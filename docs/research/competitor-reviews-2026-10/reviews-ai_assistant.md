# Slice: ai_assistant (Cleo, Monarch Money, Copilot Money, Origin)

## Data and method

| App           | Reviews   | Low (1–2★) | Mid (3★) | High (4–5★) | Stores                   |
| ------------- | --------- | ---------- | -------- | ----------- | ------------------------ |
| Cleo          | 2,107     | 1,185      | 112      | 810         | Play 1,121 / Apple 986   |
| Monarch Money | 1,831     | 543        | 139      | 1,149       | Play 956 / Apple 875     |
| Copilot Money | 900       | 244        | 89       | 567         | Apple only (no Play app) |
| Origin        | 1,182     | 212        | 63       | 907         | Play 438 / Apple 744     |
| **Total**     | **6,020** | **2,184**  | **403**  | **3,433**   |                          |

- **Counting tool:** a session-only script (not kept), a case-insensitive regex over title and text, bucketed by app and star rating. With `--years` it also splits counts by year. The regex files (`ai.re`, `sup.re`, `cat_bad.re`, `persona.re`, `latency.re`) are in the same folder. Every count below gives its pattern.
- **Regex counts are lower bounds.** Each one was spot-read: 20–140 matched snippets for each major theme.
- **Year trends are biased.** The "newest" sort pulls in mostly 2026 reviews (Cleo 1,691 of 2,107; Monarch 1,205 of 1,831). Older years come mainly from "most relevant", which favours long, detailed complaints. So a theme's share of low reviews naturally looks bigger in 2023–2024 than in 2026. Month-level spikes are more trustworthy than year-over-year shares.
- **Noise 1 (Cleo lending).** Cleo is now mostly a cash-advance app. Pattern `advance|loan|borrow|\bboost|express fee|instant (transfer|deposit|fee)|repay|credit build|payday|cover\b` matches **589 of 1,185 Cleo low reviews (50%)**, 57 of 112 mid and 287 of 810 high. These are about advance size, split payouts and express fees, which have nothing to do with budgeting or the assistant. They are counted here and then excluded from the budgeting themes. Another ~99 Cleo low reviews are about refunds or cancelling (`refund|(hard|difficult|impossible|can.?t|couldn.?t|unable to|won.?t let me) (to )?cancel|still charg|…`), which mostly reflects the lending subscription. Many of the remaining Cleo low reviews are one-liners such as "scam" or "crooks".
- **Noise 2 (Origin incentivized reviews).** **182 Origin reviews contain "Entered a sweepstakes for this review"** (`sweepstake`). All 182 are from 2026, which is 34% of Origin's 2026 reviews, and 177 of them are 4–5★. Origin's praise is inflated, so they are excluded from the AI-praise counts where noted. One 1★ reviewer also accuses the 5★ reviews of being AI-written (`play:115d8c5c`).

---

## Pain points

### P1. Bank sync breaks, and it erodes trust in every number

- **Prevalence:**
  - The strict pattern `disconnect|re-?connect|re-?link|lost connection|lose[s]? connection|losing connection|stay(s)? connected|won.?t (sync|connect|update)|(not|stopped|stop|never) (sync|updat)|sync(ing)? (issue|problem|error)|connection (issue|error|problem)s?|connectivity issue|re-?authenticat|re-?verif` matches **131 of 999 non-Cleo low reviews**: Monarch 92/543 (17%), Copilot 26/244, Origin 13/212. It also matches Cleo 34/1,185.
  - A broader version that adds `plaid|out of date|up to date|connectivity` gives 174 non-Cleo low.
  - It is also the top complaint inside positive reviews: 78 high reviews match the strict pattern (Monarch 41). Fans give 3–4★ "except for sync".
  - Plaid, MX or another aggregator is named in 77 low reviews and 58 high. Users blame the app, not the aggregator.
