// Set dressing on the tall walls (user, concept art): rusty drain pipes,
// broken pipes sticking out (a few with water running from them), ivy
// hanging from the tops and sills, and cracks. Look only, no colliders.
// Rules (§6): nothing reads as a ledge (pipes are round and short), ivy
// hangs below landing edges and never covers their trim, and only a few
// streams run, near rest spots.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Level, Piece } from "../levels/types.ts";

/** Fixed pseudo-random numbers, so the dressing is the same every time. */
function random(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, rnd: () => number) => void, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d")!, random(seed));
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Rust: dark brown with orange-brown flecks, never the parcel's orange. */
function rustTexture(): THREE.Texture {
  const t = canvasTexture(32, (g, rnd) => {
    g.fillStyle = "#4a2c1c";
    g.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 160; i++) {
      const v = rnd();
      g.fillStyle = v < 0.5 ? "#6b3b22" : v < 0.8 ? "#2e1c12" : "#7a5236";
      g.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 1 + Math.floor(rnd() * 2), 1);
    }
  }, 21);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Ivy: clusters of small leaves, cut out against transparency, muted grey-green. */
function ivyTexture(): THREE.Texture {
  return canvasTexture(64, (g, rnd) => {
    const greens = ["#3c4a32", "#4a5a3a", "#2f3a28", "#56653f"];
    // Denser at the top, thinning out at the bottom.
    for (let i = 0; i < 420; i++) {
      const y = Math.pow(rnd(), 1.6) * 62;
      const x = 2 + rnd() * 60;
      if (rnd() > 1 - y / 90) continue;
      g.fillStyle = greens[Math.floor(rnd() * greens.length)];
      g.beginPath();
      g.ellipse(x, y, 1.5 + rnd() * 1.5, 1 + rnd(), rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  }, 31);
}

/** Cracks: dark jagged lines branching out from one corner. */
function crackTexture(): THREE.Texture {
  return canvasTexture(64, (g, rnd) => {
    g.strokeStyle = "rgba(18,18,20,0.85)";
    g.lineCap = "square";
    const branch = (x: number, y: number, a: number, len: number, width: number) => {
      if (len < 3 || width < 0.5) return;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(x, y);
      let px = x, py = y;
      for (let i = 0; i < len; i += 3) {
        a += (rnd() - 0.5) * 0.9;
        px += Math.cos(a) * 3;
        py += Math.sin(a) * 3;
        g.lineTo(px, py);
        if (rnd() < 0.18) branch(px, py, a + (rnd() < 0.5 ? 0.8 : -0.8), len * 0.5, width * 0.7);
      }
      g.stroke();
    };
    branch(2, 2, Math.PI / 4, 70, 2);
    branch(4, 2, Math.PI / 3, 40, 1.4);
  }, 41);
}

/** Water: pale streaks with gaps, scrolled downward. */
function waterTexture(): THREE.Texture {
  const t = canvasTexture(16, (g, rnd) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const a = rnd() < 0.55 ? 0.35 + rnd() * 0.5 : 0;
        g.fillStyle = `rgba(210,222,230,${a})`;
        g.fillRect(x, y, 1, 1);
      }
    }
  }, 51);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const isPlainBox = (p: Piece) =>
  p.shape === "box" && p.motion.kind === "none" && p.rotation.x === 0 && p.rotation.y === 0 && p.rotation.z === 0;

/** Walls shorter or narrower than this get no dressing, m. */
const MIN_WALL = 6;
/** Water only runs within this distance of a rest spot, m. */
const WATER_NEAR_REST = 18;
const MAX_STREAMS = 8;

