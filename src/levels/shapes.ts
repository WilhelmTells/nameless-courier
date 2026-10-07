// Helpers for writing level data by extents instead of centre and size.

import type { Piece } from "./types.ts";

/** A box given by its extents, m. */
export function block(id: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Piece {
  return {
    id,
    shape: "box",
    position: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 },
    rotation: { x: 0, y: 0, z: 0 },
    size: { x: x1 - x0, y: y1 - y0, z: z1 - z0 },
    surface: "normal",
    motion: { kind: "none" },
  };
}

/** A ramp standing on height `y`, its high edge towards -Z. */
export function ramp(id: string, x: number, z: number, angle: number, height: number, width: number, y = 0): Piece {
  const depth = height / Math.tan((angle * Math.PI) / 180);
  return { ...block(id, x - width / 2, x + width / 2, y, y + height, z - depth / 2, z + depth / 2), shape: "ramp" };
}

/** A round pole standing on `y0`, its top at `y1`. */
export function pole(id: string, x: number, z: number, diameter: number, y0: number, y1: number): Piece {
  return { ...block(id, x - diameter / 2, x + diameter / 2, y0, y1, z - diameter / 2, z + diameter / 2), shape: "cylinder" };
}
