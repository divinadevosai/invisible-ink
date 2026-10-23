// npm run build → dist/ (load unpacked from chrome://extensions or edge://extensions)
//               → invisible-ink-<version>.zip (upload to the Chrome Web Store and Edge Add-ons)
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
copyFileSync(join(src, 'background.js'), join(dist, 'background.js'));
cpSync(join(src, 'icons'), join(dist, 'icons'), { recursive: true });
writeFileSync(
  join(dist, 'LICENSES.txt'),
  'Invisible Ink © 2026 Sweeney Creative.\n\nIncludes the Courier Prime typeface by Alan Dague-Greene and the Instrument Serif typeface by Instrument, both under the SIL Open Font License 1.1:\nhttps://openfontlicense.org\n',
);

const icons = { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' };
const manifest = {
  manifest_version: 3,
  name: 'Invisible Ink — see what AI sees',
  short_name: 'Invisible Ink',
  version,
  description,
  icons,
  action: { default_title: 'Invisible Ink: show what AI sees on this page (Alt+Shift+X)', default_icon: icons },
  background: { service_worker: 'background.js' },
  // activeTab: only the tab you click it on, only when you click. scripting: to run the reader there.
  permissions: ['activeTab', 'scripting'],
  commands: { _execute_action: { suggested_key: { default: 'Alt+Shift+X' }, description: 'Show what AI sees on this page' } },
  // Invisible Ink has no pages of its own and never connects to anything.
  content_security_policy: { extension_pages: "default-src 'none'; script-src 'self'; object-src 'none'" },
  minimum_chrome_version: '120',
};
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const zip = join(root, `invisible-ink-${version}.zip`);
rmSync(zip, { force: true });
const z = spawnSync('zip', ['-qr', zip, '.'], { cwd: dist, stdio: 'inherit' });
if (z.status !== 0) throw new Error('zip failed');
console.log(`Built dist/ and ${zip.slice(root.length + 1)}`);
