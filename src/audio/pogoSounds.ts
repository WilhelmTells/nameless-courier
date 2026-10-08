// The pogo (§7): the spring tightening under charge (its pitch rising with
// the charge), a twang on every bounce that rings out on a charged release,
// the tip striking stone, metal, wood, a trampoline or the mud, a dull thud
// for a bonk, and the air rushing past on a long fall.

import { fallRush, impactLevel, springPitch } from "../core/audioCore.ts";
import type { PogoSound } from "../game/pogo.ts";
import type { Vec3 } from "../levels/types.ts";
import type { Audio, Sound } from "./engine.ts";

/** What the sounds read from the pogo each frame. */
export interface PogoHeard {
  pos: Vec3;
  vel: Vec3;
  /** Charge 0..1 and whether the charge is held. */
  charge: { charge: number; held: boolean };
  riding: boolean;
  /** Contacts since the last frame; the sounds empty the list. */
  sounds: PogoSound[];
}

/** Peak loudness of each sound (before the effects volume). */
const LEVEL = { charge: 0.05, twang: 0.12, impact: 0.5, bonk: 0.6, rush: 0.35 };
/** Share of each strike sent to the reverb. */
const REVERB_SEND = 0.18;

type Strike = "stone" | "metal" | "wood" | "soft" | "trampoline" | "mud";

/** How a contact sounds: the surface type first, then the look of the piece. */
function strikeOf(s: PogoSound): Strike {
  if (s.surface === "trampoline") return "trampoline";
  if (s.surface === "mud" || s.material === "water") return "mud";
  switch (s.material) {
    case "iron":
    case "rust":
    case "barrel":
      return "metal";
    case "wood":
    case "crate":
      return "wood";
    case "cloth":
      return "soft";
    default:
      return "stone";
  }
}

export function addPogoSounds(sound: Sound): (pogo: PogoHeard) => void {
  let update: ((pogo: PogoHeard) => void) | null = null;
  sound.whenReady((a) => (update = build(a)));
  return (pogo) => {
    if (update) update(pogo);
    else pogo.sounds.length = 0;
  };
}

