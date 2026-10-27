# Pushing scripts to your phone from Claude Code

This is for a Claude Code session (like the TikTok series one) that should drop finished scripts straight into your phone's inbox. It uses your own **private** GitHub repo, so nobody else can see the scripts. The app only reads it on a phone you've connected.

Anyone using Claude on the web or in the app doesn't need any of this: the Claude skill gives them a link instead. See "Use with Claude" in the README.

## One-time setup

1. **Make a private repo** for the scripts on GitHub. Ryan's is `Crawford-92/cue-scripts`, cloned at `C:\Users\RyanC\Downloads\cue-scripts`.
2. **Make a read-only key.** On GitHub, go to Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. Then:
   - Repository access: **Only select repositories**, and pick the scripts repo.
   - Permissions: **Contents: Read-only**. Leave everything else as no access.
   - Pick an expiry. When it runs out, make a new key and paste it in again.
3. **Connect the phone.** In Cue Prompter, tap the gear, then under **Your own scripts repo** type the repo (for example `Crawford-92/cue-scripts`), paste the key, and tap **Connect**. The key is saved on that phone only.

On iPhone, a home-screen icon keeps separate storage from Safari, so connect the repo in whichever one you film with.

## Instructions for the Claude Code session

Paste this into the session's `CLAUDE.md`:

---

### Sending finished scripts to Cue Prompter

When a script is final and ready to film, push it to my phone through my private scripts repo at `C:\Users\RyanC\Downloads\cue-scripts`:

1. Save the script there as a new file named `YYYY-MM-DD-short-title.md` (for example `2026-10-27-ai-tools-week.md`). Use one script per file.
2. Write only the words to be read out. The first line becomes the title in the inbox, so start with the hook. Separate paragraphs with a blank line, and never use `---` lines, because a dashed line splits the file into separate scripts. `[pause]` and `(smile)` show as cues, and `*word*` shows as emphasis. Leave out headings, labels such as "Hook:", shot notes, captions and hashtags.
3. Commit and push: `git -C "C:\Users\RyanC\Downloads\cue-scripts" add -A`, then `git -C "C:\Users\RyanC\Downloads\cue-scripts" commit -m "Script: <title>"`, then `git -C "C:\Users\RyanC\Downloads\cue-scripts" push`.

The script appears in the phone's inbox, with a yellow dot, the next time the app is opened or brought back to the front. To fix a script that hasn't been filmed yet, edit its file, commit and push again. Once it's marked as filmed, edits are ignored.
