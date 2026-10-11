# Classic manual trackers: review analysis

Slice: `classic_manual`. Apps: Money Manager (Realbyte), Money Lover, Monefy, 1Money, YNAB and Cashew.

## Data and method

| App                             | Reviews   | Low (1–2★) | Mid (3★) | High (4–5★) | Low share | Play avg | Play low reviews with a dev reply |
| ------------------------------- | --------- | ---------- | -------- | ----------- | --------- | -------- | --------------------------------- |
| Money Manager (Realbyte), "MMR" | 1,844     | 101        | 72       | 1,671       | 5.5%      | 4.52     | 62 of 63                          |
| Money Lover, "ML"               | 1,770     | 525        | 155      | 1,090       | 29.7%     | 3.39     | 240 of 393                        |
| Monefy                          | 1,464     | 337        | 121      | 1,006       | 23.0%     | 3.85     | 54 of 246                         |
| 1Money (Play only)              | 1,110     | 340        | 58       | 712         | 30.6%     | 3.56     | 27 of 340                         |
| YNAB                            | 2,033     | 664        | 204      | 1,165       | 32.7%     | 3.31     | 369 of 403                        |
| Cashew                          | 1,063     | 22         | 17       | 1,024       | **2.1%**  | 4.81     | **20 of 20**                      |
| **Total**                       | **9,284** | **1,989**  | **627**  | **6,668**   | 21.4%     |          |                                   |

How the counts were made:

- Each count is the number of reviews whose title and text match a case-insensitive regex. They are written as `low/mid/high` or "N of 1,989 low". One review can count toward several themes.
- The scripts were session-only and are not kept. They were:
  - `count.mjs`, `c.mjs` and `cc.mjs` count theme matches.
  - `g.mjs` pulls quotes.
  - `yr.mjs` and `ev.mjs` count by period.
  - `fr2.mjs` counts feature requests at the sentence level.
- The regexes are crude. Read the counts as orders of magnitude.
- Each quote is tagged `[app store:id-suffix ★ date]`.
- **Sampling skew.** The scrape takes the newest 800 reviews plus the most relevant 400 per app. That makes 2025–2026 heavy: 1,199 of MMR's reviews and 856 of Cashew's are from 2026. So year-over-year volume says little. Trends below are read either within one event window or as a share of low reviews.

---

## Pain points (ranked by low-review volume)

### P1. Data loss from sync, backup and restore failures, especially when changing phones

**Combined count:** 196 of 1,989 low reviews (plus 29 mid and 99 high) mention lost or wiped data, a failed sync, or a failed backup or restore.

- The pattern is `data_or_sync` in `c.mjs`: `lost … data|transactions|records…`, `(data|entries…) … gone|wiped|erased|disappeared`, `sync… fail|not|stopped|error`, and `restor|backup … not|fail|never|unable`.
- The split by app is 1Money 66, Money Lover 47, Monefy 45, YNAB 18, MMR 13 and Cashew 7.

**Sub-counts:**

| Sub-theme                                 | Low reviews | By app                               |
| ----------------------------------------- | ----------- | ------------------------------------ |
| Explicit data loss                        | 102         | 1Money 42, ML 32, Monefy 18, MMR 9   |
| Sync failures                             | 123         | 1Money 39, ML 34, Monefy 23, YNAB 20 |
| Backup exists but restore fails           | 37          | Monefy 13, 1Money 12, Cashew 5       |
| Data lost on a new phone or factory reset | 45          | Monefy 17, 1Money 12, ML 9           |

**Quotes:**

- "I JUST LOST ALMOST FOUR YEARS OF DATA IN ONE DAY." The app turned out to keep local backups only. [1money play:98f8b02e ★1 2026-01-07]
- "you can backup and save data but can't restore it from that backup … when I brought a new phone I wasn't successful in restoring". This review has 158 thumbs-up. [monefy play:3c7c220a ★4 2020-01-09]
- "I was backing up to Google regularly on my previous smartphone but somehow it is not able to detect those backups in new smartphone. Years of transactions are lost." [cashew play:eefb97e1 ★3 2025-09-24]
- "Updating wiped all my data … all my added categories all my accounts." [money-manager-realbyte apple:89652798 ★1 2026-08-30]

**Trend:** this theme comes in event spikes.

- 1Money's developer removed cloud sync and login without notice in January 2025. In 2025, 68 low reviews mention sync, against 0–1 per year before. 73 of the 107 low reviews from January to June 2025 match `sync|log ?in|abandon|dead`.
- Money Lover's October 2023 category migration duplicated or erased data. The data-loss count in its low reviews rose from 4 in 2022 to 7 in 2023 and 10 in 2024.
- Restore failures in Cashew are the largest single theme among its 22 low reviews (8 of 22).

### P2. Paid features taken back: lifetime licences revoked, the free tier cut, premium reverting to ads

**Count:** 120 of 1,989 low reviews. By app: 1Money 41, Monefy 32, ML 29, YNAB 12, MMR 6 and Cashew **0**.

- The pattern is `monetization_betrayal`: purchase words followed within 80 characters by `revert|revoked|lost|no longer|pay again…`, or `paywall|took away|forced to pay|(remove|cut|limit) … features|free version`.

**1Money, December 2025 to April 2026.** Lifetime licences were converted to subscriptions, users were logged out, and password resets never arrived.

