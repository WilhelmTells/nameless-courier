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

/** A wooden crate standing on `y`, `size` m on a side, turned `yaw` degrees. Solid, so it can be landed on. */
export function crate(id: string, x: number, z: number, size: number, y: number, yaw = 0): Piece {
  const h = size / 2;
  return { ...block(id, x - h, x + h, y, y + size, z - h, z + h), rotation: { x: 0, y: yaw, z: 0 }, material: "crate" };
}

/** A rusty barrel standing on `y`. */
export function barrel(id: string, x: number, z: number, y: number, height = 1): Piece {
  return { ...pole(id, x, z, 0.7, y, y + height), material: "barrel" };
}

/** A pallet lying on `y`. */
export function pallet(id: string, x: number, z: number, y: number, yaw = 0): Piece {
  return { ...block(id, x - 0.6, x + 0.6, y, y + 0.15, z - 0.5, z + 0.5), rotation: { x: 0, y: yaw, z: 0 }, material: "crate" };
}

/**
 * A stone fountain standing on `y`: an octagonal rim around a basin of
 * water, a pedestal carrying a bowl that overflows, and a finial. 6.6 m
 * across, 2.75 m high, solid throughout.
 */
export function fountain(id: string, x: number, z: number, y: number): Piece[] {
  const RIM = 3.1;
  const side = 2 * 3.3 * Math.tan(Math.PI / 8);
  const rim = Array.from({ length: 8 }, (_, i): Piece => {
    const a = (i * Math.PI) / 4;
    const cx = x + Math.sin(a) * RIM, cz = z + Math.cos(a) * RIM;
    return { ...block(`${id}-rim-${i + 1}`, cx - side / 2, cx + side / 2, y, y + 0.75, cz - 0.18, cz + 0.18), rotation: { x: 0, y: (a * 180) / Math.PI, z: 0 }, material: "stone" };
  });
  return [
    { ...pole(`${id}-basin`, x, z, 6, y, y + 0.5), material: "water" },
    ...rim,
    { ...pole(`${id}-pedestal`, x, z, 0.7, y, y + 1.6), material: "stone" },
    { ...pole(`${id}-bowl`, x, z, 2.2, y + 1.6, y + 1.85), material: "stone" },
    { ...pole(`${id}-finial`, x, z, 0.35, y + 1.85, y + 2.75), material: "stone" },
  ];
}
