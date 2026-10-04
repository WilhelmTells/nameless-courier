// Run statistics: height, best height, fall count and run time. Heights are
// those of the surfaces bounced from, so they do not flicker with each bounce.

export interface RunStats {
  /** Height of the last surface bounced from, m. */
  height: number;
  /** Highest surface bounced from, m. */
  best: number;
  falls: number;
  /** Highest surface since the last counted fall, m: a fall is measured from here. */
  fallRef: number;
  /** Simulation time of the run, s. */
  time: number;
}

export function newStats(startY: number): RunStats {
  return { height: startY, best: startY, falls: 0, fallRef: startY, time: 0 };
}

/**
 * Updates the stats for a launch from height `y`. Landing more than
 * `fallHeight` below the highest surface since the last fall counts a fall,
 * and the fall is then measured from the new height.
 */
export function onLaunch(stats: RunStats, y: number, fallHeight: number): RunStats {
  const fell = y < stats.fallRef - fallHeight;
  return {
    ...stats,
    height: y,
    best: Math.max(stats.best, y),
    falls: fell ? stats.falls + 1 : stats.falls,
    fallRef: fell ? y : Math.max(stats.fallRef, y),
  };
}

/** Run time as m:ss, or h:mm:ss from one hour. */
export function formatTime(seconds: number): string {
  const s = Math.floor(Math.max(0, seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
