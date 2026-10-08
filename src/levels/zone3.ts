// Zone 3, inside: the hollow storeys of block C above its solid base. Floors
// at 50, 56 and 62 m, each ceiling slab with an opening to the next; a
// stairwell is the easy way up the first time, a slope under the second
// opening throws the bounce sideways. A chimney climbs from the top floor to
// the roof. A slip drops at most one floor.
//
// Inside is x -23..15, z -59..-29 (1 m walls). The entrance is the opening in
// the back wall at x 2..8, from Zone 2's top ledge.

import { barrel, bed, block, chair, crate, pole, ramp, shelves, table, wardrobe, workbench } from "./shapes.ts";
import type { Piece, Zone } from "./types.ts";

const F1 = 50;
const F2 = 56;
const F3 = 62;
const ROOF = 74;
const SLAB = 0.5;
const X0 = -23;
const X1 = 15;
const Z0 = -59;
const Z1 = -29;
// Chimney, inside x -23..-18, z -59..-54, walls 0.5 m.
const CH_X = -18;
const CH_Z = -54;

const pieces: Piece[] = [
  // Shell. The back wall leaves the entrance open.
  block("shell-back-left", -24, 2, F1, ROOF, -60, Z0),
  block("shell-back-right", 8, 16, F1, ROOF, -60, Z0),
  block("shell-lintel", 2, 8, F1 + 4, ROOF, -60, Z0),
  block("shell-front", -24, 16, F1, ROOF, Z1, -28),
  block("shell-left", -24, X0, F1, ROOF, Z0, Z1),
  block("shell-right", X1, 16, F1, ROOF, Z0, Z1),

  // Floor 1: a low ceiling inside the entrance (charging hits it), a pipe at
  // head height across the room, a sealed door in the left wall.
  block("entry-soffit", -2, 12, F1 + 3.5, F1 + 4, Z0, -53),
  // The pipe is round and rusty, hung from the ceiling on rods, and turns up
  // into the ceiling where it ends (it looked like a floating beam).
  { ...block("pipe-f1", X0, 10, F1 + 3, F1 + 3.4, -45, -44.6), shape: "cylinder", size: { x: 0.4, y: 10 - X0, z: 0.4 }, rotation: { x: 0, y: 0, z: 90 }, material: "rust" },
  { ...pole("pipe-f1-riser", 9.8, -44.8, 0.4, F1 + 3, F2 - SLAB), material: "rust" },
  ...[-18, -10, -2, 5].map((x, i) => ({ ...block(`pipe-f1-hanger-${i + 1}`, x - 0.03, x + 0.03, F1 + 3.4, F2 - SLAB, -44.83, -44.77), material: "iron" })),
  block("sealed-door", X0, X0 + 0.2, F1, F1 + 2.6, -50, -48.4),
  // Stairwell up to floor 2 at the front right.
  block("stair-1", 10, X1, F1, F1 + 1.5, -42, -38),
  block("stair-2", 10, X1, F1, F1 + 3, -38, -35),
  block("stair-3", 10, X1, F1, F1 + 4.5, -35, -32),
  block("stair-landing", 10, X1, F1, F2, -32, Z1),

  // Floor 2, open above the stairwell.
  block("floor-2-a", X0, 10, F2 - SLAB, F2, Z0, Z1),
  block("floor-2-b", 10, X1, F2 - SLAB, F2, Z0, -42),
  // A slope under the opening to floor 3: it throws the bounce towards +Z.
  ramp("slope", -17.5, -38.5, 20, 2.5, 5, F2),

  // Floor 3, open above the slope (x -20..-15, z -42..-35).
  block("floor-3-a", X0, -20, F3 - SLAB, F3, Z0, Z1),
  block("floor-3-b", -15, X1, F3 - SLAB, F3, Z0, Z1),
  block("floor-3-c", -20, -15, F3 - SLAB, F3, Z0, -42),
  block("floor-3-d", -20, -15, F3 - SLAB, F3, -35, Z1),
  // Two pipes on the floor to hop over on the way to the chimney.
  block("pipe-f3-1", CH_X + 0.5, X1, F3, F3 + 1.2, -45.4, -44.6),
  block("pipe-f3-2", CH_X + 0.5, X1, F3, F3 + 1.2, -50.4, -49.6),

  // Chimney: a door at the bottom of its right wall, ledges on alternating
  // walls 3 m apart; each ledge is the ceiling of the one two below.
  block("chimney-right-back", CH_X, CH_X + 0.5, F3, F3 + 3, Z0, -58),
  block("chimney-right-front", CH_X, CH_X + 0.5, F3, F3 + 3, -55, CH_Z + 0.5),
  block("chimney-right", CH_X, CH_X + 0.5, F3 + 3, ROOF, Z0, CH_Z + 0.5),
  block("chimney-front", X0, CH_X, F3, ROOF, CH_Z, CH_Z + 0.5),
  block("chimney-ledge-1", X0, X0 + 1.2, F3 + 2.7, F3 + 3, -57.5, -55.5),
  block("chimney-ledge-2", CH_X - 1.2, CH_X, F3 + 5.7, F3 + 6, -58, -56),
  block("chimney-ledge-3", X0, X0 + 1.2, F3 + 8.7, F3 + 9, -57.5, -55.5),

  // Roof, open above the chimney.
  block("roof-a", X0, X1, ROOF - SLAB, ROOF, CH_Z + 0.5, Z1),
  block("roof-b", CH_X + 0.5, X1, ROOF - SLAB, ROOF, Z0, CH_Z + 0.5),
];

