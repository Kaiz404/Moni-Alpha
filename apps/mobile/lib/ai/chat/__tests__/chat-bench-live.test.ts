/**
 * Two halves of `pnpm --filter moni bench:chat:live`, each opt-in by env var so the default
 * jest run skips them. The Go side (`cmd/server/chat_bench_live_test.go`) answers the exported
 * questions through the real chat service in between.
 */
import fs from 'node:fs';
import { benchSnapshot, CHAT_BENCH_CASES, scoreReply } from '@/lib/ai/chat/bench/cases';

const exportPath = process.env.MONI_CHAT_BENCH_EXPORT;
const repliesPath = process.env.MONI_CHAT_BENCH_REPLIES;

(exportPath ? it : it.skip)('exports the questions and their snapshots for the live run', () => {
  const questions = CHAT_BENCH_CASES.map((c) => ({
    id: c.id,
    question: c.question,
    snapshot: benchSnapshot(c),
  }));
  fs.writeFileSync(exportPath!, JSON.stringify({ questions }));
});

(repliesPath ? it : it.skip)('scores the live replies', () => {
  const { replies } = JSON.parse(fs.readFileSync(repliesPath!, 'utf8')) as {
    replies: Record<string, { status: string; reply?: string; reason?: string }>;
  };
  const failures: string[] = [];
  for (const c of CHAT_BENCH_CASES) {
    const answer = replies[c.id];
    const issues =
      answer?.status === 'ok'
        ? scoreReply(c, benchSnapshot(c), answer.reply ?? '')
        : [`no reply (${answer?.status ?? 'missing'}: ${answer?.reason ?? ''})`];
    if (issues.length > 0)
      failures.push(`${c.id}: ${issues.join('; ')}\n    reply: ${answer?.reply}`);
  }
  const passed = CHAT_BENCH_CASES.length - failures.length;
  console.log(
    `live chat bench: ${passed}/${CHAT_BENCH_CASES.length} passed\n${failures.join('\n')}`,
  );
  expect(failures).toEqual([]);
});
