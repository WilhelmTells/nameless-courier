// Getting off the pogo at rest spots. The courier can stop only there, and
// getting off and on takes time and starts the next bounce from rest, so
// stopping gives no advantage on the climb.

import type { PogoConfig } from "../config.ts";
import type { Vec3 } from "./pogoCore.ts";

export interface RestRegion {
  min: Vec3;
  max: Vec3;
}

export type RidePhase = "riding" | "gettingOff" | "standing" | "gettingOn";

export interface RideState {
  phase: RidePhase;
  /** Time spent in the current phase, s. */
  t: number;
  /** Riding: the player asked to get off at the next contact in the spot. */
  requested: boolean;
}

export const RIDING: Readonly<RideState> = { phase: "riding", t: 0, requested: false };
export const STANDING: Readonly<RideState> = { phase: "standing", t: 0, requested: false };

type RideConfig = Pick<PogoConfig, "dismountTime" | "mountTime" | "dismountMaxSpeed">;

/** True when `pos` lies inside any of the regions. */
export function inRestSpot(spots: readonly RestRegion[], pos: Vec3): boolean {
  return spots.some(
    (s) =>
      pos.x >= s.min.x && pos.x <= s.max.x &&
      pos.y >= s.min.y - 0.05 && pos.y <= s.max.y &&
      pos.z >= s.min.z && pos.z <= s.max.z,
  );
}

/**
 * Advances the ride by one step. `toggle` is the get-off / get-on key,
 * pressed this step. Riding, it asks to get off (pressing again cancels),
 * but only inside a rest spot; leaving the spot drops the request. Getting
 * off is started by the controller at a contact (see canDismount).
 */
export function stepRide(state: RideState, toggle: boolean, inSpot: boolean, dt: number, cfg: RideConfig): RideState {
  switch (state.phase) {
    case "riding": {
      if (!inSpot) return state.requested ? { ...RIDING } : state;
      return toggle ? { ...state, requested: !state.requested } : state;
    }
    case "gettingOff": {
      const t = state.t + dt;
      return t >= cfg.dismountTime ? { ...STANDING } : { ...state, t };
    }
    case "standing":
      return toggle ? { phase: "gettingOn", t: 0, requested: false } : state;
    case "gettingOn": {
      const t = state.t + dt;
      return t >= cfg.mountTime ? { ...RIDING } : { ...state, t };
    }
  }
}

/** A floor contact gets the courier off instead of launching. */
export function canDismount(state: RideState, inSpot: boolean, horizontalSpeed: number, cfg: RideConfig): boolean {
  return state.phase === "riding" && state.requested && inSpot && horizontalSpeed <= cfg.dismountMaxSpeed;
}

/** How far off the pogo the courier is, for the pose: 0 riding, 1 standing. */
export function standAmount(state: RideState, cfg: RideConfig): number {
  switch (state.phase) {
    case "riding":
      return 0;
    case "gettingOff":
      return cfg.dismountTime > 0 ? Math.min(1, state.t / cfg.dismountTime) : 1;
    case "standing":
      return 1;
    case "gettingOn":
      return cfg.mountTime > 0 ? Math.max(0, 1 - state.t / cfg.mountTime) : 0;
  }
}
