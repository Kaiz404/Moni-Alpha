import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { maskFile, parsePinnedBounds } from './overlays.mjs';

const dumpsys = `
  * Task{a1 #12 type=standard A=10200:com.anonymous.moni.e2e U=0 visible=true mode=fullscreen}
        mBounds=Rect(0, 0 - 1220, 2712)
  * Task{b3c2e1f #907 type=standard A=10354:com.whatsapp:voip U=0 visible=true mode=pinned translucent=true sz=1}
        mGlobalConfig={ winConfig={ mBounds=Rect(878, 122 - 1202, 842) mAppBounds=Rect(878, 122 - 1202, 842) }}
        mOverrideConfig={ winConfig={ mBounds=Rect(878, 122 - 1202, 842) }}
`;

test('finds only the pinned window, once', () => {
  assert.deepEqual(parsePinnedBounds(dumpsys), [[878, 122, 1202, 842]]);
});

test('blacks out the rectangle and leaves the rest', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'overlays-')), 'shot.png');
  await sharp({ create: { width: 100, height: 100, channels: 4, background: '#ffffff' } }).png().toFile(path);
  await maskFile(path, [[10, 10, 30, 20]]);
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
  assert.deepEqual(at(15, 15), [0, 0, 0]);
  assert.deepEqual(at(50, 50), [255, 255, 255]);
});
