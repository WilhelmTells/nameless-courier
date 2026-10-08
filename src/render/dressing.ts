// Set dressing on the tall walls (user, concept art): rusty drain pipes,
// broken pipes sticking out (a few with water running from them, many
// dripping), ivy
// hanging from the tops and sills, and cracks. Look only, no colliders.
// Rules (§6): nothing reads as a ledge (pipes are round and short), ivy
// hangs below landing edges and never covers their trim, and only a few
// streams run, near rest spots.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Level, Piece } from "../levels/types.ts";
import { deadLantern, lantern } from "./lantern.ts";
import { windStrength } from "./atmosphere.ts";
import { facesRoom } from "./worldLook.ts";

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
/** Clearance above every surface: sideways, below and above its top, m. */
const CLEAR_SIDE = 0.6;
const CLEAR_BELOW = 0.3;
const CLEAR_ABOVE = 3.2;
/** Streams only land on the ground or on plateaus at least this big, m². */
const WATER_MIN_AREA = 80;

/** A piece's world bounding box, rotation included. */
function pieceBox(p: Piece): THREE.Box3 {
  const DEG = Math.PI / 180;
  const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rotation.x * DEG, p.rotation.y * DEG, p.rotation.z * DEG));
  const box = new THREE.Box3();
  for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) {
    box.expandByPoint(new THREE.Vector3(sx * p.size.x, sy * p.size.y, sz * p.size.z).applyQuaternion(turn).add(new THREE.Vector3(p.position.x, p.position.y, p.position.z)));
  }
  return box;
}

/** Streams per zone, so every zone has a little running water. */
const STREAMS_PER_ZONE = 2;
/** Falling drops, m/s². */
const DRIP_GRAVITY = 9.8;
/** A splash shows this long where a drop lands, s. */
const SPLASH_TIME = 0.16;

