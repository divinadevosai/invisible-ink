// Reads the page the way a model does: every character, whether or not a person can see it.
// Only reads; nothing on the page is changed and nothing is sent anywhere.
import { aiScore, contrast, decodeSelectors, decodeTags, invisibleMarks, parseColor, SPEAKS_TO_AI } from './detect.js';

const MAX_NODES = 40000;
const MAX_MS = 2000;
const EXCERPT = 700;
const SKIP = new Set(['script', 'style', 'template', 'svg', 'math', 'select', 'option', 'head', 'title']);
const SMUGGLED = /[\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}︀-️​-‍⁠﻿‪-‮⁦-⁩]/u;
const ATTRS = [
  ['alt', 'Image description (alt text)'],
  ['title', 'Hover text (title)'],
  ['aria-label', 'Screen-reader label'],
  ['aria-description', 'Screen-reader description'],
  ['placeholder', 'Placeholder text'],
];
const METAS = 'meta[name="description" i], meta[name="keywords" i], meta[property^="og:" i], meta[name^="twitter:" i], meta[name="robots" i]';

// How text was hidden. "deceptive" ones are hidden only from people: colour, size or transparency
// tricks. The rest (menus, closed tabs, screen-reader labels, things waiting to animate in) are normal.
export const HOW = {
  camouflage: { label: 'Same colour as the background', deceptive: true },
  transparent: { label: 'Transparent letters', deceptive: true },
  tiny: { label: 'Text too small to see', deceptive: true },
  opacity: { label: 'Faded to nothing (opacity)', deceptive: false },
  offscreen: { label: 'Pushed off the edge of the page', deceptive: false },
  display: { label: 'Never drawn (display: none)', deceptive: false },
  visibility: { label: 'Switched off (visibility: hidden)', deceptive: false },
  collapsed: { label: 'Folded away (zero size)', deceptive: false },
  reader: { label: 'Screen-reader only', deceptive: false },
  noscript: { label: 'Only shown with JavaScript off', deceptive: false },
};