- Between December 2025 and October 2026, 121 of 190 low reviews match `lifetime|licence|subscription|log in|password`.
- Quotes:
  - "they also deactivated my account so I have no longer access to my lifetime license". [1money play:d2844dee ★1 2025-12-29]
  - "now I'm required to pay just to export my own data". [1money play:c536eefc ★1 2026-01-10]

**Monefy.** A one-time "Pro" purchase was replaced by a subscription priced at about 2,600 INR or €32 a year. Dark mode moved behind the paywall. The low-review counts by year are 2023: 8, 2024: 4, 2025: 4 and 2026: 9, so the theme is still active.

- Quotes:
  - "My previously purchased lifetime pro deal is apparently now null and void". [monefy play:a0bd6903 ★1 2025-05-13]
  - "I'm not going to pay a subscription to be able to enable dark theme when I've had it since day one". [monefy play:d8fc4671 ★2 2024-11-29]

**Money Lover, 2022–2023.** The free tier lost custom categories, search, and the ability to view any previous month.

- Among the 74 low reviews from June 2022 to September 2023, 61 match pricing or free-tier words.
- Paywall low reviews by year: 2022: 17, 2023: 6, 2024: 3. The theme is fading.
- Quote: "in the free version you are not even able to see ANY past month's expenses. I am in Jan 2023 and I can't see ANY of the expenses I recorded in the entirety of 2022". [money-lover play:e009e2c5 ★1 2023-01-02]

**MMR.** The paid "remove ads" version keeps reverting to the ad-supported one, especially after a Google account switch or a new phone. 10 of 101 low reviews mention it, mostly in 2026.

- Quote: "it keeps switching my Google account. I paid for the app using this current account, but it always … asks me to pay AGAIN". [money-manager-realbyte play:39ecfe1e ★2 2026-10-15]

### P3. Forced redesigns and updates that break a learned workflow

**Count:** 230 of 1,989 low reviews. By app: YNAB 116, ML 54, 1Money 39, Monefy 15.

- The pattern is `redesign`: `(new|latest|recent|last) (update|ui|design|version|layout)|redesign|home (tab|page|screen)|ui change`.

**YNAB, September 2025 onward.** A new "Home" tab now sits before the budget, and "budget" was renamed "plan". The redesign regex matches 59 low reviews in 2025 and 50 in 2026, against 0–5 per year before. The complaints centre on quick entry while out:

- "The new home tab is bad and makes it more difficult to enter transactions quickly on the go". [ynab play:3dd45426 ★1 2025-09-16]
- "No longer do they care about making it easy for you to enter your transactions when you are out and in a hurry". [ynab play:ab1c9c41 ★1 2025-09-19]

**Money Lover, October 2023.** A forced "combine categories" migration ran with no option to skip it. 36 of 123 low reviews from October 2023 to June 2024 mention categories.

- Quote: it "made 7 years of transaction data … totally irrelevant since the categorization is now completely inaccurate". [money-lover play:4cd5ec6e ★1 2023-10-08]

**Monefy, August to September 2023.** An update brought lag, missing dates and "Synchronization failed" popups. 28 of 40 low reviews in that window match `slow|lag|sync|date|scroll|loading|back button`.

**Cashew, May 2026.** A redesign brought stutter and battery drain. 40 of 835 reviews since April 2026 mention lag, stutter, battery or the redesign.

- Quote: "Recent redesign made the app less intuitive and more laggy even on flagship device." [cashew play:0a7cdb1f ★3 2026-05-10]

### P4. Ads and upsell popups

**Count:** 113 of 1,989 low reviews. By app: ML 34, YNAB 34, Monefy 26, MMR 18, 1Money 1, Cashew **0**.

- The pattern is `\bads\b|\bad\b|advert|pop.?up`.
- Cashew instead has 71 high reviews that mention ads, almost all to say "no ads".

**The UI complaint is about placement.** Ads sit where people tap to enter data:

- "Instead of putting money amount into the app, I sometimes accidently click on the ads instead." [money-lover play:7e42204b ★1 2022-10-24]
- "every input of words comes with ads". [money-manager-realbyte apple:55008673 ★1 2025-07-30]

**Monefy** shows a fake-urgency discount popup every time the app opens: "offer ends by midnight, but this offer never seems to end!" [monefy play:04b9891f ★3 2022-03-25]

**MMR is getting worse.** 13 of its 18 low ad mentions are from 2026: "now they are too many ads and the ads are like forever to finish … takes forever to load". [money-manager-realbyte play:799a35c1 ★2 2026-08-02]

**YNAB, a paid app,** started pushing book ads in 2026. [ynab play:1c16cd29 ★1 2026-06-22]

### P5. Subscription price increases (YNAB almost entirely)

**Count:** 95 of 1,989 low reviews, 78 of them YNAB.

- The pattern is `sub_price`: `(price|subscription|cost|fee) … increase|hike|doubl|expensive|steep`, `overpriced`, or `$NN/year`.
- YNAB doubled its price in November 2021: 33 of 52 low reviews from October 2021 to December 2022 match price words. Price complaints came back with 18 low reviews in 2025 and 30 in 2026.

**Quotes:**

- "It's peak irony for a budgeting app". [ynab play:556f64e1 ★1 2021-11-07]
- "This app should cost a one-time payment of $60 or $5/month at most". This review has 238 thumbs-up. [ynab play:9468474b ★3 2022-06-30]

### P6. Developer support does not respond, which turns bugs into 1★ reviews

