# Moni - Technical Reference & Patterns

Quick reference guide for common development tasks and patterns in the Moni codebase.

## 🎯 Key Technical Decisions

### Database Strategy
- **Cloud**: PostgreSQL via Supabase (source of truth)
- **Mobile**: SQLite via expo-sqlite + Drizzle ORM (local cache)
- **Sync**: Local-first with background sync to Supabase
- **Conflict Resolution**: Server wins (Phase 1)

### API Architecture
- **Protocol**: REST API via Next.js Route Handlers
- **Type Safety**: Shared types via `@repo/types` package with Zod schemas
- **Location**: Next.js API Routes (`/app/api/**/route.ts`)
- **Auth**: Supabase JWT tokens
- **Validation**: Zod schemas (shared between client and server)

### State Management
- **React State**: Built-in useState/useReducer for UI state
- **Server State**: TanStack Query for API calls and caching
- **No global state library** in Phase 1

### Styling
- **Mobile**: Tailwind CSS via Uniwind
- **Web**: Tailwind CSS (standard)
- **Components**: Shared components in `@repo/ui`

---

## 📱 Mobile Development Patterns

### File-Based Routing (expo-router)

```typescript
// apps/mobile/app/(app)/(home)/transaction/new.tsx
import { Stack } from 'expo-router';
import { TransactionForm } from '@/components/transactions/transaction-form';

export default function NewTransactionScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'New Transaction' }} />
      <TransactionForm />
    </>
  );
}
```

### Database Setup (Drizzle + Expo SQLite)

```typescript
// apps/mobile/db/client.ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const expoDb = openDatabaseSync('moni.db', { enableChangeListener: true });
export const db = drizzle(expoDb, { schema });
```

### Database Schema (Drizzle for SQLite)

```typescript
// apps/mobile/db/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  walletId: text('wallet_id').notNull(),
  amount: real('amount').notNull(),
  type: text('type', { enum: ['income', 'expense', 'transfer'] }).notNull(),
  categoryId: text('category_id'),
  description: text('description'),
  merchant: text('merchant'),
  transactionDate: integer('transaction_date', { mode: 'timestamp' }).notNull(),
  
  // Sync fields
  isSynced: integer('is_synced', { mode: 'boolean' }).notNull().default(false),
  localCreatedAt: integer('local_created_at', { mode: 'timestamp' }).notNull(),
  localUpdatedAt: integer('local_updated_at', { mode: 'timestamp' }),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
```

### Database Operations (Drizzle with Expo SQLite)

```typescript
// apps/mobile/db/operations/transactions.ts
import { db } from '../client';
import { transactions } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getTransactions(walletId?: string) {
  if (walletId) {
    return db.select()
      .from(transactions)
      .where(eq(transactions.walletId, walletId))
      .orderBy(desc(transactions.transactionDate));
  }
  
  return db.select()
    .from(transactions)
    .orderBy(desc(transactions.transactionDate));
}

export async function createTransaction(data: InsertTransaction) {
  const now = Date.now();
  const [transaction] = await db.insert(transactions)
    .values({
      ...data,
      isSynced: false,
      localCreatedAt: now,
      localUpdatedAt: now,
    })
    .returning();
  
  // Queue for sync
  await queueSync('transaction', transaction.id, 'create', transaction);
  
  return transaction;
}

export async function updateTransaction(id: string, data: Partial<InsertTransaction>) {
  const [updated] = await db.update(transactions)
    .set({
      ...data,
      isSynced: false,
      localUpdatedAt: Date.now(),
    })
    .where(eq(transactions.id, id))
    .returning();
  
  await queueSync('transaction', id, 'update', updated);
  return updated;
}
```

### Live Queries (Drizzle Expo SQLite)

