import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../../../', import.meta.url);

describe('generated database types', () => {
  it('were generated after the newest migration', () => {
    const newest = readdirSync(new URL('supabase/migrations/', root)).sort().at(-1);
    const header = readFileSync(new URL('packages/types/src/database.ts', root), 'utf8').split('\n')[1];
    expect(header).toBe(`// Latest migration: ${newest}`);
  });
});
