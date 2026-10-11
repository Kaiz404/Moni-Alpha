# What Malaysian and Singaporean users say about expense-tracking apps outside the app stores

Researched 2026-10-18. Web sources only. The repository was not modified.

## Method and limits

- **Reddit was not covered.** Every route to Reddit failed. `WebFetch` returned "unable to fetch from www.reddit.com". `curl` got Reddit's "Your request has been blocked due to a network policy" page. `WebSearch` with `allowed_domains: reddit.com` returned "domains are not accessible to our user agent". Unrestricted web searches for r/MalaysianPF, r/malaysia, r/singaporefi and r/askSingapore threads returned no Reddit results, so there are no snippets to quote either.
- I briefly tried third-party Reddit archives. PullPush replied that it "does not provide free scraping resources for agents". I stopped Arctic Shift after a test query. Using a mirror would get around Reddit's block, so I used none of that data and deleted what I had pulled.
- **What was covered:** Lowyat.NET forum (6 threads), Seedly community Q&A (9 threads), HardwareZone forum (2 threads), the Ringgit Oh Ringgit blog with its comments, one Threads post, Vulcan Post, and vendor pages. Vendor pages count as market framing, not as user voice.
- **Quote fidelity:** Quotes were pulled from pages through `WebFetch`, which passes text through a summarising model. Short quotes are close to verbatim, but there may be small differences. The Lowyat quotes were re-requested as full verbatim text, and those are marked (v).
- Many Seedly answers are hidden behind a login. For example, the 61-comment discontinuation post showed only 5 comments, and the sunset-alternatives thread showed 5 of 11. The Seedly evidence is therefore thinner than the real discussion.
- "Dev" marks a post by an app's own developer.

---

## Q1. Seedly: what users lost, what they liked, where they went

### Verified facts (Seedly's own pages)

