// A weight on a damped spring below an anchor point: drives the courier's
// cape. Worked out relative to that point, so it lags when the courier is
// thrown up, floats in free fall, and drops when the courier lands. Visual
// only; a pure function of the anchor's motion, so it is deterministic.

import type { Vec3 } from "./pogoCore.ts";

export interface SwingConfig {
  /** Spring stiffness per unit mass, 1/s². Higher swings faster and sags less. */
  stiffness: number;
  /** Damping per unit mass, 1/s. Higher settles sooner. */
  damping: number;
  /** How far the bag may move away from where it hangs at rest, m (the strap). */
  maxSwing: number;
}

/** Where the bag is relative to its strap point, and how fast it moves relative to it. */
export interface Swing {
  offset: Vec3;
  vel: Vec3;
}

/** Relative speeds above this are cut, so a teleport does not fling the bag. m/s. */
export const MAX_SWING_SPEED = 15;

/** The bag's resting offset: hanging below the strap point by gravity ÷ stiffness. */
export function restOffset(gravity: number, cfg: SwingConfig): Vec3 {
  return { x: 0, y: -gravity / cfg.stiffness, z: 0 };
}

export function restSwing(gravity: number, cfg: SwingConfig): Swing {
  return { offset: restOffset(gravity, cfg), vel: { x: 0, y: 0, z: 0 } };
}

/**
 * One step. `anchorDv` is the change of the strap point's velocity during
 * the step: the bag keeps its own velocity, so relative to the strap point
 * it moves the other way. Semi-implicit Euler, then the strap limit (the
 * outward part of the velocity is lost at the limit) and the speed cap.
 */
export function stepSwing(s: Swing, anchorDv: Vec3, gravity: number, cfg: SwingConfig, dt: number): Swing {
  const k = cfg.stiffness;
  const c = cfg.damping;
  let vx = s.vel.x - anchorDv.x + (-k * s.offset.x - c * s.vel.x) * dt;
  let vy = s.vel.y - anchorDv.y + (-gravity - k * s.offset.y - c * s.vel.y) * dt;
  let vz = s.vel.z - anchorDv.z + (-k * s.offset.z - c * s.vel.z) * dt;
  const speed = Math.hypot(vx, vy, vz);
  if (speed > MAX_SWING_SPEED) {
    const f = MAX_SWING_SPEED / speed;
    vx *= f;
    vy *= f;
    vz *= f;
  }
  const rest = restOffset(gravity, cfg);
  let dx = s.offset.x + vx * dt - rest.x;
  let dy = s.offset.y + vy * dt - rest.y;
  let dz = s.offset.z + vz * dt - rest.z;
  const d = Math.hypot(dx, dy, dz);
  if (d > cfg.maxSwing && d > 0) {
    const nx = dx / d, ny = dy / d, nz = dz / d;
    dx = nx * cfg.maxSwing;
    dy = ny * cfg.maxSwing;
    dz = nz * cfg.maxSwing;
    const out = vx * nx + vy * ny + vz * nz;
    if (out > 0) {
      vx -= out * nx;
      vy -= out * ny;
      vz -= out * nz;
    }
  }
  return { offset: { x: rest.x + dx, y: rest.y + dy, z: rest.z + dz }, vel: { x: vx, y: vy, z: vz } };
}
