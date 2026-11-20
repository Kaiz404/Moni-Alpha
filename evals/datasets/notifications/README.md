# notifications

Android notifications sent to `/v1/extract/notification`. 96 items, 54 transactions and 42 that must be skipped. Rebuild with `node evals/scripts/build-notifications.mjs`. The script fetches the public sources at pinned revisions, checks their SHA-256, and writes the same file on every run. The seed for card endings and reference numbers is fixed.

## Sources

| Source | Items | Gold | Licence | Trainable |
| --- | ---: | --- | --- | --- |
| `synthetic-template` | 45 | 45 ok | own | yes |
| `moni-handwritten` | 17 | 17 skipped | own | yes |
| `uci-sms-spam-collection` | 10 | 10 skipped | CC-BY-4.0 | yes |
| `finndot/finnai-slm-data-v4` | 5 | 5 skipped | Apache-2.0 | yes |
| `moni-bench` | 19 | 9 ok, 10 skipped | own | yes |

- **synthetic-template**: English alert templates modelled on how each app words its alerts, for 22 apps in 8 countries: Chase, Bank of America, Amex, Capital One, Venmo, Cash App, PayPal (US); Monzo, Revolut, Barclays, PayPal (UK); CommBank (AU); RBC (CA); HDFC, ICICI, Paytm (IN, with lakh grouping such as `₹1,85,000.00`); DBS, GrabPay (SG); Maybank, Touch 'n Go, CIMB (MY); GCash, BDO (PH). The gold comes from the same slots that fill the template. The package names are the best-known Play Store ids.
- **moni-handwritten**: negatives that carry money words: OTPs, promos, balance alerts, a declined card, a failed top-up, statements, a bill due, login alerts, deliveries with an order total, a Venmo request, and an upcoming Direct Debit.
- **UCI SMS Spam Collection** (Almeida and Hidalgo, <https://archive.ics.uci.edu/dataset/228/sms+spam+collection>, CC BY 4.0). Hand-screened lines 9, 35, 121, 359, 369, 456 and 1493 are spam. Lines 1291, 1401 and 1678 are ham. Ham rows that describe a real payment (204, 1201, 1468) were left out. The rows are delivered as SMS (`com.google.android.apps.messaging`), and the title is a plausible sender. Attribution: T. A. Almeida and J. M. Gómez Hidalgo, SMS Spam Collection v.1.
- **finndot/finnai-slm-data-v4** (`test_sms.jsonl`, revision `29b2911`, Apache-2.0 per the dataset card). The 5 rows have empty gold and come from generator templates (`failed_upi_v1` ×2, `balance_only_v1`, `otp_v1`, `promo_v1`). Rows whose `template_id` starts with `parser/` were skipped.
- **moni-bench**: the 14 notification cases in `apps/backend/internal/extract/bench_test.go`, plus 5 English codes from `testdata/one_time_codes.json` (Maybank TAC, CIMB DuitNow TAC, Hong Leong OTP, UOB passcode, 3D Secure). Each code quotes an amount. Region MY. Bench wallets map to `w-my-bank`, `w-my-ewallet` and `w-my-cash`.

## Slices

- Positives by kind: purchase 20, P2P or transfer received 9, bill 5, foreign currency 3, refund 3, salary 3, ATM 2. The bench adds 9 more.
- Regions: MY 22, UK 19, IN 18, US 18, SG 6, PH 5, AU 4, CA 4.
- Tags: `positive`/`negative`, kind (`purchase`, `p2p-in`, `atm`, ...), and the negative's reason (`otp`, `promo`, `balance`, `declined`, `statement`, `login`, `delivery`, `reminder`, `request`, `spam`, `ham`).

## Label rules

- `walletId` is set only when the alert names a wallet in the region's list. Examples: Chase → `w-us-bank`, Amex Gold → `w-us-credit`, Monzo → `w-uk-bank`, ICICI credit card → `w-in-credit`, GCash → `w-ph-ewallet`. Alerts from Bank of America, Capital One, Cash App, US PayPal, Revolut, Barclays and CIMB have no wallet in the list, so their `walletId` is left unscored. The bench's Maybank "card ending 4821" purchase also has no `walletId`: the card could be the Maybank account's debit card or the Maybank Visa.
- Money sent to another person is `expense`. Money received is `income`. `merchant` is the counterparty as a person would name it. Legal suffixes, store numbers and VPAs are dropped: `STARBUCKS STORE 08123` → `Starbucks`, `NIMBUS TECH PVT LTD SALARY NOV` → `Nimbus Tech`.

## Decisions to review

- **ATM withdrawals** (`notif-us-chase-atm-001`, `notif-in-hdfc-atm-001`) are labelled `transfer` from bank to cash, as the text suite labels them. The notification prompt can only return `income` or `expense`, so these items fail until the notification pipeline supports transfers.
- **Monzo foreign spend** (`notif-uk-monzo-foreign-001`) shows `€45.20 (£39.31)`. The gold is EUR 45.20, the purchase as made, not the GBP it settled at.
- **UCI ham 1291** ("$50 deposit by 16 May") and **1678** ("It's £6 to get in") quote prices for things not yet paid, so they are labelled skipped.
