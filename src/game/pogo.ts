// Pogo controller: applies input and the core rules each simulation step, and
// finds contacts by shape-casting the tip, shaft and body against the level.

import RAPIER from "@dimforge/rapier3d-compat";
import { pogoConfig as cfg } from "../config.ts";
import { bonkVelocity, slopeLaunch, surfaceKind, tipContactValid, wallKick, angleBetween } from "../core/contactCore.ts";
import {
  carriedApex,
  launchSpeed,
  launchVelocity,
  leanTarget,
  momentumKeep,
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

/** Slowest horizontal speed that still counts as movement for recentering, m/s. */
const MOVE_DIR_MIN_SPEED = 0.5;
/** Gap kept between the pogo's shapes and the level after a contact, m. */
const SKIN = 0.002;
/** Most contacts resolved in one simulation step. */
const MAX_CONTACTS_PER_STEP = 4;
/** Spawn height above the start point, m: starting in contact gives an unreliable first contact normal. */
const SPAWN_LIFT = 0.01;
const NO_LEAN: Vec2 = { x: 0, z: 0 };

/** A collision shape along the stick, `offset` metres from the tip to its centre. */
interface Part {
  name: "tip" | "shaft" | "body";
  shape: RAPIER.Shape;
  offset: number;
}

const TIP_RADIUS = 0.04;

/** Built on demand: Rapier shapes need the physics module initialised first. */
function createParts(): Part[] {
  return [
    { name: "tip", shape: new RAPIER.Ball(TIP_RADIUS), offset: TIP_RADIUS },
    // Shaft from 0.15 to 0.60 m along the stick.
    { name: "shaft", shape: new RAPIER.Capsule(0.225, 0.04), offset: 0.375 },
    // Rider and parcel from 0.40 to 1.75 m.
    { name: "body", shape: new RAPIER.Capsule(0.475, 0.2), offset: 1.075 },
  ];
}

export type ContactKind = "floor" | "wall" | "bonk";

export interface Contact {
  kind: ContactKind;
  /** Angle between the stick and the surface normal, degrees. */
  angle: number;
}

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));

/** `v` without its component into the surface with normal `n`. */
function removeInto(v: Vec3, n: Vec3): Vec3 {
  const d = v.x * n.x + v.y * n.y + v.z * n.z;
  return d < 0 ? sub(v, scale(n, d)) : v;
}

/** Rotation turning +Y onto the unit vector `a`. */
function rotationTo(a: Vec3): RAPIER.Rotation {
  const w = 1 + a.y;
  if (w < 1e-6) return { x: 1, y: 0, z: 0, w: 0 };
  const len = Math.hypot(a.z, a.x, w);
  return { x: a.z / len, y: 0, z: -a.x / len, w: w / len };
}

export class Pogo {
  /** Position of the stick's tip, m. */
  pos: Vec3;
  vel: Vec3 = { x: 0, y: 0, z: 0 };
  /** World-space lean in degrees (see stickAxis). */
  lean: Vec2 = { x: 0, z: 0 };
  charge: ChargeState = { ...NO_CHARGE };
  /** Time since the last launch, s. Drives the squash animation. */
  sinceLaunch = Infinity;
  /** Rise from the launch point to the peak of the last completed bounce, m. */
  lastApex = 0;
  /** Last horizontal movement direction (unit vector, or zero before any movement). */
  moveDir: Vec2 = { x: 0, z: 0 };
  /** The most recent contact, for the debug readout. */
  lastContact: Contact | null = null;

  /** State before the last step, for render interpolation. */
  prevPos: Vec3;
  prevLean: Vec2 = { x: 0, z: 0 };

  private parts = createParts();
  private peakY: number;
  private launchY: number;
  /** Time left during which lean input is ignored after a bonk, s. */
  private bonkLock = 0;
  /** A direction was pressed since the last launch (or is pressed now). */
  private steering = false;

  private world: RAPIER.World;

  constructor(start: Vec3, world: RAPIER.World) {
    this.world = world;
    this.pos = { ...start, y: start.y + SPAWN_LIFT };
    this.prevPos = { ...this.pos };
    this.peakY = this.launchY = start.y;
  }

  reset(start: Vec3): void {
    this.pos = { ...start, y: start.y + SPAWN_LIFT };
    this.prevPos = { ...this.pos };
    this.vel = { x: 0, y: 0, z: 0 };
    this.lean = { x: 0, z: 0 };
    this.prevLean = { x: 0, z: 0 };
    this.charge = { ...NO_CHARGE };
    this.peakY = this.launchY = start.y;
    this.moveDir = { x: 0, z: 0 };
    this.bonkLock = 0;
    this.lastContact = null;
    this.steering = false;
  }

