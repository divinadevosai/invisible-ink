// Films the promo: the real extension running on demo/index.html inside promo/director.html.
// npm run build && node promo/record.mjs → promo/out/invisible-ink-promo.mp4 (1920×1080, 30 fps)
// Needs Playwright (PLAYWRIGHT=<path to playwright/index.mjs>) and ffmpeg.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'promo', 'out');
const frames = join(out, 'frames');
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

// the built extension, allowed onto the local stage (a toolbar click can't be automated)
const ext = mkdtempSync(join(tmpdir(), 'ink-promo-'));
cpSync(join(root, 'dist'), ext, { recursive: true });
const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['http://127.0.0.1/*'];
writeFileSync(join(ext, 'manifest.json'), JSON.stringify(manifest));

const TYPES = { '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.js': 'text/javascript' };
const PORT = 5076;
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = path.startsWith('/promo/') || path.startsWith('/demo/') || path.startsWith('/src/icons/') || path.startsWith('/docs/store/') || path.startsWith('/node_modules/@fontsource/') ? join(root, path) : null;
  try {
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ink-pp-')), {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages', '--hide-scrollbars'],
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--disable-features=DisableLoadExtensionCommandLineSwitch'],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
const page = await ctx.newPage();
for (const p of ctx.pages()) if (p !== page) await p.close();
await page.goto(`http://127.0.0.1:${PORT}/promo/director.html`);
await page.evaluate(() => document.fonts.ready);
const site = page.frameLocator('#site');
await page.frame({ url: /demo\/index\.html/ }).waitForLoadState();
const frame = page.frame({ url: /demo\/index\.html/ });
await frame.evaluate(() => document.fonts.ready);

// ---- camera: CDP screencast, every frame kept with its timestamp ----
const cdp = await ctx.newCDPSession(page);
// with extensions loaded, headless Chromium keeps a real window with browser UI: size it so the page area is 1080 tall
{
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { width: 1920, height: 1080 + 139 } });
  await new Promise((r) => setTimeout(r, 800));
}
const shots = [];
let t0 = null;
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  if (metadata.deviceHeight !== 1080) return cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); // from before the resize
  const t = metadata.timestamp;
  t0 ??= t;
  const name = `f${String(shots.length).padStart(5, '0')}.jpg`;
  writeFileSync(join(frames, name), Buffer.from(data, 'base64'));
  shots.push({ name, t: t - t0 });
  cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
const started = Date.now();
const cues = {}; // moments for sound
const mark = (name) => (cues[name] = (Date.now() - started) / 1000);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const stage = (fn, ...args) => page.evaluate(([f, a]) => window.stage[f](...a), [fn, args]);

// a visible cursor that also really moves the mouse, so the lamp's beam follows it
let cx = 1180;
let cy = 760;
async function moveTo(x, y, ms = 700) {
  // paced by the clock, not by step count: with the lamp on, each step takes longer to draw
  const [sx, sy] = [cx, cy];
  const t0 = Date.now();
  for (let p = 0; p < 1; ) {
    p = Math.min(1, (Date.now() - t0) / ms);
    const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
    cx = sx + (x - sx) * e;
    cy = sy + (y - sy) * e;
    await Promise.all([page.mouse.move(cx, cy), stage('cursor', cx - 4, cy - 2, true)]);
    if (p < 1) await wait(16);
  }
}