// Furnishing (user: "fill this with details, maybe a chair, a table"),
// solid, kept off each floor's route and checked against new reaches.
// Floor 1: the route runs from the entrance along the right to the stairs;
// a table with a burning lantern, chairs, shelves and crates on the left.
pieces.push(
  ...table("furn-f1-table", -13, -34, F1, 10, true),
  ...chair("furn-f1-chair-1", -13.2, -35.1, F1, 190),
  ...chair("furn-f1-chair-2", -10.6, -33.3, F1, 70, true),
  ...shelves("furn-f1-shelves-1", -22.6, -56.2, F1, -90),
  ...shelves("furn-f1-shelves-2", -22.6, -54.8, F1, -90),
  crate("furn-f1-crate-1", -19.6, -41, 1, F1, 15),
  crate("furn-f1-crate-2", -18.4, -40.2, 0.7, F1, -10),
  barrel("furn-f1-barrel", -21.6, -31.6, F1),
  crate("furn-f1-crate-3", -8, -57.6, 0.9, F1, 30),
  // A second corner: a workbench and a wardrobe against the front wall.
  ...workbench("furn-f1-bench", -4, -29.8, F1, 180),
  ...chair("furn-f1-chair-3", -4.2, -31, F1, 15),
  ...wardrobe("furn-f1-wardrobe", -19, -29.7, F1, 0),
  crate("furn-f1-crate-4", -22, -46, 1.1, F1, -8),
  crate("furn-f1-crate-5", -21.8, -46.2, 0.8, F1 + 1.1, 25),
  barrel("furn-f1-barrel-2", -20.6, -46.6, F1),
);
// Floor 2: the route crosses from the stair landing to the slope; living
// quarters in the back half, far from the slope.
pieces.push(
  ...bed("furn-f2-bed", -20, -56.5, F2, -90),
  ...wardrobe("furn-f2-wardrobe", -16, -58.6, F2, 180),
  ...table("furn-f2-table", -11, -53, F2, 0, true),
  ...chair("furn-f2-chair-1", -11.2, -53.9, F2, 190),
  ...chair("furn-f2-chair-2", -9.8, -52.2, F2, -30),
  ...shelves("furn-f2-shelves", -6, -58.6, F2, 180),
  crate("furn-f2-crate", 2, -57, 1, F2, 20),
  barrel("furn-f2-barrel", 4, -56.2, F2),
  // A second bed and a long table for a meal nobody finished.
  ...bed("furn-f2-bed-2", -20, -52.5, F2, -90),
  ...table("furn-f2-long-1", -4, -47, F2, 90),
  ...table("furn-f2-long-2", -4, -45.6, F2, 90),
  ...chair("furn-f2-chair-3", -4.8, -47.2, F2, 90),
  ...chair("furn-f2-chair-4", -3.2, -45.4, F2, -90),
  ...chair("furn-f2-chair-5", -4.9, -45.2, F2, 60, true),
  ...shelves("furn-f2-shelves-2", 4, -58.6, F2, 180),
  ...wardrobe("furn-f2-wardrobe-2", -22.6, -47, F2, -90),
);
// Floor 3, the tall hall: a storeroom on the east side, away from the pipes
// to hop over and the chimney.
pieces.push(
  ...shelves("furn-f3-shelves-1", 14.6, -36, F3, 90, 2.6),
  ...shelves("furn-f3-shelves-2", 14.6, -37.4, F3, 90, 2.6),
  ...shelves("furn-f3-shelves-3", 14.6, -54, F3, 90, 2.6),
  ...shelves("furn-f3-shelves-4", 14.6, -55.4, F3, 90, 2.6),
  ...workbench("furn-f3-bench", 6, -32, F3, 0, true),
  ...chair("furn-f3-chair", 6.2, -33.3, F3, 200),
  crate("furn-f3-crate-1", 8, -56.4, 1.2, F3, 5),
  crate("furn-f3-crate-2", 8.1, -56.3, 0.9, F3 + 1.2, -20),
  crate("furn-f3-crate-3", 10.1, -57.2, 1, F3, 35),
  barrel("furn-f3-barrel-1", 2, -56.6, F3),
  barrel("furn-f3-barrel-2", 2.9, -57.4, F3, 0.9),
  // Along the front wall: a row of crates and barrels, a second bench.
  crate("furn-f3-crate-4", -6, -30, 1.2, F3, 10),
  crate("furn-f3-crate-5", -4.6, -30.1, 1, F3, -15),
  crate("furn-f3-crate-6", -5.4, -30.2, 0.8, F3 + 1.2, 30),
  barrel("furn-f3-barrel-3", -2.6, -29.8, F3),
  barrel("furn-f3-barrel-4", -1.8, -30.3, F3),
  ...workbench("furn-f3-bench-2", 12, -47.5, F3, 90),
  ...shelves("furn-f3-shelves-5", 14.6, -41, F3, 90, 2.6),
);
// The court roof: a table and chairs left out on the west side.
pieces.push(
  ...table("furn-court-table", -20.5, -48.5, ROOF, -15),
  ...chair("furn-court-chair-1", -20.3, -49.6, ROOF, 170),
  ...chair("furn-court-chair-2", -18.9, -47.7, ROOF, 60, true),
);

