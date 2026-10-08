// Settings saved beside the controls: easy mode, the mouse sensitivity and invert Y.
//
// Easy mode (user): off by default, switched in Settings. With it on,
// getting off the pogo at a rest spot checks the courier in there, and Q or
// the pause menu takes them back after a fall. A run that used it is marked
// easy, and its time is not a best time.

import { cameraConfig, DEFAULT_CAMERA, DEFAULT_POGO, pogoConfig } from "../config.ts";
import { sensitivityFactor } from "../core/cameraCore.ts";
import { SETTINGS_KEY } from "./input.ts";

function loadSettings(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function saveSetting(key: string, value: unknown): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), [key]: value }));
  } catch {
    // Storage unavailable: the setting lasts until reload.
  }
}

let enabled = loadSettings().easy === true;

export function easyMode(): boolean {
  return enabled;
}

export function setEasyMode(on: boolean): void {
  enabled = on;
  saveSetting("easy", on);
}

// Mouse sensitivity (user): one slider for both the lean (mouse controls) and
// the camera (keyboard controls), as a factor on the tuned speeds.
let sensitivity = typeof loadSettings().sensitivity === "number" ? (loadSettings().sensitivity as number) : 0.5;
applySensitivity();

function applySensitivity(): void {
  const f = sensitivityFactor(sensitivity);
  pogoConfig.mouseLeanSensitivity = DEFAULT_POGO.mouseLeanSensitivity * f;
  cameraConfig.sensitivity = DEFAULT_CAMERA.sensitivity * f;
}

/** The slider position, 0..1 (0.5 is the default speed). */
export function mouseSensitivity(): number {
  return sensitivity;
}

export function setMouseSensitivity(value: number): void {
  sensitivity = Math.min(1, Math.max(0, value));
  applySensitivity();
  saveSetting("sensitivity", sensitivity);
}

// Invert Y (user): flips the mouse's up and down for both the lean (mouse
// controls) and the camera's pitch (keyboard controls), against the defaults.
let invertY = loadSettings().invertY === true;
applyInvertY();

function applyInvertY(): void {
  pogoConfig.mouseInvertY = invertY ? !DEFAULT_POGO.mouseInvertY : DEFAULT_POGO.mouseInvertY;
  cameraConfig.invertY = invertY ? !DEFAULT_CAMERA.invertY : DEFAULT_CAMERA.invertY;
}

export function invertedY(): boolean {
  return invertY;
}

export function setInvertY(on: boolean): void {
  invertY = on;
  applyInvertY();
  saveSetting("invertY", on);
}
