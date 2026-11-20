# Eval dataset format

Each suite is one folder with `items.jsonl`: one JSON object per line, sorted by `id`. A build script under `evals/scripts/` writes it, so the file can be regenerated. The runner syncs each file to a Langfuse dataset (`moni/<suite>`) and sends `input` to the real backend endpoint.

```jsonc
{
  "id": "notif-chase-purchase-001",   // stable, unique, kebab-case; the Langfuse dataset item id
  "input": { ... },                    // the request body, see each suite
  "expected": { ... },                 // the gold answer; omit a field to leave it unscored
  "metadata": {
    "source": "synthetic-template",   // dataset or generator name
    "licence": "CC-BY-4.0",           // the data's licence, or "own" for ours
    "trainable": true,                // licence allows fine-tuning a commercial model
    "synthetic": true,                // generated rather than captured from real life
    "region": "US",                   // ISO country the item comes from, or "global"
    "tags": ["purchase", "card"]      // free slices to filter on
  }
}
```

## Shared wallets

`evals/datasets/wallets.json` holds one wallet list per region (`MY`, `SG`, `US`, `UK`, `IN`, `AU`, `CA`, `PH`): a bank account, an e-wallet, a credit card and cash, all in the local currency, with ids like `w-us-bank`, `w-us-ewallet`, `w-us-credit`, `w-us-cash`. Put the item's region list in `input.wallets` verbatim, so the backend sees the wallets a user in that country would have. The backend takes text and receipt currency from the resolved wallet, so the region's list decides the expected currency unless the input names another.

## Extraction suites: `text`, `receipts`, `notifications`

`expected` (every field optional except `status`):

| Field | Meaning |
| --- | --- |
| `status` | `"ok"` when the input is a transaction, `"skipped"` when it is not |
| `amount` | positive number, the total paid or received |
| `currency` | ISO 4217 code |
| `type` | `"expense"`, `"income"` or `"transfer"` |
| `merchant` | the merchant or counterparty as a person would name it; scored by fuzzy match |
| `date` | `YYYY-MM-DD`, only when the input states or implies a date and `input.clientNow` is set |
| `walletId` / `toWalletId` | ids from the shared wallets when the input names one |
| `itemCount` | receipts only: number of purchased items |

Inputs, matching the backend's wire contract (`apps/backend/internal/extract/types.go`):

- `text`: `{ "text": string, "wallets": [...], "clientNow": RFC3339, "timezone": IANA }`
- `notifications`: `{ "notification": { "packageName", "title", "text", "bigText"? }, "wallets": [...] }`
- `receipts`: `{ "image": "images/<file>.jpg", "userContext"?: string, "wallets": [...], "clientNow"?, "timezone"? }`. `image` is a path relative to the suite folder; the runner uploads it.

## Chat suite: `chat`

`input`: `{ "message": string, "snapshot": object, "history"?: [{ "role": "user"|"assistant", "content": string }] }`. The snapshot is the `finance_assistant_tool_v4` JSON the app sends.

`expected`: `{ "facts": [{ "currency", "path", "value" }], "refuse": boolean }`. `facts` pin snapshot values a correct reply must quote (path is relative to `snapshot.currencies[currency]`); `refuse` is true when the snapshot cannot answer or the question is out of scope.
