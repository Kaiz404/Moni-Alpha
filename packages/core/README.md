# @repo/core

Pure domain rules the phone app and the web app share. Raw TypeScript, no build step: Metro reads it directly, and Next.js through `transpilePackages`.

| Module | What it answers |
| --- | --- |
| `ai-consent.ts` | The user's choice about Moni's AI from the `ai_consent_current` rows (`consentFromRows`), whether a use may run (`aiUseAllowed`), and what Turn on and Not now record. |
| `calendar.ts` | `createCalendar(zone)` reads an instant as a day key, a month key or a day number in one IANA zone, and finds when a day starts. Day and month arithmetic (`addDays`, `daysBetween`, `daysInMonth`, `shiftMonth`, `addMonths`) needs no zone. |
| `glossary.ts` | The words `docs/redesign/glossary.md` fixes: money (`RM1,116.20`, U+2212, whole ringgit for forward-looking numbers), day labels, due phrases, month names and chart ticks. Every date word takes day keys. |
| `ledger.ts` | What a row means: whether a transaction counts as spending, as income or as cash flow, whether it is filed, and what it does to a wallet's balance; a debt's totals, its stored status, and its state on a day (open, due soon, overdue, settled, written off). |
| `chart-range.ts` | The chart ranges (1M, 7D, 30D, 90D, 1Y, All) and where each starts. |
| `money-month/` | One user's month of money: `moneyLedger` reads the synced rows once (the user's categories, budgets, monthly total and this month's bills from `detectRecurring` and the overrides), and `buildMoneyMonth` answers any month: spend per day, even pace and the days at or under it (`evenPace`, one rounding), bills and debts due, what is left and safe to spend a day (`safePerDay`), per-category spend, and the sentences each screen shows (`words.ts`). Bills, recurring series and the calendar heat live here too. |
| `read-model/` | The finance read model: synced rows as finance types (`rows.ts`), the projection with transactions by wallet and activities by debt (`projectFinance`), and what the screens read from it: wallet balances, net worth, budget progress, category spend (`selections.ts`), merchants, places, Activity's filter and chart series, a See all list's scope (`list-scope.ts`), spend and balance history, the Debts summary and the month report. |

The zone is always a parameter. Mobile builds its calendar from the device zone (`apps/mobile/lib/dates/device-calendar.ts`); the web will build it from the profile zone.

```bash
pnpm --filter @repo/core test         # Vitest
pnpm --filter @repo/core check-types
pnpm --filter @repo/core lint
```
