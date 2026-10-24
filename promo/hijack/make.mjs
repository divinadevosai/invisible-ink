// Edits the "Copilot vs hidden instructions" video from two screen recordings made in Edge on
// swe3we.dev/quiet-kitchen/brown-butter-banana-bread/ (the recordings stay out of git).
// node promo/hijack/make.mjs <copilot recording> <lamp recording> → promo/out/copilot-hijack.mp4
// Times below are for the 24 October 2026 recordings.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [copilot, lamp] = process.argv.slice(2);
if (!copilot || !lamp) throw new Error('usage: node promo/hijack/make.mjs <copilot recording> <lamp recording>');
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'out', 'hijack');
mkdirSync(out, { recursive: true });

// captions and end card as images
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`file://${join(here, 'cards.html')}`);
await page.evaluate(() => document.fonts.ready);
for (const id of ['c1', 'c2', 'c3', 'c4', 'c5', 'end']) {
  await page.evaluate((x) => document.querySelectorAll('.frame').forEach((f) => f.classList.toggle('on', f.id === x)), id);
  await page.locator(`#${id}`).screenshot({ path: join(out, `${id}.png`), omitBackground: id !== 'end' });
}
await browser.close();

const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { cwd: out, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
};
const V = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30';
const enc = ['-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p'];
// a clip of a recording, sped up by `speed`, with a caption laid over it
const clip = (name, src, from, to, speed, caption) =>
  ff(['-ss', String(from), '-to', String(to), '-i', src, '-i', `${caption}.png`, '-filter_complex',
    `[0:v]setpts=PTS/${speed},${V}[v];[v][1:v]overlay=0:0:format=auto,fade=t=in:st=0:d=0.25[o]`, '-map', '[o]', ...enc, `${name}.mp4`]);

clip('a', copilot, 0.5, 5, 1, 'c1'); // the page, looking normal
clip('b', copilot, 27.5, 34.5, 1.6, 'c2'); // typing "summarize this page"
clip('c', copilot, 34.5, 44, 2, 'c2'); // the answer streams in
// Copilot's "Extra Notes", frozen and enlarged over a dimmed frame, with a slow push in
ff(['-ss', '46.5', '-i', copilot, '-frames:v', '1', 'notes.png']);
ff(['-loop', '1', '-t', '5', '-i', 'notes.png', '-i', 'c3.png', '-filter_complex',
  `[0:v]split[a][b];` +
  `[a]${V},boxblur=8,eq=brightness=-0.35[bg];` +
  `[b]crop=380:180:2180:905,scale=1330:-1,setsar=1,` +
  `zoompan=z='min(1+0.012*on,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1330x630:fps=30[fg];` +
  `[bg][fg]overlay=(W-w)/2:(H-h)/2-60[v];[v][1:v]overlay=0:0:format=auto,fade=t=in:st=0:d=0.25[o]`,
  '-map', '[o]', '-t', '5', ...enc, 'd.mp4']);
clip('e', lamp, 31, 38, 1, 'c4'); // the lamp comes on
clip('f', lamp, 38, 46, 1.2, 'c5'); // scrolling the evidence: all seven
ff(['-loop', '1', '-i', 'end.png', '-t', '4.5', '-vf', 'fps=30,fade=t=in:st=0:d=0.5', ...enc, 'g.mp4']);

writeFileSync(join(out, 'parts.txt'), ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((p) => `file '${p}.mp4'`).join('\n') + '\n');
ff(['-f', 'concat', '-safe', '0', '-i', 'parts.txt', '-c', 'copy', 'silent.mp4']);
const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(out, 'silent.mp4')]);
const total = parseFloat(probe.stdout.toString());
// the same quiet violet drone as the promo
ff(['-f', 'lavfi', '-i', `aevalsrc='0.10*sin(2*PI*55*t)+0.06*sin(2*PI*82.5*t)+0.035*sin(2*PI*110.4*t)*(0.6+0.4*sin(2*PI*0.25*t))':s=48000:d=${total.toFixed(2)}`,
  '-af', `afade=t=in:d=1.5,afade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5,lowpass=f=900`, '-c:a', 'pcm_s16le', 'score.wav']);
const final = join(here, '..', 'out', 'copilot-hijack.mp4');
ff(['-i', 'silent.mp4', '-i', 'score.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', final]);
console.log(`Wrote ${final} (${total.toFixed(1)} s)`);
