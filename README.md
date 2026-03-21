# Moni 💰

> **Your money. Your model. Your call.**

**Moni** is a local-first personal finance app that tracks wallets and spending, syncs when you want, and uses **on-device AI** to turn chats, receipt photos, and (on Android) bank notifications into **transaction proposals** you approve before they hit your books—no cloud LLM required for core capture.

## ✨ Features

### Core (Phase 1 — in progress)
- 🔐 **Secure authentication** — Supabase Auth
- 💼 **Multi-wallet management** — Bank, cash, cards, e-wallets, and more
- 💳 **Transaction tracking** — Manual entry with full control
- 🤖 **AI-assisted capture (mobile)** — Natural language and receipt images processed **on-device** (Qwen 2.5 VL via `@react-native-ai/llama`); outputs go to **pending proposals**, not straight into the ledger
- 🔔 **Android notification capture** — Classifies and extracts spend signals from push notifications (with review)
- 🏷️ **Categories** — Organize transactions your way
- 📊 **Analytics** — Spending breakdowns and insights (web + mobile)
- 📱 **Mobile-first** — Expo / React Native
- 🌐 **Web dashboard** — Next.js app with REST API
- 🔄 **Offline-first** — SQLite on mobile with background Supabase sync

### On the roadmap
- 🎤 **Voice-first input** — Wired into the same orchestrator as typed chat
- 📍 **Location-aware insights** — Spending by place
- 📈 **Advanced analytics** — Patterns, budgets, forecasts

Details: [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) · Mobile AI pipeline: [apps/mobile/lib/ai/ORCHESTRATOR.md](./apps/mobile/lib/ai/ORCHESTRATOR.md)

## 🏗️ Architecture

Moni is a **Turborepo monorepo** with:

- **Mobile** (`apps/mobile`) — Expo / React Native
- **Web** (`apps/web`) — Next.js App Router + REST API
- **Shared packages**:
  - `@repo/ui` — Shared React components
  - `@repo/types` — Shared types and Zod schemas
  - `@repo/eslint-config` — Shared ESLint configs
  - `@repo/typescript-config` — Shared TypeScript configs

### Tech stack

**Mobile:**
- Expo SDK 54 + React Native 0.81
- expo-sqlite + Drizzle ORM (local database)
- TanStack Query (server state)
- Tailwind + Uniwind (styling)
- expo-router (file-based routing)
- **On-device AI** — `@react-native-ai/llama` (Qwen 2.5 VL 3B), Vercel AI SDK `generateObject` + Zod for structured extraction → `proposed_transactions`

**Web:**
- Next.js 16 (App Router)
- REST API (Next.js Route Handlers)
- Supabase (PostgreSQL + Auth + Storage + Realtime)
- Recharts (data visualization)
- Shared Zod schemas from `@repo/types`

**Shared:**
- TypeScript (strict mode)
- Zod (validation + shared types)
- pnpm workspaces
- Turborepo

## 📚 Documentation

**New to Moni?** Start here:

- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** — Current status and quick start
- **[PHASE1_IMPLEMENTATION_STATUS.md](./PHASE1_IMPLEMENTATION_STATUS.md)** — Progress tracking
- **[PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)** — Overview, architecture, roadmap
- **[apps/mobile/lib/ai/ORCHESTRATOR.md](./apps/mobile/lib/ai/ORCHESTRATOR.md)** — On-device AI orchestrator (text / image / notifications)
- **[ARCHITECTURE_SIMPLIFIED.md](./docs/ARCHITECTURE_SIMPLIFIED.md)** — REST + shared types
- **[SETUP_GUIDE.md](./docs/SETUP_GUIDE.md)** — Development setup
- **[DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md)** — Database structure
- **[TECHNICAL_REFERENCE.md](./docs/TECHNICAL_REFERENCE.md)** — Patterns and examples

See [docs/README.md](./docs/README.md) for the full index.

## 🚀 Quick start

### Prerequisites

- Node.js >= 18
- pnpm >= 9.0
- Supabase account ([sign up](https://supabase.com/))
- Expo Go or a dev build ([iOS](https://apps.apple.com/app/expo-go/id982107779) | [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/Moni.git
   cd Moni
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up Supabase**
   - Create a Supabase project
   - Apply the schema from `docs/DATABASE_SCHEMA.md`
   - Copy your API keys

4. **Environment variables**

   `apps/web/.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

   `apps/mobile/.env`:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   EXPO_PUBLIC_API_URL=http://localhost:3000/api
   ```

5. **Start development**
   ```bash
   pnpm dev
   ```

   Starts the web app (http://localhost:3000) and the Expo dev server.

For more detail, see [SETUP_GUIDE.md](./docs/SETUP_GUIDE.md).

## 🛠️ Development

### Commands

```bash
pnpm dev                 # All apps
pnpm --filter web dev    # Web only
pnpm --filter mobile dev # Mobile only
pnpm build
pnpm lint
pnpm check-types
pnpm format
```

### Project structure

```
Moni/
├── apps/
│   ├── mobile/          # Expo app (local DB, AI orchestrator, sync)
│   │   ├── app/
│   │   ├── components/
│   │   ├── db/
│   │   └── lib/         # includes lib/ai/ (on-device pipeline)
│   └── web/             # Next.js + API routes
├── packages/
│   ├── ui/
│   ├── types/           # Shared Zod schemas + TypeScript types
│   ├── eslint-config/
│   └── typescript-config/
├── docs/
└── turbo.json
```

## 🔐 Security & privacy

- **Local-first** — Data on device; optional cloud sync
- **On-device AI** — Core extraction runs locally; proposals are reviewed before commit
- **Row Level Security** — Tenant isolation in PostgreSQL
- **Secure storage** — Tokens in secure storage on mobile
- **HTTPS** — API traffic encrypted

## 🤝 Contributing

1. Fork the repository
2. Create a branch (`git checkout -b feature/your-feature`)
3. Make changes
4. Run `pnpm lint && pnpm check-types`
5. Commit and open a Pull Request

Read [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) and the relevant package READMEs before large changes.

## 📝 Roadmap (high level)

| Phase | Focus |
| --- | --- |
| **1** | Foundation: auth, CRUD, sync, dashboards, **on-device AI proposals** |
| **2+** | Voice input, richer analytics, location, production polish |

See [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) for the full backlog.

## 🐛 Known issues

- Sync conflict resolution can be improved
- Platform-specific build and store setup may need tuning
- Track [GitHub Issues](https://github.com/yourusername/Moni/issues) for current bugs

## 📜 License

MIT — see [LICENSE](LICENSE).

## 🙏 Acknowledgments

- [Expo](https://expo.dev/) · [Next.js](https://nextjs.org/) · [Supabase](https://supabase.com/)
- [Drizzle ORM](https://orm.drizzle.team/) · [Zod](https://zod.dev/)
- [TanStack Query](https://tanstack.com/query) · [Turborepo](https://turbo.build/repo)

---

**Made for people who want to understand their money—without giving it all to the cloud.**

*Last updated: March 22, 2026*
