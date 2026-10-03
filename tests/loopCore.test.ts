import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceLoop } from "../src/core/loopCore.ts";

const step = 1 / 120;

test("runs whole steps and carries the remainder", () => {
  const r = advanceLoop(0, step * 2.5, step);
  assert.equal(r.steps, 2);
  assert.ok(Math.abs(r.alpha - 0.5) < 1e-9);
});

test("same total time gives the same steps at any frame rate", () => {
  const run = (fps: number) => {
    let acc = 0;
    let steps = 0;
    for (let i = 0; i < fps; i++) {
      const r = advanceLoop(acc, 1 / fps, step);
      acc = r.accumulator;
      steps += r.steps;
    }
    return steps;
  };
  for (const fps of [30, 60, 144]) assert.ok(Math.abs(run(fps) - 120) <= 1, `fps ${fps}`);
});

test("clamps long frames", () => {
  assert.equal(advanceLoop(0, 5, step, 0.25).steps, 30);
  assert.equal(advanceLoop(0, -1, step).steps, 0);
});
