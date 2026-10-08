// The courier and the staff, built from primitives (concept art: navy
// half-cape, cap over a face in shadow, leather bag at the side, an iron
// staff with brass rings and a spring). The group's origin is the tip of
// the staff, and its local Y axis is the staff's axis. The rider faces -Z.

import * as THREE from "three";

const PARCEL_COLOR = 0xd9772b; // faded signal orange, used on nothing else: the bag's label

/** Standing pose: the rider steps down off the pegs and beside the staff, holding it. */
const STAND_OFFSET = new THREE.Vector3(-0.35, -0.31, 0);

/** The rider stands just behind the shaft. */
const RIDER_Z = 0.1;

/** Cape: from the shoulders down the back, across this angle either side of straight back, radians. */
const CAPE_SPREAD = (80 * Math.PI) / 180;
const CAPE_TOP = 1.46;
const CAPE_COLUMNS = 11;
const CAPE_ROWS = 6;
/** Length of each column of the cape, m: the ragged hem. */
const CAPE_LENGTHS = [0.5, 0.66, 0.58, 0.74, 0.6, 0.7, 0.56, 0.76, 0.6, 0.68, 0.52];

export interface PogoRig {
  group: THREE.Group;
  /** Blends the rider from riding (0) to standing beside the staff (1). */
  setStand(amount: number): void;
  /**
   * Moves the cape's hem by `trail` (rig space, m), the swing of the hem
   * against the body; `time` and `speed` (m/s) make the ragged edge flutter.
   */
  setCape(trail: THREE.Vector3, time: number, speed: number): void;
}

