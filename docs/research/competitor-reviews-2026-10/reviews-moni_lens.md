# Moni lens: what the market says about each Moni capability

Slice: `moni_lens`. This report is organized by feature, not by app. It covers all 25 review files: 29,934 unique reviews, of which 9,477 are low (1–2★), 18,393 high (4–5★) and 2,064 mid (3★).

**Method.** I counted with a session-only script (not kept). It takes a regex plus optional `--and`/`--not` filters, dedupes reviews by store+id, and splits the hits into low, high and mid, per app. Feature requests come from a session-only script (not kept), which buckets only the sentences that carry request wording. Every count below is "reviews matching the pattern", written L = low and H = high. The regexes are deliberately narrow, so treat the counts as lower bounds.

**Quote format:** `[app ★ date …id8]`.

**Noise handling.**

- MAE and Ryt Bank are excluded from SMS, notification and privacy counts, because there "SMS" means OTP/TAC.
- Cleo's cash-advance reviews are kept separate.
- "AI as a support gate" complaints are counted apart from AI-feature feedback.
- Expensify's GPS mileage reviews are excluded from location.
- Rocket Money's "subscription tracking" is not counted as subscription anger.

---

## 1. Automatic capture: SMS, notifications, bank sync

### 1a. SMS and notification reading (Moni's model)

**Volume.** 268 reviews (93 L / 149 H), excluding banking apps and OTP talk. Almost all come from FinArt (29 L / 99 H) and axio/Walnut (50 L / 28 H). The rest are scattered across manual apps, mostly as requests.
Pattern: `\bsms\b|text messages|(read|scan|parse)… (sms|messages|notifications|inbox)|notification (access|listener|reading|parsing)` with `--not otp|tac|verif|code`.

**What users praise.** Zero-effort completeness and "it just knows", including edge cases like cashback and wallet top-ups.

- "I tried every finance manager with auto sms transaction updates … this one is the only app that could track the cashback and show everything with 100% accuracy." `[finart 4★ 2018-09-23 …dddde574]`
- "The automated SMS tracking is incredibly accurate, sorting my UPI, credit card, and bank transactions into categories instantly." `[axio 5★ 2026-07-19 …f0688cf5]`
- "USP is that it can automatically record transactions fetching information from the sms … I haven't seen any other app do so." `[finart 5★ 2024-06-16 …0fc5acdd]`

**How it fails.** 76 reviews pair capture with failure words (43 L / 24 H). axio accounts for 33 L of them.
Pattern: capture regex `--and "stop(ped)|not (detect|captur|track|read|pick|import)|miss|fail|duplicate"`.

| Failure mode                                                                                 | Example                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Silently stops after an update or OS change                                                  | "It's been 3 days since the SMS stopped getting auto detected … re-installed the app. Now, the backup doesn't get restored" `[axio 5★ 2025-05-13 …9c213c02]` (93 👍)                                                                                                             |
| Switching to Google Messages broke rescans                                                   | `[axio 4★ 2025-05-09 …145b0699]`                                                                                                                                                                                                                                                 |
| Partial coverage of banks and senders                                                        | "Messages of Expenses and Credit transactions are not detected … Punjab National Bank, Indian Overseas Bank Credit Card" `[axio 2★ 2026-09-29 …8ec01a03]`. Also "it often misses big transactions too" `[finart 1★ 2025-08-22 …886bdbb0]`                                        |
| The OS kills the background reader                                                           | "Background battery consumption is way to much! If we try to optimize … it misses out on reading expense SMS." `[axio 3★ 2022-10-01 …16a20d48]` (143 👍)                                                                                                                         |
| Permissions granted, nothing captured (MonAi, the closest Moni analogue, notification-based) | "Le di todos los permisos … y aún así no reconoció ningún gasto … Ni las notificaciones de SMS, ni las notificaciones de Google Wallet" `[monai 2★ 2026-02-19 …f5190f83]`. Also "notified me of expenses … yet not a single expense was saved" `[monai 2★ 2025-07-06 …74022fdd]` |

**Trend: getting worse at axio.** Capture-failure reviews per year: 2023: 2, 2024: 1, 2025: 13, 2026: 44 (out of 848 reviews in 2026). FinArt stays flat at 0–3 a year.

**Effect on trust.** One miss destroys the value of the whole ledger, because the reports become "unreliable".

- "NOT DETECTING ALL TRANSACTIONS which makes it's reports and analysis unreliable … I can not rely on this app" `[finart 1★ 2025-08-22 …886bdbb0]`
- "it doesn't detect all sms … So its not trustworthy and usable for monthly expenses" `[axio 1★ 2026-10-14 …4c8b0ff5]`
- Users ask for a manual "check recent messages" button: `[axio 2★ 2026-09-02 …8d3179d0]`.

