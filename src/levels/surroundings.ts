// Around the structure (user, concept art): it stands on a paved plaza
// raised out of dark floodwater, edged by a low balustrade with iron lamp
// posts. A canal runs round the plaza; beyond it, broken quays and ruined
// buildings stand in the water and fade into the fog. A bridge leads from
// the front of the yard to a ruined street.
//
// The water is a surface like mud: it swallows the bounce, and a full
// charge gets the courier out. The ruins are solid but low and at least
// 26 m from the climb, so they open no skips. Far out, an invisible
// boundary keeps the courier from wandering off forever.

import { block, pole } from "./shapes.ts";
import type { Piece } from "./types.ts";

/** The structure's footprint, m: every zone stands inside it. */
const STRUCTURE = { x0: -44, x1: 24, z0: -114, z1: 8 };
/** Plaza margin around the structure, canal width, quay width, m. */
const MARGIN = 14;
const CANAL = 12;
const QUAY = 10;
const PLAZA = { x0: STRUCTURE.x0 - MARGIN, x1: STRUCTURE.x1 + MARGIN, z0: STRUCTURE.z0 - MARGIN, z1: STRUCTURE.z1 + MARGIN };
const WATER = -2;
/** The bridge from the front of the yard: half its width, m. */
const BRIDGE = 3;
/** The invisible boundary: this far beyond the quays, m. */
const BOUNDARY = 70;

const stone = (p: Piece): Piece => ({ ...p, material: "stone" });

