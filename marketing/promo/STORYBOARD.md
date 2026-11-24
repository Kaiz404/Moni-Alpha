# Moni promo storyboard

Shot data lives in `src/videos.ts`. To re-cut, edit that file and run `node scripts/render-all.mts [VideoId]`. The script renders `out/<video>.mp4` and writes one frame per shot midpoint to `out/frames/<video>/`.

Camera words: *spin in* turns the phone from its back to the front. *Push* moves in on part of the screen. *Whip* is a fast turn out on the cut. All moves are springs.

## Hero (`hero.mp4` 1080x1920, `hero-landscape.mp4` 1920x1080), 29.4 s

The landscape cut uses the same shots. The phone sits right of centre and the captions sit at the left.

| # | Clip, source in to out (s) | Camera | Caption | Dur |
|---|---|---|---|---|
| 1 | home-overview 0.3 to 3.3 (wallet strip swipe) | Spins in from its back, settles, drifts toward net worth, whips out | Every coin, counted. | 2.8 |
| 2 | quick-add 11.0 to 13.8, cut to 18.8 to 20.3 | Turns in from the left, pushes in on the draft card, follows down to Approved | Just say what you spent. / Moni drafts it. You approve. | 4.2 |
| 3 | scan-receipt 1.5 to 2.8 (Scan a receipt), cut to 12.45 to 13.0 (reading), cut to 14.8 to 15.9 (Check and approve), cut to 16.2 to 17.15 (Added) | Pushes in on the chooser, pushes to the receipt and amount across the cut, pulls back for Added, whips out | Snap the receipt. / Moni reads the rest. | 3.9 |
| 4 | review-captures 1.5 to 5.0 at 1.25x, cut to 12.0 to 13.7 | Turns in from the right, pushes to the card, rises to All caught up | Every payment, caught. / Swipe right to approve. | 4.4 |
| 5 | spend-pace 0.8 to 3.0 (scrub), cut to 11.1 to 12.6 (Daily) | Low angle, pushes in on the chart, drifts, whips out | Know your pace. | 3.7 |
| 6 | spend-calendar 4.25 to 8.4 at 1.15x | Pushes in on the calendar, eases down to the day list | Spot the heavy days. | 3.6 |
| 7 | places-map 4.0 to 7.3 | High angle, pushes in on the map | See where you spend. | 3.4 |
| 8 | home-overview 0.0 (still) | Turns away and settles at 3/4 | Cat icon and the moni wordmark capsule. Money, made clear. / On Android and the web. | 3.4 |

## Spots (1080x1920)

| Video | # | Clip, source in to out (s) | Camera | Caption | Dur |
|---|---|---|---|---|---|
| spot-quick-add, 9.8 s | 1 | quick-add 1.5 to 3.5 | Spins in on "What did you spend?" | Just say what you spent. | 2.0 |
| | 2 | quick-add 11.0 to 13.8 | Slow push into the draft card | Moni drafts it. | 3.6 |
| | 3 | quick-add 18.8 to 20.4 | Close on Approved and the toast | You approve. | 1.8 |
| | 4 | quick-add 21.0 (still) | End card | Money, made clear. | 2.4 |
| spot-scan, 7.7 s | 1 | scan-receipt 1.4 to 2.8 | Spins in on the chooser | Snap the receipt. | 1.6 |
| | 2 | scan-receipt 12.45 to 13.0, cut to 14.8 to 15.9 | Push to the receipt and amount | Moni reads every line. | 1.9 |
| | 3 | scan-receipt 15.95 to 17.6 | Pull back to Added to Food & Dining | One tap, and it counts. | 1.8 |
| | 4 | scan-receipt 18.0 (still) | End card | Money, made clear. | 2.4 |
| spot-review, 9.0 s | 1 | review-captures 0.0 to 2.6 | Spins in, GRAB*FOOD swipes right | Payments, caught. | 2.6 |
| | 2 | review-captures 7.4 to 9.6 | The receipt swipes left (Not mine) | Swipe to sort. | 2.2 |
| | 3 | review-captures 12.1 to 13.9 | Rises to All caught up | Done in seconds. | 1.8 |
| | 4 | review-captures 14.5 (still) | End card | Money, made clear. | 2.4 |

## Clips left out

- ask-moni. The answer card's second line is the #122 bug, and it sits directly under the title, so the card cannot be framed without it.
- budget-categories, bills, debts and activity-search. They are solid but slower, and the hero already runs 30 s. Debts is the next feature to add if one is swapped in.
- scan-receipt 2.9 to 12.4. This is the black viewfinder, the camera chip, the "Moni E2E" access line and the system scanner.
- scan-receipt 13.0 to 14.7. The Location field reads "Seattle C..." here before it settles on "Not saved".
