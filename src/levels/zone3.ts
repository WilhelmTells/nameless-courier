// Zone 3, inside: the hollow storeys of block C above its solid base. Floors
// at 50, 56 and 62 m, each ceiling slab with an opening to the next; a
// stairwell is the easy way up the first time, a slope under the second
// opening throws the bounce sideways. A chimney climbs from the top floor to
// the roof. A slip drops at most one floor.
//
// Inside is x -23..15, z -59..-29 (1 m walls). The entrance is the opening in
// the back wall at x 2..8, from Zone 2's top ledge.

import { block, ramp } from "./shapes.ts";
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
  block("pipe-f1", X0, 10, F1 + 3, F1 + 3.4, -45, -44.6),
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

export const zone3: Zone = {
  id: "zone3",
  name: "Inside",
  start: { x: 5, y: F1, z: -61.5 },
  pieces,
  restSpots: [{ id: "zone-3-top", min: { x: -12, y: ROOF, z: -58 }, max: { x: -6, y: ROOF + 3, z: -52 } }],
  figures: [{ id: "listener", pos: { x: -13.5, y: ROOF, z: -58.4 }, facing: 0, pose: "stand" }],
};
