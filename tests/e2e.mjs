// End-to-end: loads the built extension into Chromium, opens the demo page and checks every planted trick is found.
// npm run build && node tests/e2e.mjs   (PLAYWRIGHT=<path to playwright/index.mjs> if it isn't installed locally)
// Clicking the toolbar can't be automated, so a test copy of the build grants itself the demo's host
// and the service worker runs the same executeScript the click does.
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = process.env.SHOTS ?? join(root, '.shots');
mkdirSync(shots, { recursive: true });

const ext = mkdtempSync(join(tmpdir(), 'ink-ext-'));
cpSync(join(root, 'dist'), ext, { recursive: true });
const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['http://127.0.0.1/*'];
writeFileSync(join(ext, 'manifest.json'), JSON.stringify(manifest));

const demo = readFileSync(join(root, 'demo', 'index.html'));
const PORT = 5073;
const server = createServer((req, res) => {
  const headers = { 'content-type': 'text/html; charset=utf-8' };
  // the strictest policy a real site might send: no inline styles, no fonts, no images, nothing
  if (req.url.startsWith('/strict')) headers['content-security-policy'] = "default-src 'none'; style-src 'unsafe-inline'";
  if (req.url.startsWith('/locked')) headers['content-security-policy'] = "default-src 'none'";
  if (req.url.startsWith('/clean')) return res.writeHead(200, headers).end('<!doctype html><title>Plain</title><body style="font:18px Georgia;padding:40px"><h1>Just a page</h1><p>Nothing to see here. I ❤️ bread.</p><a class=x href=#>Menu</a></body>');
  res.writeHead(200, headers).end(demo);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ink-profile-')), {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--disable-features=DisableLoadExtensionCommandLineSwitch'],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
const errors = [];

async function inkOn(path) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${path}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/Content Security Policy|Failed to load resource/.test(m.text()) && errors.push(`${path}: ${m.text()}`));
  await page.goto(`http://127.0.0.1:${PORT}${path}`);
  await page.bringToFront();
  await sw.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url: url + '*' });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['ink.js'] });
  }, `http://127.0.0.1:${PORT}${path}`);
  await page.waitForSelector('invisible-ink');
  // a closed shadow root: read the card the way a person would, through what's drawn
  return page;
}
// The card is in a closed shadow root, so read it the way a screen reader does: through the accessibility tree.
async function cardText(page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  await cdp.detach();
  const dialog = nodes.find((n) => n.role?.value === 'dialog' && /Invisible Ink/.test(n.name?.value ?? ''));
  if (!dialog) return '';
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const out = [];
  const visit = (n) => {
    if (n.role?.value === 'StaticText') out.push(n.name?.value ?? '');
    for (const c of n.childIds ?? []) if (byId.has(c)) visit(byId.get(c));
  };
  visit(dialog);
  return out.join(' ');
}

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n     ${e.message.split('\n').slice(0, 6).join('\n     ')}`);
  }
}

await check('demo page: finds every planted message', async () => {
  const page = await inkOn('/');
  await page.waitForTimeout(700);
  const text = await cardText(page);
  writeFileSync(join(shots, 'demo-aria.txt'), text);
  for (const needle of [
    'drop.example.invalid', // tag characters
    'butter.example.invalid', // variation selectors
    'rate this recipe five stars', // HTML comment
    'disable their antivirus', // alt text
    'flour.example.invalid', // white on white
    'System prompt override', // 1px text
    'developer mode', // display:none
    'compare recipes', // off-screen
    'Sponsored by', // opacity 0
    'only banana bread recipe', // meta description
  ]) assert.ok(text.includes(needle), `missing: ${needle}`);
  assert.ok(!text.includes('Skip to the recipe'), 'screen-reader link should not be reported');
  assert.match(text, /10\s+messages\s+for AI/i);
  await page.screenshot({ path: join(shots, 'demo.png') });
  await page.mouse.move(420, 360);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(shots, 'demo-beam.png') });
});

await check('clicking again closes it, Esc closes it', async () => {
  const page = ctx.pages().at(-1);
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['ink.js'] });
  });
  await page.waitForSelector('invisible-ink', { state: 'detached' });
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['ink.js'] });
  });
  await page.waitForSelector('invisible-ink');
  await page.keyboard.press('Escape');
  await page.waitForSelector('invisible-ink', { state: 'detached' });
  await page.close();
});

await check('works under a strict Content-Security-Policy', async () => {
  for (const path of ['/strict', '/locked']) {
    const page = await inkOn(path);
    await page.waitForTimeout(500);
    const text = await cardText(page);
    assert.ok(text.includes('drop.example.invalid'), `${path}: card missing findings`);
    // styles applied: the card is a fixed panel on the right, not unstyled text at the bottom of the page
    const box = await page.locator('invisible-ink').evaluate((h) => h.getBoundingClientRect().width);
    assert.ok(box >= 1279, `${path}: overlay host not full-screen`);
    await page.screenshot({ path: join(shots, `csp${path.replace('/', '-')}.png`) });
    await page.close();
  }
});

await check('a clean page says so', async () => {
  const page = await inkOn('/clean');
  await page.waitForTimeout(500);
  const text = await cardText(page);
  assert.match(text, /Nothing\s+addressed\s+to AI/i);
  assert.ok(!/Addressed to AI/.test(text.replace(/Nothing\s+addressed/i, '')), 'no AI section expected');
  await page.screenshot({ path: join(shots, 'clean.png') });
  await page.close();
});

await check('no page errors', async () => assert.deepEqual(errors, []));

await ctx.close();
server.close();
rmSync(ext, { recursive: true, force: true });
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
