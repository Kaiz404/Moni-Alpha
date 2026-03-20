# Project Plan: Moni Notification Agent Orchestration (Mobile)
**Model:** Qwen 3.5-2B GGUF on-device
**Runtime:** React Native + @react-native-ai/llama + AI SDK tools
**Data Target:** Proposed transactions persisted via PowerSync/Supabase

---

## 1. Architecture Overview (Orchestrator + Sub-Agents)
Moni uses a JavaScript orchestrator to split responsibilities across focused sub-agents instead of one overloaded prompt.

* **Orchestrator (JS/TS):** Controls flow, validation, and fail-safe behavior.
* **Classification Sub-Agent (LLM):** Decides if notification is a real transaction candidate.
* **Wallet Resolution Sub-Agent (LLM+Tool):** Must call `get_wallets`; decides wallet match vs skip.
* **Transaction Creation Sub-Agent (LLM+Tool):** Calls `create_transaction` only after confirmed wallet match.

Current implementation files:
* `apps/mobile/lib/ai/notification-orchestrator.ts`
* `apps/mobile/hooks/use-notification-processor.ts`
* `apps/mobile/lib/ai/notification-processor.ts`

---

## 2. Phase 1: On-Device Inference Setup (Moni-specific)
* [x] Use `@react-native-ai/llama` local model runtime (no localhost Ollama endpoint).
* [x] Configure notification model ID: `Qwen/Qwen3.5-0.8B-GGUF/qwen3.5-0.8b-q4_k_m.gguf`.
* [x] Keep fallback path to chat model when notification model is unavailable.
* [ ] Validate model download/readiness UX from Notifications tab in real-device runs.

---

## 3. Phase 2: Notification Pipeline State Machine

### Step A: Deterministic Prefilter
* Input notification must contain:
  * currency amount signal, and
  * transfer/money-movement signal.
* If prefilter fails, skip immediately.

### Step B: Classification Sub-Agent
* Run transaction classifier on notification payload.
* Return structured decision and extracted fields (amount, currency, type, merchant/description).
* If not transaction, skip and continue queue.

### Step C: Wallet Resolution Sub-Agent (Tool-Gated)
* Mandatory tool call: `get_wallets()`.
* Compare notification source app/origin against user wallet names.
* Return `create` with exact wallet ID or `skip` if no match.

### Step D: Transaction Creation Sub-Agent (Tool-Gated)
* Execute `create_transaction()` only if wallet was matched.
* Create `proposed_transactions` record with resolved wallet ID.
* If no match, skip this notification and proceed to next.

---

## 4. Phase 3: Tool Contract (Moni Data Model)

### `get_wallets`
Returns wallet metadata used for strict wallet matching.

Expected fields:
* `id`
* `name`

### `create_transaction`
Creates a proposal (not direct bank transfer/broadcast).

Mapped output target:
* `createProposedTransaction(...)` in app logic
* `proposed_transactions` table (PowerSync/Supabase)

---

## 5. Phase 4: Guardrails and Reliability
* [x] Enforce wallet lookup before create step.
* [x] Reject invalid/nonexistent wallet IDs.
* [x] Skip safely on tool/model failure and continue queue processing.
* [ ] Add explicit per-sub-agent telemetry logs for: classify → resolve → create.
* [ ] Add integration tests for match/no-match and tool-call failure paths.

---

## 6. Success Criteria
The workflow is considered successful when all are true:
* Transaction-like notification is detected correctly.
* `get_wallets()` is executed for wallet verification.
* `create_transaction()` is called only on confirmed wallet match.
* Non-matching wallet origin notifications are skipped.
* Queue continues processing subsequent notifications without blocking.