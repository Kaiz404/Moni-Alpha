# Processors and cross-border transfers

Moni (the controller, **[CONFIRM: legal entity]**) uses the processors below. The privacy policy publishes the same list in "Where your data is kept and who helps us" ([`../legal/privacy.en.md`](../legal/privacy.en.md)). Add a processor here and in both policy languages before code sends it any data.

## Processors

| Processor | Service | What it receives | Where it processes | Agreement | Source in the repo |
| --- | --- | --- | --- | --- | --- |
| Supabase Pte. Ltd. | Postgres, Auth, Storage, Edge Functions | Everything stored: account, birth month, ledger rows, proposals with alert text, receipt photos, AI consent history, QR sign-in rows | Singapore (`ap-southeast-1`, project `yucjcjquwpwkgowzthhn`, confirmed with `supabase projects list` on 28 Nov 2026) | [Supabase DPA](https://supabase.com/legal/dpa), with EU SCCs and the UK Addendum. **[CONFIRM]** accepted | `supabase/` |
| Google LLC (Google Cloud) | Cloud Run hosting of the AI gateway `moni-ai-backend`; Cloud Build; Cloud Logging | Each AI request in memory (alert text, typed or spoken text, receipt photo, chat question with computed totals, wallet names); request logs with IP, user agent, path, status, time | Thailand (`asia-southeast3`, `cloudbuild.yaml`) | [Cloud Data Processing Addendum](https://cloud.google.com/terms/data-processing-addendum). **[CONFIRM]** accepted | `apps/backend`, `cloudbuild.yaml` |
| OpenRouter, Inc. | AI gateway to model providers | The same AI request, with `provider.zdr: true` and `data_collection: "deny"` on every call | United States | [OpenRouter DPA](https://openrouter.ai/data-processing-agreement). **[CONFIRM]** accepted, and account-wide ZDR turned on | `apps/backend/internal/llm/client.go` |
| Model providers on OpenRouter's zero-data-retention list (sub-processors of OpenRouter) | Run the model | The AI request; kept nothing after answering | Varies by provider | Through OpenRouter's DPA | `apps/backend/internal/llm/models.go` |
| Langfuse (Langfuse Cloud, JP region) | AI tracing and evals | Per request: Supabase user ID, route name, model, tokens, cost, status, errors, Cloud Run revision, the alert's Android package. Content (request, reply, receipt image) only when `LANGFUSE_CAPTURE_CONTENT` is on, which defaults to off in production | Japan (`https://jp.cloud.langfuse.com`, `apps/backend/internal/config/config.go`) | [Langfuse DPA](https://langfuse.com/security/dpa). **[CONFIRM]** accepted | `apps/backend/internal/tracing` |
| Google LLC (Google Maps Platform) | Places search through the backend; Maps SDK on Android; Maps JavaScript and Static Maps on the web | Search text and the phone's position as a 5 km bias; map tiles requested by the browser or phone | Global | [Google Maps Platform terms and data processing terms](https://cloud.google.com/maps-platform/terms). **[CONFIRM]** accepted | `apps/backend/internal/places`, `apps/web/src/lib/google-maps.ts` |
| Google LLC (Google Sign-In) | OAuth sign-in | Sign-in with Google; Google returns name, email and photo URL | Global | Google APIs Terms | `apps/mobile/lib/auth/google-signin.ts`, `supabase/config.toml` |
| Vercel Inc. | Hosting of the website and web app | Page requests (IP, user agent); the web app talks to Supabase and the gateway from the browser | Functions in Singapore (`sin1`), edge network global | [Vercel DPA](https://vercel.com/legal/dpa). **[CONFIRM]** accepted | `docs/SETUP.md` |

Not processors of user data: Expo (EAS builds only; no updates or push service), GitHub (source code), Google Play (distribution). Moni has no analytics, crash reporting or advertising SDK, and sends no remote push notifications.

## Record of cross-border transfers (PDPA s.129)

The Personal Data Protection (Amendment) Act 2024 removed the whitelist from 1 April 2025. Since then, a transfer needs one basis, written notice to users, a contract with the recipient, secure transfer, and a record. This table is the record. Each row holds for every user; Moni's users are in Malaysia first, so a transfer is any data leaving Malaysia.

| Recipient | Country | Data | Purpose | Basis relied on | Safeguards and evidence |
| --- | --- | --- | --- | --- | --- |
| Supabase | Singapore | All stored account and ledger data | Store and sync the user's records | Necessary for the contract with the user | Supabase DPA; TLS; encryption at rest; RLS per user. Evidence: DPA acceptance **[CONFIRM: date]** |
| Google Cloud | Thailand | AI requests in memory; request logs | Run the AI gateway | Necessary for the contract; consent per AI use (`ai_consents`) | Cloud DPA; TLS; no request body logged. Evidence: **[CONFIRM: date]** |
| OpenRouter | United States | AI requests | Route to a model | Explicit consent per AI use, recorded in `ai_consents` with notice version and time | OpenRouter DPA with SCCs; ZDR per request. Evidence: **[CONFIRM: date]**, ZDR setting screenshot |
| Model providers | Varies | AI requests | Read the capture or answer the question | As OpenRouter | ZDR list only, `data_collection: "deny"` |
| Langfuse | Japan | User ID and request metadata | Monitor and evaluate AI quality | Legitimate interest in a working service **[CONFIRM with the lawyer]** | Langfuse DPA; content capture off in production. Evidence: **[CONFIRM: date]** |
| Google Maps Platform | Global | Search text, position bias | Find places | Necessary for the contract (the user searches) | Google terms; nothing stored by Moni beyond the place ID and 30-day coordinates |
| Vercel | Singapore and global edge | Page requests | Serve the website and web app | Necessary for the contract | Vercel DPA; TLS |

Review this record when a processor, region or data type changes, and at least every 3 years (the validity of a transfer impact assessment under the April 2025 guideline).
