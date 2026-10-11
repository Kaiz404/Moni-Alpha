# AI entry slice: Rolly, MonAi, SimplyWise, Expensify

## Scope and caveats

| App        | Reviews                 | Low / 3★ / High   | AI entry it advertises                                               | What dominates its low reviews                                     |
| ---------- | ----------------------- | ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Rolly      | 99 (Play 86, Apple 13)  | 28 / 5 / 66       | Chat entry, voice, receipt photo, roast persona                      | Paywall and billing                                                |
| MonAi      | 117 (Play 34, Apple 83) | 25 / 12 / 80      | Voice/NL entry, Android notification capture, iOS Apple Pay shortcut | Hard paywall; notification capture not working                     |
| SimplyWise | 1,530                   | 341 / 107 / 1,082 | Receipt OCR, email/Amazon import                                     | Price and scan quota; phone-number demand                          |
| Expensify  | 1,909                   | 1,251 / 158 / 500 | SmartScan OCR, Concierge AI                                          | Bugs/crashes, the 2025-26 "New Expensify" redesign, billing, login |

- I read all 99 Rolly and all 117 MonAi reviews. For SimplyWise and Expensify I read the digests, then ran proximity regexes (e.g. a scan word within 60 characters of an error word) and checked the matches by hand. When I give a "hand-validated" count, I read every match and dropped the false positives. Plain regex counts are labelled "regex".
- Scripts (session-only, not kept): `prox.mjs` (theme counts and matches), `buckets.mjs` (what low reviews are about), `themes.mjs`.
- **All four apps were scraped from the US storefront.** No Malaysian reviews are in this sample. Rolly's users here are US, Vietnamese and Indonesian. MonAi's are mostly Latin American (50 of 117 reviews are in Spanish).
- **Rolly's origin.** `landscape.md` lists it as an Australian company with a Malaysian founder, citing a VietTimes article. The reviews themselves don't confirm the founder's nationality. The VietTimes coverage would explain why about 6 reviews are in Vietnamese and why the developer replies in Vietnamese. The developer also replies in Indonesian. Rolly's own Malaysia guide uses "nasi lemak 8" in RM as its example (`my-user-voice.md`).
- **Possible seeding.** Four Rolly App Store 5★ reviews were posted on 2025-01-19/20, all on v8.0.1, each with 5–7 thumbs-up and polished marketing copy (`07637056`, `06296350`, `06050198`, `05780077`). I count them but give them little weight.
- SimplyWise and Expensify are receipt and business-expense tools, not budgeting apps. Their scan evidence carries over to Moni's receipt capture. Their billing, admin and corporate-policy complaints do not.

---

## Pain points

### P1. Paywall before value, including quotas on scans and AI (all four apps; largest low-star driver for Rolly, MonAi and SimplyWise)

- **SimplyWise:** 120 of 341 low reviews mention price or paywall (regex `price|pricing|expensive|subscri|paywall|not free|free version|free trial|\$\d|have to pay|upgrade|premium`). 36 more are about trial or billing charges. The scan/save quota is named in 16 reviews across all ratings (regex `free scans?|\d+ (free )?(scans|saves|receipts)|unlimited scans|...`), and 7 of those are low. Peaked in 2024 with 45 low reviews mentioning price.
- **Expensify:** 156 of 1,251 low mention pricing (same regex), and 72 mention billing or cancellation. 22 reviews name a scan quota (5–25 free SmartScans a month). Price complaints rose again in 2025 (24) and 2026 (31) after a new $199/yr tier.
- **Rolly:** about 10 of 28 low reviews are about the paywall or price, and 6 more are about unexpected charges (hand count: `85bbb2a5`, `2abd8875`, `28225fbe`, `ca8d6cee`, `33d125df`, `3f4242fe`, `894d6856`, `438e79e9`, `557cd41a`; charges `a56860ff`, `e061f01b`, `02864266`, `ffb8172e`, `76a39bd9`, `c97cd948`).
- **MonAi:** about 11 of 25 low reviews are about the hard paywall in onboarding, and 3 more are about trial charges (hand count). Two users also lost data at the paywall (`75098656`, `63123082`).

Quotes:

- "The so called free version only allows 50 saves and then you have to pay $30 annually" (SimplyWise `8fbd0d54`, 1★, 2024-01-06; 936 thumbs-up, the most-helpful review in the slice)
- "Hard paywall during onboarding :(" (MonAi `4203262b`, 1★, 2025-08-10)
- "After spending a few minutes to personalize the app, then it asks to subscribe them. They should ask it at first." (Rolly `ca8d6cee`, 2★, 2025-05-29)
- "Then you need to pay and I lost my expenses from the past month." (MonAi `75098656`, 1★, 2025-02-05)
- "a receipt that I scanned wasn't very legible because of low light yet it was still deducted from my free scans without allowing me the option to delete and retake" (Expensify `1e2c0266`, 2★, 2019-03-08)

The two indie apps defend their price the same way: AI and server costs need a subscription. Users don't accept it before they have seen the AI work once.

### P2. Captures that silently vanish, stall or never arrive (Expensify, SimplyWise, MonAi, Rolly)

- **Expensify:** 39 low, 3 mid and 9 high reviews describe receipts lost, stuck uploading, or never appearing (regex `los(e|t) (my )?receipts|disappear|stuck upload|never (show|upload)|didn't save|doesn't show up|forgets`). By year this is 2017–22 in single digits, 2023:7, 2024:5, 2025:5, **2026:14**. It got worse after the redesign.
- **SimplyWise:** 10 regex matches, including email imports that never show up.
- **MonAi notification capture:** 7 of 117 reviews say automatic capture logged nothing or dropped entries (hand count: `f5190f83`, `74022fdd`, `ba97d7b8`, `67339603`, `06022473`, `35736778`, `75848071`). Only 4 praise it.
- **Rolly:** 3 reviews from Nov 2024 – Jan 2025 say the AI couldn't add any transaction during server outages (`f392bf08`, `b14d485e`, `68743975`). One more says it "cannot auto imput" (`f0d5b38e`).

Quotes:

- "several times I have taken a picture in the app and come back later to find it is nowhere in the system" (Expensify `5b07a41a`, 1★, 2026-07-24)
- "I have to go back and retake photos of at least 1 receipt for EVERY expense report. Kind of defeats the purpose" (Expensify `b76685dc`, 1★, 2019-10-28)
- "Le di todos los permisos, seguí todas las configuraciones, eliminé todas las restricciones y aún así no reconoció ningún gasto... obtuve cero registros." (MonAi `f5190f83`, 2★, 2026-02-19). It says: "I gave it every permission, followed every setting, removed every restriction, and it still didn't recognise a single expense. Zero records." The developer blamed aggressive Android battery restrictions.
- "Muchísimas veces me notificó de gastos que identificaba a través de las notificaciones de DólarApp y a pesar de eso, no guardo ni un solo gasto... aplicaciones como Bancolombia que no envían notificaciones por la app si no por mensajes de texto, son absolutamente incompatibles" (MonAi `74022fdd`, 2★, 2025-07-06). It says: "It detected expenses from DólarApp notifications many times, yet saved none. Banks like Bancolombia that send SMS instead of app notifications are completely incompatible."
- "estamos presentando problemas, intente el ingreso de los datos manualmente" (Rolly `68743975`, 1★, 2025-01-10). This is the AI error message ("we're having problems, try entering the data manually"), quoted by a user who was already trying to do exactly that.

### P3. OCR gets fields wrong (SimplyWise, Expensify; one Rolly mention)

Hand-validated counts of reviews that report specific OCR errors:

- **SimplyWise:** about 31 of 1,530 (16 low, 8 mid, 7 high).
- **Expensify:** about 45 of 1,909 (about 30 low).
- **Rolly:** 1 (`7ad15d64`: image upload "can't capture the date well").
- **MonAi:** 0. Its receipt camera is rarely mentioned.

Error types, hand-sorted. One review can name several types.

| Field                                         | SimplyWise                  | Expensify | Notes                                                                                                                 |
| --------------------------------------------- | --------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| Total / amount                                | ~11                         | ~14       | Handwritten tips are often missed or misread. Expensify "picks a random number" from the receipt.                     |
| Date                                          | ~6                          | ~6        | US-only date format, a year forced to the current year, receipts saved in "random years".                             |
| Merchant / vendor                             | ~4                          | ~6        | "weird names for stores"; for email receipts it reads the sender's email instead of the store.                        |
| Currency / non-US                             | ~1                          | ~10       | Wrong currency symbol, GST/VAT ignored, thousands separator misread.                                                  |
| Line items / tax                              | ~15 complaints vs ~8 praise | ~3        | Long receipts lose half their line items; a coupon line is read as a purchased item.                                  |
| Faded / long / handwritten / multi-page / PDF | ~10                         | ~15       | Expensify's most common ask here is PDF upload. SimplyWise added multi-page receipts after a user asked (`47535030`). |

