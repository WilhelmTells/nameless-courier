// The structure: every zone in one world, so a fall from a higher zone lands
// on a lower one. Zones are listed in climbing order.

import type { Level, Zone } from "./types.ts";
import { zone1 } from "./zone1.ts";
import { zone2 } from "./zone2.ts";
import { zone3 } from "./zone3.ts";
import { zone4 } from "./zone4.ts";
import { zone5 } from "./zone5.ts";
import { zone6 } from "./zone6.ts";

const zones: readonly Zone[] = [zone1, zone2, zone3, zone4, zone5, zone6];

export const tower: Level = {
  id: "tower",
  name: "The structure",
  start: zone1.start,
  pieces: zones.flatMap((z) => z.pieces),
  restSpots: zones.flatMap((z) => z.restSpots),
  zones,
};