**Count:** 72 of 1,989 low reviews. By app: Monefy 29, 1Money 22, ML 16. MMR has 2, and Cashew and YNAB are near 0.

- The pattern is `no response|never replied|support … unresponsive|non-existent|bounced`.

**Quotes:**

- "No reply from support for months, but every review is being commented daily … the daily review replies are obviously manipulated". [monefy play:046ccc8a ★1 2026-10-07]
- "Their customer service is trash! I've emailed them for a month now". [monefy play:78511921 ★1 2022-06-16]

### P7. Performance regressions

**Count:** 103 of 1,989 low reviews. By app: ML 39, YNAB 30, Monefy 26.

- The pattern is `slow|lag|stutter|freez|battery|crash|loading`.
- Monefy's 2023 update accounts for 19 of its 26. The second most-helpful Money Lover review is "The back button is not working", with 139 thumbs-up. [money-lover play:495cd246 ★3 2025-01-15]

### P8. Manual-entry fatigue and forgetting to log

This is the quiet cause of abandonment. It is small as an explicit low-review complaint but steady inside 4–5★ reviews.

**Explicit burden:** 19 low, 8 mid and 36 high reviews.

- The pattern is `manual_burden`: `have to … enter|input every|each|all`, `everything is manual`, `manual entry … tedious|tiresome|time|only con`.
- The high-review mentions are mostly "the only con is manual entry".

**Forgetting or giving up:** 11 low, 5 mid and 29 high reviews.

- The pattern is `forg[eo]t … track|log|enter`, `stopped tracking`, `fell off` or `gave up`.
- Requests for a reminder to log appear in 52 reviews (`remind`).

**Self-selection.** People who quit over manual entry rarely come back to write a review. The evidence is reviewers describing their own lapses and why they had quit other apps:

- "I ended up forgetting the tracking for 2 days and it turned into 3 months and I decided to leave it … simple reminders don't work." [cashew play:6a8b0373 ★5 2026-03-02]
- "I've tried to track my expenses … many times using different methods and apps but I always get too frustrated, confused, or just forget about it a week or so later." [money-manager-realbyte play:53e12e8d ★5 2019-12-31]
- "I hate that everything is done manually … I work 11 hours a day and sometimes I just don't have the energy or time to do it manually." [money-manager-realbyte apple:64625440 ★2 2025-08-26]
- "I started off as manually entering my expenses but got tired of it … The manually entry is tiresome and I can do that with free apps or a spreadsheet." [ynab play:33b27e70 ★1 2025-05-13]
- "it's often a hurdle for me to input the transaction manually. Please add parsing of SMS". [money-manager-realbyte play:aa4d23e9 ★1 2026-04-10]

**The counterweight: manual entry as a feature.** 29 high reviews say manual logging is the point.

- The pattern is `manual_benefit`: `manual … conscious|aware|in check|prefer|best part`.
- "it didn't link up to my bank but it's better that it doesn't. I have to enter every transaction manually and it's making me more self conscious about where my money goes." This review has 87 thumbs-up. [cashew play:0c9b1df5 ★5 2025-01-09]
- "You do need to manually input every transaction … but honestly that in my opinion is the best part." [money-manager-realbyte play:aaa321a3 ★3 2026-09-02]

### P9. The data model fights the user: credit cards, categories per wallet, recurring entries, transfers

- **Credit cards as a liability.** 20 low and 53 high reviews raise it, 15 of the low ones YNAB. The pattern is `credit card … payment|limit|liability|balance|bill|statement`. The most-helpful Cashew 3★ review is about recording credit-card payments ("It insists on listing as 'correction' instead of payment"). [cashew play:2b480544 ★3 2026-03-03] For YNAB: "credit card accounts are added (forced) as their own category … no way to assign it". This review has 181 thumbs-up. [ynab play:051de770 ★1 2023-04-12]
- **Categories per wallet (Money Lover).** At least 10 low reviews, and many more in mid and high. "I just want one category list that works with everything. That's a deal breaker for me". [money-lover play:4816afda ★3 2022-04-19]
- **Recurring entries that duplicate or vanish.** 19 low reviews (`recurring_dup`), ML 10. "it randomly puts back in ones deleted … about $28,000 worth of old repeaters". [1money play:f49a23d3 ★1 2021-10-22]
- **Duplicates in general.** 16 low reviews, ML 8 and YNAB 5.

### P10. Bank-sync breakage, in the apps that have it (YNAB and Money Lover)

**Count:** 83 of YNAB's 663 low reviews mention import or connection failures.

- The pattern is `(bank|import|connect|link|sync) … fail|not|disconnect|delay` or `relink|reconnect`.
- 26 of Money Lover's low reviews mention its paid "linked wallets" add-on, mostly as not working or as an extra charge on top of premium.

**The most damaging detail:**

- "It doesn't notify when an account disconnects, so you can be looking at incorrect numbers and not know". [ynab play:0e6bb6bd ★2 2023-07-07]

Bank sync is the main automation people pay for in this cohort, and it is fragile.

---

## Multi-currency (cross-cutting)

**Mentions:** 25 low, 21 mid and 134 high reviews (`currenc|exchange rate`).

- Mostly positive: 50 high reviews praise multi-currency support. The pattern is `(multi|different|foreign) currenc…`.
- The complaints are specific and come up repeatedly. They are concentrated in MMR, Monefy and 1Money.

**Where people praise it:**

