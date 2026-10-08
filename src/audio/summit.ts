// The summit's sound: as the courier arrives, the rest of the world falls
// away (the ambience and the rain take `calm` too) and a soft, warm chord
// rises, the only major one in the game after all the grinding minor. It
// breathes slowly and has a faint shimmer of air over it. No melody.

import type { Audio, Sound } from "./engine.ts";

/** Loudness at full calm (before the music volume). */
const LEVEL = 0.1;
/** A major, spread wide: A2, E3, C#4, E4, Hz. */
const CHORD = [110, 164.81, 277.18, 329.63];

export function addSummitSound(sound: Sound): (calm: number) => void {
  let update: ((calm: number) => void) | null = null;
  sound.whenReady((a) => (update = build(a)));
  return (calm) => update?.(calm);
}

function build(a: Audio): (calm: number) => void {
  const { ctx } = a;
  const level = ctx.createGain();
  level.gain.value = 0;
  const warm = ctx.createBiquadFilter();
  warm.type = "lowpass";
  warm.frequency.value = 1400;
  warm.connect(level);
  level.connect(a.music);
  const send = ctx.createGain();
  send.gain.value = 0.6;
  level.connect(send).connect(a.reverb);

  CHORD.forEach((f, i) => {
    // Each note breathes at its own slow pace, so the chord shifts but never moves.
    const g = ctx.createGain();
    g.gain.value = 0.25;
    const breath = ctx.createOscillator();
    breath.frequency.value = 0.05 + i * 0.017;
    const depth = ctx.createGain();
    depth.gain.value = 0.15;
    breath.connect(depth).connect(g.gain);
    breath.start();
    for (const [type, detune] of [["sine", -4], ["triangle", 5]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(g);
      o.start();
    }
    g.connect(warm);
  });

  // A faint shimmer of air.
  const air = ctx.createBufferSource();
  air.buffer = a.noise;
  air.loop = true;
  const airBand = ctx.createBiquadFilter();
  airBand.type = "bandpass";
  airBand.frequency.value = 5500;
  airBand.Q.value = 1.5;
  const airLevel = ctx.createGain();
  airLevel.gain.value = 0.04;
  air.connect(airBand).connect(airLevel).connect(level);
  air.start();

  return (calm) => {
    level.gain.setTargetAtTime(LEVEL * calm, ctx.currentTime, 1.5);
  };
}
