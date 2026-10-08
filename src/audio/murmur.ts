// The figures' voices (§7): while a line is on screen the figure murmurs,
// low and distorted, with the rhythm of speech but no words. Each figure has
// its own pitch; the voice comes from where the figure stands.

import { nextSyllable, random, VOWELS } from "../core/audioCore.ts";
import type { Figure } from "../levels/types.ts";
import { placePanner, type Audio, type Sound } from "./engine.ts";

/** Loudness of the voice (before the effects volume). */
const LEVEL = 0.32;
/** Syllables are scheduled this far ahead, s. */
const AHEAD = 0.25;
/** The voice comes from about head height above the figure's feet, m. */
const MOUTH = 1.5;

/** A figure's own pitch, Hz: low voices, each a little different. */
function voicePitch(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return 78 + (h % 60);
}

/** `talking`: the figure whose line is on screen now, or null. */
export function addMurmur(sound: Sound, figures: readonly Figure[]): (talking: string | null) => void {
  let update: ((talking: string | null) => void) | null = null;
  if (figures.length > 0) sound.whenReady((a) => (update = build(a, figures)));
  return (talking) => update?.(talking);
}

function build(a: Audio, figures: readonly Figure[]): (talking: string | null) => void {
  const { ctx } = a;

  // One voice, moved to whoever talks: a buzzing source through two vowel formants.
  const source = ctx.createOscillator();
  source.type = "sawtooth";
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 5.5;
  const vibratoDepth = ctx.createGain();
  vibratoDepth.gain.value = 2;
  vibrato.connect(vibratoDepth).connect(source.frequency);
  const breath = ctx.createBufferSource();
  breath.buffer = a.noise;
  breath.loop = true;
  const breathLevel = ctx.createGain();
  breathLevel.gain.value = 0.25;

  const f1 = ctx.createBiquadFilter();
  f1.type = "bandpass";
  f1.Q.value = 6;
  const f2 = ctx.createBiquadFilter();
  f2.type = "bandpass";
  f2.Q.value = 9;
  const f2Level = ctx.createGain();
  f2Level.gain.value = 0.6;
  for (const n of [source, breath.connect(breathLevel)]) {
    n.connect(f1);
    n.connect(f2);
  }
  // Distorted and muffled, as if heard through cloth or an old speaker.
  const drive = ctx.createGain();
  drive.gain.value = 6;
  const shaper = ctx.createWaveShaper();
  shaper.curve = softClip(256);
  const muffle = ctx.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 1300;
  f1.connect(drive);
  f2.connect(f2Level).connect(drive);
  drive.connect(shaper).connect(muffle);

  const envelope = ctx.createGain();
  envelope.gain.value = 0;
  const pan = ctx.createPanner();
  pan.panningModel = "equalpower";
  pan.distanceModel = "inverse";
  pan.refDistance = 4;
  pan.rolloffFactor = 1;
  muffle.connect(envelope).connect(pan);
  const out = ctx.createGain();
  out.gain.value = LEVEL;
  pan.connect(out).connect(a.effects);
  const send = ctx.createGain();
  send.gain.value = 0.35;
  out.connect(send).connect(a.reverb);

  source.start();
  vibrato.start();
  breath.start();

  let speaker: string | null = null;
  let base = 100;
  let rnd = random(1);
  let index = 0;
  let nextAt = 0;

  return (talking) => {
    const now = ctx.currentTime;
    if (talking !== speaker) {
      speaker = talking;
      const f = figures.find((g) => g.id === talking);
      if (f) {
        base = voicePitch(f.id);
        placePanner(pan, { x: f.pos.x, y: f.pos.y + MOUTH, z: f.pos.z }, now);
        rnd = random(Math.floor(now * 1000) + 1);
        index = 0;
        nextAt = now + 0.05;
      }
    }
    if (speaker === null) {
      envelope.gain.cancelScheduledValues(now);
      envelope.gain.setTargetAtTime(0, now, 0.05);
      return;
    }
    if (nextAt < now) nextAt = now;
    while (nextAt < now + AHEAD) {
      const s = nextSyllable(rnd, index++);
      const t = nextAt;
      const [v1, v2] = VOWELS[s.vowel];
      // Lower formants for a darker, bigger voice.
      f1.frequency.setTargetAtTime(v1 * 0.85, t, 0.02);
      f2.frequency.setTargetAtTime(v2 * 0.85, t, 0.02);
      source.frequency.setTargetAtTime(base * s.pitch, t, 0.03);
      envelope.gain.setTargetAtTime(1, t, 0.025);
      envelope.gain.setTargetAtTime(0, t + s.length, 0.03);
      nextAt = t + s.length + s.gap + 0.04;
    }
  };
}

/** A soft clipping curve for the wave shaper. */
function softClip(n: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(2.5 * x);
  }
  return curve;
}