- Accounts in different currencies, with automatic conversion. "The best thing is having accounts in multiple currencies, and the transactions get converted automatically. For someone who lives and works in different countries, this app is just a gem." [1money play:d77c9a79 ★5 2021-03-13]
- Being able to override the rate and add fees on a transfer. "Able to change the exchange rate manually (and add fees) for transfer within accounts, super convenient". [money-manager-realbyte play:983da50d ★4 2024-06-06]
- Cashew users cite multi-currency together with the web app as their reason to switch: "the most important things are support for multi-currency and web app". [cashew play:def755a1 ★5 2024-11-11]

**What breaks:**

- **Changing the base currency** rewrites history at today's rate. There are 8 reviews (`(change|switch) … (base|main) currency`).
  - "The way exchange rates are applied to old transactions when you switch currencies results in all your balances being incorrect." [money-manager-realbyte play:52c8c9b9 ★2 2026-05-02]
- **Cross-currency transfers** cannot record both legs' actual amounts.
  - "Transfers between two non-base currencies must be routed via the base currency, so you can't enter send/receive amounts directly." [money-manager-realbyte play:65f81e27 ★3 2026-04-13]
  - "the ability to manually enter amount in BOTH currencies while adding transfer … Exchange rate differs … depending on the bank". [cashew play:df76db6f ★5 2024-08-31]
- **Stale or manual rates.** 22 reviews (`exchange rate … manual|outdated|wrong|1:1`).
  - "the exchange rate between euro and us Dollar is 1:1, but it's not true!" [monefy play:b905eb19 ★3 2025-01-14]
  - Lebanon's unofficial rate: "add an option on each transfer to specify the exchange rate". [money-manager-realbyte play:ee182e22 ★4 2022-03-01]
- **Sums mixed across currencies.** "it will sum all of them into 1 currency instead of showing them separately". [monefy play:86bccd64 ★3 2020-07-01]

---

## Delights (why people stay and recommend)

### D1. Simple, uncluttered and easy

- **Count:** 1,537 of 6,668 high reviews. The pattern is `simple|minimal|clean|intuitive|easy to use|user-friendly|straightforward|easy`. It is broad, but this is the default reason to love these apps.
- **Contrast:** the same words appear in only 174 of 1,989 low reviews, and in those they mostly lament something lost: "used to be simple".
- **Example:** "If you like Craigslist because it does exactly what it needs to do without any extra fluff … you'll love this. Note that it's not Mint. Everything is manual. But that's the fun of it." [money-manager-realbyte play:5ac0621b ★5 2020-04-16]

### D2. Fast entry, and the UI details people name

**Quick-entry praise:** 79 high reviews. The pattern is `quick_add`: `quick to add`, `in seconds`, `few taps`, `easy to enter`, `quick add`, `calculator`.

- "adding expense is so easy. You just hit the category and enter the amount. That's it." [1money play:7a98a550 ★5 2021-08-24]
- "Fire up the app, type the amount, tap on the check mark. For most transactions, that's it. Forgot to add yesterday's coffee bill? … tap the calendar icon". [1money play:0b42c1b0 ★5 2020-02-13]
- "very simple to enter a new expense, which is most frequent action in such apps!" [1money play:7a3edd06 ★3 2022-07-10]
- "Perfect for manual budgeters who want control and get-it-done-in-5-seconds flow." [money-manager-realbyte play:2e24e425 ★5 2026-09-02]
- "It requires a lot of manual input which can be daunting at the beginning but each input is very simple and can be done in seconds." [cashew play:f3ec9ce9 ★5 2024-05-18]

**Specific UI details named in reviews, good and bad:**

| Detail                                                            | What people say                                                                                                                                                                                                                                                          | Count / source                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| Category-first entry: tap a category, then type the amount        | 1Money and Monefy are praised for it                                                                                                                                                                                                                                     | See quotes above              |
| A built-in calculator in the amount field                         | MMR, Money Lover. "easy to input (good calculator feature)" [money-lover play:29a47587 ★3 2019]                                                                                                                                                                          | 36 reviews (`calculator`)     |
| Number pad opens on its own, Save at the bottom, one-handed reach | Money Lover is criticized for missing this. "Other apps I tried popped up number pad automatically and save was on the bottom." [money-lover play:f767c06e ★3 2021-01-02]                                                                                                |                               |
| Pie chart or ring graph on the home screen                        | MMR                                                                                                                                                                                                                                                                      | 38 high reviews (`pie chart`) |
| "Left to spend per day" figure                                    | Cashew. "every day it calculates how much you can spend for the rest of the month … Seeing that go up every time I dont buy anything … is very rewarding". [cashew play:e09668d3 ★5 2024-11-15]                                                                          |                               |
| Default account = last used                                       | Requested. "Default selected account for new transactions should be the last one used". [1money play:38ea0fbd ★1 2024-12-31]                                                                                                                                             |                               |
| Category icons with tiny names                                    | Disliked. "gives more importance to icons … Name of category is in small fonts". [cashew play:922e7a8e ★3 2024-03-29] Also "It uses picture icons for everything. You are expected to remember what image goes with what purchase". [monefy play:e133a30b ★1 2023-10-28] |                               |
| Wallet chosen before category                                     | Money Lover. "what is the reason behind restricting selection of category before selecting a wallet?" [money-lover play:9f9cd759 ★3 2019-03-12]                                                                                                                          |                               |
| Deleting one digit clears the whole number                        | MMR's keypad. [money-manager-realbyte play:df649448 ★2 2026-05-01]                                                                                                                                                                                                       |                               |
| Location memory                                                   | YNAB "can geo-tag and then repeat those details (bank account, category) the next time you make a purchase in that area". [ynab play:fdd659a3 ★5 2022-04-06]                                                                                                             |                               |

