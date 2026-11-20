/**
 * Runs the eval suites against the real backend and records each as a Langfuse experiment.
 * Starts the backend's eval server (a local token, no rate limit), syncs the datasets, runs every
 * item through its route, scores it, and writes results/<run>.json next to a printed summary.
 *   pnpm --filter @moni/evals eval [suite...] [--model <openrouter id>] [--reasoning <effort>]
 *     [--name <run name>] [--no-sync] [--concurrency N]
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LangfuseClient, type Evaluation, type ExperimentItemResult, type LangfuseMediaReference } from '@langfuse/client';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { context, propagation } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { loadEnv } from './env.ts';
import { scoreChat, scoreExtraction, type ChatResponse, type ExtractResponse } from './scorers.ts';
import {
  datasetName,
  EVALS_DIR,
  REPO_DIR,
  ROUTES,
  SUITES,
  type ChatExpected,
  type ExtractionExpected,
  type Suite,
} from './suites.ts';
import { syncSuite } from './sync.ts';

loadEnv();

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const suites = SUITES.filter((s) => args.includes(s));
const selected = suites.length ? suites : SUITES;
const commit = execSync('git rev-parse --short HEAD', { cwd: REPO_DIR }).toString().trim();
const model =
  flag('--model') ??
  fs.readFileSync(path.join(REPO_DIR, 'apps/backend/internal/llm/models.go'), 'utf8').match(/const Model = "([^"]+)"/)?.[1];
const reasoning = flag('--reasoning');
const runName = flag('--name') ?? `${commit} ${model}`;
const concurrency = Number(flag('--concurrency') ?? 4);
const port = process.env.MONI_EVAL_PORT ?? '8787';
const baseURL = `http://127.0.0.1:${port}`;

const provider = new NodeTracerProvider({ spanProcessors: [new LangfuseSpanProcessor()] });
provider.register();
const langfuse = new LangfuseClient();

async function startBackend(tokenFile: string): Promise<ChildProcess> {
  const server = spawn('go', ['test', './cmd/server', '-run', 'TestEvalServer', '-count=1', '-v', '-timeout', '0'], {
    cwd: path.join(REPO_DIR, 'apps/backend'),
    env: {
      ...process.env,
      MONI_EVAL_SERVE: '1',
      MONI_EVAL_TOKEN_FILE: tokenFile,
      MONI_EVAL_PORT: port,
      MONI_EVAL_MODEL: flag('--model') ?? '',
      MONI_EVAL_REASONING: reasoning ?? '',
    },
    detached: true,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; i < 240; i++) {
    try {
      if ((await fetch(`${baseURL}/health`)).ok && fs.existsSync(tokenFile)) return server;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('eval server did not start within 2 minutes');
}

async function requestBody(suite: Suite, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (suite !== 'receipts') return input;
  const { image, ...rest } = input;
  return { ...rest, imageBase64: await (image as LangfuseMediaReference).fetchDataUri() };
}

function evaluate(suite: Suite) {
  return async ({ input, output, expectedOutput }: { input: any; output: any; expectedOutput?: any }): Promise<Evaluation[]> =>
    suite === 'chat'
      ? scoreChat(output as ChatResponse, expectedOutput as ChatExpected, input)
      : scoreExtraction(output as ExtractResponse, expectedOutput as ExtractionExpected);
}

type Row = {
  id: string;
  metadata: unknown;
  input: unknown;
  expected: unknown;
  output: unknown;
  scores: Record<string, number>;
  comments: Record<string, string>;
  traceId?: string;
};

function summarize(suite: Suite, rows: Row[]): void {
  const names = [...new Set(rows.flatMap((r) => Object.keys(r.scores)))];
  const mean = (rs: Row[], n: string) => {
    const vals = rs.map((r) => r.scores[n]).filter((v) => v !== undefined);
    return vals.length ? `${Math.round((100 * vals.reduce((a, b) => a + b, 0)) / vals.length)}% (${vals.length})` : '';
  };
  console.log(`\n${suite}: ${rows.length} items`);
  console.table(Object.fromEntries(names.map((n) => [n, { all: mean(rows, n) }])));
  const sources = [...new Set(rows.map((r) => (r.metadata as { source: string }).source))];
  console.table(
    Object.fromEntries(
      sources.map((s) => {
        const rs = rows.filter((r) => (r.metadata as { source: string }).source === s);
        return [s, Object.fromEntries(names.map((n) => [n, mean(rs, n)]))];
      }),
    ),
  );
}

async function runSuite(suite: Suite, token: string): Promise<Row[]> {
  if (!args.includes('--no-sync')) console.log(`${datasetName(suite)}: ${await syncSuite(langfuse, suite)} items synced`);
  const dataset = await langfuse.dataset.get(datasetName(suite));
  const result = await dataset.runExperiment({
    name: `moni ${suite}`,
    runName: `${runName} ${suite}`,
    description: `${suite} through ${ROUTES[suite]} on ${model} at ${commit}`,
    metadata: { model, reasoning: reasoning ?? 'off', commit, suite },
    maxConcurrency: concurrency,
    task: async ({ input }) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      propagation.inject(context.active(), headers);
      const res = await fetch(baseURL + ROUTES[suite], {
        method: 'POST',
        headers,
        body: JSON.stringify(await requestBody(suite, input as Record<string, unknown>)),
      });
      const body = await res.json();
      return res.ok ? body : { status: 'http_error', reason: `${res.status}: ${JSON.stringify(body)}` };
    },
    evaluators: [evaluate(suite)],
  });
  const rows = result.itemResults.map((r: ExperimentItemResult) => {
    const item = r.item as { id: string; metadata: unknown; input: Record<string, unknown> };
    const { image, snapshot, ...input } = item.input;
    return {
      id: item.id,
      metadata: item.metadata,
      input: image ? { ...input, image: '[media]' } : snapshot ? { ...input, snapshot: '[snapshot]' } : input,
      expected: r.expectedOutput,
      output: r.output,
      scores: Object.fromEntries(r.evaluations.map((e) => [e.name, Number(e.value)])),
      comments: Object.fromEntries(r.evaluations.filter((e) => e.comment).map((e) => [e.name, String(e.comment)])),
      traceId: r.traceId,
    };
  });
  summarize(suite, rows);
  if (result.datasetRunUrl) console.log(`Langfuse: ${result.datasetRunUrl}`);
  return rows;
}

const tokenFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'moni-eval-')), 'token');
const server = await startBackend(tokenFile);
const resultsDir = path.join(EVALS_DIR, 'results');
fs.mkdirSync(resultsDir, { recursive: true });
try {
  const token = fs.readFileSync(tokenFile, 'utf8');
  const all: Record<string, Row[]> = {};
  for (const suite of selected) all[suite] = await runSuite(suite, token);
  const out = path.join(resultsDir, `${runName.replace(/[^\w.-]+/g, '_')}.json`);
  fs.writeFileSync(out, JSON.stringify({ runName, commit, model, at: new Date().toISOString(), suites: all }, null, 2));
  console.log(`\nresults: ${path.relative(REPO_DIR, out)}`);
} finally {
  await provider.forceFlush();
  await provider.shutdown();
  if (server.pid) process.kill(-server.pid, 'SIGINT');
}
