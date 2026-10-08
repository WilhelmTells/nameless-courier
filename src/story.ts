// All text in the game: the opening before a new run, the ending at the
// summit, and the figures' lines. One entry per line on screen.

import type { FigureLines } from "./core/figureCore.ts";

export const OPENING: readonly string[] = [
  "I have a parcel.",
  "There was a name on it once. The rain took it, or the years did.",
  "I don't remember who gave it to me. I don't remember who it's for.",
  "But a parcel is meant for someone. So someone must be there.",
  "Everything down here is empty. The only way left to look is up.",
];

export const ENDING: readonly string[] = [
  "This is the top. There is nowhere further to go.",
  "I thought there would be a door. A hand. A name.",
  "There is only the wind.",
  "I could open it. I won't. It was never mine.",
  "I'll set it down here, where someone would look.",
  "I'll wait a little while.",
];

/**
 * What each figure says: first-visit lines, and return lines for when the
 * courier comes back after falling below it. Keyed by the figure ids in the
 * level data.
 */
export const FIGURE_LINES: Readonly<Record<string, FigureLines>> = {
  door: placeholder("the one by the door"),
  builder: placeholder("the builder"),
  listener: placeholder("the listener"),
  forgotten: placeholder("the one who forgot"),
  keeper: placeholder("the keeper"),
  "let-go": placeholder("the one who let go"),
  waiting: placeholder("the one who waits"),
};

/** Stand-in lines until the real ones are written. */
function placeholder(name: string): FigureLines {
  return {
    first: [1, 2, 3].map((n) => `[${name}: first visit, line ${n}]`),
    return: [1, 2].map((n) => `[${name}: return, line ${n}]`),
  };
}
