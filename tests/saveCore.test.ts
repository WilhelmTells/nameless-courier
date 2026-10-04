import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBest, parseRun, SAVE_VERSION, type RunSave } from "../src/core/saveCore.ts";

const run: RunSave = {
  version: SAVE_VERSION,
  level: "zone1",
  pogo: {
    pos: { x: 1, y: 12.5, z: -18 },
    vel: { x: 0.5, y: -3, z: 0 },
    lean: { x: 10, z: -20 },
    charge: 0.4,
    armed: true,
    launchY: 10,
    peakY: 13,
    standing: true,
  },
  yaw: 1.2,
  stats: { height: 10, best: 13.5, falls: 2, fallRef: 10, time: 321.5 },
};

test("a saved run reads back unchanged", () => {
  assert.deepEqual(parseRun(JSON.stringify(run), "zone1"), run);
});

test("saves from before rest spots load as riding", () => {
  const { standing: _, ...old } = run.pogo;
  assert.equal(parseRun(JSON.stringify({ ...run, pogo: old }), "zone1")?.pogo.standing, false);
  assert.equal(parseRun(JSON.stringify({ ...run, pogo: { ...run.pogo, standing: "yes" } }), "zone1"), null);
});

test("no save, corrupt JSON, another level or version give no run", () => {
  assert.equal(parseRun(null, "zone1"), null);
  assert.equal(parseRun("{not json", "zone1"), null);
  assert.equal(parseRun(JSON.stringify(run), "playground"), null);
  assert.equal(parseRun(JSON.stringify({ ...run, version: 99 }), "zone1"), null);
});

test("missing or malformed fields give no run", () => {
  const broken = [
    { ...run, pogo: { ...run.pogo, pos: { x: 1, y: "12", z: 0 } } },
    { ...run, pogo: { ...run.pogo, charge: 2 } },
    { ...run, pogo: { ...run.pogo, armed: undefined } },
    { ...run, stats: { ...run.stats, falls: -1 } },
    { ...run, stats: { ...run.stats, time: undefined } },
    { ...run, yaw: null },
  ];
  for (const b of broken) assert.equal(parseRun(JSON.stringify(b), "zone1"), null);
  // JSON turns non-finite numbers into null.
  assert.equal(parseRun(JSON.stringify({ ...run, stats: { ...run.stats, best: Infinity } }), "zone1"), null);
});

test("best height reads back, anything else gives none", () => {
  assert.equal(parseBest(JSON.stringify({ height: 18.5 })), 18.5);
  assert.equal(parseBest(null), null);
  assert.equal(parseBest("[]"), null);
  assert.equal(parseBest("x"), null);
});
