# Cue Prompter

A free teleprompter that runs in your phone's browser. Paste a script, look at the camera, read, record.

## How it works

1. **Write the script anywhere**, for example in Claude, ChatGPT or Notes.
2. **Get it into the inbox.** On the phone, copy it and tap **Paste script**. On a computer, paste it there, then tap **⋯ → Send to phone** (or **Send new to phone**) and scan the QR code with the phone's camera.
3. **Record.** Tap a script to open it with the camera. New scripts have a yellow dot. Once opened they show **Opened**, and after a take they show **✓ Done** with the date.
4. **Send the video back.** Tap **Share** to send it by AirDrop, Google Drive, iCloud or WhatsApp, or straight into CapCut. On a computer the video saves to Downloads.

It also works on a laptop: open the page there and it uses the webcam.

## Features

- **Follows your voice.** The script scrolls as you speak and waits when you pause. Timed scroll is there as a backup.
- **Redo a line.** Fluff a line? Tap **Redo line** while recording. The text jumps back to the start of that sentence, and the mistake is cut from the clean video.
- **Clean video export.** Cuts your redos, plus dead air at the start and end, into one clean take.
- **Captions.** Burns TikTok-style captions into the clean video, with the current word highlighted. You can also save them as an `.srt` file.
- **Hook timer.** The first 3 seconds glow, then it tells you how many words you got through. A live pace readout shows your words per minute against your target.
- **TikTok safe zones.** An overlay shows where the app's buttons and caption will cover your shot.
- **Script cues.** `[pause]` and `(smile)` show as yellow cues. `*word*` adds emphasis.
- **Filming queue.** Separate scripts with a `---` line to film them back to back.
- **Script inbox.** New, opened and done status, so you can see what's left to film.
- **Send to phone.** A QR code or link carries scripts from the computer to the phone. There's no account or server, because the script travels inside the link.
- **Installable.** Add it to your home screen and it opens like an app, even offline.

## Scripts folder

Scripts committed to the `scripts/` folder show up in the inbox on every device the next time the app is opened. That's how a Claude session can push scripts straight to your phone: it adds a `.md` file, runs `npm run scripts` to update `scripts/index.json`, then commits and pushes. [PUSHING-SCRIPTS.md](PUSHING-SCRIPTS.md) has the steps to give that session.

Edits to a script that hasn't been filmed yet come through too. Removing a script from the inbox keeps it removed.

## Script links

Any tool can send a script by building a link:

```
https://<your-site>/#add=<URL-encoded script text>
```

Opening the link adds the script to the inbox on that device. Separate several scripts with a line of `---`. The app's own Send to phone button uses a compressed `#z=` form so the QR codes stay small.

## Controls

| Action | Phone | Keyboard / Bluetooth clicker |
|---|---|---|
| Pause or play scroll | Tap the text | Space, Page Down |
| Record or stop | Red button | R, Enter |
| Redo line | Redo line (while recording) | Page Up, Backspace |
| Speed, text size, voice or timed | Adjust button, bottom left | ↑ / ↓ for speed |
| Next or previous script | ‹ › at the top | → / ← |

## Hosting (free)

The camera only works over `https://`. GitHub Pages is free:

1. Push this folder to a GitHub repo.
2. In the repo, go to **Settings → Pages → Build and deployment**, set **Source: Deploy from a branch**, then pick **main** and **/ (root)**.
3. Open `https://<you>.github.io/<repo>/` on your phone and add it to your home screen.

## Notes

- Voice follow uses the browser's built-in speech recognition. It works best in Chrome, and also works in Safari on iPhone. If it can't get the mic, the app switches to timed scroll by itself.
- Building the clean video plays the take through once, so it takes about as long as the clean video runs. Keep the screen open while it runs.
- Nothing is uploaded anywhere. Scripts and recordings stay on your device, and the inbox status is saved per device.

## Develop

```
npm run serve   # http://localhost:8080
npm test        # logic tests
npm run scripts # rebuild scripts/index.json after adding a script
```

## Code

- `index.html` is the markup.
- `style.css` is the styling.
- `app.js` holds the app. The `Core` module at the top contains the pure logic (parsing, voice matching, cuts, captions). You can test it in Node with `require("./app.js")`.
- `qrcode.js` is the QR library (qrcode-generator, MIT licence).
- `sw.js`, `manifest.webmanifest` and `icons/` make it installable and let it work offline.
- `CLAUDE.md` gives Claude Code the context for working on the project.
