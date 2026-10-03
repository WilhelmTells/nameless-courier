// All tuning values, in real-world units: metres, seconds, degrees.

/** Simulation rate. The pogo is simulated at a fixed step, whatever the frame rate. */
export const SIM_HZ = 120;

export interface PogoConfig {
  /** Downward acceleration in flight, m/s². */
  gravity: number;
  /** Apex height of the small hops while Space is held, m. */
  idleHopApex: number;
  /** Apex height of a bounce without charge, m. */
  normalApex: number;
  /** Apex height of a fully charged jump, m. */
  chargedApex: number;
  /** Time for the charge to fill from 0 to 1, s. */
  chargeTime: number;
  /** Shape of charge → height: 1 is linear, above 1 eases in, below 1 eases out. */
  chargeCurve: number;
  /** Largest lean of the stick from upright, degrees. */
  maxLean: number;
  /** How fast the lean moves towards the input, degrees per second. */
  leanRate: number;
  /** How fast the lean returns to upright without input, degrees per second. */
  returnRate: number;
  /** Fraction of incoming horizontal velocity kept on launch, 0–1 (momentum). */
  keepHorizontal: number;
  /**
   * Horizontal push from leaning on launch, as a multiple of launch speed ×
   * sin(lean). Leaning against the current motion brakes.
   */
  leanPush: number;
  /** Length of the visual squash on launch, s. Does not affect physics. */
  squashTime: number;
}

export const DEFAULT_POGO: Readonly<PogoConfig> = {
  gravity: 24,
  idleHopApex: 0.95,
  normalApex: 1.0,
  chargedApex: 10,
  chargeTime: 1.2,
  chargeCurve: 1,
  maxLean: 60,
  leanRate: 210,
  returnRate: 240,
  keepHorizontal: 0.6,
  leanPush: 1,
  squashTime: 0.08,
};

/** Live values. The debug panel changes these while the game runs. */
export const pogoConfig: PogoConfig = { ...DEFAULT_POGO };
