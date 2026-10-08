// Placeholder figures, built from primitives: tall, dark, faceless, with two
// glowing eyes that show through the fog from far away. The group's origin
// is at the figure's feet (sitting: the edge it sits on); it looks along -Z.

import * as THREE from "three";
import type { Figure, FigurePose } from "../levels/types.ts";

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

/** Head with eyes, centred on its own origin, looking along -Z. */
function head(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.3), body));
  const eyes = [-EYE_SPACING / 2, EYE_SPACING / 2];
  for (const x of eyes) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), eyeGlow);
    eye.position.set(x, 0.03, -0.152);
    g.add(eye);
  }
  const points = new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute(eyes.flatMap((x) => [x, 0.03, -0.16]), 3),
  );
  g.add(new THREE.Points(points, eyeMaterial));
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

export function createFigure(f: Figure): THREE.Group {
  const g = pose(f.pose);
  g.position.set(f.pos.x, f.pos.y, f.pos.z);
  g.rotation.y = (f.facing * Math.PI) / 180;
  return g;
}
