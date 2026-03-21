# Moni - Personal Finance Management App

## Project Overview

**Moni** is a modern, privacy-focused personal finance app for tracking daily activity across multiple wallets (bank accounts, cash, credit cards, e-wallets) with analytics—and **on-device AI** that helps capture transactions from chat-style text, receipt photos, and (on Android) bank push notifications. AI never writes straight to the ledger: it creates **proposals** users approve in a review flow.

### Vision
A local-first, user-controlled finance app where insights and **private, on-device intelligence** work together: powerful spending visibility, optional cloud sync, and AI that runs on the phone so prompts and receipts are not sent to third-party LLM APIs.

### Core Philosophy
- **User Control First**: Users approve AI output before it becomes real transactions
- **Privacy-Focused**: Local-first architecture with optional cloud sync; core AI inference on-device (Qwen 2.5 VL via `@react-native-ai/llama`)
- **Offline-First**: Full functionality without internet connection; model and queue work offline where possible
- **Cross-Platform**: Seamless experience across mobile and web

---

## Project Structure

This is a **Turborepo monorepo** with the following structure:

```
Moni/
├── apps/
│   ├── mobile/          # Expo React Native app (primary user interface)
│   └── web/             # Next.js app (dashboard + API backend)
├── packages/
│   ├── ui/              # Shared React UI components
│   ├── types/           # Shared types and Zod schemas [TO CREATE]
│   ├── eslint-config/   # Shared ESLint configurations
│   └── typescript-config/ # Shared TypeScript configurations
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Technology Stack

### Mobile App (`apps/mobile`)
- **Framework**: Expo SDK ~54.0 + React Native 0.81.5
- **Routing**: expo-router ~6.0 (file-based routing)
- **Styling**: Tailwind CSS 4.1 + Uniwind 1.3
- **Local Database**: expo-sqlite + Drizzle ORM
- **State Management**: React State (built-in useState, useReducer)
- **Server State**: TanStack Query (React Query) for API calls and caching
- **Location**: expo-location
- **Animations**: react-native-reanimated ~4.1
- **Gestures**: react-native-gesture-handler ~2.28
- **Charts**: react-native-chart-kit or Victory Native
- **Type Safety**: TypeScript (strict mode)

### Web App (`apps/web`)
- **Framework**: Next.js 16.1 (App Router)
- **Backend**: Next.js API Routes (`app/api/**/route.ts`) - Standard REST
- **Database**: Supabase (PostgreSQL + Realtime)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (for future receipt images)
- **Data Visualization**: Recharts or Tremor
- **Type Safety**: TypeScript (strict mode) + Zod validation

### Shared Infrastructure
- **Type Safety**: Shared types and Zod schemas in `@repo/types`
- **Validation**: Zod schemas used on both client and server
- **API Communication**: REST with shared TypeScript types
- **Database Schema**: Drizzle ORM schema definitions (PostgreSQL for web, SQLite for mobile)

### Backend Services
- **Supabase**:
  - PostgreSQL database
  - Row Level Security (RLS) for multi-tenant isolation
  - Realtime subscriptions for sync
  - Authentication (email/password, OAuth)
  - Storage (for future receipt images)

---

## Phase 1: Foundation (Current Focus)

### Objectives
Establish core infrastructure **plus on-device AI-assisted capture** on mobile (proposals, not auto-posted transactions):
1. ✅ Authentication system (Supabase Auth)
2. ✅ Database schema and migrations
3. ✅ Secure REST API routes with type safety
4. ✅ Local-first data architecture with cloud sync
5. ✅ Basic CRUD operations for wallets and transactions
6. ✅ Mobile UI for transaction entry (manual and AI-assisted)
7. ✅ Web dashboard with basic analytics
8. 🔄 **AI orchestrator** (unified queue → text / image / notification flows → `proposed_transactions` → user review)

### Phase 1 Features
- User registration and authentication
- Profile management
- Wallet management (create, read, update, delete)
- Manual transaction entry and **AI-assisted entry** (natural language, receipt image, Android notifications) as **pending proposals** until the user confirms
- Transaction listing with filters
- Basic transaction categorization
- Simple analytics (spending by category, time-based views)
- Web dashboard with charts
- Offline support with background sync
- **On-device VL model** (Qwen 2.5 VL 3B), MMKV-backed processing queue, Android foreground service for background processing (see `apps/mobile/lib/ai/ORCHESTRATOR.md`)

### AI-assisted capture (mobile) — summary

| Input | Behavior |
| --- | --- |
| **Text** (chat tab) | Extract amount, merchant, category hints, wallet hint → proposal |
| **Image** (receipt) | Multimodal extraction; local file saved under `documentDir/receipts`, optional upload to Supabase Storage |
| **Push notification** (Android) | Classify transaction vs spam/OTP; regex fallback if the model fails |

All paths produce **`proposed_transactions`** with `status: pending`; the app surfaces a **proposal review modal** before committing to the real transaction list.

---

## Database Architecture

### Local Database (Mobile - SQLite)
Using **Drizzle ORM** with **expo-sqlite** for local-first storage.

### Cloud Database (Supabase - PostgreSQL)
Central database for sync and web dashboard.

### Database Schema

#### Core Tables

**users** (managed by Supabase Auth)
- Handled by `auth.users` table in Supabase

**profiles**
```typescript
{
  id: uuid (PK, FK to auth.users.id)
  display_name: string
  avatar_url: string | null
  preferences: jsonb {
    currency: string (default: "USD")
    theme: "light" | "dark" | "system"
    notifications_enabled: boolean
  }
  created_at: timestamp
  updated_at: timestamp
}
```

**wallets**
```typescript
{
  id: uuid (PK)
  user_id: uuid (FK to auth.users.id)
  name: string (e.g., "Chase Checking", "Cash Wallet")
  type: enum ("bank", "cash", "credit", "debit", "ewallet", "investment", "other")
  currency: string (ISO 4217: "USD", "EUR", "GBP", etc.)
  initial_balance: decimal(12, 2)
  color: string (hex color for UI)
  icon: string (icon name/emoji)
  is_active: boolean (soft delete)
  display_order: integer (for user-defined sorting)
  created_at: timestamp
  updated_at: timestamp
  
  // Computed field (not stored):
  current_balance: calculated from initial_balance + sum(transactions)
}
```

**categories**
```typescript
{
  id: uuid (PK)
  user_id: uuid (FK, nullable - null means system category)
  name: string (e.g., "Groceries", "Transportation")
  icon: string (icon name/emoji)
  color: string (hex color)
  parent_id: uuid | null (FK to categories.id - for subcategories)
  type: enum ("income", "expense")
  is_active: boolean
  display_order: integer
  created_at: timestamp
  updated_at: timestamp
}
```

**transactions**
```typescript
{
  id: uuid (PK)
  user_id: uuid (FK to auth.users.id)
  wallet_id: uuid (FK to wallets.id)
  amount: decimal(12, 2)
  type: enum ("income", "expense", "transfer")
  category_id: uuid | null (FK to categories.id)
  
  // Transfer-specific fields
  transfer_to_wallet_id: uuid | null (FK to wallets.id - for transfers)
  linked_transaction_id: uuid | null (FK to transactions.id - reverse transfer entry)
  
  // Transaction details
  description: text | null
  merchant: string | null (store/business name)
  notes: text | null (user notes)
  
  // Temporal data
  transaction_date: timestamp (when transaction occurred)
  
  // Location data (Phase 1 - capture, Phase 4 - analyze)
  location_latitude: decimal(10, 8) | null
  location_longitude: decimal(11, 8) | null
  location_name: string | null (reverse geocoded address)
  
  // Future: Receipt data (Phase 3)
  receipt_image_url: string | null
  
  // Metadata
  metadata: jsonb {
    // Future AI fields (Phase 2+)
    ai_suggested: boolean
    ai_confidence: number
    tags: string[]
  }
  
  // Sync fields
  is_synced: boolean (mobile only - tracks sync status)
  local_created_at: timestamp (mobile only)
  local_updated_at: timestamp (mobile only)
  
  created_at: timestamp (server timestamp)
  updated_at: timestamp (server timestamp)
}
```

**tags**
```typescript
{
  id: uuid (PK)
  user_id: uuid (FK to auth.users.id)
  name: string (unique per user)
  color: string (hex color)
  created_at: timestamp
}
```

**transaction_tags** (junction table)
```typescript
{
  transaction_id: uuid (FK to transactions.id)
  tag_id: uuid (FK to tags.id)
  
  PRIMARY KEY (transaction_id, tag_id)
}
```

**sync_log** (mobile only - for conflict resolution)
```typescript
{
  id: uuid (PK)
  entity_type: enum ("wallet", "transaction", "category", "tag")
  entity_id: uuid
  action: enum ("create", "update", "delete")
  data: jsonb (snapshot of entity)
  synced_at: timestamp | null
  created_at: timestamp
}
```

#### Default System Categories

Seed with common categories:

**Expense Categories:**
- 🍔 Food & Dining (subcategories: Groceries, Restaurants, Coffee, Fast Food)
- 🚗 Transportation (subcategories: Gas, Public Transit, Parking, Ride Share)
- 🏠 Housing (subcategories: Rent/Mortgage, Utilities, Maintenance, Insurance)
- 🎬 Entertainment (subcategories: Movies, Streaming, Events, Hobbies)
- 🛍️ Shopping (subcategories: Clothing, Electronics, Home Goods, Personal Care)
- 🏥 Healthcare (subcategories: Doctor, Pharmacy, Insurance, Fitness)
- 💼 Work (subcategories: Supplies, Expenses, Professional Development)
- 🎓 Education (subcategories: Tuition, Books, Courses)
- ✈️ Travel (subcategories: Flights, Hotels, Activities)
- 📱 Subscriptions (subcategories: Software, Services, Memberships)
- 🎁 Gifts & Donations
- 💳 Fees & Charges
- 🏦 Other Expenses

**Income Categories:**
- 💰 Salary
- 💼 Freelance
- 📈 Investment
- 🎁 Gifts
- 💵 Other Income

Users can customize and add their own categories.

#### Indexes & Constraints

**Performance Indexes:**
```sql
-- User-based queries
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_tags_user_id ON tags(user_id);

