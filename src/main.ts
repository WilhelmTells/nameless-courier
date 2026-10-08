import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { FALL_HEIGHT, pogoConfig, SIM_HZ } from "./config.ts";
import { formatTime, newStats, onLaunch } from "./core/fallCore.ts";
import { parseBest, parseBestTime, parseRun, SAVE_VERSION, type RunSave } from "./core/saveCore.ts";
import { currentLine, NO_FIGURES, stepFigures, type FigureState } from "./core/figureCore.ts";
import { endingDarkEnd, endingStatsAt, endingView, openingFadeStart, openingView } from "./core/frameCore.ts";
import { advanceLoop } from "./core/loopCore.ts";
import { followYaw } from "./core/cameraCore.ts";
import { stickAxis } from "./core/pogoCore.ts";
import { inRestSpot, standAmount } from "./core/restCore.ts";
import { restOffset, restSwing, stepSwing, type SwingConfig } from "./core/swingCore.ts";
import { OrbitCamera } from "./game/camera.ts";
import { controlMode, initInput, readInput, setControlMode, setStanding, type ControlMode } from "./game/input.ts";
import { LandingMarker } from "./game/landingMarker.ts";
import { Pogo } from "./game/pogo.ts";
import { buildLevel } from "./game/world.ts";
import type { FlyCamera } from "./game/flyCamera.ts";
import { DEFAULT_LEVEL, LEVEL_ALIASES, levelFromSearch, teleportTargets, type TeleportTarget } from "./levels/index.ts";
import { createFigure } from "./render/figureRig.ts";
import { createPogoRig } from "./render/pogoRig.ts";
import { RetroPass } from "./render/retroPass.ts";
import { addArchitecture, addBeacon, addSkyline } from "./render/worldLook.ts";
import { addDressing } from "./render/dressing.ts";
import { addCrows } from "./render/crows.ts";
import { addAtmosphere, capeWind } from "./render/atmosphere.ts";
import { addNightLife } from "./render/nightLife.ts";
import { addInteriors } from "./render/interiors.ts";
import { addClubDoor } from "./render/clubDoor.ts";
import { addRain } from "./render/rain.ts";
import { addAmbience } from "./audio/ambience.ts";
import { addClub } from "./audio/club.ts";
import { Sound } from "./audio/engine.ts";
import { addMurmur } from "./audio/murmur.ts";
import { addRainSound } from "./audio/rain.ts";
import { addTitleSong } from "./audio/titleSong.ts";
import { addPogoSounds } from "./audio/pogoSounds.ts";
import { WATER } from "./levels/surroundings.ts";
import { ENDING, FIGURE_LINES, OPENING } from "./story.ts";
import { startMusic, type Volumes } from "./core/audioCore.ts";
import { Screens } from "./ui/screens.ts";
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
/** The courier turns towards leans within this angle of where they face; further back (braking) they keep facing, degrees. */
const FACING_MAX_ANGLE = 100;
const TITLE = "The Endless Journey of a Nameless Courier";
/** Reaching this rest spot ends the run. */
const SUMMIT_ID = "summit";
/** Below this the courier is in the floodwater (user: back to the start), m. */
const SINK_Y = WATER + 0.5;
/** The screen fades to black while the courier sinks, then back up at the start, s. */
const SINK_FADE = 0.9;
const SURFACE_FADE = 0.7;

/**
 * title: menu over the paused game. opening: the opening text, then a fade
 * into the game. play: the climb. ending: the summit was reached; the
 * timer has stopped and the ending text plays. paused: Esc during play; the
 * mouse is free and the pause menu shows.
 */
