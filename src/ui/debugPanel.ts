// Development panel, only loaded with ?debug: live sliders for every pogo
// value and readouts of the simulation.

import GUI from "lil-gui";
import { DEFAULT_POGO, pogoConfig, type PogoConfig } from "../config.ts";
import type { Pogo } from "../game/pogo.ts";

const STORAGE_KEY = "courier.debugConfig";

type Range = [min: number, max: number, step: number];

const RANGES: Record<keyof PogoConfig, Range> = {
  gravity: [5, 40, 0.5],
  idleHopApex: [0, 2, 0.05],
  normalApex: [0.2, 3, 0.05],
  chargedApex: [1, 10, 0.1],
  chargeTime: [0.2, 3, 0.05],
  chargeCurve: [0.3, 3, 0.05],
  maxLean: [5, 60, 1],
  leanRate: [30, 720, 10],
  returnRate: [30, 720, 10],
  keepHorizontal: [0, 1, 0.05],
  squashTime: [0, 0.3, 0.01],
};

const FOLDERS: [string, (keyof PogoConfig)[]][] = [
  ["Bounce", ["gravity", "idleHopApex", "normalApex", "chargedApex"]],
  ["Charge", ["chargeTime", "chargeCurve"]],
  ["Lean", ["maxLean", "leanRate", "returnRate"]],
  ["Launch", ["keepHorizontal", "squashTime"]],
];

function load(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<PogoConfig>;
    for (const key of Object.keys(DEFAULT_POGO) as (keyof PogoConfig)[]) {
      if (typeof saved[key] === "number") pogoConfig[key] = saved[key];
    }
  } catch {
    // Storage unavailable or corrupt: keep the defaults.
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pogoConfig));
  } catch {
    // Storage unavailable: values last until reload.
  }
}

export function createDebugPanel(pogo: Pogo, resetPosition: () => void): void {
  load();
  const gui = new GUI({ title: "Debug" });

  const readout = { height: "", speed: "", charge: "", lastApex: "" };
  const live = gui.addFolder("Readout");
  for (const key of Object.keys(readout) as (keyof typeof readout)[]) live.add(readout, key).disable().listen();
  const update = () => {
    readout.height = `${pogo.pos.y.toFixed(2)} m`;
    readout.speed = `${Math.hypot(pogo.vel.x, pogo.vel.z).toFixed(2)} m/s horiz.`;
    readout.charge = `${pogo.charge.charge.toFixed(2)}${pogo.charge.armed ? " armed" : ""}`;
    readout.lastApex = `${pogo.lastApex.toFixed(2)} m`;
    requestAnimationFrame(update);
  };
  update();

  for (const [name, keys] of FOLDERS) {
    const folder = gui.addFolder(name);
    for (const key of keys) {
      const [min, max, step] = RANGES[key];
      folder.add(pogoConfig, key, min, max, step).onChange(save);
    }
  }

  const actions = {
    copyValues: () => navigator.clipboard?.writeText(JSON.stringify(pogoConfig, null, 2)),
    resetValues: () => {
      Object.assign(pogoConfig, DEFAULT_POGO);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      save();
    },
    resetPosition,
  };
  const tools = gui.addFolder("Tools");
  tools.add(actions, "copyValues").name("Copy values");
  tools.add(actions, "resetValues").name("Reset values");
  tools.add(actions, "resetPosition").name("Back to start");
}
