// Easy mode (user): off by default, switched in Settings. With it on,
// getting off the pogo at a rest spot checks the courier in there, and Q or
// the pause menu takes them back after a fall. A run that used it is marked
// easy, and its time is not a best time.

import { SETTINGS_KEY } from "./input.ts";

let enabled = load();

function load(): boolean {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as { easy?: unknown };
    return saved.easy === true;
  } catch {
    return false;
  }
}

export function easyMode(): boolean {
  return enabled;
}

export function setEasyMode(on: boolean): void {
  enabled = on;
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...saved, easy: on }));
  } catch {
    // Storage unavailable or corrupt: the setting lasts until reload.
  }
}
