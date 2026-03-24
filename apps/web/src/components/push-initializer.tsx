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
        if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;
        }

        if (Notification.permission !== 'granted') return;

        const token = await getFCMToken();
        if (token) {
          await saveWebPushToken(userId, token);
        }

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
