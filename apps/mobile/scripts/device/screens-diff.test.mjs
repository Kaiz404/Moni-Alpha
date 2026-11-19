import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { diffFolders } from './screens-diff.mjs';

const box = (w, h, x, y, background) => ({ input: { create: { width: w, height: h, channels: 4, background } }, left: x, top: y });
const png = (path, color, patch) =>
  sharp({ create: { width: 100, height: 200, channels: 4, background: color } })
    .composite([box(10, 10, 80, 180, '#08f'), ...(patch ? [box(patch.w, patch.h, patch.x, patch.y, '#000')] : [])])
    .png()
    .toFile(path);
const flat = (path, background) => sharp({ create: { width: 100, height: 200, channels: 4, background } }).png().toFile(path);

test('sorts screenshots into same, changed, missing and new, ignoring the status bar', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'screens-diff-'));
  const [a, b] = [join(dir, 'a'), join(dir, 'b')];
  await import('node:fs').then((fs) => (fs.mkdirSync(a), fs.mkdirSync(b)));
  await png(join(a, 'home.png'), '#fff');
  await png(join(b, 'home.png'), '#fff', { x: 0, y: 0, w: 100, h: 8 });
  await png(join(a, 'budget.png'), '#fff');
  await png(join(b, 'budget.png'), '#fff', { x: 10, y: 100, w: 20, h: 20 });
  await png(join(a, 'debts.png'), '#fff');
  await png(join(b, 'chat.png'), '#fff');
  await png(join(a, 'step-001-tap.png'), '#fff');
  const r = await diffFolders(a, b, join(dir, 'out'));
  assert.deepEqual(r.same, ['home.png']);
  assert.deepEqual(r.changed.map((c) => c.name), ['budget.png']);
  assert.equal(r.changed[0].fraction, 400 / (100 * 190));
  assert.deepEqual(r.onlyBase, ['debts.png']);
  assert.deepEqual(r.onlyHead, ['chat.png']);
});

test('a blank frame or a floating window over most of the screen never reads as same', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'screens-diff-'));
  const [a, b] = [join(dir, 'a'), join(dir, 'b')];
  await import('node:fs').then((fs) => (fs.mkdirSync(a), fs.mkdirSync(b)));
  const scene = (path) =>
    sharp({ create: { width: 100, height: 200, channels: 3, background: '#fff' } })
      .composite([{ input: { create: { width: 30, height: 30, channels: 3, background: '#08f' } }, left: 20, top: 60 }])
      .png()
      .toFile(path);
  await scene(join(a, 'black.png'));
  await flat(join(b, 'black.png'), '#000');
  await scene(join(a, 'covered.png'));
  await scene(join(b, 'covered.png'));
  await flat(join(b, 'new-black.png'), '#000');
  await import('node:fs').then((fs) => fs.writeFileSync(join(b, 'overlays.txt'), '0 0 100 200\n'));
  const r = await diffFolders(a, b);
  assert.deepEqual(r.same, []);
  assert.deepEqual(
    r.changed.map((c) => [c.name, c.reason]),
    [
      ['black.png', 'blank frame on head'],
      ['covered.png', 'a floating window covers 100%'],
    ],
  );
  assert.deepEqual(r.blankNew, ['new-black.png']);
});
