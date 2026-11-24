// Renders every video in src/videos.ts (or the ids given) to out/, then pulls one frame per shot midpoint from the rendered mp4 into out/frames/<video>/.
// Bundles once and renders every video from that bundle; GPU and concurrency settings come from remotion.config.ts (see RENDERING.md).
// usage: node scripts/render-all.mts [VideoId ...]
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {videos} from '../src/videos.ts';

const root = join(import.meta.dirname, '..');
const ffmpeg = join(process.env.HOME!, '.local/opt/ffmpeg-static/bin/ffmpeg');
const only = process.argv.slice(2);
const bundle = mkdtempSync(join(tmpdir(), 'moni-promo-bundle-'));
execFileSync('npx', ['remotion', 'bundle', 'src/index.ts', `--out-dir=${bundle}`, '--log=error'], {cwd: root, stdio: 'inherit'});

for (const v of videos.filter((v) => only.length === 0 || only.includes(v.id))) {
  const out = join(root, 'out', v.out);
  const started = Date.now();
  execFileSync('npx', ['remotion', 'render', bundle, v.id, out, '--log=error'], {cwd: root, stdio: 'inherit'});
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  const name = v.out.replace(/\.mp4$/, '');
  const dir = join(root, 'out', 'frames', name);
  rmSync(dir, {recursive: true, force: true});
  mkdirSync(dir, {recursive: true});
  let t = 0;
  v.shots.forEach((s, i) => {
    const mid = t + s.dur / 2;
    const file = join(dir, `${String(i + 1).padStart(2, '0')}-${s.id}.png`);
    execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-ss', mid.toFixed(3), '-i', out, '-frames:v', '1', file]);
    t += s.dur;
  });
  console.log(`${v.out}: ${t.toFixed(1)} s of video rendered in ${seconds} s, ${v.shots.length} midpoint frames in ${dir}`);
}

rmSync(bundle, {recursive: true, force: true});