/** Adds the dressing to `scene`; returns the update that runs the water. */
export function addDressing(level: Level, scene: THREE.Scene): (time: number) => void {
  const rust = new THREE.MeshLambertMaterial({ map: rustTexture() });
  const ivy = new THREE.MeshLambertMaterial({ map: ivyTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
  // The ivy sways in the wind: its hanging ends most, its top not at all.
  const sway = { value: 0 };
  const swayTime = { value: 0 };
  ivy.onBeforeCompile = (shader) => {
    shader.uniforms.ivySway = sway;
    shader.uniforms.ivyTime = swayTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float ivySway;\nuniform float ivyTime;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nfloat hang = 1.0 - uv.y;\ntransformed.xz += vec2(-0.8, 0.6) * ivySway * hang * hang * (0.6 + 0.4 * sin(ivyTime * 1.7 + position.x * 0.8 + position.z * 0.6 + position.y));",
      );
  };
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

  /** The highest surface below `p`: its height and its piece, or the ground (null). */
  const surfaceBelow = (p: THREE.Vector3): { y: number; piece: Piece | null } => {
    let best: { y: number; piece: Piece | null } = { y: 0, piece: null };
    for (const b of level.pieces) {
      const top = b.position.y + b.size.y / 2;
      if (top >= p.y || top <= best.y) continue;
      if (Math.abs(p.x - b.position.x) <= b.size.x / 2 && Math.abs(p.z - b.position.z) <= b.size.z / 2) best = { y: top, piece: b };
    }
    return best;
  };

  // Clearance: the space above every surface the courier can be on stays
  // free of pipes and water, so nothing hangs across a path (user found a
  // drain pipe and a stream crossing the narrow path before the first
  // figure). Moving pieces get a wide margin for their travel.
  const clearance = level.pieces.map((p) => {
    const b = pieceBox(p);
    const margin = p.motion.kind === "none" ? CLEAR_SIDE : CLEAR_SIDE + 4;
    return {
      piece: p,
      box: new THREE.Box3(
        new THREE.Vector3(b.min.x - margin, b.max.y - CLEAR_BELOW, b.min.z - margin),
        new THREE.Vector3(b.max.x + margin, b.max.y + CLEAR_ABOVE + (margin - CLEAR_SIDE), b.max.z + margin),
      ),
    };
  });
  /**
   * True when `box` reaches into the space above any surface (but
   * `except`'s). A flush item (a drain pipe flat on the wall) may stand on a
   * surface beside the wall; it only counts when it passes down through one.
   */
  const blocked = (box: THREE.Box3, except: Piece | null = null, flush = false) =>
    clearance.some((c) => c.piece !== except && c.box.intersectsBox(box) && (!flush || box.min.y < c.box.min.y - 0.05));
  /** Water may only land on the ground or a big plateau, and must not fall across another surface. */
  const waterPath = (mouth: THREE.Vector3) => {
    const floor = surfaceBelow(mouth);
    const big = floor.piece === null || floor.piece.size.x * floor.piece.size.z >= WATER_MIN_AREA;
    const column = new THREE.Box3(new THREE.Vector3(mouth.x - 0.1, floor.y + 0.05, mouth.z - 0.1), new THREE.Vector3(mouth.x + 0.1, mouth.y, mouth.z + 0.1));
    return { floor: floor.y, clear: !blocked(column, floor.piece), big };
  };
  const nearRest = (p: THREE.Vector3) =>
    level.restSpots.some((r) => {
      const cx = (r.min.x + r.max.x) / 2, cz = (r.min.z + r.max.z) / 2;
      return Math.hypot(p.x - cx, p.z - cz) < WATER_NEAR_REST && Math.abs(p.y - r.min.y) < 12;
    });

  const inRoom = (p: THREE.Vector3) =>
    (level.rooms ?? []).some((r) => p.x > r.min.x && p.x < r.max.x && p.z > r.min.z && p.z < r.max.z && p.y > r.min.y && p.y < r.max.y);
  const zoneOf = new Map<string, number>();
  level.zones.forEach((z, i) => z.pieces.forEach((p) => zoneOf.set(p.id, i)));
  const streamsIn: number[] = [];
  let zone = 0;

  /** Water falling from `mouth` to the next surface below, splashing there; only near rest spots, two per zone. */
  const pour = (mouth: THREE.Vector3): boolean => {
    if ((streamsIn[zone] ?? 0) >= STREAMS_PER_ZONE || !nearRest(mouth) || inRoom(mouth)) return false;
    const path = waterPath(mouth);
    if (!path.clear || !path.big) return false;
    streamsIn[zone] = (streamsIn[zone] ?? 0) + 1;
    const floor = path.floor;
    const drop = mouth.y - floor;
    for (const spin of [0, Math.PI / 2]) {
      const sheet = new THREE.PlaneGeometry(0.07, drop).toNonIndexed();
      const uv = sheet.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * drop * 0.8);
      sheet.rotateY(spin);
      streams.push(sheet.translate(mouth.x, mouth.y - drop / 2, mouth.z));
    }
    splashes.push(new THREE.Vector3(mouth.x, floor + 0.05, mouth.z));
    return true;
  };

  // Drips: single drops falling from pipe ends, anywhere, each on its own beat.
  const drips: { x: number; y: number; z: number; floor: number; fall: number; period: number; phase: number }[] = [];
  let dripRnd = random(1);
  const drip = (mouth: THREE.Vector3, chance: number) => {
    if (dripRnd() >= chance) return;
    const path = waterPath(mouth);
    if (!path.clear) return;
    const floor = path.floor;
    const fall = Math.sqrt((2 * (mouth.y - floor)) / DRIP_GRAVITY);
    const period = Math.max(fall + SPLASH_TIME + 0.2, 0.9 + dripRnd() * 2.2);
    drips.push({ x: mouth.x, y: mouth.y, z: mouth.z, floor, fall, period, phase: dripRnd() * period });
  };

  for (const piece of boxes) {
    if (piece.size.y < MIN_WALL) continue;
    const rnd = random(hash(piece.id) + 7);
    const x0 = piece.position.x - piece.size.x / 2, x1 = piece.position.x + piece.size.x / 2;
    const z0 = piece.position.z - piece.size.z / 2, z1 = piece.position.z + piece.size.z / 2;
    const y0 = piece.position.y - piece.size.y / 2, y1 = piece.position.y + piece.size.y / 2;
    const high = y1 > 100;
    const more = random(hash(piece.id) + 13);
    dripRnd = random(hash(piece.id) + 29);
    zone = zoneOf.get(piece.id) ?? 0;
    const walls = [
      { yaw: Math.PI / 2, x: x1, z: null, from: z0, to: z1 },
      { yaw: -Math.PI / 2, x: x0, z: null, from: z0, to: z1 },
      { yaw: 0, x: null, z: z1, from: x0, to: x1 },
      { yaw: Math.PI, x: null, z: z0, from: x0, to: x1 },
    ];
    for (const w of walls) {
      const length = w.to - w.from;
      if (length < MIN_WALL) continue;
      // Inside a room: pipes and cracks, but no ivy and no water.
      const indoors = facesRoom(level, w, y0, y1);
      const q = new THREE.Quaternion().setFromAxisAngle(up, w.yaw);
      const out = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const at = (along: number, y: number, off = 0) => new THREE.Vector3(w.x ?? along, y, w.z ?? along).addScaledVector(out, off);
      // Parts of one item are gathered, then kept only if none reaches into a clearance.
      let pending: [THREE.BufferGeometry[], THREE.BufferGeometry][] = [];
      const put = (list: THREE.BufferGeometry[], geo: THREE.BufferGeometry, pos: THREE.Vector3, turn = q) =>
        pending.push([list, geo.applyMatrix4(new THREE.Matrix4().compose(pos, turn, one))]);
      /** Keeps the gathered parts: "strict" when nothing may reach a clearance, "flush" for pipes flat on the wall, "none" for flat things. */
      const commit = (check: "strict" | "flush" | "none" = "strict"): boolean => {
        const ok = check === "none" || pending.every(([, g]) => (g.computeBoundingBox(), !blocked(g.boundingBox!, null, check === "flush")));
        if (ok) for (const [list, g] of pending) list.push(g);
        pending = [];
        return ok;
      };
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
        if (commit(broken ? "strict" : "flush") && broken) drip(at(a, bottom - 0.25, 0.34), 0.7);
      }

      // A broken outlet sticking out of the wall: short, round, with a flange.
      if (rnd() < 0.3) {
        const a = along();
        const y = y0 + 2.5 + rnd() * Math.max(0, y1 - y0 - 4);
        const turn = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 - 0.15));
        put(pipes, new THREE.CylinderGeometry(0.1, 0.1, 0.38, 7).toNonIndexed(), at(a, y, 0.19), turn);
        put(pipes, new THREE.CylinderGeometry(0.16, 0.16, 0.04, 7).toNonIndexed(), at(a, y, 0.02), turn);
        if (commit()) {
          if (pour(at(a, y - 0.03, 0.38))) {
            put(stains, new THREE.PlaneGeometry(0.6, Math.min(5, y - y0)).toNonIndexed(), at(a, y - Math.min(5, y - y0) / 2, 0.02));
            commit("none");
          } else {
            drip(at(a, y - 0.05, 0.36), 0.6);
          }
        }
      }

      // More pipework (user: "even more pipes, also sticking horizontally
      // out of the wall"), from its own random numbers so the rest stays put.
      const floors = Math.max(1, Math.floor((y1 - y0) / 5));
      // Pipe height in a floor: above the windows' arches, below the next band.
      const pipeY = (floor: number) => Math.ceil((y0 + 1) / 5) * 5 + floor * 5 + 3.6;
      const extraDrains = more() < 0.5 ? 1 + (more() < 0.4 ? 1 : 0) : 0;
      for (let i = 0; i < extraDrains; i++) {
        const a = w.from + 1 + more() * (length - 2);
        const top = y1 - 0.6 - more() * 3;
        const len = top - y0;
        if (len < 2) continue;
        const r = 0.05 + more() * 0.04;
        put(pipes, new THREE.CylinderGeometry(r, r, len, 6).toNonIndexed(), at(a, y0 + len / 2, 0.08 + r));
        for (let y = y0 + 0.8; y < top; y += 2.5) put(pipes, new THREE.BoxGeometry(0.18, 0.05, 0.08 + r).toNonIndexed(), at(a, y, (0.08 + r) / 2));
        // An elbow into the wall at the top.
        put(pipes, new THREE.CylinderGeometry(r, r, 0.08 + r, 6).toNonIndexed().rotateX(Math.PI / 2), at(a, top, (0.08 + r) / 2));
        commit("flush");
      }
      // Runs along the wall between floors, on brackets.
      if (more() < 0.75) {
        const runs = 1 + Math.floor(more() * 3);
        for (let i = 0; i < runs; i++) {
          const y = pipeY(Math.floor(more() * floors));
          if (y > y1 - 0.8) continue;
          const len = Math.min(length - 1, 3 + more() * 9);
          const a = w.from + 0.5 + len / 2 + more() * (length - 1 - len);
          const r = 0.05 + more() * 0.05;
          put(pipes, new THREE.CylinderGeometry(r, r, len, 6).toNonIndexed().rotateZ(Math.PI / 2), at(a, y, 0.1 + r));
          for (let d = -len / 2 + 0.4; d < len / 2; d += 1.6) put(pipes, new THREE.BoxGeometry(0.06, 0.18, 0.1 + r).toNonIndexed(), at(a + d, y, (0.1 + r) / 2));
          // Where a run ends it turns into the wall.
          for (const end of [-1, 1]) put(pipes, new THREE.CylinderGeometry(r, r, 0.1 + r, 6).toNonIndexed().rotateX(Math.PI / 2), at(a + (end * len) / 2, y, (0.1 + r) / 2));
          commit();
        }
      }
      // Pipes sticking straight out: thin, ending in an elbow bending down or a broken end.
      const juts = more() < 0.8 ? 1 + Math.floor(more() * 4) : 0;
      for (let i = 0; i < juts; i++) {
        const a = w.from + 1 + more() * (length - 2);
        const y = pipeY(Math.floor(more() * floors)) + (more() - 0.5) * 0.6;
        if (y > y1 - 0.8 || y < y0 + 1.5) continue;
        const len = 0.5 + more() * 0.7;
        const r = 0.05 + more() * 0.04;
        put(pipes, new THREE.CylinderGeometry(r, r, len, 6).toNonIndexed().rotateX(Math.PI / 2), at(a, y, len / 2));
        put(pipes, new THREE.CylinderGeometry(r * 1.7, r * 1.7, 0.04, 6).toNonIndexed().rotateX(Math.PI / 2), at(a, y, 0.02));
        const elbow = more() < 0.55;
        const wantPour = more() < (elbow ? 0.4 : 0.3);
        if (elbow) {
          // Elbow down, open at the bottom.
          put(pipes, new THREE.CylinderGeometry(r, r, 0.4, 6).toNonIndexed(), at(a, y - 0.2 + r, len - r));
        } else {
          // Snapped off: a short piece hanging at an angle from the end.
          put(pipes, new THREE.CylinderGeometry(r, r, 0.25, 6).toNonIndexed().rotateX(Math.PI / 2 + 0.6), at(a, y - 0.06, len + 0.08));
        }
        if (commit()) {
          const mouth = elbow ? at(a, y - 0.4 + r, len - r) : at(a, y - 0.12, len + 0.18);
          if (!(wantPour && pour(mouth))) drip(mouth, 0.5);
        }
      }

      // Ivy hanging from the top (just below the landing trim) or from a sill row.
      const ivyCount = rnd() < 0.45 && !indoors ? 1 + Math.floor(rnd() * 3) : 0;
      for (let i = 0; i < ivyCount; i++) {
        const a = along();
        const width = 0.8 + rnd() * 1.4;
        const hang = Math.min(1.5 + rnd() * 4, y1 - y0 - 1);
        const fromTop = rnd() < 0.6;
        const top = fromTop ? y1 - 0.12 : y0 + Math.floor(rnd() * Math.max(1, (y1 - y0) / 5)) * 5 + 0.85;
        if (top - hang < y0) continue;
        put(leaves, new THREE.PlaneGeometry(width, hang).toNonIndexed(), at(a, top - hang / 2, 0.04 + i * 0.01));
        commit("none");
      }

      // Cracks, more of them high up where the structure gives way.
      const crackCount = rnd() < (high ? 0.8 : 0.4) ? 1 + Math.floor(rnd() * (high ? 3 : 2)) : 0;
      for (let i = 0; i < crackCount; i++) {
        const size = 1.5 + rnd() * 2.5;
        const y = y0 + 1 + rnd() * Math.max(0, y1 - y0 - size - 1);
        const geo = new THREE.PlaneGeometry(size, size).toNonIndexed();
        geo.rotateZ(Math.floor(rnd() * 4) * (Math.PI / 2));
        put(cracks, geo, at(along(), y + size / 2, 0.012));
        commit("none");
      }
    }
  }

  // Lamp posts: an iron arm and a lantern on top; the "-lit" ones still burn.
  for (const post of level.pieces.filter((p) => p.id.startsWith("lamp-"))) {
    const top = post.position.y + post.size.y / 2;
    const head = post.id.includes("-lit") ? lantern(9, 3.5) : deadLantern();
    head.position.set(post.position.x, top - 0.05, post.position.z);
    scene.add(head);
  }

  // Lanterns standing on tables and benches (parts whose id ends in "-top-lantern").
  for (const top of level.pieces.filter((p) => p.id.endsWith("-top-lantern"))) {
    const l = lantern(7, 2.6);
    l.position.set(top.position.x + 0.15, top.position.y + top.size.y / 2, top.position.z);
    scene.add(l);
  }

  // Fountains: the bowl overflows in a thin curtain into the basin, and water
  // runs down the finial into the bowl.
  for (const bowl of level.pieces.filter((p) => p.id.endsWith("-bowl") && p.material === "stone")) {
    const base = bowl.id.slice(0, -"-bowl".length);
    const basin = level.pieces.find((p) => p.id === `${base}-basin`);
    const finial = level.pieces.find((p) => p.id === `${base}-finial`);
    if (!basin) continue;
    const bowlTop = bowl.position.y + bowl.size.y / 2;
    const water = basin.position.y + basin.size.y / 2;
    const fall = (radius: number, top: number, bottom: number) => {
      const h = top - bottom;
      const sheet = new THREE.CylinderGeometry(radius, radius * 1.04, h, 16, 1, true).toNonIndexed();
      const uv = sheet.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * radius * 12, uv.getY(i) * h * 0.8);
      streams.push(sheet.translate(bowl.position.x, bottom + h / 2, bowl.position.z));
    };
    fall(bowl.size.x / 2 + 0.03, bowlTop - 0.02, water + 0.01);
    if (finial) fall(finial.size.x / 2 + 0.02, finial.position.y + finial.size.y / 2 - 0.05, bowlTop);
    // The bowl holds water, and the curtain splashes around the basin.
    const pool = new THREE.CircleGeometry(bowl.size.x / 2 - 0.08, 16).rotateX(-Math.PI / 2).toNonIndexed();
    stains.push(pool.translate(bowl.position.x, bowlTop + 0.01, bowl.position.z));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = bowl.size.x / 2 + 0.05;
      splashes.push(new THREE.Vector3(bowl.position.x + Math.sin(a) * r, water + 0.04, bowl.position.z + Math.cos(a) * r));
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

  // Each drop is a short falling streak; when it lands, a splash shows briefly.
  const HIDDEN = -1000;
  const dropPos = new Float32Array(drips.length * 6);
  const dropGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(dropPos, 3));
  const drops = new THREE.LineSegments(dropGeo, new THREE.LineBasicMaterial({ color: 0xbfccd6, transparent: true, opacity: 0.8 }));
  drops.frustumCulled = false;
  const hitPos = new Float32Array(drips.length * 3);
  const hitGeo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(hitPos, 3));
  const hits = new THREE.Points(hitGeo, new THREE.PointsMaterial({ color: 0xc8d4dc, size: 0.12, transparent: true, opacity: 0.75, depthWrite: false }));
  hits.frustumCulled = false;
  if (drips.length > 0) scene.add(drops, hits);

  return (time) => {
    swayTime.value = time;
    sway.value = 0.05 + 0.12 * windStrength(time);
    waterMap.offset.y = time * 2.2;
    splashMat.opacity = 0.45 + 0.3 * Math.abs(Math.sin(time * 9));
    drips.forEach((d, i) => {
      const t = (time + d.phase) % d.period;
      const falling = t < d.fall;
      const y = d.y - 0.5 * DRIP_GRAVITY * t * t;
      const tail = Math.min(0.14, DRIP_GRAVITY * t * 0.025);
      dropPos.set(falling ? [d.x, y, d.z, d.x, y + tail + 0.02, d.z] : [d.x, HIDDEN, d.z, d.x, HIDDEN, d.z], i * 6);
      const splashing = !falling && t < d.fall + SPLASH_TIME;
      hitPos.set([d.x, splashing ? d.floor + 0.03 : HIDDEN, d.z], i * 3);
    });
    dropGeo.attributes.position.needsUpdate = true;
    hitGeo.attributes.position.needsUpdate = true;
  };
}
