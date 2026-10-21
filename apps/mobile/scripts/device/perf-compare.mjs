#!/usr/bin/env node
// usage: perf-compare.mjs base.json head.json [--rule <metric>=<limit>]...
// A limit of N caps the head value, +N caps the increase, and +N% caps the
// increase relative to the base.
import { readFileSync } from 'node:fs';

const [basePath, headPath, ...rest] = process.argv.slice(2);
if (!basePath || !headPath || rest.length % 2 !== 0) {
  console.error('usage: perf-compare.mjs base.json head.json [--rule <metric>=<limit>]...');
  process.exit(2);
}

const rules = new Map();
for (let i = 0; i < rest.length; i += 2) {
  const match = rest[i] === '--rule' && /^(\w+)=(\+?)(\d+(?:\.\d+)?)(%?)$/.exec(rest[i + 1]);
  if (!match || (match[4] && !match[2])) {
    console.error(`bad rule ${rest[i]} ${rest[i + 1]}, want <metric>=N, +N, or +N%`);
    process.exit(2);
  }
  const [, metric, plus, amount, percent] = match;
  rules.set(metric, {
    text: `${plus}${amount}${percent}`,
    kind: percent ? 'percent' : plus ? 'increase' : 'ceiling',
    amount: Number(amount),
  });
}

const base = JSON.parse(readFileSync(basePath, 'utf8'));
const head = JSON.parse(readFileSync(headPath, 'utf8'));
const metrics = [...new Set([...Object.keys(base), ...Object.keys(head)])].filter(
  (m) => typeof base[m] === 'number' || typeof head[m] === 'number' || rules.has(m),
);

function passes(rule, b, h) {
  if (typeof h !== 'number') return false;
  if (rule.kind === 'ceiling') return h <= rule.amount;
  if (typeof b !== 'number') return false;
  if (rule.kind === 'increase') return h - b <= rule.amount;
  return b === 0 ? h <= 0 : ((h - b) / b) * 100 <= rule.amount;
}

let failed = false;
for (const m of metrics) {
  const b = base[m];
  const h = head[m];
  let line = `${m} base ${b ?? 'null'} head ${h ?? 'null'}`;
  if (typeof b === 'number' && typeof h === 'number') {
    const delta = h - b;
    const pct = b === 0 ? '' : ` (${delta >= 0 ? '+' : ''}${((delta / b) * 100).toFixed(1)}%)`;
    line += ` delta ${delta >= 0 ? '+' : ''}${Number(delta.toFixed(2))}${pct}`;
  }
  const rule = rules.get(m);
  if (rule) {
    const ok = passes(rule, b, h);
    failed ||= !ok;
    line += ` ${ok ? 'ok' : 'FAIL'} rule ${rule.text}`;
  }
  console.log(line);
}
process.exit(failed ? 1 : 0);
