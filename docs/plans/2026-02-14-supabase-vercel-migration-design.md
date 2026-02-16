# NotiFlow Architecture Migration Design

**Date**: 2026-02-14
**Status**: Approved
**Approach**: Supabase All-in (Approach A)

## Overview

Docker 기반 6개 서비스(PostgreSQL, Redis, NocoDB, Express API Gateway, Caddy, Next.js)를
Supabase + Vercel + Kotlin 앱 구성으로 전환한다.

## 1. Architecture Mapping

| Current (Docker) | Role | Target |
|---|---|---|
| PostgreSQL container | Data storage | **Supabase Database** |
| NocoDB | CRUD API middleware | **Remove** — Supabase JS Client direct query |
| Redis | Read cache | **Remove** — Supabase direct query + Vercel ISR |
| Express API Gateway | Auth, parsing, routing | **Supabase Edge Functions** (Deno) |
| NextAuth + env auth | Dashboard login | **Supabase Auth** (email/password) |
| Caddy | Reverse proxy, HTTPS | **Remove** — Vercel auto HTTPS |
| Telegram Bot | Notification | **Remove** — Kotlin app + FCM |
| Next.js (Docker) | Dashboard UI | **Vercel** deployment |

### Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Supabase                           │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Database  │  │  Auth        │  │ Edge Functions   │  │
│  │ (14 tables│  │ (email/pw)   │  │                  │  │
│  │  + RLS)   │  │              │  │ • parse-message  │  │
│  └────┬─────┘  └──────────────┘  │ • send-push      │  │
│       │                          │ • manage-users    │  │
│       │  Realtime                │ • test-parse      │  │
│       │  (subscriptions)         └────────┬─────────┘  │
│       │                          DB Webhook trigger     │
└───────┼──────────────────────────────────┼─────────────┘
        │                                  │
   ┌────┴────┐                      ┌──────┴──────┐
   │ Vercel  │                      │ Kotlin App  │
   │ Next.js │                      │             │
   │ Dashboard│                     │ • SMS recv  │
   │         │                      │ • FCM push  │
   │ supabase│                      │ • supabase  │
   │ -js     │                      │   -kt       │
   └─────────┘                      └─────────────┘
```

### Data Flow (Message → Order)

1. Kotlin app: SMS/KakaoTalk received
2. Kotlin app: supabase-kt INSERT into raw_messages
3. Supabase: DB Webhook → Edge Function `parse-message`
4. Edge Function: Claude AI parsing → hospital/product matching → orders INSERT
5. Supabase: orders INSERT → DB Webhook → Edge Function `send-push`
6. Edge Function: FCM API → push to Kotlin app
7. Vercel Dashboard: Supabase Realtime → live order list update

### Free Plan Constraints

| Resource | Free Limit | Expected Usage | Margin |
|---|---|---|---|
| DB size | 500MB | ~50MB | Sufficient |
| Edge Function calls | 500K/mo | ~3K/mo | Sufficient |
| Auth users | 50K MAU | ~5 | Sufficient |
| Realtime connections | 200 | ~3 | Sufficient |
| Bandwidth | 5GB/mo | ~1GB | Sufficient |

## 2. DB Schema + RLS

### Table Migration

- **Remove**: `dashboard_users` → replaced by Supabase Auth `auth.users`
- **Change**: `raw_messages.source` value `telegram` → `app`
- **New**: `user_profiles` table for custom fields linked to `auth.users`
- **Keep as-is** (12 tables): hospitals, products, suppliers, orders, order_items, deliveries, delivery_items, hospital_products, kpis_reports, message_parse_log, product_aliases, settings

### New Table: user_profiles

```sql
CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  role       VARCHAR(20) NOT NULL DEFAULT 'viewer',  -- 'admin' | 'viewer' | 'app'
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### RLS Helper

```sql
CREATE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### RLS Policy Summary

| Table | admin | viewer | app | Edge Function (service_role) |
|---|---|---|---|---|
| orders, order_items | CRUD | SELECT | - | CRUD |
| hospitals, products, suppliers | CRUD | SELECT | - | SELECT |
| raw_messages | CRUD | SELECT | INSERT | CRUD |
| deliveries, delivery_items | CRUD | SELECT | - | CRUD |
| settings | CRUD | - | - | SELECT |
| user_profiles | CRUD | own SELECT | - | - |
| kpis_reports | CRUD | SELECT | - | - |

### Supabase Auth Configuration

- Provider: Email/Password
- Self-registration: disabled (admin creates users via Admin API)
- JWT custom claims: `role` injected via Auth Hook

```sql
CREATE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims JSONB;
  user_role TEXT;
BEGIN
  claims := event->'claims';
  SELECT role INTO user_role FROM user_profiles WHERE id = (event->>'user_id')::UUID;
  claims := jsonb_set(claims, '{user_role}', to_jsonb(COALESCE(user_role, 'viewer')));
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 3. Edge Functions

### Function Map