  step(input: PogoInput, cameraYaw: number, dt: number): void {
    this.prevPos = this.pos;
    this.prevLean = this.lean;

    this.bonkLock = Math.max(0, this.bonkLock - dt);
    const locked = this.bonkLock > 0;
    const hasLean = !locked && (input.lean.x !== 0 || input.lean.z !== 0);
    const target = hasLean ? leanTarget(input.lean, cameraYaw, cfg.maxLean) : NO_LEAN;
    if (hasLean) this.steering = true;
    // A lean pressed in this flight is held until the next contact.
    const hold = !hasLean && cfg.holdLeanInAir && this.steering;
    const lean = hold ? this.lean : stepLean(this.lean, target, hasLean, dt, cfg);
    // The stick cannot turn into geometry; it stays put unless it is already stuck in it.
    if (!this.overlaps(lean) || this.overlaps(this.lean)) this.lean = lean;
    this.charge = stepCharge(this.charge, input.charge, dt, cfg);

    this.move(dt);

    this.sinceLaunch += dt;
    this.peakY = Math.max(this.peakY, this.pos.y);
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (hSpeed > MOVE_DIR_MIN_SPEED) this.moveDir = { x: this.vel.x / hSpeed, z: this.vel.z / hSpeed };
  }

  /** Moves along the flight path for `dt`, resolving contacts on the way. */
  private move(dt: number): void {
    let remaining = dt;
    // Surfaces touched without launching this step: the rest of the motion slides along them.
    const planes: Vec3[] = [];
    for (let i = 0; i < MAX_CONTACTS_PER_STEP && remaining > 0; i++) {
      const next = stepBallistic(this.pos, this.vel, cfg.gravity, remaining);
      let disp = sub(next.pos, this.pos);
      let vel = next.vel;
      for (const n of planes) {
        disp = removeInto(disp, n);
        vel = removeInto(vel, n);
      }
      const len = Math.hypot(disp.x, disp.y, disp.z);
      const hit = len > 1e-9 ? this.cast(disp) : null;
      if (!hit) {
        this.pos = add(this.pos, disp);
        this.vel = vel;
        return;
      }

      // Advance to just before the contact.
      const t = Math.max(0, hit.toi - SKIN / len);
      this.pos = add(this.pos, scale(disp, t));
      this.vel = lerp(this.vel, vel, t);
      remaining *= 1 - t;

      const stick = stickAxis(this.lean);
      const n = hit.normal;
      const approaching = disp.x * n.x + disp.y * n.y + disp.z * n.z < 0;
      if (hit.part === "tip" && approaching && tipContactValid(stick, n, cfg)) {
        this.launch(stick, n);
        return;
      }
      const bonk = bonkVelocity(this.vel, n, cfg);
      this.vel = bonk.vel;
      if (bonk.hard) {
        this.bonkLock = cfg.bonkLockTime;
        this.steering = false;
        this.lastContact = { kind: "bonk", angle: angleBetween(stick, n) };
      }
      planes.push(n);
    }
  }

  private launch(stick: Vec3, normal: Vec3): void {
    const kind = surfaceKind(normal, cfg);
    // Floor bounces carry part of the fall; wall kicks drop the falling speed.
    const carried = kind === "floor" ? carriedApex(this.peakY - this.pos.y, cfg) : 0;
    const bounce = resolveBounce(this.charge, cfg, carried);
    this.charge = bounce.charge;
    const keep = { ...cfg, keepHorizontal: momentumKeep(this.steering, cfg) };
    this.steering = false;
    if (kind === "wall") {
      this.vel = wallKick(stick, normal, bounce.apex, this.vel, keep);
    } else {
      const flat = launchVelocity(this.lean, launchSpeed(bounce.apex, cfg.gravity), this.vel, keep);
      this.vel = slopeLaunch(flat, normal, cfg.slopeBlend);
    }
    this.lastContact = { kind, angle: angleBetween(stick, normal) };
    this.lastApex = this.peakY - this.launchY;
    this.peakY = this.launchY = this.pos.y;
    this.sinceLaunch = 0;
  }

  /** Earliest contact of any part moving by `disp` (fraction of `disp`); the tip wins ties. */
  private cast(disp: Vec3): { part: Part["name"]; toi: number; normal: Vec3 } | null {
    const axis = stickAxis(this.lean);
    const rot = rotationTo(axis);
    let best: { part: Part["name"]; toi: number; normal: Vec3 } | null = null;
    for (const p of this.parts) {
      const centre = { x: this.pos.x + axis.x * p.offset, y: this.pos.y + axis.y * p.offset, z: this.pos.z + axis.z * p.offset };
      const hit = this.world.castShape(centre, rot, disp, p.shape, 0, 1, false);
      if (hit && (!best || hit.time_of_impact < best.toi - 1e-6)) {
        const n = hit.normal1;
        best = { part: p.name, toi: hit.time_of_impact, normal: { x: n.x, y: n.y, z: n.z } };
      }
    }
    return best;
  }

  /** True when the shaft or body would overlap geometry at the current position with `lean`. */
  private overlaps(lean: Vec2): boolean {
    const axis = stickAxis(lean);
    const rot = rotationTo(axis);
    for (const p of this.parts) {
      if (p.name === "tip") continue;
      const centre = { x: this.pos.x + axis.x * p.offset, y: this.pos.y + axis.y * p.offset, z: this.pos.z + axis.z * p.offset };
      if (this.world.intersectionWithShape(centre, rot, p.shape)) return true;
    }
    return false;
  }
}