### 1b. Bank sync (Plaid and similar; Moni deliberately lacks this)

**Volume.** 601 reviews (351 L / 170 H).

- Monarch 73 L, Wallet 60 L, Rocket 46 L, Cleo 43 L, YNAB 38 L, Copilot 37 L.
- Pattern: `(bank|account)s? (won't|doesn't|not|keeps?|stopped) (sync|connect|link|updat|refresh)|disconnect|re-?(link|connect)|plaid`.

**Trust effects.** 102 L / 45 H reviews link a sync or capture problem to unreliability, "useless", or having to enter things manually.

- "It doesn't notify when an account disconnects, so you can be looking at incorrect numbers and not know." `[ynab 2★ 2023-07-07 …0e6bb6bd]`
- "All my Chase accounts have lost connection for the last 22 days … I have cancelled." `[monarch 1★ 2025-10-28 …7bdb6721]`
- "For over 3 months my bank couldn't connect to Plaid … What a poor business model" `[copilot 1★ 2023-11-20 …06508100]`

**When automation works, the praise is about effortlessness.** 79 high reviews say things like "don't have to enter / effortless / hands-free".

- "set up to get live updates from most accounts so that I don't have to enter transactions … phenomenal and effortless" `[monarch 5★ 2025-05-14 …cf181848]`

**Apps:** FinArt, axio, MonAi (SMS/notification); Monarch, Copilot, Rocket, YNAB, Wallet, Emma, Cleo (bank sync).

## 2. Receipt scanning

**Volume.** 234 reviews (82 L / 126 H), but 202 of them are Expensify (63 L / 48 H) and SimplyWise (16 L / 52 H). Outside those two apps there are only 31 (3 L / 26 H), and they are mostly requests to attach a receipt photo.
Pattern: `receipt (scan|captur|photo|ocr…)|scan… receipts?|smartscan|\bocr\b|(photo|picture|snap) of … receipt`.

**Praise.** Self-populated fields and speed.

- "Seeing all the details self-populate (date, vendor, line items, tax, total, and suggested categories)" `[simplywise 5★ 2026-03-13 …23359ecf]`
- Monarch's "AI receipt scanner + transaction matching … found incidents where a merchant entered a different tip" `[monarch 5★ 2026-04-02 …417113c5]`

**Failures.** 80 reviews (38 L). Patterns: misreads, slow processing, the camera flow freezing, and multi-receipt queues dying.

- "Did not read scanned receipts properly … None of which recorded the receipt correctly" `[simplywise 2★ 2024-04-07 …0c625216]`
- "it makes mistakes reading totals and currencies" `[expensify 2★ 2019-06-11 …d9f46be7]`
- "I cannot snap a pic of a receipt … The app just logs out after I take a snap" `[ryt 3★ 2025-08-28 …6e8a4982]` (Malaysian)

**Demand in manual apps.** 1Money, Money Lover, Monefy and Wallet users ask for it.

- "Make it AI-powered to read receipts and create records simply by taking a picture … This would be a game changer." `[wallet 3★ 2026-02-02 …05269644]`

## 3. Voice and natural-language entry

**This signal is very thin.** A strict voice-entry regex yields 57 hits, and most are false positives ("speak to a human", "Sirius"). Genuine voice-entry mentions number fewer than 10. All of them are in Rolly and MonAi, which together have only 216 reviews.
Pattern: `voice (input|entry|command|…)|by voice|just (speak|say|talk)|speech-to-text|siri`.

- **Praise:** "I love how I can just speak to it and it records all my expenses" `[rolly 5★ 2024-12-08 …40825023]`. Also "all you need to do is chat what you did to your money and an AI will track and categorize it" `[rolly 5★ 2025-01-27 …6bb3606f]`.
- **Failures:** misclassified direction, "I made a conversation in the expense record but it was a income transaction. The AI … add the money to my wallet" `[rolly 5★ 2024-11-29 …29e9aad4]`. The balance doesn't follow the chat, "you … tell him the corrected exact balance, he will correct himself but the display is still not changed" `[rolly 2★ 2026-10-04 …d85a9bf1]`. Voice hangs, "It works really good typing what I said. But it gets stuck always at the end" `[monai 1★ 2025-01-10 …66942437]`.
- **A thin-product critique.** "es literalmente una aplicación que interpreta lo que digo con IA le pone una categoría con un emoji y hace una sumatoria… eso es!!!" `[monai 1★ 2025-06-04 …8026bcbf]`
- **Ryt Bank (Malaysian).** Users like paste-to-AI for transfers: "copy paste to AI and tell them what bank and account number with amount" `[ryt 5★ 2025-11-25 …bd954fda]`. Rolly's complaints are dominated by hard paywall and billing, not by the AI.

