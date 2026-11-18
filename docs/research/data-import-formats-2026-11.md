# Data import formats and flows (November 2026)

This page records research done on 2026-11-18. It answers the owner's question: "How do similar competitors handle data importing? Is there a proper format out there I'm not aware of?"

At the time of writing, Moni imports its own export, or any CSV through **Match columns**. Match columns has one picker per field, and it asks Day first | Month first only when the dates are ambiguous. **Check the file** then counts the new rows and the rows already here (see [`docs/REDESIGN.md`](../REDESIGN.md), "Import data").

Every link below was opened during the research. A claim marked _(unverified)_ comes only from a search snippet, because the page blocked automated fetching. Help centres change, so check a page before you rely on a detail.

## Summary and recommendation

- **The "proper formats" exist, but Malaysian consumers rarely get them.**
  - OFX (with its Intuit variant, QFX) is the one consumer format that carries a bank transaction ID, the FITID.
  - ISO 20022 camt.053 and SWIFT MT940 are corporate statement formats.
  - QIF is a legacy format that has no IDs.
  - No Malaysian bank or e-wallet we checked offers OFX or QIF. Wise is the only provider in scope that offers MT940, QIF or camt.053.
- **For Malaysians, the real formats are PDF e-statements, and a few CSVs.**
  - Maybank, CIMB, RHB, Hong Leong, GXBank and Touch 'n Go give personal customers PDFs.
  - Public Bank gives a CSV covering about 3 months.
  - Many PDFs are password-protected, and every bank lays out its PDF differently.
- **Competitors converge on one flow:**
  1. Pick an account.
  2. Map the columns, with a live preview of how each one is read.
  3. Choose how amounts are signed.
  4. Remember that setup for the account.
  5. Skip duplicates by ID, or by amount plus a date window.
  6. Preview the result, then import.

  Few of them can undo an import. Wallet by BudgetBakers adds a per-account email address that imports forwarded statements with the saved setup.

**Recommendation, in order:**

1. **Keep CSV with Match columns as the base, and make it remember.**
   - Save the mapping per source and recognise the source by its header row. The saved mapping covers the wallet, field pickers, date order, sign mode, flip, number format, encoding and rows to skip.
   - When the headers match a saved mapping, go straight to Check the file and show "Read as Public Bank CSV · Change".
   - Add XLSX input, which costs little: Wise and Hong Leong _(unverified)_ offer spreadsheets.
2. **Add PDF statements for the banks Moni's users hold. This is the import that matters in Malaysia.**
   - Start with Maybank savings and Touch 'n Go. They are the most common, and open-source parsers document their layouts.
   - Then CIMB, RHB, Public Bank and Hong Leong.
   - Detect the bank from the PDF and ask for the password when one is needed. Show the bank's password pattern as a hint, for example RHB's last 4 IC characters plus date of birth as YYMMDD.
   - Check each statement against its own balances. When the opening balance plus the rows does not equal the closing balance, say so on Check the file and don't import silently.
   - Moni's existing extraction AI could be the fallback for an unknown layout. No competitor documents doing this.
3. **Add OFX/QFX and QIF later, as a small migration feature.**
   - These serve people moving from YNAB, Quicken, Actual or GnuCash, not people bringing data from Malaysian banks.
   - OFX is worth it for its FITID. QIF has no ID, so it gets the same dedup as a CSV.
4. **Skip camt.053 and MT940** until someone asks. Only Wise offers them to consumers here, and Wise also offers CSV.
5. **Treat each import as an undoable batch, and match against captured notifications.**
   - Most rows in a statement will already be in Moni from notification capture. Check the file has to match them and not double them. This matters more for Moni than for any competitor, because Moni's main input is capture.
   - Use the amount, a few days' window and payee similarity. Keep the user's category and note, and add the bank's reference.
   - Let the user delete the whole import later, from a list of past imports.

