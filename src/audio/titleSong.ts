// The title song (user): the same techno as the distant club, still
// dampened, as if heard from the next room, but with a slow melody over it.
// It starts with the stabs, the melody comes in after a few bars. It plays
// on the title screen and carries on into the climb, growing fainter and
// duller with height until it is gone (user).

import type { Audio, Sound } from "./engine.ts";
import { Techno } from "./techno.ts";

/** Loudness (before the music volume). */
const LEVEL = 0.5;
/** Where in the arrangement it starts: the section with the stabs. */
const START_BAR = 16;

/** `level`: 1 in full, 0 silent; it also closes the low-pass. */
export function addTitleSong(sound: Sound): (level: number) => void {
  let update: ((level: number) => void) | null = null;
  sound.whenReady((a) => (update = build(a)));
  return (level) => update?.(level);
}

function build(a: Audio): (level: number) => void {
  const { ctx } = a;
  const track = new Techno(ctx, a.noise, true, START_BAR);
  // Dampened: a low-pass that breathes slowly between dull and a little clearer.
  const muffle = ctx.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 900;
  muffle.Q.value = 0.8;
  const breathe = ctx.createOscillator();
  breathe.frequency.value = 1 / 24;
  const depth = ctx.createGain();
  depth.gain.value = 450;
  breathe.connect(depth).connect(muffle.frequency);
  breathe.start();
  const fader = ctx.createGain();
  fader.gain.value = 0;
  track.out.connect(muffle).connect(fader);
  const dry = ctx.createGain();
  dry.gain.value = LEVEL;
  fader.connect(dry).connect(a.music);
  const wet = ctx.createGain();
  wet.gain.value = LEVEL * 0.5;
  fader.connect(wet).connect(a.reverb);

  return (level) => {
    const now = ctx.currentTime;
    fader.gain.setTargetAtTime(level, now, 0.8);
    // Fainter is also duller: the song sinks below as the courier climbs.
    muffle.frequency.setTargetAtTime(250 + 650 * level, now, 0.8);
    depth.gain.setTargetAtTime(450 * level, now, 0.8);
    // Keep scheduling while it fades, so it fades rather than stops.
    track.update(level > 0 || fader.gain.value > 0.01);
  };
}
