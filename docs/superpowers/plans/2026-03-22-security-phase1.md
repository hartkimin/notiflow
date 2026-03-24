# Phase 1: Security Vulnerability Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical security vulnerabilities identified in the code review — auth bypasses, injection vectors, exposed secrets, and misconfigured RLS policies.

**Architecture:** Each task is independent and can be parallelized. Tasks modify either web app code or Supabase migrations, never both in a way that creates ordering dependencies. The PostgREST sanitization utility is shared infrastructure used by multiple files.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgREST, Edge Functions), TypeScript

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/lib/supabase/sanitize.ts` | PostgREST filter input sanitizer |
| Create | `apps/web/src/middleware.ts` | Global auth middleware for API routes |
| Create | `packages/supabase/migrations/00061_fix_rls_policies.sql` | Fix forecast + my_drugs/devices RLS |
| Modify | `apps/web/src/app/supabase-proxy/[...path]/route.ts` | Add origin allowlist + auth check |
| Modify | `apps/web/src/app/api/tax-invoice/[id]/pdf/route.ts` | Add authentication + filename sanitization |
| Modify | `apps/web/src/app/api/sync-mfds/status/route.ts` | Add authentication |
| Modify | `apps/web/src/lib/actions.ts` | Replace admin client with server client for messages; sanitize filter inputs |
| Modify | `apps/web/src/lib/queries/products.ts` | Sanitize `.or()` filter inputs |
| Modify | `apps/web/src/lib/queries/invoices.ts` | Sanitize `.or()` filter inputs |
| Modify | `apps/web/src/lib/queries/hospitals.ts` | Sanitize `.ilike()` filter inputs |
| Modify | `apps/web/src/lib/queries/suppliers.ts` | Sanitize `.ilike()` filter inputs |
| Modify | `apps/web/src/lib/queries/orders.ts` | Sanitize `.ilike()` filter inputs |
| Modify | `apps/web/src/app/api/cron/daily-report/route.ts` | Use admin client instead of cookie client |
| Modify | `apps/web/src/app/api/cron/monthly-report/route.ts` | Use admin client instead of cookie client |
| Modify | `packages/supabase/functions/send-push/index.ts` | Add service-role key verification |
| Modify | `apps/web/src/lib/supabase/middleware.ts` | Add API route protection |

---

### Task 1: PostgREST Filter Sanitization Utility

**Files:**
- Create: `apps/web/src/lib/supabase/sanitize.ts`

- [ ] **Step 1: Create the sanitizer module**

PostgREST `.or()` filter strings interpret `,`, `.`, `(`, `)` as metacharacters. The `.ilike()` operator interprets `%` and `_` as wildcards. We need two functions:

```typescript
/**
 * Escape PostgREST filter metacharacters for use in `.or()` filter strings.
 * Characters `,`, `.`, `(`, `)`, `\` are escaped with backslash.
 * Also escapes LIKE wildcards `%` and `_`.
 */
export function escapeFilterValue(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/\./g, "\\.")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * Escape LIKE wildcards for use in `.ilike()` / `.like()` filter values.
 */
