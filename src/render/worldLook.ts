// The look of the structure (§6, concept art): small generated textures
// mapped by world size, gothic arched windows on the tall walls (a few lit),
// a distant skyline of towers and spires beyond the fog, and a pale moon.
// Look only: nothing here has a collider.

import * as THREE from "three";
import type { Level, Piece, Surface } from "../levels/types.ts";
import { glow } from "./lantern.ts";

/** One texture tile covers this many metres. */
const TILE_METRES = 4;
const TEXTURE_SIZE = 64;

/** Fixed pseudo-random numbers, so the look is the same every time. */
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

/** Draws a texture on a small canvas: hard pixels, repeating. */
function canvasTexture(draw: (g: CanvasRenderingContext2D, n: number, rnd: () => number) => void, seed: number): THREE.Texture {
  const n = TEXTURE_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const g = canvas.getContext("2d")!;
  draw(g, n, random(seed));
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Speckled noise around a grey level `base` (0..255). */
function noise(g: CanvasRenderingContext2D, n: number, rnd: () => number, base: number, spread: number): void {
  const img = g.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const v = base + (rnd() - 0.5) * spread;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

const TEXTURES: Record<Surface, () => THREE.Texture> = {
  // Concrete: speckle, a few darker stains and runs, panel joints.
  normal: () =>
    canvasTexture((g, n, rnd) => {
      noise(g, n, rnd, 222, 26);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = `rgba(40,38,36,${0.06 + rnd() * 0.08})`;
        const x = rnd() * n, w = 3 + rnd() * 10;
        g.fillRect(x, rnd() * n * 0.5, w, 8 + rnd() * n * 0.6);
      }
      g.fillStyle = "rgba(30,30,30,0.35)";
      g.fillRect(0, 0, n, 1);
      g.fillRect(0, 0, 1, n);
    }, 1),
  // Tarp: taut cloth with stitched bands.
  trampoline: () =>
    canvasTexture((g, n, rnd) => {
      noise(g, n, rnd, 232, 14);
      g.fillStyle = "rgba(90,70,40,0.25)";
      for (let y = 0; y < n; y += 16) g.fillRect(0, y, n, 2);
    }, 2),
  // Mud: dark, wet, lumpy.
  mud: () =>
    canvasTexture((g, n, rnd) => {
      noise(g, n, rnd, 150, 70);
      for (let i = 0; i < 20; i++) {
        g.fillStyle = `rgba(255,255,255,${rnd() * 0.12})`;
        g.fillRect(rnd() * n, rnd() * n, 2 + rnd() * 4, 1 + rnd() * 2);
      }
    }, 3),
};

const textureCache = new Map<Surface, THREE.Texture>();

export function surfaceTexture(surface: Surface): THREE.Texture {
  let t = textureCache.get(surface);
  if (!t) {
    t = TEXTURES[surface]();
    textureCache.set(surface, t);
  }
  return t;
}

/**
 * Gives `geo` texture coordinates by box projection: each triangle takes the
 * two coordinates across its main facing axis, in tiles of TILE_METRES, so
 * textures keep their size on pieces of any size. Returns a non-indexed copy.
 */
export function projectUVs(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(b.clone().sub(a)).set(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z));
    for (let k = 0; k < 3; k++) {
      const p = k === 0 ? a : k === 1 ? b : c;
      const [u, v] = n.x >= n.y && n.x >= n.z ? [p.z, p.y] : n.y >= n.z ? [p.x, p.z] : [p.x, p.y];
      uv[(i + k) * 2] = u / TILE_METRES;
      uv[(i + k) * 2 + 1] = v / TILE_METRES;
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// Windows: arched, 0.9 × 1.7 m, on a grid over the tall walls.
const WINDOW_W = 0.9;
const WINDOW_H = 1.7;
const WINDOW_GAP_X = 3.4;
const WINDOW_GAP_Y = 5;
/** Walls lower or narrower than this get no windows, m. */
const WINDOW_MIN_WALL = 6;
const LIT_SHARE = 0.1;
const DARK_SHARE = 0.4;
const WINDOW_LIT = 0xb3925a;
const WINDOW_DARK = 0x0a0a0c;

function archShape(): THREE.Shape {
  const s = new THREE.Shape();
  const hw = WINDOW_W / 2;
  const spring = WINDOW_H - hw * 1.2;
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(hw, spring);
  // A pointed arch: two arcs meeting at the top.
  s.quadraticCurveTo(hw, spring + hw * 0.8, 0, WINDOW_H);
  s.quadraticCurveTo(-hw, spring + hw * 0.8, -hw, spring);
  s.lineTo(-hw, 0);
  return s;
}

const isPlainBox = (p: Piece) =>
  p.shape === "box" && p.motion.kind === "none" && p.rotation.x === 0 && p.rotation.y === 0 && p.rotation.z === 0;

/** Arched windows on the tall walls of `level`, some lit, the rest dark. */
export function addWindows(level: Level, scene: THREE.Scene): void {
  const shape = new THREE.ShapeGeometry(archShape());
  const lit: THREE.Matrix4[] = [];
  const dark: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);

  for (const p of level.pieces) {
    if (!isPlainBox(p) || p.size.y < WINDOW_MIN_WALL) continue;
    const rnd = random(hash(p.id));
    const x0 = p.position.x - p.size.x / 2, x1 = p.position.x + p.size.x / 2;
    const z0 = p.position.z - p.size.z / 2, z1 = p.position.z + p.size.z / 2;
    const y0 = p.position.y - p.size.y / 2, y1 = p.position.y + p.size.y / 2;
    // Each wall: its outward direction, where it lies, and the axis along it.
    const walls = [
      { yaw: Math.PI / 2, x: x1 + 0.03, z: null, from: z0, to: z1 },
      { yaw: -Math.PI / 2, x: x0 - 0.03, z: null, from: z0, to: z1 },
      { yaw: 0, x: null, z: z1 + 0.03, from: x0, to: x1 },
      { yaw: Math.PI, x: null, z: z0 - 0.03, from: x0, to: x1 },
    ];
    for (const w of walls) {
      const length = w.to - w.from;
      if (length < WINDOW_MIN_WALL) continue;
      const cols = Math.floor((length - 1) / WINDOW_GAP_X);
      const rows = Math.floor((p.size.y - 2) / WINDOW_GAP_Y);
      const startAlong = w.from + (length - (cols - 1) * WINDOW_GAP_X) / 2;
      q.setFromAxisAngle(up, w.yaw);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const roll = rnd();
          const list = roll < LIT_SHARE ? lit : roll < LIT_SHARE + DARK_SHARE ? dark : null;
          if (!list) continue;
          const along = startAlong + c * WINDOW_GAP_X;
          const y = y0 + 1.5 + r * WINDOW_GAP_Y;
          if (y + WINDOW_H > y1 - 0.5) continue;
          const pos = new THREE.Vector3(w.x ?? along, y, w.z ?? along);
          list.push(m.clone().compose(pos, q, one));
        }
      }
    }
  }
  const place = (list: THREE.Matrix4[], color: number) => {
    if (list.length === 0) return;
    const mesh = new THREE.InstancedMesh(shape, new THREE.MeshBasicMaterial({ color }), list.length);
    list.forEach((mat, i) => mesh.setMatrixAt(i, mat));
    scene.add(mesh);
  };
  place(lit, WINDOW_LIT);
  place(dark, WINDOW_DARK);
}

