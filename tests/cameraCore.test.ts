import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CAMERA } from "../src/config.ts";
import {
  applyMouse,
  applyZoom,
  fallTiltTarget,
  markerScale,
  moveToward,
  orbitDirection,
  recenterYaw,
  springArm,
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

test("fall tilt only beyond the start depth", () => {
  assert.equal(fallTiltTarget(5, cfg), 0);
  assert.equal(fallTiltTarget(cfg.fallTiltStart + 1, cfg), cfg.fallTiltMax);
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
