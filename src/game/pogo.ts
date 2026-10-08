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
  /** Velocity of the piece at a world point, now; zero for still pieces, m/s. */
  velocityAt(collider: RAPIER.Collider, point: Vec3): Vec3;
  /** The look of the piece a collider belongs to (stone, iron, wood…), for its sound; undefined if plain. */
  materialOf?(collider: RAPIER.Collider): string | undefined;
  /** The pieces that move. */
  readonly movers: readonly { collider: RAPIER.Collider }[];
}

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

/** A level without surface types or moving pieces. */
const PLAIN_LEVEL: LevelInfo = { surfaceOf: () => "normal", velocityAt: () => ZERO, movers: [] };

/** Rounds of pushing the pogo out of moving pieces per step. */
const MOVER_PASSES = 3;
/** Riding without moving for this long means hanging on an edge (body on it, tip in the air), s. */
const STALL_TIME = 0.3;
/** Less movement than this in a step counts as not moving, m. */
const STALL_MOVE = 1e-4;
/** Speed of the nudge off an edge the pogo hangs on, m/s. */
const STALL_PUSH = 1.5;

/** First contact of a shape cast: which part, when (fraction of the move), the surface normal, what and where. */
interface CastHit {
  part: Part["name"];
  toi: number;
  normal: Vec3;
  collider: RAPIER.Collider;
  point: Vec3;
}

export type ContactKind = "floor" | "wall" | "bonk";

/** A contact that makes a sound (§7). The game reads them after each step and clears the list. */
export interface PogoSound {
  /** "land": the courier came down to get off. */
  kind: "floor" | "wall" | "bonk" | "land";
  surface: Surface;
  /** The look of the piece hit, if it has one. */
  material?: string;
  /** Speed into the surface, m/s. */
  speed: number;
  /** Charge released by this bounce, 0..1; 0 for a plain bounce. */
  charge: number;
}

/** A knock slower than this into a surface makes no sound, m/s. */
const SILENT_KNOCK = 1.5;

