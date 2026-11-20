# AI eval baseline and cheaper models (November 2026)

This page records the first run of the AI eval suites (`evals/`) on 2026-11-20 and what it says about Moni's AI. It answers three questions:

- How accurate are text, notification, receipt and chat answers on the production model?
- Which failures are the model's, and which come from the code or the labels?
- Which cheaper models are worth switching to?

The runs are Langfuse experiments in the JP project (Experiments, datasets `moni-text`, `moni-notifications`, `moni-receipts`, `moni-chat`). Code observations describe commit `84757226`. The runner and the scores are explained in [`evals/README.md`](../../evals/README.md).

## Setup

| Suite | Cases | Sources |
| --- | --- | --- |
| Text (typed and Say it transcripts) | 78 | LazyFinance ExpenseDataset test splits (28, half real Apple speech output), hand-written cases across 8 English markets (39), the old bench (11) |
| Notifications | 96 | Synthetic alerts from 22 apps in 8 countries (45), hand-written negatives (17), UCI SMS Spam (10), finnai negatives (5), the old bench and one-time codes (19) |
| Receipts | 65 | SROIE (27, Malaysian scans), synthetic English receipts from 7 countries (20), CORD v2 (10, Indonesian), the old bench (5), not-a-receipt images (3) |
| Chat | 57 | The chat bench (32), multi-turn follow-ups (10), CLINC150 out-of-scope questions (15) |

Agents wrote the expected answers and checked them against the inputs. Treat a one- or two-case difference as noise: each suite has 57 to 96 cases.

## Baseline: `deepseek/deepseek-v4.1-flash`

| Suite | Accuracy | p50 (p95) latency | Cost per 1,000 calls |
| --- | --- | --- | --- |
| Text | amount, type, merchant, wallet and date 100%; transaction or not 99% | 1.1s (2.3s) | $0.17 |
| Notifications | transaction or not 100%; every field right 97% | 0.9s (1.9s) | $0.13 |
| Receipts | amount 92%, merchant 94%, date 92%, item count 96%; every field but currency 88% | 1.3s (1.8s) | $0.27 |
| Chat | all checks 86%, grounded 98%, out-of-scope declined 15 of 15 | 0.9s (1.7s) | $0.32 |

### Findings

1. **Currency for text and receipts is a placeholder, so its score (79% text, 6% receipts) is not a model error.** The backend returns `USD` when no wallet is named, and the app replaces it with the currency of the wallet the proposal lands in (`apps/mobile/lib/ai/run-extraction.ts`). For a user in their home currency the app gets it right. The real gap is that a currency the user states, such as "€", "rupees", "rm 59" or a receipt from a trip abroad, is dropped, so foreign spending is saved in the default wallet's currency.
2. **About 5% of receipts fail with `unavailable` (3 of 65).** The model returned the amount as a string (`"58.57"`), the backend could not decode it, and receipts, unlike text and notifications, do not retry. The app's queue retries, so nothing is lost, but each failure costs a round trip.
3. **Receipt misreads.**
   - Indonesian `48.000` was read as 48 (2 of 10 CORD receipts). Any market that writes 1.234,56 is exposed.
   - A Malaysian `04/01/2018` was read as 1 April.
   - A product photo was extracted as a transaction.
   - One item count was off by one.
4. **Notifications fail only where the label is a judgement call.**
   - ATM withdrawals are labelled as transfers to cash, but the notification prompt can return only income or expense.
   - A Monzo "€45.20 (£39.31)" came back as the £39.31 that left the account, against a EUR label.

   All 42 non-transactions (one-time codes, promos, spam, failed payments) were skipped.
5. **Chat quotes correct numbers, but not always the one a case pins.** Most `facts_quoted` misses cite another snapshot field, for example category amounts instead of the share of budget.
   - The one `grounded` miss repeats RM800 from an earlier turn: the check reads only the current message, so it is the check's fault.
   - "Is rent going to blow up my month?" is labelled as a decline but got a reasonable answer.
6. **Chat is the most expensive call** because each request sends about 4,400 input tokens of snapshot.

## Cheaper models

Research on 2026-11-20 against OpenRouter's live API listed models that accept images, have a zero-data-retention (ZDR) endpoint with JSON mode, and cost less than the production model. Only models cheaper than the production model are considered.

