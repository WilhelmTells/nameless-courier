// Builds meshes and colliders from level data.

import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { poseAt, velocityAt, type Pose } from "../core/motionCore.ts";
import type { Vec3 } from "../core/pogoCore.ts";
import type { Level, Piece, Surface } from "../levels/types.ts";
import type { LevelInfo } from "./pogo.ts";

const PIECE_COLOR = 0x8a8a8d;
/** Lighter edges keep platform borders readable. */
const EDGE_COLOR = 0xc8c8c4;
/** Surfaces read at a glance: a pale taut tarp with a bright trim, near-black glossy mud. */
const SURFACE_LOOK: Record<Surface, { color: number; edge: number }> = {
  normal: { color: PIECE_COLOR, edge: EDGE_COLOR },
  trampoline: { color: 0xd9c9a3, edge: 0xffb340 },
  mud: { color: 0x26221e, edge: 0x5a5046 },
};
/** Rest spots: a pale outline with a faint fill on the surface. */
const REST_COLOR = 0xe8e2c8;
/** Lift above the surface so the mark does not flicker against it, m. */
const REST_LIFT = 0.01;
/** Gap between the outline and the edge of the spot, m. */
const REST_INSET = 0.15;

/** Wedge corners around the centre: low edge at +Z, high edge at -Z. */
function rampPoints(hx: number, hy: number, hz: number): number[] {
  return [
    -hx, -hy, hz, hx, -hy, hz, -hx, -hy, -hz, hx, -hy, -hz, // bottom
    -hx, hy, -hz, hx, hy, -hz, // top edge
  ];
}

function rampGeometry(hx: number, hy: number, hz: number): THREE.BufferGeometry {
  const p = rampPoints(hx, hy, hz);
  const v = (i: number) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
  // Corners: 0 low-left, 1 low-right, 2 back-left, 3 back-right, 4 top-left, 5 top-right.
  const tris = [
    [0, 2, 1], [1, 2, 3], // bottom
    [0, 1, 5], [0, 5, 4], // slope
    [2, 4, 5], [2, 5, 3], // back
    [0, 4, 2], // left side
    [1, 3, 5], // right side
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(tris.flat().flatMap(v), 3));
  geo.computeVertexNormals();
  return geo;
}

function geometryFor(piece: Piece): THREE.BufferGeometry {
  const { x, y, z } = piece.size;
  switch (piece.shape) {
    case "box":
      return new THREE.BoxGeometry(x, y, z);
    case "cylinder":
      return new THREE.CylinderGeometry(x / 2, x / 2, y, 16);
    case "ramp":
      return rampGeometry(x / 2, y / 2, z / 2);
  }
}

function colliderFor(piece: Piece): RAPIER.ColliderDesc {
  const { x, y, z } = piece.size;
  switch (piece.shape) {
    case "box":
      return RAPIER.ColliderDesc.cuboid(x / 2, y / 2, z / 2);
    case "cylinder":
      return RAPIER.ColliderDesc.cylinder(y / 2, x / 2);
    case "ramp":
      return RAPIER.ColliderDesc.convexHull(new Float32Array(rampPoints(x / 2, y / 2, z / 2)))!;
  }
}

/** Marks every rest spot of `level` on its surface: an outline and a faint fill. */
function markRestSpots(level: Level, scene: THREE.Scene): void {
  const line = new THREE.LineBasicMaterial({ color: REST_COLOR });
  const fill = new THREE.MeshBasicMaterial({ color: REST_COLOR, transparent: true, opacity: 0.12, depthWrite: false });
  for (const s of level.restSpots) {
    const w = s.max.x - s.min.x - 2 * REST_INSET;
    const d = s.max.z - s.min.z - 2 * REST_INSET;
    const plane = new THREE.PlaneGeometry(w, d);
    plane.rotateX(-Math.PI / 2);
    const mark = new THREE.Mesh(plane, fill);
    mark.add(new THREE.LineSegments(new THREE.EdgesGeometry(plane), line));
    mark.position.set((s.min.x + s.max.x) / 2, s.min.y + REST_LIFT, (s.min.z + s.max.z) / 2);
    scene.add(mark);
  }
}

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

/** A piece that moves: its kinematic body follows the motion, its mesh is drawn between steps. */
interface Mover {
  piece: Piece;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh: THREE.Object3D;
  /** The piece's own rotation, before its motion turns it. */
  rest: THREE.Quaternion;
}

/**
 * The built level: what the pogo needs to know about its pieces, and the
 * moving ones. Movers are a pure function of the run clock (`time`).
 */