Quotes:

- "I scanned 33 CVS receipts to test. The app only picked up the right date and total on 2 of them... if the month and day were before today's month and day, it would automatically make the date 2024 (even tho the date was in 2023)." (SimplyWise `f9c70ea1`, 1★, 2024-04-30)
- "Wrong date: similar receipts on the same day (written in receipts as 06/08/2024 but recognised as 6th of Aug in one expense and 8th Jun in another)... I am using IDR currency. It is stated as 69,000 but the bot recognise it as 690,00." (Expensify `381d4090`, 1★, 2024-08-10). This is the only Southeast Asian receipt in the slice. It shows the exact DD/MM and thousands-separator failure a MYR app will meet.
- "It only reads dates in the american format... It cant find GST taxes and struggles to read amounts properly. All uploads need to be double checked manually" (Expensify `b43e1a07`, 1★, 2019-08-11)
- "It doesn't do well scanning long receipts and will miss about half of the line items or mistake a coupon line as a purchased item" (SimplyWise `a6f28dba`, 3★, 2024-12-14)

**Trend.** Both apps have recent "an update made the scanner worse" reviews:

- SimplyWise `71445648` (3★, 2025-12-03), `20037729` (1★, 2025-11-20) and `90153625` (1★, 2026-02-25).
- Expensify `66c787a8` (1★, 2026-03-02), `35bbf8c7` ("scanning barely works after the update", 1★, 2026-03-08) and `58344497` ("now 50 percent of the scans fail", 2★, 2026-05-12).

Expensify's accuracy complaints cluster in 2018–19 and again in 2024–26.

### P4. AI entry moves the effort into correcting it instead of removing it (SimplyWise, Expensify)

About 24 reviews say outright that they still type, check or re-scan, so the AI doesn't save them work. That is about 10 SimplyWise and 14 Expensify, hand-validated from regex `defeats the purpose|might as well|double.?check|manually (enter|correct|fix)|by hand|re-?scan|retake|still doing the work|quickly type it out`.

- "You'll be able to quickly type it out before this app figures it out." (Expensify `3dc4ae95`, 1★, 2021-08-30)
- "if I have to manually input details of the receipt, I might as well be using Excel!!" (Expensify `95234673`, 2★, 2018-11-08)
- "I do not trust the OCR and would rather manually enter it so I have no issues at month end." (Expensify `214bbdd8`, 2★, 2026-01-16)
- "It's very expensive and your still doing the work" (SimplyWise `46d88e6d`, 1★, 2024-02-03)
- "I have had to go in and manually correct amounts on almost every receipt." (SimplyWise `97129090`, 2★, 2022-06-21)

**Counterweight.** Users accept corrections when the net saving is still clear:

- "Smartscan often misses obvious currency indicators, which requires manual correction, but compared to entering everything manually, it's fantastic. Saves me at least an hour per month" (Expensify `9ed8c7e4`, 4★, 2019-07-10)

The line people draw is about **how many** receipts need fixing. "Almost every receipt" leads to quitting. Needing to tweak "a few receipts" still earns a 5★ review (`39397603`).

### P5. Slow capture, mostly from cloud OCR latency (Expensify most, SimplyWise some)

- **Expensify:** 60 reviews put a scan word near `slow|forever|hours|next day|stuck|pending|processing` (regex: 36 low, 8 mid, 16 high). Most are about server-side SmartScan taking minutes to days. The rest are about the app slowing down after 3–5 photos in a row. It peaked in 2018–19 (24) and **came back in 2026 (9)**.
- **SimplyWise:** 18 regex matches, but on reading only about 6 are real speed complaints, mostly camera lag after an update (`430537ae`, `45de0f53`).
- **Rolly:** 2 performance asks, a 3–4 s cold start (`63394f8f`) and "make the app light and fast" (`b909b858`).
- **Capture friction counted in taps:** Expensify `cd7e0063` (3★, 2019, 49 thumbs-up) says "4 redundant clicks to SmartScan a receipt". `b16e5b63` (1★, 2025-08-29) says "Smartscan is at least two presses now instead of just one."

