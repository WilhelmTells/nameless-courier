import { test } from "node:test";
import assert from "node:assert/strict";
import {
  arrangement, CLUB_CUTOFF, CLUB_REACH, clubClap, clubHat, clubKick, clubMix, CLUB_BASS, LEAD, STAB_STEPS, DEFAULT_VOLUMES, fallRush, FALL_RUSH, impactLevel,
  nextSyllable, parseVolumes, random, springPitch, VOWELS, windLevel, WIND_FULL_HEIGHT,
} from "../src/core/audioCore.ts";

test("volumes fall back to the default when missing or broken", () => {
  assert.deepEqual(parseVolumes(undefined), DEFAULT_VOLUMES);
  assert.deepEqual(parseVolumes("loud"), DEFAULT_VOLUMES);
  assert.deepEqual(parseVolumes({ master: 0.5, ambience: "x", effects: Number.NaN }), { ...DEFAULT_VOLUMES, master: 0.5 });
});

test("volumes are clamped to 0..1", () => {
  assert.deepEqual(parseVolumes({ master: 2, ambience: -1, music: 0.4, effects: 0.3, rain: 0.5 }), { master: 1, ambience: 0, music: 0.4, effects: 0.3, rain: 0.5 });
});

test("the wind grows with height and strength, and is shut out indoors", () => {
  assert.ok(windLevel(0, 0.5, false) < windLevel(60, 0.5, false));
  assert.ok(windLevel(60, 0.5, false) < windLevel(WIND_FULL_HEIGHT, 0.5, false));
  assert.equal(windLevel(WIND_FULL_HEIGHT, 1, false), 1);
  assert.equal(windLevel(WIND_FULL_HEIGHT * 2, 2, false), 1);
  assert.ok(windLevel(60, 0.2, false) < windLevel(60, 0.9, false));
  assert.ok(windLevel(60, 0.5, true) < windLevel(60, 0.5, false) / 3);
  assert.ok(windLevel(0, 0, false) > 0);
});

test("the club is silent beyond its reach and grows as the courier comes close", () => {
  assert.equal(clubMix(CLUB_REACH).gain, 0);
  assert.equal(clubMix(CLUB_REACH * 2).gain, 0);
  assert.equal(clubMix(CLUB_REACH * 2).cutoff, CLUB_CUTOFF.far);
  assert.ok(clubMix(30).gain < clubMix(10).gain);
  assert.ok(clubMix(30).cutoff < clubMix(10).cutoff);
  assert.equal(clubMix(0).gain, 1);
  assert.equal(clubMix(0).cutoff, CLUB_CUTOFF.near);
});

test("the club stays muffled: the cutoff never opens far", () => {
  for (let d = 0; d <= CLUB_REACH; d += 5) assert.ok(clubMix(d).cutoff <= 1200);
  assert.ok(clubMix(CLUB_REACH * 0.8).cutoff < 300);
});

test("a fall rushes only after a few metres, then grows to full", () => {
  assert.equal(fallRush(30, false), 0);
  assert.equal(fallRush(FALL_RUSH.start, true), 0);
  assert.ok(fallRush(12, true) > 0);
  assert.ok(fallRush(12, true) < fallRush(20, true));
  assert.equal(fallRush(FALL_RUSH.full, true), 1);
  assert.equal(fallRush(100, true), 1);
});

test("the spring rises in pitch with the charge", () => {
  assert.ok(springPitch(0) < springPitch(0.5));
  assert.ok(springPitch(0.5) < springPitch(1));
  assert.equal(springPitch(2), springPitch(1));
});

test("impacts grow louder with speed, within 0..1", () => {
  assert.ok(impactLevel(0) > 0);
  assert.ok(impactLevel(4) < impactLevel(10));
  assert.equal(impactLevel(100), 1);
});

test("the club plays four to the floor over a two-bar bass loop", () => {
  const kicks = Array.from({ length: 16 }, (_, i) => i).filter(clubKick);
  assert.deepEqual(kicks, [0, 4, 8, 12]);
  assert.equal(CLUB_BASS.length, 32);
  // The bass sits between the kicks.
  CLUB_BASS.forEach((n, i) => {
    if (n !== null) assert.ok(!clubKick(i));
  });
});

test("the murmur is the same every time for a seed, with real pauses", () => {
  const a = random(7);
  const b = random(7);
  const one = Array.from({ length: 40 }, (_, i) => nextSyllable(a, i));
  const two = Array.from({ length: 40 }, (_, i) => nextSyllable(b, i));
  assert.deepEqual(one, two);
  for (const s of one) {
    assert.ok(s.length > 0 && s.length < 0.3);
    assert.ok(s.gap >= 0);
    assert.ok(s.vowel >= 0 && s.vowel < VOWELS.length);
  }
  assert.ok(one.some((s) => s.gap > 0.3), "phrases end in a pause");
});

test("random numbers stay in 0..1, even from a zero seed", () => {
  const r = random(0);
  for (let i = 0; i < 100; i++) {
    const x = r();
    assert.ok(x >= 0 && x < 1);
  }
});

test("the track builds, breaks down without the kick, and comes back", () => {
  assert.deepEqual(arrangement(0, true), { kick: true, bass: true, hat: false, clap: false, stab: false, lead: false });
  assert.ok(arrangement(8, true).hat && !arrangement(8, true).stab);
  assert.ok(arrangement(16, true).stab && !arrangement(16, true).lead);
  assert.ok(arrangement(24, true).lead);
  assert.ok(!arrangement(24, false).lead, "the club never plays the melody");
  assert.ok(!arrangement(32, true).kick && arrangement(32, true).lead);
  assert.ok(arrangement(40, true).kick);
  assert.deepEqual(arrangement(48, true), arrangement(0, true));
});

test("clap on two and four, hats on the off-beats, apart from the kick", () => {
  const bar = Array.from({ length: 16 }, (_, i) => i);
  assert.deepEqual(bar.filter(clubClap), [4, 12]);
  assert.deepEqual(bar.filter(clubHat), [2, 6, 10, 14]);
  for (const i of bar) assert.ok(!(clubHat(i) && clubKick(i)));
});

test("stabs and melody fit their loops", () => {
  for (const s of STAB_STEPS) assert.ok(s >= 0 && s < 32);
  let end = 0;
  for (const [step, , length] of LEAD) {
    assert.ok(step >= end, "notes do not overlap");
    end = step + length;
  }
  assert.ok(end <= 128);
});
