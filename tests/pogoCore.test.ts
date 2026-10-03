import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POGO, SIM_HZ } from "../src/config.ts";
import {
  chargedApex,
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
  type Vec3,
} from "../src/core/pogoCore.ts";

const cfg = DEFAULT_POGO;
const dt = 1 / SIM_HZ;
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("launch speed reaches the apex height", () => {
  const v = launchSpeed(cfg.normalApex, cfg.gravity);
  near((v * v) / (2 * cfg.gravity), cfg.normalApex);
  assert.equal(launchSpeed(-1, 20), 0);
});

test("lean target: W leans away from the camera, diagonals are normalised", () => {
  const w = leanTarget({ x: 0, z: 1 }, 0, 30);
  near(w.x, 0);
  near(w.z, -30);
  const d = leanTarget({ x: 1, z: 1 }, 0, 30);
  near(Math.hypot(d.x, d.z), 30);
  const none = leanTarget({ x: 0, z: 0 }, 0, 30);
  assert.deepEqual(none, { x: 0, z: 0 });
});

test("lean target follows camera yaw", () => {
  // Camera turned 90° left looks along -X, so W leans towards -X.
  const w = leanTarget({ x: 0, z: 1 }, Math.PI / 2, 30);
  near(w.x, -30);
  near(w.z, 0, 1e-9);
});

test("lean eases at leanRate with input and returnRate without", () => {
  let lean = { x: 0, z: 0 };
  lean = stepLean(lean, { x: 30, z: 0 }, true, 0.1, cfg);
  near(lean.x, cfg.leanRate * 0.1);
  lean = stepLean(lean, { x: 0, z: 0 }, false, 0.05, cfg);
  near(lean.x, cfg.leanRate * 0.1 - cfg.returnRate * 0.05);
  lean = stepLean(lean, { x: 0, z: 0 }, false, 1, cfg);
  assert.deepEqual(lean, { x: 0, z: 0 });
});

test("stick axis is a unit vector tilted by the lean", () => {
  assert.deepEqual(stickAxis({ x: 0, z: 0 }), { x: 0, y: 1, z: 0 });
  const a = stickAxis({ x: 30, z: 0 });
  near(Math.hypot(a.x, a.y, a.z), 1);
  near(a.x, 0.5);
  near(a.y, Math.cos(Math.PI / 6));
});

test("charge fills over chargeTime and holds at 1", () => {
  let s: ChargeState = { ...NO_CHARGE };
  for (let i = 0; i < SIM_HZ * cfg.chargeTime * 0.5; i++) s = stepCharge(s, true, dt, cfg);
  near(s.charge, 0.5, 1e-6);
  for (let i = 0; i < SIM_HZ * 5; i++) s = stepCharge(s, true, dt, cfg);
  assert.equal(s.charge, 1);
  assert.equal(s.armed, false);
});

test("releasing Space arms the jump; the next bounce uses it and resets the charge", () => {
  let s: ChargeState = { ...NO_CHARGE };
  for (let i = 0; i < SIM_HZ * 5; i++) s = stepCharge(s, true, dt, cfg);
  s = stepCharge(s, false, dt, cfg);
  assert.equal(s.armed, true);
  const b = resolveBounce(s, cfg);
  near(b.apex, cfg.chargedApex);
  assert.deepEqual(b.charge, { charge: 0, armed: false, held: false });
});

test("charge carries across idle hops while held", () => {
  const s: ChargeState = { charge: 0.4, armed: false, held: true };
  const b = resolveBounce(s, cfg);
  assert.equal(b.apex, cfg.idleHopApex);
  assert.deepEqual(b.charge, s);
});

test("no charge gives the normal bounce", () => {
  assert.equal(resolveBounce(NO_CHARGE, cfg).apex, cfg.normalApex);
});

test("charged apex interpolates by charge and curve", () => {
  near(chargedApex(0, cfg), cfg.normalApex);
  near(chargedApex(0.5, cfg), (cfg.normalApex + cfg.chargedApex) / 2);
  near(chargedApex(0.5, { ...cfg, chargeCurve: 2 }), cfg.normalApex + (cfg.chargedApex - cfg.normalApex) * 0.25);
});

test("launch velocity discards incoming vertical and keeps a fraction of horizontal", () => {
  const v = launchVelocity({ x: 0, z: 0 }, 5, { x: 2, y: -9, z: -4 }, { keepHorizontal: 0.5, leanPush: 1 });
  assert.deepEqual(v, { x: 1, y: 5, z: -2 });
});

test("leaning pushes horizontally without lowering the bounce", () => {
  const v = launchVelocity({ x: 30, z: 0 }, 10, { x: 0, y: 0, z: 0 }, { keepHorizontal: 0, leanPush: 1 });
  near(v.y, 10);
  near(v.x, 5);
  near(v.z, 0);
});

test("momentum builds to a top speed and counter-lean brakes", () => {
  const m = { keepHorizontal: 0.6, leanPush: 1 };
  let vel: Vec3 = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < 50; i++) vel = launchVelocity({ x: 30, z: 0 }, 10, vel, m);
  // Steady state: push / (1 - keep) = 5 / 0.4.
  near(vel.x, 12.5, 1e-6);
  const braked = launchVelocity({ x: -30, z: 0 }, 10, vel, m);
  near(braked.x, 12.5 * 0.6 - 5);
});

test("a simulated normal bounce peaks at the configured apex", () => {
  // Bounce on a floor at y = 0 several times and record each peak.
  let pos: Vec3 = { x: 0, y: 0, z: 0 };
  let vel = launchVelocity({ x: 0, z: 0 }, launchSpeed(cfg.normalApex, cfg.gravity), pos, cfg);
  let peak = 0;
  const peaks: number[] = [];
  for (let i = 0; i < SIM_HZ * 3; i++) {
    ({ pos, vel } = stepBallistic(pos, vel, cfg.gravity, dt));
    peak = Math.max(peak, pos.y);
    if (pos.y <= 0 && vel.y < 0) {
      pos = { ...pos, y: 0 };
      vel = launchVelocity({ x: 0, z: 0 }, launchSpeed(cfg.normalApex, cfg.gravity), vel, cfg);
      peaks.push(peak);
      peak = 0;
    }
  }
  assert.ok(peaks.length >= 3);
  // Sampled at 120 Hz the recorded peak is within a few millimetres of the true apex.
  for (const p of peaks) near(p, cfg.normalApex, 0.005);
});
