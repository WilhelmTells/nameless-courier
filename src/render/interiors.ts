// Small things in Zone 3's rooms and on the court roof (user: the floors
// were still empty): rugs, scattered papers, rubble, a puddle, picture
// frames on the walls and dead bulbs hanging from the ceilings. All flat or
// tiny and look only; the furniture itself is solid level data.

import * as THREE from "three";

/** Fixed pseudo-random numbers, so the clutter is the same every time. */
function random(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Floors and ceilings of Zone 3 (see levels/zone3.ts).
const F1 = 50, F2 = 56, F3 = 62, ROOF = 74;
const CEIL1 = 55.5, CEIL2 = 61.5, CEIL3 = 73.5;
/** Inner face of the left wall (x) and the back wall (z). */
const LEFT = -23, BACK = -59;

const LIFT = 0.012;

function rugTexture(): THREE.Texture {
  const n = 32;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const g = canvas.getContext("2d")!;
  const rnd = random(12);
  g.fillStyle = "#4a2a26";
  g.fillRect(0, 0, n, n);
  g.fillStyle = "#6a4a2e";
  g.fillRect(3, 3, n - 6, n - 6);
  g.fillStyle = "#3e2420";
  g.fillRect(6, 6, n - 12, n - 12);
  g.strokeStyle = "#7a5a36";
  g.strokeRect(10.5, 10.5, n - 21, n - 21);
  // Worn patches.
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(30,30,30,${0.2 + rnd() * 0.3})`;
    g.fillRect(Math.floor(rnd() * n), Math.floor(rnd() * n), 2, 1);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A dim, foggy picture: some hills, or a portrait gone dark. */
function pictureTexture(seed: number): THREE.Texture {
  const n = 16;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const g = canvas.getContext("2d")!;
  const rnd = random(seed);
  g.fillStyle = "#3a3c38";
  g.fillRect(0, 0, n, n);
  if (seed % 2 === 0) {
    g.fillStyle = "#56594c";
    for (let x = 0; x < n; x++) g.fillRect(x, 9 + Math.round(Math.sin(x * 0.6 + rnd()) * 2), 1, n);
  } else {
    g.fillStyle = "#2a2622";
    g.beginPath();
    g.ellipse(8, 7, 3, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(4, 11, 8, 5);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function addInteriors(scene: THREE.Scene): void {
  const rnd = random(4711);
  const rug = new THREE.MeshLambertMaterial({ map: rugTexture() });
  const paper = new THREE.MeshLambertMaterial({ color: 0xb4ad9c, side: THREE.DoubleSide });
  const rubble = new THREE.MeshLambertMaterial({ color: 0x5c5a56 });
  const puddle = new THREE.MeshPhongMaterial({ color: 0x15191d, specular: 0x6a7480, shininess: 90, transparent: true, opacity: 0.8 });
  const frameWood = new THREE.MeshLambertMaterial({ color: 0x2e2117 });
  const cord = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x8d8a80, transparent: true, opacity: 0.7 });

  const flat = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, turn = 0) => {
    const m = new THREE.Mesh(geo.rotateX(-Math.PI / 2), mat);
    m.position.set(x, y + LIFT, z);
    m.rotation.y = turn;
    scene.add(m);
  };
  const rugAt = (x: number, y: number, z: number, w: number, d: number, turn = 0) => flat(new THREE.PlaneGeometry(w, d), rug, x, y, z, turn);
  const papers = (x: number, y: number, z: number, count: number, spread: number) => {
    for (let i = 0; i < count; i++) {
      flat(new THREE.PlaneGeometry(0.21, 0.29), paper, x + (rnd() - 0.5) * spread, y + i * 0.001, z + (rnd() - 0.5) * spread, rnd() * Math.PI);
    }
  };
  const rubblePile = (x: number, y: number, z: number) => {
    for (let i = 0; i < 9; i++) {
      const s = 0.08 + rnd() * 0.18;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.7, s * 1.2), rubble);
      m.position.set(x + (rnd() - 0.5) * 1.2, y + s * 0.3, z + (rnd() - 0.5) * 1.2);
      m.rotation.set(rnd(), rnd() * 3, rnd());
      scene.add(m);
    }
  };
  const puddleAt = (x: number, y: number, z: number, r: number) => flat(new THREE.CircleGeometry(r, 10), puddle, x, y, z);
  /** A framed picture on a wall facing +X (left wall) or +Z (back wall). */
  const picture = (x: number, y: number, z: number, facing: "x" | "z", seed: number) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.04), frameWood));
    const img = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.42), new THREE.MeshLambertMaterial({ map: pictureTexture(seed) }));
    img.position.z = 0.025;
    g.add(img);
    g.position.set(x, y, z);
    // Hung a little crooked.
    g.rotation.set(0, facing === "x" ? Math.PI / 2 : 0, (rnd() - 0.5) * 0.12);
    scene.add(g);
  };
  /** A dead bulb on a cord from the ceiling. */
  const bulb = (x: number, ceiling: number, z: number, length: number) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, length, 4), cord);
    c.position.set(x, ceiling - length / 2, z);
    scene.add(c);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), glass);
    b.position.set(x, ceiling - length - 0.05, z);
    scene.add(b);
  };

  // Floor 1: a rug under the table, papers, rubble by the pipe, a puddle.
  rugAt(-13, F1, -34, 2.6, 1.9, 0.17);
  papers(-12, F1, -36.5, 5, 2.5);
  papers(-20, F1, -50, 4, 2);
  rubblePile(-7, F1, -47.5);
  puddleAt(-16, F1, -51, 0.9);
  picture(LEFT + 0.02, F1 + 1.9, -38, "x", 2);
  picture(LEFT + 0.02, F1 + 1.8, -42.5, "x", 3);
  bulb(-12.5, CEIL1, -35.5, 0.8);
  bulb(-5, CEIL1, -52, 0.6);

  // Floor 2: a rug by the bed, papers on the floor, a picture over the table.
  rugAt(-18, F2, -55.8, 1.6, 1.1, 0.05);
  papers(-10, F2, -51, 6, 3);
  picture(-11, F2 + 1.9, BACK + 0.02, "z", 4);
  picture(-3, F2 + 2, BACK + 0.02, "z", 5);
  rubblePile(5, F2, -47);
  bulb(-11, CEIL2, -50, 0.7);

  // Floor 3, the hall: papers by the bench, rubble, bulbs on long cords.
  papers(6, F3, -34, 6, 3);
  rubblePile(9, F3, -40);
  rubblePile(-5, F3, -31);
  puddleAt(4, F3, -47.5, 1.2);
  bulb(5, CEIL3, -40, 3.2);
  bulb(5, CEIL3, -54, 2.6);
  bulb(-6, CEIL3, -36, 3.6);

  // The court roof: papers and leaves blown into the west corner.
  papers(-20.5, ROOF, -46, 5, 3);
}
