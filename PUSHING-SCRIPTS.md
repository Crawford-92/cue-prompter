# Pushing scripts to the phone

Give these instructions to the Claude session that writes the TikTok scripts (paste them into that project's `CLAUDE.md`). Replace the path with where this repo lives on your computer.

---

## Sending finished scripts to the Cue Prompter

When a script is final and ready to film, push it to my phone through the Cue Prompter repo at `C:\Users\RyanC\Downloads\cue-prompter\cue-prompter`:

1. Save the script as a new file in that repo's `scripts/` folder, named `YYYY-MM-DD-short-title.md` (for example `2026-10-27-ai-tools-week.md`). Use one script per file.
2. Write only the words to be read out. The first line becomes the title in the inbox, so start with the hook. Separate paragraphs with a blank line. `[pause]` and `(smile)` show as cues, and `*word*` shows as emphasis. Leave out headings, shot notes and hashtags.
3. In the repo, run `npm run scripts` to rebuild `scripts/index.json`.
4. Commit and push to `main`: `git add scripts && git commit -m "Script: <title>" && git push`.

The script appears in the phone's inbox, with a yellow dot, about a minute later, the next time the app is opened or brought back to the front.

To fix a script that hasn't been filmed yet, edit its file and repeat steps 3 and 4, and the phone picks up the change. Once it's marked as done, edits are ignored.
