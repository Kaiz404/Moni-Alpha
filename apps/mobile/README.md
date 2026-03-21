# Moni — mobile app

Part of the [Moni](https://github.com/yourusername/Moni) monorepo: Expo / React Native client with local SQLite, PowerSync-oriented sync, and **on-device AI** for transaction proposals.

## AI (on-device)

The mobile app runs a **Qwen 2.5 VL** model via `@react-native-ai/llama`. Text, receipt images, and (on Android) bank notifications are processed through a unified orchestrator into **`proposed_transactions`**; users confirm in the proposal review UI before anything is committed.

See **[lib/ai/ORCHESTRATOR.md](./lib/ai/ORCHESTRATOR.md)** for architecture, queues, and file map.

## Develop

From the **repo root** (recommended):

```bash
pnpm install
pnpm --filter mobile dev
```

Environment: copy variables from the root [SETUP_GUIDE.md](../../docs/SETUP_GUIDE.md) into `apps/mobile/.env`.

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