```typescript
// apps/mobile/components/transactions/transaction-list.tsx
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { FlashList } from '@shopify/flash-list';

export function TransactionList({ walletId }: { walletId?: string }) {
  // Live query - automatically updates when data changes
  const { data, error } = useLiveQuery(
    walletId 
      ? db.select().from(transactions)
          .where(eq(transactions.walletId, walletId))
          .orderBy(desc(transactions.transactionDate))
      : db.select().from(transactions)
          .orderBy(desc(transactions.transactionDate))
  );

  if (error) return <ErrorView error={error} />;
  if (!data) return <LoadingSpinner />;

  return (
    <FlashList
      data={data}
      renderItem={({ item }) => <TransactionItem transaction={item} />}
      estimatedItemSize={80}
    />
  );
}
```

### API Calls (REST + TanStack Query)

```typescript
// apps/mobile/lib/api.ts
import { API_URL } from '@/lib/config';
import { getSupabaseSession } from '@/lib/supabase';
import type { ApiResponse, TransactionListParams } from '@repo/types';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const session = await getSupabaseSession();
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API request failed');
  }

  return response.json();
}

// Usage in components with TanStack Query
// apps/mobile/components/transactions/transaction-list.tsx
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import type { TransactionListResponse } from '@repo/types';

export function TransactionList({ walletId }: { walletId?: string }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', walletId],
    queryFn: () => fetchApi<TransactionListResponse>(
      `/api/transactions?${new URLSearchParams({ walletId: walletId || '' })}`
    ),
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <FlashList
      data={data?.transactions}
      renderItem={({ item }) => <TransactionItem transaction={item} />}
      onRefresh={refetch}
      refreshing={isLoading}
    />
  );
}
```

### Background Sync

```typescript
// apps/mobile/lib/sync.ts
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchApi } from './api';
import type { SyncPushRequest, SyncPushResponse } from '@repo/types';

export async function syncToServer() {
  // Get unsynced changes
  const unsyncedTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.isSynced, false));

  if (unsyncedTransactions.length === 0) return;

  // Push to server
  const result = await fetchApi<SyncPushResponse>('/api/sync/push', {
    method: 'POST',
    body: JSON.stringify({
      transactions: unsyncedTransactions.map(t => ({
        ...t,
        action: 'create',
      })),
    } as SyncPushRequest),
  });

  // Mark as synced
  for (const res of result.results.transactions) {
    if (res.status === 'created' || res.status === 'updated') {
      await db
        .update(transactions)
        .set({ isSynced: true })
        .where(eq(transactions.id, res.localId));
    }
  }
}

// Set up periodic sync with cleanup
export function useSyncInterval(intervalMs = 30000) {
  useEffect(() => {
    const interval = setInterval(syncToServer, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
}
```

### Location Capture

```typescript
// apps/mobile/hooks/use-location.ts
import * as Location from 'expo-location';
import { useState, useEffect } from 'react';

export function useCurrentLocation() {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    name?: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        name: address[0]?.name,
      });
    })();
  }, []);

  return location;
}
```

---

## 🌐 Web Development Patterns

### API Route Handler (Next.js Route Handler)

```typescript
// apps/web/src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transactionListParamsSchema } from '@repo/types';
import type { TransactionListResponse } from '@repo/types';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  
  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Parse and validate query params
  const searchParams = request.nextUrl.searchParams;
  const params = transactionListParamsSchema.parse({
    walletId: searchParams.get('walletId'),
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
  });

  // Query database
  let query = supabase
    .from('transactions')
    .select('*, wallets(*), categories(*)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false })
    .range((params.page - 1) * params.limit, params.page * params.limit - 1);

  if (params.walletId) {
    query = query.eq('wallet_id', params.walletId);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const response: TransactionListResponse = {
    transactions: data || [],
    pagination: {
      page: params.page,
      limit: params.limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / params.limit),
    },
  };

  return NextResponse.json(response);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const validatedData = createTransactionSchema.parse(body);

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      ...validatedData,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transaction: data });
}
```

### Server Component with Data

