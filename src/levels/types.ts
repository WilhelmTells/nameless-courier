// Level data: plain objects, built into meshes and colliders by game/world.ts.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Surface = "normal" | "trampoline" | "mud";

/** Moving obstacles come later; every piece is static for now. */
export type Motion = { kind: "none" };

export interface Piece {
  id: string;
  /**
   * box: `size` is the full extent. cylinder: `size.x` is the diameter,
   * `size.y` the height. ramp: a wedge over a `size.x` × `size.z` footprint,
   * rising to `size.y` towards -Z.
   */
  shape: "box" | "cylinder" | "ramp";
  /** Centre of the bounding box, m. */
  position: Vec3;
  /** Euler angles (XYZ order), degrees. */
  rotation: Vec3;
  size: Vec3;
  surface: Surface;
  motion: Motion;
  /** Look only. */
  material?: string;
}

export interface Level {
  id: string;
  name: string;
  start: Vec3;
  pieces: Piece[];
}
