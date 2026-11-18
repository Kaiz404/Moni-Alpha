#!/usr/bin/env node
// Proves the AI consent gate end to end on the dev project: the e2e user turns Moni's AI off, a
// refreshed token carries ai_consent false and a local backend answers 403; turned on, the claim
// is true and the backend answers 200. The rows it adds are deleted afterwards, which restores
// the user's consent exactly. Needs Go and apps/mobile/.env.e2e. Rerunnable.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eConfig, loadEnv } from '../../apps/mobile/scripts/e2e/seed.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const NOTICE_VERSION = '2026-11-19';
// A one-time code: the backend answers 200 skipped without ever calling the AI provider.
const OTP_ALERT = {
  notification: { packageName: 'com.maybank2u.life', title: 'Maybank2u', text: 'OTP 551203 for your RM 89.90 purchase.' },
  wallets: [],
};

const env = loadEnv();
const config = e2eConfig(env);
const publishable = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!publishable) throw new Error('set EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/mobile/.env');

function check(ok, message) {
  if (!ok) throw new Error(`FAILED: ${message}`);
  console.log(`ok  ${message}`);
}

async function call(url, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
}

const admin = (path, init = {}) => call(`${config.url}${path}`, { ...init, headers: { apikey: config.secret } });

async function token(grant, body) {
  const { status, json } = await call(`${config.url}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: publishable },
    body,
  });
  if (status !== 200) throw new Error(`${grant} grant failed with ${status}: ${JSON.stringify(json)}`);
  return json;
}

function claimOf(accessToken) {
  const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'));
  return 'ai_consent' in payload ? payload.ai_consent : 'none';
}

async function startBackend(port) {
  // Built, not `go run`: killing `go run` would leave the server it started running.
  const binary = join(mkdtempSync(join(tmpdir(), 'moni-backend-')), 'server');
  execFileSync('go', ['build', '-o', binary, './cmd/server'], { cwd: join(ROOT, 'apps/backend'), stdio: 'inherit' });
  const server = spawn(binary, [], {
    env: {
      ...process.env,
      PORT: String(port),
      SUPABASE_URL: config.url,
      OPENROUTER_API_KEY: 'unused-by-this-check',
      GIN_MODE: 'release',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let log = '';
  server.stderr.on('data', (chunk) => (log += chunk));
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`backend exited: ${log.slice(-500)}`);
    const health = await call(`http://127.0.0.1:${port}/health`).catch(() => null);
    if (health?.json?.authKeys === 'loaded') return server;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  server.kill();
  throw new Error(`backend never loaded its auth keys: ${log.slice(-500)}`);
}

const { json: users } = await admin(`/auth/v1/admin/users?per_page=200`);
const user = users.users.find((u) => u.email?.toLowerCase() === config.email);
if (!user) throw new Error(`no user ${config.email}, run apps/mobile/scripts/e2e/seed.mjs --reset first`);

const { json: newest } = await admin(`/rest/v1/ai_consents?user_id=eq.${user.id}&select=id&order=id.desc&limit=1`);
const lastIdBefore = newest[0]?.id ?? 0;
const port = 18000 + Math.floor(Math.random() * 1000);
const backend = await startBackend(port);
console.log(`backend on :${port}, e2e user ${user.id}`);

let session = await token('password', { email: config.email, password: config.password });
const claimBefore = claimOf(session.access_token);
console.log(`claim before: ai_consent=${claimBefore}`);

try {
  for (const granted of [false, true]) {
    const insert = await call(`${config.url}/rest/v1/ai_consents`, {
      method: 'POST',
      headers: { apikey: publishable, Authorization: `Bearer ${session.access_token}`, Prefer: 'return=minimal' },
      body: { user_id: user.id, use: 'all', granted, notice_version: NOTICE_VERSION },
    });
    check(insert.status === 201, `the user records Moni's AI ${granted ? 'on' : 'off'} (${insert.status})`);
    session = await token('refresh_token', { refresh_token: session.refresh_token });
    check(claimOf(session.access_token) === granted, `a refreshed token carries ai_consent=${granted}`);
    const answer = await call(`http://127.0.0.1:${port}/v1/extract/notification`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: OTP_ALERT,
    });
    if (granted) check(answer.status === 200, `the backend serves the AI route: ${answer.status} ${JSON.stringify(answer.json)}`);
    else
      check(
        answer.status === 403 && typeof answer.json?.error === 'string',
        `the backend refuses the AI route: ${answer.status} ${JSON.stringify(answer.json)}`,
      );
  }
  const backdated = await call(`${config.url}/rest/v1/ai_consents`, {
    method: 'POST',
    headers: { apikey: publishable, Authorization: `Bearer ${session.access_token}`, Prefer: 'return=minimal' },
    body: { user_id: user.id, use: 'all', granted: true, notice_version: NOTICE_VERSION, created_at: '2020-01-01T00:00:00Z' },
  });
  check(backdated.status >= 400, `a client cannot set the consent time (${backdated.status})`);
} finally {
  await admin(`/rest/v1/ai_consents?user_id=eq.${user.id}&id=gt.${lastIdBefore}`, { method: 'DELETE' });
  backend.kill();
}

session = await token('refresh_token', { refresh_token: session.refresh_token });
check(claimOf(session.access_token) === claimBefore, `consent restored: ai_consent=${claimOf(session.access_token)}`);
console.log('ai-consent live passed');
