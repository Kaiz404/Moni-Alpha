import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { type Bucket, emptyFolder } from './files.ts';

/** A bucket in memory that lists like Storage: direct children only, subfolders once each, sorted. */
function memoryBucket(paths: string[], { removeLimit = Infinity } = {}) {
  const files = new Set(paths);
  const bucket: Bucket = {
    list(folder, limit) {
      const children = new Map<string, boolean>();
      for (const path of files) {
        if (!path.startsWith(`${folder}/`)) continue;
        const [name, ...rest] = path.slice(folder.length + 1).split('/');
        children.set(name, rest.length > 0);
      }
      const entries = [...children].sort(([a], [b]) => a.localeCompare(b)).map(([name, folder]) => ({ name, folder }));
      return Promise.resolve(entries.slice(0, limit));
    },
    remove(batch) {
      const gone = batch.slice(0, removeLimit).filter((path) => files.delete(path));
      return Promise.resolve(gone.length);
    },
  };
  return { bucket, files };
}

const receipts = (user: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${user}/${String(i).padStart(4, '0')}.jpg`);

Deno.test('emptying a user folder removes every page of receipts and nothing of anyone else', async () => {
  const { bucket, files } = memoryBucket([...receipts('u1', 250), 'u1/old/a.jpg', ...receipts('u2', 3)]);
  assertEquals(await emptyFolder(bucket, 'u1'), 251);
  assertEquals([...files].sort(), ['u2/0000.jpg', 'u2/0001.jpg', 'u2/0002.jpg']);
});

Deno.test('a second run after a cut-short one finishes the job', async () => {
  const { bucket, files } = memoryBucket(receipts('u1', 150));
  let calls = 0;
  const crashing: Bucket = {
    ...bucket,
    remove: (paths) => (++calls === 2 ? Promise.reject(new Error('network')) : bucket.remove(paths)),
  };
  await assertRejects(() => emptyFolder(crashing, 'u1'), Error, 'network');
  assertEquals(files.size, 50);
  assertEquals(await emptyFolder(bucket, 'u1'), 50);
  assertEquals(files.size, 0);
});

Deno.test('Storage removing part of a page still converges', async () => {
  const { bucket, files } = memoryBucket(receipts('u1', 150), { removeLimit: 40 });
  assertEquals(await emptyFolder(bucket, 'u1'), 150);
  assertEquals(files.size, 0);
});

Deno.test('a bucket that refuses to remove stops the run instead of looping', async () => {
  const { bucket } = memoryBucket(receipts('u1', 2), { removeLimit: 0 });
  await assertRejects(() => emptyFolder(bucket, 'u1'), Error, 'Storage kept the files under u1');
});
