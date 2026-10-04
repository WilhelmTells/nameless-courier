import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LEVEL, LEVELS, levelFromSearch } from "../src/levels/index.ts";

test("level comes from the URL, Zone 1 by default", () => {
  assert.equal(DEFAULT_LEVEL.id, "zone1");
  assert.equal(levelFromSearch("").id, "zone1");
  assert.equal(levelFromSearch("?debug&level=playground").id, "playground");
  assert.equal(levelFromSearch("?level=nope").id, "zone1");
  assert.equal(levelFromSearch("?level=toString").id, "zone1");
});

test("every level has unique piece ids and positive sizes", () => {
  for (const level of Object.values(LEVELS)) {
    const ids = new Set(level.pieces.map((p) => p.id));
    assert.equal(ids.size, level.pieces.length, level.id);
    for (const p of level.pieces) assert.ok(p.size.x > 0 && p.size.y > 0 && p.size.z > 0, `${level.id}/${p.id}`);
  }
});
