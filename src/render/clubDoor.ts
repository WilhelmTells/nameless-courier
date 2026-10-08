// The sealed door on Zone 3's floor 1 (§7): the club is behind it. Light
// leaks round its edges and spills under it onto the floor, pulsing faintly
// with the kick. Look only.

import * as THREE from "three";
import { alphaTexture } from "./lantern.ts";

/** The door (see levels/zone3.ts): in the left wall, its face at x = -22.8. */
const WALL = -23;
const DOOR = { x1: -22.8, y0: 50, y1: 52.6, z0: -50, z1: -48.4 };
const GAP = 0.04;
const COLOR = new THREE.Color(0xb27cff);

export function addClubDoor(scene: THREE.Scene): (pulse: number) => void {
  const leak = new THREE.MeshBasicMaterial({ color: COLOR.clone() });
  const strip = (y0: number, y1: number, z0: number, z1: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, y1 - y0), leak);
    m.rotation.y = Math.PI / 2;
    m.position.set(WALL + 0.005, (y0 + y1) / 2, (z0 + z1) / 2);
    scene.add(m);
  };
  strip(DOOR.y0, DOOR.y1 + GAP, DOOR.z0 - GAP, DOOR.z0);
  strip(DOOR.y0, DOOR.y1 + GAP, DOOR.z1, DOOR.z1 + GAP);
  strip(DOOR.y1, DOOR.y1 + GAP, DOOR.z0 - GAP, DOOR.z1 + GAP);

  // Under the door: a thin bright line and a soft spill across the floor.
  const sill = new THREE.Mesh(new THREE.PlaneGeometry(0.05, DOOR.z1 - DOOR.z0).rotateX(-Math.PI / 2), leak);
  sill.position.set(DOOR.x1 + 0.025, DOOR.y0 + 0.006, (DOOR.z0 + DOOR.z1) / 2);
  scene.add(sill);
  const spillMat = new THREE.MeshBasicMaterial({
    color: COLOR.clone(),
    // Bright at the door, fading out into the room and towards the sides.
    map: alphaTexture(32, (x, y) => (1 - x) ** 2 * Math.sin(Math.PI * y) ** 0.7),
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(1.4, DOOR.z1 - DOOR.z0 + 0.6).rotateX(-Math.PI / 2), spillMat);
  spill.position.set(DOOR.x1 + 0.7, DOOR.y0 + 0.008, (DOOR.z0 + DOOR.z1) / 2);
  scene.add(spill);

  return (pulse) => {
    const k = 0.5 + 0.5 * pulse;
    leak.color.copy(COLOR).multiplyScalar(k);
    spillMat.opacity = 0.45 + 0.4 * pulse;
  };
}
