import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTime, newStats, onLaunch } from "../src/core/fallCore.ts";

const launches = (ys: number[]) => ys.reduce((s, y) => onLaunch(s, y, 5), newStats(0));

test("height and best follow the surfaces bounced from", () => {
  const s = launches([0, 2, 5, 3]);
  assert.equal(s.height, 3);
  assert.equal(s.best, 5);
  assert.equal(s.falls, 0);
});

test("losing more than 5 m counts one fall", () => {
  assert.equal(launches([10, 5]).falls, 0);
  assert.equal(launches([10, 4.9]).falls, 1);
});

test("a long fall in several drops counts once per 5 m below the new low", () => {
  // From 22 down to 10 (one fall), then bouncing on at 10 counts nothing more.
  assert.equal(launches([22, 10, 10, 10]).falls, 1);
  // Measured from the landing: climbing back to 12 and falling to 8 is no fall.
  assert.equal(launches([22, 10, 12, 8]).falls, 1);
  // Climbing to 20 again and dropping to 0 is a second one.
  assert.equal(launches([22, 10, 20, 0]).falls, 2);
});

test("charged jumps from the same floor are no fall", () => {
  // Launch heights only: the 10 m apex of a jump in the yard never shows up.
  assert.equal(launches([0, 0, 0]).falls, 0);
});

test("time formats as m:ss and h:mm:ss", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(222.9), "3:42");
  assert.equal(formatTime(3725), "1:02:05");
});
