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

/**
 * Follow camera: eases `yaw` towards the yaw behind the world-space `lean`
 * (degrees, see stickAxis), with time constant `time`. Leans within the
 * deadzone, or pointing more than `maxAngle` degrees away from the camera's
 * forward (back towards it), leave the yaw alone.
 */
export function followYaw(yaw: number, lean: Vec2, deadzone: number, maxAngle: number, time: number, dt: number): number {
  if (Math.hypot(lean.x, lean.z) <= deadzone) return yaw;
  const diff = wrapAngle((recenterYaw(lean) ?? yaw) - yaw);
  if (Math.abs(diff) > maxAngle * DEG) return yaw;
  const k = time > 0 ? 1 - Math.exp(-dt / time) : 1;
  return wrapAngle(yaw + diff * k);
}

/** The drop the automatic tilt works with: none below `minDrop`, so normal bouncing never tilts. */
export function tiltDrop(drop: number, minDrop: number): number {
  return drop >= minDrop ? drop : 0;
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

/**
 * Smallest pitch (degrees, at least `basePitch`) at which the point `drop`
 * metres straight below the focus is inside the view, at most `maxAngle`
 * degrees from the view centre. The camera looks at the focus from `distance`
 * away. Used to keep the landing marker on screen during high jumps and falls.
 */
export function pitchToSeeBelow(
  basePitch: number,
  distance: number,
  drop: number,
  maxAngle: number,
  pitchMax: number,
): number {
  const angleAt = (pitch: number) => {
    const p = pitch * DEG;
    // 2D, focus at the origin: camera at (-d cos p, d sin p), ground point at (0, -drop).
    const vx = distance * Math.cos(p);
    const vy = -distance * Math.sin(p);
    const gy = -drop - distance * Math.sin(p);
    const cos = (vx * vx + vy * gy) / (Math.hypot(vx, vy) * Math.hypot(vx, gy));
    return Math.acos(clamp(cos, -1, 1)) / DEG;
  };
  let pitch = basePitch;
  while (pitch < pitchMax && angleAt(pitch) > maxAngle) pitch = Math.min(pitchMax, pitch + 1);
  return pitch;
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
