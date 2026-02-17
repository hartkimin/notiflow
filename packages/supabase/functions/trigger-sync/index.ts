import { createClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// CORS headers (consistent with manage-users Edge Function)
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// Helpers: PEM / Base64url conversion for Deno crypto.subtle RS256 signing
// (shared with send-push — extracted for reuse)
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
// Types
// ---------------------------------------------------------------------------

interface DeviceResult {
  device_id: string;
  device_name: string;
  fcm_sent: boolean;
  realtime_updated: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Edge Function entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Single service-role client (bypasses RLS for DB operations + auth verification)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ------------------------------------------------------------------
    // 1. Verify caller identity (same pattern as manage-users)
    // ------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Missing or invalid Authorization header", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse("Invalid or expired token", 401);
    }

    // ------------------------------------------------------------------
    // 2. Parse request body
    // ------------------------------------------------------------------
    const body = await req.json();
    const deviceId: string | undefined = body.device_id;

    if (!deviceId) {
      return errorResponse("device_id is required (specific ID or \"all\")");
    }

    // ------------------------------------------------------------------
    // 3. Query target devices (ownership check via user_id)
    // ------------------------------------------------------------------
    let query = supabase
      .from("mobile_devices")
      .select("id, device_name, fcm_token, is_active")
      .eq("user_id", user.id);

    if (deviceId !== "all") {
      query = query.eq("id", deviceId);
    } else {
      query = query.eq("is_active", true);
    }

    const { data: devices, error: queryError } = await query;
    if (queryError) {
      return errorResponse(`DB query failed: ${queryError.message}`, 500);
    }

    if (!devices || devices.length === 0) {
      return errorResponse("No devices found", 404);
    }

    // ------------------------------------------------------------------
    // 4. Update sync_requested_at (Realtime fallback)
    // ------------------------------------------------------------------
    const deviceIds = devices.map((d) => d.id);
    const now = new Date().toISOString();

    await supabase
      .from("mobile_devices")
      .update({ sync_requested_at: now })
      .in("id", deviceIds);

    // ------------------------------------------------------------------
    // 5. Attempt FCM data-only messages
    // ------------------------------------------------------------------
    const fcmServiceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT");
    let fcmAvailable = false;
    let accessToken = "";
    let projectId = "";

    if (fcmServiceAccountJson) {
      try {
        const serviceAccount = JSON.parse(fcmServiceAccountJson);
        accessToken = await getAccessToken(serviceAccount);
        projectId = serviceAccount.project_id;
        fcmAvailable = true;
      } catch (e) {
        console.error("FCM setup failed:", (e as Error).message);
      }
    } else {
      console.warn("FCM_SERVICE_ACCOUNT not set — using Realtime only");
    }

    const details: DeviceResult[] = [];
    let fcmSent = 0;
    let fcmFailed = 0;

    for (const device of devices) {
      const result: DeviceResult = {
        device_id: device.id,
        device_name: device.device_name,
        fcm_sent: false,
        realtime_updated: true,
      };

      if (!fcmAvailable || !device.fcm_token) {
        result.error = !fcmAvailable
          ? "FCM not configured"
          : "No FCM token";
        fcmFailed++;
        details.push(result);
        continue;
      }

      // Send FCM data-only message (no notification field!)
      const fcmPayload = {
        message: {
          token: device.fcm_token,
          data: {
            type: "sync_request",
            requested_at: now,
          },
          android: { priority: "high" },
        },
      };

      try {
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

        if (fcmResponse.ok) {
          result.fcm_sent = true;
          fcmSent++;
        } else {
          const errBody = await fcmResponse.text();
          console.error(`FCM send failed for ${device.id} (${fcmResponse.status}):`, errBody);
          result.error = `FCM ${fcmResponse.status}`;
          fcmFailed++;

          // Expired/invalid token (404 or 400) → clear from DB
          if (fcmResponse.status === 404 || fcmResponse.status === 400) {
            await supabase
              .from("mobile_devices")
              .update({ fcm_token: null })
              .eq("id", device.id);
            result.error += " (token cleared)";
          }
        }
      } catch (e) {
        result.error = (e as Error).message;
        fcmFailed++;
      }

      details.push(result);
    }

    // ------------------------------------------------------------------
    // 6. Return result
    // ------------------------------------------------------------------
    return jsonResponse({
      success: true,
      fcm_sent: fcmSent,
      fcm_failed: fcmFailed,
      realtime_updated: devices.length,
      details,
    });
  } catch (err) {
    console.error("trigger-sync unexpected error:", err);
    return errorResponse(`Internal server error: ${(err as Error).message}`, 500);
  }
});
