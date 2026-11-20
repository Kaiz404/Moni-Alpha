import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EVALS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_DIR = path.resolve(EVALS_DIR, '..');

export type Suite = 'text' | 'notifications' | 'receipts' | 'chat';
export const SUITES: Suite[] = ['text', 'notifications', 'receipts', 'chat'];

/** The backend route each suite exercises. */
export const ROUTES: Record<Suite, string> = {
  text: '/v1/extract/text',
  notifications: '/v1/extract/notification',
  receipts: '/v1/extract/image',
  chat: '/v1/chat/analyze',
};

export type ItemMetadata = {
  source: string;
  licence: string;
  trainable: boolean;
  synthetic: boolean;
  region: string;
  tags?: string[];
};

export type ExtractionExpected = {
  status: 'ok' | 'skipped';
  amount?: number;
  currency?: string;
  type?: 'expense' | 'income' | 'transfer';
  merchant?: string;
  date?: string;
  walletId?: string;
  toWalletId?: string;
  itemCount?: number;
};

export type ChatFact = { currency: string; path: string; value: number | string | boolean | null };
export type ChatExpected = { facts: ChatFact[]; refuse: boolean };

export type SuiteItem = {
  id: string;
  input: Record<string, unknown>;
  expected: ExtractionExpected | ChatExpected;
  metadata: ItemMetadata;
};

export const datasetName = (suite: Suite) => `moni-${suite}`;

export function suiteDir(suite: Suite): string {
  return path.join(EVALS_DIR, 'datasets', suite);
}

export function loadSuite(suite: Suite): SuiteItem[] {
  const file = path.join(suiteDir(suite), 'items.jsonl');
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line, i) => {
      const item = JSON.parse(line) as SuiteItem;
      if (!item.id || !item.input || !item.expected || !item.metadata) {
        throw new Error(`${file}:${i + 1} is missing id, input, expected or metadata`);
      }
      return item;
    });
}
