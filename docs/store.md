# Invisible Ink: the Edge Add-ons listing

Live on Edge Add-ons: https://microsoftedge.microsoft.com/addons/detail/jbncjedcdohkmokiojopopddapilcnef

Upload `invisible-ink-<version>.zip` (`npm run build`). Images are in `docs/store/`. `capture.mjs` takes real screenshots and `make.mjs` renders `slides.html` to the store images.

## Name (from the package)
Invisible Ink — see what AI sees

## Short description (from the package, 132 characters)
See what AI sees on a web page: hidden text, invisible Unicode and instructions aimed at AI assistants. Runs only when you click it.

## Description

See what AI sees.

Web pages can carry text you never see but AI assistants read: white-on-white sentences, 1px type, notes in the page's code, and whole messages hidden in invisible Unicode characters. When you ask an assistant to summarise a page, that hidden text can quietly steer its answer. This is called prompt injection. Invisible Ink shows it to you.

HOW IT WORKS
• Click the ink drop in your toolbar, or press Alt+Shift+X.
• The page goes under a UV lamp, and hidden text glows where it sits.
• An evidence card lists everything written for an AI rather than for you, and says why each one was flagged.
• The number of messages for AI also shows on the toolbar icon. It comes from the extension, so a page can't hide or fake it.
• Click again or press Esc to close.

WHAT IT FINDS
• Messages to AI: "ignore your previous instructions", fake "SYSTEM:" notes, requests to send your data somewhere, scripted reviews.
• Text hidden from you: coloured like the background, too small to see, or made transparent.
• Invisible characters: sentences smuggled in Unicode tag characters and variation selectors, decoded back into words.
• Places people don't look: HTML comments, image descriptions, hover text and the page description that search engines read.

PRIVATE BY DESIGN
• Runs only on the tab you click it on, only when you click.
• Reads the page in your browser and forgets it when you close.
• Stores nothing, has no server, and can't connect to the internet.
• Open source, with a published security audit.

It shows what's hidden. It can't prove a page is safe.

Free. Made by SWE3WE (Sweeney Creative).

## Category
Productivity

## Search terms (Edge, up to 7)
prompt injection, AI safety, hidden text, invisible unicode, privacy, security, ChatGPT

## Images

| Slot | File |
|---|---|
| Extension logo (300 × 300) | `logo-300.png` |
| Small promotional tile (440 × 280) | `promo-440x280.png` |
| Screenshots (1280 × 800) | `1-uv-lamp-1280x800.png`, `2-decoded-1280x800.png`, `3-private-1280x800.png` |

## Links
- Website: https://swe3we.dev/invisible-ink/
- Privacy policy: https://swe3we.dev/invisible-ink/privacy.html
- Support: hello@swe3we.dev

---

## Privacy

### Single purpose description
> When you click it, shows the text on the current web page that is hidden from people or addressed to AI assistants (prompt injection), including messages hidden in invisible Unicode characters.

### Permission justifications
- **activeTab:** Gives Invisible Ink access to the one tab you click its toolbar button on, only at that moment, so it can read that page's text and find hidden content. It has no access to any site otherwise.
- **scripting:** Runs Invisible Ink's packaged script in that tab, which reads the page and draws the results on top of it. It doesn't change the page's content.

### Remote code
**No, I am not using remote code.** All JavaScript and fonts ship inside the package.

### Data usage
Tick **nothing**. Invisible Ink doesn't collect, store or transmit any user data. It reads the clicked page in memory in the browser and discards it when closed. It has no storage permission and no network code, and its extension page CSP is `default-src 'none'`. Then tick the three certifications.

---

## Notes for certification
Choose "Yes, I need to provide … other info" and paste:

> No account or login is needed.
>
> HOW TO TEST
> 1. Open any normal website, for example https://en.wikipedia.org/wiki/Prompt_injection
> 2. Click the Invisible Ink toolbar button (or press Alt+Shift+X). The page is tinted violet and an evidence card appears on the right. On a page with nothing hidden, the card says "Nothing addressed to AI" and the toolbar icon shows a ✓.
> 3. To see detections, open the demo page in the repository (https://github.com/divinadevosai/invisible-ink/blob/main/demo/index.html; download it and open it with "Allow access to file URLs" turned on for the extension). It contains 10 planted messages using example.invalid addresses only. The card lists all 10, they glow where they sit, and the toolbar icon shows 10.
> 4. Click the button again, or press Esc, to close.
> 5. On browser pages (new tab, settings, the add-ons store), extensions can't run; Invisible Ink shows a small card explaining this.
>
> PRIVACY
> activeTab + scripting only, no host permissions, no storage, no network code, no web-accessible resources. Results are drawn in a closed shadow root and page text is only ever inserted as textContent. Source and a security audit: https://github.com/divinadevosai/invisible-ink
>
> Support: hello@swe3we.dev

---

# Firefox Add-ons (addons.mozilla.org)

Upload `invisible-ink-<version>-firefox.zip` and, when asked about bundled code, the source zip (`git archive --format=zip HEAD`). `npm run build` makes the Firefox zip from the same build: the manifest adds Firefox's add-on ID, background `scripts` instead of a service worker, `strict_min_version` 128 and `data_collection_permissions: none`.

## Add-on ID (never change it)
`invisible-ink@swe3we.dev`

## Name
Invisible Ink — see what AI sees

## Summary (131 of 250 characters)
See what AI sees on a web page: hidden text, invisible Unicode and instructions aimed at AI assistants. Runs only when you click it.

## Description
Use the description above.

## Categories
Privacy & Security

## Support
- Email: hello@swe3we.dev
- Website: https://swe3we.dev/invisible-ink/

## Privacy policy
https://swe3we.dev/invisible-ink/privacy.html

## Data collection (in the manifest)
`required: ["none"]`. Invisible Ink reads the page in the browser and sends nothing anywhere.

## Licence
MIT (the repository's `LICENSE`).

## Is the code minified or bundled?
**Yes.** esbuild bundles `src/` into `ink.js`, with the fonts from the `@fontsource` packages embedded. Upload the source zip.

## Notes to reviewer
> No account or login is needed.
>
> HOW TO TEST
> 1. Open https://swe3we.dev/quiet-kitchen/brown-butter-banana-bread/ — a test page we made with 7 harmless hidden instructions to AI (white-on-white text, 1px text, off-screen text, an HTML comment, alt text, the meta description, and a sentence in invisible Unicode tag characters).
> 2. Click the Invisible Ink toolbar button (or Alt+Shift+X). The page is tinted violet, the hidden text glows where it sits, and an evidence card lists all 7. The toolbar icon shows 7.
> 3. Click the button again, or press Esc, to close.
> 4. On any ordinary page, the card says "Nothing addressed to AI" and the icon shows ✓.
>
> BUILD (source attached)
> Node 22 and npm, plus the `zip` command. Run `npm ci` then `npm run build`. The upload is `invisible-ink-<version>-firefox.zip`; its contents are `dist-firefox/`.
>
> PERMISSIONS
> activeTab + scripting only: the extension reads only the tab you click it on. No storage, no network code, no host permissions.
>
> Support: hello@swe3we.dev
