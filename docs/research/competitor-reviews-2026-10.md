# Competitor and app-store review research (October 2026)

This page summarizes market research done on 2026-10-18. It answers three questions for Moni:

- What do users of budgeting and expense apps complain about?
- What do they praise?
- What does that mean for Moni's features?

The evidence is 29,934 Google Play and App Store reviews of 25 apps, plus web research on competitor AI features and Malaysian forum posts. The detailed reports, with verbatim quotes and review ids, are in [`competitor-reviews-2026-10/`](competitor-reviews-2026-10/).

Code observations on this page describe commit `d9ac8ec`. Competitor facts can go out of date. Check an app's store listing before you rely on a detail about it.

## Moni's position, in one paragraph

Moni is an Android-first expense tracker for Malaysians. It defaults to MYR and supports other currencies. Its goal is to remove typing. It turns bank and e-wallet notifications, receipt photos, voice, and chat messages into transaction proposals. The first transaction of a new kind goes to review. Later notifications that match the user's own categorized history are added automatically and marked "Auto". Moni has no bank login. Its chat assistant answers from facts that the phone computes. Moni also detects duplicate purchases and pairs the two legs of a transfer. See [`docs/AI.md`](../AI.md) for how these features work.

## How the research was done

1. A research agent picked 26 competitor apps in five groups and verified each store id against the store lookup. The groups and ids are in [`apps.json`](competitor-reviews-2026-10/apps.json). Three Malaysian apps (Duitful, xFin, SnappySpend) were added later.
2. A Node script downloaded the reviews:
   - Google Play, through the `google-play-scraper` npm package (v10.0.1). It took the 800 newest and 400 most relevant English reviews per app.
   - The Apple App Store, through Apple's public review feed, `https://itunes.apple.com/{country}/rss/customerreviews/page={1..10}/id={appId}/sortby={mostrecent|mosthelpful}/json`. The feed returns at most 500 reviews per sort order per country.