| Function | Trigger | Purpose |
|---|---|---|
| `parse-message` | DB Webhook (raw_messages INSERT) | AI parsing + order creation |
| `send-push` | DB Webhook (orders INSERT) | FCM push to Kotlin app |
| `manage-users` | HTTP call from Dashboard | User CRUD via Admin API |
| `test-parse` | HTTP call from Dashboard | AI parse preview (no DB write) |

### AI Settings (Dashboard-configurable)

Stored in `settings` table as key-value:

| Key | Type | Description |
|---|---|---|
| `ai_enabled` | Switch | Enable/disable AI parsing |
| `ai_model` | Select | Claude model selection |
| `ai_parse_prompt` | Textarea | System prompt for parsing |
| `ai_auto_process` | Switch | Auto order creation on/off |
| `ai_confidence_threshold` | Slider (0.0~1.0) | Below threshold → manual review |

### parse-message Logic

1. Read AI settings from `settings` table
2. If `ai_enabled` = false → mark message as `pending_manual`, return
3. Call Claude API with configured model + prompt
4. Fuzzy match hospitals and products
5. If `ai_auto_process` = false OR low confidence → save parse log with `needs_review` status
6. Otherwise → create order + order_items automatically

### Database Webhooks

| Webhook | Table | Event | Target |
|---|---|---|---|
| `on_new_message` | raw_messages | INSERT | parse-message |
| `on_new_order` | orders | INSERT | send-push |

### Supabase Secrets

```
CLAUDE_API_KEY           — AI parsing
FCM_SERVICE_ACCOUNT      — FCM v1 API service account JSON
```

### Logic Migration Map

| Current File | Logic | Target |
|---|---|---|
| api-gateway/src/services/messageParser.js | AI prompt, parsing | parse-message |
| api-gateway/src/services/matcher.js | Fuse.js matching | parse-message (Deno port) |
| api-gateway/src/services/telegramBot.js | Notification | send-push (FCM) |
| api-gateway/src/routes/users.js | User CRUD | manage-users |

## 4. Dashboard (Next.js + Vercel)

### Auth Migration

```
NextAuth v5 + credentials → Supabase Auth (@supabase/ssr)
```

#### New Files

| File | Purpose |
|---|---|
| `lib/supabase/client.ts` | Browser Supabase client |
| `lib/supabase/server.ts` | Server component Supabase client |
| `lib/supabase/middleware.ts` | Middleware Supabase client |
| `middleware.ts` | Auth guard + inactive user check |
| `lib/queries/*.ts` | Per-table query functions |

#### Removed Files

| File | Reason |
|---|---|
| `lib/auth.ts` | Replaced by Supabase Auth |
| `types/next-auth.d.ts` | No longer needed |
| `lib/api.ts` | Replaced by direct Supabase queries |

### Data Fetching

```
Current:  lib/api.ts → fetch(API_GATEWAY_URL) → NocoDB
Target:   lib/queries/*.ts → supabase.from("table").select("...")
```

Query files: orders.ts, hospitals.ts, products.ts, suppliers.ts, deliveries.ts, messages.ts, settings.ts, users.ts

### Realtime

```typescript
// Client-side subscription for live updates
supabase.channel("orders-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
    router.refresh();
  })
  .subscribe();
```

### basePath Removal

- Remove `basePath: "/dashboard"` from next.config.ts
- All routes: `/dashboard/orders` → `/orders`
- Sidebar navItems: remove `/dashboard` prefix
- Login redirect: `/dashboard/login` → `/login`

### New Sidebar Menu

```
설정 section:
  - /settings  → AI 설정 (Brain icon)
  - /users     → 사용자 (Users icon)
```

### Settings Page (`/settings`)

- AI parsing settings card (enabled, model, prompt)
- Auto-processing card (auto-create, confidence threshold)
- Test card (test message input + parse preview button)

### Dependency Changes

```diff
- next-auth
- @auth/core
+ @supabase/supabase-js
+ @supabase/ssr
```

### Vercel Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## 5. Kotlin App Integration

### App Responsibilities

| Feature | Description |
|---|---|
| SMS/KakaoTalk receive | Android SmsReceiver |
| Send to Supabase | supabase-kt INSERT into raw_messages |
| FCM push receive | Order creation notification |
| Notification display | Tap → order detail or dashboard URL |

### Auth Strategy

- Dedicated service account: `app-service@notiflow.local` (role: `app`)
- RLS: `app` role → raw_messages INSERT only
- Token storage: Android Keystore

### FCM Configuration

- Use FCM v1 HTTP API (not legacy)
- Topic-based: Kotlin app subscribes to `orders` topic
- Edge Function `send-push` uses Google Service Account for OAuth2 token

### Notification Flow

```
1. [Kotlin] SMS received → raw_messages INSERT
2. [Supabase] DB Webhook → parse-message
3. [Edge Function] AI parse → order INSERT
4. [Supabase] DB Webhook → send-push
5. [Edge Function] FCM → Kotlin push
6. [Kotlin] Push received → notification displayed
7. [Dashboard] Realtime → order list auto-refresh
```
