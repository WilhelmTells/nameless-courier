// Development panel, only loaded with ?debug: live sliders for every pogo and
// camera value and readouts of the simulation.

import GUI from "lil-gui";
import { cameraConfig, DEFAULT_CAMERA, DEFAULT_POGO, pogoConfig, type CameraConfig, type PogoConfig } from "../config.ts";
import { controlMode, onControlModeChange, setControlMode, type ControlMode } from "../game/input.ts";
import type { Pogo } from "../game/pogo.ts";

type Range = [min: number, max: number, step: number];

interface ConfigGroup<T extends object> {
  storageKey: string;
  live: T;
  defaults: Readonly<T>;
  /** Slider ranges for numeric values; booleans get a checkbox. */
  ranges: Partial<Record<keyof T, Range>>;
  folders: [string, (keyof T)[]][];
}

const POGO: ConfigGroup<PogoConfig> = {
  storageKey: "courier.debugConfig",
  live: pogoConfig,
  defaults: DEFAULT_POGO,
  ranges: {
    gravity: [5, 40, 0.5],
    idleHopApex: [0, 2, 0.05],
    normalApex: [0.2, 3, 0.05],
    chargedApex: [1, 20, 0.1],
    chargeTime: [0.2, 3, 0.05],
    chargeCurve: [0.3, 3, 0.05],
    maxLean: [5, 80, 1],
    leanRate: [30, 720, 10],
    returnRate: [30, 720, 10],
    mouseLeanSensitivity: [0.02, 0.6, 0.01],
    mouseDeadzone: [0, 20, 0.5],
    keepHorizontal: [0, 0.95, 0.05],
    keepWithoutInput: [0, 0.95, 0.05],
    leanPush: [0, 2, 0.05],
    squashTime: [0, 0.3, 0.01],
    wallAngle: [30, 89, 1],
    floorContactLimit: [20, 90, 1],
    slopeBlend: [0, 1, 0.05],
    wallKickFactor: [0, 1.5, 0.05],
    wallKickSpeed: [0, 15, 0.5],
    wallKickAngle: [10, 90, 1],
    bonkRestitution: [0, 1, 0.05],
    bonkKeep: [0, 1, 0.05],
    bonkMinSpeed: [0, 5, 0.1],
    bonkLockTime: [0, 1, 0.05],
    wallPushSpeed: [0, 6, 0.1],
    bounceRetain: [0, 0.9, 0.05],
    maxCarriedApex: [1, 20, 0.5],
  },
  folders: [
    ["Bounce", ["gravity", "idleHopApex", "normalApex", "chargedApex", "bounceRetain", "maxCarriedApex"]],
    ["Charge", ["chargeTime", "chargeCurve"]],
    ["Lean", ["maxLean", "leanRate", "returnRate", "holdLeanInAir", "mouseLeanSensitivity", "mouseDeadzone"]],
    ["Momentum", ["keepHorizontal", "keepWithoutInput", "leanPush"]],
    ["Walls & slopes", ["wallAngle", "floorContactLimit", "slopeBlend", "wallKickFactor", "wallKickSpeed", "wallKickAngle"]],
    ["Bonk", ["bonkRestitution", "bonkKeep", "bonkMinSpeed", "bonkLockTime", "wallPushSpeed"]],
    ["Visual", ["squashTime"]],
  ],
};

const CAMERA: ConfigGroup<CameraConfig> = {
  storageKey: "courier.debugCamera",
  live: cameraConfig,
  defaults: DEFAULT_CAMERA,
  ranges: {
    sensitivity: [0.0005, 0.01, 0.0001],
    pitchMin: [-45, 0, 1],
    pitchMax: [30, 89, 1],
    distanceMin: [1, 10, 0.1],
    distanceMax: [4, 30, 0.1],
    zoomStep: [0.1, 2, 0.1],
    focusHeight: [0, 3, 0.05],
    verticalLag: [0, 1.5, 0.01],
    collisionRadius: [0.05, 1, 0.05],
    pushOutRate: [0.5, 30, 0.5],
    markerViewAngle: [5, 30, 1],
    tiltRate: [10, 360, 5],
  },
  folders: [
    ["Camera: mouse", ["sensitivity", "invertY", "pitchMin", "pitchMax"]],
    ["Camera: distance", ["distanceMin", "distanceMax", "zoomStep", "collisionRadius", "pushOutRate"]],
    ["Camera: follow", ["focusHeight", "verticalLag", "markerViewAngle", "tiltRate"]],
  ],
};

function load<T extends object>(group: ConfigGroup<T>): void {
  try {
    const saved = JSON.parse(localStorage.getItem(group.storageKey) ?? "{}") as Partial<T>;
    for (const key of Object.keys(group.defaults) as (keyof T)[]) {
      if (typeof saved[key] === typeof group.defaults[key]) group.live[key] = saved[key] as T[keyof T];
    }
  } catch {
    // Storage unavailable or corrupt: keep the defaults.
  }
}

function save<T extends object>(group: ConfigGroup<T>): void {
  try {
    localStorage.setItem(group.storageKey, JSON.stringify(group.live));
  } catch {
    // Storage unavailable: values last until reload.
  }
}

function addGroup<T extends object>(gui: GUI, group: ConfigGroup<T>): void {
  load(group);
  for (const [name, keys] of group.folders) {
    const folder = gui.addFolder(name);
    for (const key of keys) {
      const range = group.ranges[key];
      const c = range ? folder.add(group.live, key, ...range) : folder.add(group.live, key);
      c.onChange(() => save(group));
    }
    if (name.startsWith("Camera")) folder.close();
  }
}

export function createDebugPanel(pogo: Pogo, resetPosition: () => void): void {
  const gui = new GUI({ title: "Debug" });

  const settings = { controls: controlMode() };
  const controls = gui
    .add(settings, "controls", { WASD: "wasd", Mouse: "mouse" })
    .name("Controls")
    .onChange((mode: ControlMode) => setControlMode(mode));
  onControlModeChange((mode) => {
    settings.controls = mode;
    controls.updateDisplay();
  });

  const readout = { height: "", speed: "", charge: "", lastApex: "", contact: "" };
  const live = gui.addFolder("Readout");
  for (const key of Object.keys(readout) as (keyof typeof readout)[]) live.add(readout, key).disable().listen();
  const update = () => {
    readout.height = `${pogo.pos.y.toFixed(2)} m`;
    readout.speed = `${Math.hypot(pogo.vel.x, pogo.vel.z).toFixed(2)} m/s horiz.`;
    readout.charge = `${pogo.charge.charge.toFixed(2)}${pogo.charge.armed ? " armed" : ""}`;
    readout.lastApex = `${pogo.lastApex.toFixed(2)} m`;
    const c = pogo.lastContact;
    readout.contact = c ? `${c.kind}, ${c.angle.toFixed(0)}° to normal` : "none";
    requestAnimationFrame(update);
  };
  update();

  addGroup(gui, POGO);
  addGroup(gui, CAMERA);

  const actions = {
    copyValues: () =>
      navigator.clipboard?.writeText(JSON.stringify({ pogo: pogoConfig, camera: cameraConfig }, null, 2)),
    resetValues: () => {
      Object.assign(pogoConfig, DEFAULT_POGO);
      Object.assign(cameraConfig, DEFAULT_CAMERA);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      save(POGO);
      save(CAMERA);
    },
    resetPosition,
  };
  const tools = gui.addFolder("Tools");
  tools.add(actions, "copyValues").name("Copy values");
  tools.add(actions, "resetValues").name("Reset values");
  tools.add(actions, "resetPosition").name("Back to start");
}
