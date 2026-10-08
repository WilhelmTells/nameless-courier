import { test } from "node:test";
import assert from "node:assert/strict";
import { lowResSize } from "../src/core/lookCore.ts";

test("the low-resolution pass keeps the window's aspect", () => {
  assert.deepEqual(lowResSize(1920, 1080, 480), { width: 853, height: 480 });
  assert.deepEqual(lowResSize(1000, 500, 480), { width: 960, height: 480 });
});

test("the low-resolution pass is never larger than the window", () => {
  assert.deepEqual(lowResSize(400, 300, 480), { width: 400, height: 300 });
  assert.deepEqual(lowResSize(0, 0, 480), { width: 1, height: 1 });
});
