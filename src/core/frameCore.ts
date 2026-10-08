// Timing of the opening and the ending: which lines are shown and how dark
// the screen is, as a function of the time since each began.

/** Opening: first line at 1 s, one more every 3 s, then a pause and a fade into the game. */
export const OPENING_TIMING = { first: 1, gap: 3, hold: 4, fade: 2.5 };

/** Ending: a moment at the summit, the screen darkens, the lines, then the run's stats. */
export const ENDING_TIMING = { wait: 3, dark: 4, first: 1, gap: 3.5, stats: 3 };

export interface OpeningView {
  /** Lines shown. */
  lines: number;
  /** Black over the game, 1 = fully black. */
  black: number;
  /** The game takes over; the opening is gone. */
  done: boolean;
}

export interface EndingView {
  /** Black over the game, 1 = fully black. */
  black: number;
  lines: number;
  stats: boolean;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Lines shown at time `t` when the first appears at `first` and the rest every `gap`. */
export function linesShown(t: number, first: number, gap: number, count: number): number {
  if (t < first) return 0;
  return Math.min(count, Math.floor((t - first) / gap) + 1);
}

/** When the opening's fade begins; skipping jumps here. */
export function openingFadeStart(count: number): number {
  const o = OPENING_TIMING;
  return o.first + (count - 1) * o.gap + o.hold;
}

export function openingView(t: number, count: number): OpeningView {
  const start = openingFadeStart(count);
  return {
    lines: linesShown(t, OPENING_TIMING.first, OPENING_TIMING.gap, count),
    black: 1 - clamp01((t - start) / OPENING_TIMING.fade),
    done: t >= start + OPENING_TIMING.fade,
  };
}

/** When the ending's screen is fully black; from then on it can be skipped. */
export function endingDarkEnd(): number {
  return ENDING_TIMING.wait + ENDING_TIMING.dark;
}

/** When the ending shows the stats; skipping jumps here. */
export function endingStatsAt(count: number): number {
  const e = ENDING_TIMING;
  return endingDarkEnd() + e.first + (count - 1) * e.gap + e.stats;
}

export function endingView(t: number, count: number): EndingView {
  const e = ENDING_TIMING;
  return {
    black: clamp01((t - e.wait) / e.dark),
    lines: linesShown(t - endingDarkEnd(), e.first, e.gap, count),
    stats: t >= endingStatsAt(count),
  };
}
