-- Seed visual demo transactions for Touch n Go wallets
-- Adds 160 transactions per user under a Touch n Go wallet (creates wallet if missing)

DO $$
DECLARE
  rec RECORD;
  w_id UUID;
  cat_ids UUID[];
  cat_count INT;
  chosen_cat UUID;
  tx_type TEXT;
  amt NUMERIC(12,2);
  days_ago INT;
  tx_date TIMESTAMPTZ;
  i INT;
  metadata JSONB := jsonb_build_object('seedSource', 'visual-seed-sql');
BEGIN
  -- Gather category ids for expense categories excluding "Other"
  SELECT array_agg(id) INTO cat_ids FROM categories WHERE type = 'expense' AND name NOT ILIKE '%other%';
  IF cat_ids IS NULL OR array_length(cat_ids, 1) = 0 THEN
    SELECT array_agg(id) INTO cat_ids FROM categories WHERE type = 'expense';
  END IF;
  cat_count := COALESCE(array_length(cat_ids, 1), 0);

  FOR rec IN SELECT id AS user_id FROM auth.users LOOP
    -- Find or create Touch n Go wallet for this user
    SELECT id INTO w_id FROM wallets WHERE user_id = rec.user_id AND LOWER(name) IN ('touch n go', 'touch n go wallet') LIMIT 1;
    IF w_id IS NULL THEN
      INSERT INTO wallets (user_id, name, type, currency, initial_balance, color, icon)
      VALUES (rec.user_id, 'Touch n Go', 'ewallet', 'USD', 100, '#f59e0b', 'credit-card')
      RETURNING id INTO w_id;
    END IF;

    -- Insert 160 random transactions for visual demo
    FOR i IN 1..160 LOOP
      -- pick a random category
      IF cat_count > 0 THEN
        chosen_cat := cat_ids[(floor(random() * cat_count)::int % cat_count) + 1];
      ELSE
        chosen_cat := NULL;
      END IF;

      -- mostly expenses, small chance of income
      IF random() < 0.15 THEN
        tx_type := 'income';
      ELSE
        tx_type := 'expense';
      END IF;

      amt := (3 + floor(random() * 200))::numeric;
      days_ago := floor(random() * 90)::int;
      tx_date := NOW() - (days_ago || ' days')::interval - (floor(random() * 86400) || ' seconds')::interval;

      INSERT INTO transactions (
        id, user_id, wallet_id, amount, type, category_id, transfer_to_wallet_id, linked_transaction_id,
        description, merchant, notes, transaction_date, location_latitude, location_longitude, location_name,
        receipt_image_url, metadata
      ) VALUES (
        uuid_generate_v4(), rec.user_id, w_id, amt, tx_type::transaction_type, chosen_cat, NULL, NULL,
        CONCAT('Visual seed txn ', i), CONCAT('Merchant ', (floor(random()*40)+1)::int), 'Seeded for visual chart demo', tx_date,
        NULL, NULL, NULL, NULL, metadata
      );
    END LOOP;
  END LOOP;
END$$;
