import { test } from "node:test";
import assert from "node:assert/strict";
import {
  currentLine, FELL_BELOW, lineDuration, LINE_TIMING, NO_FIGURES, speechAt, stepFigures, TALK_RADIUS,
  type FigureState,
} from "../src/core/figureCore.ts";

const figures = [
  { id: "a", pos: { x: 0, y: 10, z: 0 } },
  { id: "b", pos: { x: 100, y: 50, z: 0 } },
];
const lines = {
  a: { first: ["one", "two"], return: ["again"] },
  b: { first: ["far"], return: ["far again"] },
};
const near = { x: 2, y: 10, z: 0 };
const away = { x: 30, y: 10, z: 0 };
const below = { x: 30, y: 10 - FELL_BELOW - 1, z: 0 };

/** Runs `seconds` at `pos` in steps of 0.1 s. */
function run(state: FigureState, pos: { x: number; y: number; z: number }, seconds: number): FigureState {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) state = stepFigures(state, figures, lines, pos, 0.1);
  return state;
}

const talkLength = (set: readonly string[]) =>
  LINE_TIMING.first + set.reduce((s, l) => s + lineDuration(l), 0) + (set.length - 1) * LINE_TIMING.gap;

test("lines follow each other with a pause between, then the talk is over", () => {
  const set = ["one", "two"];
  assert.deepEqual(speechAt(set, 0), { line: -1, done: false });
  assert.equal(speechAt(set, LINE_TIMING.first).line, 0);
  const second = LINE_TIMING.first + lineDuration("one") + LINE_TIMING.gap;
  assert.equal(speechAt(set, second - 0.01).line, -1);
  assert.equal(speechAt(set, second).line, 1);
  assert.equal(speechAt(set, talkLength(set) - 0.01).done, false);
  assert.equal(speechAt(set, talkLength(set)).done, true);
});

test("a figure talks only when the courier is close", () => {
  assert.equal(run(NO_FIGURES, away, 1).talk, null);
  assert.equal(run(NO_FIGURES, { x: TALK_RADIUS + 0.1, y: 10, z: 0 }, 1).talk, null);
  const s = run(NO_FIGURES, near, 1);
  assert.equal(s.talk?.id, "a");
  assert.equal(s.talk?.set, "first");
  assert.equal(currentLine(s.talk, lines), "one");
});

test("the first-visit lines play once; staying near does not repeat them", () => {
  const s = run(NO_FIGURES, near, talkLength(lines.a.first) + 1);
  assert.deepEqual(s.memory.a, { heard: true, below: false });
  assert.equal(run(s, near, 20).talk, null);
});

test("walking away ends the talk; coming back starts it from the beginning", () => {
  let s = run(NO_FIGURES, near, 4);
  assert.notEqual(s.talk, null);
  s = run(s, away, 0.1);
  assert.equal(s.talk, null);
  assert.equal(s.memory.a, undefined);
  s = run(s, near, 0.1);
  assert.equal(s.talk?.t, 0);
  assert.equal(s.talk?.set, "first");
});

test("after falling below a figure, coming back plays its return lines, once per fall", () => {
  let s = run(NO_FIGURES, near, talkLength(lines.a.first) + 1);
  s = run(s, below, 0.1);
  assert.equal(s.memory.a.below, true);
  s = run(s, near, 0.1);
  assert.equal(s.talk?.set, "return");
  s = run(s, near, talkLength(lines.a.return) + 1);
  assert.deepEqual(s.memory.a, { heard: true, below: false });
  assert.equal(run(s, near, 10).talk, null);
});

test("falling below a figure not yet heard changes nothing", () => {
  const s = run(NO_FIGURES, below, 1);
  assert.equal(s.memory.a, undefined);
});

test("a bounce just past the edge does not cut the talk", () => {
  let s = run(NO_FIGURES, near, 1);
  s = run(s, { x: TALK_RADIUS + 1, y: 13, z: 0 }, 0.5);
  assert.equal(s.talk?.id, "a");
});
