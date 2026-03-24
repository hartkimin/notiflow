# Web Push Notification + Sync Trigger Design

**Date:** 2026-03-24
**Status:** Approved

## Goal

Enable Firebase Cloud Messaging on the NotiFlow web dashboard so that:
1. When new messages arrive in `captured_messages`, all logged-in web users receive a browser push notification
2. The existing web → mobile sync trigger flow continues to work via `trigger-sync` Edge Function

## Current State

- **Mobile → Server sync**: Working. `SyncManager` auto-uploads captured messages.
- **Web → Mobile sync trigger**: Working. `requestDeviceSync()` → `trigger-sync` Edge Function → FCM data message → mobile `forceSync()`.
- **Web push reception**: NOT working. Service worker (`sw.js`) has a push event handler, but Firebase Messaging SDK is not initialized on the web client. No browser token registration, no VAPID key configuration.
- **`device_tokens` table**: Exists with `user_id`, `fcm_token`, `platform`, `device_name` columns. Currently unused (mobile uses `mobile_devices.fcm_token` instead). Will be repurposed for web tokens.

## Architecture

### Data Flow

```
Mobile notification captured → SyncManager uploads → captured_messages INSERT
    ↓
DB webhook (pg_net) → send-web-push Edge Function
    ↓
Query device_tokens WHERE platform = 'web' → collect all web FCM tokens
    ↓
FCM v1 API → browser push notification
    ↓
User clicks → navigates to /messages
```

### Components

```
apps/web/public/firebase-messaging-sw.js    — Firebase messaging service worker
apps/web/src/lib/firebase.ts                — Firebase app + messaging init
apps/web/src/lib/push-subscription.ts       — Token registration/cleanup
apps/web/src/components/push-initializer.tsx — Client component, init on login
packages/supabase/supabase/functions/send-web-push/index.ts — Edge Function
packages/supabase/migrations/00019_web_push_webhook.sql     — DB webhook trigger
```

## Detailed Spec

### 1. Firebase Messaging Service Worker

**File:** `apps/web/public/firebase-messaging-sw.js`

- Import Firebase Messaging SDK via CDN (compat version for service worker context)
- Initialize Firebase app with project config
- `messaging.onBackgroundMessage()` handler shows browser notification
- Notification click opens `/messages` page
- This replaces the push handler in the existing `sw.js` — remove the `push` event listener from `sw.js` to avoid conflicts

### 2. Firebase Client Initialization

**File:** `apps/web/src/lib/firebase.ts`

- Initialize Firebase app with config from env vars:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (optional, `{projectId}.firebaseapp.com`)
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
- Export `getMessagingInstance()` — lazy init, returns `null` if browser doesn't support notifications
- Export `getFCMToken(vapidKey)` — calls `getToken()` with VAPID key and service worker registration

### 3. Token Registration

**File:** `apps/web/src/lib/push-subscription.ts`

- `subscribeToWebPush(userId: string)`:
  1. Check `Notification.permission` — if `default`, call `Notification.requestPermission()`
  2. If `granted`, get FCM token via `getFCMToken(VAPID_KEY)`
  3. Upsert to `device_tokens` table: `{ user_id, fcm_token, platform: 'web', device_name: browser user agent }`
  4. Return token or null
- `unsubscribeFromWebPush(userId: string)`:
  1. Delete user's web tokens from `device_tokens` where `platform = 'web'`
- Token refresh: Firebase auto-refreshes tokens; `onMessage()` callback detects token changes

### 4. Push Initializer Component

**File:** `apps/web/src/components/push-initializer.tsx`

- `'use client'` component
- Placed in the dashboard layout (inside `(dashboard)/layout.tsx`)
- On mount: check if user is logged in, call `subscribeToWebPush(userId)`
- Register `onMessage()` handler for foreground notifications → show toast via Sonner
- Renders nothing (invisible component)

### 5. Edge Function: `send-web-push`

**File:** `packages/supabase/supabase/functions/send-web-push/index.ts`

- **Trigger:** DB webhook on `captured_messages.INSERT`
- **Logic:**
  1. Parse webhook payload to get the new message record
  2. Query `device_tokens` where `platform = 'web'` to get all web FCM tokens
  3. For each token, send FCM v1 notification:
     - Title: `새 메시지 도착`
     - Body: sender info + preview from the captured message (truncated to 100 chars)
     - Click action: `/messages`
     - Icon: `/icons/icon.svg`
  4. Handle errors: remove invalid tokens (404/400), log to `notification_logs`
- **Auth:** Uses `FCM_SERVICE_ACCOUNT` env var (same as existing `send-push` function)
- **Rate limiting:** If multiple messages arrive within 5 seconds, batch into one notification ("N건의 새 메시지")

### 6. Database Webhook

**File:** `packages/supabase/migrations/00019_web_push_webhook.sql`

- Create trigger function `notify_send_web_push()` on `captured_messages` table
- On INSERT → call `send-web-push` Edge Function via `net.http_post()`
- Same pattern as existing `notify_send_push()` in `00004_webhooks.sql`

### 7. Existing `sw.js` Modification

- Remove the `self.addEventListener("push", ...)` handler from `sw.js`
- Push notifications will be handled by `firebase-messaging-sw.js` instead
- Keep all other `sw.js` functionality (cache, fetch strategies, notification click)

## Environment Variables

New variables needed in `apps/web/.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BJVj52KmZmUcahsIwS5JjPRzCBoLj0oQMVBvvlu1oqZeQ2Znu63wLTD9X8uKIeTJUWWoMrwP8uQvC9p-TY56cdI
```

## What Does NOT Change

- Mobile FCM service (`NotiFlowFcmService.kt`)
- `trigger-sync` Edge Function (web → mobile sync)
- `send-push` Edge Function (order creation notifications to mobile)
- `SyncManager` (mobile auto-sync)
- `mobile_devices` table schema
- Existing device list UI and sync buttons

## Edge Cases

- **Permission denied:** If user denies notification permission, silently skip registration. Don't block any functionality.
- **Multiple tabs:** Firebase handles this — only one service worker instance, one token per browser.
- **Token expiry:** Firebase auto-refreshes. Edge function cleans invalid tokens on send failure.
- **No FCM_SERVICE_ACCOUNT:** Edge function logs warning and returns gracefully (same pattern as `send-push`).
- **Offline:** Service worker caches the notification click URL. When user comes online, clicking notification still navigates correctly.
