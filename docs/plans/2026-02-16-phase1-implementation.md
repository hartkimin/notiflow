# Phase 1: 안정화 — 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 현재 구현된 NotiFlow 기능의 프로덕션 안정성 확보 — Webhook 트리거, 에러 핸들링, FCM 연동, 배포 자동화

**Architecture:** Supabase PostgreSQL 트리거(pg_net)로 Edge Function을 HTTP 호출하는 Webhook 체계 구축. 웹 대시보드의 Server Action 에러를 toast로 일관성 있게 처리. Android 앱에 Firebase Messaging을 추가하여 주문 알림 수신.

**Tech Stack:** PostgreSQL (pg_net extension), Next.js 16 Server Actions + Sonner toast, Android Kotlin (Firebase BOM + firebase-messaging-ktx), Supabase CLI

---

## Task 1: Webhook SQL 마이그레이션

**Files:**
- Create: `packages/supabase/migrations/00004_webhooks.sql`

**Step 1: 마이그레이션 SQL 작성**

Supabase 프로덕션에서 `pg_net` extension은 이미 활성화되어 있음. 트리거 함수에서 `net.http_post()`를 사용하여 Edge Function을 HTTP로 호출.

```sql
-- 00004_webhooks.sql
-- DB Webhook triggers for Edge Functions via pg_net

-- Ensure pg_net extension is available (already enabled on Supabase hosted)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ─────────────────────────────────────────────────
-- 1. raw_messages INSERT → parse-message
-- ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_parse_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  -- Read from vault or use environment
  edge_function_url := current_setting('app.settings.supabase_url', true)
    || '/functions/v1/parse-message';
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Skip if settings are not configured
  IF edge_function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Webhook settings not configured, skipping parse-message';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'raw_messages',
      'record', row_to_json(NEW)
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_raw_message_inserted
  AFTER INSERT ON raw_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_parse_message();

-- ─────────────────────────────────────────────────
-- 2. orders INSERT → send-push
-- ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_send_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  edge_function_url := current_setting('app.settings.supabase_url', true)
    || '/functions/v1/send-push';
  service_role_key := current_setting('app.settings.service_role_key', true);

  IF edge_function_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Webhook settings not configured, skipping send-push';
    RETURN NEW;
  END IF;

  -- Only trigger for non-cancelled orders
  IF NEW.status != 'cancelled' THEN
    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'orders',
        'record', row_to_json(NEW)
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_created
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_send_push();
```

> **주의:** `current_setting('app.settings.supabase_url', true)`은 Supabase Dashboard > Database Settings > Configuration에서 설정해야 함. 또는 Supabase 프로젝트 설정에서 자동 제공되는 `SUPABASE_URL` 환경변수 사용. 배포 후 아래 SQL로 설정:
> ```sql
> ALTER DATABASE postgres SET app.settings.supabase_url = 'https://<project-ref>.supabase.co';
> ALTER DATABASE postgres SET app.settings.service_role_key = '<service-role-key>';
> ```

**Step 2: 커밋**

```bash
git add packages/supabase/migrations/00004_webhooks.sql
git commit -m "feat(supabase): add pg_net webhook triggers for parse-message and send-push"
```

---

## Task 2: 웹 에러 핸들링 통합 — product-list.tsx

**Files:**
- Modify: `apps/web/src/components/product-list.tsx`

**참조 패턴 (`delivery-list.tsx:13-19`):**
```tsx
import { toast } from "sonner";
// ...
async function handleDeliver(orderId: number) {
  try {
    await markDeliveredAction(orderId);
    toast.success("배송완료 처리되었습니다.");
  } catch {
    toast.error("처리에 실패했습니다.");
  }
}
```

**Step 1: toast import 추가 + ProductTable.handleDelete 수정**

`product-list.tsx:3`에 `toast` import 추가.
`product-list.tsx:126-132` — `handleDelete`에 try/catch + toast 적용.

변경 전 (line 126-132):
```tsx
function handleDelete(id: number) {
  startTransition(async () => {
    await deleteProduct(id);
    setDeleteId(null);
    router.refresh();
  });
}
```

변경 후:
```tsx
function handleDelete(id: number) {
  startTransition(async () => {
    try {
      await deleteProduct(id);
      toast.success("품목이 삭제되었습니다.");
      setDeleteId(null);
      router.refresh();
    } catch {
      toast.error("품목 삭제에 실패했습니다.");
    }
  });
}
```

**Step 2: ProductFormDialog.handleSubmit 수정**

