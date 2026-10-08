// Zone 6, the summit: tower E stands behind the structure, its roof level
// with the crane top that ends Zone 5; the crane's jib leads across. An
// antenna forest climbs its roof to a pump shaft with a tarp pad at the
// bottom, which throws the courier up onto the upper roof E2. There an
// antenna boom sweeps across the way to the poles up to the mast crown. From the crown a shuttle
// carries the courier out over the open drop beside the tower, and two pole
// tops under swinging weights lead to the summit: the final heartbreak spot.
// A miss there falls all the way to the ground.
//
// Tower E is x -44..-8, z -114..-90; its roof is the zone start, and every
// slip before the crown lands on it.

import type { Motion } from "../core/motionCore.ts";
import { block, pole, ramp } from "./shapes.ts";
import type { Piece, Surface, Zone } from "./types.ts";

const ROOF = 120;
const E2 = 139;
const HUT = 141;
const CROWN = 147.5;
const SUMMIT = 158;
/** A hood over the summit: lobs from below hit it instead of landing. */
const HOOD = 162;
const RAIL = HOOD;
const PAD = 0.3;
/** The pump shaft's door reaches up to here; its lid hangs at `LID`. */
const DOOR = 131.5;
const LID = 146;

const moving = (piece: Piece, motion: Motion): Piece => ({ ...piece, motion });
const surfaced = (piece: Piece, surface: Surface): Piece => ({ ...piece, surface });

/** A weight hanging from the summit rail, swinging across the way at `low`..`low + 1`. */
const pendulum = (id: string, x: number, low: number, angle: number, phase: number): Piece =>
  moving(block(id, x - 0.5, x + 0.5, low, low + 1, -98.5, -97.5), {
    kind: "pendulum",
    pivot: { x, y: RAIL, z: -98 },
    axis: { x: 1, y: 0, z: 0 },
    angle,
    period: 4,
    phase,
  });

const pieces: Piece[] = [
  // Tower E, with a low parapet along its back edge; the crane's jib reaches it.
  block("tower-e", -44, -8, 0, ROOF, -114, -90),
  block("tower-e-parapet", -44, -8, ROOF, ROOF + 2, -114, -113.5),
  block("jib", -11, -9, ROOF - 0.5, ROOF, -90, -82),
  // Catches overshoots past the poles up to the crown.
  block("tower-e-wing", -8, 2, 0, ROOF, -114, -101),
  block("tower-e-wing-parapet", -8, 2, ROOF, ROOF + 2, -114, -113.5),

  // Antenna forest (safe): masts going left along the front, then a water
  // tank by the door of a pump shaft.
  pole("mast-1", -15, -95, 1.5, ROOF, 122),
  pole("mast-2", -19.5, -95, 1.3, ROOF, 124),
  pole("mast-3", -24, -95, 1.1, ROOF, 126),
  pole("tank", -29.5, -95, 4, ROOF, 128.5),

  // The pump shaft: a flooded floor with a tarp pad, walls up to a lid. A
  // throw can only leave over the back wall, onto E2; anything else comes
  // back down the shaft or out through the door.
  surfaced(block("pump-house", -39, -33, ROOF, 128, -101, -95), "mud"),
  surfaced(block("tarp-3", -38, -35, 128, 128 + PAD, -100, -97), "trampoline"),
  block("shaft-left", -40, -39, ROOF, LID, -102, -94),
  block("shaft-front", -39, -33, ROOF, LID, -95, -94),
  block("shaft-back", -39, -33, ROOF, E2, -102, -101),
  block("shaft-right-back", -33, -32, ROOF, LID, -102, -100),
  block("shaft-right-front", -33, -32, ROOF, LID, -96, -94),
  block("shaft-door-lintel", -33, -32, DOOR, LID, -100, -96),
  // The lid reaches out over E2, so a throw leaves the shaft low.
  block("shaft-lid", -40, -32, LID, LID + 0.5, -106, -94),

  // Upper roof E2 (exposed): out of reach without the pad. An antenna boom
  // sweeps across it at body height; a roof pitch climbs to a hut.
  block("tower-e2", -40, -16, ROOF, E2, -113, -102),
  block("tower-e2-parapet", -40, -16, E2, E2 + 1.5, -113, -112.5),
  moving(block("boom", -31, -21, E2 + 0.6, E2 + 1.2, -107.2, -106.8), { kind: "rotate", axis: { x: 0, y: 1, z: 0 }, period: 8, phase: 0 }),
  block("boom-hub", -26.4, -25.6, E2, E2 + 1.6, -107.4, -106.6),
  ramp("pitch", -18, -107.25, 20, HUT - E2, 4, E2),
  block("hut", -20, -14, ROOF, HUT, -113, -110),

  // Poles up the right side to the mast crown.
  pole("summit-pole-1", -11, -111, 1.1, ROOF, 143),
  pole("summit-pole-2", -11, -107, 1, ROOF, 144.5),
  pole("summit-pole-3", -11, -103, 1, ROOF, 146),
  block("crown", -13, -9, ROOF, CROWN, -100, -96),

  // The final crossing, over the open drop: a shuttle out from the crown, then
  // two pole tops under weights swinging from the rail, to the summit.
  moving(block("shuttle", -8.5, -4.5, CROWN - 0.5, CROWN, -100, -96), { kind: "linear", by: { x: 8, y: 0, z: 0 }, period: 12, phase: 0 }),
  pole("last-pole-1", 7, -98, 1.1, 0, 149.5),
  pole("last-pole-2", 11.5, -98, 1.1, 0, 152.5),
  pendulum("weight-1", 7, 150.5, 18, 0),
  pendulum("weight-2", 11.5, 153.5, 22, 0.5),
  block("summit-mast", 16.5, 19.5, 0, SUMMIT - 1, -99.5, -96.5),
  block("summit", 15, 21, SUMMIT - 1, SUMMIT, -101, -95),
  block("summit-hood-post", 20.5, 21, SUMMIT, HOOD, -101, -100.5),
  block("summit-hood", 15, 21, HOOD, HOOD + 0.5, -101, -95),
  pole("antenna", 19, -99.5, 0.6, HOOD + 0.5, 172),
  block("summit-rail", 5, 15, RAIL, RAIL + 0.5, -98.5, -97.5),
];

export const zone6: Zone = {
  id: "zone6",
  name: "Summit",
  start: { x: -10, y: ROOF, z: -92 },
  pieces,
  restSpots: [
    { id: "zone-6-start", min: { x: -12, y: ROOF, z: -94 }, max: { x: -8, y: ROOF + 3, z: -90 } },
    { id: "zone-6-crown", min: { x: -13, y: CROWN, z: -100 }, max: { x: -9, y: CROWN + 3, z: -96 } },
    { id: "summit", min: { x: 15, y: SUMMIT, z: -101 }, max: { x: 21, y: SUMMIT + 3, z: -95 } },
  ],
  figures: [{ id: "waiting", pos: { x: 20.4, y: SUMMIT, z: -98 }, facing: -90, pose: "hood" }],
};
