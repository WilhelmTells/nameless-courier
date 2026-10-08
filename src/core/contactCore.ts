// Pure contact rules: which tip contacts launch, how slopes and walls shape
// the launch, and what a bonk does. Numbers in, numbers out.

import type { PogoConfig } from "../config.ts";
import { launchSpeed, type Vec2, type Vec3 } from "./pogoCore.ts";

const DEG = Math.PI / 180;

export type SurfaceKind = "floor" | "wall";

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });

/** Angle between two unit vectors, degrees. */
export function angleBetween(a: Vec3, b: Vec3): number {
  return Math.acos(Math.min(1, Math.max(-1, dot(a, b)))) / DEG;
}

/** A surface is a wall when its normal is more than `wallAngle` from up. Ceilings count as walls. */
export function surfaceKind(normal: Vec3, cfg: Pick<PogoConfig, "wallAngle">): SurfaceKind {
  return normal.y < Math.cos(cfg.wallAngle * DEG) ? "wall" : "floor";
}

/**
 * True for a ceiling: a surface facing down, steeper than `wallAngle` from a
 * wall. Knocking the head on one keeps the lean (see Pogo.bonk).
 */
export function isCeiling(normal: Vec3, cfg: Pick<PogoConfig, "wallAngle">): boolean {
  return normal.y <= -Math.cos(cfg.wallAngle * DEG);
}

/** True for walls and overhangs that can be kicked off or pushed away from (not floors, not ceilings). */
export function isWall(normal: Vec3, cfg: Pick<PogoConfig, "wallAngle">): boolean {
  return Math.abs(normal.y) < Math.cos(cfg.wallAngle * DEG) && Math.hypot(normal.x, normal.z) > 1e-9;
}

/** True when the tip meets a floor or slope steeply enough to bounce instead of bonking. Walls never bounce the tip. */
export function tipContactValid(
  stick: Vec3,
  normal: Vec3,
  cfg: Pick<PogoConfig, "wallAngle" | "floorContactLimit">,
): boolean {
  return surfaceKind(normal, cfg) === "floor" && angleBetween(stick, normal) <= cfg.floorContactLimit;
}

/**
 * True when touching a wall with direction `dir` pressed kicks off it: `dir`
 * (unit, horizontal) must point away from the wall, within `wallKickAngle`
 * of its outward normal.
 */
export function wallKickAllowed(dir: Vec2, normal: Vec3, cfg: Pick<PogoConfig, "wallAngle" | "wallKickAngle">): boolean {
  if (!isWall(normal, cfg) || (dir.x === 0 && dir.z === 0)) return false;
  const cos = (dir.x * normal.x + dir.z * normal.z) / Math.hypot(normal.x, normal.z);
  return cos >= Math.cos(cfg.wallKickAngle * DEG) - 1e-9;
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
 * Kick off a wall in the pressed direction `dir`: rises to `apex` ×
 * `wallKickFactor` and moves away at `wallKickSpeed` whatever the charge.
 * Speed into the wall and falling speed are dropped; horizontal speed along
 * the wall is kept at `keepHorizontal`.
 */
export function wallKick(
  dir: Vec2,
  normal: Vec3,
  apex: number,
  incoming: Vec3,
  cfg: Pick<PogoConfig, "gravity" | "wallKickFactor" | "wallKickSpeed" | "keepHorizontal">,
): Vec3 {
  const up = launchSpeed(apex * cfg.wallKickFactor, cfg.gravity);
  const nh = Math.hypot(normal.x, normal.z);
  const out = { x: normal.x / nh, z: normal.z / nh };
  const inOut = incoming.x * out.x + incoming.z * out.z;
  const along = { x: incoming.x - out.x * inOut, z: incoming.z - out.z * inOut };
  return {
    x: dir.x * cfg.wallKickSpeed + along.x * cfg.keepHorizontal,
    y: up,
    z: dir.z * cfg.wallKickSpeed + along.z * cfg.keepHorizontal,
  };
}

/**
 * Response to a non-spring contact. A hard impact (faster than
 * `bonkMinSpeed` into the surface) is a bonk: low bounce, most speed along
 * the surface lost. On a wall a bonk keeps the vertical speed (scraping a
 * wall does not kill the bounce) and pushes away at `wallPushSpeed` or more.
 * A slower contact just slides: the part into the surface is removed.
 */
export function bonkVelocity(
  vel: Vec3,
  normal: Vec3,
  cfg: Pick<PogoConfig, "bonkRestitution" | "bonkKeep" | "bonkMinSpeed" | "wallAngle" | "wallPushSpeed">,
): { vel: Vec3; hard: boolean } {
  const vn = dot(vel, normal);
  if (vn >= 0) return { vel, hard: false };
  const tangent = add(vel, scale(normal, -vn));
  if (-vn <= cfg.bonkMinSpeed) return { vel: tangent, hard: false };

  if (!isWall(normal, cfg)) {
    return { vel: add(scale(tangent, cfg.bonkKeep), scale(normal, -vn * cfg.bonkRestitution)), hard: true };
  }
  // Wall: split into horizontal-out, horizontal-along and vertical.
  const nh = Math.hypot(normal.x, normal.z);
  const out = { x: normal.x / nh, y: 0, z: normal.z / nh };
  const inOut = vel.x * out.x + vel.z * out.z;
  const along = { x: vel.x - out.x * inOut, y: 0, z: vel.z - out.z * inOut };
  const push = Math.max(cfg.wallPushSpeed, -inOut * cfg.bonkRestitution);
  return { vel: add(add(scale(along, cfg.bonkKeep), scale(out, push)), { x: 0, y: vel.y, z: 0 }), hard: true };
}
