// Keyboard state for the pogo. Uses physical key codes, so the layout
// (QWERTY, QWERTZ, AZERTY) does not matter.

export interface PogoInput {
  /** Camera-relative lean input: x = right, z = away from the camera. */
  lean: { x: number; z: number };
  /** Space is held. */
  charge: boolean;
}

const held = new Set<string>();

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

export function initInput(): void {
  window.addEventListener("keydown", (e) => {
    if (isTyping(e.target)) return;
    held.add(e.code);
    if (e.code === "Space") e.preventDefault();
  });
  window.addEventListener("keyup", (e) => held.delete(e.code));
  window.addEventListener("blur", () => held.clear());
}

export function readInput(): PogoInput {
  const key = (code: string) => (held.has(code) ? 1 : 0);
  return {
    lean: { x: key("KeyD") - key("KeyA"), z: key("KeyW") - key("KeyS") },
    charge: held.has("Space"),
  };
}
