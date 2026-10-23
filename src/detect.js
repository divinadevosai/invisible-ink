// The parts of Invisible Ink that don't need a page: decoding invisible Unicode, and judging whether
// text is talking to an AI. Pure, so they're tested directly (tests/detect.test.js).

/**
 * Unicode's tag block (U+E0000–E007F) mirrors ASCII but draws nothing. Text written in it is
 * invisible to people and readable by any model that sees the raw characters ("ASCII smuggling").
 */
export function decodeTags(text) {
  let message = '';
  let count = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xe0000 && cp <= 0xe007f) {
      count++;
      if (cp >= 0xe0020 && cp <= 0xe007e) message += String.fromCharCode(cp - 0xe0000);
    }
  }
  return { count, message };
}

/**
 * Variation selectors (U+FE00–FE0F and U+E0100–E01EF) are 256 invisible marks normally used to pick
 * an emoji's style. Strung after one character they can carry any bytes: one selector, one byte.
 */
export function decodeSelectors(text) {
  const runs = [];
  let bytes = [];
  const flush = () => {
    if (bytes.length >= 4) runs.push(new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes)));
    bytes = [];
  };
  let count = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xfe00 && cp <= 0xfe0f) bytes.push(cp - 0xfe00);
    else if (cp >= 0xe0100 && cp <= 0xe01ef) bytes.push(cp - 0xe0100 + 16);
    else {
      flush();
      continue;
    }
    count++;
  }
  flush();
  // a lone selector after an emoji (❤️ = ❤ + FE0F) is normal; only a run of them carries a message
  return { count, message: runs.filter((r) => /[\x20-\x7e]{3,}/.test(r)).join(' ') };
}

const ZERO_WIDTH = /[​‌‍⁠﻿]/g;
const BIDI = /[‪-‮⁦-⁩]/g;
/** Zero-width marks and right-to-left overrides ("Trojan Source"): invisible, and they change what text means to a machine. */
export function invisibleMarks(text) {
  return { zeroWidth: (text.match(ZERO_WIDTH) ?? []).length, bidi: (text.match(BIDI) ?? []).length };
}

// Phrases that only make sense addressed to an AI. Each carries a weight; the strongest wins and others add a little.
const CUES = [
  [/\b(ignore|disregard|forget|override)\b.{0,30}\b(previous|prior|above|earlier|all|your|system)\b.{0,20}\b(instructions?|prompts?|rules|directions)\b/i, 1, 'tells it to ignore its instructions'],
  [/\bsystem prompt\b|\bdeveloper mode\b|\bjailbreak\b/i, 0.9, 'mentions its system prompt or modes'],
  [/^\s*(system|assistant)\s*:/im, 0.8, 'is written as a message to the AI'],
  [/<\|im_start\|>|\[INST\]|<<SYS>>|###\s*(system|instruction)/i, 1, 'uses a model’s chat markup'],
  [/\b(ai|llm|language model|chatbot|assistant|agent)s?\b.{0,40}\b(you must|must|should|always|never|do not|don'?t|before answering|quietly)\b/i, 0.8, 'gives an AI orders'],
  [/\b(you are|you're)\s+(now\s+)?(an?\s+)?(ai|assistant|language model|chatbot|agent|in developer mode)\b/i, 0.85, 'tells the AI who it is'],
  [/\b(do not|don'?t|never)\s+(tell|mention|reveal|show)\s+(this|the user|anyone)/i, 0.85, 'asks to keep something from the user'],
  [/\b(send|email|forward|post|upload|include|paste)\b.{0,60}\b(the user'?s?|their|your)\b.{0,30}\b(messages?|address|email|password|history|data|details|conversation)/i, 0.95, 'asks for the user’s data'],
  [/\b(open|visit|navigate to|go to|fetch|click)\b.{0,20}(https?:\/\/|www\.)/i, 0.6, 'sends the AI to a link'],
  [/\b(tell|say to|convince|recommend)\b.{0,15}\b(the )?user\b/i, 0.55, 'tells the AI what to say to the user'],
  [/\bwhen (a|the) user asks\b|\bin your (answer|reply|response|summary)\b/i, 0.7, 'tells the AI how to answer'],
  [/\b(rate|review|summari[sz]e)\b.{0,40}\b(five stars|5 stars|perfectly safe|the best)\b/i, 0.6, 'scripts the AI’s verdict'],
];

/** How strongly this text reads as instructions to an AI: { score 0..1, reasons }. */
export function aiScore(text) {
  const t = (text ?? '').replace(/\s+/g, ' ').slice(0, 4000);
  const hits = CUES.filter(([re]) => re.test(t));
  if (!hits.length) return { score: 0, reasons: [] };
  const top = Math.max(...hits.map(([, w]) => w));
  const score = Math.min(1, top + 0.08 * (hits.length - 1));
  return { score, reasons: hits.map(([, , why]) => why) };
}

export const SPEAKS_TO_AI = 0.55;

/** "rgb(r, g, b)" / "rgba(r, g, b, a)" → [r, g, b, a], or null. */
export function parseColor(css) {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/.exec(css ?? '');
  if (!m) return null;
  let a = m[4] === undefined ? 1 : parseFloat(m[4]);
  if (m[4]?.endsWith('%')) a /= 100;
  return [+m[1], +m[2], +m[3], a];
}

const lum = ([r, g, b]) => {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
/** WCAG contrast ratio between two colours, 1 (identical) to 21 (black on white). */
export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
