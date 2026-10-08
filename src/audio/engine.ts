// The sound engine: one AudioContext, made on the first click or key press
// (browsers, Safari above all, only start audio from a user gesture). Every
// sound is generated with the Web Audio API (§7); there are no audio files.
//
// Three buses end in the master: ambience (wind, hum, machinery, the distant
// club), effects (the pogo, the figures), and a shared reverb that both can
// send to. While a menu is open the effects fall silent and the ambience
// stays, a little quieter.

import * as THREE from "three";
import { DEFAULT_VOLUMES, parseVolumes, type Volumes } from "../core/audioCore.ts";
import { SETTINGS_KEY } from "../game/input.ts";

/** Ambience level while a menu is open (the effects are silent). */
const MENU_AMBIENCE = 0.6;
/** Length of the reverb's tail, s. */
const REVERB_TIME = 2.8;

function loadVolumes(): Volumes {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as { volumes?: unknown };
    return parseVolumes(saved.volumes);
  } catch {
    return { ...DEFAULT_VOLUMES };
  }
}

function saveVolumes(volumes: Volumes): void {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...saved, volumes }));
  } catch {
    // Storage unavailable or corrupt: the volumes last until reload.
  }
}

/** Everything a sound needs once the context exists. */
export interface Audio {
  ctx: AudioContext;
  ambience: AudioNode;
  effects: AudioNode;
  reverb: AudioNode;
  /** Two seconds of white noise, to loop or cut from. */
  noise: AudioBuffer;
}

export class Sound {
  private audio: Audio | null = null;
  private master: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private menuAmbience: GainNode | null = null;
  private menuEffects: GainNode | null = null;
  private volumes = loadVolumes();
  private inMenu = true;
  private readyCallbacks: ((a: Audio) => void)[] = [];

  constructor() {
    // The first gesture anywhere starts the sound.
    const start = () => this.start();
    window.addEventListener("pointerdown", start, true);
    window.addEventListener("keydown", start, true);
    // Hidden tab: no sound in the background.
    document.addEventListener("visibilitychange", () => {
      const ctx = this.audio?.ctx;
      if (!ctx) return;
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
  }

  /** Runs `build` once the context exists (now, if it already does). */
  whenReady(build: (a: Audio) => void): void {
    if (this.audio) build(this.audio);
    else this.readyCallbacks.push(build);
  }

  get context(): AudioContext | null {
    return this.audio?.ctx ?? null;
  }

  getVolumes(): Volumes {
    return { ...this.volumes };
  }

  setVolumes(volumes: Volumes): void {
    this.volumes = parseVolumes(volumes);
    saveVolumes(this.volumes);
    this.applyLevels();
  }

  /** A menu is open: the effects fall silent, the ambience gets quieter. */
  setMenu(inMenu: boolean): void {
    if (inMenu === this.inMenu) return;
    this.inMenu = inMenu;
    this.applyLevels();
  }

  /** Puts the listener at the camera. */
  listen(camera: THREE.Camera): void {
    const ctx = this.audio?.ctx;
    if (!ctx) return;
    const l = ctx.listener;
    const p = camera.getWorldPosition(tmpPos);
    const f = camera.getWorldDirection(tmpDir);
    const u = tmpUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const t = ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(p.x, t, 0.02);
      l.positionY.setTargetAtTime(p.y, t, 0.02);
      l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(f.x, t, 0.02);
      l.forwardY.setTargetAtTime(f.y, t, 0.02);
      l.forwardZ.setTargetAtTime(f.z, t, 0.02);
      l.upX.setTargetAtTime(u.x, t, 0.02);
      l.upY.setTargetAtTime(u.y, t, 0.02);
      l.upZ.setTargetAtTime(u.z, t, 0.02);
    } else {
      // Older Safari: no AudioParams on the listener.
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
  }

  private start(): void {
    if (this.audio) {
      if (this.audio.ctx.state !== "running" && !document.hidden) void this.audio.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    void ctx.resume();

    this.master = ctx.createGain();
    // A gentle limiter, so a pile of sounds never clips.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    this.master.connect(limiter).connect(ctx.destination);

    this.menuAmbience = ctx.createGain();
    this.ambienceBus = ctx.createGain();
    this.menuAmbience.connect(this.ambienceBus).connect(this.master);
    this.menuEffects = ctx.createGain();
    this.effectsBus = ctx.createGain();
    this.menuEffects.connect(this.effectsBus).connect(this.master);

    // The reverb sits after the buses' volume, so turning one down also turns down its echo.
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, REVERB_TIME);
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.7;
    reverb.connect(reverbOut).connect(this.master);
    const reverbIn = ctx.createGain();
    reverbIn.connect(reverb);

    this.audio = { ctx, ambience: this.menuAmbience, effects: this.menuEffects, reverb: reverbIn, noise: whiteNoise(ctx, 2) };
    this.applyLevels(true);
    for (const build of this.readyCallbacks) build(this.audio);
    this.readyCallbacks = [];
  }

  private applyLevels(now = false): void {
    const ctx = this.audio?.ctx;
    if (!ctx || !this.master || !this.ambienceBus || !this.effectsBus || !this.menuAmbience || !this.menuEffects) return;
    const t = ctx.currentTime;
    const set = (p: AudioParam, v: number) => (now ? p.setValueAtTime(v, t) : p.setTargetAtTime(v, t, 0.08));
    // Slider positions feel more even squared (loudness is not linear).
    set(this.master.gain, this.volumes.master ** 2);
    set(this.ambienceBus.gain, this.volumes.ambience ** 2);
    set(this.effectsBus.gain, this.volumes.effects ** 2);
    set(this.menuAmbience.gain, this.inMenu ? MENU_AMBIENCE : 1);
    set(this.menuEffects.gain, this.inMenu ? 0 : 1);
  }
}

const tmpPos = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpUp = new THREE.Vector3();

function whiteNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** A large, dark stone room: decaying noise, darker as it fades, a little different left and right. */
function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let low = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // A one-pole low-pass that closes over the tail.
      const k = 0.5 - 0.42 * t;
      low += k * (Math.random() * 2 - 1 - low);
      data[i] = low * Math.pow(1 - t, 3) * (i < ctx.sampleRate * 0.01 ? i / (ctx.sampleRate * 0.01) : 1);
    }
  }
  return buffer;
}

/** Places a panner at `p`. */
export function placePanner(panner: PannerNode, p: { x: number; y: number; z: number }, time: number): void {
  if (panner.positionX) {
    panner.positionX.setTargetAtTime(p.x, time, 0.03);
    panner.positionY.setTargetAtTime(p.y, time, 0.03);
    panner.positionZ.setTargetAtTime(p.z, time, 0.03);
  } else {
    panner.setPosition(p.x, p.y, p.z);
  }
}

/** A panner that only gives direction: loudness is set by hand. */
export function directionPanner(ctx: BaseAudioContext): PannerNode {
  const p = ctx.createPanner();
  p.panningModel = "equalpower";
  p.distanceModel = "inverse";
  p.refDistance = 1;
  p.rolloffFactor = 0;
  return p;
}