```typescript
// apps/web/src/app/(dashboard)/page.tsx
import { createClient } from '@/lib/supabase/server';
import { StatsCard } from '@/components/dashboard/stats-card';

export default async function DashboardPage() {
  const supabase = createClient();
  
  // Fetch data on server
  const { data: wallets } = await supabase
    .from('wallets')
    .select('*')
    .eq('is_active', true);

  const totalBalance = wallets?.reduce((sum, w) => 
    sum + Number(w.initial_balance), 0
  ) ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatsCard 
        title="Total Balance" 
        value={totalBalance}
        format="currency"
      />
      {/* More stats */}
    </div>
  );
}
```

### Client Component with API

```typescript
// apps/web/src/components/transactions/transaction-table.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { DataTable } from '@/components/ui/data-table';
import type { TransactionListResponse } from '@repo/types';

async function fetchTransactions(params: { page: number; limit: number }) {
  const response = await fetch(
    `/api/transactions?${new URLSearchParams({
      page: params.page.toString(),
      limit: params.limit.toString(),
    })}`
  );
  
  if (!response.ok) throw new Error('Failed to fetch transactions');
  return response.json() as Promise<TransactionListResponse>;
}

export function TransactionTable() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
  });

  return (
    <div>
      <TransactionFilters onChange={setFilters} />
      <DataTable 
        data={data?.transactions} 
        loading={isLoading}
        columns={columns}
      />
    </div>
  );
}
```

### Real-time Subscriptions (Supabase)

```typescript
// apps/web/src/hooks/use-realtime-transactions.ts
'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtimeTransactions(userId: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel('transactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Invalidate queries to refetch
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
```

---

## 🔧 Shared Package Patterns

### Shared Types Package (`@repo/types`)

```typescript
// packages/types/src/index.ts
export * from './wallet';
export * from './transaction';
export * from './category';
export * from './api';

// packages/types/src/wallet.ts
import { z } from 'zod';

export const walletTypeSchema = z.enum([
  'bank',
  'cash',
  'credit',
  'debit',
  'ewallet',
  'investment',
  'other',
]);

export const walletSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: walletTypeSchema,
  currency: z.string().length(3),
  initialBalance: z.number(),
  currentBalance: z.number().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string(),
  isActive: z.boolean(),
  displayOrder: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createWalletSchema = z.object({
  name: z.string().min(1).max(100),
  type: walletTypeSchema,
  currency: z.string().length(3).default('USD'),
  initialBalance: z.number().default(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string(),
});

export const updateWalletSchema = createWalletSchema.partial();

// Type inference
export type Wallet = z.infer<typeof walletSchema>;
export type CreateWallet = z.infer<typeof createWalletSchema>;
export type UpdateWallet = z.infer<typeof updateWalletSchema>;

// API Response types
export type WalletListResponse = {
  wallets: Wallet[];
};

export type WalletResponse = {
  wallet: Wallet;
};
```

### Using Shared Types in API Routes

```typescript
// apps/web/src/app/api/wallets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createWalletSchema, type WalletListResponse, type WalletResponse } from '@repo/types';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response: WalletListResponse = {
    wallets: data || [],
  };

  return NextResponse.json(response);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  
  // Validate with Zod schema
  const validatedData = createWalletSchema.parse(body);

  const { data, error } = await supabase
    .from('wallets')
    .insert({
      ...validatedData,
      user_id: user.id,
      display_order: 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response: WalletResponse = {
    wallet: data,
  };

  return NextResponse.json(response);
}
```

### Using Shared Types in Mobile

```typescript
// apps/mobile/lib/api.ts
import { API_URL } from '@/lib/config';
import { getSupabaseSession } from '@/lib/supabase';
import { createWalletSchema, type CreateWallet, type WalletResponse } from '@repo/types';

export async function createWallet(data: CreateWallet): Promise<WalletResponse> {
  // Validate data before sending
  const validatedData = createWalletSchema.parse(data);
  
  const session = await getSupabaseSession();
  
  const response = await fetch(`${API_URL}/api/wallets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(validatedData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create wallet');
  }

  return response.json();
}

