# Moni 💰

> A modern, privacy-focused personal finance management application

Moni is a local-first finance tracking app that helps you manage transactions across multiple wallets (bank accounts, cash, credit cards, e-wallets) with comprehensive analytics and insights—all while keeping your data under your control.

## ✨ Features

### Phase 1: Foundation (Current Focus)
- 🔐 **Secure Authentication** - Powered by Supabase Auth
- 💼 **Multi-Wallet Management** - Track unlimited wallets of different types
- 💳 **Transaction Tracking** - Manual entry with full control over details
- 🏷️ **Categories & Tags** - Organize transactions your way
- 📊 **Basic Analytics** - Spending breakdowns and insights
- 📱 **Mobile-First** - Beautiful React Native interface
- 🌐 **Web Dashboard** - Comprehensive web-based analytics
- 🔄 **Offline-First** - Local SQLite database with cloud sync
- 🚀 **Real-time Sync** - Changes sync across devices

### Coming Soon
- 🎤 **Voice Input** - Natural language transaction entry (Phase 2)
- 🤖 **AI Assistant** - Smart data extraction from text/speech (Phase 2)
- 📸 **Receipt Scanning** - OCR and AI-powered receipt processing (Phase 3)
- 📍 **Location Tracking** - Analyze spending by location (Phase 4)
- 📈 **Advanced Analytics** - Pattern recognition and forecasts (Phase 4)
- 💡 **Smart Insights** - AI-powered financial insights (Phase 5)

## 🏗️ Architecture

Moni is built as a **Turborepo monorepo** with:

- **Mobile App** (`apps/mobile`) - Expo/React Native
- **Web App** (`apps/web`) - Next.js with App Router
- **Shared Packages**:
  - `@repo/ui` - Shared React components
  - `@repo/types` - Shared types and Zod schemas
  - `@repo/eslint-config` - Shared ESLint configs
  - `@repo/typescript-config` - Shared TypeScript configs

### Tech Stack

**Mobile:**
- Expo SDK 54 + React Native 0.81
- expo-sqlite + Drizzle ORM (local database)
- TanStack Query (server state)
- Tailwind CSS + Uniwind (styling)
- expo-router (file-based routing)

**Web:**
- Next.js 16 (App Router)
- REST API (Next.js Route Handlers)
- Supabase (PostgreSQL + Auth + Storage + Realtime)
- Recharts (data visualization)
- Type-safe with shared Zod schemas

**Shared:**
- TypeScript (strict mode)
- Zod (validation + shared types)
- pnpm workspaces
- Turborepo (build system)
- `@repo/types` - Shared types and schemas for type-safe APIs

## 📚 Documentation

**New to Moni?** Start with our comprehensive documentation:

- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** ⭐ **START HERE** - Current implementation status & quick start
- **[PHASE1_IMPLEMENTATION_STATUS.md](./PHASE1_IMPLEMENTATION_STATUS.md)** - Detailed progress tracking
- **[PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)** - Complete project overview, architecture, and roadmap
- **[ARCHITECTURE_SIMPLIFIED.md](./docs/ARCHITECTURE_SIMPLIFIED.md)** - Simplified architecture guide (REST + Shared Types)
- **[SETUP_GUIDE.md](./docs/SETUP_GUIDE.md)** - Step-by-step development setup
- **[DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md)** - Database structure and migrations
- **[TECHNICAL_REFERENCE.md](./docs/TECHNICAL_REFERENCE.md)** - Common patterns and code examples

See [docs/README.md](./docs/README.md) for a full documentation index.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 9.0
- Supabase account ([sign up](https://supabase.com/))
- Expo Go app ([iOS](https://apps.apple.com/app/expo-go/id982107779) | [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))

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

3. **Setup Supabase**
   - Create a new Supabase project
   - Run the database schema from `docs/DATABASE_SCHEMA.md`
   - Copy your API keys

4. **Configure environment variables**
   
   Create `apps/web/.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
   
   Create `apps/mobile/.env`:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   EXPO_PUBLIC_API_URL=http://localhost:3000/api
   ```

5. **Start development**
   ```bash
   pnpm dev
   ```
   
   This starts both the web app (http://localhost:3000) and mobile app (Expo dev server).

📖 For detailed setup instructions, see [SETUP_GUIDE.md](./docs/SETUP_GUIDE.md)

## 🛠️ Development

### Commands

```bash
# Start all apps
pnpm dev

# Start web app only
pnpm --filter web dev

# Start mobile app only
pnpm --filter mobile dev

# Build all apps
pnpm build

# Lint all packages
pnpm lint

# Type check
pnpm check-types

# Format code
pnpm format
```

### Project Structure

```
Moni/
├── apps/
│   ├── mobile/          # Expo React Native app
│   │   ├── app/         # File-based routing
│   │   ├── components/  # React components
│   │   ├── db/          # Local database
│   │   └── lib/         # Utilities
│   └── web/             # Next.js web app
│       ├── src/
│       │   ├── app/     # App Router
│       │   ├── components/
│       │   └── lib/
│       └── public/
├── packages/
│   ├── ui/              # Shared UI components
│   ├── types/           # Shared types + Zod schemas [TO CREATE]
│   ├── eslint-config/
│   └── typescript-config/
├── docs/                # Documentation
└── turbo.json           # Turborepo config
```

## 🔐 Security & Privacy

- **Local-First**: Data stored locally on your device
- **End-to-End Control**: You own and control your data
- **Row Level Security**: Database-level access control
- **Encrypted Storage**: Secure token storage (iOS/Android)
- **HTTPS Only**: All network communication encrypted
- **GDPR Compliant**: Export and delete your data anytime

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`pnpm lint && pnpm check-types`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

Please read our documentation before contributing.

## 📝 Development Phases

### Phase 1: Foundation 🚧 (50% Complete)
Core infrastructure, authentication, CRUD operations, basic sync

**Completed:**
- ✅ Complete type system with Zod schemas
- ✅ Supabase PostgreSQL database with RLS
- ✅ REST API routes (auth, wallets, transactions, categories, tags, analytics)
- ✅ API error handling and validation
- ✅ Dependencies installed

**In Progress:**
- 🚧 Mobile SQLite database setup
- 🚧 Mobile authentication
- 🚧 Mobile UI components
- 🚧 Sync implementation

See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for details.

### Phase 2: AI-Powered Input 🔜 (Next)
Voice input, natural language processing, smart transaction entry

### Phase 3: Image Processing 📋
Receipt scanning, OCR, AI-powered data extraction

### Phase 4: Advanced Analytics 📊
Location-based insights, spending patterns, forecasts

### Phase 5: Production Polish ✨
Optimization, testing, deployment, user documentation

## 🐛 Known Issues

- [ ] Sync conflict resolution needs improvement
- [ ] iOS/Android build configurations pending
- [ ] Web dashboard charts need styling

See [GitHub Issues](https://github.com/yourusername/Moni/issues) for a complete list.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with:
- [Expo](https://expo.dev/) - React Native framework
- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend-as-a-Service
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [Zod](https://zod.dev/) - TypeScript-first schema validation
- [TanStack Query](https://tanstack.com/query) - Powerful data synchronization
- [Turborepo](https://turbo.build/repo) - Monorepo build system

## 📧 Contact

- **Project Lead**: [Your Name]
- **Email**: your.email@example.com
- **Discord**: [Join our community](#)

## 🗺️ Roadmap

See [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) for the complete roadmap and feature backlog.

---

**Made with ❤️ for privacy-conscious individuals who want to understand their finances**

*Last Updated: February 14, 2026*
