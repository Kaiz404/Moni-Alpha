# Supabase Setup Instructions

## Quick Setup (via Dashboard)

1. **Create Project**
   - Go to [Supabase Dashboard](https://app.supabase.com/)
   - Click "New Project"
   - Fill in project details
   - Wait for provisioning

2. **Run Migration**
   - In Supabase Dashboard, go to **SQL Editor**
   - Click "New Query"
   - Copy entire contents of `migrations/20260214000000_initial_schema.sql`
   - Paste and run

3. **Verify Setup**
   ```sql
   -- Check tables
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   
   -- Check RLS is enabled
   SELECT schemaname, tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   
   -- Check seed data
   SELECT COUNT(*) FROM categories WHERE user_id IS NULL;
   -- Should return 18 (13 expense + 5 income categories)
   ```

4. **Get API Keys**
   - Go to **Settings** → **API**
   - Copy:
     - Project URL
     - `anon` public key
     - `service_role` key (keep secret!)

5. **Configure Environment Variables**
   - Update `apps/web/.env.local`
   - Update `apps/mobile/.env`
   (See main README.md for details)

## Advanced Setup (via CLI)

### Install Supabase CLI

```bash
npm install -g supabase
```

### Link to Project

```bash
# From project root
supabase link --project-ref your-project-ref
```

### Apply Migrations

```bash
supabase db push
```

### Generate TypeScript Types

```bash
supabase gen types typescript --linked > apps/web/src/lib/database.types.ts
```

## Database Structure

### Tables Created
- `profiles` - User profiles
- `wallets` - Financial accounts
- `categories` - Transaction categories
- `tags` - User tags
- `transactions` - Financial transactions
- `transaction_tags` - Tag associations

### System Categories
18 default categories are seeded:
- 13 expense categories (Food, Transport, etc.)
- 5 income categories (Salary, Freelance, etc.)

### Row Level Security (RLS)
All tables have RLS enabled with policies ensuring users can only access their own data.

## Testing the Setup

### Create Test User

```sql
-- Via Supabase Dashboard → Authentication → Add User
-- Or use the auth API endpoints
```

### Insert Test Data

```sql
-- Insert profile
INSERT INTO profiles (id, display_name)
VALUES ('user-id-here', 'Test User');

-- Insert wallet
INSERT INTO wallets (user_id, name, type, color, icon, initial_balance)
VALUES ('user-id-here', 'Test Wallet', 'bank', '#0066FF', '🏦', 1000);

-- Query with RLS
SET request.jwt.claim.sub = 'user-id-here';
SELECT * FROM wallets;
```

## Troubleshooting

### RLS Not Working
```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Enable RLS if missing
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

### Missing System Categories
```sql
-- Re-run seed data from migration file
-- Or manually insert categories
```

### Migration Errors
- Ensure UUID extension is enabled
- Check for existing tables/types
- Run `DROP TABLE` commands if resetting

## Backup

Supabase provides automatic backups. For manual backups:

```bash
# Via CLI
supabase db dump -f backup.sql

# Restore
psql -h db.xxx.supabase.co -p 5432 -U postgres -d postgres -f backup.sql
```

## Storage (receipt images)

The mobile app uploads receipt images to a Storage bucket named **`receipts`** (path: `{userId}/{proposalId}.jpg`).

If you see **`Bucket not found`** in logs, apply the migration that creates the bucket and policies:

- `migrations/20260323000000_storage_receipts_bucket.sql`

Or in **Dashboard → Storage → New bucket**, create `receipts` (public read optional; policies in the migration restrict access by `auth.uid()` prefix).

## Next Steps

1. Configure API keys in apps
2. Test authentication flow
3. Create first wallet via web/mobile app
4. Verify RLS policies work
5. Test sync functionality
6. Apply storage migration if using receipt image uploads from mobile