- **Apps:** Monarch most, then Copilot and Origin. For Cleo, broken links block the cash advance.
- **Trend:** The Monarch low reviews matching `sync|connect` fell from 33/55 (60%) in 2024 to 40/91 (44%) in 2025 and 80/371 (22%) in 2026. That is partly sampling bias, but within 2026 it stays steady at 3–6 a month, so it isn't going away.
- **Secondary harm: reconnecting wipes history and rules.** "The only fix is to re-add them. But that means all your rules and filters for them are gone too" (Monarch `play:8d6f988d` ★2 2026-07-18).
- **Quotes:**
  - "All my Chase accounts have lost connection for the last 22 days… they should not be charging for an app that you can't rely on." (Monarch `play:7bdb6721` ★1 2025-10-28, 👍79)
  - "Since I can never trust the balances I have to login to each account to confirm things which completely defeats the purpose" (Monarch `play:bbfd6261` ★1 2024-08-31)
  - "Too many accounts will not sync and go 30+ days without an update despite refreshes saying they're updated. Deleting the non syncing accounts and reconnecting them erases all of your account history" (Origin `play:6956af9c` ★2 2026-03-09)
  - "constant syncing issues with my AMEX bank accounts dragging for months… finger-point at Plaid" (Copilot `apple:53617008` ★1 2023-12-03)

### P2. A paywall before you can even look, and trials that are too short

- **Prevalence:** `free trial|pay ?wall|before (you|i|we) (can|could|even|are|get)|credit card (info|before|first|to)|can.?t (even )?(use|try|see|explore|check)|no free (version|option|plan|tier)|forced? (to )?(pay|subscribe|start|pick)|7.?day|one week|not free` matches **173 of 2,184 low**: Monarch 90/543 (17%), Cleo 50, Copilot 18, Origin 15.
- **Apps:** Monarch dominates. Origin's "$1 for the first year" wall gets the same complaint.
- **Trend:** Monarch is flat at 16% of low reviews in both 2025 and 2026. It is the most common complaint in December 2025.
- **Quotes:**
  - "The first thing you see when you open up is a required login. The second thing, is a pay wall. Then the third thing… a blocking popup saying connect credit cards." (Monarch `play:e8917425` ★1 2025-05-29, 👍350, the most-helpful review in the slice)
  - "It takes a full month to see if a budgeting app is working, not 7 days." (Monarch `play:24c3c42f` ★1 2025-02-04)
  - "the screen saying join for $1, isn't closable nor can you bypass it to even see what the app does" (Origin `play:a028124e` ★1 2026-07-31)

### P3. Price is too high, with stated ceilings around $25–50 a year

- **Prevalence:**
  - `too expensive|overpriced|expensive|pricey|not worth (the|it|paying|\$|\d)|price (is|point|tag)|costs? too|steep|out of (my|our) (price|budget)|cost prohibitive` matches **127 low**: Monarch 50, Copilot 11, Origin 6, and Cleo 60 (mostly advance fees). It also matches 19 mid reviews and 54 high ("great but pricey").
  - The irony of paying to save money: `(trying to|want to|goal is to|help me|supposed to) (save|budget)|…defeats? the (whole )?purpose|…` combined with a price word matches 18 low (Monarch 12).
  - Requests for a lifetime, one-time or free tier: `lifetime|one.?(time|off) (purchase|payment|fee)|freemium|free (tier|version|plan|option)` matches 25 low and 20 high.
- **Pricing tolerance:**
  - When reviewers name a ceiling, it clusters at **$25–50 a year or about $5 a month**, against list prices of $99–100 a year (Monarch, Copilot, Origin after the promo).
  - Willingness to pay depends on reliability. People who pay say "worth it": `worth (every|the|it)|paid for itself|…|no.?brainer|well worth` matches **264 high** (Monarch 135, Copilot 89). Reliability failures turn the same price into "not worth it".
  - Origin's $1 first year buys goodwill: `\$1\b|…|99 cents|one dollar` appears in 45 Origin high reviews against 21 low. It also attracts users who think even $1 was too much once the app failed, and it front-loads a $99 renewal shock.
- **Quotes:**
  - "My pain point is $50/yr" (Monarch `play:2fb7aee0` ★1 2026-01-10)
  - "If the price were only $25 a year or even 35 I would consider it" (Monarch `play:ad3ed847` ★3 2022-10-23)
  - "If it was free, sure, you get what you pay for. But I'm not paying to troubleshoot connectivity issues" (Monarch `play:4c82e4be` ★2 2024-10-24)
  - "I paid 99 cents for a year, and I think it was still too much money." (Origin `play:b33f9de6` ★1 2025-12-29)