`product-list.tsx:338-346` — 에러 핸들링 추가.

변경 전 (line 338-346):
```tsx
startTransition(async () => {
  if (product) {
    await updateProduct(product.id, data);
  } else {
    await createProduct(data);
  }
  onClose();
  router.refresh();
});
```

변경 후:
```tsx
startTransition(async () => {
  try {
    if (product) {
      await updateProduct(product.id, data);
      toast.success("품목이 수정되었습니다.");
    } else {
      await createProduct(data);
      toast.success("품목이 추가되었습니다.");
    }
    onClose();
    router.refresh();
  } catch {
    toast.error("품목 저장에 실패했습니다.");
  }
});
```

**Step 3: AliasDialog.handleDelete + loadAliases 수정**

`product-list.tsx:434-438` — `handleDelete`에 try/catch 추가.

변경 전 (line 434-438):
```tsx
function handleDelete(aliasId: number) {
  startTransition(async () => {
    await deleteProductAlias(product.id, aliasId);
    loadAliases();
  });
}
```

변경 후:
```tsx
function handleDelete(aliasId: number) {
  startTransition(async () => {
    try {
      await deleteProductAlias(product.id, aliasId);
      toast.success("별칭이 삭제되었습니다.");
      loadAliases();
    } catch {
      toast.error("별칭 삭제에 실패했습니다.");
    }
  });
}
```

`product-list.tsx:424-430` — `loadAliases`의 silent catch 개선.

변경 전 (line 424-430):
```tsx
function loadAliases() {
  setLoading(true);
  getProductAliases(product.id).then((aliases) => {
    setAliases(aliases || []);
    setLoading(false);
  }).catch(() => setLoading(false));
}
```

변경 후:
```tsx
function loadAliases() {
  setLoading(true);
  getProductAliases(product.id).then((data) => {
    setAliases(data || []);
    setLoading(false);
  }).catch(() => {
    toast.error("별칭 목록을 불러오지 못했습니다.");
    setLoading(false);
  });
}
```

**Step 4: AliasFormDialog.handleSubmit 수정**

`product-list.tsx:543-557` — 에러 핸들링 추가.

변경 전 (line 543-557):
```tsx
startTransition(async () => {
  if (alias) {
    await updateProductAlias(productId, alias.id, {
      alias: aliasText,
      hospital_id: hospitalId ? parseInt(hospitalId, 10) : null,
    });
  } else {
    await createProductAlias(productId, {
      alias: aliasText,
      hospital_id: hospitalId ? parseInt(hospitalId, 10) : null,
    });
  }
  onSaved();
  onClose();
});
```

변경 후:
```tsx
startTransition(async () => {
  try {
    if (alias) {
      await updateProductAlias(productId, alias.id, {
        alias: aliasText,
        hospital_id: hospitalId ? parseInt(hospitalId, 10) : null,
      });
      toast.success("별칭이 수정되었습니다.");
    } else {
      await createProductAlias(productId, {
        alias: aliasText,
        hospital_id: hospitalId ? parseInt(hospitalId, 10) : null,
      });
      toast.success("별칭이 추가되었습니다.");
    }
    onSaved();
    onClose();
  } catch {
    toast.error("별칭 저장에 실패했습니다.");
  }
});
```

**Step 5: 빌드 확인 후 커밋**

```bash
cd apps/web && npx next build
git add src/components/product-list.tsx
git commit -m "feat(web): add error handling with toast to product-list component"
```

---

## Task 3: 웹 에러 핸들링 통합 — hospital-list.tsx

**Files:**
- Modify: `apps/web/src/components/hospital-list.tsx`

**Step 1: toast import 추가 + handleDelete 수정**

`hospital-list.tsx:17`에서 import 목록에 아래 추가:
```tsx
import { toast } from "sonner";
```

`hospital-list.tsx:106-112` — `handleDelete` 수정:

변경 전:
```tsx
function handleDelete(id: number) {
  startTransition(async () => {
    await deleteHospital(id);
    setDeleteId(null);
    router.refresh();
  });
}
```

변경 후:
```tsx
function handleDelete(id: number) {
  startTransition(async () => {
    try {
      await deleteHospital(id);
      toast.success("거래처가 삭제되었습니다.");
      setDeleteId(null);
      router.refresh();
    } catch {
      toast.error("거래처 삭제에 실패했습니다.");
    }
  });
}
```

**Step 2: HospitalFormDialog.handleSubmit 수정**