/** Centre of the skyline ring, roughly the middle of the structure. */
const SKYLINE_CENTRE = new THREE.Vector3(0, 0, -50);
const SKYLINE_COLOR = 0x15181d;

/**
 * Towers and spires in a ring far beyond the fog, drawn without fog as dark
 * silhouettes with a few warm windows, and a pale moon low over them.
 */
export function addSkyline(scene: THREE.Scene): void {
  const rnd = random(99);
  const mat = new THREE.MeshBasicMaterial({ color: SKYLINE_COLOR, fog: false });
  const windows: number[] = [];
  const group = new THREE.Group();
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rnd() * 0.08;
    const r = 165 + rnd() * 25;
    const w = 8 + rnd() * 16;
    const h = 40 + rnd() * 100;
    const x = SKYLINE_CENTRE.x + Math.sin(a) * r;
    const z = SKYLINE_CENTRE.z + Math.cos(a) * r;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    tower.position.set(x, h / 2 - 20, z);
    tower.rotation.y = a;
    group.add(tower);
    if (rnd() < 0.6) {
      const spire = new THREE.Mesh(new THREE.ConeGeometry(w * 0.35, 15 + rnd() * 35, 4), mat);
      spire.position.set(x, h - 20 + spire.geometry.parameters.height / 2, z);
      spire.rotation.y = a + Math.PI / 4;
      group.add(spire);
    }
    // A few lit windows on the side facing the structure.
    for (let k = 0; k < 6; k++) {
      if (rnd() < 0.5) continue;
      const along = (rnd() - 0.5) * w * 0.8;
      const y = 10 + rnd() * (h - 30);
      windows.push(x - Math.sin(a) * (w / 2 + 0.5) + Math.cos(a) * along, y, z - Math.cos(a) * (w / 2 + 0.5) - Math.sin(a) * along);
    }
  }
  const points = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(windows, 3));
  group.add(new THREE.Points(points, new THREE.PointsMaterial({ color: 0x9c7a4c, size: 2, sizeAttenuation: false, fog: false })));
  const moon = glow(0xe6e2d6, 40, 0.5);
  (moon.material as THREE.SpriteMaterial).fog = false;
  moon.position.set(SKYLINE_CENTRE.x - 120, 110, SKYLINE_CENTRE.z - 110);
  group.add(moon);
  scene.add(group);
}

/** Where the red warning light sits: on the summit's roof. */
const BEACON = new THREE.Vector3(18, 162.6, -98);

/** A red aircraft warning light that blinks once every two seconds; returns its update. */
export function addBeacon(scene: THREE.Scene): (time: number) => void {
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
  lamp.position.copy(BEACON);
  const halo = glow(0xff3020, 3, 0.8);
  (halo.material as THREE.SpriteMaterial).fog = false;
  halo.position.copy(BEACON);
  scene.add(lamp, halo);
  return (time) => {
    const on = time % 2 < 0.35;
    lamp.visible = on;
    halo.visible = on;
  };
}

/** The ground around the structure: dark concrete, fading into the fog. */
export function groundMaterial(): THREE.Material {
  const map = surfaceTexture("normal").clone();
  map.repeat.set(250, 250);
  map.needsUpdate = true;
  return new THREE.MeshLambertMaterial({ color: 0x5a5c60, map });
}
