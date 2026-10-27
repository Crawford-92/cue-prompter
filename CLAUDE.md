# Cue Prompter

A free teleprompter web app for filming ~1 minute talking-head TikToks. You paste a script and the camera opens with the script scrolling just under the lens. The scroll follows your voice. Fluffed lines are cut out automatically, and the clean video gets captions.

The owner is Ryan, who films an AI-focused TikTok series. Keep it free to run: no server, no accounts, no paid services.

## Stack

- Plain static site: `index.html`, `style.css` and `app.js`, with no build step and no framework. Keep it that way unless there's a strong reason to change.
- `qrcode.js` is vendored (qrcode-generator 1.4.4, MIT). Don't edit it.
- `sw.js` and `manifest.webmanifest` make it an installable PWA that works offline. **Bump `CACHE` in `sw.js` whenever you change shipped files.**
- Hosting target is GitHub Pages (deploy from `main`, root). The camera and mic need `https://` or `localhost`.

## Run and test

```
npm run serve   # http://localhost:8080 (camera works on localhost)
npm test        # unit tests for the Core logic (Node 18+)
```

On Windows, if `npx serve` isn't wanted, `python -m http.server 8080` works too.

For browser testing, headless Chromium with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` gives a fake camera, so recording and export can be exercised. Voice follow (Web Speech API) can't be tested headless, so use timed mode (the Voice/Timed button) in automated tests.

## How app.js is laid out

1. **`Core`** (top of the file) is pure logic with no DOM, and is exported for Node:
   - `parse(text)`: splits a script into paragraphs, words, `[cue]`/`(cue)` items and `*emphasis*`, and records where each sentence starts (`sentStart`)
   - `advance(words, base, spoken)`: fuzzy-matches recognised speech against the script (allows small skips, won't leap ahead on short words)
   - `logAdvance` / `wordStart`: per-word timestamps during a take
   - `buildEdit(at, redoCuts, dur)`: the final cut list (redos plus dead air at the start and end)
   - `chunks` / `srt` / `mapTime`: caption chunks and an `.srt` file timed to the clean edit
   - `splitScripts` (`---` separator) and `titleOf`
2. **App** (an IIFE that runs only in the browser):
   - Inbox: scripts live in `localStorage` key `cue.lib` as `{id, text, created, status: new|opened|recorded, recordedAt?, archived?}`. Status is per device.
   - Send to phone: scripts travel in the URL hash, either `#z=` (deflate-raw plus base64url, used by the app's QR codes) or `#add=` (plain URL-encoded text, easy for other tools to build). `importFromHash` adds them on load and dedupes by text.
   - Stage: camera, scrolling band, voice follow (`SpeechRecognition`, restarted on `onend`), timed fallback, hook timer, pace readout, TikTok safe-zone overlay.
   - Recording: `MediaRecorder`. Redo line adds a cut from the end of the previous sentence to now plus 1.6 s, and rewinds the pointer.
   - Clean export: plays the raw take into a canvas, skips cut ranges at 4× with the recorder paused, burns captions, and re-records. It runs in real time.
   - Share: Web Share API with files on phones, falling back to a download on desktop.
3. Settings live in `localStorage` key `cue.settings`. Every storage call is wrapped in try/catch.

## Conventions

- UK English in the UI copy. Short, plain labels.
- Colours are CSS custom properties in `:root` in `style.css`. It's a dark, single-theme design with prompter yellow (`--accent`) as the only accent.
- Respect the safe-area insets (the app runs full screen on iPhone).
- Keep `Core` free of DOM access so it stays testable.

## Ideas not built yet

- Sync inbox status across devices (would need a backend or GitHub API writes with a token).
- A "scripts" folder in the repo that the inbox reads, so Claude can push scripts by committing files.
- Per-person inboxes if this is shared with other creators.
