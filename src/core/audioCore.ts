// The numbers behind the sound (§7), kept apart from the Web Audio nodes so
// they can be tested: volumes, how the wind grows with height, how the
// distant club comes through the walls, the rush of a long fall.

export interface Volumes {
  /** Everything, 0..1. */
  master: number;
  /** Wind, hum, machinery, the distant club, 0..1. */
  ambience: number;
  /** The pogo and the figures, 0..1. */
  effects: number;
}

export const DEFAULT_VOLUMES: Volumes = { master: 0.8, ambience: 0.8, effects: 0.8 };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Volumes from saved settings; anything missing or broken falls back to the default. */
export function parseVolumes(raw: unknown): Volumes {
  const v = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const pick = (key: keyof Volumes) => {
    const x = v[key];
    return typeof x === "number" && Number.isFinite(x) ? clamp01(x) : DEFAULT_VOLUMES[key];
  };
  return { master: pick("master"), ambience: pick("ambience"), effects: pick("effects") };
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
export const CLUB_REACH = 45;
/** Low-pass cutoff far away and right at the wall, Hz (§7: start about 200 Hz). */
export const CLUB_CUTOFF = { far: 160, near: 420 };

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

/** The club's beat: 124 BPM; sixteenths, a bar of 16. */
export const CLUB_BPM = 124;

/** Bass notes for each sixteenth of the two-bar loop (semitones above A1), or null for a rest. */
export const CLUB_BASS: readonly (number | null)[] = [
  null, null, 0, null, null, null, 0, null, null, null, 0, null, null, null, 3, null,
  null, null, 0, null, null, null, 0, null, null, null, 5, null, null, null, 3, null,
];

/** True when the kick plays on sixteenth `step`: four to the floor. */
export function clubKick(step: number): boolean {
  return step % 4 === 0;
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