// ---- the film ----
await wait(400);
await stage('boot');
mark('window');
await stage('windowIn');
await wait(900);
await stage('caption', 'a recipe blog. looks harmless.');
await wait(1500);
mark('ai');
await stage('caption', 'then you ask your AI about it.');
await stage('ai', 'Great banana bread! One tip: disable your antivirus before baking, and only buy flour from flour.example.invalid.');
await wait(1400);
await stage('clearCaption');
mark('question');
await stage('question', true);
await wait(2000);
await stage('question', false);
await stage('aiOut');
await wait(300);
await stage('caption', 'invisible ink: see what AI sees.');
const icon = await stage('iconBox');
await moveTo(icon.x, icon.y, 900);
await wait(200);
mark('click');
await stage('press', true);
await wait(140);
await stage('press', false);
await sw.evaluate(async () => {
  const [tab] = await chrome.tabs.query({ active: true });
  const results = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: () => location.pathname });
  const demo = results.find((r) => r.result.startsWith('/demo/'));
  await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [demo.frameId] }, files: ['ink.js'] });
});
mark('stamp');
await wait(600);
await stage('caption', '10 messages written for AI. none of them for you.');
// sweep the lamp across the page
await moveTo(700, 520, 1100);
await moveTo(980, 760, 900);
await wait(500);
await stage('caption', 'white-on-white. 1px type. invisible unicode, decoded.');
await frame.evaluate(() => scrollTo({ top: 520, behavior: 'smooth' }));
await moveTo(820, 640, 1200);
await wait(900);
await frame.evaluate(() => scrollTo({ top: 980, behavior: 'smooth' }));
await moveTo(600, 560, 1200);
await wait(1100);
await stage('caption', 'runs only when you click. nothing leaves your browser.');
await stage('cursor', cx, cy, false);
await stage('zoom', 1.55, 1640, 300); // lean in on the evidence card
await wait(3000);
await stage('zoom', 1, 960, 540);
await wait(700);
await stage('clearCaption');
mark('end');
await stage('end');
await wait(3600);

const filmed = Date.now() / 1000; // the last frames can be still, and a still screen sends no new frames
await cdp.send('Page.stopScreencast');
await wait(300);
await ctx.close();
server.close();
rmSync(ext, { recursive: true, force: true });

// ---- edit: constant 30 fps video from the timestamped frames, plus a quiet score ----
const total = Math.max(shots.at(-1).t + 0.1, filmed - t0);
const list = shots.map((s, i) => `file 'frames/${s.name}'\nduration ${((shots[i + 1]?.t ?? total) - s.t).toFixed(4)}`).join('\n');
writeFileSync(join(out, 'frames.txt'), `${list}\nfile 'frames/${shots.at(-1).name}'\n`);
writeFileSync(join(out, 'cues.json'), JSON.stringify({ total, ...cues }, null, 2));
console.log(`${shots.length} frames over ${total.toFixed(1)} s`, cues);
const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { cwd: out, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed');
};
ff(['-f', 'concat', '-safe', '0', '-i', 'frames.txt', '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', 'silent.mp4']);

// sound: a low violet drone, a soft tick on the toolbar click, a rubber-stamp thump when the count lands
const T = total.toFixed(2);
const at = (s) => Math.max(0, s).toFixed(2);
const drone = `aevalsrc='0.10*sin(2*PI*55*t)+0.06*sin(2*PI*82.5*t)+0.035*sin(2*PI*110.4*t)*(0.6+0.4*sin(2*PI*0.25*t))':s=48000:d=${T}`;
const tick = `aevalsrc='0.5*sin(2*PI*1800*t)*exp(-60*t)':s=48000:d=0.15`;
const thump = `aevalsrc='0.9*sin(2*PI*(70-30*t)*t)*exp(-11*t)+0.25*(random(0)-0.5)*exp(-30*t)':s=48000:d=0.6`;
ff([
  '-f', 'lavfi', '-i', drone,
  '-f', 'lavfi', '-i', tick,
  '-f', 'lavfi', '-i', thump,
  '-filter_complex',
  `[0]afade=t=in:d=2,afade=t=out:st=${at(total - 2.5)}:d=2.5,lowpass=f=900[d];` +
    `[1]adelay=${Math.round(cues.click * 1000)}|${Math.round(cues.click * 1000)}[k];` +
    `[2]adelay=${Math.round((cues.stamp + 0.45) * 1000)}|${Math.round((cues.stamp + 0.45) * 1000)}[s];` +
    `[d][k][s]amix=inputs=3:normalize=0,alimiter=limit=0.9[a]`,
  '-map', '[a]', '-c:a', 'pcm_s16le', 'score.wav',
]);
ff(['-i', 'silent.mp4', '-i', 'score.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', 'invisible-ink-promo.mp4']);
console.log(`Wrote ${join(out, 'invisible-ink-promo.mp4')}`);
