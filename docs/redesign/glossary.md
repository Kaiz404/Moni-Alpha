# Redesign v2 glossary

The words the redesigned app uses, and the words it never uses. The design canvas follows this file; UI copy in `apps/mobile` must follow it too. Figures in quotes are the canvas sample data (Kai, Wed 14 Oct 2026), shown as examples only; the app computes its own.

## Words to use

| Use | Meaning |
| --- | --- |
| Home, Activity, Budget, Debts | The four tabs, in this order, with the + in the middle of the bar. |
| Moni chat | The pushed page where the user talks to Moni. It hides the tab bar. It is not a tab. |
| Ask Moni | The label on the ways into Moni chat: the + chooser row, the Moni header button (Home, Activity), the ask box on Home. |
| Review | The screen holding captures that wait for a decision. |
| Approve · Not mine · Later | The three actions on every capture: chat draft cards, the Review card, the notification. Approve is on the right. |
| Recently reviewed, Move back to review | The Review page's list of the last 30 days of Approve and Not mine, and the button on a Not mine row that returns it to the deck. |
| Don't ask about similar | The checkbox on a capture. Moni then adds similar alerts without asking and marks them Auto. |
| Auto | The pill on a row Moni added without asking (routine auto-add). |
| Added, Auto-added, Waiting for review, Ignored, Not linked | The five statuses in the Capture log. |
| safe to spend a day | What's left ÷ days left in the month ("RM443 left for 18 days · RM24 a day"). |
| even pace | The month's budget ÷ days in the month ("Even pace RM58"). "a day" may follow only "even pace". |
| bills | Recurring bills still due this month. Debts are not bills. |
| bills and RM40 to Mei | The label when a total includes money owed to a person as well as bills. |
| Net worth | The sum of wallets in the main currency only. |
| Main currency | The Profile setting (default MYR) that picks the one currency focused pages show. Other-currency wallets appear only on Wallets and their own detail. |
| Merchant names | The Profile page listing raw merchant codes from alerts and the names the user gave them. "Name this merchant" names one in place. |
| Balance correction | The transaction Moni adds when the user fixes a wallet's balance ("Balance not right?"). Check-in buttons: "That's right", "Fix it". |
| Source | Where a transaction came from: Manual, Voice, Moni, Notification, Camera. |
| Capture log | The page listing the notifications Moni read and what it did with each. |
| Location from notifications | On by default; per banking app in Capture sources. |

## Never use

| Never | Use instead |
| --- | --- |
| Split | Nothing. There is no Split feature. |
| Tags, Add a tag | Source, in that slot. |
| Duplicate (as an action) | Delete, or nothing. The warning "Maybe a duplicate" is fine. |
| Decline, Declined (captures) | Not mine. Toast: "1 not mine". |
| Merge | Nothing. |
| Move money, Move RM20, move from | Nothing. Over budget is information on Budget, never an action. |
| Plan, Insights (as the name of a tab, page or place) | Budget. Lowercase "plan" as an ordinary word is fine. |
| daily budget, target (for pace) | even pace, or safe to spend a day. |
| Ask Moni tab, Moni tab | Moni chat. |
| Don't ask again | Don't ask about similar. |
| Queued, Queued for review | Waiting for review. |

## Formatting

- No space after RM, thousands commas: `RM42`, `RM1,116.20`.
- Forward-looking numbers (left, safe to spend a day, even pace, budgets, "RM20 over") are whole ringgit, rounded down. Money that exists (balances, transactions, spent) keeps 2 decimals.
- Expenses use U+2212, never a hyphen or en dash: `−RM45.90`. Income `+RM4,200.00` in deep mint. Transfers have no sign, in Meta.
- Other currencies keep their own symbol (`$120.00`) and never sum with ringgit or convert.
- Dates day first: `Wed 14 Oct`; September is `Sep`. Times lowercase with a space: `12:41 pm`. "Today" and "Yesterday" for the last two days.
- Straight apostrophe: `Touch 'n Go`.
- Meta lines join parts with ` · `.
- Raw alert text is quoted exactly as the bank sent it.
- Greetings follow the local time of day ("Morning, Kai", "Afternoon, Kai", "Evening, Kai").