`hospital-list.tsx:311-319` — 에러 핸들링 추가:

변경 전:
```tsx
startTransition(async () => {
  if (hospital) {
    await updateHospital(hospital.id, data);
  } else {
    await createHospital(data);
  }
  onClose();
  router.refresh();
});
```

변경 후:
```tsx
startTransition(async () => {
  try {
    if (hospital) {
      await updateHospital(hospital.id, data);
      toast.success("거래처가 수정되었습니다.");
    } else {
      await createHospital(data);
      toast.success("거래처가 추가되었습니다.");
    }
    onClose();
    router.refresh();
  } catch {
    toast.error("거래처 저장에 실패했습니다.");
  }
});
```

**Step 3: 커밋**

```bash
git add apps/web/src/components/hospital-list.tsx
git commit -m "feat(web): add error handling with toast to hospital-list component"
```

---

## Task 4: 웹 에러 핸들링 통합 — supplier-list.tsx

**Files:**
- Modify: `apps/web/src/components/supplier-list.tsx`

**Step 1: toast import 추가 + handleDelete 수정**

`supplier-list.tsx:17`에서 import 목록에 추가:
```tsx
import { toast } from "sonner";
```

`supplier-list.tsx:95-101` — `handleDelete` 수정:

변경 전:
```tsx
function handleDelete(id: number) {
  startTransition(async () => {
    await deleteSupplier(id);
    setDeleteId(null);
    router.refresh();
  });
}
```

변경 후:
```tsx
function handleDelete(id: number) {
  startTransition(async () => {
    try {
      await deleteSupplier(id);
      toast.success("공급사가 삭제되었습니다.");
      setDeleteId(null);
      router.refresh();
    } catch {
      toast.error("공급사 삭제에 실패했습니다.");
    }
  });
}
```

**Step 2: SupplierFormDialog.handleSubmit 수정**

`supplier-list.tsx:271-279` — 에러 핸들링 추가:

변경 전:
```tsx
startTransition(async () => {
  if (supplier) {
    await updateSupplier(supplier.id, data);
  } else {
    await createSupplier(data);
  }
  onClose();
  router.refresh();
});
```

변경 후:
```tsx
startTransition(async () => {
  try {
    if (supplier) {
      await updateSupplier(supplier.id, data);
      toast.success("공급사가 수정되었습니다.");
    } else {
      await createSupplier(data);
      toast.success("공급사가 추가되었습니다.");
    }
    onClose();
    router.refresh();
  } catch {
    toast.error("공급사 저장에 실패했습니다.");
  }
});
```

**Step 3: 커밋**

```bash
git add apps/web/src/components/supplier-list.tsx
git commit -m "feat(web): add error handling with toast to supplier-list component"
```

---

## Task 5: FCM device_tokens 테이블 마이그레이션

**Files:**
- Create: `packages/supabase/migrations/00005_device_tokens.sql`

**Step 1: device_tokens 테이블 SQL 작성**

```sql
-- 00005_device_tokens.sql
-- FCM device token storage for push notifications

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fcm_token text NOT NULL,
  device_name text,
  platform text NOT NULL DEFAULT 'android',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, fcm_token)
);

-- Enable RLS
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY "Users can view own tokens"
  ON public.device_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
  ON public.device_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
  ON public.device_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
  ON public.device_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Admin can view all tokens (for future individual push)
CREATE POLICY "Admin can view all tokens"
  ON public.device_tokens FOR SELECT
  USING (
    (SELECT public.get_user_role()) = 'admin'
  );

-- Index for efficient lookups
CREATE INDEX idx_device_tokens_user_id ON public.device_tokens(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_device_token_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_device_token_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_device_token_timestamp();
```

**Step 2: 커밋**

```bash
git add packages/supabase/migrations/00005_device_tokens.sql
git commit -m "feat(supabase): add device_tokens table for FCM push notifications"
```

---

## Task 6: Android FCM 의존성 및 서비스 구현

**Files:**
- Modify: `apps/mobile/gradle/libs.versions.toml` — Firebase BOM + messaging 추가
- Modify: `apps/mobile/build.gradle.kts` — google-services 플러그인 추가
- Modify: `apps/mobile/app/build.gradle.kts` — Firebase 의존성 추가
- Create: `apps/mobile/app/src/main/java/com/hart/notimgmt/service/fcm/NotiFlowFcmService.kt`
- Modify: `apps/mobile/app/src/main/AndroidManifest.xml` — FCM 서비스 선언