export interface Contact {
  kind: ContactKind;
  /** Angle between the stick and the surface normal, degrees. */
  angle: number;
}

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
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
  /** Contacts since the game last read them, for the sound. */
  sounds: PogoSound[] = [];

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
  /** Time riding without moving, s. */
  private stalled = 0;

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
    this.stalled = 0;
    this.sounds = [];
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
    this.hitByMovers();
    this.pushOutOfLevel();
    const locked = this.bonkLock > 0;
    if (input.mode === "mouse") this.stepMouseLean(input, cameraYaw, locked, dt);
    else this.stepKeyLean(input, cameraYaw, locked, dt);
    this.charge = stepCharge(this.charge, input.charge, dt * surfaceChargeRate(this.surface, cfg), cfg);

    const before = this.pos;
    this.move(dt);
    const moved = Math.hypot(this.pos.x - before.x, this.pos.y - before.y, this.pos.z - before.z);
    this.stalled = moved < STALL_MOVE ? this.stalled + dt : 0;
    if (this.stalled >= STALL_TIME) this.nudgeOffEdge();

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
      const carrier = this.level.velocityAt(hit.collider, hit.point);
      const moving = carrier.x !== 0 || carrier.y !== 0 || carrier.z !== 0;
      // On a moving piece what counts is the motion relative to it.
      const rel = moving ? sub(this.vel, carrier) : disp;
      const approaching = rel.x * n.x + rel.y * n.y + rel.z * n.z < 0;
      // Touching a wall with a direction pressed away from it kicks off it, whatever part touches.
      if (wallKickAllowed(this.kickDir, n, cfg)) {
        this.launch(stick, n, "wall", "normal", carrier, hit.collider);
        return;
      }
      if (hit.part === "tip" && approaching && tipContactValid(stick, n, cfg)) {
        const relSpeed = Math.hypot(this.vel.x - carrier.x, this.vel.z - carrier.z);
        if (canDismount(this.ride, this.inRestSpot(), relSpeed, cfg)) this.getOff(stick, n, hit.collider);
        else this.launch(stick, n, "floor", this.level.surfaceOf(hit.collider), carrier, hit.collider);
        return;
      }
      this.bonk(stick, n, carrier, hit.collider);
      // A moving surface does not stay put to slide along: stop here for this step.
      if (moving) return;
      planes.push(n);
    }
  }

  /** Bonk off a surface moving at `carrier`: the bounce is worked out relative to it. */
  private bonk(stick: Vec3, n: Vec3, carrier: Vec3, collider: RAPIER.Collider): void {
    const incoming = sub(this.vel, carrier);
    const bonk = bonkVelocity(incoming, n, cfg);
    this.vel = add(bonk.vel, carrier);
    const speed = -dot(incoming, n);
    if (bonk.hard || speed > SILENT_KNOCK) this.hear("bonk", "normal", speed, 0, collider);
    if (bonk.hard) {
      this.bonkLock = cfg.bonkLockTime;
      this.steering = false;
      this.kickDir = NO_LEAN;
      this.lastContact = { kind: "bonk", angle: angleBetween(stick, n) };
    }
  }

  /**
   * Moving pieces may have moved into the pogo since the last step. Pushes
   * it out; a tip pushed up from below bounces off the piece, anything else
   * is knocked away with the piece's speed. The step then moves on as usual.
   */
  private hitByMovers(): void {
    if (this.level.movers.length === 0) return;
    let hit: { part: Part["name"]; normal: Vec3; collider: RAPIER.Collider; point: Vec3 } | null = null;
    for (let pass = 0; pass < MOVER_PASSES; pass++) {
      const axis = stickAxis(this.lean);
      const rot = rotationTo(axis);
      let moved = false;
      for (const { collider } of this.level.movers) {
        for (const p of this.parts) {
          const centre = add(this.pos, scale(axis, p.offset));
          const c = collider.contactShape(p.shape, centre, rot, 0);
          if (!c || c.distance >= 0) continue;
          const n = { x: c.normal1.x, y: c.normal1.y, z: c.normal1.z };
          this.pos = add(this.pos, scale(n, -c.distance + SKIN));
          moved = true;
          // The tip counts first: it decides between a bounce and a knock.
          if (!hit || (p.name === "tip" && hit.part !== "tip")) hit = { part: p.name, normal: n, collider, point: c.point1 };
          break;
        }
      }
      if (!moved) break;
    }
    if (!hit) return;
    const stick = stickAxis(this.lean);
    const carrier = this.level.velocityAt(hit.collider, hit.point);
    if (hit.part === "tip" && tipContactValid(stick, hit.normal, cfg)) {
      this.launch(stick, hit.normal, "floor", this.level.surfaceOf(hit.collider), carrier, hit.collider);
    } else {
      this.bonk(stick, hit.normal, carrier, hit.collider);
    }
  }

  /**
   * Pushes the pogo out of still geometry it has sunk into. A swing that
   * starts in contact goes through freely (see setLean), which can leave a
   * part a few millimetres inside a block; from there every cast would hit at
   * once and the pogo could never move again.
   */
  private pushOutOfLevel(): void {
    for (let pass = 0; pass < MOVER_PASSES; pass++) {
      const axis = stickAxis(this.lean);
      const rot = rotationTo(axis);
      let deepest: { normal: Vec3; depth: number } | null = null;
      for (const p of this.parts) {
        const centre = add(this.pos, scale(axis, p.offset));
        this.world.intersectionsWithShape(centre, rot, p.shape, (collider) => {
          const c = collider.contactShape(p.shape, centre, rot, 0);
          if (c && -c.distance > SKIN && (!deepest || -c.distance > deepest.depth)) {
            deepest = { normal: { x: c.normal1.x, y: c.normal1.y, z: c.normal1.z }, depth: -c.distance };
          }
          return true;
        });
      }
      if (!deepest) return;
      const { normal, depth } = deepest as { normal: Vec3; depth: number };
      this.pos = add(this.pos, scale(normal, depth + SKIN));
    }
  }

  /**
   * The pogo hangs on an edge: its body rests on it while the tip is in the
   * air, so it never bounces again. Nudges it off sideways, away from the
   * lean (the tip hangs on that side), or the nearest free way.
   */
  private nudgeOffEdge(): void {
    this.stalled = 0;
    const len = Math.hypot(this.lean.x, this.lean.z);
    const away = len > 1 ? Math.atan2(-this.lean.z, -this.lean.x) : Math.atan2(this.moveDir.z, this.moveDir.x);
    for (let k = 0; k < 8; k++) {
      // Away first, then alternating either side of it.
      const a = away + Math.ceil(k / 2) * (k % 2 ? 1 : -1) * (Math.PI / 4);
      const dir = { x: Math.cos(a), y: 0, z: Math.sin(a) };
      if (this.cast(scale(dir, 0.3))) continue;
      this.pos = add(this.pos, scale(dir, 0.05));
      this.vel = scale(dir, STALL_PUSH);
      return;
    }
    this.pos = add(this.pos, { x: 0, y: 0.05, z: 0 });
  }

  private hear(kind: PogoSound["kind"], surface: Surface, speed: number, charge: number, collider?: RAPIER.Collider): void {
    // An unread list never grows without end.
    if (this.sounds.length > 8) this.sounds.shift();
    const material = collider ? this.level.materialOf?.(collider) : undefined;
    this.sounds.push({ kind, surface, material, speed: Math.max(0, speed), charge });
  }

  /** Lands without launching and starts getting off. Counts as a launch from here for the run stats. */
  private getOff(stick: Vec3, normal: Vec3, collider: RAPIER.Collider): void {
    this.hear("land", this.level.surfaceOf(collider), -dot(this.vel, normal), 0, collider);
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

  /**
   * Wall kicks ignore the surface type; floor bounces use it. `carrier` is the
   * velocity of the surface: the launch is worked out relative to it and then
   * carried along (riding a moving platform, a rising piston throws higher).
   */
  private launch(stick: Vec3, normal: Vec3, kind: "floor" | "wall", surface: Surface = "normal", carrier: Vec3 = ZERO, collider?: RAPIER.Collider): void {
    const incoming = sub(this.vel, carrier);
    this.hear(kind, surface, -dot(incoming, normal), this.charge.armed ? this.charge.charge : 0, collider);
    // Floor bounces carry part of the fall; wall kicks drop the falling speed.
    const carried = kind === "floor" ? carriedApex(this.peakY - this.pos.y, cfg) : 0;
    const bounce = resolveBounce(this.charge, cfg, carried);
    this.charge = bounce.charge;
    const keep = { ...cfg, keepHorizontal: surfaceKeep(momentumKeep(this.steering, cfg), surface, cfg) };
    this.steering = false;
    if (kind === "wall") {
      this.vel = add(wallKick(this.kickDir, normal, bounce.apex, incoming, keep), carrier);
    } else {
      this.surface = surface;
      const speed = launchSpeed(bounce.apex, cfg.gravity) * surfaceLaunchFactor(surface, cfg);
      const flat = launchVelocity(this.lean, speed, incoming, keep);
      this.vel = add(slopeLaunch(flat, normal, cfg.slopeBlend), carrier);
    }
    this.kickDir = NO_LEAN;
    this.lastContact = { kind, angle: angleBetween(stick, normal) };
    this.lastApex = this.peakY - this.launchY;
    this.peakY = this.launchY = this.pos.y;
    this.sinceLaunch = 0;
    this.launches++;
  }

  /** Earliest contact of any part moving by `disp` (fraction of `disp`); the tip wins ties. */
  private cast(disp: Vec3): CastHit | null {
    const axis = stickAxis(this.lean);
    const rot = rotationTo(axis);
    let best: CastHit | null = null;
    for (const p of this.parts) {
      const centre = { x: this.pos.x + axis.x * p.offset, y: this.pos.y + axis.y * p.offset, z: this.pos.z + axis.z * p.offset };
      const hit = this.world.castShape(centre, rot, disp, p.shape, 0, 1, false);
      if (hit && (!best || hit.time_of_impact < best.toi - 1e-6)) {
        const n = hit.normal1;
        const w = hit.witness1;
        best = { part: p.name, toi: hit.time_of_impact, normal: { x: n.x, y: n.y, z: n.z }, collider: hit.collider, point: { x: w.x, y: w.y, z: w.z } };
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