### P4. "AI" used as a support wall: bots that loop, block cancelling, or make things up

- **Prevalence:** the AI pattern (`ai.re`: `\bai\b|a\.i\.|artificial intelligence|chat ?bot|chatgpt|\bgpt\b|\bllm\b|assistant|sidekick|\bbot\b|machine learning|\bml\b`) combined with support words (`sup.re`: `support|customer service|human|live (agent|person|rep)|real person|representative|cancel|refund|unsubscrib|agent\b|help desk|ticket`) matches **149 of 2,587 1–3★ reviews**: Cleo 105, Monarch 19, Origin 15, Copilot 10.
- **Apps:** All four. Cleo is the worst, because its chat is also its support desk and its cancel flow.
- **Trend:** Cleo is at 18–21% of low reviews in 2024–2025, falling to 6% in 2026 as advance complaints swamp the sample. Monarch and Copilot complaints appear in 2025–2026 after both moved first-line support to an AI agent.
- **Quotes:**
  - "when you try to cancel your subscription, you're literally redirected to an AI CHAT that refuses to let you cancel" (Cleo `play:30b64301` ★1 2026-09-15)
  - "All they have is AI bots that do not help whatsoever and keep regurgitating the literal same answer over and over" (Monarch `apple:74822424` ★1 2025-12-04)
  - "Their ai support agent hallucinates and I haven't been able to get in touch with a real person." (Copilot `apple:90459853` ★1 2026-06-16)

### P5. The AI assistant gives wrong answers, generic advice, or can't act, which breaks trust

- **Prevalence:** the AI pattern combined with a quality-complaint pattern (`making up|made up|hallucinat|wrong|incorrect|inaccurate|mistake|…|useless|daft|braindead|dumb|weak|…|generic|slow|takes forever|couldn.?t edit|can.?t (take|make|edit|change|do)|starting point|…`), and excluding support context, matches **59 of 2,587 1–3★ reviews**: Origin 19 of 275 (7%), Monarch 16, Cleo 16, Copilot 8. Including support context it is 132.
- **What goes wrong:**
  - **Invented or wrong numbers and facts.** Wrong market summary, wrong RMD age, missed an income source, recommended doubling spending.
  - **Generic advice.** "spend less money", or "move it to a high-yield savings account" when it already is in one.
  - **Read-only chat.** It tells you to fix things manually and can't edit budgets or categories. That is 7 explicit cases, 5 of them Origin.
  - **Slow.** 18 cases: "thinks for 5 minutes", times out.
  - **No memory or audit trail.** Users can't see how income was classified.
- **Trend:** Origin's AI complaints cluster from October 2025 to January 2026, at 6–8 a month (22–42% of its 1–3★ reviews in those months), when AI-first reviews ("AI-first interface", "AI Budget Builder") start appearing. They fall to 1–3 a month after February 2026, suggesting fixes or fewer new users.
- **Quotes:**
  - "the AI literally gave up and said, 'You're right. I repeatedly keep ignoring instructions and making up data…'" (Origin `play:6ef8d03b` ★1 2025-10-29)
  - "Today the Ai gave a market summary stating that the market reached record highs. The Market was actually down… The in app support tool is just an Ai that empathizes and apologizes for the Ai mistakes" (Origin `apple:37471857` ★1 2025-10-07)
  - "it recommended for me to almost double my average monthly spend" (Origin `apple:52511848` ★1 2026-01-19)
  - "tried to get a summary and it quoted wrong numbers" (Monarch `play:4f91db64` ★1 2025-12-19)
  - "There is no way to see how your income is classified… You're shown confident-looking outputs without any audit trail" (Origin `apple:79621440` ★1 2026-01-26)
  - "I tried talking to the AI but it said it couldn't edit it either." (Origin `play:7a9955f0` ★1 2025-09-12)

