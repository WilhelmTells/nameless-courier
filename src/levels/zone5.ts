// Zone 5, machinery: on top of tower D, inside the roof court. Pistons lift
// the way up to a machine house, a sweeper turns on its roof, two pendulums
// swing across a beam to the crane gantry. From there lift cages carry the
// courier out through the gate in the back wall, over the open drop to Zone
// 2's deck, to the crane tower: the first heartbreak spot.

import type { Motion } from "../core/motionCore.ts";
import { barrel, block, crate, pallet } from "./shapes.ts";
import type { Piece, Zone } from "./types.ts";
import { D_TOP, GATE_BOTTOM, GATE_X0, GATE_X1 } from "./zone4.ts";

const HOUSE = 114;
/** The crossing starts above the gate's sill. */
const GANTRY = 116;
const CRANE = 120;
const CAGE = 0.5;

const moving = (piece: Piece, motion: Motion): Piece => ({ ...piece, motion });

/** A piston: a column standing on D's top whose head rises `rise` m and back. */
const piston = (id: string, x0: number, x1: number, low: number, phase: number): Piece[] => [
  ...(low - 1 > D_TOP ? [block(`${id}-column`, x0, x1, D_TOP, low - 1, -41, -38.5)] : []),
  moving(block(id, x0, x1, low - 1, low, -41, -38.5), { kind: "piston", by: { x: 0, y: 3, z: 0 }, period: 4, dwell: 1, phase }),
];

/** A weight hanging from the gantry rail, swinging across the beam. */
const pendulum = (id: string, x: number, phase: number): Piece =>
  moving(block(id, x - 0.5, x + 0.5, HOUSE + 0.5, HOUSE + 1.5, -47.5, -46.5), {
    kind: "pendulum",
    pivot: { x, y: 120, z: -47 },
    axis: { x: 1, y: 0, z: 0 },
    angle: 30,
    period: 4,
    phase,
  });

const pieces: Piece[] = [
  // Pistons along D's front edge, each a step higher (heads 101/103/105 at rest, +3).
  ...piston("piston-1", -8, -5.5, 101, 0),
  ...piston("piston-2", -4, -1.5, 103, 1 / 3),
  ...piston("piston-3", 0, 2.5, 105, 2 / 3),

  // The machine house; a sweeper arm turns over its roof at body height.
  block("machine-house", -1, 5, D_TOP, HOUSE, -50, -44),
  moving(block("sweeper", -2, 6, HOUSE + 0.6, HOUSE + 1.2, -47.2, -46.8), { kind: "rotate", axis: { x: 0, y: 1, z: 0 }, period: 8, phase: 0 }),
  block("sweeper-hub", 1.6, 2.4, HOUSE, HOUSE + 1.6, -47.4, -46.6),

  // A beam over D's top to the crane gantry, two pendulums swinging across it
  // from a rail overhead.
  block("gantry-beam", -8, -1, HOUSE - 0.5, HOUSE, -47.25, -46.75),
  block("rail", -8, -1, 120, 120.5, -47.5, -46.5),
  pendulum("pendulum-1", -3, 0),
  pendulum("pendulum-2", -6, 0.5),
  block("gantry", -12, -8, D_TOP, GANTRY, -50, -46),

  // The crossing: two lift cages shuttling out through the gate in turn, over
  // the drop to Zone 2's deck, to the top of the crane tower.
  moving(block("cage-1", -12, -8, GANTRY - CAGE, GANTRY, -55, -51), { kind: "linear", by: { x: 0, y: 0, z: -8 }, period: 12, phase: 0 }),
  moving(block("cage-2", -12, -8, GANTRY + 2 - CAGE, GANTRY + 2, -67, -63), { kind: "linear", by: { x: 0, y: 0, z: -8 }, period: 12, phase: 0.5 }),
  block("crane-tower", -12, -8, 0, CRANE - 0.5, -81, -76),
  block("crane-top", -13, -7, CRANE - 0.5, CRANE, -82, -75),
  // Catches a fall beyond the far end of Zone 2's deck.
  block("deck-annex", -24, 0, 25, 26, -90, -76),
];

// The gate in the back wall must let the cages through.
if (GATE_X0 > -12 || GATE_X1 < -8 || GATE_BOTTOM > GANTRY - CAGE) throw new Error("zone5: cages do not fit the gate");

// Props on the lower deck, where a miss at the crossing lands.
/** Top of the lower deck (deck-annex), m. */
const DECK = 26;
pieces.push(
  crate("prop-annex-crate-1", -20.4, -87.4, 1.2, DECK, -8),
  crate("prop-annex-crate-2", -19, -86.6, 0.9, DECK, 22),
  pallet("prop-annex-pallet", -20.6, -85.9, DECK, 4),
  barrel("prop-annex-barrel-1", -4.3, -87.8, DECK),
  barrel("prop-annex-barrel-2", -3.5, -87.1, DECK, 0.9),
);

export const zone5: Zone = {
  id: "zone5",
  name: "Machinery",
  start: { x: -10, y: D_TOP, z: -43.5 },
  pieces,
  restSpots: [
    { id: "zone-5-crossing", min: { x: -12, y: GANTRY, z: -50 }, max: { x: -8, y: GANTRY + 3, z: -46 } },
    { id: "zone-5-top", min: { x: -12, y: CRANE, z: -81 }, max: { x: -8, y: CRANE + 3, z: -77 } },
  ],
  // The club again, deep inside the machine house.
  clubs: [{ x: 2, y: D_TOP + 4, z: -47 }],
  figures: [
    { id: "let-go", pos: { x: -11.6, y: GANTRY, z: -46.4 }, facing: 0, pose: "stand" },
    { id: "keeper", pos: { x: -12.6, y: CRANE, z: -81.6 }, facing: 180, pose: "stand" },
  ],
};
