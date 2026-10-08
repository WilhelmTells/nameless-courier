import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_SWING_SPEED, restOffset, restSwing, stepSwing, type SwingConfig } from "../src/core/swingCore.ts";

const cfg: SwingConfig = { stiffness: 180, damping: 6, maxSwing: 0.2 };
const g = 18;
const dt = 1 / 120;
const still = { x: 0, y: 0, z: 0 };

test("at rest the hem hangs still, sagging gravity ÷ stiffness", () => {
  let s = restSwing(g, cfg);
  assert.ok(Math.abs(s.offset.y + 0.1) < 1e-9);
  for (let i = 0; i < 240; i++) s = stepSwing(s, still, g, cfg, dt);
  assert.ok(Math.abs(s.offset.y + 0.1) < 1e-6);
  assert.ok(Math.hypot(s.vel.x, s.vel.y, s.vel.z) < 1e-6);
});

test("in free fall the hem floats up to the anchor", () => {
  let s = restSwing(g, cfg);
  // The anchor gains g·dt of downward speed every step.
  for (let i = 0; i < 600; i++) s = stepSwing(s, { x: 0, y: -g * dt, z: 0 }, g, cfg, dt);
  assert.ok(Math.abs(s.offset.y) < 1e-3, `offset ${s.offset.y}`);
});

test("a launch throws the hem down to the swing limit, then it settles back", () => {
  let s = restSwing(g, cfg);
  s = stepSwing(s, { x: 0, y: 12, z: 0 }, g, cfg, dt);
  let lowest = 0;
  for (let i = 0; i < 30; i++) {
    s = stepSwing(s, still, g, cfg, dt);
    lowest = Math.min(lowest, s.offset.y - restOffset(g, cfg).y);
  }
  assert.ok(Math.abs(lowest + cfg.maxSwing) < 1e-9, `lowest ${lowest}`);
  for (let i = 0; i < 600; i++) s = stepSwing(s, still, g, cfg, dt);
  assert.ok(Math.abs(s.offset.y - restOffset(g, cfg).y) < 1e-3);
});

test("moving off sideways swings the hem the other way, never past the limit", () => {
  let s = stepSwing(restSwing(g, cfg), { x: 5, y: 0, z: 0 }, g, cfg, dt);
  let most = 0;
  for (let i = 0; i < 120; i++) {
    s = stepSwing(s, still, g, cfg, dt);
    most = Math.min(most, s.offset.x);
    const r = restOffset(g, cfg);
    assert.ok(Math.hypot(s.offset.x - r.x, s.offset.y - r.y, s.offset.z - r.z) <= cfg.maxSwing + 1e-9);
  }
  assert.ok(most < -0.1, `most ${most}`);
});

test("a teleport does not fling the hem faster than the cap", () => {
  const s = stepSwing(restSwing(g, cfg), { x: 0, y: -500, z: 300 }, g, cfg, dt);
  assert.ok(Math.hypot(s.vel.x, s.vel.y, s.vel.z) <= MAX_SWING_SPEED + 1e-9);
});
