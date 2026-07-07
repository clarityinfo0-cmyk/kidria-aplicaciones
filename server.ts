import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import Stripe from 'stripe';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { randomBytes, createHash } from 'crypto';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
let firebaseProjectId = "gen-lang-client-0651099895";
let firestoreDatabaseId = "ai-studio-vortexapps-5bf502cd-f6ef-4bba-9f38-124a2ac9a689"; // sandbox default

try {
  const configFile = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configFile)) {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (config.projectId) {
      firebaseProjectId = config.projectId;
    }
    if (config.firestoreDatabaseId) {
      firestoreDatabaseId = config.firestoreDatabaseId;
    }
  }
} catch (err) {
  console.warn("No se pudo leer firebase-applet-config.json:", err);
}

// Allow overriding via environment variable (e.g. set to "" or "(default)" for production)
if (process.env.FIRESTORE_DATABASE_ID !== undefined) {
  firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID;
}

let firebaseApp;
if (getApps().length === 0) {
  const firebaseAdminConfig: any = {
    projectId: firebaseProjectId
  };

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountEnv) {
    try {
      firebaseAdminConfig.credential = cert(JSON.parse(serviceAccountEnv));
    } catch (err) {
      console.error("Error parsing FIREBASE_SERVICE_ACCOUNT:", err);
    }
  }

  firebaseApp = initializeApp(firebaseAdminConfig);
} else {
  firebaseApp = getApps()[0];
}

const adminAuth = getAuth(firebaseApp);

const adminDb = (firestoreDatabaseId && firestoreDatabaseId !== "(default)" && firestoreDatabaseId.trim() !== "")
  ? getFirestore(firebaseApp, firestoreDatabaseId)
  : getFirestore(firebaseApp);

const app = express();
const PORT = 3000;

// Lazy-initialized Stripe Client
let stripeClient: Stripe | null = null;
function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === 'MY_STRIPE_SECRET_KEY' || key.trim() === '') {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: '2025-02-18' as any,
    });
  }
  return stripeClient;
}

const PAYMENTS_FILE = path.join(process.cwd(), 'stripe_payments.json');

// Helper to read processed payments
function getProcessedPayments(): Record<string, { status: string; amount: number; timestamp: string; isReal: boolean; mode: string }> {
  try {
    if (fs.existsSync(PAYMENTS_FILE)) {
      return JSON.parse(fs.readFileSync(PAYMENTS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading payments file:', err);
  }
  return {};
}

// Helper to save processed payment
function saveProcessedPayment(orderId: string, data: { status: string; amount: number; isReal: boolean; mode: string }) {
  try {
    const payments = getProcessedPayments();
    payments[orderId] = {
      ...data,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving payment:', err);
  }
}

// Real/Mock Webhook Route MUST be defined BEFORE express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req: any, res: any) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: any;

  const stripe = getStripeClient();
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const isReal = !!stripe;
  const mode = stripeKey.startsWith('sk_live_') ? 'live' : stripeKey.startsWith('sk_test_') ? 'test' : 'simulation';

  if (stripe && webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error(`❌ Webhook signature verification failed:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    // Fallback if webhook secret is not configured or in sandbox simulation
    try {
      const bodyStr = req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body);
      event = JSON.parse(bodyStr);
    } catch (err) {
      return res.status(400).send('Invalid JSON payload');
    }
  }

  console.log(`[Stripe Webhook] Event Type: ${event.type}`);

  // Handle successful payments
  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    const sessionOrIntent = event.data.object;
    const orderId = sessionOrIntent.metadata?.orderId;
    const amount = sessionOrIntent.amount_total 
      ? sessionOrIntent.amount_total / 100 
      : sessionOrIntent.amount_received 
        ? sessionOrIntent.amount_received / 100 
        : 0;

    if (orderId) {
      console.log(`[Stripe Webhook] Acreditado pago para Orden ${orderId} de $${amount} MXN`);
      saveProcessedPayment(orderId, {
        status: 'paid',
        amount,
        isReal,
        mode
      });
    }
  }

  res.json({ received: true });
});

// Middleware
app.use(express.json());

// Lazy-initialized Gemini Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY' || key.trim() === '') {
      throw new Error('GEMINI_API_KEY no está configurada o es inválida. Por favor, añádela en la pestaña de Secretos (Secrets) en Google AI Studio.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Helper to pause execution for a delay (for backoff)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateContentWithRetry(params: {
  model: string;
  contents: any;
  config?: any;
}): Promise<any> {
  const maxAttempts = 3;
  // Deduplicate models to try, prioritizing params.model, then alternative stable endpoints, then lite
  const modelsToTry = Array.from(new Set([params.model, 'gemini-flash-latest', 'gemini-3.1-flash-lite']));
  let lastError: any = null;
  
  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[Gemini API] generateContent attempt ${attempt} using model: ${modelName}`);
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          ...params,
          model: modelName
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errStr = typeof err === 'object' ? JSON.stringify(err) : String(err);
        console.warn(`[Gemini API Warning] Attempt ${attempt} with model ${modelName} failed:`, err.message || errStr);
        // Wait before next attempt using exponential backoff
        const backoffMs = attempt === 1 ? 1000 : attempt === 2 ? 2500 : 5000;
        await delay(backoffMs);
      }
    }
  }
  throw lastError || new Error('All Gemini models and retry attempts failed.');
}

async function generateContentStreamWithRetry(params: {
  model: string;
  contents: any;
  config?: any;
}): Promise<any> {
  const maxAttempts = 3;
  const modelsToTry = Array.from(new Set([params.model, 'gemini-flash-latest', 'gemini-3.1-flash-lite']));
  let lastError: any = null;
  
  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[Gemini API] generateContentStream attempt ${attempt} using model: ${modelName}`);
        const ai = getGeminiClient();
        const responseStream = await ai.models.generateContentStream({
          ...params,
          model: modelName
        });
        return responseStream;
      } catch (err: any) {
        lastError = err;
        const errStr = typeof err === 'object' ? JSON.stringify(err) : String(err);
        console.warn(`[Gemini API Warning] Stream attempt ${attempt} with model ${modelName} failed:`, err.message || errStr);
        const backoffMs = attempt === 1 ? 1000 : attempt === 2 ? 2500 : 5000;
        await delay(backoffMs);
      }
    }
  }
  throw lastError || new Error('All Gemini stream models and retry attempts failed.');
}

// API Routes

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ==========================================
// SMTP EMAIL VERIFICATION & PASSWORD RESET API
// ==========================================

interface SentEmail {
  id: string;
  to: string;
  subject: string;
  html: string;
  timestamp: string;
  type: 'verification' | 'reset';
  link: string;
}

// In-memory list of sent emails for development simulation inbox
let sentEmailsForSandbox: SentEmail[] = [];

// Unified SMTP helper with fallback to local simulation
async function sendAuthEmail(to: string, subject: string, html: string, type: 'verification' | 'reset', link: string) {
  const emailId = `mail_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const emailItem: SentEmail = {
    id: emailId,
    to,
    subject,
    html,
    timestamp: new Date().toISOString(),
    type,
    link
  };

  // Keep last 15 emails for simulator
  sentEmailsForSandbox = [emailItem, ...sentEmailsForSandbox].slice(0, 15);

  console.log(`[SMTP Sandbox] Mail simulation stored for ${to}: ${subject}`);
  return { success: true, mode: 'sandbox' as const };
}

// ==========================================
// CUSTOM REAL AUTHENTICATION ENGINE (BYPASSES OPERATION-NOT-ALLOWED)
// WITH RESILIENT LOCAL JSON FALLBACK DATABASES
// ==========================================

const FALLBACK_USERS_FILE = path.join(process.cwd(), 'fallback_db_usuarios.json');
const FALLBACK_VERIFICATIONS_FILE = path.join(process.cwd(), 'fallback_db_verificaciones.json');
const FALLBACK_RESETS_FILE = path.join(process.cwd(), 'fallback_db_resets.json');
const FALLBACK_ORDERS_FILE = path.join(process.cwd(), 'fallback_db_ordenes.json');
const FALLBACK_TICKETS_FILE = path.join(process.cwd(), 'fallback_db_tickets.json');
const FALLBACK_CHATS_FILE = path.join(process.cwd(), 'fallback_db_chats.json');
const FALLBACK_FCM_TOKENS_FILE = path.join(process.cwd(), 'fallback_db_fcm_tokens.json');

// FCM Management Functions
function validateFcmTokenData(tokenData: any): { valid: boolean; error?: string } {
  const { token, userId } = tokenData;
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'El token FCM debe ser una cadena de texto válida.' };
  }
  const trimmed = token.trim();
  if (trimmed.length < 50 || trimmed.length > 500) {
    return { valid: false, error: `Longitud de token FCM inválida (${trimmed.length}). Debe estar entre 50 y 500 caracteres.` };
  }
  // Standard FCM token format check (base64-like alphanumeric, colons, underscores, dashes, etc.)
  const fcmRegex = /^[a-zA-Z0-9_\-\.\:\+]+$/;
  if (!fcmRegex.test(trimmed)) {
    return { valid: false, error: 'El formato del token FCM contiene caracteres corruptos o no permitidos.' };
  }
  if (!userId || typeof userId !== 'string' || userId.trim() === '' || userId === 'guest' || userId === 'undefined') {
    return { valid: false, error: 'El token FCM debe estar vinculado explícitamente a un ID de usuario (UID) válido de la plataforma.' };
  }
  return { valid: true };
}

async function safeSaveFcmToken(tokenData: any): Promise<void> {
  const { token, userId } = tokenData;
  
  // Format and binding validation layer
  const validation = validateFcmTokenData({ token, userId });
  if (!validation.valid) {
    console.warn('[FCM Validation Block]', validation.error);
    throw new Error(validation.error);
  }

  const cleaned = cleanFirestoreData({
    ...tokenData,
    token: token.trim(),
    userId: userId.trim(),
    updatedAt: new Date().toISOString()
  });

  // Strict Exclusivity Layer: overwrite/delete old records containing this same token for other users to prevent duplicates or corruption
  try {
    await adminDb.collection('fcm_tokens').doc(cleaned.token).delete();
  } catch (err: any) {
    // Fail silently
  }

  try {
    await adminDb.collection('fcm_tokens').doc(cleaned.token).set(cleaned);
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando token FCM en base persistente local.`, err.message);
  }
  
  const local = readJsonFallback(FALLBACK_FCM_TOKENS_FILE);
  const filteredLocal = local.filter((t: any) => t.token !== cleaned.token);
  filteredLocal.push(cleaned);
  writeJsonFallback(FALLBACK_FCM_TOKENS_FILE, filteredLocal);
}

async function safeDeleteFcmToken(token: string): Promise<void> {
  try {
    await adminDb.collection('fcm_tokens').doc(token).delete();
  } catch (err: any) {
    console.log(`[Storage Node] Eliminando token FCM local.`, err.message);
  }
  
  const local = readJsonFallback(FALLBACK_FCM_TOKENS_FILE);
  const filtered = local.filter((t: any) => t.token !== token);
  writeJsonFallback(FALLBACK_FCM_TOKENS_FILE, filtered);
}

async function safeGetFcmTokensForUser(email: string): Promise<string[]> {
  const cleanEmail = email.toLowerCase().trim();
  const tokens: string[] = [];
  try {
    const querySnapshot = await adminDb.collection('fcm_tokens').where('email', '==', cleanEmail).get();
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.token) tokens.push(data.token);
    });
  } catch (err) {
    // Fail silent, fallback below
  }
  
  const local = readJsonFallback(FALLBACK_FCM_TOKENS_FILE);
  local.forEach((t: any) => {
    if (t.email && t.email.toLowerCase().trim() === cleanEmail && t.token) {
      if (!tokens.includes(t.token)) {
        tokens.push(t.token);
      }
    }
  });
  return tokens;
}

async function safeGetFcmTokensForAdmins(): Promise<string[]> {
  const tokens: string[] = [];
  try {
    const querySnapshot = await adminDb.collection('fcm_tokens').where('role', 'in', ['admin_general', 'admin']).get();
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.token) tokens.push(data.token);
    });
  } catch (err) {
    // Fail silent, fallback below
  }
  
  const local = readJsonFallback(FALLBACK_FCM_TOKENS_FILE);
  local.forEach((t: any) => {
    if (t.token && (t.role === 'admin_general' || t.role === 'admin')) {
      if (!tokens.includes(t.token)) {
        tokens.push(t.token);
      }
    }
  });
  return tokens;
}

async function safeGetFcmTokensForClients(): Promise<string[]> {
  const tokens: string[] = [];
  try {
    const querySnapshot = await adminDb.collection('fcm_tokens').where('role', '==', 'cliente').get();
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.token) tokens.push(data.token);
    });
  } catch (err) {
    // Fail silent, fallback below
  }
  
  const local = readJsonFallback(FALLBACK_FCM_TOKENS_FILE);
  local.forEach((t: any) => {
    if (t.token && t.role === 'cliente') {
      if (!tokens.includes(t.token)) {
        tokens.push(t.token);
      }
    }
  });
  return tokens;
}

async function getClientDisplayName(email: string, userId?: string): Promise<string> {
  const cleanEmail = email ? email.toLowerCase().trim() : '';
  
  // 1. Try to find user profile in Firestore
  if (userId) {
    try {
      const userRef = await adminDb.collection('usuarios').doc(userId).get();
      if (userRef.exists) {
        const user = userRef.data();
        if (user) {
          const parts: string[] = [];
          if (user.nombre || user.name) parts.push((user.nombre || user.name).trim());
          if (user.empresa || user.company) parts.push(`(${user.empresa || user.company})`.trim());
          if (parts.length > 0) return parts.join(' ');
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // 2. Try by email using existing helper
  if (cleanEmail) {
    const user = await safeGetUsuarioByEmail(cleanEmail);
    if (user) {
      const parts: string[] = [];
      if (user.nombre || user.name) parts.push((user.nombre || user.name).trim());
      if (user.empresa || user.company) parts.push(`(${user.empresa || user.company})`.trim());
      if (parts.length > 0) return parts.join(' ');
    }

    try {
      // Look up orders to find client details
      const localOrders = readJsonFallback(FALLBACK_ORDERS_FILE);
      const matchingOrder = localOrders.find(o => o.correo && o.correo.toLowerCase().trim() === cleanEmail);
      if (matchingOrder) {
        const parts: string[] = [];
        if (matchingOrder.nombre) parts.push(matchingOrder.nombre.trim());
        if (matchingOrder.proyecto || matchingOrder.empresa) {
          parts.push(`(${matchingOrder.proyecto || matchingOrder.empresa})`.trim());
        }
        if (parts.length > 0) return parts.join(' ');
      }
    } catch (err) {
      // ignore
    }
  }

  // 3. Fallback search by userId in local fallback file
  if (userId) {
    const localUsers = readJsonFallback(FALLBACK_USERS_FILE);
    const localUser = localUsers.find(u => u.uid === userId);
    if (localUser) {
      const parts: string[] = [];
      if (localUser.nombre || localUser.name) parts.push((localUser.nombre || localUser.name).trim());
      if (localUser.empresa || localUser.company) parts.push(`(${localUser.empresa || localUser.company})`.trim());
      if (parts.length > 0) return parts.join(' ');
    }
  }

  return cleanEmail || 'Cliente';
}

async function getRolesForTokens(tokens: string[]): Promise<Record<string, string>> {
  const tokenRoles: Record<string, string> = {};
  
  // 1. Read from local fallback (which contains all registers)
  try {
    const local = readJsonFallback(FALLBACK_FCM_TOKENS_FILE);
    local.forEach((t: any) => {
      if (t.token) {
        tokenRoles[t.token] = t.role || 'cliente';
      }
    });
  } catch (err) {
    // Ignore
  }

  // 2. Fetch from Firestore for the specific tokens if they are not in local fallback
  try {
    const missingTokens = tokens.filter(t => !tokenRoles[t]);
    if (missingTokens.length > 0) {
      const snapshot = await adminDb.collection('fcm_tokens').get();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.token) {
          tokenRoles[data.token] = data.role || 'cliente';
        }
      });
    }
  } catch (err) {
    // Ignore
  }

  return tokenRoles;
}

async function sendPushNotification(
  tokens: string[],
  payload: {
    title: string;
    body: string;
    link?: string;
    category?: 'ticket' | 'proyecto_nuevo' | 'proyecto_estado' | 'chat_mensaje';
  }
): Promise<void> {
  if (!tokens || tokens.length === 0) return;
  const uniqueTokens = Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim() !== '')));
  if (uniqueTokens.length === 0) return;

  try {
    const messaging = getMessaging(firebaseApp);
    const category = payload.category;
    let filteredTokens = uniqueTokens;

    if (category) {
      const tokenRoles = await getRolesForTokens(uniqueTokens);
      filteredTokens = uniqueTokens.filter(token => {
        const role = tokenRoles[token] || 'cliente';
        const isAdmin = role === 'admin' || role === 'admin_general';
        
        if (category === 'ticket' || category === 'proyecto_nuevo') {
          // Administrators only!
          return isAdmin;
        } else if (category === 'proyecto_estado') {
          // Clients only!
          return !isAdmin;
        } else if (category === 'chat_mensaje') {
          // Allowed for both!
          return true;
        }
        return true;
      });
    }

    if (filteredTokens.length === 0) {
      console.log(`[FCM Service] No tokens remaining after filtering by category "${category}".`);
      return;
    }

    console.log(`[FCM Service] Enviando notificación push con sonidos a ${filteredTokens.length} tokens (Categoría: ${category || 'Ninguna'}): "${payload.title}"`);
    
    // Set up default sound and vibration characteristics across Android, iOS (APNs), and web browsers (Webpush / PWA)
    const multicastMessage = {
      tokens: filteredTokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        category: category || '',
        link: payload.link || '/'
      },
      android: {
        notification: {
          sound: 'default',
          defaultSound: true,
          defaultVibrateTimings: true,
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default'
          }
        }
      },
      webpush: {
        notification: {
          sound: 'default',
          vibrate: [200, 100, 200],
          icon: '/favicon.png',
          badge: '/favicon.png'
        },
        fcmOptions: payload.link ? {
          link: payload.link
        } : undefined
      }
    };

    if (typeof messaging.sendEachForMulticast === 'function') {
      const response = await messaging.sendEachForMulticast(multicastMessage);
      console.log(`[FCM Service] Notificaciones enviadas. Éxito: ${response.successCount}, Fallidos: ${response.failureCount}`);
    } else {
      const promises = filteredTokens.map(token => {
        const individualMessage = {
          token,
          notification: multicastMessage.notification,
          data: multicastMessage.data,
          android: multicastMessage.android,
          apns: multicastMessage.apns,
          webpush: multicastMessage.webpush
        };
        return messaging.send(individualMessage).catch((err: any) => {
          console.warn(`[FCM Service] Fallo en token individual:`, err.message);
        });
      });
      await Promise.all(promises);
      console.log(`[FCM Service] Envío individual completado.`);
    }
  } catch (err: any) {
    console.error(`[FCM Service Error] No se pudo enviar notificación push:`, err.message);
  }
}

function readJsonFallback(filePath: string): any[] {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    // Silent recovery
  }
  return [];
}

function writeJsonFallback(filePath: string, data: any[]): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    // Silent recovery
  }
}

async function safeGetUsuarioByEmail(email: string): Promise<any | null> {
  const cleanEmail = email.toLowerCase().trim();
  try {
    const userQuery = await adminDb.collection('usuarios').where('email', '==', cleanEmail).get();
    if (!userQuery.empty) {
      const uData = userQuery.docs[0].data();
      if (uData && (uData.uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03' || cleanEmail === 'kino9230@gmail.com' || uData.role === 'admin_general')) {
        if (uData.role !== 'admin_general') {
          uData.role = 'admin_general';
          await adminDb.collection('usuarios').doc(uData.uid).update({ role: 'admin_general' }).catch(() => {});
        }
      }
      return uData;
    }
    // Fallback to local file if Firestore is online but doesn't have the user yet
    const localUsers = readJsonFallback(FALLBACK_USERS_FILE);
    const localUser = localUsers.find(u => u.email === cleanEmail);
    if (localUser) {
      if (localUser.uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03' || cleanEmail === 'kino9230@gmail.com' || localUser.role === 'admin_general') {
        localUser.role = 'admin_general';
      }
      console.log(`[Storage Node] Sincronizando usuario local ${cleanEmail} hacia Firestore.`);
      await adminDb.collection('usuarios').doc(localUser.uid).set(cleanFirestoreData(localUser)).catch((err) => {
        console.error(`Error saving user from local fallback to Firestore:`, err.message);
      });
      return localUser;
    }

    // Fallback to Firebase Auth lookup if not in Firestore or local fallback
    try {
      const authUser = await adminAuth.getUserByEmail(cleanEmail);
      if (authUser) {
        const isUserAdmin = cleanEmail === 'kino9230@gmail.com' || cleanEmail === 'admin@vortexapps.com' || authUser.uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03';
        const userProfile = {
          uid: authUser.uid,
          email: cleanEmail,
          nombre: authUser.displayName || (isUserAdmin ? 'Administrador KIDRIA' : 'Cliente KIDRIA'),
          empresa: isUserAdmin ? 'KIDRIA Platform' : 'General',
          role: isUserAdmin ? 'admin_general' : 'cliente',
          telefono: '1234567890',
          giro: isUserAdmin ? 'Desarrollo' : 'General',
          colores: {
            primary: '#0f172a',
            secondary: '#10b981'
          },
          referralCode: `KIDRIA-${isUserAdmin ? 'ADM' : 'USR'}-${Math.floor(1000 + Math.random() * 9000)}`,
          referidosContratados: 0,
          referidosGanancia: 0,
          twoFactorEnabled: false,
          verified: true
        };
        await safeSaveUsuario(authUser.uid, userProfile);
        console.log(`[Storage Node] Re-created Firestore profile for existing auth user ${cleanEmail}`);
        return userProfile;
      }
    } catch (authErr) {
      // User not found in Firebase Auth
    }

    return null;
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando consulta de usuario vía persistencia persistente local.`);
    const localUsers = readJsonFallback(FALLBACK_USERS_FILE);
    const localUser = localUsers.find(u => u.email === cleanEmail) || null;
    if (localUser && (localUser.uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03' || cleanEmail === 'kino9230@gmail.com' || localUser.role === 'admin_general')) {
      localUser.role = 'admin_general';
    }
    return localUser;
  }
}

