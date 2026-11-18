/** The two Storage calls emptying a folder needs, so the tests can use a bucket in memory. */
export type Bucket = {
  /** Up to `limit` entries directly under `folder`, files and subfolders alike. */
  list(folder: string, limit: number): Promise<{ name: string; folder: boolean }[]>;
  /** Removes the files at `paths` and returns how many it removed. */
  remove(paths: string[]): Promise<number>;
};

const PAGE = 100;

/**
 * Removes every file under `folder`, subfolders included, a page at a time. Each pass lists from the
 * start again, so a run cut short leaves nothing the next run can't finish.
 */
export async function emptyFolder(bucket: Bucket, folder: string): Promise<number> {
  let removed = 0;
  for (;;) {
    const entries = await bucket.list(folder, PAGE);
    if (entries.length === 0) return removed;
    const files = entries.filter((entry) => !entry.folder).map((entry) => `${folder}/${entry.name}`);
    let pass = files.length > 0 ? await bucket.remove(files) : 0;
    for (const sub of entries.filter((entry) => entry.folder)) {
      pass += await emptyFolder(bucket, `${folder}/${sub.name}`);
    }
    if (pass === 0) throw new Error(`Storage kept the files under ${folder}`);
    removed += pass;
  }
}
