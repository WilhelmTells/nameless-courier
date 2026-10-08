// Save data for the current run, the best height and the best clear time. Parsing checks every
// field; anything missing or malformed gives no save rather than a broken one.

import type { FigureMemory } from "./figureCore.ts";
import type { RunStats } from "./fallCore.ts";
import type { Vec2, Vec3 } from "./pogoCore.ts";

export const SAVE_VERSION = 1;

/** The pogo's state as saved: enough to continue a flight mid-air. */
export interface PogoState {
  pos: Vec3;
  vel: Vec3;
  lean: Vec2;
  charge: number;
  armed: boolean;
  /** Height of the last launch point, m. */
  launchY: number;
  /** Highest point since the last launch, m. */
  peakY: number;
  /** Off the pogo at a rest spot. Missing in older saves, which means riding. */
  standing: boolean;
}

export interface RunSave {
  version: number;
  level: string;
  pogo: PogoState;
  /** Camera facing, radians. */
  yaw: number;
  stats: RunStats;
  /** What each figure has said. Missing in older saves, which means none met. */
  figures: Record<string, FigureMemory>;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function vec3(v: unknown): Vec3 | null {
  if (!isObj(v)) return null;
  const x = num(v.x), y = num(v.y), z = num(v.z);
  return x === null || y === null || z === null ? null : { x, y, z };
}

function vec2(v: unknown): Vec2 | null {
  if (!isObj(v)) return null;
  const x = num(v.x), z = num(v.z);
  return x === null || z === null ? null : { x, z };
}

function pogoState(v: unknown): PogoState | null {
  if (!isObj(v)) return null;
  const pos = vec3(v.pos), vel = vec3(v.vel), lean = vec2(v.lean);
  const charge = num(v.charge), launchY = num(v.launchY), peakY = num(v.peakY);
  if (!pos || !vel || !lean || charge === null || launchY === null || peakY === null) return null;
  if (typeof v.armed !== "boolean" || charge < 0 || charge > 1) return null;
  if (v.standing !== undefined && typeof v.standing !== "boolean") return null;
  return { pos, vel, lean, charge, armed: v.armed, launchY, peakY, standing: v.standing === true };
}

function stats(v: unknown): RunStats | null {
  if (!isObj(v)) return null;
  const height = num(v.height), best = num(v.best), falls = num(v.falls), fallRef = num(v.fallRef), time = num(v.time);
  if (height === null || best === null || falls === null || fallRef === null || time === null) return null;
  if (falls < 0 || !Number.isInteger(falls) || time < 0) return null;
  return { height, best, falls, fallRef, time };
}

function figures(v: unknown): Record<string, FigureMemory> | null {
  if (v === undefined) return {};
  if (!isObj(v) || Array.isArray(v)) return null;
  const out: Record<string, FigureMemory> = {};
  for (const [id, m] of Object.entries(v)) {
    if (!isObj(m) || typeof m.heard !== "boolean" || typeof m.below !== "boolean") return null;
    out[id] = { heard: m.heard, below: m.below };
  }
  return out;
}

/**
 * The saved run for `level`, or null if there is none or it cannot be used.
 * A save under an old id that `aliases` maps to `level` counts as `level`.
 */
export function parseRun(text: string | null, level: string, aliases: Readonly<Record<string, string>> = {}): RunSave | null {
  if (text === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(data) || data.version !== SAVE_VERSION || (data.level !== level && !(typeof data.level === "string" && Object.hasOwn(aliases, data.level) && aliases[data.level] === level))) return null;
  const pogo = pogoState(data.pogo), s = stats(data.stats), yaw = num(data.yaw), met = figures(data.figures);
  if (!pogo || !s || yaw === null || !met) return null;
  return { version: SAVE_VERSION, level, pogo, yaw, stats: s, figures: met };
}

/** The saved best height, or null. */
export function parseBest(text: string | null): number | null {
  if (text === null) return null;
  try {
    const data: unknown = JSON.parse(text);
    return isObj(data) ? num(data.height) : null;
  } catch {
    return null;
  }
}

/** The saved best clear time (summit reached), s, or null before a first clear. */
export function parseBestTime(text: string | null): number | null {
  if (text === null) return null;
  try {
    const data: unknown = JSON.parse(text);
    const time = isObj(data) ? num(data.time) : null;
    return time !== null && time > 0 ? time : null;
  } catch {
    return null;
  }
}
