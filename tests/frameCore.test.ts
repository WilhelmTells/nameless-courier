import { test } from "node:test";
import assert from "node:assert/strict";
import {
  endingDarkEnd, endingStatsAt, endingView, linesShown, openingFadeStart, openingView,
} from "../src/core/frameCore.ts";
import { ENDING, OPENING } from "../src/story.ts";

test("lines appear one at a time and stop at the last", () => {
  assert.equal(linesShown(0.5, 1, 3, 5), 0);
  assert.equal(linesShown(1, 1, 3, 5), 1);
  assert.equal(linesShown(3.9, 1, 3, 5), 1);
  assert.equal(linesShown(4, 1, 3, 5), 2);
  assert.equal(linesShown(1000, 1, 3, 5), 5);
});

test("the opening starts black, shows every line, then fades into the game", () => {
  const n = OPENING.length;
  assert.deepEqual(openingView(0, n), { lines: 0, black: 1, done: false });
  const start = openingFadeStart(n);
  assert.equal(openingView(start, n).lines, n);
  assert.equal(openingView(start, n).black, 1);
  const mid = openingView(start + 1, n);
  assert.ok(mid.black > 0 && mid.black < 1 && !mid.done);
  assert.deepEqual(openingView(start + 100, n), { lines: n, black: 0, done: true });
});

test("the ending darkens before any line and shows the stats after the last", () => {
  const n = ENDING.length;
  assert.deepEqual(endingView(0, n), { black: 0, lines: 0, stats: false });
  const dark = endingDarkEnd();
  assert.equal(endingView(dark, n).black, 1);
  assert.equal(endingView(dark, n).lines, 0);
  const statsAt = endingStatsAt(n);
  assert.equal(endingView(statsAt - 0.01, n).lines, n);
  assert.equal(endingView(statsAt - 0.01, n).stats, false);
  assert.equal(endingView(statsAt, n).stats, true);
});
