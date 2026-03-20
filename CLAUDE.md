# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NotiFlow is a medical supply order notification management system for Korean hemodialysis clinics. It captures notifications/SMS from Android devices, parses them with AI (Claude API + regex fallback), manages orders, and integrates with Korean MFDS regulatory APIs. The system consists of a Next.js web dashboard, an Android mobile app, and a Supabase backend.

## Monorepo Structure

- `apps/web/` — Next.js 16 (App Router) dashboard (TypeScript strict mode, React 19, shadcn/ui, Tailwind CSS 4)
- `apps/mobile/` — Android app (Kotlin, Jetpack Compose, Material 3, Hilt, Room, MediaPipe Gemma 3N)
- `packages/supabase/` — Backend: PostgreSQL migrations, Edge Functions, seed data
- `docs/` — API reference (`API.md`), setup guide (`SETUP.md`), testing guide (`TESTING_GUIDE.md`)
- `scripts/` — Deployment and utility scripts

## Commands

### Web Dashboard
```bash
npm run dev:web          # Dev server (localhost:3000, uses Turbopack)
npm run build:web        # Production build (standalone output for Docker/Vercel)
npm run lint:web         # ESLint 9 (flat config, Next.js core-web-vitals + TypeScript)
```

### Supabase Backend
```bash
npm run supabase:start   # Local stack (API :54321, Studio :54323)
npm run supabase:reset   # Apply all migrations + seed
npm run supabase:stop    # Stop local stack
```

### Combined Local Dev
```bash
npm run dev:local        # Supabase + web dev server together
```

### Docker
```bash
npm run docker:web       # Build and run web in container (:3002 → :3000 internal)
npm run docker:web:stop  # Stop container
```

### Mobile (Android)
```bash
cd apps/mobile
./gradlew assembleDebug        # Build debug APK
./gradlew testDebugUnitTest    # Run unit tests
```

### shadcn/ui Components
```bash
cd apps/web
npx shadcn@latest add <component>   # Add a new shadcn component
```

## Architecture

### Data Flow
```
Android (NotificationListener/SMS) → Supabase Realtime → captured_messages table
                                                            ↓
Web Dashboard ← Server Actions ← Claude AI parse (confidence ≥ 0.7) / regex fallback
                                                            ↓
                                                    orders + order_items
```

### Web App Key Modules (`apps/web/src/lib/`)
- `actions.ts` — Server Actions (message parsing, order CRUD, MFDS sync)
- `parse-service.ts` — Parsing orchestration (AI + regex pipeline)
- `parser.ts` — Regex-based fallback parser
- `ai-client.ts` — Multi-provider AI client (Claude + fallbacks)
- `mfds-sync.ts` / `mfds-search-utils.ts` — MFDS regulatory data sync and search
- `queries/` — Supabase data query functions
- `supabase/` — Client factories (server, client, admin)
- `schedule-utils.ts` — Calendar/schedule view helpers
- `types.ts` — Shared TypeScript interfaces

### Web App Path Alias
`@/*` maps to `apps/web/src/*`

### Dashboard Routes (`apps/web/src/app/(dashboard)/`)
Protected route group containing: dashboard, orders (list/detail/new), messages, notifications, hospitals, suppliers, products (all/my), devices, users, settings (general/devices/users), help

### API Routes (`apps/web/src/app/api/`)
- Search endpoints: `drug-search`, `device-search`, `device-standard-search`, `ai-product-search`, `ai-supplier-search`
- `manual-parse` — Manual message parsing trigger
- `orders/[id]` — Order retrieval
- `mfds-sync/` — MFDS sync status and cancellation
- `cron/` — Scheduled jobs (archive, daily/monthly reports, MFDS sync continuation)

### Supabase Proxy
`/supabase-proxy/[...path]` rewrites Supabase API calls, needed for Docker where the container can't reach `localhost:54321` directly.

### Mobile Architecture (MVVM)
- `data/db/` — Room entities and DAOs
- `data/repository/` — Repository layer
- `data/sync/` — Bidirectional Supabase sync (SyncManager)
- `service/notification/` — NotificationListenerService, SmsReceiver, FilterEngine
- `ai/` — On-device Gemma 3N inference
- `ui/` — Compose screens
- `viewmodel/` — StateFlow-based ViewModels

### Backend
- SQL migrations in `packages/supabase/migrations/`
- Edge Functions: `ai-product-search`, `manage-users`, `send-push`, `sync-mfds`, `trigger-sync`
- RLS policies enforce row-level security on all tables
- Vercel Cron jobs: daily report (14:50 UTC), monthly report (16:00 1st), archive (18:00 Sun), MFDS sync (19:00 daily)

### Key Database Tables
- `raw_messages` / `captured_messages` — Incoming messages
- `orders` / `order_items` — Order data (format: `ORD-YYYYMMDD-###`)
- `hospitals`, `suppliers`, `products` — Master data
- `categories`, `plans`, `day_categories` — Schedule/calendar (shared with mobile app)
- `mfds_items` — Cached MFDS regulatory data
- `device_tokens`, `mobile_devices` — Device management

## Environment Variables

See `apps/web/.env.example`. Required:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase connection
- `SUPABASE_SERVICE_ROLE_KEY` — Admin access for Edge Functions
- `ANTHROPIC_API_KEY` — Claude AI for message parsing
- `FCM_SERVICE_ACCOUNT` — Firebase push notifications
- `CRON_SECRET` — Vercel cron job authentication

Mobile reads `SUPABASE_URL`, `SUPABASE_KEY`, and `HUGGING_FACE_TOKEN` from `apps/mobile/local.properties`.

## Development Notes

- Node.js 22+ required (CI uses Node 22)
- Korean language content throughout (UI labels, messages, docs)
- Order status workflow: `draft` → `confirmed` → `processing` → `delivered`
- AI parsing uses confidence threshold of 0.7; below that falls back to regex parser
- Next.js standalone output mode — important for Docker and Vercel deployment
- Tailwind CSS 4 via `@tailwindcss/postcss` plugin (no separate tailwind.config)
- Mobile: minSDK 26 (Android 8.0), targetSDK 35, namespace `com.hart.notimgmt`, appId `com.hart.notiflow`

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) triggers on push/PR to `main` with path-based detection:
- **Mobile changes** (`apps/mobile/**`) → JDK 17, build debug APK + run unit tests
- **Web changes** (`apps/web/**`) → Node 22, `npm ci` + lint + production build (uses placeholder Supabase env vars)

## Deployment

- **Web**: Vercel (standalone Next.js output, security headers configured in `next.config.ts`)
- **Mobile**: Google Play Store
- **Backend**: Supabase Cloud
- **Tunnel**: Cloudflare Tunnel to `notiflow.life` (via docker-compose)
