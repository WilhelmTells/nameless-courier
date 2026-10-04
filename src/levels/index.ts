// All levels by id. `?level=<id>` picks one; normal play starts in Zone 1.

import type { Level } from "./types.ts";
import { playground } from "./playground.ts";
import { zone1 } from "./zone1.ts";

export const LEVELS: Readonly<Record<string, Level>> = { zone1, playground };

export const DEFAULT_LEVEL = zone1;

/** The level named by the `level` URL parameter, or the default. */
export function levelFromSearch(search: string): Level {
  const id = new URLSearchParams(search).get("level");
  return (id !== null && Object.hasOwn(LEVELS, id) ? LEVELS[id] : undefined) ?? DEFAULT_LEVEL;
}
