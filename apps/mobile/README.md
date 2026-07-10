# Moni — mobile app

Part of the [Moni](https://github.com/yourusername/Moni) monorepo: Expo / React Native client with local-first sync and AI-assisted transaction capture.

## AI (backend-bound)

Inference no longer runs on-device. The app queues text / receipt / notification inputs and calls a typed AI client (`lib/ai/client`) aimed at a future **Go** service. Until `EXPO_PUBLIC_AI_API_URL` is set, the client is a **mock** (features no-op cleanly).

Prompts and former on-device orchestration notes for the Go port: **[lib/ai/BACKEND_AI.md](./lib/ai/BACKEND_AI.md)**.

## Develop

From the **repo root** (recommended):

```bash
pnpm install
pnpm --filter mobile dev
```

Environment: copy variables from the root [SETUP_GUIDE.md](../../docs/SETUP_GUIDE.md) into `apps/mobile/.env`. Optional: `EXPO_PUBLIC_AI_API_URL` for the Go AI backend.
