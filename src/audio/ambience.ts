// The ambience (§7): wind that grows with height and swells with the gusts
// the cape and the mist show, an electrical hum, distant machinery that
// comes and goes, and now and then a far-off metallic sound. Inside a room
// the wind is mostly shut out and the hum comes closer. The lightning stays
// silent.

import { random, windLevel } from "../core/audioCore.ts";
import { windStrength } from "../render/atmosphere.ts";
import type { Vec3 } from "../levels/types.ts";
import type { Audio, Sound } from "./engine.ts";

type Room = { min: Vec3; max: Vec3 };

/** Peak loudness of each layer (before the ambience volume). */
const LEVEL = { wind: 0.5, whistle: 0.07, hum: 0.025, machine: 0.12, metal: 0.18 };
/** A far-off metallic sound every this many seconds. */
const METAL_EVERY = [9, 26];

const inside = (rooms: readonly Room[], p: Vec3) =>
  rooms.some((r) => p.x > r.min.x && p.x < r.max.x && p.y > r.min.y && p.y < r.max.y && p.z > r.min.z && p.z < r.max.z);

export function addAmbience(sound: Sound, rooms: readonly Room[]): (courier: Vec3, time: number) => void {
  let update: ((courier: Vec3, time: number) => void) | null = null;
  sound.whenReady((a) => (update = build(a, rooms)));
  return (courier, time) => update?.(courier, time);
}

function build(a: Audio, rooms: readonly Room[]): (courier: Vec3, time: number) => void {
  const { ctx } = a;
  const rnd = random(977);
  const noise = (rate = 1) => {
    const src = ctx.createBufferSource();
    src.buffer = a.noise;
    src.loop = true;
    src.playbackRate.value = rate;
    src.start();
    return src;
  };
  const gain = (v = 0) => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };
  const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };

  // Wind: a deep roar and, higher up, a thin whistle; two noise loops so left and right differ.
  const windGain = gain();
  const windBody = filter("lowpass", 400);
  const windBand = filter("bandpass", 500, 0.6);
  const left = ctx.createStereoPanner();
  left.pan.value = -0.6;
  const right = ctx.createStereoPanner();
  right.pan.value = 0.6;
  noise(1).connect(left).connect(windBand);
  noise(0.93).connect(right).connect(windBand);
  windBand.connect(windBody).connect(windGain).connect(a.ambience);
  const whistleGain = gain();
  const whistle = filter("bandpass", 1300, 14);
  noise(1.07).connect(whistle).connect(whistleGain).connect(a.ambience);

  // Hum: mains at 50 Hz with a few harmonics, slightly buzzy.
  const humGain = gain();
  const hum = filter("lowpass", 600);
  for (const [f, v] of [[50, 1], [100, 0.6], [150, 0.35], [250, 0.15]] as const) {
    const o = ctx.createOscillator();
    o.type = f === 50 ? "sine" : "triangle";
    o.frequency.value = f + (rnd() - 0.5) * 0.4;
    const g = gain(v);
    o.connect(g).connect(hum);
    o.start();
  }
  hum.connect(humGain).connect(a.ambience);

  // Machinery, far off: a slow thump and a grinding whir, mostly heard through the reverb.
  const machine = gain();
  const machineOut = filter("lowpass", 260);
  machine.connect(machineOut);
  machineOut.connect(a.ambience);
  const machineSend = gain(0.8);
  machineOut.connect(machineSend).connect(a.reverb);
  const whir = filter("bandpass", 110, 3);
  const whirGain = gain(0.35);
  noise(0.5).connect(whir).connect(whirGain).connect(machine);
  const whirWobble = ctx.createOscillator();
  whirWobble.frequency.value = 0.31;
  const wobbleDepth = gain(0.2);
  whirWobble.connect(wobbleDepth).connect(whirGain.gain);
  whirWobble.start();
  let nextThump = ctx.currentTime + 1;
  const THUMP_EVERY = 1.9;

  const thump = (t: number) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const g = gain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g).connect(machine);
    o.start(t);
    o.stop(t + 0.55);
  };

  // Far-off metal: a struck pipe or a girder, inharmonic partials ringing in the reverb.
  const metalOut = gain(1);
  const metalPan = ctx.createStereoPanner();
  metalOut.connect(metalPan);
  const metalDry = gain(0.25);
  metalPan.connect(metalDry).connect(a.ambience);
  metalPan.connect(a.reverb);
  let nextMetal = ctx.currentTime + 6;

  const clank = (t: number, base: number, level: number) => {
    for (const [ratio, v, decay] of [[1, 1, 1.6], [2.76, 0.5, 1.1], [5.4, 0.3, 0.6], [8.93, 0.15, 0.35]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = base * ratio;
      const g = gain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level * v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
      o.connect(g).connect(metalOut);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
  };

  const set = (p: AudioParam, v: number, smooth = 0.3) => p.setTargetAtTime(v, ctx.currentTime, smooth);

  return (courier, time) => {
    const now = ctx.currentTime;
    const indoors = inside(rooms, courier);
    const strength = windStrength(time);
    const w = windLevel(courier.y, strength, indoors);
    set(windGain.gain, LEVEL.wind * w);
    set(windBand.frequency, 260 + 520 * w);
    set(windBody.frequency, indoors ? 220 : 380 + 900 * w);
    // The whistle only in strong wind, high up.
    set(whistleGain.gain, LEVEL.whistle * Math.max(0, w - 0.45) * 2);
    set(whistle.frequency, 1100 + 700 * strength, 0.6);
    set(humGain.gain, LEVEL.hum * (indoors ? 2.2 : 1));

    // The machinery comes and goes over a few minutes.
    const swell = 0.5 + 0.5 * Math.sin(time * 0.043) * Math.sin(time * 0.017 + 1);
    set(machine.gain, LEVEL.machine * (0.25 + 0.75 * swell) * (indoors ? 1.5 : 1), 1);
    while (nextThump < now + 0.2) {
      thump(Math.max(nextThump, now));
      nextThump += THUMP_EVERY * (rnd() < 0.15 ? 2 : 1);
    }

    if (now > nextMetal) {
      // Sometimes two or three, like something falling down a stairwell.
      const hits = rnd() < 0.3 ? 2 + Math.floor(rnd() * 2) : 1;
      const base = 180 + rnd() * 420;
      metalPan.pan.setValueAtTime(rnd() * 1.6 - 0.8, now);
      for (let i = 0; i < hits; i++) clank(now + i * (0.25 + rnd() * 0.3), base * (1 - i * 0.06), LEVEL.metal * (1 - i * 0.25));
      nextMetal = now + METAL_EVERY[0] + rnd() * (METAL_EVERY[1] - METAL_EVERY[0]);
    }
  };
}