3. Neither store blocked or rate-limited the requests. The full run took about 10 minutes. Firecrawl was not needed. Reddit blocked every fetch method, so the Malaysian forum research used Lowyat.NET, Seedly Q&A, HardwareZone, and blogs instead.
4. Six analysis agents read the reviews. Five covered one app group each, and one covered all apps feature by feature. Each agent counted themes with regular expressions over the review text and checked every quoted review id against the data. Two more agents did web research on competitor features and on Malaysian user opinion.
5. The main author re-checked the most surprising numbers against the raw data. Two corrections came from that check. They are listed in [Read the numbers with these limits](#read-the-numbers-with-these-limits).

The raw review files (17 MB) and the scripts were not kept. To repeat the scrape, use the ids in `apps.json` with the two sources in step 2.

### Reviews collected per app

"Low" means 1 or 2 stars. "High" means 4 or 5 stars. The global apps were scraped from the US storefront. The Malaysian apps were scraped from the Malaysian storefront.

| Group            | App                      | Play id                             | Apple id   | Play reviews | Apple reviews |       Low |       High |
| ---------------- | ------------------------ | ----------------------------------- | ---------- | -----------: | ------------: | --------: | ---------: |
| `ai_assistant`   | Cleo                     | `com.meetcleo.cleo`                 | 1447274646 |         1121 |           986 |      1185 |        810 |
| `ai_assistant`   | Copilot Money            | none                                | 1447330651 |            0 |           900 |       244 |        567 |
| `ai_assistant`   | Monarch Money            | `com.monarchmoney.mobile`           | 1459319842 |          956 |           875 |       543 |       1149 |
| `ai_assistant`   | Origin                   | `com.useorigin.employee.android`    | 1637693312 |          438 |           744 |       212 |        907 |
| `auto_capture`   | axio (formerly Walnut)   | `com.daamitt.walnut.app`            | none       |         1056 |             0 |       425 |        543 |
| `auto_capture`   | Emma                     | `com.emmaprod`                      | 1270062373 |         1011 |           106 |       642 |        393 |
| `auto_capture`   | FinArt                   | `com.finart`                        | 6748001842 |         1057 |             0 |       147 |        837 |
| `auto_capture`   | Rocket Money             | `com.truebill`                      | 1130616675 |         1184 |           993 |       993 |       1041 |
| `auto_capture`   | Wallet by BudgetBakers   | `com.droid4you.application.wallet`  | 1032467659 |         1025 |           626 |       444 |       1063 |
| `ai_entry`       | Expensify                | `org.me.mobiexpensifyg`             | 471713959  |         1039 |           870 |      1251 |        500 |
| `ai_entry`       | MonAi                    | `app.getmonai.android`              | 6447112647 |           34 |            83 |        25 |         80 |
| `ai_entry`       | Rolly                    | `com.jc.rollymoneytracker`          | 6636525257 |           86 |            13 |        28 |         66 |
| `ai_entry`       | SimplyWise               | `com.simplywise.mobile`             | 1538521095 |          921 |           609 |       341 |       1082 |
| `classic_manual` | 1Money                   | `org.pixelrush.moneyiq`             | none       |         1110 |             0 |       340 |        712 |
| `classic_manual` | Cashew                   | `com.budget.tracker_app`            | 6463662930 |          946 |           117 |        22 |       1024 |
| `classic_manual` | Monefy                   | `com.monefy.app.lite`               | 1212024409 |         1153 |           311 |       337 |       1006 |
| `classic_manual` | Money Lover              | `com.bookmark.money`                | 486312413  |         1152 |           618 |       525 |       1090 |
| `classic_manual` | Money Manager (Realbyte) | `com.realbyteapps.moneymanagerfree` | 560481810  |         1077 |           767 |       101 |       1671 |
| `classic_manual` | YNAB                     | `com.youneedabudget.evergreen.app`  | 1010865877 |         1075 |           958 |       664 |       1165 |
| `sea_regional`   | Belanjawanku (EPF)       | `kwsp.epf.belanjawanku`             | 1632408106 |           61 |            29 |        18 |         40 |
| `sea_regional`   | Finory                   | `com.keennovation.finory`           | 1512346194 |          142 |            63 |         9 |        189 |
| `sea_regional`   | MAE by Maybank2u         | `com.maybank2u.life`                | 1481028763 |         1027 |           899 |       796 |       1011 |
| `sea_regional`   | Ryt Bank                 | `my.rytbank.app`                    | 6480042570 |          967 |           722 |       184 |       1441 |
| `sea_regional`   | SnappySpend              | `com.snaptrack.app`                 | none       |            3 |             0 |         0 |          3 |
| `sea_regional`   | xFin                     | `com.nocluelabs.xfin`               | none       |            4 |             0 |         1 |          3 |
|                  | **Total**                |                                     |            |              |    **29,934** | **9,477** | **18,393** |

Four Malaysian apps returned no reviews. Seedly closed its app on 2025-12-31 and is delisted from both stores. Duitful (`com.aydiljoe.duitful`) is in open beta. RinggitWise and Daybook have fewer than 5 ratings. RichAuntie is iOS-only and has no reviews.

## Users punish lost money, lost data, and silent failure

The list is ordered by how much evidence each theme has. Counts are reviews that match a theme's regular expression. Treat them as approximate.

1. **Subscriptions and billing traps.** 1,582 low reviews mention pricing. "Charged after I cancelled" and refused refunds appear in 131 low reviews and only 11 high reviews. That is the most one-sided theme in the data. Users who name a price they would accept say $25 to $50 a year, against list prices near $99.
2. **Bank sync that breaks.** Broken sync is 31% of Wallet by BudgetBakers' low reviews (138 of 444), and 80 of those users paid for sync. Monarch has 92 of 543. Malaysian Wallet users report that CIMB, Maybank, and AmBank do not connect. An external analysis of 1,586 critical App Store reviews found the same top cause (21%). Its source is listed in [`feature-landscape.md`](competitor-reviews-2026-10/feature-landscape.md).
3. **Lost data and paid features taken back.** In January 2026, 1Money moved to a forced subscription and revoked lifetime licences. It received 134 low reviews that month, against 15 in December 2025. Across the classic trackers, 196 low reviews describe data lost in sync, backup, or restore, and 45 of them name a phone change as the trigger. Seedly deleted all expense data after 2026-03-31, and it never offered an export.
4. **Capture that stops without warning.** In the apps that read SMS, 16% of axio's low reviews (67 of 425) and 14% of FinArt's (20 of 147) describe missed transactions. Users notice days later. At least 50 reviews name a specific cause:
   - a bank changed its sender id or message format;
   - alerts moved to RCS or WhatsApp;
   - the user switched to Google Messages;
   - an OEM battery manager killed the app.
5. **Forced redesigns and forced AI.** Classic trackers have 230 low reviews about forced redesigns or migrations, mostly YNAB's Home tab from September 2025 and Money Lover's category merge. About 95 low Expensify reviews from 2025 and 2026 blame its new chat-style interface. Monarch's AI launch produced 10 of its 39 low reviews in December 2025.
6. **Duplicates, and transfers counted as spending.** 75 low reviews across all apps. Examples include one purchase that sends two notifications, credit-card bill payments, and e-wallet top-ups that are counted as expenses. One FinArt review reports the opposite error: three real identical payments merged into one.
7. **AI used as a wall in front of support.** Between 98 and 149 low reviews, depending on the counting pattern. Most are Cleo's. Users describe chatbots that loop, block cancellation, or invent answers.
8. **Wrong AI answers.** 59 reviews rated 1 to 3 stars say the AI assistant was wrong, generic, slow, or unable to act. Receipt OCR errors appear in about 31 SimplyWise reviews and about 45 Expensify reviews. The errors involve totals, tips, DD/MM dates, currency, and thousands separators. About 24 reviews say AI capture moved the work into fixing mistakes.
9. **Ads and upsell popups.** 113 low reviews in classic trackers. Money Manager is getting worse, with 13 of its 18 in 2026. Cashew has none.

## Users reward simplicity, no typing, and fair prices

1. **Simple and fast.** About 1,537 high reviews of classic trackers praise simplicity. 445 say the app replaced a spreadsheet or a notebook.
2. **Capture they don't have to think about.** 342 high reviews across all apps. FinArt's SMS capture alone gets 99. Users value completeness: "this one is the only app that could track the cashback".
3. **An app that learns from one correction.** A Monarch review that praises reviewing each transaction once has 161 helpful votes. FinArt is praised for learning a merchant after one fix. In Maybank's MAE, 9 reviews with 197 helpful votes ask the tracker to remember a merchant's category.
4. **One-time pricing and no ads.** 218 high reviews praise one-time or lifetime pricing. Cashew has only 2.1% low reviews (22 of 1,063). It is free, has no ads, works offline, and offers pay-what-you-want premium. Its developer answers every low review.
5. **Budgets.** Budgets are the most-mentioned feature in high reviews (3,003). YNAB users credit the app with changing their behavior (204 high reviews).
6. **AI that does practical jobs with the user's own data.** 573 high reviews praise AI grounded in the user's data. Most come from Origin (232) and Ryt Bank (113). In Ryt Bank, about 42 AI mentions involve making a transfer or paying a bill from a screenshot or a typed line. About 5 of 123 involve questions about past spending.
7. **Multi-currency.** 125 high and 33 low reviews.

## The Malaysian market

- **Open finance is years away.** Bank Negara Malaysia issued an exposure draft on open finance on 2025-11-18. The draft starts data sharing with large banks in January 2027 and reaches e-money issuers with more than 5M users in January 2029. It is unclear whether an unlicensed app could read that data. Sources are in [`feature-landscape.md`](competitor-reviews-2026-10/feature-landscape.md), section 3.
- **Bank feeds do not show e-wallet spending.** A Touch 'n Go reload appears in the bank as one transfer. Notification capture sees the individual purchases.
- **Push notifications have replaced SMS.** Bank Negara Malaysia moved banks off SMS one-time codes in 2022. Maybank moved several alert types into MAE push notifications between 2020 and 2024.
- **Duitful is the closest competitor.** It reads notifications from Maybank, CIMB, Public Bank, RHB, Hong Leong, HSBC, Bank Islam, TNG, GrabPay, Boost, BigPay, ShopeePay, and three BNPL apps. Parsing runs on the device and the user approves every entry. It has no chat, no auto-add, and no duplicate detection. Pro costs RM19.90 once. It was in open beta with no public reviews on 2026-10-18.
- **Other local apps.** Rolly logs from chat or voice and has an "Angry Mom" roast persona. RichAuntie reads screenshots on iOS. Finory parses forwarded card statements and sends due-date reminders, which 49 reviews praise. RinggitWise is an AI coach with Malaysian categories.
- **Local price anchors.** RM19.90 one-time (Duitful) and RM19.90 per 6 months (RichAuntie). US apps charge $95 to $109 a year.
- **Maybank's MAE tracker is miscategorizing and double-counting.** 28 reviews report failed category edits, wrong categories, double or triple entries, and wrong totals.
- **Bank notifications themselves are unreliable.** 19 MAE and Ryt reviews report missing or late transaction notifications. 22 reviews complain that promotions share the alert channel. That noise is the input Moni reads.
- **Users want Malaysian categories.** 20 reviews ask for PTPTN, takaful, and transit fares. Others ask for income entry and for budgets that start on payday.
- **Forum users describe manual-entry fatigue.** A typical comment: "after 6months, didn't use it anymore because you need to key-in every time". One Lowyat user built a Tasker and Google Sheets pipeline: "No need to input values like a barbarian". In April 2026 another asked for an app that would "auto read spendings from ewallet apps and categorized them". Sources are in [`malaysian-user-voice.md`](competitor-reviews-2026-10/malaysian-user-voice.md).

## Competitors already ship chat, voice, and receipt AI

- **Chat over your finances is standard in the US.** Cleo, Monarch, Rocket Money ("Rowan", built with Anthropic, August 2026, $15 a month tier), Origin, and ChatGPT Personal Finance (Plaid, US Pro users, since May 2026) all have it. YNAB answers through an official ChatGPT app. All of them read bank-synced data. None answers from an aggregated snapshot built on the phone.
- **Chat, voice, and receipt entry are cheap to copy.** Rolly, DrakeAI, ChatExpense, and Cleo's voice mode already do them.
- **SMS and notification parsing exists mainly in India** (axio, FinArt, Moneyview, PennyWise) and in small Malaysian apps.
- **No app in this research combines** notification capture, auto-add based on the user's history, duplicate and transfer pairing, and AI chat.

The full feature matrix and pricing table are in [`feature-landscape.md`](competitor-reviews-2026-10/feature-landscape.md).

## Platform rules that affect notification capture

- **Google Play SMS permissions** need a Permissions Declaration Form. "SMS-based money management" is an allowed exception, subject to review. Moni does not read SMS.
- **Notification access on Google Play** has no special declaration. The User Data policy applies, which has three effects:
  - The app must show its own disclosure in the app, immediately before it asks for access.
  - "Financial and payment information" is sensitive data.
  - The rules "also apply to third-party AI integrations", which covers sending notification text to an LLM.
- **Sideloaded builds are a separate problem.** Play Protect treats sideloaded apps that use notification access as high risk. That affects APK and internal test builds, not Play installs.
- **Android 15 changes one-time codes.** Android 15 redacts notifications that contain a one-time code before an untrusted listener reads them. Ordinary transaction alerts are unaffected.
- **iOS cannot read other apps' notifications.** Apple's developer forum confirms this. iOS users of Moni get chat, voice, and receipt capture only.

## Implications for Moni

Each item says whether the reviews support a current feature, show a threat, or show a gap.

### What the evidence supports

- **No bank login is an advantage in Malaysia.** Broken bank sync is the top complaint in every market that has it, and Malaysian banks do not connect reliably.
- **Review first, then Auto, is what users ask for.** 67 reviews in manual-entry apps ask for "parse the SMS, show it, I confirm". YNAB users ask the app to "ask me, then learn from my choices". This is Moni's routine detection.
- **Duplicate and transfer pairing addresses a top reason users stop trusting auto-capture apps.** The reviews add these Malaysian cases to cover:
  - the bank notification and the e-wallet notification for the same purchase;
  - a TNG or GrabPay reload funded from a bank;
  - a credit-card bill payment, which is a transfer and not spending.
- **Currency parsing per notification matters.** Users report "AUD 50 tracked as INR 50" and ¥1500 read as $1590. Moni already takes currency from the notification text ([`docs/AI.md`](../AI.md), extraction pipeline details).

### Threats

- **Silent capture failure is the largest risk.** `lib/notifications/permission.ts` reads whether listener access is granted. At commit `d9ac8ec` a code search finds no battery-optimization exemption request and no indicator of when each source last produced a capture. The reviews suggest three additions:
  - "last captured from Maybank 3 hours ago" for each linked app;
  - an alert when a source that usually fires daily goes quiet;
  - a one-tap "this was a transaction you missed" report.
- **Privacy at the permission prompt decides adoption.** The most-upvoted privacy review (137 votes) is a fear that an app reads one-time codes. The top positive reviews of Money Manager and Monefy praise those apps for not reading SMS. The Go backend skips one-time-code notifications before the model sees them (`oneTimeCode` in `apps/backend/internal/extract/service.go`). The on-device prefilter (`lib/notifications/notification-filter.core.js`) has no such rule. A code that quotes an amount, such as "TAC for a transfer of RM 300", therefore still leaves the phone. Moving the same check onto the device would let Moni promise that one-time codes never leave the phone. Other filtered notification text goes to a cloud model through the Go backend. Google Play requires Moni to say so in the app before it asks for access.
- **Duitful already ships notification capture for Malaysian banks.** Notification capture alone does not set Moni apart. The combination does: capture, auto-add, duplicate pairing, and chat.
- **Price expectations are low.** A Malaysian user compares Moni with RM19.90 one-time. A subscription near US prices would hit the most one-sided complaint in the data.
- **A forced AI interface drives users away.** Expensify and Monarch lost users when chat replaced direct controls. Keep chat optional and keep direct entry fast.

### Gaps

- **Data export.** At commit `d9ac8ec` no export exists. Export and import is the third most-requested feature (93 requests). After Seedly and 1Money, export is also a trust signal.
- **Most-requested features across all apps:** reports (172), categories and tags (99), export and import (93), investments (89), debt tracking (74), a web or desktop version (74), and receipts (71). Users also ask for savings goals, shared budgets, widgets and quick add, live exchange rates, and budgets aligned to payday.
- **Malaysian categories.** PTPTN, takaful, tolls, transit, and TNG reloads.
- **Idempotent restore.** Reinstalling to fix capture caused lost data and re-imported history in axio and FinArt. Restoring must not create a second copy of a transaction.

### Features with little demand

- **Location heatmap.** No review in the data asks for a spending heatmap. Users value location only to pre-fill a new entry, which is YNAB's best-loved trick.
- **Voice entry.** Fewer than 10 real mentions. Keep it, but don't lead with it.

## Read the numbers with these limits

- **Counts by year mislead.** The scrape took the newest reviews first, so 2026 has most of the reviews. For example, 848 of axio's 1,056 reviews are from 2026. One agent called axio's capture failures "rising" because 31 came from 2026. As a share of each year's reviews, they fell from 27% in 2025 to 3.7% in 2026. Compare shares, not raw counts.
- **1Money was not a shutdown.** It moved to forced subscriptions and revoked lifetime licences in January 2026. The app still runs.
- **Regular-expression counts are approximate.** The agents spot-checked matches by hand and labeled hand counts in the detailed reports.
- **Malaysian in-store data is thin.** The global apps came from the US storefront. Only 9 reviews in the global apps' data mention Malaysia. The Malaysian apps are mostly bank apps where budgeting is a side feature.
- **Some reviews are noise.** Half of Cleo's low reviews (589 of 1,185) are about cash advances. 182 Origin reviews were written for a sweepstakes entry. 206 of MAE's 932 five-star reviews are templated. The analyses count these separately.
- **Web claims carry source labels.** [`feature-landscape.md`](competitor-reviews-2026-10/feature-landscape.md) marks vendor and third-party claims, and it flags statistics such as "72% quit within 90 days" as unverified.

## Detailed reports

| File                                                                                | Contents                                                                                                                         |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [`reviews-moni_lens.md`](competitor-reviews-2026-10/reviews-moni_lens.md)           | All apps, organized by Moni feature, with the top feature requests                                                               |
| [`reviews-auto_capture.md`](competitor-reviews-2026-10/reviews-auto_capture.md)     | axio, FinArt, Rocket Money, Emma, and Wallet. SMS capture failures and bank sync                                                 |
| [`reviews-ai_assistant.md`](competitor-reviews-2026-10/reviews-ai_assistant.md)     | Cleo, Monarch, Copilot, and Origin. AI chat quality, pricing, and sync                                                           |
| [`reviews-ai_entry.md`](competitor-reviews-2026-10/reviews-ai_entry.md)             | Rolly, MonAi, SimplyWise, and Expensify. Receipt OCR, voice, and paywalls                                                        |
| [`reviews-classic_manual.md`](competitor-reviews-2026-10/reviews-classic_manual.md) | Money Manager, Money Lover, Monefy, 1Money, YNAB, and Cashew                                                                     |
| [`reviews-sea_regional.md`](competitor-reviews-2026-10/reviews-sea_regional.md)     | MAE, Ryt Bank, Finory, Belanjawanku, xFin, and SnappySpend                                                                       |
| [`feature-landscape.md`](competitor-reviews-2026-10/feature-landscape.md)           | Competitor AI feature matrix, pricing, Bank Negara Malaysia open finance, platform policy, and abandonment studies, with sources |
| [`malaysian-user-voice.md`](competitor-reviews-2026-10/malaysian-user-voice.md)     | Dated, sourced quotes from Malaysian and Singaporean forums and blogs, including the Seedly shutdown                             |
| [`apps.json`](competitor-reviews-2026-10/apps.json)                                 | Verified Play and Apple ids for every app, with its group and advertised AI features                                             |