// Usage with TanStack Query
export function useCreateWallet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createWallet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
  });
}
```

### Drizzle Schema Definition (Expo SQLite)

```typescript
// apps/mobile/db/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Note: SQLite uses different column types than PostgreSQL
// - text for strings and UUIDs
// - integer for booleans and timestamps
// - real for decimals

export const wallets = sqliteTable('wallets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  type: text('type', { 
    enum: ['bank', 'cash', 'credit', 'debit', 'ewallet', 'investment', 'other'] 
  }).notNull(),
  currency: text('currency').notNull().default('USD'),
  initialBalance: real('initial_balance').notNull().default(0),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  
  // Timestamps as Unix timestamps (milliseconds)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  walletId: text('wallet_id').notNull(),
  amount: real('amount').notNull(),
  type: text('type', { enum: ['income', 'expense', 'transfer'] }).notNull(),
  categoryId: text('category_id'),
  
  // Transfer fields
  transferToWalletId: text('transfer_to_wallet_id'),
  linkedTransactionId: text('linked_transaction_id'),
  
  // Details
  description: text('description'),
  merchant: text('merchant'),
  notes: text('notes'),
  
  // Temporal
  transactionDate: integer('transaction_date', { mode: 'timestamp' }).notNull(),
  
  // Location
  locationLatitude: real('location_latitude'),
  locationLongitude: real('location_longitude'),
  locationName: text('location_name'),
  
  // Receipt
  receiptImageUrl: text('receipt_image_url'),
  
  // Metadata (stored as JSON string in SQLite)
  metadata: text('metadata', { mode: 'json' }).$type<{
    ai_suggested?: boolean;
    ai_confidence?: number;
    tags?: string[];
  }>().notNull().default('{}'),
  
  // Sync fields (mobile-only)
  isSynced: integer('is_synced', { mode: 'boolean' }).notNull().default(false),
  localCreatedAt: integer('local_created_at', { mode: 'timestamp' }).notNull(),
  localUpdatedAt: integer('local_updated_at', { mode: 'timestamp' }),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  userId: text('user_id'), // null for system categories
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  parentId: text('parent_id'),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Type inference
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
```

### Drizzle Migrations Setup (Expo)

```typescript
// apps/mobile/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo', // Important: use expo driver
});
```

```typescript
// apps/mobile/app/_layout.tsx
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';

const expoDb = openDatabaseSync('moni.db', { enableChangeListener: true });
const db = drizzle(expoDb);

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View>
        <Text>Migration error: {error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View>
        <Text>Migrating database...</Text>
      </View>
    );
  }

  return (
    <Stack>
      {/* Your app structure */}
    </Stack>
  );
}
```

---

## 🔒 Authentication Patterns

### Supabase Auth (Mobile)

```typescript
// apps/mobile/lib/auth.ts
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: {
        getItem: (key) => SecureStore.getItemAsync(key),
        setItem: (key, value) => SecureStore.setItemAsync(key, value),
        removeItem: (key) => SecureStore.deleteItemAsync(key),
      },
    },
  }
);

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
```

### Protected Routes (Mobile)

```typescript
// apps/mobile/app/_layout.tsx
import { useEffect } from 'react';
import { router, useSegments } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';

export default function RootLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (!user && inAppGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Redirect to app if already authenticated
      router.replace('/(app)/(home)');
    }
  }, [user, loading, segments]);

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
    </Stack>
  );
}
```

### Protected API Middleware (Web)

```typescript
// apps/web/src/lib/api-middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function withAuth(
  handler: (request: NextRequest, userId: string) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return handler(request, user.id);
  };
}

// Usage in API routes
// apps/web/src/app/api/wallets/route.ts
export const GET = withAuth(async (request, userId) => {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wallets: data });
});
```

---

## 📊 Data Fetching Patterns

### Optimistic Updates

```typescript
// apps/mobile/components/transactions/transaction-form.tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import type { CreateTransaction, TransactionResponse, TransactionListResponse } from '@repo/types';

