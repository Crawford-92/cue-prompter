"use strict";

/* ============================================================
   Core: pure logic (script parsing, voice matching, timing,
   cuts, captions). No DOM here, so it can be tested in Node.
   ============================================================ */
const Core = (() => {
  const norm = s => String(s).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "");
  const NUM = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12", twenty: "20", hundred: "100" };

  // Several scripts separated by a line of ---
  function splitScripts(raw) {
    return String(raw).split(/^\s*-{3,}\s*$/m).map(s => s.trim()).filter(Boolean);
  }

  function titleOf(script) {
    const line = script.split("\n").find(l => l.trim()) || "Untitled";
    const t = line.replace(/\[[^\]]*\]|\([^)]*\)|\*/g, "").replace(/\s+/g, " ").trim() || "Untitled";
    return t.length > 36 ? t.slice(0, 34).trim() + "…" : t;
  }

  // Parse a script into paragraphs of words and cues.
  // [pause] and (smile) are cues; *text* is emphasis.
  function parse(raw) {
    const paras = [], words = [], sentStart = [0];
    let sid = 0;
    String(raw).split(/\n\s*\n/).forEach(par => {
      const items = [];
      const re = /\[([^\]\n]+)\]|\(([^)\n]+)\)|\*([^*\n]+)\*|(\S+)/g;
      let m;
      while ((m = re.exec(par))) {
        if (m[1] || m[2]) { items.push({ type: "cue", text: (m[1] || m[2]).trim() }); continue; }
        const emph = !!m[3];
        (m[3] || m[4]).split(/\s+/).filter(Boolean).forEach(w => {
          const n = norm(w);
          if (!n) { items.push({ type: "punct", text: w }); return; }
          const word = { type: "word", text: w.replace(/\*/g, ""), norm: n, i: words.length, sid, emph };
          words.push(word); items.push(word);
          if (/[.!?]["”’)]*$/.test(w)) { sid++; sentStart[sid] = words.length; }
        });
      }
      if (items.length) paras.push(items);
      if (words.length && sentStart[sid] !== words.length) { sid++; sentStart[sid] = words.length; }
    });
    return { paras, words, sentStart };
  }

  function same(a, b) {
    a = NUM[a] || a; b = NUM[b] || b;
    if (a === b) return true;
    return a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4);
  }

  // Walk spoken words against the script from `base`, allowing small skips.
  function advance(words, base, spoken) {
    let p = base;
    for (const w of spoken) {
      if (!w) continue;
      const lim = Math.min(words.length, p + 8);
      for (let j = p; j < lim; j++) {
        if (same(words[j].norm, w)) {
          if (j - p > 2 && w.length < 4) break; // don't leap ahead on short words like "the"
          p = j + 1; break;
        }
      }
    }
    return p;
  }

  // Record when each word finished. Spread jumps evenly, but don't stretch across long silences.
  function logAdvance(at, from, to, tPrev, t) {
    const n = to - from; if (n <= 0) return;
    const t0 = Math.max(tPrev, t - 0.42 * n);
    for (let k = from; k < to; k++) at[k] = t0 + (t - t0) * (k - from + 1) / n;
  }

  function wordStart(at, i) {
    if (at[i] == null) return null;
    if (i === 0 || at[i - 1] == null) return Math.max(0, at[i] - 0.38);
    return Math.max(at[i - 1], at[i] - 0.55); // don't reach back across a pause or a cut
  }

  function mergeCuts(cuts) {
    const s = cuts.filter(c => c[1] - c[0] > 0.04).map(c => c.slice()).sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const c of s) {
      const l = out[out.length - 1];
      if (l && c[0] <= l[1] + 0.05) l[1] = Math.max(l[1], c[1]); else out.push(c);
    }
    return out;
  }

  const inCut = (t, cuts) => cuts.find(c => t >= c[0] && t < c[1]) || null;

  function mapTime(t, cuts) {
    let o = t;
    for (const [a, b] of cuts) { if (t >= b) o -= b - a; else if (t > a) o -= t - a; }
    return o;
  }

  const cutTotal = cuts => cuts.reduce((s, [a, b]) => s + (b - a), 0);

  // Group spoken words into short TikTok-style caption chunks (raw take times).
  function chunks(words, at) {
    const out = []; let cur = null;
    for (const w of words) {
      if (at[w.i] == null) continue;
      const st = wordStart(at, w.i);
      const text = w.text.replace(/^["“(]+|[")”,;:.]+$/g, "");
      if (!text) continue;
      if (!cur || cur.words.length >= 3 || cur.chars + text.length > 16 || cur.sid !== w.sid || st - cur.end > 0.9) {
        cur = { start: st, end: at[w.i], sid: w.sid, chars: 0, words: [] }; out.push(cur);
      }
      cur.words.push({ text, start: st, end: at[w.i] });
      cur.chars += text.length + 1; cur.end = at[w.i];
    }
    out.forEach((c, k) => {
      const nx = out[k + 1];
      c.end = Math.max(c.end + 0.7, c.start + 0.3);
      if (nx) c.end = Math.min(c.end, nx.start);
    });
    return out;
  }

  function srtTime(s) {
    s = Math.max(0, s);
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = Math.floor(s) % 60, ms = Math.round((s % 1) * 1000) % 1000;
    const p = (n, l = 2) => String(n).padStart(l, "0");
    return `${p(h)}:${p(m)}:${p(sec)},${p(ms, 3)}`;
  }

  function srt(chs, cuts) {
    const lines = []; let n = 0;
    for (const c of chs) {
      if (inCut((c.start + c.end) / 2, cuts)) continue;
      const a = mapTime(c.start, cuts), b = mapTime(c.end, cuts);
      if (b - a < 0.1) continue;
      lines.push(String(++n), srtTime(a) + " --> " + srtTime(b), c.words.map(w => w.text).join(" "), "");
    }
    return lines.join("\n");
  }

  // Final edit list: redo cuts plus dead air trimmed at the start and end.
  function buildEdit(at, redoCuts, dur) {
    const cuts = redoCuts.slice();
    const first = at.findIndex(x => x != null);
    let last = -1; at.forEach((x, k) => { if (x != null) last = k; });
    if (first >= 0) {
      const fs = wordStart(at, first);
      if (fs > 1.0) cuts.push([0, fs - 0.5]);
    }
    if (last >= 0 && dur - at[last] > 1.6) cuts.push([at[last] + 1.0, dur]);
    const clean = mergeCuts(cuts.map(([a, b]) => [Math.max(0, a), Math.min(dur, b)]));
    return { cuts: clean, dur, cleanDur: dur - cutTotal(clean) };
  }

  return { norm, splitScripts, titleOf, parse, advance, logAdvance, wordStart, mergeCuts, inCut, mapTime, cutTotal, chunks, srt, srtTime, buildEdit };
})();

