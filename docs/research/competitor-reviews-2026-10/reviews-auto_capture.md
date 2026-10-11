# Auto-capture slice: axio (Walnut), FinArt, Rocket Money, Emma, Wallet by BudgetBakers

## Data and how to read the counts

| App                    | Capture mechanism                                   | Reviews (Play / App Store) | Low 1–2★ | High 4–5★ | Date range        |
| ---------------------- | --------------------------------------------------- | -------------------------- | -------- | --------- | ----------------- |
| axio (formerly Walnut) | Reads bank SMS (India)                              | 1,056 (1,056 / 0)          | 425      | 543       | 2018-09 → 2026-10 |
| FinArt                 | Reads SMS, email and app notifications (India, UAE) | 1,057 (1,057 / 0)          | 147      | 837       | 2018-09 → 2026-10 |
| Rocket Money           | Bank sync via Plaid (US)                            | 2,177 (1,184 / 993)        | 993      | 1,041     | 2017-10 → 2026-10 |
| Emma                   | UK open banking                                     | 1,117 (1,011 / 106)        | 642      | 393       | 2018-10 → 2026-10 |
| Wallet by BudgetBakers | Bank sync (Salt Edge and others) plus manual        | 1,651 (1,025 / 626)        | 444      | 1,063     | 2017-12 → 2026-10 |

Caveats:

- **Sampling skews the trends.** The newest 800 Play reviews are mostly from 2026. For example, axio has 848 reviews from 2026 and 168 from 2018–2024. Older reviews come from the "most relevant" sort, which over-represents long, upvoted complaints. So I compare shares within each year, never raw counts across years.
- **How I counted.** Every count comes from a regex over title and text, after removing duplicate rows. The scripts were session-only and are not kept (`count.mjs`, `grep.mjs`). "Hand-counted" means I read each regex hit and dropped the false positives.
- **Quote format.** Each quote is cited as `id-suffix ★rating date (👍 helpful votes)`.

---

## Part A — SMS and notification parsers (axio, FinArt): the closest analogs to Moni

### A1. Capture silently stops or misses transactions (the top pain for this mechanism)

- **Prevalence.** axio: **67 of 425 low reviews (16%)**, plus 27 high and 22 mixed reviews that report the same problem (116 of 1,056 overall). FinArt: **20 of 147 low (14%)**, 35 of 1,057 overall.
  - Pattern: `(sms|message|transaction|expense|spend|payment|upi)…(not|n't|never|stopped|fail)…(detect|captur|track|read|pick|scan|record|recogni|import|identif)` or the reverse word order, or `miss(es|ed|ing)…(transaction|expense|sms|message)|undetected|rescan|skipped`.
- **Applies to:** axio and FinArt. The bank-sync equivalent is B1.
- **How it fails.** Among the 67 axio low reviews:
  - 22 say capture stopped _suddenly_, or name how long it had been broken ("since 4 days", "since August 2nd").
  - 20 say they reported it to support with no fix.
  - 16 complain that they now enter transactions by hand.
  - 6 reinstalled, and some of those then lost their data (see A8).
  - 7 say outright that it "defeats the purpose".
- **The user finds out late.** The failure is noticed days later, when the user compares the app with their SMS inbox.
  - > "the application has stopped tracking my expenses for past 4 days… I can see text messages of my expenses in my messages but nothing is being tracked." — axio `98ac31fd ★2 2025-05-09 (👍67)`
  - > "Many of the transactions are not detecting automatically… A few times i incurred loss also as some of the expenses i did for others are i forget to recover because of this app's memory loss." — axio `4a069ba0 ★1 2025-06-12 (👍15)`
  - > "you have to keep track if it got updated or not and then manually note it down." — FinArt `60e83cbc ★3 2025-06-19`
  - > "Only 2/10 transactions detected… Even with all permissions and battery saver off, most expenses aren't tracked automatically." — axio `365ab20e ★1 2026-04-25`
  - > "After scanning my SMS, it missed a lot of transactions. And there's no way to teach it." — FinArt `2587c25c ★2 2025-12-25`
- **The axio outage of May 2025.** This is a natural experiment in a fleet-wide silent failure.
  - **Scale:** 20 of the 22 axio reviews posted between 1 May and 15 June 2025 are about SMS detection or backup restore.
  - **Repair:** a fix shipped around 13 May, and at least 3 reviewers raised their rating afterwards (`9c213c02`, `3cd1e15f`, `a4440be3`).
  - **Reinstall cascade:** users reinstalled to fix it, and then restoring the backup failed with "could not connect" (6 reviews), e.g. `f123f57e ★1`, "now my backed up data would not restore."
