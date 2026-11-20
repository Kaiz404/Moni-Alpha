/**
 * Sends one row's writes one at a time, in the order they were made. Sync can have two writes for the
 * same row in flight at once (a change, then its Undo a second later); if the server got them in the
 * other order it would keep the change. Writes to different rows still go out together.
 */
export function createRowOrder() {
  const last = new Map<string, Promise<unknown>>();
  return function inOrder<T>(key: string, write: () => Promise<T>): Promise<T> {
    const before = last.get(key) ?? Promise.resolve();
    const next = before.catch(() => undefined).then(write);
    last.set(key, next);
    void next.finally(() => {
      if (last.get(key) === next) last.delete(key);
    }).catch(() => undefined);
    return next;
  };
}
