// Zone 1, the base: a yard at the foot of the structure, then a climb up its
// front face and around the first corner. Each element appears first where a
// slip is cheap. The camera starts looking along -Z; +X is right.
//
// The structure is three stacked blocks with setbacks, so each roof is a
// terrace and a fall from a higher one lands on a lower one:
//   A (base)  x -24..24, z -60..-16, top 10
//   B         x -24..20, z -60..-22, top 22 (gap at the side, crossed on pads)
//   C         x -24..16, z -60..-28, solid up to 50; Zone 2 climbs its back,
//             Zone 3 is the hollow storeys above
//
// Overhangs and walls above the route stop the big skips: a full charge
// under them hits them instead of clearing a whole section.

import { barrel, block, crate, fountain, pallet, ramp } from "./shapes.ts";
import type { Piece, Zone } from "./types.ts";

const FACE_A = -16;
const FACE_B = -22;
const ROOF_A = 10;
const ROOF_B = 22;

const pieces: Piece[] = [
  // Yard: open ground framed by low side walls, with crates to hop on.
  block("yard-wall-left", -26.6, -26, 0, 3, FACE_A, 8),
  block("yard-wall-right", 26, 26.6, 0, 3, FACE_A, 8),
  { ...block("crate-1", -6, -4.5, 0, 0.5, -5, -3.5), material: "crate" },
  { ...block("crate-2", -8.5, -7, 0, 0.7, -8.5, -7), material: "crate" },
  { ...block("crate-stack", -10, -8, 0, 1.5, -12, -10), material: "crate" },
  ramp("yard-ramp", -2, -9, 15, 0.8, 2),

  // Low steps up to the loading dock (normal bounces).
  block("step-1", 5, 9, 0, 0.5, -7.5, -6),
  block("step-2", 5, 9, 0, 1, -10, -8.5),
  block("step-3", 5, 9, 0, 1.5, -12.5, -11),
  block("dock", 2, 12, 0, 2, FACE_A, -13.5),

  // First charge: a 3 m step up from the dock.
  block("ledge-1", -4, 2, 0, 5, FACE_A, -13),

  // Gaps, going left: 1.5 m, 2.5 m (+1 m), 3.5 m (+1.5 m). A slip lands in the yard.
  block("gap-1", -8.5, -5.5, 0, 5, FACE_A, -13),
  block("gap-2", -14, -11, 0, 6, FACE_A, -13),
  block("gap-3", -20.5, -17.5, 0, 7.5, FACE_A, -13),

  // Block A. Its front terrace is split around two light wells (3 m deep).
  block("block-a", -24, 24, 0, ROOF_A, -60, FACE_B),
  block("terrace-a-1", -24, -13, 0, ROOF_A, FACE_B, FACE_A),
  block("well-1-floor", -13, -6, 0, ROOF_A - 3, FACE_B, FACE_A),
  block("terrace-a-2", -6, 5, 0, ROOF_A, FACE_B, FACE_A),
  block("well-2-floor", 5, 7.5, 0, ROOF_A - 3, FACE_B, FACE_A),
  block("terrace-a-3", 7.5, 24, 0, ROOF_A, FACE_B, FACE_A),
  // Parapet along the front edge, open at the left end where the route arrives.
  block("parapet-1", -16, -13, ROOF_A, ROOF_A + 1, FACE_A - 0.4, FACE_A),
  block("well-1-lip", -13, -6, ROOF_A - 3, ROOF_A + 1, FACE_A - 0.4, FACE_A),
  block("parapet-2", -6, 5, ROOF_A, ROOF_A + 1, FACE_A - 0.4, FACE_A),
  block("well-2-lip", 5, 7.5, ROOF_A - 3, ROOF_A + 1, FACE_A - 0.4, FACE_A),
  block("parapet-3", 7.5, 24, ROOF_A, ROOF_A + 1, FACE_A - 0.4, FACE_A),

  // Cornice along roof A's front, over ledge 1 and the gaps: charging under it
  // hits it, and its top is out of reach from the yard.
  block("cornice", -13, 24, ROOF_A, ROOF_A + 2, FACE_A, FACE_A + 3),

  // Narrow beam between two vents over the first light well.
  block("vent-1", -16, -13, ROOF_A, ROOF_A + 3, -21, -17),
  block("beam", -13, -6, ROOF_A + 2.7, ROOF_A + 3, -19.2, -18.8),
  block("vent-2", -6, -3, ROOF_A, ROOF_A + 3, -21, -17),

  // Low ceiling: a canopy 3.2 m above the terrace, over the second light well.
  block("canopy", 2, 10, ROOF_A + 3.2, ROOF_A + 3.6, FACE_B, FACE_A),
  // A service stack rising from the canopy stops jumps from the vents over it.
  block("stack", 2, 3, ROOF_A + 3.2, ROOF_B + 2, FACE_B, FACE_A + 3),

  // Mixed stretch: ledges on block B's front face, round the corner onto roof B.
  block("ledge-b-1", 12, 15, ROOF_A, 13.5, FACE_B, -19.5),
  block("ledge-b-2", 16.5, 19, ROOF_A, 17, FACE_B, -19.5),
  block("ledge-b-3", 20, 23.5, ROOF_A, 20, -26, -21),

  // Block B, with a gap in its side strip crossed on two pads (1.5 m gaps).
  block("block-b", -24, 16, ROOF_A, ROOF_B, -60, FACE_B),
  // Parapet along roof B's front, too high to reach from the vents.
  block("parapet-b", -24, 12, ROOF_B, ROOF_B + 2, FACE_B - 0.4, FACE_B),
  block("block-b-side-1", 16, 20, ROOF_A, ROOF_B, -36, FACE_B),
  block("pad-1", 16.75, 19.25, ROOF_A, ROOF_B + 0.5, -40, -37.5),
  block("pad-2", 16.75, 19.25, ROOF_A, ROOF_B + 1, -44, -41.5),
  block("block-b-side-2", 16, 20, ROOF_A, ROOF_B, -56, -45.5),

  // Block C, the rest of the tower, and the rest ledge at the top of the zone.
  block("block-c", -24, 16, ROOF_B, 50, -60, -28),
  block("rest-ledge", 16, 20, ROOF_A, ROOF_B + 4, -60, -56),
];

// Props on the yard (user: "boxes, barrels or maybe a nice fountain"): solid,
// placed off the route and checked against new reaches (internal/sim-props.ts).
pieces.push(
  ...fountain("fountain", -14, 4, 0),
  crate("prop-yard-crate-1", 19.6, -1.4, 1.1, 0, 12),
  crate("prop-yard-crate-2", 20.9, -0.2, 0.8, 0, -20),
  pallet("prop-yard-pallet", 19.4, 0.4, 0, 8),
  barrel("prop-yard-barrel-1", 22.6, 4.6, 0),
  barrel("prop-yard-barrel-2", 23.4, 5.4, 0, 0.9),
  barrel("prop-yard-barrel-3", 22.7, 5.8, 0),
);

export const zone1: Zone = {
  id: "zone1",
  name: "Base",
  start: { x: 0, y: 0, z: 0 },
  pieces,
  restSpots: [
    { id: "yard-start", min: { x: -3, y: 0, z: -3 }, max: { x: 3, y: 3, z: 3 } },
    { id: "zone-top", min: { x: 16, y: ROOF_B + 4, z: -60 }, max: { x: 20, y: ROOF_B + 7, z: -56 } },
  ],
  figures: [{ id: "door", pos: { x: 16.4, y: ROOF_B + 4, z: -59.6 }, facing: -90, pose: "stand" }],
};
