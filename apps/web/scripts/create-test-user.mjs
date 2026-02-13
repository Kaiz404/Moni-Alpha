#!/usr/bin/env node
/**
 * Creates a test user via Supabase Admin API (bypasses email rate limit).
 * Run from apps/web: pnpm run create-test-user
 * Or: node scripts/create-test-user.mjs [email] [password] [displayName]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [key, ...rest] = line.split('=');
      return [key.trim(), rest.join('=').trim().replace(/^["']|["']$/g, '')];
    })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const email = process.argv[2] || `test-${Date.now()}@example.com`;
const password = process.argv[3] || 'Test1234';
const displayName = process.argv[4] || 'Test User';

async function main() {
  console.log('Creating test user:', { email, displayName });
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error) {
    if (error.message.includes('already been registered')) {
      console.log('User already exists. You can login with:', email, password);
      process.exit(0);
    }
    console.error('Error:', error.message);
    process.exit(1);
  }

  // Create profile
  await supabase.from('profiles').upsert({
    id: data.user.id,
    display_name: displayName,
    preferences: { currency: 'USD', theme: 'system', notifications_enabled: true },
  }, { onConflict: 'id' });

  console.log('User created successfully!');
  console.log('Email:', email);
  console.log('Password:', password);
  console.log('');
  console.log('Run: ./scripts/test-api.sh');
  console.log('Or: TEST_EMAIL=' + email + ' ./scripts/test-api.sh');
}

main();
