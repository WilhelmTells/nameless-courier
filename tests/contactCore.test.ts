import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POGO } from "../src/config.ts";
import { angleBetween, bonkVelocity, slopeLaunch, surfaceKind, tipContactValid, wallKick } from "../src/core/contactCore.ts";
import { launchVelocity, stickAxis, type Vec3 } from "../src/core/pogoCore.ts";

const cfg = DEFAULT_POGO;
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const UP: Vec3 = { x: 0, y: 1, z: 0 };
const deg = (d: number) => (d * Math.PI) / 180;
/** Normal of a slope rising towards -X, tilted `d` degrees from up. */
const slope = (d: number): Vec3 => ({ x: Math.sin(deg(d)), y: Math.cos(deg(d)), z: 0 });
/** Wall facing +X. */
const WALL: Vec3 = { x: 1, y: 0, z: 0 };
const apexOf = (v: Vec3) => (v.y * v.y) / (2 * cfg.gravity);

test("surfaces steeper than wallAngle are walls, ceilings too", () => {
  assert.equal(surfaceKind(UP, cfg), "floor");
  assert.equal(surfaceKind(slope(59), cfg), "floor");
  assert.equal(surfaceKind(slope(61), cfg), "wall");
  assert.equal(surfaceKind(WALL, cfg), "wall");
  assert.equal(surfaceKind({ x: 0, y: -1, z: 0 }, cfg), "wall");
});

test("flat ground accepts every lean up to max lean", () => {
  assert.ok(tipContactValid(stickAxis({ x: cfg.maxLean, z: 0 }), UP, cfg));
  assert.ok(tipContactValid(stickAxis({ x: 0, z: -cfg.maxLean }), UP, cfg));
});

test("leaning downhill on a steep slope bonks", () => {
  // Normal leans to +X; leaning 40° to -X gives 30 + 40 = 70° > 65°.
  assert.equal(tipContactValid(stickAxis({ x: -40, z: 0 }), slope(30), cfg), false);
  assert.ok(tipContactValid(stickAxis({ x: -30, z: 0 }), slope(30), cfg));
});

test("wall kick needs 40° or more lean away from a vertical wall", () => {
  assert.ok(tipContactValid(stickAxis({ x: 41, z: 0 }), WALL, cfg));
  assert.equal(tipContactValid(stickAxis({ x: 39, z: 0 }), WALL, cfg), false);
  assert.equal(tipContactValid(stickAxis({ x: -60, z: 0 }), WALL, cfg), false);
  // Mostly sideways along the wall is outside the window.
  assert.equal(tipContactValid(stickAxis({ x: 30, z: 45 }), WALL, cfg), false);
});

test("ceilings never launch", () => {
  assert.equal(tipContactValid(UP, { x: 0, y: -1, z: 0 }, cfg), false);
});

test("slope launch on flat ground is the plain launch", () => {
  const flat = launchVelocity({ x: 20, z: -10 }, 5, { x: 3, y: -4, z: 1 }, cfg);
  assert.deepEqual(slopeLaunch(flat, UP, cfg.slopeBlend), flat);
});

test("slope launch turns an upright bounce halfway towards the normal", () => {
  const v = slopeLaunch({ x: 0, y: 5, z: 0 }, slope(30), 0.5);
  near(Math.hypot(v.x, v.y, v.z), 5);
  near(angleBetween(scaleTo1(v), UP), 15, 1e-6);
  assert.ok(v.x > 0, "deflected downhill");
});

test("slope launch never points into the surface", () => {
  const v = slopeLaunch({ x: -20, y: 1, z: 0 }, slope(40), 0.5);
  const n = slope(40);
  assert.ok(v.x * n.x + v.y * n.y + v.z * n.z >= -1e-9);
});

test("wall kick reaches the reduced apex and pushes away from the wall", () => {
  const v = wallKick(stickAxis({ x: 45, z: 0 }), WALL, cfg.normalApex, { x: -6, y: -8, z: 0 }, cfg);
  near(apexOf(v), cfg.normalApex * cfg.wallKickFactor);
  assert.ok(v.x > 0);
  near(v.z, 0);
});

test("an armed charge fires off a wall at the reduced height", () => {
  const v = wallKick(stickAxis({ x: 42, z: 0 }), WALL, cfg.chargedApex, { x: 0, y: 0, z: 0 }, cfg);
  near(apexOf(v), cfg.chargedApex * cfg.wallKickFactor);
});

test("wall kick direction follows the lean: a sideways lean steers along the wall", () => {
  const straight = wallKick(stickAxis({ x: 50, z: 0 }), WALL, 1, { x: 0, y: 0, z: 0 }, cfg);
  const angled = wallKick(stickAxis({ x: 45, z: -20 }), WALL, 1, { x: 0, y: 0, z: 0 }, cfg);
  near(straight.z, 0);
  assert.ok(angled.z < -1, "steered towards -Z");
});

test("very flat wall kicks go lower", () => {
  const v = wallKick(stickAxis({ x: 60, z: 0 }), WALL, 1, { x: 0, y: 0, z: 0 }, cfg);
  assert.ok(apexOf(v) < cfg.wallKickFactor);
  assert.ok(apexOf(v) > 0.1);
});

test("wall kick keeps along-wall speed, drops speed into the wall", () => {
  const still = wallKick(stickAxis({ x: 50, z: 0 }), WALL, 1, { x: 0, y: 0, z: 0 }, cfg);
  const moving = wallKick(stickAxis({ x: 50, z: 0 }), WALL, 1, { x: -9, y: -3, z: 4 }, cfg);
  near(moving.x, still.x);
  near(moving.y, still.y);
  near(moving.z, 4 * cfg.keepHorizontal);
});

test("hard impact on a ceiling bonks: low bounce, most speed lost", () => {
  const { vel, hard } = bonkVelocity({ x: 4, y: 10, z: 0 }, { x: 0, y: -1, z: 0 }, cfg);
  assert.ok(hard);
  near(vel.y, -10 * cfg.bonkRestitution);
  near(vel.x, 4 * cfg.bonkKeep);
});

test("hitting a wall keeps the vertical speed and pushes away", () => {
  const { vel, hard } = bonkVelocity({ x: -6, y: 6.9, z: 3 }, WALL, cfg);
  assert.ok(hard);
  near(vel.y, 6.9);
  near(vel.x, cfg.wallPushSpeed);
  near(vel.z, 3 * cfg.bonkKeep);
});

test("a very hard wall hit bounces back faster than the minimum push", () => {
  const { vel } = bonkVelocity({ x: -40, y: 0, z: 0 }, WALL, cfg);
  near(vel.x, 40 * cfg.bonkRestitution);
});

test("slow contact slides; moving away is untouched", () => {
  const slide = bonkVelocity({ x: -0.5, y: -2, z: 1 }, WALL, cfg);
  assert.equal(slide.hard, false);
  assert.deepEqual(slide.vel, { x: 0, y: -2, z: 1 });
  const away = bonkVelocity({ x: 3, y: 0, z: 0 }, WALL, cfg);
  assert.deepEqual(away.vel, { x: 3, y: 0, z: 0 });
});

function scaleTo1(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}