### P6. AI backlash: "nobody asked for it", forced on users, opted into training, fix the core first

- **Prevalence:** the AI pattern combined with `slop|nobody (asked|cares)|no one (is )?ask|opt[- ]?(out|in)\b|forced|shove|ruined|remove (the|it|ai)|disable|bling|hype|gimmick|narrative|focus(ed)? … on (the )?ai|ai training|training|instead of (fix|implement)|features nobody|…|unwanted` matches **35 of 2,587 1–3★**: Monarch 18, Cleo 9, Origin 6, Copilot 2. It also matches 10 high reviews ("love it, but stop with the AI").
- **Trend:** This is a sharp event. Monarch's AI mentions in low reviews went from about 0 a month to **10 of 39 low reviews in December 2025**, the month its AI shipped with default opt-in to training. Its total review volume jumped from about 15 a month to 104 that month. The rate has stayed at 3–4 a month since.
- **The opposite view, and the small print:**
  - About 14 reviews (Copilot 8) punish an app for having _no_ AI (`no ai|…|waitlist|falling (far )?behind|…`).
  - What both groups want is AI that improves categorization and does work, not a chat bolted on.
- **Quotes:**
  - "Accounts won't stay connected, while they add features nobody cares about like AI." (Monarch `play:3347aa09` ★1 2025-12-22, 👍57)
  - "Monarch admitted in their reply that they automatically opt-in people's financial data into it's AI training. This is a very bad look for a financial company" (Monarch `play:2219ba0d` ★1 2025-12-17)
  - "a basic budgeting tool with AI chat wrapped around it" (Origin `apple:75985123` ★2 2025-10-16)
  - "Nobody is able to get off their waitlist for the beta… They are falling far behind" (Copilot `apple:05790989` ★1 2026-09-28)

### P7. Auto-categorization is wrong, rules don't stick, and AI overrides the user

- **Prevalence:**
  - Explicit accuracy complaints (`cat_bad.re`, starting `miscategor|mis-?label|mislabel|misclassif|wrong categor|(categor|classif|label)\w*[^.]{0,80}(wrong|bad\b|terrible|inaccura|…)|…|rules? (don.?t|doesn.?t|never|didn.?t|won.?t) (work|stick|apply)|ignores? (set )?rules|…`) match **40 of 1,290 non-Cleo 1–3★**: Monarch 20, Copilot 11, Origin 9.
  - Any mention of categorization (`categor|classif|recategor`) appears in 178 non-Cleo 1–3★ reviews, and spot-reading suggests about a third of those are accuracy complaints.
  - Income, transfers and card payments are the classic failures. Those words appear alongside categorization in 44 1–3★ reviews.
  - Cleo barely mentions categorization in low reviews (0 explicit), though early reviews complain that bills and Venmo get lumped together.
- **Trend:** Monarch complaints are concentrated in 2026 (10 of 14 low), several explicitly saying "got worse in the past 6 months".
- **Quotes:**
  - "the automatic categorization of expenses is laughably bad, like machine learning from the 90s bad. My autopay credit card payments get classified as car payments" (Monarch `play:b221b0c0` ★2 2025-08-14)
  - "it categorizes my direct deposit paycheck… as an Insurance payment. So basically it underrepresents my income by about 95%" (Copilot `apple:48886463` ★2 2026-03-14)
  - "it overrides direct input by the user… I tried to change this by hand but it would change back to recurring a minute or so later" (Copilot `apple:95637368` ★1 2025-02-10)
  - "About 25% to 30% of my credit card transactions were categorized incorrectly as a Transfer" (Origin `apple:89621901` ★1 2025-11-12)

### P8. Duplicate, missing and wrong transactions corrupt the budget

- **Prevalence:**
  - `duplicat|double(d|s)? (transactions|entries|entered|count)|doubling` matches **49 of 1,290 non-Cleo 1–3★** (Monarch 30, Copilot 16, Origin 3) and 23 high.
  - Wrong or untrustworthy numbers (`wrong (balance|amount|number)s?|incorrect …|inaccurate|numbers? (are|were) (wrong|off)|can.?t trust|don.?t trust|not accurate`) match 44 low.
