// Debug free-fly camera: F toggles it. While it flies the game is paused;
// the mouse looks around, WASD moves along the view, Space / Shift move up
// and down, the wheel sets the speed and Ctrl goes faster. It passes
// through walls. Only created with ?debug.

import * as THREE from "three";
import { cameraConfig } from "../config.ts";
import { flyLook, flyMove, flySpeed, lookDirection } from "../core/flyCore.ts";
import type { Vec3 } from "../core/pogoCore.ts";

/** Starting speed, m/s. */
const DEFAULT_SPEED = 10;
/** Speed factor while Ctrl is held. */
const FAST = 4;

export class FlyCamera {
  active = false;
  speed = DEFAULT_SPEED;
  private pos: Vec3 = { x: 0, y: 0, z: 0 };
  private yaw = 0;
  private pitch = 0;
  private readonly held = new Set<string>();
  private mouseDx = 0;
  private mouseDy = 0;
  private wheel = 0;
  private readonly listeners: ((active: boolean) => void)[] = [];
  private readonly camera: THREE.PerspectiveCamera;

  constructor(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    window.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "KeyF" && !e.repeat) this.toggle();
      this.held.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.held.delete(e.code));
    window.addEventListener("blur", () => this.held.clear());
    document.addEventListener("mousemove", (e) => {
      if (!this.active || document.pointerLockElement !== canvas) return;
      this.mouseDx += e.movementX;
      this.mouseDy += e.movementY;
    });
    canvas.addEventListener("wheel", (e) => {
      if (!this.active) return;
      this.wheel += e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY / 3 : e.deltaY / 100;
    });
  }

  /** Called whenever fly mode starts or stops. */
  onChange(fn: (active: boolean) => void): void {
    this.listeners.push(fn);
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    if (active) {
      // Start where the orbit camera is, looking the same way.
      const c = this.camera;
      const dir = c.getWorldDirection(new THREE.Vector3());
      this.pos = { x: c.position.x, y: c.position.y, z: c.position.z };
      this.yaw = Math.atan2(-dir.x, -dir.z);
      this.pitch = (Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) * 180) / Math.PI;
      this.mouseDx = this.mouseDy = this.wheel = 0;
    }
    for (const fn of this.listeners) fn(active);
  }

  toggle(): void {
    this.setActive(!this.active);
  }

  /** The camera's position. */
  position(): Vec3 {
    return { ...this.pos };
  }

  update(frameDt: number): void {
    ({ yaw: this.yaw, pitch: this.pitch } = flyLook(this.yaw, this.pitch, this.mouseDx, this.mouseDy, cameraConfig.sensitivity));
    this.mouseDx = this.mouseDy = 0;
    this.speed = flySpeed(this.speed, this.wheel);
    this.wheel = 0;

    const key = (code: string) => (this.held.has(code) ? 1 : 0);
    const input = {
      forward: key("KeyW") - key("KeyS"),
      right: key("KeyD") - key("KeyA"),
      up: key("Space") - Math.max(key("ShiftLeft"), key("ShiftRight")),
    };
    const fast = this.held.has("ControlLeft") || this.held.has("ControlRight") ? FAST : 1;
    this.pos = flyMove(this.pos, this.yaw, this.pitch, input, this.speed * fast, Math.max(0, frameDt));

    const d = lookDirection(this.yaw, this.pitch);
    this.camera.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.camera.lookAt(this.pos.x + d.x, this.pos.y + d.y, this.pos.z + d.z);
  }
}
