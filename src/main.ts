import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { FALL_HEIGHT, pogoConfig, SIM_HZ } from "./config.ts";
import { formatTime, newStats, onLaunch } from "./core/fallCore.ts";
import { parseBest, parseRun, SAVE_VERSION, type RunSave } from "./core/saveCore.ts";
import { advanceLoop } from "./core/loopCore.ts";
import { stickAxis } from "./core/pogoCore.ts";
import { standAmount } from "./core/restCore.ts";
import { OrbitCamera } from "./game/camera.ts";
import { controlMode, initInput, onControlModeChange, readInput, setStanding, type ControlMode } from "./game/input.ts";
import { LandingMarker } from "./game/landingMarker.ts";
import { Pogo } from "./game/pogo.ts";
import { buildLevel } from "./game/world.ts";
import type { FlyCamera } from "./game/flyCamera.ts";
import { DEFAULT_LEVEL, LEVEL_ALIASES, levelFromSearch, teleportTargets, type TeleportTarget } from "./levels/index.ts";
import { createPogoRig } from "./render/pogoRig.ts";
import { VERSION } from "./version.ts";

const FLOOR_SIZE = 1000; // metres, large enough that its edge is lost in fog
const GRID_SIZE = 200;
const SIM_DT = 1 / SIM_HZ;
const LEVEL = levelFromSearch(location.search);
const START = LEVEL.start;
/** Only the game's own level is saved; test levels always start fresh. */
const SAVES = LEVEL === DEFAULT_LEVEL;
const RUN_KEY = "courier.run";
const BEST_KEY = "courier.best";
/** Simulation time between saves, s. */
const SAVE_INTERVAL = 1;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the run lasts until reload.
  }
}