### D3. Home-screen widgets

**Count:** 68 high reviews against 6 low (`widget`). Widgets are also requested in 23 feature-request sentences.

- "WIDGET- There's a simple widget u can add to homescreen that makes adding transactions easier on the go". [cashew play:0d001e4e ★5 2025-06-08]
- "The widget is so simple, it is a 1x1 square with a circular minus sign to quickly input your spending." [1money play:6aec8351 ★5 2018-12-06]
- Money Lover's persistent notification widget "let's you easily add transactions". [money-lover play:bd4e3641 ★5 2019-07-05]
- A widget as a spending nudge: "When I see the widget, I am reminded that enough is enough lmao." [monefy play:cb97d469 ★5 2022-07-01]
- A budget-remaining widget: it shows "the remaining amounts in each of my top categories without even opening the app". [ynab play:ff5ab0a6 ★5 2025-07-01]

### D4. No bank link, privacy, offline use

**Counts:**

- 41 high reviews value not linking a bank, privacy, or not reading SMS (`privacy_pref`).
- 29 high reviews say manual logging is the point (`manual_benefit`, D8).
- 19 high reviews mention offline use (`offline|no internet`), 7 of them Cashew.

**Two of the most-helpful positive reviews in the cohort praise the absence of SMS reading:**

- "Liked the fact that it is a standalone app and does not read your SMS, like many others do." This review has 99 thumbs-up. [money-manager-realbyte play:e6d89dea ★4 2019-11-01]
- "it won't ask you permission to read your messages or get your location." This review has 141 thumbs-up. [monefy play:22db4ef2 ★4 2021-10-06]

**Other quotes:**

- "you can sync using Google drive, but works completely offline if desired, it's cross platform". [cashew play:14b09839 ★5 2026-06-23]
- "I have an obscure bank that is not able to be connected to by any apps so whenever it's required (i.e. Mint) I can't use the app." [1money play:99ef7887 ★5 2020-03-28]

### D5. A one-time purchase instead of a subscription

**Count:** 210 high reviews (`one.time|lifetime|not a subscription|no subscription`).

- 103 of these are 1Money reviews written before the licences were revoked. That is why the theme is also behind P2.

**Quotes:**

- "props to the fact that the pro version is a one time purchase and not a subscription. Much much much better." [money-manager-realbyte play:e90d719f ★5 2024-03-06]
- "thanks for being legends and not charging a subscription". [money-manager-realbyte play:6f62996b ★5 2026-06-10]
- "the paid version is inexpensive and worth it (and not a subscription!)". [monefy play:75acf193 ★4 2020-08-08]

### D6. Customization, categories and subcategories

**Counts:** 199 high reviews mention customization. 96 high reviews mention subcategories. Subcategories are also a top complaint where they are paywalled or missing (Monefy).

### D7. Behavior change and replacing a spreadsheet

**Counts:**

- 269 high reviews describe a change in behavior, 204 of them YNAB. The pattern is `conscious|aware|mindful|changed my life|paid off|saved money|spending habits|where my money goes`.
- 445 high reviews mention spreadsheets, Excel, a notebook or a notes app, mostly as what the app replaced. MMR accounts for 152 and Cashew for 60.

**Quote:**

- "I've never been more financially healthy and communicative". [ynab play:0ce8202a ★4 2019-02-08]

### D8. Manual logging as mindfulness

See P8.

- "having to do it manually makes it easier to keep myself in check which is why I want this app!" [monefy play:0e7eb18b ★5 2018-09-19]

### D9. Developers who respond

**Reply rates on low Play reviews:**

- Cashew replies to 20 of 20 and MMR to 62 of 63. Both apps have the lowest negative shares.
- Monefy replies to 54 of 246 and 1Money to 27 of 340.

**Upgrades after a reply:**

- "Bumped it up to 4 stars after the developer responded quickly". [cashew play:0352853f ★4 2024-02-27]
- "The two changes I asked for were implemented and I signed up for the premium app." [money-manager-realbyte play:e99ce72c ★5 2023-07-06]

---

## Why Cashew is loved (2.1% negative, versus 23–33% for ML, Monefy, 1Money and YNAB)

**What Cashew is.** Cashew is offline-first and multi-currency, with optional Google sign-in, Google Drive backup and sync, and a free web app. "Pro" costs about $1.49 a month or about $15–20 for life. It can be unlocked for free, and the app asks users to pay as support.

**What its 1,024 high reviews mention:**

| Driver                            | High reviews (of 1,024) | Pattern / note                             |
| --------------------------------- | ----------------------- | ------------------------------------------ | ------ | ---------------- | ------------- | ------------ | --- | --------- | ------- |
| Easy, simple, intuitive           | 246                     |                                            |
| Design or UI praise               | 196                     | `beautiful                                 | pretty | aesthetic        | well-designed | Material You | ui  | interface | design` |
| "Free"                            | 146                     |                                            |
| Customization                     | 86                      |                                            |
| Premium free or pay-what-you-want | 63                      | `premium … for free                        | donate | support the dev` |
| Categories                        | 63                      |                                            |
| Stats                             | 47                      |                                            |
| No ads                            | 47                      |                                            |
| Sync or backup                    | 46                      |                                            |
| Lifetime option                   | 41                      |                                            |
| Goals                             | 31                      |                                            |
| Recurring / subscriptions         | 31                      |                                            |
| Switched from other apps          | 27                      | Wallet, Bluecoins, Spendee, Monefy, 1Money |
| Open source                       | 17                      |                                            |
| No bank link                      | 16                      |                                            |
| Multi-currency                    | 15                      |                                            |
| Widget                            | 15                      |                                            |
| Web app                           | 12                      |                                            |
| Offline / sign-in optional        | 9                       |                                            |