export class LevelWorld implements LevelInfo {
  /** Run time the movers' colliders are posed at, s. */
  time = 0;
  readonly movers: Mover[] = [];
  private pieces = new Map<number, Piece>();
  private turn = new THREE.Quaternion();

  add(collider: RAPIER.Collider, piece: Piece): void {
    this.pieces.set(collider.handle, piece);
  }

  addMover(mover: Mover): void {
    this.movers.push(mover);
    this.add(mover.collider, mover.piece);
  }

  /** The piece a collider belongs to; undefined for the ground. */
  pieceOf(collider: RAPIER.Collider): Piece | undefined {
    return this.pieces.get(collider.handle);
  }

  surfaceOf(collider: RAPIER.Collider): Surface {
    return this.pieceOf(collider)?.surface ?? "normal";
  }

  /** Velocity of the piece at `point`, at the current time; zero for still pieces, m/s. */
  velocityAt(collider: RAPIER.Collider, point: Vec3): Vec3 {
    const piece = this.pieces.get(collider.handle);
    return piece ? velocityAt(piece.motion, piece.position, this.time, point) : ZERO;
  }

  isMover(collider: RAPIER.Collider): boolean {
    const piece = this.pieces.get(collider.handle);
    return piece !== undefined && piece.motion.kind !== "none";
  }

  /** Moves every mover's collider to time `t` now (start, reload, new run). Takes effect after the next physics step. */
  place(t: number): void {
    this.time = t;
    for (const m of this.movers) {
      const { position, rotation } = this.bodyPose(m, poseAt(m.piece.motion, m.piece.position, t));
      m.body.setTranslation(position, false);
      m.body.setRotation(rotation, false);
      m.body.setNextKinematicTranslation(position);
      m.body.setNextKinematicRotation(rotation);
    }
  }

  /** Sets every mover's pose for time `t`; the next physics step moves them there. */
  advance(t: number): void {
    this.time = t;
    for (const m of this.movers) {
      const { position, rotation } = this.bodyPose(m, poseAt(m.piece.motion, m.piece.position, t));
      m.body.setNextKinematicTranslation(position);
      m.body.setNextKinematicRotation(rotation);
    }
  }

  /** Poses the movers' meshes for drawing at run time `t`. */
  render(t: number): void {
    for (const m of this.movers) {
      const pose = poseAt(m.piece.motion, m.piece.position, t);
      m.mesh.position.set(pose.position.x, pose.position.y, pose.position.z);
      m.mesh.quaternion.set(pose.turn.x, pose.turn.y, pose.turn.z, pose.turn.w).multiply(m.rest);
    }
  }

  private bodyPose(m: Mover, pose: Pose): { position: Vec3; rotation: RAPIER.Rotation } {
    const q = this.turn.set(pose.turn.x, pose.turn.y, pose.turn.z, pose.turn.w).multiply(m.rest);
    return { position: pose.position, rotation: { x: q.x, y: q.y, z: q.z, w: q.w } };
  }
}

/** Adds every piece of `level` to the scene and the physics world. */
export function buildLevel(level: Level, scene: THREE.Scene, physics: RAPIER.World): LevelWorld {
  const looks = new Map<Surface, { mesh: THREE.Material; edge: THREE.Material }>();
  const lookFor = (surface: Surface) => {
    let look = looks.get(surface);
    if (!look) {
      const { color, edge } = SURFACE_LOOK[surface];
      look = {
        mesh: surface === "mud" ? new THREE.MeshPhongMaterial({ color, shininess: 80, specular: 0x6a6258 }) : new THREE.MeshLambertMaterial({ color }),
        edge: new THREE.LineBasicMaterial({ color: edge }),
      };
      looks.set(surface, look);
    }
    return look;
  };
  const DEG = Math.PI / 180;
  const built = new LevelWorld();

  for (const piece of level.pieces) {
    const look = lookFor(piece.surface);
    const geo = geometryFor(piece);
    const mesh = new THREE.Mesh(geo, look.mesh);
    mesh.position.set(piece.position.x, piece.position.y, piece.position.z);
    mesh.rotation.set(piece.rotation.x * DEG, piece.rotation.y * DEG, piece.rotation.z * DEG);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), look.edge));
    scene.add(mesh);

    const q = mesh.quaternion;
    if (piece.motion.kind === "none") {
      const collider = physics.createCollider(
        colliderFor(piece)
          .setTranslation(piece.position.x, piece.position.y, piece.position.z)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      );
      built.add(collider, piece);
    } else {
      const body = physics.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      const collider = physics.createCollider(colliderFor(piece), body);
      built.addMover({ piece, body, collider, mesh, rest: q.clone() });
    }
  }
  markRestSpots(level, scene);
  built.place(0);
  built.render(0);
  return built;
}