export function TransactionForm() {
  const queryClient = useQueryClient();
  
  const createMutation = useMutation({
    mutationFn: (data: CreateTransaction) =>
      fetchApi<TransactionResponse>('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Optimistic update
    onMutate: async (newTransaction) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['transactions'] });

      // Snapshot previous value
      const previous = queryClient.getQueryData<TransactionListResponse>(['transactions']);

      // Optimistically update
      if (previous) {
        queryClient.setQueryData<TransactionListResponse>(['transactions'], {
          ...previous,
          transactions: [
            { ...newTransaction, id: 'temp-id', createdAt: new Date().toISOString() } as any,
            ...previous.transactions,
          ],
        });
      }

      return { previous };
    },

    // Rollback on error
    onError: (err, newTransaction, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['transactions'], context.previous);
      }
    },

    // Refetch on success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  // ...
}
```

### Pagination

```typescript
// apps/web/src/components/transactions/transaction-list.tsx
import { useQuery } from '@tanstack/react-query';
import type { TransactionListResponse } from '@repo/types';

async function fetchTransactions(page: number, limit: number) {
  const response = await fetch(
    `/api/transactions?${new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    })}`
  );
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json() as Promise<TransactionListResponse>;
}

export function TransactionList() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', page],
    queryFn: () => fetchTransactions(page, 50),
  });

  return (
    <>
      <TransactionTable data={data?.transactions} />
      <Pagination
        currentPage={page}
        totalPages={data?.pagination.totalPages ?? 1}
        onPageChange={setPage}
      />
    </>
  );
}
```

### Infinite Scroll

```typescript
// apps/mobile/components/transactions/infinite-list.tsx
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import type { TransactionListResponse } from '@repo/types';

export function InfiniteTransactionList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['transactions'],
    queryFn: ({ pageParam = 1 }) =>
      fetchApi<TransactionListResponse>(
        `/api/transactions?page=${pageParam}&limit=20`
      ),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const allTransactions = data?.pages.flatMap((page) => page.transactions) ?? [];

  return (
    <FlashList
      data={allTransactions}
      renderItem={({ item }) => <TransactionItem transaction={item} />}
      onEndReached={() => hasNextPage && fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator /> : null
      }
    />
  );
}
```

---

## 🧪 Testing Patterns

### Component Tests (TODO)

```typescript
// apps/mobile/components/wallets/__tests__/wallet-card.test.tsx
import { render, screen } from '@testing-library/react-native';
import { WalletCard } from '../wallet-card';

describe('WalletCard', () => {
  const mockWallet = {
    id: '1',
    name: 'Chase Checking',
    type: 'bank',
    currentBalance: 1250.50,
    currency: 'USD',
    color: '#0066FF',
    icon: '🏦',
  };

  it('renders wallet information', () => {
    render(<WalletCard wallet={mockWallet} />);
    
    expect(screen.getByText('Chase Checking')).toBeOnTheScreen();
    expect(screen.getByText('$1,250.50')).toBeOnTheScreen();
  });
});
```

### API Tests (TODO)

```typescript
// packages/api/src/routers/__tests__/wallets.test.ts
import { appRouter } from '../root';
import { createTestContext } from '../../test-utils';

describe('walletsRouter', () => {
  it('lists user wallets', async () => {
    const ctx = await createTestContext({ userId: 'test-user' });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.wallets.list({});

    expect(result.wallets).toHaveLength(2);
    expect(result.wallets[0]).toHaveProperty('name');
  });
});
```

---

## 🎨 Styling Patterns

### Tailwind (Mobile with Uniwind)

```typescript
// apps/mobile/components/ui/button.tsx
import { Pressable, Text } from 'react-native';
import { cn } from '@/lib/utils';

interface ButtonProps {
  children: string;
  variant?: 'primary' | 'secondary';
  onPress: () => void;
}

