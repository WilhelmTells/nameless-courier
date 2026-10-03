import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POGO } from "../src/config.ts";
import { angleBetween, bonkVelocity, slopeLaunch, surfaceKind, tipContactValid, wallKick, wallKickAllowed } from "../src/core/contactCore.ts";
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

test("ceilings and walls never bounce the tip", () => {
  assert.equal(tipContactValid(UP, { x: 0, y: -1, z: 0 }, cfg), false);
  assert.equal(tipContactValid(stickAxis({ x: 50, z: 0 }), WALL, cfg), false);
});

test("wall kick needs a direction pressed away from the wall", () => {
  assert.ok(wallKickAllowed({ x: 1, z: 0 }, WALL, cfg));
  // 60° off the normal is inside the 70° window, 80° is not.
  assert.ok(wallKickAllowed({ x: Math.cos(deg(60)), z: Math.sin(deg(60)) }, WALL, cfg));
  assert.equal(wallKickAllowed({ x: Math.cos(deg(80)), z: Math.sin(deg(80)) }, WALL, cfg), false);
  assert.equal(wallKickAllowed({ x: -1, z: 0 }, WALL, cfg), false);
  assert.equal(wallKickAllowed({ x: 0, z: 0 }, WALL, cfg), false);
});

test("floors and ceilings cannot be kicked off", () => {
  assert.equal(wallKickAllowed({ x: 0, z: 1 }, UP, cfg), false);
  assert.equal(wallKickAllowed({ x: 1, z: 0 }, { x: 0.3, y: -0.95, z: 0 }, cfg), false);
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

test("wall kick: reduced apex, fixed speed in the pressed direction", () => {
  const v = wallKick({ x: 1, z: 0 }, WALL, cfg.normalApex, { x: -6, y: -8, z: 0 }, cfg);
  near(apexOf(v), cfg.normalApex * cfg.wallKickFactor);
  near(v.x, cfg.wallKickSpeed);
  near(v.z, 0);
});

test("an armed charge kicks higher but not farther", () => {
  const normal = wallKick({ x: 1, z: 0 }, WALL, cfg.normalApex, { x: 0, y: 0, z: 0 }, cfg);
  const charged = wallKick({ x: 1, z: 0 }, WALL, cfg.chargedApex, { x: 0, y: 0, z: 0 }, cfg);
  near(apexOf(charged), cfg.chargedApex * cfg.wallKickFactor);
  near(charged.x, normal.x);
});

test("wall kick steers with the pressed direction and keeps along-wall speed", () => {
  const d = { x: Math.cos(deg(45)), z: -Math.sin(deg(45)) };
  const v = wallKick(d, WALL, 1, { x: -9, y: -3, z: 4 }, cfg);
  near(v.x, d.x * cfg.wallKickSpeed);
  near(v.z, d.z * cfg.wallKickSpeed + 4 * cfg.keepHorizontal);
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
