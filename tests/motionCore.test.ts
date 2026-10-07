import { test } from "node:test";
import assert from "node:assert/strict";
import { axisAngle, poseAt, rotate, topSpeed, velocityAt, type Motion, type Pose } from "../src/core/motionCore.ts";
import type { Vec3 } from "../src/core/pogoCore.ts";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const nearVec = (a: Vec3, b: Vec3, eps = 1e-6) => {
  near(a.x, b.x, eps);
  near(a.y, b.y, eps);
  near(a.z, b.z, eps);
};

const base: Vec3 = { x: 2, y: 5, z: -3 };
const MOTIONS: Motion[] = [
  { kind: "linear", by: { x: 6, y: 0, z: 0 }, period: 4, phase: 0.1 },
  { kind: "piston", by: { x: 0, y: 3, z: 0 }, period: 5, dwell: 1, phase: 0.3 },
  { kind: "rotate", axis: { x: 0, y: 1, z: 0 }, period: 6, phase: 0 },
  { kind: "pendulum", pivot: { x: 2, y: 10, z: -3 }, axis: { x: 0, y: 0, z: 1 }, angle: 40, period: 3, phase: 0.2 },
];

/** Where a point attached to the piece (at `local` from its centre at rest) is in `pose`. */
const carried = (pose: Pose, local: Vec3): Vec3 => {
  const r = rotate(pose.turn, local);
  return { x: pose.position.x + r.x, y: pose.position.y + r.y, z: pose.position.z + r.z };
};

test("motion: a still piece stays at rest", () => {
  const pose = poseAt({ kind: "none" }, base, 12.3);
  assert.deepEqual(pose.position, base);
  assert.deepEqual(velocityAt({ kind: "none" }, base, 12.3, base), { x: 0, y: 0, z: 0 });
});

test("motion: every cycle repeats exactly", () => {
  for (const m of MOTIONS) {
    const local = { x: 1, y: 0.5, z: -0.7 };
    const period = (m as { period: number }).period;
    nearVec(carried(poseAt(m, base, 1.234), local), carried(poseAt(m, base, 1.234 + 3 * period), local), 1e-9);
  }
});

test("motion: velocity matches the change in position of a carried point", () => {
  const h = 1e-5;
  for (const m of MOTIONS) {
    const local = { x: 1.5, y: 0.25, z: -0.5 };
    for (const t of [0.3, 1.1, 2.7, 3.9]) {
      const a = carried(poseAt(m, base, t - h), local);
      const b = carried(poseAt(m, base, t + h), local);
      const fd = { x: (b.x - a.x) / (2 * h), y: (b.y - a.y) / (2 * h), z: (b.z - a.z) / (2 * h) };
      nearVec(velocityAt(m, base, t, carried(poseAt(m, base, t), local)), fd, 1e-4);
    }
  }
});

test("motion: linear eases between its two ends", () => {
  const m: Motion = { kind: "linear", by: { x: 6, y: 0, z: 0 }, period: 4, phase: 0 };
  nearVec(poseAt(m, base, 0).position, base);
  nearVec(poseAt(m, base, 2).position, { x: 8, y: 5, z: -3 });
  near(velocityAt(m, base, 0, base).x, 0);
});

test("motion: a piston rests at each end for its dwell time", () => {
  const m: Motion = { kind: "piston", by: { x: 0, y: 3, z: 0 }, period: 6, dwell: 1, phase: 0 };
  for (const t of [0.2, 0.9]) {
    nearVec(poseAt(m, base, t).position, base);
    near(velocityAt(m, base, t, base).y, 0);
  }
  for (const t of [3.2, 3.9]) nearVec(poseAt(m, base, t).position, { x: 2, y: 8, z: -3 });
  assert.ok(velocityAt(m, base, 2, base).y > 0, "rising");
  assert.ok(velocityAt(m, base, 5, base).y < 0, "falling");
});

test("motion: a pendulum swings to its angle and back through the bottom", () => {
  const m: Motion = { kind: "pendulum", pivot: { x: 0, y: 10, z: 0 }, axis: { x: 0, y: 0, z: 1 }, angle: 30, period: 4, phase: 0 };
  const bob = { x: 0, y: 4, z: 0 };
  nearVec(poseAt(m, bob, 0).position, bob);
  const side = poseAt(m, bob, 1).position;
  // Right-handed: a positive turn about +Z swings the bob from below the pivot towards +X.
  near(Math.atan2(side.x, 10 - side.y), 30 * (Math.PI / 180));
});

test("motion: top speed bounds every point's speed", () => {
  for (const m of MOTIONS) {
    const reach = 2;
    const top = topSpeed(m, base, reach);
    for (let t = 0; t < 6; t += 0.05) {
      const pose = poseAt(m, base, t);
      for (const local of [{ x: reach, y: 0, z: 0 }, { x: 0, y: 0, z: -reach }, { x: 0, y: reach, z: 0 }]) {
        const v = velocityAt(m, base, t, carried(pose, local));
        assert.ok(Math.hypot(v.x, v.y, v.z) <= top + 1e-9, `${m.kind} ${Math.hypot(v.x, v.y, v.z)} > ${top}`);
      }
    }
  }
});

test("quaternions: a quarter turn about Y takes +X to -Z", () => {
  nearVec(rotate(axisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2), { x: 1, y: 0, z: 0 }), { x: 0, y: 0, z: -1 });
});
