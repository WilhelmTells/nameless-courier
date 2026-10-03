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
  stickAxis,
  type ChargeState,
  type Vec2,
  type Vec3,
} from "../core/pogoCore.ts";
import type { PogoInput } from "./input.ts";

/** Height of the flat test floor. Replaced by collision queries later. */
const FLOOR_Y = 0;

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

    // Tip contact with the floor: launch along the stick.
    if (this.pos.y <= FLOOR_Y && this.vel.y < 0) {
      this.pos = { ...this.pos, y: FLOOR_Y };
      const bounce = resolveBounce(this.charge, cfg);
      this.charge = bounce.charge;
      this.vel = launchVelocity(
        stickAxis(this.lean),
        launchSpeed(bounce.apex, cfg.gravity),
        this.vel,
        cfg.keepHorizontal,
      );
      this.lastApex = this.peak;
      this.peak = 0;
      this.sinceLaunch = 0;
    }
  }
}
