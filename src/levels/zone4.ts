// Zone 4, surfaces: a roof court on top of block C. Its outer walls rise far
// above the roof, so a mistimed trampoline throw hits a wall or comes back
// down into the court, which is the zone start. Tower D stands in the middle;
// tarred terraces, a mud-flooded ledge and two tarp pads climb its faces to
// its top at 100 m.
//
// The court is x -23..15, z -59..-29 at 74 m (Zone 3's roof). Tower D is
// x -12..4, z -50..-38.

import { block } from "./shapes.ts";
import type { Piece, Surface, Zone } from "./types.ts";

export const COURT = 74;
export const WALL_TOP = 120;
export const D_TOP = 100;
/** A gap in the back wall from this height up lets Zone 5's crossing out. */
export const GATE_BOTTOM = 115;
export const GATE_X0 = -14;
export const GATE_X1 = -6;

const TERRACE = 0.5;
const PAD = 0.3;

const surfaced = (piece: Piece, surface: Surface): Piece => ({ ...piece, surface });
/** A terrace slab whose top is at `top`. */
const terrace = (id: string, x0: number, x1: number, z0: number, z1: number, top: number, surface: Surface = "normal") =>
  surfaced(block(id, x0, x1, top - TERRACE, top, z0, z1), surface);
/** A tarp pad lying on a surface at `on`. */
const pad = (id: string, x0: number, x1: number, z0: number, z1: number, on: number) =>
  surfaced(block(id, x0, x1, on, on + PAD, z0, z1), "trampoline");

const pieces: Piece[] = [
  // Court walls on top of block C's shell; the back wall leaves the gate open.
  block("court-wall-back-left", -24, GATE_X0, COURT, WALL_TOP, -60, -59),
  block("court-wall-back-right", GATE_X1, 16, COURT, WALL_TOP, -60, -59),
  block("court-wall-back-gate", GATE_X0, GATE_X1, COURT, GATE_BOTTOM, -60, -59),
  block("court-wall-front", -24, 16, COURT, WALL_TOP, -29, -28),
  block("court-wall-left", -24, -23, COURT, WALL_TOP, -59, -29),
  block("court-wall-right", 15, 16, COURT, WALL_TOP, -59, -29),

  // Tower D.
  block("tower-d", -12, 4, COURT, D_TOP, -50, -38),

  // Zone 3's chimney opens in the court floor at the back left corner: a hood
  // and a curb keep falls out of it; the way out of it to the right stays open.
  // The hood stops short of the curb: 2.3 m over the curb's top pinned the
  // pogo between the two (user).
  block("chimney-hood", -23, -17.5, 77.5, 78, -59, -54),
  block("chimney-curb", -23, -17.5, COURT, COURT + 1.2, -54, -53.5),

  // Back face: the first pad, on the court floor, is the only way up to the
  // first terrace (10.5 m above the floor, out of reach of a full charge).
  // No pad throw reaches the gate in the back wall (highest 113.9 m).
  pad("tarp-1", -2, 2, -58, -55.5, COURT),
  terrace("terrace-1", -6, 4, -54, -50, 84.5),
  // Right face: a flooded ledge. Mud only lets a full charge out.
  terrace("mud-ledge", 4, 6.5, -54, -42, 84.5, "mud"),
  terrace("terrace-2", 0, 7, -38, -35.5, 85.8),
  terrace("terrace-2-side", 4, 7, -40.5, -38, 85.8),
  // Front face: a flooded terrace, a tarp beyond the mud.
  terrace("mud-terrace", -11, 0, -38, -36, 88, "mud"),
  terrace("tarp-2-base", -14, -11, -38, -35, 88),
  pad("tarp-2", -14, -11, -38, -35, 88),
  // Left face: the last terrace below the top.
  terrace("terrace-4", -16, -12, -48, -41, 95),
];

export const zone4: Zone = {
  id: "zone4",
  name: "Surfaces",
  start: { x: -9, y: COURT, z: -55 },
  pieces,
  restSpots: [{ id: "zone-4-top", min: { x: -11.5, y: D_TOP, z: -45 }, max: { x: -8.5, y: D_TOP + 3, z: -42 } }],
  // The club again, deep inside tower D.
  clubs: [{ x: -4, y: 88, z: -44 }],
  figures: [{ id: "forgotten", pos: { x: -11.5, y: D_TOP, z: -38.6 }, facing: 90, pose: "hunch" }],
};