- **Trend.** The share of axio reviews (all ratings) that mention missed capture:
  - **2018–2024:** 16% (27 of 168).
  - **2025:** 50% (20 of 40). This year is dominated by the outage.
  - **2026:** 8% (69 of 848).

  The 2026 share is lower, but 2026 low reviews describe new kinds of breakage (A2), so the problem is chronic rather than improving. FinArt's share is flat at roughly 3–8% a year.

### A2. Format and channel drift breaks individual banks

- **Prevalence.** At least 50 reviews across both apps name a specific bank, sender ID or message channel that stopped parsing. Crude bank-name regex: axio 27, FinArt 24, all ratings; I checked the clearest ones below by hand.
- **Banks named:**
  - **Indian banks:** HDFC, Axis, SBI Card, Canara, PNB, Ujjivan, Karur Vysya, Slice, OneCard and ICICI.
  - **Wallets and payment rails:** Paytm wallet, GPay debits, UPI outbound, RuPay-on-UPI, UPI Lite and the digital rupee.
- **Concrete drift mechanisms users diagnosed themselves.** Each one maps to a risk for Moni:
  - **Sender-ID rotation.** "Sms from VD-DCBANK-S are tracked. But May 3 onwards debit sms started coming from AD-DCBANK-T. These are not getting tracked." — axio `093f0351 ★2 2026-06-02`. Also "Bank SMS with S suffix not detecting" — `68f4f674 ★1 2026-07-28`.
  - **The bank moves from SMS to RCS or rich messages.** "it doesn't track bank balance messages which come as RCS messages instead of regular SMS." — axio `53d0f952 ★5 2026-08-11`. Also `29c7f40d ★4` (YES Bank RCS), and HDFC "rich format with media" in `e42804bb ★4 2025-05-15`.
  - **The bank moves to WhatsApp.** "transactions/balance message from WhatsApp is not being updated (which is issue in case of ICICI as they stopped sending sms)" — FinArt `8ea7ee94 ★1 2026-10-06`.
  - **The user changes their default SMS app.** "The only change recently is that I've switched to Google messages… rescan… fails (0 new messages)" — axio `145b0699 ★4 2025-05-09 (👍62)`.
  - **OS and OEM changes.**
    - Samsung: "stopped identifying expenses since 2 weeks, in my Samsung OneUI 8.5 device" — `07058811 ★1 2026-08-18`.
    - Battery optimisation: "If we try to optimize… it misses out on reading expense SMS" — `16a20d48 ★3 2022-10-01 (👍143)`.
    - Notification-access conflicts: "Gmail notifications gets disabled when I enable notification access for this app" — FinArt `d8434ad2 ★3`.
  - **Notification capture stops.** "It was automatically recording the transactions through notifications and later it stopped all of a sudden." — FinArt `99dbf48c ★1 2022-03-27`
- **Wrong amounts and currencies.** These are small but serious:
  - axio 4 and FinArt 3 low reviews report wrong amounts.
  - "AUD 50 will get tracked as INR 50" — axio `d0aec62a ★2 2025-01-31`.
  - FinArt shows "$60.75 as $60" — `6fbcb644 ★1`.
  - Bank-sync apps have the same failure: Rocket Money read "¥1500 → $1590 large transaction alert" (`144a05a0 ★3`, 👍101).
- **Trend.** This is getting worse. RCS, WhatsApp and the sender-ID complaints all date from 2025–2026.

### A3. Duplicates (and one case of over-merging)

- **Prevalence.** Hand-counted from the pattern `duplicat|twice|double|two times|\d times`: **axio 14 of 1,056** genuine capture-duplicate reports, 9 of them low and dated 2026. **FinArt 8 of 1,057.**
- **Causes users name:**
  - **Two messages for one payment**, one from the bank and one from the merchant or UPI.
    - > "If I order online I will receive two sms one from swiggy and one from my bank. So it will consider both the SMS as spend. But I am ok with it as I can decide which one to keep." — axio `4cdc9c68 ★5 2020-09-24 (👍108)`
  - **Rescans** create duplicates (`0ee24cdc`, `b3746432`).
  - **RuPay credit cards on UPI** are logged twice (`4470f96e ★2`, 👍20).
  - **The same transaction from the app and from SMS** — FinArt `1ea2554d ★1`.
  - **Editing from a notification** creates duplicates — FinArt `f6898202 ★2`.
- **Getting worse in 2026:**
  - > "Almost all online transactions are captured twice or sometimes even 5 times, many transactions do not appear" — axio `0b189338 ★2 2026-07-11`
