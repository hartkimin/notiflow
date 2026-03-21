import { createClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Helpers: PEM / Base64url conversion for Deno crypto.subtle RS256 signing
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

// ---------------------------------------------------------------------------
// Create a self-signed JWT and exchange it for a Google OAuth2 access token
// ---------------------------------------------------------------------------

async function getAccessToken(
  serviceAccount: { client_email: string; private_key: string; project_id: string },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = stringToBase64url(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  );

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

  // Import the RSA private key for signing
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

  // Exchange JWT for access token
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
  // Supabase client (uses service-role key so we can write to notification_logs)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
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

    // ------------------------------------------------------------------
    // 1. Parse the Database Webhook payload
    // ------------------------------------------------------------------
    const body = await req.json();
    const record = body.record;

    if (!record) {
      return new Response(
        JSON.stringify({ error: "No record in webhook payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const orderId: number = record.id;
    const orderNumber: string = record.order_number;
    const hospitalId: number = record.hospital_id;

    // ------------------------------------------------------------------
    // 2. Query order details: hospital name + order_items count
    // ------------------------------------------------------------------
    const { data: hospital } = await supabase
      .from("hospitals")
      .select("name")
      .eq("id", hospitalId)
      .single();

    const hospitalName: string = hospital?.name ?? `병원 #${hospitalId}`;

    const { count: itemCount } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId);

    const finalItemCount = itemCount ?? record.total_items ?? 0;

    // ------------------------------------------------------------------
    // 3. Check FCM_SERVICE_ACCOUNT env var
    // ------------------------------------------------------------------
    const fcmServiceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT");

    if (!fcmServiceAccountJson) {
      console.warn("FCM_SERVICE_ACCOUNT env var is not set. Skipping push notification.");

      await supabase.from("notification_logs").insert({
        event_type: "order_created",
        channel: "fcm",
        recipient: "topic:orders",
        message: `새 주문: ${hospitalName} (${finalItemCount}건)`,
        status: "failed",
        related_id: orderId,
        sent_at: new Date().toISOString(),
        error_message: "FCM_SERVICE_ACCOUNT env var is not set",
      });

      return new Response(
        JSON.stringify({ skipped: true, reason: "FCM_SERVICE_ACCOUNT not configured" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const serviceAccount = JSON.parse(fcmServiceAccountJson);

    // ------------------------------------------------------------------
    // 4. Get Google access token via service account JWT
    // ------------------------------------------------------------------
    const accessToken = await getAccessToken(serviceAccount);

    // ------------------------------------------------------------------
    // 5. Send FCM v1 push notification to topic "orders"
    // ------------------------------------------------------------------
    const projectId = serviceAccount.project_id;

    const fcmPayload = {
      message: {
        topic: "orders",
        notification: {
          title: `새 주문: ${hospitalName}`,
          body: `${finalItemCount}건 품목 | ${orderNumber}`,
        },
        data: {
          order_id: String(orderId),
          order_number: orderNumber,
        },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channel_id: "orders",
          },
        },
      },
    };

    const fcmResponse = await fetch(
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

    let fcmError: string | undefined;
    if (!fcmResponse.ok) {
      fcmError = await fcmResponse.text();
      console.error(`FCM API error (${fcmResponse.status}):`, fcmError);
    }

    // ------------------------------------------------------------------
    // 6. Log to notification_logs
    // ------------------------------------------------------------------
    await supabase.from("notification_logs").insert({
      event_type: "order_created",
      channel: "fcm",
      recipient: "topic:orders",
      message: `새 주문: ${hospitalName} (${finalItemCount}건)`,
      status: fcmResponse.ok ? "sent" : "failed",
      related_id: orderId,
      sent_at: new Date().toISOString(),
      ...(fcmError ? { error_message: fcmError } : {}),
    });

    // ------------------------------------------------------------------
    // 7. Return success (always 200 so we don't break the webhook)
    // ------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        success: fcmResponse.ok,
        order_id: orderId,
        order_number: orderNumber,
        ...(fcmError ? { fcm_error: fcmError } : {}),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-push unexpected error:", err);

    // Best-effort: log the failure
    try {
      await supabase.from("notification_logs").insert({
        event_type: "order_created",
        channel: "fcm",
        recipient: "topic:orders",
        message: `Push notification failed: ${(err as Error).message}`,
        status: "failed",
        sent_at: new Date().toISOString(),
        error_message: (err as Error).message,
      });
    } catch (logErr) {
      console.error("Failed to write error to notification_logs:", logErr);
    }

    // Still return 200 to avoid breaking the database webhook
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
});
