# Invisible Ink: security audit report (run 1)

| | |
|---|---|
| **Target** | `invisible-ink` at commit `9395c14` (clean worktree). Chrome/Edge MV3 extension. |
| **Profile** | **quick**. This is a partial pass: one hunter wave, one final coverage critic, one independent verifier per candidate. |
| **Scope** | `src/`, `build.mjs`, `package.json`, `package-lock.json`, `scripts/`, `demo/`, `tests/`. `node_modules/` was checked only for dependency identity. |
| **Budget** | None set. 3 agent passes ran: hunter (run by the coordinating agent), coverage critic, verifier. |
| **Execution** | Source review plus local Chromium checks against a loopback dummy page (`127.0.0.1`, `example.invalid` addresses only). Target build output was copied into scratch and run under a clean, allowlisted environment with time limits. No deployed or third-party service was contacted. |
| **Prior runs** | None. This is the first audit of this repository. |

**Deviations.** Reconnaissance and the single hunter wave were done by the coordinating agent, not by separate delegated agents, because the target is about 700 lines. Candidate verification and the final coverage critique were done by fresh, independent agents. The local checks ran inside the session container with a clean environment and time limits. Full OS-level read-only mounts and CPU, memory and process limits were not available. The executed code is first-party, built from the audited source.

## Posture

Strong for its size:
- No standing host access (`activeTab` + `scripting` only).
- No messaging surface, storage or network code.
- No web-accessible resources, and a `default-src 'none'` extension CSP.
- Page text is rendered only through `textContent` inside a closed shadow root.

The one confirmed issue is a design limitation. The verdict is shown only inside the page being inspected, so a page built to target this extension can hide or forge it.

## Confirmed findings

| Severity | Title | Boundary | Observed result |
|---|---|---|---|
| **Low** | Inspected page can remove, forge, or dismiss the in-page verdict | Hostile page → integrity of the extension's report | A dummy page removed the real report and showed a fake "Nothing addressed to AI" card. A synthetic Escape event (`isTrusted=false`) closed the real report. |

### Inspected page can remove, forge, or dismiss the in-page verdict (`invisible-ink/overlay/page-controlled-report-dom`)

**Lower-trust principal:** the scripts of the web page being inspected.

**Source:**
- `src/overlay.js:58`: the host is a plain element in the page's document.
- `src/overlay.js:270`: it is appended after `<body>`.
- `src/overlay.js:260-268`: a capture-phase Escape handler with no `isTrusted` check.
- `src/background.js:5-8`: no extension-owned success indicator; the badge is only used for failures.

**Reproduction.** Load the built extension in Chromium and open a loopback page that contains:
- a `MutationObserver` that removes `<invisible-ink>` when it appears and inserts a look-alike card, or
- one that dispatches `new KeyboardEvent('keydown', {key: 'Escape'})`.

Run the extension on the page. A control page without the observer keeps the real report.

**Conditions:** the user runs the extension on a page whose author wrote code specifically against it.

**Result:** the page fully controls what the user believes the extension found. No data, code execution or privilege is gained.

**Priority:** likelihood is low (a targeted page is needed; generic pages don't do this). Impact is medium, because the tool's single verdict is defeated. Overall **low**. The UI already says "it can't prove a page is safe".

**Smallest fix:**
1. Return the AI-addressed count as the `executeScript` result and set it on the toolbar badge from `src/background.js`. The page cannot touch extension UI. Tell the user in the card that the badge is authoritative.
2. Ignore untrusted key events in `onKey` (`e.isTrusted`).
3. Optionally, flag the badge if the page removes the host while it is open.

## NEEDS VALIDATION

None.

## Deferred lead (raised by the final critic; not a finding)

**Page-visible traces of the extension.**
- `src/overlay.js:22-23` adds FontFaces to `document.fonts`, and teardown (`src/overlay.js:275-285`) never removes them.
- Because `ink.js` is re-evaluated on each click, the `fontsAdded` guard resets, so faces pile up.
- The host element and the focus move are also page-observable while the overlay is open.

If FontFaces added from the isolated world are visible to page scripts, a page could learn that the user ran the extension. This would contradict README.md's "Doesn't change the page".

The quick profile stops before a follow-up hunter wave, so this is recorded as `deferred`. Next step: a local check of whether page-world `document.fonts` lists the faces after close.

## Hardening notes

- **Copy report replays injections.** The copied report contains decoded hidden instructions verbatim (`src/overlay.js` `plainReport`). Pasting it into an AI assistant re-delivers them. Add a header that marks the quoted text as untrusted page content.
- **Uncapped attribute and meta loops.** These loops in `src/page.js` and full-length Unicode decoding are not covered by the 40,000-node / 2-second budget. Only the hostile page's own tab is affected.
- **Report URL can be changed.** `location.href` is re-read when Copy is pressed, so a page can `pushState` to change the URL in the copied report. Capture it at scan time.
- **README privacy wording.** It should say the overlay is a temporary element the page can see while open. "Can't detect it's installed" is true only until the user runs it.
- **Install script at dev time.** esbuild has a dev-time `postinstall` (pinned, with an integrity hash, not shipped). "No install scripts" applies to the shipped package only.

## Positive patterns

- Least privilege (`activeTab`, no host permissions).
- No `onMessage` or `onMessageExternal`.
- No web-accessible resources, so the extension can't be fingerprinted before use.
- A constant bundled CSS string, and `textContent`-only rendering.
- An isolated world, so page prototype tampering can't reach the scanner.
- Fonts embedded in the bundle rather than fetched.
- Pinned dependencies with a lockfile, and a build with no network fetch.
- Loopback-only tests using `example.invalid` addresses.

## Coverage

7 ledger units:
- **5 covered:**
  - DOM injection sinks
  - permissions and messaging
  - data leaving the tab
  - supply chain
  - resource exhaustion
- **1 candidate:** confirmed above.
- **1 deferred:** page-visible traces.

The final critic found every recorded check supported by source. It raised the one deferred lead, so the critic pass was not clean.

**Not covered:**
- Iframes and closed shadow roots, which the scanner does not read by design.
- Evasion techniques the scanner doesn't model: canvas text, CSS `content`, images of text. These are detection limits, not boundary violations.

A single quick run does not exhaust this target.

---

## Fixes applied after the audit

| Item | Fix | Regression test |
|---|---|---|
| Confirmed: page can remove, forge or dismiss the verdict | The count is set on the toolbar badge by the background worker (`src/background.js`), and the card says the badge is authoritative. Escape is honoured only from trusted key presses. If the page removes the card, the extension tears down so the next click rescans. | `tests/e2e.mjs`: "a hostile page can’t fake the count, fake Esc, or leave the fonts behind" |
| Deferred lead: fonts visible to the page and left behind | The end-to-end test confirmed the page can list the fonts while the overlay is open. They are now removed on close. README wording updated. | Same test checks `document.fonts` from the page's own world before and after closing |
| Hardening: copied report replays injections | The report starts with a line marking the quoted text as evidence, not instructions | – |
| Hardening: the page could change the URL in the copied report | The URL is captured at scan time | – |
| Hardening: uncapped attribute and meta loops | They share the scan's time budget | – |
