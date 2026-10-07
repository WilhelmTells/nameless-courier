import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POGO, SIM_HZ } from "../src/config.ts";
import {
  applyMouseLean,
  carriedApex,
  chargedApex,
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

test("mouse up leans away from the camera, mouse right leans right", () => {
  const up = applyMouseLean({ x: 0, z: 0 }, 0, -100, 0, 0.1, 60);
  near(up.x, 0);
  near(up.z, -10);
  const right = applyMouseLean({ x: 0, z: 0 }, 100, 0, 0, 0.1, 60);
  near(right.x, 10);
  near(right.z, 0);
});

test("mouse lean follows camera yaw and matches the keyboard direction", () => {
  const up = applyMouseLean({ x: 0, z: 0 }, 0, -100, Math.PI / 2, 0.1, 60);
  const w = leanTarget({ x: 0, z: 1 }, Math.PI / 2, 10);
  near(up.x, w.x);
  near(up.z, w.z);
});

test("mouse lean is clamped to max lean and stays where it is left", () => {
  const far = applyMouseLean({ x: 0, z: 0 }, 3000, -4000, 0, 0.1, 60);
  near(Math.hypot(far.x, far.z), 60);
  near(far.x / far.z, -3 / 4);
  const still = applyMouseLean(far, 0, 0, 0, 0.1, 60);
  assert.deepEqual(still, far);
});

test("moving the mouse back returns the lean to upright", () => {
  const out = applyMouseLean({ x: 0, z: 0 }, 50, 80, 1.2, 0.1, 60);
  const back = applyMouseLean(out, -50, -80, 1.2, 0.1, 60);
  near(back.x, 0);
  near(back.z, 0);
});

test("swinging the stick keeps the pivot in place and moves the tip the other way", () => {
  const tip = { x: 1, y: 2, z: 3 };
  const lean = { x: 60, z: 0 };
  const swung = swingTip(tip, { x: 0, z: 0 }, lean, 1.1);
  const a = stickAxis(lean);
  near(swung.x + a.x * 1.1, tip.x);
  near(swung.y + a.y * 1.1, tip.y + 1.1);
  near(swung.z + a.z * 1.1, tip.z);
  near(swung.x, 1 - 1.1 * Math.sin(Math.PI / 3));
  near(swung.y, 2 + 1.1 * (1 - Math.cos(Math.PI / 3)));
});

test("a pivot height of 0 turns the stick about its tip", () => {
  const tip = { x: 1, y: 2, z: 3 };
  assert.deepEqual(swingTip(tip, { x: 10, z: -20 }, { x: -40, z: 5 }, 0), tip);
});

test("lean target follows camera yaw", () => {
  // Camera turned 90° left looks along -X, so W leans towards -X.
  const w = leanTarget({ x: 0, z: 1 }, Math.PI / 2, 30);
  near(w.x, -30);
  near(w.z, 0, 1e-9);
});

test("lean eases at leanRate with input and returnRate without", () => {
  // Fixed rates, so the first step stays short of the target whatever the defaults.
  const rates = { leanRate: 200, returnRate: 240 };
  let lean = { x: 0, z: 0 };
  lean = stepLean(lean, { x: 30, z: 0 }, true, 0.1, rates);
  near(lean.x, 20);
  lean = stepLean(lean, { x: 0, z: 0 }, false, 0.05, rates);
  near(lean.x, 20 - 12);
  lean = stepLean(lean, { x: 0, z: 0 }, false, 1, rates);
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

test("bounces after a fall die down gradually, up to a cap", () => {
  near(carriedApex(4, cfg), 4 * cfg.bounceRetain);
  near(carriedApex(100, cfg), cfg.maxCarriedApex);
  assert.equal(carriedApex(-1, cfg), 0);
  // 10 m fall: the bounces shrink back towards the normal bounce.
  let apex = 10;
  const seen: number[] = [];
  for (let i = 0; i < 5; i++) {
    apex = resolveBounce(NO_CHARGE, cfg, carriedApex(apex, cfg)).apex;
    seen.push(apex);
  }
  assert.deepEqual(seen, [5, 2.5, 1.25, 1, 1]);
});

test("holding Space absorbs the carried bounce; an armed jump goes at least as high", () => {
  const held: ChargeState = { charge: 0.3, armed: false, held: true };
  assert.equal(resolveBounce(held, cfg, 5).apex, cfg.idleHopApex);
  const armed: ChargeState = { charge: 0.1, armed: true, held: false };
  assert.equal(resolveBounce(armed, cfg, 5).apex, 5);
  near(resolveBounce({ charge: 1, armed: true, held: false }, cfg, 5).apex, cfg.chargedApex);
});

test("letting go of the keys brakes: less momentum is kept without steering", () => {
  assert.equal(momentumKeep(true, cfg), cfg.keepHorizontal);
  assert.equal(momentumKeep(false, cfg), cfg.keepWithoutInput);
  assert.ok(cfg.keepWithoutInput < cfg.keepHorizontal);
});

test("surfaces: trampolines throw harder, mud softer, slower to charge and sticky", () => {
  assert.equal(surfaceLaunchFactor("normal", cfg), 1);
  assert.equal(surfaceLaunchFactor("trampoline", cfg), cfg.trampolineFactor);
  assert.equal(surfaceLaunchFactor("mud", cfg), cfg.mudFactor);
  // Launch speed × 1.6 multiplies the apex by 1.6².
  const v = launchSpeed(cfg.normalApex, cfg.gravity) * cfg.trampolineFactor;
  near((v * v) / (2 * cfg.gravity), cfg.normalApex * cfg.trampolineFactor ** 2);
  assert.equal(surfaceChargeRate("normal", cfg), 1);
  assert.equal(surfaceChargeRate("mud", cfg), cfg.mudChargeRate);
  assert.equal(surfaceKeep(0.6, "normal", cfg), 0.6);
  assert.equal(surfaceKeep(0.6, "trampoline", cfg), 0.6);
  assert.equal(surfaceKeep(0.6, "mud", cfg), cfg.mudKeep);
  assert.equal(surfaceKeep(0.05, "mud", cfg), 0.05);
});
