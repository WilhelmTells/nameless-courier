import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LEVEL, LEVELS, levelFromSearch, teleportTargets } from "../src/levels/index.ts";
import { tower } from "../src/levels/tower.ts";
import { surroundings } from "../src/levels/surroundings.ts";
import { FIGURE_LINES } from "../src/story.ts";

test("level comes from the URL, the structure by default", () => {
  assert.equal(DEFAULT_LEVEL.id, "tower");
  assert.equal(levelFromSearch("").id, "tower");
  assert.equal(levelFromSearch("?debug&level=playground").id, "playground");
  assert.equal(levelFromSearch("?level=zone1").id, "tower");
  assert.equal(levelFromSearch("?level=nope").id, "tower");
  assert.equal(levelFromSearch("?level=toString").id, "tower");
});

test("the structure is its zones, in order, starting in Zone 1", () => {
  const tower = LEVELS.tower;
  assert.equal(tower.zones[0].id, "zone1");
  assert.deepEqual(tower.start, tower.zones[0].start);
  assert.equal(tower.pieces.length, tower.zones.reduce((n, z) => n + z.pieces.length, 0) + surroundings.length);
  assert.equal(tower.restSpots.length, tower.zones.reduce((n, z) => n + z.restSpots.length, 0));
});

test("every zone starts inside a rest spot, on a surface", () => {
  for (const level of Object.values(LEVELS)) {
    for (const zone of level.zones) {
      const s = zone.start;
      const inSpot = level.restSpots.some(
        (r) => s.x >= r.min.x && s.x <= r.max.x && s.y >= r.min.y && s.y <= r.max.y && s.z >= r.min.z && s.z <= r.max.z,
      );
      assert.ok(inSpot, `${zone.id} start in a rest spot`);
      const onPiece = level.pieces.some(
        (p) =>
          Math.abs(p.position.y + p.size.y / 2 - s.y) < 1e-6 &&
          Math.abs(s.x - p.position.x) <= p.size.x / 2 &&
          Math.abs(s.z - p.position.z) <= p.size.z / 2,
      );
      assert.ok(s.y === 0 || onPiece, `${zone.id} start on a surface`);
    }
  }
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

test("teleport targets: each zone start, then each rest spot's surface centre", () => {
  const tower = LEVELS.tower;
  const targets = teleportTargets(tower);
  assert.equal(targets.length, tower.zones.length + tower.restSpots.length);
  assert.deepEqual(targets[0], { label: "Base: start", point: tower.zones[0].start });
  const spot = tower.restSpots[0];
  assert.deepEqual(targets[tower.zones.length].point, {
    x: (spot.min.x + spot.max.x) / 2,
    y: spot.min.y,
    z: (spot.min.z + spot.max.z) / 2,
  });
  assert.equal(teleportTargets(LEVELS.playground)[0].label, "Playground: start");
});

test("seven figures, each with its own lines, standing on a level surface", () => {
  assert.equal(tower.figures.length, 7);
  assert.equal(new Set(tower.figures.map((f) => f.id)).size, 7);
  for (const f of tower.figures) {
    assert.ok(Object.hasOwn(FIGURE_LINES, f.id), `${f.id} has lines`);
    assert.ok(FIGURE_LINES[f.id].first.length > 0 && FIGURE_LINES[f.id].return.length > 0, `${f.id} has both sets`);
    const floor = tower.pieces.some(
      (p) =>
        p.shape === "box" && p.motion.kind === "none" &&
        Math.abs(p.position.y + p.size.y / 2 - f.pos.y) < 0.01 &&
        Math.abs(f.pos.x - p.position.x) <= p.size.x / 2 &&
        Math.abs(f.pos.z - p.position.z) <= p.size.z / 2,
    );
    assert.ok(floor, `${f.id} stands on a piece`);
  }
});

test("the ruins around the structure stay at least 26 m from every zone", () => {
  const zonePieces = tower.zones.flatMap((z) => z.pieces);
  const ruins = surroundings.filter((p) => p.id.startsWith("ruin"));
  assert.ok(ruins.length > 20);
  for (const r of ruins) {
    for (const q of zonePieces) {
      const dx = Math.max(0, Math.abs(r.position.x - q.position.x) - (r.size.x + q.size.x) / 2);
      const dz = Math.max(0, Math.abs(r.position.z - q.position.z) - (r.size.z + q.size.z) / 2);
      assert.ok(Math.hypot(dx, dz) >= 26, `${r.id} is ${Math.hypot(dx, dz).toFixed(1)} m from ${q.id}`);
    }
  }
});

test("piece ids are unique", () => {
  const ids = tower.pieces.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});
