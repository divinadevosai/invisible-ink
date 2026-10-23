# Invisible Ink

See what AI sees on a web page.

**[Get Invisible Ink for Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/jbncjedcdohkmokiojopopddapilcnef)** · [swe3we.dev/invisible-ink](https://swe3we.dev/invisible-ink/)

Pages can carry text that people never see but AI assistants read: white-on-white sentences, 1px type, HTML comments, alt text, and whole messages hidden in invisible Unicode (tag characters and variation selectors). When you ask an assistant to summarise a page, that text can quietly steer the answer. This is called *prompt injection*.

Click Invisible Ink (or press **Alt+Shift+X**) and the page goes under a UV lamp. Hidden ink glows where it sits, and an evidence card lists everything written for an AI rather than for you, with the reasons it was flagged. Click again or press **Esc** to close.

The count also appears on the toolbar icon. That number comes from the extension itself, so a page can't hide or fake it, even if it tampers with the card drawn on the page.

## What it finds

| | |
|---|---|
| **Addressed to AI** | Any text, visible or not, that reads as instructions to an assistant: "ignore previous instructions", fake `SYSTEM:` messages, chat markup, requests for your data, scripted verdicts |
| **Hidden from you** | Text coloured like its background, too small to see, or made transparent |
| **Decoded** | Messages smuggled in Unicode tag characters (U+E0000–E007F) or variation selectors (U+FE00–FE0F, U+E0100–E01EF), decoded back to text |
| **Also on file** | Ordinary hidden text (menus, closed tabs, screen-reader labels), comments, zero-width marks, frames it didn't open |

It shows what's hidden. It can't prove a page is safe.

## Privacy

- Runs only when you click it, and only on that tab (`activeTab`). No access to any site otherwise.
- Reads the page and draws a temporary overlay on top of it, removed again when you close it. It doesn't edit the page's content, store anything or connect anywhere: the extension has no network code, no storage permission, and no pages of its own.
- Everything ships in the package (fonts included). Nothing is web-accessible, so a site can't tell it's installed. While the overlay is open, the page can see that it's there.
- **Copy report** puts the hidden text on your clipboard with a note that it's evidence, not instructions, because pasting it into an AI assistant hands the AI those same instructions.

## Develop

```sh
npm install
npm test            # unit tests for the decoders and the AI-instruction scorer
npm run build       # dist/ and invisible-ink-<version>.zip
npm run test:e2e    # loads dist/ into Chromium and checks every trick on demo/index.html is found
node demo/make.mjs  # regenerates the demo page
```

Store listing: `docs/store.md`. Website: https://swe3we.dev/invisible-ink/

Load `dist/` from `chrome://extensions` or `edge://extensions` with developer mode on.

A security audit is in `docs/security-audit.md`.

Limits: text inside iframes and closed shadow roots isn't read, and the AI-instruction check is a set of English patterns, not a model.

© 2026 Sweeney Creative. Courier Prime and Instrument Serif are under the SIL Open Font License 1.1.
