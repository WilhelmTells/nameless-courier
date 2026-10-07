// Moving obstacles: where a piece is at a given time, and how fast any point
// on it moves. Pure functions of the simulation clock, so every cycle repeats
// exactly and can be learned.

import type { Vec3 } from "./pogoCore.ts";

/** Rotation as a unit quaternion. */
export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * How a piece moves. `period` is one full cycle in seconds, `phase` shifts it
 * by a fraction of a cycle (0–1). Vectors are in metres, angles in degrees.
 * - linear: to `position + by` and back, easing at both ends.
 * - piston: like linear, but holds `dwell` seconds at each end and moves fast in between.
 * - rotate: turns steadily about `axis` through the piece's centre, one turn per period.
 * - pendulum: swings ±`angle` about `axis` through `pivot`.
 */
export type Motion =
  | { kind: "none" }
  | { kind: "linear"; by: Vec3; period: number; phase: number }
  | { kind: "piston"; by: Vec3; period: number; dwell: number; phase: number }
  | { kind: "rotate"; axis: Vec3; period: number; phase: number }
  | { kind: "pendulum"; pivot: Vec3; axis: Vec3; angle: number; period: number; phase: number };

/** Where a moving piece is: its centre, and the turn applied on top of its own rotation. */
export interface Pose {
  position: Vec3;
  turn: Quat;
}

const DEG = Math.PI / 180;
const NO_TURN: Quat = { x: 0, y: 0, z: 0, w: 1 };
const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a.x, a.y, a.z));

/** Quaternion turning `angle` radians about `axis` (any length). */
export function axisAngle(axis: Vec3, angle: number): Quat {
  const a = unit(axis);
  const s = Math.sin(angle / 2);
  return { x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(angle / 2) };
}

/** `v` turned by `q`. */
export function rotate(q: Quat, v: Vec3): Vec3 {
  // v + 2w(u × v) + 2u × (u × v), with u the vector part of q.
  const u = { x: q.x, y: q.y, z: q.z };
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, q.w)), cross(u, t));
}

/** Cycle position in [0, 1) at time `t`. */
function cycle(t: number, period: number, phase: number): number {
  const u = t / period + phase;
  return u - Math.floor(u);
}

/**
 * Piston travel in [0, 1] and its rate (per second): rest at 0, move up,
 * rest at 1, move down. Each move eases in and out (smoothstep).
 */
function pistonTravel(u: number, period: number, dwell: number): { s: number; ds: number } {
  const move = Math.max(1e-6, (period - 2 * dwell) / 2);
  let t = u * period;
  if (t < dwell) return { s: 0, ds: 0 };
  t -= dwell;
  if (t < move) {
    const x = t / move;
    return { s: x * x * (3 - 2 * x), ds: (6 * x * (1 - x)) / move };
  }
  t -= move;
  if (t < dwell) return { s: 1, ds: 0 };
  const x = Math.min(1, (t - dwell) / move);
  return { s: 1 - x * x * (3 - 2 * x), ds: -(6 * x * (1 - x)) / move };
}

/** Linear and piston: travel along `by` in [0, 1] and its rate. */
function travel(m: Extract<Motion, { kind: "linear" | "piston" }>, t: number): { s: number; ds: number } {
  const u = cycle(t, m.period, m.phase);
  if (m.kind === "piston") return pistonTravel(u, m.period, m.dwell);
  const w = (2 * Math.PI) / m.period;
  return { s: (1 - Math.cos(2 * Math.PI * u)) / 2, ds: (w / 2) * Math.sin(2 * Math.PI * u) };
}

/** Turn angle (radians) and its rate for the turning motions. */
function swing(m: Extract<Motion, { kind: "rotate" | "pendulum" }>, t: number): { a: number; da: number } {
  const u = cycle(t, m.period, m.phase);
  const w = (2 * Math.PI) / m.period;
  if (m.kind === "rotate") return { a: 2 * Math.PI * u, da: w };
  const amp = m.angle * DEG;
  return { a: amp * Math.sin(2 * Math.PI * u), da: amp * w * Math.cos(2 * Math.PI * u) };
}

/** Pose at time `t` of a piece whose centre is `base` at rest. */
export function poseAt(motion: Motion, base: Vec3, t: number): Pose {
  switch (motion.kind) {
    case "none":
      return { position: base, turn: NO_TURN };
    case "linear":
    case "piston":
      return { position: add(base, scale(motion.by, travel(motion, t).s)), turn: NO_TURN };
    case "rotate":
      return { position: base, turn: axisAngle(motion.axis, swing(motion, t).a) };
    case "pendulum": {
      const turn = axisAngle(motion.axis, swing(motion, t).a);
      return { position: add(motion.pivot, rotate(turn, sub(base, motion.pivot))), turn };
    }
  }
}

/** Velocity at time `t` of the point of the piece that is at `point` then, m/s. */
export function velocityAt(motion: Motion, base: Vec3, t: number, point: Vec3): Vec3 {
  switch (motion.kind) {
    case "none":
      return ZERO;
    case "linear":
    case "piston":
      return scale(motion.by, travel(motion, t).ds);
    case "rotate":
      return cross(scale(unit(motion.axis), swing(motion, t).da), sub(point, base));
    case "pendulum":
      return cross(scale(unit(motion.axis), swing(motion, t).da), sub(point, motion.pivot));
  }
}

/** Fastest speed any point within `reach` metres of the turning centre moves at, m/s. For level checks. */
export function topSpeed(motion: Motion, base: Vec3, reach: number): number {
  switch (motion.kind) {
    case "none":
      return 0;
    case "linear": {
      const len = Math.hypot(motion.by.x, motion.by.y, motion.by.z);
      return (Math.PI * len) / motion.period;
    }
    case "piston": {
      const len = Math.hypot(motion.by.x, motion.by.y, motion.by.z);
      return (1.5 * len) / Math.max(1e-6, (motion.period - 2 * motion.dwell) / 2);
    }
    case "rotate":
      return ((2 * Math.PI) / motion.period) * reach;
    case "pendulum": {
      const arm = Math.hypot(...Object.values(sub(base, motion.pivot))) + reach;
      return motion.angle * DEG * ((2 * Math.PI) / motion.period) * arm;
    }
  }
}
