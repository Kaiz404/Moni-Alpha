# text

Typed sentences and on-device speech transcripts sent to `/v1/extract/text`. 78 items: 66 transactions (50 expense, 7 income, 9 transfer) and 12 that must be skipped. Rebuild with `node evals/scripts/build-text.mjs`. The script fetches LazyFinance at a pinned revision, checks its SHA-256, and has no randomness.

Every item sets `clientNow` to Wednesday 2026-11-18 19:30 in the region's time zone. `date` is labelled only when the input names a day: "yesterday" → 2026-11-17, "last friday" → 2026-11-13, "on monday" → 2026-11-16, "on the 1st" → 2026-11-01, "this morning"/"today" → 2026-11-18. `currency` is the region wallet's currency.

## Sources

| Source | Items | Gold | Licence | Trainable |
| --- | ---: | --- | --- | --- |
| `LazyFinance/ExpenseDataset:test_clean` | 14 | 11 ok, 3 skipped | CC-BY-4.0 | **no** |
| `LazyFinance/ExpenseDataset:test_apple_speech` | 14 | 12 ok, 2 skipped | CC-BY-4.0 | **no** |
| `moni-bench` | 11 | 10 ok, 1 skipped | own | yes |
| `moni-handwritten` | 39 | 33 ok, 6 skipped | own | yes |

- **LazyFinance/ExpenseDataset** v1.0.0, revision `e00137f`, <https://huggingface.co/datasets/LazyFinance/ExpenseDataset>, CC BY 4.0. These are English (`en-US`) rows from the two test splits. The card says "Never train on this split" for both, so `trainable` is false. `test_clean` rows were LLM-written and owner-reviewed (`synthetic: true`). `test_apple_speech` rows are real Apple Speech transcripts of the owner reading them (`synthetic: false`, tag `asr`). The two splits share row ids, so the clean and speech picks use disjoint ids and no expense appears twice. Region US.
- **moni-bench**: the 11 text cases in `apps/backend/internal/extract/bench_test.go`, region MY. `w-maybank`, `w-tng` and `w-cash` map to `w-my-bank`, `w-my-ewallet` and `w-my-cash`.
- **moni-handwritten**: across all 8 regions. Typed shorthand ("uber 23.40 amex"), speech-style transcripts (tag `asr`: no punctuation, numbers as words), slang (fiver, quid, bucks, 5k, 2.5k, 1.2 lakh), income, transfers between the region's own wallets, relative dates, and 6 non-transactions. Two of the non-transactions name an amount ("set a budget of 500 for food", "cancel netflix next month its 18.99 now").

Typed vs speech: 25 `asr` items (14 LazyFinance speech, 11 hand-written) and 53 typed.

## How LazyFinance labels were mapped and reviewed

The dataset labels `price`, `currency`, `item`, `place`, `paymentMethod` and `category`, and flags every row `needs_owner_review`. Each picked row was checked against its own transcript:

- `price` → `amount`. `currency` is USD. Rows with no expense map to `{status: "skipped"}`.
- `place` → `merchant` only when it is a real merchant named in the input: `Shell station` → `Shell`; `Regal Cinema`, `CVS Pharmacy`, `Olive Garden`, `Foot Locker`, `Coursera`, `Macy's`, `AMC Theatres`. Generic places (`deli`, `mall`, `pharmacy`, `dentist`) are dropped.
- `paymentMethod` → `walletId` only when the speaker says it ("using my credit card" → `w-us-credit`, the region's only credit card; "paid with cash" → `w-us-cash`). The dataset fills `paymentMethod` from the default even when nothing is said, as in rows 000001, 000009, 000027 and 000089. Those defaults were dropped.

Fixes against the dataset's labels:

- `speech-000015`: `place` is `airport`. The merchant is `Uber`.
- `speech-000011`: "on you to me" is Udemy misheard, and nothing in the transcript names it, so `merchant` is unscored. The amount and credit card stand.
- `speech-000143`: "Do you prefer what's $25 actually it was 23 $.50". The amount 23.50 is recoverable, but the dataset's `Uber` is not in the transcript, so `merchant` is unscored.
- `clean-000027`, `clean-000089`: "this morning" and "today" are labelled `date: 2026-11-18`.

Speech rows were left out where the transcript no longer supports the label's amount:

- 000031 and 000045: "8999" for $89.99.
- 000033: "1550" for $15.50.
- 000039: "3999".
- 000065: "1250" for 12.50.
- 000083: "worth 1000 and $200".
- 000148: "$200" for 1200.

Also excluded: pt-BR rows, and the en/pt code-switching rows, which are not English.

## Decisions to review

- `speech-000035` ("for 24 $.50") and `speech-000057` ("two dollars and 50 for abuse rate") keep the gold 24.50 and 2.50. A careful listener reads them that way.
- `text-au-pay-off-card` ("put 300 from commbank on my anz visa") is a `transfer` from bank to credit card: paying one's own card is not spending.
- `text-ph-send-to-mama` and `text-us-venmo-friend` are `expense`. Sending money to a person is not a transfer between the user's own wallets.
- `text-us-lunch-card` has no `walletId`. "card" could be the Chase debit card or the Amex.
