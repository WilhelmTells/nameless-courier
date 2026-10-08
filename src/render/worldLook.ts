// The look of the structure (§6, concept art): small generated textures
// mapped by world size, gothic arched windows on the tall walls (a few lit),
// a distant skyline of towers and spires beyond the fog, and a pale moon.
// Look only: nothing here has a collider.

import * as THREE from "three";
import type { Level, Piece, Surface } from "../levels/types.ts";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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

/** Concrete: speckle, a few faint stains, panel joints. Variants differ in stains and joints. */
function concrete(seed: number): THREE.Texture {
  return canvasTexture((g, n, rnd) => {
    noise(g, n, rnd, 222, 22);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = `rgba(40,38,36,${0.03 + rnd() * 0.05})`;
      g.fillRect(rnd() * n, rnd() * n, 4 + rnd() * 14, 3 + rnd() * 14);
    }
    g.fillStyle = "rgba(30,30,30,0.3)";
    g.fillRect(0, 0, n, 1);
    if (seed % 2 === 0) g.fillRect(0, n / 2, n, 1);
    g.fillRect(0, 0, 1, n);
  }, seed);
}

/** Concrete variants, picked per piece. */
export const CONCRETE_VARIANTS = 3;

const TEXTURES: Record<Surface, () => THREE.Texture> = {
  normal: () => concrete(1),
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

const textureCache = new Map<string, THREE.Texture>();

/** The texture for a surface; concrete comes in `CONCRETE_VARIANTS` variants. */
export function surfaceTexture(surface: Surface, variant = 0): THREE.Texture {
  const id = `${surface}:${surface === "normal" ? variant : 0}`;
  let t = textureCache.get(id);
  if (!t) {
    t = surface === "normal" ? concrete(1 + variant * 3) : TEXTURES[surface]();
    textureCache.set(id, t);
  }
  return t;
}

/** A piece's concrete variant and texture offset, fixed by its id. */
export function pieceLook(id: string): { variant: number; offset: [number, number] } {
  const rnd = random(hash(id));
  return { variant: Math.floor(rnd() * CONCRETE_VARIANTS), offset: [rnd(), rnd()] };
}

const WEATHER_VERTEX = /* glsl */ `
  vWeatherPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vWeatherNormal = normalize(mat3(modelMatrix) * objectNormal);
`;

const WEATHER_FRAGMENT = /* glsl */ `
  {
    vec3 wp = vWeatherPos;
    vec3 wn = normalize(vWeatherNormal);
    float wall = 1.0 - smoothstep(0.4, 0.7, abs(wn.y));
    // Large blotches, so big walls never look like the same tile.
    float blotch = weatherNoise(wp * 0.07) * 0.6 + weatherNoise(wp * 0.21) * 0.4;
    float shade = mix(0.74, 1.08, blotch);
    // Water streaks running down the walls.
    float across = dot(wp.xz, vec2(1.0)) * 1.1;
    float streak = weatherNoise(vec3(across, wp.y * 0.045, 7.0));
    shade *= 1.0 - wall * 0.32 * smoothstep(0.52, 0.85, streak);
    // Grime towards the ground.
    shade *= mix(0.7, 1.0, smoothstep(0.0, 6.0, wp.y));
    // Tops a little lighter than walls.
    shade *= mix(1.06, 0.94, wall);
    diffuseColor.rgb *= shade;
    // Damp green-grey moss on low, shaded patches of the walls.
    float moss = wall * smoothstep(0.62, 0.8, weatherNoise(wp * 0.33 + 3.1)) * (1.0 - smoothstep(0.55, 0.9, blotch));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.25, 0.17), moss * 0.55);
  }
`;

const WEATHER_NOISE = /* glsl */ `
  varying vec3 vWeatherPos;
  varying vec3 vWeatherNormal;
  float weatherHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float weatherNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(weatherHash(i), weatherHash(i + vec3(1, 0, 0)), f.x), mix(weatherHash(i + vec3(0, 1, 0)), weatherHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(weatherHash(i + vec3(0, 0, 1)), weatherHash(i + vec3(1, 0, 1)), f.x), mix(weatherHash(i + vec3(0, 1, 1)), weatherHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }
`;

/** Weathers a material in its shader: blotches, water streaks, grime near the ground, moss. */
export function weather<T extends THREE.Material>(material: T): T {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWeatherPos;\nvarying vec3 vWeatherNormal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + WEATHER_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + WEATHER_NOISE)
      .replace("#include <map_fragment>", "#include <map_fragment>\n" + WEATHER_FRAGMENT);
  };
  return material;
}

