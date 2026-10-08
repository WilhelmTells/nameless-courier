// The figures' speech. A figure talks when the courier comes close: its
// first-visit lines once, and its return lines each time the courier comes
// back after falling below it. Walking away ends the talk; coming back
// starts it again from the first line.

import type { Vec3 } from "./pogoCore.ts";

/** Horizontal distance within which a figure starts talking, m. */
export const TALK_RADIUS = 6;
/** Extra distance before a talk ends, so bounces at the edge do not cut it, m. */
export const TALK_HYSTERESIS = 1.5;
/** The talk zone reaches this far below and above the figure's feet, m. */
export const TALK_BELOW = 2;
export const TALK_ABOVE = 8;
/** Below the figure's feet by more than this counts as having fallen below it, m. */
export const FELL_BELOW = 5;

/** Each line stays for a base time plus a time per character, then a short pause, s. */
export const LINE_TIMING = { first: 0.5, base: 2.5, perChar: 0.05, gap: 0.8 };

export type SpeechSet = "first" | "return";

export interface FigureLines {
  first: readonly string[];
  return: readonly string[];
}

export interface FigureMemory {
  /** The first-visit lines were heard to the end. */
  heard: boolean;
  /** Fell below the figure since its lines were last heard to the end. */
  below: boolean;
}

export interface Talk {
  id: string;
  set: SpeechSet;
  /** Time since the talk began, s. */
  t: number;
}

export interface FigureState {
  memory: Readonly<Record<string, FigureMemory>>;
  talk: Talk | null;
}

export interface FigureSpot {
  id: string;
  pos: Vec3;
}

export const NO_FIGURES: FigureState = { memory: {}, talk: null };

/** How long a line stays on screen, s. */
export function lineDuration(line: string): number {
  return LINE_TIMING.base + LINE_TIMING.perChar * line.length;
}

/** The line shown `t` seconds into a talk (-1 between lines), and whether the talk is over. */
export function speechAt(lines: readonly string[], t: number): { line: number; done: boolean } {
  let start = LINE_TIMING.first;
  for (let i = 0; i < lines.length; i++) {
    const end = start + lineDuration(lines[i]);
    if (t < start) return { line: -1, done: false };
    if (t < end) return { line: i, done: false };
    start = end + LINE_TIMING.gap;
  }
  return { line: -1, done: t >= start - LINE_TIMING.gap };
}

/** Which lines a figure would say now, or null if it has nothing to say. */
export function wantsToTalk(memory: FigureMemory | undefined): SpeechSet | null {
  if (!memory?.heard) return "first";
  return memory.below ? "return" : null;
}

function inZone(f: FigureSpot, pos: Vec3, extra: number): boolean {
  const dy = pos.y - f.pos.y;
  return (
    Math.hypot(pos.x - f.pos.x, pos.z - f.pos.z) <= TALK_RADIUS + extra &&
    dy >= -TALK_BELOW - extra && dy <= TALK_ABOVE + extra
  );
}

/** Advances the figures by one step with the courier at `pos`. */
export function stepFigures(
  state: FigureState,
  figures: readonly FigureSpot[],
  lines: Readonly<Record<string, FigureLines>>,
  pos: Vec3,
  dt: number,
): FigureState {
  let memory = state.memory;
  for (const f of figures) {
    const m = memory[f.id];
    if (m?.heard && !m.below && pos.y < f.pos.y - FELL_BELOW) memory = { ...memory, [f.id]: { ...m, below: true } };
  }

  let talk = state.talk;
  if (talk) {
    const f = figures.find((g) => g.id === talk!.id);
    if (!f || !inZone(f, pos, TALK_HYSTERESIS)) {
      talk = null;
    } else {
      talk = { ...talk, t: talk.t + dt };
      if (speechAt(lines[talk.id]?.[talk.set] ?? [], talk.t).done) {
        memory = { ...memory, [talk.id]: { heard: true, below: false } };
        talk = null;
      }
    }
    return { memory, talk };
  }

  // The nearest figure with something to say starts talking.
  let best: FigureSpot | null = null;
  let bestDist = Infinity;
  for (const f of figures) {
    if (!wantsToTalk(memory[f.id]) || !inZone(f, pos, 0)) continue;
    const d = Math.hypot(pos.x - f.pos.x, pos.z - f.pos.z);
    if (d < bestDist) {
      best = f;
      bestDist = d;
    }
  }
  if (best) talk = { id: best.id, set: wantsToTalk(memory[best.id])!, t: 0 };
  return { memory, talk };
}

/** The line to show for a talk, or "" between lines. */
export function currentLine(talk: Talk | null, lines: Readonly<Record<string, FigureLines>>): string {
  if (!talk) return "";
  const set = lines[talk.id]?.[talk.set] ?? [];
  const { line } = speechAt(set, talk.t);
  return line >= 0 ? set[line] : "";
}
