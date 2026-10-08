// Rain (user): it rains all the time. Thin streaks fall round the camera,
// slanted by the same wind that drives the mist and the cape; they wrap
// round so there are always some near, and the fog swallows the rest.
// None fall inside the rooms. Look only; the sound is in audio/rain.ts.

import * as THREE from "three";
import type { Vec3 } from "../levels/types.ts";
import { WIND_DIR, windStrength } from "./atmosphere.ts";

type Room = { min: Vec3; max: Vec3 };

const DROPS = 2200;
/** Drops fall in a box this big round the camera, m (half sizes). */
const BOX = { x: 16, y: 12, z: 16 };
const FALL_SPEED = 15;
/** Sideways speed in full wind, m/s. */
const WIND_PUSH = 5;
/** A streak shows the drop's path over this long, s. */
const STREAK = 0.04;
const OPACITY = 0.32;

/** Fixed pseudo-random numbers, so the rain starts the same every time. */
function random(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** The update takes `calm` 0..1: the rain thins out at the summit. */
export function addRain(scene: THREE.Scene, rooms: readonly Room[]): (camera: THREE.Vector3, time: number, dt: number, calm: number) => void {
  const rnd = random(2024);
  const offsets = new Float32Array(DROPS * 3);
  const speeds = new Float32Array(DROPS);
  for (let i = 0; i < DROPS; i++) {
    offsets[i * 3] = (rnd() * 2 - 1) * BOX.x;
    offsets[i * 3 + 1] = (rnd() * 2 - 1) * BOX.y;
    offsets[i * 3 + 2] = (rnd() * 2 - 1) * BOX.z;
    speeds[i] = 0.85 + rnd() * 0.3;
  }
  const positions = new Float32Array(DROPS * 6);
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(positions, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position", attr);
  const material = new THREE.LineBasicMaterial({ color: 0xa4afc0, transparent: true, opacity: OPACITY, depthWrite: false });
  const lines = new THREE.LineSegments(geo, material);
  // It moves with the camera: never culled.
  lines.frustumCulled = false;
  scene.add(lines);

  const inside = (x: number, y: number, z: number) =>
    rooms.some((r) => x > r.min.x && x < r.max.x && y > r.min.y && y < r.max.y && z > r.min.z && z < r.max.z);

  return (camera, time, dt, calm) => {
    material.opacity = OPACITY * (1 - 0.9 * calm);
    lines.visible = calm < 0.99;
    const wind = windStrength(time) * WIND_PUSH;
    const vx = WIND_DIR.x * wind;
    const vz = WIND_DIR.z * wind;
    for (let i = 0; i < DROPS; i++) {
      const k = i * 3;
      const s = speeds[i];
      // Fall, and wrap round the camera on every axis.
      offsets[k] += vx * s * dt;
      offsets[k + 1] -= FALL_SPEED * s * dt;
      offsets[k + 2] += vz * s * dt;
      if (offsets[k + 1] < -BOX.y) offsets[k + 1] += 2 * BOX.y;
      if (offsets[k] > BOX.x) offsets[k] -= 2 * BOX.x;
      if (offsets[k] < -BOX.x) offsets[k] += 2 * BOX.x;
      if (offsets[k + 2] > BOX.z) offsets[k + 2] -= 2 * BOX.z;
      if (offsets[k + 2] < -BOX.z) offsets[k + 2] += 2 * BOX.z;
      const x = camera.x + offsets[k];
      const y = camera.y + offsets[k + 1];
      const z = camera.z + offsets[k + 2];
      const p = i * 6;
      const len = STREAK * s;
      // Indoors (either end of the streak) the drop is put far below, lost in the fog.
      const drop = inside(x, y, z) || inside(x - vx * len, y + FALL_SPEED * len, z - vz * len) ? -1000 : 0;
      positions[p] = x;
      positions[p + 1] = y + drop;
      positions[p + 2] = z;
      positions[p + 3] = x - vx * len;
      positions[p + 4] = y + drop + FALL_SPEED * len;
      positions[p + 5] = z - vz * len;
    }
    attr.needsUpdate = true;
  };
}
