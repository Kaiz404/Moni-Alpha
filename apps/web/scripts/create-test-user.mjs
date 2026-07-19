#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Creates a test user via Supabase Admin API (bypasses email rate limit).
 * Run from apps/web: pnpm run create-test-user
 * Or: node scripts/create-test-user.mjs [email] [password] [displayName]
 */

// Ensure this script only runs in Node.js environment
if (typeof process === 'undefined') {
  throw new Error('This script must be run in Node.js environment');
}

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
if (!existsSync(envPath)) {
  console.error('No .env found in apps/web');
  process.exit(1);
}
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
const secretKey = env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  console.error('Missing SUPABASE_SECRET_KEY or NEXT_PUBLIC_SUPABASE_URL in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });

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
}

await main();
