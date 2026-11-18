import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { diffFolders } from './screens-diff.mjs';

const png = (path, color, patch) =>
  sharp({ create: { width: 100, height: 200, channels: 4, background: color } })
    .composite(patch ? [{ input: { create: { width: patch.w, height: patch.h, channels: 4, background: '#000' } }, left: patch.x, top: patch.y }] : [])
    .png()
    .toFile(path);

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
