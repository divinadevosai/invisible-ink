// Draws src/icons/*.png and the stores' 300px logo (docs/store/logo-300.png) from one SVG: a drop of fluorescent ink on a UV-violet tile.
// node scripts/icons.mjs (needs Playwright; the PNGs are committed)
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'icons');
const store = join(out, '..', '..', 'docs', 'store');
mkdirSync(out, { recursive: true });
mkdirSync(store, { recursive: true });

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs>
    <radialGradient id="uv" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#4a1d8c"/><stop offset="1" stop-color="#1d0838"/></radialGradient>
    <radialGradient id="ink" cx="42%" cy="62%" r="60%"><stop offset="0" stop-color="#f6ffad"/><stop offset=".55" stop-color="#e6ff4d"/><stop offset="1" stop-color="#b8d814"/></radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${size < 40 ? 3 : 6}"/></filter>
  </defs>
  <rect width="128" height="128" rx="${size < 40 ? 24 : 28}" fill="url(#uv)"/>
  <path id="drop" d="M64 18 C64 18 30 60 30 80 a34 34 0 0 0 68 0 C98 60 64 18 64 18 Z" fill="#e6ff4d" opacity=".55" filter="url(#glow)"/>
  <path d="M64 18 C64 18 30 60 30 80 a34 34 0 0 0 68 0 C98 60 64 18 64 18 Z" fill="url(#ink)"/>
  ${size >= 48 ? '<path d="M47 82 a17 17 0 0 0 12 16" fill="none" stroke="#fffde0" stroke-width="5" stroke-linecap="round" opacity=".8"/>' : ''}
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128, 300]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg(size)}`);
  await page.locator('svg').screenshot({ path: size === 300 ? join(store, 'logo-300.png') : join(out, `${size}.png`), omitBackground: true });
}
await browser.close();
console.log('icons written');