export function escapeLikeValue(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/supabase/sanitize.ts
git commit -m "feat: add PostgREST filter input sanitization utilities"
```

---

### Task 2: Fix Admin Client Misuse in Message Actions

**Files:**
- Modify: `apps/web/src/lib/actions.ts:10-59`

The `createMessage`, `deleteMessage`, `deleteMessages` functions use `createAdminClient()` (from `@/lib/supabase/admin`) which bypasses RLS and has no user session. Replace with the cookie-aware `createClient()`.

- [ ] **Step 1: Fix `createMessage` (lines 10-34)**

Replace:
```typescript
export async function createMessage(data: {
  source_app: string;
  sender?: string;
  content: string;
}) {
  const supabase = createAdminClient();
  const id = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from("captured_messages").insert({
    id,
    user_id: (await supabase.auth.getUser()).data.user?.id ?? "00000000-0000-0000-0000-000000000000",
```

With:
```typescript
export async function createMessage(data: {
  source_app: string;
  sender?: string;
  content: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("인증되지 않은 사용자입니다.");
  const id = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from("captured_messages").insert({
    id,
    user_id: user.id,
```

- [ ] **Step 2: Fix `deleteMessage` (lines 36-46)**

Replace `const supabase = createAdminClient();` with `const supabase = await createClient();`

- [ ] **Step 3: Fix `deleteMessages` (lines 48-59)**

Replace `const supabase = createAdminClient();` with `const supabase = await createClient();`

- [ ] **Step 4: Remove unused admin import if no other functions use it**

Check if `createProduct`, `updateProduct`, `deleteProduct`, `deleteProducts`, `getProductAliases`, `createProductAlias`, `updateProductAlias`, `deleteProductAlias` still use `createAdminClient`. They do (lines 862-921), so keep the import. These product/alias actions are legacy and intentionally use admin access for the shared product catalog. No change needed for those.

- [ ] **Step 5: Verify build**

Run: `npm run build:web`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/actions.ts
git commit -m "fix(security): use session-aware client for message CRUD, stop bypassing RLS"
```

---

### Task 3: Sanitize PostgREST Filter Inputs Across Query Files

**Files:**
- Modify: `apps/web/src/lib/actions.ts:718-753`
- Modify: `apps/web/src/lib/queries/products.ts:50-58`
- Modify: `apps/web/src/lib/queries/invoices.ts:24`
- Modify: `apps/web/src/lib/queries/hospitals.ts:14`
- Modify: `apps/web/src/lib/queries/suppliers.ts:13`
- Modify: `apps/web/src/lib/queries/orders.ts:67`

- [ ] **Step 1: Fix `actions.ts` — `searchMyItems` (lines 718-725)**

Add import at top of file:
```typescript
import { escapeFilterValue, escapeLikeValue } from "@/lib/supabase/sanitize";
```

Replace lines 718-724:
```typescript
  if (q) {
    const eq = escapeFilterValue(q);
    if (sourceType === "drug") dbQuery = dbQuery.or(`item_name.ilike.%${eq}%,entp_name.ilike.%${eq}%,bar_code.ilike.%${eq}%`);
    else dbQuery = dbQuery.or(`prdlst_nm.ilike.%${eq}%,mnft_iprt_entp_nm.ilike.%${eq}%,udidi_cd.ilike.%${eq}%`);
  }
  for (const chip of filters) {
    const dbCol = chip.field.toLowerCase();
    const ev = escapeLikeValue(chip.value);
    if (chip.operator === "contains") dbQuery = dbQuery.filter(dbCol, "ilike", `%${ev}%`);
    else if (chip.operator === "equals") dbQuery = dbQuery.filter(dbCol, "eq", chip.value);
  }
```

- [ ] **Step 2: Fix `actions.ts` — `searchMfdsItems` (lines 752-753)**

Replace:
```typescript
  if (q) dbQuery = dbQuery.or(`${nameCol}.ilike.%${q}%,${mfrCol}.ilike.%${q}%,${codeCol}.ilike.%${q}%`);
  for (const chip of filters) dbQuery = dbQuery.filter(chip.field.toLowerCase(), "ilike", `%${chip.value}%`);
```

With:
```typescript
  if (q) {
    const eq = escapeFilterValue(q);
    dbQuery = dbQuery.or(`${nameCol}.ilike.%${eq}%,${mfrCol}.ilike.%${eq}%,${codeCol}.ilike.%${eq}%`);
  }
  for (const chip of filters) {
    const ev = escapeLikeValue(chip.value);
    dbQuery = dbQuery.filter(chip.field.toLowerCase(), "ilike", `%${ev}%`);
  }
```

- [ ] **Step 3: Fix `queries/products.ts` (lines 46-58)**

Add import:
```typescript
import { escapeFilterValue } from "@/lib/supabase/sanitize";
```

The current code wraps the raw query in `%...%` at line 46: `const q = \`%${query}%\``. We need to escape BEFORE wrapping. Replace lines 46-57:
```typescript
  const escaped = escapeFilterValue(query);
  const q = `%${escaped}%`;

  const [{ data: drugs }, { data: devices }] = await Promise.all([
    supabase
      .from("my_drugs")
      .select("*")
      .or(`item_name.ilike.${q},bar_code.ilike.${q},entp_name.ilike.${q},edi_code.ilike.${q}`)
      .limit(20),
    supabase
      .from("my_devices")
      .select("*")
      .or(`prdlst_nm.ilike.${q},udidi_cd.ilike.${q},mnft_iprt_entp_nm.ilike.${q}`)
      .limit(20),
  ]);
```

- [ ] **Step 4: Fix `queries/invoices.ts` (line 24)**

Add import:
```typescript
import { escapeFilterValue } from "@/lib/supabase/sanitize";
```

Replace:
```typescript
    const eq = escapeFilterValue(params.search);
    query = query.or(`invoice_number.ilike.%${eq}%,buyer_name.ilike.%${eq}%`);
```

- [ ] **Step 5: Fix `queries/hospitals.ts` (line 14)**

Add import:
```typescript
import { escapeLikeValue } from "@/lib/supabase/sanitize";
```

Replace:
```typescript
  if (params.search) query = query.ilike("name", `%${escapeLikeValue(params.search)}%`);
```

- [ ] **Step 6: Fix `queries/suppliers.ts` (line 13)**

Add import:
```typescript
import { escapeLikeValue } from "@/lib/supabase/sanitize";
```

Replace:
```typescript
  if (params.search) query = query.ilike("name", `%${escapeLikeValue(params.search)}%`);
```

- [ ] **Step 7: Fix `queries/orders.ts` (line 67)**

Add import:
```typescript
import { escapeLikeValue } from "@/lib/supabase/sanitize";
```

Replace:
```typescript
      .ilike("product_name", `%${escapeLikeValue(params.search)}%`);
```

- [ ] **Step 8: Verify build**

Run: `npm run build:web`

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/actions.ts apps/web/src/lib/queries/products.ts apps/web/src/lib/queries/invoices.ts apps/web/src/lib/queries/hospitals.ts apps/web/src/lib/queries/suppliers.ts apps/web/src/lib/queries/orders.ts
git commit -m "fix(security): sanitize PostgREST filter inputs to prevent injection"
```

---

### Task 4: Restrict Supabase Proxy

**Files:**
- Modify: `apps/web/src/app/supabase-proxy/[...path]/route.ts`

The proxy currently has `Access-Control-Allow-Origin: *` and no auth. Restrict origins to known domains and require a valid Supabase auth token or apikey header.

- [ ] **Step 1: Replace the entire proxy file**

```typescript
/**
 * Catch-all proxy for Supabase API.
 * Used by Docker web container and mobile apps connecting via Cloudflare Tunnel.
 * Restricted to known origins with apikey validation.
 */
import { NextRequest, NextResponse } from "next/server";

function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "http://127.0.0.1:54321"
  );
}

const ALLOWED_ORIGINS = new Set(
  (process.env.PROXY_ALLOWED_ORIGINS || "https://notiflow.life,http://localhost:3000,http://localhost:3002")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Access-Control-Max-Age": "86400",
  };
}

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  // Require apikey or authorization header
  const hasApiKey = request.headers.has("apikey");
  const hasAuth = request.headers.has("authorization");
  if (!hasApiKey && !hasAuth) {
    return NextResponse.json(
      { error: "Missing authentication" },
      { status: 401, headers: corsHeaders },
    );
  }

  const { path } = await params;
  const supabaseUrl = getSupabaseUrl();
  const targetPath = path.join("/");
  const url = new URL(request.url);
  const target = `${supabaseUrl}/${targetPath}${url.search}`;

  // Forward headers (strip host)
  const headers = new Headers(request.headers);
  headers.delete("host");

  const res = await fetch(target, {
    method: request.method,
    headers,
    body:
      request.method !== "GET" && request.method !== "HEAD"
        ? await request.arrayBuffer()
        : undefined,
  });

  // Forward response with CORS headers
  const responseHeaders = new Headers(res.headers);
  responseHeaders.delete("transfer-encoding");
  for (const [key, value] of Object.entries(corsHeaders)) {
    responseHeaders.set(key, value);
  }

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
```

- [ ] **Step 2: Verify build**

Run: `npm run build:web`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/supabase-proxy/\\[...path\\]/route.ts
git commit -m "fix(security): restrict supabase proxy to allowed origins, require auth headers"
```

---

### Task 5: Add Authentication to Tax Invoice PDF Route

**Files:**
- Modify: `apps/web/src/app/api/tax-invoice/[id]/pdf/route.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
import { createClient } from "@/lib/supabase/server";
import { getInvoice } from "@/lib/queries/invoices";
import { generateInvoicePdf } from "@/lib/tax-invoice/pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const invoiceId = parseInt(id, 10);

  if (isNaN(invoiceId)) {
    return Response.json(
      { error: "유효하지 않은 세금계산서 ID입니다." },
      { status: 400 }
    );
  }

  try {
    const invoice = await getInvoice(invoiceId);
    const pdfBytes = await generateInvoicePdf(invoice);

    // Sanitize filename — allow only alphanumeric, hyphen, underscore
    const safeName = invoice.invoice_number.replace(/[^a-zA-Z0-9_-]/g, "_");

    return new Response(pdfBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch {
    return Response.json(
      { error: "세금계산서를 찾을 수 없습니다." },
      { status: 404 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/tax-invoice/\\[id\\]/pdf/route.ts
git commit -m "fix(security): add auth check and filename sanitization to tax invoice PDF"
```

---

### Task 6: Add Authentication to Sync-MFDS Status Route

**Files:**
- Modify: `apps/web/src/app/api/sync-mfds/status/route.ts`

- [ ] **Step 1: Add auth check at the top of the GET handler**

Replace the file:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminSupabase, cleanupStaleLogs } from "@/lib/mfds-sync";

export async function GET() {
  // Auth check — this endpoint exposes internal sync state
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabase();

  // Auto-cleanup stale "running" logs (process died)
  await cleanupStaleLogs();

  // Find active or partial sync
  const { data: active } = await admin
    .from("mfds_sync_logs")
    .select("id, source_type, sync_mode, total_fetched, total_upserted, next_page, api_total_count, status, started_at, error_message")
    .in("status", ["running", "partial"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get counts per table
  const [drug, device] = await Promise.all([
    admin.from("mfds_drugs").select("id", { count: "exact", head: true }),
    admin.from("mfds_devices").select("id", { count: "exact", head: true }),
  ]);

  // Get meta
  const { data: meta } = await admin.from("mfds_sync_meta").select("*");

  return NextResponse.json({
    active: active ?? null,
    counts: {
      drug: drug.count ?? 0,
      device_std: device.count ?? 0,
    },
    meta: meta ?? [],
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/sync-mfds/status/route.ts
git commit -m "fix(security): add authentication to sync-mfds status endpoint"
```

---

### Task 7: Fix Cron Routes — Use Admin Client

**Files:**
- Modify: `apps/web/src/app/api/cron/daily-report/route.ts:2,17`
- Modify: `apps/web/src/app/api/cron/monthly-report/route.ts:2,17`

Cron routes run without cookies so `createClient()` (which reads cookies) gives an unauthenticated anon session. Replace with `createAdminClient` from the admin module.

- [ ] **Step 1: Fix daily-report**

In `apps/web/src/app/api/cron/daily-report/route.ts`:

Replace line 2:
```typescript
import { createAdminClient } from "@/lib/supabase/admin";
```

Replace line 17:
```typescript
  const supabase = createAdminClient();
```

- [ ] **Step 2: Fix monthly-report**

In `apps/web/src/app/api/cron/monthly-report/route.ts`:

Replace line 2:
```typescript
import { createAdminClient } from "@/lib/supabase/admin";
```

Replace line 17:
```typescript
  const supabase = createAdminClient();
```

- [ ] **Step 3: Verify build**

Run: `npm run build:web`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/cron/daily-report/route.ts apps/web/src/app/api/cron/monthly-report/route.ts
git commit -m "fix(security): use admin client in cron routes that run without cookie context"
```

---

### Task 8: Fix RLS Policies — Forecast Tables and My Drugs/Devices

**Files:**
- Create: `packages/supabase/migrations/00061_fix_rls_policies.sql`

- [ ] **Step 1: Create the migration**

```sql
-- Fix overly permissive RLS policies
-- Forecast tables: restrict to authenticated users only
-- My drugs/devices: remove anonymous read access

-- ═══ 1. Forecast tables — restrict from public to authenticated ═══

DROP POLICY IF EXISTS "dashboard_forecasts_all" ON order_forecasts;
CREATE POLICY "authenticated_forecasts_all" ON order_forecasts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dashboard_forecast_items_all" ON forecast_items;
CREATE POLICY "authenticated_forecast_items_all" ON forecast_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dashboard_order_patterns_all" ON order_patterns;
CREATE POLICY "authenticated_order_patterns_all" ON order_patterns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══ 2. My drugs/devices — remove anonymous read, keep authenticated ═══

DROP POLICY IF EXISTS "read_my_drugs" ON my_drugs;
DROP POLICY IF EXISTS "read_my_devices" ON my_devices;
```

- [ ] **Step 2: Commit**

```bash
git add packages/supabase/migrations/00061_fix_rls_policies.sql
git commit -m "fix(security): restrict forecast/my_drugs/my_devices RLS to authenticated only"
```

---

### Task 9: Add Authentication to send-push Edge Function

**Files:**
- Modify: `packages/supabase/functions/send-push/index.ts`

This function is called by a database webhook trigger. Add service-role key verification so it cannot be called by external users who discover the URL.

- [ ] **Step 1: Add auth check after line 103 (after supabase client creation)**

Insert after `const supabase = createClient(supabaseUrl, supabaseServiceKey);`:

```typescript
  // Verify the request is from a trusted source (database webhook or service role)
  const authHeader = req.headers.get("authorization");
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (authHeader !== `Bearer ${expectedKey}`) {
    // Check for webhook-specific header from Supabase
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
    const webhookHeader = req.headers.get("x-webhook-secret");
    if (!webhookSecret || webhookHeader !== webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add packages/supabase/functions/send-push/index.ts
git commit -m "fix(security): add auth verification to send-push edge function"
```

---

### Task 10: Add API Route Auth Middleware

**Files:**
- Create: `apps/web/src/middleware.ts`
- Modify: `apps/web/src/lib/supabase/middleware.ts` (reference only, no change needed)

Currently there is no `middleware.ts` at the app root. The auth check only happens in the `(dashboard)` layout and individual API routes. A missing auth check on any new API route is an open vulnerability. Add global middleware that protects `/api/` routes (except cron endpoints which use CRON_SECRET).

- [ ] **Step 1: Create the middleware**

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - API cron routes (use CRON_SECRET auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/cron).*)",
  ],
};
```

This ensures `updateSession` runs for all routes (including `/api/*` except `/api/cron/*`), which validates the Supabase session and redirects unauthenticated users. The `/api/cron/*` routes are excluded because they use `CRON_SECRET` bearer token auth instead.

- [ ] **Step 2: Verify build**

Run: `npm run build:web`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "fix(security): add global middleware for API route auth protection"
```