/**
 * Gives `geo` texture coordinates by box projection: each triangle takes the
 * two coordinates across its main facing axis, in tiles of TILE_METRES, so
 * textures keep their size on pieces of any size. Returns a non-indexed copy.
 */
export function projectUVs(geo: THREE.BufferGeometry, offset: [number, number] = [0, 0], tile = TILE_METRES): THREE.BufferGeometry {
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
      uv[(i + k) * 2] = u / tile + offset[0];
      uv[(i + k) * 2 + 1] = v / tile + offset[1];
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// Architecture on the tall walls: pointed-arch windows in floors (a frame
// standing out 10 cm, a sill, dark or lit glass), a band along each floor, a
// moulding below the top, and shallow pilasters. Nothing sticks out more
// than 12 cm, so none of it reads as a ledge to land on.
const WINDOW_W = 0.9;
const WINDOW_H = 1.7;
const FRAME = 0.15;
const FRAME_DEPTH = 0.1;
const WINDOW_GAP_X = 3.4;
/** Floors are this tall everywhere, so window rows line up across buildings, m. */
const FLOOR_HEIGHT = 5;
/** Walls lower or narrower than this get no architecture, m. */
const WINDOW_MIN_WALL = 6;
/** Share of window openings with a lit window; the rest are dark, a few bricked up. */
const LIT_SHARE = 0.1;
const BRICKED_SHARE = 0.12;
const WINDOW_LIT = 0xb3925a;
const WINDOW_DARK = 0x0a0a0c;
const STONE_COLOR = 0x9a9995;

/** A pointed arch `w` wide and `h` tall, standing on y = `y0`. */
function arch(w: number, h: number, y0 = 0, path: THREE.Path = new THREE.Shape()): THREE.Path {
  const hw = w / 2;
  const spring = y0 + h - hw * 1.2;
  path.moveTo(-hw, y0);
  path.lineTo(hw, y0);
  path.lineTo(hw, spring);
  path.quadraticCurveTo(hw, spring + hw * 0.8, 0, y0 + h);
  path.quadraticCurveTo(-hw, spring + hw * 0.8, -hw, spring);
  path.lineTo(-hw, y0);
  return path;
}

/** The window's stone: an arched frame around the opening and a sill, facing +Z, on y = 0. */
function windowStone(): THREE.BufferGeometry {
  const outer = arch(WINDOW_W + 2 * FRAME, WINDOW_H + 2 * FRAME, -FRAME) as THREE.Shape;
  outer.holes.push(arch(WINDOW_W, WINDOW_H));
  const frame = new THREE.ExtrudeGeometry(outer, { depth: FRAME_DEPTH, bevelEnabled: false, curveSegments: 6 });
  const sill = new THREE.BoxGeometry(WINDOW_W + 2 * FRAME + 0.16, 0.08, 0.12).translate(0, -FRAME - 0.04, 0.06);
  return mergeGeometries([frame.toNonIndexed(), sill.toNonIndexed()])!;
}

const isPlainBox = (p: Piece) =>
  p.shape === "box" && p.motion.kind === "none" && p.rotation.x === 0 && p.rotation.y === 0 && p.rotation.z === 0;

/** Windows, bands, mouldings and pilasters on the tall walls of `level`. */
export function addArchitecture(level: Level, scene: THREE.Scene): void {
  const stone: THREE.BufferGeometry[] = [];
  const lit: THREE.Matrix4[] = [];
  const dark: THREE.Matrix4[] = [];
  const windowGeo = windowStone();
  const glassGeo = new THREE.ShapeGeometry(arch(WINDOW_W, WINDOW_H) as THREE.Shape, 6);
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);

  for (const p of level.pieces) {
    if (!isPlainBox(p) || p.size.y < WINDOW_MIN_WALL) continue;
    const rnd = random(hash(p.id) + 1);
    const x0 = p.position.x - p.size.x / 2, x1 = p.position.x + p.size.x / 2;
    const z0 = p.position.z - p.size.z / 2, z1 = p.position.z + p.size.z / 2;
    const y0 = p.position.y - p.size.y / 2, y1 = p.position.y + p.size.y / 2;
    // Each wall: the turn that faces +Z outward, where it lies, and its extent along it.
    const walls = [
      { yaw: Math.PI / 2, x: x1, z: null, from: z0, to: z1 },
      { yaw: -Math.PI / 2, x: x0, z: null, from: z0, to: z1 },
      { yaw: 0, x: null, z: z1, from: x0, to: x1 },
      { yaw: Math.PI, x: null, z: z0, from: x0, to: x1 },
    ];
    for (const w of walls) {
      const length = w.to - w.from;
      if (length < WINDOW_MIN_WALL) continue;
      const q = new THREE.Quaternion().setFromAxisAngle(up, w.yaw);
      const at = (along: number, y: number) => new THREE.Vector3(w.x ?? along, y, w.z ?? along);
      const put = (geo: THREE.BufferGeometry, along: number, y: number) =>
        stone.push(geo.clone().applyMatrix4(new THREE.Matrix4().compose(at(along, y), q, one)));
      const mid = (w.from + w.to) / 2;

      // A band below each row of windows, and a moulding below the top.
      const band = new THREE.BoxGeometry(length, 0.22, 0.06).translate(0, 0, 0.03).toNonIndexed();
      for (let y = Math.ceil((y0 + 1) / FLOOR_HEIGHT) * FLOOR_HEIGHT; y < y1 - 1.5; y += FLOOR_HEIGHT) put(band, mid, y);
      if (p.size.y >= 8) put(new THREE.BoxGeometry(length, 0.32, 0.1).translate(0, 0, 0.05).toNonIndexed(), mid, y1 - 0.8);

      // Windows on a grid of floors and bays; pilasters between every second bay.
      const cols = Math.floor((length - 1) / WINDOW_GAP_X);
      const startAlong = w.from + (length - (cols - 1) * WINDOW_GAP_X) / 2;
      const pilaster = new THREE.BoxGeometry(0.45, p.size.y - 1.2, 0.08).translate(0, 0, 0.04).toNonIndexed();
      for (let c = 1; c < cols; c += 2) put(pilaster, startAlong + (c - 0.5) * WINDOW_GAP_X, (y0 + y1 - 1.2) / 2);
      for (let y = Math.ceil((y0 + 1) / FLOOR_HEIGHT) * FLOOR_HEIGHT + 1; y + WINDOW_H + 1 < y1; y += FLOOR_HEIGHT) {
        for (let c = 0; c < cols; c++) {
          const along = startAlong + c * WINDOW_GAP_X;
          const roll = rnd();
          if (roll < BRICKED_SHARE) continue;
          put(windowGeo, along, y);
          const glass = new THREE.Matrix4().compose(at(along, y).addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(q), 0.015), q, one);
          (roll < BRICKED_SHARE + LIT_SHARE ? lit : dark).push(glass);
        }
      }
    }
  }
  if (stone.length > 0) {
    const merged = projectUVs(mergeGeometries(stone)!);
    scene.add(new THREE.Mesh(merged, weather(new THREE.MeshLambertMaterial({ color: STONE_COLOR, map: surfaceTexture("normal", 1) }))));
  }
  const place = (list: THREE.Matrix4[], color: number) => {
    if (list.length === 0) return;
    const mesh = new THREE.InstancedMesh(glassGeo, new THREE.MeshBasicMaterial({ color }), list.length);
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


/** Faces pointing up at least this much (cosine) count as landable for the trim. */
const TRIM_UP = 0.7;
/** Width of the trim on the surface and down the side, m. */
const TRIM_TOP = 0.07;
const TRIM_SIDE = 0.05;
/** Lift off the faces, so the trim never flickers against them, m. */
const TRIM_LIFT = 0.006;

/**
 * A slim band wrapping the outer edges of every upward face of `geo`
 * (non-indexed, in the piece's own space): along the top and a little way
 * down the side. `turn` is the piece's rotation, to tell which faces point up;
 * `continues` says whether a point just past an edge (piece space) lies on
 * another surface at the same height, where no trim is drawn.
 */
export function trimGeometry(
  geo: THREE.BufferGeometry,
  turn: THREE.Quaternion,
  continues: (point: THREE.Vector3) => boolean = () => false,
): THREE.BufferGeometry | null {
  const pos = geo.attributes.position;
  const worldUp = new THREE.Vector3(0, 1, 0).applyQuaternion(turn.clone().invert());
  const key = (v: THREE.Vector3) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
  const edges = new Map<string, { a: THREE.Vector3; b: THREE.Vector3; n: THREE.Vector3; c: THREE.Vector3; count: number }>();
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i < pos.count; i += 3) {
    for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, i + k);
    const n = new THREE.Vector3().subVectors(v[1], v[0]).cross(new THREE.Vector3().subVectors(v[2], v[0])).normalize();
    if (n.dot(worldUp) < TRIM_UP) continue;
    const c = new THREE.Vector3().add(v[0]).add(v[1]).add(v[2]).divideScalar(3);
    for (let k = 0; k < 3; k++) {
      const a = v[k], b = v[(k + 1) % 3];
      const ka = key(a), kb = key(b);
      const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const e = edges.get(id);
      if (e) e.count++;
      else edges.set(id, { a: a.clone(), b: b.clone(), n: n.clone(), c, count: 1 });
    }
  }
  const out: number[] = [];
  const quad = (p: THREE.Vector3[]) => out.push(...[p[0], p[1], p[2], p[0], p[2], p[3]].flatMap((q) => [q.x, q.y, q.z]));
  for (const e of edges.values()) {
    if (e.count !== 1) continue;
    const along = new THREE.Vector3().subVectors(e.b, e.a);
    const inward = new THREE.Vector3().crossVectors(e.n, along).normalize();
    if (inward.dot(new THREE.Vector3().subVectors(e.c, e.a)) < 0) inward.negate();
    // No trim where the surface carries on at the same height (another piece).
    const beyond = e.a.clone().add(e.b).multiplyScalar(0.5).addScaledVector(inward, -0.1);
    if (continues(beyond)) continue;
    const lift = e.n.clone().multiplyScalar(TRIM_LIFT);
    const out1 = inward.clone().multiplyScalar(-TRIM_LIFT);
    const a = e.a.clone().add(lift).add(out1), b = e.b.clone().add(lift).add(out1);
    const ai = a.clone().addScaledVector(inward, TRIM_TOP), bi = b.clone().addScaledVector(inward, TRIM_TOP);
    const ad = a.clone().addScaledVector(e.n, -TRIM_SIDE), bd = b.clone().addScaledVector(e.n, -TRIM_SIDE);
    quad([a, ai, bi, b]);
    quad([a, b, bd, ad]);
  }
  if (out.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  return g;
}

