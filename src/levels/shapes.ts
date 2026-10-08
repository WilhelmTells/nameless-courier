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

/** One box of a piece of furniture, in its own frame: extents across (x), up (y) and along (z), and its look. */
type Part = [name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material?: string];

/**
 * A piece of furniture made of boxes, standing on `y` at (`x`, `z`), turned
 * `yaw` degrees. Every part is solid.
 */
function furniture(id: string, x: number, z: number, y: number, yaw: number, parts: Part[], material = "wood"): Piece[] {
  const a = (yaw * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  return parts.map(([name, x0, x1, y0, y1, z0, z1, look]) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // Turned about the vertical axis like a piece's own rotation.
    const wx = x + cx * cos + cz * sin, wz = z - cx * sin + cz * cos;
    const sx = (x1 - x0) / 2, sz = (z1 - z0) / 2;
    return {
      ...block(`${id}-${name}`, wx - sx, wx + sx, y + y0, y + y1, wz - sz, wz + sz),
      rotation: { x: 0, y: yaw, z: 0 },
      material: look ?? material,
    };
  });
}

/** Four legs under a top, `w` × `d`, legs `t` thick, standing `h` high. */
function legs(w: number, d: number, h: number, t = 0.06): Part[] {
  const x = w / 2 - t, z = d / 2 - t;
  return [
    ["leg-1", -x - t / 2, -x + t / 2, 0, h, -z - t / 2, -z + t / 2],
    ["leg-2", x - t / 2, x + t / 2, 0, h, -z - t / 2, -z + t / 2],
    ["leg-3", -x - t / 2, -x + t / 2, 0, h, z - t / 2, z + t / 2],
    ["leg-4", x - t / 2, x + t / 2, 0, h, z - t / 2, z + t / 2],
  ];
}

/** A wooden table, 1.4 × 0.8 m, 0.78 m high. Its id ends in "-lantern-top" when a lantern burns on it. */
export function table(id: string, x: number, z: number, y: number, yaw = 0, lantern = false): Piece[] {
  return furniture(id, x, z, y, yaw, [...legs(1.4, 0.8, 0.74), [lantern ? "top-lantern" : "top", -0.7, 0.7, 0.74, 0.78, -0.4, 0.4]]);
}

/** A wooden chair facing -Z (its back at +Z); `tipped` lies it on its back. */
export function chair(id: string, x: number, z: number, y: number, yaw = 0, tipped = false): Piece[] {
  if (tipped) {
    // On its back: the seat stands upright, the back lies flat.
    return furniture(id, x, z, y, yaw, [
      ["back", -0.22, 0.22, 0, 0.04, -0.25, 0.3],
      ["seat", -0.22, 0.22, 0, 0.45, 0.3, 0.34],
      ["leg-1", -0.22, -0.17, 0.4, 0.44, 0.3, 0.75],
      ["leg-2", 0.17, 0.22, 0.4, 0.44, 0.3, 0.75],
    ]);
  }
  return furniture(id, x, z, y, yaw, [
    ...legs(0.44, 0.44, 0.43, 0.05),
    ["seat", -0.22, 0.22, 0.43, 0.47, -0.22, 0.22],
    ["back", -0.22, 0.22, 0.47, 0.95, 0.18, 0.22],
  ]);
}

/** Tall open shelves against a wall, 1.2 m wide, 0.4 m deep, `h` high, their back at +Z. */
export function shelves(id: string, x: number, z: number, y: number, yaw = 0, h = 1.8): Piece[] {
  const boards: Part[] = [0.05, h * 0.36, h * 0.68, h - 0.04].map((b, i) => [`board-${i + 1}`, -0.6, 0.6, b - 0.03, b + 0.03, -0.2, 0.2]);
  return furniture(id, x, z, y, yaw, [
    ["side-1", -0.6, -0.56, 0, h, -0.2, 0.2],
    ["side-2", 0.56, 0.6, 0, h, -0.2, 0.2],
    ["back", -0.56, 0.56, 0, h, 0.17, 0.2],
    ...boards,
  ]);
}

/** A wardrobe against a wall, its back at +Z. */
export function wardrobe(id: string, x: number, z: number, y: number, yaw = 0): Piece[] {
  return furniture(id, x, z, y, yaw, [
    ["body", -0.55, 0.55, 0.08, 1.95, -0.3, 0.3],
    ["foot", -0.5, 0.5, 0, 0.08, -0.26, 0.26],
    ["cornice", -0.6, 0.6, 1.95, 2.02, -0.33, 0.33],
  ]);
}

/** A narrow iron bed with a grey blanket, its head at +Z. */
export function bed(id: string, x: number, z: number, y: number, yaw = 0): Piece[] {
  return furniture(id, x, z, y, yaw, [
    ...legs(0.9, 1.95, 0.3, 0.05).map(([n, x0, x1, y0, y1, z0, z1]): Part => [n, x0, x1, y0, y1, z0, z1, "iron"]),
    ["frame", -0.45, 0.45, 0.3, 0.36, -0.98, 0.98, "iron"],
    ["mattress", -0.42, 0.42, 0.36, 0.5, -0.95, 0.95, "cloth"],
    ["head", -0.45, 0.45, 0.3, 0.95, 0.95, 0.99, "iron"],
  ]);
}

/** A heavy workbench, 2 × 0.8 m, 0.9 m high. */
export function workbench(id: string, x: number, z: number, y: number, yaw = 0, lantern = false): Piece[] {
  return furniture(id, x, z, y, yaw, [
    ...legs(2, 0.8, 0.84, 0.09),
    ["shelf", -0.9, 0.9, 0.18, 0.22, -0.32, 0.32],
    [lantern ? "top-lantern" : "top", -1, 1, 0.84, 0.9, -0.4, 0.4],
  ]);
}
