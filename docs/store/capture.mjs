// Real screenshots of the built extension on the demo page (served as thequietkitchen.example, which can never be a real site), for the store images and website.
// npm run build && node docs/store/capture.mjs → docs/store/raw/*.png (then open slides.html via make.mjs)
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const raw = join(here, 'raw');
mkdirSync(raw, { recursive: true });

const ext = mkdtempSync(join(tmpdir(), 'ink-shots-'));
cpSync(join(root, 'dist'), ext, { recursive: true });
const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['http://thequietkitchen.example/*'];
writeFileSync(join(ext, 'manifest.json'), JSON.stringify(manifest));

const demo = readFileSync(join(root, 'demo', 'index.html'));
const server = createServer((q, r) => r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(demo));
await new Promise((r) => server.listen(5078, '127.0.0.1', r));
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ink-sp-')), {
  channel: 'chromium',
  headless: true,
  ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--disable-features=DisableLoadExtensionCommandLineSwitch', '--no-proxy-server', '--host-resolver-rules=MAP thequietkitchen.example:80 127.0.0.1:5078'],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));

async function shoot(name, { width, height, scale = 1, scroll = 0, mouse = [width * 0.35, height * 0.5] }) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width, height });
  if (scale !== 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  }
  await page.goto('http://thequietkitchen.example/brown-butter-banana-bread');
  await page.bringToFront();
  await page.evaluate((y) => scrollTo(0, y), scroll);
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await run(tab);
  });
  await page.mouse.move(...mouse);
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(raw, `${name}.png`) });
  await page.close();
}
await shoot('lamp', { width: 1280, height: 800, mouse: [520, 420] });
await shoot('lamp-2x', { width: 1280, height: 800, scale: 2, mouse: [520, 420] });
await shoot('scrolled-2x', { width: 1280, height: 800, scale: 2, scroll: 560, mouse: [480, 360] });
await ctx.close();
server.close();
console.log('raw screenshots in', raw);
