-- Legend-State sync prep: soft deletes, transaction_tags id PK, Realtime publication

-- Soft-delete column for incremental sync (changesSince: last-sync)
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE transaction_tags ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE category_budgets ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE proposed_transactions ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- transaction_tags: Legend-State requires a single id column per row
ALTER TABLE transaction_tags ADD COLUMN IF NOT EXISTS id UUID;

UPDATE transaction_tags SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE transaction_tags ALTER COLUMN id SET NOT NULL;
ALTER TABLE transaction_tags ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE transaction_tags DROP CONSTRAINT IF EXISTS transaction_tags_pkey;
ALTER TABLE transaction_tags ADD PRIMARY KEY (id);
ALTER TABLE transaction_tags DROP CONSTRAINT IF EXISTS transaction_tags_transaction_tag_unique;
ALTER TABLE transaction_tags ADD CONSTRAINT transaction_tags_transaction_tag_unique UNIQUE (transaction_id, tag_id);

-- Enable Supabase Realtime for synced tables
ALTER PUBLICATION supabase_realtime ADD TABLE wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE tags;
ALTER PUBLICATION supabase_realtime ADD TABLE transaction_tags;
ALTER PUBLICATION supabase_realtime ADD TABLE category_budgets;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_insights;
ALTER PUBLICATION supabase_realtime ADD TABLE proposed_transactions;
