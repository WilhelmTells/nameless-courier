import { test } from "node:test";
import assert from "node:assert/strict";
import { flyLook, flyMove, flySpeed, FLY_PITCH_LIMIT, FLY_SPEED_MAX, FLY_SPEED_MIN, lookDirection } from "../src/core/flyCore.ts";

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("yaw 0 looks along -Z; pitch looks up", () => {
  const d = lookDirection(0, 0);
  near(d.x, 0);
  near(d.y, 0);
  near(d.z, -1);
  near(lookDirection(0, 90).y, 1);
});

test("mouse right turns right, mouse up looks up, pitch is limited", () => {
  const turned = flyLook(0, 0, 100, 0, 0.01);
  assert.ok(lookDirection(turned.yaw, 0).x > 0);
  assert.ok(flyLook(0, 0, 0, -10, 0.01).pitch > 0);
  assert.equal(flyLook(0, 0, 0, -1e6, 0.01).pitch, FLY_PITCH_LIMIT);
  assert.equal(flyLook(0, 0, 0, 1e6, 0.01).pitch, -FLY_PITCH_LIMIT);
});

test("moves forward along the look, right on the level, up straight up", () => {
  const o = { x: 0, y: 0, z: 0 };
  const fwd = flyMove(o, 0, 0, { forward: 1, right: 0, up: 0 }, 10, 0.5);
  near(fwd.z, -5);
  const right = flyMove(o, 0, 45, { forward: 0, right: 1, up: 0 }, 10, 0.5);
  near(right.x, 5);
  near(right.y, 0);
  const up = flyMove(o, 1, -30, { forward: 0, right: 0, up: 1 }, 10, 0.5);
  near(up.y, 5);
  const climb = flyMove(o, 0, 30, { forward: 1, right: 0, up: 0 }, 10, 1);
  near(climb.y, 5);
});

test("diagonals are not faster, no input does not move", () => {
  const d = flyMove({ x: 0, y: 0, z: 0 }, 0, 0, { forward: 1, right: 1, up: 1 }, 10, 1);
  near(Math.hypot(d.x, d.y, d.z), 10);
  assert.deepEqual(flyMove({ x: 1, y: 2, z: 3 }, 0, 0, { forward: 0, right: 0, up: 0 }, 10, 1), { x: 1, y: 2, z: 3 });
});

test("the wheel changes speed within limits", () => {
  assert.ok(flySpeed(10, -1) > 10);
  assert.ok(flySpeed(10, 1) < 10);
  assert.equal(flySpeed(10, -100), FLY_SPEED_MAX);
  assert.equal(flySpeed(10, 100), FLY_SPEED_MIN);
});
