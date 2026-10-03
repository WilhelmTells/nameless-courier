// Pure pogo rules: launch, charge, lean. Numbers in, numbers out.

import type { PogoConfig } from "../config.ts";

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const DEG = Math.PI / 180;

/** Vertical speed needed to rise exactly `apex` metres under `gravity`. */
export function launchSpeed(apex: number, gravity: number): number {
  return Math.sqrt(2 * gravity * Math.max(0, apex));
}

/**
 * World-space lean target from camera-relative input.
 * `input.x` is right (+1) / left (-1), `input.z` is away from the camera (+1)
 * / towards it (-1). `yaw` is the camera's rotation about the vertical axis in
 * radians (0 = looking along -Z). Diagonals are normalised so they lean no
 * further than straight input.
 */
export function leanTarget(input: Vec2, yaw: number, maxLean: number): Vec2 {
  const len = Math.hypot(input.x, input.z);
  if (len === 0) return { x: 0, z: 0 };
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const fwdX = -Math.sin(yaw);
  const fwdZ = -Math.cos(yaw);
  const scale = maxLean / Math.max(1, len);
  return {
    x: (input.x * rightX + input.z * fwdX) * scale,
    z: (input.x * rightZ + input.z * fwdZ) * scale,
  };
}

/**
 * Eases the lean towards the target at `leanRate` while input is held, or at
 * `returnRate` back to upright when it is not.
 */
export function stepLean(
  current: Vec2,
  target: Vec2,
  hasInput: boolean,
  dt: number,
  cfg: Pick<PogoConfig, "leanRate" | "returnRate">,
): Vec2 {
  const dx = target.x - current.x;
  const dz = target.z - current.z;
  const dist = Math.hypot(dx, dz);
  const maxStep = (hasInput ? cfg.leanRate : cfg.returnRate) * dt;
  if (dist <= maxStep) return { x: target.x, z: target.z };
  const k = maxStep / dist;
  return { x: current.x + dx * k, z: current.z + dz * k };
}

/** Unit vector along the stick, from the tip upwards, for a lean in degrees. */
export function stickAxis(lean: Vec2): Vec3 {
  const angle = Math.hypot(lean.x, lean.z);
  if (angle === 0) return { x: 0, y: 1, z: 0 };
  const s = Math.sin(angle * DEG);
  return { x: (lean.x / angle) * s, y: Math.cos(angle * DEG), z: (lean.z / angle) * s };
}

export interface ChargeState {
  /** Charge level, 0–1. Carries across bounces. */
  charge: number;
  /** True once Space was released: the next contact launches the charged jump. */
  armed: boolean;
  /** Whether Space was held in the last step. */
  held: boolean;
}

export const NO_CHARGE: Readonly<ChargeState> = { charge: 0, armed: false, held: false };

/** Advances the charge by one step given whether Space is held now. */
export function stepCharge(
  state: ChargeState,
  held: boolean,
  dt: number,
  cfg: Pick<PogoConfig, "chargeTime">,
): ChargeState {
  let { charge, armed } = state;
  if (held) charge = Math.min(1, charge + dt / cfg.chargeTime);
  if (state.held && !held && charge > 0) armed = true;
  return { charge, armed, held };
}

/** Apex of a charged jump for a charge level, between normal and full. */
export function chargedApex(
  charge: number,
  cfg: Pick<PogoConfig, "normalApex" | "chargedApex" | "chargeCurve">,
): number {
  const t = Math.pow(Math.min(1, Math.max(0, charge)), cfg.chargeCurve);
  return cfg.normalApex + (cfg.chargedApex - cfg.normalApex) * t;
}

/** Apex carried over from a fall of `fall` metres: bounces die down gradually. */
export function carriedApex(fall: number, cfg: Pick<PogoConfig, "bounceRetain" | "maxCarriedApex">): number {
  return Math.min(cfg.maxCarriedApex, Math.max(0, fall) * cfg.bounceRetain);
}

/**
 * Decides the bounce on a valid tip contact: an armed charged jump, an idle
 * hop while charging, or a normal bounce. `carried` is the apex left over
 * from the fall (see carriedApex); normal and charged bounces go at least
 * that high, while holding Space absorbs it. Returns the apex and the charge
 * state after the bounce.
 */
export function resolveBounce(
  state: ChargeState,
  cfg: Pick<PogoConfig, "idleHopApex" | "normalApex" | "chargedApex" | "chargeCurve">,
  carried = 0,
): { apex: number; charge: ChargeState } {
  if (state.armed) {
    return { apex: Math.max(carried, chargedApex(state.charge, cfg)), charge: { charge: 0, armed: false, held: state.held } };
  }
  if (state.held) return { apex: cfg.idleHopApex, charge: state };
  return { apex: Math.max(carried, cfg.normalApex), charge: state };
}

/**
 * Launch velocity. Vertical: the full launch speed, so leaning does not lower
 * the bounce. Horizontal: a push of launch speed × sin(lean) × leanPush in the
 * lean direction, plus the kept fraction of the incoming horizontal velocity
 * (momentum). Incoming vertical velocity is discarded.
 */
export function launchVelocity(
  lean: Vec2,
  speed: number,
  incoming: Vec3,
  cfg: Pick<PogoConfig, "keepHorizontal" | "leanPush">,
): Vec3 {
  const angle = Math.hypot(lean.x, lean.z);
  const push = angle === 0 ? 0 : (speed * Math.sin(angle * DEG) * cfg.leanPush) / angle;
  return {
    x: lean.x * push + incoming.x * cfg.keepHorizontal,
    y: speed,
    z: lean.z * push + incoming.z * cfg.keepHorizontal,
  };
}

/**
 * Share of horizontal speed kept on launch: full momentum while the player
 * steers, much less when no direction was pressed, so letting go brakes.
 */
export function momentumKeep(steering: boolean, cfg: Pick<PogoConfig, "keepHorizontal" | "keepWithoutInput">): number {
  return steering ? cfg.keepHorizontal : cfg.keepWithoutInput;
}

/** Exact ballistic motion over `dt` under gravity. */
export function stepBallistic(pos: Vec3, vel: Vec3, gravity: number, dt: number): { pos: Vec3; vel: Vec3 } {
  return {
    pos: {
      x: pos.x + vel.x * dt,
      y: pos.y + vel.y * dt - 0.5 * gravity * dt * dt,
      z: pos.z + vel.z * dt,
    },
    vel: { x: vel.x, y: vel.y - gravity * dt, z: vel.z },
  };
}