if (typeof module !== "undefined") module.exports = Core;

/* ============================================================
   App
   ============================================================ */
if (typeof document !== "undefined") (() => {
  const $ = id => document.getElementById(id);
  const HOLD = 1.6; // seconds of breathing room after tapping Redo
  const SAMPLE = `Most people think AI video tools are just toys.

I spent a week testing them for real work, and here's what actually surprised me. [pause]

First: the voice cloning is *good enough* that my own mum couldn't tell. (smile)

Second: the hard part isn't the tech. It's writing a script worth saying.

Follow along and I'll show you exactly how I build each one.

---

Here's the one AI tool I use every single day.

It turns a messy idea into a script I can actually read on camera. [pause]

Try it tonight and tell me how you get on.`;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  const S = Object.assign({
    mode: "voice", speed: 130, size: 30, mirror: true, front: true, flip: false, safe: false, burn: true
  }, store.get("cue.settings", {}), {
    scripts: [], qi: 0, doc: null, words: [], spans: [], ptr: 0, ptrF: 0, offset: 0, dragging: false,
    playing: false, listening: false, sr: null, srGen: 0, resKey: null, resBase: 0, holdUntil: 0,
    stream: null, mr: null, chunks: [], recording: false, recStart: 0, recDur: 0, at: [], lastT: 0, cuts: [], redos: 0,
    timerId: 0, autoStop: 0, hookTimer: 0, wake: null, raw: null, edit: null, capChunks: [], clean: null, exporting: false
  });
  const saveSettings = () => store.set("cue.settings", { mode: S.mode, speed: S.speed, size: S.size, mirror: S.mirror, front: S.front, flip: S.flip, safe: S.safe, burn: S.burn });

  const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  let toastId = 0;
  function toast(msg, ms = 2600) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastId); toastId = setTimeout(() => { t.hidden = true; }, ms);
  }
  function showErr(msg) { $("err").textContent = msg; $("err").hidden = !msg; }

  /* ---------- setup screen ---------- */
  $("script").value = store.get("cue.script", SAMPLE);
  $("speed").value = S.speed; $("size").value = S.size;

  function updMeta() {
    const scripts = Core.splitScripts($("script").value);
    const words = scripts.reduce((n, s) => n + Core.parse(s).words.length, 0);
    $("wc").textContent = (scripts.length > 1 ? scripts.length + " scripts · " : "") + words + " words · ~" + fmt(words / S.speed * 60);
    $("speedOut").textContent = S.speed + " wpm"; $("sizeOut").textContent = S.size + " px";
    $("sLbl").textContent = S.speed; $("fLbl").textContent = S.size;
    $("start").textContent = scripts.length > 1 ? `Open camera · ${scripts.length} scripts` : "Open camera";
  }
  function syncChips() {
    $("mVoice").setAttribute("aria-pressed", S.mode === "voice");
    $("mTimed").setAttribute("aria-pressed", S.mode === "timed");
    [["tMirror", "mirror"], ["tFront", "front"], ["tFlip", "flip"], ["tSafe", "safe"]].forEach(([id, k]) => $(id).setAttribute("aria-pressed", S[k]));
    $("modeLbl").textContent = S.mode === "voice" ? "Voice" : "Timed";
    $("safe").hidden = !S.safe; $("safeBtn").setAttribute("aria-pressed", S.safe);
    $("burn").checked = S.burn;
  }
  $("script").addEventListener("input", () => { store.set("cue.script", $("script").value); updMeta(); });
  $("speed").addEventListener("input", e => { S.speed = +e.target.value; saveSettings(); updMeta(); });
  $("size").addEventListener("input", e => { S.size = +e.target.value; saveSettings(); setFs(); updMeta(); });
  $("mVoice").onclick = () => { S.mode = "voice"; saveSettings(); syncChips(); };
  $("mTimed").onclick = () => { S.mode = "timed"; saveSettings(); syncChips(); };
  [["tMirror", "mirror"], ["tFront", "front"], ["tFlip", "flip"], ["tSafe", "safe"]].forEach(([id, k]) => {
    $(id).onclick = () => { S[k] = !S[k]; saveSettings(); syncChips(); };
  });
  $("burn").onchange = e => { S.burn = e.target.checked; saveSettings(); resetClean(); };
  syncChips(); updMeta();

  /* ---------- rendering the script ---------- */
  function setFs() { document.documentElement.style.setProperty("--fs", S.size + "px"); }

  function loadScript(i) {
    S.qi = i; S.doc = Core.parse(S.scripts[i]); S.words = S.doc.words;
    const t = $("text"); t.textContent = ""; S.spans = [];
    for (const items of S.doc.paras) {
      const p = document.createElement("p");
      items.forEach((it, k) => {
        if (k) p.appendChild(document.createTextNode(" "));
        const s = document.createElement("span");
        if (it.type === "word") { s.className = "w" + (it.emph ? " em" : ""); s.textContent = it.text; S.spans[it.i] = s; }
        else if (it.type === "cue") { s.className = "cue"; s.textContent = it.text; }
        else s.textContent = it.text;
        p.appendChild(s);
      });
      t.appendChild(p);
    }
    t.classList.toggle("flip", S.flip); setFs();
    S.ptr = 0; S.ptrF = 0; S.offset = 0; setPtr(0, false);
    const multi = S.scripts.length > 1;
    $("queue").hidden = !multi;
    $("qLbl").textContent = `${i + 1}/${S.scripts.length} · ${Core.titleOf(S.scripts[i])}`;
    $("qPrev").disabled = i === 0; $("qNext").disabled = i >= S.scripts.length - 1;
  }

  function setPtr(p, log = true) {
    const N = S.words.length;
    p = Math.max(0, Math.min(N, p));
    if (log && S.recording && p > S.ptr) {
      const t = recTime(); Core.logAdvance(S.at, S.ptr, p, S.lastT, t); S.lastT = t;
    }
    const lo = Math.min(p, S.ptr), hi = Math.max(p, S.ptr);
    for (let k = lo; k < hi; k++) if (S.spans[k]) S.spans[k].classList.toggle("said", k < p);
    if (S.spans[S.ptr]) S.spans[S.ptr].classList.remove("now");
    S.ptr = p;
    if (S.spans[p]) S.spans[p].classList.add("now");
    if (S.recording && p >= N && N && !S.autoStop) {
      toast("That's the last line. Stopping…", 1600);
      S.autoStop = setTimeout(() => { S.autoStop = 0; if (S.recording) stopRec(); }, 1500);
    }
  }

  const guideY = () => $("band").clientHeight * 0.3;
  function place() { $("scroller").style.transform = `translateY(${guideY() - S.offset}px)`; }

  /* ---------- scroll loop ---------- */
  let last = 0;
  function tick(ts) {
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
    if (!$("stage").hidden && S.words.length) {
      const N = S.words.length, hold = performance.now() < S.holdUntil;
      if (S.mode === "timed" && S.playing && !hold) {
        S.ptrF = Math.min(N, S.ptrF + S.speed / 60 * dt);
        const p = Math.floor(S.ptrF); if (p > S.ptr) setPtr(p);
        if (S.ptrF >= N && !S.recording) setPlaying(false);
      }
      const frac = S.mode === "timed" ? S.ptrF : S.ptr;
      const i = Math.min(N - 1, Math.floor(frac)), a = S.spans[i];
      if (a && !S.dragging) {
        let target = a.offsetTop;
        if (S.ptr >= N) target = a.offsetTop + a.offsetHeight * 0.6;
        else if (S.mode === "timed" && S.spans[i + 1]) target += (S.spans[i + 1].offsetTop - a.offsetTop) * (frac - i);
        S.offset += (target - S.offset) * Math.min(1, dt * (S.mode === "timed" ? 8 : 5));
      }
      place();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function setPlaying(v) {
    S.playing = v;
    $("play").textContent = v ? "❚❚" : "▶";
    $("play").setAttribute("aria-label", v ? "Pause" : (S.mode === "voice" ? "Start listening" : "Start scrolling"));
    if (S.mode === "voice") { v ? startListening() : stopListening(); }
    $("listenDot").hidden = !(v && S.mode === "voice");
  }
  $("play").onclick = () => setPlaying(!S.playing);

  // tap the text to pause, drag it to move
  let dragY = null, moved = false;
  $("band").addEventListener("pointerdown", e => { dragY = e.clientY; moved = false; });
  $("band").addEventListener("pointermove", e => {
    if (dragY == null) return;
    const dy = e.clientY - dragY;
    if (!moved && Math.abs(dy) < 6) return;
    moved = true; S.dragging = true; S.offset = Math.max(0, S.offset - dy); dragY = e.clientY; place();
  });
  const endDrag = () => {
    if (dragY == null) return; dragY = null;
    if (!moved) { setPlaying(!S.playing); return; }
    S.dragging = false;
    let best = 0, bd = Infinity;
    S.spans.forEach((s, k) => { const d = Math.abs(s.offsetTop - S.offset); if (d < bd) { bd = d; best = k; } });
    setPtr(best, false); S.ptrF = best;
    if (S.recording) { S.lastT = recTime(); S.at.fill(null, best); }
    S.resKey = null;
  };
  $("band").addEventListener("pointerup", endDrag);
  $("band").addEventListener("pointercancel", endDrag);

  function bump(key, d, min, max) {
    S[key] = Math.min(max, Math.max(min, S[key] + d)); $(key).value = S[key];
    saveSettings(); if (key === "size") setFs(); updMeta();
  }
  $("sUp").onclick = () => bump("speed", 10, 40, 240); $("sDown").onclick = () => bump("speed", -10, 40, 240);
  $("fUp").onclick = () => bump("size", 2, 20, 60); $("fDown").onclick = () => bump("size", -2, 20, 60);
  $("safeBtn").onclick = () => { S.safe = !S.safe; saveSettings(); syncChips(); };
  $("modeBtn").onclick = () => {
    if (S.recording) return;
    const was = S.playing; setPlaying(false);
    S.mode = S.mode === "voice" ? "timed" : "voice"; S.ptrF = S.ptr; saveSettings(); syncChips();
    toast(S.mode === "voice" ? "Follows your voice" : "Timed scroll at " + S.speed + " wpm");
    if (was) setPlaying(true);
  };

  /* ---------- voice follow ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function fallbackTimed(msg) {
    S.listening = false; S.srGen++;
    S.mode = "timed"; S.ptrF = S.ptr; syncChips(); toast(msg, 4500);
    if (S.recording) { S.playing = true; $("play").textContent = "❚❚"; }
    $("listenDot").hidden = true;
  }
  function startListening() {
    if (!SR) { fallbackTimed("Voice follow isn't available in this browser, so it's on timed scroll. Chrome or Safari work best."); return; }
    if (S.listening) return;
    S.listening = true; spawn();
  }
  function spawn() {
    if (!S.listening) return;
    const r = new SR(), gen = ++S.srGen; S.sr = r; S.resKey = null;
    r.lang = navigator.language || "en-GB"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = e => {
      if (gen !== S.srGen || performance.now() < S.holdUntil) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const key = gen + ":" + i;
        if (S.resKey !== key) { S.resKey = key; S.resBase = S.ptr; }
        const spoken = e.results[i][0].transcript.split(/\s+/).map(Core.norm).filter(Boolean);
        const p = Core.advance(S.words, S.resBase, spoken);
        if (p > S.ptr) setPtr(p);
      }
    };
    r.onerror = e => {
      if (gen !== S.srGen) return;
      if (["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"].includes(e.error))
        fallbackTimed("Voice follow couldn't use the mic here, so it's switched to timed scroll.");
    };
    r.onend = () => { if (gen === S.srGen && S.listening) setTimeout(spawn, 120); };
    try { r.start(); } catch (e) { if (gen === S.srGen) setTimeout(spawn, 400); }
  }
  function stopListening() {
    S.listening = false; S.srGen++;
    try { S.sr && S.sr.abort(); } catch (e) {}
    S.sr = null;
  }
  function restartListening() {
    if (!S.listening) return;
    S.srGen++; try { S.sr && S.sr.abort(); } catch (e) {}
    setTimeout(spawn, 150);
  }

  /* ---------- camera ---------- */
  async function openCam() {
    showErr("");
    if (S.stream) S.stream.getTracks().forEach(t => t.stop());
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showErr("The camera only opens when this page loads from an https:// address. Open it from your GitHub Pages or Netlify link in Safari or Chrome.");
      return;
    }
    try {
      S.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: S.front ? "user" : "environment", width: { ideal: 1080 }, height: { ideal: 1920 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      const v = $("cam"); v.srcObject = S.stream; v.classList.toggle("mirror", S.mirror && S.front);
      await v.play().catch(() => {});
    } catch (e) {
      showErr(e.name === "NotAllowedError"
        ? "Camera or microphone access was blocked. Allow both for this site in your browser settings, then tap ✎ and Open camera again."
        : "The camera didn't start: " + e.message);
    }
  }
  $("swap").onclick = () => { if (S.recording) return; S.front = !S.front; saveSettings(); syncChips(); openCam(); };
  async function wake() { try { S.wake = await navigator.wakeLock.request("screen"); } catch (e) {} }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !$("stage").hidden) wake(); });

  $("start").onclick = async () => {
    S.scripts = Core.splitScripts($("script").value);
    if (!S.scripts.length) { $("script").focus(); return; }
    $("setup").hidden = true; $("stage").hidden = false;
    loadScript(0); requestAnimationFrame(place);
    await openCam(); wake();
    if (S.mode === "voice" && !SR) fallbackTimed("Voice follow isn't available in this browser, so it's on timed scroll.");
  };
  function backToSetup() {
    if (S.recording) return;
    setPlaying(false);
    if (S.stream) S.stream.getTracks().forEach(t => t.stop()); S.stream = null;
    try { S.wake && S.wake.release(); } catch (e) {}
    $("stage").hidden = true; $("setup").hidden = false;
  }
  $("back").onclick = backToSetup;
  $("qPrev").onclick = () => { if (!S.recording && S.qi > 0) { setPlaying(false); loadScript(S.qi - 1); } };
  $("qNext").onclick = () => { if (!S.recording && S.qi < S.scripts.length - 1) { setPlaying(false); loadScript(S.qi + 1); } };
  window.addEventListener("resize", place);

  /* ---------- recording ---------- */
  const recTime = () => (performance.now() - S.recStart) / 1000;
  function pickType() {
    if (!window.MediaRecorder) return null;
    const opts = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    for (const t of opts) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
    return "";
  }
  function countdown(n) {
    return new Promise(res => {
      const c = $("count"); c.hidden = false; let i = n; c.textContent = i;
      const id = setInterval(() => { i--; if (i <= 0) { clearInterval(id); c.hidden = true; res(); } else c.textContent = i; }, 1000);
    });
  }

  async function startRec() {
    if (!S.stream) { showErr("The camera isn't running yet."); return; }
    const type = pickType();
    if (type === null) { showErr("This browser can't record video. The prompter still works, so you can film with another app."); return; }
    setPlaying(false); setPtr(0, false); S.ptrF = 0; S.offset = 0;
    $("rec").disabled = true;
    await countdown(3);
    $("rec").disabled = false;
    S.chunks = []; S.at = new Array(S.words.length).fill(null); S.cuts = []; S.redos = 0; S.lastT = 0;
    try { S.mr = type ? new MediaRecorder(S.stream, { mimeType: type, videoBitsPerSecond: 8e6 }) : new MediaRecorder(S.stream); }
    catch (e) { showErr("Recording didn't start: " + e.message); return; }
    S.mr.ondataavailable = e => { if (e.data && e.data.size) S.chunks.push(e.data); };
    S.mr.onstop = finishRec;
    S.recStart = performance.now();
    S.mr.start(1000);
    S.recording = true; document.body.classList.add("recording");
    $("rec").classList.add("on"); $("rec").setAttribute("aria-label", "Stop recording");
    $("redo").setAttribute("aria-label", "Redo this line"); $("redoTxt").textContent = "Redo line";
    $("timer").hidden = false; updTimer(); S.timerId = setInterval(updTimer, 250);
    // hook timer: first 3 seconds
    $("band").classList.add("hook");
    requestAnimationFrame(() => $("hookbar").classList.add("run"));
    S.hookTimer = setTimeout(() => {
      $("band").classList.remove("hook"); $("hookbar").classList.remove("run");
      toast(`Hook done: ${S.ptr} words in the first 3 seconds`);
    }, 3000);
    setPlaying(true);
  }

  function stopRec() {
    if (S.mr && S.mr.state !== "inactive") { S.recDur = recTime(); S.mr.stop(); }
  }

  function updTimer() {
    const t = recTime();
    const done = Core.cutTotal(S.cuts.filter(c => c[1] <= t));
    const active = t - done;
    const wpm = active > 4 && S.ptr > 3 ? Math.round(S.ptr / (active / 60)) : null;
    $("tTime").textContent = fmt(t);
    const el = $("tPace");
    el.textContent = wpm ? wpm + " wpm" : "";
    el.className = wpm && wpm > S.speed * 1.18 ? "fast" : (wpm && wpm < S.speed * 0.75 ? "slow" : "");
  }

  function redo() {
    if (!S.recording) { setPtr(0, false); S.ptrF = 0; S.resKey = null; return; }
    const N = S.words.length; if (!N) return;
    const t = recTime();
    const sid = S.words[Math.min(S.ptr, N - 1)].sid;
    const start = S.doc.sentStart[sid];
    const prevEnd = S.cuts.length ? S.cuts[S.cuts.length - 1][1] : 0;
    let cutStart = start > 0 && S.at[start - 1] != null ? S.at[start - 1] + 0.12 : prevEnd;
    cutStart = Math.max(cutStart, prevEnd);
    S.cuts.push([cutStart, t + HOLD]);
    S.at.fill(null, start);
    clearTimeout(S.autoStop); S.autoStop = 0;
    setPtr(start, false); S.ptrF = start; S.lastT = t + HOLD; S.redos++;
    S.holdUntil = performance.now() + HOLD * 1000;
    const preview = S.words.slice(start, start + 5).map(w => w.text).join(" ");
    $("again").hidden = false; $("againTxt").textContent = "From “" + preview + (N - start > 5 ? "…" : "") + "”";
    $("againBar").classList.remove("run"); void $("againBar").offsetWidth; $("againBar").classList.add("run");
    setTimeout(() => { $("again").hidden = true; }, HOLD * 1000);
    if (S.mode === "voice") restartListening();
  }
  $("redo").onclick = redo;
  $("rec").onclick = () => { S.recording ? stopRec() : startRec(); };

  function finishRec() {
    clearInterval(S.timerId); clearTimeout(S.hookTimer); clearTimeout(S.autoStop); S.autoStop = 0;
    $("band").classList.remove("hook"); $("hookbar").classList.remove("run");
    S.recording = false; document.body.classList.remove("recording");
    setPlaying(false);
    $("timer").hidden = true; $("again").hidden = true; S.holdUntil = 0;
    $("rec").classList.remove("on"); $("rec").setAttribute("aria-label", "Start recording");
    $("redo").setAttribute("aria-label", "Back to the start"); $("redoTxt").textContent = "";
    const mt = (S.mr.mimeType || "video/webm").split(";")[0];
    const blob = new Blob(S.chunks, { type: mt });
    if (S.raw) URL.revokeObjectURL(S.raw.url);
    S.raw = { blob, url: URL.createObjectURL(blob), ext: mt.includes("mp4") ? "mp4" : "webm", type: mt };
    S.edit = Core.buildEdit(S.at, S.cuts, S.recDur);
    S.capChunks = Core.chunks(S.words, S.at);
    showResult();
  }

  /* ---------- result + clean export ---------- */
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  function resetClean() {
    if (S.clean) { URL.revokeObjectURL(S.clean.url); S.clean = null; }
    $("dlClean").hidden = true; $("exportBtn").hidden = false;
    if (S.raw && !$("result").hidden) $("playback").src = S.raw.url;
  }
  function showResult() {
    resetClean();
    const e = S.edit, saved = e.dur - e.cleanDur;
    const name = "take-" + (S.qi + 1) + "-" + stamp();
    $("playback").src = S.raw.url;
    $("dlRaw").href = S.raw.url; $("dlRaw").download = name + "-raw." + S.raw.ext;
    const srt = Core.srt(S.capChunks, e.cuts);
    if (S.srtUrl) URL.revokeObjectURL(S.srtUrl);
    S.srtUrl = URL.createObjectURL(new Blob([srt], { type: "application/x-subrip" }));
    $("dlSrt").href = S.srtUrl; $("dlSrt").download = name + ".srt"; $("dlSrt").hidden = !srt;
    S.baseName = name;
    $("stats").textContent =
      `Take ${fmt(e.dur)}` +
      (S.redos ? ` · ${S.redos} redo${S.redos > 1 ? "s" : ""}` : "") +
      (saved > 0.5 ? ` · clean cut ${fmt(e.cleanDur)}` : "") +
      (S.capChunks.length ? ` · ${S.capChunks.length} caption lines` : "");
    $("nextScript").hidden = S.qi >= S.scripts.length - 1;
    $("prog").hidden = true; $("exportBtn").disabled = false; $("exportBtn").textContent = "Make clean video";
    $("result").hidden = false;
  }

  function drawCaption(ctx, W, H, t) {
    const ch = S.capChunks.find(c => t >= c.start && t < c.end);
    if (!ch) return;
    const fam = '"Atkinson Hyperlegible", system-ui, sans-serif';
    let fs = Math.round(Math.min(W, H) * 0.075);
    ctx.font = `700 ${fs}px ${fam}`;
    let sp = ctx.measureText(" ").width, ws = ch.words.map(w => ctx.measureText(w.text).width);
    let total = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
    if (total > W * 0.86) {
      fs = Math.floor(fs * W * 0.86 / total); ctx.font = `700 ${fs}px ${fam}`;
      sp = ctx.measureText(" ").width; ws = ch.words.map(w => ctx.measureText(w.text).width);
      total = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
    }
    let x = (W - total) / 2; const y = Math.round(H * (H > W ? 0.64 : 0.8));
    ctx.textBaseline = "middle"; ctx.lineJoin = "round"; ctx.lineWidth = Math.max(4, fs * 0.17); ctx.strokeStyle = "rgba(0,0,0,0.92)";
    let cur = -1; ch.words.forEach((w, k) => { if (t >= w.start) cur = k; });
    ch.words.forEach((w, k) => {
      ctx.strokeText(w.text, x, y);
      ctx.fillStyle = k === cur ? "#ffcf3f" : "#ffffff";
      ctx.fillText(w.text, x, y);
      x += ws[k] + sp;
    });
  }

  async function exportClean() {
    if (S.exporting || !S.raw) return;
    S.exporting = true;
    const btn = $("exportBtn"); btn.disabled = true; btn.textContent = "Making clean video…";
    $("prog").hidden = false; $("progBar").style.width = "0%";
    $("playback").pause();
    let ac;
    try {
      try { await document.fonts.load('700 40px "Atkinson Hyperlegible"'); } catch (e) {}
      const v = document.createElement("video");
      v.playsInline = true; v.preload = "auto"; v.src = S.raw.url;
      await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error("the recording couldn't be read")); });
      let W = v.videoWidth || 1080, H = v.videoHeight || 1920;
      const k = Math.min(1, 1920 / Math.max(W, H)); W = Math.round(W * k / 2) * 2; H = Math.round(H * k / 2) * 2;
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const ctx = c.getContext("2d");
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC(); await ac.resume();
      const src = ac.createMediaElementSource(v), dest = ac.createMediaStreamDestination(); src.connect(dest);
      const out = new MediaStream([...c.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const type = pickType();
      const mr = type ? new MediaRecorder(out, { mimeType: type, videoBitsPerSecond: 8e6 }) : new MediaRecorder(out);
      const parts = []; mr.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
      const done = new Promise(r => { mr.onstop = r; });
      const { cuts, dur } = S.edit, burn = S.burn;
      let started = false, finished = false;
      const finish = () => {
        if (finished) return; finished = true; v.pause();
        if (mr.state !== "inactive") mr.stop(); else mr.onstop();
      };
      v.onended = finish;
      const loop = () => {
        if (finished) return;
        const t = v.currentTime, cut = Core.inCut(t, cuts);
        if (cut && cut[1] >= dur - 0.05) { finish(); return; }
        if (cut) {
          if (mr.state === "recording") mr.pause();
          if (v.playbackRate !== 4) v.playbackRate = 4;
        } else {
          if (v.playbackRate !== 1) v.playbackRate = 1;
          ctx.drawImage(v, 0, 0, W, H);
          if (burn) drawCaption(ctx, W, H, t);
          if (mr.state === "paused") mr.resume();
          else if (!started) { mr.start(500); started = true; }
        }
        $("progBar").style.width = Math.min(100, t / dur * 100).toFixed(1) + "%";
        requestAnimationFrame(loop);
      };
      await v.play();
      requestAnimationFrame(loop);
      await done;
      const mt = (mr.mimeType || type || "video/webm").split(";")[0];
      const blob = new Blob(parts, { type: mt });
      if (!blob.size) throw new Error("nothing was recorded");
      S.clean = { url: URL.createObjectURL(blob) };
      $("playback").src = S.clean.url;
      $("dlClean").href = S.clean.url; $("dlClean").download = S.baseName + "-clean." + (mt.includes("mp4") ? "mp4" : "webm");
      $("dlClean").hidden = false; btn.hidden = true;
      $("progBar").style.width = "100%";
      setTimeout(() => { $("prog").hidden = true; }, 600);
    } catch (e) {
      btn.disabled = false; btn.textContent = "Try again";
      $("prog").hidden = true;
      toast("The clean video didn't finish: " + e.message + ". Your raw take is still here.", 5000);
    } finally {
      S.exporting = false;
      try { ac && ac.close(); } catch (e) {}
    }
  }
  $("exportBtn").onclick = exportClean;
  $("againBtn").onclick = () => { $("playback").pause(); $("result").hidden = true; setPtr(0, false); S.ptrF = 0; S.offset = 0; };
  $("nextScript").onclick = () => { $("playback").pause(); $("result").hidden = true; loadScript(S.qi + 1); };

  /* ---------- keyboard and Bluetooth clickers ---------- */
  document.addEventListener("keydown", e => {
    if ($("stage").hidden || !$("result").hidden) return;
    const k = e.key;
    if (k === " " || k === "PageDown") { e.preventDefault(); setPlaying(!S.playing); }
    else if (k === "PageUp" || k === "Backspace") { e.preventDefault(); redo(); }
    else if (k === "r" || k === "R" || k === "Enter") { e.preventDefault(); $("rec").click(); }
    else if (k === "ArrowUp") { e.preventDefault(); bump("speed", 10, 40, 240); }
    else if (k === "ArrowDown") { e.preventDefault(); bump("speed", -10, 40, 240); }
    else if (k === "ArrowRight") $("qNext").click();
    else if (k === "ArrowLeft") $("qPrev").click();
    else if (k === "Escape") backToSetup();
  });
})();