- **Triggers named:** a card replacement, a new phone, a bank platform change, or a reconnect.
- **Quotes:**
  - "when my credit card had to be replaced, I got a bunch of duplicate transactions. Hiding didn't work. deleting them blew up all of my rollovers" (Monarch `play:47873a3d` ★2 2026-01-31)
  - "Upgraded my iPhone and Copilot duplicated every single Apple Card transaction. My budget is now completely unusable" (Copilot `apple:92032322` ★1 2025-09-27)
  - "it'll import transactions then delete them and import them again… It also does it silently" (Monarch `play:77c27eca` ★2 2026-02-01)

### P9. Personality that backfires at the wrong moment (Cleo)

- **Prevalence:** the personality pattern (`persona.re`: `roast|sass|snark|hype (me|you)|personality|witty|funny|…|condescend|mean girl|\btone\b|cringe|…|judg`) matches 21 Cleo low and 9 mid, against **88 high**. Overall it is a delight (see D6). The negatives share a pattern: humour aimed at essentials, or used while money is at stake.
- **Quotes:**
  - "Instead I got roasted for such crazy transactions as… paying my rent?" (Cleo `apple:26048215` ★3 2022-01-10)
  - "Just a reaction gif and a 'sorry lol. thanks for paying us a monthly fee though!'" (Cleo `apple:49650345` ★1 2025-07-03)
  - "the frigging AI assistant was very condescending when I was explaining the problem and my anxiety over needing it for real this time" (Cleo `apple:11304803` ★1 2026-03-03)
  - "The voice this app adopts is… obnoxious. It's combative, and not in a good or helpful way." (Cleo `apple:65595511` ★1 2019-12-12)

### Smaller pains, for completeness

- **Weak Android ports.** `android|back (button|gesture|swipe|navigation)|pixel|samsung|…` matches 17 low, 8 of them Origin: the back gesture exits the app, "Face ID" text appears on Android, and logins are forgotten. Copilot has no Android app at all. Quote: "When you swipe in from the side to go back a page, it closes the app instead" (Origin `play:a3e4ea38` ★3 2025-02-02).
- **Sync lag and pending transactions not shown.** `latency.re` matches 20 non-Cleo 1–3★ and 16 high. Quote: "it doesn't sync pending transactions, so there's about a 24 hour delay… where my spending isn't really real time" (Copilot `apple:86360581` ★5 2024-04-21).
- **Privacy worries about handing over credentials or account and routing numbers.** 60 low and 62 high. Quote: "Origin requested to view full account numbers and routing number… Will NEVER trust them." (Origin `play:601a0863` ★1 2026-05-04)
- **Multi-currency.** 14 low and 13 high: "accounts in foreign currency are not converted… your net worth will be 110 CA, which is wrong" (Monarch `play:06d1cec8` ★4 2025-10-25).

---

## Delights

### D1. Everything in one place, plus net worth

- **Prevalence:** `all (of )?(my|our) (accounts|finances|financial)|one place|everything in one|…|complete picture|big picture|full picture|holistic|bird.?s.?eye|whole picture|all in one|all-in-one` matches **306 of 3,433 high** (sweepstakes excluded): Monarch 122, Origin 114, Copilot 64, Cleo 6. `net ?worth` matches 135 high.
- **Quotes:**
  - "I've never had such a complete picture of my finances." (Monarch `play:2a4d1520` ★5 2025-06-18)
  - "for the first time ever we now have one succinct picture of all our finances" (Monarch `play:00a0107c` ★5 2026-07-15)
  - "this app saves me 10 apps in one!!" (Copilot `apple:92734399` ★5 2020-10-02)

### D2. Visual design that makes checking in feel rewarding

- **Prevalence:** the broad pattern `beautiful|gorgeous|clean|intuitive|interface|\bui\b|\bux\b|design|sleek|polished|easy to (use|navigate|understand)|user.?friendly|visual|charts?|graphs?` matches **881 high**. Copilot is highest at 251 of 567 (44%).
- **Caveat:** it also appears in 166 low reviews as "pretty, but broken". Design doesn't save bad data.
- **Quotes:**
  - "seeing that line graph and keeping your spending under your projected budget is weirdly satisfying" (Copilot `apple:02703912` ★5 2021-03-14)
  - "makes not spending just as much of a dopamine rush as spending can" (Copilot `apple:53290637` ★5 2026-01-19)
  - Counterpoint: "This app has a beautiful interface… However, if it doesn't work properly then all that doesn't matter." (Copilot `apple:40612113` ★1 2025-01-28)

