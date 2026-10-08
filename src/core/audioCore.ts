// The numbers behind the sound (§7), kept apart from the Web Audio nodes so
// they can be tested: volumes, how the wind grows with height, how the
// distant club comes through the walls, the rush of a long fall.

export interface Volumes {
  /** Everything, 0..1. */
  master: number;
  /** Wind, hum, machinery, 0..1. */
  ambience: number;
  /** The title song and the distant club, 0..1. */
  music: number;
  /** The pogo and the figures, 0..1. */
  effects: number;
  /** The rain, 0..1. */
  rain: number;
}

export const DEFAULT_VOLUMES: Volumes = { master: 0.8, ambience: 0.8, music: 0.8, effects: 0.8, rain: 0.6 };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Volumes from saved settings; anything missing or broken falls back to the default. */
export function parseVolumes(raw: unknown): Volumes {
  const v = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const pick = (key: keyof Volumes) => {
    const x = v[key];
    return typeof x === "number" && Number.isFinite(x) ? clamp01(x) : DEFAULT_VOLUMES[key];
  };
  return { master: pick("master"), ambience: pick("ambience"), music: pick("music"), effects: pick("effects"), rain: pick("rain") };
}

/** Height at which the wind is at its loudest, m. */
export const WIND_FULL_HEIGHT = 140;

/**
 * Wind loudness 0..1 at `height` with the visible wind at `strength` (0..1):
 * a breath near the ground, a gale at the top. Indoors it is mostly shut out.
 */
export function windLevel(height: number, strength: number, indoors: boolean): number {
  const up = clamp01(height / WIND_FULL_HEIGHT);
  const level = (0.15 + 0.85 * up) * (0.35 + 0.65 * clamp01(strength));
  return indoors ? level * 0.2 : level;
}

/** The distant club: silent beyond this distance, m. */
export const CLUB_REACH = 60;
/**
 * Low-pass cutoff far away and right at the wall, Hz (§7: start about 200 Hz;
 * user: open enough near the wall to hear that it is techno).
 */
export const CLUB_CUTOFF = { far: 220, near: 1100 };

/**
 * How the club comes through at `distance` m: its loudness 0..1 and the
 * low-pass cutoff. It grows slowly as the courier comes close and the filter
 * opens a little; it never gets clear.
 */
export function clubMix(distance: number): { gain: number; cutoff: number } {
  const near = clamp01(1 - distance / CLUB_REACH);
  const gain = near * near;
  return { gain, cutoff: CLUB_CUTOFF.far + (CLUB_CUTOFF.near - CLUB_CUTOFF.far) * near * near };
}

/** A fall starts to rush after this far below the peak, m; full at FALL_RUSH.full. */
export const FALL_RUSH = { start: 8, full: 35 };

/** Loudness 0..1 of the air rushing past during a fall `fallen` m below the peak. */
export function fallRush(fallen: number, falling: boolean): number {
  if (!falling) return 0;
  const x = clamp01((fallen - FALL_RUSH.start) / (FALL_RUSH.full - FALL_RUSH.start));
  return x * x;
}

/** Pitch of the spring under charge, Hz: rises with the charge (0..1). */
export function springPitch(charge: number): number {
  return 140 * Math.pow(2, 1.6 * clamp01(charge));
}

/** Loudness 0..1 of a tip impact at `speed` m/s into the surface. */
export function impactLevel(speed: number): number {
  return clamp01(0.25 + speed / 16);
}

/** The club's beat (and the title song's), BPM; sixteenths, a bar of 16. */
export const CLUB_BPM = 124;

/** Bass notes for each sixteenth of the two-bar loop (semitones above A1), or null for a rest. */
export const CLUB_BASS: readonly (number | null)[] = [
  null, null, 0, 0, null, null, 0, null, null, 12, 0, null, null, null, 3, null,
  null, null, 0, 0, null, null, 0, null, null, 12, 5, null, null, 3, 0, null,
];

