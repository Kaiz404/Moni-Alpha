# sea_regional: the Malaysian market

Slice: Ryt Bank, MAE by Maybank2u, Finory, Belanjawanku, xFin, SnappySpend, Duitful, plus Malaysian voices found in the global review files. Scraped 2026-10-18.

## Data and caveats

| App                | Reviews | Stores                | 1★/2★/3★/4★/5★     | Date range         |
| ------------------ | ------- | --------------------- | ------------------ | ------------------ |
| Ryt Bank           | 1,689   | Play 967, Apple 722   | 150/34/64/79/1362  | 2025-03 to 2026-10 |
| MAE by Maybank2u   | 1,926   | Play 1,027, Apple 899 | 654/142/119/79/932 | 2020-10 to 2026-10 |
| Finory             | 205     | Play 142, Apple 63    | 8/1/7/15/174       | 2020-07 to 2026-07 |
| Belanjawanku (EPF) | 90      | Play 61, Apple 29     | 9/9/32/20/20       | 2022-08 to 2026-09 |
| xFin               | 4       | Play                  | 1 low, 3 high      | 2026-06 to 2026-09 |
| SnappySpend        | 3       | Play                  | 3 high             | 2026-03 to 2026-09 |
| Duitful            | 0       | (open beta)           | none               | none               |

Read these numbers with the following in mind:

- **The samples are skewed toward 2026.** MAE has 1,464 of its 1,926 reviews dated 2026, because the scraper took the newest 800 Play reviews. Raw monthly counts therefore overstate recent trends. A trend is claimed below only when the dates show it within one theme.
- **MAE's 5★ reviews are polluted.** 206 of the 932 5★ reviews open with a brochure-style line such as "Maybank2u is a convenient…" or "The MAE app makes…". 176 of those are from 2026, and 15 sets of reviews share the same first 60 characters (for example, `35332475` and `31562793`). Generic 5★ praise of MAE's "expense tracking" is therefore not used as evidence. Only reviews that name a specific behaviour are counted.
- **Finory's 4.7★ is partly campaign-driven.** Reviews arrive in bursts: 31 in June 2022, 27 in April 2023 and 19 in May 2021. Nine carry the hashtag `#finoryreview`.
- **Ryt's 5★ reviews also come in launch bursts.** 34 of its AI mentions are from August 2025, and many of its short Apple reviews are dated 2026-10-06, when Apple Pay launched.
- **The global review files are almost entirely from the US stores** (country "us"). Only 9 reviews in them are clearly Malaysian.
- **Method.** The scripts below were session-only and are not kept. `scripts/sea/q.mjs` runs a regex over the JSONL and prints counts and lines. `scripts/sea/tags.mjs` holds the hand-tagged review-id lists for every count marked "tagged" below, so the tallies can be rerun. Both scripts are under the scratchpad directory.
- **Translations.** Malay, Manglish and Chinese quotes are translated in [brackets].

---

## Pain points

### P1. Bank-built trackers get the numbers wrong (MAE)

- **Prevalence:** 28 distinct MAE reviews report a data defect in the Expenses tracker (tagged). They break down as follows:
  - category edits that fail or don't save: 10
  - wrong auto-category, usually "Financial services" or "Others": 7
  - duplicated entries: 6
  - missing transactions or totals that don't add up: 10
- **Wider count:** 45 distinct reviews raise a specific tracker problem or request.
- **Broad regex:** `expense|tracker|track (my )?(spending|expense)|categor|kategori|spending summary|perbelanjaan` matches 81 reviews (26 low, 14 mid, 41 high), but most of the 41 high are generic.
- **Applies to:** MAE.
- **Trend:** the problems are chronic rather than new. Category-edit failures run from 2021-01 to 2026-10. Duplicates cluster in Jan–Feb 2025 (3 reviews, all after an update) and come back in May 2026. One reviewer complains about a 2026-09 redesign: "Had a perfectly functioning expenses tracker… Then they decided to make it an uncomfortable, unintuitive… experience" (`98197325`, 1★, 2026-09-01).

Quotes:

- "the expense categories can't always be updated… Has been an issue since they first implemented it, and years since, it's still a bug." `ddc5e8f3`, 3★, 2025-10-08, 59 👍
- "when I use QR to pay, the expenses was recorded thrice, which is confusing cause it inflates my expenses to more than it should be." `5bd26e54`, 2★, 2026-05-18
- "Just about every purchase is categorised under financial services… a lunch i had is categorised as financial service and the title is public bank." `90756187`, 3★, 2020-11-27, 114 👍
- "the summary failed to record a certain amount under the Electronics category, causing my overall monthly summary to be way less than what actually spent" `60766779`, 2★, 2026-08-22

### P2. Corrections don't teach the app, so users recategorize one by one (MAE)

- **Prevalence:** 9 reviews ask for "remember my category for this merchant" or for bulk edit (tagged). Between them they have 197 👍, the highest per-review engagement of any tracker theme.
- **Applies to:** MAE. The same complaint about Maybank's auto-categorisation shows up on Lowyat (see `my-user-voice.md`, item 18).
- **Trend:** from 2020-10 to 2024-12, with no sign that it was fixed.

Quotes:

- "wonder if the app would learn the grouping based on personal historical action, so that regular transactions would not need regrouping every month." `0d5e6053`, 3★, 2020-10-23, 71 👍
- "I need to manually categorise every transaction I made even though these transactions are from the same merchant." `be43e15b`, 4★, 2024-07-28
- "Discourages me to rely on the expenses feature if i have to manually tag the same transaction correctly every month." `10578328`, 3★, 2024-10-08

### P3. Bank transaction notifications go missing or arrive late

- **Prevalence:** 19 reports, with 609 👍 combined (tagged): MAE 13 and Ryt 6. The MAE count comes from hand-sorting the 89 MAE reviews matching `notif|alert|ka-?ching|pemberitahuan`. Secure2u approval-prompt complaints are excluded.
- **Applies to:** MAE and Ryt. These are the same notifications Moni reads.
- **Trend:** 6 of the 13 MAE reports are from Jun–Oct 2026. That is consistent with a recent regression, but the 2026 sampling skew applies.

Quotes:

- "Everytime I received money or someone scanned my qr for payment, I never received any notification from the app. No 'ka-ching' sound" `06916473`, 2★, 2025-06-25, 51 👍
- "notification sometimes got sometimes not… everytime the notification came after 3 or 4 hour" `dc60d58f`, 2★, 2026-07-05
- "I didnt receieve notification since 16 June 2026 for the last 4 transactions using my Amex charge card." `b3b15886`, 1★, 2026-06-21
- Ryt: "Money was stolen from my account without any transaction notifications. Usually, you receive a notification for every transaction" `01400618`, 1★, 2026-08-07

### P4. Promotions, tips and repeat alerts share the transaction channel

- **Prevalence:** 22 reports (tagged). MAE has 13 about promo or contest spam. Ryt has 9 about noise: loud or unchangeable sounds, badges that won't clear, and "endless tips".
- **Related reports:**
  - MAE repeats "funds received" alerts after the user has acknowledged them: "Please stop the repeating notifications of receiving funds…" (`8d9eacc4`, 4★, 2026-08-29).
  - Ryt sends a notification even for the daily interest credit (`ffe50123`).
- **Applies to:** MAE and Ryt.

Quotes:

- "I turned off promotional messages in mae app but that doesn't work. The developer responded by asking me to turn off all notifications" `24249088`, 2★, 2025-02-17
- "once per hour notifications. I have a mini heart attack thinking someone steal my money from the account each time the notification pop up." `25188253`, 2★, 2023-02-16
- "You get a phone notification for every transaction, even when your daily interest is credited." `ffe50123`, 5★, 2025-12-19, 48 👍

### P5. Each tool sees only one slice of a Malaysian's money

- **Prevalence:** about 10 reviews, but the theme is structural.
  - **MAE covers Maybank only.** 4 reviews ask for e-wallets, other banks or income: `23794588`, `90358110`, `94178745`, `74473837`.
  - **Finory covers card statements only.** It can't add e-wallets (`ff317893`) and doesn't parse 3 banks: Muamalat, RHB and Bank Islam.
  - **Belanjawanku has no bank link** (`3c13f5fc`).
  - **Global apps' Malaysian bank sync is missing or broken.** Wallet: CIMB and Maybank missing (`47959ab0`, 1★, 2026-07-07; `bf81dc21`), AmBank Fastlink broken (`7ffea622`, 1★, 2026-05-18). Money Lover: "My bank in Malaysia suddenly disconnected… i used Maybank" (`ca81b92e`, 1★, 2024-02-06).