> **전제 조건:** Firebase Console에서 프로젝트를 생성하고 `google-services.json`을 `apps/mobile/app/` 디렉토리에 배치해야 합니다. 이 파일은 .gitignore에 포함되어야 합니다.

**Step 1: libs.versions.toml에 Firebase 버전 추가**

`gradle/libs.versions.toml`의 `[versions]` 섹션에 추가:
```toml
firebase-bom = "33.8.0"
```

`[libraries]` 섹션에 추가:
```toml
firebase-bom = { group = "com.google.firebase", name = "firebase-bom", version.ref = "firebase-bom" }
firebase-messaging = { group = "com.google.firebase", name = "firebase-messaging-ktx" }
```

`[plugins]` 섹션에 추가:
```toml
google-services = { id = "com.google.gms.google-services", version = "4.4.2" }
```

**Step 2: 루트 build.gradle.kts에 google-services 플러그인 추가**

`build.gradle.kts` 최상위 plugins 블록에 추가:
```kotlin
alias(libs.plugins.google.services) apply false
```

**Step 3: app/build.gradle.kts에 Firebase 의존성 추가**

plugins 블록에 추가:
```kotlin
alias(libs.plugins.google.services)
```

dependencies 블록에 추가:
```kotlin
implementation(platform(libs.firebase.bom))
implementation(libs.firebase.messaging)
```

**Step 4: NotiFlowFcmService.kt 생성**

```kotlin
package com.hart.notimgmt.service.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.hart.notimgmt.R
import com.hart.notimgmt.data.preferences.AppPreferences
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class NotiFlowFcmService : FirebaseMessagingService() {

    @Inject
    lateinit var appPreferences: AppPreferences

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    companion object {
        private const val TAG = "NotiFlowFcm"
        private const val CHANNEL_ID = "orders"
        private const val CHANNEL_NAME = "주문 알림"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "FCM token refreshed")
        serviceScope.launch {
            appPreferences.setFcmToken(token)
            // Token will be uploaded to Supabase during next sync
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "FCM message received: ${message.data}")

        val title = message.notification?.title ?: message.data["title"] ?: "NotiFlow"
        val body = message.notification?.body ?: message.data["body"] ?: ""

        showNotification(title, body, message.data)
    }

    private fun showNotification(
        title: String,
        body: String,
        data: Map<String, String>
    ) {
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val notificationId = data["order_id"]?.toIntOrNull()
            ?: System.currentTimeMillis().toInt()

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(notificationId, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "새 주문 생성 시 알림"
            }
            val notificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}
```

**Step 5: AndroidManifest.xml에 FCM 서비스 선언 추가**

`<application>` 태그 안에 추가:
```xml
<service
    android:name=".service.fcm.NotiFlowFcmService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>

<meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="orders" />
```

**Step 6: AppPreferences에 FCM 토큰 저장 메서드 추가**

`AppPreferences.kt`에 추가:
```kotlin
suspend fun setFcmToken(token: String) {
    // DataStore 또는 SharedPreferences에 저장
    dataStore.edit { prefs ->
        prefs[FCM_TOKEN_KEY] = token
    }
}

fun getFcmToken(): Flow<String?> {
    return dataStore.data.map { prefs ->
        prefs[FCM_TOKEN_KEY]
    }
}

companion object {
    // ... 기존 키 ...
    val FCM_TOKEN_KEY = stringPreferencesKey("fcm_token")
}
```

**Step 7: FCM 토큰을 Supabase에 업로드하는 로직 (SyncManager에 추가)**

`SyncManager.kt`에 토큰 동기화 함수 추가:
```kotlin
suspend fun syncFcmToken() {
    val token = appPreferences.getFcmToken().firstOrNull() ?: return
    val userId = authManager.getCurrentUserId() ?: return

    supabase.from("device_tokens")
        .upsert(
            buildJsonObject {
                put("user_id", userId)
                put("fcm_token", token)
                put("device_name", Build.MODEL)
                put("platform", "android")
            }
        ) {
            onConflict = "user_id,fcm_token"
        }
}
```

**Step 8: Firebase topic 구독 (앱 시작 시)**

`MainActivity.kt` 또는 적절한 초기화 위치에 추가:
```kotlin
Firebase.messaging.subscribeToTopic("orders")
    .addOnCompleteListener { task ->
        Log.d("FCM", "Topic subscription: ${task.isSuccessful}")
    }
```

**Step 9: .gitignore에 google-services.json 추가 확인**