Quotes:

- "Now it takes at least 24+ hours for it to complete a scan of a receipt." (Expensify `95234673`, 2★, 2018-11-08)
- "Smart scan is too slow, it should run on the device instead of the cloud." (Expensify `f9f96d79`, 4★, 2019-05-21)
- "Scanning multiple receipts slows the app to a halt. Once you add 5 receipts, the app totally freezes" (Expensify `cd7e0063`, 3★, 2019-02-26)

### P6. Forcing a chat/AI interface onto capture backfires (Expensify, 2025–26)

- 112 Expensify low reviews blame a new version or UI (regex), and 95 of them are from 2025–26. About 40 of those are specifically about receipt capture getting worse (hand-read).
- 15 low reviews complain about AI or a chat-style UI being forced on them. All are from 2024-06 or later, and 12 are from 2025-05 or later.
- 22 low reviews complain that support is only an AI bot.
- The word "AI" appears in 38 Expensify low reviews: 20 from 2026, 6 from 2025, 7 from 2024.

Quotes:

- "The new interface tries so hard to mimic AI conversational interface. I don't need or want another conversational language bot that I need to train on what I want. I just need my receipts scanned, data filled and my dropdowns with my usual options." (Expensify `43021213`, 2★, 2025-12-22)
- "This new chat-like UI makes it harder to find expenses... not everything needs to be a chat UI. Revert now." (Expensify `b16e5b63`, 1★, 2025-08-29)
- "The AI version is very slow so you have to select manual entry. Worst thing is that after several days of entering expenses most disappeared." (Expensify `47162867`, 1★, 2026-07-25)
- "Bring back the ability to take a picture and scan with one button. Restore offline usability." (Expensify `657f200b`, 2★, 2025-10-11)

This is the clearest **worsening** trend in the slice.

### P7. Chat/NL entry misreads intent or context (Rolly)

This is small in absolute terms: about 8 of 99 Rolly reviews, hand count. But these are the only reviews in the slice about natural-language entry going wrong.

- **Wrong category (1):** "Dinner at restaurant but Ai is taking dinner with friends it is dropping in entertainment category" (`438e79e9`, 3★, 2025-08-28)
- **Wrong direction or balance (3):** income recorded "but remove it in the total balances" (`29e9aad4`, 5★, 2024-11-29). "When you question him and tell him the corrected exact balance, he will correct himself but the display is still not changed." (`d85a9bf1`, 2★, 2026-10-04). Also `3c0289aa`.
- **Wallet context not parsed (3):** "When chatting with the AI, I have to manually switch the wallet at the top every time. it's better... if I mention the wallet name in my message" (`be52ffe0`, 3★, 2026-01-03). Also `bf2c02dc` (wallet name in the message, one shared chat instead of one per wallet) and `3154fe67` (a transfer between two wallets should take one message, not two).
- **Persona offends (2):** "If you enter expenses for health related things like depression treatment, dialysis, etc. it will curse you." (`93174fde`, 1★, 2025-03-28). Also "I don't like how the AI keep mocking every expense I made" (`e5ca675e`, 4★, 2025-01-04).
- **Wrong date logic (1):** streaks count the day of entry, not the transaction date (`e235c5e3`, 1★, 2025-11-22, 6 thumbs-up). The developer refused to change it.

### P8. Offline is barely possible (SimplyWise, Expensify)

About 7 genuine reviews out of 3,655 (hand-validated from regex `offline|no internet|without (internet|connection)|internet connection|limited service`): SimplyWise 4 and Expensify 3. That is rare, but every one describes a hard failure, and they come from travellers and field workers.

- "Purchased this app to record expenses on a 5-week trip across Europe... COMPLETELY USELESS WITHOUT CONSTANT INTERNET... there is no temporary local storage for when there is an interruption" (SimplyWise `60271136`, 1★, 2022-10-07)
- "apparently the application doesn't work without having an internet connection so it's kind of useless if I'm out in the field" (SimplyWise `499c03c8`, 3★, 2021-12-05)
- "Why should I need to be connected to the internet to be able to save a receipt?" (SimplyWise `46123782`, 1★, 2026-01-17)
- "The bugs with limited service are basically unworkable now." (Expensify `74831081`, 1★, 2026-05-17); "Restore offline usability" (`657f200b`, 2025-10-11)

