/**
 * The bridge python/catart.py calls: `node scripts/call.ts '["figure", "happy", "deep", {}]'` prints
 * the function's result as JSON, and `'["constants"]'` prints every exported constant. JSON null
 * arguments arrive as undefined, so Python's None picks the default as it did in catart.py.
 */
import * as cat from '../src/cat.ts';

const CALLS = [
  'figure',
  'catSvg',
  'monoFigure',
  'catMonoSvg',
  'wordmarkHtml',
  'lockupHtml',
  'earBase',
];

const exports: Record<string, unknown> = cat;
const [name, ...args] = JSON.parse(process.argv[2] ?? '[]', (_key, value) =>
  value === null ? undefined : value,
) as [string, ...unknown[]];

let result: unknown;
if (name === 'constants') {
  result = Object.fromEntries(
    Object.entries(exports).filter(([, value]) => typeof value !== 'function'),
  );
} else if (CALLS.includes(name)) {
  result = (exports[name] as (...a: unknown[]) => unknown)(...args);
} else {
  console.error(`unknown call ${name}; expected constants or one of ${CALLS.join(', ')}`);
  process.exit(2);
}
process.stdout.write(JSON.stringify(result));
