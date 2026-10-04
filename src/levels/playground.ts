// Collision test playground: steps, gaps, ramps, poles, a narrow beam, a low
// tunnel, an overhang, and walls for wall kicks. The camera starts looking
// along -Z.

import type { Level, Piece, Vec3 } from "./types.ts";

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

/** A piece standing on `bottom` (its lowest point), centred on x/z. */
function piece(id: string, shape: Piece["shape"], x: number, bottom: number, z: number, sx: number, sy: number, sz: number): Piece {
  return {
    id,
    shape,
    position: { x, y: bottom + sy / 2, z },
    rotation: ZERO,
    size: { x: sx, y: sy, z: sz },
    surface: "normal",
    motion: { kind: "none" },
  };
}

const box = (id: string, x: number, bottom: number, z: number, sx: number, sy: number, sz: number) =>
  piece(id, "box", x, bottom, z, sx, sy, sz);

/** Ramp of a given angle and height, its high edge towards -Z. */
function ramp(id: string, x: number, z: number, angle: number, height: number, width: number): Piece {
  const depth = height / Math.tan((angle * Math.PI) / 180);
  return piece(id, "ramp", x, 0, z, width, height, depth);
}

const pieces: Piece[] = [
  // Steps with 1 m gaps, ahead left.
  box("step-1", -6, 0, -4, 2, 0.5, 2),
  box("step-2", -6, 0, -7, 2, 1, 2),
  box("step-3", -6, 0, -10, 2, 1.5, 2),
  box("step-4", -6, 0, -13, 2, 2.5, 2),

  // Narrow beam at 1 m between two platforms, straight ahead.
  box("beam-start", 0, 0, -4, 2, 1, 2),
  box("beam", 0, 0.7, -9, 0.3, 0.3, 8),
  box("beam-end", 0, 0, -14, 2, 1, 2),

  // Ramps of 15°, 30°, 45° and 60°, 2 m high, ahead right.
  ramp("ramp-15", 5, -8, 15, 2, 3),
  ramp("ramp-30", 9, -8, 30, 2, 3),
  ramp("ramp-45", 13, -8, 45, 2, 3),
  ramp("ramp-60", 17, -8, 60, 2, 3),

  // Poles, 0.6 m wide, 1–3 m high, left.
  piece("pole-1", "cylinder", -12, 0, -3, 0.6, 1, 0.6),
  piece("pole-2", "cylinder", -12, 0, -5, 0.6, 1.5, 0.6),
  piece("pole-3", "cylinder", -12, 0, -7, 0.6, 2, 0.6),
  piece("pole-4", "cylinder", -12, 0, -9, 0.6, 2.5, 0.6),
  piece("pole-5", "cylinder", -12, 0, -11, 0.6, 3, 0.6),

  // Low tunnel, behind the start: 3 m clear height fits normal bounces
  // (rider height 1.75 m + 1 m apex), charged jumps hit the roof.
  box("tunnel-left", -1.75, 0, 8, 0.5, 3, 6),
  box("tunnel-right", 1.75, 0, 8, 0.5, 3, 6),
  box("tunnel-roof", 0, 3, 8, 4, 0.4, 6),

  // Overhang: a 3 m high platform sticking out past its pillar, behind left.
  box("overhang-pillar", -8, 0, 9, 1, 3, 1),
  box("overhang", -8, 3, 8, 4, 0.5, 4),

  // Single wall for wall kicks, its face towards -X, right.
  box("wall-single", 25.5, 0, -4, 3, 6, 8),

  // Chimneys: two walls 2.5 m and 4 m apart, 10 m high, with a landing on top.
  box("chimney-a-left", 20.5, 0, -16, 1, 10, 4),
  box("chimney-a-right", 24, 0, -16, 1, 10, 4),
  box("chimney-b-left", 20.5, 0, -24, 1, 10, 4),
  box("chimney-b-right", 25.5, 0, -24, 1, 10, 4),
  box("chimney-top", 28, 0, -20, 3, 10, 12),

  // Crossing along a wall: two 2 m platforms 9 m apart beside a long wall.
  box("cross-start", 31, 0, -2, 3, 2, 3),
  box("cross-wall", 33.5, 0, -8.5, 0.6, 6, 16),
  box("cross-end", 31, 0, -15, 3, 2, 3),
];

export const playground: Level = {
  id: "playground",
  name: "Playground",
  start: { x: 0, y: 0, z: 0 },
  pieces,
  restSpots: [{ id: "start", min: { x: -3, y: 0, z: -3 }, max: { x: 3, y: 3, z: 3 } }],
};
