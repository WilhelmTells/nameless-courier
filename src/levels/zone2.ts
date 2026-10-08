// Zone 2, the pillars: unfinished construction on the back of block C. A deck
// at the zone start carries a row of bare columns that grow taller and
// narrower, then scaffolding zig-zags up the wall to an opening into block C.
// Every slip lands on the deck, which is the zone start.
//
// The back face of block C is z = -60; the deck lies behind it (towards -Z).
// Scaffolding levels overlap in x, so each level is the ceiling of the one
// below: a full charge under a plank hits it instead of skipping a level.

import { barrel, block, crate, pallet, pole } from "./shapes.ts";
import type { Piece, Zone } from "./types.ts";

const DECK = 26;
const WALL = -60;
/** Scaffolding planks stick out this far from the wall, m. */
const PLANK = 1.5;
const L1 = 37;
const L2 = 42;
const L3 = 46.5;
const TOP = 50;

const pieces: Piece[] = [
  // Deck, joined to Zone 1's rest ledge at its right front corner.
  block("deck", -24, 20, 0, DECK, -76, WALL),
  block("deck-parapet-back", -24, 20, DECK, DECK + 2, -76, -75.6),
  block("deck-parapet-left", -24, -23.6, DECK, DECK + 2, -75.6, WALL),
  block("deck-parapet-right", 19.6, 20, DECK, DECK + 2, -75.6, -66),

  // Pillar field (safe): columns going left, taller and narrower each time.
  column("column-1", 11, 2, DECK + 1.5),
  column("column-2", 7, 2, DECK + 3),
  column("column-3", 3, 1.6, DECK + 4.5),
  column("column-4", -1, 1.3, DECK + 5.5),
  column("column-5", -5, 1, DECK + 6.5),
  column("column-6", -9, 0.8, DECK + 7.5),

  // Scaffolding (exposed). Level 1 runs left from above the last column.
  block("scaffold-1", -22, -12, L1 - 0.3, L1, WALL - PLANK, WALL),
  // A pole top at the left corner up to level 2.
  pole("scaffold-pole-1", -23, -62.5, 0.8, DECK, L1 + 2.5),
  // Level 2 runs right, above level 1, and narrows to a beam along the wall.
  block("scaffold-2", -20, -6, L2 - 0.3, L2, WALL - PLANK, WALL),
  block("scaffold-beam", -6, 4, L2 - 0.3, L2, WALL - 0.4, WALL),
  pole("scaffold-pole-2", 6, -62.5, 0.8, DECK, L2 + 2),
  // Level 3 to the right, then back left onto the top ledge.
  block("scaffold-3", 8, 15, L3 - 0.3, L3, WALL - PLANK, WALL),
  block("top-ledge", 2, 8, TOP - 0.5, TOP, WALL - 3, WALL),
];

/** A square column standing on the deck. */
function column(id: string, x: number, width: number, top: number): Piece {
  return block(id, x - width / 2, x + width / 2, DECK, top, -67 - width / 2, -67 + width / 2);
}

// Props on the deck, in the back corner, away from the columns and the scaffolding.
pieces.push(
  crate("prop-deck-crate-1", 13.6, -74.3, 1.2, DECK, 5),
  crate("prop-deck-crate-2", 15.2, -73.9, 1, DECK, -15),
  crate("prop-deck-crate-3", 14.9, -72.6, 0.8, DECK, 30),
  pallet("prop-deck-pallet", 13.4, -72.7, DECK, -6),
  barrel("prop-deck-barrel-1", 7.4, -74.8, DECK),
  barrel("prop-deck-barrel-2", 8.3, -74.4, DECK, 0.9),
);

export const zone2: Zone = {
  id: "zone2",
  name: "Pillars",
  start: { x: 18, y: DECK, z: -63 },
  pieces,
  restSpots: [
    { id: "deck-start", min: { x: 16, y: DECK, z: -66 }, max: { x: 20, y: DECK + 3, z: WALL } },
    { id: "zone-2-top", min: { x: 2, y: TOP, z: WALL - 3 }, max: { x: 8, y: TOP + 3, z: WALL } },
  ],
  figures: [{ id: "builder", pos: { x: 7.6, y: TOP, z: WALL - 3 }, facing: 0, pose: "sit" }],
};
