import type { MoniSupabase } from '../supabase';

type Row = Record<string, unknown>;
type Result = { data: Row[] | null; error: { message: string; code?: string } | null };

/**
 * Postgres behind PostgREST as the store meets it: a response stops at `maxRows` with no error, a
 * table the server lacks answers PGRST205, and offline every request fails as React Native's does.
 */
export function fakeSupabase() {
  const server = {
    tables: new Map<string, Row[]>(),
    maxRows: 1000,
    offline: false,
    failOnRequest: null as number | null,
    requests: 0,
    calls: [] as string[],
    userId: 'user-1' as string | null,
    /** `table id` of each row an insert added, and of each an insert refused for a key clash. */
    inserted: [] as string[],
    clashes: [] as string[],
    /** `table.column` a migration the server has not had yet would add. */
    missingColumns: new Set<string>(),
    /**
     * How long a request takes to reach the server, by its call (`insert transactions`). Unset, every
     * request lands at once, in the order it was sent.
     */
    latency: null as ((call: string) => number) | null,
    /** Set, the server stamps `created_at` and `updated_at` as Postgres's defaults and trigger do. */
    clock: null as (() => string) | null,
    /** `table.column` to the table its foreign key points at; a write to a missing row is refused. */
    foreignKeys: new Map<string, string>(),
    /** How long a landed write takes to reach the realtime handlers; unset, it reaches them at once. */
    realtimeLag: 0,
    /** Realtime handlers by table; each landed write reaches them as Postgres's change feed would. */
    realtime: new Map<string, ((payload: { eventType: string; new: Row; old: Row }) => void)[]>(),
  };

  const missing = (table: string): Result => ({
    data: null,
    error: { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` },
  });
  const offline: Result = { data: null, error: { message: 'TypeError: Network request failed' } };

  function query(table: string, op: string, run: (rows: Row[]) => Row[], inserting?: Row[], columns?: string, patch?: Row) {
    const filters: ((row: Row) => boolean)[] = [];
    let orderBy: string | null = null;
    let window: [number, number] | null = null;
    let limit: number | null = null;
    const builder = {
      select: () => builder,
      gt: (field: string, value: string) => {
        filters.push((row) => new Date(String(row[field])) > new Date(value));
        return builder;
      },
      eq: (field: string, value: unknown) => {
        filters.push((row) => row[field] === value);
        return builder;
      },
      order: (field: string) => {
        orderBy = field;
        return builder;
      },
      range: (from: number, to: number) => {
        window = [from, to];
        return builder;
      },
      limit: (count: number) => {
        limit = count;
        return builder;
      },
      single: () =>
        new Promise((resolve, reject) =>
          builder.then((result) => resolve({ ...result, data: result.data?.[0] ?? null }), reject),
        ),
      maybeSingle: () => builder.single(),
      then: (resolve: (result: Result) => unknown, reject: (error: unknown) => unknown) => {
        const label = op === 'list' && limit !== null ? 'probe' : op;
        const call = `${label} ${table}${window ? ` ${window.join('-')}` : ''}`;
        server.calls.push(call);
        server.requests += 1;
        const failed = server.offline || server.failOnRequest === server.requests;
        // A request's body leaves the device when it is sent, so a later local change can't alter it.
        const sent = inserting && structuredClone(inserting);
        const land = () => (failed ? offline : arrive(sent));
        const delay = server.latency?.(call) ?? 0;
        const landed = delay > 0 ? new Promise<Result>((done) => setTimeout(() => done(land()), delay)) : Promise.resolve(land());
        return landed.then(resolve, reject);
      },
    };
    function arrive(sent: Row[] | undefined): Result {
      const rows = server.tables.get(table);
      if (columns && server.missingColumns.has(`${table}.${columns}`))
        return { data: null, error: { code: '42703', message: `column ${table}.${columns} does not exist` } };
      if (!rows) return missing(table);
      const dangling = (row: Row) =>
        [...server.foreignKeys].find(([column, target]) => {
          const [from, field] = column.split('.') as [string, string];
          const value = row[field];
          return from === table && value != null && !server.tables.get(target)?.some((other) => other.id === value);
        });
      const broken = (sent ?? (patch ? [patch] : [])).map(dangling).find(Boolean);
      if (broken) return { data: null, error: { code: '23503', message: `insert or update on table "${table}" violates foreign key constraint "${broken[0].replace('.', '_')}_fkey"` } };
      if (sent && rows.some((row) => sent.some((insert) => insert.id !== undefined && row.id === insert.id))) {
        for (const insert of sent) server.clashes.push(`${table} ${String(insert.id)}`);
        return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
      }
      if (sent) {
        const now = server.clock?.();
        const added = sent.map((insert) => (now ? { ...insert, created_at: now, updated_at: now } : insert));
        for (const insert of added) server.inserted.push(`${table} ${String(insert.id)}`);
        rows.push(...added);
        for (const insert of added) notify(table, 'INSERT', insert);
        return { data: added.map((insert) => ({ ...insert })), error: null };
      }
      const all = run(rows.filter((row) => filters.every((keep) => keep(row))));
      if (op === 'update') for (const changed of all) notify(table, 'UPDATE', changed);
      if (orderBy) {
        const field = orderBy;
        all.sort((a, b) => String(a[field]).localeCompare(String(b[field])));
      }
      const asked = window ? all.slice(window[0], window[1] + 1) : all;
      return { data: asked.slice(0, Math.min(server.maxRows, limit ?? Infinity)).map((row) => ({ ...row })), error: null };
    }
    return builder;
  }

  function notify(table: string, eventType: string, row: Row) {
    const payload = { eventType, new: { ...row }, old: {} };
    const send = () => {
      for (const handler of server.realtime.get(table) ?? []) handler(payload);
    };
    if (server.realtimeLag > 0) setTimeout(send, server.realtimeLag);
    else send();
  }

  const client = {
    from: (table: string) => ({
      select: (columns?: string) => query(table, 'list', (rows) => [...rows], undefined, columns),
      insert: (row: Row | Row[]) => query(table, 'insert', () => [], Array.isArray(row) ? row : [row]),
      update: (patch: Row) => {
        const sent = structuredClone(patch);
        return query(
          table,
          'update',
          (matched) => matched.map((row) => Object.assign(row, sent, server.clock ? { updated_at: server.clock() } : {})),
          undefined,
          undefined,
          sent,
        );
      },
    }),
    channel: () => {
      const channel = {
        on: (_event: string, filter: { table: string }, handler: (payload: { eventType: string; new: Row; old: Row }) => void) => {
          server.calls.push(`subscribe ${filter.table}`);
          server.realtime.set(filter.table, [...(server.realtime.get(filter.table) ?? []), handler]);
          return channel;
        },
        subscribe: () => channel,
        unsubscribe: () => {},
      };
      return channel;
    },
    removeChannel: () => {},
    auth: {
      getSession: async () => ({
        data: { session: server.userId ? { user: { id: server.userId } } : null },
      }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
    },
  };

  return { server, supabase: client as unknown as MoniSupabase };
}
