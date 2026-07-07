import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from './firebase';

// Storage key for custom VAPID Key
const VAPID_KEY_STORAGE_ID = 'kidria_fcm_vapid_key';

// A default public VAPID Key placeholder.
// The user can configure their own VAPID key in the Settings UI or in the code.
const FALLBACK_VAPID_KEY = 'BCOt476mNOf4Ea7eCofmBvP89TfG-pYpU_g1uP2-Zc63zP5vP_gYpU-OjlzeNBQcMFynJM2nrj3Lh4';

export function getStoredVapidKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(VAPID_KEY_STORAGE_ID) || '';
}

export function saveStoredVapidKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (key.trim()) {
    localStorage.setItem(VAPID_KEY_STORAGE_ID, key.trim());
  } else {
    localStorage.removeItem(VAPID_KEY_STORAGE_ID);
  }
}

/**
 * Checks if Push Notifications / FCM is supported in the current browser environment
 */
export async function isFcmSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
    return false;
  }
  try {
    return await isSupported();
  } catch (err) {
    return false;
  }
}

/**
 * Request notification permission and return the FCM registration token.
 * Also registers '/firebase-messaging-sw.js' service worker.
 */
export async function requestFcmToken(
  userId: string,
  email: string,
  role: string,
  customVapidKey?: string
): Promise<string | null> {
  const supported = await isFcmSupported();
  if (!supported) {
    console.warn('[FCM client] Push notifications are not supported in this browser.');
    return null;
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM client] Notification permission denied:', permission);
      return null;
    }

    // Register FCM Service Worker
    console.log('[FCM client] Registering FCM Service Worker...');
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope' // Scope it differently or default
    }).catch(async () => {
      // Fallback: register at root if custom scope fails
      return await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    });

    const messagingInstance = getMessaging(app);
    const activeVapidKey = customVapidKey || getStoredVapidKey() || FALLBACK_VAPID_KEY;

    console.log('[FCM client] Requesting token with VAPID Key:', activeVapidKey);
    const token = await getToken(messagingInstance, {
      vapidKey: activeVapidKey,
      serviceWorkerRegistration: registration
    });

    if (token) {
      console.log('[FCM client] Token generated successfully:', token);
      
      // Save token to server backend
      await fetch('/api/fcm-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          userId,
          email,
          role,
          userAgent: navigator.userAgent
        })
      });
      
      return token;
    } else {
      console.warn('[FCM client] No token returned from FCM.');
      return null;
    }
  } catch (err: any) {
    console.error('[FCM client error] Failed to retrieve FCM token:', err);
    throw err;
  }
}

/**
 * Listen for foreground push notifications when the app is active
 */
export async function initForegroundNotificationListener(onNotificationReceived: (payload: any) => void): Promise<() => void> {
  const supported = await isFcmSupported();
  if (!supported) return () => {};

  try {
    const messagingInstance = getMessaging(app);
    return onMessage(messagingInstance, (payload) => {
      console.log('[FCM client] Received foreground message:', payload);
      onNotificationReceived(payload);
    });
  } catch (err) {
    console.warn('[FCM client] Could not initialize foreground listener:', err);
    return () => {};
  }
}

/**
 * Clear FCM subscription token locally and on the server
 */
export async function unsubscribeFcm(token: string): Promise<void> {
  try {
    await fetch('/api/fcm-token/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    console.log('[FCM client] Unsubscribed successfully.');
  } catch (err) {
    console.error('[FCM client] Failed to delete token on server:', err);
  }
}

/**
 * Play a high-quality dual-tone notification chime using the native Web Audio API
 * compatible with iOS, Android, and PWAs in the browser.
 */
export function playNotificationSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Play a gentle dual-tone chime
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      
      osc.start(start);
      osc.stop(start + duration);
    };

    const now = ctx.currentTime;
    // Standard beautiful chime: E5 followed by A5
    playTone(659.25, now, 0.25); // E5
    playTone(880.00, now + 0.08, 0.35); // A5
  } catch (err) {
    console.warn('Web Audio chime blocked or not supported:', err);
  }
}

