# Moni - Simplified Architecture Guide

This document explains the simplified, type-safe architecture for Moni without the complexity of tRPC.

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Mobile App (Expo)                      │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   UI Layer   │ ←→ │ Local SQLite │ ←→ │   API Client │ │
│  │  (Components)│    │   (Drizzle)  │    │ (fetch + TQ) │ │
│  └──────────────┘    └──────────────┘    └──────┬───────┘ │
│                                                  │         │
└──────────────────────────────────────────────────┼─────────┘
                                                   │
                                                   │ HTTP/REST
                                                   │ (JSON + JWT)
                     ┌─────────────────────────────▼─────────┐
                     │       @repo/types (Shared Types)      │
                     │                                       │
                     │  ┌──────────────────────────────────┐ │
                     │  │ Zod Schemas + TypeScript Types   │ │
                     │  │ - Wallets, Transactions, etc     │ │
                     │  └──────────────────────────────────┘ │
                     └─────────────────────────────────────┬─┘
                                                           │
                     ┌─────────────────────────────────────▼─┐
                     │       Web App (Next.js)               │
                     │                                       │
                     │  ┌──────────────┐    ┌─────────────┐ │
                     │  │ API Routes   │ ←→ │  Supabase   │ │
                     │  │ (/api/*)     │    │ (PostgreSQL)│ │
                     │  └──────────────┘    └─────────────┘ │
                     │                                       │
                     │  ┌──────────────┐                    │
                     │  │  Dashboard   │                    │
                     │  │   (Web UI)   │                    │
                     │  └──────────────┘                    │
                     └───────────────────────────────────────┘
```

## 🔑 Key Design Decisions

### 1. REST API Instead of tRPC

**Why REST?**
- ✅ **Simpler**: No tRPC setup, just standard Next.js Route Handlers
- ✅ **Familiar**: Everyone knows REST
- ✅ **Flexible**: Easy to add non-TypeScript clients later
- ✅ **Debugging**: Standard HTTP tools work out of the box

**How do we maintain type safety?**
- Shared `@repo/types` package with Zod schemas
- Both client and server use the same types
- Zod validates at runtime on both sides

### 2. Shared Types Package

**Structure:**
```
@repo/types
├── Zod schemas (for validation)
├── TypeScript types (inferred from Zod)
└── API request/response types
```

**Benefits:**
- Single source of truth for all types
- Runtime validation with Zod
- Compile-time type checking with TypeScript
- Easy to maintain and update

### 3. Drizzle ORM with Expo SQLite

**Why this matters:**
- Use `drizzle-orm/expo-sqlite` specifically (not generic Drizzle)
- SQLite types are different from PostgreSQL
- Migration bundling works automatically with Expo
- Live queries for reactive UI

**Key Differences:**
```typescript
// PostgreSQL (Web - Supabase)
uuid('id')
timestamp('created_at')
decimal('amount', { precision: 12, scale: 2 })

// SQLite (Mobile - Expo)
text('id')              // UUIDs as text
integer('created_at', { mode: 'timestamp' })
real('amount')          // Decimals as real/float
```

### 4. TanStack Query for Server State

**Why TanStack Query?**
- ✅ Caching built-in
- ✅ Automatic refetching
- ✅ Optimistic updates
- ✅ Works perfectly with REST APIs
- ✅ No tRPC needed

## 📦 Package Structure

```
Moni/
├── apps/
│   ├── mobile/
│   │   ├── app/              # Expo router
│   │   ├── components/       # React components
│   │   ├── db/
│   │   │   ├── schema.ts     # Drizzle SQLite schema
│   │   │   ├── client.ts     # Database instance
│   │   │   └── operations/   # CRUD operations
│   │   ├── lib/
│   │   │   ├── api.ts        # REST API client
│   │   │   └── supabase.ts   # Supabase client (auth)
│   │   └── drizzle/          # Auto-generated migrations
│   │
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   │   ├── api/      # REST API routes
│       │   │   │   ├── wallets/route.ts
│       │   │   │   ├── transactions/route.ts
│       │   │   │   └── ...
│       │   │   └── (dashboard)/  # Dashboard pages
│       │   ├── components/
│       │   └── lib/
│       │       └── supabase/     # Supabase client
│       └── public/
│
└── packages/
    ├── types/            # ⭐ Shared types and schemas
    │   ├── src/
    │   │   ├── wallet.ts
    │   │   ├── transaction.ts
    │   │   ├── category.ts
    │   │   └── ...
    │   └── package.json
    │
    ├── ui/               # Shared UI components
    ├── eslint-config/
    └── typescript-config/
```

## 🔄 Data Flow Examples

### Creating a Transaction (Mobile)

```typescript
// 1. User fills out form
const handleSubmit = async (data: CreateTransaction) => {
  
  // 2. Validate with shared Zod schema
  const validated = createTransactionSchema.parse(data);
  
  // 3. Save to local SQLite first
  const localTransaction = await db.insert(transactions).values({
    ...validated,
    id: uuid(),
    isSynced: false,
    localCreatedAt: Date.now(),
  }).returning();
  
  // 4. UI updates immediately (optimistic)
  
  // 5. Sync to server in background
  try {
    const response = await fetch(`${API_URL}/api/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(validated),
    });
    
    const result: TransactionResponse = await response.json();
    
    // 6. Mark as synced
    await db.update(transactions)
      .set({ isSynced: true })
      .where(eq(transactions.id, localTransaction.id));
    
  } catch (error) {
    // Handle error, will retry on next sync
  }
};
```

### Listing Transactions (Web)

```typescript
// API Route: apps/web/src/app/api/transactions/route.ts
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Parse query params with shared schema
  const searchParams = request.nextUrl.searchParams;
  const params = transactionListParamsSchema.parse({
    page: searchParams.get('page') || 1,
    limit: searchParams.get('limit') || 50,
  });
  
  // Query database
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .range(
      (params.page - 1) * params.limit,
      params.page * params.limit - 1
    );
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Return typed response
  const response: TransactionListResponse = {
    transactions: data,
    pagination: { /* ... */ },
  };
  
  return NextResponse.json(response);
}