Neither Rolly nor MonAi gets a single offline review. Both need a server to parse input.

### P9. Duplicate captures (Expensify, SimplyWise, MonAi)

- **Expensify:** 21 low reviews (regex `duplicat|twice|\d+ to \d+ times`), with 6 in 2026 after the redesign: "Every receipt I took a picture of is entered twice" (`14053158`, 1★, 2026-03-04).
- **SimplyWise:** 11, mostly from email import: "It imported the same ones like 4 times. I cleaned them up and then today... they are back." (`77291701`, 1★, 2023-02-02)
- **MonAi:** "if I receive the same notification twice it will log it twice" (`ce4adcb5`, 3★, 2026-05-08)
- **The reverse problem:** Expensify flags false duplicates "simply because they have the same dollar value" (`435e7c02`, 1★, 2021-03-02).

### P10. One platform is a second-class citizen (MonAi, SimplyWise, Expensify)

- **MonAi:** 5 of its 34 Play reviews complain that Android lags iOS (no widget, no reports): "a bunch of features of iOS are not in android. Even though we both pay" (`09b009ca`, 2★, 2026-06-13).
- **SimplyWise:** about 6 Android-specific complaints (it "doesn't seem to like Android phones", `0c625216`).
- **Expensify:** the Android 15 status-bar bug in Dec 2024 – Jan 2025 produced a burst of reviews. It was fixed within days.

### Noise, kept separate

- **SimplyWise phone-number demand and spam:** 43 low reviews. This is about privacy in onboarding, not AI.
- **Expensify login and magic codes:** 109 low (peak 2024: 39).
- **Expensify political emails:** 37 low (2020–21).
- **Expensify SNAP $50 promo:** 8.
- **Expensify corporate policy and approval complaints:** about 14 say their employer forces them to use it.
- **Rolly and MonAi bank-sync requests:** 4 reviews. Not noise for Moni, but not an AI-entry complaint either; see I-12.

---

## Delights

### D1. "Just say or type what you spent" (Rolly, MonAi)

- About 10 of 66 Rolly high reviews praise chat or voice entry (hand count).
- About 9 of 80 MonAi high reviews praise voice dictation (hand count).

In MonAi, most of the voice praise is **in Spanish**. Dictation is what users value most there.

- "Imagine, all you need to do is chat what you did to your money and an AI will track and categorize it for you. I LOVE IT!... Your app is a timesaver" (Rolly `6bb3606f`, 5★, 2025-01-27)
- "I love how I can just speak to it and it records all my expenses" (Rolly `40825023`, 5★, 2024-12-08)
- "dictar las transacciones y no tener que ingresarlas una a una es increíble" (MonAi `76329695`, 5★, 2026-01-25). It says: "dictating transactions instead of entering them one by one is incredible".
- "Con el comando de voz es muy rápido registrar los gastos... registramos mi esposa y yo los gastos en una sola lista." (MonAi `53357472`, 5★, 2026-01-19). It says: "With the voice command logging is very fast... my wife and I log into a single list."

**Voice failures are rare.** Only one review: "It works really good typing what I said. But it gets stuck always at the end. Take forever" (MonAi `66942437`, 1★, 2025-01-10).

**Languages and code-switching.** Reviewers wrote in English, Spanish, Vietnamese and Indonesian. **No review mentions mixed-language input or entering something like "nasi lemak 8".** The US-storefront sample can't show how Malaysian code-switching performs. This is an evidence gap, not a sign that it works.

### D2. No manual categorising (Rolly, MonAi, SimplyWise)

About 15 reviews praise automatic categorisation (hand count: Rolly 5, MonAi 3, SimplyWise about 7).

- "It's easy to use and I don't have to classify stuff manually." (Rolly `486aaeca`, 5★, 2025-06-26)
- "AI akan otomatis memasukkan ke kategori" (Rolly `9cebc8b1`, 5★, 2025-05-21). It says: "the AI automatically puts it in a category".
- "it correctly categorized everything in the receipt!" (SimplyWise `d08505da`, 5★, 2023-10-03)

### D3. Snap it and walk away (SimplyWise, Expensify)

Time saving is the main reason receipt-app fans give high stars.

