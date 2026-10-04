// Builds meshes and fixed colliders from level data.

import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { Level, Piece } from "../levels/types.ts";

const PIECE_COLOR = 0x8a8a8d;
/** Lighter edges keep platform borders readable. */
const EDGE_COLOR = 0xc8c8c4;
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

/** Adds every piece of `level` to the scene and the physics world. */
export function buildLevel(level: Level, scene: THREE.Scene, physics: RAPIER.World): void {
  const material = new THREE.MeshLambertMaterial({ color: PIECE_COLOR });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: EDGE_COLOR });
  const DEG = Math.PI / 180;

  for (const piece of level.pieces) {
    const geo = geometryFor(piece);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(piece.position.x, piece.position.y, piece.position.z);
    mesh.rotation.set(piece.rotation.x * DEG, piece.rotation.y * DEG, piece.rotation.z * DEG);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMaterial));
    scene.add(mesh);

    const q = mesh.quaternion;
    physics.createCollider(
      colliderFor(piece)
        .setTranslation(piece.position.x, piece.position.y, piece.position.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    );
  }
  markRestSpots(level, scene);
}