// Client: apps/web/src/components/transactions/list.tsx
export function TransactionList() {
  const { data } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res = await fetch('/api/transactions');
      return res.json() as Promise<TransactionListResponse>;
    },
  });
  
  return (
    <Table>
      {data?.transactions.map(tx => (
        <TransactionRow key={tx.id} transaction={tx} />
      ))}
    </Table>
  );
}
```

## ✅ Type Safety Checklist

### On the Mobile App:

1. ✅ Use shared types from `@repo/types`
2. ✅ Validate request data with Zod before sending
3. ✅ Type API responses using shared types
4. ✅ Use TanStack Query for type-safe queries
5. ✅ Local database uses Drizzle's type inference

### On the Web API:

1. ✅ Validate incoming requests with Zod schemas
2. ✅ Type responses using shared types
3. ✅ Use TypeScript for all API routes
4. ✅ Return consistent error shapes

### Benefits of This Approach:

```typescript
// Mobile knows exactly what to send
const wallet: CreateWallet = {
  name: "My Bank",
  type: "bank",
  currency: "USD",
  initialBalance: 1000,
  color: "#0066FF",
  icon: "🏦",
};

// Both sides validate the same way
createWalletSchema.parse(wallet); // ✅ Type-safe and runtime-safe

// API response is fully typed
const response: WalletResponse = await createWallet(wallet);
console.log(response.wallet.id); // ✅ TypeScript knows this exists

// No guessing, no bugs, no runtime surprises!
```

## 🚀 Getting Started

### 1. Create the Types Package

```bash
mkdir -p packages/types/src
cd packages/types
pnpm init
pnpm add zod
pnpm add -D @repo/typescript-config
```

### 2. Define Your First Schema

```typescript
// packages/types/src/wallet.ts
import { z } from 'zod';

export const createWalletSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['bank', 'cash', 'credit']),
  initialBalance: z.number().default(0),
});

export type CreateWallet = z.infer<typeof createWalletSchema>;
```

### 3. Use in API Route

```typescript
// apps/web/src/app/api/wallets/route.ts
import { createWalletSchema } from '@repo/types';

export async function POST(request: Request) {
  const body = await request.json();
  const validated = createWalletSchema.parse(body); // ✅ Validates!
  // ... save to database
}
```

### 4. Use in Mobile App

```typescript
// apps/mobile/components/wallet-form.tsx
import { createWalletSchema, type CreateWallet } from '@repo/types';

const handleSubmit = (data: CreateWallet) => {
  const validated = createWalletSchema.parse(data); // ✅ Same validation!
  // ... send to API
};
```

## 📚 Further Reading

- **Zod Documentation**: https://zod.dev/
- **Drizzle + Expo SQLite**: https://orm.drizzle.team/docs/connect-expo-sqlite
- **TanStack Query**: https://tanstack.com/query/latest
- **Next.js Route Handlers**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

## 🎯 Summary

This simplified architecture gives you:

- ✅ **Full type safety** without tRPC complexity
- ✅ **Simple REST APIs** that everyone understands
- ✅ **Shared validation** with Zod schemas
- ✅ **Easy debugging** with standard HTTP tools
- ✅ **Great DX** with TypeScript autocomplete everywhere
- ✅ **Proper Expo SQLite** integration with Drizzle

Perfect for Phase 1 foundation! You can always add more sophisticated tooling later if needed.

---

*Last Updated: February 14, 2026*
