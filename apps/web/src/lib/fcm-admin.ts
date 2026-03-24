/**
 * FCM Admin — server-side Firebase Cloud Messaging via service account JWT
 * Used by Server Actions to send push notifications directly,
 * bypassing Edge Functions (which may not be available locally).
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  // Handle escaped \\n from env vars
  const normalized = pem.replace(/\\n/g, '\n');
  const b64 = normalized.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const buf = Buffer.from(b64, 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64url');
}

function stringToBase64url(str: string): string {
  return Buffer.from(str).toString('base64url');
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = stringToBase64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = stringToBase64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));

  const signingInput = `${header}.${payload}`;
  const keyData = pemToArrayBuffer(sa.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${arrayBufferToBase64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) throw new Error(`OAuth token exchange failed: ${res.status}`);
  const data = await res.json();

  cachedToken = { token: data.access_token, expiresAt: Date.now() + 3500_000 };
  return data.access_token;
}

export async function sendFCMDataMessage(
  fcmToken: string,
  dataPayload: Record<string, string>,
): Promise<{ success: boolean; status: number; error?: string }> {
  const saJson = process.env.FCM_SERVICE_ACCOUNT;
  if (!saJson) return { success: false, status: 0, error: 'FCM_SERVICE_ACCOUNT not set' };

  const sa: ServiceAccount = JSON.parse(saJson);
  const accessToken = await getAccessToken(sa);

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          data: dataPayload,
          android: { priority: 'high' },
        },
      }),
    },
  );

  if (res.ok) return { success: true, status: 200 };

  const errText = await res.text();
  return { success: false, status: res.status, error: errText };
}
