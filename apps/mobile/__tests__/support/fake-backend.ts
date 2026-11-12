import { buildProfile, fixtureId, SAMPLE_TODAY } from '../../scripts/e2e/fixtures.mjs';

/** The network is the boundary: real supabase-js and real Legend-State sync talk to this. */
export const USER_ID = '11111111-1111-4111-8111-111111111111';
const STAMP = '2026-10-01T00:00:00.000Z';

const SYSTEM_CATEGORIES: [name: string, type: string, icon: string, color: string][] = [
  ['Food & Dining', 'expense', 'silverware-fork-knife', '#FB7F77'],
  ['Transportation', 'expense', 'car', '#69DBD5'],
  ['Housing', 'expense', 'home-variant', '#7CBDF8'],
  ['Entertainment', 'expense', 'movie-open', '#FBA75E'],
  ['Shopping', 'expense', 'shopping', '#EFAE6F'],
  ['Healthcare', 'expense', 'heart-pulse', '#F1966D'],
  ['Subscriptions', 'expense', 'autorenew', '#95ADCD'],
  ['Gifts & Donations', 'expense', 'gift-outline', '#E77BE7'],
  ['Salary', 'income', 'cash', '#7CD76C'],
  ['Freelance', 'income', 'laptop', '#68CBFB'],
];

export const id = (...parts: string[]): string => fixtureId(USER_ID, ...parts);

const systemCategoryRows = SYSTEM_CATEGORIES.map(([name, type, icon, color], index) => ({
  id: id('system-category', name),
  user_id: null,
  name,
  type,
  icon,
  color,
  is_active: true,
  display_order: index + 1,
  deleted: false,
}));
export const systemCategoryId = (name: string): string => id('system-category', name);

export type Profile = 'empty' | 'full';
type Row = Record<string, unknown>;

let tables: Record<string, Row[]> = {};
let online = true;

export function setOnline(value: boolean): void {
  online = value;
}
/** What the server holds. A brand new account still sees the system categories. */
export function serve(profile: Profile): void {
  const built = buildProfile(profile, {
    userId: USER_ID,
    today: SAMPLE_TODAY,
    systemCategories: Object.fromEntries(systemCategoryRows.map((row) => [row.name, row.id])),
  });
  const rows = built.rows as Record<string, Row[]>;
  tables = {
    ...rows,
    categories: [...systemCategoryRows, ...(rows.categories ?? [])],
    profiles: [{ id: USER_ID, display_name: built.displayName, preferences: built.preferences }],
  };
  for (const table of Object.values(tables)) {
    for (const row of table) {
      row.created_at ??= STAMP;
      row.updated_at ??= STAMP;
    }
  }
}

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [column, condition] of params) {
    const dot = condition.indexOf('.');
    const op = condition.slice(0, dot);
    const value = condition.slice(dot + 1);
    if (op === 'eq' && String(row[column]) !== value) return false;
    if (op === 'gt' && String(row[column]) <= value) return false;
  }
  return true;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** PostgREST for the handful of verbs the app sends; anything else is empty, never an error. */
export async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!online) throw new TypeError('Network request failed');
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const rest = url.pathname.match(/^\/rest\/v1\/([^/]+)$/);
  if (!rest) return json({});
  const headers = new Headers(init?.headers);
  const method = init?.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : [];
    return json(Array.isArray(body) ? body : [body], 201);
  }
  const rows = (tables[rest[1]] ?? []).filter((row) => matches(row, url.searchParams));
  if (headers.get('Accept')?.includes('vnd.pgrst.object')) {
    return rows[0] ? json(rows[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406);
  }
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const limit = Number(url.searchParams.get('limit') ?? rows.length);
  return json(rows.slice(offset, offset + limit));
}

/** The realtime socket stays silent: a push is not what these tests are about. */
export class SilentWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = SilentWebSocket.CONNECTING;
  binaryType = 'blob';
  url: string;
  protocol = '';
  bufferedAmount = 0;
  onopen: unknown = null;
  onclose: unknown = null;
  onerror: unknown = null;
  onmessage: unknown = null;
  constructor(url: string) {
    this.url = url;
  }
  send(): void {}
  close(): void {
    this.readyState = SilentWebSocket.CLOSED;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
}

export function sessionStorageEntry(): [key: string, value: string] {
  const expires = Math.floor(Date.parse('2030-01-01T00:00:00Z') / 1000);
  return [
    'sb-example-auth-token',
    JSON.stringify({
      access_token: 'test.jwt.token',
      refresh_token: 'refresh',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expires,
      user: {
        id: USER_ID,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'kai@example.com',
        app_metadata: {},
        user_metadata: { display_name: 'Kai' },
        created_at: STAMP,
      },
    }),
  ];
}
