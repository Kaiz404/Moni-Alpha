-- Add user_id column to transaction_tags for PowerSync sync rules
-- This enables direct filtering without JOINs in sync rules

ALTER TABLE transaction_tags ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_transaction_tags_user_id ON transaction_tags(user_id);

-- Populate user_id from existing transactions
UPDATE transaction_tags
SET user_id = transactions.user_id
FROM transactions
WHERE transaction_tags.transaction_id = transactions.id;

-- Make user_id NOT NULL after populating existing data
ALTER TABLE transaction_tags ALTER COLUMN user_id SET NOT NULL;

-- Update RLS policy to use direct user_id column
DROP POLICY "Users can manage own transaction tags" ON transaction_tags;

CREATE POLICY "Users can manage own transaction tags"
  ON transaction_tags
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON COLUMN transaction_tags.user_id IS 'User ID for direct filtering in PowerSync sync rules';