- **SimplyWise:** 73 high reviews (regex `fast|quick|seconds|time.?saver|saves (me) time|on the go|walk away|fire and forget`), and 21 say specifically that it "saves time/hours".
- **Expensify:** 55 high regex matches and 16 "saves time".

Quotes:

- "You can take a picture of a receipt and smart scan it in the app and walk away." (Expensify `008816c4`, 5★, 2024-04-10)
- "caught up on about 3 hours of receipts logging in 20 minutes nearly no work at all." (Expensify `39308781`, 5★, 2022-08-31)
- "I used to be able to take a picture of a receipt and just forget about it, but now I have to check them all" (Expensify `08218921`, 3★, 2018-05-28). This one praises the old behaviour and shows how it was lost.

### D4. OCR that works, even on bad receipts (SimplyWise most)

- **SimplyWise:** 48 high regex matches for a scan word near `accurate|correctly|impress|works great|perfect`.
- **Expensify:** 23.
- Praise for crumpled, handwritten and very long receipts appears about 6 times.

Quotes:

- "Every single receipt I've scanned has imported the merchant and date correctly. Only twice have I had to make a minor modification to the dollar amount" (SimplyWise `78112082`, 5★, 2022-02-20)
- "I just scanned a receipt that I had actually crumbled up and tossed into the trash can... it still copied it perfectly" (SimplyWise `369a4b1f`, 5★, 2023-11-28)
- "Even hand written tip amounts are correctly picked up, which is impressive." (Expensify `4b0de283`, 5★, 2020-02-21)
- "I just processed a _very long_ receipt and it was almost perfectly transferred into the app the first time" (SimplyWise `20df2294`, 5★, 2026-08-22). This is evidence of improvement in late 2026.

### D5. Simple, minimal, good-looking (MonAi especially)

- **MonAi:** 44 of 80 high reviews use "simple / sencilla / fácil / easy / intuitive" and similar words (regex).
- **Rolly:** 11 of 66.

- "Simplicity is its brilliance... many of them wanted to layer in more than I needed." (MonAi `63973207`, 5★, 2026-06-09)
- "la simplicidad es una de las mejores virtudes de esta app" (MonAi `15c106da`, 4★, 2026-03-09). It says: "simplicity is one of this app's best virtues". The same reviewer still asked for bank balances.

### D6. Passive capture that just happens (MonAi, SimplyWise)

Where it works, passive capture earns the warmest reviews. About 4 MonAi reviews praise it and about 9 SimplyWise high reviews praise email or Amazon import.

- "MonAI solves this with shortcuts and AI, now everything is logged automatically." (MonAi `31512568`, 5★, 2025-06-29)
- "I like the fact that it reads directly from my notifications, saves me the trouble of remembering, especially if I'm in a hurry." (MonAi `ce4adcb5`, 3★, 2026-05-08)
- "I just walked out of Lowe's, and I received a notification asking if I'd like to import the receipt that was just sent to my email. It even added to my calendar the last day my items are returnable" (SimplyWise `66199517`, 5★, 2023-05-22, 288 thumbs-up)

### D7. A developer who listens (MonAi, Rolly, SimplyWise)

- **MonAi:** 12 high reviews credit the developer or support (regex).
- **Rolly:** 7.
- "I made a suggestion and it was implemented in the following update" (MonAi `7182618f`, 5★, 2026-02-06)
- **Contrast:** Expensify has 22 low reviews about AI-only support. The indie apps earn goodwill here and the big app loses it.

### D8. Personality and motivation, but it cuts both ways (Rolly)

3 strong positive Rolly reviews against 2 negative.

- "I have a Tramatic Brain Injury... I love that I can just text Rolly and he's my cheerleader and financial adviser and expense tracker" (Rolly `476fdfbe`, 5★, 2025-07-06)
- See P7 for the two reviews that found the roasting offensive.

---

## Answers to the extra focus questions

- **Receipt OCR accuracy.** Complaints about specific fields are a small share of reviews: about 2% of SimplyWise and 2–3% of Expensify. Praise for accuracy outnumbers them on SimplyWise (48 vs 31).
  - Errors concentrate in **totals with handwritten tips**, **dates** (year inference, DD/MM vs MM/DD), **non-USD currency and thousands separators**, and **line items on long receipts**.
  - Faded and crumpled receipts are praised more often than they are blamed.
  - The real request around multi-page receipts is **PDF/e-receipt ingestion**, about 15 Expensify reviews.
