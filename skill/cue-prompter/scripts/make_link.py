"""Make a Cue Prompter link that carries a script to the user's phone.

The script travels in the link's #fragment, which is never sent to the website.

Usage:
    python make_link.py script.txt
    python make_link.py < script.txt
    python make_link.py script.txt --app https://example.github.io/cue-prompter/
"""
import argparse
import sys
from urllib.parse import quote

APP = "https://crawford-92.github.io/cue-prompter/"
LONG = 6000


def make_link(text, app=APP):
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        raise ValueError("the script is empty")
    if not app.endswith("/"):
        app += "/"
    return app + "#add=" + quote(text, safe="")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("file", nargs="?", help="text file holding the script (reads stdin if left out)")
    p.add_argument("--app", default=APP, help="address of the Cue Prompter app")
    a = p.parse_args()
    if a.file:
        with open(a.file, encoding="utf-8") as f:
            text = f.read()
    else:
        text = sys.stdin.read()
    try:
        link = make_link(text, a.app)
    except ValueError as e:
        sys.exit("Error: " + str(e))
    if len(text) > LONG:
        print(f"Warning: the script is {len(text)} characters. Links this long may not open on every phone, so consider splitting it.", file=sys.stderr)
    print(link)


if __name__ == "__main__":
    main()
