const test = require("node:test");
const assert = require("node:assert");
const Core = require("../app.js");

const SCRIPT = `Most people think AI tools are just toys.

I spent a week testing them. [pause] My mum *couldnt tell* at all. (smile)`;

test("splitScripts splits on --- lines", () => {
  assert.strictEqual(Core.splitScripts("One.\n\n---\n\nTwo.").length, 2);
  assert.strictEqual(Core.splitScripts("No separator here.").length, 1);
});

test("parse finds words, cues, emphasis and sentence starts", () => {
  const d = Core.parse(SCRIPT);
  assert.strictEqual(d.words.length, 20);
  assert.deepStrictEqual(d.sentStart.slice(0, 3), [0, 8, 14]);
  const cues = d.paras.flat().filter(i => i.type === "cue").map(i => i.text);
  assert.deepStrictEqual(cues, ["pause", "smile"]);
  assert.ok(d.words.find(w => w.text === "couldnt").emph);
});

test("advance follows speech, allows small skips, ignores stray short words", () => {
  const W = Core.parse(SCRIPT).words;
  assert.strictEqual(Core.advance(W, 0, "most people think ai tools are".split(" ")), 6);
  assert.strictEqual(Core.advance(W, 0, "most people think tools".split(" ")), 5);
  assert.strictEqual(Core.advance(W, 0, ["the"]), 0);
});

test("buildEdit trims dead air and merges redo cuts", () => {
  const W = Core.parse(SCRIPT).words;
  const at = new Array(W.length).fill(null);
  Core.logAdvance(at, 0, 8, 0, 3.0);
  Core.logAdvance(at, 8, W.length, 5.2, 9.5);
  const e = Core.buildEdit(at, [[3.12, 5.2]], 13);
  assert.ok(e.cuts.some(([a, b]) => a === 3.12 && b === 5.2));
  assert.ok(e.cuts.some(([, b]) => b === 13), "trailing silence is cut");
  assert.ok(e.cleanDur < 13);
});

test("srt is shifted to clean-edit time", () => {
  const W = Core.parse(SCRIPT).words;
  const at = new Array(W.length).fill(null);
  Core.logAdvance(at, 0, 8, 0, 3.0);
  Core.logAdvance(at, 8, W.length, 5.2, 9.5);
  const srt = Core.srt(Core.chunks(W, at), [[3.12, 5.2]]);
  assert.match(srt, /^1\n00:00:00,000 --> /);
  const times = [...srt.matchAll(/(\d\d):(\d\d):(\d\d),(\d{3})/g)].map(m => +m[3] + m[4] / 1000);
  assert.ok(Math.max(...times) < 9.5 - 2.0, "times after the cut move earlier");
});