/** Adds the dressing to `scene`; returns the update that runs the water. */
export function addDressing(level: Level, scene: THREE.Scene): (time: number) => void {
  const rust = new THREE.MeshLambertMaterial({ map: rustTexture() });
  const ivy = new THREE.MeshLambertMaterial({ map: ivyTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
  const crack = new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const stain = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const waterMap = waterTexture();
  const water = new THREE.MeshBasicMaterial({ map: waterMap, transparent: true, depthWrite: false, side: THREE.DoubleSide });

  const pipes: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];
  const cracks: THREE.BufferGeometry[] = [];
  const stains: THREE.BufferGeometry[] = [];
  const streams: THREE.BufferGeometry[] = [];
  const splashes: THREE.Vector3[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const boxes = level.pieces.filter(isPlainBox);

  /** Height of the highest surface below `p`, or the ground. */
  const floorBelow = (p: THREE.Vector3) => {
    let best = 0;
    for (const b of level.pieces) {
      const top = b.position.y + b.size.y / 2;
      if (top >= p.y || top <= best) continue;
      if (Math.abs(p.x - b.position.x) <= b.size.x / 2 && Math.abs(p.z - b.position.z) <= b.size.z / 2) best = top;
    }
    return best;
  };
  const nearRest = (p: THREE.Vector3) =>
    level.restSpots.some((r) => {
      const cx = (r.min.x + r.max.x) / 2, cz = (r.min.z + r.max.z) / 2;
      return Math.hypot(p.x - cx, p.z - cz) < WATER_NEAR_REST && Math.abs(p.y - r.min.y) < 12;
    });

  for (const piece of boxes) {
    if (piece.size.y < MIN_WALL) continue;
    const rnd = random(hash(piece.id) + 7);
    const x0 = piece.position.x - piece.size.x / 2, x1 = piece.position.x + piece.size.x / 2;
    const z0 = piece.position.z - piece.size.z / 2, z1 = piece.position.z + piece.size.z / 2;
    const y0 = piece.position.y - piece.size.y / 2, y1 = piece.position.y + piece.size.y / 2;
    const high = y1 > 100;
    const walls = [
      { yaw: Math.PI / 2, x: x1, z: null, from: z0, to: z1 },
      { yaw: -Math.PI / 2, x: x0, z: null, from: z0, to: z1 },
      { yaw: 0, x: null, z: z1, from: x0, to: x1 },
      { yaw: Math.PI, x: null, z: z0, from: x0, to: x1 },
    ];
    for (const w of walls) {
      const length = w.to - w.from;
      if (length < MIN_WALL) continue;
      const q = new THREE.Quaternion().setFromAxisAngle(up, w.yaw);
      const out = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const at = (along: number, y: number, off = 0) => new THREE.Vector3(w.x ?? along, y, w.z ?? along).addScaledVector(out, off);
      const put = (list: THREE.BufferGeometry[], geo: THREE.BufferGeometry, pos: THREE.Vector3, turn = q) =>
        list.push(geo.applyMatrix4(new THREE.Matrix4().compose(pos, turn, one)));
      // Away from the corners, where pilasters and neighbours meet.
      const along = () => w.from + 1.2 + rnd() * (length - 2.4);

      // A drain pipe down the wall, held by brackets; sometimes broken off partway.
      if (rnd() < 0.35) {
        const a = along();
        const top = y1 - 0.6;
        const broken = rnd() < 0.4;
        const bottom = broken ? y0 + (y1 - y0) * (0.3 + rnd() * 0.4) : y0;
        const len = top - bottom;
        put(pipes, new THREE.CylinderGeometry(0.07, 0.07, len, 6).toNonIndexed(), at(a, bottom + len / 2, 0.14));
        for (let y = bottom + 0.5; y < top; y += 2.2) put(pipes, new THREE.BoxGeometry(0.2, 0.06, 0.14).toNonIndexed(), at(a, y, 0.07));
        if (broken) {
          // The broken end bends away from the wall.
          const end = new THREE.CylinderGeometry(0.07, 0.07, 0.35, 6).toNonIndexed().rotateX(0.7);
          put(pipes, end, at(a, bottom - 0.12, 0.24));
          put(stains, new THREE.PlaneGeometry(0.5, Math.min(6, bottom - y0)).toNonIndexed(), at(a, bottom - Math.min(6, bottom - y0) / 2, 0.02));
        }
      }

      // A broken outlet sticking out of the wall: short, round, with a flange.
      if (rnd() < 0.3) {
        const a = along();
        const y = y0 + 2.5 + rnd() * Math.max(0, y1 - y0 - 4);
        const turn = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 - 0.15));
        put(pipes, new THREE.CylinderGeometry(0.1, 0.1, 0.38, 7).toNonIndexed(), at(a, y, 0.19), turn);
        put(pipes, new THREE.CylinderGeometry(0.16, 0.16, 0.04, 7).toNonIndexed(), at(a, y, 0.02), turn);
        const mouth = at(a, y - 0.03, 0.38);
        if (streams.length / 2 < MAX_STREAMS && nearRest(mouth)) {
          // Water falls to the next surface below and splashes there.
          const floor = floorBelow(mouth);
          const drop = mouth.y - floor;
          for (const spin of [0, Math.PI / 2]) {
            const sheet = new THREE.PlaneGeometry(0.07, drop).toNonIndexed();
            const uv = sheet.attributes.uv;
            for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * drop * 0.8);
            sheet.rotateY(spin);
            streams.push(sheet.translate(mouth.x, mouth.y - drop / 2, mouth.z));
          }
          splashes.push(new THREE.Vector3(mouth.x, floor + 0.05, mouth.z));
          put(stains, new THREE.PlaneGeometry(0.6, Math.min(5, y - y0)).toNonIndexed(), at(a, y - Math.min(5, y - y0) / 2, 0.02));
        }
      }

      // Ivy hanging from the top (just below the landing trim) or from a sill row.
      const ivyCount = rnd() < 0.45 ? 1 + Math.floor(rnd() * 3) : 0;
      for (let i = 0; i < ivyCount; i++) {
        const a = along();
        const width = 0.8 + rnd() * 1.4;
        const hang = Math.min(1.5 + rnd() * 4, y1 - y0 - 1);
        const fromTop = rnd() < 0.6;
        const top = fromTop ? y1 - 0.12 : y0 + Math.floor(rnd() * Math.max(1, (y1 - y0) / 5)) * 5 + 0.85;
        if (top - hang < y0) continue;
        put(leaves, new THREE.PlaneGeometry(width, hang).toNonIndexed(), at(a, top - hang / 2, 0.04 + i * 0.01));
      }

      // Cracks, more of them high up where the structure gives way.
      const crackCount = rnd() < (high ? 0.8 : 0.4) ? 1 + Math.floor(rnd() * (high ? 3 : 2)) : 0;
      for (let i = 0; i < crackCount; i++) {
        const size = 1.5 + rnd() * 2.5;
        const y = y0 + 1 + rnd() * Math.max(0, y1 - y0 - size - 1);
        const geo = new THREE.PlaneGeometry(size, size).toNonIndexed();
        geo.rotateZ(Math.floor(rnd() * 4) * (Math.PI / 2));
        put(cracks, geo, at(along(), y + size / 2, 0.012));
      }
    }
  }

  const add = (list: THREE.BufferGeometry[], material: THREE.Material) => {
    if (list.length === 0) return;
    const mesh = new THREE.Mesh(mergeGeometries(list)!, material);
    scene.add(mesh);
  };
  add(pipes, rust);
  add(leaves, ivy);
  add(cracks, crack);
  add(stains, stain);
  add(streams, water);

  // Splashes: small pale puffs that pulse where the water lands.
  const splashMat = new THREE.PointsMaterial({ color: 0xc8d4dc, size: 0.18, transparent: true, opacity: 0.7, depthWrite: false });
  const splashGeo = new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute(splashes.flatMap((p) => [p.x, p.y, p.z, p.x + 0.08, p.y + 0.06, p.z, p.x - 0.07, p.y + 0.04, p.z + 0.05]), 3),
  );
  const splash = new THREE.Points(splashGeo, splashMat);
  scene.add(splash);

  return (time) => {
    waterMap.offset.y = time * 2.2;
    splashMat.opacity = 0.45 + 0.3 * Math.abs(Math.sin(time * 9));
  };
}
