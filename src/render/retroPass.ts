// The retro look (§6): the scene is drawn at a low resolution into a render
// target, then upscaled to the window with hard pixels and ordered dithering
// to a reduced colour depth. The pass also writes the scene's depth, so
// things on the SHARP layer (the landing marker) are drawn afterwards at full
// resolution and are still hidden behind walls.

import * as THREE from "three";
import { lookConfig } from "../config.ts";
import { lowResSize } from "../core/lookCore.ts";

/** Objects on this layer skip the low-resolution pass and are drawn sharp. */
export const SHARP_LAYER = 1;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 size;
  uniform float levels;
  varying vec2 vUv;

  // 4 × 4 Bayer matrix, thresholds in 0..1.
  float bayer(vec2 p) {
    const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    ivec2 i = ivec2(mod(p, 4.0));
    return (m[i.x + i.y * 4] + 0.5) / 16.0;
  }

  vec3 toSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }

  void main() {
    vec2 px = floor(vUv * size);
    vec2 uv = (px + 0.5) / size;
    // Dither in display space, where the steps are even to the eye.
    vec3 c = toSRGB(clamp(texture2D(tColor, uv).rgb, 0.0, 1.0));
    float steps = levels - 1.0;
    // Only the brightness is stepped and dithered, so the colour stays put:
    // stepping each channel alone sprinkled grey fog with coloured pixels.
    float l = max(max(c.r, c.g), c.b);
    float stepped = floor(l * steps + bayer(px)) / steps;
    c *= l > 0.0001 ? stepped / l : 0.0;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    gl_FragDepth = texture2D(tDepth, uv).r;
  }
`;

export class RetroPass {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly material: THREE.ShaderMaterial;
  private readonly post = new THREE.Scene();
  private readonly postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private width = 1;
  private height = 1;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture: new THREE.DepthTexture(1, 1),
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        size: { value: new THREE.Vector2(1, 1) },
        levels: { value: lookConfig.colorLevels },
      },
      vertexShader,
      fragmentShader,
      // Writes the scene's depth everywhere, whatever is in the buffer.
      depthTest: true,
      depthWrite: true,
      depthFunc: THREE.AlwaysDepth,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.post.add(quad);
  }

  /** The window size, CSS pixels. */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    const r = this.renderer;
    if (!lookConfig.pixelated) {
      camera.layers.enable(SHARP_LAYER);
      r.render(scene, camera);
      return;
    }
    const size = lowResSize(this.width, this.height, lookConfig.lines);
    if (size.width !== this.target.width || size.height !== this.target.height) {
      this.target.setSize(size.width, size.height);
    }
    const u = this.material.uniforms;
    (u.size.value as THREE.Vector2).set(size.width, size.height);
    u.levels.value = lookConfig.colorLevels;

    camera.layers.disable(SHARP_LAYER);
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.post, this.postCamera);

    // Sharp things on top, depth-tested against the low-resolution scene.
    // A colour background always clears the screen, so it is taken away for this pass.
    const background = scene.background;
    scene.background = null;
    camera.layers.set(SHARP_LAYER);
    r.autoClear = false;
    r.render(scene, camera);
    r.autoClear = true;
    camera.layers.set(0);
    scene.background = background;
  }
}
