/**
 * FCM Admin — server-side Firebase Cloud Messaging via firebase-admin SDK
 */

import admin from 'firebase-admin';

function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const saJson = process.env.FCM_SERVICE_ACCOUNT;
  if (!saJson) throw new Error('FCM_SERVICE_ACCOUNT not set');

  const sa = JSON.parse(saJson);
  // Handle escaped \\n in private_key from env vars
  if (sa.private_key) {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }

  return admin.initializeApp({
    credential: admin.credential.cert(sa),
  });
}

export async function sendFCMDataMessage(
  fcmToken: string,
  dataPayload: Record<string, string>,
): Promise<{ success: boolean; status: number; error?: string }> {
  try {
    const app = getApp();
    const messaging = admin.messaging(app);

    const result = await messaging.send({
      token: fcmToken,
      data: dataPayload,
      // notification field ensures delivery even when app is killed
      notification: {
        title: '동기화 요청',
        body: '새로운 데이터를 동기화합니다.',
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'orders',
          sound: 'default',
          clickAction: 'SYNC_ACTION',
        },
      },
    });

    console.log('FCM send success:', result);
    return { success: true, status: 200 };
  } catch (err) {
    const error = err as { code?: string; message?: string };
    console.error('FCM send error:', error.code, error.message);

    // Map Firebase error codes to HTTP status for token cleanup logic
    const invalidTokenCodes = [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
    ];
    const status = invalidTokenCodes.includes(error.code ?? '') ? 404 : 500;

    return { success: false, status, error: error.message ?? 'FCM send failed' };
  }
}
