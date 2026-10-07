// All levels by id. `?level=<id>` picks one; normal play is the structure.

import type { Level, Vec3 } from "./types.ts";
import { playground } from "./playground.ts";
import { tower } from "./tower.ts";

export const LEVELS: Readonly<Record<string, Level>> = { tower, playground };

export const DEFAULT_LEVEL = tower;

/** Old level ids that now name another level. Zone 1 became part of the structure. */
export const LEVEL_ALIASES: Readonly<Record<string, string>> = { zone1: "tower" };

export interface TeleportTarget {
  label: string;
  point: Vec3;
}

/** Debug teleport targets: every zone start, then every rest spot (centre of its surface). */
export function teleportTargets(level: Level): TeleportTarget[] {
  const starts = level.zones.length > 0 ? level.zones : [level];
  return [
    ...starts.map((z) => ({ label: `${z.name}: start`, point: z.start })),
    ...level.restSpots.map((r) => ({
      label: `rest: ${r.id}`,
      point: { x: (r.min.x + r.max.x) / 2, y: r.min.y, z: (r.min.z + r.max.z) / 2 },
    })),
  ];
}

/** The level named by the `level` URL parameter, or the default. */
export function levelFromSearch(search: string): Level {
  const param = new URLSearchParams(search).get("level");
  const id = param !== null && Object.hasOwn(LEVEL_ALIASES, param) ? LEVEL_ALIASES[param] : param;
  return (id != null && Object.hasOwn(LEVELS, id) ? LEVELS[id] : undefined) ?? DEFAULT_LEVEL;
}