- **Speed of capture.** The complaint is latency between snapping and seeing the result: hours to days in Expensify's worst periods. A second complaint is tap count. Users explicitly asked for **on-device** processing and **one-button** capture.
- **Voice and natural language.**
  - Voice: about 9 MonAi praise reviews (plus 2 in Rolly) against 1 transcription or hang failure. Chat: about 10 Rolly praise reviews against about 8 that say it misread intent or context.
  - The NL failures are about _meaning_, not transcription: category, income vs expense, which wallet, transfers.
  - Languages seen: English, Spanish (dominant in MonAi), Vietnamese and Indonesian. There is no evidence about code-switching either way.
- **Does AI entry reduce effort?** For chat and voice, reviewers say yes; nobody in Rolly or MonAi complains about correction effort. For receipt OCR it is conditional. About 24 reviews say correction cancels the saving, and the rest say the saving holds. **The tipping point is how often you must fix something**, not whether you ever do.
- **Paywall on scans.** Quotas anger people when they are small or hidden: 5 scans/month on Expensify, 10/month or 50 saves on SimplyWise. A failed scan using up the quota is a specific grievance. Hard paywalls on AI apps (Rolly, MonAi) are the top low-star cause in both.
- **Offline.** About 7 reviews in all. Every one is a dealbreaker for travellers and field workers, and nobody praises offline support anywhere in the slice.

---

## Implications for Moni

**I-1. The approve/decline proposal is the right shape, so make correcting it cheap.**

- **Supports:** AI capture with review.
- **Evidence-backed** (P3, P4).
- OCR and NL errors are unavoidable. Users tolerate them when fixing is quick and rare.
- On the proposal card, make amount, date, merchant, category and wallet editable with one tap each. Show the source photo, notification text or transcript beside the fields.
- Track the correction rate per capture type internally. Once users fix "almost every" receipt, they abandon the feature (`97129090`, `3dc4ae95`).

**I-2. Parse dates and amounts for Malaysia, not the US.**

- **Threatens:** receipt capture, if it uses a generic OCR model. **Evidence-backed** (`381d4090`, `f9c70ea1`, `b43e1a07`, `0b83fb87`).
- Default to DD/MM.
- Never put a receipt date in the future. If the day and month have already passed this year, keep the current year; if they haven't, the receipt is from last year. Don't force the current year.
- Recognise "RM" and "MYR" and comma thousands separators, and handle SST lines.
- Treat a handwritten tip or rounding line as a likely correction point.

**I-3. Never lose a capture, especially offline.**

- **Supports:** offline-first, but it also **shows a gap**: AI parsing needs the network. **Evidence-backed** need (P2, P8); design **inferred**.
- Save the raw input (photo, audio, text, notification payload) on the device first. Show it right away as a "pending" proposal and parse it once the device is back online.
- This is the exact fallback SimplyWise users asked for ("no temporary local storage") and Expensify removed ("Restore offline usability").

**I-4. Keep capture one tap and fast; don't make chat the only way in.**

- **Supports:** keeping the chat assistant separate from capture. **Evidence-backed** (P5, P6).
- Expensify's backlash shows that a conversational UI layered over capture reads as slower and less trustworthy. Users who wanted "my dropdowns with my usual options" hated it.
- Keep manual entry and the transaction list as fast, first-class paths. Let the chat answer questions rather than gate data entry.
- Aim for a proposal within seconds. When a parse is slow, let the user type the fields instead of waiting ("quickly type it out before this app figures it out").

**I-5. Notification capture is Moni's strongest differentiator and its biggest reliability risk.**

- **Supports, and threatens:** notification capture plus "Auto" add. **Evidence-backed** (MonAi: 7 failure reviews vs 4 praise, out of 117).
- MonAi's failures came from OEM battery killers and from banks that send SMS instead of app notifications.
- Moni needs:
  - OEM-specific onboarding for battery-optimisation exemptions;
  - a visible capture-health indicator ("last notification read: 2 h ago");
  - a published list of supported Malaysian banks and e-wallets, saying whether each sends a push notification or an SMS.
- **Inferred:** a silent failure here hurts more than a wrong OCR field, because users stop checking.

**I-6. Duplicate and transfer detection are directly in demand.**

