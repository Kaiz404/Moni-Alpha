# @repo/ai

The client for the Go AI gateway (`apps/backend`), shared by the phone and the web. Each app hands in its own URL, token and image encoder. Raw TypeScript, no build step.

| Module | What it does |
| --- | --- |
| `client.ts` | `createAiClient({ baseUrl, getAccessToken, encodeImage, consent })` returns an `AiClient`: text, receipt and notification extraction, and Moni chat's analysis. `withConsent(client, allowed)` gates any `AiClient`, the mock included. |
| `places.ts` | `createPlacesClient({ baseUrl, getAccessToken })` searches places through the gateway's Google Places proxy. |
| `post.ts` | One POST with the bearer token and a timeout (100 s for AI, 8 s for Places). It never throws. |
| `runtime.d.ts` | Declares `fetch`, `AbortController` and the timers, which React Native, browsers and Node all have, because the shared tsconfig has no DOM library. |

## Contract

- No method throws. A call answers `ok`, `skipped` or `unavailable` (Places: `ok`, `not_found` or `unavailable`).
- `consent` is asked before every call. While it is false, the call answers `{ status: 'unavailable', reason: 'consent' }` without the network. A 403 whose `details.reason` is `consent` answers the same, so the phone's queue waits for the user instead of retrying.
- A non-2xx, a network failure and the timeout answer `unavailable` with a reason. The reason is the body's `error` when the body is `{ error, details? }`.
- Every response is parsed with the Zod schemas in `@repo/types` (`extractResultSchema`, `chatAnalyzeResultSchema`, the Places results). A body that does not parse answers `unavailable`. Keys a newer backend adds are dropped, so an older build keeps working.
- `encodeImage` returning null answers `skipped` ("Could not read the receipt image") without the network.

## Adapters

The web uses it for Moni chat (`apps/web/src/lib/ai.ts`, `apps/web/src/components/chat/ask.ts`).

| | Phone | Web |
| --- | --- | --- |
| `baseUrl` | `EXPO_PUBLIC_AI_API_URL` (`apps/mobile/lib/ai/client/config.ts`) | `NEXT_PUBLIC_AI_API_URL` |
| `getAccessToken` | The MMKV-backed Supabase session | The `@supabase/ssr` browser session |
| `encodeImage` | `buildImagePayload` (`expo-image-manipulator`, `lib/ai/client/image-payload.ts`) | Written with web receipt capture |
| `consent` | `aiUseAllowedNow(use)` for the use asking | `aiUseAllowed` from `@repo/core` over the store's `aiConsent$` |

With no gateway URL the phone uses `mockAiClient` (`lib/ai/client/mock.ts`), the second adapter of `AiClient`, which serves the e2e fixtures and otherwise answers `unavailable`. `withConsent` gates it the same way. The web origin must be in the gateway's `CORS_ALLOWED_ORIGINS`.

```bash
pnpm --filter @repo/ai test         # Vitest, with fetch stubbed
pnpm --filter @repo/ai check-types
pnpm --filter @repo/ai lint
```
