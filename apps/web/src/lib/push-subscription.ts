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
