# Data breach plan

Use this page when personal data in Moni may have been read, changed, lost or deleted by someone who should not have. It follows Malaysia's breach notification guideline (25 February 2025), GDPR Art. 33 and 34, and the other clocks listed below.

## Who decides

- **Owner of the response:** **[CONFIRM: name]**, who runs Moni. This person decides whether to notify, writes the notices and keeps the register.
- **Backup:** **[CONFIRM: name, or "none"]**.
- **Contact the public sees:** **[CONFIRM: support email]**.

## Steps

1. **Contain it, within the hour.** Rotate the leaked key or password (Supabase secret key, OpenRouter key, Langfuse keys, Google Cloud service account), revoke sessions in Supabase Auth, stop public traffic to the gateway (`gcloud run services remove-iam-policy-binding moni-ai-backend --region asia-southeast3 --member allUsers --role roles/run.invoker`), or turn on the web maintenance page if the hole is there.
2. **Open a register entry.** Write the time you learned of it. Every clock below starts then.
3. **Find the scope.** Which tables, buckets or logs; how many users; which data types (see [`retention.md`](retention.md) for what each store holds). Check Supabase logs, Cloud Run logs and the processors' notices.
4. **Decide whether it is notifiable.** Notify when the breach is likely to cause significant harm. Under the Malaysian guideline that means any of:
   - financial loss,
   - misuse for illegal purposes,
   - sensitive data exposed,
   - data that together allows identity fraud,
   - for the Commissioner only: more than 1,000 people affected.

   A copy of Moni's database leaving Supabase meets at least the identity-fraud and scale tests at launch size. Record the reasoning either way.
5. **Notify the regulators** that apply, within their clocks (table below).
6. **Notify affected users** by email and in the app: what happened, what data, what Moni did, what they can do (change password, watch for phishing that quotes their transactions), and the contact.
7. **Fix the cause** and add a test or check that would have caught it.
8. **Close the register entry** with the outcome.

## Clocks

| Law | Who to tell | When | Trigger |
| --- | --- | --- | --- |
| Malaysia PDPA (s.12B, guideline of 25 Feb 2025) | Personal Data Protection Commissioner | As soon as practicable, within **72 hours** | Significant harm, or more than 1,000 people |
| Malaysia PDPA | Affected users | Within **7 days** after notifying the Commissioner | Significant harm |
| EU and UK GDPR Art. 33 | The lead supervisory authority, through the EU or UK representative | Within **72 hours** | Unless unlikely to result in a risk |
| EU and UK GDPR Art. 34 | Affected users | Without undue delay | High risk |
| Singapore PDPA | PDPC | Within **3 days** of assessing it as notifiable | Significant harm, or 500 or more people |
| India DPDP (from May 2027) | Data Protection Board and users | Details within **72 hours** | Any personal data breach |
| US FTC Safeguards Rule (if GLBA applies) | FTC | Within **30 days** | Unencrypted data of 500 or more people |

Processors must tell Moni promptly: Supabase, Google Cloud, OpenRouter (72 hours in its DPA) and Vercel do so under their DPAs. Their notice starts Moni's clocks.

## Breach register

Keep every incident, notifiable or not, for at least **2 years** (Malaysian guideline). Store it outside the systems it describes: **[CONFIRM: location, for example a private document]**.

| Field | Example |
| --- | --- |
| Number and date found | 2027-001, 2027-03-04 09:12 MYT |
| What happened | Secret key committed to a public repo |
| Data and people affected | All tables; 812 users |
| Harm assessment and reasoning | Identity fraud possible; notifiable |
| Notices sent, with times | Commissioner 2027-03-05 14:00; users 2027-03-08 |
| Containment and fix | Key rotated 09:40; secret scanning added |
| Closed | 2027-03-15 |
