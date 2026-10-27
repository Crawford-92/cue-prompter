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
- **Send to phone.** A QR code or link carries scripts from the computer to the phone. There's no account or server, because the script travels inside the link. Opening a script link on a computer shows the QR code straight away.
- **Claude skill.** Claude formats scripts for the prompter and ends each one with a link. See "Use with Claude".
- **Installable.** Add it to your home screen and it opens like an app, even offline.

## Use with Claude

Anyone can have Claude write their scripts and send them to their phone:

1. Download [cue-prompter-skill.zip](cue-prompter-skill.zip) (it's also linked in the app's settings).
2. In Claude, open Settings, find Skills, and upload the zip.
3. Write a script with Claude. When it's final, Claude gives a link. Tap it on your phone and the script lands in the inbox. On a computer, opening the link shows a QR code to scan with the phone.

Every script stays private to the person who wrote it. The script travels inside the link, after the `#`, which browsers never send to the website, and it's saved only on the device that opens it. There's no server or shared storage, so nobody can see anyone else's scripts. Anyone who has a link can read that one script, so don't post links publicly.

The skill lives in [skill/cue-prompter](skill/cue-prompter). After editing it, run `npm run skill` to rebuild the zip.

## Pushing scripts from Claude Code

A Claude Code session can drop scripts straight into your inbox instead. It pushes them to your own **private** GitHub repo, and the app on your phone reads that repo with a read-only key you paste in once. The key never leaves your phone, and the app doesn't look for any repo until you connect one, so nobody else's app sees your scripts. [PUSHING-SCRIPTS.md](PUSHING-SCRIPTS.md) has the setup and the instructions to give that session.

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
npm run skill   # rebuild cue-prompter-skill.zip after editing skill/
```

## Code

- `index.html` is the markup.
- `style.css` is the styling.
- `app.js` holds the app. The `Core` module at the top contains the pure logic (parsing, voice matching, cuts, captions). You can test it in Node with `require("./app.js")`.
- `qrcode.js` is the QR library (qrcode-generator, MIT licence).
- `sw.js`, `manifest.webmanifest` and `icons/` make it installable and let it work offline.
- `CLAUDE.md` gives Claude Code the context for working on the project.