export function Button({ children, variant = 'primary', onPress }: ButtonProps) {
  return (
    <Pressable
      className={cn(
        'px-4 py-3 rounded-lg',
        variant === 'primary' && 'bg-blue-600',
        variant === 'secondary' && 'bg-gray-200',
      )}
      onPress={onPress}
    >
      <Text className={cn(
        'text-center font-semibold',
        variant === 'primary' && 'text-white',
        variant === 'secondary' && 'text-gray-900',
      )}>
        {children}
      </Text>
    </Pressable>
  );
}
```

### Tailwind (Web)

```typescript
// apps/web/src/components/ui/card.tsx
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn(
      'rounded-lg border bg-card text-card-foreground shadow-sm',
      className
    )}>
      {children}
    </div>
  );
}
```

---

## 📐 Common Utilities

### Currency Formatting

```typescript
// packages/ui/src/lib/format.ts
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

// Usage
formatCurrency(1250.50); // "$1,250.50"
formatCurrency(1250.50, 'EUR', 'de-DE'); // "1.250,50 €"
```

### Date Formatting

```typescript
// packages/ui/src/lib/date.ts
import { format, formatDistanceToNow } from 'date-fns';

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy h:mm a');
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

// Usage
formatDate('2026-02-14'); // "Feb 14, 2026"
formatRelative('2026-02-14'); // "2 hours ago"
```

### Class Name Utility

```typescript
// packages/ui/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 🚨 Error Handling

### Global Error Boundary (Mobile)

```typescript
// apps/mobile/components/error-boundary.tsx
import React from 'react';
import { View, Text, Button } from 'react-native';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Report to error tracking service (e.g., Sentry)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-xl font-bold mb-4">Something went wrong</Text>
          <Text className="text-gray-600 mb-4">
            {this.state.error?.message}
          </Text>
          <Button
            title="Try Again"
            onPress={() => this.setState({ hasError: false, error: null })}
          />
        </View>
      );
    }

    return this.props.children;
  }
}
```

### API Error Handling

```typescript
// apps/web/src/lib/errors.ts
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function handleApiError(error: unknown) {
  console.error('API error:', error);
  
  // Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation error',
        details: error.errors,
      },
      { status: 400 }
    );
  }
  
  // Database errors
  if (error instanceof Error) {
    if (error.message.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'A record with this value already exists' },
        { status: 409 }
      );
    }
    
    if (error.message.includes('foreign key constraint')) {
      return NextResponse.json(
        { error: 'Referenced record does not exist' },
        { status: 400 }
      );
    }
    
    // Generic error
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { error: 'An unexpected error occurred' },
    { status: 500 }
  );
}

// Usage in API routes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createWalletSchema.parse(body);
    
    // ... handle request
    
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## 🔍 Debugging Tips

### React Native Debugger

```bash
# Enable Hermes debugger
# In Expo Dev Menu: tap "Debug Remote JS"

# Or use Flipper
npx flipper

# View SQLite database
npx expo-sqlite-viewer
```

### Drizzle Studio

```bash
# View Supabase database
cd packages/database
pnpm drizzle-kit studio

# View mobile SQLite (requires Android/iOS simulator)
# Connect via ADB and pull database file
```

### Network Debugging

```bash
# Use React Native Debugger or Flipper
# Or proxy through Charles/Proxyman
```

```typescript
// Enable fetch logging in development
// apps/mobile/lib/api.ts
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  if (__DEV__) {
    console.log('API Request:', {
      method: options?.method || 'GET',
      url,
      body: options?.body,
    });
  }
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await response.json();
  
  if (__DEV__) {
    console.log('API Response:', {
      status: response.status,
      url,
      data,
    });
  }
  
  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}
