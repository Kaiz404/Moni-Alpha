# International compliance research (November 2026)

This page answers one question for Moni: what does it take to launch worldwide (Malaysia first, then the US and everywhere else) on the App Store, Google Play and the web, when the app sends people's financial data to AI models?

It is research, not legal advice. It was done on 2026-11-18 from the primary sources linked in each line, and laws and store rules change. Malaysia's PDPA and the design options for AI in import are covered in [`import-ai-compliance-2026-11.md`](import-ai-compliance-2026-11.md); this page does not repeat them.

Code observations on this page describe commit `ddaeebb`.

## Summary in plain words

- **The app stores are the real day-one gate, not foreign laws.** Apple and Google already enforce most of what GDPR and US law would ask of an app Moni's size: a privacy policy, consent before data leaves the phone, a true account-delete button, and honest data labels. Apple now names third-party AI in its rule: you must say data goes to an AI provider and get explicit permission first ([Apple 5.1.2(i)](https://developer.apple.com/app-store/review/guidelines/), [Apple notice, 13 Nov 2025](https://developer.apple.com/news?id=ey6d8onl)).
- **Google Play has no special form for notification access, but the general rules bite hard.** Reading other apps' notifications in the background and sending them to a cloud AI is exactly the "outside user expectations" case that needs an in-app prominent disclosure and an affirmative tap ([Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)). Moni already has a disclosure sheet; it needs a little more detail (see [Google Play](#google-play)).
- **Moni is missing in-app account deletion.** Both stores require it. The Profile screen's "Privacy and data" section has Permissions and Capture log only (`apps/mobile/app/profile.tsx`).
- **The AI provider settings are the biggest data-handling gap.** The backend sets neither `zdr` nor `data_collection: "deny"`, so OpenRouter may route a request to a host that keeps or trains on it. The sibling page has the endpoint check and the fix.
- **GDPR applies the day Moni is offered to people in the EU or UK.** There is no size threshold. The practical extra costs are an EU and a UK representative, a short record of processing, a DPIA note, and transfer contracts with each processor.
- **Most US laws do not reach Moni at launch.** State privacy laws start at 100,000 residents or US$25M revenue. The FTC can still punish any app whose privacy promises are false. The one open US question is whether the FTC would call a budgeting app a "financial institution" under GLBA; at fewer than 5,000 users the heaviest parts are waived anyway.
- **Apple has a structural risk.** Its guidelines say finance apps "should be submitted by a legal entity … and not by an individual developer." Enrolling as an organization needs a registered company and a D-U-N-S number ([Apple enroll](https://developer.apple.com/programs/enroll/)).
- **No money moves, so payments, open banking and money-transmitter rules do not apply,** and no lending or advice means the EU AI Act's credit-scoring high-risk category does not either. The AI Act's chatbot rule does: tell users Moni chat is an AI.

## What Moni does with data

| Data | Where it goes | Source |
| --- | --- | --- |
| Account (email), wallets, transactions, budgets, debts, place names and coordinates | Supabase (Postgres, auth, storage). The region is not stated in `docs/`. The DPA is with Supabase Pte. Ltd. (Singapore) and includes EU SCCs and the UK Addendum | [Supabase DPA](https://supabase.com/legal/dpa) |
| Bank and e-wallet notification text (after on-device filtering; one-time codes dropped), typed text, voice transcripts, receipt photos, chat questions with computed facts | Go backend on Cloud Run `asia-southeast3` (Bangkok), stateless, then OpenRouter (US) and an upstream model host | `apps/backend/README.md`, [`docs/AI.md`](../AI.md), [OpenRouter privacy](https://openrouter.ai/privacy) |
| Voice | Transcribed on-device when the phone supports it (`requiresOnDeviceRecognition`), else by the platform's speech service | `apps/mobile/lib/speech/speech-recognition.ts` |
| Place search text | Backend proxy to Google Places; nothing stored | [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Analytics, ads, crash SDKs | None found in `apps/mobile` or `apps/web` dependencies | `package.json` files |

Financial data is not a GDPR "special category" ([Art. 9(1)](https://gdpr-info.eu/art-9-gdpr/)), but transaction lists can reveal one (a clinic, a church, a union). California counts "financial account" data as sensitive ([CA AG](https://oag.ca.gov/privacy/ccpa)), and the Irish regulator lists financial data among the "sensitive" signals for a DPIA ([DPC](https://www.dataprotection.ie/en/organisations/know-your-obligations/data-protection-impact-assessments)).

## Applicability table

| Law | Applies to Moni? | Why | Main obligations | Trigger thresholds |
| --- | --- | --- | --- | --- |
| **US: FTC Act s.5** (unfair or deceptive practices) | Yes, once US users exist | No size floor. The FTC treats broken privacy promises as deception; Flo was ordered to get consent before sharing and to have third parties destroy data ([TechCrunch on FTC v. Flo](https://techcrunch.com/2021/01/13/flo-gets-ftc-slap-for-sharing-user-data-when-it-promised-privacy/)). Quietly widening a privacy policy, for example to allow AI training, "may be unfair or deceptive" ([FTC, Feb 2024](https://www.ftc.gov/policy/advocacy-research/tech-at-ftc/2024/02/ai-other-companies-quietly-changing-your-terms-service-could-be-unfair-or-deceptive)) | Say exactly what happens to data, then do only that. Give notice and get consent before any more permissive change | None |
| **US: GLBA Safeguards Rule** (16 CFR 314) | Unclear; plan as if yes | It covers any business "significantly engaged" in activities "financial in nature" under the Bank Holding Company Act ([314.2](https://www.law.cornell.edu/cfr/text/16/314.2)). That list includes data processing of "financial, banking or economic" data and financial-management education for consumers ([12 CFR 225.28](https://www.law.cornell.edu/cfr/text/12/225.28)). The FTC's examples do not mention budgeting apps ([FTC guide](https://www.ftc.gov/business-guidance/resources/ftc-safeguards-rule-what-your-business-needs-know)) | A named person responsible, encryption in transit and at rest, MFA for system access, access logs, vendor oversight, training ([314.4](https://www.law.cornell.edu/cfr/text/16/314.4)). Report a breach of 500+ people's unencrypted data to the FTC within 30 days | Under 5,000 consumers: no written risk assessment, pen testing, written incident plan or annual report ([314.6](https://www.law.cornell.edu/cfr/text/16/314.6)) |
| **US: GLBA Privacy Rule** | Same question as above | Same definition | Privacy notice; opt-out before sharing with non-affiliated third parties outside service-provider exceptions | Same |
| **US: CCPA/CPRA** (California) | No at launch | For-profit businesses with revenue over $25M, or that buy, sell or share data of 100,000+ Californians, or get half their revenue from selling it ([CA AG](https://oag.ca.gov/privacy/ccpa)). New ADMT and risk-assessment rules were finalised Sept 2025 for covered businesses ([CPPA](https://cppa.ca.gov/regulations/)) | If covered: notice at collection, access, delete, correct, opt out of sale/share, limit sensitive data use | Any one of the three thresholds |
| **US: Virginia, Colorado and similar state laws** | No at launch | Virginia: 100,000 residents' data a year, or 25,000 plus over 50% of revenue from selling data. Data subject to GLBA is exempt ([Va. Code 59.1-576](https://law.lis.virginia.gov/vacode/title59.1/chapter53/section59.1-576/)). Most states copy this model | Similar rights to CCPA | 100,000 (or 25,000 + data sales) per state |
| **US: Texas TDPSA** | Only if Moni sold sensitive data | Small businesses are exempt, except they "may not engage in the sale of personal data that is sensitive data without receiving prior consent" ([s.541.107](https://texas.public.law/statutes/tex._bus._and_com._code_section_541.107)) | Never sell data | None for this clause |
| **US: CFPB s.1033** (personal financial data rights) | No | It obliges banks ("data providers") to share data with consumers and "authorized third parties" ([CFPB](https://www.consumerfinance.gov/personal-financial-data-rights/)). Moni pulls no bank data. The rule is under reconsideration (ANPR, Aug 2025) | None for Moni. Matters only if Moni adds bank-account linking | — |
| **US: COPPA** | Only if Moni knowingly collects from under-13s | It covers general-audience services "with actual knowledge" of collecting from children. A neutral age screen asks for birth month and year without hinting at the right answer ([FTC FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)) | Block or delete under-13 accounts when you learn of them | Actual knowledge |
| **US: money transmitter laws** | No | Federal and state definitions turn on accepting money and transmitting it ([31 CFR 1010.100(ff)(5)](https://www.law.cornell.edu/cfr/text/31/1010.100)). Moni never touches funds | — | — |
| **EU GDPR** | Yes, from the first EU user Moni offers the app to | Art. 3(2): applies to a non-EU controller offering goods or services to people in the Union, paid or free ([Art. 3](https://gdpr-info.eu/art-3-gdpr/)) | Lawful basis ([Art. 6](https://gdpr-info.eu/art-6-gdpr/)), notice, rights, processor contracts ([Art. 28](https://gdpr-info.eu/art-28-gdpr/)), transfer safeguards, breach notice to a regulator within 72 hours and a log of every breach ([Art. 33](https://gdpr-info.eu/art-33-gdpr/)), DPIA when high risk, EU representative | No size threshold |
| **EU representative** (Art. 27) | Probably yes | The exemption needs processing that is "occasional" and low-risk ([Art. 27](https://gdpr-info.eu/art-27-gdpr/)). Moni processes continuously | Name a representative in an EU country where users are, in writing, and list it in the privacy policy | Exemption unlikely to fit |
| **Record of processing** (Art. 30) | Yes | The under-250-staff exemption is lost when processing "is not occasional" ([Art. 30](https://gdpr-info.eu/art-30-gdpr/)) | A short table: purposes, data, recipients, transfers, retention, security | — |
| **DPIA** (Art. 35) | Advisable | Two or more WP29 criteria make one expected. Moni meets at least two: financial data and innovative technology (AI), plus transfers outside the EU ([DPC](https://www.dataprotection.ie/en/organisations/know-your-obligations/data-protection-impact-assessments)) | A written assessment of risks and mitigations, or written reasons for skipping | Two criteria |
| **Transfers out of the EU** | Yes | Data goes to the US (OpenRouter), Thailand (Cloud Run) and Supabase's region. The EU–US Data Privacy Framework covers certified US companies ([European Commission](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/eu-us-data-transfers_en)). OpenRouter's policy relies on SCCs and does not name the DPF ([OpenRouter privacy](https://openrouter.ai/privacy)); Supabase's DPA includes SCCs ([Supabase DPA](https://supabase.com/legal/dpa)) | Accept each processor's DPA with SCCs; keep a transfer list | — |
| **EU AI Act** | Lightly | Not high-risk: Annex III 5(b) covers AI to "evaluate the creditworthiness … or establish their credit score" ([Annex III](https://artificialintelligenceact.eu/annex/3/)); Moni does neither. Art. 50(1) requires that people are told they are "interacting with an AI system" unless obvious ([Art. 50](https://artificialintelligenceact.eu/article/50/)). Applies from 2 Aug 2026; the Digital Omnibus delayed high-risk rules to Dec 2027 but not chatbot disclosure ([Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/)) | Label Moni chat and AI-drafted proposals as AI | In force |
| **EU PSD2 / UK PSRs** (open banking) | No | An "account information service" is an online service giving consolidated information on payment accounts "held … with another payment service provider" ([UK PSRs 2017 reg. 2](https://www.legislation.gov.uk/uksi/2017/752/regulation/2)). Moni reads notifications on the user's own phone, not accounts | None | Becomes relevant if Moni ever links bank accounts |
| **UK GDPR** | Yes, as for the EU | Same structure, including a UK representative under Art. 27 with the same "occasional" exemption ([UK GDPR Art. 27](https://www.legislation.gov.uk/eur/2016/679/article/27)) | As GDPR, plus a UK representative | — |
| **Singapore PDPA** | Yes, once Singapore users exist | Covers organisations collecting data in Singapore without local presence ([DLA Piper: SG](https://www.dlapiperdataprotection.com/index.html?t=law&c=SG)) | Appoint a DPO with public contact details; notify the PDPC within 3 days of assessing a breach that is significant or hits 500+ people; transfers need "comparable protection" | No size threshold |
| **Australia Privacy Act** | Probably not at launch | Applies to private entities with turnover of AUD 3M or more ([DLA Piper: AU](https://www.dlapiperdataprotection.com/index.html?t=law&c=AU)) | If covered: APPs, notifiable breaches; privacy policies must describe substantially automated decisions from 10 Dec 2026 | AUD 3M turnover |
| **Canada PIPEDA** (and Quebec Law 25) | Yes, for Canadian users | Covers personal information handled in commercial activity, including cross-border ([OPC](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/pipeda_brief/)). Quebec requires opt-in for profiling and incident logs ([DLA Piper: CA](https://www.dlapiperdataprotection.com/index.html?t=law&c=CA)) | Meaningful consent; tell users data may go abroad; report breaches with "real risk of significant harm" and log all incidents | No size threshold |
| **India DPDP Act 2023** | Yes, from May 2027 | Applies to foreign entities offering goods or services to people in India; a child is anyone under 18 ([DLA Piper: IN](https://www.dlapiperdataprotection.com/index.html?t=law&c=IN)). Main duties apply from 13 May 2027 ([AZB](https://www.azbpartners.com/bank/update-indias-digital-personal-data-protection-framework-comes-into-effect/)) | Itemised notice; specific consent; verifiable parental consent for children; breach notice to the Board and users, details within 72 hours; erase on withdrawal | No size threshold |
| **Indonesia PDP Law** (Law 27/2022) | Likely, for Indonesian users; scope for foreign apps not confirmed in the source read | In force since 17 Oct 2024 ([DLA Piper: ID](https://www.dlapiperdataprotection.com/index.html?t=law&c=ID)) | Lawful basis; notify users and the agency within 72 hours of a breach; transfers need equal protection, safeguards or consent | No size threshold |

## App store requirements

### Apple App Store

From the [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/):

- **5.1.1(i) Privacy policy.** A link in App Store Connect and inside the app. It must list what is collected and every use, confirm that third parties give equal protection, and explain retention, deletion and how to withdraw consent.
- **5.1.1(ii) Consent.** Apps must get consent to collect user data, give an easy way to withdraw it, and must not make paid features depend on granting it.
- **5.1.1(v) Account deletion.** An app with account creation must let people start deletion inside the app. Deleting means the whole account record and its personal data; deactivation alone fails. A website step is allowed if the app links straight to it ([Apple deletion guide](https://developer.apple.com/support/offering-account-deletion-in-your-app/)).
- **5.1.2(i) Third-party AI.** "You must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so." Added 13 Nov 2025 ([Apple notice](https://developer.apple.com/news?id=ey6d8onl)).
- **5.1.1(ix) and 3.2.1(viii) Who submits.** Apps in "banking and financial services" or that "require sensitive user information should be submitted by a legal entity … and not by an individual developer." Apps "used for financial trading, investing, or money management should be submitted by the financial institution". A budgeting app that moves no money is a grey area, and a rejection on this ground is possible. An organization account needs a legal entity and a D-U-N-S number; sole proprietors enroll as individuals ([Apple enroll](https://developer.apple.com/programs/enroll/)).
- **App Privacy labels.** Declare everything you or third parties collect. "Collect" means sent off the device and kept longer than needed to answer the request in real time. Financial types include "Other Financial Info: salary, income, assets, debts" ([App privacy details](https://developer.apple.com/app-store/app-privacy-details/)). Moni would declare at least email, Other Financial Info, photos (receipts), audio-derived text if not on-device, coarse or precise location, and user content.
- **3.1.2 Subscriptions** (later): describe clearly what the subscription gives before asking people to pay.

### Google Play

- **Privacy policy.** A link in Play Console and in the app, on a public, non-geofenced page, not a PDF ([User Data](https://support.google.com/googleplay/android-developer/answer/10144311)).
- **Prominent disclosure and consent.** Required when collection is outside what users expect, such as background collection. It must be in the app during normal use, not only in settings or the privacy policy; it must say what data and how it is used or shared; consent needs an affirmative tap, and backing out is not consent ([User Data](https://support.google.com/googleplay/android-developer/answer/10144311)). Play says these rules "also apply to third-party AI integrations."
- **Account deletion.** A readily discoverable option inside the app and outside it (a web link), and deleting the account must delete its data ([User Data](https://support.google.com/googleplay/android-developer/answer/10144311)).
- **Data safety form.** Data sent off the device is "collected". A processor acting on your behalf is not "sharing". Data held only in memory for the request can count as ephemeral ([Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)). OpenRouter with ZDR fits the processor exemption; a host that may train does not.
- **Financial features declaration.** Every app must complete it, even with "My app doesn't provide any financial features." The categories cover loans, payments, trading, credit monitoring, advice, insurance and "Other"; budgeting is not listed ([declaration help](https://support.google.com/googleplay/android-developer/answer/13849271)). The loan and earned-wage rules do not apply to Moni ([Financial Services](https://support.google.com/googleplay/android-developer/answer/9876821)).
- **AI-generated content.** Text chatbots where chatting "is a central feature" need an in-app way to report offensive output ([AI-generated content](https://support.google.com/googleplay/android-developer/answer/13985936)). Moni chat is a pushed page, not the core, so this is borderline; a "Report reply" action is cheap.
- **New personal developer accounts** need a closed test with 12 testers opted in for 14 days before production ([Play testing](https://support.google.com/googleplay/android-developer/answer/14151465)).

#### Notification access (critical for Moni)

- **No declaration form found.** The 2026 "Permissions and APIs that Access Sensitive Information" policy lists declaration forms for SMS and Call Log, All Files, Accessibility, Photos and Video, exact alarms and others. It does not mention notification access or `BIND_NOTIFICATION_LISTENER_SERVICE` ([Permissions policy](https://support.google.com/googleplay/android-developer/answer/9888170)). It does say apps may request only permissions that are "necessary". The SMS permission route, which many expense trackers in other markets use, is the declaration-gated one; Moni avoids it.
- **What governs it instead.** The User Data prominent-disclosure rules above. Reading every notification on the phone in the background and sending payment alerts to a cloud AI is the textbook case.
- **Moni's current disclosure.** `askForNotificationAccess` shows a sheet "Let Moni read alerts?" with "One-time codes never leave this phone, and other payment alerts from the apps you link go to a cloud AI model that reads them," and an affirmative "Open settings" (`apps/mobile/lib/notifications/permission.ts`). That meets the shape. Gaps against the policy text: it does not say the alerts are stored as transactions in Moni's cloud database, does not say Moni can see all notifications but filters on the phone, and does not link the privacy policy.
- **Android itself narrows what Moni sees.** Since Android 15, notifications with two-factor codes reach ordinary listeners as "sensitive notification content hidden" ([Android Authority](https://www.androidauthority.com/android-15-two-factor-authentication-codes-3492585/)). That supports Moni's claim that codes never leave the phone, but Moni's own filter must stay because older Android versions still deliver them.
- **Reviewer risk.** A reviewer who cannot see the feature may reject it. Put the access flow and a demo video in the review notes, and make the store listing describe the feature.

## AI disclosure requirements

What every market and both stores converge on:

1. **Say it in the moment.** Before the first AI-powered capture (notification, receipt, voice or chat), show what is sent, to whom (a named AI gateway in the US and its model hosts), why, and that the providers do not train on or keep it. Apple requires explicit permission for third-party AI; Play requires an affirmative tap for background collection. A privacy-policy line alone satisfies neither.
2. **Opt-in, not notice, for AI.** Under GDPR, AI extraction for a feature the user turns on fits "performance of a contract" ([Art. 6(1)(b)](https://gdpr-info.eu/art-6-gdpr/)), but Apple and Quebec both want explicit opt-in, so one opt-in screen per capture source covers all three.
3. **Keep manual entry working without AI.** Apple forbids making paid features depend on granting data access (5.1.1(ii)).
4. **Contract and settings.** Accept OpenRouter's DPA, turn on account-wide ZDR, and send `provider.zdr: true` on every request. OpenRouter stores no prompts by default, but `data_collection` defaults to `"allow"`, which permits hosts that "store data and may train on it" ([provider routing](https://openrouter.ai/docs/guides/routing/provider-selection), [ZDR](https://openrouter.ai/docs/guides/features/zdr), [data collection](https://openrouter.ai/docs/guides/privacy/data-collection)). Endpoint-by-endpoint findings are in [`import-ai-compliance-2026-11.md`](import-ai-compliance-2026-11.md#provider-data-handling).
5. **Label AI output.** Moni chat must say it is an AI (EU AI Act Art. 50). AI-drafted proposals are already reviewed by the user; label routine auto-added rows as AI-added, which Moni does ("Auto").
6. **Never widen silently.** If Moni ever trains models, adds a provider that keeps data, or uses data for anything new, notify users and get fresh consent first (FTC, Feb 2024).

## Staged launch checklist

### Day one, for any store launch in any country

- [ ] Privacy policy on a public web page, linked in both stores and in the app. One document covering PDPA, GDPR/UK GDPR, CCPA-style rights and PIPEDA: what is collected, purposes, lawful basis per purpose, processors and countries, retention, rights and how to use them, contact, children, changes. Add GDPR-specific lines (representative, regulator complaint right) when EU users start.
- [ ] Terms of service: no financial advice, AI output may be wrong and the user reviews it, acceptable use, subscription terms later, governing law (Malaysia), limitation of liability.
- [ ] In-app account deletion that removes Supabase rows and storage objects, plus a web deletion page for Play.
- [ ] AI opt-in screen per capture source naming the AI gateway; extend the notification-access sheet (stored in Moni's cloud, filtered on the phone, policy link).
- [ ] OpenRouter: ZDR in account settings and per request; accept its DPA. Accept Supabase's and Google Cloud's DPAs.
- [ ] Processor list (public, in or linked from the policy): Supabase, Google Cloud (Cloud Run, Places, Maps), OpenRouter and its model hosts, Apple/Google for push and billing.
- [ ] Confirm the Supabase region and write it in `docs/SETUP.md`.
- [ ] Age gate: neutral birth month and year at sign-up; refuse under-13s everywhere (COPPA) and decide on 13–17 (GDPR lets countries set 13–16 for consent, [Art. 8](https://gdpr-info.eu/art-8-gdpr/); India counts under-18s as children). The simplest rule is 18+.
- [ ] App Privacy labels, Data safety form and Financial features declaration filled to match the policy.
- [ ] Moni chat labelled as AI.
- [ ] Security basics that also satisfy a GLBA reading: MFA on every admin console (Supabase, Google Cloud, OpenRouter, GitHub, store consoles), encryption in transit and at rest (Supabase default), least-privilege keys, secrets in Secret Manager.
- [ ] One-page breach plan: who decides, how to tell users, the 72-hour regulator clocks (GDPR, Malaysia, India), Singapore's 3 days, the FTC's 30 days at 500+ US users, and a breach log.
- [ ] Decide the Apple account type: register a company (for example a Sdn Bhd) and enroll as an organization, or accept the 5.1.1(ix) rejection risk on an individual account.

### Before marketing to the EU or UK

- [ ] Appoint an EU representative and a UK representative (Art. 27).
- [ ] Record of processing (one table) and a short DPIA for the AI capture features.
- [ ] Transfer list: each processor, country, mechanism (SCCs or DPF).
- [ ] Web app: only strictly necessary auth cookies today, which need no consent; add a consent banner before any analytics or tracking cookie ([Your Europe](https://europa.eu/youreurope/business/dealing-with-customers/data-protection/online-privacy/index_en.htm)).

### At thresholds

| Trigger | Add |
| --- | --- |
| First paying subscribers | Subscription terms in the ToS and paywall (Apple 3.1.2) |
| 5,000 US users | If treating GLBA as applicable: written risk assessment, written incident plan, annual pen test or continuous monitoring, annual written report |
| Singapore users | Name a DPO with public contact details (can be you) |
| 100,000 residents of a US state, or US$25M revenue | State privacy law compliance (CCPA and others) |
| AUD 3M turnover | Australia Privacy Act |
| May 2027, with Indian users | DPDP notice and consent format; parental consent for under-18s |
| Any bank-account linking or money movement | Fresh legal review: CFPB 1033, PSD2/UK PSRs, money transmission, Apple 3.2.1(viii) |

## Tools and templates

Solo developers commonly use generated policies and consent banners from services such as [Termly](https://termly.io), [iubenda](https://www.iubenda.com) or [TermsFeed](https://www.termsfeed.com). They give a usable first draft; none knows about notification capture or AI routing, so those sections need writing by hand.

## When to pay a lawyer

- **Before launch, a fixed-fee review** of the privacy policy, ToS, consent screens and processor list by a privacy or tech lawyer. A Malaysian firm with a data-protection practice can cover PDPA and give a GDPR view. Ask for a fixed quote; pricing varies too much to state from public sources.
- **Before EU marketing**, a GDPR-focused review if the EU becomes a real market.
- **Before any money movement, lending or bank linking**, a fintech regulatory lawyer in each target market.

## Open questions for a lawyer

1. Would the FTC treat Moni as a GLBA "financial institution" ("data processing" of financial data, or financial-management education)? If yes, is the Privacy Rule notice needed at launch?
2. Is Moni "money management" under Apple 3.2.1(viii), and does 5.1.1(ix) require an organization account for a budgeting app that moves no money?
3. Does reading payment notifications on the user's own phone fall outside the UK and EU definitions of an account information service?
4. Is the Art. 27 "occasional" exemption ever available to Moni, or should representatives be appointed before the first EU and UK user?
5. Which lawful basis should cover AI extraction under GDPR: contract or consent? Does one opt-in screen also satisfy Apple 5.1.2(i), Quebec and PDPA?
6. Which age floor works everywhere: 13, 16 or 18?
7. Does OpenRouter's self-serve DPA cover Moni, and is SCCs-only acceptable for EU transfers given it does not cite the DPF?
8. Does Indonesia's PDP Law reach an app with no Indonesian presence?
