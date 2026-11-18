# Domain logic in `apps/mobile/lib`: what can move to a shared package

Read-only exploration, 2026-11-19, at `1e67703`. Goal: find the domain logic the desktop web app (`apps/web`, Next.js 16) would otherwise rebuild, and the friction in moving it.

Method: every non-test file under `apps/mobile/lib` was classified by its **transitive** imports. A file is "pure" only if nothing it reaches imports React Native, Expo, MMKV, Legend-State, Supabase JS, React, `@/components`, `@/hooks` or `@/modules`. Line counts exclude tests. "Tests" counts the `__tests__` files that cover the module.

## Headline

- About **9,000 lines of pure domain TypeScript** already exist in `lib/finance`, `lib/reports`, `lib/ai/facts`, `lib/ai/insights`, `lib/ai/snapshot`, `lib/dates`, `lib/transactions/list-scope`, `lib/capture/*` (parsers) and `lib/ai/{routine,duplicates,money-movement,institutions}`. Most of it is tested, and **the tests are pure as well**: of the 34 test files that cover these modules, only `prefetch-location.test.ts` (expo-location) and `row.test.ts` (renders a component) touch the platform.
- The best part is that `buildBudgetMonth`, `summarizeDebts`, `selectUpcomingBills`, `buildReport`, `flowSeries`, `spendIndex`, `balanceIndex` and `chartTicks` are already deep modules that take plain arrays. The web can call them on rows read from Supabase.
- The worst part is that **the rules are deep, but assembling their inputs and some of the rules themselves are spread across hooks, components and Legend `computed` selectors**. These rules are "what counts as spend", even pace, safe to spend a day, debt balance, month and day keys, and the glossary sentences. The web would copy those, and some copies already disagree with each other (see Friction 1–4).
- `packages/types` holds Zod schemas and money arithmetic, but has **no test runner**. It also carries **dead schemas** (`analytics.ts`: `OverviewStats` and the rest have no importer in mobile, and only web's old `use-overview-stats.ts` uses `OverviewStatsResponse`). Its `exports` map lists only 7 of 18 files. It does not have the domain model (`FinanceTransaction` and the rest) that the pure modules actually use.

## Module table

Verdicts: **move**: move to the shared package as is, apart from import paths. **split**: pure core plus a platform **adapter**, with the **seam** at the named point. **stays**: inherently mobile.

### Finance read model and money

| Path (lib/) | Pure or platform | Depends on | Lines | Tests | Verdict |
|---|---|---|---|---|---|
| finance/types.ts | pure | @repo/types | 121 | (via others) | **move**. This is the real domain model (`FinanceTransaction`, `FinanceWallet` and the rest) and belongs beside the Zod schemas |
| finance/adapters.ts | pure | money, types | 235 | adapters, transaction-metadata | **move**. A Supabase row becomes a domain entity. The web needs exactly this on rows from `@supabase/ssr` |
| finance/money.ts | pure | @repo/types | 32 | money | **move**. Merge `parseAmountInput`, `normalizeCurrency` and `PLAN_LIMIT_MINOR` into `@repo/types/money` |
| finance/format-money.ts | pure | @repo/types | 55 | format-money | **move**. The glossary money format (`RM1,116.20`, U+2212, `whole`) |
| finance/ledger.ts | pure | types | 35 | (via selectors) | **move** (wallet delta, debt balance) |
| finance/dates.ts | pure | — | 20 | none | move or delete. A timezone-explicit month and day key that only `ai/chat/sessions` and `selectors.budgetProgress$` use |
| finance/budget-month.ts | pure | format-money, types | 442 | budget-month | **move**. Spend, even pace, bills due, left this month, per day, merchants, slices |
| finance/bills.ts | pure | ai/facts/days, ai/facts/recurring | 138 | bills | **move** (with ai/facts) |
| finance/debt-summary.ts | pure | dates/local-date-input | 123 | debt-summary | **move** |
| finance/spent-summary.ts, budget-note.ts | pure | budget-month, format-money | 75 | budget-note | **move**, but merge with the copies (Friction 3) |
| finance/activity-filter.ts, activity-series.ts | pure | dates, budget-month | 256 | activity-filter, activity-series, activity-cost | **move** |
| finance/flow-series.ts, flow-geometry.ts | pure | reports/report, budget-month | 244 | flow-series | **move** series. Geometry is SVG maths and moves only if web charts share it |
| finance/spend-history.ts, balance-history.ts | pure | chart-range, ledger | 229 | spend-history, balance-history | **move** |
| finance/chart-range.ts, chart-ticks.ts | pure | dates | 130 | chart-range, chart-ticks | **move** (ranges and axis labels are design-system rules) |
| finance/calendar-heat.ts | pure | @repo/types | 46 | calendar-heat | **move** |
| finance/places.ts | pure | dates, types | 339 | places | **move** (grouping, ranges, labels). `clusterPins`, `projector` and `regionFor` are map-view maths: keep them with whichever map renderer needs them |
| finance/merchant-name.ts | pure | ai/routine.merchantKey | 10 | merchant-name | **move**, together with `merchantKey` |
| finance/category-presets.ts | pure | — | 25 | category-presets | **move** |
| finance/projection.ts | Legend-State, store | adapters, store | 241 | projection-scale, reactivity | **stays** (the mobile adapter that feeds the projection). The web needs its own, simpler adapter |
| finance/selectors.ts | Legend-State, store | projection, ledger | 625 | snapshot, reactivity | **split**. Pull out the pure bodies (`balanceLinesByCurrency`, `categoryExpensesByCurrency`, net worth, budget progress, wallet balance) and leave only `cacheComputed` wiring |
| finance/integrity.ts, main-currency.ts | store | store | 148 | main-currency | **split**. `selectMainCurrency(preferences)` is pure; the hook stays |
| finance/paged.ts | React | react | 41 | paged | stays (a hook). Its paging rule is tiny |
| reports/report.ts | pure | budget-month, merchant-name, dates | 305 | report | **move** |
| transactions/list-scope.ts | pure | bills, budget-month, places | 146 | list-scope | **move** (the scope model is domain. The `listParams` route encoding is shared by both routers) |
| transactions/alert.ts, type-change.ts | pure | @repo/types | 83 | alert | **move** |
| transactions/row.ts | React (via icon.ts) | finance/types, wallets/balance-correction, transactions/icon | 98 | row | **split**. Row words are pure; only `icon.ts` (vector-icons) is mobile |
| transactions/icon.ts, prefetch-location.ts | RN icons, expo-location | — | 81 | prefetch-location | stays |
| wallets/balance-correction.ts, compact-name.ts, wallet-meta.ts (logic) | pure / React | — | 108 | balance-correction, compact-name | **move** balance-correction and compact-name |
| wallets/proposal-wallet.ts, default-wallet.ts | MMKV (preferences) | ai/routine | 182 | proposal-wallet | **split**. The seam is "default wallet id" passed in instead of read from MMKV |
| wallets/balance-confirmation.ts, wallet-link.ts, delete-wallet.ts | React, Legend, MMKV | auth-context, selectors | 146 | balance-confirmation | stays (hooks). The confirmation rule lives in ai/facts/confirmation, which is pure |
| dates/local-date-input.ts, day-label.ts, relative-time.ts | pure | — | 140 | day-label, local-date-input | **move** |
| amount/amount-input.ts | pure | @repo/types | 75 | amount-input | **move** (typing rules for an amount field apply to the web too) |
| text/word-order.ts | pure | — | 5 | none | stays (an animation helper) |

### AI, capture and proposals

| Path (lib/) | Pure or platform | Depends on | Lines | Tests | Verdict |
|---|---|---|---|---|---|
| ai/facts/* (days, recurring, forecast, confirmation, index) | pure | finance/types, ledger, ai/routine | 874 | facts, recurring, forecast, confirmation | **move**. Recurring detection drives bills, the forecast and the chat |
| ai/insights/*, ai/snapshot/finance-metrics.ts | pure | ai/facts | 668 | **none directly** (finance/snapshot.test covers part) | **move**. This is the chat snapshot the Go backend reads, so web chat needs it |
| ai/routine.ts | pure | @repo/types | 166 | routine | **move**. It holds `merchantKey`, which is merchant identity, not routine logic |
| ai/duplicates.ts, money-movement.ts, institutions.ts, category-hints.ts, occurred-at.ts | pure | routine, notifications/notification-package-aliases | 622 | duplicates, money-movement, category-hints, occurred-at | **move** duplicates, occurred-at and category-hints. Money-movement and institutions are notification-specific, so moving them is optional |
| ai/notification-types.ts | pure | @repo/types | 97 | — | **move** (it is part of the wire contract) |
| ai/client/types.ts | pure | notification-types, snapshot/finance-metrics | 94 | — | **move** into the shared package as the wire contract (Friction 6) |
| ai/client/http-client.ts, config.ts, mock*.ts | `EXPO_PUBLIC_*`, dynamic `@/lib/supabase/client`, expo-image-manipulator (via image-payload) | — | 337 | http-client, mock | **split**. A pure `createAiClient({ baseUrl, getToken, encodeImage, fetch })` that both apps adapt. That makes two **adapters**, so the **seam** is real |
| ai/client/image-payload.ts | expo-image-manipulator | — | 62 | — | stays (the mobile image **adapter**) |
| ai/run-extraction.ts | store, MMKV, location (transitively) | 22 lib modules | 591 | 3 run-extraction suites | stays for notifications. Text and receipt extraction to proposal on web would reuse only the pure parts (duplicates, routine, proposal-wallet) |
| ai/background-processor.ts, processing-queue.ts, proposal-location-cache.ts | Android FG service, MMKV | — | 599 | capture-retry | stays |
| ai/chat/analyze.ts | store via facts/projection | client, facts, snapshot | 102 | — | **split**. Building the snapshot from data is pure; reading `financeProjection$` is the adapter |
| ai/chat/answer-cards.ts, routing.ts, fresh-replies.ts | pure | budget-month | 207 | answer-cards, routing | **move** |
| ai/chat/answer-snapshot.ts | store | budget-month, bills, selectors | 68 | — | **split**. It repeats `useBudgetData`'s assembly (Friction 2) |
| ai/chat/messages.ts, noticed.ts, sessions.ts, orchestrator.ts | MMKV, components, expo-crypto | — | 480 | messages, noticed, sessions | stays. `noticed.ts` reaches React only via `transactions/icon` |
| ai/chat/bench/* | pure | snapshot, facts | 741 | chat-bench | move with the snapshot (fixtures) |
| capture/spoken-amount.ts, amount-sentence.ts, clock-time.ts, type-duplicate.ts, place-suggestion.ts, place-search.ts | pure | amount, duplicates, places | 573 | one test each | **move**. A typed or spoken amount and a duplicate warning on web are the same rules |
| capture/capture-stage.ts, entry-place.ts, read-capture.ts | expo-location via `transactions/prefetch-location` and ai/client | — | 426 | capture-stage, entry-place, read-capture | **split**. One import (`prefetch-location`) makes the capture-stage model platform-bound. The seam is "current position" passed in |
| capture/approve-capture.ts, held-capture.ts | store, file system | — | 65 | — | stays |
| proposals/review-status.ts, capture-source.ts (rules) | pure / MMKV via installed-apps | routine | 59 | review-status, capture-source | **move** review-status |
| proposals/review-card-state.ts | Reanimated (only `projectedPosition`) and a type from review-actions | motion/tokens | 312 | review-card-state | **split**. The card reducer and fit rules are pure; the swipe thresholds are touch only. Move `projectedPosition` out, or inject it |
| proposals/review-actions.ts, pairing.ts | store, MMKV, receipts | 13 modules | 613 | review-actions, pending-readers | **split**. The approve, Not mine and Later decision rules, `canPairInto` and `toAbsorbedCapture` are domain. Writes go through a "ledger writer" **seam**, with Legend on mobile and Supabase on web |
| proposals/budget-line.ts | Legend (selectors) | format-money | 34 | budget-line | **split** (a pure sentence over a BudgetMonth) |
| supabase/*.ts (CRUD) | Legend store, expo-crypto | store/helpers | 2,278 | 7 suites | stays as the mobile write **adapter**. Pure pieces inside it should move: `rowToProposedTransaction`, `isAwaitingReview`, `selectRecurringOverrides`, `billSeriesKey`, `debtDueState`, `outstandingDebtBalance`, `proposalSource` |
| backup/csv, decode, moni-export, read-moni-export, plan, generic-csv | pure | dates, routine, merchant-name | 1,433 | generic-csv, moni-export, restore | **move**. Export and import on web is a stated research topic (`docs/research/data-import-formats-2026-11.md`) |
| backup/apply, import-session, store-tables, share-file | store, file system, sharing | — | 272 | restore-sync | stays (the adapter) |
| places/types, coords, place-search | pure | finance/places | 191 | coords, place-search | **move** |
| places/client.ts, refresh-coords.ts | ai/client http (image-manipulator), store, MMKV | — | 234 | refresh-coords | **split**, together with the AI client |
| notifications/* (25 files, `.core.js` headless) | Android, MMKV, expo-notifications | — | 2,504 | 15 suites | **stays**. The exceptions are `capture-log.ts` and `missed-report.ts` (pure), which only matter if web shows a capture log |
| notifications/bill-reminder.ts | expo-notifications | format-money | 126 | bill-reminder | stays. Its reminder wording could be pure |
| store/*, mmkv/*, auth/*, query/*, sheet/*, toast/*, haptics/*, location/*, speech/*, receipts/*, motion/*, theme/*, app-variant, e2e | platform | — | ~2,400 | various | **stays**. `auth/login-mode.ts`, `theme/glyph-on.ts` and `haptics/tick-governor.ts` are pure but have no web use, apart from possibly glyph-on |

### Pure logic outside `lib/` that the web needs too

| Path | Lines | What it is | Verdict |
|---|---|---|---|
| components/budget/use-budget.ts | 122 | `useBudgetData`: assembles the BudgetMonth inputs (categories filter, budgets of the user, monthly total from `profilePreferences$`, bills from overrides) | **split**. The assembly is domain; the `useValue` wiring is the adapter |
| components/debts/use-debts.ts | 55 | `useDebt` filters and sorts activities inline | split (fold into the debt module) |
| components/merchants/merchant-list.ts | 118 | merchant directory, `guessMerchantName`, "To name" threshold | **move** |
| components/debts/debt-words.ts, past-people.ts, reminder.ts (`reminderMessage`) | ~150 | debt glossary words, reminder text | move the words. `useRemindedToday` (MMKV) stays |
| components/charts/pace-geometry.ts, spend-geometry.ts, net-worth-geometry.ts, budget/ring-geometry.ts | 872 | chart geometry plus **chart copy** ("N of M days stayed at or under the even pace of RMx") | split. The copy and counts are domain; pixel geometry moves only if web uses the same SVG approach |
| components/profile/currency-words.ts | 29 | currency names | move |
| components/chat/answer-card.tsx `useMonthDaily` | ~20 | a second daily-spend series | delete, and use `dailySpend` (Friction 1) |
| components/review/caught-up.tsx `useSafeToSpend` | ~15 | re-derives per-day before approvals | move into the money-month module (Friction 2) |

## Friction list

1. **"What counts as spend" is written about ten times, and the copies disagree.** `countsAsSpend` in `lib/finance/budget-month.ts:92` excludes `analysisExcluded` and `debtActivityId`, and requires the currency to match. These copies skip the debt-mirror exclusion: `lib/finance/selectors.ts:316` and `:464` (`budgetProgress$`), `lib/ai/snapshot/finance-metrics.ts:82,92,180,192`, `lib/ai/insights/insight-metrics.ts:36–97`, `lib/ai/insights/budget-coach-metrics.ts:94` and `components/chat/answer-card.tsx:47`. `lib/finance/places.ts:90`, `lib/finance/activity-series.ts:20,42`, `lib/reports/report.ts:89` and `lib/ai/facts/recurring.ts:68` each write their own version. So a debt repayment counts as spending in the chat snapshot and in the answer card's sparkline, but not on Budget. Fails the **deletion test** in reverse: no one module owns the rule, so the complexity is already spread across callers.
2. **Even pace and safe to spend a day are computed in several places with different rounding.**
   - Even pace: `budget-month.ts:188` floors to minor units, while `components/charts/pace-geometry.ts:164` and `components/charts/spend-geometry.ts:116` use unrounded `budget / days`.
   - The "N of M days at or under even pace" count appears three times: `pace-geometry.ts:186`, `spend-geometry.ts:200` and `components/budget/calendar-view.tsx:146`.
   - Safe per day uses `Math.floor(x / days / 100) * 100` in `budget-month.ts:263` and again in `components/review/caught-up.tsx:22`.
   - The input assembly for `buildBudgetMonth` exists twice, in `components/budget/use-budget.ts:37–96` and `lib/ai/chat/answer-snapshot.ts:15–37`, with the same category, budget and monthly-total filters copied.
3. **Glossary sentences are duplicated.**
   - "RMx left for N days · RMy a day" appears in `budget-month.ts:283 leftSentence` and `spent-summary.ts:19 leftLine`.
   - The debt phrase "RM40 to Mei / 2 people" appears in `budget-month.ts:270 setAsideLabel` and `spent-summary.ts:9 debtPhrase`.
   - U+2212 and sign logic is written by hand outside `formatSignedMoney` in `app/transaction/[id].tsx:212`, `components/capture/capture-result-card.tsx:257` and `components/amount/amount-page.tsx:21`.
   - A third `whole()` helper sits at `components/charts/spend-geometry.ts:71` and `pace-geometry.ts:107`.
4. **Debt balance and debt state have three implementations.** They are `finance/ledger.ts outstandingDebtBalanceMinor`, `supabase/debts.ts:85 outstandingDebtBalance` with `debtDueState` (timezone-based, with a 7-day "due soon"), and `finance/debt-summary.ts describeDebt` and `daysUntil` (device-local). Day differences are computed again in `spent-summary.ts:29 dueWhen`.
5. **Calendar conventions are mixed.**
   - Device-local `monthKey(Date)` is in `budget-month.ts:77`.
   - Timezone-explicit `monthKeyInTimezone` is in `finance/dates.ts`, used by `selectors.budgetProgress$` and `ai/chat/sessions`.
   - Day numbers in UTC maths are in `ai/facts/days.ts`.
   - Local `YYYY-MM-DD` strings are in `dates/local-date-input.ts`.
   - The month name arrays are copied four times: `dates/day-label.ts:4`, `finance/chart-ticks.ts:7`, `components/charts/pace-geometry.ts:70`, plus `daysInMonth`/`monthName` again at `pace-geometry.ts:92–96`.
   - Local `pad` and `localDay` helpers are repeated in `report.ts:82`, `generic-csv.ts:109`, `occurred-at.ts:6`, `review-notification.ts:234` and `app/chat/history.tsx:187`.
   - The Jest config pins `TZ=Asia/Kuala_Lumpur` (`apps/mobile/jest.config.js:2`), so tests hide local-time assumptions. A Next.js server component renders in UTC, which turns device-local helpers into a **correctness** risk on web, not just a style issue.
6. **The AI wire contract is split three ways and is enforced only by convention.**
   - `lib/ai/client/types.ts` (TS types), `packages/types/src/chat.ts` and `apps/backend/internal/extract/types.go` together form the contract. `apps/backend/internal/{chat,places}` mirror further shapes.
   - `ChatAnalyzeRequest` is defined twice: as a Zod schema in `@repo/types` (with `snapshot: z.record(z.unknown())`) and as a TS type in mobile (with `snapshot: FinanceAssistantToolSnapshot`).
   - The extract request and response have no Zod schema, so responses are not parsed at the network boundary.
   - No test checks TS against Go: grep finds no contract test.
7. **Small platform leaks pin pure modules to mobile.**
   - `capture/capture-stage.ts` and `entry-place.ts` reach expo-location only through `transactions/prefetch-location.ts`.
   - `transactions/row.ts` and `ai/chat/noticed.ts` reach React only through `transactions/icon.ts`.
   - `proposals/review-card-state.ts` reaches Reanimated only through `motion/tokens.projectedPosition`.
   - `ai/client/http-client.ts` dynamically imports `@/lib/supabase/client` and reads `EXPO_PUBLIC_AI_API_URL` at module load (`config.ts`).
   - `wallets/proposal-wallet.ts` reads MMKV via `default-wallet.ts`.
8. **Locality problems.**
   - `merchantKey` (merchant identity) lives in `ai/routine.ts`, and 45 call sites reach into the auto-add module for it.
   - Bills, a Budget concept, live in `ai/facts/recurring` and `days`.
   - `distanceM` is duplicated in `ai/routine.ts:70` and `finance/places.ts:70`.
   - Merchant naming is split across `ai/routine`, `finance/merchant-name` and `components/merchants/merchant-list`.
9. **There are two domain models.** `@repo/types` has `Wallet`, `Transaction` and `Debt` (Zod, used by the CRUD helpers and the web API routes), and `lib/finance/types.ts` has `FinanceWallet` and the rest (used by every pure module). `supabase/debts.ts` maps rows to `Debt` by hand, while `finance/adapters.ts` maps the same rows to `FinanceDebt`. The web's API routes use a third mapping and read `wallets.current_balance`, while mobile computes balances from the ledger (`apps/web/src/app/api/wallets/route.ts:42`).
10. **Mechanical friction in moving files.**
   - Every pure module imports siblings through the `@/lib/...` alias, which in `apps/web` means `./src/*` (`apps/web/tsconfig.json`). Moved files need relative or package imports.
   - `packages/types` has no Jest or Vitest setup and no TZ pin.
   - `packages/types` has a partial `exports` map.
   - `apps/web/next.config.js` lists only `@repo/types` in `transpilePackages`, so a new package must be added there.
   - The mobile tests use `jest-expo`, but the pure suites need only `ts-jest` or Vitest plus `TZ`.
11. **Selectors hide domain rules inside Legend `computed`.** `selectors.ts` (625 lines) holds the budget status thresholds (`near_limit` at 75%), net worth (cash plus receivable minus payable), per-currency balance lines and wallet balance. Each is a pure function body wrapped in `cacheComputed`. The web cannot call it without Legend.
12. **Hot spots that change often** (commits since August): `run-extraction.ts` (19), `store/index.ts` (18), `supabase/proposed-transactions.ts` (17), `review-actions.ts` (11), `finance/adapters.ts` (9), `budget-month.ts` (7), `activity-series.ts` (7), `bills.ts` (6) and `finance/types.ts` (6). The finance read model changes often, which argues for moving it early, before the web forks it.

## Deepening candidates for a shared domain package (`packages/domain` or similar)

### 1. Money month

- **Files:** `finance/budget-month.ts`, `spent-summary.ts`, `budget-note.ts`, `calendar-heat.ts`, `bills.ts`, `components/budget/use-budget.ts` (assembly), `ai/chat/answer-snapshot.ts` (assembly), `components/review/caught-up.tsx` (`useSafeToSpend`), the even-pace parts of `components/charts/{pace,spend}-geometry.ts` and `components/budget/calendar-view.tsx`.
- **Problem:** `buildBudgetMonth` is deep, but each caller rebuilds its inputs: it filters categories and budgets by user, decodes `monthly_budget` and derives bills from overrides. The callers also re-derive outputs from it, such as even pace at a different rounding, days-under-pace counts and the safe per day before approvals. The sentences built from it exist twice.
- **Proposed interface:** Give the module the user's id, "now", the main currency, and the raw lists: transactions, categories, budgets, profile preferences, recurring overrides and debts with balances. It returns one month view with these parts:
  - spent so far and the daily and cumulative series;
  - the budget and even pace, each at one rounding;
  - days at or under pace;
  - bills due and debts due;
  - left this month, safe per day, and "safe per day if X more were spent";
  - per-category spend with budgets;
  - the ready glossary sentences ("RM443 left for 18 days · RM24 a day", "after bills and RM40 to Mei").
  The caller never filters or rounds.
- **Benefits:**
  - **Locality:** the D1 rules (budget, then bills, then debts, then per day) and the rounding live in one file, so a change to "safe to spend" ships to Home, Budget, the calendar, Review, the chat snapshot and the web dashboard at once.
  - **Leverage:** a single call replaces about five call sites on mobile and every web Budget and Home panel.
- **Tests:** the `budget-month.test.ts` and `bills.test.ts` suites move unchanged. Add cases at the interface that the scattered copies made impossible to test together, such as even pace equal on the chart and the calendar, and the safe per day before and after approvals. Delete the per-component assertions.

### 2. Ledger rules (what counts)

- **Files:** `finance/ledger.ts`, `budget-month.countsAsSpend`, `reports/report.countsAsIncome`, the spend predicates in `selectors.ts`, `ai/snapshot/finance-metrics.ts`, `ai/insights/*`, `finance/places.ts`, `activity-series.ts`, `ai/facts/recurring.isCashFlow` and `ai/routine.isFiled`, plus the three debt balance implementations.
- **Problem:** about ten hand-written predicates over the same fields, and they already disagree on debt mirrors and balance corrections.
- **Proposed interface:** a small set of named questions about one transaction: does it count as spending, as income, or as cash flow for recurring detection? Is it filed, so it says something about a merchant? What does it do to this wallet's balance? Add one question about one debt: its balance and state (open, due soon, overdue, settled, written off) on a given day. Every chart, report and AI metric asks these questions instead of reading the flags itself.
- **Benefits:**
  - **Locality:** a new flag, such as a future "refund" kind, is one edit.
  - **Leverage:** the web's server-side aggregations, the mobile charts and the Go chat snapshot inputs all agree by construction.
- **Tests:** one table-driven suite over a synthetic ledger (`ai/facts/__tests__/synthetic-ledger.ts` already exists) asserts every predicate. The existing finance suites then stop re-proving the exclusions.

### 3. Calendar and glossary format

- **Files:** `dates/*`, `finance/dates.ts`, `ai/facts/days.ts`, `chart-range.ts`, `chart-ticks.ts`, `format-money.ts`, `debt-summary.daysUntil`, `spent-summary.dueWhen`, the month and day helpers in `components/charts/pace-geometry.ts`, `components/debts/debt-words.ts`, `components/profile/currency-words.ts`, `components/chat/chat-time.ts`, and the hand-written U+2212 sites.
- **Problem:**
  - There are four day and month conventions, four month-name arrays, and about six `pad` and `localDay` helpers.
  - Device-local time is implicit, which is safe on a phone but wrong in a Next.js server render running in UTC.
  - Money and date wording rules from `docs/redesign/glossary.md` are split between lib and components.
- **Proposed interface:**
  - One "calendar" that is created with an IANA timezone, explicitly. It answers the day key and month key of an instant, days between two days, the days in a month, and a shifted month.
  - One "glossary" that formats money (whole or exact, signed by direction), day labels ("Today", "Fri 16 Oct"), due phrases ("tomorrow", "in 3 days"), month names and chart ticks for a range.
  - Mobile builds the calendar with the device zone; web builds it with the user's profile zone.
- **Benefits:**
  - **Locality:** glossary and lint-copy rules apply in one place for both apps.
  - **Leverage:** every module above takes a calendar instead of calling `new Date().getDate()`, so tests stop depending on `TZ=Asia/Kuala_Lumpur`.
- **Tests:** `format-money`, `day-label`, `local-date-input`, `chart-range` and `chart-ticks` move as they are. Add the same assertions run under two zones, which is impossible today because the zone is pinned process-wide.

### 4. Finance read model (rows to projection to selections)

- **Files:** `finance/types.ts`, `adapters.ts`, the pure bodies inside `selectors.ts` (wallet balances, net worth, balance lines, category expenses, budget progress), `transactions/list-scope.ts`, `activity-filter.ts`, `places.ts` (grouping), `reports/report.ts`, `flow-series.ts`, `spend-history.ts`, `balance-history.ts`, `debt-summary.ts`, and `components/merchants/merchant-list.ts` with `merchant-name.ts` and `merchantKey`.
- **Problem:** the pure transformations are entangled with Legend `computed` caching. There is also a second, divergent model in `@repo/types` (`Wallet` and the rest) and a third mapping in the web API routes. The web would write its own row mapping and balance maths, and already reads `current_balance` instead of the ledger.
- **Proposed interface:** "Give me the user's live rows (any order, soft-deleted included). I give you a normalized projection, and pure selections over it: wallet balances, net worth by currency, the activity list for a scope and filter, the report for a month, places, merchants, debts." Mobile keeps its Legend `projection.ts` and `selectors.ts` as a thin caching **adapter**. Web calls the same selections from a server component or a TanStack Query result, which makes two adapters and a real **seam**.
- **Benefits:**
  - **Leverage:** about 3,000 tested lines become usable on the web for free.
  - **Locality:** a schema change, such as adding `place_id`, touches one adapter instead of three mappings.
  - Merchant identity moves out of `ai/routine` to where merchants live.
- **Tests:** the 25 `lib/finance/__tests__` suites (24 of them platform-free) and `report.test.ts` move with the code. `reactivity.test.tsx` and `projection-scale.test.ts` stay with the mobile adapter.

### 5. AI wire contract and client

- **Files:** `ai/client/types.ts`, `ai/notification-types.ts`, `packages/types/src/chat.ts`, `ai/snapshot/finance-metrics.ts`, `ai/facts/*`, `ai/insights/*`, `ai/chat/{answer-cards,routing,analyze}.ts`, `ai/client/http-client.ts`, `places/client.ts`, and `apps/backend/internal/{extract,chat,places}/types.go`.
- **Problem:** there are three sources of truth, two `ChatAnalyzeRequest` definitions, no response parsing, and no TS-to-Go check. The client is bound to Expo by env, a dynamic Supabase import and an image adapter.
- **Proposed interface:**
  - The wire contract is Zod schemas in the shared package, for the extract requests and results, chat analyze with the typed snapshot, and places search.
  - The client is created with a base URL, a token getter and an image encoder, and always returns the `ok`, `skipped` or `unavailable` result.
  - The snapshot builder takes data (candidate 4's projection plus candidate 1's month) and returns the exact JSON the backend reads.
- **Benefits:**
  - **Locality:** a contract change is one schema plus one Go struct, and a fixture test checks both.
  - **Leverage:** web chat and receipt or text capture on desktop reuse the client and the snapshot unchanged.
- **Tests:** `http-client.test.ts` and `mock.test.ts` move. The chat bench fixtures move with the snapshot. Add a golden JSON fixture in the shared package that both a TS test (parse with Zod) and a Go test (`json.Unmarshal` into `types.go` with `DisallowUnknownFields`) read. That closes Friction 6 without codegen.

### 6. Review decisions (proposals to ledger)

- **Files:** `proposals/review-actions.ts` (rules part), `pairing.ts` (`canPairInto`, `toAbsorbedCapture`), `review-status.ts`, `review-card-state.ts` (reducer and fit), `supabase/proposed-transactions.ts` (`rowToProposedTransaction`, `isAwaitingReview`, retention constants), `ai/duplicates.ts`, `ai/routine.ts`, `wallets/proposal-wallet.ts`, `capture/type-duplicate.ts`.
- **Problem:** what Approve, Not mine and Later do, which captures pair, and what is still awaiting review are domain rules. They are tangled with Legend writes, MMKV and receipt upload queues. A desktop Review page would re-derive them.
- **Proposed interface:** "Given a proposal, the ledger around it and a decision, return the ledger changes to make: rows to insert, patch and soft-delete, and the capture status." A thin **adapter** applies the changes: Legend on the phone and the headless task, Supabase on the web.
- **Benefits:**
  - **Locality:** the review semantics in `docs/ARCHITECTURE.md` live in one module.
  - **Leverage:** the phone deck, the Android notification actions and a web Review page share it.
  - Only one adapter exists today, so this seam stays hypothetical until the web Review page exists. Build it then, not before.
- **Tests:** `review-actions.test.ts` and `pending-readers.test.ts` currently drive the Legend store. At the new interface they assert the returned change sets directly, with no MMKV mock, and a small adapter test stays on mobile.

## Suggested order

Start with 3 (calendar and glossary) and 2 (ledger rules): they are small and the other candidates depend on them. Then do 1 (money month), which the web Home and Budget need first, and then 4 (read model). Do 5 when web chat or capture starts. Do 6 only when a web Review page is designed.
