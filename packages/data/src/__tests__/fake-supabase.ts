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
  };

  const missing = (table: string): Result => ({
    data: null,
    error: { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` },
  });
  const offline: Result = { data: null, error: { message: 'TypeError: Network request failed' } };

  function query(table: string, op: string, run: (rows: Row[]) => Row[], inserting?: Row[], columns?: string) {
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
      then: (resolve: (result: Result) => unknown, reject: (error: unknown) => unknown) => {
        const label = op === 'list' && limit !== null ? 'probe' : op;
        server.calls.push(`${label} ${table}${window ? ` ${window.join('-')}` : ''}`);
        server.requests += 1;
        let result: Result;
        const rows = server.tables.get(table);
        if (server.offline || server.failOnRequest === server.requests) result = offline;
        else if (columns && server.missingColumns.has(`${table}.${columns}`))
          result = { data: null, error: { code: '42703', message: `column ${table}.${columns} does not exist` } };
        else if (!rows) result = missing(table);
        else if (inserting && rows.some((row) => inserting.some((insert) => insert.id !== undefined && row.id === insert.id))) {
          for (const insert of inserting) server.clashes.push(`${table} ${String(insert.id)}`);
          result = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        } else if (inserting) {
          for (const insert of inserting) server.inserted.push(`${table} ${String(insert.id)}`);
          rows.push(...inserting);
          result = { data: inserting, error: null };
        } else {
          const all = run(rows.filter((row) => filters.every((keep) => keep(row))));
          if (orderBy) {
            const field = orderBy;
            all.sort((a, b) => String(a[field]).localeCompare(String(b[field])));
          }
          const asked = window ? all.slice(window[0], window[1] + 1) : all;
          result = { data: asked.slice(0, Math.min(server.maxRows, limit ?? Infinity)), error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return builder;
  }

  const client = {
    from: (table: string) => ({
      select: (columns?: string) => query(table, 'list', (rows) => [...rows], undefined, columns),
      insert: (row: Row | Row[]) => query(table, 'insert', () => [], Array.isArray(row) ? row : [row]),
      update: (patch: Row) =>
        query(table, 'update', (matched) =>
          matched.map((row) => Object.assign(row, patch)),
        ),
    }),
    channel: () => {
      const channel = {
        on: (_event: string, filter: { table: string }) => {
          server.calls.push(`subscribe ${filter.table}`);
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
