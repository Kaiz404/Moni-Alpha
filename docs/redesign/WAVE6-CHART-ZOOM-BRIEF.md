# Brief: range changes zoom the chart instead of redrawing it

Owner's ask (12 Nov 2026, from the phone): switching a chart's range (1M, 7D, 30D, 90D, 1Y, All) should feel instant and smooth. The x and y axes zoom in and out to the new range, cleanly. Preload the data so nothing waits. Find a clean way to show dates at every zoom. The range control (`Segmented`) now picks options mid-glide, so a chart may get several range changes within a second while the finger slides; every change must retarget the running animation, never restart it.

Charts in scope: Home's spent card (`components/home/spent-card.tsx`, `components/charts/pace-chart.tsx`, `components/charts/pace-geometry.ts`, `lib/finance/spend-history.ts`) and the Wallets net-worth card (`components/wallets/net-worth-chart.tsx`, `components/wallets/net-worth-geometry.ts`, `lib/finance/balance-history.ts`). Range logic: `lib/finance/chart-range.ts`. Out of scope: `balance-plot.tsx` (single-month wallet chart), the Budget category page's `PaceChart` use (keep it working unchanged).

## Data shape (name it first)

- One **day index per chart**, built once per change of its inputs (transactions, currency, wallets, balances) in a `useMemo`, never per range:
  - Spend: `{ firstDay: string; days: number; spent: Float64Array /* per day, minor units */; cumulative: Float64Array /* running total from firstDay */ }` covering firstDay..today. firstDay is the earliest of: first spend day, and the earliest range start (1 year back, and the 1M month start), so every range is a slice.
  - Net worth: per day `total` and per wallet arrays (null before a wallet began), covering the earliest wallet/transaction day..today (this is what `balanceHistory` computes for `all` today).
- A **viewport** per chart: `{ from: number; to: number }` in day indices, plus the y domain `{ low: number; high: number }`. Range → viewport is a pure function. 1M's viewport is month start..month end (future days empty, as today).
- Shared values on the UI thread: `from`, `to`, `low`, `high` (and for Pace in range mode, `base` = cumulative value at the day before `from`, so the line reads "spent since the range start"). One spring drives all of them on each range change: `springs.value` from `lib/motion/tokens.ts`, retargeted mid-flight (withSpring from the current value; never reset to a start value). Reduce Motion: 180 ms cross-fade, as the existing code does.

## Rendering

- Lines and areas: an `Animated` SVG `Path` whose `d` is built in a worklet (`useAnimatedProps`) from the day index and the four shared values. Emit only points inside the viewport plus one on each side, decimated to at most one point per pixel column (keep each column's last value for cumulative/balance lines). This keeps per-frame work bounded whatever the data size. Pass the typed arrays into the worklet once (they are immutable per index build).
- Home Daily bars: bars need a unit (day, week, month, year by `unitFor`). Draw the target range's buckets, each positioned in data space (bucket's first..last day), so they move and widen with the zoom. When the unit changes, the outgoing set fades out (≈120 ms) while the incoming set grows in place on the same viewport spring. A bar's height is in data space too, so the y zoom rescales it. Keep the 1M extras (coral over even pace, safe-to-spend marker) on 1M only, fading with the switch.
- 1M Pace extras (budget line and label, even-pace line) fade in on 1M and out elsewhere; they live in the same viewport so they zoom with it.
- Remove the remount-and-redraw on range change: no `key={range}`, no `PaceChart`/`RangeChart` element swap between 1M and the others (one chart component handles all ranges), no `reveal` wipe on range change. A draw-in on first mount per session may stay. A Pace↔Daily mode switch may cross-fade.
- Gridlines stay at fixed pixel rows. Y labels sit on them and show the domain's values at the target: when the target changes, labels cross-fade (old out, new in, ≈150 ms) while the marks rescale under them. Y domain: Home zero-based, `niceCeil` of the visible max (keep today's nice-number rules, and 1M's budget rules). Net worth keeps its floor/ceiling snapping to a nice unit.

## Dates on the x axis (owner asked for a clean scheme)

Ticks are anchored to dates, so during a zoom each tick slides with its date; the tick set for the target range fades in and the old set fades out. "Today" is always pinned at the right edge, and any tick within 52 px of it hides (existing rule). The start-of-range tick goes: the range chip already says the span.

| Range | Ticks at | Label |
| --- | --- | --- |
| 7D | every day | `Mon`, `Tue` … (3-letter weekday) |
| 30D | every Monday | `5 Oct` |
| 1M | 1st, 8th, 15th, 22nd, 29th | `1 Oct`, `8`, `15`, `22`, `29` (month only on the first) |
| 90D | each month's 1st | `Sep`, `Oct` |
| 1Y | each quarter's 1st (Jan, Apr, Jul, Oct) | `Apr`, `Jul`, `Oct`, and `Jan 2026` on a January |
| All | each 1 Jan | `2025`; if the data spans under 13 months, use the 1Y scheme |

Callouts (the scrub readout) keep their current formats. Put the tick rule in one pure, tested function (`lib/finance/chart-ticks.ts` or beside chart-range): `(range, viewport days, today) → { day, label }[]`.

## Scrub

The scrub gesture must read the live viewport shared values to map a finger x to a day or bucket (no captured `left/step`/`xs` from React render). Selection guide, dot and callout positioned on the UI thread from shared values (net worth already does this; port Home to the same approach). Callout text may update through React. Haptic rules unchanged (`chartStep`, net worth's per-index tick).

## Constraints

- Keep every testID listed: `home.pace-chart`, `home.chart.plot`, `home.chart.callout`, `home.chart.even-pace`, `home.chart.budget`, `home.chart.{pace,daily}`, `home.range.*`, `home.spent.left`, `budget.pace-chart`, `wallet.list.net-worth`, `wallet.chart.plot`, `wallet.chart.callout`, `wallet.chart.{1m,7d,30d,90d,1y,all}`, `wallet.chart.{total,by-wallet}`, `wallet.chart.key`, `wallet.chart.key.<id>`. Maestro flows `.maestro/flows/home/home.yaml`, `home-scrub.yaml`, `budget/category.yaml` must still make sense; update any assertion whose label text changes by design.
- Tests: rewrite geometry tests that parse `points` strings to test the pure pieces (day index, viewport, tick rule, y domain, decimation) with literal expected values, and keep behaviour tests (callout values after a range press, labels shown per range). Delete tests that only pinned the old redraw.
- Per-frame work stays on the UI thread; no `setState` per frame; `scheduleOnRN` only at commit points.
- Update docs in the same change: `docs/redesign/tokens.md` (the net worth chart bullet's "Range and view changes redraw left to right" becomes the zoom; add the tick table), `docs/DESIGN_SYSTEM.md` chart section, `docs/REDESIGN.md` "Where the app differs" (owner's direction, 12 Nov 2026: range changes zoom; ticks per the table), `apps/mobile/README.md` if it names files you move.
- Measure: add a small Jest timing check (not an assertion on time, a logged number) of building each index for 6,000 transactions over 3 years and 4 wallets, and of building one decimated path for the All viewport, before and after, and report the numbers.
