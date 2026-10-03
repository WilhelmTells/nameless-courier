// Pure camera maths: orbit position, recentering, zoom, fall tilt, marker size.

import type { Vec2, Vec3 } from "./pogoCore.ts";

const DEG = Math.PI / 180;

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Unit vector from the focus point to the camera. `yaw` 0 puts the camera on
 * the +Z side looking along -Z; `pitch` is degrees above the horizontal.
 */
export function orbitDirection(yaw: number, pitch: number): Vec3 {
  const p = pitch * DEG;
  return { x: Math.sin(yaw) * Math.cos(p), y: Math.sin(p), z: Math.cos(yaw) * Math.cos(p) };
}

/**
 * Yaw that puts the camera behind a horizontal movement direction, so the
 * camera looks the way the pogo is moving. Returns null without a direction.
 */
export function recenterYaw(dir: Vec2): number | null {
  if (dir.x === 0 && dir.z === 0) return null;
  return Math.atan2(-dir.x, -dir.z);
}

/** Applies mouse movement to yaw and pitch. */
export function applyMouse(
  yaw: number,
  pitch: number,
  dx: number,
  dy: number,
  cfg: { sensitivity: number; invertY: boolean; pitchMin: number; pitchMax: number },
): { yaw: number; pitch: number } {
  const dPitch = (dy * cfg.sensitivity) / DEG;
  return {
    yaw: wrapAngle(yaw - dx * cfg.sensitivity),
    pitch: clamp(pitch + (cfg.invertY ? -dPitch : dPitch), cfg.pitchMin, cfg.pitchMax),
  };
}

/** Wraps an angle in radians to (-π, π]. */
export function wrapAngle(a: number): number {
  const t = (a + Math.PI) % (2 * Math.PI);
  return (t <= 0 ? t + 2 * Math.PI : t) - Math.PI;
}

/** Applies mouse wheel notches (positive = zoom out) within the limits. */
export function applyZoom(
  distance: number,
  notches: number,
  cfg: { zoomStep: number; distanceMin: number; distanceMax: number },
): number {
  return clamp(distance + notches * cfg.zoomStep, cfg.distanceMin, cfg.distanceMax);
}

/** Target extra downward tilt for a fall depth, degrees. */
export function fallTiltTarget(fallDepth: number, cfg: { fallTiltStart: number; fallTiltMax: number }): number {
  return fallDepth > cfg.fallTiltStart ? cfg.fallTiltMax : 0;
}

/** Moves `current` towards `target` by at most `maxStep`. */
export function moveToward(current: number, target: number, maxStep: number): number {
  if (Math.abs(target - current) <= maxStep) return target;
  return current + Math.sign(target - current) * maxStep;
}

/**
 * Spring arm: the camera snaps in at once when geometry blocks it, and moves
 * back out at `pushOutRate`.
 */
export function springArm(current: number, allowed: number, pushOutRate: number, dt: number): number {
  if (allowed <= current) return allowed;
  return Math.min(allowed, current + pushOutRate * dt);
}

/** Landing marker scale: full size on the surface, shrinking to 60 % at 10 m and above. */
export function markerScale(height: number): number {
  return 1 - 0.4 * clamp(height / 10, 0, 1);
}
