// The title song (user: grungy, gritty, not melodic): the same techno as the
// distant club, but dirty. A dissonant drone grinds under it, the stabs are a
// dark cluster, the whole mix runs through an overdriven, muffled amp, and
// tape hiss and crackle sit on top. It plays on the title screen and carries
// on into the climb, growing fainter and duller with height until it is gone.

import { DARK_CHORD, random } from "../core/audioCore.ts";
import type { Audio, Sound } from "./engine.ts";
import { SIXTEENTH, Techno } from "./techno.ts";

/** Loudness (before the music volume). */
const LEVEL = 0.42;
/** Where in the arrangement it starts: the section with the stabs. */
const START_BAR = 16;
/** The drone: A1 against a slightly flat B-flat, a grinding minor second, Hz. */
const DRONE = [55, 58.1];
/** Crackles per second. */
const CRACKLE_RATE = 9;

/** `level`: 1 in full, 0 silent; it also closes the low-pass. */
export function addTitleSong(sound: Sound): (level: number) => void {
  let update: ((level: number) => void) | null = null;
  sound.whenReady((a) => (update = build(a)));
  return (level) => update?.(level);
}

function build(a: Audio): (level: number) => void {
  const { ctx } = a;
  const rnd = random(666);
  const track = new Techno(ctx, a.noise, { barOffset: START_BAR, chord: DARK_CHORD });

  // The dirty amp: drive into a hard-ish clipper, then a low-pass that breathes slowly.
  const drive = ctx.createGain();
  drive.gain.value = 3.5;
  const clip = ctx.createWaveShaper();
  clip.curve = overdrive(512);
  clip.oversample = "2x";
  const muffle = ctx.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 900;
  muffle.Q.value = 1.2;
  const breathe = ctx.createOscillator();
  breathe.frequency.value = 1 / 24;
  const depth = ctx.createGain();
  depth.gain.value = 350;
  breathe.connect(depth).connect(muffle.frequency);
  breathe.start();
  const rumbleCut = ctx.createBiquadFilter();
  rumbleCut.type = "highpass";
  rumbleCut.frequency.value = 35;
  track.out.connect(drive);

  // The drone: two detuned saws through a slowly sweeping, resonant low-pass.
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.16;
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.Q.value = 7;
  droneFilter.frequency.value = 260;
  const sweep = ctx.createOscillator();
  sweep.frequency.value = 0.07;
  const sweepDepth = ctx.createGain();
  sweepDepth.gain.value = 170;
  sweep.connect(sweepDepth).connect(droneFilter.frequency);
  sweep.start();
  for (const f of DRONE) {
    for (const detune of [-9, 9]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(droneFilter);
      o.start();
    }
  }
  droneFilter.connect(droneGain).connect(drive);
  // The clipper sits near full scale; bring it back down after.
  const trim = ctx.createGain();
  trim.gain.value = 0.28;
  drive.connect(clip).connect(rumbleCut).connect(trim).connect(muffle);

  // Tape: a little hiss and crackle, after the amp so it stays crisp.
  const tape = ctx.createGain();
  tape.gain.value = 0.05;
  const hiss = ctx.createBufferSource();
  hiss.buffer = a.noise;
  hiss.loop = true;
  const hissBand = ctx.createBiquadFilter();
  hissBand.type = "bandpass";
  hissBand.frequency.value = 3500;
  hissBand.Q.value = 0.4;
  const hissLevel = ctx.createGain();
  hissLevel.gain.value = 0.25;
  hiss.connect(hissBand).connect(hissLevel).connect(tape);
  hiss.start();
  const crackle = (t: number) => {
    const n = ctx.createBufferSource();
    n.buffer = a.noise;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4 + rnd() * 1.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.004 + rnd() * 0.006);
    n.connect(g).connect(tape);
    n.start(t, rnd() * 1.9, 0.02);
  };

  const fader = ctx.createGain();
  fader.gain.value = 0;
  muffle.connect(fader);
  tape.connect(fader);
  const dry = ctx.createGain();
  dry.gain.value = LEVEL;
  fader.connect(dry).connect(a.music);
  const wet = ctx.createGain();
  wet.gain.value = LEVEL * 0.4;
  fader.connect(wet).connect(a.reverb);

  let nextCrackle = ctx.currentTime;
  return (level) => {
    const now = ctx.currentTime;
    fader.gain.setTargetAtTime(level, now, 0.8);
    // Fainter is also duller: the song sinks below as the courier climbs.
    muffle.frequency.setTargetAtTime(220 + 680 * level, now, 0.8);
    depth.gain.setTargetAtTime(350 * level, now, 0.8);
    const playing = level > 0 || fader.gain.value > 0.01;
    // Keep scheduling while it fades, so it fades rather than stops.
    track.update(playing);
    if (nextCrackle < now) nextCrackle = now;
    while (playing && nextCrackle < now + SIXTEENTH * 2) {
      crackle(nextCrackle);
      nextCrackle += -Math.log(1 - rnd()) / CRACKLE_RATE;
    }
  };
}

/** An overdrive curve: soft near zero, flattening hard at the top. */
function overdrive(n: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(3 * x) * 0.8 + 0.2 * Math.sign(x) * Math.min(1, Math.abs(x) * 4) ** 2;
  }
  return curve;
}
