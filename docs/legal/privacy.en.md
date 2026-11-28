---
updated: 2026-11-28
---

# Privacy policy

What Moni collects, why, where it is kept, who helps us run it, and how you can see, export or delete it. Moni is a budgeting app. It never moves your money and never sells your data.

## Who we are {#who}

Moni is run by {{legalEntity}}. In this policy, "Moni", "we" and "us" mean {{legalEntity}}. "You" means the person who uses Moni.

We decide how your personal data is used, so we are its data controller. This policy covers the Moni app for Android, the Moni web app and this website. It is written to meet Malaysia's Personal Data Protection Act 2010, the EU and UK General Data Protection Regulation, and US state privacy laws.

This policy is in English and in Bahasa Melayu. Both say the same thing. [Baca Dasar Privasi dalam Bahasa Melayu](/privacy/ms).

## What we collect {#collect}

### Your account

- Your name, email address and password. Our database provider stores the password in a scrambled form that we cannot read.
- The month and year you were born, to check that you are 18 or older.
- If you sign in with Google, the name and email address Google gives us.

### The money records you keep

- Wallets and their balances, transactions, categories, tags, budgets, debts, bills, merchant names you set and the rules you make, such as "Don't ask about similar".
- Notes and receipt photos you add to a transaction.

### Captures

- The text of payment alerts from the apps you link, when you allow Moni to read notifications. Section 3 explains this.
- Receipt photos you scan, and what you type or say to add a transaction.
- What Moni's AI read from each capture, and whether you approved it or marked it "Not mine".

### Location and places

- Where your phone is when you add a transaction and when Moni captures a payment alert, if you allow location access. On Android, Moni also asks for location access in the background, so it can note where you were when a payment alert arrives while Moni is closed. It records a location only for a transaction or a captured alert. It does not track where you go. You can turn location off for each wallet's alerts, or deny it in Android settings.
- The shop or place you pick for a transaction.

### Settings and choices

- Your main currency, time zone, theme and the voice you pick for Moni chat.
- Each time you turn Moni's AI on or off: the choice, the time and the version of the notice you saw.

### Technical data

- Your device's IP address and browser or app details reach our providers' servers when you connect. Google Cloud keeps a log of each request to Moni's AI gateway, with that address, those details and the time, but not what you sent.
- When you sign in to the web app with a QR code, we keep a scrambled form of the browser's network address and a label such as "Chrome on Windows". We delete it when the code is used. An unused request expires after 10 minutes and is deleted after that.

### What stays on your phone

- Moni chat conversations and the capture log are stored on your phone, not in our database.
- The list of apps on your phone, which Moni shows so you can pick the apps to link.

Moni never asks for your bank password or card number, and never connects to your bank account. Giving us your account details is needed to use Moni. Everything else is your choice.

## Notifications on your phone {#notifications}

On Android, Moni can read payment alerts so you do not have to type them in. This only starts after you read what it does in the app and turn on notification access in Android settings.

- Android lets Moni see every notification on your phone. Moni checks them on your phone and keeps only alerts from the apps you link, such as your bank or e-wallet, that look like a payment.
- One-time codes, such as a TAC or OTP, never leave your phone.
- The alerts Moni keeps go to Moni's AI, if you have turned it on, to read the payment. They are then saved in Moni's cloud database with your account. If the AI is off, they wait on your phone.

You can turn notification access off at any time in Android settings.

## Moni's AI {#ai}

Moni's AI turns a payment alert, a receipt photo or a sentence into a transaction, and answers your questions in Moni chat. Nothing goes to it until you say yes. You choose for each use: payment alerts, Say it, Scan a receipt and Moni chat. You can change this at any time in the Android app, in Profile › Moni's AI.

When a use is on, Moni sends:

- Payment alerts: the text of the alert.
- Say it: what you type, or the words you say.
- Scan a receipt: the receipt photo.
- Moni chat: your message, any photo you send, and totals your phone works out from your records, such as spending this month. It does not send your list of transactions.
- With each capture: the names and types of your wallets and any account hint you saved for them, so the AI can pick the right one.

Your words for Say it are turned into text on your phone when it can do that. Otherwise your phone's speech service does it.

Moni's AI gateway runs on Google Cloud and stores nothing you send. It passes the request to OpenRouter, an AI service in the US, which sends it to an AI model provider. We only allow providers that do not keep the request and do not train on it. {{aiNoRetention}}.

To keep the AI working, the gateway sends a record of each request to Langfuse, an AI monitoring service. The record holds your account ID, the kind of request, the name of the app a payment alert came from, how long it took, its cost and any error. It does not hold what you sent or what the AI answered.

The AI suggests. You approve. A capture waits in Review until you approve it or mark it "Not mine". The exception is a payment that matches what you have filed many times before, or a transfer between your own wallets. Moni adds those itself and marks them, and you can undo or edit them.

Without the AI, you can still add transactions by hand, import a CSV file, and use budgets and debts. Alerts and receipts need the AI to become transactions.

## Why we use your data {#why}

We use your data only for these purposes:

- To run Moni for you: keep your records, sync them between your phone and the web, and show your budgets, charts and bills. The legal basis is our contract with you.
- To read captures with AI, read notifications and use your location. The legal basis is your consent, which you can withdraw at any time.
- To sign you in and keep your account safe. The legal basis is our contract with you and our legitimate interest in security.
- To answer you when you contact us.
- To meet our legal duties.

We do not use your data for advertising, and we do not use it to train AI models. If we ever want to use your data for something new, we will tell you first and ask for your consent where the law requires it.

## Where your data is kept and who helps us {#where}