| Model | Open weights | Price on the cheapest ZDR host ($ per 1M in / out) | Note |
| --- | --- | --- | --- |
| `deepseek/deepseek-v4.1-flash` (production) | MIT | 0.051 / 0.567 | |
| `deepseek/deepseek-v4.1-flash-1017` | MIT | 0.030 / 0.25 (flex tier), 0.036 / 0.50 | newer snapshot of the production model |
| `z-ai/glm-5.3-flash` | MIT | 0.042 / 0.184 | refuses reasoning off; runs at `minimal` effort |
| `google/gemma-4-26b-a4b-it` | Apache-2.0 | 0.06 / 0.33 | few tokens per image |
| `tencent/hy4-flash` | Tencent licence | 0.035 / 0.14 | released 2026-11-16, one host |

The Qwen Flash models tried in October no longer have a ZDR endpoint. Gemini Flash-Lite is listed only under OpenRouter's Safety Retention tier, which is not strict ZDR. OpenRouter's `/api/v1/endpoints/zdr` list is the authority for what `provider.zdr: true` routes to.

### Results

Each model ran every suite once on 2026-11-20 through the eval server's model switch (`--model`), with OpenRouter's default routing among ZDR hosts. Text and receipts are scored on every field but currency (finding 1). Chat `pass` re-counts declines with curly apostrophes read as straight ones (see Eval issues).

| Model | Text | Notifications | Receipts | Chat | Receipts `unavailable` |
| --- | --- | --- | --- | --- | --- |
| `deepseek-v4.1-flash` (production) | 99% | 97% | 88% | 86% | 3 |
| `deepseek-v4.1-flash-1017` | 99% | 97% | 91% | 88% | 1 |
| `tencent/hy4-flash` | 96% | 97% | 86% | 84% | 0 |
| `google/gemma-4-26b-a4b-it` | 97% | 97% | 78% | 74% | 0 |
| `z-ai/glm-5.3-flash` (minimal reasoning) | 97% | 86% | 86% | 75% | 0 |

Cost per 1,000 calls, and p50 / p95 latency, measured from the Langfuse traces:

| Model | Text | Notifications | Receipts | Chat |
| --- | --- | --- | --- | --- |
| `deepseek-v4.1-flash` | $0.17, 1.1s / 2.3s | $0.13, 0.9s / 1.9s | $0.27, 1.3s / 1.8s | $0.32, 0.9s / 1.7s |
| `deepseek-v4.1-flash-1017` | $0.15, 1.2s / 2.3s | $0.12, 1.0s / 1.7s | $0.22, 1.7s / 2.6s | $0.36, 1.1s / 2.3s |
| `tencent/hy4-flash` | $0.06, 1.6s / 5.7s | $0.04, 1.7s / 7.6s | $0.08, 2.7s / 9.8s | $0.15, 1.8s / 6.5s |
| `google/gemma-4-26b-a4b-it` | $0.17, 2.0s / 4.9s | $0.09, 1.3s / 3.3s | $0.16, 2.1s / 4.5s | $0.39, 1.5s / 3.7s |
| `z-ai/glm-5.3-flash` | $0.20, 1.6s / 3.3s | $0.12, 1.1s / 3.4s | $0.32, 1.9s / 5.5s | $0.44, 1.5s / 3.7s |

- **`deepseek-v4.1-flash-1017` is the only drop-in.** It matches or beats production on every suite (receipts 91% against 88%, one `unavailable` against three) and costs 6 to 20% less on extraction, but about 10% more on chat and runs 0.1 to 0.4s slower at the median. The halved price the research found is on a flex-tier host that default routing did not pick; reaching it needs `provider.sort: "price"` and a run that measures its queueing.
- **`tencent/hy4-flash` costs a third to a quarter as much** with close accuracy, identical on notifications. Its tail is slow (p95 5.7 to 9.8s) on its single host, it was four days old, and text dates dropped to 88%. Notifications run in the background, where latency matters least, so it fits that route best; using it means giving up one model for every flow.
- **Gemma 4 and GLM 5.3 are out.** Default routing made neither cheaper than production in practice, Gemma's receipts fell to 78%, and GLM, which needs reasoning on, lost merchants on notifications (81%).

## Eval issues found by these runs

These are faults in the evals, not the models. They are recorded here, not yet fixed.

- The refusal check matches only a straight apostrophe, so "can’t" counts as not declining. It hid 18 of hy4-flash's declines.
- The chat grounding check reads only the current message, so a number from an earlier turn counts as ungrounded.
- Text and receipt `currency` scores the backend's placeholder instead of the currency the app saves (finding 1).
- Some labels are judgement calls that the prompt can't meet (ATM withdrawals as transfers) or that a model can fairly dispute (Monzo's settled pounds, "Is rent going to blow up my month?").