**Open finance does not change this for years.** Bank Negara Malaysia issued its final Open Finance policy document on 17 Nov 2026 ([BNM](https://www.bnm.gov.my/-/pd-openfinance), [The Edge](https://theedgemalaysia.com/node/826133)).

- Mandatory sharing starts on 1 Jan 2028, for banks with more than 1M customers.
- E-money issuers with more than 5M users join on 1 Jan 2029.
- Sharing covers 12 months of transactions and balances, and runs through PayNet's Open Finance Malaysia.
- The exposure draft limited data consumers to licensed financial service providers ([Skrine](https://www.skrine.com/insights/alerts/december-2025/bank-negara-seeks-feedback-on-proposed-regulatory), [HHQ](https://hhq.com.my/posts/open-finance-in-malaysia-bank-negara-malaysias-exposure-draft/)). The Edge's summary of the final document does not say whether an app like Moni can be one.

This update supersedes the January 2027 start given in [`competitor-reviews-2026-10/feature-landscape.md`](competitor-reviews-2026-10/feature-landscape.md), which was based on the exposure draft.

## Formats

| Format | What it carries | Consumer use today | Parsing and dedup |
| --- | --- | --- | --- |
| **OFX** 1.x (SGML) and 2.x (XML) | Statement start and end dates and balances. Each transaction has an ID (FITID), date, signed amount, payee, type, memo and cheque number ([ofxparse](https://raw.githubusercontent.com/jseutter/ofxparse/master/README.rst)). | Common in the US. Many Canadian, UK and Australian banks offer it as a download ([Wikipedia](https://en.wikipedia.org/wiki/Open_Financial_Exchange)). We found no Malaysian bank offering it. FDX now manages the spec. | FITID must be unique per account ([GnuCash list](https://lists.gnucash.org/pipermail/gnucash-user/2015-December/063299.html)), but some banks issue new FITIDs on every download. KMyMoney added content hashing because of this ([commit](https://invent.kde.org/office/kmymoney/-/commit/65e3837697c9378616a7eda2ba3387d1208f288e)). Scope the ID to the account and keep a fuzzy fallback. Times are timezone-aware ([ofxtools](https://ofxtools.readthedocs.io/en/latest/parser.html)), so store the date only. |
| **QFX** | OFX plus Intuit tags such as `INTU.BANKID`. These support the fee that banks pay Intuit, and Quicken refuses files from banks that haven't paid ([Wikipedia](https://en.wikipedia.org/wiki/QFX_(file_format))). | US Quicken "Web Connect" downloads. | Parse it as OFX and ignore the `INTU.*` tags ([ofxtools](https://ofxtools.readthedocs.io/en/latest/parser.html)). |
| **QIF** | One-letter line codes: D date, T amount, P payee, M memo, L category, plus split lines ([Wikipedia](https://en.wikipedia.org/wiki/Quicken_Interchange_Format)). | Legacy. Quicken 2006 dropped QIF import for bank accounts, but many apps still export it. | No transaction ID, so dedup is content-only. The day and month order is not defined, and years may have 2 digits. Quicken expects ANSI, not UTF-8 (same source). |
| **CSV** | Whatever the bank chooses to put in it. | Universal, but there is no standard. RFC 4180 is informational only and says "be liberal in what you accept" ([RFC 4180](https://www.rfc-editor.org/rfc/rfc4180)). | Needs a mapping step. Watch for the delimiter, encoding, date order, decimal separator, header and footer lines, and split debit and credit columns ([GnuCash manual](https://www.gnucash.org/docs/v5/C/gnucash-manual/trans-import.html)). |
| **ISO 20022 camt.053 / .052 / .054** | XML. camt.053 is the prior-day statement, camt.052 an intraday report and camt.054 a debit or credit notice ([SEPA for Corporates](https://www.sepaforcorporates.com/swift-for-corporates/the-difference-between-a-camt052-camt053-and-camt054/)). Each entry has an amount, CdtDbtInd, a booking date and a value date, AcctSvcrRef and NtryRef, and opening and closing balances ([guide](https://www.sepaforcorporates.com/swift-for-corporates/a-practical-guide-to-the-bank-statement-camt-053-format/)). | Corporate and European. Wise offers it ([Wise](https://wise.com/help/articles/2736049/how-do-i-download-a-statement)). Actual imports it. | Amounts are unsigned, and the sign comes from CRDT or DBIT. One entry can hold a batch of transaction details. Dedup on the bank reference ([Mambu profile](https://docs.mambupayments.com/docs/camt053-xsd-business-logic), one vendor's profile). |
| **SWIFT MT940 / MT942** | Tagged text: `:60F:` and `:62F:` balances, and `:61:` statement lines with a value date, an entry date without a year, a D or C mark, an amount with a comma decimal and a bank reference. `:86:` is free text ([Westpac spec](https://bankrec.westpac.com.au/docs/statements/mt940)). | Corporate. ISO 20022 is replacing it ([Wikipedia](https://en.wikipedia.org/wiki/MT940)). Wise offers it. | Infer the year across year-end, parse comma decimals, and expect the `:86:` text to differ by bank. |
| **PDF statement** | A date, a description over several lines, an amount, a direction mark and a running balance. It has no IDs. | The main format Malaysian banks give consumers (see the next section). | Needs a layout parser per bank. pdfplumber reads machine-generated PDFs but not scans ([pdfplumber](https://github.com/jsvine/pdfplumber)). Validate against the balance chain. Dedup is content-only. |

## Malaysian banks and e-wallets

"Strong" means the bank's own page says it. "Weak" means a forum post, a parser repo, or a search snippet only.

| Provider | What a consumer can get | History | Quirks | Evidence |
| --- | --- | --- | --- | --- |
| **Maybank** (M2U, MAE) | PDF e-statement. We found no personal CSV export. CSV appears only in M2U Biz _(unverified)_. | 6 months on M2U, by user report. | Emailed PDFs use a password the user sets, or by default the date of birth as `01Jan1980`. Savings rows read `DD/MM/YY desc amount+/-  balance`. Descriptions run over several lines and across pages, and headers are in three languages. Credit card rows give `DD/MM` without a year and mark credits `CR`. | Weak: [parser repo](https://github.com/jaihohoho/maybank_statement_parser), [Lowyat](https://forum.lowyat.net/topic/5147518/all), [stmtparser.my](https://github.com/hongjiaherng/stmtparser.my/blob/main/src/stmtparser_my/parsers/maybank_savings.py), [layout notes](https://github.com/flyhust/malaysia-bank-statement-to-excel/blob/main/references/banks/maybank.md) |
| **CIMB** (Clicks, OCTO) | PDF e-statement. The official advice for history is to save the page from the browser. | Not found. | The password is set by the user _(unverified)_. Dates are `dd/mm/yyyy`, and the amount sits on the last line of each block. A bank code is sometimes glued to the name. | Strong for no export: [CIMB FAQ](https://www.cimb.com.my/en/personal/help-support/faq/cimb-clicks-online-banking/accounts-and-transactions/accounts-and-transactions/can-i-save-the-transaction-pages-as-shown-in-cimb-clicks.html). Weak for the layout: [notes](https://github.com/flyhust/malaysia-bank-statement-to-excel/blob/main/references/banks/cimb.md) |
| **Public Bank** (PBe) | **CSV download** of the balance and transaction history, plus a monthly PDF. | CSV covers the current month and the past two. | PDF dates are `dd/mm` without a year, and only the first row of each day shows the date. `Balance C/F` and `B/F` appear at page breaks. Debit and credit can flatten into one column, so the direction must come from the balance. | Strong: [PBe FAQ](https://pbebank.com/en/digital-banking/pbe-online-banking/faq/pbe-online-banking/general-pbe-services/), [e-statement FAQ](https://www.pbebank.com/en/digital-banking/pbe-online-banking/faq/pbe-online-banking/e-statement/). Weak: [layout](https://github.com/flyhust/malaysia-bank-statement-to-excel/blob/main/references/banks/public-bank.md) |
| **RHB** | PDF e-statement. | Up to 25 months online. Savings statements are quarterly, current account and card statements monthly. | The emailed PDF password is the last 4 characters of the IC or passport plus the date of birth as `YYMMDD`. Rows start `dd Mon`. | Strong: [RHB FAQ](https://www.rhbgroup.com/others/faq/general/statement/index.html). Weak: [layout](https://github.com/flyhust/malaysia-bank-statement-to-excel/blob/main/references/banks/rhb.md) |
| **Hong Leong** | PDF e-statement, password-protected. A CSV download over 120 days _(unverified)_. | 24 months plus the current month. | Dates are `dd-mm-yyyy`, with separate deposit and withdrawal columns. The password formula is not published. | Strong: [HLB FAQ](https://www.hlb.com.my/en/personal-banking/help-support/general-faq/e-statement.html). Weak: [layout](https://github.com/flyhust/malaysia-bank-statement-to-excel/blob/main/references/banks/hong-leong.md) |
| **AmBank** | Transaction history download, format not stated. E-statement. | 1 month of history. E-statements for 12 months. | None known. | Strong: [AmBank FAQ](https://www.ambank.com.my/online-banking/faq/account) |
| **Bank Islam** | E-statement in BIMB Mobile _(unverified)_. | Not found. | Not found. | None opened (403). |
| **GXBank** | PDF only, in the app. | Up to 12 months. | Statements can't be emailed _(unverified)_. | Strong: [format](https://help.gxbank.my/deposits/Account_Statements/What_format_can_I_download_my_e-statement_in%3F), [range](https://help.gxbank.my/deposits/Account_Statements/How_long_will_my_Savings_Account_monthly_e-statements_be_available_on_the_app%3F) |
| **Touch 'n Go eWallet** | PDF emailed from the app (Transactions, then Email), or downloaded from the TNG ePortal. | The last 90 days, or the current search. | Two stacked tables, wallet and GO+. Dates are `d/m/yyyy`. Amounts read `RM 1,234.56` with no sign, so the direction comes from the type or the balance. GO+ moves double-count against the wallet table, and some rewards are missing. | Weak: [TNG_Statement_in_CSV](https://github.com/Rexpert/TNG_Statement_in_CSV), [stmtparser.my tng.py](https://github.com/hongjiaherng/stmtparser.my/blob/main/src/stmtparser_my/parsers/tng.py) |
| **GrabPay** | The terms say a full statement can be downloaded. Format unknown. | Unknown. | None known. | Weak: [Grab MY terms](https://www.grab.com/my/terms-policies/payment-rewards/) |
| **Boost** | History by support request, sent by email _(unverified)_. | Unknown. | None known. | None opened (403). |
| **ShopeePay** | In Malaysia, in-app history only _(unverified)_. The Philippines gets a monthly PDF statement. | 12 months (Philippines). | None known. | Weak: [Shopee PH](https://help.shopee.ph/portal/4/article/144913-[ShopeePay]-What-is-the-ShopeePay-Statement-of-Account) |
| **BigPay** | A "financial statement" for any date range _(unverified)_. | Any range. | Format unknown. | None opened. |
| **Ryt Bank** | A statement whose amounts carry a leading `+` or `-`. | Not found. | None known. | Weak: [duitku](https://github.com/ian-cq/duitku) |
| **Wise** | Web: PDF, XLSX, CSV, MT940, QIF and camt.053. App: PDF, CSV and XLSX. **No OFX.** | Up to 365 days per statement. | A password is needed to download. | Strong: [Wise help](https://wise.com/help/articles/2736049/how-do-i-download-a-statement) |

What this means for Moni:

- **PDF is the norm.** Only Public Bank, Wise and possibly Hong Leong give structured files.
- **Signs come in five conventions:**
  - a trailing `+` or `-` (Maybank);
  - a `CR` suffix (Maybank card);
  - a leading `+` or `-` (Ryt);
  - separate deposit and withdrawal columns (Hong Leong);
  - no sign at all, so the direction comes from the balance (Public Bank, RHB, TNG).
- **Every Malaysian source is day-first.** Several leave out the year.
- **History windows are short,** from 1 month to 3 months. Monthly e-statements, kept for 12 to 25 months, are the reliable way to backfill.

## Competitors

"—" means the app's docs don't say.

| App | Formats | Mapping and saved setup | Duplicates | Sign | Rules and AI on import | Preview and undo |
| --- | --- | --- | --- | --- | --- | --- |
| **YNAB** ([guide](https://support.ynab.com/en_us/file-based-import-a-guide-Bkj4Sszyo.md)) | CSV, OFX, QFX, QIF. Web and iPad only. | A dropdown per column, auto-matched. "Remember setting for this account" is on by default. | Skips rows with the same date and amount. Matches a manual entry with the same amount within 10 days. Deleted rows don't come back. | One column, or Inflow and Outflow. A Swap toggle. | From 14 Sep 2026, payee cleanup and auto-categorize run always on, learned from the user's edits. | A preview, where you confirm rows. No batch undo. |
| **Monarch** ([page](https://www.monarch.com/tags-csv-import)) | CSV, including a multi-account Mint export. | — | _(unverified)_ Three modes: Prioritize CSV (replaces the date range), Use transaction IDs, Import all. | — | Maps Mint categories to Monarch's. | _(unverified)_ No undo. |
| **Copilot** | _(unverified)_ Apple Card statements and a Mint import only. Generic CSV is still a roadmap request. | — | — | — | — | — |
| **Lunch Money** ([CSV import](https://support.lunchmoney.app/importing-transactions/import-via-csv)) | CSV and PDF, up to 3 MB and 10k rows. | Auto-match by header name. Saved configs per account skip the mapping steps. | Exact date, payee and amount. Duplicates listed below the preview. | Three modes: signed amount, two columns, or amount plus type column. A Flip types toggle. | Rules on by default. Category values match by name, otherwise you map or create them. | Deselect rows in the preview. A "Fix dates" step. Balance entry at the end. Undo —. |
| **Actual Budget** ([importing](https://actualbudget.org/docs/transactions/importing), [rules](https://actualbudget.org/docs/budgeting/rules/), [source](https://raw.githubusercontent.com/actualbudget/actual/master/packages/loot-core/src/server/accounts/sync.ts)) | CSV, QIF, OFX, QFX, CAMT. Recommends OFX. | Field pickers, a date format with the parsed value shown in green, delimiter, Flip, Split, Multiply. Saved settings —. | `imported_id` first. Then the same amount within ±7 days, preferring the same payee and the nearest date. On a merge, the user's payee, category and notes are kept and the bank's date and id taken. | Flip, Split into inflow and outflow. | Ordered rules in stages. A rename or category edit offers a rule. | "Reimport deleted transactions" toggle. Manual merge ([merging](https://actualbudget.org/docs/transactions/merging)). |
| **Firefly III Data Importer** ([CSV](https://firefly-iii-docs.pages.dev/how-to/data-importer/import/csv), [dedup](https://raw.githubusercontent.com/firefly-iii/docs/main/docs/docs/references/data-importer/duplicate-detection.md)) | CSV, plus bank feeds such as GoCardless (Nordigen). | A role per column, date format string with a locale, encoding. _(unverified)_ The whole configuration saves as reusable JSON. | Content hash by default, which breaks if the mapping changes. Or an identifier column. Checks deleted transactions too. | — | An "apply rules" toggle. | Every batch is tagged, so it can be found and deleted. |
| **Quicken Classic** ([CSV](https://info.quicken.com/win/import-transactions-from-csv-file)), **Simplifi** ([CSV](https://support.simplifi.quicken.com/en/articles/4413430-how-to-manually-import-transactions-in-quicken-simplifi)) | CSV in a fixed column order, plus QFX Web Connect. | No mapping. Columns must follow the template. | Quicken: none, so re-importing duplicates everything. Simplifi: each set imports once. | Positive raises net worth. Simplifi expenses need a minus. | Categories must already exist (Simplifi). | A summary after import. |
| **Wallet by BudgetBakers** ([imports](https://budgetbakers.com/imports-web-app/), [2017](https://budgetbakers.com/introducing-imports-wallet/)) | Bank statement files, on the web. | "Import rules" are set over a view of the file, saved, and reused. **An email address per account** imports forwarded statements automatically. | _(unverified)_ Duplicate flagging only for bank-connected accounts. | — | Auto-categorized like synced records. | _(unverified)_ A preview to accept. |
| **Toshl** ([guide](https://toshl.com/blog/how-to-import-financial-data-web-app/)) | CSV, TSV, XLS, TXT, OFX, QFX, QIF. | Map columns over a preview, skip any column. The date format is auto-detected, and D/M/Y or M/D/Y is asked when ambiguous. | — | — | Suggests transfer pairs after import. | A "List of previous imports". Undo means deleting the account. |
| **Moneyspire** ([KB](https://kb.moneyspire.com/article/21-importing-data)) | OFX, QFX, QBO, QIF, QMTF, CSV. | — | — | — | "Import Filters": keyword rules set the category and payee. | — |
| **GnuCash** ([manual](https://code.gnucash.org/docs/C/gnucash-manual/trans-import.html)) | QIF, OFX, QFX, CSV, plus camt.052 and MT940 through AqBanking. | Column dropdowns, encoding, currency format, skip lines. Named presets. | The Import Matcher scores date, amount, ID, description and memo in a window of about ±42 days. A colour bar shows match strength, and you can override it. | Separate Deposit and Withdrawal columns. | A Bayesian token map per account suggests the other account. Learned mappings can be edited. | — |
| **PocketSmith** ([files](https://learn.pocketsmith.com/article/238-importing-bank-files-into-pocketsmith)) | OFX (recommended, matches the account), QFX, QIF, CSV. | Saved CSV formats under preferences. Quick import takes several files and asks for the account of each. | You choose: leave out overlapping dates, replace them (which erases edits), or keep all. | An "amounts are reversed" checkbox. | — | — |
| **Emma** ([help](https://help.emma-app.com/en/article/7gebro/)) | CSV into an offline account (Pro). | Required columns are Date, Payment Reference and Amount. | Re-uploading an updated file "will not duplicate". Method not stated. | — | — | — |
| **Money Lover**, **Spendee** | We found no import docs we could open. _(unverified)_ Spendee: web upload into a chosen wallet, unknown categories go to Other. | — | — | — | — | — |

What this means for Moni:

- **Patterns to copy:**
  - the setup remembered per account (YNAB, Lunch Money, PocketSmith, GnuCash);
  - three amount modes plus a flip;
  - the parsed value shown beside the raw value (Actual);
  - duplicates by ID first, then fuzzy, with the matches listed and overridable;
  - deleted rows don't return;
  - rules applied before the preview;
  - Wallet's email-in.
- **To avoid:**
  - fixed column orders (Quicken);
  - "replace the date range", which erases the user's edits (PocketSmith, Monarch's Prioritize CSV).
- **No one documents a one-tap undo of a whole import.** Firefly's batch tag comes closest. An undo would set Moni apart.
- **AI in import is mostly categorization.** YNAB's is always on, and GnuCash uses Bayesian matching. No competitor documents reading an unknown PDF layout with an LLM. Lunch Money accepts PDFs but doesn't say how it reads them.

## Best practices

- **Dedup in layers.**
  1. Match a bank ID scoped to the account (FITID, or camt AcctSvcrRef or NtryRef).
  2. Otherwise match the same amount within a date window, preferring a similar payee and the nearest date. Actual uses ±7 days, YNAB ±10 days against manual entries, and GnuCash about ±42 days with a score.
  3. Show uncertain matches and let the user decide.

  When a row matches, keep the user's category and note and take the bank's reference ([Actual source](https://raw.githubusercontent.com/actualbudget/actual/master/packages/loot-core/src/server/accounts/sync.ts)). For Moni, step 2 also has to match notification captures, which carry the time but no bank reference.
- **Make re-import idempotent.**
  - Store a fingerprint of the raw row, built from the parsed date, amount, normalised description and account, taken before any user edits. Importing the same file twice then changes nothing.
  - Hashes break when the mapping changes ([Firefly](https://raw.githubusercontent.com/firefly-iii/docs/main/docs/docs/references/data-importer/duplicate-detection.md)), so hash parsed values, not column positions.
  - Remember deleted rows' fingerprints, so a re-import doesn't bring them back (YNAB, Firefly).
- **Make each import an undoable batch.** Give every row an import id, keep a list of past imports, and let the user delete one import as a unit. Firefly's import tag is the nearest precedent.
- **Remember the source.**
  - Key the saved setup by a normalised header signature, plus the bank for PDFs.
  - Store the wallet, field map, date order, sign mode, flip, number format, encoding and rows to skip.
  - Ask again only when the headers change.
- **Pending and posted transactions.**
  - A pending row's name and amount can change. It may disappear, and it gets a new ID when it posts ([Plaid](https://plaid.com/docs/transactions/transactions-data/)).
  - Statements hold only posted rows, so a statement row should replace a pending capture, not sit beside it.
  - Actual skips pending rows by default.
- **Dates.**
  - Parsers default to month-first ([dateutil](https://dateutil.readthedocs.io/en/stable/parser.html)). Scan the whole column: a first number above 12 settles the order.
  - Default to day-first for Malaysian sources, and show "03/04 → 3 Apr" before import.
  - Infer missing years from the statement period, taking care across year-end ([MT940](https://bankrec.westpac.com.au/docs/statements/mt940), Public Bank, Maybank card).
  - Store the date only, so a UTC conversion doesn't move a row to the previous day ([ofxtools](https://ofxtools.readthedocs.io/en/latest/parser.html)).
- **Encoding.**
  - Strip the UTF-8 BOM. Excel writes one, and if it is left in, it corrupts the first header name.
  - Try strict UTF-8, then fall back to Windows-1252 ([Python codecs](https://docs.python.org/3/library/codecs.html)).
- **Numbers.**
  - Handle a comma or a dot as the decimal separator: MT940 uses a comma. Detect it from the last separator followed by 1 or 2 digits.
  - Strip `RM`.
  - Read `CR` and `DR` suffixes, trailing `+` and `-`, and parentheses as negative. We found no doc page for the suffix and parentheses conventions. They come from the Malaysian layouts above and from common practice.
- **Statements carry their own check.** Opening balance plus credits minus debits equals the closing balance ([Mambu](https://docs.mambupayments.com/docs/camt053-xsd-business-logic)). Every Malaysian PDF parser repo we read uses the balance chain to work out the direction and catch extraction errors.

## Open questions

- **Restore and deleted rows.** REDESIGN.md says a row deleted since the export comes back on restore. YNAB and Firefly block deleted rows from coming back. Should Moni remember deleted fingerprints for imports from bank files, and keep the current behaviour for restoring its own export?
- **PDF parsing on the server or on the device?** Statements are sensitive. A rule-based parser per bank can run on the phone. An AI fallback for unknown layouts would send the text to the backend.
- **PDF passwords.** Should Moni ever store a statement password or its pattern, or ask every time?
- **Email-in.** Is a per-user forwarding address, as in Wallet, worth the backend work, given that most banks email monthly PDF statements?
- **Who imports at all?** The October research counted export and import as the third most-requested feature, but did not separate migrating from another app from backfilling bank history. A migration needs CSV, QIF and OFX. A backfill needs PDF.
- **Can a non-licensed app be an open finance data consumer?** Read the definition in BNM's final policy document. This research read only the landing page and The Edge's summary.
- **Evidence gaps:** Hong Leong's CSV, AmBank's download format, and the e-wallet exports for Bank Islam, Boost, ShopeePay, BigPay and GrabPay. A short test with real accounts would settle these faster than more web research.
