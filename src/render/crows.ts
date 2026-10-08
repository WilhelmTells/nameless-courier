// Crows (user: "black birds sitting somewhere, and sometimes flying
// away"): the only living things. They sit on parapets, rims, crates and
// ruin tops, alone or in small groups, hop and turn now and then, and burst
// up and fly off when the courier comes close. Later they glide in and
// settle somewhere out of the courier's way. A few circle slowly above,
// a little higher than the courier. Look only.

import * as THREE from "three";
import type { Level, Piece } from "../levels/types.ts";
import type { Vec3 } from "../core/pogoCore.ts";

/** Fixed pseudo-random numbers, so perches are the same every time. */
function random(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SITTING = 26;
const CIRCLING = 3;
/** The courier this close (horizontally, and not far above or below) scares a crow off, m. */
const SCARE = 5;
/** Crows settle this far from the courier: out of the way, but near enough to be seen, m. */
const SETTLE_AWAY = 16;
const SETTLE_NEAR = 45;
/** At the start, this many sit near the yard. */
const NEAR_START = 10;
const FLY_TIME = 6;

const black = new THREE.MeshLambertMaterial({ color: 0x0b0b0d });
const beakMat = new THREE.MeshLambertMaterial({ color: 0x2c2c30 });

interface Bird {
  group: THREE.Group;
  head: THREE.Object3D;
  wings: [THREE.Object3D, THREE.Object3D];
}

/** A small low-poly crow facing -Z, standing on y = 0. */
function makeBird(): Bird {
  const group = new THREE.Group();
  group.scale.setScalar(1.3);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.28), black);
  body.position.set(0, 0.13, 0);
  body.rotation.x = 0.25;
  group.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.22, -0.13);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), black));
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.08, 4).rotateX(-Math.PI / 2), beakMat);
  beak.position.set(0, -0.01, -0.08);
  head.add(beak);
  group.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.16), black);
  tail.position.set(0, 0.1, 0.19);
  tail.rotation.x = -0.35;
  group.add(tail);
  const wing = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.06, 0.17, -0.02);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.15), black);
    w.position.x = side * 0.15;
    pivot.add(w);
    group.add(pivot);
    return pivot;
  };
  return { group, head, wings: [wing(-1), wing(1)] };
}

/** Folded (sitting) or spread and beating at `phase`. */
function setWings(b: Bird, flap: number | null): void {
  const [l, r] = b.wings;
  if (flap === null) {
    // Folded along the sides.
    l.rotation.z = 1.35;
    r.rotation.z = -1.35;
    return;
  }
  const a = Math.sin(flap) * 0.9;
  l.rotation.z = a;
  r.rotation.z = -a;
}

type Mode = "sit" | "flee" | "gone" | "arrive";

interface Crow {
  bird: Bird;
  mode: Mode;
  perch: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  /** Time left in the current mode or until the next small action, s. */
  timer: number;
  hop: number;
  from: THREE.Vector3;
}

const isStill = (p: Piece) =>
  p.shape === "box" && p.motion.kind === "none" && p.rotation.x === 0 && p.rotation.z === 0 && p.material !== "invisible" && p.material !== "water";

