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
  // last caption ends 0.7 s after the final word (raw 10.2 s), minus the 2.08 s cut
  assert.ok(Math.abs(Math.max(...times) - 8.12) < 0.01, "times after the cut move earlier");
});

test("repoWanted fetches new files and edits to unrecorded scripts only", () => {
  const lib = [
    { file: "a.md", rev: "1", status: "new" },
    { file: "b.md", rev: "1", status: "recorded" },
    { file: "c.md", rev: "1", status: "opened", archived: true },
  ];
  const want = Core.repoWanted(lib, [
    { file: "a.md", hash: "2" }, { file: "b.md", hash: "2" }, { file: "c.md", hash: "2" }, { file: "d.md", hash: "1" }, { file: "a.md", hash: "1" },
  ]).map(e => e.file + e.hash);
  assert.deepStrictEqual(want, ["a.md2", "d.md1"]);
});

test("repoMerge adds new files, updates edits, links scripts already pasted in", () => {
  let n = 0;
  const lib = [
    { id: "x", file: "a.md", rev: "1", text: "Old", status: "opened" },
    { id: "y", text: "Pasted already.", status: "new" },
  ];
  const added = Core.repoMerge(lib, [
    { file: "a.md", hash: "2", text: "New\r\n" },
    { file: "b.md", hash: "1", text: "Pasted already." },
    { file: "c.md", hash: "1", text: "Brand new script." },
    { file: "d.md", hash: "1", text: "   " },
  ], 1000, () => "id" + n++);
  assert.strictEqual(added, 1);
  assert.strictEqual(lib.length, 3);
  assert.deepStrictEqual([lib[0].text, lib[0].rev], ["New", "2"]);
  assert.strictEqual(lib[1].file, "b.md");
  assert.deepStrictEqual([lib[2].file, lib[2].status, lib[2].source], ["c.md", "new", "folder"]);
});

test("scripts/index.json matches the scripts folder (run npm run scripts)", () => {
  const fs = require("fs"), path = require("path");
  const onDisk = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "scripts", "index.json"), "utf8"));
  assert.deepStrictEqual(onDisk, require("../tools/index-scripts.js").build());
});
