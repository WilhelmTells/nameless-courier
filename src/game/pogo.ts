// Pogo controller: applies input and the core rules each simulation step, and
// finds contacts by shape-casting the tip, shaft and body against the level.

import RAPIER from "@dimforge/rapier3d-compat";
import { pogoConfig as cfg } from "../config.ts";
import { angleBetween, bonkVelocity, slopeLaunch, tipContactValid, wallKick, wallKickAllowed } from "../core/contactCore.ts";
import {
  applyMouseLean,
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
  surfaceChargeRate,
  surfaceKeep,
  surfaceLaunchFactor,
  swingTip,
  type ChargeState,
  type Vec2,
  type Vec3,
} from "../core/pogoCore.ts";
import { canDismount, inRestSpot, RIDING, STANDING, stepRide, type RestRegion, type RideState } from "../core/restCore.ts";
import type { PogoState } from "../core/saveCore.ts";
import type { Surface } from "../levels/types.ts";
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
/** Largest lean change checked against the level at once while the stick swings, degrees. */
const SWING_STEP = 2;

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

/** What the pogo needs to know about the level beyond its shapes. */
export interface LevelInfo {
  /** Surface type of the piece a collider belongs to. */
  surfaceOf(collider: RAPIER.Collider): Surface;
}

/** A level without surface types: everything is normal. */
const PLAIN_LEVEL: LevelInfo = { surfaceOf: () => "normal" };

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
  /** Number of launches so far: changes whenever the pogo bounces (or the courier gets off). */
  launches = 0;
  /** Riding, or getting off / standing / getting on at a rest spot. */
  ride: RideState = { ...RIDING };
  /** Surface of the last floor bounce: decides how fast the charge fills. */
  surface: Surface = "normal";

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
  /** Last direction pressed (unit vector) since the last launch; zero if none. Decides wall kicks. */
  private kickDir: Vec2 = { x: 0, z: 0 };

  private world: RAPIER.World;
  private restSpots: readonly RestRegion[];
  private level: LevelInfo;

  constructor(start: Vec3, world: RAPIER.World, restSpots: readonly RestRegion[] = [], level: LevelInfo = PLAIN_LEVEL) {
    this.world = world;
    this.restSpots = restSpots;
    this.level = level;
    this.pos = { ...start, y: start.y + SPAWN_LIFT };
    this.prevPos = { ...this.pos };
    this.peakY = this.launchY = start.y;
  }

  /** Height of the last launch point, m. */
  get groundY(): number {
    return this.launchY;
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
    this.kickDir = { x: 0, z: 0 };
    this.ride = { ...RIDING };
    this.surface = "normal";
  }

  /** True when the pogo is inside a rest spot, where the courier can get off. */
  inRestSpot(): boolean {
    return inRestSpot(this.restSpots, this.pos);
  }

  /** The state needed to continue later, for saving. */
  snapshot(): PogoState {
    const { charge, armed } = this.charge;
    const standing = this.ride.phase === "gettingOff" || this.ride.phase === "standing";
    return { pos: this.pos, vel: this.vel, lean: this.lean, charge, armed, launchY: this.launchY, peakY: this.peakY, standing };
  }

  /** Continues from a saved state. Keys are not held after a reload. */
  restore(s: PogoState): void {
    this.reset(s.pos);
    this.pos = this.prevPos = { ...s.pos };
    this.vel = { ...s.vel };
    this.lean = this.prevLean = { ...s.lean };
    this.charge = { charge: s.charge, armed: s.armed, held: false };
    this.launchY = s.launchY;
    this.peakY = s.peakY;
    if (s.standing) {
      this.ride = { ...STANDING };
      this.vel = { x: 0, y: 0, z: 0 };
      this.lean = this.prevLean = { x: 0, z: 0 };
    }
  }

  step(input: PogoInput, cameraYaw: number, dt: number): void {
    this.prevPos = this.pos;
    this.prevLean = this.lean;

    const wasGettingOn = this.ride.phase === "gettingOn";
    this.ride = stepRide(this.ride, input.toggleRide, this.inRestSpot(), dt, cfg);
    if (this.ride.phase !== "riding") {
      // Off the pogo: the courier stands still and holds the stick upright.
      this.vel = { x: 0, y: 0, z: 0 };
      this.charge = { ...NO_CHARGE };
      this.lean = stepLean(this.lean, NO_LEAN, false, dt, cfg);
      this.sinceLaunch += dt;
      return;
    }
    if (wasGettingOn) {
      // Back on: the next bounce starts from rest, with nothing carried over.
      this.vel = { x: 0, y: 0, z: 0 };
      this.lean = this.prevLean = { x: 0, z: 0 };
      this.peakY = this.launchY = this.pos.y;
      this.steering = false;
      this.kickDir = NO_LEAN;
    }

    this.bonkLock = Math.max(0, this.bonkLock - dt);
    const locked = this.bonkLock > 0;
    if (input.mode === "mouse") this.stepMouseLean(input, cameraYaw, locked, dt);
    else this.stepKeyLean(input, cameraYaw, locked, dt);
    this.charge = stepCharge(this.charge, input.charge, dt * surfaceChargeRate(this.surface, cfg), cfg);

    this.move(dt);

    this.sinceLaunch += dt;
    this.peakY = Math.max(this.peakY, this.pos.y);
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (hSpeed > MOVE_DIR_MIN_SPEED) this.moveDir = { x: this.vel.x / hSpeed, z: this.vel.z / hSpeed };
  }

  /** WASD: the lean eases towards the pressed direction. */
  private stepKeyLean(input: PogoInput, cameraYaw: number, locked: boolean, dt: number): void {
    const hasLean = !locked && (input.lean.x !== 0 || input.lean.z !== 0);
    const target = hasLean ? leanTarget(input.lean, cameraYaw, cfg.maxLean) : NO_LEAN;
    if (hasLean) {
      this.steering = true;
      this.kickDir = leanTarget(input.lean, cameraYaw, 1);
    } else if (!cfg.holdLeanInAir) {
      this.kickDir = NO_LEAN;
    }
    // A lean pressed in this flight is held until the next contact.
    const hold = !hasLean && cfg.holdLeanInAir && this.steering;
    this.setLean(hold ? this.lean : stepLean(this.lean, target, hasLean, dt, cfg));
  }

  /**
   * Mouse: the mouse moves the lean directly and it stays where it is left.
   * After a bonk it eases back to upright while input is locked. A lean past
   * the deadzone counts as a pressed direction (momentum, wall kicks).
   */
  private stepMouseLean(input: PogoInput, cameraYaw: number, locked: boolean, dt: number): void {
    this.setLean(
      locked
        ? stepLean(this.lean, NO_LEAN, false, dt, cfg)
        : applyMouseLean(this.lean, cfg.mouseInvertX ? -input.mouse.dx : input.mouse.dx, cfg.mouseInvertY ? -input.mouse.dy : input.mouse.dy, cameraYaw, cfg.mouseLeanSensitivity, cfg.maxLean),
    );
    const angle = Math.hypot(this.lean.x, this.lean.z);
    this.steering = !locked && angle > cfg.mouseDeadzone;
    this.kickDir = this.steering ? { x: this.lean.x / angle, z: this.lean.z / angle } : NO_LEAN;
  }

  /**
   * Turns the stick about the rider (pivotHeight), which swings the tip. The
   * swing is checked against the level in small steps and stops at the last
   * free pose; it goes through freely only if the pogo is already stuck.
   */
  private setLean(lean: Vec2): void {
    const from = this.lean;
    const start = this.pos;
    const swingTo = (l: Vec2) => swingTip(start, from, l, cfg.pivotHeight);
    if (this.overlaps(start, from)) {
      this.pos = swingTo(lean);
      this.lean = lean;
      return;
    }
    const n = Math.ceil(angleBetween(stickAxis(from), stickAxis(lean)) / SWING_STEP);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const l = { x: from.x + (lean.x - from.x) * t, z: from.z + (lean.z - from.z) * t };
      const p = swingTo(l);
      if (this.overlaps(p, l)) return;
      this.pos = p;
      this.lean = l;
    }
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
      // Touching a wall with a direction pressed away from it kicks off it, whatever part touches.
      if (wallKickAllowed(this.kickDir, n, cfg)) {
        this.launch(stick, n, "wall");
        return;
      }
      if (hit.part === "tip" && approaching && tipContactValid(stick, n, cfg)) {
        if (canDismount(this.ride, this.inRestSpot(), Math.hypot(this.vel.x, this.vel.z), cfg)) this.getOff(stick, n);
        else this.launch(stick, n, "floor", this.level.surfaceOf(hit.collider));
        return;
      }
      const bonk = bonkVelocity(this.vel, n, cfg);
      this.vel = bonk.vel;
      if (bonk.hard) {
        this.bonkLock = cfg.bonkLockTime;
        this.steering = false;
        this.kickDir = NO_LEAN;
        this.lastContact = { kind: "bonk", angle: angleBetween(stick, n) };
      }
      planes.push(n);
    }
  }

  /** Lands without launching and starts getting off. Counts as a launch from here for the run stats. */
  private getOff(stick: Vec3, normal: Vec3): void {
    this.vel = { x: 0, y: 0, z: 0 };
    this.charge = { ...NO_CHARGE };
    this.ride = { phase: "gettingOff", t: 0, requested: false };
    this.steering = false;
    this.kickDir = NO_LEAN;
    this.lastContact = { kind: "floor", angle: angleBetween(stick, normal) };
    this.lastApex = this.peakY - this.launchY;
    this.peakY = this.launchY = this.pos.y;
    this.launches++;
  }

  /** Wall kicks ignore the surface type; floor bounces use it. */
  private launch(stick: Vec3, normal: Vec3, kind: "floor" | "wall", surface: Surface = "normal"): void {
    // Floor bounces carry part of the fall; wall kicks drop the falling speed.
    const carried = kind === "floor" ? carriedApex(this.peakY - this.pos.y, cfg) : 0;
    const bounce = resolveBounce(this.charge, cfg, carried);
    this.charge = bounce.charge;
    const keep = { ...cfg, keepHorizontal: surfaceKeep(momentumKeep(this.steering, cfg), surface, cfg) };
    this.steering = false;
    if (kind === "wall") {
      this.vel = wallKick(this.kickDir, normal, bounce.apex, this.vel, keep);
    } else {
      this.surface = surface;
      const speed = launchSpeed(bounce.apex, cfg.gravity) * surfaceLaunchFactor(surface, cfg);
      const flat = launchVelocity(this.lean, speed, this.vel, keep);
      this.vel = slopeLaunch(flat, normal, cfg.slopeBlend);
    }
    this.kickDir = NO_LEAN;
    this.lastContact = { kind, angle: angleBetween(stick, normal) };
    this.lastApex = this.peakY - this.launchY;
    this.peakY = this.launchY = this.pos.y;
    this.sinceLaunch = 0;
    this.launches++;
  }

  /** Earliest contact of any part moving by `disp` (fraction of `disp`); the tip wins ties. */
  private cast(disp: Vec3): { part: Part["name"]; toi: number; normal: Vec3; collider: RAPIER.Collider } | null {
    const axis = stickAxis(this.lean);
    const rot = rotationTo(axis);
    let best: { part: Part["name"]; toi: number; normal: Vec3; collider: RAPIER.Collider } | null = null;
    for (const p of this.parts) {
      const centre = { x: this.pos.x + axis.x * p.offset, y: this.pos.y + axis.y * p.offset, z: this.pos.z + axis.z * p.offset };
      const hit = this.world.castShape(centre, rot, disp, p.shape, 0, 1, false);
      if (hit && (!best || hit.time_of_impact < best.toi - 1e-6)) {
        const n = hit.normal1;
        best = { part: p.name, toi: hit.time_of_impact, normal: { x: n.x, y: n.y, z: n.z }, collider: hit.collider };
      }
    }
    return best;
  }

  /** True when any part would overlap geometry with the tip at `tip` and the stick at `lean`. */
  private overlaps(tip: Vec3, lean: Vec2): boolean {
    const axis = stickAxis(lean);
    const rot = rotationTo(axis);
    for (const p of this.parts) {
      const centre = { x: tip.x + axis.x * p.offset, y: tip.y + axis.y * p.offset, z: tip.z + axis.z * p.offset };
      if (this.world.intersectionWithShape(centre, rot, p.shape)) return true;
    }
    return false;
  }
}