Your account and records are stored with Supabase, in {{dataRegion}}. These providers process data for us, only on our instructions:

| Provider | What it does | Where |
| --- | --- | --- |
| Supabase | Database, sign-in and receipt photo storage | {{dataRegion}} |
| Google Cloud (Cloud Run) | Runs Moni's AI gateway. It has no database. It keeps request logs, not what you send. | Thailand |
| OpenRouter | Passes AI requests to an AI model provider | United States |
| AI model providers, through OpenRouter | Read the request and send back the answer, under zero data retention | Several countries |
| Langfuse | Monitors the AI gateway: which requests ran, how long they took and their errors, with your account ID. Not what you send. | Japan |
| Google Maps Platform | Shop search and maps. Moni sends the words you search and where you are, to show places nearby. | Several countries |
| Vercel | Hosts this website and the web app | Singapore |
| Google Sign-In | Signs you in, if you choose Sign in with Google | Several countries |

Google Sign-In also works under Google's own privacy policy. We do not share your data with anyone else, except when the law requires it.

## Sending data to other countries {#transfers}

Your data leaves your country, because the providers above work from other countries. This includes Singapore, Thailand, Japan, the United States and the countries of the AI model providers. Some of these countries do not have the same data protection laws as yours.

We protect your data when it moves:

- Each provider is bound by a data processing agreement with us. Where EU or UK law applies, these include the Standard Contractual Clauses.
- Data travels encrypted.
- We send only what each task needs.

We transfer your data because it is needed to give you the service you asked for. For AI, you also agree to the transfer when you turn on Moni's AI.

## How long we keep it {#retention}

- We keep your account and records for as long as you have a Moni account.
- When you delete something in Moni, such as a transaction or a wallet, Moni hides it everywhere. The record stays in our database, marked as deleted, until you delete your account.
- Captures you have reviewed stay in Recently reviewed for 30 days. After 90 days, the Moni app on your phone marks them as deleted. Like other deleted records, they stay in our database until you delete your account.
- A transaction made from a payment alert keeps the text of that alert.
- Receipt photos stay until you delete your account, even if you delete the transaction.
- Map coordinates from Google are refreshed or removed when they are 30 days old, the next time you open the Android app. The place's ID stays.
- The AI gateway, OpenRouter and the AI model providers keep nothing you send after they answer.
- Google Cloud keeps the AI gateway's request logs for {{requestLogRetention}}. Langfuse keeps its monitoring records for {{traceRetention}}.
- When you delete your account, everything goes at once. Copies in Moni's backups are gone within {{backupRetention}}.

## Your rights {#rights}

You can:

- See your data. Most of it is in the app. For a full copy, email us.
- Correct it. You can edit your records in the app, or ask us.
- Get a copy you can take elsewhere. Profile › Export data on your phone, or Settings › Import and export on the web, makes a CSV file of your wallets, categories, budgets, debts, debt payments and transactions.
- Delete it. Section 10 explains how.
- Withdraw your consent. Turn Moni's AI off in the Android app, in Profile › Moni's AI. Turn notification access and location off in Android settings. Withdrawing does not undo what happened before.
- Object to or ask us to limit how we use your data.
- Ask us how your data has been used and who received it.

These rights apply wherever you live, including in US states with their own privacy laws.

To use a right, email {{supportEmail}}. We will answer within the time the law sets. We may need to check that the request comes from you.

You can also complain to a data protection authority. In Malaysia, this is the Personal Data Protection Department (Jabatan Perlindungan Data Peribadi, JPDP). In the EU, it is the authority in your country. In the UK, it is the Information Commissioner's Office (ICO). We would like the chance to fix the problem first, so please contact us.

## Deleting your account {#delete}

You can delete your account and all its data at any time:

- In the Android app: Profile › Delete your account.
- In the web app: Settings › Delete your account.
- Without the app: go to [Delete your account](/delete-account) on this website.

This deletes your transactions, wallets, balances, budgets, debts, rules, merchant names, captures and the alert text stored in our database, your receipt photos, and your sign-in on every device. It happens at once and cannot be undone. Copies in Moni's backups are gone within {{backupRetention}}. Export a copy first if you want to keep your records.

Moni chat history and the capture log are on your phone. Uninstall Moni to remove them.

## Security and data breaches {#security}

We protect your data with these measures:

- Data is encrypted when it travels and when it is stored.
- Each account can read only its own records. The database enforces this.
- The AI gateway stores nothing you send and does not log the content of your requests.

No system is perfectly secure. If a data breach is likely to cause you significant harm, we will report it to the data protection authority as the law requires. In Malaysia and the EU, that is within 72 hours. We will also tell you without undue delay, and in Malaysia within 7 days of telling the authority, and say what happened and what you can do. We keep a record of every breach.

## Age {#age}

Moni is only for people aged 18 or older. When you sign up with an email address, we ask for your month and year of birth and do not let anyone younger create an account. If we learn that someone under 18 has an account, we will delete it.

## No selling, no ads {#selling}

We do not sell your personal data and we do not share it for advertising. Moni has no ads and no advertising or analytics trackers.

The website and web app use only the cookies needed to keep you signed in. They need no consent. If we ever add other cookies, we will ask you first.

## Changes to this policy {#changes}

If we change this policy, we will post the new version here with its date. If a change affects how we use your data, we will tell you in the app or by email before it takes effect, and ask for your consent again where the law requires it.

## Contact us {#contact}

For questions about this policy or your data, contact:

- {{legalEntity}}
- Email: {{supportEmail}}
- Post: {{postalAddress}}
