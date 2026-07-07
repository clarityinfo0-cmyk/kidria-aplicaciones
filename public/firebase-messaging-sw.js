// Firebase Cloud Messaging Service Worker for KIDRIA
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBy6W6HeZb0UjlzeNBQcMFynJM2nrj3Lh4",
  authDomain: "ceremonial-hull-z79b0.firebaseapp.com",
  projectId: "ceremonial-hull-z79b0",
  storageBucket: "ceremonial-hull-z79b0.firebasestorage.app",
  messagingSenderId: "629717376985",
  appId: "1:629717376985:web:b0e2c8efd43f199f12c3c8"
};

// Initialize Firebase App inside Service Worker
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background notifications
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM Service Worker] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'Notificación de KIDRIA';
  const notificationOptions = {
    body: payload.notification?.body || 'Tienes una nueva actualización en tu cuenta.',
    icon: '/logo.jpg',
    badge: '/logo.jpg',
    data: {
      link: payload.data?.link || '/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle click on notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const targetUrl = event.notification.data?.link || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window client is already open, navigate/focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
