# @repo/core

Pure domain rules the phone app and the web app share. Raw TypeScript, no build step: Metro reads it directly, and Next.js through `transpilePackages`.

| Module | What it answers |
| --- | --- |
| `calendar.ts` | `createCalendar(zone)` reads an instant as a day key, a month key or a day number in one IANA zone, and finds when a day starts. Day and month arithmetic (`addDays`, `daysBetween`, `daysInMonth`, `shiftMonth`, `addMonths`) needs no zone. |
| `glossary.ts` | The words `docs/redesign/glossary.md` fixes: money (`RM1,116.20`, U+2212, whole ringgit for forward-looking numbers), day labels, due phrases, month names and chart ticks. Every date word takes day keys. |
| `chart-range.ts` | The chart ranges (1M, 7D, 30D, 90D, 1Y, All) and where each starts. |

The zone is always a parameter. Mobile builds its calendar from the device zone (`apps/mobile/lib/dates/device-calendar.ts`); the web will build it from the profile zone.

```bash
pnpm --filter @repo/core test         # Vitest
pnpm --filter @repo/core check-types
pnpm --filter @repo/core lint
```