1. "we've made the difficult decision to discontinue the Seedly app (the app, not us!) on 31 December 2025." Seedly, https://seedly.sg/posts/important-update-seedly-app-discontinuation/ (post edited 2026-02-10)
2. "After 31 March 2026, your expense tracking data will be permanently and securely deleted from our servers." The same post. No export path is described.
3. What the app offered (Seedly blog FAQ, 2019-02-11, https://blog.seedly.sg/seedly-expense-tracker-budgeting-app-faq-guide/):
   - bank sync, which "usually takes between 5 to 7mins"
   - "smart categories"
   - budgets "calculated down to the day!"
   - a manual cash wallet
   - foreign-currency cash wallets, about which it says "the app will log it in in SGD for you"
   - a free price: "The Seedly Expense Tracker (Free!)"

### User voice

4. **There was never an export.**
   - "Unfortunately for now, we do not have that feature to export out expenses for the Seedly app." Kenneth Lou (Seedly co-founder), 2019-07-17, https://seedly.sg/posts/is-it-possible-to-export-out-the-expenses-for-a-month-for-the-seedly-app/
   - On the same thread in 2026: "As far as I can tell, there was never an export." Vish (Dev of Tallied, a statement-PDF app), shown as "9d ago" on the page, so about 2026-10.
5. "Is there any way to extract the expenses report from Seedly Expense Tracker app?" The only answer: "I dont think so." Pak Melepak, MELEPAK.com blogger (MY), 2020-08-02. https://seedly.sg/posts/is-there-any-way-to-extract-the-expenses-report-from-seedly-expense-tracker-app/
6. **Bank sync was the core value.**
   - "Without the app syncing with banks, Seedly is useless". Sylvia Fogoly, 2022-06-01, https://seedly.sg/posts/seedly-sync-issues/
7. **Sync was already eroding before the shutdown.**
   - "the citibank sync issue has been stuck for like almost a month" and "uob keep failing nowadays". Leon Oh, 2022-04-18, same thread.
8. DBS sync was suspended in 2019 because of "updated DBS third-party application policies". Kenneth Lou, Seedly, 2019-06-01, https://seedly.sg/posts/why-is-the-seedly-app-unable-to-sync-to-dbs-ibanking-when-will-it-be-up/
9. **Reaction to the shutdown** (visible comments on the notice): "So sad!" and "Why?..." (Chris, 2026-01-31), "Sado" (Leon Chua, 2026-02-03), "Sad news" (Leon Chua, 2026-02-08). https://seedly.sg/posts/important-update-seedly-app-discontinuation/
10. **Migration question.** "The Seedly Expense Tracker App is being sunset, what are some good alternatives? Free or not". Chermaine Yong, 2025-12-18, https://seedly.sg/posts/the-seedly-expense-tracker-app-is-being-sunset-what-are-some-good-alternatives-free-or-not/
11. **Some went back to spreadsheets over privacy.** "Personally, I rather use excel, or google sheet or notion." The same commenter does not want Dobin, which another (hidden) reply evidently suggested, to access their bank info. User "I", 2026-01-01, same thread.
12. **Others gave no direction:** "I use any normal app in app store." Hahaha, 2026-01-02, same thread.
13. **Shutdown risk is now a sales pitch.** "Everything is on-device (no account, no server, so there's no company database to sunset)." TWS (Dev of CanFIRE), 2026-08-19, same thread.
14. **Post-shutdown searches favour simplicity.** A question about having "struggled with apps that feel too 'IT-heavy'" drew the answer "Excel worked for me." The question is by CN Lee (edited 2026-03-23); the answer is by Connie, 2026-07-05. https://seedly.sg/posts/seeking-your-recommendation-for-a-simple-financial-tool-i-want-to-start-tracking-my-expenses-more-closely-but-i-ve-struggled-with-apps-that-feel-too-it-heavy-looking-for-an-easy-app/
15. **Planner Bee for bank sync:** "I use planner bee for bank syncing". Genn, 2022-04-14, https://seedly.sg/posts/seedly-sync-issues/

**Where Seedly users went** (visible evidence only): Excel, Google Sheets or Notion; Dobin (implied by a reply); CashJot (dev-promoted); CanFIRE (dev-promoted); Planner Bee and YNAB in older threads. A search-result summary also mentioned mysprout.ai, but I could not see it on the page, so it is unverified. **No visible evidence shows a single dominant destination.**

---

## Q2. Apps Malaysians recommend, and why

16. **Money Manager (Realbyte), the most-named app on Lowyat.** "really useful to track my spendings". Asked whether you must key in every transaction, the same poster said: "Yes same as others. The difference is this is much more detailed." debonairs91, 2023-07-12, https://forum.lowyat.net/topic/5392723
17. **Money Manager covers cards, cash and TNG in one place:** "Got cards/cash/tng/accounts/investments which is really powerful if you record you money flow properly." debonairs91 (TS), 2023-07-12, same thread.
18. **Maybank MAE auto-categorisation (v):** "always get lazy to input after a while". The poster now links all cards to MAE because it auto-categorises. -kytz-, 2023-07-12, same thread.
19. **MAE's limit:** "If your finance is all maybank then it is really good app". debonairs91, 2023-07-12, https://forum.lowyat.net/topic/5392723/+20
20. **Same point:** "Problem is I dont use only MAE, i have various card, cash, etc." MeToo, 2023-07-12, https://forum.lowyat.net/topic/5392723/+40
21. **Money Lover, left over a paywall:** "Used to use moneylover, until the vietcong developers became greedy that you need pro license". Kaya Butter Toast (tracking since 2012), 2023-07-12, same page.
22. **BudgetBakers Wallet, only for its bank linking:** "It allows linking to certain Malaysia bank, it has free trial and required subscription later on". hong823, 2018-07-30, https://forum.lowyat.net/topic/4628333
23. **YNAB, paid and manual:** "It costs me $50/year, which is just RM20 every month." The same poster says it needs discipline because tracking is manual. imnotabot, 2021-11-03, https://forum.lowyat.net/topic/5158227
24. **Easy Expense, for receipt capture:** "Capture Receipts and information so that i have a photo of the receipt". c64, 2021-11-03, same thread.
25. **Spreadsheets and paper are common.** Excel, Google Sheets and "Buku 555" (a paper notebook) appear repeatedly. One example: "Just make use for Google Excel Sheet je." briantwj, 2021-11-03, same thread.
26. **A blogger's pick:** Money Lover "just works ridiculously well for me". Suraya, Ringgit Oh Ringgit (MY), 2018-07-23 (updated 2021-06-21), https://ringgitohringgit.com/money-management/expense-tracking/

---

## Q3. Recurring complaints

**Manual-entry fatigue**

27. "after 6months, didn't use it anymore because you need to key-in every time." BuKeYi, 2023-07-12, https://forum.lowyat.net/topic/5392723/+40
28. "ended up not using because it's a hassle". Quantum Geist, 2023-07-12, https://forum.lowyat.net/topic/5392723/+20
29. "It only works if u have the discipline go remember what u spent and key in correctly." WaCKy-Angel, 2023-07-12, same page.
30. "is only as good as your dicipline in adding things in". Roadwarrior1337, 2023-07-12, https://forum.lowyat.net/topic/5392723/+60
31. "Need to enter for every spending?" Sunshape, 2026-04-13, https://forum.lowyat.net/topic/5561342/all
32. A Singaporean poster on HardwareZone calls it "simply too troublesome" because "you still need to manually categorize and label most expense". badsector, 2017-02-18, http://forums.hardwarezone.com.sg/showthread.php?t=4965572&page=3

**Transfers between wallets and cards make logging tedious**

33. **(v)** "track expenses only not to track my bank/ewallet/cc flow". The poster gave up on per-account wallets because of transfers. thankyou, 2023-07-12, https://forum.lowyat.net/topic/5392723

**No Malaysian bank sync**

34. "Couldn't find any app that connect to Malaysia bank". FreedomDream, 2018-07-30, https://forum.lowyat.net/topic/4628333
35. "it support only limited numbers of Malaysia bank account 2 years ago." hong823, 2020-12-31, same thread.
36. **Developer view, 2026:** direct bank sync isn't feasible because Malaysia lacks a mature open-banking API framework, and Apple Pay and Samsung Pay don't share transaction data. RinggitWise dev (watekungsik), 2026-04-13, https://forum.lowyat.net/topic/5561342/all (paraphrase; the verbatim text was not available)
37. **Sync breaks:** "most modern apps demand your bank logins or constantly break their sync." tauruslabs (Dev, Live Zero Path), 2026-10-16, https://forum.lowyat.net/topic/5392723/+80

**E-wallet sprawl**

38. "those hawker stalls/ food court which only has TNG QR code." This is why MAE-only tracking leaks. -kytz-, 2023-07-12, https://forum.lowyat.net/topic/5392723/+20
39. "the only problem with ewallet is there are too many". The poster holds balances in Boost, TNG, GrabPay and ShopeePay. am_i_rulez, 2021-01-14, https://forum.lowyat.net/topic/5087331/+40
40. A Shopee PayLater request, plus a split view of e-wallets versus banks. Sunshape, 2026-04-14, https://forum.lowyat.net/topic/5561342/all (paraphrase)

**Cash**

41. "I gave up tracking everyday cash expenses." rapple, 2018-07-30, https://forum.lowyat.net/topic/4628333
42. "What I do is request for a receipt and keep that in my wallet to sort out later." Suraya, Ringgit Oh Ringgit, 2018, https://ringgitohringgit.com/money-management/expense-tracking/

**Multi-currency**

43. "Downside is that it doesn't support multiple currencies, so I switched to Monefy". jonoave, 2018-08-05, https://forum.lowyat.net/topic/4628333
44. Yaowarat asked RinggitWise for multi-currency support, 2026-04-14, https://forum.lowyat.net/topic/5561342/all (paraphrase)

**Ads and in-app purchases**

45. **(v)** "best money management / ads / in-app purchases / yeah no". Clowninja, 2023-07-12, https://forum.lowyat.net/topic/5392723
46. "very annoyed with daily ads." IpohGuyz, 2023-07-12, https://forum.lowyat.net/topic/5392723/+20
47. "Why need to install app full of adware". ylyap, 2023-07-12, https://forum.lowyat.net/topic/5392723/+60

**Subscriptions**

48. **(v)** "Hopefully the premium version is lifetime license, not yearly". Clowninja, 2023-07-12, https://forum.lowyat.net/topic/5392723
49. "Money lover but need to pay subscription fee for the linking to bank feature." solstice818, 2018-08-05, https://forum.lowyat.net/topic/4628333
50. "I love this YNAB. But its subscriptions are getting more expensive also." miyakochan89, 2021-11-03, https://forum.lowyat.net/topic/5158227
51. "keep pushing for subscription". The poster left Spendee over this. bergstein, 2023-07-12, https://forum.lowyat.net/topic/5392723/+20
52. Price scepticism: "dunno can earn money or not if no body subscribes for 89.90 per year". Sunshape, 2026-04-14, https://forum.lowyat.net/topic/5561342/all

**Data privacy**

53. "great for scammers/app creator to fish all your data". digilife, 2023-07-12, https://forum.lowyat.net/topic/5392723/+60
54. "what app good without having them to fish my data?" Syie9^\_^, 2023-07-12, same page.
55. "if have to input every single transaction manually then a spreadsheet is the best and the most secure". Thebestscammer, 2023-07-12, https://forum.lowyat.net/topic/5392723/+20
56. "what is the data collection policy of this app?" AbbyCom, 2026-04-13, https://forum.lowyat.net/topic/5561342/all
57. "are the data still captured and stored in the server's end?" Hastebreak, 2026-04-14, same thread. He then suggested the deletion policy be marketed as "one of the main value proposition".
58. A Malaysian Spendee user avoids linking bank accounts for security. Ahmad Taufeq Azeman, 2019-11-05, Ringgit Oh Ringgit comments (paraphrase).
59. A Singaporean poster: "I felt not secure if my credentials are being passed around". freethinker54321, 2017-02-18, HardwareZone page 3 (link above).

**App shutdowns, lock-in and export**

60. "Can export expenses records in json or other formats for own data analysis purpose?" akhito, 2026-04-13, https://forum.lowyat.net/topic/5561342/all
61. orangbulu stays on Money Manager Ex desktop "as I have 10+ years of records". 2020-12-31, https://forum.lowyat.net/topic/4628333
62. Seedly's data deletion (items 2 and 4–5) is the clearest data-loss case. There are no visible Malaysian forum posts reacting to it.

---

## Q4. Demand for auto-capture, AI receipts and chat-based tracking

63. **DIY notification capture:** **(v)** "Tasker + a google spreadsheet / No need to input values like a barbarian / Your phone is not just for fesbuk and tiktok lol". loserguy, 2023-07-12, https://forum.lowyat.net/topic/5392723
64. **Explicit e-wallet auto-read request:** "it would be good if it can auto read spendings from ewallet apps and categorized them". Sunshape, 2026-04-13, https://forum.lowyat.net/topic/5561342/all
65. **Statement parsing:** "No credit card statement auto parsing?" bombacat, 2026-10-16, same thread. Kelangketerusa (2026-04-14) pointed to FINORY as a model for turning statements into line items (paraphrase).
66. **SMS auto-entry:** "It adds everything automatically based on SMS alerts." The commenter uses FinArt and adds cash manually. The blogger replied: "Automatic entries via SMS? That sounds intriguing and handy." Vikas, 2019-01-23, Ringgit Oh Ringgit comments. Vikas's nationality is unknown, and FinArt targets India.
67. **Receipt overload:** "The receipts are out of control" and "Any FREE apps I can use to track my expenses and scan receipts from my phone? (Malaysia based)". piarrae on Threads, 2026-04-03, 37 replies (not readable). https://www.threads.com/@piarrae/post/DWrmDd7kkUC/
68. **Receipt photo instead of typing:** c64, 2021 (item 24).
69. **Chat-based tracking built for Malaysians:** NajibAI on WhatsApp, where you send a receipt photo and confirm the extracted fields. Founder Dylan Tan: "It's a tool for Malaysians, by a Malaysian, to make tracking spending easy, practical, and a bit more fun." Vulcan Post (sponsored), 2024-11-29, https://vulcanpost.com/877118/najibai-chat-ai-free-financial-spending-tracker-whatsapp-malaysia/
70. **A developer building screenshot OCR for local wallets:** SpenDrop (iOS) says Malaysians use many payment apps and "none of them consolidate confirmations into one ledger". It names TNG, Maybank/MAE, GrabPay, Boost and DuitNow QR. 504 commits, last verified 2026-09-29. https://github.com/tirukon015/SpenDrop
71. **A singular "Telegram bot built by a Malaysian" was not found.** The Telegram expense bots on GitHub that I found are Indian or generic.

---

## Competitor and market signals (vendor claims, not user voice)

- **RinggitWise** (iOS, launched 2026-04):
  - an AI coach in English and BM over spending, budgets and debts
  - receipt scanning (premium)
  - 24 MY categories
  - an LHDN relief tracker
  - no bank sync
  - RM89.90 a year (price from a forum reply)

  This is the closest analogue to Moni's chat assistant. https://forum.lowyat.net/topic/5561342/all

- **Rolly** (Aug 2026 page) offers chat logging ("nasi lemak 8" in RM), voice and receipt AI, with no credentials needed. It claims "Touch 'n Go reloads hide twenty purchases inside one bank transaction" and that aggregator coverage of Maybank, CIMB, Public Bank and RHB "is inconsistent and can break without notice." https://rollyapp.ai/ai-budgeting-app-malaysia
- **Pocket Clear** (Apr 2026) says "no app can auto-import TNG eWallet transactions". It is ad-free, at RM4.90 a month for Pro. https://pocketclear.app/blog/expense-tracker-malaysia.html
- **Stale roundups:** A 2026-07 Singapore roundup still ranks Seedly #1 with "Yes (DBS, OCBC, UOB)" bank links (https://seamoneytips.com/best-money-management-apps-singapore-2026/). SingSaver's 2026 guide also lists it. Former users who search will find dead recommendations.

---

## Verified vs inferred

**Verified (seen on the page, dated):**

- Seedly shut the app on 2025-12-31 and deleted data after 2026-03-31.
- Users and staff say Seedly never offered an export.
- Seedly's sync was broken for DBS from 2019 and for Citi and UOB in 2022.
- Lowyat users repeatedly cite manual-entry fatigue, ads, subscription aversion, privacy distrust, too many e-wallets, and MAE's Maybank-only coverage.
- At least one Malaysian automates entry with Tasker.
- In 2026 a Malaysian user explicitly asked for "auto read spendings from ewallet apps".
- NajibAI, SpenDrop, RinggitWise and Rolly exist, and they target the same gap.

**Inferred (my reading, not stated by users):**

- **The main reason people churn is that logging takes too much effort, not missing features.** Every long thread has someone who quit after weeks or months. Notification capture that needs no bank credentials answers both the effort complaint and the privacy complaint, which are often raised together.
- **Malaysians distrust bank-login sync more than they want it.** Several users refuse to link banks. That makes "no bank API, reads your own phone's notifications, you review" a defensible position. It only works if Moni's data practice is stated plainly: Hastebreak said deletion assurances should be the main pitch.
- **Shutdown and data-loss fear is a live selling point in Singapore after Seedly.** CanFIRE already sells "no company database to sunset". Export (CSV/JSON) is a frequent ask in both countries.
- **Moni's niche is narrowing.** At least four MY products launched 2024–2026 with AI, chat or receipt capture. None I found does Android notification capture for TNG, Grab or bank alerts, so that remains Moni's clearest gap. This is unverified beyond these searches.
- **Pricing has to be cheap and preferably lifetime.** Forum users push back on yearly subscriptions and on RM89.90 a year.
- **The Reddit gap could change the picture.** r/MalaysianPF is likely the largest pool of recent Malaysian opinion, and none of it was read.
