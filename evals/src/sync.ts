/**
 * Pushes each suite's items.jsonl to its Langfuse dataset. Item ids are stable, so a rerun
 * updates items in place. Receipt images upload as Langfuse media.
 *   pnpm --filter @moni/evals sync [suite...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { LangfuseClient, LangfuseMedia } from '@langfuse/client';
import { loadEnv } from './env.ts';
import { datasetName, loadSuite, SUITES, suiteDir, type Suite, type SuiteItem } from './suites.ts';

const CONTENT_TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

function datasetInput(suite: Suite, item: SuiteItem): Record<string, unknown> {
  if (suite !== 'receipts') return item.input;
  const file = path.join(suiteDir(suite), String(item.input.image));
  return {
    ...item.input,
    image: new LangfuseMedia({
      source: 'bytes',
      contentBytes: fs.readFileSync(file),
      contentType: CONTENT_TYPES[path.extname(file).toLowerCase()] as 'image/jpeg',
    }),
  };
}

export async function syncSuite(langfuse: LangfuseClient, suite: Suite): Promise<number> {
  const name = datasetName(suite);
  const items = loadSuite(suite);
  try {
    await langfuse.api.datasets.get(name);
  } catch {
    await langfuse.api.datasets.create({
      name,
      description: `Moni ${suite} evals, built from evals/datasets/${suite}/items.jsonl`,
    });
  }
  let done = 0;
  for (const item of items) {
    await langfuse.dataset.createItem({
      datasetName: name,
      id: item.id,
      input: datasetInput(suite, item),
      expectedOutput: item.expected,
      metadata: item.metadata,
    });
    done++;
  }
  return done;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loadEnv();
  const suites = (process.argv.slice(2) as Suite[]).filter((s) => SUITES.includes(s));
  const langfuse = new LangfuseClient();
  for (const suite of suites.length ? suites : SUITES) {
    const count = await syncSuite(langfuse, suite);
    console.log(`${datasetName(suite)}: ${count} items synced`);
  }
}
