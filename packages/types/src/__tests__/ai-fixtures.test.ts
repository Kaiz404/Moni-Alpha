import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ZodTypeAny } from 'zod';

import {
  extractImageWireRequestSchema,
  extractNotificationRequestSchema,
  extractResultSchema,
  extractTextRequestSchema,
} from '../ai';
import { chatAnalyzeRequestSchema, chatAnalyzeResultSchema } from '../chat';
import {
  autocompleteRequestSchema,
  autocompleteResultSchema,
  detailsRequestSchema,
  detailsResultSchema,
} from '../places';

/**
 * The golden fixtures of the AI wire contract. `apps/backend/internal/contract` decodes the same
 * files into the Go structs with unknown fields refused, so a field one side lacks fails a test.
 */
const dir = new URL('../../fixtures/ai/', import.meta.url);

const schemaOf: Record<string, ZodTypeAny> = {
  'extract-text-request': extractTextRequestSchema,
  'extract-image-request': extractImageWireRequestSchema,
  'extract-image-url-request': extractImageWireRequestSchema,
  'extract-notification-request': extractNotificationRequestSchema,
  'extract-result-ok': extractResultSchema,
  'extract-result-skipped': extractResultSchema,
  'extract-result-unavailable': extractResultSchema,
  'chat-analyze-request': chatAnalyzeRequestSchema,
  'chat-analyze-result-ok': chatAnalyzeResultSchema,
  'chat-analyze-result-unavailable': chatAnalyzeResultSchema,
  'places-autocomplete-request': autocompleteRequestSchema,
  'places-autocomplete-result-ok': autocompleteResultSchema,
  'places-autocomplete-result-unavailable': autocompleteResultSchema,
  'places-details-request': detailsRequestSchema,
  'places-details-result-ok': detailsResultSchema,
  'places-details-result-not-found': detailsResultSchema,
  'places-details-result-unavailable': detailsResultSchema,
};

const files = readdirSync(dir).filter((file) => file.endsWith('.json'));

describe('AI wire fixtures', () => {
  it('names a schema for every fixture file, and a file for every schema entry', () => {
    expect(files.map((file) => file.replace(/\.json$/, '')).sort()).toEqual(
      Object.keys(schemaOf).sort(),
    );
  });

  it.each(files)('%s parses with every key kept', (file) => {
    const raw: unknown = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    const schema = schemaOf[file.replace(/\.json$/, '')]!;
    // Zod drops keys a schema lacks, so equality fails when the fixture has a field TS doesn't know.
    expect(schema.parse(raw)).toEqual(raw);
  });
});