/** The chord stab: minor seventh on A (semitones above A3); played on these sixteenths of a two-bar loop. */
export const STAB_CHORD: readonly number[] = [0, 3, 7, 10];
export const STAB_STEPS: readonly number[] = [6, 19, 22];

/**
 * The title song's melody over eight bars (128 sixteenths): [step, semitones
 * above A4, length in sixteenths]. A slow, falling line in A minor.
 */
export const LEAD: readonly (readonly [number, number, number])[] = [
  [0, 7, 6], [6, 5, 2], [8, 3, 8],
  [24, 0, 4], [28, 3, 4],
  [32, 7, 6], [38, 10, 2], [40, 7, 8],
  [56, 5, 4], [60, 3, 4],
  [64, 7, 6], [70, 5, 2], [72, 3, 8],
  [88, 0, 4], [92, -2, 4],
  [96, 0, 12], [112, 3, 4], [116, 2, 4], [120, -2, 8],
];

/** What plays in a bar of the track. */
export interface Arrangement {
  kick: boolean;
  bass: boolean;
  hat: boolean;
  clap: boolean;
  stab: boolean;
  lead: boolean;
}

/**
 * The track over time, in eight-bar sections that come round again: it builds
 * from kick and bass, adds hats, clap and stabs, drops the kick in a
 * breakdown, and comes back in full. The melody only plays when `withLead`.
 */
export function arrangement(bar: number, withLead: boolean): Arrangement {
  const section = Math.floor(Math.max(0, bar) / 8) % 6;
  const all = { kick: true, bass: true, hat: true, clap: true, stab: true, lead: withLead };
  switch (section) {
    case 0:
      return { ...all, hat: false, clap: false, stab: false, lead: false };
    case 1:
      return { ...all, clap: false, stab: false, lead: false };
    case 2:
      return { ...all, lead: false };
    case 4:
      // Breakdown: no kick, no bass; the stabs and the melody carry on.
      return { ...all, kick: false, bass: false, hat: false, clap: false };
    default:
      return all;
  }
}

/** True when the kick plays on sixteenth `step`: four to the floor. */
export function clubKick(step: number): boolean {
  return step % 4 === 0;
}

/** True when the clap plays on sixteenth `step` of a bar: on two and four. */
export function clubClap(step: number): boolean {
  return step % 16 === 4 || step % 16 === 12;
}

/** True when the open hat plays on sixteenth `step`: on the off-beats. */
export function clubHat(step: number): boolean {
  return step % 4 === 2;
}

/** Fixed pseudo-random numbers 0..1. */
export function random(seed: number): () => number {
  let s = Math.max(1, Math.floor(seed) % 2147483647);
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export interface Syllable {
  /** Start after the previous syllable's end, s. */
  gap: number;
  length: number;
  /** Pitch relative to the voice, as a factor. */
  pitch: number;
  /** Index into the vowel formants. */
  vowel: number;
}

/** Vowel formants (F1, F2), Hz: a, e, i, o, u, and a schwa. */
export const VOWELS: readonly [number, number][] = [
  [730, 1090], [530, 1840], [300, 2200], [570, 840], [320, 800], [500, 1500],
];

/**
 * The next syllable of a figure's murmur: short words with small pauses, the
 * pitch sinking over a phrase. No real words, only the rhythm of speech.
 */
export function nextSyllable(rnd: () => number, index: number): Syllable {
  const phraseEnd = rnd() < 0.18;
  const word = index % 3 === 2 || rnd() < 0.3;
  return {
    gap: phraseEnd ? 0.35 + rnd() * 0.4 : word ? 0.06 + rnd() * 0.08 : 0.01,
    length: 0.09 + rnd() * 0.14,
    pitch: 0.85 + rnd() * 0.3 - (index % 7) * 0.02,
    vowel: Math.floor(rnd() * VOWELS.length),
  };
}
