import fs from 'node:fs';
import path from 'node:path';
import { REPO_DIR } from './suites.ts';

/** Reads the backend's .env, which holds the Langfuse and OpenRouter keys, without overriding the shell. */
export function loadEnv(): void {
  const file = path.join(REPO_DIR, 'apps/backend/.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  process.env.LANGFUSE_BASE_URL ??= 'https://jp.cloud.langfuse.com';
  process.env.LANGFUSE_TRACING_ENVIRONMENT = 'eval';
}