/** Fixed pseudo-random numbers, so the ruins are the same every time. */
function random(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function plaza(): Piece[] {
  const { x0, x1, z0, z1 } = PLAZA;
  const T = 0.4;
  const H = 0.9;
  const pieces: Piece[] = [
    block("plaza", x0, x1, -3, 0, z0, z1),
    // Balustrade on the plaza's edge, open at the bridge.
    stone(block("balustrade-back", x0, x1, 0, H, z0, z0 + T)),
    stone(block("balustrade-left", x0, x0 + T, 0, H, z0 + T, z1)),
    stone(block("balustrade-right", x1 - T, x1, 0, H, z0 + T, z1)),
    stone(block("balustrade-front-left", x0 + T, -BRIDGE, 0, H, z1 - T, z1)),
    stone(block("balustrade-front-right", BRIDGE, x1 - T, 0, H, z1 - T, z1)),
    // The bridge over the canal, with low parapets.
    stone(block("bridge", -BRIDGE, BRIDGE, -0.8, 0, z1, z1 + CANAL)),
    stone(block("bridge-parapet-left", -BRIDGE, -BRIDGE + T, 0, 0.7, z1, z1 + CANAL)),
    stone(block("bridge-parapet-right", BRIDGE - T, BRIDGE, 0, 0.7, z1, z1 + CANAL)),
  ];
  // Iron lamp posts along the edge; two by the bridge still burn.
  const lamps: [string, number, number][] = [
    ["lamp-lit-1", -BRIDGE - 1.2, z1 - 1],
    ["lamp-lit-2", BRIDGE + 1.2, z1 - 1],
    ["lamp-1", x0 + 1, z1 - 1],
    ["lamp-2", x1 - 1, z1 - 1],
    ["lamp-3", x0 + 1, (z0 + z1) / 2],
    ["lamp-4", x1 - 1, (z0 + z1) / 2],
    ["lamp-5", x0 + 1, z0 + 1],
    ["lamp-6", x1 - 1, z0 + 1],
  ];
  for (const [id, x, z] of lamps) pieces.push({ ...pole(id, x, z, 0.16, 0, 3.4), material: "iron" });
  return pieces;
}

/** Quays round the canal, broken in places, and ruins on them and in the water beyond. */
function city(): Piece[] {
  const rnd = random(4242);
  const pieces: Piece[] = [];
  const q0 = { x0: PLAZA.x0 - CANAL, x1: PLAZA.x1 + CANAL, z0: PLAZA.z0 - CANAL, z1: PLAZA.z1 + CANAL };
  // The four sides of the quay ring, each as a run of segments with gaps.
  const sides = [
    { id: "front", along: [q0.x0 - QUAY, q0.x1 + QUAY], across: [q0.z1, q0.z1 + QUAY], alongX: true, outward: 1 },
    { id: "back", along: [q0.x0 - QUAY, q0.x1 + QUAY], across: [q0.z0 - QUAY, q0.z0], alongX: true, outward: -1 },
    { id: "left", along: [q0.z0, q0.z1], across: [q0.x0 - QUAY, q0.x0], alongX: false, outward: -1 },
    { id: "right", along: [q0.z0, q0.z1], across: [q0.x1, q0.x1 + QUAY], alongX: false, outward: 1 },
  ];
  const box = (id: string, alongX: boolean, a0: number, a1: number, c0: number, c1: number, y0: number, y1: number) =>
    alongX ? block(id, a0, a1, y0, y1, c0, c1) : block(id, c0, c1, y0, y1, a0, a1);

  for (const side of sides) {
    let a = side.along[0];
    let n = 0;
    while (a < side.along[1]) {
      const len = Math.min(side.along[1] - a, 12 + rnd() * 18);
      const gap = rnd() < 0.35 ? 4 + rnd() * 6 : 0;
      // The street from the bridge stays open on the front quay.
      const street = side.id === "front" && a < BRIDGE + 2 && a + len > -BRIDGE - 2;
      pieces.push(stone(box(`quay-${side.id}-${++n}`, side.alongX, a, a + len, side.across[0], side.across[1], -3, 0)));
      // Ruins along the quay, set back from the canal, in a row with alleys.
      let b = a + 1;
      while (b < a + len - 4) {
        const w = 5 + rnd() * 8;
        const d = 5 + rnd() * 4;
        const end = Math.min(b + w, a + len - 1);
        if (street && end > -BRIDGE - 3 && b < BRIDGE + 3) {
          b = BRIDGE + 3;
          continue;
        }
        const back = side.outward > 0 ? side.across[1] : side.across[0];
        const c0 = side.outward > 0 ? back - d : back;
        const c1 = side.outward > 0 ? back : back + d;
        const h = 6 + rnd() * 10;
        pieces.push(stone(box(`ruin-${side.id}-${n}-${pieces.length}`, side.alongX, b, end, c0, c1, 0, h)));
        // A broken top: a stump of the next storey along part of it.
        if (rnd() < 0.7) {
          const s0 = b + rnd() * (end - b) * 0.4;
          const s1 = s0 + (end - b) * (0.25 + rnd() * 0.35);
          pieces.push(stone(box(`ruin-top-${side.id}-${n}-${pieces.length}`, side.alongX, s0, Math.min(s1, end), c0, c1, h, h + 1.5 + rnd() * 3)));
        }
        b = end + 1.5 + rnd() * 3;
      }
      a += len + gap;
    }
    // Further out, ruins standing in the water, fading into the fog.
    for (let i = 0; i < 9; i++) {
      const at = side.along[0] + rnd() * (side.along[1] - side.along[0]);
      const out = (side.outward > 0 ? side.across[1] : side.across[0]) + side.outward * (6 + rnd() * 28);
      const w = 6 + rnd() * 10;
      const h = 4 + rnd() * 12;
      const c0 = Math.min(out, out + side.outward * w);
      const c1 = Math.max(out, out + side.outward * w);
      pieces.push(stone(box(`ruin-${side.id}-far-${i}`, side.alongX, at, at + w, c0, c1, -3, h)));
    }
  }
  return pieces;
}

/** Floodwater under everything, and the invisible boundary far out. */
function edges(): Piece[] {
  const water: Piece = { ...block("floodwater", -600, 600, WATER - 1, WATER, -600, 600), surface: "mud", material: "water" };
  const b = {
    x0: PLAZA.x0 - CANAL - QUAY - BOUNDARY,
    x1: PLAZA.x1 + CANAL + QUAY + BOUNDARY,
    z0: PLAZA.z0 - CANAL - QUAY - BOUNDARY,
    z1: PLAZA.z1 + CANAL + QUAY + BOUNDARY,
  };
  const hidden = (p: Piece): Piece => ({ ...p, material: "invisible" });
  return [
    water,
    hidden(block("boundary-front", b.x0, b.x1, WATER, 80, b.z1, b.z1 + 1)),
    hidden(block("boundary-back", b.x0, b.x1, WATER, 80, b.z0 - 1, b.z0)),
    hidden(block("boundary-left", b.x0 - 1, b.x0, WATER, 80, b.z0, b.z1)),
    hidden(block("boundary-right", b.x1, b.x1 + 1, WATER, 80, b.z0, b.z1)),
  ];
}

export const surroundings: Piece[] = [...edges(), ...plaza(), ...city()];