/** Spots on top edges of still pieces, at least a metre up: on the climb first, then around it. */
function perches(level: Level): THREE.Vector3[] {
  const climb = new Set(level.zones.flatMap((z) => z.pieces));
  const out: THREE.Vector3[] = [];
  const around: THREE.Vector3[] = [];
  for (const p of level.pieces) {
    if (!isStill(p) || p.rotation.y !== 0) continue;
    const top = p.position.y + p.size.y / 2;
    if (top < 0.6 || p.size.x * p.size.z > 4000) continue;
    const x0 = p.position.x - p.size.x / 2 + 0.2, x1 = p.position.x + p.size.x / 2 - 0.2;
    const z0 = p.position.z - p.size.z / 2 + 0.2, z1 = p.position.z + p.size.z / 2 - 0.2;
    const list = climb.has(p) ? out : around;
    const along = (a0: number, a1: number, at: (t: number) => THREE.Vector3) => {
      for (let t = a0 + 1; t < a1 - 1; t += 7) list.push(at(t));
    };
    along(x0, x1, (t) => new THREE.Vector3(t, top, z0));
    along(x0, x1, (t) => new THREE.Vector3(t, top, z1));
    along(z0, z1, (t) => new THREE.Vector3(x0, top, t));
    along(z0, z1, (t) => new THREE.Vector3(x1, top, t));
    // Small things (crates, barrels' tops are round) take one spot in the middle.
    if (p.size.x < 2.5 && p.size.z < 2.5) list.push(new THREE.Vector3(p.position.x, top, p.position.z));
  }
  // Three in four spots on the climb, the rest on the plaza edge and the ruins.
  const keep = Math.ceil(out.length / 3);
  return [...out, ...around.filter((_, i) => i % Math.max(1, Math.round(around.length / keep)) === 0)];
}

export interface Crows {
  update(courier: Vec3, time: number, dt: number): void;
}