- **Applies to:** all of the above.

Quotes:

- "To link/track payment at popular on9 shopping platforms and ewallets such as shopee, lazada, TnG & boost." `23794588`, 4★, 2020-12-06
- "Right now I'm using Spendee—if MAE spending/income tracker could be as immersive as Spendee I would be happy to have one app only for everything." `90358110`, 3★, 2021-12-03
- "put all major bank in malaysia like cimb and maybank in options. like how can you even miss that?" Wallet, `47959ab0`, 1★, 2026-07-07

### P6. Basic budget mechanics are broken (Belanjawanku)

- **Prevalence:**
  - The monthly total doesn't reset: 17 of 90 reviews, about 19% (tagged). Pattern: `reset|bulan baru|new month|previous month|negative|minus`.
  - History is hidden or lost, including lists that turn grey after about 9–11 entries: 15 of 90.
  - Entries can't be edited or deleted: 5.
- **Applies to:** Belanjawanku.
- **Trend:** the reset complaints run from 2022-10 to 2026-01, so the bug has gone unfixed for over three years.

Quotes:

- "the Expenses Overview doesn't reset back every month… the expenses overview shows minus sign where the Spent exceeds the Balance." `07be4345`, 4★, 2023-02-01, 40 👍
- "Klu boleh please adjust supaya expenses review to update setiap bulan… expense review x reset. Terus malas nak pakai." [If possible, please make the expenses review update every month… it doesn't reset. It makes me not want to use it anymore.] `c87a7969`, 2★, 2023-08-14
- "Selepas masukkan 9 perbelanjaan, senarai perbelanjaan hilang, tinggal ruangan kelabu sahaja." [After I entered 9 expenses, the list disappeared and only a grey area was left.] `b5ca7ec9`, 1★, 2023-07-25

### P7. Missing Malaysian categories, income and pay cycles

- **Prevalence (Belanjawanku):**
  - 20 of 90 reviews ask for missing categories (tagged): PTPTN and education loans, insurance and takaful, pets, public-transport fares, personal debt, or custom categories.
  - 9 ask to record income or side income.
  - 7 call the fixed budget guide unrealistic.
- **Pay cycles:** 5 reviews across MAE and Belanjawanku ask for budgets that start on payday: `90756187`, `76802040`, `89218792`, `49122096`, `3d736e8d`.
- **MAE:** 4 reviews ask for income or treat own-account transfers as wrongly counted (`96135330`).
- **Applies to:** Belanjawanku and MAE.

Quotes:

- "bang loan ptptn xde kategori ke? ke xpayah bayar?" [Bro, is there no category for the PTPTN loan? Or do we not have to pay it?] `e83eb6cc`, 3★, 2026-09-02
- "pls tambah insuran/takaful into expenses, personal debt, pet care. Utk yg guna public transport, pls add option for tambang, setakat ni cuma ada toll, fuel, loan & others ja." [Please add insurance/takaful, personal debt and pet care. For public-transport users, please add fares; right now there is only toll, fuel, loan and others.] `7cadac8c`, 3★, 2023-06-17, 11 👍
- "the belanjawanku budget for housing for single person renting a home is RM250. In which negeri is the renting RM250 these days" `67384194`, 3★, 2023-06-24
- "people get paid at different times." `90756187`, 3★, 2020-11-27 (in a request for user-set spending periods)

### P8. Malaysians push back hard on subscriptions and broken lifetime deals

- **Finory's paywall:** Finory moved to a subscription in June 2026, with a free tier of 1 card. 7 of the 8 reviews since then are about the change, 4 of them low (tagged). One user also reports that the new version lost their history (`57339686`).
- **Global apps:**
  - Money Lover's lost lifetime licence: `9dadd544`.
  - Money Lover's bank-link fee: `9769adcb`, 42 👍.
  - YNAB "ridiculously expensive for Malaysian": `42e5c403`.
- **Applies to:** Finory, Money Lover and YNAB.
- **Trend:** Finory's backlash is new (2026-06/07).

Quotes:

- "the free version only offers 1 credit card tracking. Too bad but gotta need to stop using it and track manually again on excel." `ebdcd173`, 3★, 2026-06-15
- "I have since transition to hosting an agent to track my credit card payment dates instead." `54013687`, 2★, 2026-07-02
- "I paid for lifetime premium RM100+ on 18 Aug 2018… my account now became free account." Money Lover, `9dadd544`, 1★, 2025-10-21
- A 5★ user also asks for "a one-time lifetime purchase option" (`92b158a2`, 2026-06-22).

### P9. AI that fails at the one action it promises (Ryt)

- **Prevalence:** 10 of the 123 Ryt reviews that mention AI criticise it (tagged; 154 👍). They say it fails transfers, ignores commands, misreads a receipt split, can't take voice, or is a gimmick. Pattern: `\bAI\b|ryt ?ai`.
- **Applies to:** Ryt.

Quotes:

- "The Ai chat was completely useless… i want to transfer money use ai chat & it didn't transfer it well." `f52a0591`, 1★, 2026-02-04, 30 👍
- "AI seem to be have hallucinations of ignore my transfer command. Repeat few times app will crash" `566825a3`, 3★, 2025-12-29
- "uploaded a pre-snap receipt, I exactly stated to pay that specific item as per receipt #splitbill but it still factors the receipt total… I usually use ChatGPT to do this and that's correct." `6e8a4982`, 3★, 2025-08-28, 45 👍
- "Nobody asked for AI though, all we need is a fast, efficieny banking app" `62d7cda3`, 4★, 2025-10-28

### P10. Real double charges, pending states and holds (an edge case for duplicate logic)

- **Prevalence:** 5 reviews (tagged by hand).
  - 3 report real double payments: Ryt `d6182efc`, MAE `468824de` and `79066749`.
  - 2 describe pending or hold states that a tracker misreads: the petrol pre-authorisation in `90756187`, and the credit card pending-versus-cleared request in `c6ea60f4`.
- **Applies to:** MAE and Ryt.

Quotes:

- "I tried to pay via QR, and then it said pending… after two days, the transaction suddenly completed?? I paid two times for my food." Ryt, `d6182efc`, 1★, 2025-10-23, 29 👍
- "When you buy fuel with debit, 200 is taken from your account right away. However, MAE doesn't show that the money gets credited back in." `90756187`, 3★, 2020-11-27
- "can we get a notification when our credit card transaction has been cleared instead of just when we made the payment but still pending? It helps a lot when we wanna reconcile in our budgets." `c6ea60f4`, 4★, 2026-05-01

### Context: Malaysian banking-app UX (signal for "don't make me open the bank app")

These counts are not tracker features. They show why checking spending inside a bank app is painful.

- MAE:
  - slow or loading: 205 reviews (147 low), pattern `slow|lag|loading|takes? (ages|forever|\d+ ?(sec|min))|lambat|load`
  - login, Secure2u or unlink: 338 (235 low)
  - crash, error or bug: 240 (184 low)
- Ryt:
  - slow: 76 (28 low)
  - face or IC verification: 101

Quotes:

- "It takes me 1 minute to just open it." MAE, `0ed6e796`, 1★, 2024-11-06, 41 👍
- "open app and scan QR need 2 minute." Ryt, `1999e382`, 1★, 2026-10-10, 27 👍
- "have to look thru msgs just to download statements!" Ryt, `0c4656e7`, 1★, 2026-06-04
- Chinese, on accessibility: "整个 App 的字体都非常小……也没有提供调整字体大小的选项" [The whole app's font is tiny… and there is no option to adjust font size.] MAE, `3dd7227e`, 1★, 2026-07-23

---

## Delights

### D1. AI that turns a screenshot, photo or typed line into a ready transaction (Ryt)

- **Prevalence:** 110 of the 123 Ryt AI mentions are 4–5★. Of the 123:
  - at least 42 mention transfers, bills, JomPAY or DuitNow;
  - 10 mention screenshots, photos, handwriting, PDFs or copy-paste;
  - only about 5 mention asking the AI about past spending.
- **Applies to:** Ryt.
- **Trend:** steady from launch (2025-04) to 2026-10. The August 2025 burst inflates the total.

Quotes:

- "Just a screenshot of my whatsapp chat and it prepares my transaction with the right details and reference." `58176356`, 5★, 2025-08-25
- "the AI can capture information from handwriting, photos, and even different languages." `71e65eba`, 5★, 2025-04-18
- "Damn bro, and this is made by Malaysian? the ai part is so nice ay… copy paste to AI and tell them what bank and account number with amount. I don't have to use the stupid bank click here and there anymore!" `bd954fda`, 5★, 2025-11-25
- "syok guna mcm ewallet ada AI lg… apa² tanya AI" [Fun to use, like an e-wallet but with AI too… ask the AI anything] `93b0d6a4`, 5★, 2026-07-31

### D2. Asking about your own history: rare, but the requests point somewhere

- **Prevalence:** about 5 reviews: `29251103`, `58173077`, `ad6879d9`, `97622703`, plus `e03f1220` on the negative side. Ryt's "Insights" screen is mentioned only 3 times, twice because it loads slowly. One user asks for a pie chart of monthly spending (`66665219`).

Quotes:

- "just ask the AI, all specific past transactions will show immediately! Hope they can put in more AI capabilities like prompt reminder for bill payment based on past behaviour" `29251103`, 5★, 2026-05-13
- "Customisable spending tracker. Actually useful AI chat bot." `58173077`, 5★, 2025-08-25
- "the AI also dont hv much info when asked." `e03f1220`, 1★, 2026-03-28, 25 👍

### D3. Capture and categorization without typing

- **Prevalence:**
  - MAE: 11 reviews give specific tracker praise (tagged).
  - Finory: 64 mention statement forwarding or parsing, and 32 mention categories or analysis. All are 4–5★ except 5.
  - SnappySpend and xFin: 4 of their 7 reviews praise notification auto-capture.
- **Applies to:** MAE, Finory, SnappySpend and xFin.

Quotes:

- "Love the built-in expense tracker because it automatically categorizes where my money goes." MAE, `72b0b00c`, 5★, 2026-05-29
- "I only use this app's tracker it's the only one amongst all my bank cards that does this." MAE, `84006495`, 3★, 2023-03-05
- "If like me, you're super lazy to record your own monthly expenses and prefer to let an AI to do the budgeting by simply uploading a copy of your credit card statement…" Finory, `36888807`, 5★, 2022-06-03 (campaign period)
- "It automatically picks up my transactions and saves me a lot of time… I like that everything stays on my device." SnappySpend, `c1b9adae`, 5★, 2026-03-21

### D4. One view across banks, plus due-date reminders (Finory)

- **Prevalence:** 49 Finory reviews mention reminders or due dates, all 4–5★ (pattern `remind|due date|due|late payment|missed`). 21 mention the cashback tracker.
- **Applies to:** Finory.

Quotes:

- "A useful app providing a service that which credit card supplying banks in Malaysia should but shamefully do not provide." `61aa7061`, 5★, 2021-09-10
- "I used to install all 3 bank apps in my HP but with finory, u just can check in 1 app" `914dd0ec`, 5★, 2023-04-11
- "Without this app, I been missing 3 times monthly payments in 2026 and Tawidh, Profit Charges came in." `79c13a9a`, 5★, 2026-06-17
- Chinese: "只是需要每月把card statement发到系统，我以为是automatic的" [The only thing is you have to send the card statement every month; I thought it was automatic.] `66409250`, 5★, 2021-05-20. The monthly lag is the main complaint even among fans: 8 reviews (tagged).

### D5. Instant per-transaction notifications as the spending check

- **Prevalence:** 5 reviews: Ryt 4 and MAE 1, with 119 👍. Ryt's most-liked suggestion (117 👍) asks for more popups, not fewer.
- **Applies to:** MAE and Ryt.

Quotes:

- "with MAE all card expenditures will show in a super fast notification, hence I don't have to wait for the card terminal's receipt." `d5ebcdb7`, 5★, 2020-11-03, 40 👍
- "I love the real-time notifications for every transaction." Ryt, `b1da67cc`, 5★, 2026-02-25, 31 👍

### D6. Built for Malaysians

- **Prevalence:** 14 reviews praise local fit, using pattern `for malaysian|localis|tailored to malaysia|made by malaysian|local app|malaysian context|for malaysians`. They are Finory 8, Ryt 3, Belanjawanku 2 and xFin 1.

Quotes:

- "very localised for MY." Finory, `b48fe136`, 5★, 2025-01-03
- "Love that it's tailored to Malaysian population" Belanjawanku, `04111471`, 3★, 2022-09-20
- "Great app design for Malaysian!" xFin, `7b2bd608`, 5★, 2026-06-30

### D7. No bank credentials needed

- **Prevalence:** 9 Finory reviews raise privacy or security. 6 praise not handing over bank logins, and 3 are low-rated fears.

Quotes:

- "Unlike personal financial management app that connects online, you don't have to worry if they support each individual bank." Finory, `57527639`, 5★, 2021-09-29
- "This app does not link to your credit card account so don't worry your credentials are safe." Finory, `89a975a7`, 5★, 2022-06-03

### D8. Pockets as envelopes (Ryt)

- **Prevalence:** about 5 reviews link Save Pockets to budgeting.

Quote:

- "It clears my mental energy from calculating my expenses with one account into different pockets… really hope there's a pie chart view of monthly expenditures" `66665219`, 4★, 2026-09-18

---

## Small local auto-capture apps: xFin, SnappySpend, Duitful

Seven reviews in total, so this is anecdotal only.

- **xFin (4 reviews).** Notification capture is unreliable for some users:
  - "sometimes the auto notification capture doesn't work but it's still pretty convenient when it works. would like a dark mode/updated ui and a dashboard" `88719a3c`, 5★, 2026-09-22
  - "Still not able to auto track my expenses when i had done all settings" `213c8b10`, 2★, 2026-07-03
- **SnappySpend (3 reviews, all 5★).** All praise automatic capture and simplicity. One praises on-device storage (`c1b9adae`).
- **Duitful.** No public reviews.

**Takeaway:** local developers are converging on notification capture. The one failure mode visible here is setup or capture that silently doesn't work.

---

## Noise kept apart from signal

| Noise                                                   | Count                          | Why it's excluded                                                      |
| ------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| Ryt PayLater limits and fees                            | 136                            | Banking product, not tracking                                          |
| Ryt interest rates and pockets-as-savings               | 148                            | Banking product                                                        |
| Ryt eKYC and face verification                          | 101                            | Onboarding                                                             |
| Ryt card delivery                                       | (not counted)                  | Logistics                                                              |
| Ryt AI debt-collection call (`225c855b`)                | 1                              | Not the in-app AI                                                      |
| MAE login, Secure2u and device-binding                  | 338                            | Banking UX. Kept only as context for "don't make me open the bank app" |
| MAE slowness                                            | 205                            | Same                                                                   |
| MAE crashes                                             | 240                            | Same                                                                   |
| MAE templated 5★ reviews                                | 206                            | Unreliable as evidence                                                 |
| Finory campaign bursts and `#finoryreview`              | about 77 in 3 months, 9 tagged | Inflate praise                                                         |
| Belanjawanku "app says my phone is rooted" (`97c9cd7c`) | 1                              | Device issue                                                           |
| Belanjawanku spam/gibberish (`bd2c80fd`)                | 1                              | Spam                                                                   |
| Cleo "boost" matches                                    | 29                             | Cash-advance product, not the Malaysian e-wallet                       |

---

## Implications for Moni

1. **History-matched auto-categorization is the most-asked-for fix in Malaysia's biggest bank tracker.** _Supports_ Moni's history-matched auto-add ("Auto"). P2 has 9 reviews with 197 👍, P1 has 7 miscategorisation reviews, and Lowyat says the same. The pitch writes itself: "categorize a merchant once; Moni remembers." _Evidence-backed._
   - Bulk recategorize is also requested (`84006495`, `00761793`, `0d5e6053`). _Possibly missing; inferred, Moni's support not verified._
2. **Duplicate detection is necessary, but it must not hide real double charges.** _Supports_ Moni's duplicate and transfer-leg pairing, with edge cases. MAE's own tracker double- and triple-counts (6 reviews). Yet real double payments happen after a "pending" QR (3 reviews), and holds reverse later: petrol pre-auth, pending versus cleared card (2 reviews). Moni should do three things:
   - flag a suspected duplicate for review instead of silently dropping it when the amounts and merchant match within minutes;
   - pair a hold with its reversal;
   - drop repeated "funds received" re-alerts (`8d9eacc4`).

   _The edge cases are evidence-backed; the design response is inferred._

3. **Notification capture inherits the banks' unreliability.** _Threatens_ the "auto" promise. 19 users report missing or late MAE and Ryt notifications. xFin users report silent capture failures. Two possible mitigations:
   - Show when a linked app has gone quiet, for example "No Maybank notifications for 7 days". Offer a quick reconcile through chat, receipt or a statement screenshot.
   - Never claim complete coverage.

   _The threat is evidence-backed; the mitigations are inferred._

4. **The notification filter is a product feature, not plumbing.** _Supports, with a risk._ Banks route promotions, tips, Secure2u prompts, interest credits and repeat alerts through the same channel (22 reports). MAE cannot mute promotions alone (`24249088`). Some users will turn MAE notifications off entirely to stop the spam, which blinds Moni. Onboarding should explain this and check that notifications are on. _Evidence-backed for the noise; the onboarding step is inferred._
5. **Coverage across banks and e-wallets is the open gap.** _Supports_ Moni's core thesis. Each local option sees one slice: MAE sees Maybank, Finory sees card statements a month late, Belanjawanku is manual, and global apps' Maybank, CIMB and AmBank sync breaks (P5). Duitful makes the same pitch, so the edge has to come from parser breadth and from what sits on top: auto-add, pairing and chat (see `landscape.md`). _Evidence-backed, but the counts are small, about 10 reviews plus Lowyat._
6. **Lead AI messaging with "show it a screenshot or a sentence and it fills the transaction", not with "chat about your spending".** _Supports_ Moni's chat, voice and receipt capture into approve-or-decline proposals. It _questions_ how prominently to feature the chat assistant.
   - Malaysians loudly reward Ryt's extraction-to-action AI: 42+ transfer and bill mentions, 10 about screenshots.
   - Spend-question chat appears only about 5 times.
   - The 10 Ryt AI failures all happened on actions taken without a safe check. Moni's approve-or-decline step answers that.
   - Voice is explicitly requested (`05536978`), and Moni has it.
   - An iOS screenshot path would also cover Moni's iOS gap, since about 45% of the MAE and Ryt reviews come from Apple users.

   _Counts are evidence-backed; the positioning and iOS idea are inferred._

7. **Ship Malaysian defaults.** _Shows a gap to verify._ Users want these categories: PTPTN and education loan, takaful and insurance, toll, petrol, public-transport fares, TNG reload, pets and personal debt. They also want income and side income, and budgets that start on payday (P7: 20 + 9 + 5 reviews). Moni's category budgets default to a `'monthly'` period. I did not verify whether the start day can be customised. _Demand is evidence-backed; Moni's gap is inferred._
8. **Table stakes: monthly rollover, full history, edit and delete, no data loss.** _Supports_ offline-first, but with a warning: Belanjawanku lost users on exactly these points (17 + 15 + 5 reviews). Finory's update wiped one user's history (`57339686`). _Evidence-backed._
9. **Price low and avoid surprise paywalls.** _Informs pricing._ Finory's free tier of one card produced 7 negative-leaning reviews within a month. Money Lover's lost lifetime licence still angers people, and YNAB is "ridiculously expensive for Malaysian." The local anchor is Duitful at RM19.90 one-time. _Evidence-backed, small n._
10. **Bill and card due-date reminders are a proven local delight.** _Possibly missing from Moni._ Finory has 49 reminder mentions. A Ryt user asks for "prompt reminder for bill payment based on past behaviour" (`29251103`). Moni has debts and recurring detection, but I did not verify whether it sends reminders. _Demand is evidence-backed; the gap is inferred._
11. **Privacy framing works.** _Supports_ Moni's no-bank-credentials design and on-device snapshot for chat. Finory fans cite not sharing logins (6). SnappySpend's reviewer praises "everything stays on my device." Finory has 3 low reviews about data fears. _Evidence-backed, small n._
12. **Bank "insights" are not a strong incumbent.** _Supports_ the room for Moni's charts and heatmap. Ryt's Insights screen is mentioned only for being slow. A Ryt fan asks for a basic pie chart. MAE's summary is "way below annoying promotions" (`08733270`, 44 👍) and its totals are unreliable (P1). _Evidence-backed._