## 4. AI chat and assistant answers

**Volume.** 894 AI-feature reviews (250 L / 573 H), after removing 149 reviews about "AI as customer support". That support group is Cleo-heavy: 45 L.

- **Where the praise sits:** Origin 232 H / 30 L, Ryt Bank 113 H / 6 L, Monarch 44 H / 28 L, Cleo 54 H / 80 L.
- **Growth:** the share of reviews that mention AI rose from about 1% (2019–2024) to 5.0% in 2025 and 3.3% in 2026.

**Do they trust and use it?** Yes, when the AI is grounded in the user's own data.

- "it's not just a generic chatbot; it actually understands my specific financial data" `[origin 5★ 2026-01-15 …38112085]`
- "it looked through my spending and I was able to ask it credit questions" `[cleo 5★ 2026-07-23 …f5ea2bd9]`
- An ungrounded AI is called out: "it cannot read my actual account values so it's just a generic chat AI with no personalized insight" `[origin 4★ 2024-08-08 …86512655]`.

**Failures.** 127 reviews pair AI with wrong, useless, generic or confusing (75 L).

- "the AI feature can be a little daft" `[monarch 4★ 2026-09-17 …15764cd0]`
- "AI seem to be have hallucinations of ignore my transfer command" `[ryt 3★ 2025-12-29 …566825a3]`
- "conflicting information … provided by their AI chat" `[cleo 1★ 2026-07-25 …70c681cb]`

**Backlash against forced AI.** The strict pattern (`ai slop|can't disable … ai|forced ai|turn off ai|ai garbage`) finds 14 reviews (9 L), concentrated at Monarch. Monarch's AI-mentioning reviews spiked to 10 L in Dec 2025 when AI launched without an opt-out, then settled.

- "I DO NOT WANT AI SLOP IN MY FINANCIAL TOOL!" `[monarch 1★ 2025-12-18 …971688f8]`
- "No opting in or not, they are just sharing your data with who knows what." `[monarch 1★ 2025-12-19 …4f91db64]`
- "sloppy AI launch … signals a company that can't be trusted" `[monarch 1★ 2026-01-12 …e93d9ec8]`

**AI as a support wall** is a separate, large anger source: 98 L.

- "the only recourse is an AI that can't even give me a response" `[cleo 1★ 2026-07-10 …07fdb8e8]`

## 5. Auto-categorization and learning from corrections

**Volume.** Auto-categorization terms appear in 104 reviews (27 L / 66 H). The "categories + learn/remember/rules" pattern matches 261 (59 L / 172 H). Leaders: Monarch, Copilot, YNAB, Rocket.

**What delights.** Learning that generalizes a single correction.

- "In case a transaction is wrongly categorized, it allows to change it manually and automatically updates the remaining similar transactions by itself." `[finart 5★ 2023-06-24 …f23157e1]`
- "the AI categorization is so good. I only have to manually change maybe 2-4 transactions a month" `[copilot 5★ 2026-10-06 …34451706]`
- "I like that it learns how to categorize expenditures and notifies me when there are uncategorized items" `[rocket 5★ 2020-11-24 …951d71db]`

**What enrages.** Corrections that don't stick, cascades, and rules nobody can see.

- "Consistenly wrong categorization even after applying a rule. Treats my paycheck as shopping" `[rocket 3★ 2022-07-08 …ce4672e7]` (241 👍)
- "manual changes lead to a cascade of other expenses being moved to wrong categories" `[copilot 1★ 2025-04-02 …94173217]`
- "when I change the category and save it say it got saved but it remains in the same auto assigned category" `[axio 2★ 2024-10-01 …6eb0855c]`
- "inability to view, let alone manage rules … You have to contact support" `[copilot 3★ 2026-01-23 …66481670]`
- "It miscategorizes EVERYTHING. I spend more time fixing this app's transactions than I did when I was manually data entering" `[wallet 1★ 2026-08-29 …fc38f20e]`

**What people actually want, stated outright.** "pull transactions from my bank and then ask me how I want to categorize them and then learn from my choices" `[ynab 3★ 2026-07-16 …b9b5b082]`. This is almost exactly Moni's review-then-auto loop.

## 6. Duplicates and double-counted transfers

**Volume.**

- Duplicates: 152 reviews (75 L / 49 H), excluding double-charge billing. Leaders: Monarch 16 L, Rocket 11 L, Copilot 8 L, Money Lover 8 L, Expensify 8 L.
- Transfers counted as income or expense: 52 (21 L / 22 H).