type Mode = "title" | "opening" | "play" | "paused" | "ending";

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
  // First, so the first click or key press (even on the title) starts the sound.
  const sound = new Sound();

  await RAPIER.init();
  const physics = new RAPIER.World({ x: 0, y: -pogoConfig.gravity, z: 0 });
  physics.timestep = SIM_DT;
  // Test levels stand on a plain floor; the structure brings its own ground (plaza, water).
  const testLevel = LEVEL.zones.length === 0;
  if (testLevel) {
    physics.createCollider(
      RAPIER.ColliderDesc.cuboid(FLOOR_SIZE / 2, 0.5, FLOOR_SIZE / 2).setTranslation(0, -0.5, 0),
    );
  }
  const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const retro = new RetroPass(renderer);

  const scene = new THREE.Scene();
  // Cold blue-grey fog and moonlight; warm light comes only from lamps and windows.
  const fogColor = new THREE.Color(0x1c1f25);
  const fog = new THREE.Fog(fogColor, 14, 48);
  scene.fog = fog;
  // The background is the fog's own colour, so a flash of lightning lights both.
  scene.background = fog.color;

  const orbit = new OrbitCamera(new THREE.PerspectiveCamera(60, 1, 0.1, 200), canvas, physics);
  const camera = orbit.camera;

  const sky = new THREE.HemisphereLight(0xb4bccb, 0x2e2a25, 1.15);
  scene.add(sky);
  const moon = new THREE.DirectionalLight(0xd0d6e4, 1.25);
  moon.position.set(-6, 9, -5);
  scene.add(moon);

  // Test levels keep a plain floor with a grid for judging distances.
  if (testLevel) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE), new THREE.MeshLambertMaterial({ color: 0x77777a }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const grid = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x505055, 0x5c5c60);
    grid.position.y = 0.001;
    scene.add(grid);
  }
  const updateBeacon = LEVEL.zones.length > 0 ? addBeacon(scene) : () => {};
  if (LEVEL.zones.length > 0) {
    addSkyline(scene);
    addInteriors(scene);
  }
  const updateWindows = LEVEL.zones.length > 0 ? addArchitecture(LEVEL, scene) : () => {};
  const updateDressing = LEVEL.zones.length > 0 ? addDressing(LEVEL, scene) : () => {};
  const crows = LEVEL.zones.length > 0 ? addCrows(LEVEL, scene) : null;
  const updateAtmosphere = LEVEL.zones.length > 0 ? addAtmosphere(scene) : () => {};
  const capeGust = new THREE.Vector3();
  // After every lantern is placed (figures, lamps), so the moths find them all.
  const updateNightLife = LEVEL.zones.length > 0 ? addNightLife(scene, sky, fog.color) : () => {};

  const updateAmbience = addAmbience(sound, LEVEL.rooms ?? []);
  const updatePogoSounds = addPogoSounds(sound);
  const club = addClub(sound, LEVEL.clubs ?? []);
  const updateTitleSong = addTitleSong(sound);
  const updateMurmur = addMurmur(sound, LEVEL.figures);
  // It rains all the time on the structure (user).
  const raining = LEVEL.zones.length > 0;
  const updateRain = raining ? addRain(scene, LEVEL.rooms ?? []) : () => {};
  const updateRainSound = raining ? addRainSound(sound, LEVEL.rooms ?? []) : () => {};
  const updateClubDoor = LEVEL.zones.length > 0 ? addClubDoor(scene) : () => {};

  const levelWorld = buildLevel(LEVEL, scene, physics);
  // Build the query structures once, so the pogo, camera and marker can cast
  // against the level before the first simulation step.
  physics.step();

  const pogo = new Pogo(START, physics, LEVEL.restSpots, levelWorld);
  const rig = createPogoRig();
  scene.add(rig.group);

  const marker = new LandingMarker(physics);
  scene.add(marker.group);

  const figureRigs = LEVEL.figures.map(createFigure);
  for (const f of figureRigs) scene.add(f.group);

  let stats = newStats(START.y);
  const saved = SAVES ? parseRun(readStorage(RUN_KEY), LEVEL.id, LEVEL_ALIASES) : null;
  if (saved) {
    pogo.restore(saved.pogo);
    orbit.yaw = saved.yaw;
    stats = saved.stats;
  }
  let figures: FigureState = saved ? { memory: saved.figures, talk: null } : NO_FIGURES;
  // Moving pieces follow the run clock, so a reload puts them where they were.
  const placeMovers = (t: number) => {
    levelWorld.place(t);
    physics.step();
  };
  placeMovers(stats.time);
  const savedBest = SAVES ? parseBest(readStorage(BEST_KEY)) : null;
  if (savedBest !== null) stats.best = Math.max(stats.best, savedBest);
  /** Best clear time, s; null before the first clear. */
  let bestTime = SAVES ? parseBestTime(readStorage(BEST_KEY)) : null;
  let seenLaunches = pogo.launches;

  // Test levels skip the title and go straight to play.
  let mode: Mode = SAVES ? "title" : "play";
  /** Time in the opening or the ending, s. */
  let modeTime = 0;
  /** Simulation time since the summit was reached: the world keeps moving while the timer has stopped, s. */
  let afterSummit = 0;
  const worldTime = () => stats.time + afterSummit;
  const summit = LEVEL.restSpots.filter((r) => r.id === SUMMIT_ID);

  const writeBest = () => writeStorage(BEST_KEY, JSON.stringify(bestTime === null ? { height: stats.best } : { height: stats.best, time: bestTime }));
  let sinceSave = 0;
  const save = () => {
    if (!SAVES || (mode !== "play" && mode !== "paused")) return;
    const run: RunSave = { version: SAVE_VERSION, level: LEVEL.id, pogo: pogo.snapshot(), yaw: orbit.yaw, stats, figures: { ...figures.memory } };
    writeStorage(RUN_KEY, JSON.stringify(run));
    writeBest();
    sinceSave = 0;
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
  window.addEventListener("pagehide", save);
  /** Starts over at the bottom. `keepBest` keeps the best height and clear time (the debug tool clears them). */
  const newRun = (keepBest: boolean) => {
    const best = stats.best;
    if (SAVES) {
      writeStorage(RUN_KEY, null);
      if (!keepBest) writeStorage(BEST_KEY, null);
    }
    pogo.reset(START);
    orbit.yaw = 0;
    stats = newStats(START.y);
    if (keepBest) stats.best = Math.max(stats.best, best);
    else bestTime = null;
    afterSummit = 0;
    figures = NO_FIGURES;
    placeMovers(stats.time);
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
  const speech = document.querySelector<HTMLDivElement>("#speech")!;
  let speechLine = "";
  // A line fades out with its text still there; the next line replaces it.
  const showSpeech = () => {
    const line = currentLine(figures.talk, FIGURE_LINES);
    if (line === speechLine) return;
    speechLine = line;
    if (line !== "") speech.textContent = line;
    speech.classList.toggle("shown", line !== "");
  };

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
    createDebugPanel(pogo, () => pogo.reset(START), () => { newRun(false); play(); }, teleportTargets(LEVEL), teleport, flyCam, dropHere);
  }

  const hud = document.querySelector<HTMLDivElement>("#hud")!;
  const screens = new Screens();
  const lockPointer = () => {
    // A rejected lock (e.g. too soon after leaving it) is fine: a click on the game locks it.
    Promise.resolve(canvas.requestPointerLock()).catch(() => {});
  };
  const play = () => {
    mode = "play";
    screens.hide();
    hud.hidden = false;
    lockPointer();
  };
  const startOpening = () => {
    newRun(true);
    mode = "opening";
    modeTime = 0;
    hud.hidden = true;
    screens.show(1);
    screens.setLines(OPENING);
    lockPointer();
  };
  const showTitle = () => {
    const hasRun = SAVES && parseRun(readStorage(RUN_KEY), LEVEL.id, LEVEL_ALIASES) !== null;
    const confirmNew = () =>
      screens.ask("Start a new run? The current run will be lost.", [
        { label: "Start over", action: startOpening },
        { label: "Back", action: showTitle },
      ]);
    mode = "title";
    hud.hidden = true;
    screens.title(TITLE, [
      ...(hasRun ? [{ label: "Continue", action: play }] : []),
      { label: "New run", action: hasRun ? confirmNew : startOpening },
      { label: "Settings", action: () => showSettings(showTitle) },
    ]);
  };
  /** How to play, for the settings screen (the on-screen hints are gone). */
  const CONTROLS_HELP: Record<ControlMode, string> = {
    mouse: [
      "Mouse          lean (the stick stays where you leave it)",
      "Left button    hold to charge, release to jump (or Space)",
      "Right button   hold to turn the camera",
      "Wheel          zoom",
      "R              camera behind you",
      "E              get off at a calm spot, and back on",
      "Esc            pause",
    ].join("\n"),
    wasd: [
      "W A S D        lean",
      "Space          hold to charge, release to jump",
      "Mouse          turn the camera",
      "Wheel          zoom",
      "R              camera behind you",
      "E              get off at a calm spot, and back on",
      "Esc            pause",
    ].join("\n"),
  };
  /** Settings: the control scheme, and how it plays. `back` returns to where it was opened. */
  const showSettings = (back: () => void) => {
    const pick = (m: ControlMode) => () => {
      setControlMode(m);
      showSettings(back);
    };
    const mark = (m: ControlMode) => (controlMode() === m ? "● " : "○ ");
    screens.ask(`Settings\n\nControls\n\n${CONTROLS_HELP[controlMode()]}`, [
      { label: `${mark("mouse")}Mouse`, action: pick("mouse") },
      { label: `${mark("wasd")}Keyboard (W A S D)`, action: pick("wasd") },
      { label: "Back", action: back },
    ]);
    const volume = (key: keyof Volumes) => (v: number) => sound.setVolumes({ ...sound.getVolumes(), [key]: v });
    const v = sound.getVolumes();
    screens.setSliders([
      { label: "Volume", value: v.master, change: volume("master") },
      { label: "Ambience", value: v.ambience, change: volume("ambience") },
      { label: "Music", value: v.music, change: volume("music") },
      { label: "Effects", value: v.effects, change: volume("effects") },
      { label: "Rain", value: v.rain, change: volume("rain") },
    ]);
  };
  // Fallen into the water: fade out, start again at the bottom, fade back in.
  // The run goes on (time and falls are kept).
  let sinkTime = -1;
  let surfaceTime = -1;
  const stepSinking = (dt: number) => {
    // Held while paused.
    if (mode !== "play") return;
    if (sinkTime < 0 && surfaceTime < 0) {
      if (testLevel || pogo.pos.y > SINK_Y) return;
      sinkTime = 0;
      screens.show(0);
    }
    if (sinkTime >= 0) {
      sinkTime += dt;
      screens.setBlack(Math.min(1, sinkTime / SINK_FADE));
      if (sinkTime < SINK_FADE) return;
      sinkTime = -1;
      surfaceTime = 0;
      pogo.reset(START);
      orbit.yaw = 0;
      stats = { ...stats, height: START.y, fallRef: START.y };
      seenLaunches = pogo.launches;
    }
    surfaceTime += dt;
    screens.setBlack(Math.max(0, 1 - surfaceTime / SURFACE_FADE));
    if (surfaceTime >= SURFACE_FADE) {
      surfaceTime = -1;
      screens.hide();
    }
  };
  const pause = () => {
    if (mode !== "play") return;
    mode = "paused";
    showPauseMenu();
  };
  const showPauseMenu = () => {
    hud.hidden = true;
    screens.title("Paused", [
      { label: "Resume", action: play },
      { label: "Settings", action: () => showSettings(showPauseMenu) },
      { label: "Quit to title", action: () => (save(), showTitle()) },
    ]);
  };
  // Esc frees the mouse: during play that pauses the game.
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement !== canvas) pause();
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && mode === "play") pause();
  });

  const startEnding = () => {
    mode = "ending";
    modeTime = 0;
    bestTime = bestTime === null ? stats.time : Math.min(bestTime, stats.time);
    if (SAVES) {
      // The run is over: nothing left to continue.
      writeStorage(RUN_KEY, null);
      writeBest();
    }
    screens.show(0);
    screens.setLines(ENDING);
  };
  const showEndingStats = () => {
    document.exitPointerLock();
    screens.setInfo([`time   ${formatTime(stats.time)}`, `falls  ${stats.falls}`, `best   ${formatTime(bestTime ?? stats.time)}`].join("\n"));
    screens.setMenu([{ label: "New run", action: startOpening }]);
  };
  // Any key or click skips ahead: the opening to its fade, the ending (once dark) to its stats.
  const skip = () => {
    if (mode === "opening") modeTime = Math.max(modeTime, openingFadeStart(OPENING.length));
    if (mode === "ending" && modeTime >= endingDarkEnd()) modeTime = Math.max(modeTime, endingStatsAt(ENDING.length));
  };
  window.addEventListener("keydown", (e) => {
    if (!e.repeat) skip();
  });
  window.addEventListener("mousedown", skip);
  // First a plain screen with the name and Play (user): that click also
  // starts the sound (browsers only allow audio after a gesture), so the
  // title song plays under the menu that follows.
  const showSplash = () => {
    hud.hidden = true;
    screens.splash(TITLE.replace(" of ", "\nof "), [{ label: "Play", action: showTitle }]);
  };
  if (mode === "title") showSplash();

  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    retro.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // The courier faces where they lean (visual only); braking leans back do not turn them.
  let facing = orbit.yaw;
  const facingTurn = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const axis = new THREE.Vector3();
  // The cape's hem swings on a spring below the shoulders, this far up the
  // staff from the tip (visual only).
  const CAPE_ANCHOR = 1.45;
  const capeConfig = (): SwingConfig => ({
    stiffness: pogoConfig.capeStiffness,
    damping: pogoConfig.capeDamping,
    maxSwing: pogoConfig.capeMaxSwing,
  });
  const capeAnchor = () => {
    const a = stickAxis(pogo.lean);
    return { x: pogo.pos.x + a.x * CAPE_ANCHOR, y: pogo.pos.y + a.y * CAPE_ANCHOR, z: pogo.pos.z + a.z * CAPE_ANCHOR };
  };
  let cape = restSwing(pogoConfig.gravity, capeConfig());
  let prevCapeOffset = cape.offset;
  let lastAnchor = capeAnchor();
  let anchorVel = { x: 0, y: 0, z: 0 };
  const stepCape = (dt: number) => {
    const p = capeAnchor();
    const v = { x: (p.x - lastAnchor.x) / dt, y: (p.y - lastAnchor.y) / dt, z: (p.z - lastAnchor.z) / dt };
    const dv = { x: v.x - anchorVel.x, y: v.y - anchorVel.y, z: v.z - anchorVel.z };
    lastAnchor = p;
    anchorVel = v;
    prevCapeOffset = cape.offset;
    cape = stepSwing(cape, dv, pogoConfig.gravity, capeConfig(), dt);
  };
  const capeTrail = new THREE.Vector3();
  const rigTurnBack = new THREE.Quaternion();
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
      retro.render(scene, camera);
      return;
    }

    let simulate = mode === "play" || mode === "ending";
    if (mode === "opening") {
      modeTime += frameDt;
      const view = openingView(modeTime, OPENING.length);
      screens.reveal(view.lines);
      screens.setFade(view.black);
      // The game starts under the fade.
      simulate = view.black < 1;
      if (view.done) play();
    } else if (mode === "ending") {
      // A figure talking at the summit has the last word before the screen darkens.
      if (figures.talk === null) modeTime += frameDt;
      const view = endingView(modeTime, ENDING.length);
      screens.setBlack(view.black);
      screens.reveal(view.lines);
      if (view.stats && !screens.hasMenu()) showEndingStats();
    }

    const loop = advanceLoop(accumulator, frameDt, SIM_DT);
    accumulator = simulate ? loop.accumulator : 0;
    for (let i = 0; simulate && i < loop.steps; i++) {
      const input = readInput();
      if (mode === "ending") {
        // At the summit the courier lets go: upright, and off the pogo at the next landing.
        const r = pogo.ride;
        const getOff = r.phase === "riding" && !r.requested && pogo.inRestSpot();
        pogo.step({ mode: "wasd", lean: { x: 0, z: 0 }, charge: false, mouse: { dx: 0, dy: 0 }, toggleRide: getOff }, orbit.yaw, SIM_DT);
        afterSummit += SIM_DT;
      } else {
        pogo.step(input, orbit.yaw, SIM_DT);
        stats.time += SIM_DT;
      }
      stepCape(SIM_DT);
      levelWorld.advance(worldTime());
      physics.step();
      figures = stepFigures(figures, LEVEL.figures, FIGURE_LINES, pogo.pos, SIM_DT);
      if (pogo.launches !== seenLaunches) {
        seenLaunches = pogo.launches;
        if (mode !== "ending") {
          stats = onLaunch(stats, pogo.groundY, FALL_HEIGHT);
          if (summit.length > 0 && inRestSpot(summit, pogo.pos)) startEnding();
        }
      }
      sinceSave += SIM_DT;
      if (sinceSave >= SAVE_INTERVAL) save();
    }

    stepSinking(Math.min(0.1, Math.max(0, frameDt)));

    // Interpolate between the last two simulation states.
    const a = loop.alpha;
    levelWorld.render(worldTime() - SIM_DT * (1 - a));
    for (const f of figureRigs) f.update(worldTime());
    updateBeacon(time / 1000);
    updateDressing(time / 1000);
    updateWindows(tip, time / 1000);
    crows?.update(tip, time / 1000, Math.min(0.1, Math.max(0, frameDt)));
    updateAtmosphere(tip, time / 1000, Math.min(0.1, Math.max(0, frameDt)));
    updateNightLife(time / 1000, tip);
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
    facing = followYaw(facing, pogo.lean, pogoConfig.mouseDeadzone, FACING_MAX_ANGLE, pogoConfig.turnTime, Math.max(0, frameDt));
    rig.group.quaternion
      .setFromUnitVectors(up, axis.set(s.x, s.y, s.z))
      .multiply(facingTurn.setFromAxisAngle(up, facing));
    rig.setStand(standAmount(pogo.ride, pogoConfig));
    // The hem's swing, from world space into the rig's.
    const capeRest = restOffset(pogoConfig.gravity, capeConfig());
    capeTrail
      .set(
        prevCapeOffset.x + (cape.offset.x - prevCapeOffset.x) * a - capeRest.x,
        prevCapeOffset.y + (cape.offset.y - prevCapeOffset.y) * a - capeRest.y,
        prevCapeOffset.z + (cape.offset.z - prevCapeOffset.z) * a - capeRest.z,
      )
      // The wind tugs at the cape, harder higher up.
      .add(capeWind(time / 1000, tip.y, capeGust))
      .applyQuaternion(rigTurnBack.copy(rig.group.quaternion).invert());
    rig.setCape(capeTrail, time / 1000, Math.hypot(pogo.vel.x, pogo.vel.y, pogo.vel.z));

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
    showSpeech();
    // The figure murmurs while its line is on screen.
    updateMurmur(speechLine !== "" ? (figures.talk?.id ?? null) : null);
    setStanding(pogo.ride.phase !== "riding");
    chargeFill.style.width = `${pogo.charge.charge * 100}%`;
    chargeBar.classList.toggle("armed", pogo.charge.armed);

    // The pogo and the figures are heard only in play; menus keep the ambience.
    sound.setMenu(mode === "title" || mode === "paused");
    sound.listen(camera);
    updateRain(camera.position, time / 1000, Math.min(0.1, Math.max(0, frameDt)));
    updateRainSound(tip, time / 1000);
    updateAmbience(tip, time / 1000);
    // The title song plays on the title screen and carries on at the bottom of
    // the climb, fading with height; the club plays everywhere but the title.
    updateTitleSong(mode === "title" ? 1 : mode === "ending" ? 0 : startMusic(tip.y));
    club.update(tip, mode !== "title");
    updateClubDoor(club.pulse());
    updatePogoSounds({ pos: pogo.pos, vel: pogo.vel, charge: pogo.charge, riding: pogo.ride.phase === "riding", sounds: pogo.sounds });

    retro.render(scene, camera);
  });
}

boot();
