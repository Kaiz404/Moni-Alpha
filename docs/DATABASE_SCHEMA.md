# Moni Database Schema

## Overview

This document provides the complete database schema for Moni, including both the Supabase PostgreSQL database (cloud) and the local SQLite database (mobile).

---

## Database Diagrams

### Entity Relationship Diagram

```
┌─────────────────┐
│   auth.users    │ (Managed by Supabase Auth)
│                 │
│  id (uuid) PK   │
│  email          │
│  created_at     │
└────────┬────────┘
         │
         │ 1:1
         │
┌────────▼────────┐
│    profiles     │
│                 │
│  id (uuid) PK   ├─────┐
│  display_name   │     │
│  avatar_url     │     │
│  preferences    │     │
└─────────────────┘     │
                        │
                        │ 1:N
         ┌──────────────┼──────────────────┬──────────────────┐
         │              │                  │                  │
┌────────▼────────┐ ┌───▼──────────┐ ┌────▼────────────┐ ┌──▼─────────┐
│    wallets      │ │transactions  │ │   categories    │ │    tags    │
│                 │ │              │ │                 │ │            │
│  id PK          │ │  id PK       │ │  id PK          │ │  id PK     │
│  user_id FK     │ │  user_id FK  │ │  user_id FK     │ │  user_id FK│
│  name           │ │  wallet_id FK│ │  name           │ │  name      │
│  type           │ │  amount      │ │  icon           │ │  color     │
│  currency       │ │  type        │ │  color          │ └────────────┘
│  initial_balance│ │  category_id │ │  parent_id FK   │      │
│  color          │ │  merchant    │ │  type           │      │
│  icon           │ │  description │ └─────────────────┘      │
└─────────────────┘ │  location    │                          │
         │          │  receipt_url │                          │
         │          │  metadata    │                          │
         │          └───────┬──────┘                          │
         │                  │                                 │
         │ transfer_to      │                                 │
         └──────────────────┘                                 │
                            │                                 │
                            │ N:N                             │
                            │                                 │
                   ┌────────▼─────────┐                       │
                   │ transaction_tags │◄──────────────────────┘
                   │                  │
                   │ transaction_id FK│
                   │ tag_id FK        │
                   └──────────────────┘
```

---

## Table Definitions

### 1. profiles

User profile information extending Supabase Auth users.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  preferences JSONB NOT NULL DEFAULT '{
    "currency": "USD",
    "theme": "system",
    "notifications_enabled": true
  }',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_updated_at ON profiles(updated_at DESC);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Trigger for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**TypeScript Type:**
```typescript
interface Profile {
  id: string; // UUID
  display_name: string;
  avatar_url: string | null;
  preferences: {
    currency: string;
    theme: 'light' | 'dark' | 'system';
    notifications_enabled: boolean;
  };
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}
```

---

### 2. wallets

User's financial accounts (bank accounts, cash, credit cards, etc.)

```sql
CREATE TYPE wallet_type AS ENUM (
  'bank',
  'cash', 
  'credit',
  'debit',
  'ewallet',
  'investment',
  'other'
);

CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type wallet_type NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD', -- ISO 4217
  initial_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  color TEXT NOT NULL, -- Hex color
  icon TEXT NOT NULL, -- Icon name or emoji
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_user_active ON wallets(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_wallets_updated_at ON wallets(updated_at DESC);

-- RLS Policies
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own wallets" 
  ON wallets 
  USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**TypeScript Type:**
```typescript
interface Wallet {
  id: string; // UUID
  user_id: string; // UUID
  name: string;
  type: 'bank' | 'cash' | 'credit' | 'debit' | 'ewallet' | 'investment' | 'other';
  currency: string; // ISO 4217 code
  initial_balance: number;
  color: string; // Hex color
  icon: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  
  // Computed field (not in DB)
  current_balance?: number;
}
```

---

### 3. categories

Transaction categories (both system-provided and user-created)

```sql
CREATE TYPE category_type AS ENUM ('income', 'expense');

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for system categories
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  type category_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT check_parent_not_self CHECK (parent_id != id)
);

-- Indexes
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_type ON categories(type);
CREATE INDEX idx_categories_user_type_active ON categories(user_id, type, is_active) 
  WHERE is_active = TRUE;

-- RLS Policies
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view system and own categories" 
  ON categories FOR SELECT 
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can manage own categories" 
  ON categories FOR ALL
  USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**TypeScript Type:**
```typescript
interface Category {
  id: string; // UUID
  user_id: string | null; // NULL for system categories
  name: string;
  icon: string;
  color: string;
  parent_id: string | null; // For subcategories
  type: 'income' | 'expense';
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}
```

---

### 4. transactions

Financial transactions (income, expenses, transfers)

