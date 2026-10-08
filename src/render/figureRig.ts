// The figures, built from primitives: tall, dark, faceless, with two
// glowing eyes that show through the fog from far away, and the props from
// the concept art. The group's origin is at the figure's feet (sitting: the
// edge it sits on); it looks along -Z, its right is +X.

import * as THREE from "three";
import type { Figure, FigurePose } from "../levels/types.ts";
import { lantern } from "./lantern.ts";

const BODY_COLOR = 0x0e0e10;
const EYE_COLOR = 0xf4ead2;
/** Eye size on screen, pixels, whatever the distance. */
const EYE_PIXELS = 3;
const EYE_SPACING = 0.14;

const body = new THREE.MeshLambertMaterial({ color: BODY_COLOR });
// Eyes ignore fog and light, and keep their size with distance, so they read as two points far off.
const eyeMaterial = new THREE.PointsMaterial({ color: EYE_COLOR, size: EYE_PIXELS, sizeAttenuation: false, fog: false });
const eyeGlow = new THREE.MeshBasicMaterial({ color: EYE_COLOR, fog: false });

/** A tapered column with five sides: narrow at the top, `height` tall, standing on y = 0. */
function trunk(height: number, top: number, bottom: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 5), body);
  m.position.y = height / 2;
  return m;
}

/** Two glowing eyes at height `y`, on a surface `z` in front of the origin (negative). */
function eyes(y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const xs = [-EYE_SPACING / 2, EYE_SPACING / 2];
  for (const x of xs) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), eyeGlow);
    eye.position.set(x, y, z + 0.008);
    g.add(eye);
  }
  const points = new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute(xs.flatMap((x) => [x, y, z]), 3),
  );
  g.add(new THREE.Points(points, eyeMaterial));
  return g;
}

/** Head with eyes, centred on its own origin, looking along -Z. */
function head(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.3), body));
  g.add(eyes(0.03, -0.16));
  return g;
}

function pose(kind: FigurePose): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case "stand": {
      // 2.6 m: a head taller than the courier.
      g.add(trunk(2.2, 0.2, 0.36));
      const h = head();
      h.position.y = 2.4;
      g.add(h);
      break;
    }
    case "sit": {
      // On an edge: the body sits back from it, the legs hang over the drop.
      const torso = trunk(1.5, 0.2, 0.34);
      torso.position.z = 0.35;
      g.add(torso);
      const thighs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.7), body);
      thighs.position.set(0, 0.11, 0.05);
      g.add(thighs);
      const shins = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.9, 0.2), body);
      shins.position.set(0, -0.4, -0.25);
      g.add(shins);
      const h = head();
      h.position.set(0, 1.72, 0.3);
      g.add(h);
      break;
    }
    case "hood": {
      // A tall cone, eyes high up in it.
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3, 6), body);
      cone.position.y = 1.5;
      g.add(cone);
      g.add(eyes(2.3, -0.14));
      break;
    }
    case "hunch": {
      // Bent forward, head hanging low.
      const upper = new THREE.Group();
      upper.add(trunk(1.3, 0.2, 0.32));
      const h = head();
      h.position.set(0, 1.4, -0.1);
      h.rotation.x = -0.45;
      upper.add(h);
      upper.position.y = 1.0;
      upper.rotation.x = -0.35;
      g.add(trunk(1.05, 0.32, 0.36));
      g.add(upper);
      break;
    }
  }
  return g;
}

const wood = new THREE.MeshLambertMaterial({ color: 0x3b2a1c });
const darkWood = new THREE.MeshLambertMaterial({ color: 0x2a1d13 });
const ironProp = new THREE.MeshLambertMaterial({ color: 0x26272b });
const brassProp = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
const leatherProp = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
const paper = new THREE.MeshLambertMaterial({ color: 0xbdb6a4, side: THREE.DoubleSide });
const recess = new THREE.MeshBasicMaterial({ color: 0x050506 });
const rag = new THREE.MeshLambertMaterial({ color: 0x2c2f36, side: THREE.DoubleSide, transparent: true, opacity: 0.6, depthWrite: false });

function box(parent: THREE.Object3D, mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}