export function addCrows(level: Level, scene: THREE.Scene): Crows {
  const spots = perches(level);
  const rnd = random(777);
  const taken = new Set<number>();
  const crows: Crow[] = [];

  const place = (c: Crow, perch: number) => {
    taken.delete(c.perch);
    c.perch = perch;
    taken.add(perch);
    c.pos.copy(spots[perch]);
  };
  const nearStart = spots.map((p, i) => [p, i] as const).filter(([p]) => p.length() < 45 && p.y < 30).map(([, i]) => i);
  for (let i = 0; i < SITTING && spots.length > 0; i++) {
    // Some come in twos and threes on neighbouring spots; the first few near the yard.
    let perch = i < NEAR_START && nearStart.length > 0 ? nearStart[Math.floor(rnd() * nearStart.length)] : Math.floor(rnd() * spots.length);
    while (taken.has(perch)) perch = (perch + 1) % spots.length;
    const bird = makeBird();
    scene.add(bird.group);
    const crow: Crow = { bird, mode: "sit", perch: -1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: rnd() * Math.PI * 2, timer: rnd() * 4, hop: 0, from: new THREE.Vector3() };
    place(crow, perch);
    crows.push(crow);
    if (rnd() < 0.4 && i + 1 < SITTING) {
      const mate = makeBird();
      scene.add(mate.group);
      const next = (perch + 1) % spots.length;
      if (!taken.has(next) && spots[next].distanceTo(spots[perch]) < 8) {
        const c2: Crow = { bird: mate, mode: "sit", perch: -1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: rnd() * Math.PI * 2, timer: rnd() * 4, hop: 0, from: new THREE.Vector3() };
        place(c2, next);
        crows.push(c2);
        i++;
      } else {
        scene.remove(mate.group);
      }
    }
  }

  // Circlers: slow wide circles a little above the courier.
  const circlers = Array.from({ length: CIRCLING }, (_, i) => {
    const bird = makeBird();
    scene.add(bird.group);
    return { bird, angle: (i / CIRCLING) * Math.PI * 2, radius: 26 + i * 9, speed: 0.12 + i * 0.03, height: 14 + i * 5 };
  });
  let circleY = 20;
  const centre = new THREE.Vector3(-10, 0, -50);

  const courierV = new THREE.Vector3();
  return {
    update(courier, time, dt) {
      courierV.set(courier.x, courier.y, courier.z);
      for (const c of crows) {
        c.timer -= dt;
        const g = c.bird.group;
        switch (c.mode) {
          case "sit": {
            const near = Math.hypot(c.pos.x - courier.x, c.pos.z - courier.z) < SCARE && Math.abs(c.pos.y - courier.y) < 4;
            if (near) {
              // Burst up and away from the courier.
              c.mode = "flee";
              c.timer = FLY_TIME;
              const away = new THREE.Vector3(c.pos.x - courier.x, 0, c.pos.z - courier.z).normalize();
              if (!Number.isFinite(away.x)) away.set(1, 0, 0);
              c.vel.copy(away).multiplyScalar(3.5 + rnd() * 2).setY(3 + rnd() * 1.5);
              taken.delete(c.perch);
              break;
            }
            if (c.timer <= 0) {
              // A small action: turn, hop, or look down.
              const r = rnd();
              if (r < 0.45) c.yaw += (rnd() - 0.5) * 2.4;
              else if (r < 0.7) c.hop = 0.3;
              c.timer = 1.5 + rnd() * 4;
            }
            c.hop = Math.max(0, c.hop - dt);
            const hopY = c.hop > 0 ? Math.sin((c.hop / 0.3) * Math.PI) * 0.12 : 0;
            g.position.set(c.pos.x, c.pos.y + hopY, c.pos.z);
            g.rotation.set(0, c.yaw, 0);
            c.bird.head.rotation.x = Math.sin(time * 0.7 + c.perch) > 0.92 ? 0.6 : 0;
            setWings(c.bird, c.hop > 0 ? time * 30 : null);
            g.visible = true;
            break;
          }
          case "flee": {
            c.vel.y += 1.5 * dt;
            c.pos.addScaledVector(c.vel, dt);
            g.position.copy(c.pos);
            g.rotation.set(-0.3, Math.atan2(-c.vel.x, -c.vel.z), 0);
            setWings(c.bird, time * 22);
            if (c.timer <= 0) {
              c.mode = "gone";
              c.timer = 15 + rnd() * 30;
              g.visible = false;
            }
            break;
          }
          case "gone": {
            if (c.timer > 0) break;
            // Settle somewhere free near where the courier is now, but out of the way.
            let perch = -1;
            for (let tries = 0; tries < 200 && perch < 0; tries++) {
              const p = Math.floor(rnd() * spots.length);
              const d = spots[p].distanceTo(courierV);
              if (!taken.has(p) && d > SETTLE_AWAY && (d < SETTLE_NEAR || tries > 150)) perch = p;
            }
            if (perch < 0) {
              c.timer = 5;
              break;
            }
            place(c, perch);
            const a = rnd() * Math.PI * 2;
            c.from.set(c.pos.x + Math.cos(a) * 18, c.pos.y + 8, c.pos.z + Math.sin(a) * 18);
            c.mode = "arrive";
            c.timer = 3;
            break;
          }
          case "arrive": {
            const t = 1 - Math.max(0, c.timer) / 3;
            const ease = 1 - (1 - t) * (1 - t);
            g.position.lerpVectors(c.from, c.pos, ease);
            g.rotation.set(0, Math.atan2(c.from.x - c.pos.x, c.from.z - c.pos.z), 0);
            setWings(c.bird, t < 0.8 ? time * 16 : null);
            g.visible = true;
            if (c.timer <= 0) {
              c.mode = "sit";
              c.timer = 2 + rnd() * 3;
            }
            break;
          }
        }
      }
      // The circlers drift up and down with the courier, slowly.
      circleY += (courier.y - circleY) * Math.min(1, dt * 0.2);
      for (const k of circlers) {
        k.angle += k.speed * dt;
        const g = k.bird.group;
        g.position.set(centre.x + Math.cos(k.angle) * k.radius, circleY + k.height + Math.sin(time * 0.3 + k.radius) * 3, centre.z + Math.sin(k.angle) * k.radius);
        // Facing along the circle, banked into it.
        g.rotation.set(0, Math.atan2(Math.sin(k.angle), -Math.cos(k.angle)), Math.PI * 0.08);
        // Mostly gliding, a few beats now and then.
        setWings(k.bird, Math.sin(time * 0.5 + k.radius) > 0.6 ? time * 14 : 0.25);
      }
    },
  };
}