function build(a: Audio): (pogo: PogoHeard) => void {
  const { ctx } = a;
  const out = ctx.createGain();
  out.connect(a.effects);
  const send = ctx.createGain();
  send.gain.value = REVERB_SEND;
  out.connect(send).connect(a.reverb);

  const gain = (v = 0, to: AudioNode = out) => {
    const g = ctx.createGain();
    g.gain.value = v;
    g.connect(to);
    return g;
  };
  const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };
  /** A quick strike envelope on a new gain: up in `attack`, down to nothing over `decay`. */
  const env = (t: number, level: number, decay: number, attack = 0.003, to: AudioNode = out) => {
    const g = gain(0, to);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0005, t + attack + decay);
    return g;
  };
  const tone = (t: number, type: OscillatorType, from: number, to: number, sweep: number, g: AudioNode, stop: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + sweep);
    o.connect(g);
    o.start(t);
    o.stop(t + stop);
  };
  const burst = (t: number, f: BiquadFilterNode, g: AudioNode, length: number) => {
    const n = ctx.createBufferSource();
    n.buffer = a.noise;
    n.connect(f).connect(g);
    n.start(t, Math.random() * 1.5, length);
  };

  const strike = (t: number, kind: Strike, level: number) => {
    switch (kind) {
      case "stone":
        tone(t, "sine", 140, 55, 0.1, env(t, level * 0.9, 0.14), 0.2);
        burst(t, filter("lowpass", 1600), env(t, level * 0.5, 0.05), 0.1);
        break;
      case "metal":
        for (const [r, v, d] of [[1, 0.5, 0.45], [2.4, 0.3, 0.3], [4.1, 0.2, 0.18]] as const) {
          tone(t, "sine", 380 * r, 375 * r, 0.3, env(t, level * v, d), d + 0.05);
        }
        burst(t, filter("highpass", 2500), env(t, level * 0.25, 0.02), 0.05);
        break;
      case "wood":
        tone(t, "triangle", 260, 180, 0.06, env(t, level * 0.6, 0.08), 0.12);
        burst(t, filter("bandpass", 700, 3), env(t, level * 0.8, 0.06), 0.1);
        break;
      case "soft":
        burst(t, filter("lowpass", 350), env(t, level * 0.8, 0.12, 0.01), 0.2);
        break;
      case "trampoline": {
        // A rubbery boing: rising, with a wobble.
        const g = env(t, level * 0.7, 0.35, 0.01);
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(85, t);
        o.frequency.exponentialRampToValueAtTime(240, t + 0.18);
        const wob = ctx.createOscillator();
        wob.frequency.value = 22;
        const depth = ctx.createGain();
        depth.gain.value = 18;
        wob.connect(depth).connect(o.frequency);
        o.connect(g);
        o.start(t);
        wob.start(t);
        o.stop(t + 0.4);
        wob.stop(t + 0.4);
        break;
      }
      case "mud": {
        // A wet slap and a sinking gloop.
        const f = filter("bandpass", 1800, 1.2);
        f.frequency.setValueAtTime(1800, t);
        f.frequency.exponentialRampToValueAtTime(300, t + 0.3);
        burst(t, f, env(t, level * 1.1, 0.3, 0.005), 0.35);
        tone(t + 0.04, "sine", 170, 70, 0.2, env(t + 0.04, level * 0.5, 0.2, 0.02), 0.3);
        break;
      }
    }
  };

  /** The spring: a short twang on every bounce; a charged release rings longer and higher. */
  const twang = (t: number, charge: number) => {
    const f = springPitch(charge) * 2;
    const level = LEVEL.twang * (0.5 + 1.2 * charge);
    const decay = 0.12 + 0.35 * charge;
    const ring = filter("bandpass", f * 2, 5);
    ring.connect(env(t, level, decay));
    tone(t, "sawtooth", f, f * (0.7 - 0.15 * charge), decay, ring, decay + 0.05);
  };

  const bonk = (t: number, level: number) => {
    tone(t, "sine", 85, 42, 0.18, env(t, level, 0.25, 0.005), 0.3);
    burst(t, filter("lowpass", 450), env(t, level * 0.7, 0.12), 0.15);
    // The bag and the staff rattle a moment later.
    burst(t + 0.05, filter("bandpass", 2400, 4), env(t + 0.05, level * 0.12, 0.05), 0.08);
  };

  // The spring under charge: a buzzy tone through a ringing band, with a creak in it.
  const creakBase = gain(1);
  const chargeGain = gain(0, creakBase);
  const chargeBand = filter("bandpass", 500, 6);
  chargeBand.connect(chargeGain);
  const chargeOsc = ctx.createOscillator();
  chargeOsc.type = "sawtooth";
  chargeOsc.connect(chargeBand);
  chargeOsc.start();
  const creak = ctx.createOscillator();
  creak.frequency.value = 17;
  const creakDepth = ctx.createGain();
  creakDepth.gain.value = 0.35;
  creak.connect(creakDepth).connect(creakBase.gain);
  creak.start();

  // The air on a long fall.
  const rushGain = gain();
  const rushBand = filter("bandpass", 600, 0.8);
  const rush = ctx.createBufferSource();
  rush.buffer = a.noise;
  rush.loop = true;
  rush.playbackRate.value = 0.8;
  rush.connect(rushBand).connect(rushGain);
  rush.start();

  let peak = -Infinity;
  let lastY = 0;
  const set = (p: AudioParam, v: number, smooth = 0.04) => p.setTargetAtTime(v, ctx.currentTime, smooth);

  return (pogo) => {
    const t = ctx.currentTime;
    for (const s of pogo.sounds) {
      const level = impactLevel(s.speed);
      if (s.kind === "bonk") bonk(t, LEVEL.bonk * level);
      else {
        strike(t, strikeOf(s), LEVEL.impact * level * (s.kind === "wall" ? 0.8 : s.kind === "land" ? 0.6 : 1));
        if (s.kind !== "land") twang(t, s.charge);
      }
      // A contact ends the fall.
      peak = pogo.pos.y;
    }
    pogo.sounds.length = 0;

    const c = pogo.charge;
    const charging = pogo.riding && c.held && c.charge > 0;
    set(chargeGain.gain, charging ? LEVEL.charge * (0.4 + 0.6 * c.charge) : 0);
    set(chargeOsc.frequency, springPitch(c.charge));
    set(chargeBand.frequency, springPitch(c.charge) * 3);

    // A teleport or a new run is not a fall.
    if (Math.abs(pogo.pos.y - lastY) > 5) peak = pogo.pos.y;
    lastY = pogo.pos.y;
    peak = Math.max(peak, pogo.pos.y);
    const r = fallRush(peak - pogo.pos.y, pogo.vel.y < -1);
    set(rushGain.gain, LEVEL.rush * r, 0.1);
    set(rushBand.frequency, 500 + 1300 * r, 0.1);
  };
}