/** Weathered planks with dark gaps and a cross brace: one crate face per tile. */
function woodTexture(): THREE.Texture {
  return canvasTexture((g, n, rnd) => {
    const planks = 4;
    for (let i = 0; i < planks; i++) {
      const base = 92 + rnd() * 30;
      for (let y = (i * n) / planks; y < ((i + 1) * n) / planks; y++) {
        for (let x = 0; x < n; x++) {
          const v = base + (rnd() - 0.5) * 18 + Math.sin(x * 0.4 + i) * 4;
          g.fillStyle = `rgb(${v},${v * 0.78},${v * 0.55})`;
          g.fillRect(x, y, 1, 1);
        }
      }
      g.fillStyle = "rgba(20,14,8,0.8)";
      g.fillRect(0, (i * n) / planks, n, 1);
    }
    g.fillStyle = "rgba(40,28,16,0.9)";
    g.fillRect(0, 0, n, 4);
    g.fillRect(0, n - 4, n, 4);
    g.fillRect(0, 0, 4, n);
    g.fillRect(n - 4, 0, 4, n);
    g.strokeStyle = "rgba(55,38,22,0.95)";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(4, 4);
    g.lineTo(n - 4, n - 4);
    g.stroke();
  }, 61);
}

/** Rusty metal with two raised bands. */
function barrelTexture(): THREE.Texture {
  return canvasTexture((g, n, rnd) => {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = rnd();
        g.fillStyle = v < 0.5 ? "#4a3022" : v < 0.8 ? "#5e3a24" : v < 0.95 ? "#3a3634" : "#7a5236";
        g.fillRect(x, y, 1, 1);
      }
    }
    g.fillStyle = "rgba(25,20,18,0.85)";
    for (const y of [n * 0.18, n * 0.78]) g.fillRect(0, y, n, 3);
  }, 71);
}

export type PropMaterial = "crate" | "barrel" | "stone" | "water" | "iron";

/** The look of a prop (level data `material`), and its texture tile size in metres. */
export function propLook(material: PropMaterial): { mesh: THREE.Material; tile: number } {
  switch (material) {
    case "crate":
      return { mesh: new THREE.MeshLambertMaterial({ map: woodTexture() }), tile: 1 };
    case "barrel":
      return { mesh: new THREE.MeshLambertMaterial({ map: barrelTexture() }), tile: 1 };
    case "stone":
      return { mesh: weather(new THREE.MeshLambertMaterial({ color: 0xa8a6a0, map: surfaceTexture("normal", 2) })), tile: 2 };
    case "water":
      return { mesh: new THREE.MeshPhongMaterial({ color: 0x24323b, specular: 0x7c8c98, shininess: 90 }), tile: TILE_METRES };
    case "iron":
      return { mesh: new THREE.MeshLambertMaterial({ color: 0x1e1f22 }), tile: TILE_METRES };
  }
}