**Moni-relevant failure: one purchase, two messages.**

- "it produces duplicate spends with respect to every SMS. Like If I order online I will receive two sms one from swiggy and one from my bank" `[axio 5★ 2020-09-24 …4cdc9c68]` (108 👍)
- "all Rupay card payments are incorrectly shown twice … this makes the final amount double" `[axio 2★ 2025-03-30 …4470f96e]`

**Effect on trust.**

- "random duplicates, random amounts, etc. so you couldn't rely on it" `[emma 1★ 2024-05-01 …f8164875]`
- "they're duplicating (which ruins my transaction history, cash flow, AND budget)" `[monarch 3★ 2025-12-30 …4318bbfa]`

**Transfers.**

- "When I transfer funds to a savings or another wallet, it will count as an expense." `[money-lover 5★ 2019-07-05 …bd4e3641]`
- "awful at recognising transfers between accounts … account balances be +/- $10,000" `[wallet 2★ 2021-12-29 …00d3d6a5]`
- "failing to detect simple things like TRANSFERS are transfers and not income" `[monarch 3★ 2022-10-16 …8af928b0]`

**Praise when handled.** "It does catch duplicate receipts, that's handy." `[simplywise 3★ 2026-03-07 …62516813]`

## 7. Review-before-add versus fully automatic, and the feeling of control