- **What users ask for:** show duplicates rather than hide them. They want a duplicates tab or highlight (`3786357f ★3 2026-08-17`), a "mark as duplicate" button (`6aa2a8d6 ★4`, `de529048 ★4`), and dedupe by reference number or date plus amount (`e882ca5e ★4 2026-07-22`).
- **Over-merging is also a failure.**
  - > "If I have transaction of 25 for same 3 times then it consider as one transaction it should be 75" — FinArt `e065eca6 ★3 2024-03-15`

### A4. Transfers, credit-card bill payments, wallet top-ups and refunds counted as spending

- **Prevalence.** Hand-counted from the pattern `self[- ]?transfer|not an expense|credit card (bill|payment)|wallet (load|recharge)|refund…|transfer…(expense|income|double|between|own)`: **axio ~15, FinArt ~17** across all ratings.
- **Quotes:**
  - > "When i pay using a credit card and settle the bill, they should not both add up." — axio `4ab3da4d ★1 2022-11-08 (👍159)`
  - > "It is always showing the money added to Paytm wallet as an expense instead of transfer." — FinArt `e6fa389a ★1 2023-08-07 (👍21)`
  - > "you've broken the refund logic… If I've paid by card and received the refund by UPI… it's no longer possible to link the two." — axio `884d3d31 ★2 2025-10-27`
- **The positive side.** FinArt is praised because it "ignores wallet recharges (customisable)" (`a4241a2d ★5`, 👍33) and because "refunds are identified against the right expenses" (`2bcc23a2 ★4`).

### A5. Categorisation drifts into "Unknown"

- **Prevalence.** axio ~10 negative reviews. Pattern: `\bunknown\b|merchant|categor…(wrong|not work|glitch|remain)|tag others`. FinArt has none in low reviews; its categorisation is a delight (D3).
- **Quotes:**
  - > "earlier most of the spends were auto categorised and merchant recognition was better. now, most of the transactions are in Unknown" — axio `08913d8b ★2 2025-06-04`
  - > "A major chunk of expenses (more than 50%) get tagged as 'unknown', some of which are very obvious from the merchant names." — axio `d0aec62a ★2 2025-01-31`
  - > "In old version it detected similar stores and if you tag one automatically it gave an option to tag others also. This is gone… if you goto mcd 5 times u need to tag 5 times." — axio `5373e1d4 ★2 2026-06-06`
  - "Category auto selection doesn't work anymore" — `b17a12e1 ★1 2023-11-13 (👍110)`.
- **Trend.** Users of 8 or more years say it is getting worse.

### A6. Privacy unease about reading every message

- **FinArt: ~14 of 147 low reviews (10%), hand-counted.** The concerns are specific:
  - **OTPs:** "allowing to read all the message means allowing otp access also" (`832664df ★1 2024-03-27`, 👍137).
  - **Upload on by default:** "if you don't want to share the data you have to manually turn off the sharing by enabling private mode (paid feature). I would rather prefer to have it turned off by default" (`a7d4937c ★2 2023-05-21`, 👍80).
  - **Network access:** "why internet connectivity is required. Suspicious" (`dacd69f4 ★1`).
  - **No way to refuse:** "No option to not access your sms at all" (`de7aa609 ★1`).
- **axio: ~10 of 425 low (2%).** Most are about data deletion, data sale or spam calls, which follow from the loan business. Only 2 are about reading SMS itself (`4a955ac4`, "this app read all sms, otp etc. be aware"; and `f090e9e6`).
- **The mirror image is a delight.**
  - About 19 of 837 FinArt high reviews praise private or offline mode, or not needing bank credentials. Pattern: `privacy|private mode|offline processing|locally|on (my) device…|no…bank (account|details|credential)`.
  - About 5 high reviews still voice worry.
  - > "it runs algorithm in our mobile only rather than transfering data to some server I feel secured" — FinArt `6f3e8e4c ★5 2025-07-19`
  - > "the only thing I'm worry about is privacy of my data. They said my data is secured but I'm still worry." — FinArt `497b0a19 ★5 2024-10-03`
- **Trend.** FinArt's privacy complaints cluster in 2023–2024: 9 of the 14. That is roughly in line with the sample, since 85 of FinArt's 147 low reviews are from those years, so it is not a clear trend.

### A7. Monetisation erodes trust in the capture product

