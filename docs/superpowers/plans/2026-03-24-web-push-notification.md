# Web Push Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Firebase Cloud Messaging on the NotiFlow web dashboard so logged-in users receive browser push notifications when new captured messages arrive.

**Architecture:** Firebase Messaging SDK initializes on the web client, registers a browser FCM token in the existing `device_tokens` table (`platform: 'web'`), and a new `send-web-push` Edge Function sends FCM v1 notifications to all web tokens when `captured_messages` receives an INSERT via DB webhook.

**Tech Stack:** Firebase Messaging (web SDK v11), Next.js 16, Supabase Edge Functions (Deno), PostgreSQL pg_net webhooks

**Spec:** `docs/superpowers/specs/2026-03-24-web-push-sync-design.md`

---

### Task 1: Create Firebase Messaging Service Worker

The service worker handles background push notifications (when the tab is not focused). It uses Firebase compat SDK loaded from CDN.

**Files:**
- Create: `apps/web/public/firebase-messaging-sw.js`
- Modify: `apps/web/public/sw.js` (remove push handler to avoid conflict)

- [ ] **Step 1: Create `firebase-messaging-sw.js`**

```js
// Firebase Messaging Service Worker
// Handles background push notifications for NotiFlow web dashboard

importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-messaging-compat.js');

// Firebase config is injected at runtime via query string from the main app.
// Fallback: if no config in URL, the SW was registered without params — skip init.
const urlParams = new URL(self.location.href).searchParams;
const firebaseConfig = urlParams.get('config')
  ? JSON.parse(decodeURIComponent(urlParams.get('config')))
  : null;

if (firebaseConfig) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {};
    const notificationTitle = title || 'NotiFlow';
    const notificationOptions = {
      body: body || '새로운 알림이 있습니다.',
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      data: { url: payload.data?.url || '/messages' },
      tag: 'notiflow-web-push',
      renotify: true,
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Notification click handler (works regardless of Firebase init)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/messages';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
```

- [ ] **Step 2: Remove push handler from `sw.js`**

In `apps/web/public/sw.js`, remove the `self.addEventListener("push", ...)` block (lines 48-62) and the `self.addEventListener("notificationclick", ...)` block (lines 64-80). These are now handled by `firebase-messaging-sw.js`.

The resulting `sw.js` should contain only: install, activate, and fetch event listeners (lines 1-46).

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/firebase-messaging-sw.js apps/web/public/sw.js
git commit -m "feat: add Firebase messaging service worker for web push"
```

---

### Task 2: Firebase Client Library

Create the Firebase initialization module. This is a thin wrapper that lazy-initializes Firebase App and Messaging.

**Files:**
- Create: `apps/web/src/lib/firebase.ts`

- [ ] **Step 1: Create `firebase.ts`**

```ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp(): FirebaseApp {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

export async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(getFirebaseApp());
}

export async function getFCMToken(): Promise<string | null> {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn('NEXT_PUBLIC_FIREBASE_VAPID_KEY not set');
    return null;
  }

  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  // Register the Firebase messaging service worker with config
  const configParam = encodeURIComponent(JSON.stringify(firebaseConfig));
  const swRegistration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?config=${configParam}`,
    { scope: '/' }
  );

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swRegistration,
  });

  return token || null;
}

export { onMessage };
```

- [ ] **Step 2: Install firebase SDK**

```bash
cd apps/web && npm install firebase
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/hartmacm4/Documents/Notiflow && npm run build:web
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/firebase.ts apps/web/package.json apps/web/package-lock.json
git commit -m "feat: add Firebase client initialization for web messaging"
```

---

### Task 3: Push Subscription Management

Handles registering/unregistering web FCM tokens in the `device_tokens` table.

**Files:**
- Create: `apps/web/src/lib/push-subscription.ts`

- [ ] **Step 1: Create `push-subscription.ts`**

```ts
'use server';

import { createClient } from '@/lib/supabase/server';

export async function saveWebPushToken(userId: string, fcmToken: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('device_tokens')
    .upsert(
      {
        user_id: userId,
        fcm_token: fcmToken,
        platform: 'web',
        device_name: 'Web Browser',
      },
      { onConflict: 'user_id,fcm_token' }
    );

  if (error) {
    console.error('Failed to save web push token:', error);
    return false;
  }
  return true;
}

export async function removeWebPushTokens(userId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('platform', 'web');

  if (error) {
    console.error('Failed to remove web push tokens:', error);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/push-subscription.ts
git commit -m "feat: add web push token management server actions"
```