**Why the negative share is so low:**

1. **Nothing has been taken back, and the free tier is the full app.** Cashew has 0 low reviews in the monetization theme, against 120 across the cohort. Its pricing is the inverse of the betrayal pattern (P2), the biggest reason long-time users of the other apps leave. Without being asked, users volunteer that they will pay anyway:
   - "it is offered for free with a prompt asking, sincerely, for support. At a cool $20.00 for lifetime access … I am happy to pay for such an open payment model." [cashew play:e3f84dfc ★5 2024-10-12]
   - "get all the pro features for free and the pop ups aren't annoying either. I fully intend on paying for pro soon. The creators deserve the support." [cashew play:0c9b1df5 ★5 2025-01-09]

2. **No ads at all.** Cashew has 0 low ad mentions against 113 for the cohort, and 47 high reviews say "no ads". The second most-helpful Cashew review compares it with apps "riddled with nuisance ads". [cashew play:33b4472e ★5 2025-04-19] A switcher from Wallet cited ads "where the 'X' is on different sides of the screen". [cashew play:98b897e7 ★5 2024-06-29]

3. **Design quality as a reason to log.** 19% of high reviews praise the design. Reviewers call it "visually beautiful" and "esthetically pleasing" and praise its "micro-details":
   - "I really loved all the micro-details, that the team paid attention to". [cashew play:10e1a419 ★5 2025-03-30]
   - "I find myself actually excited to track down past expenses just to add it in". [cashew play:1e982e01 ★5 2026-06-07]

4. **Privacy-first and do-it-yourself, without being bare-bones.** It offers budgets, goals, subcategories, loans, recurring entries, forecasting, a web app, CSV import and export, and multi-currency.
   - "Most budgeting apps either harvest your financial data for convenience or leave you to manage everything yourself. Cashew takes the privacy-first DIY route and does it exceptionally well." [cashew play:d7f9bb9f ★5 2026-05-30]
   - "one of the most compete and functional apps for managing your transactions in the classic style of 'I'll do it myself'". [cashew play:1fa6bce7 ★5 2024-10-02]
   - "BY FAR the best budgeting app … I didn't have this one for probably more than 20 minutes before I deleted all my others." This review has 366 thumbs-up. [cashew play:cde5863b ★5 2025-01-31]

5. **A developer who replies to every review, plus a rating-update ask.** Cashew replies to 100% of its low Play reviews. The reply template ends with "Consider updating your review to 5 stars if you enjoy the app." Several reviews were edited upward after a reply (0352853f, d8dddbb8, f3ec9ce9). This is a real driver of the score, but it also inflates the 2.1% somewhat.

6. **Inbound migration from the apps in P2.** One user posted a guide to moving 1Money data into Cashew. It has 37 thumbs-up [1money play:eab8e446 ★1 2025-01-16]. Others moved over from Wallet, Bluecoins, Spendee and Monefy. People arriving after a bad experience elsewhere tend to rate the alternative generously.

7. **A young app with no history of breaking promises.** Its reviews start in October 2023. Note that 856 of its 1,063 reviews are from 2026.

**Where Cashew is weak, which is useful for Moni:**

- Sync and backup reliability: 8 of 22 low reviews.
  - "Even if I use ONE device and backup after every use, transactions are lost". [cashew play:619c6bb6 ★1 2026-05-31]
- The May 2026 redesign brought lag, stutter and battery drain (40 reviews since April 2026).
- Credit-card handling: "I hate the transfer option! It insists on listing as 'correction'". [cashew play:2b480544 ★3 2026-03-03]
- Gaps people name:
  - no running balance or end-of-month projection [cashew play:0fa5b971 ★3 2025-12-10]
  - entering both amounts in a cross-currency transfer
  - CSV import that drops transactions into the wrong month [cashew play:52fc2be0 ★2 2026-08-24]
- Requests for SMS auto-capture (2 high reviews with 33 and 28 thumbs-up):
  - "if you could add an option to automatically read balances and spends from SMS … Users just have to add the category or title then." [cashew play:8305603d ★5 2024-02-07]
  - "I hope in the future that there's a functionality to read SMS messages and automatically make transactions - then it would be beyond perfection." [cashew play:b0cc7416 ★5 2024-09-30]

---

## Feature requests

**Method.** Sentences were matched for request wording: `wish|please add|would be great/nice if|would love|missing|i'd like|should have|there's no|no way to|can't …`. The next sentence was then checked for a topic. 884 reviews contain at least one topical request.