### D3. Finding forgotten subscriptions, fraud and leaks, so the app "pays for itself"

- **Prevalence:**
  - `paid for itself|pays for itself|forgot (to cancel|about)|unused subscription|…|(found|spot(ted)?|identif\w+|discover\w*) [^.]{0,40}(subscription|recurring|charge|leak)|cancel(l?ed)? (a few|several|some|them|subscriptions)` matches 32 high.
  - Recurring and upcoming-bills tracking (`recurring|subscriptions? (tracker|tracking|i|we|that)|upcoming (bills|payments|transactions)|bills? (coming|due|reminder)`) matches 123 high: Copilot 52, Monarch 51.
  - This is the main reason people give for paying, and it ties directly to the "worth it" count of 264.
- **Quotes:**
  - "Immediately found garbage subscriptions and canceled them. It's already paid for itself so far." (Monarch `play:f234e252` ★5 2026-04-10)
  - "my old gym made a (honest) mistake when cancelling my membership… I was still getting charged" (Monarch `play:65d9832f` ★5 2024-07-12)
  - "someone using my credit card and trying to stay under the radar. I probably would have missed it if not for the transaction review practice with this app." (Copilot `apple:27096781` ★5 2026-05-04)

### D4. Accurate auto-categorization, rules that stick, and a review-then-approve loop

- **Prevalence:**
  - `cat_good.re`: `(categor|classif)\w*[^.]{0,60}(accurate|great|good|smart|learn|well\b|correct|perfect|…)|…|rules[^.]{0,20}(stick|work|amazing|great)|machine learning|learns?\b` matches **173 high**: Monarch 71, Copilot 60, Origin 32.
  - `rules?\b` appears in 112 high (Monarch 62, Copilot 36) against 42 low.
  - The review loop (`review (each|every|my|the|new|all)? ?transactions?|transactions? (for|to) review|mark…reviewed|approve|check (them|it|expenses) off`) matches 20 non-Cleo high and 3 low.
- **Note:** This is the same feature as P7 seen from the other side. Satisfaction depends on how accurate it is.
- **Quotes:**
  - "the one that shows me each transaction and asks for my review. I've caught so many unknown transactions" (Monarch `play:60f8d9bc` ★5 2025-10-10, 👍161)
  - "I just got a spicy deluxe at Chick-fil-A then opened the app and it already synced into my transactions and into the correct category." (Copilot `apple:65285195` ★5 2021-03-04)
  - "the AI categorization is so good. I only have to manually change maybe 2-4 transactions a month." (Copilot `apple:34451706` ★5 2026-10-06)
  - "Intuitive, clean, easy to change categories… the rules actually stick" (Monarch `apple:83710047` ★5 2026-04-21)

### D5. An AI assistant that gives grounded, personal help

