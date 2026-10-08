// The rain's sound (user): a steady hiss, a softer body under it and single
// drops ticking close by, a little louder in the gusts. Inside a room it
// becomes a muffled drumming on the roof. It has its own volume slider.

import { random } from "../core/audioCore.ts";
import { windStrength } from "../render/atmosphere.ts";
import type { Vec3 } from "../levels/types.ts";
import type { Audio, Sound } from "./engine.ts";

type Room = { min: Vec3; max: Vec3 };

/** Loudness of each layer (before the rain volume). */
const LEVEL = { hiss: 0.16, body: 0.12, drops: 0.06 };
/** Drops are scheduled this far ahead, s. */
const AHEAD = 0.2;
/** Close drops per second. */
const DROP_RATE = 26;

const inside = (rooms: readonly Room[], p: Vec3) =>
  rooms.some((r) => p.x > r.min.x && p.x < r.max.x && p.y > r.min.y && p.y < r.max.y && p.z > r.min.z && p.z < r.max.z);

export function addRainSound(sound: Sound, rooms: readonly Room[]): (courier: Vec3, time: number) => void {
  let update: ((courier: Vec3, time: number) => void) | null = null;
  sound.whenReady((a) => (update = build(a, rooms)));
  return (courier, time) => update?.(courier, time);
}

function build(a: Audio, rooms: readonly Room[]): (courier: Vec3, time: number) => void {
  const { ctx } = a;
  const rnd = random(4711);
  const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };
  const loop = (rate: number, pan: number) => {
    const src = ctx.createBufferSource();
    src.buffer = a.noise;
    src.loop = true;
    src.playbackRate.value = rate;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(p);
    src.start(0, rnd() * 1.5);
    return p;
  };

  // Everything passes one low-pass: open outside, closed indoors (the roof).
  const level = ctx.createGain();
  level.gain.value = 0;
  const roof = filter("lowpass", 12000);
  roof.connect(level).connect(a.rain);

  const hiss = ctx.createGain();
  hiss.gain.value = LEVEL.hiss;
  const hissBand = filter("bandpass", 4200, 0.5);
  loop(1, -0.7).connect(hissBand);
  loop(0.96, 0.7).connect(hissBand);
  hissBand.connect(hiss).connect(roof);

  const body = ctx.createGain();
  body.gain.value = LEVEL.body;
  const bodyBand = filter("bandpass", 900, 0.6);
  loop(0.6, 0).connect(bodyBand).connect(body).connect(roof);

  const dropBus = ctx.createGain();
  dropBus.gain.value = LEVEL.drops;
  dropBus.connect(roof);
  const drop = (t: number) => {
    const n = ctx.createBufferSource();
    n.buffer = a.noise;
    const f = filter("bandpass", 1800 + rnd() * 3500, 6);
    const g = ctx.createGain();
    const peak = 0.3 + rnd() * 0.7;
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.015 + rnd() * 0.02);
    const p = ctx.createStereoPanner();
    p.pan.value = rnd() * 2 - 1;
    n.connect(f).connect(g).connect(p).connect(dropBus);
    n.start(t, rnd() * 1.9, 0.05);
  };

  let nextDrop = ctx.currentTime;
  let fadedIn = false;

  return (courier, time) => {
    const now = ctx.currentTime;
    const indoors = inside(rooms, courier);
    const gust = 0.8 + 0.3 * windStrength(time);
    // Fade in at the start rather than switching on.
    level.gain.setTargetAtTime((indoors ? 0.6 : 1) * gust, now, fadedIn ? 0.4 : 1.5);
    fadedIn = true;
    roof.frequency.setTargetAtTime(indoors ? 650 : 12000, now, 0.3);
    if (nextDrop < now) nextDrop = now;
    while (nextDrop < now + AHEAD) {
      drop(nextDrop);
      nextDrop += (-Math.log(1 - rnd()) / DROP_RATE);
    }
  };
}
