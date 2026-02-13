-- Moni Database Schema
-- Phase 1: Foundation
-- Last Updated: February 14, 2026

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE wallet_type AS ENUM (
  'bank',
  'cash',
  'credit',
  'debit',
  'ewallet',
  'investment',
  'other'
);

CREATE TYPE category_type AS ENUM ('income', 'expense');

CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer');

-- ============================================
-- Helper Functions
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Tables
-- ============================================

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  preferences JSONB NOT NULL DEFAULT '{
    "currency": "USD",
    "theme": "system",
    "notifications_enabled": true
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wallets table
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type wallet_type NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  initial_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Tags table
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_tag_per_user UNIQUE (user_id, name)
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
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

-- Transaction tags junction table
CREATE TABLE transaction_tags (
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

-- ============================================
-- Indexes
-- ============================================

-- Profiles indexes
CREATE INDEX idx_profiles_updated_at ON profiles(updated_at DESC);

-- Wallets indexes
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_user_active ON wallets(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_wallets_updated_at ON wallets(updated_at DESC);

-- Categories indexes
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_type ON categories(type);
CREATE INDEX idx_categories_user_type_active ON categories(user_id, type, is_active) WHERE is_active = TRUE;

-- Tags indexes
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE UNIQUE INDEX idx_tags_user_name ON tags(user_id, LOWER(name));

-- Transactions indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_merchant ON transactions(merchant) WHERE merchant IS NOT NULL;
CREATE INDEX idx_transactions_updated_at ON transactions(updated_at DESC);

-- Full-text search index for transactions
CREATE INDEX idx_transactions_search ON transactions 
  USING GIN (to_tsvector('english', 
    COALESCE(description, '') || ' ' || 
    COALESCE(merchant, '') || ' ' || 
    COALESCE(notes, '')
  ));

-- Transaction tags indexes
CREATE INDEX idx_transaction_tags_transaction ON transaction_tags(transaction_id);
CREATE INDEX idx_transaction_tags_tag ON transaction_tags(tag_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_tags ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Wallets RLS policies
CREATE POLICY "Users can manage own wallets" 
  ON wallets 
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Categories RLS policies
CREATE POLICY "Users can view system and own categories" 
  ON categories FOR SELECT 
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" 
  ON categories FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" 
  ON categories FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" 
  ON categories FOR DELETE 
  USING (auth.uid() = user_id);

-- Tags RLS policies
CREATE POLICY "Users can manage own tags" 
  ON tags 
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Transactions RLS policies
CREATE POLICY "Users can manage own transactions" 
  ON transactions 
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Transaction tags RLS policies
CREATE POLICY "Users can manage own transaction tags" 
  ON transaction_tags 
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM transactions 
      WHERE id = transaction_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions 
      WHERE id = transaction_id AND user_id = auth.uid()
    )
  );

-- ============================================
-- Triggers
-- ============================================

-- Profiles updated_at trigger
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Wallets updated_at trigger
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Categories updated_at trigger
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Transactions updated_at trigger
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Views
-- ============================================

-- Wallet balances view
CREATE OR REPLACE VIEW wallet_balances AS
SELECT 
  w.id,
  w.user_id,
  w.name,
  w.type,
  w.currency,
  w.initial_balance,
  w.color,
  w.icon,
  w.is_active,
  w.display_order,
  w.created_at,
  w.updated_at,
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
LEFT JOIN transactions t ON (t.wallet_id = w.id OR t.transfer_to_wallet_id = w.id)
WHERE w.is_active = TRUE
GROUP BY w.id;

-- ============================================
-- Seed Data: System Categories
-- ============================================

-- Expense categories
INSERT INTO categories (user_id, name, icon, color, type, display_order) VALUES
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
(NULL, 'Other Expenses', '📦', '#2A9D8F', 'expense', 13);

-- Income categories
INSERT INTO categories (user_id, name, icon, color, type, display_order) VALUES
(NULL, 'Salary', '💰', '#06D6A0', 'income', 1),
(NULL, 'Freelance', '💼', '#118AB2', 'income', 2),
(NULL, 'Investment', '📈', '#073B4C', 'income', 3),
(NULL, 'Gifts', '🎁', '#EF476F', 'income', 4),
(NULL, 'Other Income', '💵', '#FFD166', 'income', 5);

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE profiles IS 'User profile information extending Supabase Auth';
COMMENT ON TABLE wallets IS 'Financial accounts (bank, cash, credit cards, etc.)';
COMMENT ON TABLE categories IS 'Transaction categories (system and user-defined)';
COMMENT ON TABLE tags IS 'User-defined tags for organizing transactions';
COMMENT ON TABLE transactions IS 'Financial transactions (income, expenses, transfers)';
COMMENT ON TABLE transaction_tags IS 'Junction table linking transactions to tags';
COMMENT ON VIEW wallet_balances IS 'Calculated current balance for each wallet';
