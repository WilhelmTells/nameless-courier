// Third-person orbit camera: mouse orbit with pointer lock (only while the
// right button is held in mouse control mode), wheel zoom, recenter key,
// spring arm against geometry, tilt during long falls.
// It never turns horizontally by itself: lean is camera-relative.

import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { cameraConfig as cfg } from "../config.ts";
import {
  applyMouse,
  applyZoom,
  clamp,
  moveToward,
  orbitDirection,
  pitchToSeeBelow,
  recenterYaw,
  springArm,
} from "../core/cameraCore.ts";
import type { Vec2 } from "../core/pogoCore.ts";
import { mouseOrbits } from "./input.ts";

/** Closest the spring arm may pull the camera to the focus point, m. */
const MIN_ARM = 0.5;
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

export class OrbitCamera {
  readonly camera: THREE.PerspectiveCamera;
  /** Horizontal facing in radians; read by the pogo to turn lean input into world space. */
  yaw = 0;
  pitch = cfg.pitchDefault;
  distance = cfg.distanceDefault;

  private readonly world: RAPIER.World;
  private probe: RAPIER.Ball;
  private arm = cfg.distanceDefault;
  private focusY: number | null = null;
  private tilt = 0;
  private mouseDx = 0;
  private mouseDy = 0;
  private wheel = 0;
  private recenter = false;

  constructor(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement, world: RAPIER.World) {
    this.camera = camera;
    this.world = world;
    this.probe = new RAPIER.Ball(cfg.collisionRadius);

    canvas.addEventListener("click", () => {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    });
    document.addEventListener("mousemove", (e) => {
      // With mouse controls the mouse leans the stick; it orbits only while the right button is held.
      if (document.pointerLockElement !== canvas || !mouseOrbits()) return;
      this.mouseDx += e.movementX;
      this.mouseDy += e.movementY;
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        // Normalise to notches: line mode reports ~3 per notch, pixel mode ~100.
        this.wheel += e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY / 3 : e.deltaY / 100;
      },
      { passive: false },
    );
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyR" && !(e.target instanceof HTMLInputElement)) this.recenter = true;
    });
  }

  /**
   * Updates the camera once per rendered frame.
   * @param tip interpolated tip position
   * @param groundBelow height of the surface below the tip, or null if none
   * @param moveDir last horizontal movement direction (unit or zero)
   */
  update(frameDt: number, tip: THREE.Vector3, groundBelow: number | null, moveDir: Vec2): void {
    const dt = Math.max(0, frameDt);

    ({ yaw: this.yaw, pitch: this.pitch } = applyMouse(this.yaw, this.pitch, this.mouseDx, this.mouseDy, cfg));
    this.mouseDx = this.mouseDy = 0;
    this.distance = applyZoom(this.distance, this.wheel, cfg);
    this.wheel = 0;
    if (this.recenter) {
      this.yaw = recenterYaw(moveDir) ?? this.yaw;
      this.recenter = false;
    }

    // Vertical follow lags behind the bounce; horizontal follow is exact.
    const targetY = tip.y + cfg.focusHeight;
    this.focusY = this.focusY === null ? targetY : this.focusY + (targetY - this.focusY) * (1 - Math.exp(-dt / cfg.verticalLag));
    const focus = { x: tip.x, y: this.focusY, z: tip.z };

    // Orbit up just enough to keep the surface below the pogo in view.
    const drop = groundBelow === null ? 0 : Math.max(0, this.focusY - groundBelow);
    const needed = pitchToSeeBelow(this.pitch, this.arm, drop, cfg.markerViewAngle, cfg.pitchMax);
    this.tilt = moveToward(this.tilt, needed - this.pitch, cfg.tiltRate * dt);

    const dir = orbitDirection(this.yaw, clamp(this.pitch + this.tilt, cfg.pitchMin, cfg.pitchMax));

    // Spring arm: pull in front of anything between the focus and the camera.
    if (this.probe.radius !== cfg.collisionRadius) this.probe = new RAPIER.Ball(cfg.collisionRadius);
    const hit = this.world.castShape(focus, IDENTITY, dir, this.probe, 0, this.distance, true);
    const allowed = Math.max(MIN_ARM, hit ? hit.time_of_impact : this.distance);
    this.arm = springArm(this.arm, allowed, cfg.pushOutRate, dt);

    this.camera.position.set(focus.x + dir.x * this.arm, focus.y + dir.y * this.arm, focus.z + dir.z * this.arm);
    this.camera.lookAt(focus.x, focus.y, focus.z);
  }
}
