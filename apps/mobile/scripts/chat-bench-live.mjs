// Live chat bench: export the fixture questions, answer them through the Go chat service
// against the real model, then score the replies. Needs apps/backend/.env with OPENROUTER_API_KEY.
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mobile = path.resolve(import.meta.dirname, '..');
const backend = path.resolve(mobile, '../backend');
const dir = mkdtempSync(path.join(tmpdir(), 'moni-chat-bench-'));
const input = path.join(dir, 'questions.json');
const output = path.join(dir, 'replies.json');
const run = (cwd, cmd, args, env) =>
  execFileSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
const jest = (env, name) =>
  run(
    mobile,
    'npx',
    [
      'jest',
      '--runInBand',
      'lib/ai/chat/__tests__/chat-bench-live.test.ts',
      '-t',
      name,
    ],
    env,
  );

jest({ MONI_CHAT_BENCH_EXPORT: input }, 'exports');
run(
  backend,
  'pnpm',
  [
    'exec',
    'dotenv',
    '-e',
    '.env',
    '--',
    'go',
    'test',
    './cmd/server',
    '-run',
    'LiveChatBench',
    '-count=1',
    '-v',
  ],
  {
    MONI_LIVE_TESTS: '1',
    MONI_CHAT_BENCH_IN: input,
    MONI_CHAT_BENCH_OUT: output,
  },
);
jest({ MONI_CHAT_BENCH_REPLIES: output }, 'scores');