```sql
CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer');

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL,
  type transaction_type NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  
  -- Transfer fields
  transfer_to_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  linked_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  
  -- Transaction details
  description TEXT,
  merchant TEXT,
  notes TEXT,
  
  -- Temporal
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Location (Phase 1: capture, Phase 4: analyze)
  location_latitude NUMERIC(10, 8),
  location_longitude NUMERIC(11, 8),
  location_name TEXT,
  
  -- Receipt (Phase 3)
  receipt_image_url TEXT,
  
  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}',
  
  -- Sync fields (mobile only, not in Supabase)
  -- is_synced BOOLEAN DEFAULT FALSE,
  -- local_created_at TIMESTAMPTZ,
  -- local_updated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT check_amount_positive CHECK (amount > 0),
  CONSTRAINT check_transfer_has_target CHECK (
    (type != 'transfer') OR (transfer_to_wallet_id IS NOT NULL)
  ),
  CONSTRAINT check_location_complete CHECK (
    (location_latitude IS NULL AND location_longitude IS NULL) OR
    (location_latitude IS NOT NULL AND location_longitude IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_merchant ON transactions(merchant) WHERE merchant IS NOT NULL;
CREATE INDEX idx_transactions_updated_at ON transactions(updated_at DESC);

-- Full-text search index
CREATE INDEX idx_transactions_search ON transactions 
  USING GIN (to_tsvector('english', 
    COALESCE(description, '') || ' ' || 
    COALESCE(merchant, '') || ' ' || 
    COALESCE(notes, '')
  ));

-- Location index (PostGIS extension required - Phase 4)
-- CREATE INDEX idx_transactions_location ON transactions 
--   USING GIST (ll_to_earth(location_latitude, location_longitude))
--   WHERE location_latitude IS NOT NULL;

-- RLS Policies
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transactions" 
  ON transactions 
  USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**TypeScript Type:**
```typescript
interface Transaction {
  id: string; // UUID
  user_id: string; // UUID
  wallet_id: string; // UUID
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category_id: string | null; // UUID
  
  // Transfer fields
  transfer_to_wallet_id: string | null; // UUID
  linked_transaction_id: string | null; // UUID
  
  // Details
  description: string | null;
  merchant: string | null;
  notes: string | null;
  
  // Temporal
  transaction_date: string; // ISO timestamp
  
  // Location
  location_latitude: number | null;
  location_longitude: number | null;
  location_name: string | null;
  
  // Receipt
  receipt_image_url: string | null;
  
  // Metadata
  metadata: {
    ai_suggested?: boolean;
    ai_confidence?: number;
    tags?: string[];
    [key: string]: any;
  };
  
  // Mobile-only sync fields
  is_synced?: boolean;
  local_created_at?: string;
  local_updated_at?: string;
  
  created_at: string;
  updated_at: string;
}
```

---

### 5. tags

User-defined tags for organizing transactions

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_tag_per_user UNIQUE (user_id, name)
);

-- Indexes
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE UNIQUE INDEX idx_tags_user_name ON tags(user_id, LOWER(name));

-- RLS Policies
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tags" 
  ON tags 
  USING (auth.uid() = user_id);
```

**TypeScript Type:**
```typescript
interface Tag {
  id: string; // UUID
  user_id: string; // UUID
  name: string;
  color: string;
  created_at: string;
}
```

---

### 6. transaction_tags

Junction table linking transactions to tags (many-to-many)

```sql
CREATE TABLE transaction_tags (
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  
  PRIMARY KEY (transaction_id, tag_id)
);

-- Indexes
CREATE INDEX idx_transaction_tags_transaction ON transaction_tags(transaction_id);
CREATE INDEX idx_transaction_tags_tag ON transaction_tags(tag_id);

-- RLS Policies
ALTER TABLE transaction_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transaction tags" 
  ON transaction_tags 
  USING (
    EXISTS (
      SELECT 1 FROM transactions 
      WHERE id = transaction_id AND user_id = auth.uid()
    )
  );
```

**TypeScript Type:**
```typescript
interface TransactionTag {
  transaction_id: string; // UUID
  tag_id: string; // UUID
}
```

---

### 7. sync_log (Mobile SQLite Only)

Tracks local changes for syncing to server. **Not present in Supabase.**

```sql
CREATE TABLE sync_log (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('wallet', 'transaction', 'category', 'tag')),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  data TEXT NOT NULL, -- JSON string
  synced_at INTEGER, -- Unix timestamp
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')) -- Unix timestamp
);

CREATE INDEX idx_sync_log_synced ON sync_log(synced_at) WHERE synced_at IS NULL;
CREATE INDEX idx_sync_log_entity ON sync_log(entity_type, entity_id);
```

**TypeScript Type:**
```typescript
interface SyncLog {
  id: string; // UUID
  entity_type: 'wallet' | 'transaction' | 'category' | 'tag';
  entity_id: string; // UUID of the entity
  action: 'create' | 'update' | 'delete';
  data: string; // JSON string of entity data
  synced_at: number | null; // Unix timestamp
  created_at: number; // Unix timestamp
}
```

---

