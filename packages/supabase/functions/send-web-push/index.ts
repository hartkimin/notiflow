import { createClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Helpers (same as send-push)
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
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function stringToBase64url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

    const senderName: string = record.sender_name || record.app_name || "알 수 없음";
    const messagePreview: string = (record.body || record.content || "").substring(0, 100);

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

    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    let sent = 0;
    let failed = 0;
    const invalidTokenIds: number[] = [];

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
        if (status === 404 || status === 400) {
          invalidTokenIds.push(tokenRow.id);
        }
        const errText = await fcmRes.text();
        console.error(`FCM send failed for token ${tokenRow.id} (${status}):`, errText);
      }
    }

    // Remove invalid tokens
    if (invalidTokenIds.length > 0) {
      await supabase.from("device_tokens").delete().in("id", invalidTokenIds);
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