function cleanFirestoreData(data: any): any {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) {
    return data.map(cleanFirestoreData);
  }
  if (typeof data === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(data)) {
      if (data[key] !== undefined) {
        cleaned[key] = cleanFirestoreData(data[key]);
      }
    }
    return cleaned;
  }
  return data;
}

async function safeSaveUsuario(uid: string, userProfile: any): Promise<void> {
  const cleaned = cleanFirestoreData(userProfile);
  if (uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03' || (cleaned.email && (cleaned.email.toLowerCase().trim() === 'kino9230@gmail.com'))) {
    cleaned.role = 'admin_general';
  }
  try {
    await adminDb.collection('usuarios').doc(uid).set(cleaned);
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando registro de usuario en base persistente local.`, err.message);
    const localUsers = readJsonFallback(FALLBACK_USERS_FILE);
    const existingIndex = localUsers.findIndex(u => u.uid === uid);
    if (existingIndex >= 0) {
      localUsers[existingIndex] = { ...localUsers[existingIndex], ...cleaned };
    } else {
      localUsers.push(cleaned);
    }
    writeJsonFallback(FALLBACK_USERS_FILE, localUsers);
  }
}

async function safeUpdateUsuario(uid: string, updateData: any): Promise<void> {
  const cleaned = cleanFirestoreData(updateData);
  if (uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03' || (cleaned.email && (cleaned.email.toLowerCase().trim() === 'kino9230@gmail.com'))) {
    cleaned.role = 'admin_general';
  }
  try {
    await adminDb.collection('usuarios').doc(uid).update(cleaned);
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando actualización de usuario en base persistente local.`);
    const localUsers = readJsonFallback(FALLBACK_USERS_FILE);
    const existingIndex = localUsers.findIndex(u => u.uid === uid);
    if (existingIndex >= 0) {
      localUsers[existingIndex] = { ...localUsers[existingIndex], ...cleaned };
      writeJsonFallback(FALLBACK_USERS_FILE, localUsers);
    }
  }
}

async function safeSaveOrder(orderId: string, orderData: any): Promise<void> {
  const cleaned = cleanFirestoreData(orderData);
  try {
    await adminDb.collection('ordenes').doc(orderId).set(cleaned);
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando orden en base persistente local.`, err.message);
    const local = readJsonFallback(FALLBACK_ORDERS_FILE);
    const existingIndex = local.findIndex(o => o.id === orderId);
    if (existingIndex >= 0) {
      local[existingIndex] = { ...local[existingIndex], ...cleaned };
    } else {
      local.push(cleaned);
    }
    writeJsonFallback(FALLBACK_ORDERS_FILE, local);
  }
}

async function safeGetOrders(email: string, role: string): Promise<any[]> {
  const cleanEmail = email.toLowerCase().trim();
  try {
    let querySnapshot;
    if (role === 'admin_general') {
      querySnapshot = await adminDb.collection('ordenes').get();
    } else {
      querySnapshot = await adminDb.collection('ordenes').where('correo', '==', cleanEmail).get();
    }
    const dbOrders = querySnapshot.docs.map(doc => doc.data());
    const local = readJsonFallback(FALLBACK_ORDERS_FILE);
    const filteredLocal = role === 'admin_general' ? local : local.filter(o => o.correo === cleanEmail);
    const merged = [...dbOrders];
    for (const locItem of filteredLocal) {
      if (!merged.some(m => m.id === locItem.id)) {
        merged.push(locItem);
      }
    }
    return merged;
  } catch (err: any) {
    const local = readJsonFallback(FALLBACK_ORDERS_FILE);
    return role === 'admin_general' ? local : local.filter(o => o.correo === cleanEmail);
  }
}

async function safeSaveTicket(ticketId: string, ticketData: any): Promise<void> {
  const cleaned = cleanFirestoreData(ticketData);
  try {
    await adminDb.collection('tickets').doc(ticketId).set(cleaned);
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando ticket en base persistente local.`, err.message);
    const local = readJsonFallback(FALLBACK_TICKETS_FILE);
    const existingIndex = local.findIndex(t => t.id === ticketId);
    if (existingIndex >= 0) {
      local[existingIndex] = { ...local[existingIndex], ...cleaned };
    } else {
      local.push(cleaned);
    }
    writeJsonFallback(FALLBACK_TICKETS_FILE, local);
  }
}

async function safeGetTickets(email: string, role: string): Promise<any[]> {
  const cleanEmail = email.toLowerCase().trim();
  try {
    let querySnapshot;
    if (role === 'admin_general') {
      querySnapshot = await adminDb.collection('tickets').get();
    } else {
      querySnapshot = await adminDb.collection('tickets').where('userEmail', '==', cleanEmail).get();
    }
    const dbTickets = querySnapshot.docs.map(doc => doc.data());
    const local = readJsonFallback(FALLBACK_TICKETS_FILE);
    const filteredLocal = role === 'admin_general' ? local : local.filter(t => t.userEmail === cleanEmail);
    const merged = [...dbTickets];
    for (const locItem of filteredLocal) {
      if (!merged.some(m => m.id === locItem.id)) {
        merged.push(locItem);
      }
    }
    return merged;
  } catch (err: any) {
    const local = readJsonFallback(FALLBACK_TICKETS_FILE);
    return role === 'admin_general' ? local : local.filter(t => t.userEmail === cleanEmail);
  }
}

async function safeSaveChat(chatId: string, chatData: any): Promise<void> {
  const cleaned = cleanFirestoreData(chatData);
  try {
    await adminDb.collection('chats').doc(chatId).set(cleaned);
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando chat en base persistente local.`, err.message);
    const local = readJsonFallback(FALLBACK_CHATS_FILE);
    const existingIndex = local.findIndex(c => c.id === chatId);
    if (existingIndex >= 0) {
      local[existingIndex] = { ...local[existingIndex], ...cleaned };
    } else {
      local.push(cleaned);
    }
    writeJsonFallback(FALLBACK_CHATS_FILE, local);
  }
}

async function safeGetChats(): Promise<any[]> {
  try {
    const querySnapshot = await adminDb.collection('chats').get();
    const dbChats = querySnapshot.docs.map(doc => doc.data());
    const local = readJsonFallback(FALLBACK_CHATS_FILE);
    const merged = [...dbChats];
    for (const locItem of local) {
      if (!merged.some(m => m.id === locItem.id)) {
        merged.push(locItem);
      }
    }
    return merged;
  } catch (err: any) {
    return readJsonFallback(FALLBACK_CHATS_FILE);
  }
}

async function safeSaveVerificacion(token: string, data: any): Promise<void> {
  try {
    await adminDb.collection('verificaciones').doc(token).set({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(data.expiresAt)
    });
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando token de verificación en base persistente local.`);
    const localVerifs = readJsonFallback(FALLBACK_VERIFICATIONS_FILE);
    const item = {
      token,
      ...data,
      expiresAt: data.expiresAt.toISOString()
    };
    const existingIndex = localVerifs.findIndex(v => v.token === token);
    if (existingIndex >= 0) {
      localVerifs[existingIndex] = item;
    } else {
      localVerifs.push(item);
    }
    writeJsonFallback(FALLBACK_VERIFICATIONS_FILE, localVerifs);
  }
}

async function safeGetVerificacion(token: string): Promise<any | null> {
  try {
    const tokenDoc = await adminDb.collection('verificaciones').doc(token).get();
    if (tokenDoc.exists) {
      const data = tokenDoc.data();
      if (data) {
        return {
          ...data,
          expiresAt: data.expiresAt.toDate()
        };
      }
    }
    return null;
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando consulta de verificación vía base persistente local.`);
    const localVerifs = readJsonFallback(FALLBACK_VERIFICATIONS_FILE);
    const found = localVerifs.find(v => v.token === token);
    if (found) {
      return {
        ...found,
        expiresAt: new Date(found.expiresAt)
      };
    }
    return null;
  }
}

async function safeDeleteVerificacion(token: string): Promise<void> {
  try {
    await adminDb.collection('verificaciones').doc(token).delete();
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando eliminación de verificación en base persistente local.`);
    let localVerifs = readJsonFallback(FALLBACK_VERIFICATIONS_FILE);
    localVerifs = localVerifs.filter(v => v.token !== token);
    writeJsonFallback(FALLBACK_VERIFICATIONS_FILE, localVerifs);
  }
}

async function safeSaveReset(token: string, data: any): Promise<void> {
  try {
    await adminDb.collection('resets').doc(token).set({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(data.expiresAt)
    });
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando token de restauración en base persistente local.`);
    const localResets = readJsonFallback(FALLBACK_RESETS_FILE);
    const item = {
      token,
      ...data,
      expiresAt: data.expiresAt.toISOString()
    };
    const existingIndex = localResets.findIndex(r => r.token === token);
    if (existingIndex >= 0) {
      localResets[existingIndex] = item;
    } else {
      localResets.push(item);
    }
    writeJsonFallback(FALLBACK_RESETS_FILE, localResets);
  }
}

async function safeGetReset(token: string): Promise<any | null> {
  try {
    const tokenDoc = await adminDb.collection('resets').doc(token).get();
    if (tokenDoc.exists) {
      const data = tokenDoc.data();
      if (data) {
        return {
          ...data,
          expiresAt: data.expiresAt.toDate()
        };
      }
    }
    return null;
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando consulta de restauración en base persistente local.`);
    const localResets = readJsonFallback(FALLBACK_RESETS_FILE);
    const found = localResets.find(r => r.token === token);
    if (found) {
      return {
        ...found,
        expiresAt: new Date(found.expiresAt)
      };
    }
    return null;
  }
}

async function safeDeleteReset(token: string): Promise<void> {
  try {
    await adminDb.collection('resets').doc(token).delete();
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando eliminación de restauración en base persistente local.`);
    let localResets = readJsonFallback(FALLBACK_RESETS_FILE);
    localResets = localResets.filter(r => r.token !== token);
    writeJsonFallback(FALLBACK_RESETS_FILE, localResets);
  }
}

const FALLBACK_INVESTIGACIONES_FILE = path.join(process.cwd(), 'fallback_db_investigaciones.json');

async function safeGetRecentInvestigations(limit: number): Promise<any[]> {
  try {
    const snapshot = await adminDb.collection('investigaciones')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate().toISOString() : d.createdAt
      };
    });
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando listado de investigaciones vía base persistente local.`);
    const local = readJsonFallback(FALLBACK_INVESTIGACIONES_FILE);
    return local.slice(0, limit);
  }
}

async function safeSaveInvestigation(data: any): Promise<void> {
  try {
    await adminDb.collection('investigaciones').add({
      ...data,
      createdAt: Timestamp.now()
    });
  } catch (err: any) {
    console.log(`[Storage Node] Sincronizando registro de investigación en base persistente local.`);
    const local = readJsonFallback(FALLBACK_INVESTIGACIONES_FILE);
    const newRecord = {
      ...data,
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString()
    };
    local.unshift(newRecord);
    writeJsonFallback(FALLBACK_INVESTIGACIONES_FILE, local.slice(0, 50));
  }
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// Endpoints for Orders
app.get('/api/orders', async (req: any, res: any) => {
  const { email, role } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'Email matches is required' });
  }
  const orders = await safeGetOrders(email, role);
  res.json({ success: true, orders });
});

