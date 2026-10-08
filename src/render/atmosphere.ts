// Fog and wind (user): slow banks of mist drifting past the courier, and
// now and then a sheet of paper or a few leaves blowing by. The wind also
// tugs at the courier's cape, harder the higher they climb. Look only.

import * as THREE from "three";

/** Fixed pseudo-random numbers, so the weather starts the same every time. */
function random(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Where the wind blows (horizontal, unit). */
const WIND_DIR = new THREE.Vector3(-0.8, 0, 0.6).normalize();
const MIST_BANKS = 22;
/** Mist drifts in a box this big around the courier, m (half sizes). */
const MIST_BOX = { x: 32, y: 14, z: 32 };
const MIST_SPEED = 1.2;
/** Something blows past every this many seconds. */
const GUST_EVERY = [10, 22];
const DEBRIS_LIFE = 7;

/** Wind strength 0..1 at `time`: slow swells with gusts. */
export function windStrength(time: number): number {
  const swell = 0.5 + 0.5 * Math.sin(time * 0.21);
  const gust = Math.max(0, Math.sin(time * 0.73 + 1.3) * Math.sin(time * 0.31));
  return Math.min(1, 0.25 + 0.45 * swell + 0.6 * gust);
}

/** How far the wind pushes the cape's hem at `height`, in world space, m. */
export function capeWind(time: number, height: number, out: THREE.Vector3): THREE.Vector3 {
  const reach = 0.04 + 0.16 * Math.min(1, Math.max(0, height) / 120);
  const flutter = 0.85 + 0.15 * Math.sin(time * 7.3);
  return out.copy(WIND_DIR).multiplyScalar(windStrength(time) * reach * flutter);
}

/** A soft, uneven blot of mist, drawn once. */
function mistTexture(): THREE.Texture {
  const n = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const g = canvas.getContext("2d")!;
  const rnd = random(81);
  for (let i = 0; i < 14; i++) {
    const x = n * (0.25 + rnd() * 0.5), y = n * (0.3 + rnd() * 0.4), r = n * (0.15 + rnd() * 0.2);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, n, n);
  }
  return new THREE.CanvasTexture(canvas);
}

interface Debris {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
}

export function addAtmosphere(scene: THREE.Scene): (courier: THREE.Vector3, time: number, dt: number) => void {
  const rnd = random(303);
  const tex = mistTexture();
  const banks = Array.from({ length: MIST_BANKS }, () => {
    const mat = new THREE.SpriteMaterial({ map: tex, color: 0x8a93a3, transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(14 + rnd() * 14, 4 + rnd() * 4, 1);
    s.position.set((rnd() - 0.5) * 2 * MIST_BOX.x, (rnd() - 0.5) * 2 * MIST_BOX.y, (rnd() - 0.5) * 2 * MIST_BOX.z);
    scene.add(s);
    return { s, mat, peak: 0.06 + rnd() * 0.08, offset: s.position.clone() };
  });

  const paper = new THREE.MeshLambertMaterial({ color: 0xb9b2a0, side: THREE.DoubleSide });
  const leaf = new THREE.MeshLambertMaterial({ color: 0x4a4630, side: THREE.DoubleSide });
  const debris: Debris[] = [];
  let nextGust = 4;
  const drift = new THREE.Vector3();

  return (courier, time, dt) => {
    const wind = windStrength(time);
    drift.copy(WIND_DIR).multiplyScalar(MIST_SPEED * (0.6 + wind) * dt);
    for (const b of banks) {
      // Banks drift with the wind and wrap around the courier, so there are always some near.
      b.offset.add(drift);
      for (const axis of ["x", "y", "z"] as const) {
        const half = MIST_BOX[axis];
        if (b.offset[axis] > half) b.offset[axis] -= 2 * half;
        if (b.offset[axis] < -half) b.offset[axis] += 2 * half;
      }
      b.s.position.copy(courier).add(b.offset);
      // Thin near the courier and at the edge of the box, so nothing pops or blinds.
      const d = b.offset.length();
      const edge = Math.min(1, (MIST_BOX.x - Math.abs(b.offset.x)) / 6, (MIST_BOX.z - Math.abs(b.offset.z)) / 6, (MIST_BOX.y - Math.abs(b.offset.y)) / 4);
      b.mat.opacity = b.peak * Math.max(0, edge) * THREE.MathUtils.smoothstep(d, 4, 10);
    }

    // Now and then a sheet of paper or a few leaves blow past.
    if (time > nextGust) {
      nextGust = time + GUST_EVERY[0] + rnd() * (GUST_EVERY[1] - GUST_EVERY[0]);
      const isPaper = rnd() < 0.4;
      const count = isPaper ? 1 : 3 + Math.floor(rnd() * 3);
      // From upwind, passing the courier.
      const start = courier.clone().addScaledVector(WIND_DIR, -14).add(new THREE.Vector3((rnd() - 0.5) * 6, 1 + rnd() * 3, (rnd() - 0.5) * 6));
      for (let i = 0; i < count; i++) {
        const geo = isPaper ? new THREE.PlaneGeometry(0.22, 0.3) : new THREE.PlaneGeometry(0.07, 0.1);
        const mesh = new THREE.Mesh(geo, isPaper ? paper : leaf);
        mesh.position.copy(start).add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5));
        scene.add(mesh);
        debris.push({
          mesh,
          vel: WIND_DIR.clone().multiplyScalar(3.5 + rnd() * 2).setY(isPaper ? 0.3 : -0.1),
          spin: new THREE.Vector3(rnd() * 4, rnd() * 4, rnd() * 4),
          age: 0,
        });
      }
    }
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.age += dt;
      d.vel.y += Math.sin(time * 3 + i) * 0.8 * dt - 0.15 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      d.mesh.rotation.z += d.spin.z * dt;
      if (d.age > DEBRIS_LIFE) {
        scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        debris.splice(i, 1);
      }
    }
  };
}
