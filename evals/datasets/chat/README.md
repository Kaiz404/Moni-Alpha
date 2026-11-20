# chat

Questions for `POST /v1/chat/analyze`, in the format in `../SCHEMA.md`. English only. 57 items.

| Source | Items | Licence | What it covers |
| --- | --- | --- | --- |
| `moni-bench` | 32 | own | Every case in `apps/mobile/lib/ai/chat/bench/cases.ts`, with the snapshot `fixture.ts` builds for it and the case's `facts` and `refuse` |
| `moni-handwritten` | 10 | own | Follow-ups (`multi-turn` tag) with 1 or 2 prior exchanges in `history`. Each prior assistant turn quotes only snapshot values |
| `clinc150` | 15 | CC BY 3.0 | 11 `oos_test` queries with nothing to do with money (tag `general`), and 4 banking requests from `test` that Moni cannot carry out: freeze an account, report fraud, pay a bill, report a lost card (tag `banking-action`). All expect `refuse: true` and use the default snapshot |

The snapshots are synthetic. They come from the bench fixture, dated 12 October 2026, with MYR, SGD and USD wallets. A follow-up uses the snapshot the app would send for that message. The app reads the asked amount from the current message only, so "so can I afford it?" gets the default snapshot with no `afford` block, while "and what about RM9000?" gets the `afford-too-much` case's snapshot.

CLINC150: Larson et al., "An Evaluation Dataset for Intent Classification and Out-of-Scope Prediction", EMNLP 2019, <https://github.com/clinc/oos-eval>, licensed under CC BY 3.0. The rows are copied verbatim.

## Rebuild

```sh
node evals/scripts/build-chat.mjs             # from the vendored sources/moni-bench.json
node evals/scripts/build-chat.mjs --refresh   # re-export the bench through Jest, check CLINC rows upstream
```

`--refresh` runs Jest in `MONI_MOBILE_DIR`, which defaults to `apps/mobile` in this checkout and needs `node_modules`. It writes nothing under `apps/`. The build fails if a pinned fact no longer matches its snapshot.