- **Prevalence:**
  - The AI pattern without support context, combined with `helpful|insight|advice|advisor|useful|smart|actually|plan|questions?|explain|recommend|guid|game ?changer|love|great|awesome|amazing|impress`, matches **284 high**: Origin 196, Cleo 40, Monarch 32, Copilot 16.
  - Excluding sweepstakes reviews, any AI mention appears in 322 high reviews, 188 of them Origin (21% of Origin's high reviews).
- **What earns praise:**
  - A debt payoff plan built from the user's own data.
  - A "gut check" before a splurge.
  - Explaining how the app itself works.
  - Decoding cryptic merchant strings.
  - Spend analysis presented in plain text.
  - Help during a crisis (divorce, hardship).
- **Quotes:**
  - "the A.I. even figured out my debt and came up with an action plan to get rid of it" (Origin `play:59b92409` ★4 2025-09-25)
  - "It's been a good gut check for planning for splurges or understanding the implications of more or less liquidity." (Origin `play:9f6c999a` ★5 2025-11-06)
  - "the new LLM AI integration for analyzing cryptic statement entries is awesome" (Monarch `play:c069ccb6` ★2 2025-07-25)
  - "the AI assistant is SUUUUPER helpful. It REALLY makes things easier to figure out when it comes to how the program works" (Monarch `play:76d5cd49` ★5 2026-09-07)
  - "it looked through my spending and I was able to ask it credit questions" (Cleo `play:f5ea2bd9` ★5 2026-07-23)

### D6. Personality as an engagement engine (Cleo)

- **Prevalence:** `persona.re` matches **88 of 810 Cleo high** against 30 low or mid.
- **Trend:** Personality was the core of Cleo's praise early on: 40–63% of high reviews in each year from 2019 to 2023, against 3% in 2026 as advance users dominate.
- **Related:** Cleo's spending-insight praise without any advance mention (`spend(ing)?|budget|sav(e|ing)|insight|habit|track|where (my )?money`, excluding advance words) shows the same decline: 113 high overall, at 39–88% of high reviews from 2019 to 2023 and 8% in 2026.
- **Quotes:**
  - "I find the whole 'roasting' aspect and Cleo's 'shade throwing' quite fun!" (Cleo `apple:37750834` ★5 2024-07-26)
  - "I love that there's an option for Hype Me or Roast Me, because sometimes you need a different kind of spiel" (Cleo `apple:91286666` ★5 2019-11-05)
  - "Love The Honesty!… I spent $791 on eating out just in December guys!" (Cleo `apple:61241124` ★5 2026-01-21)

### D7. Sharing with a partner or household

- **Prevalence:** `wife|husband|spouse|partner|couples?\b|household|\bbf\b|boyfriend|girlfriend|family|fianc` matches 329 high. "Family" adds noise, so this overstates it. Monarch has 170.
- **Quotes:**
  - "One account gives two people access, so you dont need to pay for 2 accounts if you are a couple." (Monarch `play:f2d8dd9b` ★4 2024-08-25)
  - "I can finally use a budgeting app with my spouse that she isn't confused by!" (Monarch `apple:97034262` ★5 2021-12-05)

### D8. Responsive human support (strongest at Copilot)

- **Prevalence:** `(customer service|support|team)[^.]{0,40}(great|amazing|excellent|helpful|responsive|quick|fast|prompt|kind|friendly|top)|…` matches 151 high. Copilot has 70 of 567 (12%). The negative pattern matches 131 low.
- **Quote:** "a REAL person talks to me and fixes my problem" (Copilot `apple:44511563` ★5 2025-11-01)

---

## Implications for Moni

1. **No bank API is a structural advantage on the top paid-app pain (supports).** _Evidence-backed:_ about 131–174 non-Cleo low reviews are about connections dropping, accounts going stale, and history being wiped on reconnect (P1). Even happy users dock stars for it. Moni's notification capture and local-first data never "disconnect" and never lose history to a reconnect, so it can say "nothing to re-link" in its positioning. _Inferred:_ Moni has its own fragile pipe. Android notification access gets revoked, battery optimizers kill the listener, and bank apps change their text format. Monitor that capture is still alive and warn the user when it stops, which is the thing Monarch fails to do (`play:574c7fde`: "doesn't always tell you that the data is outdated").
2. **The approve/decline proposal flow and the "Auto" tag match the most-loved interaction (supports).** _Evidence-backed:_ the review-each-transaction praise is Monarch's second most-helpful high review, at 👍161 (D4). Fraud and subscription catches come from that review habit (D3). The fury in P7 is about AI overriding user corrections and ignoring rules. Moni should:
   - never silently re-categorize something the user has approved;
   - learn from every decline or edit;
   - keep "Auto" visible and reversible with one tap.
3. **Transfer pairing and duplicate detection target known trust-breakers (supports).** _Evidence-backed:_ 49 non-Cleo 1–3★ reviews mention duplicates (P8), and income, transfers and card payments are the most-cited miscategorizations (44 in 1–3★, P7). _Inferred:_ Moni should test duplicate detection hardest on the triggers users name: card replacement, a new phone (reinstall and restore), and the same purchase arriving from both a bank notification and an e-wallet notification.
4. **A chat that reads an on-device snapshot answers the privacy backlash (supports, and needs guardrails).** _Evidence-backed:_ Monarch's December 2025 spike over default AI-training opt-in, and "sharing your data with who knows what" (P6). Moni sends only aggregates. Say so plainly, and make the chat opt-in and fully disableable, with no AI buttons scattered "all over the app".
5. **Ground every answer in Moni's own computed numbers, and don't speculate beyond them (threat).** _Evidence-backed:_ the wrong-number, wrong-market-fact and "double your spending" failures (P5, 59 1–3★) drive 1★ reviews and the word "trust". _Inferred guardrails:_
   - show the figure and the period behind each answer (an audit trail);
   - refuse market news and tax rules it can't verify;
   - say "I don't have that data";
   - keep answers short and fast, since slowness is a named complaint;
   - never present budget advice that contradicts the user's history without saying why.
6. **Let the chat act through proposals (gap).** _Evidence-backed_ (n is small, about 7 explicit): users are angry when the AI "said it couldn't edit it either" or "only does the initial work". Moni already turns chat into transaction proposals. Extending that to budget, category and rule changes, still behind approve/decline, fits Moni's model.
7. **Don't put AI between users and support or cancelling (threat to avoid).** _Evidence-backed:_ 149 1–3★ reviews (P4) are about bots that loop, block cancelling or hallucinate. Keep the subscription, cancel and refund actions in normal UI, and keep a human or email path that the bot doesn't gate.
8. **Personality is an optional spice, not the default voice (inferred for MY).** _Evidence-backed:_ Cleo's roast and hype mode drove early love (88 high vs 30 low or mid, D6). The backlash comes from roasting essentials like rent, being flippant on errors, and being condescending to an anxious user (P9). _Inferred:_ offer a "roast me" or "hype me" mode on request for spending recaps. Never joke in error, debt-stress or money-at-stake states. Exclude bills and debts from roasts. Test the tone separately for Malaysian users.
9. **Pricing: let people look before asking for a card, and price well below US norms (inferred for MYR).** _Evidence-backed:_ 173 low reviews about paywall-before-preview (P2), stated ceilings of $25–50 a year or about $5 a month against list prices of about $99 (P3), 45 requests for lifetime or free tiers, and "7 days isn't enough to judge a budgeting app". _Inferred:_ a usable free core (manual, chat and notification capture) and a trial of about a month that starts after the first real use, with no card up front. Lead the pitch with the "pays for itself" moments, such as subscription and leak catches. The $1-promo pattern shows a cheap entry buys installs but pushes the pain to renewal.
10. **Gaps the delights reveal (missing).** _Evidence-backed demand, inferred gap:_
    - **All-in-one and net worth** (306 and 135 high, D1). Without bank sync Moni can't auto-aggregate. Consider manual or notification-derived wallet balances with a net-worth view across wallets and debts.
    - **Recurring and subscription detection** (123 high, D3). Moni's notification history could detect repeat merchants and amounts and surface "you're still paying X". It isn't in the current feature list.
    - **Couple or household sharing** (329 high, noisy, D7). Not in the feature list.
    - **Widgets** (39 high, 8 low).
11. **Android quality is a differentiator here (supports).** _Evidence-backed:_ Origin is punished for broken back navigation and iOS-isms on Android, and Copilot has no Android app at all. Moni is Android-first with notification capture that iOS can't match, so its fundamentals (back stack, staying logged in, biometric login) need to be solid.
12. **Real-time capture beats "a day behind" (supports, small n).** _Evidence-backed:_ 36 reviews complain about pending transactions not showing or syncing a day late. Notification capture is instant. _Inferred:_ make "captured 2 seconds ago" visible.
13. **Multi-currency correctness (supports, small n).** _Evidence-backed:_ a Monarch net-worth error across currencies (`play:06d1cec8`). Moni defaults to MYR and supports multiple currencies, so make sure every chat answer and total converts consistently.
