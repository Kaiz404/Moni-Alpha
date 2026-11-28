# Google Play Console answers

These are the answers to give in Play Console, each tied to the privacy policy section ([`../legal/privacy.en.md`](../legal/privacy.en.md)) that says the same thing. Play rejects an app whose form and policy disagree, so change both together.

Play's rules used here ([Data safety help](https://support.google.com/googleplay/android-developer/answer/10787469)):

- Data sent off the device is **collected**.
- Data sent to a service provider that processes it for Moni is **not shared**. Every recipient in [`processors-and-transfers.md`](processors-and-transfers.md) is a service provider, so Moni shares nothing.
- Data processed only in memory to answer a request can be marked **processed ephemerally**.
- Data that stays on the phone is not collected.

## Data safety: overview questions

| Question | Answer | Policy section |
| --- | --- | --- |
| Does your app collect or share any of the required user data types? | Yes | What we collect |
| Is all of the user data collected by your app encrypted in transit? | Yes (HTTPS to Supabase, the AI gateway, Google and Vercel) | Security and data breaches |
| Which account creation methods does your app support? | Username and password (email); OAuth (Sign in with Google) | What we collect › Your account |
| Do you provide a way for users to request that their data is deleted? | Yes: in the app (Profile › Delete your account) and at `https://moni-web-plum.vercel.app/delete-account` | Deleting your account |
| Delete account URL | `https://moni-web-plum.vercel.app/delete-account` (change it if the domain changes; the host is `WEB_URL` in `apps/mobile/constants/links.ts`) | Deleting your account |
| Has your app undergone an independent security review? | No | — |
| Is your app's data handling compliant with the Families policy? | Not applicable: Moni is for adults (18+), not for children | Age |

## Data safety: data types

Purposes use Play's names. "Optional" means the user can use Moni without it. Every row is **not shared**.

| Play data type | Collected | Ephemeral | Required or optional | Purposes | What it is in Moni | Policy section |
| --- | --- | --- | --- | --- | --- | --- |
| Location › Approximate location | Yes | No | Optional | App functionality | The phone's position on a transaction or a captured alert (`transactions.location_latitude`, `location_longitude`), and the search bias sent to Google Places | What we collect › Location and places |
| Location › Precise location | Yes | No | Optional | App functionality | Same as above; Moni asks for fine location, including in the background | What we collect › Location and places |
| Personal info › Name | Yes | No | Required | Account management, App functionality | `profiles.display_name`, the name from Google Sign-In | What we collect › Your account |
| Personal info › Email address | Yes | No | Required | Account management | Supabase Auth email | What we collect › Your account |
| Personal info › User IDs | Yes | No | Required | Account management, App functionality | The Supabase user ID; also on each Langfuse trace | Moni's AI; Where your data is kept |
| Personal info › Other info | Yes | No | Required for email sign-up | Fraud prevention, security, and compliance | Birth month and year (`user_metadata.birth_month`) for the 18+ check | What we collect › Your account; Age |
| Financial info › Purchase history | Yes | No | Required | App functionality | Transactions: amount, merchant, date, category | What we collect › The money records you keep |
| Financial info › Other financial info | Yes | No | Required | App functionality | Wallets and balances, budgets, debts, bills, and the text of payment alerts from linked apps | What we collect; Notifications on your phone |
| Financial info › User payment info | No | — | — | — | Moni never asks for card or bank account numbers | What we collect |
| Messages › Other in-app messages | Yes | Yes | Optional | App functionality | Moni chat questions, sent to the AI gateway and answered, not stored on a server (the thread stays on the phone) | Moni's AI |
| Photos and videos › Photos | Yes | No | Optional | App functionality | Receipt photos, stored in the private `receipts` bucket and sent to the AI | What we collect › Captures; Moni's AI |
| Audio › Voice or sound recordings | No | — | — | — | Speech becomes text on the phone or in the phone's speech service; Moni receives only text | Moni's AI |
| App activity › Installed apps | Yes | No | Optional | App functionality | Only the package name of each app the user links to a wallet (`wallets.notification_package`). The full app list stays on the phone | What we collect › What stays on your phone |
| App activity › Other user-generated content | Yes | No | Optional | App functionality | Notes, typed or spoken sentences for Say it, merchant names, categories, tags, rules | What we collect |
| App info and performance › Diagnostics | Yes | No | Required | App functionality | AI gateway request logs on Google Cloud and Langfuse traces: timings, status, errors, the linked app's package name | Moni's AI; How long we keep it |
| App info and performance › Crash logs | No | — | — | — | No crash reporting SDK | No selling, no ads |
| Device or other IDs | No | — | — | — | No advertising ID or device ID. **[CONFIRM with the lawyer]** whether the hashed IP kept for QR sign-in (`qr_sign_ins.ip_hash`, up to about 10 minutes) needs declaring | What we collect › Technical data |
| Web browsing, Contacts, Calendar, Health and fitness, Files and docs, Emails, SMS or MMS | No | — | — | — | Moni reads notifications, not SMS | — |

## Financial features declaration

Play's form lists loans, payments and transfers, purchase agreements, trading and funds, credit monitoring, financial advice, insurance and **Other**, plus "My app doesn't provide any financial features". It does not mention budgeting apps ([declaration help](https://support.google.com/googleplay/android-developer/answer/13849271), read 28 November 2026).

Answer (the default chosen in #61, owner to confirm): **Support services › Other**, described as:

> Personal budgeting and expense tracking. Moni records the user's own wallets, transactions, budgets and debts. It never holds, sends or lends money, does not connect to bank accounts, and gives no financial advice.

Only the two loan options require licence documents, so "Other" adds no paperwork. If the owner prefers to certify that Moni has no financial features, the alternative is "My app doesn't provide any financial features"; "Other" is the more honest description of a money app and leaves less room for a reviewer to disagree.

## Permission declarations

Play asks for a declaration, a short video, or both, for these permissions in Moni's manifest:

| Permission | Why Moni needs it | Where it shows | Source |
| --- | --- | --- | --- |
| `ACCESS_BACKGROUND_LOCATION` | Notes where the user was when a payment alert arrives while Moni is closed; only with "Allow all the time" on Capture sources' Location row | Capture sources › Location | `apps/mobile/app.json` (`isAndroidBackgroundLocationEnabled`), `components/capture-sources/use-phone-access.ts` |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Keeps the notification listener alive so payment alerts are not missed | Capture sources › Battery | `plugins/with-notification-listener-manifest.js` |
| Notification access (`BIND_NOTIFICATION_LISTENER_SERVICE`) | Reads payment alerts from linked apps. No Play form exists for it; the in-app disclosure sheet (#59) and the review notes carry it | "Let Moni read alerts?" sheet | `components/sheets/notification-access-sheet.tsx` |

For the review notes, record a video of: linking a bank app to a wallet, the disclosure sheet, Android's notification access page, an alert becoming a capture in Review, and the background location prompt.

## Store listing

- Privacy policy URL: `https://moni-web-plum.vercel.app/privacy` (Malay: `/privacy/ms`).
- The description should name notification capture and Moni's AI, so a reviewer expects them.
