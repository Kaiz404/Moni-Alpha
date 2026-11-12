/**
 * Moni's replies that finished in this app run and have not played their
 * entrance yet. In memory only: a reopened thread shows every reply at once.
 */
const fresh = new Set<string>();

export function markFresh(id: string) {
  fresh.add(id);
}

export function isFresh(id: string): boolean {
  return fresh.has(id);
}

/** The entrance played (or was cut short); from now on the reply shows whole. */
export function settle(id: string) {
  fresh.delete(id);
}
