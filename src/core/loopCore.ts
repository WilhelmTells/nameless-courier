// Fixed-timestep accumulator: how many simulation steps a frame needs.

export interface LoopAdvance {
  /** Simulation steps to run this frame. */
  steps: number;
  /** Time left over, carried into the next frame, s. */
  accumulator: number;
  /** Blend between the previous and current state for rendering, 0–1. */
  alpha: number;
}

/**
 * Adds a frame's time to the accumulator and returns the steps to run.
 * Frames longer than `maxFrame` are clamped so a stall (tab in background)
 * does not trigger a burst of catch-up steps.
 */
export function advanceLoop(accumulator: number, frameDt: number, step: number, maxFrame = 0.25): LoopAdvance {
  let acc = accumulator + Math.min(Math.max(0, frameDt), maxFrame);
  let steps = 0;
  while (acc >= step) {
    acc -= step;
    steps++;
  }
  return { steps, accumulator: acc, alpha: acc / step };
}