export function createPogoRig(): PogoRig {
  const group = new THREE.Group();
  const rider = new THREE.Group();
  group.add(rider);

  const iron = new THREE.MeshLambertMaterial({ color: 0x2a2c30 });
  const brass = new THREE.MeshLambertMaterial({ color: 0x9a7a44 });
  const coat = new THREE.MeshLambertMaterial({ color: 0x1f2436 });
  const capeCloth = new THREE.MeshLambertMaterial({ color: 0x2a3250, side: THREE.DoubleSide, flatShading: true });
  const trousers = new THREE.MeshLambertMaterial({ color: 0x2b2826 });
  const boots = new THREE.MeshLambertMaterial({ color: 0x17140f });
  const shadow = new THREE.MeshLambertMaterial({ color: 0x0f0f12 });
  const leather = new THREE.MeshLambertMaterial({ color: 0x5a3a22 });
  const darkLeather = new THREE.MeshLambertMaterial({ color: 0x3a2516 });
  const label = new THREE.MeshLambertMaterial({ color: PARCEL_COLOR });

  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // Staff: iron tip, a brass spring, the iron shaft with brass rings, foot
  // pegs, the grip, and a brass knob on top.
  add(group, new THREE.ConeGeometry(0.03, 0.08, 8).rotateX(Math.PI), iron, 0, 0.04, 0);
  // The spring: seven turns, 12 points a turn.
  const coil = Array.from({ length: 85 }, (_, i) => {
    const t = i / 84;
    const a = t * Math.PI * 2 * 7;
    return new THREE.Vector3(Math.cos(a) * 0.042, 0.08 + t * 0.26, Math.sin(a) * 0.042);
  });
  add(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 84, 0.008, 4), brass, 0, 0, 0);
  add(group, new THREE.CylinderGeometry(0.014, 0.014, 0.3, 6), iron, 0, 0.21, 0);
  add(group, new THREE.CylinderGeometry(0.022, 0.022, 1.18, 8), iron, 0, 0.93, 0);
  for (const y of [0.35, 0.62, 0.98]) add(group, new THREE.CylinderGeometry(0.03, 0.03, 0.035, 8), brass, 0, y, 0);
  add(group, new THREE.BoxGeometry(0.4, 0.025, 0.06), iron, 0, 0.35, 0.03);
  add(group, new THREE.BoxGeometry(0.44, 0.03, 0.03), iron, 0, 1.25, 0);
  for (const x of [-0.24, 0.24]) add(group, new THREE.CylinderGeometry(0.02, 0.02, 0.06, 6).rotateZ(Math.PI / 2), brass, x, 1.25, 0);
  add(group, new THREE.SphereGeometry(0.04, 8, 6), brass, 0, 1.54, 0);

  // Rider: boots on the pegs, trousers, coat, a head in shadow under the cap.
  for (const x of [-0.1, 0.1]) {
    add(rider, new THREE.BoxGeometry(0.12, 0.22, 0.2), boots, x, 0.47, RIDER_Z - 0.02);
    add(rider, new THREE.CapsuleGeometry(0.085, 0.3, 4, 8), trousers, x, 0.74, RIDER_Z);
  }
  add(rider, new THREE.CapsuleGeometry(0.19, 0.36, 4, 10), coat, 0, 1.2, RIDER_Z);
  add(rider, new THREE.CylinderGeometry(0.11, 0.15, 0.12, 8), coat, 0, 1.47, RIDER_Z);
  add(rider, new THREE.SphereGeometry(0.12, 10, 8), shadow, 0, 1.62, RIDER_Z);
  // Cap: a crown, a band and a peak over the face.
  add(rider, new THREE.CylinderGeometry(0.15, 0.13, 0.09, 10), coat, 0, 1.74, RIDER_Z + 0.01);
  add(rider, new THREE.CylinderGeometry(0.132, 0.132, 0.03, 10), shadow, 0, 1.695, RIDER_Z + 0.01);
  const peak = add(rider, new THREE.CylinderGeometry(0.13, 0.13, 0.015, 10, 1, false, Math.PI / 2, Math.PI), shadow, 0, 1.69, RIDER_Z - 0.04);
  peak.rotation.x = -0.15;

  // Bag at the left hip (the rider's left is -X), the strap across the chest,
  // and the orange label on its outer side and back.
  const bag = new THREE.Group();
  bag.position.set(-0.29, 0.98, RIDER_Z - 0.06);
  rider.add(bag);
  add(bag, new THREE.BoxGeometry(0.09, 0.22, 0.28), leather, 0, 0, 0);
  add(bag, new THREE.BoxGeometry(0.1, 0.1, 0.29), darkLeather, -0.005, 0.07, 0);
  add(bag, new THREE.BoxGeometry(0.012, 0.06, 0.1), label, -0.05, -0.04, 0.04);
  add(bag, new THREE.BoxGeometry(0.06, 0.06, 0.012), label, -0.02, -0.04, 0.142);
  const strap = add(rider, new THREE.BoxGeometry(0.04, 0.72, 0.015), darkLeather, -0.06, 1.24, RIDER_Z - 0.19);
  strap.rotation.z = -0.62;

  // Cape: a grid of columns hanging from the shoulders, ragged at the hem.
  const base: number[] = [];
  const index: number[] = [];
  for (let r = 0; r < CAPE_ROWS; r++) {
    const f = r / (CAPE_ROWS - 1);
    for (let c = 0; c < CAPE_COLUMNS; c++) {
      const a = -CAPE_SPREAD + (2 * CAPE_SPREAD * c) / (CAPE_COLUMNS - 1);
      const radius = 0.17 + 0.15 * f;
      base.push(Math.sin(a) * radius, CAPE_TOP - CAPE_LENGTHS[c] * f, RIDER_Z + Math.cos(a) * radius);
    }
  }
  for (let r = 0; r < CAPE_ROWS - 1; r++) {
    for (let c = 0; c < CAPE_COLUMNS - 1; c++) {
      const i = r * CAPE_COLUMNS + c;
      index.push(i, i + CAPE_COLUMNS, i + 1, i + 1, i + CAPE_COLUMNS, i + CAPE_COLUMNS + 1);
    }
  }
  const capeGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(base);
  capeGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  capeGeo.setIndex(index);
  const cape = new THREE.Mesh(capeGeo, capeCloth);
  cape.frustumCulled = false;
  rider.add(cape);

  return {
    group,
    setStand(amount) {
      const t = amount * amount * (3 - 2 * amount); // smoothstep
      rider.position.copy(STAND_OFFSET).multiplyScalar(t);
    },
    setCape(trail, time, speed) {
      // The hem never swings into the body: forward swings are mostly held back.
      const tx = trail.x;
      const ty = trail.y;
      const tz = trail.z < 0 ? trail.z * 0.25 : trail.z;
      const flutter = Math.min(1, speed / 6) * 0.05;
      for (let r = 0; r < CAPE_ROWS; r++) {
        const f = r / (CAPE_ROWS - 1);
        const w = f * f;
        for (let c = 0; c < CAPE_COLUMNS; c++) {
          const i = (r * CAPE_COLUMNS + c) * 3;
          const wave = Math.sin(time * 11 + c * 1.7 + r * 0.9) * flutter * w;
          positions[i] = base[i] + tx * w + wave * 0.5;
          positions[i + 1] = base[i + 1] + ty * w + Math.abs(wave) * 0.4;
          positions[i + 2] = base[i + 2] + tz * w + wave;
        }
      }
      capeGeo.attributes.position.needsUpdate = true;
    },
  };
}
