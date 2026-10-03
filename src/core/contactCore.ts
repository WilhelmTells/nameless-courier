// Pure contact rules: which tip contacts launch, how slopes and walls shape
// the launch, and what a bonk does. Numbers in, numbers out.

import type { PogoConfig } from "../config.ts";
import { launchSpeed, type Vec3 } from "./pogoCore.ts";

const DEG = Math.PI / 180;

/** Smallest upward share of a wall kick's direction used to scale its speed. */
const WALL_KICK_MIN_UP = 0.5;

export type SurfaceKind = "floor" | "wall";

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });

function normalise(a: Vec3): Vec3 {
  const len = Math.hypot(a.x, a.y, a.z);
  return len === 0 ? { x: 0, y: 1, z: 0 } : scale(a, 1 / len);
}

/** Angle between two unit vectors, degrees. */
export function angleBetween(a: Vec3, b: Vec3): number {
  return Math.acos(Math.min(1, Math.max(-1, dot(a, b)))) / DEG;
}

/** A surface is a wall when its normal is more than `wallAngle` from up. Ceilings count as walls. */
export function surfaceKind(normal: Vec3, cfg: Pick<PogoConfig, "wallAngle">): SurfaceKind {
  return normal.y < Math.cos(cfg.wallAngle * DEG) ? "wall" : "floor";
}

/** True when the tip meets the surface steeply enough to launch instead of bonking. */
export function tipContactValid(
  stick: Vec3,
  normal: Vec3,
  cfg: Pick<PogoConfig, "wallAngle" | "floorContactLimit" | "wallContactLimit">,
): boolean {
  const limit = surfaceKind(normal, cfg) === "wall" ? cfg.wallContactLimit : cfg.floorContactLimit;
  return angleBetween(stick, normal) <= limit;
}

/**
 * Launch from a floor or slope. `flat` is the launch the same bounce would
 * give on level ground; it is turned towards the surface normal by `blend` of
 * the slope angle. Velocity into the surface is removed.
 */
export function slopeLaunch(flat: Vec3, normal: Vec3, blend: number): Vec3 {
  const horiz = Math.hypot(normal.x, normal.z);
  let v = flat;
  if (horiz > 1e-9) {
    // Rotate about up × normal, which turns up towards the normal.
    const k = { x: normal.z / horiz, y: 0, z: -normal.x / horiz };
    const phi = Math.atan2(horiz, normal.y) * blend;
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const kxv = { x: k.y * v.z - k.z * v.y, y: k.z * v.x - k.x * v.z, z: k.x * v.y - k.y * v.x };
    v = add(add(scale(v, c), scale(kxv, s)), scale(k, dot(k, v) * (1 - c)));
  }
  const into = dot(v, normal);
  return into < 0 ? add(v, scale(normal, -into)) : v;
}

/**
 * Kick off a wall. The apex is `apex` × `wallKickFactor`; the direction is
 * mostly the stick, partly the wall normal. Speed into the wall and falling
 * speed are dropped; horizontal speed along the wall is kept at
 * `keepHorizontal`.
 */
export function wallKick(
  stick: Vec3,
  normal: Vec3,
  apex: number,
  incoming: Vec3,
  cfg: Pick<PogoConfig, "gravity" | "wallKickFactor" | "wallNormalBlend" | "keepHorizontal">,
): Vec3 {
  const up = launchSpeed(apex * cfg.wallKickFactor, cfg.gravity);
  const dir = normalise(add(scale(stick, 1 - cfg.wallNormalBlend), scale(normal, cfg.wallNormalBlend)));
  const kick = scale(dir, up / Math.max(dir.y, WALL_KICK_MIN_UP));

  const nh = Math.hypot(normal.x, normal.z);
  const inH = { x: incoming.x, y: 0, z: incoming.z };
  const along = nh > 1e-9 ? add(inH, scale({ x: normal.x / nh, y: 0, z: normal.z / nh }, -(inH.x * normal.x + inH.z * normal.z) / nh)) : inH;
  return add(kick, scale(along, cfg.keepHorizontal));
}

/**
 * Response to a non-spring contact. A hard impact (faster than
 * `bonkMinSpeed` into the surface) is a bonk: low bounce, most speed lost.
 * A slower one just slides: the part into the surface is removed.
 */
export function bonkVelocity(
  vel: Vec3,
  normal: Vec3,
  cfg: Pick<PogoConfig, "bonkRestitution" | "bonkKeep" | "bonkMinSpeed">,
): { vel: Vec3; hard: boolean } {
  const vn = dot(vel, normal);
  if (vn >= 0) return { vel, hard: false };
  const tangent = add(vel, scale(normal, -vn));
  if (-vn > cfg.bonkMinSpeed) {
    return { vel: add(scale(tangent, cfg.bonkKeep), scale(normal, -vn * cfg.bonkRestitution)), hard: true };
  }
  return { vel: tangent, hard: false };
}
