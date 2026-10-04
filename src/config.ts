// All tuning values, in real-world units: metres, seconds, degrees.

/** Simulation rate. The pogo is simulated at a fixed step, whatever the frame rate. */
export const SIM_HZ = 120;

/** Losing more than this much height below the highest surface reached counts as a fall, m. */
export const FALL_HEIGHT = 5;

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
  /**
   * The stick turns about this point above the tip (the rider), m: leaning
   * swings the tip instead of the rider. 0 turns it about the tip.
   */
  pivotHeight: number;
  /** Mouse controls: lean change per pixel of mouse movement, degrees. */
  mouseLeanSensitivity: number;
  /** Mouse controls: a lean smaller than this counts as no direction pressed (brakes, no wall kick), degrees. */
  mouseDeadzone: number;
  /** Mouse controls: moving the mouse up leans towards the camera instead of away. */
  mouseInvertY: boolean;
  /** Mouse controls: moving the mouse right leans left instead of right. */
  mouseInvertX: boolean;
  /** Fraction of incoming horizontal velocity kept on launch while steering, 0–1 (momentum). */
  keepHorizontal: number;
  /** Fraction kept when no direction was pressed during the flight: lets the pogo come to rest. */
  keepWithoutInput: number;
  /** A lean pressed during a flight is held until the next contact instead of easing back. */
  holdLeanInAir: boolean;
  /**
   * Horizontal push from leaning on launch, as a multiple of launch speed ×
   * sin(lean). Leaning against the current motion brakes.
   */
  leanPush: number;
  /** Length of the visual squash on launch, s. Does not affect physics. */
  squashTime: number;
  /** Surfaces whose normal is more than this far from up are walls, degrees. */
  wallAngle: number;
  /** Largest angle between stick and surface normal for a bounce on floors and slopes, degrees. */
  floorContactLimit: number;
  /** How far a slope turns the launch towards its normal, 0 (none) – 1 (fully). */
  slopeBlend: number;
  /** Apex of a wall kick as a fraction of the same bounce on a floor. */
  wallKickFactor: number;
  /** Horizontal speed of a wall kick in the pressed direction, m/s. Charge does not change it. */
  wallKickSpeed: number;
  /** A wall kick needs the pressed direction within this angle of the wall's outward normal, degrees. */
  wallKickAngle: number;
  /** Bounciness of a bonk, 0–1. */
  bonkRestitution: number;
  /** Fraction of the speed along the surface kept in a bonk, 0–1. */
  bonkKeep: number;
  /** Slower impacts than this just slide instead of bonking, m/s. */
  bonkMinSpeed: number;
  /** Lean input is ignored for this long after a bonk, s. */
  bonkLockTime: number;
  /** Smallest speed away from a wall after the shaft or body hits it, m/s. */
  wallPushSpeed: number;
  /** Share of the fall height carried into the next floor bounce, 0–1. Holding Space absorbs it. */
  bounceRetain: number;
  /** Highest apex a carried bounce can reach, m. */
  maxCarriedApex: number;
}

export const DEFAULT_POGO: Readonly<PogoConfig> = {
  gravity: 18,
  idleHopApex: 0.95,
  normalApex: 1.0,
  chargedApex: 10,
  chargeTime: 1.2,
  chargeCurve: 1,
  maxLean: 60,
  leanRate: 130,
  returnRate: 240,
  pivotHeight: 1.1,
  mouseLeanSensitivity: 0.15,
  mouseDeadzone: 5,
  mouseInvertY: false,
  mouseInvertX: false,
  keepHorizontal: 0.6,
  keepWithoutInput: 0.2,
  holdLeanInAir: true,
  leanPush: 1,
  squashTime: 0.08,
  wallAngle: 60,
  floorContactLimit: 65,
  slopeBlend: 0.5,
  wallKickFactor: 0.5,
  wallKickSpeed: 6,
  wallKickAngle: 70,
  bonkRestitution: 0.1,
  bonkKeep: 0.3,
  bonkMinSpeed: 1,
  bonkLockTime: 0.3,
  wallPushSpeed: 2,
  bounceRetain: 0.5,
  maxCarriedApex: 5,
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
