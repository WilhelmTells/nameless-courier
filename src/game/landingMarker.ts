// Landing marker and blob shadow, projected onto the first surface directly
// below the tip. The marker ignores fog so it always reads clearly.

import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { markerScale } from "../core/cameraCore.ts";
import { SHARP_LAYER } from "../render/retroPass.ts";

const MAX_PROBE = 1000; // m
const RAY_START = 0.05; // start the ray slightly above the tip, m
const Z_AXIS = new THREE.Vector3(0, 0, 1);

export class LandingMarker {
  readonly group = new THREE.Group();
  private readonly marker = new THREE.Group();
  private readonly shadow: THREE.Mesh;
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private readonly world: RAPIER.World;
  private readonly ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  private readonly normal = new THREE.Vector3();

  constructor(world: RAPIER.World) {
    this.world = world;

    const flat = (color: number, order: number) =>
      new THREE.MeshBasicMaterial({
        color,
        fog: false,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -order,
        polygonOffsetUnits: -order,
      });

    // Bright ring with a dark border and a centre dot: readable on any surface.
    const parts: [THREE.BufferGeometry, number, number][] = [
      [new THREE.RingGeometry(0.17, 0.3, 40), 0x0c0c0c, 2],
      [new THREE.RingGeometry(0.2, 0.27, 40), 0xf4f2ec, 3],
      [new THREE.CircleGeometry(0.04, 16), 0xf4f2ec, 3],
    ];
    for (const [geo, color, order] of parts) {
      const m = new THREE.Mesh(geo, flat(color, order));
      m.renderOrder = 10 + order;
      // Drawn at full resolution, over the low-resolution scene (§6 readability).
      m.layers.set(SHARP_LAYER);
      this.marker.add(m);
    }

    this.shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), this.shadowMat);
    this.shadow.renderOrder = 5;

    this.group.add(this.shadow, this.marker);
  }

  /** Height of the surface below the tip after the last update, or null if none. */
  groundY: number | null = null;

  update(tip: THREE.Vector3): void {
    this.ray.origin = { x: tip.x, y: tip.y + RAY_START, z: tip.z };
    const hit = this.world.castRayAndGetNormal(this.ray, MAX_PROBE, true);
    this.group.visible = hit !== null;
    this.groundY = hit ? tip.y + RAY_START - hit.timeOfImpact : null;
    if (!hit) return;

    const height = Math.max(0, hit.timeOfImpact - RAY_START);
    this.normal.set(hit.normal.x, hit.normal.y, hit.normal.z);
    this.group.position.set(tip.x, tip.y + RAY_START - hit.timeOfImpact, tip.z).addScaledVector(this.normal, 0.01);
    this.group.quaternion.setFromUnitVectors(Z_AXIS, this.normal);

    this.marker.scale.setScalar(markerScale(height));
    // The shadow spreads and fades with height.
    this.shadow.scale.setScalar(1 + height * 0.05);
    this.shadowMat.opacity = 0.45 / (1 + height * 0.25);
  }
}