| Request                                                                                              | Reviews                                                | Where it concentrates                    |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Better reports and charts (category trends, month-over-month, custom ranges, values not percentages) | 126                                                    | YNAB 31, MMR 27, ML 22                   |
| Export and import (CSV import, PDF reports, backup files)                                            | 114                                                    | MMR 28, 1Money 25, YNAB 20               |
| Multi-device sync                                                                                    | 91                                                     | All apps; MMR's "PC Manager" is LAN-only |
| Loans and debts tracking                                                                             | 80                                                     | Spread evenly                            |
| Credit-card model (limit, statement, payment as a transfer, installments)                            | 78                                                     | ML 20, MMR 15, YNAB 15, Cashew 11        |
| More icons, colours, themes, dark mode                                                               | 72                                                     | Monefy 28                                |
| Flexible recurring (bi-weekly, every 4 weeks, recurring transfers)                                   | 68                                                     |                                          |
| Web or desktop version                                                                               | 64                                                     | YNAB 32                                  |
| End-of-month forecast, running balance                                                               | 61                                                     |                                          |
| Search and filter (by amount, subcategory, multiple terms)                                           | 61                                                     |                                          |
| Share with a partner (who logged what)                                                               | 54                                                     |                                          |
| Attach receipt or invoice photos                                                                     | 50                                                     | 1Money 20                                |
| Multi-currency fixes (see the section above)                                                         | 47                                                     | MMR 16                                   |
| Savings goals                                                                                        | 35                                                     |                                          |
| Quick-entry helpers (default account, templates, favourites)                                         | 35                                                     |                                          |
| Payee or merchant field                                                                              | 34                                                     |                                          |
| Investments                                                                                          | 31                                                     |                                          |
| Reconcile / pending flag                                                                             | 29                                                     |                                          |
| Split transactions                                                                                   | 25                                                     |                                          |
| More widgets                                                                                         | 23                                                     |                                          |
| Tags or events for trips                                                                             | 15                                                     |                                          |
| Voice or AI entry                                                                                    | 12                                                     | MMR 8, all from 2025–2026                |
| SMS or bank-notification parsing                                                                     | 10 sentence-level; 17 reviews in any rating mention it |                                          |
| Reminders to log                                                                                     | 6                                                      |                                          |

**Requests that map directly onto Moni's AI capture:**

- "I need this app listening to my sms inbox and read card payments alert messages and add them as expenses records in the app automatically **with my approval**." [money-manager-realbyte play:383f14f1 ★5 2026-04-26]
- "Would be nice if it could auto update amounts from SMS notifications. Or maybe even allow voice commands natively or through the phone assistant like Gemini". [monefy play:d5763ddc ★4 2025-11-05]
- "any plans to introduce an AI-powered Voice Expense Entry feature? … just speak our expenses (e.g., 'Spent 200 on groceries')". [money-manager-realbyte play:e3e8a842 ★3 2026-07-21]
- One user left Money Lover for "another with BULK ENTRIES with AI. It's 2025". [money-lover play:ba65de97 ★4 2025-07-03]

**AI that acts on its own gets a backlash.**

- YNAB has 13 low reviews mentioning AI in 2026, mostly about AI support chatbots. One is about silent automation:
  - "it keeps surprising me with 'helpful' AI interventions … an 'automatic reconciliation adjustment' that threw off my cleared balance by over $2000 … There is no way to turn this function off … Please make these AI interventions optional!" [ynab apple:07843135 ★4 2026-08-09]
- Older YNAB reviews draw the line Moni draws:
  - Praise: "YNAB makes suggestions based on your previous categorizations, but leaves the final decision to you." [ynab apple:95855661 ★5 2020-12-26]
  - Criticism: "when adding new transactions it guesses what category and account you want rather than forcing you to choose them. This has resulted in mistakes". [ynab play:0d57160a ★2 2019-09-15]

---

## Noise versus signal

These themes are real but say little about Moni's design.

- **YNAB's method and price.** Its learning curve (71 low reviews), credit-card category mechanics, the $99–109 a year price (78 low) and its US bank-aggregator failures are specific to a subscription envelope-budgeting product that syncs with banks. They count for the cohort, but their only lesson for Moni is caution about price changes. The bank-sync failures do support Moni's no-bank stance (P10).
- **Money Lover's paid "linked wallets" add-on** for certain Philippine and US banks (about 26 low reviews) is about bank sync, not manual tracking.
- **Unrelated:**
  - MMR reviews blaming the app for fraud calls or phantom ringing (2 reviews), and an Apple review alleging card fraud (1).
  - Cookie-consent walls with no "Reject all" (4 low).
  - Reviews written to get a developer's attention ("I give 1 star until you reply").
- **1Money's Russia-related Google Play payment outage** (January 2025) explains the abandonment. It is an operational failure, not a product one. The lesson still holds: when the backend goes, users lose their data.
- **Short, low-content reviews.** About half of Cashew's high reviews are under 80 characters ("good", "I am addicted to this app"). The driver counts above are based on all high reviews, and the share among long reviews is similar.

---

## Implications for Moni

Labels: **[E]** = evidence-backed by the counts above. **[I]** = inferred.

1. **Data durability is the top risk for an offline-first app, so make backup, restore and device migration impossible to get wrong.** This threatens Moni's offline-first core. **[E]**
   - Lost data and sync or restore failures are the largest low-review theme: 196 of 1,989.
   - Phone switches are a named trigger in 45 low reviews.
   - Even Cashew's few complaints are mostly this.
   - What Moni needs:
     - automatic cloud backup with a visible "last backed up" time
     - a tested restore on a new device
     - a free, always-available export
   - The 1Money cases where export or backup was put behind a paywall, or locked behind a login that broke, are the worst outcomes in the data set.

