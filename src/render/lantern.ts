// Warm lights: a lantern (a small iron cage around a glowing core, a soft
// halo and a real point light) and the halo on its own. Used by the figures
// and the world.

import * as THREE from "three";

export const LAMP_COLOR = 0xffc27a;

let haloTexture: THREE.Texture | null = null;

/** Every burning lantern made so far (moths gather round them). */
export const litLanterns: THREE.Object3D[] = [];

/**
 * A white texture whose alpha is `alpha(x, y)` (0..1, coordinates 0..1).
 * Computed pixel by pixel: Safari dithers canvas gradients with coloured
 * noise, which showed as coloured dots in the moon and the mist.
 */
export function alphaTexture(size: number, alpha: (x: number, y: number) => number): THREE.Texture {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = (j * size + i) * 4;
      data[k] = data[k + 1] = data[k + 2] = 255;
      data[k + 3] = Math.round(255 * Math.min(1, Math.max(0, alpha((i + 0.5) / size, (j + 0.5) / size))));
    }
  }
  const t = new THREE.DataTexture(data, size, size);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** A soft round glow: bright core, falling to nothing at the edge. */
function halo(): THREE.Texture {
  if (haloTexture) return haloTexture;
  haloTexture = alphaTexture(128, (x, y) => {
    const r = Math.hypot(x - 0.5, y - 0.5) * 2;
    return r < 0.25 ? 1 - (r / 0.25) * 0.55 : 0.45 * Math.max(0, 1 - (r - 0.25) / 0.75);
  });
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
  litLanterns.push(g);
  return g;
}

/** A lantern that has gone out: the cage and a dark core, no light. */
export function deadLantern(): THREE.Group {
  const g = lantern();
  litLanterns.pop();
  for (const child of [...g.children]) {
    if (child instanceof THREE.PointLight || child instanceof THREE.Sprite) g.remove(child);
    if (child instanceof THREE.Mesh && child.material === flame) child.material = dark;
  }
  return g;
}

const dark = new THREE.MeshLambertMaterial({ color: 0x2a2620 });
