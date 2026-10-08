// Warm lights: a lantern (a small iron cage around a glowing core, a soft
// halo and a real point light) and the halo on its own. Used by the figures
// and the world.

import * as THREE from "three";

export const LAMP_COLOR = 0xffc27a;

let haloTexture: THREE.Texture | null = null;

/** A soft round glow, drawn once on a canvas. */
function halo(): THREE.Texture {
  if (haloTexture) return haloTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  haloTexture = new THREE.CanvasTexture(canvas);
  return haloTexture;
}

/** A glow sprite `size` m across, additive, seen through light fog. */
export function glow(color: number, size: number, opacity = 0.6): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: halo(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  sprite.scale.setScalar(size);
  return sprite;
}

const iron = new THREE.MeshLambertMaterial({ color: 0x1c1c1f });
const flame = new THREE.MeshBasicMaterial({ color: LAMP_COLOR });

/** A lantern standing on y = 0, with a light reaching `reach` m. */
export function lantern(reach = 7, intensity = 3): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    g.add(m);
  };
  add(new THREE.BoxGeometry(0.16, 0.03, 0.16), iron, 0.015);
  add(new THREE.BoxGeometry(0.1, 0.16, 0.1), flame, 0.12);
  for (const [x, z] of [[-0.065, -0.065], [0.065, -0.065], [-0.065, 0.065], [0.065, 0.065]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.02), iron);
    post.position.set(x, 0.13, z);
    g.add(post);
  }
  add(new THREE.ConeGeometry(0.11, 0.08, 4).rotateY(Math.PI / 4), iron, 0.28);
  const h = glow(LAMP_COLOR, 0.9);
  h.position.y = 0.12;
  g.add(h);
  const light = new THREE.PointLight(LAMP_COLOR, intensity, reach, 1.6);
  light.position.y = 0.2;
  g.add(light);
  return g;
}

/** A lantern that has gone out: the cage and a dark core, no light. */
export function deadLantern(): THREE.Group {
  const g = lantern();
  for (const child of [...g.children]) {
    if (child instanceof THREE.PointLight || child instanceof THREE.Sprite) g.remove(child);
    if (child instanceof THREE.Mesh && child.material === flame) child.material = dark;
  }
  return g;
}

const dark = new THREE.MeshLambertMaterial({ color: 0x2a2620 });