// Props on the court floor, in its corners, away from the climb up tower D.
pieces.push(
  crate("prop-court-crate-1", -20.8, -31.9, 1.1, ROOF, 10),
  barrel("prop-court-barrel-1", -19.6, -30.8, ROOF),
  barrel("prop-court-barrel-2", -21.4, -30.6, ROOF, 0.9),
  barrel("prop-court-barrel-3", -21.3, -44.4, ROOF),
  crate("prop-court-crate-2", -20.6, -43.4, 0.9, ROOF, -25),
);

export const zone3: Zone = {
  id: "zone3",
  name: "Inside",
  start: { x: 5, y: F1, z: -61.5 },
  pieces,
  restSpots: [{ id: "zone-3-top", min: { x: -12, y: ROOF, z: -58 }, max: { x: -6, y: ROOF + 3, z: -52 } }],
  // The three storeys inside the shell, under the roof.
  rooms: [{ min: { x: X0, y: F1, z: Z0 }, max: { x: X1, y: ROOF - SLAB, z: Z1 } }],
  // The club, first heard here: behind the sealed door on floor 1 (the listener above hears it too).
  clubs: [{ x: X0 - 0.5, y: F1 + 1.3, z: -49.2 }],
  figures: [{ id: "listener", pos: { x: -13.5, y: ROOF, z: -58.4 }, facing: 0, pose: "stand" }],
};
