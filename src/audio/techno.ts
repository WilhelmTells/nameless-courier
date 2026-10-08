// The techno track, generated: kick, clap, open hats, a rolling bass, dub
// chord stabs with an echo and, for the title song, a slow melody. The club
// and the title song both play it; each muffles it its own way. The
// arrangement (audioCore) builds, breaks down and comes back every 48 bars.

import {
  arrangement, CLUB_BASS, CLUB_BPM, clubClap, clubHat, clubKick, LEAD, STAB_CHORD, STAB_STEPS,
} from "../core/audioCore.ts";

export const SIXTEENTH = 60 / CLUB_BPM / 4;
/** Notes are scheduled this far ahead, s. */
const AHEAD = 0.3;
const A1 = 55;
const A3 = 220;
const A4 = 440;

const hz = (base: number, semitones: number) => base * Math.pow(2, semitones / 12);

export class Techno {
  /** Everything comes out here. */
  readonly out: GainNode;
  private readonly ctx: BaseAudioContext;
  private readonly noise: AudioBuffer;
  private readonly withLead: boolean;
  /** Next sixteenth to schedule, counted from time 0 of the audio clock (so every copy keeps the same beat). */
  private step: number;
  private readonly stabIn: GainNode;
  /** Bars added to the clock's: where in the arrangement the track starts. */
  private readonly barOffset: number;

  constructor(ctx: BaseAudioContext, noise: AudioBuffer, withLead: boolean, barOffset = 0) {
    this.barOffset = barOffset;
    this.ctx = ctx;
    this.noise = noise;
    this.withLead = withLead;
    this.out = ctx.createGain();
    this.step = Math.ceil(ctx.currentTime / SIXTEENTH);
    // The stabs echo: a dotted-eighth delay, darker each time round.
    this.stabIn = ctx.createGain();
    this.stabIn.connect(this.out);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = SIXTEENTH * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.45;
    const dark = ctx.createBiquadFilter();
    dark.type = "lowpass";
    dark.frequency.value = 1400;
    this.stabIn.connect(delay).connect(dark).connect(feedback).connect(delay);
    dark.connect(this.out);
  }

  /** Schedules what is due; with `playing` false it only keeps its place in the beat. */
  update(playing: boolean): void {
    const now = this.ctx.currentTime;
    if (this.step * SIXTEENTH < now) this.step = Math.ceil(now / SIXTEENTH);
    while (this.step * SIXTEENTH < now + AHEAD) {
      if (playing) this.play(this.step, this.step * SIXTEENTH);
      this.step++;
    }
  }

  /** The kick right now, 0..1: 1 on the beat, fading before the next (for lights). */
  pulse(): number {
    const t = this.ctx.currentTime;
    const bar = Math.floor(t / (SIXTEENTH * 16)) + this.barOffset;
    if (!arrangement(bar, this.withLead).kick) return 0;
    return Math.exp(-(t % (SIXTEENTH * 4)) * 9);
  }

  private play(step: number, t: number): void {
    const bar = Math.floor(step / 16) + this.barOffset;
    const inBar = step % 16;
    const a = arrangement(bar, this.withLead);
    if (a.kick && clubKick(inBar)) this.kick(t);
    if (a.clap && clubClap(inBar)) this.clap(t);
    if (a.hat && clubHat(inBar)) this.hat(t);
    const note = CLUB_BASS[step % CLUB_BASS.length];
    if (a.bass && note !== null) this.bass(t, note);
    if (a.stab && STAB_STEPS.includes(step % 32)) this.stab(t);
    if (a.lead) {
      const n = LEAD.find(([s]) => s === step % 128);
      if (n) this.lead(t, n[1], n[2] * SIXTEENTH);
    }
  }

  private env(t: number, level: number, decay: number, attack = 0.004): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
    g.connect(this.out);
    return g;
  }

  private osc(t: number, type: OscillatorType, freq: number, to: AudioNode, length: number): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(to);
    o.start(t);
    o.stop(t + length);
    return o;
  }

  private noiseBurst(t: number, to: AudioNode, length: number): void {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    n.connect(to);
    n.start(t, Math.random() * 1.5, length);
  }

  private kick(t: number): void {
    const o = this.osc(t, "sine", 150, this.env(t, 1, 0.38), 0.42);
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
  }

  private clap(t: number): void {
    const band = this.ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1300;
    band.Q.value = 1.5;
    // Three quick hits and a short tail.
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (const [dt, v] of [[0, 0.5], [0.012, 0.4], [0.024, 0.45]] as const) {
      g.gain.setValueAtTime(v, t + dt);
      g.gain.exponentialRampToValueAtTime(0.05, t + dt + 0.01);
    }
    g.gain.setValueAtTime(0.35, t + 0.036);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    g.connect(this.out);
    band.connect(g);
    this.noiseBurst(t, band, 0.22);
  }

  private hat(t: number): void {
    const high = this.ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 6500;
    high.connect(this.env(t, 0.22, 0.09, 0.002));
    this.noiseBurst(t, high, 0.12);
  }

  private bass(t: number, semitones: number): void {
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 4;
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(150, t + 0.12);
    f.connect(this.env(t, 0.42, SIXTEENTH * 1.6, 0.005));
    this.osc(t, "sawtooth", hz(A1, semitones), f, SIXTEENTH * 2);
  }

  private stab(t: number): void {
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 3;
    f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    f.connect(g).connect(this.stabIn);
    for (const n of STAB_CHORD) {
      for (const detune of [-6, 6]) this.osc(t, "sawtooth", hz(A3, n), f, 0.3).detune.value = detune;
    }
  }

  private lead(t: number, semitones: number, length: number): void {
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.06);
    g.gain.setTargetAtTime(0.1, t + 0.06, length * 0.4);
    g.gain.setTargetAtTime(0, t + length, 0.12);
    f.connect(g).connect(this.stabIn);
    const o = this.osc(t, "triangle", hz(A4, semitones), f, length + 0.6);
    const o2 = this.osc(t, "square", hz(A4, semitones - 12), f, length + 0.6);
    o2.detune.value = 4;
    // A slow vibrato that comes in late.
    const vib = this.ctx.createOscillator();
    vib.frequency.value = 5;
    const depth = this.ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(6, t + Math.min(length, 0.8));
    vib.connect(depth);
    depth.connect(o.detune);
    depth.connect(o2.detune);
    vib.start(t);
    vib.stop(t + length + 0.6);
  }
}
