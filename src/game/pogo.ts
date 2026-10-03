// Pogo controller: applies input and the core rules each simulation step.

import { pogoConfig as cfg } from "../config.ts";
import {
  launchSpeed,
  launchVelocity,
  leanTarget,
  NO_CHARGE,
  resolveBounce,
  stepBallistic,
  stepCharge,
  stepLean,
  type ChargeState,
  type Vec2,
  type Vec3,
} from "../core/pogoCore.ts";
import type { PogoInput } from "./input.ts";

/** Height of the flat test floor. Replaced by collision queries later. */
const FLOOR_Y = 0;
/** Slowest horizontal speed that still counts as movement for recentering, m/s. */
const MOVE_DIR_MIN_SPEED = 0.5;

export class Pogo {
  /** Position of the stick's tip, m. */
  pos: Vec3;
  vel: Vec3 = { x: 0, y: 0, z: 0 };
  /** World-space lean in degrees (see stickAxis). */
  lean: Vec2 = { x: 0, z: 0 };
  charge: ChargeState = { ...NO_CHARGE };
  /** Time since the last launch, s. Drives the squash animation. */
  sinceLaunch = Infinity;
  /** Peak height above the floor of the last completed bounce, m. */
  lastApex = 0;
  /** Last horizontal movement direction (unit vector, or zero before any movement). */
  moveDir: Vec2 = { x: 0, z: 0 };

  /** State before the last step, for render interpolation. */
  prevPos: Vec3;
  prevLean: Vec2 = { x: 0, z: 0 };

  private peak = 0;

  constructor(start: Vec3) {
    this.pos = { ...start };
    this.prevPos = { ...start };
  }

  reset(start: Vec3): void {
    this.pos = { ...start };
    this.prevPos = { ...start };
    this.vel = { x: 0, y: 0, z: 0 };
    this.lean = { x: 0, z: 0 };
    this.prevLean = { x: 0, z: 0 };
    this.charge = { ...NO_CHARGE };
    this.peak = 0;
    this.moveDir = { x: 0, z: 0 };
  }

  step(input: PogoInput, cameraYaw: number, dt: number): void {
    this.prevPos = this.pos;
    this.prevLean = this.lean;

    const hasLean = input.lean.x !== 0 || input.lean.z !== 0;
    const target = leanTarget(input.lean, cameraYaw, cfg.maxLean);
    this.lean = stepLean(this.lean, target, hasLean, dt, cfg);
    this.charge = stepCharge(this.charge, input.charge, dt, cfg);

    const next = stepBallistic(this.pos, this.vel, cfg.gravity, dt);
    this.pos = next.pos;
    this.vel = next.vel;
    this.sinceLaunch += dt;
    this.peak = Math.max(this.peak, this.pos.y - FLOOR_Y);
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (hSpeed > MOVE_DIR_MIN_SPEED) this.moveDir = { x: this.vel.x / hSpeed, z: this.vel.z / hSpeed };

    // Tip contact with the floor: launch along the stick.
    if (this.pos.y <= FLOOR_Y && this.vel.y < 0) {
      this.pos = { ...this.pos, y: FLOOR_Y };
      const bounce = resolveBounce(this.charge, cfg);
      this.charge = bounce.charge;
      this.vel = launchVelocity(this.lean, launchSpeed(bounce.apex, cfg.gravity), this.vel, cfg);
      this.lastApex = this.peak;
      this.peak = 0;
      this.sinceLaunch = 0;
    }
  }
}