`.gitignore`에 아래가 있는지 확인 (없으면 추가):
```
**/google-services.json
```

**Step 10: 커밋**

```bash
git add apps/mobile/gradle/libs.versions.toml
git add apps/mobile/build.gradle.kts
git add apps/mobile/app/build.gradle.kts
git add apps/mobile/app/src/main/java/com/hart/notimgmt/service/fcm/NotiFlowFcmService.kt
git add apps/mobile/app/src/main/AndroidManifest.xml
git commit -m "feat(mobile): add Firebase Cloud Messaging for order push notifications"
```

---

## Task 7: Edge Function 배포 스크립트

**Files:**
- Create: `packages/supabase/deploy.sh`

**Step 1: 배포 스크립트 작성**

```bash
#!/usr/bin/env bash
set -euo pipefail

# NotiFlow Supabase Deployment Script
# Usage: ./deploy.sh [functions|db|all]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

deploy_functions() {
  echo "==> Deploying Edge Functions..."
  supabase functions deploy parse-message --no-verify-jwt
  supabase functions deploy send-push --no-verify-jwt
  supabase functions deploy manage-users
  supabase functions deploy test-parse
  echo "==> Edge Functions deployed successfully."
}

deploy_db() {
  echo "==> Pushing database migrations..."
  supabase db push
  echo "==> Database migrations applied successfully."
}

case "${1:-all}" in
  functions)
    deploy_functions
    ;;
  db)
    deploy_db
    ;;
  all)
    deploy_db
    deploy_functions
    ;;
  *)
    echo "Usage: $0 [functions|db|all]"
    exit 1
    ;;
esac

echo "==> Deployment complete!"
```

> **참고:** `parse-message`과 `send-push`는 DB Webhook에서 service_role_key로 호출되므로 `--no-verify-jwt` 플래그가 필요. `manage-users`와 `test-parse`는 대시보드에서 인증된 사용자가 호출하므로 JWT 검증 유지.

**Step 2: 실행 권한 부여 후 커밋**

```bash
chmod +x packages/supabase/deploy.sh
git add packages/supabase/deploy.sh
git commit -m "feat(supabase): add deployment script for edge functions and migrations"
```

---

## Task 8: Vercel 환경변수 확인

**Files:**
- Modify: `.env.example` — 필요한 모든 변수 목록 최신화

**Step 1: .env.example 업데이트**

```env
# ─── Supabase (Web Dashboard) ───
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# ─── Supabase (Edge Functions — set in Supabase Dashboard) ───
# SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
# ANTHROPIC_API_KEY=<anthropic-api-key>
# FCM_SERVICE_ACCOUNT=<firebase-service-account-json>

# ─── Supabase (DB Webhook Config — set via ALTER DATABASE) ───
# app.settings.supabase_url=https://<project-ref>.supabase.co
# app.settings.service_role_key=<service-role-key>
```

**Step 2: Vercel 환경변수 설정 가이드 확인**

Vercel에 설정해야 하는 환경변수 (Vercel Dashboard > Settings > Environment Variables):

| 변수 | 환경 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development | Supabase anon 공개 키 |

> Edge Function 환경변수(ANTHROPIC_API_KEY, FCM_SERVICE_ACCOUNT 등)는 Supabase Dashboard > Edge Functions > Secrets에서 설정합니다. Vercel에는 필요하지 않습니다.

**Step 3: 커밋**

```bash
git add .env.example
git commit -m "docs: update .env.example with all required environment variables"
```

---

## Task 9: 최종 빌드 검증 + 통합 커밋

**Step 1: 웹 빌드 확인**

```bash
cd apps/web && npx next build
```

Expected: 빌드 성공, 에러 없음.

**Step 2: 마이그레이션 문법 확인 (로컬 Supabase)**

```bash
cd packages/supabase && supabase db lint
```

**Step 3: 전체 변경사항 리뷰**

```bash
git diff --stat HEAD~6
```

Phase 1의 전체 변경 파일 목록:
- `packages/supabase/migrations/00004_webhooks.sql` (신규)
- `packages/supabase/migrations/00005_device_tokens.sql` (신규)
- `packages/supabase/deploy.sh` (신규)
- `apps/web/src/components/product-list.tsx` (수정)
- `apps/web/src/components/hospital-list.tsx` (수정)
- `apps/web/src/components/supplier-list.tsx` (수정)
- `apps/mobile/` — FCM 관련 파일 (수정/신규)
- `.env.example` (수정)
