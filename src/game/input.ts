// Keyboard and mouse state for the pogo. Uses physical key codes, so the
// layout (QWERTY, QWERTZ, AZERTY) does not matter.
//
// Two control modes: "wasd" leans with the keys and the mouse orbits the
// camera; "mouse" leans with the mouse, charges with the left button, and
// orbits the camera only while the right button is held. C switches.
// E gets off the pogo at a rest spot and back on; while standing, the mouse
// orbits the camera in both modes.

export type ControlMode = "wasd" | "mouse";

export interface PogoInput {
  mode: ControlMode;
  /** Camera-relative lean input from the keys: x = right, z = away from the camera. */
  lean: { x: number; z: number };
  /** Space (or, in mouse mode, the left mouse button) is held. */
  charge: boolean;
  /** Mouse movement for the lean since the last read, pixels (mouse mode only). */
  mouse: { dx: number; dy: number };
  /** E was pressed since the last read: get off / get on. */
  toggleRide: boolean;
}

const SETTINGS_KEY = "courier.settings";

const held = new Set<string>();
let mode: ControlMode = loadMode();
let leftHeld = false;
let rightHeld = false;
let mouseDx = 0;
let mouseDy = 0;
let rideToggle = false;
let standing = false;
const listeners: ((mode: ControlMode) => void)[] = [];

function loadMode(): ControlMode {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as { controls?: unknown };
    return saved.controls === "mouse" ? "mouse" : "wasd";
  } catch {
    return "wasd";
  }
}

function saveMode(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...saved, controls: mode }));
  } catch {
    // Storage unavailable or corrupt: the mode lasts until reload.
  }
}

export function controlMode(): ControlMode {
  return mode;
}

export function setControlMode(next: ControlMode): void {
  if (next === mode) return;
  mode = next;
  mouseDx = mouseDy = 0;
  saveMode();
  for (const fn of listeners) fn(mode);
}

export function onControlModeChange(fn: (mode: ControlMode) => void): void {
  listeners.push(fn);
}

/** True while the mouse should orbit the camera. */
export function mouseOrbits(): boolean {
  return mode === "wasd" || rightHeld || standing;
}

/** Tells the input whether the courier is off the pogo (the mouse then only orbits). */
export function setStanding(value: boolean): void {
  if (value && !standing) mouseDx = mouseDy = 0;
  standing = value;
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

export function initInput(canvas: HTMLCanvasElement): void {
  const locked = () => document.pointerLockElement === canvas;
  window.addEventListener("keydown", (e) => {
    if (isTyping(e.target)) return;
    held.add(e.code);
    if (e.code === "Space") e.preventDefault();
    if (e.code === "KeyC" && !e.repeat) setControlMode(mode === "wasd" ? "mouse" : "wasd");
    if (e.code === "KeyE" && !e.repeat) rideToggle = true;
  });
  window.addEventListener("keyup", (e) => held.delete(e.code));
  const releaseAll = () => {
    held.clear();
    leftHeld = rightHeld = false;
  };
  window.addEventListener("blur", releaseAll);
  document.addEventListener("pointerlockchange", () => {
    if (!locked()) releaseAll();
  });

  // Buttons only count once the mouse is captured, so the capturing click does nothing else.
  canvas.addEventListener("mousedown", (e) => {
    if (!locked()) return;
    if (e.button === 0) leftHeld = true;
    if (e.button === 2) rightHeld = true;
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) leftHeld = false;
    if (e.button === 2) rightHeld = false;
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("mousemove", (e) => {
    if (!locked() || mode !== "mouse" || rightHeld || standing) return;
    mouseDx += e.movementX;
    mouseDy += e.movementY;
  });
}

/** Reads the input for one simulation step. Mouse movement is handed out once. */
export function readInput(): PogoInput {
  const key = (code: string) => (held.has(code) ? 1 : 0);
  const mouse = { dx: mouseDx, dy: mouseDy };
  mouseDx = mouseDy = 0;
  const toggleRide = rideToggle;
  rideToggle = false;
  const wasd = mode === "wasd";
  return {
    mode,
    lean: wasd ? { x: key("KeyD") - key("KeyA"), z: key("KeyW") - key("KeyS") } : { x: 0, z: 0 },
    charge: held.has("Space") || (!wasd && leftHeld),
    mouse,
    toggleRide,
  };
}
