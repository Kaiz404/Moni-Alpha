# Moni AI evals

Labelled cases for each AI feature, run against the real backend and recorded as [Langfuse](https://jp.cloud.langfuse.com) experiments. Use them to compare a prompt or model change against the last run before it ships.

| Suite | Route | Dataset |
| --- | --- | --- |
| `text` | `/v1/extract/text` (typed text and Say it transcripts) | `moni-text` |
| `notifications` | `/v1/extract/notification` | `moni-notifications` |
| `receipts` | `/v1/extract/image` | `moni-receipts` |
| `chat` | `/v1/chat/analyze` | `moni-chat` |

## Run

Needs Go, Node 22 and `apps/backend/.env` with `OPENROUTER_API_KEY` and the Langfuse keys.

```bash
pnpm --filter @moni/evals eval                      # every suite
pnpm --filter @moni/evals eval receipts chat        # some suites
pnpm --filter @moni/evals eval --name "prompt v2"   # name the run
pnpm --filter @moni/evals eval --model z-ai/glm-5.3-flash --reasoning minimal   # another model
pnpm --filter @moni/evals sync                      # push datasets to Langfuse without running
```

`eval` starts the backend's eval server (`TestEvalServer` in `apps/backend/cmd/server/eval_server_test.go`: a local sign-in key, no rate limit, the model in `internal/llm/models.go` unless `--model` names another OpenRouter id; `--reasoning` turns reasoning on at that effort for models that refuse it off), syncs each `datasets/<suite>/items.jsonl` to its Langfuse dataset, sends every item to its route, and scores the response. Each suite becomes one experiment run named `<commit> <model> <suite>`. The backend's own spans nest inside each item's trace, so a failing item shows the prompt and raw model output. It prints a summary per score and per source and writes `results/<run>.json` (gitignored).

Compare runs in Langfuse under **Experiments**: pick the baseline run, add the new one, and filter by a score.

## Scores

Extraction suites score each labelled field on its own, as 1 or 0: `status` (transaction or skipped), `amount` (within 1 cent), `currency`, `type`, `merchant` (fuzzy: shared words, company suffixes ignored), `date`, `wallet`, `to_wallet`, `item_count`. `exact` is 1 when every labelled field is right. A field missing from `expected` is not scored.

Chat scores reuse the chat bench's checks (`apps/mobile/lib/ai/chat/bench/grounding.ts`): `grounded` (every number comes from the snapshot or the question), `facts_quoted` (the pinned facts appear), `concise` (90 words or fewer), `no_internal_names`, `declined` (only for items the app should refuse), and `pass` when all hold.

## Datasets

`datasets/SCHEMA.md` defines an item. Each suite folder has a README with its sources, counts and licences, and `scripts/build-<suite>.mjs` regenerates its `items.jsonl`. Every item's metadata names its source, licence, whether it may be used for fine-tuning (`trainable`) and whether it is synthetic, so results can be read per slice. Synthetic items have exact labels by construction but overstate real accuracy; read them apart from real ones.

Add a case by editing the build script or appending a line that follows the schema, then rerun `sync`. Labels written by a model are not ground truth: check each against its input before it lands.