-- Common query patterns
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);

-- Sync queries
CREATE INDEX idx_transactions_synced ON transactions(is_synced) WHERE is_synced = false;
CREATE INDEX idx_transactions_updated ON transactions(updated_at DESC);

-- Location queries (Phase 4)
CREATE INDEX idx_transactions_location ON transactions 
  USING GIST (ll_to_earth(location_latitude, location_longitude)) 
  WHERE location_latitude IS NOT NULL;

-- Unique constraints
CREATE UNIQUE INDEX idx_tags_user_name ON tags(user_id, LOWER(name));
```

**Row Level Security (RLS) Policies:**
```sql
-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Wallets
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own wallets" ON wallets USING (auth.uid() = user_id);

-- Transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own transactions" ON transactions USING (auth.uid() = user_id);

-- Categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view system and own categories" ON categories FOR SELECT 
  USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Users can manage own categories" ON categories FOR INSERT, UPDATE, DELETE 
  USING (auth.uid() = user_id);

-- Tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tags" ON tags USING (auth.uid() = user_id);
```

---

## API Architecture (REST + Shared Types)

### Structure

```
apps/web/src/app/api/        # Next.js API Routes
├── auth/
│   ├── register/route.ts    # POST /api/auth/register
│   └── login/route.ts       # POST /api/auth/login
├── wallets/
│   ├── route.ts             # GET, POST /api/wallets
│   └── [id]/route.ts        # GET, PUT, DELETE /api/wallets/:id
├── transactions/
│   ├── route.ts             # GET, POST /api/transactions
│   └── [id]/route.ts        # GET, PUT, DELETE /api/transactions/:id
├── categories/route.ts      # Category endpoints
├── tags/route.ts            # Tag endpoints
├── analytics/
│   ├── overview/route.ts    # GET /api/analytics/overview
│   ├── spending/route.ts    # GET /api/analytics/spending
│   └── ...
└── sync/
    ├── pull/route.ts        # GET /api/sync/pull
    └── push/route.ts        # POST /api/sync/push