const words = (t) => (t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
const clean = (t) => t.replace(/\s+/g, ' ').trim();
const excerpt = (t) => {
  t = unveil(t);
  return t.length > EXCERPT ? `${t.slice(0, EXCERPT)}…` : t;
};
// show invisible marks as visible stand-ins so the excerpt itself doesn't smuggle anything
export const unveil = (t) =>
  t
    .replace(/[\u{E0000}-\u{E007F}]+/gu, '⟨tags⟩')
    .replace(/[\u{E0100}-\u{E01EF}︀-️]{2,}/gu, '⟨selectors⟩')
    .replace(/[​-‍⁠﻿]/g, '·')
    .replace(/[‪-‮⁦-⁩]/g, '⇄');

/**
 * Scan a document. Returns { findings, quiet, stats }.
 *  findings: [{ level: 'ai' | 'hidden', how, text, reasons, anchor?, inkAt? }]
 *  quiet:    totals of ordinary hidden things, so a clean page still shows what was looked at
 */
export function scanPage(doc = document, skip = null) {
  const started = performance.now();
  const win = doc.defaultView;
  const findings = [];
  const quiet = { hiddenWords: {}, comments: 0, zeroWidth: 0, frames: doc.querySelectorAll('iframe, frame').length, stoppedEarly: false };
  const stats = { textNodes: 0, words: 0 };
  const styleOf = new Map();
  const style = (el) => {
    let s = styleOf.get(el);
    if (!s) styleOf.set(el, (s = win.getComputedStyle(el)));
    return s;
  };

  // what hides an element and everything inside it: { why, root } or null
  const covered = new Map();
  const cover = (el) => {
    if (!el || el.nodeType !== 1) return null;
    if (covered.has(el)) return covered.get(el);
    const s = style(el);
    let why = null;
    if (el.localName === 'noscript') why = 'noscript';
    else if (s.display === 'none' || s.contentVisibility === 'hidden') why = 'display';
    else if (s.visibility === 'hidden' || s.visibility === 'collapse') why = 'visibility';
    else if (parseFloat(s.opacity) < 0.05) why = 'opacity';
    const r = why ? { why, root: el } : cover(el.parentElement ?? el.getRootNode()?.host);
    covered.set(el, r);
    return r;
  };

  const background = (el) => {
    for (let e = el; e; e = e.parentElement ?? e.getRootNode()?.host) {
      const s = style(e);
      if (s.backgroundImage !== 'none') return null; // a picture behind the text: can't judge contrast
      const c = parseColor(s.backgroundColor);
      if (c && c[3] > 0.5) return c;
    }
    return [255, 255, 255, 1];
  };

  // hiding that only applies to this run of text: colour, size, position
  const pageW = Math.max(doc.documentElement.scrollWidth, win.innerWidth);
  const pageH = Math.max(doc.documentElement.scrollHeight, win.innerHeight);
  const local = (node, el) => {
    const s = style(el);
    const range = doc.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (parseFloat(s.fontSize) < 3) return 'tiny';
    if (r.width === 0 && r.height === 0) return 'collapsed';
    const x = r.left + win.scrollX;
    const y = r.top + win.scrollY;
    if (x + r.width <= 0 || y + r.height <= 0 || x >= pageW || y >= pageH) return 'offscreen';
    if (r.width <= 2 || r.height <= 2) return 'reader';
    const fg = parseColor(s.color);
    if (fg && fg[3] < 0.1) return 'transparent';
    const bg = background(el);
    if (fg && bg && contrast(fg, bg) < 1.25) return 'camouflage';
    return null;
  };

  // invisible Unicode inside any string
  const smuggled = (raw, where, anchor) => {
    if (!SMUGGLED.test(raw)) return;
    const tags = decodeTags(raw);
    const sel = decodeSelectors(raw);
    for (const [hit, how] of [
      [tags, `Hidden in ${tags.count} invisible tag characters`],
      [sel, `Hidden in ${sel.count} invisible variation selectors`],
    ]) {
      if (!hit.message.trim()) continue;
      const { score, reasons } = aiScore(hit.message);
      findings.push({ level: score >= SPEAKS_TO_AI ? 'ai' : 'hidden', how: `${how} · ${where}`, text: excerpt(clean(hit.message)), decoded: true, reasons, anchor, inkAt: 'below' });
    }
    const m = invisibleMarks(raw);
    quiet.zeroWidth += m.zeroWidth;
    // a dozen zero-width marks in one place is a code, not typesetting
    if (m.zeroWidth >= 12 || /[‭‮]/.test(raw)) {
      findings.push({ level: 'hidden', how: m.zeroWidth >= 12 ? `${m.zeroWidth} zero-width marks in one spot · ${where}` : `Text direction flipped · ${where}`, text: excerpt(clean(raw)), reasons: [], anchor, inkAt: 'below' });
    }
  };

  // collect text per hiding root, so a hidden <div> with links inside is one finding, not ten
  const groups = new Map();
  const add = (key, init, text) => {
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { ...init, parts: [] }));
    g.parts.push(text);
  };

  const walk = (root) => {
    const tw = doc.createTreeWalker(root, 0x1 | 0x4 | 0x80, {
      acceptNode: (n) => {
        if (n.nodeType === 1) {
          if (n === skip || SKIP.has(n.localName)) return 2; // reject subtree
          if (n.shadowRoot) walk(n.shadowRoot);
          if (n.localName === 'iframe') return 2;
          return 3; // skip the element itself, keep its children
        }
        return 1;
      },
    });
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (++stats.textNodes > MAX_NODES || performance.now() - started > MAX_MS) {
        quiet.stoppedEarly = true;
        return;
      }
      const parent = n.parentElement ?? n.parentNode?.host;
      if (n.nodeType === 8) {
        const t = clean(n.data);
        if (!t) continue;
        quiet.comments++;
        smuggled(n.data, 'in a code comment', parent);
        const { score, reasons } = aiScore(t);
        // pin it to the spot it was written: the top of whatever comes next
        let next = n.nextSibling;
        while (next && next.nodeType !== 1) next = next.nextSibling;
        if (score >= SPEAKS_TO_AI) findings.push({ level: 'ai', how: 'Note in the page’s code (HTML comment)', text: excerpt(t), reasons, anchor: next ?? parent, pin: true });
        continue;
      }
      const raw = n.data;
      const t = clean(raw);
      if (!t || !parent) continue;
      stats.words += words(t);
      smuggled(raw, 'in the text', parent);
      const c = cover(parent);
      const why = c ? c.why : local(n, parent);
      const key = c ? c.root : parent;
      add(key, { why, anchor: why && c ? (why === 'opacity' ? c.root : null) : key, node: n }, t);
    }
  };
  walk(doc.body ?? doc.documentElement);
  // <noscript> lives in <head> sometimes, and the walker skips <head>
  for (const ns of doc.head?.querySelectorAll('noscript') ?? []) add(ns, { why: 'noscript', anchor: null }, clean(ns.textContent));

  for (const g of groups.values()) {
    const text = clean(g.parts.join(' '));
    if (!text) continue;
    const { score, reasons } = aiScore(text);
    const placed = g.why === null || g.why === 'camouflage' || g.why === 'transparent' || g.why === 'tiny' || g.why === 'opacity';
    if (score >= SPEAKS_TO_AI) {
      findings.push({ level: 'ai', how: g.why ? HOW[g.why].label : 'In plain sight', text: excerpt(text), reasons, anchor: placed ? g.anchor : null, inkAt: g.why ? 'over' : 'below', plain: !g.why });
    } else if (g.why && HOW[g.why].deceptive && words(text) >= 3) {
      findings.push({ level: 'hidden', how: HOW[g.why].label, text: excerpt(text), reasons: [], anchor: g.anchor, inkAt: 'over' });
    } else if (g.why) {
      quiet.hiddenWords[g.why] = (quiet.hiddenWords[g.why] ?? 0) + words(text);
    }
  }

  // text a model reads that never appears as page text
  const outOfTime = () => {
    if (performance.now() - started < MAX_MS * 1.5) return false;
    quiet.stoppedEarly = true;
    return true;
  };
  for (const el of doc.querySelectorAll(ATTRS.map(([a]) => `[${a}]`).join(','))) {
    if (outOfTime()) break;
    if (el === skip) continue;
    for (const [attr, label] of ATTRS) {
      const v = el.getAttribute(attr);
      if (!v) continue;
      smuggled(v, `in ${attr}`, el);
      const { score, reasons } = aiScore(v);
      if (score >= SPEAKS_TO_AI) findings.push({ level: 'ai', how: label, text: excerpt(clean(v)), reasons, anchor: el, boxOnly: true });
    }
  }
  for (const m of doc.querySelectorAll(METAS)) {
    if (outOfTime()) break;
    const v = m.getAttribute('content') ?? '';
    smuggled(v, 'in the page description', null);
    const { score, reasons } = aiScore(v);
    if (score >= SPEAKS_TO_AI) findings.push({ level: 'ai', how: 'Page description for search engines and AI (meta tag)', text: excerpt(clean(v)), reasons, anchor: null });
  }

  // the page in reading order: findings that can be pointed at come first, top to bottom
  const pos = (f) => {
    if (!f.anchor) return Infinity;
    const r = f.anchor.getBoundingClientRect();
    return r.width || r.height ? r.top + win.scrollY : Infinity;
  };
  for (const f of findings) f.y = pos(f);
  findings.sort((a, b) => (a.level === b.level ? a.y - b.y : a.level === 'ai' ? -1 : 1));
  for (const f of findings) if (f.y === Infinity) f.anchor = null;
  stats.ms = Math.round(performance.now() - started);
  return { findings, quiet, stats };
}
