// Small signs of night (user): moths circling every burning lantern, and
// now and then a silent flash of lightning far off over the skyline. Look
// only.

import * as THREE from "three";
import { litLanterns } from "./lantern.ts";

/** Fixed pseudo-random numbers. */
function random(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const MOTHS_PER_LANTERN = 3;
/** Seconds between flashes of lightning. */
const LIGHTNING_EVERY = [45, 110];
/** A flash: two quick strokes, then a fade, s. */
const STROKES = [
  { at: 0, length: 0.07 },
  { at: 0.16, length: 0.22 },
];

export function addNightLife(
  scene: THREE.Scene,
  sky: THREE.HemisphereLight,
  fog: THREE.Color,
): (time: number) => void {
  const rnd = random(1919);

  // Moths: pale flecks on erratic loops round each lantern's flame.
  const centres: THREE.Vector3[] = [];
  const moths: { centre: number; r: number; speed: number; phase: number; tilt: number }[] = [];
  let positions = new Float32Array(0);
  const geo = new THREE.BufferGeometry();
  const flecks = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd9ceb2, size: 0.045, transparent: true, opacity: 0.9 }));
  flecks.frustumCulled = false;
  scene.add(flecks);
  let placed = false;

  // Lightning: the sky light and the fog flare up for a moment.
  const baseSky = sky.intensity;
  const baseFog = fog.clone();
  const flashFog = new THREE.Color(0x4a5466);
  let nextFlash = LIGHTNING_EVERY[0] * 0.5 + rnd() * 30;
  let flashStart = -1;

  return (time) => {
    if (!placed) {
      // Lanterns are placed once the scene is built; take their flames' positions then.
      for (const l of litLanterns) {
        l.updateWorldMatrix(true, false);
        centres.push(new THREE.Vector3(0, 0.12, 0).applyMatrix4(l.matrixWorld));
      }
      centres.forEach((_, c) => {
        for (let k = 0; k < MOTHS_PER_LANTERN; k++) moths.push({ centre: c, r: 0.25 + rnd() * 0.35, speed: 2 + rnd() * 3, phase: rnd() * 10, tilt: rnd() * 2 });
      });
      positions = new Float32Array(moths.length * 3);
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      placed = true;
    }
    moths.forEach((m, i) => {
      const c = centres[m.centre];
      const t = time * m.speed + m.phase;
      positions[i * 3] = c.x + Math.cos(t) * m.r + Math.sin(t * 2.7) * 0.08;
      positions[i * 3 + 1] = c.y + Math.sin(t * 1.3 + m.tilt) * 0.25;
      positions[i * 3 + 2] = c.z + Math.sin(t) * m.r + Math.cos(t * 3.1) * 0.08;
    });
    geo.attributes.position.needsUpdate = true;

    if (flashStart < 0 && time > nextFlash) flashStart = time;
    let flare = 0;
    if (flashStart >= 0) {
      const t = time - flashStart;
      for (const s of STROKES) if (t >= s.at && t < s.at + s.length) flare = Math.max(flare, 1 - (t - s.at) / s.length);
      if (t > 0.6) {
        flashStart = -1;
        nextFlash = time + LIGHTNING_EVERY[0] + rnd() * (LIGHTNING_EVERY[1] - LIGHTNING_EVERY[0]);
      }
    }
    sky.intensity = baseSky * (1 + flare * 1.6);
    fog.copy(baseFog).lerp(flashFog, flare);
  };
}