async function boot(): Promise<void> {
  document.querySelector<HTMLDivElement>("#version")!.textContent = VERSION;

  await RAPIER.init();
  const physics = new RAPIER.World({ x: 0, y: -pogoConfig.gravity, z: 0 });
  physics.timestep = SIM_DT;
  physics.createCollider(
    RAPIER.ColliderDesc.cuboid(FLOOR_SIZE / 2, 0.5, FLOOR_SIZE / 2).setTranslation(0, -0.5, 0),
  );
  const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0x1a1b1d);
  scene.background = fogColor;
  scene.fog = new THREE.Fog(fogColor, 15, 45);

  const orbit = new OrbitCamera(new THREE.PerspectiveCamera(60, 1, 0.1, 200), canvas, physics);
  const camera = orbit.camera;

  scene.add(new THREE.HemisphereLight(0xd8d6d0, 0x3a3836, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(5, 10, 3);
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
    new THREE.MeshLambertMaterial({ color: 0x77777a }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const grid = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x505055, 0x5c5c60);
  grid.position.y = 0.001;
  scene.add(grid);

  buildLevel(LEVEL, scene, physics);
  // Build the query structures once, so the pogo, camera and marker can cast
  // against the level before the first simulation step.
  physics.step();

  const pogo = new Pogo(START, physics, LEVEL.restSpots);
  const rig = createPogoRig();
  scene.add(rig.group);

  const marker = new LandingMarker(physics);
  scene.add(marker.group);

  let stats = newStats(START.y);
  const saved = SAVES ? parseRun(readStorage(RUN_KEY), LEVEL.id, LEVEL_ALIASES) : null;
  if (saved) {
    pogo.restore(saved.pogo);
    orbit.yaw = saved.yaw;
    stats = saved.stats;
  }
  const savedBest = SAVES ? parseBest(readStorage(BEST_KEY)) : null;
  if (savedBest !== null) stats.best = Math.max(stats.best, savedBest);
  let seenLaunches = pogo.launches;

  let sinceSave = 0;
  const save = () => {
    if (!SAVES) return;
    const run: RunSave = { version: SAVE_VERSION, level: LEVEL.id, pogo: pogo.snapshot(), yaw: orbit.yaw, stats };
    writeStorage(RUN_KEY, JSON.stringify(run));
    writeStorage(BEST_KEY, JSON.stringify({ height: stats.best }));
    sinceSave = 0;
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
  window.addEventListener("pagehide", save);
  const newRun = () => {
    if (SAVES) {
      writeStorage(RUN_KEY, null);
      writeStorage(BEST_KEY, null);
    }
    pogo.reset(START);
    orbit.yaw = 0;
    stats = newStats(START.y);
    seenLaunches = pogo.launches;
  };
  const statsLabel = document.querySelector<HTMLDivElement>("#stats")!;
  let statsText = "";
  // Adding 0 turns -0 into 0, so tiny negative heights never show as "-0.0".
  const metres = (h: number) => `${(Math.round(h * 10) / 10 + 0).toFixed(1)} m`;
  const showStats = () => {
    const text = [
      `height ${metres(stats.height)}`,
      `best   ${metres(stats.best)}`,
      `time   ${formatTime(stats.time)}`,
      `falls  ${stats.falls}`,
    ].join("\n");
    if (text !== statsText) statsLabel.textContent = statsText = text;
  };

  const chargeFill = document.querySelector<HTMLDivElement>("#charge-fill")!;
  const chargeBar = document.querySelector<HTMLDivElement>("#charge")!;

  initInput(canvas);
  const rideHint = document.querySelector<HTMLDivElement>("#ride-hint")!;
  let rideHintText = "";
  const showRideHint = () => {
    const r = pogo.ride;
    const text =
      r.phase === "standing" ? "E: get on" :
      r.phase === "riding" && pogo.inRestSpot() ? (r.requested ? "getting off…" : "E: get off") : "";
    if (text !== rideHintText) rideHint.textContent = rideHintText = text;
  };
  const controlsLabel = document.querySelector<HTMLDivElement>("#controls")!;
  const showControls = (mode: ControlMode) => {
    controlsLabel.textContent =
      mode === "mouse" ? "Mouse controls · right mouse: camera · C: switch" : "WASD controls · C: switch";
  };
  showControls(controlMode());
  onControlModeChange(showControls);

  /** Debug fly camera; while it flies the game is paused. */
  let fly: FlyCamera | null = null;
  if (new URLSearchParams(location.search).has("debug")) {
    const { createDebugPanel } = await import("./ui/debugPanel.ts");
    const { FlyCamera } = await import("./game/flyCamera.ts");
    // A teleport is not a fall: the fall reference moves with the pogo.
    const teleport = ({ point }: TeleportTarget) => {
      pogo.reset(point);
      stats = { ...stats, height: point.y, fallRef: point.y };
      seenLaunches = pogo.launches;
    };
    const flyCam = new FlyCamera(camera, canvas);
    // Flying looks at the whole map: fog and view distance are pushed back.
    const fog = scene.fog as THREE.Fog;
    const view = { fogFar: fog.far, cameraFar: camera.far };
    flyCam.onChange((active) => {
      orbit.active = !active;
      fog.far = active ? 400 : view.fogFar;
      camera.far = active ? 1000 : view.cameraFar;
      camera.updateProjectionMatrix();
    });
    // Put the pogo on the surface below the fly camera and end fly mode.
    // Nothing happens when the camera is inside a block or above nothing.
    const dropHere = () => {
      if (!flyCam.active) return;
      const p = flyCam.position();
      const hit = physics.castRay(new RAPIER.Ray(p, { x: 0, y: -1, z: 0 }), 1000, true);
      if (!hit || hit.timeOfImpact < 0.01) return;
      teleport({ label: "", point: { x: p.x, y: p.y - hit.timeOfImpact, z: p.z } });
      flyCam.setActive(false);
    };
    fly = flyCam;
    createDebugPanel(pogo, () => pogo.reset(START), newRun, teleportTargets(LEVEL), teleport, flyCam, dropHere);
  }

  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  const up = new THREE.Vector3(0, 1, 0);
  const axis = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const rider = new THREE.Vector3();
  let accumulator = 0;
  let lastTime = performance.now();

  renderer.setAnimationLoop((time: number) => {
    const frameDt = (time - lastTime) / 1000;
    lastTime = time;

    if (fly?.active) {
      // Paused: no simulation, no timer, no saves; the fly camera renders.
      accumulator = 0;
      fly.update(frameDt);
      rideHint.textContent = rideHintText = "fly: WASD · Space / Shift up, down · wheel speed · Ctrl fast · F back";
      renderer.render(scene, camera);
      return;
    }

    const loop = advanceLoop(accumulator, frameDt, SIM_DT);
    accumulator = loop.accumulator;
    for (let i = 0; i < loop.steps; i++) {
      pogo.step(readInput(), orbit.yaw, SIM_DT);
      physics.step();
      stats.time += SIM_DT;
      if (pogo.launches !== seenLaunches) {
        seenLaunches = pogo.launches;
        stats = onLaunch(stats, pogo.groundY, FALL_HEIGHT);
      }
      sinceSave += SIM_DT;
      if (sinceSave >= SAVE_INTERVAL) save();
    }

    // Interpolate between the last two simulation states.
    const a = loop.alpha;
    tip.set(
      pogo.prevPos.x + (pogo.pos.x - pogo.prevPos.x) * a,
      pogo.prevPos.y + (pogo.pos.y - pogo.prevPos.y) * a,
      pogo.prevPos.z + (pogo.pos.z - pogo.prevPos.z) * a,
    );
    const s = stickAxis({
      x: pogo.prevLean.x + (pogo.lean.x - pogo.prevLean.x) * a,
      z: pogo.prevLean.z + (pogo.lean.z - pogo.prevLean.z) * a,
    });
    rig.group.position.copy(tip);
    rig.group.quaternion.setFromUnitVectors(up, axis.set(s.x, s.y, s.z));
    rig.setStand(standAmount(pogo.ride, pogoConfig));

    // Squash and stretch on launch (visual only).
    const sq = pogo.sinceLaunch < pogoConfig.squashTime ? Math.sin((Math.PI * pogo.sinceLaunch) / pogoConfig.squashTime) : 0;
    rig.group.scale.set(1 + 0.08 * sq, 1 - 0.15 * sq, 1 + 0.08 * sq);

    marker.update(tip);
    // The camera follows the rider, not the swinging tip: the point where the
    // tip would be if the stick stood upright about the pivot.
    const h = pogoConfig.pivotHeight;
    rider.set(tip.x + s.x * h, tip.y + (s.y - 1) * h, tip.z + s.z * h);
    // With mouse controls the camera turns behind the lean, and R puts it
    // behind the lean too; otherwise R uses the last movement direction.
    const mouseRiding = controlMode() === "mouse" && pogo.ride.phase === "riding";
    const leaning = Math.hypot(pogo.lean.x, pogo.lean.z) > pogoConfig.mouseDeadzone;
    const homeDir = mouseRiding && leaning ? pogo.lean : pogo.moveDir;
    orbit.update(frameDt, rider, marker.groundY, homeDir, mouseRiding ? pogo.lean : null, pogoConfig.mouseDeadzone);

    showStats();
    showRideHint();
    setStanding(pogo.ride.phase !== "riding");
    chargeFill.style.width = `${pogo.charge.charge * 100}%`;
    chargeBar.classList.toggle("armed", pogo.charge.armed);

    renderer.render(scene, camera);
  });
}

boot();
