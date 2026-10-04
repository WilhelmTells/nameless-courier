// Save data for the current run and the best height. Parsing checks every
// field; anything missing or malformed gives no save rather than a broken one.

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
}

export interface RunSave {
  version: number;
  level: string;
  pogo: PogoState;
  /** Camera facing, radians. */
  yaw: number;
  stats: RunStats;
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
  return { pos, vel, lean, charge, armed: v.armed, launchY, peakY };
}

function stats(v: unknown): RunStats | null {
  if (!isObj(v)) return null;
  const height = num(v.height), best = num(v.best), falls = num(v.falls), fallRef = num(v.fallRef), time = num(v.time);
  if (height === null || best === null || falls === null || fallRef === null || time === null) return null;
  if (falls < 0 || !Number.isInteger(falls) || time < 0) return null;
  return { height, best, falls, fallRef, time };
}

/** The saved run for `level`, or null if there is none or it cannot be used. */
export function parseRun(text: string | null, level: string): RunSave | null {
  if (text === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(data) || data.version !== SAVE_VERSION || data.level !== level) return null;
  const pogo = pogoState(data.pogo), s = stats(data.stats), yaw = num(data.yaw);
  if (!pogo || !s || yaw === null) return null;
  return { version: SAVE_VERSION, level, pogo, yaw, stats: s };
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
