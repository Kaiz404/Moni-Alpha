# Moni AI Orchestrator – Architecture Documentation

## Overview

The Moni AI orchestrator is a unified pipeline that processes three types of input into **proposed transactions**. It runs entirely on-device using a Qwen 2.5 VL 3B vision-language model via `@react-native-ai/llama`, ensuring complete privacy.

All flows produce `proposed_transactions` records (never real transactions). Users review and approve/reject proposals through a full-screen modal on app open.

---

## Input Sources

| Source | Entry Point | When Triggered |
|--------|-------------|----------------|
| **Text input** | User types a transaction description in the chat tab | User presses send |
| **Image input** | User takes/picks a receipt photo in the chat tab | User presses send |
| **Push notification** | Android notification listener headless task | Notification received |

---

## Pipeline Architecture

```
                    ┌─────────────────────────────────────┐
                    │        Unified Processing Queue      │
                    │          (MMKV-backed)               │
                    │   Items: text / image / notification  │
                    └────────────────┬────────────────────┘
                                     │
                              ┌──────▼──────┐
                              │  Background  │
                              │  Processor   │
                              │ (Foreground  │
                              │  Service)    │
                              └──────┬───────┘
                                     │
                          ┌──────────▼──────────┐
                          │  Unified Orchestrator │
                          │  (orchestrator/)      │
                          └──────────┬───────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
     ┌────────▼────────┐   ┌────────▼────────┐   ┌────────▼────────┐
     │   Text Flow      │   │   Image Flow     │   │  Notification   │
     │  (text-flow.ts)  │   │ (image-flow.ts)  │   │     Flow        │
     │                   │   │                   │   │ (notif-flow.ts) │
     │ Skip classify    │   │ VL model extract │   │ Classify first  │
     │ Extract details  │   │ (multimodal msg) │   │ Extract details │
     │ Resolve wallet   │   │ Resolve wallet   │   │ Resolve wallet  │
     │ Create proposal  │   │ Create proposal  │   │ Create proposal │
     └──────────────────┘   └──────────────────┘   └─────────────────┘
```

---

## Sub-Agents

### 1. Classification Sub-Agent (notifications only)

**Purpose:** Determine if a push notification represents a real financial transaction (vs. promotional/OTP/alert).

**System prompt:** `TRANSACTION_DETECTION_SYSTEM_PROMPT` (in `notification-processor.ts`)

**Input:** Notification app name, title, body, time

**Output:** `NotificationAnalysisResult` — either `{ isTransaction: false, reasoning }` or `{ isTransaction: true, amount, type, currency, merchant, ... }`

**Fallback:** If the LLM fails or returns invalid output, a deterministic regex-based classifier (`fallbackClassify`) extracts amount and type from the notification text using money patterns and transfer signal patterns.

**Why only for notifications:** Text and image inputs come from explicit user action — the user intends to log a transaction. Notifications may be anything (deals, OTPs, balance alerts), so classification is needed to filter.

### 2. Detail Extraction Sub-Agent

**Purpose:** Extract transaction fields from user input.

**For text inputs:**
- **Prompt:** `TRANSACTION_EXTRACTION_PROMPT`
- **Method:** `generateObject()` with `extractionResultSchema` for grammar-constrained JSON
- **Input:** User's natural language text
- **Output:** JSON with `amount`, `type`, `currency`, `merchant`, `description`, `wallet_hint`, `category_hint`

**For image inputs:**
- **Prompt:** `RECEIPT_EXTRACTION_PROMPT`
- **Method:** `generateObject()` with multimodal `messages` format — passes the local `file://` URI as a `file` content part
- **Output:** Same JSON schema as text extraction
- **Fallback:** If vision fails, falls back to text extraction using user context

**For notifications:**
- Uses the classification result which already includes extracted details
- The `buildPotentialTransaction()` helper maps the analysis result to a `CreateProposedTransaction`

### 3. Wallet Resolution Sub-Agent

**Purpose:** Match the extracted transaction to one of the user's wallets.

**System prompt:** `WALLET_RESOLUTION_PROMPT`

**Logic (in priority order):**
1. If user has only one wallet → auto-select
2. If `wallet_hint` matches a wallet name deterministically → use that wallet
3. LLM-based resolution via `generateObject()` with wallet list in prompt → model selects best match
4. If no match found → `walletId = null` (user selects during review)

### 4. Proposal Creator

**Purpose:** Insert the final `proposed_transaction` record into PowerSync.

**Fields populated:**
- `sourceType`: `'text'` | `'image'` | `'notification'`
- `sourceText`: User's original text input (or notification body)
- `sourceImageUri`: Local `file://` path for receipt images
- `walletId`: Resolved wallet ID (or `null` for user selection)
- `amount`, `type`, `currency`, `merchant`, `description`, `categoryHint`
- `aiReasoning`, `aiConfidence`
- `status`: Always `'pending'`

---

## Vision-Language Model Setup

The orchestrator uses a single **Qwen 2.5 VL 3B Instruct** model for all flows (text, image, notification). This VL model handles both text-only and multimodal inputs.

| File | Purpose | Size |
|------|---------|------|
| `Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf` | Main VL model (text + vision) | ~2.0 GB |
| `qwen2.5-vl-3b-instruct-mmproj-f16.gguf` | Vision projector | ~200 MB |

Loaded via `model-manager.ts`:
```typescript
llama.languageModel(mainPath, {
  projectorPath: mmProjPath,
  projectorUseGpu: true,
  contextParams: { n_ctx: 4096, n_gpu_layers: 99 },
})
```