```

### Complete Shared Types Package Structure

```
packages/types/
├── src/
│   ├── index.ts          # Re-export all types
│   ├── wallet.ts         # Wallet types and schemas
│   ├── transaction.ts    # Transaction types and schemas
│   ├── category.ts       # Category types and schemas
│   ├── tag.ts            # Tag types and schemas
│   ├── user.ts           # User/Profile types and schemas
│   ├── analytics.ts      # Analytics response types
│   ├── sync.ts           # Sync request/response types
│   └── api.ts            # Common API types
├── package.json
└── tsconfig.json
```

**packages/types/package.json:**
```json
{
  "name": "@repo/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./wallet": "./src/wallet.ts",
    "./transaction": "./src/transaction.ts",
    "./category": "./src/category.ts",
    "./tag": "./src/tag.ts",
    "./analytics": "./src/analytics.ts",
    "./sync": "./src/sync.ts"
  },
  "dependencies": {
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*"
  }
}
```

**packages/types/src/api.ts:**
```typescript
// Common API response types
export type ApiError = {
  error: string;
  details?: any;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ListResponse<T> = {
  data: T[];
  pagination: Pagination;
};
```

**packages/types/src/transaction.ts:**
```typescript
import { z } from 'zod';
import type { Pagination } from './api';

export const transactionTypeSchema = z.enum(['income', 'expense', 'transfer']);

export const transactionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  walletId: z.string().uuid(),
  amount: z.number().positive(),
  type: transactionTypeSchema,
  categoryId: z.string().uuid().optional(),
  transferToWalletId: z.string().uuid().optional(),
  linkedTransactionId: z.string().uuid().optional(),
  description: z.string().optional(),
  merchant: z.string().optional(),
  notes: z.string().optional(),
  transactionDate: z.string().datetime(),
  locationLatitude: z.number().min(-90).max(90).optional(),
  locationLongitude: z.number().min(-180).max(180).optional(),
  locationName: z.string().optional(),
  receiptImageUrl: z.string().url().optional(),
  metadata: z.object({
    ai_suggested: z.boolean().optional(),
    ai_confidence: z.number().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createTransactionSchema = z.object({
  walletId: z.string().uuid(),
  amount: z.number().positive(),
  type: transactionTypeSchema,
  categoryId: z.string().uuid().optional(),
  transferToWalletId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  merchant: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  transactionDate: z.string().datetime().optional(),
  locationLatitude: z.number().min(-90).max(90).optional(),
  locationLongitude: z.number().min(-180).max(180).optional(),
  locationName: z.string().max(200).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
}).refine(
  (data) => data.type !== 'transfer' || data.transferToWalletId,
  { message: 'Transfer must have target wallet' }
);

export const updateTransactionSchema = createTransactionSchema.partial();

export const transactionListParamsSchema = z.object({
  walletId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: transactionTypeSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  search: z.string().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50),
  sortBy: z.enum(['date', 'amount', 'merchant']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Type inference
export type Transaction = z.infer<typeof transactionSchema>;
export type CreateTransaction = z.infer<typeof createTransactionSchema>;
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;
export type TransactionListParams = z.infer<typeof transactionListParamsSchema>;

// API Response types
export type TransactionResponse = {
  transaction: Transaction;
};

export type TransactionListResponse = {
  transactions: Transaction[];
  pagination: Pagination;
};
```

---

## 🎨 Type-Safe API Communication Summary

### Architecture Benefits

1. **Full Type Safety**: Shared Zod schemas ensure type safety from client to server
2. **Validation**: Zod validates requests on both client and server
3. **Simple**: No complex tRPC setup, just standard REST APIs
4. **Flexible**: Easy to add new endpoints or modify existing ones
5. **DX**: Great developer experience with autocomplete and type checking

### Flow Example

```
Mobile App                     Shared Types                    Web API
─────────                      ────────────                    ────────

1. User fills form       →     CreateWallet schema      →     
2. Validate with Zod     →     (shared validation)      →     
3. POST to /api/wallets  →                              →     Receive request
                         →                              →     Validate with same schema
                         →                              →     Insert to database
                         ←      WalletResponse type     ←     Return typed response
4. Update UI with data   ←                              ←

Types are shared, consistent, and validated at every step!
```

---

*Last Updated: February 14, 2026*
