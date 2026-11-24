// Bundles once and renders half-scale stills of an Editorial composition, so a look at many frames costs one bundle.
// usage: node src/directions/editorial/stills.mjs <CompositionId> [seconds ...]
// With no seconds, renders each shot's beat moments: 0.6 s in, its echo or midpoint, and 0.3 s before it ends, plus the end card.
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {editorialCuts as cuts} from './shots.ts';

const FPS = 30;

const root = join(import.meta.dirname, '../../..');
const [id, ...times] = process.argv.slice(2);
const cut = cuts[id]?.cut;
if (!cut) throw new Error(`unknown id ${id}; known: ${Object.keys(cuts).join(', ')}`);

const moments = [];
if (times.length) {
  for (const s of times) moments.push({t: Number(s), name: `t${s}`});
} else {
  let t = 0;
  cut.shots.forEach((s, i) => {
    const key = s.echo ? s.echo.at + 0.9 : s.dur / 2;
    moments.push({t: t + 0.6, name: `${i + 1}a-${s.id}`}, {t: t + key, name: `${i + 1}b-${s.id}`}, {t: t + s.dur - 0.3, name: `${i + 1}c-${s.id}`});
    t += s.dur;
  });
  moments.push({t: t + cut.end.dur - 0.2, name: 'end'});
}

const serveUrl = await bundle({entryPoint: join(root, 'src/index.ts')});
const composition = await selectComposition({serveUrl, id});
const dir = join(root, 'out/editorial/frames', id);
mkdirSync(dir, {recursive: true});
for (const m of moments) {
  const output = join(dir, `${m.name}.png`);
  await renderStill({serveUrl, composition, output, frame: Math.min(composition.durationInFrames - 1, Math.round(m.t * FPS)), scale: 0.5, timeoutInMilliseconds: 180000});
  console.log(output);
}