The mmproj projector enables vision capabilities. If not downloaded, the model runs in text-only mode. Image inputs fall back to text extraction using user context.

---

## LLM API Usage

All structured LLM calls use `generateObject()` from the Vercel AI SDK with Zod schemas for grammar-constrained JSON output. This ensures reliable parsing without manual JSON extraction.

```typescript
import { generateObject } from 'ai';
const { object } = await generateObject({
  model,
  schema: extractionResultSchema,
  system: TRANSACTION_EXTRACTION_PROMPT,
  prompt: userInput,
  temperature: 0,
});
```

For image inputs, the multimodal `messages` format is used:
```typescript
const { object } = await generateObject({
  model,
  schema: extractionResultSchema,
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: RECEIPT_EXTRACTION_PROMPT },
      { type: 'file', mediaType: 'image/jpeg', data: imageUri },
    ],
  }],
});
```

---

## Processing Queue

**Storage:** MMKV instance `moni-processing`, key `unified_processing_queue`

**Item types:**
```typescript
TextQueueItem       { type: 'text', text: string }
ImageQueueItem      { type: 'image', imageUri: string, userContext?: string }
NotificationQueueItem { type: 'notification', notification: RawNotification }
```

**Status lifecycle:** `pending` → `processing` → `done` | `error`

**Writers:**
- Chat screen (text/image): `enqueue()` from `processing-queue.ts`
- Headless notification task: Writes directly to MMKV in `index.js`

**Consumer:** Background processor drains items sequentially.

---

## Background Processing (Android)

Uses `react-native-background-actions` to run an Android foreground service.

**Lifecycle:**
1. `startBackgroundProcessor()` called after user submits input or on app foreground with pending items
2. Foreground service starts with notification: "Moni: Processing your transactions..."
3. Model loaded via `getOrLoadModel()` (singleton, shared with UI)
4. Queue items processed sequentially through `runOrchestration()`
5. Service stops when queue is empty

**Important:** `BackgroundService.start()` resolves immediately once the Android service is up — NOT when the task finishes. The `processingTask` function owns its own cleanup in its `finally` block. Do NOT call `stop()` from the caller.

**Fallback:** If the foreground service fails to start (permissions, etc.), processing runs in the foreground context.

---

## Image Storage

**Offline-first design:**
1. `saveImageLocally(uri)` → copies to `{documentDir}/receipts/{uuid}.jpg`
2. Local path stored in `proposed_transactions.source_image_uri`
3. `enqueueImageUpload()` → adds to MMKV upload queue
4. `drainImageUploadQueue()` → called on app foreground, uploads to Supabase Storage `receipts/{userId}/{proposalId}.jpg`
5. On successful upload, `source_image_uri` updated to remote URL via `updateProposalImageUri()`

This ensures the LLM always works offline (reads local file), and the image is eventually synced to the cloud.

---

## Fallback & Error Recovery

| Scenario | Recovery |
|----------|----------|
| LLM classification fails | Deterministic regex fallback |
| LLM extraction returns no amount | Item skipped, marked as error |
| LLM wallet resolution fails | Direct DB lookup + deterministic name matching |
| Vision model not available | Fall back to text extraction with user context |
| Background service fails to start | Run processing in foreground |
| Image upload fails | Stays in upload queue, retried on next foreground |
| Model download fails | User prompted to retry from debug screen |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/ai/orchestrator/index.ts` | Unified orchestration entry point |
| `lib/ai/orchestrator/types.ts` | Shared types (TraceEvent, OrchestrationResult) |
| `lib/ai/orchestrator/prompts.ts` | System prompts + Zod schemas |
| `lib/ai/orchestrator/text-flow.ts` | Text extraction sub-agent + flow |
| `lib/ai/orchestrator/image-flow.ts` | Image extraction sub-agent + flow (multimodal) |
| `lib/ai/orchestrator/notification-flow.ts` | Notification classification + flow |
| `lib/ai/orchestrator/wallet-resolver.ts` | Wallet resolution sub-agent |
| `lib/ai/notification-orchestrator.ts` | Backward-compatible wrapper |
| `lib/ai/notification-processor.ts` | Notification classification + analysis |
| `lib/ai/processing-queue.ts` | MMKV-backed unified queue |
| `lib/ai/model-manager.ts` | Shared model lifecycle (download, load, unload, delete) |
| `lib/ai/background-processor.ts` | Android foreground service processor |
| `lib/ai/chat-orchestrator.ts` | Chat intent routing |
| `lib/ai/tools.ts` | Finance tools for chat |
| `lib/ai/system-prompt.ts` | Chat system prompt builder |
| `lib/storage/image-storage.ts` | Local image persistence + Supabase upload |
| `lib/storage/image-upload-queue.ts` | Offline-first image upload queue |
| `lib/supabase/proposed-transactions.ts` | PowerSync CRUD for proposals |
| `app/(tabs)/chat.tsx` | Transaction input screen (text + image + voice) |
| `components/proposal-review-modal.tsx` | Full-screen proposal review form |
| `app/_layout.tsx` | Global proposal check + upload queue drain |
| `index.js` | Headless notification task → unified queue |

---

## MMKV Storage Keys

| Instance ID | Key | Purpose |
|-------------|-----|---------|
| `moni-processing` | `unified_processing_queue` | Processing queue items |
| `moni-image-uploads` | `pending_image_uploads` | Pending receipt uploads |
| `moni-notifications` | `captured_notifications` | Full notification history (UI) |
