import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POGO } from "../src/config.ts";
import { canDismount, inRestSpot, RIDING, standAmount, stepRide, type RideState } from "../src/core/restCore.ts";

const cfg = DEFAULT_POGO;
const dt = 1 / 120;
const spot = { min: { x: -3, y: 0, z: -3 }, max: { x: 3, y: 3, z: 3 } };

test("rest spots are box regions above their surface", () => {
  assert.ok(inRestSpot([spot], { x: 0, y: 0, z: 0 }));
  assert.ok(inRestSpot([spot], { x: 2.9, y: 1, z: -2.9 }));
  assert.ok(!inRestSpot([spot], { x: 3.1, y: 0, z: 0 }));
  assert.ok(!inRestSpot([spot], { x: 0, y: 4, z: 0 }));
  assert.ok(!inRestSpot([], { x: 0, y: 0, z: 0 }));
});

test("the key does nothing outside a rest spot", () => {
  assert.deepEqual(stepRide(RIDING, true, false, dt, cfg), RIDING);
});

test("a request inside a spot lasts until the contact, and is dropped on leaving", () => {
  let s = stepRide(RIDING, true, true, dt, cfg);
  assert.equal(s.requested, true);
  for (let i = 0; i < 100; i++) s = stepRide(s, false, true, dt, cfg);
  assert.equal(s.requested, true);
  assert.equal(stepRide(s, true, true, dt, cfg).requested, false, "pressing again cancels");
  assert.equal(stepRide(s, false, false, dt, cfg).requested, false);
});

test("getting off needs a request, the spot and low speed", () => {
  const asked: RideState = { ...RIDING, requested: true };
  assert.ok(canDismount(asked, true, 1, cfg));
  assert.ok(!canDismount(RIDING, true, 1, cfg));
  assert.ok(!canDismount(asked, false, 1, cfg));
  assert.ok(!canDismount(asked, true, cfg.dismountMaxSpeed + 0.1, cfg));
});

test("getting off and on take their times, then riding resumes", () => {
  let s: RideState = { phase: "gettingOff", t: 0, requested: false };
  const steps = (time: number) => Math.round(time / dt);
  for (let i = 0; i < steps(cfg.dismountTime) - 1; i++) s = stepRide(s, true, true, dt, cfg);
  assert.equal(s.phase, "gettingOff", "the key does nothing while getting off");
  s = stepRide(s, false, true, dt, cfg);
  assert.equal(s.phase, "standing");
  assert.equal(standAmount(s, cfg), 1);
  assert.equal(stepRide(s, false, true, dt, cfg).phase, "standing");
  s = stepRide(s, true, true, dt, cfg);
  assert.equal(s.phase, "gettingOn");
  for (let i = 0; i < steps(cfg.mountTime / 2); i++) s = stepRide(s, false, true, dt, cfg);
  assert.ok(Math.abs(standAmount(s, cfg) - 0.5) < 0.02);
  for (let i = 0; i < steps(cfg.mountTime / 2); i++) s = stepRide(s, false, true, dt, cfg);
  assert.deepEqual(s, RIDING);
});
