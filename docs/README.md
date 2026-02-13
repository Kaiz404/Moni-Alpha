# Moni Documentation

Welcome to the Moni project documentation! This folder contains comprehensive guides and specifications for developing the Moni personal finance management application.

## 📚 Documentation Index

### Core Documentation

1. **[PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)**
   - Complete project overview and vision
   - Technology stack details
   - Phase-by-phase development plan
   - Current focus (Phase 1: Foundation)
   - Future features backlog (AI/ML, OCR, Advanced Analytics)
   - Recommended for: Understanding the big picture

2. **[ARCHITECTURE_SIMPLIFIED.md](./ARCHITECTURE_SIMPLIFIED.md)** ⭐ **NEW**
   - Simplified architecture guide (no tRPC)
   - REST API + Shared Types approach
   - Type safety with Zod schemas
   - Drizzle ORM with Expo SQLite
   - Data flow examples
   - Recommended for: Getting started, understanding the simplified stack

3. **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)**
   - Complete database schema (PostgreSQL + SQLite)
   - Entity relationship diagrams
   - Table definitions with TypeScript types
   - Indexes and constraints
   - Row Level Security policies
   - Seed data and migrations
   - Recommended for: Backend developers, database work

4. **[TECHNICAL_REFERENCE.md](./TECHNICAL_REFERENCE.md)**
   - Common development patterns
   - Drizzle with Expo SQLite examples
   - REST API patterns
   - TanStack Query usage
   - Shared types package structure
   - Code examples and best practices
   - Recommended for: Daily development reference

5. **[SETUP_GUIDE.md](./SETUP_GUIDE.md)**
   - Step-by-step setup instructions
   - Environment configuration
   - Running the development environment
   - Database migrations
   - Troubleshooting common issues
   - Recommended for: New developers, onboarding

## 🎯 Quick Start Guide

### For New Developers

1. **Start here**: Read [SETUP_GUIDE.md](./SETUP_GUIDE.md) to get your development environment running
2. **Understand the project**: Read [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) for the big picture
3. **Learn the architecture**: Read [ARCHITECTURE_SIMPLIFIED.md](./ARCHITECTURE_SIMPLIFIED.md) to understand the simplified stack
4. **Reference patterns**: Use [TECHNICAL_REFERENCE.md](./TECHNICAL_REFERENCE.md) for code examples
5. **Database work**: Consult [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for schema details

### For Product/Design

1. **Read**: [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) - especially:
   - Project Overview section
   - Phase 1 Features
   - User flows
   - Future features (backlog)

### For DevOps/Infrastructure

1. **Read**: [SETUP_GUIDE.md](./SETUP_GUIDE.md) - especially:
   - Supabase Setup
   - Environment Variables
   - Production Deployment

## 📖 Documentation Philosophy

Our documentation follows these principles:

- **Comprehensive**: All information needed to understand and build the project
- **Up-to-date**: Documentation is updated alongside code changes
- **Practical**: Includes examples, code snippets, and troubleshooting
- **Accessible**: Written for both technical and non-technical audiences
- **Versioned**: Documentation is version-controlled with the code

## 🔄 Phase 1 Focus (Current)

We are currently in **Phase 1: Foundation**. Documentation reflects this focus:

- ✅ Authentication (Supabase Auth)
- ✅ Database schema (PostgreSQL + SQLite)
- ✅ API design (REST with shared types)
- ✅ Local-first sync strategy
- ✅ Basic CRUD operations
- 🚧 Mobile UI implementation (in progress)
- 🚧 Web dashboard (in progress)

## 🔮 Future Documentation (Upcoming Phases)

As we progress through development phases, we'll add:

### Phase 2: AI-Powered Features
- AI integration guide
- Voice-to-text setup
- Natural language processing prompts
- AI confidence scoring

### Phase 3: Image Processing
- OCR integration guide
- Receipt processing workflow
- Image storage and optimization

### Phase 4: Advanced Analytics
- Analytics algorithms
- Location-based queries
- Performance optimization

### Phase 5: Production Polish
- Deployment guide (expanded)
- Monitoring and alerts
- User documentation

## 🤝 Contributing to Documentation

When making changes:

1. **Update relevant docs** when changing features/APIs
2. **Include examples** for new features
3. **Update last modified date** at bottom of each doc
4. **Keep it simple** - write for developers of all skill levels
5. **Review for accuracy** - ensure code examples work

## 📝 Documentation Standards

### File Naming
- Use `UPPERCASE_WITH_UNDERSCORES.md` for main docs
- Use `lowercase-with-hyphens.md` for supplementary docs

### Markdown Standards
- Use ATX-style headers (`#` not underlines)
- Include table of contents for docs > 300 lines
- Use code blocks with language identifiers
- Include "Last Updated" date at bottom

### Code Examples
- All code examples should be tested and working
- Include TypeScript types where applicable
- Show both input and output for API examples
- Include error handling examples

## 🔗 External Resources

### Official Documentation
- [Expo Documentation](https://docs.expo.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Zod Documentation](https://zod.dev/)
- [TanStack Query Documentation](https://tanstack.com/query/latest)

### Learning Resources
- [React Native Tutorial](https://reactnative.dev/docs/tutorial)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Turborepo Handbook](https://turbo.build/repo/docs/handbook)

## 📧 Questions?

If you can't find what you're looking for:

1. Check the troubleshooting sections in each doc
2. Search existing GitHub issues
3. Ask in the project Discord/Slack channel
4. Create a GitHub issue with the `documentation` label

---

**Documentation maintained by the Moni team**

*Last Updated: February 14, 2026*
