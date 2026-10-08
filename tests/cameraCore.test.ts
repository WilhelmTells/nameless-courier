import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CAMERA } from "../src/config.ts";
import {
  sensitivityFactor,
  applyMouse,
  followYaw,
  applyZoom,
  markerScale,
  moveToward,
  orbitDirection,
  pitchToSeeBelow,
  recenterYaw,
  springArm,
  tiltDrop,
  wrapAngle,
} from "../src/core/cameraCore.ts";
import { leanTarget } from "../src/core/pogoCore.ts";

const cfg = DEFAULT_CAMERA;
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("orbit direction: yaw 0 puts the camera on +Z, pitch raises it", () => {
  const d = orbitDirection(0, 0);
  near(d.x, 0);
  near(d.y, 0);
  near(d.z, 1);
  const up = orbitDirection(0, 90);
  near(up.y, 1);
});

test("recentering looks along the movement direction, matching lean input", () => {
  for (const dir of [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: -0.6, z: 0.8 }]) {
    const yaw = recenterYaw(dir)!;
    // After recentering, W must lean in the movement direction.
    const w = leanTarget({ x: 0, z: 1 }, yaw, 1);
    near(w.x, dir.x);
    near(w.z, dir.z);
  }
  assert.equal(recenterYaw({ x: 0, z: 0 }), null);
});

test("mouse turns yaw and clamps pitch; invertY flips pitch", () => {
  const r = applyMouse(0, 15, 100, 0, cfg);
  near(r.yaw, -100 * cfg.sensitivity);
  assert.equal(applyMouse(0, 15, 0, 1e6, cfg).pitch, cfg.pitchMax);
  assert.equal(applyMouse(0, 15, 0, -1e6, cfg).pitch, cfg.pitchMin);
  const a = applyMouse(0, 15, 0, 10, cfg).pitch;
  const b = applyMouse(0, 15, 0, 10, { ...cfg, invertY: true }).pitch;
  near(a - 15, 15 - b);
});

test("angles wrap", () => {
  near(wrapAngle(3 * Math.PI), Math.PI);
  near(wrapAngle(-Math.PI / 2), -Math.PI / 2);
});

test("zoom stays within limits", () => {
  assert.equal(applyZoom(6.5, 100, cfg), cfg.distanceMax);
  assert.equal(applyZoom(6.5, -100, cfg), cfg.distanceMin);
  near(applyZoom(6.5, 1, cfg), 6.5 + cfg.zoomStep);
});

test("pitch rises only as far as needed to see the ground below", () => {
  // Standing on the floor: the ground under the focus is already in view.
  assert.equal(pitchToSeeBelow(15, 6.5, 1, 22, 75), 15);
  // High above the floor the camera has to orbit up.
  const high = pitchToSeeBelow(15, 6.5, 11, 22, 75);
  assert.ok(high > 15 && high < 75, `pitch ${high}`);
  assert.ok(pitchToSeeBelow(15, 6.5, 30, 22, 75) >= high);
  // Far below, the ground is straight down: 90° − 22° is enough, short of pitchMax.
  assert.equal(pitchToSeeBelow(15, 6.5, 1e6, 22, 75), 68);
  assert.equal(pitchToSeeBelow(15, 6.5, 1e6, 22, 60), 60);
  assert.equal(moveToward(0, 20, 5), 5);
  assert.equal(moveToward(18, 20, 5), 20);
});

test("spring arm snaps in and eases out", () => {
  assert.equal(springArm(6, 2, 6, 0.1), 2);
  near(springArm(2, 6, 6, 0.1), 2.6);
  assert.equal(springArm(5.9, 6, 6, 0.1), 6);
});

test("marker shrinks with height", () => {
  assert.equal(markerScale(0), 1);
  near(markerScale(5), 0.8);
  near(markerScale(50), 0.6);
});

test("follow: the camera turns towards behind a sideways lean and settles there", () => {
  // Camera at yaw 0 looks along -Z; a lean to +X is 90° to the right.
  let yaw = 0;
  for (let i = 0; i < 600; i++) yaw = followYaw(yaw, { x: 30, z: 0 }, 5, 100, 0.4, 1 / 120);
  // Behind a +X lean means looking along +X.
  assert.ok(Math.abs(yaw - recenterYaw({ x: 1, z: 0 })!) < 1e-3);
  const one = followYaw(0, { x: 30, z: 0 }, 5, 100, 0.4, 1 / 120);
  assert.ok(one !== 0 && Math.abs(one) < Math.PI / 2, "eases, does not snap");
});

test("follow: leans in the deadzone or back towards the camera are ignored", () => {
  assert.equal(followYaw(0.3, { x: 3, z: 0 }, 5, 100, 0.4, 0.1), 0.3);
  // Camera at yaw 0: a lean to +Z points back at the camera (180°).
  assert.equal(followYaw(0, { x: 0, z: 30 }, 5, 100, 0.4, 0.1), 0);
  // 120° off forward is past 100°.
  assert.equal(followYaw(0, { x: 30 * Math.sin((120 * Math.PI) / 180), z: -30 * Math.cos((120 * Math.PI) / 180) }, 5, 100, 0.4, 0.1), 0);
});

test("tilt only works with drops of at least the minimum", () => {
  assert.equal(tiltDrop(2.9, 3), 0);
  assert.equal(tiltDrop(3, 3), 3);
  assert.equal(tiltDrop(8, 3), 8);
});

test("the sensitivity slider scales the speeds evenly around the default", () => {
  assert.equal(sensitivityFactor(0.5), 1);
  assert.ok(Math.abs(sensitivityFactor(1) * sensitivityFactor(0) - 1) < 1e-12);
  assert.ok(sensitivityFactor(0) > 0.3 && sensitivityFactor(1) < 3);
  assert.equal(sensitivityFactor(5), sensitivityFactor(1));
  assert.equal(sensitivityFactor(Number.NaN), 1);
});
