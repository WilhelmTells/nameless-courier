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

/**
 * A calm place where the courier can get off the pogo: a box region from
 * `min` to `max`. `min.y` is the surface; the region reaches up above it so
 * bounces stay inside.
 */
export interface RestSpot {
  id: string;
  min: Vec3;
  max: Vec3;
}

/** One stretch of the climb, kept in its own file. */
export interface Zone {
  id: string;
  name: string;
  start: Vec3;
  pieces: Piece[];
  restSpots: RestSpot[];
}

/** What the game builds and runs: one world, made of zones or standing alone. */
export interface Level extends Zone {
  /** The zones it is made of, in climbing order; empty for a test level. */
  zones: readonly Zone[];
}
