// npm run build → dist/ (load unpacked from chrome://extensions or edge://extensions)
//               → invisible-ink-<version>.zip (upload to the Chrome Web Store and Edge Add-ons)
//               → invisible-ink-<version>-firefox.zip (upload to Firefox Add-ons)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const dist = join(root, 'dist');
const { version, description } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (description.length > 132) throw new Error(`description is ${description.length} characters; the stores allow 132`);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// One self-contained script for the page, fonts and styles included, so nothing on the page
// can point back at the extension (no web-accessible files).
await build({
  entryPoints: [join(src, 'ink.js')],
  outfile: join(dist, 'ink.js'),
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  minify: true,
  charset: 'utf8',
  loader: { '.woff2': 'binary', '.css': 'text' },
  legalComments: 'none',
});
for (const f of ['background.js', 'cant.html', 'cant.css']) copyFileSync(join(src, f), join(dist, f));
// the "can't read this page" card uses the same type as the evidence card
mkdirSync(join(dist, 'fonts'));
const fontsrc = join(root, 'node_modules/@fontsource');
copyFileSync(join(fontsrc, 'courier-prime/files/courier-prime-latin-400-normal.woff2'), join(dist, 'fonts', 'courier-prime.woff2'));
copyFileSync(join(fontsrc, 'instrument-serif/files/instrument-serif-latin-400-normal.woff2'), join(dist, 'fonts', 'instrument-serif.woff2'));
copyFileSync(join(fontsrc, 'instrument-serif/files/instrument-serif-latin-400-italic.woff2'), join(dist, 'fonts', 'instrument-serif-italic.woff2'));
cpSync(join(src, 'icons'), join(dist, 'icons'), { recursive: true });
writeFileSync(
  join(dist, 'LICENSES.txt'),
  'Invisible Ink © 2026 Sweeney Creative.\n\nIncludes the Courier Prime typeface by Alan Dague-Greene and the Instrument Serif typeface by Instrument, both under the SIL Open Font License 1.1:\nhttps://openfontlicense.org\n',
);

const icons = { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' };
const manifest = {
  manifest_version: 3,
  name: 'Invisible Ink — see what AI sees',
  version,
  description,
  icons,
  action: { default_title: 'Invisible Ink: show what AI sees on this page (Alt+Shift+X)', default_icon: icons },
  background: { service_worker: 'background.js' },
  // activeTab: only the tab you click it on, only when you click. scripting: to run the reader there.
  permissions: ['activeTab', 'scripting'],
  commands: { _execute_action: { suggested_key: { default: 'Alt+Shift+X' }, description: 'Show what AI sees on this page' } },
  // Its only page is the "can't read this page" card, and it never connects to anything.
  content_security_policy: { extension_pages: "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'" },
  minimum_chrome_version: '120',
};
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const zip = join(root, `invisible-ink-${version}.zip`);
rmSync(zip, { force: true });
const z = spawnSync('zip', ['-qr', zip, '.'], { cwd: dist, stdio: 'inherit' });
if (z.status !== 0) throw new Error('zip failed');
// Firefox: the same build with what Firefox needs in its manifest. It has no extension service workers (the
// background runs as a page from "scripts"), needs a fixed add-on ID (never change it), and new add-ons must
// declare what data they collect: none. Reviewers rebuild this from source with `npm ci && npm run build`.
const FIREFOX_ID = 'invisible-ink@swe3we.dev';
const firefox = join(root, 'dist-firefox');
rmSync(firefox, { recursive: true, force: true });
cpSync(dist, firefox, { recursive: true });
const { service_worker: worker, ...background } = manifest.background;
const { minimum_chrome_version: _chromeOnly, ...shared } = manifest;
const firefoxManifest = {
  ...shared,
  background: { ...background, scripts: [worker] },
  browser_specific_settings: { gecko: { id: FIREFOX_ID, strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } } },
};
writeFileSync(join(firefox, 'manifest.json'), JSON.stringify(firefoxManifest, null, 2) + '\n');
const firefoxZip = join(root, `invisible-ink-${version}-firefox.zip`);
rmSync(firefoxZip, { force: true });
if (spawnSync('zip', ['-qr', firefoxZip, '.'], { cwd: firefox, stdio: 'inherit' }).status !== 0) throw new Error('zip failed');
console.log(`Built dist/, dist-firefox/, ${zip.slice(root.length + 1)} (Chrome and Edge) and ${firefoxZip.slice(root.length + 1)} (Firefox)`);