- **axio pivots to loans and BNPL.** This is **noise for capture, but it drives churn.**
  - Loan and BNPL complaints: **112 of 425 low (26%)**, including 82 of 326 low reviews in 2026. Pattern: `loan|pay ?later|emi|credit limit|cibil|foreclos|interest|penalt|late fee|recovery|disburs`.
  - The capture-relevant point is that users read the pivot as neglect of the tracker:
    - > "seems like they are focusing more on sales of their financial product than the original purpose of the app." — `23dee2b4 ★1 2026-04-30`
- **FinArt hides the trial and paywalls automation.**
  - 14 of 147 low reviews mention the trial, 6 say it was never disclosed, and 18 complain about price.
  - The automatic part is what gets locked:
    - > "after the free period the automatic sms based expenses tracking won't work" — `a7d4937c`
    - > "Shud hv told it's trial period. I wouldn't have spent so much time editing the data" — `acfaf7f5 ★1`
  - Even 46 of 837 high reviews call it pricey, while 19 say it is worth it.
  - Some paid users lost their entitlement after changing phones (6 low reviews), e.g. `c34721a3`, a lifetime purchase with no restore option.

### A8. Reinstalling or changing phones loses data or re-ingests history

- **Prevalence.** axio 14 low reviews. Pattern: `lost…(years|data|months)|data…gone|restore|backup`. 8 of these are from 2026.
- **Quotes:**
  - > "since 2014 i was using it… they lost my 11 years of data" — `7f3ead72 ★1 2026-07-10`
  - > "It read the SMS's all over again instead of just migrating the existing data" (and the user's categories were lost) — `51451c9e ★3 2026-06-27`

### A9. Battery drain from always-on listening

- **Prevalence.** axio 4 reviews.
- **Quotes:** "36% in 24 hours" (`665e16c9 ★4 2022-08-16`), followed by "Battery drainage has been fixed" (`27e8c17a ★4 2023-08-31`).
- **The trade-off.** Throttling the background listener causes missed SMS (`16a20d48`).

### Delights for the SMS parsers

- **D1. No data entry at all.**
  - **Prevalence:** FinArt **91 of 837 high (11%)**, axio **29 of 543 high**. Pattern: `automatic|auto[- ](track|captur|…)|reads (the|my) sms|sms[- ](based|tracking|…)|without…manual|set and forget|does the rest`.
  - > "This app, just does it automatically with one click. You give it permissions it needs. Thats all. You have last 6 months of your data in front of you." — axio `0d71fca7 ★5 2021-03-04 (👍92)`
  - > "The only budget app that works! Simply because it tracks all my expenses through sms." — FinArt `2ba5810b ★5 2023-01-07 (👍31)`
  - > "Hands down the best app… Set and forget… it does the rest." — axio `adf08ca7` (in 2026 the same user dropped it to 3★ over missed SMS)
- **D2. Works without bank credentials or open banking.** About 8 explicit reviews, plus the privacy praise in A6.
  - > "As it reads only the messages it's safe to not have my credentials given to any 3rd party" — axio `f107e9a8 ★5 2020-09-08`
  - > "No bank in my country allows for information access to third party so the sms scan is god sent." — FinArt `37d64bca ★5 2019-06-30`
- **D3. It learns from one correction.**
  - **Prevalence:** FinArt 9 high reviews. Pattern: `learn|from next time|similar…|applies that association|all similar`.
  - > "Once you tag a transaction to a category, from next time onwards, it applies that association correctly." — FinArt `926b06cb ★5 2022-10-13`
  - > "if a transaction is wrongly categorized, it allows to change it manually and automatically updates the remaining similar transactions by itself. This is so unique…" — FinArt `f23157e1 ★5 2023-06-24 (👍37)`
  - > "I do not have to do anything except selecting category for new merchant… All other things it does automatically." — axio `7000a7cc ★5 2026-09-22`
- **D4. A report-and-fix loop for missed messages.**
  - **Prevalence:** FinArt support praise appears in **50 of 837 high reviews**. Pattern: `(support|team)…(great|quick|prompt|helpful|resolved|within)`.
  - > "even if it misses something, you can report and they will fix it." — FinArt `6f8392ec ★5 2023-03-03 (👍26)`
  - **The contrast:** axio's "report undetected messages" flow (8 mentions) is described as broken. "Request to Support… displays a 'Failed request Support' error" — `8fdbaafd ★2 2025-01-30 (👍40)`.
- **D5. Fluency with the local ecosystem.** These are individual reviews, not counts:
  - UPI to merchant mapping (`1d1b57a3`).
  - Wallet-recharge handling and refund matching (`a4241a2d`, `2bcc23a2`).
  - Spanish card SMS parsed correctly (`eb5a5693`).
  - Multi-currency for Indians working abroad (`b9575061`, `9b6a731d`).

---

## Part B — Bank-sync apps (Rocket Money, Emma, Wallet)

### B1. Bank connections break, and the user pays for the breakage

- **Prevalence** (narrow pattern, below):
  - **Wallet: 138 of 444 low (31%).** 80 of those 131 also mention paying for premium or lifetime, or a refund.
  - **Rocket: 87 of 993 (9%).**
  - **Emma: 26 of 642 (4%).**
  - Pattern: `(sync|connect|link)…(not work|fail|stop|error|disconnect|again|every (day|week)|keeps|never|won't|can't)|disconnect|reconnect|re-?link|re-?authori|(can't|unable to|couldn't|won't|not) connect|plaid|saltedge|bank not (connected|supported)|(stopped|removed) support`.
- **Quotes:**
  - > "One bank synced initially, but stopped working after a few days… they blamed the bank… without the bank sync option, I don't think it's worth using this app even though I already paid for it." — Wallet `1a4d3452 ★2 2022-12-21 (👍76)`
  - > "I bought the lifetime subscription 4 months ago and the bank sync has never worked… Now they've even removed SBI from the supported bank list." — Wallet `557415ee ★1 2026-07-25`
  - > "more accounts have been disconnected and the rocket team says there is nothing they can do. They recommend I SWITCH BANKS" — Rocket `144bce8a ★1 2023-12-16`
- **Relevant to Malaysia.** Three Wallet reviews:
  - > "The AmBank Fastlink connection is broken" — Wallet `7ffea622 ★1 2026-05-18`
  - > "put all major bank in malaysia like cimb and maybank in options" — Wallet `47959ab0 ★1 2026-07-07`
  - `bf81dc21 ★3 2026-06-24` says the same.
- **Trend.** The share of low reviews hitting the broad sync pattern is persistent, not improving:
  - **Wallet:** 52% in 2023, 41% in 2024, 38% in 2025, 32% in 2026.
  - **Rocket:** 23–27% in 2022–2024, then 12% in 2026, diluted by the paywall complaints.

### B2. Stale or late data

- **Prevalence.** Rocket 30, Emma 14, Wallet 11 low reviews. Pattern: `days later|delay|syncs every|not real.?time|outdated|months old|updated x days ago|once a day|uncleared|pending`.
- **Quotes:**
  - "Real time sync? A total joke, my account syncs every 6 days" — Rocket `5faf412f ★2 2022-02-28 (👍160)`.
  - "notifications are just so delayed… I mean days" — Emma `eda8767d ★2 2020-01-11`.
  - "It says 'updated x days ago' and there is no button to sync" — Wallet `5c21f2d9 ★1 2026-05-17`.

### B3. Duplicates and gaps after reconnecting

- **Prevalence.** Rocket 37, Wallet 10, Emma 6 low reviews mention duplicates.
- **Quotes:**
  - > "One month it didn't track every purchase but then this month most of my purchases are entered twice" — Rocket `9f726614 ★2 2023-03-31 (👍193)`
  - > "When I reported this problem I was told to basically fix it myself by merging transactions." — Wallet `c59695ac ★2 2018-11-17`
  - "When it gets reconnected its missing transactions during the off periods" — Rocket `144bce8a`.

### B4. Miscategorisation and rules that don't stick

- **Prevalence.** Small by regex: Rocket 6, Wallet 6, Emma 4 low. Pattern: `categor…(wrong|mis|not work|again|manually)|miscategori|rules? (don't|doesn't) (work|apply)`. The complaints that do appear are among the most upvoted.
- **Quotes:**
  - > "Once, it decided that three conflicting rules all applied… all of my credit card transactions were recorded as business income AND child support!" — Rocket `2dfa1da0 ★2 2023-01-17 (👍166)`
  - > "It miscategorizes EVERYTHING. I spend more time fixing this app's transactions than I did when I was manually data entering" — Wallet `fc38f20e ★1 2026-08-29`
  - > "an app like this should learn from previous categorizations, but it doesn't." — Rocket `33722349 ★1 2025-02-20`
  - > "there is no way to stop their auto subscription detection… support deemed [a disable checkbox] not a necessary feature." — Rocket `c063df60 ★1 2026-05-12 (👍112)`

### B5. Subscription detection misses (Rocket and Emma)

- **Prevalence.** Rocket **40 of 993 low**, Emma **9 of 642**. Pattern: `(didn't|not|only|never) (find|detect|catch|recogni|identify)…(subscription|recurring)|only found half|add them manually`.
- **Quotes:**
  - "It only got around half of mine" — Rocket `01a020e3 ★2 2024-06-05 (👍114)`.
  - "Couldn't find all my payments, making me add them individually, which defeats the purpose" — Emma `ce972536 ★1 2026-03-12`.

### B6. The "we cancel for you" service doesn't cancel (Rocket)

- **Prevalence.** **53 of 993 low.** Pattern: `(couldn't|unable|didn't|never|doesn't) cancel…|instructions/links to cancel|cancel it myself|still charged`.
- **Quotes:**
  - "I have logged in to the app cancelled it through rocket money only to have the same charge come around a month later." — `f79ecd30 ★3 2022-12-11 (👍199)`
  - "they just have links that take you to the website to do it yourself" — `3995e8bd ★1 2025-05-29 (👍920)`

### B7. The app's own subscription: surprise annual charges, cancellation dark patterns, and the free tier hollowed out

This is the largest low-review cluster for all three apps.

- **Rocket:** surprise or annual charges in **140 of 993 low**. Dark-pattern words in **85**. Bill-negotiation fee anger in **70**. In 2026, 263 of 678 low reviews mention premium, paywall or charges, often paired with "not as advertised" (28 low).
- **Emma:** surprise charges in **41 of 642**. Dark patterns in **49**. "Moved behind paywall" in **77**.
  - **Trend:** paywall words appear in 23% of low reviews in 2022 versus 51–57% in 2024–2026, after features moved to the paid tier in April 2024.
- **Wallet:** refunds in **35 of 444 low**, mostly "paid for sync that didn't work".
- **Patterns:**
  - Charges: `charg…(year|annual|without|never|$|£)|billed annually|auto.?renew|without (consent|notice)|no reminder|refund`.
  - Dark patterns: `are you sure|hard to cancel|retention|\d+ (step|page|click)|trick|sneaky|deceptive|predatory|misleading|shady`.
- **Quotes:**
  - > "they don't tell you about adding a subscription of their own and charging you $60 dollars. It doesn't even show you that they charged you" — Rocket `d0a94ae4 ★2 2022-12-26 (👍1391)`
  - > "signed up for a seven day free trial… now I have been charged £83.00 for a years subscription" — Emma `ed0cbeec ★1 2025-07-05 (👍308)`
  - > "any app that needs more than 5 'yes I'm sure I want to cancel my subscriptions' to be pressed… can get in the bin." — Emma `66a2bc41 ★1 2026-04-05`

### B8. Privacy of bank credentials

- **Prevalence.** Small: Rocket 11, Emma 5, Wallet 3 reviews.
- **Quotes:**
  - Plaid security breach — Rocket `98027927 ★1 2026-09-01`.
  - "3rd parties may keep my data even after I withdraw my consent" — Emma `55b5b974 ★2`.
  - Some people choose manual entry over sync: "we use it without bank syncing… that weirds me out" — Wallet `3974c7e4 ★4 2022-07-03`.

### B9. Nagging or condescending notifications (Emma)

- **Prevalence.** 35 of 642 low.
- **Quotes:**
  - "the app screeching 'OMG SLOW DOWN YOU'LL RUN OUT OF MONEY' at every large expense" — `23076264 ★2 2020-10-07 (👍39)`.
  - "I don't want to be woken up with a notification telling me to 'rise and shine' with my bank balance" — `d895bde9 ★1 2025-07-01 (👍55)`.

### Delights for the bank-sync apps

- **Set-and-forget import.**
  - **Prevalence:** Rocket **57 of 1,041 high**, Wallet 40, Emma 11.
  - > "once the initial set up was done, the numbers didn't have to be entered manually." — Rocket `2997bf64 ★5 2025-07-04 (👍1049)`
- **Found forgotten subscriptions.**
  - **Prevalence:** Rocket **55 high**.
  - "I found 3 subscriptions that I no longer use" — `57472635 ★5 (👍247)`. "It saved me $135 per month" — `9ae09577 ★5 (👍212)`.
- **Every account in one place.** Rocket 37 high, Emma 22.
- **Alerts on unusual charges.**
  - > "when my credit card has been charged a larger than usual amount… gives you a chance to get on top of a possible theft." — Rocket `00ee678e ★4 2025-04-23 (👍902)`
- **A queue of reviewed and unreviewed transactions.**
  - > "Lets me know what has been reviewed and what hasn't so I'm never wasting time reviewing it more than once." — Rocket `1fa2427d ★5 2025-03-15 (👍355)`
- **A hybrid of manual entry and sync, with a CSV fallback** (Wallet). Users keep the app even when a bank won't connect:
  - "it was easy to download the .csv files and upload them here for my backlog" — `a41671a5 ★5 (👍33)`
  - "allows you to manually record cash, as well as automatically recording bank cashflow" — `41a01d3c ★4 (👍88)`

---

## Part C — Review-before-add versus fully automatic entry (across all five apps)

Few reviews talk about this directly: about 15 explicit statements, so treat these as directional. Still, they agree with each other.

1. **Users accept teaching an app once. They reject checking it again and again.**
   - Teaching once is praised: "selecting category for new merchant… all other things it does automatically" (axio `7000a7cc`), and FinArt's "from next time onwards" (`926b06cb`).
   - Repeated checking is resented:
     - "Every expense that is automatically logged has to be double checked which defeats the purpose of the app" — axio `8b874976 ★3 2019`.
     - "If I had to do it manually why would I get a paid subscription app?" — FinArt `38092fe5 ★1`.
     - "we shouldn't have to manually verify the sums" — FinArt `8c911bce ★1`.
     - Rocket `33722349` makes the same complaint.
2. **Users like a prompt at the moment they pay, and miss it when it is gone.**
   - "add a feature that would… return to axio screen back, asking for category and tagging… becoz the upi message most of the times merchant name will be there not the shop name" — axio `d65506a0 ★5 2026-08-29`.
   - "no more notification of payments… all getting categorized as 'unknown'. i won't know until i open the app. earlier used to get notified along with the UPI SMS" — axio `3462550d ★1 2026-07-26`.
3. **Users want to trace an entry back to its source.** "after clicking on any item/transaction there should be capability to take me to that SMS so that we can reverify" — FinArt `962b78e5 ★4 2025-01-15`.
4. **Users want an off switch for automatic creation.**
   - "There is no option to stop automatic sms tracking" — axio `fda51c5a ★1 2026-07-12`.
   - Rocket's auto subscription detection has no off switch — `c063df60` (👍112).
5. **Users want doubtful items shown to them, not silently added or silently merged.** Examples are the duplicate-tab and flag requests in A3, and the over-merge complaint in `e065eca6`.
6. **A review queue only works if it remembers what has been reviewed.** Rocket `1fa2427d` (👍355).

---

## Part D — Noise kept separate

- **axio loans, BNPL and Amazon Pay Later:** 112 of 425 low reviews (26%). This is lending-service anger (harassment, foreclosure, CIBIL) and does not bear on capture quality. It matters to Moni only as a warning that cross-selling credit erodes trust in the tracker.
- **axio OTP and sign-up failures:** 21 of 326 low reviews in 2026, mostly a September 2026 cluster ("OTP not receiving while sign up"). This is an account-infrastructure outage, not parsing.
- **Rocket bill negotiation** (70 low), **credit score and Smart Savings** (23 low), **Emma investing and loan upsell.** These are product-line complaints that do not involve capture.
- **Wallet category-system rigidity:** a long tail of "can't add top-level categories" complaints. This is a core-product issue that falls outside this slice.

---

## Implications for Moni

Each item says how the theme bears on Moni (supports, threatens or missing) and whether the claim is evidence-backed or inferred.

1. **Silent capture failure is the main risk. Moni needs capture-health monitoring.** _Threatens; missing._ **Evidence-backed** (A1: 16% of axio low reviews and 14% of FinArt's; users notice days later; the May 2025 outage).
   - Show "last captured from <source> N hours ago" for each source.
   - Alert when a source that usually fires daily goes quiet.
   - Alert when Android revokes or disconnects the notification-listener permission, which happens after updates and when OEM battery managers kill the listener.
   - _Inferred:_ this matters more for Moni than for the SMS apps. A notification listener is easier to kill than an SMS inbox, and notifications can't be rescanned later the way axio and FinArt rescan the SMS inbox.
2. **Format and channel drift will hit Moni too. Plan for it.** _Threatens._ **Evidence-backed** for the mechanisms (A2: sender-ID changes, the move from SMS to RCS and WhatsApp, a new default messaging app, One UI updates).
   - _Inferred:_ Moni reads notifications, not SMS, so RCS, Google Messages and WhatsApp bank alerts all reach it as notifications. That is a structural advantage over axio, but only if Moni identifies sources by app package and message content rather than a hard-coded sender list.
   - _Inferred:_ LLM-based parsing should tolerate wording changes better than regex templates. It still needs a working one-tap "this notification was a transaction, you missed it" report. axio's report flow failing was its own complaint (`8fdbaafd`, 👍40).
3. **Moni's model of reviewing the first transaction of a kind and auto-adding matches is well supported.** _Supports._ **Evidence-backed** (Part C items 1 and 6; D3, where FinArt's learn-once behaviour is its most specific praise).
   - Keep review a one-time teaching step, not a recurring audit.
   - _Inferred_ additions that users asked for elsewhere:
     - "apply to all similar" when the user corrects an auto entry (axio `5373e1d4`);
     - a link from every Auto entry to the source notification text (FinArt `962b78e5`);
     - an off switch for auto-add per source (`fda51c5a`, `c063df60`);
     - a reviewed or unreviewed state (Rocket `1fa2427d`).
4. **Duplicate detection and transfer pairing target real, recurring complaints.** _Supports._ **Evidence-backed** (A3, A4, B3).
   - Requirements implied by the reviews:
     - Pair the bank-app notification with the e-wallet or merchant notification for the same purchase. This is the two-SMS problem in `4cdc9c68` (👍108).
     - Treat credit-card bill payments and e-wallet top-ups as transfers, not spending.
     - Link refunds across payment methods.
     - Never silently merge legitimate repeated identical amounts (`e065eca6`).
     - Put suspected duplicates in a visible queue rather than deleting them.
   - _Inferred:_ the Malaysian equivalents are Touch 'n Go or GrabPay reloads funded from a bank, and the bank-plus-DuitNow pair of notifications.
5. **Privacy at the moment Moni asks to read notifications will decide adoption.** _Threatens if handled badly._ **Evidence-backed** (A6: 10% of FinArt low reviews; OTP access is the named fear; upload on by default and a paid private mode were punished).
   - Say at permission time what Moni reads and what it discards.
   - Drop OTP and non-financial notifications on the device before any parsing.
   - If notification text goes to a cloud model, say so plainly and offer an on-device or opt-out path. Never charge for privacy.
   - _Inferred:_ the brief does not say where Moni's notification parsing runs, and that answer matters more than any feature.
6. **"No bank connection" is a selling point in Malaysia, not a gap.** _Supports._ **Evidence-backed:**
   - Wallet's top complaint is broken sync (31% of its low reviews), and 80 of those users had paid for it.
   - Malaysian users specifically can't connect CIMB, Maybank or AmBank (B1).
   - SMS-app users praise not handing over bank credentials (D2).
   - _Inferred_ caveat: iOS users get no passive capture. FinArt and axio users cite the lack of iOS as a reason to leave (`4ecff996`, `3df63b37`), so Moni's iOS experience needs chat, voice and receipt capture to be fast.
7. **Parse currency from each notification. Never assume MYR.** _Threatens if missed._ **Evidence-backed:**
   - "AUD 50 tracked as INR 50" (`d0aec62a`).
   - Rocket read ¥1500 as $1590 (`144a05a0`, 👍101).
   - This directly tests Moni's multi-currency claim.
8. **Restore and reinstall must not lose data or re-ingest history as new entries.** _Threatens; partly supported by offline-first._ **Evidence-backed** (A8: reinstalling to fix capture led to restore failures and lost categories).
   - Make restore idempotent: match restored entries to existing ones, for example by a source-notification hash.
9. **Use the balance in notifications to catch missed captures.** _Missing._ **Inferred**, but users asked for it:
   - "alert the user when the bank balance logged on the app doesn't matches with the latest balance given by the SMS" — FinArt `7e88a882 ★5` (👍16).
   - A balance-delta mismatch is a cheap signal that a transaction was missed (see item 1).
10. **Monetisation guardrails.** _Threatens if ignored._ **Evidence-backed** (A7, B7):
    - Don't gate automatic capture behind an undisclosed trial (FinArt).
    - Don't cross-sell credit inside the tracker (axio).
    - Don't charge annually when a monthly price was shown, or bury cancellation (Rocket, Emma).
    - Emma's share of low reviews about the paywall went from 23% to over 50% within two years of moving features behind it.
11. **Keep notifications informational and calm.** _Inferred, by analogy:_ Emma has 35 low reviews about notification tone. When Moni tells users about Auto entries, the message should state facts: "Added RM12.50 · Grab · Food — tap to change".
12. **Background reliability on OEM phones needs onboarding help.** **Evidence-backed** for the problem (`16a20d48` 👍143; `365ab20e`; `32064874`). **Inferred** for the fix: guide users through exempting Moni from battery optimisation and auto-start limits on Xiaomi, Samsung, Oppo and Vivo, and re-check the setting periodically.
