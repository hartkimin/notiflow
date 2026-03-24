// Firebase Messaging Service Worker
// Handles background push notifications for NotiFlow web dashboard

importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.7.1/firebase-messaging-compat.js');

// Firebase config is injected at runtime via query string from the main app.
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

// Notification click handler
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
