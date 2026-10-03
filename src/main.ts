import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { pogoConfig, SIM_HZ } from "./config.ts";
import { advanceLoop } from "./core/loopCore.ts";
import { stickAxis } from "./core/pogoCore.ts";
import { OrbitCamera } from "./game/camera.ts";
import { initInput, readInput } from "./game/input.ts";
import { LandingMarker } from "./game/landingMarker.ts";
import { Pogo } from "./game/pogo.ts";
import { buildLevel } from "./game/world.ts";
import { playground } from "./levels/playground.ts";
import { createPogoRig } from "./render/pogoRig.ts";
import { VERSION } from "./version.ts";

const FLOOR_SIZE = 1000; // metres, large enough that its edge is lost in fog
const GRID_SIZE = 200;
const SIM_DT = 1 / SIM_HZ;
const START = playground.start;

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

  buildLevel(playground, scene, physics);
  // Build the query structures once, so the pogo, camera and marker can cast
  // against the level before the first simulation step.
  physics.step();

  const pogo = new Pogo(START);
  const rig = createPogoRig();
  scene.add(rig);

  const marker = new LandingMarker(physics);
  scene.add(marker.group);

  const chargeFill = document.querySelector<HTMLDivElement>("#charge-fill")!;
  const chargeBar = document.querySelector<HTMLDivElement>("#charge")!;

  initInput();

  if (new URLSearchParams(location.search).has("debug")) {
    const { createDebugPanel } = await import("./ui/debugPanel.ts");
    createDebugPanel(pogo, () => pogo.reset(START));
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
  let accumulator = 0;
  let lastTime = performance.now();

  renderer.setAnimationLoop((time: number) => {
    const frameDt = (time - lastTime) / 1000;
    lastTime = time;

    const loop = advanceLoop(accumulator, frameDt, SIM_DT);
    accumulator = loop.accumulator;
    for (let i = 0; i < loop.steps; i++) {
      pogo.step(readInput(), orbit.yaw, SIM_DT);
      physics.step();
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
    rig.position.copy(tip);
    rig.quaternion.setFromUnitVectors(up, axis.set(s.x, s.y, s.z));

    // Squash and stretch on launch (visual only).
    const sq = pogo.sinceLaunch < pogoConfig.squashTime ? Math.sin((Math.PI * pogo.sinceLaunch) / pogoConfig.squashTime) : 0;
    rig.scale.set(1 + 0.08 * sq, 1 - 0.15 * sq, 1 + 0.08 * sq);

    marker.update(tip);
    orbit.update(frameDt, tip, marker.groundY, pogo.moveDir);

    chargeFill.style.width = `${pogo.charge.charge * 100}%`;
    chargeBar.classList.toggle("armed", pogo.charge.armed);

    renderer.render(scene, camera);
  });
}

boot();