- **Supports:** duplicate detection and transfer pairing. **Evidence-backed** (P9, `ce4adcb5`, `3154fe67`).
- MonAi logs a repeated notification twice. SimplyWise re-imports emails. Expensify's 2026 redesign doubles photos.
- Avoid Expensify's false positive (`435e7c02`). Don't flag a duplicate on amount alone; also check time window, merchant and source.

**I-7. Natural-language entry has to resolve wallet, direction and transfers from the sentence.**

- **Supports:** chat/voice capture, multi-wallet. **Evidence-backed** (Rolly `be52ffe0`, `bf2c02dc`, `3154fe67`, `29e9aad4`).
- "Paid 30 from Maybank to TNG" should become one transfer proposal, not two entries or a wallet switch.
- When income vs expense is unclear (a gift, for example), ask in the proposal rather than guess.

**I-8. Learn categories from the user's own corrections.**

- **Supports:** history-matched auto-add. **Evidence-backed** (`438e79e9`, where Rolly's developer replied "set a custom categorisation rule… it is very subjective"; Expensify `42700006`: "never remembers categories for a certain vendor").
- Moni's "matches your categorised history" approach answers this directly. Show users that a correction will stick.

**I-9. The chat assistant must not claim to change data it can't change.**

- **Threatens:** the chat assistant, if handled badly. **Evidence-backed** (1 review, `d85a9bf1`) and **inferred** design.
- Rolly's bot "corrected itself" while the balance on screen stayed wrong. Moni's assistant reads a metrics snapshot.
- If a user tells it a balance is wrong, it should either create a balance-adjustment proposal or say clearly that it can't edit. It should never acknowledge a change that didn't happen.

**I-10. Use transaction date, not entry date, everywhere.**

- **Supports:** charts, heatmap and budgets. **Evidence-backed** (Rolly `e235c5e3`).
- Auto-captured and back-filled entries must land on the day of the purchase. Any streak or "days tracked" metric must follow that date.

**I-11. Monetise after the first win; never meter failed scans; never hold data hostage.**

- **Shows a gap:** monetisation design. **Evidence-backed** (P1).
- Hard paywalls in onboarding are the top 1★ cause for both AI-native indies.
- If AI capture is metered, keep failed or retried parses free and make the quota visible before it runs out.
- On downgrade, keep every past transaction readable and exportable. "I lost my expenses" at the paywall is MonAi `75098656`; SimplyWise `45397815` reports the same.

**I-12. Pitch notification capture as the answer to "no bank sync".**

- **Supports:** Moni positioning. **Evidence-backed** (Rolly `c9086f36`: the most-helpful Rolly review at 12 thumbs-up: "The only thing preventing me from subscribing… is the lack of automatic transactions being uploaded from my bank". Also `be52ffe0`, `438e79e9`, MonAi `15c106da`).
- Moni's store listing and onboarding should say "automatic, without giving us your bank login".

**I-13. Persona tone: neutral by default; any roast mode opt-in and never on sensitive categories.**

- **Inferred** from 2 Rolly complaints (health spending cursed, every expense mocked), weighed against 3 delighted users.

**I-14. Set iOS expectations up front.**

- **Threatens:** the iOS rating. **Evidence-backed by analogy** (MonAi: 5 of 34 Play reviews are angry about feature gaps between platforms).
- Moni has the opposite gap (iOS has no notification capture). Say so in the iOS listing, and make chat, voice and receipt capture feel complete on their own.

**I-15. Add an app lock.**

- **Shows a gap**, if Moni lacks one. **Evidence-backed**, but thin: MonAi's most-helpful review (`9edcb47f`, 14 thumbs-up) asks for PIN, fingerprint or 2FA, and Rolly `b8be8d6a` asks for a password.

**I-16. Test Malaysian code-switched input before claiming it works.**

- **Shows a gap** in evidence. **Inferred.**
- No review here covers BM, Manglish or Chinese-English mixed entry. Spanish dictation works for MonAi, but that is one language, not mixing.
- Build a test set of real Malaysian phrasings, for example "makan mamak 12", "grab balik rumah rm18", "topup tng 50". The US-storefront scrape can't supply it.

**I-17. Line items are optional for Moni.**

- **Inferred.** Itemisation drives much of SimplyWise's praise (a tax/business audience) and most of its line-item errors.
- For personal budgeting, one total with a category, plus an optional split, probably carries less error risk for the value it gives.