2. **Never take back what users paid for or used for free.** No existing Moni feature covers this; it is a policy. **[E]**
   - Monetization betrayal accounts for 120 low reviews and is the main reason multi-year users write 1★.
   - A one-time purchase is praised in 210 high reviews.
   - Cashew's model (full app free, pay to support or for a cheap lifetime) produced 0 monetization complaints.
   - If Moni charges for its AI capture because of inference costs, users will accept it best as a clearly scoped add-on. The manual core should stay free and ad-free. **[I]**

3. **Notification capture and voice/chat capture answer a real but quiet need.** This supports Moni's AI capture. **[E for the need, I for the size]**
   - Explicit manual-entry fatigue is small here: 19 low, plus 36 high reviews calling it "the only con".
   - Forgetting to log also appears (11 low, 29 high), and so do SMS-parsing and voice requests (about 17 reviews, rising in 2025–2026, concentrated in MMR).
   - These are self-selected manual users. The people who quit over fatigue mostly did not stay to review.
   - Moni's "propose, then approve" flow matches the exact wording users ask for ("with my approval").

4. **Privacy is a selling point for this audience, so frame notification reading as opt-in, on-device and reversible.** This partly threatens Moni's notification capture. **[E]**
   - The two most-helpful positive reviews in MMR and Monefy (99 and 141 thumbs-up) praise those apps for not reading SMS or asking for permissions.
   - Moni should:
     - make notification access a deliberate, explained toggle
     - keep manual-only a first-class mode
     - say clearly what leaves the device. The chat assistant's use of an aggregated snapshot rather than raw transactions is a strong message for this crowd. **[I]**

5. **Keep "Auto" visible, undoable and switchable.** This supports Moni's design: first-of-kind items always go to review, and Auto items are labelled. It also shows something to add. **[E, small n]**
   - The YNAB backlash is about silent AI changes that cannot be turned off.
   - YNAB's praise is for suggestions where the user makes the final decision.
   - Moni should add a global and per-source "never auto-add" switch, and a review log of Auto items.

6. **Duplicate detection and transfer pairing fix known pain.** This supports Moni's existing features. **[E]**
   - Duplicated recurring entries (19 low reviews; Money Lover's migration duplicates) and transfers counted as expenses (12 reviews) are recurring complaints.
   - Credit-card payments recorded as transfers are a top Cashew mid-rating complaint.

7. **Multi-currency must handle the hard cases.** This supports Moni's multi-currency, with gaps to close. **[E]**
   - Moni should:
     - let a cross-currency transfer record both actual amounts, with an implied rate and fee
     - allow a per-transaction rate override
     - change the base currency without re-pricing history
     - refresh rates while still working offline
     - never silently sum different currencies
   - These are the specific failures named across MMR, Monefy and Cashew.
   - For MYR users holding SGD, USD, IDR or THB, cross-currency transfers will be common. **[I]**

8. **Quick add and a home-screen widget.** These may be missing from Moni; widgets are not in its feature list. **[E for demand, I for the gap]**
   - 68 high reviews praise widgets and 79 praise fast entry.
   - The named details to copy:
     - category-first entry
     - a number pad that opens on its own
     - Save within thumb reach
     - default to the last-used wallet
     - an inline calculator
     - a 1×1 "minus" widget
     - a "left to spend today" figure
   - iOS users only have manual, chat, voice and receipt capture. For them, a widget plus logging reminders is the main fix for the "forgot for 2 days, then 3 months" pattern.

9. **Do not redesign the add-transaction path from under people.** This matters for Moni's roadmap. **[E]**
   - 230 low reviews are about forced redesigns or migrations. YNAB's Home tab (109 low reviews in 2025–26) and Money Lover's category merge both broke muscle memory or data.
   - Ship big UI changes behind an opt-in or with a "classic" option. Never run a destructive data migration without a skip option and a backup.

10. **Charts, the heatmap and budgets meet the top request.** This supports Moni's existing features. **[E]**
    - Better reports are the most-requested feature (126 reviews): trends by category over months, custom date ranges, and values as well as percentages.
    - Budgets with custom periods (from payday, yearly) and an end-of-month forecast are also asked for repeatedly (61 forecast requests; pay-cycle or custom budget periods come up in 145 reviews in any rating, 100 of them YNAB).

11. **Debts and credit cards.** Moni's debts feature supports this; a credit-card model may be missing. **[E for demand, I for the gap]**
    - Loans and debts are requested in 80 reviews and credit-card handling in 78.
    - A credit-card wallet with a limit and a statement date, where the payment is a transfer that reduces the liability, is a frequent ask.

12. **Answer every review quickly and like a person.** This is about operations, not a feature. **[E]**
    - The two apps with near-complete reply rates (Cashew and MMR) have negative shares of 2–6%.
    - The two that ignore support (Monefy and 1Money) carry 51 of 72 "no response" complaints.
    - YNAB's 2026 move to AI chatbot support is itself a 1★ driver. A finance app's AI should not replace human support. **[E, small n]**

13. **Not needed: bank-API sync.** This supports Moni's design. **[E]**
    - In the apps that have it, bank sync is the most fragile feature. YNAB alone has 83 low reviews about import failures, and "doesn't notify when an account disconnects" is the worst case.
    - Moni's notification capture avoids the aggregator dependency. It shares one risk: missed notifications fail silently. Moni should surface "no notifications from Bank X in N days". **[I]**
