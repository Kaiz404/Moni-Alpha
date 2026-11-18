# AI in data import: compliance research (November 2026)

This page answers one question for Moni: can the import flow (bank CSV files, and maybe PDF statements) use AI without a data-protection problem delaying launch?

The research was done on 2026-11-18 from web sources. Every claim links to the page it came from. Code observations describe the `main` branch on that day.

**This is research, not legal advice.** Points marked **Lawyer** should be confirmed by a Malaysian data-protection lawyer before launch. Most sources on the 2024 amendment are law-firm summaries, because the Act's PDF and the Commissioner's site could not be read as text.

## Summary and recommendation

- **AI on personal financial data is not new for Moni.** Notification text, typed and voice text, and receipt photos already go to an LLM through the Go backend and OpenRouter ([`docs/AI.md`](../AI.md)). Import would send more history at once. It would not add a new kind of processing.
- **PDPA does not block it.** Financial data is not "sensitive personal data" under the Act. Moni is far below the thresholds for a mandatory data protection officer and impact assessment. Cross-border transfer no longer needs a government whitelist. The duties that do apply (notice, consent, security, retention, transfer records, breach notification) apply to Moni **today**, with or without AI import.
- **Two gaps exist now, before import.** Neither needs a lawyer to fix.
  1. The backend sends `provider: { require_parameters: true }` only (`apps/backend/internal/llm/client.go`). It sets neither `zdr` nor `data_collection: "deny"`. OpenRouter can therefore route Moni's requests to any of 38 endpoints for `deepseek-v4.1-flash`. Five of them (Alibaba, AtlasCloud, Baidu, GMICloud, StreamLake) are not on OpenRouter's zero-data-retention list. This was checked against OpenRouter's public endpoint API on 2026-11-18.
  2. The app has no privacy notice, no consent step, and no account deletion. A search of `apps/mobile/app`, `components` and `lib` found none. Google Play requires account deletion both in the app and through a web link ([Play policy](https://support.google.com/googleplay/android-developer/answer/13327111)).
- **Recommendation for launch:**
  - Ship import **without sending file rows to AI.** Use today's deterministic **Match columns** flow and add auto-matching from header names. Lunch Money and YNAB do this (see [Competitors](#how-competitors-do-it)).
  - If AI helps at all, use option **A**: send only the column headers and 2 or 3 masked sample rows to propose a column mapping. Then apply the mapping on the phone. This is less exposure than any notification Moni already sends.
  - Leave PDF statements out of the launch. They carry name, address and full account numbers, and an LLM would see every page.
  - Categorising imported rows by merchant string only (option **C**) is acceptable after launch. Put it behind the same notice and the zero-retention setting.
- **Must be in place first, in order:**
  1. Set `zdr: true` on every OpenRouter request and turn on account-wide ZDR in OpenRouter's privacy settings.
  2. Publish a privacy notice in Malay and English, and capture consent to it at sign-up.
  3. Add in-app account deletion and a web deletion link.
  4. Keep a one-page breach plan and a processor and transfer register.

## PDPA findings

### What applies to Moni

| Topic | Finding | Source |
| --- | --- | --- |
| Scope | The Act covers personal data processed "in respect of commercial transactions" by persons established in Malaysia. An individual present at least 180 days a year counts as established. A consumer app with sign-up and paid AI is inside the scope. | [Act 709 s.2, Lawplayer](https://lawplayer.com/my/act/act-709) |
| Sensitive data | The Act defines sensitive data as physical or mental health, political opinions, religious beliefs, commission of an offence, and (since 1 April 2025) biometric data. **Financial data is not on the list.** Sensitive data needs explicit consent (s.40). Ordinary personal data needs consent with exceptions (s.6). | [DLA Piper](https://www.dlapiperdataprotection.com/?c=MY&t=law), [Skrine](https://www.skrine.com/insights/alerts/december-2024/amendments-to-the-personal-data-protection-act-201), [Lawplayer](https://lawplayer.com/my/act/act-709) |
| Financial data in guidelines | The Commissioner's DPO and DPIA guidelines count "sensitive personal data **including financial information**" towards a 10,000-person threshold. Moni's transaction data falls into that count, even though the Act does not call it sensitive. | [CMS](https://cms.law/en/int/legal-updates/guidelines-on-appointment-of-data-protection-officers-in-malaysia), [Rahmat Lim](https://www.rahmatlim.com/publication/articles/32906/pdp-commissioner-launches-guidelines-on-data-protection-impact-assessment-automated-decision-making-and-profiling-and-data-protection-by-design) |
| Notice and choice (s.7) | A written notice must give the purposes, the source of the data, the classes of third parties who receive it, and whether supplying it is voluntary. It must be in Malay **and** English (s.7(3)). | [Lawplayer](https://lawplayer.com/my/act/act-709), [Lex Mundi](https://www.lexmundi.com/guides/global-data-privacy-guide/jurisdictions/asia-pacific/malaysia) |
| Consent form | Consent must be recordable and "maintained properly". Users under 18 need a parent's consent. | [DLA Piper](https://www.dlapiperdataprotection.com/?c=MY&t=law) |
| Disclosure (s.8) and retention (s.10) | Data may not go beyond the stated purposes or third-party classes without consent. Data must not be kept longer than its purpose needs. | [Lawplayer](https://lawplayer.com/my/act/act-709) |
| Registration | Only listed classes must register: banking and financial institutions, communications, insurance, health, tourism, transport, education, direct selling, certain services, real estate, utilities, pawnbrokers and moneylenders. A budgeting app is not obviously one of them. **Lawyer** to confirm. | [DLA Piper](https://www.dlapiperdataprotection.com/?c=MY&t=law) |

### The 2024 amendment (Act A1727)

The amendment came into force in three stages ([Skrine](https://www.skrine.com/insights/alerts/december-2024/amendments-to-the-personal-data-protection-act-201)):

- **1 January 2025:** no new duties.
- **1 April 2025:**
  - "Data user" becomes "data controller".
  - Biometric data becomes sensitive data.
  - Processors become directly bound by the Security Principle (s.9) and face penalties themselves.
  - The fine for breaching a principle rises to RM1,000,000 and up to 3 years in prison, from RM300,000 and 2 years ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/07/from-legislative-reform-to-practical-guidance-key-amendments-to-malaysias-pdpa-and-the-launch-of-cross-border-transfer-guidelines)).
  - The cross-border whitelist is removed.
- **1 June 2025:** DPO appointment, breach notification and data portability (s.43A).

**Cross-border transfer (s.129), with guidelines issued on 29 April 2025** ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/07/from-legislative-reform-to-practical-guidance-key-amendments-to-malaysias-pdpa-and-the-launch-of-cross-border-transfer-guidelines), [Rödl](https://www.roedl.com/en/insights/malaysia-part3-personal-data-protection-amendment-act-2024/)):

- One basis is enough. The options are:
  - The destination has a "substantially similar" law or "adequate" protection, shown by a transfer impact assessment that is valid for 3 years.
  - Consent: explicit, recorded, and given after written notice of the recipient class and purpose.
  - The transfer is necessary for the contract with the user.
  - Reasonable precautions and due diligence, such as contract clauses (ASEAN model clauses or EU SCCs).
- Whatever the basis:
  - Notify users in writing.
  - Have a contract with the recipient.
  - Use secure transfer.
  - Keep a record of each transfer: recipient, country, data type, purpose, evidence.
- **Moni already transfers abroad.**
  - The backend runs in Cloud Run `asia-southeast3`, which is Bangkok ([`apps/backend/README.md`](../../apps/backend/README.md)).
  - OpenRouter processes in the US ([OpenRouter privacy](https://openrouter.ai/privacy)).
  - Upstream model hosts are in various countries.
  - The simplest basis is explicit consent in the sign-up notice, plus the OpenRouter DPA as a contract. **Lawyer** to confirm which basis to rely on.

**Breach notification**, from the guideline of 25 February 2025 ([DLA Piper](https://privacymatters.dlapiper.com/2025/03/malaysia-guidelines-issued-on-data-breach-notification-and-data-protection-officer-appointment/)):

- **Who must be told, and when:**
  - Notify the Commissioner as soon as practicable and **within 72 hours**.
  - Notify affected users **within 7 days** of notifying the Commissioner.
- **When notice is required:** the breach is likely to cause significant harm. That means any of the following:
  - financial loss
  - misuse for illegal purposes
  - compromise of sensitive data
  - a combination of data that enables identity fraud
  - for the Commissioner only, more than 1,000 affected people
- **Records and processors:** keep a breach register for 2 years. Require processors by contract to report breaches to you promptly.
- At 1,000 users, any leak of the whole database would meet the scale test.

**DPO**, effective 1 June 2025 ([CMS](https://cms.law/en/int/legal-updates/guidelines-on-appointment-of-data-protection-officers-in-malaysia)):

- **When one is required:** controllers and processors must appoint a DPO when they process any of these:
  - data of more than 20,000 people
  - sensitive data, including financial information, of more than 10,000 people
  - regular and systematic monitoring
- **Moni at launch:** at about 1,000 users it is below both counts.
- **Open question:** whether reading payment notifications counts as "systematic monitoring". **Lawyer** to confirm.
- **If one is needed:** register the DPO within 21 days of appointment. The DPO must speak Malay and English and be resident or easily contactable.

**DPIA, automated decisions and design guidelines** (30 April 2026, [Rahmat Lim](https://www.rahmatlim.com/publication/articles/32906/pdp-commissioner-launches-guidelines-on-data-protection-impact-assessment-automated-decision-making-and-profiling-and-data-protection-by-design)):

- **When a DPIA is needed:** it uses the same large-scale thresholds as the DPO guideline. It is also needed for high-risk processing, and "innovative technologies such as AI-driven features" count as a risk factor.
- **Moni's position:** below the thresholds. A one-page DPIA for the AI features is still cheap insurance.
- **Automated decisions:** where automated decision-making is used, notices should say so and describe what the AI does. Moni's AI proposes and the user reviews, so it makes no significant automated decision about the user.

**Draft AI framework** (consultation from 5 to 23 October 2026, [Baker McKenzie](https://www.bakermckenzie.com/en/insight/publications/2026/10/malaysia-consultation-on-proposed-ai-and-personal-data-protection-framework)):

- **What the draft expects:**
  - due diligence and contracts for third-party AI vendors
  - clear notices
  - fresh consent for materially new purposes
  - an assessment of each transfer
- **Status:** it does not create a new legal basis. Its final status was unknown on 2026-11-18. Recheck before launch.

### Bank Negara Malaysia

- **Licences:** BNM licenses or approves:
  - banks (FSA s.10)
  - e-money and payment instruments, and payment system operators (s.11)
  - merchant acquirers (s.17)
  - money services businesses
- **Other regulators:**
  - Non-bank credit, including BNPL, falls under the Consumer Credit Commission.
  - Digital assets fall under the Securities Commission.
  - [Christopher & Lee Ong](https://www.christopherleeong.com/?p=67938) names no rule for budgeting or personal finance management apps.
- **Moni:** it holds no money, makes no payments and gives no credit, so no BNM licence appears to apply. **Lawyer** to confirm.
- **Watch item, Open Finance:** an exposure draft from 18 November 2025 starts with large banks from 1 January 2027. Consent there must be "specific, voluntary, explicit, deliberate and revocable", recurring access lasts at most 6 months, and a consent dashboard is required ([same source](https://www.christopherleeong.com/?p=67938)). This matters only if Moni later pulls bank data through it.

## GDPR expectations, as far as they affect choosing a provider

- **Article 28(1) GDPR:** use only processors that give "sufficient guarantees". Malaysia's processor security duty and the transfer guideline's contract requirement point the same way.
- **Article 28(2) and 28(4):** sub-processors need the controller's authorisation, and the processor stays liable for them ([GDPR Art. 28](https://gdpr-info.eu/art-28-gdpr/)).
- **For Moni:** pick a gateway with a DPA and a known list of sub-processors, and send the minimum.

## Provider data handling

| Provider | Trains on API data? | Retention | Controls a small app can use | DPA | Source |
| --- | --- | --- | --- | --- | --- |
| **OpenRouter** (gateway) | OpenRouter does not. Upstream providers may, and they differ. | No fixed period is stated for prompts. ZDR endpoints keep nothing after processing. From 27 Oct 2026 all traffic, including ZDR, is screened for CSAM. | `provider.zdr: true` per request, account-wide ZDR in privacy settings, `provider.data_collection: "deny"` (default `allow`), and `only`/`ignore` lists of providers. EU or US in-region routing is for Business and Enterprise only. | Published DPA dated 26 Aug 2026. It says it forms part of the Terms of Service, with OpenRouter as processor, breach notice within 72 hours, and SCCs. Model providers are excluded from the 30-day sub-processor change notice. Sensitive data is not processed unless agreed. | [Logging](https://openrouter.ai/docs/guides/privacy/logging), [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection), [ZDR](https://openrouter.ai/docs/guides/features/zdr), [privacy](https://openrouter.ai/privacy), [DPA](https://openrouter.ai/data-processing-agreement) |
| **`deepseek-v4.1-flash` on OpenRouter** (Moni's model) | Depends on the endpoint | 33 of 38 endpoints are on the ZDR list. Alibaba, AtlasCloud, Baidu, GMICloud and StreamLake are not. | Setting `zdr: true` removes those five and keeps Nebius, DeepInfra, Fireworks, Together and others. | Through OpenRouter | [Endpoints API](https://openrouter.ai/api/v1/models/deepseek/deepseek-v4.1-flash/endpoints), [ZDR list](https://openrouter.ai/api/v1/endpoints/zdr) (both read on 2026-11-18) |
| **Anthropic API** | No, unless the user sends feedback or opts in | Deleted within 30 days. Flagged content is kept up to 2 years. ZDR is by agreement. | No setting needed for training. ZDR only by agreement. On OpenRouter, Claude ZDR endpoints are Bedrock and Google only. | Commercial terms | [Retention](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data), [training](https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training) |
| **OpenAI API** | No, unless you opt in | Abuse logs up to 30 days. Responses API state is kept 30 days when stored. ZDR needs OpenAI's approval. | Do not store application state. ZDR via sales. | Not on the page read; check with OpenAI | [Your data](https://developers.openai.com/api/docs/guides/your-data) |
| **Google Gemini API** | Paid tier: no. Free tier: yes, with human review, and Google says not to send personal data. | Paid tier: logs are kept "for a limited period" for abuse detection. | Use only a billing-enabled project. Never use the free tier for user data. | Paid tier is covered by Google's processor DPA | [Gemini API terms](https://aistudio.google.com/docs/terms) (effective 23 Mar 2026) |

**What a small app must configure:**

1. Use paid tiers only.
2. Send `provider.zdr: true` on every request, and turn on account-wide ZDR so a missed field cannot fall through.
3. Do not use any provider-side storage, such as files or stored responses.
4. Keep the backend stateless, as it is now, and log no prompt bodies.
5. Re-run the endpoint check when changing the model. `pnpm --filter backend test:live` could also assert that ZDR endpoints exist.

## Design options for AI in import

The ratings are this author's assessment, not sourced facts. "Exposure" means what reaches a third party.

| Option | Exposure | Accuracy | Running cost | Effort | Notes |
| --- | --- | --- | --- | --- | --- |
| **A. Headers plus 2 or 3 masked sample rows**: AI proposes the mapping, and the phone applies it to the whole file | Very low. Column names and data shapes only. Mask amounts as `123.45`, merchants as `MERCHANT_1`, digits as `X`. | High for mapping. The user still confirms in Match columns. | About one call per file | Small. A new endpoint, with Match columns as the review step. | Less data than one notification extraction. Covered by the notice already needed. |
| **B. Deterministic parsers per known bank format, plus saved templates, no AI** | None | Exact for known formats. Unknown formats fall back to manual mapping. | Zero | Medium, and grows with each bank | YNAB remembers settings per account. Lunch Money auto-maps by header names on the client. |
| **C. AI categorisation from merchant strings only**, with account numbers, names and references stripped, rows batched | Low to moderate. Spending pattern by merchant, not identity. | Good. Moni's own history (routine detection) can handle repeats first. | Scales with rows. Batch and dedupe merchants. | Small to medium | Close to what notification extraction already sends. Put it behind ZDR. |
| **D. On-device or self-hosted small model** | None to third parties for on-device. Self-hosted keeps it inside your own processor chain. | Lower on small models | Device battery, or a GPU host cost | High | The project rule says "NO local LLM — do not reintroduce" ([`project-overview.mdc`](../../.cursor/rules/project-overview.mdc)). Self-hosting conflicts with minimal cost. |
| **E1. PDF via LLM vision** | Highest. Every page includes name, address, full account number and balances. | Good on clean PDFs. Long statements need many calls and checks that totals add up. | Highest | Medium | Lunch Money avoids this by sending PDFs to a converter partner that keeps files 24 h, which is another processor to disclose. BudgetBakers does it only through the user's own AI client (MCP). |
| **E2. PDF via deterministic text extraction plus per-bank layouts** | None | Exact for supported banks, and fragile when a bank changes its layout | Zero | High | Could later be combined with A: AI sees a masked line sample only. |
| **F. Explicit opt-in toggle with a plain-language notice** | Not an option in itself. It is a wrapper for A, C or E1. | — | — | Small | Gives a clear s.129 consent basis and matches the draft AI framework's notice expectations. |

**Least compliance burden:**

1. **B** needs nothing beyond the baseline.
2. **A** adds nothing material, because it sends less than today's flows.
3. **C** needs ZDR and a notice line, both of which are needed anyway.
4. **E1** needs everything above plus a strong case for sending full statements. Defer it.

## How competitors do it

From a sub-agent's reading of each app's own pages on 2026-11-18. "Snippet" means the page refused fetching and only search text was seen.

| App | AI provider named | Training and retention promise | Import |
| --- | --- | --- | --- |
| Monarch | OpenAI powers "AI Services" ([privacy](https://www.monarch.com/privacy)) | Nothing on training in the policy. The help page (snippet only) says providers are contractually barred from training. | CSV |
| Copilot Money | Not named. "We or our vendors may use… large language models" ([privacy](https://www.copilot.money/privacy-policy)) | Vendors "do not train their artificial intelligence models with your information". Categorisation is an in-house model per user ([dispatch](https://www.copilot.money/dispatch)). | No general CSV import found |
| YNAB | Not named. AI is used "to categorize transactions, improve merchant name clarity" ([privacy](https://ynab.com/privacy-policy), 9 Apr 2026) | The support chatbot vendor does not train on data | Deterministic CSV, OFX and QIF mapping. Settings are remembered per account. Files are processed on the server and not kept ([guide](https://support.ynab.com/en_us/file-based-import-a-guide-Bkj4Sszyo.md)). |
| Lunch Money | No AI in the policy ([privacy](https://lunchmoney.app/privacy)) | — | CSV is parsed on the client with auto-mapping from header names. PDF goes to Bank Statement Converter, which keeps it 24 h ([CSV help](https://support.lunchmoney.app/importing-transactions/import-via-csv)). |
| Cleo | ChatGPT (snippet only, UK policy) | Defers to OpenAI's terms | — |
| Emma | None in the policy ([privacy](https://emma-app.com/privacy)) | — | — |
| Rocket Money | Rowan built "in partnership with Anthropic" ([Rowan](https://www.rocketmoney.com/learn/personal-finance/what-is-rowan)) | Nothing stated on training or retention | — |
| Wallet by BudgetBakers | OpenAI for receipt and document OCR ([privacy](https://budgetbakers.com/en/privacy), 1 Apr 2026, s.3.2) | "not used for training" | PDF and CSV through the user's own AI client over MCP ([MCP](https://budgetbakers.com/en/products/wallet/integrations/mcp/)) |
| Cashew | Gemini or Apple Intelligence for AI entry ([FAQ](https://cashewapp.web.app/faq.html)) | No central server | CSV with a column picker |

**Patterns:**

- The usual disclosure is one line that names the vendor and promises no training. None states the provider's retention period.
- No app offers an AI-specific opt-out.
- Every import that could be read uses deterministic column mapping. PDF is either unsupported, outsourced, or done by an LLM the user brings.
- Moni can match the industry norm with a short notice and ZDR.

## Launch checklist

Most of these are needed for launch **regardless** of AI import.

- [ ] Set `provider.zdr: true` in `apps/backend/internal/llm/client.go` and turn on ZDR in OpenRouter's privacy settings. Note it in `docs/AI.md`.
- [ ] Write a privacy notice in Malay and English (s.7) covering:
  - what is collected: account, transactions, notification text, receipt photos, voice, location for places
  - purposes
  - processors and countries: Supabase (region to confirm), Google Cloud Run in Thailand, OpenRouter in the US and its upstream hosts, Google Places
  - that AI providers do not train on or keep the data
  - whether supplying the data is voluntary
  - retention
  - rights to access, correct, delete and port
  - a contact
- [ ] Capture consent at sign-up: a checkbox, the notice version and a timestamp, stored per user. Include explicit consent to transfers abroad as the s.129 basis. Capture parental consent, or set an 18+ age gate.
- [ ] Add in-app account deletion and a web deletion link, as Play requires. Delete Supabase rows and storage objects. State any backup lag in the notice.
- [ ] Keep a processor and transfer register (s.129 records) listing Supabase, Google Cloud, OpenRouter, the upstream class, and Google Places, with links to each DPA.
- [ ] Write a retention schedule:
  - ledger: until the user deletes it
  - receipt images: state the period
  - AI requests: not stored by Moni, and ZDR upstream
  - backups: per Supabase
- [ ] Write a breach plan: who decides, the 72-hour notice to the Commissioner, user notice within 7 days, and a register kept 2 years.
- [ ] Write a one-page DPIA note for the AI features. It is optional at this scale, but it is cheap.
- [ ] Before AI import ships: add option A or C behind a notice line. Keep PDF statements out.

## Open questions

1. Which Supabase region is the project in? It is not stated in `docs/`. It is another s.129 transfer if the region is outside Malaysia.
2. **Lawyer:** is a budgeting app outside the classes that must register under PDPA?
3. **Lawyer:** does reading payment notifications count as "regular and systematic monitoring" for the DPO threshold?
4. **Lawyer:** which s.129 basis is best: consent, contract necessity, or the OpenRouter DPA as due diligence? Does the OpenRouter DPA cover self-serve accounts? The support article that says it is for enterprise only could not be read (403).
5. Has the AI and personal data framework been finalised since its consultation closed on 23 October 2026?
6. Which Malaysian banks give CSV transaction history, and which give PDF only? This decides whether option B covers most users without PDF support.
