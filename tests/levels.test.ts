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

test("every rest spot lies on the ground or on top of a piece", () => {
  for (const level of Object.values(LEVELS)) {
    for (const s of level.restSpots) {
      const cx = (s.min.x + s.max.x) / 2;
      const cz = (s.min.z + s.max.z) / 2;
      const onPiece = level.pieces.some(
        (p) =>
          Math.abs(p.position.y + p.size.y / 2 - s.min.y) < 1e-6 &&
          Math.abs(cx - p.position.x) <= p.size.x / 2 &&
          Math.abs(cz - p.position.z) <= p.size.z / 2,
      );
      assert.ok(s.min.y === 0 || onPiece, `${level.id}/${s.id}`);
      assert.ok(s.max.y > s.min.y + 1, `${level.id}/${s.id} reaches above the surface`);
    }
  }
});
