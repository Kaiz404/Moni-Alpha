export type Screen =
  | 'auth'
  | 'nav'
  | 'home'
  | 'activity'
  | 'txn'
  | 'capture'
  | 'review'
  | 'chat'
  | 'budget'
  | 'debts'
  | 'profile'
  | 'wallet'
  | 'sheet'
  | 'map';

export type TestId = `${Screen}.${string}`;

function kebab(part: string | number): string {
  return String(part)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** Maestro selects controls by these ids: `tid('home', 'recent', 'row', id)` is `home.recent.row.<id>`. */
export function tid(screen: Screen, part: string | number, ...rest: (string | number)[]): TestId {
  return `${screen}.${[part, ...rest].map(kebab).join('.')}`;
}
