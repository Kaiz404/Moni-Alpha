# Data retention schedule

How long each kind of personal data is kept, and what deletes it. The privacy policy states the same in "How long we keep it" ([`../legal/privacy.en.md`](../legal/privacy.en.md)).

Two mechanisms do all deletion today:

- **Soft delete.** Synced rows get `deleted = true` so every device learns of the delete. The row stays in Postgres.
- **Account deletion.** The `delete-account` Edge Function empties the user's folder in the `receipts` bucket, then deletes the Auth user. Every table that references `auth.users` does so `ON DELETE CASCADE`, so all the user's rows go with it. Profile › Delete your account, web Settings › Delete your account and the public `/delete-account` page all call it.

There is no server-side job that hard-deletes anything on a schedule.

| Data | Where | Kept for | What removes it | Source |
| --- | --- | --- | --- | --- |
| Account: email, password hash, name, Google profile, birth month | Supabase Auth, `profiles` | While the account exists | Account deletion | `supabase/functions/delete-account` |
| Ledger: wallets, transactions, categories, tags, budgets, debts and debt payments, bills, rules, merchant names | Postgres | While the account exists, deleted rows included | Soft delete hides a row; account deletion removes it | `packages/data`, migrations |
| Captures in Review, with alert title and text, typed text, AI reasoning | `proposed_transactions` | Reviewed: shown 30 days, soft-deleted by the phone after 90 days, then kept until account deletion | Phone's daily prune (`pruneReviewHistory`, 90 days); account deletion | `apps/mobile/lib/supabase/proposed-transactions.ts`, `packages/core/src/read-model/review-inbox.ts` |
| Alert text on an auto-added or approved transaction | `transactions.metadata.alert` | While the transaction exists | Account deletion | `docs/AI.md` |
| Receipt photos | Storage bucket `receipts` (private) | Until account deletion, even after the transaction is deleted | Account deletion only | `apps/mobile/lib/receipts/images.ts` |
| Google place coordinates | `transactions.location_latitude`, `location_longitude`, `place_coords_at` | 30 days, refreshed after 25; the place ID stays | Phone app on foreground, up to 20 rows a run (Google Maps terms) | `apps/mobile/lib/places/refresh-coords.ts` |
| Phone location on a transaction | `transactions.location_*` | While the transaction exists | Account deletion | `apps/mobile/lib/ai/run-extraction.ts` |
| AI consent history | `ai_consents` (append only) | While the account exists | Account deletion | `supabase/migrations/20261119120000_ai_consents.sql` |
| QR sign-in requests: hashed IP, browser label | `qr_sign_ins` | Until used, or 10 minutes; expired rows are swept on the next QR start | `qr-poll` on use; `qr-start` sweep | `supabase/functions/qr-start`, `qr-poll`, `_shared/qr.ts` |
| AI requests (alert text, sentences, receipt photos, chat questions) | Gateway memory, OpenRouter, model providers | Only while answering (ZDR) | Not stored | `apps/backend/internal/llm/client.go` |
| AI traces: user ID, route, timings, cost, errors, alert app | Langfuse (JP) | **[CONFIRM: plan or project retention]** | Langfuse retention setting | `apps/backend/internal/tracing` |
| Gateway request logs: IP, user agent, path, status, time | Google Cloud Logging | **[CONFIRM: `_Default` bucket retention; Google's default is 30 days]** | Cloud Logging retention | `apps/backend/cmd/server/router.go` (`gin.Logger`), Cloud Run |
| Web hosting logs | Vercel | **[CONFIRM: Vercel plan log retention]** | Vercel | — |
| Database backups | Supabase | **[CONFIRM: depends on the plan; the project is on the free tier per `docs/ARCHITECTURE.md`, and Pro keeps 7 days of daily backups]** | Supabase backup rotation | — |
| Moni chat threads, capture log, settings cache | Phone (MMKV) | Until the app is uninstalled or the user clears them | Uninstall; signing out clears the capture queue | `apps/mobile/lib/ai/chat/messages.ts`, `lib/notifications/capture-health.ts` |
| Breach register | Outside the product | At least 2 years | Owner | [`breach-plan.md`](breach-plan.md) |

## Gaps to decide before launch

- Soft-deleted rows and reviewed captures with alert text stay on the server until account deletion. PDPA s.10 says data must not be kept longer than its purpose needs. A scheduled hard delete of rows soft-deleted more than a set time ago (for example 90 days, after every device has synced) would close this. It needs a product decision and a migration.
- A receipt photo outlives its deleted transaction. Deleting the object when the transaction is deleted would close this.
- The QR sign-in sweep runs only when someone starts a QR sign-in. A daily `pg_cron` delete of expired rows would bound it.
- Map coordinates older than 30 days stay until the phone app opens. The web never refreshes them.