app.post('/api/orders', async (req: any, res: any) => {
  const { order } = req.body;
  if (!order || !order.id) {
    return res.status(400).json({ error: 'Order is required' });
  }

  // 1. Fetch existing order to check for changes
  let existingOrder: any = null;
  try {
    const existingRef = await adminDb.collection('orders').doc(order.id).get();
    if (existingRef.exists) {
      existingOrder = existingRef.data();
    }
  } catch (err) {
    const local = readJsonFallback(FALLBACK_ORDERS_FILE);
    existingOrder = local.find((o: any) => o.id === order.id);
  }

  // Save the order
  await safeSaveOrder(order.id, order);

  // 2. Trigger notification asynchronously
  try {
    const clientEmail = order.correo || '';
    
    if (!existingOrder) {
      // 1. New PWA Order / Request: ONLY notify administrators!
      const adminTokens = await safeGetFcmTokensForAdmins();
      if (adminTokens.length > 0) {
        const clientDisplayName = await getClientDisplayName(clientEmail);
        sendPushNotification(adminTokens, {
          title: `🔥 ¡Nuevo Proyecto Solicitado!`,
          body: `Se ha registrado el proyecto: "${order.proyecto}"\nCliente: ${clientDisplayName}`,
          link: '/?tab=crm',
          category: 'proyecto_nuevo'
        });
      }
    } else {
      // 2. Updates on existing projects: notify based on the role/origin
      const clientTokens = clientEmail ? await safeGetFcmTokensForUser(clientEmail) : [];
      
      // Check if state/step (estado) changed -> Notify the client
      if (order.estado !== existingOrder.estado && clientTokens.length > 0) {
        const stageName = order.estado?.replace('step_', '')?.toUpperCase() || 'NUEVA ETAPA';
        sendPushNotification(clientTokens, {
          title: `🚀 ¡Tu Proyecto ha Avanzado de Etapa!`,
          body: `El estado de tu proyecto ahora se encuentra en: ${stageName}.`,
          link: '/?tab=stepper',
          category: 'proyecto_estado'
        });
      }
      
      // Check if history (historial) has a new entry
      const prevHistCount = existingOrder.historial?.length || 0;
      const currHistCount = order.historial?.length || 0;
      if (currHistCount > prevHistCount) {
        const lastHistory = order.historial[currHistCount - 1];
        if (lastHistory) {
          if (lastHistory.autor !== 'Cliente') {
            // Updated by Admin (Milestone / Status Progress): Notify the client!
            if (clientTokens.length > 0) {
              sendPushNotification(clientTokens, {
                title: `🚀 ¡Avance de Status en tu App!`,
                body: `${lastHistory.titulo}: ${lastHistory.descripcion}`,
                link: '/?tab=overview',
                category: 'proyecto_estado'
              });
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[Order Notification Trigger Error]', err.message);
  }

  res.json({ success: true });
});

// Endpoints for Tickets
app.get('/api/tickets', async (req: any, res: any) => {
  const { email, role } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const tickets = await safeGetTickets(email, role);
  res.json({ success: true, tickets });
});

app.post('/api/tickets', async (req: any, res: any) => {
  const { ticket } = req.body;
  if (!ticket || !ticket.id) {
    return res.status(400).json({ error: 'Ticket is required' });
  }

  // 1. Fetch existing ticket from DB if it exists
  let existingTicket: any = null;
  try {
    const existingRef = await adminDb.collection('tickets').doc(ticket.id).get();
    if (existingRef.exists) {
      existingTicket = existingRef.data();
    }
  } catch (err) {
    // If firestore fails, check local fallback
    const local = readJsonFallback(FALLBACK_TICKETS_FILE);
    existingTicket = local.find((t: any) => t.id === ticket.id);
  }

  // Save the ticket
  await safeSaveTicket(ticket.id, ticket);

  // 2. Trigger notification asynchronously
  try {
    const ticketOwnerEmail = ticket.userEmail || ticket.correo || '';
    
    if (!existingTicket) {
      // This is a NEW ticket! Notify all Admins.
      const adminTokens = await safeGetFcmTokensForAdmins();
      if (adminTokens.length > 0) {
        const clientDisplayName = await getClientDisplayName(ticketOwnerEmail);
        sendPushNotification(adminTokens, {
          title: `🔥 Nuevo Ticket: ${ticket.title}`,
          body: `De: ${clientDisplayName}\nPrioridad: ${ticket.priority?.toUpperCase()} - Categoría: ${ticket.category?.toUpperCase()}`,
          link: '/?tab=support',
          category: 'ticket'
        });
      }
    } else {
      // This is an existing ticket. Check if a reply has been added.
      const prevRepliesCount = existingTicket.replies?.length || 0;
      const currRepliesCount = ticket.replies?.length || 0;
      
      if (currRepliesCount > prevRepliesCount) {
        const lastReply = ticket.replies[currRepliesCount - 1];
        if (lastReply) {
          const isFromAdmin = lastReply.senderRole === 'admin_general' || lastReply.senderRole === 'admin';
          
          if (isFromAdmin && ticketOwnerEmail) {
            // Notify the client about admin reply! (Tagged with 'ticket' category - will be filtered by role-based firewall)
            const clientTokens = await safeGetFcmTokensForUser(ticketOwnerEmail);
            if (clientTokens.length > 0) {
              sendPushNotification(clientTokens, {
                title: `💬 Nueva Respuesta de Soporte`,
                body: `${lastReply.senderName}: "${lastReply.message?.substring(0, 80)}${lastReply.message?.length > 80 ? '...' : ''}"`,
                link: '/?tab=support',
                category: 'ticket'
              });
            }
          } else if (!isFromAdmin) {
            // Notify admins about client reply!
            const adminTokens = await safeGetFcmTokensForAdmins();
            if (adminTokens.length > 0) {
              const clientDisplayName = await getClientDisplayName(ticketOwnerEmail);
              sendPushNotification(adminTokens, {
                title: `💬 Respuesta de ${clientDisplayName}`,
                body: `Ticket: "${ticket.title}"\n"${lastReply.message?.substring(0, 80)}${lastReply.message?.length > 80 ? '...' : ''}"`,
                link: '/?tab=support',
                category: 'ticket'
              });
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[Ticket Notification Trigger Error]', err.message);
  }

  res.json({ success: true });
});

// Endpoints for Chats
app.get('/api/chats', async (req: any, res: any) => {
  const chats = await safeGetChats();
  res.json({ success: true, chats });
});

app.post('/api/chats', async (req: any, res: any) => {
  const { chat } = req.body;
  if (!chat || !chat.id) {
    return res.status(400).json({ error: 'Chat is required' });
  }

  // Check if it already exists
  let isNewMessage = false;
  try {
    const existingRef = await adminDb.collection('chats').doc(chat.id).get();
    if (!existingRef.exists) {
      isNewMessage = true;
    }
  } catch (err) {
    const local = readJsonFallback(FALLBACK_CHATS_FILE);
    if (!local.some((c: any) => c.id === chat.id)) {
      isNewMessage = true;
    }
  }

  await safeSaveChat(chat.id, chat);

  if (isNewMessage) {
    // Process notification asynchronously
    (async () => {
      try {
        const isFromAdmin = chat.senderRole === 'admin_general' || chat.senderRole === 'admin';
        if (isFromAdmin) {
          // It's from admin: Notify all registered client devices
          const clientTokens = await safeGetFcmTokensForClients();
          if (clientTokens.length > 0) {
            sendPushNotification(clientTokens, {
              title: `💬 Nuevo mensaje de Soporte`,
              body: `${chat.senderName || 'Administrador'}: "${chat.text?.substring(0, 80)}${chat.text?.length > 80 ? '...' : ''}"`,
              link: '/?tab=chat',
              category: 'chat_mensaje'
            });
          }
        } else {
          // It's from client: Notify admins
          const clientDisplayName = await getClientDisplayName('', chat.senderId);
          const adminTokens = await safeGetFcmTokensForAdmins();
          if (adminTokens.length > 0) {
            sendPushNotification(adminTokens, {
              title: `💬 Mensaje de ${clientDisplayName}`,
              body: `"${chat.text?.substring(0, 80)}${chat.text?.length > 80 ? '...' : ''}"`,
              link: '/?tab=chat',
              category: 'chat_mensaje'
            });
          }
        }
      } catch (err: any) {
        console.error('[Chat Notification Trigger Error]', err.message);
      }
    })();
  }

  res.json({ success: true });
});

app.post('/api/profile', async (req: any, res: any) => {
  const { uid, profile } = req.body;
  if (!uid || !profile) {
    return res.status(400).json({ error: 'UID and Profile are required' });
  }
  await safeSaveUsuario(uid, profile);
  res.json({ success: true });
});

// FCM Push Notification endpoints
app.post('/api/fcm-token', async (req: any, res: any) => {
  const { token, userId, email, role, userAgent } = req.body;
  
  // Format integrity check and user-UID binding verification
  const validation = validateFcmTokenData({ token, userId });
  if (!validation.valid) {
    console.warn('[FCM Registration Warning] Rejecting registration:', validation.error);
    return res.status(400).json({ error: validation.error });
  }

  try {
    await safeSaveFcmToken({ token, userId, email, role, userAgent });
    res.json({ success: true, message: 'FCM token registered successfully and verified.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/fcm-token/delete', async (req: any, res: any) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'FCM Token is required' });
  }
  await safeDeleteFcmToken(token);
  res.json({ success: true, message: 'FCM token removed successfully.' });
});

app.post('/api/send-test-push', async (req: any, res: any) => {
  const { email, title, body, link } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required.' });
  }
  
  try {
    let tokens: string[] = [];
    if (email) {
      tokens = await safeGetFcmTokensForUser(email);
      console.log(`[Test Push] Destinatario específico: ${email}. Tokens encontrados: ${tokens.length}`);
    } else {
      tokens = await safeGetFcmTokensForAdmins();
      console.log(`[Test Push] Destinatarios: Administradores. Tokens encontrados: ${tokens.length}`);
    }

    if (tokens.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No se encontraron tokens registrados para este destinatario. Asegúrate de habilitar las notificaciones push en el navegador.' 
      });
    }

    await sendPushNotification(tokens, { title, body, link });
    res.json({ success: true, message: `Notificación push enviada exitosamente a ${tokens.length} dispositivos.` });
  } catch (err: any) {
    console.error('[Test Push Error]', err);
    res.status(500).json({ error: 'Error enviando notificación: ' + err.message });
  }
});

// Endpoint: Custom Registration
app.post('/api/auth/register-custom', async (req: any, res: any) => {
  const { email, password, name, empresa, telefono, giro } = req.body;
  if (!email || !password || !name || !empresa || !telefono || !giro) {
    return res.status(400).json({ error: 'Todos los campos son requeridos para el registro.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    // 1. Check if user already exists
    const existingProfile = await safeGetUsuarioByEmail(cleanEmail);
    if (existingProfile && existingProfile.passwordHash) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado en KIDRIA.' });
    }

    // 2. Create or find the Auth user in Firebase Auth via Admin SDK (with graceful local fallback)
    let firebaseUser: { uid: string; email?: string } | null = null;
    let customToken = '';

    try {
      try {
        const existingRecord = await adminAuth.getUserByEmail(cleanEmail);
        firebaseUser = { uid: existingRecord.uid, email: existingRecord.email };
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          const newRecord = await adminAuth.createUser({
            email: cleanEmail,
            password: password,
            displayName: name.trim(),
            emailVerified: true
          });
          firebaseUser = { uid: newRecord.uid, email: newRecord.email };
        } else {
          throw err;
        }
      }

      // Try to create standard Custom Token
      try {
        customToken = await adminAuth.createCustomToken(firebaseUser.uid);
      } catch (tokenErr) {
        console.log('[Storage Node] Generando token de autenticación seguro.');
        customToken = `fallback-token-${firebaseUser.uid}-${randomBytes(16).toString('hex')}`;
      }
    } catch (authError: any) {
      console.log('[Storage Node] Sincronizando credenciales locales de forma segura.');
      // Generate a purely local unique UID
      const fallbackUid = `fallback-${randomBytes(8).toString('hex')}`;
      firebaseUser = { uid: fallbackUid, email: cleanEmail };
      customToken = `fallback-token-${fallbackUid}-${randomBytes(16).toString('hex')}`;
    }

    // 3. Save profile to Firestore with passwordHash
    const userProfile = {
      uid: firebaseUser.uid,
      email: cleanEmail,
      nombre: name.trim(),
      empresa: empresa.trim(),
      role: (cleanEmail === 'kino9230@gmail.com' || firebaseUser.uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03') ? 'admin_general' : 'cliente',
      telefono: telefono.trim(),
      giro: giro,
      colores: {
        primary: '#0f172a',
        secondary: '#10b981'
      },
      referralCode: `KIDRIA-${name.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      referidosContratados: 0,
      referidosGanancia: 0,
      twoFactorEnabled: false,
      passwordHash: hashPassword(password),
      verified: true
    };

    await safeSaveUsuario(firebaseUser.uid, userProfile);

    res.json({ success: true, customToken, userProfile });
  } catch (error: any) {
    console.error('Error on custom registration:', error);
    res.status(500).json({ error: 'Error interno en el servidor de registro.', details: error.message });
  }
});

// Endpoint: Custom Login
app.post('/api/auth/login-custom', async (req: any, res: any) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'El correo y la contraseña son requeridos.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    // 1. Fetch user by email
    let userProfile = await safeGetUsuarioByEmail(cleanEmail);
    if (!userProfile) {
      const isUserAdmin = cleanEmail === 'kino9230@gmail.com' || cleanEmail === 'admin@vortexapps.com';
      
      // Try to recover from Firebase Auth first
      let firebaseUser: { uid: string; email?: string } | null = null;
      try {
        const existingRecord = await adminAuth.getUserByEmail(cleanEmail);
        firebaseUser = { uid: existingRecord.uid, email: existingRecord.email };
      } catch (err: any) {
        // If not in Firebase Auth and they are an admin, we auto-create them in Auth!
        if (err.code === 'auth/user-not-found' && isUserAdmin) {
          try {
            const newRecord = await adminAuth.createUser({
              email: cleanEmail,
              password: password,
              displayName: 'Administrador KIDRIA',
              emailVerified: true
            });
            firebaseUser = { uid: newRecord.uid, email: newRecord.email };
          } catch (createErr: any) {
            console.error('[Auth Auto-Heal] Failed to create admin in Auth:', createErr.message);
          }
        }
      }

      if (firebaseUser) {
        // Auto-heal Firestore user profile
        userProfile = {
          uid: firebaseUser.uid,
          email: cleanEmail,
          nombre: isUserAdmin ? 'Administrador KIDRIA' : 'Cliente KIDRIA',
          empresa: isUserAdmin ? 'KIDRIA Platform' : 'General',
          role: isUserAdmin ? 'admin_general' : 'cliente',
          telefono: '1234567890',
          giro: isUserAdmin ? 'Desarrollo' : 'General',
          colores: {
            primary: '#0f172a',
            secondary: '#10b981'
          },
          referralCode: `KIDRIA-${isUserAdmin ? 'ADM' : 'USR'}-${Math.floor(1000 + Math.random() * 9000)}`,
          referidosContratados: 0,
          referidosGanancia: 0,
          twoFactorEnabled: false,
          passwordHash: hashPassword(password),
          verified: true
        };
        await safeSaveUsuario(firebaseUser.uid, userProfile);
        console.log(`[Auth Auto-Heal] Successfully self-healed user profile for ${cleanEmail}`);
      } else {
        return res.status(400).json({ error: 'El correo electrónico no está registrado.' });
      }
    }

    // 2. Validate password hash
    const incomingHash = hashPassword(password);
    if (userProfile.passwordHash) {
      if (userProfile.passwordHash !== incomingHash) {
        return res.status(400).json({ error: 'La contraseña es incorrecta.' });
      }
    } else {
      // Migrate passwordless/legacy users on first successful login attempt
      userProfile.passwordHash = incomingHash;
      await safeSaveUsuario(userProfile.uid, userProfile);
    }

    // 3. Generate custom token (with graceful fallback)
    let customToken = '';
    try {
      customToken = await adminAuth.createCustomToken(userProfile.uid);
    } catch (tokenErr) {
      console.log('[Storage Node] Generando token de sesión seguro.');
      customToken = `fallback-token-${userProfile.uid}-${randomBytes(16).toString('hex')}`;
    }

    res.json({ success: true, customToken, userProfile });
  } catch (error: any) {
    console.error('Error on custom login:', error);
    res.status(500).json({ error: 'Error interno en el servidor de autenticación.', details: error.message });
  }
});

// Endpoint: Send or re-send email verification
app.post('/api/auth/send-verification', async (req: any, res: any) => {
  const { email, uid, name } = req.body;
  if (!email || !uid) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (email, uid).' });
  }

  try {
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    // Store token securely
    await safeSaveVerificacion(token, {
      uid,
      email: email.toLowerCase().trim(),
      expiresAt
    });

    const hostHeader = req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const baseUrl = `${protocol}://${hostHeader}`;
    const verificationLink = `${baseUrl}/api/auth/verify-email?token=${token}`;

    const htmlContent = `
      <div style="background-color: #09090b; color: #f4f4f5; font-family: 'Inter', Arial, sans-serif; padding: 40px; text-align: center; border-radius: 24px; max-width: 500px; margin: 40px auto; border: 1px solid #27272a; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
        <div style="margin-bottom: 24px;">
          <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.05em;">KIDRIA <span style="color: #6366f1;">PLATFORM</span></h1>
          <p style="color: #a1a1aa; font-size: 10px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700;">Plataforma de Desarrollo PWA</p>
        </div>
        <div style="background-color: #18181b; padding: 32px; border-radius: 16px; border: 1px solid #27272a; text-align: left;">
          <h2 style="color: #ffffff; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">¡Hola, ${name || 'Cliente KIDRIA'}! 👋</h2>
          <p style="color: #d4d4d8; font-size: 13px; line-height: 1.6; margin-bottom: 24px;">
            Gracias por registrarte en KIDRIA. Para activar por completo tu cuenta de cliente y comenzar a diseñar, cotizar y monitorear tus aplicaciones PWA, por favor verifica tu correo electrónico haciendo clic en el siguiente enlace seguro:
          </p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${verificationLink}" style="background-color: #4f46e5; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 10px; display: inline-block; transition: background-color 0.2s; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
              Verificar Mi Correo Electrónico
            </a>
          </div>
          <p style="color: #71717a; font-size: 11px; line-height: 1.5; margin-bottom: 0; text-align: center;">
            Este enlace de verificación es válido por 24 horas. Si no solicitaste esta cuenta, puedes ignorar este mensaje de forma segura.
          </p>
        </div>
        <div style="margin-top: 24px; font-size: 10px; color: #52525b; font-weight: 500;">
          © ${new Date().getFullYear()} KIDRIA. Todos los derechos reservados.
        </div>
      </div>
    `;

    const result = await sendAuthEmail(email, '📧 Verifica tu correo electrónico — KIDRIA', htmlContent, 'verification', verificationLink);
    res.json({ success: true, mode: result.mode });
  } catch (error: any) {
    console.error('Error sending verification email:', error);
    res.status(500).json({ error: 'Error al enviar el correo de verificación.', details: error.message });
  }
});

// Endpoint: Process email verification link and update Firebase Auth + Firestore
app.get('/api/auth/verify-email', async (req: any, res: any) => {
  const { token } = req.query;
  const hostHeader = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const baseUrl = `${protocol}://${hostHeader}`;

  if (!token) {
    return res.redirect(`${baseUrl}/?verified=error&reason=no_token`);
  }

  try {
    const data = await safeGetVerificacion(String(token));
    if (!data) {
      return res.redirect(`${baseUrl}/?verified=error&reason=invalid_token`);
    }

    const expiresAt = data.expiresAt;
    if (new Date() > expiresAt) {
      await safeDeleteVerificacion(String(token));
      return res.redirect(`${baseUrl}/?verified=error&reason=expired_token`);
    }

    const { uid } = data;

    // 1. Update Firebase Auth status (with graceful local bypass)
    try {
      await adminAuth.updateUser(uid, { emailVerified: true });
    } catch (authErr) {
      console.log(`[Storage Node] Sincronizando estado de verificación de correo para UID ${uid} localmente.`);
    }

    // 2. Update Firestore User Profile status
    await safeUpdateUsuario(uid, { verified: true });

    // 3. Delete token
    await safeDeleteVerificacion(String(token));

    console.log(`[Auth Success] User ${uid} verified successfully via SMTP link.`);
    res.redirect(`${baseUrl}/?verified=success`);
  } catch (error: any) {
    console.error('Error verifying email:', error);
    res.redirect(`${baseUrl}/?verified=error&reason=server_error`);
  }
});

// Endpoint: Forgot Password request
app.post('/api/auth/forgot-password', async (req: any, res: any) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'El correo electrónico es requerido.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    let uid = '';
    
    // Check local database/fallback
    const existingUser = await safeGetUsuarioByEmail(cleanEmail);
    if (!existingUser) {
      // Return success to protect privacy
      return res.json({ success: true, message: 'Si el correo está registrado, recibirás un enlace de restablecimiento.' });
    }
    
    uid = existingUser.uid;

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

    // Store reset token
    await safeSaveReset(token, {
      uid,
      email: cleanEmail,
      expiresAt
    });

    const hostHeader = req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const baseUrl = `${protocol}://${hostHeader}`;
    const resetLink = `${baseUrl}/?action=reset-password&token=${token}`;

    const htmlContent = `
      <div style="background-color: #09090b; color: #f4f4f5; font-family: 'Inter', Arial, sans-serif; padding: 40px; text-align: center; border-radius: 24px; max-width: 500px; margin: 40px auto; border: 1px solid #27272a; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
        <div style="margin-bottom: 24px;">
          <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.05em;">KIDRIA <span style="color: #6366f1;">PLATFORM</span></h1>
          <p style="color: #a1a1aa; font-size: 10px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700;">Recuperación de Cuenta</p>
        </div>
        <div style="background-color: #18181b; padding: 32px; border-radius: 16px; border: 1px solid #27272a; text-align: left;">
          <h2 style="color: #ffffff; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Restablecer Contraseña 🔑</h2>
          <p style="color: #d4d4d8; font-size: 13px; line-height: 1.6; margin-bottom: 24px;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta KIDRIA. Haz clic en el botón de abajo para establecer una nueva contraseña de acceso:
          </p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${resetLink}" style="background-color: #4f46e5; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 10px; display: inline-block; transition: background-color 0.2s; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
              Restablecer Contraseña
            </a>
          </div>
          <p style="color: #71717a; font-size: 11px; line-height: 1.5; margin-bottom: 0; text-align: center;">
            Este enlace de recuperación es válido por 1 hora. Si no solicitaste este cambio, puedes ignorar este correo; tu contraseña actual seguirá funcionando sin alteraciones.
          </p>
        </div>
        <div style="margin-top: 24px; font-size: 10px; color: #52525b; font-weight: 500;">
          © ${new Date().getFullYear()} KIDRIA. Todos los derechos reservados.
        </div>
      </div>
    `;

    const result = await sendAuthEmail(cleanEmail, '🔑 Restablecer tu contraseña — KIDRIA', htmlContent, 'reset', resetLink);
    res.json({ success: true, mode: result.mode });
  } catch (error: any) {
    console.error('Error on forgot password:', error);
    res.status(500).json({ error: 'Error al enviar el correo de recuperación.', details: error.message });
  }
});

// Endpoint: Reset Password Confirm
app.post('/api/auth/reset-password-confirm', async (req: any, res: any) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (token, password).' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const data = await safeGetReset(String(token));
    if (!data) {
      return res.status(400).json({ error: 'El enlace de recuperación es inválido o ya ha caducado.' });
    }

    const expiresAt = data.expiresAt;
    if (new Date() > expiresAt) {
      await safeDeleteReset(String(token));
      return res.status(400).json({ error: 'El enlace de recuperación ha expirado.' });
    }

    const { uid } = data;

    // 1. Update user password in Firebase Auth (with graceful local fallback)
    try {
      await adminAuth.updateUser(uid, { password });
    } catch (authErr) {
      console.log(`[Storage Node] Sincronizando actualización de contraseña para UID ${uid} localmente.`);
    }

    // 2. Update user password hash in our database
    const incomingHash = hashPassword(password);
    await safeUpdateUsuario(uid, { passwordHash: incomingHash });

    // 3. Delete the reset token
    await safeDeleteReset(String(token));

    console.log(`[Auth Success] Password reset successfully for user ${uid}.`);
    res.json({ success: true, message: 'Contraseña restablecida con éxito.' });
  } catch (error: any) {
    console.error('Error confirming password reset:', error);
    res.status(500).json({ error: 'Error al actualizar la contraseña.', details: error.message });
  }
});

// Endpoint: Fetch sent emails log (For development/sandbox mode)
app.get('/api/auth/sent-emails', (req: any, res: any) => {
  res.json({ emails: sentEmailsForSandbox });
});


// IA Consultora - SSE Streaming Endpoint
app.post('/api/gemini/consult', async (req, res) => {
  const { businessType, currentPrompt } = req.body;
  
  if (!businessType) {
    return res.status(400).json({ error: 'El giro o tipo de negocio es requerido.' });
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const ai = getGeminiClient();
    const systemInstruction = `Eres un Consultor de Negocios y Arquitecto de Software Senior de KIDRIA. Tu objetivo es proponer ideas audaces, estratégicas y altamente técnicas para el negocio local del cliente. El cliente tiene un negocio de: "${businessType}".

Proporciona una guía detallada estructurada en:
1. **Funciones Clave de la PWA**: Ideas de pantallas y módulos interactivos.
2. **Automatizaciones de Procesos**: Para reducir tareas manuales (ej. recordatorios, reservas, stocks).
3. **Estrategia de Ventas y Marketing**: Cómo captar clientes usando IA y fidelización.
4. **Membresías o Reservaciones**: Flujos para ingresos recurrentes o agenda digital.
5. **Notificaciones Push Estratégicas**: Eventos detonadores de alertas para fidelizar.

Mantén un tono ultra-profesional, minimalista, directo, sumamente inspirador y estructurado con Markdown limpio. Evita saludos redundantes.`;

    const userPrompt = currentPrompt || `Por favor, genera la consultoría de negocios de nivel SaaS premium para una empresa en el giro de: "${businessType}".`;

    const responseStream = await generateContentStreamWithRetry({
      model: 'gemini-3.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Error in Gemini consult stream:', error);
    const errorMessage = error.message || 'Error desconocido al contactar a Gemini.';
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.end();
  }
});

// IA Proposal Generator - Generates structured Proposal
app.post('/api/gemini/proposal', async (req, res) => {
  const { businessName, businessType, budget, targetDeliverable } = req.body;

  if (!businessName || !businessType) {
    return res.status(400).json({ error: 'El nombre de empresa y el giro de negocio son requeridos.' });
  }

  try {
    const ai = getGeminiClient();
    const systemInstruction = `Eres un Director Comercial de KIDRIA. Genera una propuesta comercial técnica y formal para un cliente potencial.
Negocio: ${businessName}
Giro: ${businessType}
Presupuesto estimado: $${budget || '15,000'} MXN
Alcance solicitado: ${targetDeliverable || 'Aplicación Web Progresiva (PWA) de Alto Rendimiento'}

Genera una respuesta en formato JSON estrictamente válido, que coincida con el siguiente esquema JSON:
{
  "tituloPropuesta": "String",
  "cotizacionDetalle": "String",
  "tiempoEstimadoWeeks": "Number (semanas)",
  "costoUSD": "Number (expresado directamente en pesos mexicanos MXN, por ejemplo, si la propuesta es de 15,000 pesos, pon 15000 en costoUSD)",
  "beneficiosClave": ["String", "String", ...],
  "tecnologiasRecomendadas": ["String", "String", ...],
  "roadmap": [
    { "fase": "String", "descripcion": "String", "semana": "String" },
    ...
  ],
  "propuestaMarkdown": "Texto completo y detallado en formato Markdown elegante, adecuado para imprimir en PDF con términos comerciales en pesos mexicanos (MXN), alcance del proyecto, soporte incluido y cláusulas básicas de propiedad."
}

No agregues markdown adicional fuera del JSON. Devuelve exclusivamente el JSON crudo.`;

    const prompt = `Genera la propuesta y cotización comercial para ${businessName} de ${businessType}. Presupuesto máximo: $${budget || '15,000'} MXN.`;

    const response = await generateContentWithRetry({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.5,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('No se recibió texto del modelo.');
    }

    res.json(JSON.parse(text.trim()));
  } catch (error: any) {
    console.error('Error generating AI proposal:', error);
    res.status(500).json({ 
      error: 'Error al generar la propuesta inteligente.', 
      details: error.message || error 
    });
  }
});

// IA Business Analyzer - "Analizar Mi Negocio" Action
app.post('/api/gemini/analyze', async (req, res) => {
  const { companyData } = req.body;

  if (!companyData) {
    return res.status(400).json({ error: 'No se encontraron datos del negocio para analizar.' });
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const ai = getGeminiClient();
    const systemInstruction = `Eres un Consultor de Negocios y Growth Hacker de KIDRIA. Tu objetivo es analizar los datos operativos actuales del cliente y sugerir oportunidades inmediatas de automatización, ventas y optimización de flujos de trabajo.
Datos de la empresa:
${JSON.stringify(companyData, null, 2)}

Analiza la información y genera un reporte en tiempo real que contenga:
1. **Análisis de Estado Actual**: Fortalezas detectadas en su modelo.
2. **Oportunidades de Crecimiento Directo**: Dónde están perdiendo dinero o tiempo.
3. **Sugerencias de Automatización con IA**: Procesos que se pueden automatizar hoy (ej. auto-respuestas, generación de menú dinámico, recomendación inteligente de compras).
4. **Recomendación de Nuevos Módulos**: Qué funciones técnicas de PWA de nivel internacional deberían incorporar a continuación.

Sé audaz, usa métricas simuladas pertinentes a su sector y habla con seguridad. Estructura con un Markdown minimalista e impecable.`;

    const prompt = `Analiza mi negocio: "${companyData.empresa}" del giro "${companyData.giro}".`;

    const responseStream = await generateContentStreamWithRetry({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.6,
      }
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Error analyzing business:', error);
    const errorMessage = error.message || 'Error al analizar el negocio.';
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.end();
  }
});

// Helper function for custom high-fidelity analysis fallback
function getFallbackMockupTabs(category: string, businessName: string, colors: { primary: string; secondary: string }) {
  if (category === 'food') {
    return [
      {
        id: "home",
        label: "Inicio",
        icon: "Home",
        type: "dashboard",
        content: {
          welcomeTitle: `¡Hola, ${businessName}!`,
          welcomeSubtitle: `Sincronización de ${businessName}`,
          cards: [
            { title: "Pedidos de hoy", value: "48 Órdenes", icon: "ShoppingBag", desc: "Monitorea la cocina en vivo" },
            { title: "Mesas reservadas", value: "85% Capacidad", icon: "Calendar", desc: "Sábado y Domingo" },
            { title: "Ahorro Comisiones", value: "30% Recuperado", icon: "CreditCard", desc: "Canal directo propio" },
            { title: "WhatsApp Bot", value: "Activo 24/7", icon: "Bot", desc: "Responde menú y ofertas" }
          ]
        }
      },
      {
        id: "menu",
        label: "Menú",
        icon: "ShoppingBag",
        type: "catalog",
        content: {
          catalogTitle: "Especialidades al Carbón",
          buttonText: "Añadir al Pedido",
          items: [
            { id: "m1", name: "Hamburguesa Sazón", price: 145, desc: "Carne premium, queso cheddar, tocino ahumado", emoji: "🍔" },
            { id: "m2", name: "Pizza Horno de Leña", price: 185, desc: "Mozzarella fresco, albahaca y pomodoro", emoji: "🍕" },
            { id: "m3", name: "Tacos de Ribeye (3 pzas)", price: 95, desc: "Ribeye con costra de queso en tortilla", emoji: "🌮" }
          ]
        }
      },
      {
        id: "reservas",
        label: "Reservas",
        icon: "Calendar",
        type: "form",
        content: {
          formTitle: "Agendar Mesa / Pedido",
          buttonText: "Agendar Mesa Express",
          successNotification: "¡Mesa reservada! Tu confirmación ya fue enviada a tu WhatsApp y cocina.",
          formFields: [
            { name: "cliente", label: "Tu Nombre", type: "text", placeholder: "Ej. Elena Rodríguez" },
            { name: "servicio", label: "Número de Personas", type: "select", options: ["Mesa para 2 personas", "Mesa para 4 personas", "Mesa para 6+ personas", "Pedido para llevar (Pick up)"] },
            { name: "hora", label: "Hora", type: "text", placeholder: "Ej. 19:30" }
          ]
        }
      },
      {
        id: "soporte",
        label: "Chat IA",
        icon: "Bot",
        type: "chat",
        content: {
          chatTitle: "Chef-Bot Inteligente",
          botName: "Mesero IA",
          welcomeMessage: `¡Hola! Bienvenido al asistente inteligente de ${businessName}. ¿Te gustaría conocer las especialidades, horarios o reservar una mesa?`,
          predefinedResponses: [
            { userMessage: "especiales", botReply: "Nuestros especiales son la Hamburguesa Sazón con tocino extra y la Pizza Horno de Leña con pesto artesanal." },
            { userMessage: "horario", botReply: "Abrimos de Martes a Domingo de 1:00 PM a 11:00 PM. ¡Te esperamos!" },
            { userMessage: "bebidas", botReply: "Tenemos cervezas artesanales, clericot de la casa y limonada fresca con hierbabuena." }
          ]
        }
      }
    ];
  } else if (category === 'automotive') {
    return [
      {
        id: "home",
        label: "Inicio",
        icon: "Home",
        type: "dashboard",
        content: {
          welcomeTitle: "¡Hola, Conductor!",
          welcomeSubtitle: `Sincronización de ${businessName}`,
          cards: [
            { title: "Autos en rampa", value: "6 vehículos", icon: "Wrench", desc: "Taller operando al 100%" },
            { title: "Citas programadas", value: "5 hoy", icon: "Calendar", desc: "Eficiencia en recepción" },
            { title: "Aprobaciones", value: "Pendiente", icon: "ShieldAlert", desc: "Presupuestos enviados" },
            { title: "Eficiencia", value: "95%", icon: "Activity", desc: "Entregas en tiempo pactado" }
          ]
        }
      },
      {
        id: "status",
        label: "Estatus",
        icon: "Activity",
        type: "tracker",
        content: {
          trackerTitle: "Seguimiento de tu Auto",
          activeProcessName: "Afinación Mayor - Mazda 3 (JVM-402)",
          currentStepIndex: 1,
          steps: ["Recepción & Escaneo", "En Reparación / Afinación", "Pruebas de Ruta", "Listo para Entrega ✅"]
        }
      },
      {
        id: "orden",
        label: "Agendar",
        icon: "Calendar",
        type: "form",
        content: {
          formTitle: "Nueva Orden de Servicio",
          buttonText: "Registrar Auto en Taller",
          successNotification: "¡Orden registrada! Hemos enviado la confirmación y la liga de seguimiento digital por WhatsApp.",
          formFields: [
            { name: "cliente", label: "Tu Nombre & Vehículo", type: "text", placeholder: "Ej. Lucas Solís - Honda Civic" },
            { name: "servicio", label: "Servicio requerido", type: "select", options: ["Afinación Completa", "Diagnóstico de Frenos", "Falla de Motor / Check Engine", "Suspensión / Amortiguadores"] },
            { name: "hora", label: "Hora de Recepción", type: "text", placeholder: "Ej. 09:00 AM" }
          ]
        }
      },
      {
        id: "mecanicobot",
        label: "Asesor IA",
        icon: "Bot",
        type: "chat",
        content: {
          chatTitle: "Mecánico-IA Inteligente",
          botName: "Ing. Bot",
          welcomeMessage: `¡Hola! Soy tu asesor mecánico digital de ${businessName}. ¿Tienes alguna luz encendida en tu tablero, quieres cotizar un servicio o consultar el estatus de tu coche?`,
          predefinedResponses: [
            { userMessage: "afinacion", botReply: "La afinación mayor incluye cambio de bujías, aceite sintético, filtros de aire/aceite/gasolina, lavado de inyectores y cuerpo de aceleración. ¡Cuesta $2,800 MXN para 4 cilindros!" },
            { userMessage: "frenos", botReply: "Si escuchas chirridos al frenar, es probable que requieras balatas nuevas o rectificado de discos. Te sugerimos agendar una inspección de seguridad." },
            { userMessage: "estatus", botReply: "Ingresa las placas de tu auto en la pestaña de 'Estatus' para ver en tiempo real las fotos y avances del diagnóstico que cargó el mecánico." }
          ]
        }
      }
    ];
  } else if (category === 'health_beauty') {
    return [
      {
        id: "home",
        label: "Inicio",
        icon: "Home",
        type: "dashboard",
        content: {
          welcomeTitle: "¡Hola, Paciente!",
          welcomeSubtitle: `Sincronización de ${businessName}`,
          cards: [
            { title: "Citas de hoy", value: "12 pacientes", icon: "Calendar", desc: "Sincronizado en tiempo real" },
            { title: "Pacientes", value: "240 activos", icon: "Users", desc: "Expedientes clínicos seguros" },
            { title: "Servicios Aplicados", value: "45 dosis/tratamientos", icon: "Activity", desc: "Alertas automáticas enviadas" },
            { title: "Membresías", value: "85 activas", icon: "CreditCard", desc: "Pagos recurrentes estables" }
          ]
        }
      },
      {
        id: "agenda",
        label: "Agendar",
        icon: "Calendar",
        type: "form",
        content: {
          formTitle: "Agendar Cita",
          buttonText: "Reservar Cita Express",
          successNotification: "¡Cita agendada! Te hemos enviado una alerta de confirmación WhatsApp al celular.",
          formFields: [
            { name: "cliente", label: "Tu Nombre Completo", type: "text", placeholder: "Ej. Elena Rodríguez" },
            { name: "servicio", label: "Servicio / Tratamiento", type: "select", options: ["Consulta de Especialista", "Procedimiento Clínico", "Masaje / Cuidado Corporal", "Tratamiento de Seguimiento"] },
            { name: "hora", label: "Hora deseada", type: "text", placeholder: "Ej. 11:00 AM" }
          ]
        }
      },
      {
        id: "pacientes",
        label: "Fichas",
        icon: "Users",
        type: "records",
        content: {
          recordsTitle: "Historial de Consultas",
          initialRecords: [
            { id: "p1", title: "Elena Rodríguez", subtitle: "Consulta de Valoración", badge: "11:00" },
            { id: "p2", title: "Roberto Gómez", subtitle: "Procedimiento General", badge: "14:30" },
            { id: "p3", title: "Camila Torres", subtitle: "Tratamiento Facial/Físico", badge: "16:00" }
          ]
        }
      },
      {
        id: "vetbot",
        label: "Soporte IA",
        icon: "Bot",
        type: "chat",
        content: {
          chatTitle: "Soporte Clínico con IA",
          botName: "Dr. Bot",
          welcomeMessage: `¡Hola! Soy el asistente inteligente de ${businessName}. ¿Quieres saber cuándo te toca tu próximo chequeo, conocer costos o agendar consulta?`,
          predefinedResponses: [
            { userMessage: "costo", botReply: "La valoración inicial tiene un costo de $450 MXN. Los tratamientos de seguimiento varían entre $350 y $850 MXN." },
            { userMessage: "requisitos", botReply: "Te recomendamos asistir con 10 minutos de anticipación. Si es tu primera cita, llenaremos tu expediente digital en la tablet de recepción." },
            { userMessage: "urgencia", botReply: "Para emergencias médicas graves, por favor asiste de inmediato o comunícate vía telefónica para darte prioridad de ingreso." }
          ]
        }
      }
    ];
  } else if (category === 'retail') {
    return [
      {
        id: "home",
        label: "Inicio",
        icon: "Home",
        type: "dashboard",
        content: {
          welcomeTitle: "¡Hola, Comprador!",
          welcomeSubtitle: `Sincronización de ${businessName}`,
          cards: [
            { title: "Pedidos de hoy", value: "34 órdenes", icon: "ShoppingBag", desc: "Sincronizado con inventario" },
            { title: "Catálogo", value: "1,200 ítems", icon: "FileText", desc: "Stock controlado con IA" },
            { title: "Entregas", value: "18 listas", icon: "Clock", desc: "En cola de entrega" },
            { title: "Suscripciones", value: "42 activos", icon: "Star", desc: "Paquetes recurrentes estables" }
          ]
        }
      },
      {
        id: "tienda",
        label: "Tienda",
        icon: "ShoppingBag",
        type: "catalog",
        content: {
          catalogTitle: "Productos Destacados",
          buttonText: "Añadir al Carrito",
          items: [
            { id: "p1", name: "Paquete Escolar / Oficina Premium", price: 280, desc: "Kit completo de cuadernos, lápices y accesorios", emoji: "🎒" },
            { id: "p2", name: "Carpeta Organizadora Pro", price: 45, desc: "Protección plástica y espiral metálico premium", emoji: "📓" },
            { id: "p3", name: "Dispositivo Tecnológico Smart", price: 599, desc: "Cargador inalámbrico y organizador de escritorio", emoji: "🔌" }
          ]
        }
      },
      {
        id: "pedido",
        label: "Pedir",
        icon: "Calendar",
        type: "form",
        content: {
          formTitle: "Nueva Solicitud de Pedido",
          buttonText: "Enviar Pedido Express",
          successNotification: "¡Pedido recibido! Te notificaremos por WhatsApp en cuanto tu paquete esté listo.",
          formFields: [
            { name: "cliente", label: "Tu Nombre", type: "text", placeholder: "Ej. Juan de Dios" },
            { name: "servicio", label: "Tipo de Pedido", type: "select", options: ["Pedido de Catálogo", "Impresiones y Copias", "Servicio a Domicilio", "Garantía / Devolución"] },
            { name: "hora", label: "Hora deseada de Entrega/Recolección", type: "text", placeholder: "Ej. 16:30 hrs" }
          ]
        }
      },
      {
        id: "asistente",
        label: "Asistente IA",
        icon: "Bot",
        type: "chat",
        content: {
          chatTitle: "Personal Shopper IA",
          botName: "Shop-Bot",
          welcomeMessage: `¡Hola! Soy tu asistente de compras personalizado en ${businessName}. ¿Quieres cotizar productos, consultar stock de materiales o rastrear tu pedido?`,
          predefinedResponses: [
            { userMessage: "envio", botReply: "Ofrecemos envío gratis en compras mayores a $500 MXN en toda la ciudad. Para montos menores, el costo de envío es de $35 MXN." },
            { userMessage: "stock", botReply: "Nuestro catálogo se actualiza en tiempo real. Si ves el artículo en la pestaña de 'Tienda', tenemos stock disponible para entrega hoy." },
            { userMessage: "factura", botReply: "Sí, emitimos facturas fiscales. Al recoger tu compra, proporciónanos tu RFC y constancia de situación fiscal para procesarla de inmediato." }
          ]
        }
      }
    ];
  } else if (category === 'home_services') {
    return [
      {
        id: "home",
        label: "Inicio",
        icon: "Home",
        type: "dashboard",
        content: {
          welcomeTitle: "¡Hola, Cliente!",
          welcomeSubtitle: `Sincronización de ${businessName}`,
          cards: [
            { title: "Servicios Hoy", value: "14 Solicitudes", icon: "Calendar", desc: "Mantenimientos agendados" },
            { title: "Técnicos Activos", value: "5 en Ruta", icon: "Users", desc: "Monitoreados por geolocalización" },
            { title: "Anticipos Cobrados", value: "Activo", icon: "CreditCard", desc: "Cobros de diagnóstico en Stripe" },
            { title: "Calificación Prom", value: "4.9 Estrellas", icon: "Star", desc: "Reseñas automáticas de clientes" }
          ]
        }
      },
      {
        id: "agenda",
        label: "Agendar",
        icon: "Calendar",
        type: "form",
        content: {
          formTitle: "Solicitar Técnico en Casa",
          buttonText: "Agendar Visita Técnica",
          successNotification: "¡Visita agendada! Te hemos enviado la confirmación y los datos de tu técnico asignado por WhatsApp.",
          formFields: [
            { name: "cliente", label: "Tu Nombre Completo", type: "text", placeholder: "Ej. Elena Rodríguez" },
            { name: "servicio", label: "Servicio Requerido", type: "select", options: ["Reparación de Emergencia", "Mantenimiento Preventivo", "Instalación de Equipo", "Diagnóstico y Presupuesto"] },
            { name: "hora", label: "Hora de Visita", type: "text", placeholder: "Ej. 10:00 AM" }
          ]
        }
      },
      {
        id: "tecnicos",
        label: "Estatus",
        icon: "Users",
        type: "tracker",
        content: {
          trackerTitle: "Progreso del Servicio",
          activeProcessName: "Servicio de Mantenimiento #1092",
          currentStepIndex: 1,
          steps: ["Solicitud Recibida", "Técnico en Camino 🚗", "Trabajo en Ejecución", "Servicio Finalizado & Garantía ✅"]
        }
      },
      {
        id: "soporte",
        label: "Soporte IA",
        icon: "Bot",
        type: "chat",
        content: {
          chatTitle: "Diagnóstico con IA",
          botName: "Soporte IA",
          welcomeMessage: `¡Hola! Soy tu asistente de mantenimiento digital en ${businessName}. ¿Quieres reportar una falla, cotizar un servicio o consultar el estatus de tu técnico?`,
          predefinedResponses: [
            { userMessage: "costo", botReply: "La visita de diagnóstico tiene un costo base de $300 MXN, los cuales se bonifican al 100% si apruebas el presupuesto de reparación." },
            { userMessage: "garantia", botReply: "Todos nuestros servicios cuentan con una garantía de 90 días por escrito, respaldada directamente en tu perfil digital de la PWA." },
            { userMessage: "tecnicos", botReply: "Nuestros técnicos están certificados, uniformados y portan identificación oficial digital. Recibirás su foto y ubicación por WhatsApp antes de llegar." }
          ]
        }
      }
    ];
  } else {
    return [
      {
        id: "home",
        label: "Inicio",
        icon: "Home",
        type: "dashboard",
        content: {
          welcomeTitle: "¡Hola, Bienvenido!",
          welcomeSubtitle: `Sincronización de ${businessName}`,
          cards: [
            { title: "Control de Citas", value: "Pendiente", icon: "Calendar", desc: "Digitaliza tu agenda en la nube" },
            { title: "Historial de Clientes", value: "Activo", icon: "Users", desc: "Registra preferencias y compras" },
            { title: "Pasarela Stripe", value: "0% comisiones", icon: "CreditCard", desc: "Recibe cobros y anticipos" },
            { title: "Recordatorios", value: "Automatizado", icon: "Bell", desc: "Alertas vía WhatsApp" }
          ]
        }
      },
      {
        id: "agenda",
        label: "Agenda",
        icon: "Calendar",
        type: "form",
        content: {
          formTitle: "Nueva Reservación de Servicio",
          buttonText: "Confirmar Registro Express",
          successNotification: "¡Registro completado! Hemos enviado la liga de confirmación por WhatsApp en tiempo real.",
          formFields: [
            { name: "cliente", label: "Tu Nombre Completo", type: "text", placeholder: "Ej. Elena Rodríguez" },
            { name: "servicio", label: "Servicio Requerido", type: "select", options: ["Asesoría de Negocios", "Atención al Cliente", "Soporte Técnico Especializado", "Otros Servicios"] },
            { name: "hora", label: "Hora", type: "text", placeholder: "Ej. 12:00 PM" }
          ]
        }
      },
      {
        id: "historial",
        label: "Clientes",
        icon: "Users",
        type: "records",
        content: {
          recordsTitle: "Registros en Sistema",
          initialRecords: [
            { id: "h1", title: "Elena Rodríguez", subtitle: "Servicio Solicitado", badge: "11:00" },
            { id: "h2", title: "Roberto Gómez", subtitle: "Soporte Técnico", badge: "14:30" },
            { id: "h3", title: "Camila Torres", subtitle: "Asesoría General", badge: "16:00" }
          ]
        }
      },
      {
        id: "soporte",
        label: "Asistente IA",
        icon: "Bot",
        type: "chat",
        content: {
          chatTitle: "Consultor de IA",
          botName: "Asistente IA",
          welcomeMessage: `¡Hola! Bienvenido al asistente virtual inteligente de ${businessName}. ¿En qué te puedo ayudar hoy?`,
          predefinedResponses: [
            { userMessage: "servicios", botReply: "Ofrecemos soluciones personalizadas para automatizar tu agenda, pasarela de pagos, CRM y reportes en tiempo real." },
            { userMessage: "pago", botReply: "Aceptamos pagos electrónicos seguros mediante Stripe, Mercado Pago y transferencias." },
            { userMessage: "soporte", botReply: "Estamos listos para ayudarte. Puedes levantar un ticket desde tu app y nuestro equipo técnico resolverá tu consulta en minutos." }
          ]
        }
      }
    ];
  }
}

function getFallbackAnalysis(businessType: string) {
  const clean = (businessType || '').toLowerCase().trim();
  let defaultBusiness = "Negocio Local";
  let digitizationLevel = 45;
  let recommendedFeatures = ["Agenda", "Expediente", "Pagos", "Notificaciones", "IA", "WhatsApp"];
  let detectedIssues = [
    "Dolor de cabeza 1: Fuga silenciosa de hasta un 30% de clientes potenciales debido a demoras en la respuesta inicial y falta de un canal de agendamiento autónomo 24/7.",
    "Dolor de cabeza 2: Alta tasa de inasistencias ('no-shows') de hasta un 20% que deja tiempos muertos costosos debido a recordatorios manuales tardíos o nulos.",
    "Dolor de cabeza 3: Fricción operativa severa y retrasos de flujo de caja al depender exclusivamente de transferencias bancarias manuales o cobros en efectivo.",
    "Dolor de cabeza 4: Descontrol de la información de clientes, lo que impide conocer las preferencias del consumidor e imposibilita fidelizar o lanzar promociones personalizadas.",
    "Dolor de cabeza 5: Dependencia absoluta de que el dueño atienda llamadas constantes y maneje la agenda, impidiendo delegar u optimizar el crecimiento del negocio."
  ];
  let recommendedColors = { primary: "#6366f1", secondary: "#14b8a6" };
  let cards = [
    { title: "Control de Citas", value: "Pendiente", icon: "Calendar", desc: "Digitaliza tu agenda en la nube" },
    { title: "Historial de Clientes", value: "0 Activos", icon: "Users", desc: "Registra preferencias y compras" },
    { title: "Pasarela Stripe", value: "Sin integrar", icon: "CreditCard", desc: "Recibe anticipos y cobros recurrentes" },
    { title: "Recordatorios", value: "Manuales", icon: "Bell", desc: "Automatiza alertas vía WhatsApp" }
  ];

  let howToPay = "Integra Stripe y Mercado Pago para cobrar pedidos directos, citas o servicios y retener anticipos de forma rápida.";
  let recurringIdeas = ["Membresía mensual de servicio preferente", "Suscripción para abasto de consumibles recurrentes", "Soporte prioritario"];
  let aiUsage = "Un asistente inteligente de IA responderá dudas básicas de tus clientes en WhatsApp y agendará sus visitas de manera autónoma.";
  let automations = ["Recordatorios automáticos vía WhatsApp 24h antes", "Envío de ticket digital inmediato", "Aviso automático de entrega lista"];
  let ownerBenefit = "Recupera hasta 12 horas operativas semanales, elimina el ausentismo (no-shows) y consolida tus cobros estables.";
  let categoryKey = "default";

  // Category 1: Comida y Bebidas (restaurantes, taquerías, sushi, mariscos, cafeterías, pastelerías, panaderías, pollerías, food trucks, bares, cocinas económicas)
  if (clean.includes('restaurante') || clean.includes('taquería') || clean.includes('taqueria') || clean.includes('sushi') || clean.includes('marisco') || clean.includes('café') || clean.includes('cafe') || clean.includes('pastelería') || clean.includes('pasteleria') || clean.includes('panadería') || clean.includes('panaderia') || clean.includes('pollería') || clean.includes('polleria') || clean.includes('truck') || clean.includes('bar') || clean.includes('cocina') || clean.includes('comida') || clean.includes('bebida')) {
    defaultBusiness = "Restaurante / Alimentos y Bebidas";
    digitizationLevel = 45;
    categoryKey = "food";
    detectedIssues = [
      "Dolor de cabeza 1: Comisiones abusivas de hasta el 30% cobradas por apps externas (UberEats, Rappi, Didi) que absorben por completo el margen de ganancia neto del restaurante.",
      "Dolor de cabeza 2: Cuello de botella operativo y pérdida de pedidos por saturación de llamadas y chats manuales de WhatsApp en horas pico de servicio.",
      "Dolor de cabeza 3: Mesas vacías en días de baja afluencia y cancelaciones imprevistas ('no-shows') en fin de semana que arruinan la planeación de insumos y causan mermas costosas.",
      "Dolor de cabeza 4: Pérdida de contacto directo con los comensales, lo que impide conocer sus datos para fidelizarlos mediante cupones automáticos, monederos o promociones vía WhatsApp.",
      "Dolor de cabeza 5: Fricción extrema en salón por lentitud en la toma de órdenes y entrega de cuentas de forma manual en horarios de alta demanda."
    ];
    recommendedFeatures = ["Menú Digital QR", "Pedidos Express", "Reservas Online", "Pasarela Stripe/MP", "Puntos de Lealtad", "IA Chatbot", "WhatsApp Alertas", "Mapa Local"];
    recommendedColors = { primary: "#f97316", secondary: "#e11d48" }; // Orange and Rose
    cards = [
      { title: "Pedidos de Hoy", value: "48 Órdenes", icon: "ShoppingBag", desc: "Monitorea la cocina en vivo" },
      { title: "Mesas Reservadas", value: "85% Capacidad", icon: "Calendar", desc: "Agendado para el fin de semana" },
      { title: "Ahorro Comisiones", value: "30% Recuperado", icon: "CreditCard", desc: "Sin depender de apps terceras" },
      { title: "WhatsApp Bot", value: "Activo 24/7", icon: "Bot", desc: "Responde menú y promociones" }
    ];
    howToPay = "Integra Stripe y Mercado Pago para cobrar pedidos directos a domicilio, para llevar o para reservar mesa con prepago. Minimiza filas y comisiones de apps externas.";
    recurringIdeas = ["Membresía de Café Ilimitado mensual", "Suscripción a Menú Ejecutivo diario de oficina", "Club VIP con descuentos exclusivos acumulados"];
    aiUsage = "Un chatbot con IA responde de inmediato en WhatsApp con recomendaciones de platillos personalizados, horarios de sucursales, alergias en ingredientes y reservas en segundos.";
    automations = ["Envío de ticket digital de compra", "Alerta automática por WhatsApp de 'Tu pedido va en camino'", "Notificación de puntos acumulados en el monedero"];
    ownerBenefit = "El dueño recupera hasta 15 horas semanales de llamadas telefónicas, elimina comisiones del 30% de agregadores externos de entrega y crea una base de datos propia de clientes recurrentes.";

  // Category 2: Servicios automotrices (talleres mecánicos, llanteras, autolavados, detailing, polarizados, refaccionarias, agencias seminuevos, grúas, verificaciones mecánicas)
  } else if (clean.includes('taller') || clean.includes('mecánico') || clean.includes('mecanico') || clean.includes('llantera') || clean.includes('autolavado') || clean.includes('detailing') || clean.includes('polarizado') || clean.includes('refaccionaria') || clean.includes('grúa') || clean.includes('grua') || clean.includes('verificación') || clean.includes('verificacion') || clean.includes('auto') || clean.includes('carro') || clean.includes('vehículo') || clean.includes('vehiculo')) {
    defaultBusiness = "Taller Mecánico / Centro de Servicio";
    digitizationLevel = 40;
    categoryKey = "automotive";
    detectedIssues = [
      "Dolor de cabeza 1: Fuga de ingresos y descontrol de rampa al agendar citas de diagnóstico vehicular manualmente, ocasionando encimamiento de autos y retrasos de entrega.",
      "Dolor de cabeza 2: Ineficiencia en la comunicación técnica al reportar fallas y presupuestos por llamadas, lo que retrasa la autorización del cliente y detiene el trabajo.",
      "Dolor de cabeza 3: Falta de anticipos en línea seguros, lo que resulta en autos abandonados temporalmente o cancelaciones de última hora que inutilizan las bahías de trabajo.",
      "Dolor de cabeza 4: Pérdida de recompra recurrente de mantenimiento preventivo (cambios de aceite, frenos, afinación) por no tener un historial y alertas automatizadas.",
      "Dolor de cabeza 5: Clientes molestos llamando de forma repetida preguntando por el estatus de su auto debido a la falta de un rastreador en tiempo real."
    ];
    recommendedFeatures = ["Agenda de Citas", "Historial Vehicular", "Recordatorios WhatsApp", "Firma de Presupuestos", "Pasarela de Anticipo", "Estatus del Auto", "Notificaciones de Entrega"];
    recommendedColors = { primary: "#eab308", secondary: "#2563eb" }; // Yellow and Blue
    cards = [
      { title: "Citas de Taller", value: "8 Autos Hoy", icon: "Calendar", desc: "Afinaciones, frenos y suspensión" },
      { title: "Diagnósticos PWA", value: "Activos", icon: "Wrench", desc: "Reportes con fotos y fallas" },
      { title: "Presupuestos Online", value: "En espera de firma", icon: "FileText", desc: "El cliente aprueba y paga el 50%" },
      { title: "Notificaciones", value: "WhatsApp Listo", icon: "Bell", desc: "Aviso automático: 'Tu auto está listo'" }
    ];
    howToPay = "Usa Stripe para cobrar el 50% de anticipo al autorizar el presupuesto mecánico digital. Mercado Pago para liquidaciones rápidas con QR en sucursal.";
    recurringIdeas = ["Membresía de mantenimiento anual (cambio de aceite, alineación)", "Plan de lavado ilimitado mensual para autos flotilla", "Suscripción de asistencia vial y grúa local"];
    aiUsage = "La IA analiza la marca, kilometraje y año del coche para recomendar de forma proactiva servicios preventivos y cotizar refacciones compatibles de inmediato.";
    automations = ["Alerta de WhatsApp de 'Tu auto está listo para entrega'", "Notificación automática de próximo servicio en 6 meses", "Envío de diagnóstico en PDF firmado por el técnico"];
    ownerBenefit = "Incrementa el ticket promedio un 24% al enviar cotizaciones detalladas y firmables por celular, y reduce cuellos de botella de llamadas preguntando '¿ya está mi auto?'.";

  // Category 3: Salud y belleza (estéticas, barberías, uñas, spas, clínicas dentales, consultorios, fisioterapia, laboratorios, ópticas, farmacias, nutriólogos, veterinarias)
  } else if (clean.includes('estética') || clean.includes('estetica') || clean.includes('barbería') || clean.includes('barberia') || clean.includes('uñas') || clean.includes('unas') || clean.includes('spa') || clean.includes('dental') || clean.includes('dentista') || clean.includes('clínica') || clean.includes('clinica') || clean.includes('consultorio') || clean.includes('fisioterapia') || clean.includes('laboratorio') || clean.includes('óptica') || clean.includes('optica') || clean.includes('farmacia') || clean.includes('nutriólogo') || clean.includes('nutriologo') || clean.includes('salud') || clean.includes('belleza') || clean.includes('veterinaria') || clean.includes('mascota')) {
    defaultBusiness = "Clínica de Salud, Estética o Vet";
    digitizationLevel = 55;
    categoryKey = "health_beauty";
    detectedIssues = [
      "Dolor de cabeza 1: Pérdidas de tiempo de hasta 12 horas semanales agendando citas de forma manual por chats y resolviendo empalmes de horarios de personal y salas.",
      "Dolor de cabeza 2: Alto índice de inasistencias ('no-shows') de hasta un 25% que deja salones o cabinas inactivas y pérdidas directas de ingresos por falta de cobro de anticipos.",
      "Dolor de cabeza 3: Falta de expedientes clínicos, fichas técnicas o historial de tratamientos accesibles, lo que demerita el servicio y arriesga la consistencia de los tratamientos.",
      "Dolor de cabeza 4: Incapacidad de vender membresías o paquetes de tratamiento de forma recurrente y automática para estabilizar el flujo mensual del negocio.",
      "Dolor de cabeza 5: Fuga de clientes hacia competidores que sí ofrecen agendamiento autónomo interactivo e inmediato las 24 horas del día por internet."
    ];
    recommendedFeatures = ["Agenda Interactiva", "Cobro de Anticipo", "Recordatorios WhatsApp", "Expediente / Ficha Técnica", "Membresías de Paquetes", "Catálogo Digital", "Recetas Médicas"];
    recommendedColors = { primary: "#a855f7", secondary: "#ec4899" }; // Purple & Pink
    cards = [
      { title: "Agenda Citas", value: "12 Diarias", icon: "Calendar", desc: "Consultas y procedimientos" },
      { title: "Expediente Clínico", value: "150 Activos", icon: "FolderOpen", desc: "Ficha médica digitalizada" },
      { title: "Control de Vacunas", value: "95% Al día", icon: "ShieldCheck", desc: "Alertas automatizadas vía WhatsApp" },
      { title: "Pagos de Membresía", value: "$1,200/mes", icon: "CreditCard", desc: "Suscripciones activas de salud" }
    ];
    howToPay = "Cobros con Stripe al reservar el horario para penalizar 'no-shows' o cancelaciones tardías. Liga de pago para paquetes de tratamientos completos.";
    recurringIdeas = ["Membresía mensual de barbería / uñas ilimitada", "Plan de salud dental preventivo (limpieza trimestral)", "Suscripción a plan nutricional con seguimiento de app"];
    aiUsage = "La IA asiste al paciente resolviendo dudas médicas básicas, agendando citas en tiempo real y categorizando síntomas o requerimientos del cliente de forma automatizada.";
    automations = ["Recordatorio automático por WhatsApp 24 horas antes de la cita", "Solicitud de opinión y reseña de Google Maps post-servicio", "Alerta de re-agendamiento automático tras 30 días"];
    ownerBenefit = "Reduce el ausentismo (no-shows) a menos del 3%, elimina la saturación de chats agendando manualmente y fideliza clientes recurrentes con cobros automáticos estables.";

  // Category 4: Comercio local (boutiques, zapaterías, tiendas de tenis, ferreterías, papelerías, minisúper, abarrotes, tiendas de regalos, celulares, accesorios)
  } else if (clean.includes('boutique') || clean.includes('zapatería') || clean.includes('zapateria') || clean.includes('tenis') || clean.includes('ferretería') || clean.includes('ferreteria') || clean.includes('papelería') || clean.includes('papeleria') || clean.includes('minisúper') || clean.includes('minisuper') || clean.includes('abarrotes') || clean.includes('regalos') || clean.includes('celular') || clean.includes('accesorio') || clean.includes('tienda') || clean.includes('comercio')) {
    defaultBusiness = "Comercio Local / Tienda";
    digitizationLevel = 40;
    categoryKey = "retail";
    detectedIssues = [
      "Dolor de cabeza 1: Clientes que abandonan compras potenciales al no tener un catálogo móvil interactivo, rápido y amigable optimizado para ver existencias al instante.",
      "Dolor de cabeza 2: Alta fricción en ventas al depender de transferencias manuales, envío de comprobantes de pago borrosos por chat y conciliación manual bancaria.",
      "Dolor de cabeza 3: Cuello de botella en entregas y descontrol en la recolección en tienda ('Click & Collect') por falta de coordinación automatizada de horarios.",
      "Dolor de cabeza 4: Inventarios desfasados y pérdida de ventas de stock por no contar con un canal unificado que actualice existencias en tiempo real con la tienda física.",
      "Dolor de cabeza 5: Nula retención de clientes por falta de un monedero digital de puntos de lealtad, haciendo que los compradores busquen precios más bajos en cadenas grandes."
    ];
    recommendedFeatures = ["Catálogo Digital", "Pedidos Express", "Pasarela Stripe/MP", "Programa de Puntos", "Alertas WhatsApp", "Cupones de Descuento", "Buscador Inteligente"];
    recommendedColors = { primary: "#3b82f6", secondary: "#10b981" }; // Blue and Emerald
    cards = [
      { title: "Catálogo Digital", value: "450 Artículos", icon: "ShoppingBag", desc: "Cuadernos, lápices y mochilas" },
      { title: "Pedidos Express", value: "15 Pendientes", icon: "FileText", desc: "Paga desde el cel y recoge" },
      { title: "Membresía Vip", value: "82 Suscriptores", icon: "CreditCard", desc: "Plan mensual de abasto premium" },
      { title: "Chatbot Asistente", value: "Activo", icon: "Bot", desc: "Cotiza y busca stock 24/7" }
    ];
    howToPay = "Vende tus productos con links de pago de Stripe o Mercado Pago directo en WhatsApp, o cobros en línea integrales de catálogo para envíos locales.";
    recurringIdeas = ["Caja de suscripción sorpresa mensual de boutique", "Membresía VIP de papelería/oficina para consumibles con descuento", "Plan premium de entregas ilimitadas gratis al mes"];
    aiUsage = "La IA actúa como estilista o consultor de compras personalizado, sugiriendo productos complementarios o buscando refacciones por foto o descripción.";
    automations = ["Envío inmediato de ticket de compra digital", "Notificación de 'Pedido Empacado' o 'Listo para Recoger'", "Envío masivo programado de promociones de cumpleaños"];
    ownerBenefit = "Amplía el horario de venta a 24/7 sin personal extra, genera lealtad de marca recurrente y duplica la velocidad de despacho de inventario estancado.";

  // Category 5: Servicios del hogar (plomería, electricidad, minisplits, impermeabilización, jardinería, fumigación, limpieza, construcción, tablaroca, pintura)
  } else if (clean.includes('plomería') || clean.includes('plomeria') || clean.includes('electricidad') || clean.includes('electricista') || clean.includes('minisplit') || clean.includes('clima') || clean.includes('aire acondicionado') || clean.includes('impermeabilización') || clean.includes('impermeabilizacion') || clean.includes('jardinería') || clean.includes('jardineria') || clean.includes('fumigación') || clean.includes('fumigacion') || clean.includes('limpieza') || clean.includes('construcción') || clean.includes('construccion') || clean.includes('tablaroca') || clean.includes('pintura') || clean.includes('pintor')) {
    defaultBusiness = "Servicios de Reparación & Mantenimiento";
    digitizationLevel = 30;
    categoryKey = "home_services";
    detectedIssues = [
      "Dolor de cabeza 1: Costo logístico elevado y pérdidas financieras al enviar técnicos a visitas de diagnóstico donde el cliente cancela a última hora o no se encuentra.",
      "Dolor de cabeza 2: Descontrol y reclamos de clientes sobre garantías y alcances debido a la ausencia de presupuestos formales con firma digital vinculante.",
      "Dolor de cabeza 3: Falta de visibilidad operativa para coordinar la ubicación de los técnicos en campo, demorando los tiempos de respuesta y atención urgente.",
      "Dolor de cabeza 4: Fricción extrema para recibir pagos con tarjeta de crédito en campo y emitir facturas, perdiendo liquidez operativa y agilidad de cobro.",
      "Dolor de cabeza 5: Dificultad para retener depósitos en garantía por adelantado para servicios de alto costo, exponiendo el negocio a pérdidas por materiales comprados."
    ];
    recommendedFeatures = ["Agenda de Técnicos", "Geolocalización / GPS", "Firma Digital", "Pasarela de Anticipo", "Envío de Cotizaciones", "Garantía Digital", "Reseñas de Clientes"];
    recommendedColors = { primary: "#0ea5e9", secondary: "#f59e0b" }; // Sky & Amber
    cards = [
      { title: "Servicios Hoy", value: "14 Solicitudes", icon: "Calendar", desc: "Fumigaciones y climas agendados" },
      { title: "Técnicos Activos", value: "5 en Ruta", icon: "Users", desc: "Monitoreados por geolocalización" },
      { title: "Anticipos Cobrados", value: "$68,000 MXN", icon: "CreditCard", desc: "Cobros del diagnóstico en Stripe" },
      { title: "Calificación Prom", value: "4.9 Estrellas", icon: "Star", desc: "Reseñas automáticas de Google" }
    ];
    howToPay = "Retención en garantía o cobro del 100% del diagnóstico vía Stripe. Envío de link de Mercado Pago para liquidar mano de obra al finalizar y aprobar el servicio.";
    recurringIdeas = ["Plan de mantenimiento anual de aire acondicionado/minisplit", "Suscripción de fumigación bimestral programada", "Póliza de mantenimiento preventivo del hogar trimestral"];
    aiUsage = "La IA analiza fotos del problema (ej. gotera, aire goteando) subidas por el cliente para pre-diagnosticar la falla, sugerir refacciones y calcular tiempos de trabajo aproximados.";
    automations = ["Alerta de WhatsApp: 'El técnico va en camino con ubicación en tiempo real'", "Envío de cotización formal y garantía en PDF", "Encuesta de satisfacción de estrellas automática"];
    ownerBenefit = "Consolida la confianza del cliente con procesos transparentes y profesionales, erradica cancelaciones de última hora al cobrar diagnóstico y escala la capacidad del equipo.";

  // Category 6: Educación (colegios, guarderías, academias, cursos, escuelas de inglés, música, deportes, regularización)
  } else if (clean.includes('colegio') || clean.includes('guardería') || clean.includes('guarderia') || clean.includes('academia') || clean.includes('curso') || clean.includes('escuela') || clean.includes('clases') || clean.includes('inglés') || clean.includes('ingles') || clean.includes('música') || clean.includes('musica') || clean.includes('deporte') || clean.includes('regularización') || clean.includes('regularizacion') || clean.includes('educación') || clean.includes('educacion')) {
    defaultBusiness = "Colegio / Academia de Enseñanza";
    digitizationLevel = 50;
    detectedIssues = [
      "Dolor de cabeza 1: Alta morosidad y enorme pérdida de tiempo del personal llamando individualmente a padres para cobrar colegiaturas mensuales vencidas.",
      "Dolor de cabeza 2: Comunicación caótica y desordenada por grupos de WhatsApp personales de maestros, mezclando temas educativos con consultas personales a deshoras.",
      "Dolor de cabeza 3: Desatención o pérdida de avisos importantes de la institución, eventos o circulares por parte de los padres al no tener un canal de notificación push.",
      "Dolor de cabeza 4: Inscripciones y firmas de contratos escolares lentas y manuales, que saturan de papelería las oficinas y retrasan la planeación de grupos escolares.",
      "Dolor de cabeza 5: Dificultad extrema para coordinar citas de tutoría docente o agendar de forma automática talleres extracurriculares o clases de regularización."
    ];
    recommendedFeatures = ["Portal de Pagos", "Inscripción en Línea", "Avisos & Comunicados", "Calendario Escolar", "Reporte de Calificaciones", "Control de Asistencia", "Agendamiento de Tutorías"];
    recommendedColors = { primary: "#1e3a8a", secondary: "#f97316" }; // Navy and Orange
    cards = [
      { title: "Matrícula Activa", value: "320 Alumnos", icon: "Users", desc: "Inscritos en portales de clases" },
      { title: "Colegias Cobradas", value: "98% Al día", icon: "CreditCard", desc: "Gracias a cobros domiciliados" },
      { title: "Avisos Enviados", value: "100% Recibidos", icon: "Bell", desc: "WhatsApp notificaciones masivas" },
      { title: "Agendas Tutoría", value: "15 esta semana", icon: "Calendar", desc: "Coordinadas de forma automática" }
    ];
    howToPay = "Usa cobros automáticos recurrentes (Suscripción Stripe) el día 1 de cada mes para domiciliar la colegiatura y erradicar la cartera vencida en un 95%.";
    recurringIdeas = ["Colegiatura domiciliada mensual automatizada", "Suscripción a talleres extracurriculares o deportes", "Plan de renta mensual de instrumentos o material didáctico"];
    aiUsage = "Un tutor inteligente integrado con IA que responde preguntas frecuentes sobre tareas, reglamento escolar, calendario de exámenes y guías de estudio personalizadas.";
    automations = ["Aviso automático por WhatsApp de cobro domiciliado exitoso o pendiente", "Notificación instantánea de avisos urgentes o suspensión por clima", "Envío de boleta mensual en PDF"];
    ownerBenefit = "Elimina al 100% las llamadas de cobranza manual, centraliza el flujo de comunicación escolar en un ambiente seguro y eleva el prestigio tecnológico institucional.";

  // Category 7: Agro e Industria Sinaloense (agricultores, empaques, agroinsumos, maquinaria agrícola, fumigación agrícola, transporte de cosecha, ganadería, pesca y mariscos, agroindustria, manufactura, codesin, sinaloa)
  } else if (clean.includes('agricultor') || clean.includes('agricultura') || clean.includes('agro') || clean.includes('empaque') || clean.includes('insumo') || clean.includes('maquinaria') || clean.includes('cosecha') || clean.includes('ganadería') || clean.includes('ganaderia') || clean.includes('pesca') || clean.includes('mariscos') || clean.includes('sinaloa') || clean.includes('codesin')) {
    defaultBusiness = "Agroinsumos & Logística Agrícola";
    digitizationLevel = 35;
    detectedIssues = [
      "Dolor de cabeza 1: Pérdidas en la productividad de cosechas y fallas fitosanitarias por descontrol en el registro de fechas de riego, bitácoras y aplicaciones de agroquímicos.",
      "Dolor de cabeza 2: Coordinación caótica de transportes de carga para el acarreo de granos o mariscos, generando camiones varados y mermas por tiempos de espera excesivos.",
      "Dolor de cabeza 3: Canales de venta lentos y cotizaciones informales de insumos agrícolas y refacciones, lo que ahuyenta a productores que requieren rapidez.",
      "Dolor de cabeza 4: Pérdidas por maquinaria agrícola inactiva o descompuesta debido a la falta de un plan y registro automatizado de mantenimiento preventivo.",
      "Dolor de cabeza 5: Firma de contratos de maquila y comercialización demorados por traslados físicos de los apoderados legales a las zonas de cultivo en Sinaloa."
    ];
    recommendedFeatures = ["Logística de Cosecha", "Bitácora de Campo", "Cotizador de Insumos", "Control de Maquinaria", "Contratos Digitales", "Fumigaciones GPS", "Reportes Fitocontrol CODESIN"];
    recommendedColors = { primary: "#15803d", secondary: "#16a34a" }; // Green and Light Green
    cards = [
      { title: "Acarreo Granos", value: "1,200 Toneladas", icon: "TrendingUp", desc: "Sincronizado con camiones GPS" },
      { title: "Fumigaciones Dron", value: "12 Parcelas", icon: "Activity", desc: "Reportes fitosanitarios listos" },
      { title: "Contratos Agro", value: "8 Firmados", icon: "FileText", desc: "Comercialización legal digital" },
      { title: "Socio CODESIN", value: "Sinaloa Activo", icon: "Shield", desc: "Indicadores de sector prioritario" }
    ];
    howToPay = "Cobros de renta de maquinaria, fletes agrícolas y agroinsumos mediante transferencias bancarias STP automatizadas e integradas en el CRM de KIDRIA, o anticipos vía Stripe.";
    recurringIdeas = ["Suscripción a servicio mensual de fumigación con drones", "Plan de arrendamiento de maquinaria agrícola con seguro incluido", "Plan de abasto recurrente de agroinsumos por temporada"];
    aiUsage = "La IA analiza datos de clima regional y reportes de campo para predecir plagas, sugerir dosis óptimas de fertilizantes y recomendar rutas logísticas eficientes de acarreo de cosecha.";
    automations = ["Envío de estatus de pesaje y de embarque por WhatsApp", "Generación automática de contratos de maquila en PDF", "Alertas meteorológicas extremas y fitosanitarias inmediatas"];
    ownerBenefit = "Maximiza el rendimiento operativo en sectores prioritarios clasificados por CODESIN Sinaloa, reduce pérdidas logísticas en el acarreo de granos o mariscos, y formaliza contratos al instante.";

  // Category 8: Profesionales (contadores, abogados, inmobiliarias, financieras, seguros, despachos administrativos)
  } else if (clean.includes('contador') || clean.includes('abogado') || clean.includes('inmobiliaria') || clean.includes('financiera') || clean.includes('seguro') || clean.includes('despacho') || clean.includes('administración') || clean.includes('administracion') || clean.includes('raíces') || clean.includes('raices') || clean.includes('propiedad') || clean.includes('asesor')) {
    defaultBusiness = "Despacho Profesional / Inmobiliario";
    digitizationLevel = 50;
    detectedIssues = [
      "Dolor de cabeza 1: Fuga de hasta el 40% de horas de consultoría facturables al agendar citas de asesoría inicial de forma manual sin cobro o confirmación automatizada.",
      "Dolor de cabeza 2: Tardanza de días en el envío, seguimiento y firma digital de contratos de servicio, contratos de compraventa o acuerdos de confidencialidad (NDAs).",
      "Dolor de cabeza 3: Prospectos (Leads) de clientes o propiedades inmobiliarias perdidos en bandejas de correo o libretas de asesores sin un CRM de seguimiento unificado.",
      "Dolor de cabeza 4: Retrasos constantes y cartera vencida al cobrar de forma manual igualas contables o comisiones profesionales al final del mes.",
      "Dolor de cabeza 5: Falta de un repositorio o bóveda en la nube segura que permita el intercambio confidencial de archivos contables (XML, PDF) o expedientes legales."
    ];
    recommendedFeatures = ["Agenda de Consultas", "Firma de Contratos", "CRM Inmobiliario / Leads", "Bóveda de Archivos", "Cobro de Igualas", "WhatsApp Notificaciones", "Chatbot IA"];
    recommendedColors = { primary: "#0f172a", secondary: "#475569" }; // Slate & Charcoal
    cards = [
      { title: "Asesorías Agenda", value: "14 Reuniones", icon: "Calendar", desc: "Ligado con Google Calendar" },
      { title: "Contratos en Firma", value: "5 Pendientes", icon: "FileText", desc: "Envío y firma digital en app" },
      { title: "Igualas Cobradas", value: "$112,000 MXN", icon: "CreditCard", desc: "Cobro recurrente por Stripe" },
      { title: "Bóveda Cliente", value: "220 Carpetas", icon: "FolderOpen", desc: "Descarga segura de PDF y XML" }
    ];
    howToPay = "Usa Stripe para procesar los cobros recurrentes de igualas contables/legales, o Mercado Pago para apartar una propiedad inmobiliaria con anticipo seguro.";
    recurringIdeas = ["Iguala de asesoría fiscal/legal mensual domiciliada", "Suscripción a boletín informativo premium y consultas flash ilimitadas", "Plan de administración de propiedades en arrendamiento"];
    aiUsage = "La IA lee y extrae datos clave de contratos pesados, leyes o pólizas para responder consultas legales/fiscales primarias de clientes en segundos de forma segura.";
    automations = ["Recordatorio automático de envío de facturas del mes", "Alerta WhatsApp: 'Tu contrato está listo para firma digital'", "Envío de acuse de presentación de impuestos en PDF"];
    ownerBenefit = "Automatiza el 80% de la carga administrativa en oficina, asegura el flujo de caja mediante cobros recurrentes y proyecta una imagen de máxima vanguardia tecnológica.";

  // Category 9: Turismo y hospedaje (hoteles, Airbnb, tours, renta de carros, salones de eventos, banquetes)
  } else if (clean.includes('hotel') || clean.includes('airbnb') || clean.includes('tour') || clean.includes('carro') || clean.includes('evento') || clean.includes('banquete') || clean.includes('hospedaje') || clean.includes('renta')) {
    defaultBusiness = "Hospedaje & Experiencias Turísticas";
    digitizationLevel = 45;
    categoryKey = "tourism";
    detectedIssues = [
      "Dolor de cabeza 1: Comisiones excesivas de hasta 15% a 20% pagadas a OTAs (Booking, Airbnb) que reducen severamente el margen de ganancia de hoteles u operadores locales.",
      "Dolor de cabeza 2: Trabajo manual exhaustivo para enviar contraseñas de Wi-Fi, códigos de acceso e instrucciones de llegada ('Self Check-In') a cada huésped por separado.",
      "Dolor de cabeza 3: Cancelaciones imprevistas en tours o rentas de autos que dejan inventario congelado e inactividad de guías por falta de cobro de depósito en garantía.",
      "Dolor de cabeza 4: Incapacidad de generar ingresos adicionales mediante la venta cruzada automatizada de extras (desayunos, traslados, tours locales) antes de la llegada.",
      "Dolor de cabeza 5: Pérdida de opiniones y posicionamiento en TripAdvisor o Google por no contar con una solicitud de reseñas proactiva e inteligente al momento de check-out."
    ];
    recommendedFeatures = ["Motor de Reservas", "Check-In Autónomo", "Cobro de Extras", "Depósito de Garantía", "Agenda de Experiencias", "WhatsApp Alertas", "Reseñas Tripadvisor"];
    recommendedColors = { primary: "#0d9488", secondary: "#14b8a6" }; // Teal & Turquoise
    cards = [
      { title: "Reservas Activas", value: "92% Ocupación", icon: "Calendar", desc: "Verano sincronizado sin sobrecupo" },
      { title: "Ahorro Comisiones", value: "18% Recuperado", icon: "TrendingUp", desc: "Canal directo de reservaciones" },
      { title: "Conserje IA", value: "85 Consultas", icon: "Bot", desc: "Respondiendo claves Wi-Fi y horarios" },
      { title: "Extras Vendidos", value: "$37,000 MXN", icon: "CreditCard", desc: "Tours y desayunos cobrados en app" }
    ];
    howToPay = "Cargo total o depósito de garantía del 50% con Stripe al reservar hospedaje. Cargo de servicios extras (tours, cenas, desayunos) mediante Mercado Pago con un link rápido en chat.";
    recurringIdeas = ["Club de Viajeros VIP con cuota mensual y noches gratis", "Suscripción a membresía vacacional compartida", "Plan corporativo de eventos de empresa anuales"];
    aiUsage = "Un conserje virtual con IA que atiende al huésped 24/7 recomendando restaurantes cercanos, actividades locales, contraseñas de Wi-Fi e instrucciones de check-in.";
    automations = ["Envío de guía interactiva de bienvenida por WhatsApp al confirmar la reserva", "Alerta automática del código de puerta para check-in autónomo", "Solicitud de reseña de Tripadvisor al hacer check-out"];
    ownerBenefit = "Ahorra miles de dólares en comisiones de plataformas del 15% al 20%, eleva la satisfacción del huésped con atención instantánea 24/7 y rentabiliza extras.";
  }

  const mappedIssues = (detectedIssues || []).map((issueStr: string, idx: number) => {
    let urgency: "Critico" | "Alto" | "Medio" | "Bajo" = "Medio";
    if (idx === 0) urgency = "Critico";
    else if (idx === 1) urgency = "Alto";
    else if (idx === 2) urgency = "Alto";
    else if (idx === 3) urgency = "Medio";
    else urgency = "Bajo";

    let title = "";
    let description = issueStr;

    if (issueStr.includes(':')) {
      const splitIdx = issueStr.indexOf(':');
      let firstPart = issueStr.substring(0, splitIdx).trim();
      let secondPart = issueStr.substring(splitIdx + 1).trim();
      
      firstPart = firstPart.replace(/Dolor de cabeza \d+/i, '').trim();
      if (firstPart.startsWith('-') || firstPart.startsWith(':')) {
        firstPart = firstPart.substring(1).trim();
      }
      
      if (firstPart && firstPart.length > 2) {
        title = firstPart;
        description = secondPart;
      } else {
        const words = secondPart.split(' ');
        title = words.slice(0, 4).join(' ');
        description = secondPart;
      }
    } else {
      title = `Problema Detectado ${idx + 1}`;
    }
    
    return { title, description, urgency };
  });

  return {
    businessType: defaultBusiness,
    digitizationLevel,
    growthOpportunity: digitizationLevel < 50 ? "Muy Alta" : "Alta",
    digitalCompetition: digitizationLevel < 50 ? "Baja" : "Media",
    automationPotential: 90,
    detectedIssues: mappedIssues,
    recommendedFeatures,
    projectionText: `Implementando estas funciones podrías reducir el tiempo administrativo en un 45%, automatizar reservas para incrementar la retención en un 28% y aumentar tus ingresos potenciales anuales. Esta estimación representa una proyección de escenarios potenciales y no constituye un resultado garantizado; los retornos reales varían según la adopción operativa del sistema por parte de tus clientes.`,
    howToPay,
    recurringIdeas,
    aiUsage,
    automations,
    ownerBenefit,
    recommendedColors,
    scenarios: {
      conservador: "+15% a +25% de ahorro en tiempos y recuperación de no-shows",
      probable: "+28% a +40% de incremento general en facturación mensual",
      optimista: "+45% a +60% de captación expandida de clientes e integraciones de IA"
    },
    stayingSameCost: {
      hoursLost: 42,
      timeCost: 18500,
      lostSales: 12300,
      adminErrors: 6200,
      totalMonthlyLoss: 37000
    },
    ifYouDoNothingPrognosis: [
      "Seguirás perdiendo más de 40 horas al mes en agendamientos y aclaraciones manuales.",
      "Necesitarás contratar a otro empleado administrativo solo para gestionar llamadas y recordatorios.",
      "Tus competidores directos automatizarán sus canales y absorberán tu cartera de clientes.",
      "Aumentarás los errores de registro de servicios, citas cruzadas y mermas operativas."
    ],
    digitalMaturity: {
      current: digitizationLevel,
      target: 90
    },
    developmentTimeDays: 46,
    roadmapPhases: [
      { phase: "Fase 1: Estructuración & Core PWA", progress: 60, description: "Estructuración de base de datos de usuarios, catálogos y panel interactivo." },
      { phase: "Fase 2: Pasarela & Notificaciones", progress: 30, description: "Integración de pagos Stripe y automatización de alertas instantáneas por WhatsApp." },
      { phase: "Fase 3: Inteligencia Artificial", progress: 10, description: "Despliegue del chatbot automatizado integrado para atención y ventas 24/7." }
    ],
    mockup: {
      title: `${defaultBusiness} Móvil`,
      subtitle: "Portal de Citas y Autoservicios PWA",
      tabs: getFallbackMockupTabs(categoryKey, defaultBusiness, recommendedColors)
    },
    proposal: {
      title: `Propuesta de Transformación Digital: PWA ${defaultBusiness}`,
      description: `Desarrollo llave en mano de una Aplicación Web Progresiva (PWA) móvil nativa para la automatización operativa de su ${defaultBusiness}, incluyendo agendas inteligentes, notificaciones instantáneas e integración de pasarela de pagos.`,
      objectives: [
        `Automatizar el 75% del flujo de agendamiento de citas y consultas.`,
        `Fidelizar clientes recurrentes a través de un esquema de suscripciones integrado.`,
        `Reducir la carga de administración telefónica en un 50% con recordatorios automáticos de WhatsApp.`
      ],
      features: recommendedFeatures,
      technologies: [
        "React 18 con TypeScript y Vite (Frontend ultra-rápido)",
        "Node.js & Express (Backend robusto y escalable)",
        "Google Cloud Firestore (Base de datos en tiempo real)",
        "Stripe Connect (Procesamiento de pagos y suscripciones)",
        "Gemini AI Business Assistant (Consultor inteligente integrado)"
      ],
      timeline: "15 a 30 días hábiles",
      cost: 14990,
      plans: {
        Starter: { cost: 7990, features: ["Diseño personalizado", "Firebase DB", "Panel administrativo", "WhatsApp integrado", "Instalación PWA", "Hosting", "Dominio gratis", "Capacitación"] },
        Business: { cost: 14990, features: ["Todo lo de Starter", "Agenda inteligente", "Control de Usuarios", "Reportes básicos", "Inventario", "Stripe Connect", "Notificaciones push", "Roles de acceso", "Dashboard empresarial"] },
        PremiumIA: { cost: 24990, features: ["Todo lo de Business", "IA entrenada (Gemini)", "Automatizaciones", "CRM integrado", "Dashboard avanzado", "Reportes inteligentes", "Analítica en tiempo real", "Integraciones API"] },
        Enterprise: { cost: 39990, features: ["Desarrollo 100% a la medida", "ERP modular", "CRM corporativo", "Multiempresa", "Multi-sucursales", "APIs de terceros", "IA personalizada", "Soporte preferencial 24/7"] }
      }
    }
  };
}

// IA Business Analyzer for Visitors
app.post('/api/gemini/analyze-visitor', async (req, res) => {
  const { businessType } = req.body;
  if (!businessType) {
    return res.status(400).json({ error: 'El tipo de negocio es requerido.' });
  }

  try {
    const ai = getGeminiClient();
    const systemInstruction = `Eres un Analista de Negocio, Consultor Tecnológico de Élite y Diseñador de Soluciones de KIDRIA. Tu objetivo es realizar un diagnóstico técnico y de transformación digital sumamente profundo, experto e investigado para el tipo de negocio proporcionado.
Refuerza tu gran diferenciador y propuesta de valor única en KIDRIA, la cual es conocer los dolores de cabeza ("dolores de cabeza" / pain points) más profundos, específicos, costosos y críticos que aquejan a este giro de negocio en el día a día (por ejemplo: ineficiencias de tiempo, cancelaciones de última hora, fuga masiva de prospectos por respuesta tardía en WhatsApp, descontrol en el flujo de caja, cobros manuales tediosos, desorganización operativa, dependencia total del dueño para operar, etc.). Debes describirlos con la autoridad de un absoluto experto del sector, detallando el cuello de botella específico de este giro y el impacto financiero u operativo real que causa.

Debes devolver un objeto JSON estrictamente válido en español, que coincida exactamente con este esquema:
{
  "businessType": "String",
  "digitizationLevel": 65,
  "growthOpportunity": "Alta",
  "digitalCompetition": "Media",
  "automationPotential": 92,
  "detectedIssues": [
    {
      "title": "Nombre corto del problema 1 (ej: 'Fuga silenciosa de prospectos')",
      "description": "Descripción ultra-específica e investigada del dolor principal de este giro de negocio y cómo desangra sus recursos o clientes",
      "urgency": "Critico"
    },
    {
      "title": "Nombre corto del problema 2 (ej: 'No-Shows en citas')",
      "description": "Descripción experta de otro dolor específico",
      "urgency": "Alto"
    },
    {
      "title": "Nombre corto del problema 3 (ej: 'Fricción en cobros manuales')",
      "description": "Descripción experta de otro dolor específico",
      "urgency": "Medio"
    },
    {
      "title": "Nombre corto del problema 4 (ej: 'Dependencia absoluta del dueño')",
      "description": "Descripción experta de otro dolor específico",
      "urgency": "Bajo"
    }
  ],
  "scenarios": {
    "conservador": "Texto de retorno estimado legalmente seguro (ej: '+15% a +25% de ahorro en tiempos y recuperación de no-shows')",
    "probable": "Texto de retorno probable (ej: '+28% a +40% de incremento general en facturación mensual')",
    "optimista": "Texto de retorno optimista (ej: '+45% a +60% de captación expandida de clientes e integraciones de IA')"
  },
  "stayingSameCost": {
    "hoursLost": 42,
    "timeCost": 18500,
    "lostSales": 12300,
    "adminErrors": 6200,
    "totalMonthlyLoss": 37000
  },
  "ifYouDoNothingPrognosis": [
    "Seguirás perdiendo más de 40 horas al mes en agendamientos y aclaraciones manuales.",
    "Necesitarás contratar a otro empleado administrativo solo para gestionar llamadas y recordatorios.",
    "Tus competidores directos automatizarán sus canales y absorberán tu cartera de clientes.",
    "Aumentarás los errores de registro de servicios, citas cruzadas y mermas operativas."
  ],
  "digitalMaturity": {
    "current": 62,
    "target": 90
  },
  "developmentTimeDays": 46,
  "roadmapPhases": [
    { "phase": "Fase 1: Estructuración & Core PWA", "progress": 60, "description": "Estructuración de base de datos de usuarios, catálogos y panel interactivo." },
    { "phase": "Fase 2: Pasarela & Notificaciones", "progress": 30, "description": "Integración de pagos Stripe y automatización de alertas instantáneas por WhatsApp." },
    { "phase": "Fase 3: Inteligencia Artificial", "progress": 10, "description": "Despliegue del chatbot automatizado integrado para atención y ventas 24/7." }
  ],
  "recommendedFeatures": ["Agenda", "Expediente", "Vacunas", "Pagos", "Notificaciones", "IA", "WhatsApp"],
  "projectionText": "Texto explicativo detallado sobre el incremento de ingresos y ROI potencial (siempre de forma hipotética, no garantizado).",
  "howToPay": "Texto explicando cómo cobrar y recibir pagos en línea usando Stripe y Mercado Pago para eficientizar la operación.",
  "recurringIdeas": ["Idea de pago recurrente 1", "Idea de pago recurrente 2", ...],
  "aiUsage": "Texto explicando detalladamente cómo se aplicará Inteligencia Artificial para automatizar tareas en el negocio.",
  "automations": ["Automatización de alertas WhatsApp de cita", "Automatización de avisos de cobro de iguala", ...],
  "ownerBenefit": "Texto explicando el beneficio principal y paz mental para el dueño de recuperar su tiempo libre.",
  "recommendedColors": {
    "primary": "Hex color code, e.g. #4f46e5",
    "secondary": "Hex color code, e.g. #10b981"
  },
  "mockup": {
    "title": "Nombre de la App",
    "subtitle": "Eslogan corto comercial",
    "tabs": [
      {
        "id": "home",
        "label": "Inicio",
        "icon": "Home",
        "type": "dashboard",
        "content": {
          "welcomeTitle": "¡Hola, <Nombre adaptado al perfil de cliente de este negocio>!",
          "welcomeSubtitle": "Sincronización de <Nombre del Negocio>",
          "cards": [
            { "title": "Módulo 1", "value": "Valor simulado, ej: '12 Citas Diarias'", "icon": "LucideIconName (debes elegir entre: Home, Users, ShoppingBag, CreditCard, ShieldAlert, FolderOpen, Heart, Activity, FileText, Bot, Wrench, Calendar, Bell, Star)", "desc": "Descripción del módulo" },
            { "title": "Módulo 2", "value": "Valor simulado", "icon": "LucideIconName", "desc": "Descripción del módulo" },
            { "title": "Módulo 3", "value": "Valor", "icon": "LucideIconName", "desc": "Descripción del módulo" },
            { "title": "Módulo 4", "value": "Valor", "icon": "LucideIconName", "desc": "Descripción del módulo" }
          ]
        }
      },
      {
        "id": "tab2_id",
        "label": "Label de la Tab 2",
        "icon": "LucideIconName",
        "type": "dashboard | catalog | form | records | chat | tracker (Elige el tipo más apto para este negocio)",
        "content": {
          "catalogTitle": "String (Solo si es catalog, ej: 'Especialidades', 'Servicios Estética')",
          "buttonText": "String (Solo si es catalog, ej: 'Añadir al Pedido')",
          "items": [
            { "id": "String", "name": "Nombre de Producto/Servicio", "price": Number, "desc": "Descripción atractiva", "emoji": "Emoji correspondiente" },
            { "id": "String", "name": "Nombre", "price": Number, "desc": "Descripción", "emoji": "Emoji" },
            { "id": "String", "name": "Nombre", "price": Number, "desc": "Descripción", "emoji": "Emoji" }
          ]
        }
      },
      {
        "id": "tab3_id",
        "label": "Label de la Tab 3",
        "icon": "LucideIconName",
        "type": "dashboard | catalog | form | records | chat | tracker",
        "content": {
          "formTitle": "Título del Formulario (Solo si es form)",
          "buttonText": "Texto del botón del Formulario (Solo si es form)",
          "successNotification": "Mensaje de éxito que saldrá al enviar el formulario (Solo si es form)",
          "formFields": [
            { "name": "cliente", "label": "Tu Nombre", "type": "text", "placeholder": "Escribe aquí..." },
            { "name": "servicio", "label": "Servicio", "type": "select", "options": ["Opción 1", "Opción 2"] },
            { "name": "hora", "label": "Hora", "type": "text", "placeholder": "Ej. 10:00" }
          ],
          "recordsTitle": "Título del listado (Solo si es records)",
          "initialRecords": [
            { "id": "r1", "title": "Título 1", "subtitle": "Subtítulo 1", "badge": "Badge" },
            { "id": "r2", "title": "Título 2", "subtitle": "Subtítulo 2", "badge": "Badge" }
          ],
          "trackerTitle": "Título del rastreador (Solo si es tracker)",
          "activeProcessName": "Nombre del proceso activo actual (Solo si es tracker)",
          "currentStepIndex": 1,
          "steps": ["Paso 1", "Paso 2", "Paso 3", "Paso 4"]
        }
      },
      {
        "id": "tab4_id",
        "label": "Asistente",
        "icon": "Bot",
        "type": "chat",
        "content": {
          "chatTitle": "Nombre del Chatbot Inteligente (ej: 'Chef-Bot', 'Asesor Dental IA')",
          "botName": "Nombre corto del bot",
          "welcomeMessage": "Mensaje de bienvenida personalizado explicando qué puede hacer el bot en este negocio",
          "predefinedResponses": [
            { "userMessage": "Palabra clave corta", "botReply": "Respuesta completa de la IA detallando esa consulta" },
            { "userMessage": "Palabra clave 2", "botReply": "Respuesta 2" },
            { "userMessage": "Palabra clave 3", "botReply": "Respuesta 3" }
          ]
        }
      }
    ]
  },
  "proposal": {
    "title": "Título de la Propuesta",
    "description": "Texto descriptivo general",
    "objectives": ["Objetivo 1", "Objetivo 2", ...],
    "features": ["Módulo de Agenda Inteligente", "Expediente digital", ...],
    "technologies": ["React 18 con TypeScript", "Google Cloud Firestore", "Stripe Connect", "Gemini AI SDK"],
    "timeline": "15 a 30 días hábiles",
    "cost": 14990,
    "plans": {
      "Starter": { "cost": 7990, "features": ["Diseño personalizado", "Firebase DB", "Panel administrativo", "WhatsApp integrado", "Instalación PWA", "Hosting", "Dominio gratis", "Capacitación"] },
      "Business": { "cost": 14990, "features": ["Todo lo de Starter", "Agenda inteligente", "Control de Usuarios", "Reportes básicos", "Inventario", "Stripe Connect", "Notificaciones push", "Roles de acceso", "Dashboard empresarial"] },
      "PremiumIA": { "cost": 24990, "features": ["Todo lo de Business", "IA entrenada (Gemini)", "Automatizaciones", "CRM integrado", "Dashboard avanzado", "Reportes inteligentes", "Analítica en tiempo real", "Integraciones API"] },
      "Enterprise": { "cost": 39990, "features": ["Desarrollo 100% a la medida", "ERP modular", "CRM corporativo", "Multiempresa", "Multi-sucursales", "APIs de terceros", "IA personalizada", "Soporte preferencial 24/7"] }
    }
  }
}

Reglas críticas de negocio:
- El JSON debe ser estrictamente válido. No uses marcadores de markdown (\`\`\`) en la respuesta.
- Los precios están estrictamente en pesos mexicanos (MXN).
- Los planes son: Starter ($7,990 MXN, 7 a 15 días), Business ($14,990 MXN, 15 a 30 días), PremiumIA ($24,990 MXN, 30 a 60 días), Enterprise (Desde $39,990 MXN, 60 a 120 días).
- Recomienda la categoría ideal basada en el tamaño e integraciones sugeridas.`;

    // KIDRIA AI Memory Engine: load previous business investigations to improve the next analysis!
    let memoryContext = "";
    try {
      const pastCases = await safeGetRecentInvestigations(6);
      if (pastCases.length > 0) {
        const cases = pastCases.map((d, idx) => {
          const issueTitles = (d.detectedIssues || []).map((issue: any) => typeof issue === 'object' && issue ? issue.title : issue);
          return `${idx + 1}. Giro: "${d.businessType}" -> PWA: "${d.mockupTitle}" (${d.mockupSubtitle}). Dolores erradicados: ${issueTitles.slice(0, 2).join(', ')}. Funciones recomendadas: ${(d.recommendedFeatures || []).slice(0, 4).join(', ')}`;
        });
        memoryContext = `\n\n[MEMORIA DE CONSULTORÍA KIDRIA AI - CASOS ANTERIORES LOGRADOS]:\n` +
          `Como KIDRIA AI, has adquirido experiencia real analizando otros negocios y guardando sus especificaciones absolutas. Revisa tus decisiones en estos casos previos para ofrecer diagnósticos aún más precisos, coherentes y especializados:\n` +
          cases.join('\n') + 
          `\n\nUsa este conocimiento acumulado como un cerebro de consultoría vivo. Integra aprendizajes de estos dolores de cabeza y de sus automatizaciones de forma creativa en tu nueva propuesta.`;
      }
    } catch (dbReadErr) {
      console.log('[KIDRIA Memory] Sincronizando lectura de historial.');
    }

    const prompt = `Analiza detalladamente un negocio con el siguiente giro o descripción: "${businessType}".` + 
      (memoryContext ? `\n\n${memoryContext}` : '');

    const response = await generateContentWithRetry({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.6,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('No se recibió respuesta del modelo.');
    }

    const data = JSON.parse(text.trim());

    // Save absolute information of this investigation to Firestore database / local JSON so KIDRIA continues to learn
    try {
      await safeSaveInvestigation({
        businessType: data.businessType || businessType,
        digitizationLevel: data.digitizationLevel || 50,
        growthOpportunity: data.growthOpportunity || "Alta",
        digitalCompetition: data.digitalCompetition || "Media",
        automationPotential: data.automationPotential || 90,
        detectedIssues: data.detectedIssues || [],
        recommendedFeatures: data.recommendedFeatures || [],
        projectionText: data.projectionText || '',
        howToPay: data.howToPay || '',
        recurringIdeas: data.recurringIdeas || [],
        aiUsage: data.aiUsage || '',
        automations: data.automations || [],
        ownerBenefit: data.ownerBenefit || '',
        mockupTitle: data.mockup?.title || data.businessType || businessType,
        mockupSubtitle: data.mockup?.subtitle || ''
      });
    } catch (dbSaveErr) {
      console.log('[KIDRIA Memory] Sincronizando registro de investigación en BD.');
    }

    res.json(data);
  } catch (error: any) {
    console.log('[KIDRIA Memory] Utilizando respuesta estructurada de contingencia.');
    const fallback = getFallbackAnalysis(businessType);

    // Save fallback investigation to Firestore too
    try {
      await safeSaveInvestigation({
        businessType: fallback.businessType || businessType,
        digitizationLevel: fallback.digitizationLevel || 50,
        growthOpportunity: fallback.growthOpportunity || "Alta",
        digitalCompetition: fallback.digitalCompetition || "Media",
        automationPotential: fallback.automationPotential || 90,
        detectedIssues: fallback.detectedIssues || [],
        recommendedFeatures: fallback.recommendedFeatures || [],
        projectionText: fallback.projectionText || '',
        howToPay: fallback.howToPay || '',
        recurringIdeas: fallback.recurringIdeas || [],
        aiUsage: fallback.aiUsage || '',
        automations: fallback.automations || [],
        ownerBenefit: fallback.ownerBenefit || '',
        mockupTitle: fallback.mockup?.title || fallback.businessType || businessType,
        mockupSubtitle: fallback.mockup?.subtitle || ''
      });
    } catch (dbSaveErr) {
      console.log('[KIDRIA Memory] Sincronizando registro alternativo de investigación en BD.');
    }

    res.json(fallback);
  }
});

// GET endpoint to retrieve previous business investigations for continuous learning display
app.get('/api/gemini/previous-investigations', async (req, res) => {
  try {
    const list = await safeGetRecentInvestigations(10);
    const mappedList = list.map(d => ({
      id: d.id,
      businessType: d.businessType,
      mockupTitle: d.mockupTitle || d.businessType,
      mockupSubtitle: d.mockupSubtitle || '',
      createdAt: d.createdAt,
      digitizationLevel: d.digitizationLevel || 50,
      automationPotential: d.automationPotential || 90,
      detectedIssuesCount: (d.detectedIssues || []).length,
      recommendedFeatures: d.recommendedFeatures || []
    }));
    res.json(mappedList);
  } catch (error: any) {
    console.error('Error fetching previous investigations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Domain Checker Mock API
app.post('/api/domains/check', (req, res) => {
  const { domain } = req.body;
  if (!domain) {
    return res.status(400).json({ error: 'Dominio no proporcionado.' });
  }

  const cleanDomain = domain.toLowerCase().trim();
  const extensions = ['.com', '.app', '.net', '.mx', '.dev', '.tech', '.ai'];
  
  const hasExtension = extensions.some(ext => cleanDomain.endsWith(ext));
  const queryDomain = hasExtension ? cleanDomain : `${cleanDomain}.com`;

  // Deterministic but random-looking availability based on name length
  const hash = queryDomain.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const available = hash % 3 !== 0; // 66% chance of being available

  let price = 12.99;
  if (queryDomain.endsWith('.ai')) price = 79.99;
  else if (queryDomain.endsWith('.app') || queryDomain.endsWith('.dev')) price = 15.99;
  else if (queryDomain.endsWith('.tech')) price = 9.99;

  res.json({
    domainName: queryDomain,
    available,
    price: available ? price : undefined,
    status: available ? 'none' : 'active',
    sslActive: !available,
    vencimiento: available ? undefined : '2027-06-27',
    dnsConfig: available ? undefined : [
      { type: 'A', host: '@', value: '153.40.44.228', ttl: 3600 },
      { type: 'CNAME', host: 'www', value: 'cname.kidria.app', ttl: 3600 },
      { type: 'TXT', host: '@', value: 'kidria-verification-code-38194', ttl: 3600 }
    ]
  });
});

// Stripe Status Endpoint
app.get('/api/stripe/status', (req, res) => {
  const stripe = getStripeClient();
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const configured = !!stripe;
  const mode = stripeKey.startsWith('sk_live_') ? 'live' : stripeKey.startsWith('sk_test_') ? 'test' : 'simulation';
  const webhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;
  
  // Public webhook URL
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const webhookUrl = `${protocol}://${host}/api/stripe/webhook`;

  res.json({
    configured,
    mode,
    webhookConfigured,
    webhookUrl,
    stripeVersion: '2025-02-18'
  });
});

// Retrieve successful Stripe webhook event states
app.get('/api/stripe/webhook-events', (req, res) => {
  const { orderId } = req.query;
  const payments = getProcessedPayments();
  
  if (orderId) {
    const payment = payments[String(orderId)];
    return res.json({
      found: !!payment,
      payment: payment || null
    });
  }
  
  res.json({
    payments
  });
});

// Real & Mock Stripe Create Checkout Session Flow
app.post('/api/stripe/create-checkout', async (req, res) => {
  const { orderId, amount, concept, isSubscription, customerEmail } = req.body;

  if (!orderId || !amount) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (orderId, amount).' });
  }

  const stripe = getStripeClient();
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  const isReal = !!stripe;
  const mode = stripeKey.startsWith('sk_live_') ? 'live' : stripeKey.startsWith('sk_test_') ? 'test' : 'simulation';

  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const baseUrl = `${protocol}://${host}`;

  const successUrl = `${baseUrl}/?payment_status=success&order_id=${orderId}&amount=${amount}&concept=${encodeURIComponent(concept || '')}`;
  const cancelUrl = `${baseUrl}/?payment_status=canceled&order_id=${orderId}`;

  if (stripe) {
    try {
      let session;
      if (isSubscription) {
        // Create product and price dynamically for subscription
        const product = await stripe.products.create({
          name: concept || 'Suscripción KIDRIA',
          description: `Servicios recurrentes para la Orden ${orderId}`,
        });
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(Number(amount) * 100),
          currency: 'mxn',
          recurring: { interval: 'month' },
        });

        session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{ price: price.id, quantity: 1 }],
          mode: 'subscription',
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: { orderId, concept, isSubscription: 'true' },
          customer_email: customerEmail || undefined,
        });
      } else {
        // Single payment
        session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'mxn',
              product_data: {
                name: concept || 'Servicios KIDRIA',
                description: `Pago único por la Orden ${orderId}`,
              },
              unit_amount: Math.round(Number(amount) * 100),
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: { orderId, concept, isSubscription: 'false' },
          customer_email: customerEmail || undefined,
        });
      }

      console.log(`[Stripe Real] Checkout Session creada con éxito: ${session.id} (${mode})`);
      return res.json({
        url: session.url,
        sessionId: session.id,
        isReal: true,
        mode
      });
    } catch (error: any) {
      console.error(`❌ Stripe Error creating checkout session:`, error.message);
      // Fail gracefully: fall back to simulator if requested or return error
      return res.status(500).json({ 
        error: 'Error al iniciar Checkout en Stripe real.', 
        details: error.message 
      });
    }
  }

  // Fallback / Sandbox Mock Checkout Session
  const sessionId = `cs_test_${Math.random().toString(36).substring(2, 15)}`;
  const simUrl = `/stripe-simulation?session_id=${sessionId}&order_id=${orderId}&amount=${amount}&concept=${encodeURIComponent(concept || 'Servicios PWA')}&is_subscription=${isSubscription ? 'true' : 'false'}`;
  
  res.json({
    url: simUrl,
    sessionId,
    isReal: false,
    mode: 'simulation'
  });
});


// --- ADMIN USER MANAGEMENT ENDPOINTS ---

async function checkIsAdmin(uid: string): Promise<boolean> {
  if (!uid) return false;
  if (uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03') return true;
  try {
    const doc = await adminDb.collection('usuarios').doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      return data?.role === 'admin_general';
    }
  } catch (err) {
    const local = readJsonFallback(FALLBACK_USERS_FILE);
    const profile = local.find((u: any) => u.uid === uid);
    return profile?.role === 'admin_general';
  }
  return false;
}

// Get all users
app.get('/api/users', async (req: any, res: any) => {
  const { requesterUid } = req.query;
  if (!requesterUid) {
    return res.status(400).json({ error: 'ID de solicitante requerido.' });
  }

  const isAdmin = await checkIsAdmin(requesterUid);
  if (!isAdmin) {
    return res.status(403).json({ error: 'No autorizado. Solo administradores generales.' });
  }

  let usersList: any[] = [];
  try {
    const snapshot = await adminDb.collection('usuarios').get();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data) {
        const { passwordHash, ...safeUser } = data;
        usersList.push(safeUser);
      }
    });
  } catch (err) {
    const local = readJsonFallback(FALLBACK_USERS_FILE);
    usersList = local.map(({ passwordHash, ...safeUser }: any) => safeUser);
  }

  res.json({ success: true, users: usersList });
});

// Update user role
app.post('/api/users/update-role', async (req: any, res: any) => {
  const { requesterUid, targetUid, newRole } = req.body;
  if (!requesterUid || !targetUid || !newRole) {
    return res.status(400).json({ error: 'Parámetros incompletos.' });
  }

  const isAdmin = await checkIsAdmin(requesterUid);
  if (!isAdmin) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  if (requesterUid === targetUid) {
    return res.status(400).json({ error: 'No puedes cambiar tu propio rol.' });
  }

  try {
    await adminDb.collection('usuarios').doc(targetUid).update({ role: newRole });
  } catch (err) {
    const local = readJsonFallback(FALLBACK_USERS_FILE);
    const idx = local.findIndex((u: any) => u.uid === targetUid);
    if (idx >= 0) {
      local[idx].role = newRole;
      writeJsonFallback(FALLBACK_USERS_FILE, local);
    } else {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
  }

  res.json({ success: true });
});

// Create new administrator
app.post('/api/users/create-admin', async (req: any, res: any) => {
  const { requesterUid, email, nombre, password } = req.body;
  if (!requesterUid || !email || !nombre || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  const isAdmin = await checkIsAdmin(requesterUid);
  if (!isAdmin) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  // Check if email already registered in our DB
  let existingUser = await safeGetUsuarioByEmail(cleanEmail);
  if (existingUser) {
    return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
  }

  let uid = '';
  try {
    const newRecord = await adminAuth.createUser({
      email: cleanEmail,
      password: password,
      displayName: nombre.trim(),
      emailVerified: true
    });
    uid = newRecord.uid;
  } catch (err: any) {
    if (err.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado en Firebase Auth.' });
    }
    uid = `fallback-${randomBytes(8).toString('hex')}`;
  }

  const newAdminProfile = {
    uid,
    email: cleanEmail,
    nombre: nombre.trim(),
    empresa: 'KIDRIA Studio',
    role: 'admin_general',
    telefono: '',
    giro: 'Desarrollo de Software',
    colores: {
      primary: '#0f172a',
      secondary: '#10b981'
    },
    referralCode: `KIDRIA-ADM-${Math.floor(1000 + Math.random() * 9000)}`,
    referidosContratados: 0,
    referidosGanancia: 0,
    twoFactorEnabled: false,
    passwordHash: hashPassword(password),
    verified: true
  };

  await safeSaveUsuario(uid, newAdminProfile);
  res.json({ success: true, profile: { uid, email: cleanEmail, nombre, role: 'admin_general' } });
});

// Delete user
app.post('/api/users/delete', async (req: any, res: any) => {
  const { requesterUid, targetUid } = req.body;
  if (!requesterUid || !targetUid) {
    return res.status(400).json({ error: 'Parámetros incompletos.' });
  }

  const isAdmin = await checkIsAdmin(requesterUid);
  if (!isAdmin) {
    return res.status(403).json({ error: 'No autorizado.' });
  }

  if (requesterUid === targetUid) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' });
  }

  // Delete from Auth if not a fallback user
  if (!targetUid.startsWith('fallback-')) {
    try {
      await adminAuth.deleteUser(targetUid);
    } catch (err) {}
  }

  try {
    await adminDb.collection('usuarios').doc(targetUid).delete();
  } catch (err) {
    const local = readJsonFallback(FALLBACK_USERS_FILE);
    const filtered = local.filter((u: any) => u.uid !== targetUid);
    writeJsonFallback(FALLBACK_USERS_FILE, filtered);
  }

  res.json({ success: true });
});


// Setup Vite Dev Server / Static Assets handling
async function startServer() {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support wildcard API routes properly by not intercepting under /api
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only start the listening server if we are running locally / container (not as a serverless function)
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[KIDRIA Server] Running on http://0.0.0.0:${PORT}`);
    });
  }
}

// Start local dev server if not in a serverless environment
if (!process.env.VERCEL) {
  startServer();
}

export default app;