packages/types/              # Shared types and schemas
├── src/
│   ├── wallet.ts            # Wallet types + Zod schemas
│   ├── transaction.ts       # Transaction types + Zod schemas
│   ├── category.ts          # Category types + Zod schemas
│   ├── tag.ts               # Tag types + Zod schemas
│   ├── user.ts              # User types + Zod schemas
│   ├── analytics.ts         # Analytics response types
│   ├── sync.ts              # Sync types
│   ├── api.ts               # Common API types
│   └── index.ts             # Re-exports
└── package.json
```

### API Endpoints (REST)

#### Auth Endpoints
```
POST   /api/auth/register          - Create new user account
POST   /api/auth/login             - Login with email/password
POST   /api/auth/logout            - Logout and invalidate session
GET    /api/auth/session           - Get current session
PUT    /api/auth/profile           - Update user profile
```

#### Wallet Endpoints
```
GET    /api/wallets                - List all user wallets
GET    /api/wallets/:id            - Get single wallet by ID
POST   /api/wallets                - Create new wallet
PUT    /api/wallets/:id            - Update wallet
DELETE /api/wallets/:id            - Soft delete wallet
PUT    /api/wallets/reorder        - Update display order
GET    /api/wallets/:id/balance    - Get current balance
```

#### Transaction Endpoints
```
GET    /api/transactions           - List transactions (with filters, pagination)
GET    /api/transactions/:id       - Get single transaction
POST   /api/transactions           - Create new transaction
PUT    /api/transactions/:id       - Update transaction
DELETE /api/transactions/:id       - Delete transaction
POST   /api/sync/push              - Bulk sync from mobile
GET    /api/transactions/search    - Search transactions by text
```

**List Filters:**
- `walletId`: Filter by wallet
- `categoryId`: Filter by category
- `type`: Filter by type (income/expense/transfer)
- `startDate` / `endDate`: Date range
- `minAmount` / `maxAmount`: Amount range
- `search`: Text search in description/merchant
- `tags`: Filter by tag IDs
- `page` / `limit`: Pagination

#### Categories Router (`categories.ts`)
```typescript
categories.list        // GET - List all categories (system + user)
categories.getById     // GET - Get single category
categories.create      // POST - Create custom category
categories.update      // PUT - Update custom category
categories.delete      // DELETE - Delete custom category (only user-created)
categories.reorder     // PUT - Update display order
```

#### Tags Router (`tags.ts`)
```typescript
tags.list              // GET - List all user tags
tags.create            // POST - Create new tag
tags.update            // PUT - Update tag
tags.delete            // DELETE - Delete tag
tags.addToTransaction  // POST - Add tag to transaction
tags.removeFromTransaction // DELETE - Remove tag from transaction
```

#### Analytics Router (`analytics.ts`)
```typescript
analytics.overview              // GET - Dashboard overview stats
analytics.spendingByCategory    // GET - Spending breakdown by category
analytics.spendingByWallet      // GET - Spending breakdown by wallet
analytics.spendingOverTime      // GET - Time series data (daily/weekly/monthly)
analytics.topMerchants          // GET - Most frequent merchants
analytics.incomeVsExpense       // GET - Income vs expense comparison
```

**Overview Stats Response:**
```typescript
{
  totalIncome: number      // Current month income
  totalExpenses: number    // Current month expenses
  netCashFlow: number      // income - expenses
  totalBalance: number     // Sum of all wallet balances
  transactionCount: number // Total transactions this month
  topCategory: { name, amount, percentage }
  compared: {              // vs previous month
    income: { amount, percentage }
    expenses: { amount, percentage }
  }
}
```

#### Sync Router (`sync.ts`)
```typescript
sync.pull              // GET - Get changes since last sync (timestamp)
sync.push              // POST - Push local changes to server
sync.resolve           // POST - Resolve sync conflicts
```

**Pull Response:**
```typescript
{
  wallets: { created: [], updated: [], deleted: [] }
  transactions: { created: [], updated: [], deleted: [] }
  categories: { created: [], updated: [], deleted: [] }
  tags: { created: [], updated: [], deleted: [] }
  timestamp: string  // Server timestamp for next pull
}
```

### Type Safety with Shared Types

All endpoints use shared Zod schemas from `@repo/types`:

```typescript
// Define once, use everywhere
// packages/types/src/wallet.ts
export const createWalletSchema = z.object({
  name: z.string().min(1).max(100),
  type: walletTypeSchema,
  currency: z.string().length(3).default('USD'),
  initialBalance: z.number().default(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string(),
});

// Use in API (server-side validation)
// apps/web/src/app/api/wallets/route.ts
const validated = createWalletSchema.parse(body);

// Use in mobile (client-side validation)
// apps/mobile/components/wallet-form.tsx
const validated = createWalletSchema.parse(formData);
```

### Authentication Middleware

All endpoints (except auth routes) require Supabase JWT token:

```typescript
// Validates Bearer token in Authorization header
// Extracts user ID from JWT
// Returns 401 if invalid/missing
```

### Error Handling

Standardized error responses:
```typescript
{
  error: string
  details?: any
}

// HTTP status codes:
// 400 - Bad Request (validation error)
// 401 - Unauthorized
// 403 - Forbidden
// 404 - Not Found
// 409 - Conflict
// 500 - Internal Server Error
```

---

## Sync Strategy

### Local-First Architecture

**Write Operations:**
1. User performs action on mobile
2. Write immediately to local SQLite database
3. Mark as `is_synced: false`
4. Immediately update UI
5. Queue sync operation in background

**Sync Operations:**
1. When online, mobile app polls for changes every 30s or on app focus
2. **Pull**: Fetch server changes since last sync timestamp
3. **Merge**: Apply server changes to local database (server wins for conflicts)
4. **Push**: Send local unsynced changes to server
5. **Resolve**: Handle conflicts (last-write-wins strategy)
6. Update sync timestamps

**Conflict Resolution (Phase 1 - Simple):**
- **Server Wins**: In case of conflict, server version is authoritative
- Track `updated_at` timestamps
- Mobile shows notification if local changes were overwritten

**Optimizations:**
- Batch sync operations
- Only sync changed entities
- Use Supabase Realtime for instant updates when app is active
- Background sync when app is backgrounded (iOS/Android background fetch)

### Supabase Realtime Integration

Subscribe to changes on web dashboard:
```typescript
// Subscribe to user's transactions
supabase
  .channel('transactions')
  .on('postgres_changes', 
    { 
      event: '*', 
      schema: 'public', 
      table: 'transactions',
      filter: `user_id=eq.${userId}`
    }, 
    (payload) => {
      // Update UI in real-time
    }
  )
  .subscribe()
```

---

## Mobile App Structure

### File-Based Routing (expo-router)

```
apps/mobile/app/
├── _layout.tsx              # Root layout (auth check, providers)
├── index.tsx                # Landing/splash screen
├── (auth)/                  # Auth group (no auth required)
│   ├── _layout.tsx
│   ├── login.tsx
│   └── register.tsx
├── (app)/                   # Main app (auth required)
│   ├── _layout.tsx          # Tab navigator
│   ├── (home)/              # Home tab
│   │   ├── index.tsx        # Transaction list
│   │   └── transaction/
│   │       ├── [id].tsx     # View transaction
│   │       ├── new.tsx      # Add transaction
│   │       └── edit/[id].tsx # Edit transaction
│   ├── (wallets)/           # Wallets tab
│   │   ├── index.tsx        # Wallet list
│   │   └── [id].tsx         # Wallet details
│   ├── (analytics)/         # Analytics tab
│   │   └── index.tsx        # Charts and insights
│   └── (settings)/          # Settings tab
│       ├── index.tsx        # Settings home
│       ├── profile.tsx
│       ├── categories.tsx
│       └── sync.tsx
└── modal.tsx                # Global modals
```

### Component Structure

```
apps/mobile/components/
├── ui/                      # Base UI components
│   ├── button.tsx
│   ├── input.tsx
│   ├── card.tsx
│   ├── modal.tsx
│   └── ...
├── transactions/
│   ├── transaction-list-item.tsx
│   ├── transaction-form.tsx
│   ├── category-picker.tsx
│   ├── amount-input.tsx
│   └── date-picker.tsx
├── wallets/
│   ├── wallet-card.tsx
│   ├── wallet-list-item.tsx
│   └── wallet-form.tsx
├── analytics/
│   ├── spending-chart.tsx
│   ├── category-breakdown.tsx
│   └── stats-card.tsx
└── shared/
    ├── loading-spinner.tsx
    ├── empty-state.tsx
    └── error-boundary.tsx
```

### Database Layer (Drizzle ORM)

```
apps/mobile/db/
├── schema.ts               # Drizzle schema definitions
├── client.ts               # Database instance
├── migrations/             # Generated migrations
│   └── migrations.js       # Bundled migrations
└── operations/             # Database operations
    ├── wallets.ts          # Wallet CRUD
    ├── transactions.ts     # Transaction CRUD
    ├── categories.ts       # Category operations
    ├── tags.ts             # Tag operations
    └── sync.ts             # Sync operations
```

### API Client (REST + TanStack Query)

```
apps/mobile/lib/
├── api.ts                  # Fetch wrapper with auth
├── query-client.ts         # TanStack Query configuration
└── supabase.ts             # Supabase client (for auth tokens)
```

**Usage Example:**
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import type { WalletListResponse, CreateWallet } from '@repo/types';

// In component
const { data: wallets, isLoading } = useQuery({
  queryKey: ['wallets'],
  queryFn: () => fetchApi<WalletListResponse>('/api/wallets'),
});

const createWallet = useMutation({
  mutationFn: (data: CreateWallet) =>
    fetchApi('/api/wallets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
});
```

---

## Web App Structure

### App Router Structure

```
apps/web/src/app/
├── layout.tsx              # Root layout
├── page.tsx                # Landing page
├── (auth)/                 # Auth routes
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx
├── (dashboard)/            # Dashboard (auth required)
│   ├── layout.tsx          # Dashboard shell
│   ├── page.tsx            # Overview dashboard
│   ├── transactions/
│   │   └── page.tsx
│   ├── wallets/
│   │   └── page.tsx
│   ├── analytics/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
└── api/                    # REST API routes
    ├── auth/
    │   ├── register/route.ts
    │   └── login/route.ts
    ├── wallets/
    │   ├── route.ts
    │   └── [id]/route.ts
    ├── transactions/
    │   ├── route.ts
    │   └── [id]/route.ts
    ├── categories/route.ts
    ├── tags/route.ts
    ├── analytics/
    │   └── overview/route.ts
    └── sync/
        ├── pull/route.ts
        └── push/route.ts
```

### API Route Example

```typescript
// apps/web/src/app/api/wallets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createWalletSchema, type WalletListResponse } from '@repo/types';

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
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response: WalletListResponse = { wallets: data };
  return NextResponse.json(response);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const validated = createWalletSchema.parse(body); // ✅ Runtime validation

  const { data, error } = await supabase
    .from('wallets')
    .insert({ ...validated, user_id: user.id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wallet: data });
}
```

### Components

```
apps/web/src/components/
├── dashboard/
│   ├── stats-card.tsx
│   ├── recent-transactions.tsx
│   └── spending-chart.tsx
├── transactions/
│   ├── transaction-table.tsx
│   ├── transaction-filters.tsx
│   └── transaction-form.tsx
├── wallets/
│   ├── wallet-grid.tsx
│   └── wallet-card.tsx
├── analytics/
│   ├── category-chart.tsx
│   ├── timeline-chart.tsx
│   └── merchant-chart.tsx
└── ui/                     # Shared UI from @repo/ui
```

---

## Security Considerations

### Authentication
- **Supabase Auth** with secure JWT tokens
- Token refresh handled automatically
- Secure storage of tokens (Expo SecureStore on mobile)
- Password requirements: min 8 characters, complexity rules

### Authorization
- **Row Level Security (RLS)** on all tables
- User can only access their own data
- Server-side validation on all API endpoints

### Data Privacy
- All API communication over HTTPS
- Local database encrypted at rest (iOS/Android system encryption)
- No sensitive data logged
- User can export and delete all data (GDPR compliance)

### API Security
- Rate limiting on API endpoints
- Input validation with Zod schemas
- SQL injection prevention (Drizzle parameterized queries)
- XSS prevention (React auto-escaping)

---

## Development Workflow

### Setup Instructions

**Prerequisites:**
- Node.js >=18
- pnpm 9.0+
- Expo Go app (for mobile testing)
- Supabase account

**Environment Variables:**

`.env.local` (web app):
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

`.env` (mobile app):
```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

**Installation:**
```bash
# Install dependencies
pnpm install

# Run mobile app
pnpm --filter mobile dev

# Run web app
pnpm --filter web dev

# Run all apps
pnpm dev
```

### Database Migrations

**Generate migration:**
```bash
# Generate from Drizzle schema
cd packages/database
pnpm drizzle-kit generate

# For mobile (generates bundled migrations)
cd apps/mobile
pnpm drizzle-kit generate
```

**Apply migration:**
```bash
# Supabase (web)
cd packages/database
pnpm drizzle-kit push

# Mobile (applied automatically on app start via useMigrations hook)
```

### Git Workflow
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature branches
- `fix/*` - Bug fix branches

### Code Quality
- ESLint for linting
- Prettier for formatting
- TypeScript strict mode
- Pre-commit hooks (Husky + lint-staged) [TO SETUP]

---

## Shared Packages

### `@repo/types`

**Purpose:** Shared TypeScript types and Zod schemas for type-safe API communication

```typescript
// packages/types/src/wallet.ts
import { z } from 'zod';

// Zod schema for validation
export const createWalletSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['bank', 'cash', 'credit', 'debit', 'ewallet', 'investment', 'other']),
  currency: z.string().length(3).default('USD'),
  initialBalance: z.number().default(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string(),
});

// TypeScript type (inferred from schema)
export type CreateWallet = z.infer<typeof createWalletSchema>;

// API response types
export type WalletResponse = {
  wallet: Wallet;
};

export type WalletListResponse = {
  wallets: Wallet[];
};
```

**Exports:**
- Zod schemas for runtime validation
- TypeScript types (inferred from Zod)
- API request/response types
- Shared enums and constants

**Usage in Web API:**
```typescript
import { createWalletSchema, type WalletResponse } from '@repo/types';

// Validate incoming request
const validated = createWalletSchema.parse(body);
```

**Usage in Mobile:**
```typescript
import { createWalletSchema, type CreateWallet, type WalletResponse } from '@repo/types';

// Validate before sending
const validated = createWalletSchema.parse(formData);

// Type-safe API response
const response = await fetch('/api/wallets', { /* ... */ });
const data: WalletResponse = await response.json();
```

---

## Phase 1 Acceptance Criteria

### Core Functionality
- [ ] User can register and login
- [ ] User can create multiple wallets
- [ ] User can manually add transactions (amount, category, description, date)
- [ ] User can view list of all transactions
- [ ] User can filter transactions by wallet, category, date range
- [ ] User can edit and delete transactions
- [ ] User can see wallet balances (calculated from transactions)
- [ ] Web dashboard shows overview statistics
- [ ] Web dashboard shows spending charts

### Data Sync
- [ ] Transactions created on mobile sync to Supabase
- [ ] Transactions created on web appear on mobile after sync
- [ ] Offline transaction creation works on mobile
- [ ] Background sync occurs periodically when app is online
- [ ] User can see sync status

### Performance
- [ ] App loads in < 3 seconds
- [ ] Transaction list scrolls smoothly (60fps)
- [ ] Local database queries return in < 100ms
- [ ] API responses return in < 500ms (p95)

### Security
- [ ] All API endpoints require authentication
- [ ] Users can only access their own data
- [ ] Passwords are hashed (Supabase handles this)
- [ ] Input validation prevents injection attacks

---

## Future Phases (Backlog)

### Phase 2: AI-Powered Transaction Entry — *partially delivered (on-device)*

**Delivered (mobile):** Natural-language and typed text → structured extraction via **on-device** Qwen 2.5 VL; **grammar-constrained JSON** (`generateObject` + Zod); wallet resolution sub-agent; proposals with confidence/reasoning; user review before save.

**Still on the backlog:**
- First-class **voice-to-text** pipeline (e.g. Expo Speech / on-device STT) wired into the same orchestrator
- Optional **cloud LLM** path for users who prefer it (would be opt-in and clearly labeled)

**Original example flow** (still valid; today often typed or pasted instead of spoken):
```
User: "I spent $45.50 at Starbucks this morning"
↓
Model extracts: amount, type, merchant, category hints, wallet hint
↓
User reviews in proposal modal and confirms/edits
```

**Tech (as implemented):** `@react-native-ai/llama`, Vercel AI SDK `generateObject`, shared Zod schemas in `@repo/types` where applicable.

### Phase 3: Receipt OCR & Image Processing — *partially delivered (on-device VL)*

**Delivered:** Receipt/camera image in chat → **multimodal** VL extraction (no separate cloud OCR required for the happy path); local image persistence; offline-first upload queue to Supabase Storage; same proposal + review flow.

**Backlog:** Deeper itemized line items (`metadata.receipt_items`), richer merchant/tax breakdown, optional **cloud OCR** fallback for hard images.

### Phase 4: Advanced Analytics & Location
**Objective:** Provide insights into spending patterns

**Features:**
- Spending patterns by time of day, day of week
- Location-based spending analysis (spending by neighborhood, city)
- Merchant frequency analysis
- Budget tracking and alerts
- Spending forecasts using historical data
- Anomaly detection (unusual spending)

**Tech Stack:**
- `expo-location` for GPS coordinates
- PostgreSQL PostGIS extension for geo queries
- Materialized views for performance
- Recharts for advanced visualizations
- Optional: Python backend for ML forecasting

**Database Changes:**
- Enable PostGIS extension
- Add geo indexes on location fields
- Create materialized views for aggregations

### Phase 5: Advanced Features
**Objective:** Polish and advanced capabilities

**Features:**
- Recurring transactions (subscriptions, bills)
- Budget planning and tracking
- Savings goals
- Multi-currency support with exchange rates
- Bill splitting with friends
- Export reports (PDF, CSV, Excel)
- Home screen widgets (iOS/Android)
- Push notifications for budgets, bills
- Wear OS / watchOS app

**Tech Stack:**
- `expo-notifications` for push notifications
- `react-native-widget-extension` for widgets
- Exchange rate API (e.g., exchangerate-api.io)
- PDF generation library (e.g., react-native-html-to-pdf)

---

## Testing Strategy

### Unit Tests
- Business logic in `@repo/api`
- Database operations
- Utility functions
- Target: 80% code coverage

### Integration Tests
- API endpoints (REST routes)
- Database migrations
- Sync operations

### E2E Tests
- Critical user flows:
  - Registration → Login → Create Wallet → Add Transaction
  - View analytics dashboard
  - Sync between mobile and web

**Tools:**
- Jest for unit tests
- Playwright for web E2E
- Maestro or Detox for mobile E2E

---

## Performance Targets

### Mobile App
- App launch: < 3 seconds (cold start)
- Navigation: < 16ms (60fps)
- Local queries: < 100ms
- Sync operation: < 2 seconds for 100 transactions

### Web App
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.5s
- API responses: < 500ms (p95)

### Database
- Simple queries: < 50ms
- Complex analytics queries: < 500ms
- Concurrent users: Support 10,000+ users

---

## Monitoring & Analytics

### Error Tracking
- Sentry for error monitoring (both mobile and web)
- Track crash-free sessions
- Alert on critical errors

### Performance Monitoring
- Web Vitals (web app)
- App startup time (mobile)
- API endpoint latency

### Usage Analytics (Privacy-Preserving)
- Anonymous feature usage tracking
- User retention metrics
- Session duration
- No PII collected

**Tools:**
- Sentry for errors
- Posthog or Plausible for privacy-focused analytics

---

## Deployment

### Mobile App
- **Expo EAS Build** for building production apps
- **Expo EAS Submit** for app store submission
- Over-the-air updates with Expo Updates

**Deployment Process:**
```bash
# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to app stores
eas submit --platform ios
eas submit --platform android
```

### Web App
- **Vercel** for hosting (recommended)
- Automatic deployments on git push
- Preview deployments for PRs
- Edge network for global performance

**Alternative:** Railway, Render, Fly.io

### Database
- **Supabase Cloud** (managed PostgreSQL)
- Automatic backups
- Point-in-time recovery
- Database branching for testing

---

## License & Credits

**License:** MIT (or your chosen license)

**Tech Stack Credits:**
- React Native & Expo
- Next.js & React
- Supabase
- Drizzle ORM
- Zod (validation)
- TanStack Query
- Turborepo

---

## Support & Documentation

### Resources
- [Expo Documentation](https://docs.expo.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Zod Documentation](https://zod.dev)
- [TanStack Query Documentation](https://tanstack.com/query/latest)

### Getting Help
- GitHub Issues for bug reports
- GitHub Discussions for questions
- Discord community (if applicable)

---

## Changelog

### Phase 1 (In Progress)
- Initial project setup
- Database schema design
- Authentication implementation
- Basic CRUD operations
- Mobile UI implementation
- Web dashboard
- Sync functionality
- **On-device AI orchestrator** (text / image / Android notifications → proposed transactions, user review); see `apps/mobile/lib/ai/ORCHESTRATOR.md`

---

*Last Updated: March 22, 2026*