## Helper Functions

### update_updated_at_column()

Automatically updates the `updated_at` timestamp on row updates.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Views

### wallet_balances

Calculate current balance for each wallet.

```sql
CREATE OR REPLACE VIEW wallet_balances AS
SELECT 
  w.id,
  w.user_id,
  w.name,
  w.type,
  w.currency,
  w.initial_balance,
  w.initial_balance + COALESCE(
    SUM(
      CASE 
        WHEN t.type = 'income' THEN t.amount
        WHEN t.type = 'expense' THEN -t.amount
        WHEN t.type = 'transfer' AND t.wallet_id = w.id THEN -t.amount
        WHEN t.type = 'transfer' AND t.transfer_to_wallet_id = w.id THEN t.amount
        ELSE 0
      END
    ), 0
  ) AS current_balance
FROM wallets w
LEFT JOIN transactions t ON t.wallet_id = w.id OR t.transfer_to_wallet_id = w.id
WHERE w.is_active = TRUE
GROUP BY w.id;
```

---

## Materialized Views (Phase 4 - Performance Optimization)

### monthly_spending_by_category

Pre-computed monthly spending aggregations.

```sql
CREATE MATERIALIZED VIEW monthly_spending_by_category AS
SELECT 
  user_id,
  category_id,
  DATE_TRUNC('month', transaction_date) AS month,
  COUNT(*) AS transaction_count,
  SUM(amount) AS total_amount
FROM transactions
WHERE type = 'expense' AND category_id IS NOT NULL
GROUP BY user_id, category_id, DATE_TRUNC('month', transaction_date);

CREATE UNIQUE INDEX ON monthly_spending_by_category (user_id, category_id, month);
CREATE INDEX ON monthly_spending_by_category (user_id, month);

-- Refresh strategy: Cron job or trigger-based
```

---

## Seed Data

### System Categories

```sql
-- Insert system categories (user_id = NULL)
INSERT INTO categories (user_id, name, icon, color, type, display_order) VALUES
-- Expense categories
(NULL, 'Food & Dining', '🍔', '#FF6B6B', 'expense', 1),
(NULL, 'Transportation', '🚗', '#4ECDC4', 'expense', 2),
(NULL, 'Housing', '🏠', '#45B7D1', 'expense', 3),
(NULL, 'Entertainment', '🎬', '#FFA07A', 'expense', 4),
(NULL, 'Shopping', '🛍️', '#DDA15E', 'expense', 5),
(NULL, 'Healthcare', '🏥', '#BC6C25', 'expense', 6),
(NULL, 'Work', '💼', '#606C38', 'expense', 7),
(NULL, 'Education', '🎓', '#283618', 'expense', 8),
(NULL, 'Travel', '✈️', '#6C757D', 'expense', 9),
(NULL, 'Subscriptions', '📱', '#495057', 'expense', 10),
(NULL, 'Gifts & Donations', '🎁', '#E63946', 'expense', 11),
(NULL, 'Fees & Charges', '💳', '#F4A261', 'expense', 12),
(NULL, 'Other Expenses', '📦', '#2A9D8F', 'expense', 13),

-- Income categories
(NULL, 'Salary', '💰', '#06D6A0', 'income', 1),
(NULL, 'Freelance', '💼', '#118AB2', 'income', 2),
(NULL, 'Investment', '📈', '#073B4C', 'income', 3),
(NULL, 'Gifts', '🎁', '#EF476F', 'income', 4),
(NULL, 'Other Income', '💵', '#FFD166', 'income', 5);
```

---

## Migration Order

When setting up database from scratch:

1. Create `update_updated_at_column()` function
2. Create custom types (`wallet_type`, `category_type`, `transaction_type`)
3. Create `profiles` table
4. Create `wallets` table
5. Create `categories` table
6. Create `tags` table
7. Create `transactions` table
8. Create `transaction_tags` table
9. Create views (`wallet_balances`)
10. Seed system categories

---

## Backup & Maintenance

### Recommended Backups
- Daily automated backups (Supabase handles this)
- Point-in-time recovery enabled
- Manual exports before major migrations

### Maintenance Tasks
- VACUUM ANALYZE weekly (automatic in Supabase)
- Refresh materialized views (Phase 4)
- Archive old transactions (optional, after 5+ years)

---

## Mobile SQLite Schema Differences

The mobile SQLite database mirrors the Supabase schema with these additions:

1. **Sync fields** in transactions, wallets, categories, tags:
   - `is_synced` BOOLEAN
   - `local_created_at` INTEGER (Unix timestamp)
   - `local_updated_at` INTEGER (Unix timestamp)

2. **sync_log** table for tracking pending syncs

3. **Type differences**:
   - Use TEXT for UUIDs
   - Use INTEGER for timestamps (Unix timestamps)
   - Use TEXT for JSONB fields
   - Use TEXT for ENUMs (validate in app code)

---

*Last Updated: February 14, 2026*
