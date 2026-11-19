import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { affected, parseImports, resolveImport, tableAreas } from './affected.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TABLE = JSON.parse(readFileSync(join(ROOT, 'apps/mobile/scripts/device/areas.json'), 'utf8'));
const FLOW_AREAS = readdirSync(join(ROOT, 'apps/mobile/.maestro/flows')).filter((area) => area !== 'perf');

test('reads static, dynamic, side-effect and require imports, and re-exports', () => {
  const source = [
    "import { a } from '@/lib/a';",
    "import type { B } from '../b';",
    "import './side.css';",
    "export { c } from './c';",
    "const d = require('@/assets/d.png');",
    "const e = await import('@repo/core/ledger');",
    'import {\n  f,\n} from "react-native";',
  ].join('\n');
  assert.deepEqual(parseImports(source), [
    '@/lib/a',
    '../b',
    './side.css',
    './c',
    '@/assets/d.png',
    '@repo/core/ledger',
    'react-native',
  ]);
});

test('resolves relative paths, the @/ alias, index files, assets and @repo exports', () => {
  const files = new Set([
    'apps/mobile/lib/a.ts',
    'apps/mobile/components/b/index.tsx',
    'apps/mobile/components/ui/icon.android.tsx',
    'apps/mobile/assets/d.png',
    'packages/core/src/ledger.ts',
    'packages/core/src/money-month/index.ts',
    'packages/core/src/read.ts',
  ]);
  const packages = { core: { exports: { '.': './src/index.ts', './money-month': './src/money-month/index.ts' } } };
  const from = 'apps/mobile/app/(tabs)/index.tsx';
  assert.equal(resolveImport(from, '@/lib/a', files, packages), 'apps/mobile/lib/a.ts');
  assert.equal(resolveImport(from, '../../components/b', files, packages), 'apps/mobile/components/b/index.tsx');
  assert.equal(resolveImport(from, '@/components/ui/icon', files, packages), 'apps/mobile/components/ui/icon.android.tsx');
  assert.equal(resolveImport(from, '@/assets/d.png', files, packages), 'apps/mobile/assets/d.png');
  assert.equal(resolveImport(from, '@repo/core/money-month', files, packages), 'packages/core/src/money-month/index.ts');
  assert.equal(resolveImport(from, '@repo/core/ledger', files, packages), 'packages/core/src/ledger.ts');
  assert.equal(resolveImport('packages/core/src/ledger.ts', './read.js', files, packages), 'packages/core/src/read.ts');
  assert.equal(resolveImport(from, 'react-native', files, packages), null);
  assert.equal(resolveImport('apps/web/app/page.tsx', '@/lib/a', files, packages), null);
});

test('maps routes, flows and globals to areas', () => {
  const all = ['account', 'chat', 'home', 'nav', 'smoke'];
  assert.deepEqual(tableAreas('apps/mobile/app/chat/history.tsx', TABLE, all), ['chat']);
  assert.deepEqual(tableAreas('apps/mobile/app/(tabs)/index.tsx', TABLE, all), ['home', 'smoke']);
  assert.deepEqual(tableAreas('apps/mobile/.maestro/flows/chat/answer.yaml', TABLE, all), ['chat']);
  assert.deepEqual(tableAreas('apps/mobile/.maestro/flows/perf/zoom.yaml', TABLE, all), []);
  assert.deepEqual(tableAreas('apps/mobile/global.css', TABLE, all), all);
  assert.deepEqual(tableAreas('apps/mobile/README.md', TABLE, all), []);
  assert.deepEqual(tableAreas('apps/web/app/page.tsx', TABLE, all), []);
});

test('follows importers to the routes, skips layouts, and flags a change only pixels show', () => {
  const sources = new Map([
    ['apps/mobile/app/_layout.tsx', "import { Toast } from '@/components/ui/toast';"],
    ['apps/mobile/app/chat.tsx', "import { Bubble } from '@/components/chat/bubble';"],
    ['apps/mobile/app/(tabs)/index.tsx', "import { Ask } from '@/components/home/ask';"],
    ['apps/mobile/components/home/ask.tsx', "import { Bubble } from '../chat/bubble';"],
    ['apps/mobile/components/chat/bubble.tsx', "import Animated from 'react-native-reanimated';\nimport { money } from '@repo/types';"],
    ['apps/mobile/components/ui/toast.tsx', "import { Text } from 'react-native';"],
    ['packages/types/src/index.ts', ''],
    ['apps/web/app/page.tsx', "import { money } from '@repo/types';"],
  ]);
  const files = new Set([...sources.keys(), 'docs/ARCHITECTURE.md']);
  const packages = { types: { exports: { '.': './src/index.ts' } } };
  const allAreas = ['chat', 'home', 'nav', 'smoke'];
  const run = (changed) => affected({ changed, sources, files, packages, table: TABLE, allAreas });

  const bubble = run(['apps/mobile/components/chat/bubble.tsx']);
  assert.deepEqual(bubble.areas, ['chat', 'home', 'nav', 'smoke']);
  assert.deepEqual(bubble.pixels, ['chat', 'home', 'nav', 'smoke']);
  assert.deepEqual([...bubble.reasons], [['apps/mobile/components/chat/bubble.tsx', 'imports react-native-reanimated']]);

  const types = run(['packages/types/src/index.ts']);
  assert.deepEqual(types.areas, ['chat', 'home', 'nav', 'smoke']);
  assert.deepEqual(types.pixels, []);

  assert.deepEqual(run(['apps/mobile/components/ui/toast.tsx']).areas, []);
  assert.deepEqual(run(['apps/mobile/app/_layout.tsx']).areas, allAreas);
  assert.deepEqual(run(['docs/ARCHITECTURE.md', 'apps/web/app/page.tsx']).areas, []);
});

function routeFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? routeFiles(join(dir, entry.name)) : [relative(ROOT, join(dir, entry.name))],
  );
}

test('every route file has a row in areas.json, and every row names real areas', () => {
  const unmapped = routeFiles(join(ROOT, 'apps/mobile/app')).filter(
    (path) => !Object.keys(TABLE.areas).some((glob) => tableAreas(path, { areas: { [glob]: ['x'] } }, ['x']).length),
  );
  assert.deepEqual(unmapped, []);
  const unknown = Object.values(TABLE.areas)
    .flat()
    .filter((area) => area !== '*' && !FLOW_AREAS.includes(area));
  assert.deepEqual(unknown, []);
});
