---
name: cue-prompter
description: Formats short talking-to-camera video scripts (TikTok, Reels, Shorts) for the Cue Prompter teleprompter app and gives the user a link that puts the script on their phone, ready to film. Use when the user is writing a script they will read to camera, asks for a teleprompter or Cue Prompter link, or wants a script sent to their phone.
---

# Cue Prompter

Cue Prompter is a free teleprompter web app at https://crawford-92.github.io/cue-prompter/. The script scrolls under the phone's camera and follows the speaker's voice.

A script gets into the app through a link. The whole script travels inside the link, after the `#`, which browsers never send to the website. When the link opens, the script is saved on that device only. Nothing is uploaded, and nobody else can see it unless the user shares the link.

## Writing the script for the prompter

Whatever else the user asks for, the text that goes into the link must be **only the words to be spoken**:

- Start with the hook. The first line becomes the script's title in the app.
- Short sentences, one idea each. Put a blank line between paragraphs.
- Cues the app understands:
  - `[pause]` or `(smile)`, or any short direction in square or round brackets, shows as a small yellow cue, not words to read. Keep cues to one or two words.
  - `*word*` underlines a word to stress it. Use it sparingly.
- Leave out everything that isn't spoken: headings, labels such as "Hook:" or "CTA:", scene numbers, camera or B-roll notes, on-screen text, captions and hashtags. If the user wants those, give them separately, outside the link.
- Write numbers the way they'll be said if that's clearer to read aloud.
- Several scripts can go in one link, separated by a line containing only `---`. Keep it to five or fewer per link.

## Giving the user the link

Make the link once the script is final: when the user approves it, asks for the link, or asks to film or send it. If they're still editing, keep drafting and offer the link when they're happy.

1. Save the exact script text to a file, for example `script.txt`.
2. Run the link maker:

   ```
   python scripts/make_link.py script.txt
   ```

   It prints the link. If the user hosts their own copy of the app, add `--app https://their-address/`.

3. If you can't run code, build the link yourself: `https://crawford-92.github.io/cue-prompter/#add=` followed by the script with every character percent-encoded except `A-Z a-z 0-9 - _ . ~` (UTF-8, spaces as `%20`, new lines as `%0A`).

Then reply in this shape:

> **[Open in Cue Prompter](THE_LINK)**
>
> On your phone, tap the link and the script lands in your inbox. On a computer, open it and scan the code that appears with your phone's camera.

After that, give the clean script in a plain code block, so the user can also copy it and tap **Paste script** in the app.

## Notes

- Keep the user's script private: don't put it anywhere except the link and this conversation. Remind them that anyone they send the link to can read the script.
- On iPhone, links open in Safari. If the user added the app to their home screen, that icon keeps a separate inbox, so they should either use the app in Safari or copy the script and tap Paste script.
- Very long scripts make long links. Over about 6,000 characters, split them into several links.
