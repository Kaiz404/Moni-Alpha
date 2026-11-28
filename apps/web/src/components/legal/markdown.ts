import { SITE_FACTS, type SiteFactName } from '@/lib/site-facts';
import type { Block, Inline, LegalDoc, LegalSection } from './doc';

/**
 * Reads a legal document from `docs/legal/*.md`. The format is a small, strict subset of markdown, so the same
 * file reads well on GitHub and in a store listing: front matter with `updated: YYYY-MM-DD`, `# Title`, one
 * summary paragraph, then `## Heading {#id}` sections holding paragraphs, `### ` subheadings, `- ` lists and
 * pipe tables. Inline, `[text](href)` is a link and `{{name}}` a site fact. Anything else throws, so a typo
 * fails the build instead of reaching the page.
 */
export function parseLegalMarkdown(source: string, file = 'legal document'): LegalDoc {
  const fail = (message: string): never => {
    throw new Error(`${file}: ${message}`);
  };

  const front = /^---\n([\s\S]*?)\n?---\n/.exec(source) ?? fail('starts without front matter');
  const meta = new Map(
    front[1]!.split('\n').map((line) => {
      const [key, ...rest] = line.split(':');
      return [key!.trim(), rest.join(':').trim()] as const;
    }),
  );
  const updated = meta.get('updated') ?? fail('front matter has no `updated`');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(updated)) fail(`updated "${updated}" is not YYYY-MM-DD`);

  const chunks = source
    .slice(front[0].length)
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const titleChunk = chunks.shift() ?? fail('has no title');
  if (!titleChunk.startsWith('# ')) fail('the first line after the front matter is not `# Title`');
  const summaryChunk = chunks.shift() ?? fail('has no summary');
  if (summaryChunk.startsWith('#')) fail('has no summary paragraph under the title');

  const inline = (text: string): Inline[] => {
    const runs: Inline[] = [];
    let last = 0;
    for (const match of text.matchAll(/\{\{(\w+)\}\}|\[([^\]]+)\]\(([^)\s]+)\)/g)) {
      if (match.index > last) runs.push({ kind: 'text', text: text.slice(last, match.index) });
      if (match[1]) {
        if (!(match[1] in SITE_FACTS)) fail(`{{${match[1]}}} is not a site fact`);
        runs.push({ kind: 'fact', name: match[1] as SiteFactName });
      } else {
        runs.push({ kind: 'link', text: match[2]!, href: match[3]! });
      }
      last = match.index + match[0].length;
    }
    if (last < text.length) runs.push({ kind: 'text', text: text.slice(last) });
    return runs;
  };
  const oneLine = (lines: string) => lines.trim().split('\n').map((line) => line.trim()).join(' ');
  const cells = (row: string) =>
    row
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => inline(cell.trim()));

  const block = (chunk: string): Block => {
    if (chunk.startsWith('### ')) return { kind: 'h3', content: inline(chunk.slice(4)) };
    if (chunk.startsWith('#')) fail(`unexpected heading "${chunk.split('\n')[0]}"`);
    if (chunk.startsWith('- ')) {
      return { kind: 'ul', items: chunk.split(/^- /m).filter(Boolean).map((item) => inline(oneLine(item))) };
    }
    if (chunk.startsWith('|')) {
      const [head, rule, ...rows] = chunk.split('\n');
      if (!rule || !/^\|[\s|:-]+\|$/.test(rule.trim())) fail('a table has no `| --- |` rule under its head');
      return { kind: 'table', head: cells(head!), rows: rows.map(cells) };
    }
    if (/^[*_>`]|\*\*/.test(chunk)) fail(`unsupported markdown in "${chunk.slice(0, 40)}"`);
    return { kind: 'p', content: inline(oneLine(chunk)) };
  };

  const sections: LegalSection[] = [];
  for (const chunk of chunks) {
    const heading = /^## (.+) \{#([a-z0-9-]+)\}$/.exec(chunk);
    if (heading) {
      sections.push({ id: heading[2]!, heading: heading[1]!, blocks: [] });
      continue;
    }
    if (chunk.startsWith('## ')) fail(`section "${chunk}" has no {#id}`);
    const section = sections.at(-1) ?? fail('has text between the summary and the first section');
    (section.blocks as Block[]).push(block(chunk));
  }
  if (sections.length === 0) fail('has no sections');

  return { title: titleChunk.slice(2).trim(), summary: inline(oneLine(summaryChunk)), updated, sections };
}
