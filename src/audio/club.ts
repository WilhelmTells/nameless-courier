// The distant club (§7): a techno track playing far away behind the walls.
// Muffled, but open enough near a wall to hear that it is techno (user):
// kick, clap, hats, a rolling bass and dub stabs, building and breaking
// down over a few minutes. It plays in several spots through the climb;
// each is a positional source that gets louder and opens a little as the
// courier comes close, then fades behind them. The beat runs all the time,
// so it is always mid-track when it comes into earshot.

import { clubMix } from "../core/audioCore.ts";
import type { Vec3 } from "../levels/types.ts";
import { directionPanner, placePanner, type Audio, type Sound } from "./engine.ts";
import { Techno } from "./techno.ts";

/** Loudness at the wall (before the music volume). */
const LEVEL = 0.6;

export interface Club {
  /** `audible`: false in menus, where the title song plays instead. */
  update(courier: Vec3, audible: boolean): void;
  /** The kick right now, 0..1: the light round the sealed door pulses with it. */
  pulse(): number;
}

export function addClub(sound: Sound, spots: readonly Vec3[]): Club {
  let built: { update: (courier: Vec3, audible: boolean) => void; track: Techno } | null = null;
  if (spots.length > 0) sound.whenReady((a) => (built = build(a, spots)));
  return {
    update: (courier, audible) => built?.update(courier, audible),
    pulse: () => built?.track.pulse() ?? 0.5,
  };
}

function build(a: Audio, spots: readonly Vec3[]): { update: (courier: Vec3, audible: boolean) => void; track: Techno } {
  const { ctx } = a;
  const track = new Techno(ctx, a.noise);
  const fader = ctx.createGain();
  track.out.connect(fader);

  const chains = spots.map((spot) => {
    const low1 = ctx.createBiquadFilter();
    low1.type = "lowpass";
    low1.Q.value = 0.9;
    const low2 = ctx.createBiquadFilter();
    low2.type = "lowpass";
    low2.Q.value = 0.5;
    const level = ctx.createGain();
    level.gain.value = 0;
    const pan = directionPanner(ctx);
    placePanner(pan, spot, ctx.currentTime);
    fader.connect(low1).connect(low2).connect(level).connect(pan);
    // Much of it is echo: it comes round corners and through the stairwells.
    const dry = ctx.createGain();
    dry.gain.value = 0.7;
    pan.connect(dry).connect(a.music);
    const wet = ctx.createGain();
    wet.gain.value = 0.6;
    pan.connect(wet).connect(a.reverb);
    return { spot, low1, low2, level };
  });

  const update = (courier: Vec3, audible: boolean) => {
    const now = ctx.currentTime;
    let loudest = 0;
    for (const c of chains) {
      const mix = clubMix(Math.hypot(courier.x - c.spot.x, courier.y - c.spot.y, courier.z - c.spot.z));
      loudest = Math.max(loudest, mix.gain);
      c.level.gain.setTargetAtTime(LEVEL * mix.gain, now, 0.25);
      c.low1.frequency.setTargetAtTime(mix.cutoff, now, 0.25);
      c.low2.frequency.setTargetAtTime(mix.cutoff * 1.4, now, 0.25);
    }
    fader.gain.setTargetAtTime(audible ? 1 : 0, now, 0.6);
    // Out of earshot it keeps its place in the beat but plays nothing.
    track.update(audible && loudest > 0);
  };
  return { update, track };
}
