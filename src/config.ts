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

export interface CameraConfig {
  /** Mouse look speed, radians per pixel of mouse movement. */
  sensitivity: number;
  /** Mouse up looks down when true. */
  invertY: boolean;
  /** Pitch: camera angle above the horizontal, degrees. */
  pitchDefault: number;
  pitchMin: number;
  pitchMax: number;
  /** Distance from the focus point, m. The mouse wheel zooms between min and max. */
  distanceDefault: number;
  distanceMin: number;
  distanceMax: number;
  /** Distance change per mouse wheel notch, m. */
  zoomStep: number;
  /** The camera looks at this point above the tip, m. */
  focusHeight: number;
  /** Time constant of the vertical follow, s. Smooths the bounce out of the view. */
  verticalLag: number;
  /** Radius of the sphere cast that pulls the camera in front of geometry, m. */
  collisionRadius: number;
  /** How fast the camera moves back out once geometry no longer blocks it, m/s. */
  pushOutRate: number;
  /**
   * Keep the landing marker on screen: the camera orbits up (pitch only, never
   * yaw) so the surface below the pogo stays at most this many degrees from
   * the view centre. Vertical field of view is 60°, so 30 is the frame edge.
   */
  markerViewAngle: number;
  /** How fast that automatic tilt eases in and out, degrees per second. */
  tiltRate: number;
}

export const DEFAULT_CAMERA: Readonly<CameraConfig> = {
  sensitivity: 0.0025,
  invertY: false,
  pitchDefault: 15,
  pitchMin: -10,
  pitchMax: 75,
  distanceDefault: 6.5,
  distanceMin: 4,
  distanceMax: 10,
  zoomStep: 0.6,
  focusHeight: 1.0,
  verticalLag: 0.35,
  collisionRadius: 0.25,
  pushOutRate: 6,
  markerViewAngle: 22,
  tiltRate: 90,
};

/** Live values. The debug panel changes these while the game runs. */
export const cameraConfig: CameraConfig = { ...DEFAULT_CAMERA };