**Review flows are liked.** 66 reviews mention reviewing or approving transactions (21 L / 36 H; MAE's 7 L are about Secure2u payment approval, which is noise). Copilot and Monarch dominate the praise.

- "Brief prompts to review transactions I may not have seen yet" `[copilot 5★ 2020-01-31 …72304557]`
- "it prompts us to review transactions" `[monarch 5★ 2026-08-04 …d08310ff]`

**The review queue must be cheap.**

- "no checkboxes for the transactions to approve? I have to click EACH ONE manually?" `[ynab 3★ 2025-10-09 …1a6c75e3]`
- "all of a sudden there's 15 transactions to review … from 5 days ago" `[monarch 2★ 2025-02-25 …f04b9ef3]`

**Manual-by-choice is a real segment.** 40 reviews (10 L / 29 H) praise entering transactions manually or not linking a bank, for mindfulness or privacy.

- "it didn't link up to my bank but it's better that it doesn't … making me more self conscious about where my money goes" `[cashew 5★ 2025-01-09 …0c9b1df5]` (87 👍)
- "ability to budget without linking accounts … For the privacy sensitive" `[copilot 5★ 2023-03-01 …68353537]`

**Unwanted automation is rare but sharp.** 6 reviews: "can't turn off auto-categories" `[monarch 1★ 2026-03-11 …4527b711]`; "I can't turn off auto categorization in the mobile app" `[ynab 1★ 2026-10-13 …e8d2472c]`; "automatically hides it from my expenses" `[origin 2★ 2026-09-05 …f81812a6]`.

**Manual-entry burden.** Only 46 reviews (20 L) explicitly call manual entry tedious. But manual-app users frequently ask for automation: 67 reviews in 1Money, Cashew, Monefy, Money Lover, Money Manager, Rolly and Finory pair bank/SMS/automatic import with request wording (20 L / 39 H).

- "if you could add an option to automatically read balances and spends from SMS … Users just have to add the category or title then" `[cashew 5★ 2024-02-07 …8305603d]`. This describes Moni's proposal flow.
- "Please add parsing of SMS … where it shows the parsed SMS and there is an option t[o confirm]" `[money-manager 1★ 2026-04-10 …aa4d23e9]`

## 8. Privacy and trust: message, notification or bank access, and AI

**Volume.** 338 reviews mention privacy, data or permission terms (193 L / 125 H), excluding banking apps. 135 of them involve SMS, messages, notifications, permissions or access (86 L / 40 H).

**SMS and OTP fear is the single most-upvoted privacy review.**

- "allowing to read all the message means allowing otp access also. This looks dangerous." `[finart 1★ 2024-03-27 …832664df]` (137 👍)
- "How can you give me assurance that my OTP are safe and not read by yor app from SMS?" `[finart 4★ 2020-05-29 …5790b680]`
- Data sharing that is opt-out and paywalled: "you have to manually turn off the sharing by enabling private mode (paid feature). I would rather prefer to have it turned off by default" `[finart 2★ 2023-05-21 …a7d4937c]`
- Internet use during local parsing looks suspicious: "While mining the reports from sms it requires internet, when everything is happening offline then why … Suspicious." `[finart 1★ 2022-12-29 …dacd69f4]`

**Not reading SMS is itself praised**, by competitors' users.

- "does not read your SMS, like many others do" `[money-manager 4★ 2019-11-01 …e6d89dea]` (99 👍)
- "it won't ask you permission to read your messages or get your location" `[monefy 4★ 2021-10-06 …22db4ef2]` (141 👍)

**Reading messages can be framed as safer than bank credentials.** "As it reads only the messages it's safe to not have my credentials given to any 3rd party" `[axio 5★ 2020-09-08 …f107e9a8]`.

**Bank-credential fear.** 54 reviews (25 L / 26 H).

- "won't even let me finish the setup without directly connecting my bank account. I don't trust you with my bank information" `[simplywise 1★ 2024-03-22 …f2910806]`

**AI and privacy.** 42 reviews. Negative ones are Monarch-centred: forced AI read as data sharing (`…4f91db64`, `…fb68e59d`).

## 9. Offline use, data loss, shutdowns and migrations

**Data loss.** 194 reviews (135 L / 40 H). This is the most lopsided theme measured. Leaders: 1Money 38 L, Money Lover 24 L, Wallet 18 L, Monefy 12 L, Money Manager 10 L. Backup or restore failure: 41 (30 L).

**The 1Money shutdown and resurrection.** January 2026 alone produced 134 low reviews against a baseline of about 2 a month. 77 low reviews mention lifetime revocation.

- "I uninstalled and reinstalled it, only to discover that it does local backups only. I JUST LOST ALMOST FOUR YEARS OF DATA IN ONE DAY." `[1money 1★ 2026-01-07 …98f8b02e]`
- Recovery praise when the developer honored lifetime licenses: "my previous lifetime subscription reflected🥳" `[1money 5★ 2026-01-12 …11555818]` (117 👍)

**Logout wipes data.** "One day suddenly automatically logged out … all my data had disappeared" `[wallet 1★ 2024-08-02 …22f744d4]`.

**Mint's shutdown drove migrations.** 654 Mint mentions; 263 of them about the shutdown or migration (39 L / 211 H, mostly Monarch and Copilot). Migrants arrive with high expectations and judge on import fidelity.

**Offline is a weak but positive signal.** 51 reviews (19 L / 29 H).

- "does EVERYTHING one could want from an offline finance app" `[cashew 5★ 2024-10-12 …e3f84dfc]`
- "works completely offline if desired" `[cashew 5★ 2026-06-23 …14b09839]`

## 10. Multi-currency

**Volume.** 180 reviews (33 L / 125 H), almost entirely classic manual apps: 1Money, Monefy, Money Manager, Wallet, Cashew. It is a strong delight. The pain is exchange-rate staleness.

- **Delight:** "support for multiple currencies" listed as a core reason to buy `[1money 5★ 2019-08-18 …ac956f36]`. Also "Able to change the exchange rate manually (and add fees) for transfer within accounts" `[money-manager 4★ 2024-06-06 …983da50d]`.
- **Pain:** "Conversion of currency is locked with the exchange rate that you need to enter manually … No updated exchange rate after that" `[monefy 4★ 2023-06-17 …f1d8977a]`. Also "all the exchange rates are now wrong after the update, which affects all previous transactions" `[1money 1★ 2026-01-04 …25a7b9e0]`. And YNAB's lack of it earns a 1★ `[ynab 1★ 2025-09-18 …6855bb97]`.
- **Request:** "manually enter amount in BOTH currencies while adding transfer" `[cashew 5★ 2024-08-31 …df76db6f]`.

## 11. Pricing: subscription anger versus one-time praise

**Subscription anger.** 2,728 reviews (1,582 L / 924 H). Pattern: `subscription|paywall|price hike|too expensive|overpriced|rip-off|greed`, excluding subscription-tracking.

- **Leaders:** Rocket 286 L, Cleo 278 L, Emma 238 L, YNAB 146 L, Monarch 142 L.
- **Billing traps:** charged after cancelling, can't cancel, refused refunds, trial charges. 148 reviews (131 L / 11 H), the most one-sided theme in this report.
- **Price hikes:** 56 (43 L), led by YNAB with 34 L.

**One-time or lifetime.** 425 reviews (184 L / 218 H). The split is bimodal.

- **Praise:** Cashew 30 H / 1 L.
  - "the paid version is inexpensive and worth it (and not a subscription!)" `[monefy 4★ 2020-08-08 …75acf193]` (96 👍)
  - "At a cool $20.00 for lifetime access … happy to pay for such an open payment model" `[cashew 5★ 2024-10-12 …e3f84dfc]`
  - "I like the 1 time payment option they have instead of a subscription" `[money-lover 5★ 2025-04-14 …5f9e46f7]`
- **Betrayal when a lifetime licence is revoked:** 125 L. 1Money accounts for 77 and Wallet for 29 (lifetime bought, then bank support dropped).
  - "If you want to risk your money … I bought the lifetime subscription 4 months ago and the bank sync has never worked" `[wallet 1★ 2026-07-25 …557415ee]`

**Hard paywall before first use** is the main complaint in the AI-entry apps.

- "Hard paywall during onboarding :(" `[monai 1★ 2025-08-10 …4203262b]`
- "After spending a few minutes to personalize the app, then it asks to subscribe" `[rolly 2★ 2025-05-29 …ca8d6cee]`

## 12. Budgets and debts

**Budgets.** Mentioned in 4,032 reviews (730 L / 3,003 H). This is the core value word in high reviews.

- Flexibility requests (rollover, pay-period budgets, custom month start): 106 (21 L / 75 H).
  - "I can't budget by pay period so I end up using a spreadsheet" `[monarch 2★ 2025-09-18 …2d5f8e0e]`
  - "I wish you could have certain budgets rollover to the next month" `[origin 3★ 2024-04-09 …855c6ad1]`
  - FinArt praise for a custom month start: "most important feature is that it let's me set the start of month and scans sms" `[finart 5★ 2019-04-29 …a4241a2d]`

**Debts and lending.** 139 reviews with a word-bounded pattern (33 L / 90 H). This is a modest, mostly positive niche.

- "I wish the lending and debt repaying record weren't categorized amongst other spending and earnings because it gives false information" `[wallet 5★ 2024-09-14 …8bad7735]` (143 👍)
- "If your accounts are manual, Copilot cannot track your debt payoff. At all." `[copilot 2★ 2025-11-21 …26198708]`
- "add buttons to mark the spend as loan and income as borrowed" `[axio 4★ 2026-09-25 …9485b292]`

## 13. Location and map features

**Near-zero signal.** A strict pattern (geo-tag, location field, map of spending, where I spent) yields 26 reviews (4 L / 21 H), and only about 10 are real feature talk. No review in the corpus asks for a spending heatmap.

The best evidence treats location as an input that speeds up entry, not as a visualization:

- "It can geo-tag and then repeat those details (bank account, category) the next time you make a purchase in that area." `[ynab 5★ 2022-04-06 …fdd659a3]`
- "automatically populates your payee based on your location … arguably the best feature" `[ynab 5★ 2020-02-17 …d43445a0]`
- Requests: "add a location field … and can thus filter on it" `[money-lover 4★ 2024-06-24 …88e7411a]`. Also "why Android didn't have the function to add location attached to each transaction like iOS?" `[money-lover 1★ 2026-04-19 …3210342c]`.
- Monefy users are praised for not being asked for location `[…22db4ef2]`.

---

## Ranking: which of Moni's features users value most

Ranked by the volume and intensity of praise, and by the number of requests from users who don't have the feature.

| #   | Moni feature                                                                 | Evidence                                                                                                                         | Label                                 |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | **Automatic capture that is complete** (notification parsing)                | FinArt 99 H; 342 H praise "automatic(ally)"; 67 manual-app users ask for it; bank-sync users' praise is all about effortlessness | evidence-backed                       |
| 2   | **Budgets**, with flexible periods (pay-day or custom month start, rollover) | 3,003 H mentions; 106 flexibility asks                                                                                           | evidence-backed                       |
| 3   | **Fair pricing** (lifetime or one-time, free core)                           | 218 H one-time praise; 1,582 L subscription anger; 131 L billing traps                                                           | evidence-backed                       |
| 4   | **Data durability** (backup, restore, export)                                | 135 L data loss vs 40 H; 1Money's Jan-2026 spike of 134 L; export/import is the #3 request                                       | evidence-backed                       |
| 5   | **Categorization that learns from one correction**                           | FinArt and Copilot praise; Rocket and Copilot rage when corrections don't stick                                                  | evidence-backed                       |
| 6   | **Multi-currency** with up-to-date rates                                     | 125 H / 33 L; stale rates are the main pain                                                                                      | evidence-backed                       |
| 7   | **Grounded AI chat** (answers from the user's own numbers)                   | Origin 232 H, Ryt (MY) 113 H; "generic chat AI" criticized                                                                       | evidence-backed                       |
| 8   | **Receipt scan**                                                             | strong in SimplyWise and Expensify; repeated asks in manual apps; small outside those apps                                       | evidence-backed, small                |
| 9   | **Duplicate and transfer pairing**                                           | rarely praised by name, but its absence produces 75 L duplicate reviews                                                          | evidence-backed (as a hygiene factor) |
| 10  | **Debts**                                                                    | 90 H / 33 L, niche                                                                                                               | evidence-backed, small                |
| 11  | **Voice / NL entry**                                                         | fewer than 10 genuine mentions (Rolly, MonAi)                                                                                    | thin evidence                         |
| 12  | **Location heatmap**                                                         | no demand found; location is valued only as an autofill input                                                                    | evidence-backed (absence)             |

## Failure modes Moni must design against

1. **Silent capture gaps.** axio failures went from 1 in 2024 to 44 in 2026; MonAi "gave all permissions, nothing recognized"; YNAB "incorrect numbers and not know".
   - Moni design: a capture-health indicator (last notification seen per source), a "missed one? rescan" action, and warnings when battery optimization or notification access is revoked. _Evidence-backed._
2. **Duplicate spends from multi-source messages.** Merchant + bank or wallet + bank (axio …4cdc9c68, …4470f96e).
   - Moni's duplicate and transfer pairing directly addresses this. Make merges visible and reversible. _Evidence-backed._
3. **Corrections that don't stick, and invisible rules.** Rocket …ce4672e7, Copilot …94173217 and …66481670.
   - Moni's "learn from history → Auto" must apply the user's latest correction. It must show why a transaction was auto-added, and let the user see and undo the rule. _Evidence-backed._
4. **Data loss on logout, update or shutdown.** Covers local-only backups and lifetime licences revoked (1Money: 134 L in one month).
   - Offline-first is an asset only if export and restore are trivial and tested. Never tie data access to a subscription state. _Evidence-backed._
5. **SMS and OTP privacy fear.** FinArt …832664df, 137 👍.
   - Moni reads notifications, not the SMS inbox. Say so explicitly. State that OTPs are ignored and what leaves the device. Make data sharing opt-in, never a paid "private mode". _Evidence-backed for the fear; inferred for the remedy._
6. **Forced or ungrounded AI.** Monarch's Dec-2025 spike; "generic chat AI"; AI as a support wall (98 L).
   - Keep AI optional and grounded in the on-device metrics snapshot. Never put AI between the user and a human. _Evidence-backed._
7. **Hard paywall and billing traps.** 131 L billing-trap reviews; MonAi and Rolly onboarding paywalls. _Evidence-backed._
8. **Review-queue fatigue.** "click EACH ONE", "15 transactions to review".
   - Batch approve, plus fast escalation to Auto, keeps the "control" benefit without the chore. _Evidence-backed._
9. **Platform parity.** "a bunch of features of iOS are not in android. Even though we both pay" `[monai 2★ 2026-06-13 …09b009ca]`.
   - Moni's iOS has no notification capture, so be explicit on the paywall and in the store copy. _Inferred from MonAi's reverse case._
10. **Source-side notification unreliability (Malaysia).** MAE users report missing receive/QR notifications (about 10 reviews, e.g. `[mae 2★ 2026-10-04 …25792385]`). Ryt users praise "a notification for every transaction" (`…ffe50123`, `…b1da67cc`).
    - Moni's capture is only as complete as each bank's push behaviour. Per-source coverage notes are needed. _Evidence-backed, small n._

## Top 15 explicit feature requests (all apps)

**Method.** `requests.mjs` keeps only the sentences containing request wording:
`wish | please add/include/allow… | would love | I'd love | would be nice/great… | X is missing / missing feature | if only | hope you/they… | should add | can/could you add | lacks/lacking | needs a/an/the… | suggestion | would like to see | it would be nice`.
Each sentence is then bucketed by feature keywords. 3,044 of 29,934 reviews contain request wording. Counts are reviews per bucket. A review can land in several buckets.

| #   | Request                                                        | Reviews (L / mid / H)                          | Top apps                                  | Example                                                                                                |
| --- | -------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Better reports, charts, insights                               | 172 (19/25/128)                                | Monefy 24, YNAB 23, Copilot 16            | "I would like to see more analytics/statistics." `[monefy 2★ …97d78710]`                               |
| 2   | Categories: subcategories, tags, custom icons                  | 99 (8/15/76)                                   | Monefy 18, Wallet 15, 1Money 11           | "Please bring in the feature to search for user created tags." `[axio 1★ …ce3e029d]`                   |
| 3   | Export / import (CSV, Excel, PDF)                              | 93 (10/15/68)                                  | Money Manager 13, 1Money 9, Money Lover 9 | "The lack of spreadsheet export means I must continue to give 1 stars." `[axio 1★ …3468539e]`          |
| 4   | Investments, net worth, assets                                 | 89 (7/7/75)                                    | Monarch 16, Wallet 13, Copilot 10         | "an Investment Tracker for stocks, mutual funds, fixed deposits, gold, crypto" `[cashew 5★ …b75c671c]` |
| 5   | Debt / loan / lending tracking                                 | 74 (15/7/52) (Cleo's 11 are mostly loan noise) | Wallet 10, Monarch 7, Copilot 6           | "I want to track how much I'm paying towards a loan, including interest." `[monarch 5★ …7a1c9d4c]`     |
| 6   | Web / desktop version                                          | 74 (13/11/50)                                  | Copilot 20, YNAB 12, Rocket 10            | `[ynab 2★ …e45c08b4]`                                                                                  |
| 7   | Receipt attach / scan                                          | 71 (19/9/43)                                   | SimplyWise 20, Expensify 19, 1Money 7     | "I would love to see an option where I can attach receipts." `[monefy 5★ …6cb6e3fe]`                   |
| 8   | Better transfers (standing transfers, history, cross-currency) | 57 (11/7/39)                                   | Monefy 12, Cashew 7                       | "standing order for transfers would be nice" `[monefy 4★ …aa65ed18]`                                   |
| 9   | Notes, payee and merchant fields                               | 55 (4/6/45)                                    | 1Money 8, Wallet 8                        | "include a notes section in each of the accounts" `[1money 5★ …83253c46]`                              |
| 10  | Recurring transactions and bill reminders                      | 52 (4/12/36)                                   | Monarch 13, Monefy 8, 1Money 7            | "I hope you could add recurring features." `[1money 5★ …24693264]`                                     |
| 11  | Search and filters                                             | 51 (5/9/37)                                    | 1Money 8, Expensify 6                     | "missing is the ability to filter a category by a specific time frame" `[copilot 5★ …92562048]`        |
| 12  | Savings goals                                                  | 49 (1/4/44)                                    | Monarch 15, Wallet 7                      | "My main suggestion would be to add the option of tracking a savings goal." `[rocket 4★ …dcf3c8c7]`    |
| 13  | Shared, family or partner budgets                              | 48 (5/4/39)                                    | Copilot 10, Monarch 6, Monefy 6           | "be able to have personal and shared budget views" `[1money 5★ …7f41dd4e]`                             |
| 14  | Multi-currency and live exchange rates                         | 45 (4/5/36)                                    | Money Manager 10, Wallet 10, Cashew 6     | "please … let us add custom currencies" `[monefy 3★ …86bccd64]`                                        |
| 15  | Widgets and quick add                                          | 45 (1/4/40)                                    | Monefy 7, Monarch 6, Wallet 6             | "I hope you will add budget monitoring widget soon" `[money-lover 5★ …3112b181]`                       |

**Just below the top 15:**

- AI assistant / smarter automation: 44
- Budget flexibility (rollover, pay-period): 41
- Lifetime or one-time purchase option: 40
- Split transactions: 26
- Bank sync: 25
- Dark mode and themes: 24
- Backup and cloud sync: 20
- SMS / notification auto-capture: 18 at sentence level, but 67 at review level in manual apps (see §7)
- Calendar view: 17
- Location: 7
- Voice: 4

**Caveat.** Sentence-level bucketing undercounts requests phrased indirectly ("the only thing that would make it ideal is integration with banking apps", `[1money 4★ 2026-10-12 …aa8fca91]`). The automation buckets are hit hardest by this.

## Implications for Moni (summary)

- **Supports Moni (evidence-backed).** The market rewards a proposal → review → learn → Auto pipeline:
  - manual-app users explicitly ask for "parse the SMS and show it, then I confirm" (`…8305603d`, `…aa4d23e9`);
  - YNAB users ask for "ask me … then learn from my choices" (`…b9b5b082`);
  - FinArt and Copilot are praised for learning from one correction.
- **Supports Moni (evidence-backed).** Duplicate and transfer pairing targets a top trust-breaker of SMS and notification capture.
- **Supports Moni (evidence-backed).** Grounded on-device AI answers match what Origin and Ryt users praise. Privacy-safe aggregation answers the Monarch backlash.
- **Threatens Moni (evidence-backed).**
  - Silent capture gaps and OS background-killing (axio 2025–26);
  - SMS/OTP privacy fear;
  - any data-loss or licence-revocation event (1Money);
  - hard paywalls in AI-entry apps.
- **Missing or weak in Moni (evidence-backed requests).**
  - export/import and restore;
  - richer reports;
  - investments and net worth;
  - recurring transactions and bills;
  - savings goals;
  - shared budgets;
  - widgets and quick add;
  - live exchange rates;
  - budget periods aligned to payday.
- **Probably over-invested (evidence-backed absence).**
  - The location heatmap has no demand. Repurpose location as an autofill signal (YNAB's best-loved trick).
  - Voice entry has thin evidence. Keep it, but don't lead with it.