---

### Task 4: Push Initializer Component

Client component that initializes FCM on the dashboard, requests permission, registers the token, and handles foreground messages with toast notifications.

**Files:**
- Create: `apps/web/src/components/push-initializer.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx` (add PushInitializer)

- [ ] **Step 1: Create `push-initializer.tsx`**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getFCMToken, getMessagingInstance, onMessage } from '@/lib/firebase';
import { saveWebPushToken } from '@/lib/push-subscription';

export function PushInitializer({ userId }: { userId: string }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      try {
        // Don't block if notifications not supported
        if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

        // Request permission if not yet decided
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;
        }

        if (Notification.permission !== 'granted') return;

        // Get FCM token and save it
        const token = await getFCMToken();
        if (token) {
          await saveWebPushToken(userId, token);
        }

        // Handle foreground messages
        const messaging = await getMessagingInstance();
        if (messaging) {
          onMessage(messaging, (payload) => {
            const { title, body } = payload.notification || {};
            toast(title || '새 알림', {
              description: body || '새로운 메시지가 도착했습니다.',
              action: {
                label: '확인',
                onClick: () => {
                  window.location.href = payload.data?.url || '/messages';
                },
              },
            });
          });
        }
      } catch (err) {
        console.error('Push initialization failed:', err);
      }
    }

    init();
  }, [userId]);

  return null;
}
```

- [ ] **Step 2: Add PushInitializer to dashboard layout**

In `apps/web/src/app/(dashboard)/layout.tsx`, import and render the component. The layout already has access to the authenticated user via `requireAuth()`.

Add the import:
```tsx
import { PushInitializer } from "@/components/push-initializer";
```

Add `<PushInitializer userId={user.id} />` inside the JSX, next to other invisible components like `<GlobalNotifications />`. The `user` object is already available from `requireAuth()`.

- [ ] **Step 3: Verify build**

```bash
cd /Users/hartmacm4/Documents/Notiflow && npm run build:web
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/push-initializer.tsx apps/web/src/app/\(dashboard\)/layout.tsx
git commit -m "feat: add PushInitializer component to dashboard layout"
```

---

### Task 5: Create `send-web-push` Edge Function

New Edge Function that sends FCM v1 notifications to all web browser tokens when new captured messages arrive. Follows the same pattern as the existing `send-push` function.

**Files:**
- Create: `packages/supabase/supabase/functions/send-web-push/index.ts`

- [ ] **Step 1: Create the Edge Function**

```ts
import { createClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Helpers: PEM / Base64url conversion (same as send-push)
// ---------------------------------------------------------------------------

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const binary = atob(b64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  return buffer.buffer;
}

function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function stringToBase64url(str: string): string {
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getAccessToken(
  serviceAccount: { client_email: string; private_key: string; project_id: string },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = stringToBase64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = stringToBase64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const signingInput = `${header}.${payload}`;
  const keyData = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const signature = arrayBufferToBase64url(signatureBuffer);
  const jwt = `${signingInput}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(`Google OAuth token exchange failed (${tokenRes.status}): ${errBody}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token as string;
}

// ---------------------------------------------------------------------------
// Edge Function entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Verify authorization
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${supabaseServiceKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse webhook payload
    const body = await req.json();
    const record = body.record;

    if (!record) {
      return new Response(JSON.stringify({ error: "No record in webhook payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract message info for notification content
    const senderName: string = record.sender_name || record.app_name || "알 수 없음";
    const messagePreview: string = (record.body || record.content || "")
      .substring(0, 100);

    // Check FCM_SERVICE_ACCOUNT
    const fcmServiceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!fcmServiceAccountJson) {
      console.warn("FCM_SERVICE_ACCOUNT not set. Skipping web push.");
      return new Response(
        JSON.stringify({ skipped: true, reason: "FCM_SERVICE_ACCOUNT not configured" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const serviceAccount = JSON.parse(fcmServiceAccountJson);

    // Query all web FCM tokens
    const { data: webTokens, error: tokenError } = await supabase
      .from("device_tokens")
      .select("id, fcm_token, user_id")
      .eq("platform", "web");

    if (tokenError || !webTokens || webTokens.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No web push tokens registered" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Get access token
    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    let sent = 0;
    let failed = 0;
    const invalidTokenIds: number[] = [];

    // Send to each web token
    for (const tokenRow of webTokens) {
      const fcmPayload = {
        message: {
          token: tokenRow.fcm_token,
          notification: {
            title: "새 메시지 도착",
            body: `${senderName}: ${messagePreview}`,
          },
          data: {
            url: "/messages",
            message_id: String(record.id || ""),
          },
          webpush: {
            fcm_options: {
              link: "/messages",
            },
          },
        },
      };

      const fcmRes = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fcmPayload),
        },
      );

      if (fcmRes.ok) {
        sent++;
      } else {
        failed++;
        const status = fcmRes.status;
        // Clean up invalid tokens
        if (status === 404 || status === 400) {
          invalidTokenIds.push(tokenRow.id);
        }
        const errText = await fcmRes.text();
        console.error(`FCM send failed for token ${tokenRow.id} (${status}):`, errText);
      }
    }

    // Remove invalid tokens
    if (invalidTokenIds.length > 0) {
      await supabase
        .from("device_tokens")
        .delete()
        .in("id", invalidTokenIds);
      console.log(`Removed ${invalidTokenIds.length} invalid web push tokens`);
    }

    // Log to notification_logs
    await supabase.from("notification_logs").insert({
      event_type: "new_message",
      channel: "fcm_web",
      recipient: `web_tokens:${webTokens.length}`,
      message: `새 메시지: ${senderName} - ${messagePreview.substring(0, 50)}`,
      status: sent > 0 ? "sent" : "failed",
      related_id: record.id || null,
      sent_at: new Date().toISOString(),
      ...(failed > 0 ? { error_message: `${failed}/${webTokens.length} tokens failed` } : {}),
    });

    return new Response(
      JSON.stringify({ success: true, sent, failed, invalid_removed: invalidTokenIds.length }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-web-push error:", err);

    try {
      await supabase.from("notification_logs").insert({
        event_type: "new_message",
        channel: "fcm_web",
        recipient: "web_tokens",
        message: `Web push failed: ${(err as Error).message}`,
        status: "failed",
        sent_at: new Date().toISOString(),
        error_message: (err as Error).message,
      });
    } catch (logErr) {
      console.error("Failed to log error:", logErr);
    }

    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/supabase/supabase/functions/send-web-push/index.ts
git commit -m "feat: add send-web-push Edge Function for browser notifications"
```

---

### Task 6: Database Webhook for `captured_messages`

Create a migration that adds a DB trigger to invoke the `send-web-push` Edge Function when new messages are inserted into `captured_messages`.

**Files:**
- Create: `packages/supabase/migrations/00067_web_push_webhook.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Web push notification webhook for new captured messages
-- Sends browser push notifications via send-web-push Edge Function

CREATE OR REPLACE FUNCTION notify_send_web_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Read settings (same pattern as 00004_webhooks.sql)
  BEGIN
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not read app.settings for web push webhook: %', SQLERRM;
    RETURN NEW;
  END;

  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'captured_messages',
      'record', row_to_json(NEW)
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_captured_message_inserted_web_push
  AFTER INSERT ON captured_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_send_web_push();
```

- [ ] **Step 2: Commit**

```bash
git add packages/supabase/migrations/00067_web_push_webhook.sql
git commit -m "feat: add DB webhook trigger for web push on new captured messages"
```

---

### Task 7: Environment Variables + Documentation

Update `.env.example` and add the new env vars.

**Files:**
- Modify: `apps/web/.env.local.example`

- [ ] **Step 1: Add Firebase env vars to `.env.local.example`**

Append to the file:

```
# Firebase Cloud Messaging (Web Push)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

- [ ] **Step 2: Verify full build**

```bash
cd /Users/hartmacm4/Documents/Notiflow && npm run build:web
```

- [ ] **Step 3: Run lint**

```bash
cd /Users/hartmacm4/Documents/Notiflow && npm run lint:web
```

Fix any issues.

- [ ] **Step 4: Commit**

```bash
git add apps/web/.env.local.example
git commit -m "docs: add Firebase web push environment variables to example"
```