/** Fixed pseudo-random numbers, so props look the same every time. */
function random(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Animate = (t: number) => void;

/** The props of a figure, by id (concept art); each may animate with the run clock. */
const PROPS: Record<string, (g: THREE.Group) => Animate | void> = {
  // A door frame in the wall behind, the dark doorway, a lantern on an arm.
  door(g) {
    box(g, recess, 1, 2.2, 0.05, 0, 1.1, 0.38);
    for (const x of [-0.55, 0.55]) box(g, wood, 0.1, 2.3, 0.12, x, 1.15, 0.35);
    box(g, wood, 1.22, 0.12, 0.12, 0, 2.3, 0.35);
    box(g, darkWood, 1.2, 0.06, 0.3, 0, 0.03, 0.24);
    box(g, ironProp, 0.03, 0.03, 0.3, 0.75, 1.95, 0.24);
    const l = lantern();
    l.position.set(0.75, 1.6, 0.1);
    g.add(l);
  },
  // A beam on the ledge beside, a toolbox with a hammer.
  builder(g) {
    box(g, wood, 0.14, 0.14, 2.4, -0.75, 0.07, 1.45, 0.12);
    box(g, wood, 0.12, 0.12, 1.6, -1.05, 0.06, 1.7, -0.08);
    box(g, darkWood, 0.42, 0.2, 0.22, -0.45, 0.1, 0.35);
    box(g, ironProp, 0.03, 0.03, 0.3, -0.45, 0.22, 0.35, 0.3);
    box(g, ironProp, 0.1, 0.05, 0.05, -0.41, 0.23, 0.22, 0.3);
  },
  // A gramophone on a crate, its horn to the wall; a lantern on the floor.
  listener(g) {
    box(g, darkWood, 0.42, 0.42, 0.42, 0.75, 0.21, -0.05, 0.2);
    box(g, wood, 0.3, 0.12, 0.3, 0.75, 0.48, -0.05, 0.2);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 12, 1, true), new THREE.MeshLambertMaterial({ color: 0x8a6a3a, side: THREE.DoubleSide }));
    horn.rotation.x = -Math.PI / 2 - 0.5;
    horn.position.set(0.75, 0.78, -0.3);
    g.add(horn);
    const l = lantern(6, 2.5);
    l.position.set(-0.6, 0, -0.2);
    g.add(l);
  },
  // A stack of suitcases and papers scattered on the roof.
  forgotten(g) {
    box(g, leatherProp, 0.55, 0.18, 0.36, 0.7, 0.09, 0.3, 0.1);
    box(g, darkWood, 0.5, 0.16, 0.32, 0.72, 0.26, 0.28, -0.15);
    box(g, leatherProp, 0.4, 0.14, 0.28, 0.68, 0.41, 0.32, 0.25);
    const rnd = random(7);
    for (let i = 0; i < 7; i++) {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.28), paper);
      sheet.rotation.set(-Math.PI / 2, 0, rnd() * Math.PI * 2);
      sheet.position.set(0.1 + rnd() * 1.3, 0.005 + i * 0.001, -0.3 + rnd() * 1.4);
      g.add(sheet);
    }
  },
  // An arm reaching out, and rags hanging from it and from the body, swaying.
  "let-go"(g) {
    const arm = box(g, body, 0.09, 0.09, 0.85, 0.22, 2.05, -0.38);
    arm.rotation.x = 0.25;
    const strips: THREE.Mesh[] = [];
    const rnd = random(11);
    const hang = (x: number, y: number, z: number, length: number) => {
      const geo = new THREE.PlaneGeometry(0.13, length).translate(0, -length / 2, 0);
      const strip = new THREE.Mesh(geo, rag);
      strip.position.set(x, y, z);
      strip.rotation.y = rnd() * Math.PI;
      g.add(strip);
      strips.push(strip);
    };
    for (let i = 0; i < 4; i++) hang(0.22, 2.1 + i * 0.03, -0.1 - i * 0.2, 0.6 + rnd() * 0.6);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      hang(Math.sin(a) * 0.3, 1.5 + rnd() * 0.4, Math.cos(a) * 0.3, 0.9 + rnd() * 0.6);
    }
    return (t) => strips.forEach((s, i) => (s.rotation.x = Math.sin(t * 1.3 + i * 1.1) * 0.18));
  },
  // A great gear wheel on a frame, turning slowly; a lantern on the floor.
  keeper(g) {
    const gear = new THREE.Group();
    gear.position.set(-1.1, 1.0, -0.6);
    g.add(gear);
    gear.add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 20).rotateZ(Math.PI / 2), ironProp));
    gear.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 10).rotateZ(Math.PI / 2), brassProp));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.14), ironProp);
      tooth.position.set(0, Math.cos(a) * 0.86, Math.sin(a) * 0.86);
      tooth.rotation.x = -a;
      gear.add(tooth);
    }
    for (const z of [-0.6, 0.6]) {
      const post = box(g, ironProp, 0.1, 1.0, 0.1, -1.0, 0.5, -0.6 + z * 0.4);
      post.rotation.x = z * 0.4;
    }
    const l = lantern(6, 2.5);
    l.position.set(-0.4, 0, -0.5);
    g.add(l);
    return (t) => (gear.rotation.x = t * 0.25);
  },
  // Chains hanging from the summit hood above.
  waiting(g) {
    for (const x of [-0.8, 0.8]) {
      for (let i = 0; i < 18; i++) {
        const link = box(g, ironProp, 0.03, 0.14, 0.07, x, 3.85 - i * 0.12, 0.2);
        link.rotation.y = i % 2 === 0 ? 0 : Math.PI / 2;
      }
    }
  },
};

export interface FigureRig {
  group: THREE.Group;
  /** Moves the animated props to run time `t`, s. */
  update(t: number): void;
}

export function createFigure(f: Figure): FigureRig {
  const g = pose(f.pose);
  g.position.set(f.pos.x, f.pos.y, f.pos.z);
  g.rotation.y = (f.facing * Math.PI) / 180;
  const animate = PROPS[f.id]?.(g);
  return { group: g, update: animate ?? (() => {}) };
}
