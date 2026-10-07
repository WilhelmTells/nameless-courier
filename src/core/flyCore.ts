// Free-fly debug camera maths: mouse look and movement, numbers in and out.
// Yaw follows the orbit camera's convention (0 looks along -Z); pitch is the
// look angle above the horizon, degrees.

import { clamp, wrapAngle } from "./cameraCore.ts";
import type { Vec3 } from "./pogoCore.ts";

const DEG = Math.PI / 180;
export const FLY_PITCH_LIMIT = 89;
export const FLY_SPEED_MIN = 1;
export const FLY_SPEED_MAX = 100;
/** Speed factor per mouse wheel notch. */
export const FLY_SPEED_STEP = 1.25;

/** Unit vector the camera looks along. */
export function lookDirection(yaw: number, pitch: number): Vec3 {
  const p = pitch * DEG;
  return { x: -Math.sin(yaw) * Math.cos(p), y: Math.sin(p), z: -Math.cos(yaw) * Math.cos(p) };
}

/** Mouse look: moving the mouse up looks up. */
export function flyLook(yaw: number, pitch: number, dx: number, dy: number, sensitivity: number): { yaw: number; pitch: number } {
  return {
    yaw: wrapAngle(yaw - dx * sensitivity),
    pitch: clamp(pitch - (dy * sensitivity) / DEG, -FLY_PITCH_LIMIT, FLY_PITCH_LIMIT),
  };
}

/**
 * Moves the camera: `forward` along the look direction (climbing when
 * looking up), `right` sideways on the level, `up` straight up. Each input is
 * -1..1; combined inputs are normalised so diagonals are not faster.
 */
export function flyMove(
  pos: Vec3,
  yaw: number,
  pitch: number,
  input: { forward: number; right: number; up: number },
  speed: number,
  dt: number,
): Vec3 {
  const f = lookDirection(yaw, pitch);
  const r = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const v = {
    x: f.x * input.forward + r.x * input.right,
    y: f.y * input.forward + input.up,
    z: f.z * input.forward + r.z * input.right,
  };
  const len = Math.hypot(v.x, v.y, v.z);
  if (len === 0) return { ...pos };
  const step = (speed * dt) / len;
  return { x: pos.x + v.x * step, y: pos.y + v.y * step, z: pos.z + v.z * step };
}

/** Speed after `notches` of the mouse wheel (positive = slower, like zooming out). */
export function flySpeed(speed: number, notches: number): number {
  return clamp(speed * FLY_SPEED_STEP ** -notches, FLY_SPEED_MIN, FLY_SPEED_MAX);
}
