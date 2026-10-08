// The distant club (§7): a techno track playing far away behind several
// walls. Only the kick and the bass come through, low-passed and drowned in
// reverb. Each spot is a positional source; closer, it gets a little louder
// and the filter opens a little, then it fades behind the courier. The beat
// runs all the time, so it is always mid-track when it comes into earshot.

import { CLUB_BASS, CLUB_BPM, clubKick, clubMix } from "../core/audioCore.ts";
import type { Vec3 } from "../levels/types.ts";
import { directionPanner, placePanner, type Audio, type Sound } from "./engine.ts";

/** Loudness at the wall (before the ambience volume). */
const LEVEL = 0.55;
/** Notes are scheduled this far ahead, s. */
const AHEAD = 0.3;
const SIXTEENTH = 60 / CLUB_BPM / 4;
/** Bass root: A1, Hz. */
const ROOT = 55;

export interface Club {
  update(courier: Vec3): void;
  /** The kick right now, 0..1 (1 on the beat, fading before the next): the light round the door pulses with it. */
  pulse(timeSeconds: number): number;
}

export function addClub(sound: Sound, spots: readonly Vec3[]): Club {
  let update: ((courier: Vec3) => void) | null = null;
  if (spots.length > 0) sound.whenReady((a) => (update = build(a, spots)));
  return {
    update: (courier) => update?.(courier),
    pulse: (time) => {
      // From the audio clock when there is one, so the light keeps time with the kick.
      const t = sound.context?.currentTime ?? time;
      const sinceKick = t % (SIXTEENTH * 4);
      return Math.exp(-sinceKick * 9);
    },
  };
}

function build(a: Audio, spots: readonly Vec3[]): (courier: Vec3) => void {
  const { ctx } = a;
  // The track: one dry source feeding every spot.
  const track = ctx.createGain();

  const chains = spots.map((spot) => {
    const low1 = ctx.createBiquadFilter();
    low1.type = "lowpass";
    low1.Q.value = 0.9;
    const low2 = ctx.createBiquadFilter();
    low2.type = "lowpass";
    low2.Q.value = 0.5;
    const level = ctx.createGain();
    level.gain.value = 0;
    const pan = directionPanner(ctx);
    placePanner(pan, spot, ctx.currentTime);
    track.connect(low1).connect(low2).connect(level).connect(pan);
    // Mostly echo: it comes round corners and through the stairwells.
    const dry = ctx.createGain();
    dry.gain.value = 0.55;
    pan.connect(dry).connect(a.ambience);
    const wet = ctx.createGain();
    wet.gain.value = 0.9;
    pan.connect(wet).connect(a.reverb);
    return { spot, low1, low2, level };
  });

  const kick = (t: number) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    o.connect(g).connect(track);
    o.start(t);
    o.stop(t + 0.4);
  };
  const bass = (t: number, semitones: number) => {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = ROOT * Math.pow(2, semitones / 12);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(140, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + SIXTEENTH * 1.8);
    o.connect(f).connect(g).connect(track);
    o.start(t);
    o.stop(t + SIXTEENTH * 2);
  };

  /** Next sixteenth to schedule, counted from time 0 of the audio clock. */
  let step = Math.ceil(ctx.currentTime / SIXTEENTH);

  return (courier) => {
    const now = ctx.currentTime;
    let loudest = 0;
    for (const c of chains) {
      const mix = clubMix(Math.hypot(courier.x - c.spot.x, courier.y - c.spot.y, courier.z - c.spot.z));
      loudest = Math.max(loudest, mix.gain);
      c.level.gain.setTargetAtTime(LEVEL * mix.gain, now, 0.25);
      c.low1.frequency.setTargetAtTime(mix.cutoff, now, 0.25);
      c.low2.frequency.setTargetAtTime(mix.cutoff * 1.4, now, 0.25);
    }
    // Out of earshot: keep the beat's place but play nothing.
    if (step * SIXTEENTH < now) step = Math.ceil(now / SIXTEENTH);
    while (step * SIXTEENTH < now + AHEAD) {
      const t = step * SIXTEENTH;
      if (loudest > 0) {
        if (clubKick(step % 16)) kick(t);
        const note = CLUB_BASS[step % CLUB_BASS.length];
        if (note !== null) bass(t, note);
      }
      step++;
    }
  };
}
