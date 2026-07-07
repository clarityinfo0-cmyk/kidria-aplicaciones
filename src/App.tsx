import React, { useState, useEffect } from 'react';
import { 
  getStoredState, STEPPER_STEPS, INITIAL_PROFILES
} from './data';
import { ProjectOrder, SupportTicket, ChatMessage, UserProfile, StepperStep, PaymentSettings } from './types';
import ClientDashboard from './components/ClientDashboard';
import AdminDashboard from './components/AdminDashboard';
import VisitorFunnel from './components/VisitorFunnel';
import StripeSimulation from './components/StripeSimulation';
import LoginScreen from './components/LoginScreen';
import SplashIntro from './components/SplashIntro';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  Shield, User, Briefcase, HelpCircle, LogOut, CheckCircle2, 
  MessageSquare, Sparkles, Building2, Bell, Smartphone, X,
  Facebook, Instagram, MessageCircle
} from 'lucide-react';

export function KidriaLogo({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <div className={`${className} flex items-center justify-center bg-zinc-950 rounded-xl border border-indigo-500/20 shadow-lg relative overflow-hidden p-1.5`}>
      <svg viewBox="0 0 120 120" fill="none" className="w-full h-full animate-pulse" xmlns="http://www.w3.org/2000/svg" style={{ animationDuration: '3s' }}>
        <defs>
          <linearGradient id="blueGradApp" x1="0" y1="0" x2="0" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00c6ff" />
            <stop offset="100%" stopColor="#0072ff" />
          </linearGradient>
          <linearGradient id="purpleGradApp" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#d946ef" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <path d="M40 25 H52 L44 53 L52 81 H40 L32 53 Z" fill="url(#blueGradApp)" />
        <path d="M52 53 L78 25 H92 L64 53 L92 81 H78 Z" fill="url(#purpleGradApp)" />
      </svg>
    </div>
  );
}

function createDefaultOrderForUser(user: UserProfile): ProjectOrder {
  return {
    id: `order_client_${user.uid}`,
    cliente: user.nombre || 'Cliente KIDRIA',
    correo: user.email,
    empresa: user.empresa || 'Mi Empresa',
    telefono: user.telefono || '',
    giro: user.giro || 'General',
    proyecto: `PWA ${user.empresa || 'Mi Empresa'} Enterprise System`,
    precioTotal: 15000,
    anticipo: 7500,
    saldoPendiente: 7500,
    estado: 'step_diseno',
    fechaContratacion: new Date().toISOString().split('T')[0],
    fechaEntrega: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    mensualidad: 250,
    estadoStripe: 'active',
    estadoFirebase: 'pending',
    notasInternas: 'El client es muy receptivo. Prioridad en animaciones móviles fluidas.',
    prioridad: 'alta',
    categoria: 'PWA Premium',
    observaciones: 'Configuración inicial en progreso.',
    responsableProyecto: 'Lucas Prieto (Senior Frontend Developer)',
    historial: [
      { id: 'h1', fecha: new Date().toISOString().replace('T', ' ').substring(0, 16), titulo: 'Proyecto Iniciado', descripcion: 'Registro de cuenta e inicio de aprovisionamiento de la PWA.', autor: 'KIDRIA Team' }
    ],
    archivos: [
      { id: 'f1', nombre: 'Guia_Desarrollo_KIDRIA.pdf', categoria: 'manual', url: '#', size: '1.2 MB', fecha: new Date().toISOString().split('T')[0] }
    ],
    facturas: [
      { id: `inv_1_${Date.now()}`, numero: 'INV-2026-001', concepto: 'Anticipo del 50% - Desarrollo PWA', monto: 7500, fechaEmision: new Date().toISOString().split('T')[0], fechaVencimiento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], estado: 'pendiente' },
      { id: `inv_2_${Date.now()}`, numero: 'INV-2026-002', concepto: 'Suscripción Mensual Soporte e IA', monto: 250, fechaEmision: new Date().toISOString().split('T')[0], fechaVencimiento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], estado: 'pendiente' }
    ],
    contractSigned: false
  };
}

export function createDummyNoOrderForUser(user: UserProfile): ProjectOrder {
  return {
    id: `no_order_${user.uid}`,
    cliente: user.nombre || 'Cliente KIDRIA',
    correo: user.email,
    empresa: user.empresa || 'Mi Empresa',
    telefono: user.telefono || '',
    giro: user.giro || 'General',
    proyecto: `Aún no tienes un proyecto de PWA activo`,
    precioTotal: 0,
    anticipo: 0,
    saldoPendiente: 0,
    estado: 'step_conectar',
    fechaContratacion: '',
    fechaEntrega: 'Por definir',
    mensualidad: 0,
    estadoStripe: 'canceled',
    estadoFirebase: 'pending',
    notasInternas: '',
    prioridad: 'baja',
    categoria: '',
    observaciones: '',
    responsableProyecto: '',
    historial: [],
    archivos: [],
    facturas: [],
    contractSigned: false,
    isDummy: true
  };
}

async function saveOrderToDb(order: ProjectOrder) {
  const currentAuthUser = auth.currentUser;
  if (!currentAuthUser) {
    console.warn("Attempted to save order without authenticated user.");
    return;
  }
  
  const emailLower = currentAuthUser.email?.toLowerCase() || '';
  const isAdmin = emailLower === 'kino9230@gmail.com' || currentAuthUser.uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03';
  
  if (!isAdmin) {
    const isOwner = order.correo.toLowerCase().trim() === emailLower;
    if (!isOwner) {
      console.warn(`[Security Check Failed] User UID ${currentAuthUser.uid} / Email ${emailLower} tried to persist order ${order.id} belonging to ${order.correo}. Operation blocked.`);
      return;
    }
  }

  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order })
    });
  } catch (err) {
    console.error("Error persisting order to server:", err);
  }
}

async function saveTicketToDb(ticket: SupportTicket, userEmail?: string) {
  try {
    const ticketWithEmail = userEmail ? { ...ticket, userEmail } : ticket;
    await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: ticketWithEmail })
    });
  } catch (err) {
    console.error("Error persisting ticket to server:", err);
  }
}

async function saveChatToDb(chat: ChatMessage) {
  try {
    await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat })
    });
  } catch (err) {
    console.error("Error persisting chat to server:", err);
  }
}

async function saveProfileToDb(uid: string, profile: UserProfile) {
  const currentAuthUser = auth.currentUser;
  if (!currentAuthUser) {
    console.warn("Attempted to save profile without authenticated user.");
    return;
  }
  
  const emailLower = currentAuthUser.email?.toLowerCase() || '';
  const isAdmin = emailLower === 'kino9230@gmail.com' || currentAuthUser.uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03';
  
  if (!isAdmin) {
    const isOwner = uid === currentAuthUser.uid || (profile.email && profile.email.toLowerCase().trim() === emailLower);
    if (!isOwner) {
      console.warn(`[Security Check Failed] User UID ${currentAuthUser.uid} tried to persist profile with UID ${uid} / Email ${profile.email}. Operation blocked.`);
      return;
    }
  }

  try {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, profile })
    });
  } catch (err) {
    console.error("Error persisting user profile to server:", err);
  }
}

export default function App() {
  const [state, setState] = useState(() => getStoredState());
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFunnelForClient, setShowFunnelForClient] = useState(false);
  const [orders, setOrders] = useState<ProjectOrder[]>(state.orders);
  const [tickets, setTickets] = useState<SupportTicket[]>(state.tickets);
  const [chats, setChats] = useState<ChatMessage[]>(state.chats);
  const [stepperSteps, setStepperSteps] = useState<StepperStep[]>(state.stepperSteps);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(state.settings);

  // Stripe Overlay simulation states
  const [stripeOverlay, setStripeOverlay] = useState<{
    show: boolean;
    amount: number;
    concept: string;
    orderId: string;
    invoiceId?: string;
    isSubscription?: boolean;
  } | null>(null);

  // Real-time alert notifications
  const [notification, setNotification] = useState<string | null>(null);

  // Admin active alerts state
  const [adminAlerts, setAdminAlerts] = useState<{
    id: string;
    type: 'ticket' | 'request' | 'payment';
    title: string;
    description: string;
    timestamp: string;
    read: boolean;
  }[]>(() => {
    try {
      const saved = localStorage.getItem('kidria_admin_alerts_list');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [activeAdminModalAlert, setActiveAdminModalAlert] = useState<{
    id: string;
    type: 'ticket' | 'request' | 'payment';
    title: string;
    description: string;
    timestamp: string;
    read: boolean;
  } | null>(null);

  // Firebase Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Enforce email verification for standard client accounts
        const emailLower = firebaseUser.email?.toLowerCase() || '';
        const isAdmin = emailLower === 'kino9230@gmail.com' || firebaseUser.uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03';
        if (!firebaseUser.emailVerified && !isAdmin) {
          await signOut(auth);
          localStorage.removeItem('kidria_bypass_user');
          setOrders([]);
          setTickets([]);
          setChats([]);
          setCurrentUser({
            uid: 'guest',
            email: 'invitado@kidria.com',
            nombre: 'Visitante',
            empresa: 'Mi Empresa',
            role: 'invitado',
            telefono: '',
            giro: 'General'
          });
          setLoadingSession(false);
          return;
        }

        try {
          const docRef = doc(db, 'usuarios', firebaseUser.uid);
          const docSnap = await getDoc(docRef);

          
          if (docSnap.exists()) {
            const profile = docSnap.data() as UserProfile;
            const isUserAdmin = emailLower === 'kino9230@gmail.com' || firebaseUser.uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03' || profile.role === 'admin_general';
            if (isUserAdmin && profile.role !== 'admin_general') {
              profile.role = 'admin_general';
              await saveProfileToDb(firebaseUser.uid, profile);
            }
            setCurrentUser(profile);
          } else {
            // New account or manually created without Firestore entry (e.g. from Firebase Console)
            const isAdminProfile = emailLower === 'kino9230@gmail.com' || firebaseUser.uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03';
            const defaultProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              nombre: isAdminProfile ? 'Administrador General' : (firebaseUser.displayName || 'Cliente KIDRIA'),
              empresa: isAdminProfile ? 'KIDRIA Platform' : 'Mi Empresa',
              role: isAdminProfile ? 'admin_general' : 'cliente',
              telefono: '',
              giro: isAdminProfile ? 'Desarrollo' : 'General',
              colores: {
                primary: '#0f172a',
                secondary: '#10b981'
              }
            };
            
            await saveProfileToDb(firebaseUser.uid, defaultProfile);
            setCurrentUser(defaultProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile from Firestore:", error);
          // Resilient fallback local state to prevent blocking the user
          const isAdminProfile = emailLower === 'kino9230@gmail.com' || firebaseUser.uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03';
          setCurrentUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            nombre: isAdminProfile ? 'Administrador General' : 'Cliente KIDRIA',
            empresa: isAdminProfile ? 'KIDRIA Platform' : 'Mi Empresa',
            role: isAdminProfile ? 'admin_general' : 'cliente',
          });
        }
      } else {
        const savedBypass = localStorage.getItem('kidria_bypass_user');
        if (savedBypass) {
          try {
            const profile = JSON.parse(savedBypass);
            setCurrentUser(profile);
            setLoadingSession(false);
            return;
          } catch (e) {}
        }
        
        // No active Firebase session and no local bypass -> clear caches completely
        localStorage.removeItem('kidria_current_user');
        localStorage.removeItem('kidria_orders');
        localStorage.removeItem('kidria_tickets');
        localStorage.removeItem('kidria_chats');
        
        setOrders([]);
        setTickets([]);
        setChats([]);
        setCurrentUser({
          uid: 'guest',
          email: 'invitado@kidria.com',
          nombre: 'Visitante',
          empresa: 'Mi Empresa',
          role: 'invitado',
          telefono: '',
          giro: 'General'
        });
      }
      setLoadingSession(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync state mutations back to LocalStorage
  useEffect(() => {
    if (currentUser) {
      state.currentUser = currentUser;
    }
    state.orders = orders;
    state.tickets = tickets;
    state.chats = chats;
    state.stepperSteps = stepperSteps;
    state.settings = paymentSettings;
    state.save();
    localStorage.setItem('kidria_admin_alerts_list', JSON.stringify(adminAlerts));
  }, [currentUser, orders, tickets, chats, stepperSteps, adminAlerts, paymentSettings, state]);

  // Fetch data from Firestore via backend APIs when currentUser changes
  useEffect(() => {
    // Immediately clear all client/admin specific data in local states to prevent data crossover/leaks
    setOrders([]);
    setTickets([]);
    setChats([]);

    if (!currentUser || currentUser.uid === 'guest') {
      return;
    }

    const fetchData = async () => {
      try {
        const ordersRes = await fetch(`/api/orders?email=${encodeURIComponent(currentUser.email)}&role=${currentUser.role}`);
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          if (ordersData.success && ordersData.orders) {
            setOrders(ordersData.orders);
          } else {
            setOrders([]);
          }
        } else {
          setOrders([]);
        }

        const ticketsRes = await fetch(`/api/tickets?email=${encodeURIComponent(currentUser.email)}&role=${currentUser.role}`);
        if (ticketsRes.ok) {
          const ticketsData = await ticketsRes.json();
          if (ticketsData.success && ticketsData.tickets) {
            setTickets(ticketsData.tickets);
          } else {
            setTickets([]);
          }
        } else {
          setTickets([]);
        }

        const chatsRes = await fetch(`/api/chats`);
        if (chatsRes.ok) {
          const chatsData = await chatsRes.json();
          if (chatsData.success && chatsData.chats) {
            setChats(chatsData.chats);
          } else {
            setChats([]);
          }
        } else {
          setChats([]);
        }
      } catch (err) {
        console.error("Error loading secure backend data:", err);
        setOrders([]);
        setTickets([]);
        setChats([]);
      }
    };

    fetchData();
  }, [currentUser]);

  // Persist local state changes to Firestore securely via REST APIs
  useEffect(() => {
    if (!currentUser || currentUser.uid === 'guest') return;
    orders.forEach(ord => {
      if (ord && !ord.isDummy) {
        saveOrderToDb(ord);
      }
    });
  }, [orders, currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.uid === 'guest') return;
    tickets.forEach(tick => {
      saveTicketToDb(tick, currentUser.email);
    });
  }, [tickets, currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.uid === 'guest') return;
    chats.forEach(ch => {
      saveChatToDb(ch);
    });
  }, [chats, currentUser]);

  const showToast = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Watchers to detect client activity and alert the administrator
  const [prevTicketsCount, setPrevTicketsCount] = useState(tickets.length);
  const [prevOrdersCount, setPrevOrdersCount] = useState(orders.length);

  const getTotalHistoryCount = (ordList: ProjectOrder[]) => {
    return ordList.reduce((sum, ord) => sum + (ord.historial?.length || 0), 0);
  };
  const [prevHistoryCount, setPrevHistoryCount] = useState(() => getTotalHistoryCount(orders));

  // 1. Support Tickets Watcher
  useEffect(() => {
    if (currentUser?.role !== 'admin_general') {
      setPrevTicketsCount(tickets.length);
      return;
    }
    if (tickets.length > prevTicketsCount) {
      const newestTicket = tickets[0];
      if (newestTicket) {
        const newAlert = {
          id: `alert_t_${Date.now()}`,
          type: 'ticket' as const,
          title: '🔥 Nuevo Ticket de Soporte Técnico',
          description: `El cliente ha generado un nuevo ticket de soporte: "${newestTicket.title}" (Categoría: ${newestTicket.category.toUpperCase()} • Prioridad: ${newestTicket.priority.toUpperCase()}). Mensaje: "${newestTicket.description}"`,
          timestamp: new Date().toLocaleTimeString(),
          read: false
        };
        setAdminAlerts(prev => [newAlert, ...prev]);
        setActiveAdminModalAlert(newAlert);
      }
    }
    setPrevTicketsCount(tickets.length);
  }, [tickets, prevTicketsCount, currentUser]);

  // 2. New PWA Order/Request Watcher
  useEffect(() => {
    if (currentUser?.role !== 'admin_general') {
      setPrevOrdersCount(orders.length);
      return;
    }
    if (orders.length > prevOrdersCount) {
      const newestOrder = orders[0];
      if (newestOrder) {
        const newAlert = {
          id: `alert_o_${Date.now()}`,
          type: 'request' as const,
          title: '✨ Nueva Solicitud de PWA Recibida',
          description: `Se ha registrado una nueva solicitud de PWA para la empresa "${newestOrder.empresa}" (${newestOrder.giro}). Solución: "${newestOrder.proyecto}". Costo acordado: $${newestOrder.precioTotal} MXN.`,
          timestamp: new Date().toLocaleTimeString(),
          read: false
        };
        setAdminAlerts(prev => [newAlert, ...prev]);
        setActiveAdminModalAlert(newAlert);
      }
    }
    setPrevOrdersCount(orders.length);
  }, [orders, prevOrdersCount, currentUser]);

  // 3. Dynamic Proposal Generation Watcher (via History item increment)
  useEffect(() => {
    const currentHistoryCount = getTotalHistoryCount(orders);
    if (currentUser?.role !== 'admin_general') {
      setPrevHistoryCount(currentHistoryCount);
      return;
    }
    if (currentHistoryCount > prevHistoryCount) {
      // Find order with new proposal history item
      for (const ord of orders) {
        const latestHistory = ord.historial?.[0];
        if (latestHistory && latestHistory.titulo.includes('Propuesta Comercial Generada')) {
          const alertId = `alert_prop_${Date.now()}`;
          const newAlert = {
            id: alertId,
            type: 'request' as const,
            title: '💼 Propuesta Comercial Autogenerada',
            description: `El cliente "${ord.cliente}" de "${ord.empresa}" ha autogenerado un Roadmap de propuesta comercial en formato PDF para el hito o alcance deseado. ${latestHistory.descripcion}`,
            timestamp: new Date().toLocaleTimeString(),
            read: false
          };
          setAdminAlerts(prev => [newAlert, ...prev]);
          setActiveAdminModalAlert(newAlert);
          break;
        }
      }
    }
    setPrevHistoryCount(currentHistoryCount);
  }, [orders, prevHistoryCount, currentUser]);

  // Helper handler when checking the alert from the overlay
  const handleReviewAlert = (alert: any) => {
    if (!alert) return;
    
    // Mark as read
    setAdminAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, read: true } : a));
    setActiveAdminModalAlert(null);
    
    // Switch active simulated role to admin_general to view dashboard
    const adminProfile = state.profiles.find(p => p.role === 'admin_general') || state.profiles[0];
    setCurrentUser(adminProfile);
    
    // Configure initial active tab and ticket focus in sessionStorage
    if (alert.type === 'ticket') {
      sessionStorage.setItem('admin_initial_tab', 'tickets');
      const newestTicket = tickets[0];
      if (newestTicket) {
        sessionStorage.setItem('admin_initial_ticket_id', newestTicket.id);
      }
    } else {
      sessionStorage.setItem('admin_initial_tab', 'crm');
    }
    
    // Dispatch event to force activeTab check
    setTimeout(() => {
      window.dispatchEvent(new Event('admin_tab_switch'));
    }, 50);

    showToast(`Accediendo al Panel de Control de KIDRIA - Sección: ${alert.type === 'ticket' ? 'Tickets' : 'CRM'}`);
  };

  const handleRoleSwitch = async (role: 'cliente' | 'admin_general' | 'invitado') => {
    // Clear caches completely on any role switch simulation
    localStorage.removeItem('kidria_orders');
    localStorage.removeItem('kidria_tickets');
    localStorage.removeItem('kidria_chats');
    localStorage.removeItem('kidria_current_user');
    setOrders([]);
    setTickets([]);
    setChats([]);

    if (role === 'invitado') {
      try {
        localStorage.removeItem('kidria_bypass_user');
        await signOut(auth);
      } catch (e) {}
      
      const guestProfile: UserProfile = {
        uid: 'guest',
        email: 'invitado@kidria.com',
        nombre: 'Visitante',
        empresa: 'Prospecto de Negocio',
        role: 'invitado',
        telefono: ''
      };
      setCurrentUser(guestProfile);
      showToast('Navegando en modo Visitante. ¡Analiza tu negocio con IA sin registrarte!');
    } else {
      // Check if there is a real authenticated Firebase User and if they belong to this role
      const firebaseUser = auth.currentUser;
      const savedBypass = localStorage.getItem('kidria_bypass_user');
      
      if (firebaseUser) {
        const emailLower = firebaseUser.email?.toLowerCase() || '';
        const isUserAdmin = emailLower === 'kino9230@gmail.com' || firebaseUser.uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03';
        const userRole = isUserAdmin ? 'admin_general' : 'cliente';
        
        if (userRole === role) {
          // Authorized, load the profile
          try {
            const docRef = doc(db, 'usuarios', firebaseUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setCurrentUser(docSnap.data() as UserProfile);
              showToast(`Acceso autorizado: Sesión activa como ${firebaseUser.email}`);
              return;
            }
          } catch (err) {}
          
          setCurrentUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            nombre: isUserAdmin ? 'Administrador General' : 'Cliente KIDRIA',
            empresa: isUserAdmin ? 'KIDRIA Platform' : 'Mi Empresa',
            role: userRole,
          });
          showToast(`Acceso autorizado: Sesión activa como ${firebaseUser.email}`);
          return;
        }
      } else if (savedBypass) {
        try {
          const profile = JSON.parse(savedBypass) as UserProfile;
          if (profile.role === role) {
            setCurrentUser(profile);
            showToast(`Acceso autorizado por sesión previa: ${profile.email}`);
            return;
          }
        } catch (e) {}
      }

      // If they are not logged in or do not match the required role, prompt for real authentication
      showToast(`Acceso restringido. Por favor, inicia sesión con una cuenta de ${role === 'admin_general' ? 'Administrador' : 'Cliente'} autorizada para acceder.`);
      setShowLoginModal(true);
    }
  };

  // Unified real and simulated Stripe payment initiator
  const initiateStripePayment = async (
    amount: number, 
    concept: string, 
    orderId: string, 
    invoiceId?: string, 
    isSubscription?: boolean
  ) => {
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          amount,
          concept,
          isSubscription: !!isSubscription,
          customerEmail: currentUser.email || undefined
        })
      });
      const data = await response.json();
      if (data.isReal && data.url) {
        // Redirigir a pasarela real de Stripe (Soporta sk_test_* y sk_live_* de forma transparente)
        window.location.href = data.url;
      } else {
        // Cargar simulador sandbox de alta fidelidad
        setStripeOverlay({
          show: true,
          amount,
          concept,
          orderId,
          invoiceId: invoiceId || 'inv_prov_1',
          isSubscription: !!isSubscription
        });
      }
    } catch (err) {
      console.warn('Stripe checkout error, using sandbox simulation:', err);
      setStripeOverlay({
        show: true,
        amount,
        concept,
        orderId,
        invoiceId: invoiceId || 'inv_prov_1',
        isSubscription: !!isSubscription
      });
    }
  };

  // Payment triggers Checkout
  const handleInitiatePayment = (amount: number, concept: string, invoiceId?: string, isSub?: boolean) => {
    initiateStripePayment(amount, concept, orders[0]?.id || 'order_1', invoiceId, isSub);
  };

  const handlePaymentSuccess = (invoiceId?: string) => {
    if (!stripeOverlay) return;

    // Update the invoice status as PAGADA
    const updatedOrders = orders.map(ord => {
      if (ord.id === stripeOverlay.orderId) {
        const updatedInvoices = ord.facturas.map(inv => {
          if (inv.id === invoiceId) {
            return { ...inv, estado: 'pagada' as const };
          }
          return inv;
        });

        // Deduct balance and update milestones
        const isAnticipo = stripeOverlay.concept.toLowerCase().includes('anticipo');
        const nextAnticipo = isAnticipo ? ord.anticipo + stripeOverlay.amount : ord.anticipo;
        const nextSaldo = isAnticipo ? ord.precioTotal - nextAnticipo : ord.saldoPendiente - stripeOverlay.amount;
        
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const newHistoryItem = {
          id: `h_pay_${Date.now()}`,
          fecha: timestamp,
          titulo: `Pago Acreditado: $${stripeOverlay.amount} MXN`,
          descripcion: `Se completó con éxito la transacción por concepto de: "${stripeOverlay.concept}".`,
          autor: currentUser.nombre
        };

        return {
          ...ord,
          facturas: updatedInvoices,
          anticipo: nextAnticipo,
          saldoPendiente: Math.max(0, nextSaldo),
          estadoStripe: 'paid' as const,
          historial: [newHistoryItem, ...ord.historial]
        };
      }
      return ord;
    });

    setOrders(updatedOrders);
    
    // Trigger real-time alert to Admin
    const paymentAlert = {
      id: `alert_p_${Date.now()}`,
      type: 'payment' as const,
      title: '💰 Pago de PWA Recibido',
      description: `El cliente "${currentUser.nombre}" ha completado con éxito el pago de $${stripeOverlay.amount} MXN por concepto de "${stripeOverlay.concept}".`,
      timestamp: new Date().toLocaleTimeString(),
      read: false
    };
    setAdminAlerts(prev => [paymentAlert, ...prev]);
    setActiveAdminModalAlert(paymentAlert);

    setStripeOverlay(null);
    showToast(`¡Transacción Procesada! Se acreditó el pago de $${stripeOverlay.amount} MXN.`);
  };

  // Reconcile and synchronize successful payment returns and webhooks
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment_status');
    const orderId = params.get('order_id');
    const amountStr = params.get('amount');
    const concept = params.get('concept') || 'Servicios KIDRIA';

    if (paymentStatus === 'success' && orderId) {
      const amount = amountStr ? parseFloat(amountStr) : 0;
      
      setOrders(prevOrders => {
        return prevOrders.map(ord => {
          if (ord.id === orderId) {
            // Check if this payment is already credited
            const isAlreadyPaid = ord.historial.some(item => item.titulo.includes(`Pago Acreditado`) && item.titulo.includes(`$${amount}`));
            if (isAlreadyPaid) return ord;

            const updatedInvoices = ord.facturas.map(inv => {
              if (inv.concepto.toLowerCase().includes(concept.toLowerCase()) || inv.monto === amount || ord.facturas.length === 1) {
                return { ...inv, estado: 'pagada' as const };
              }
              return inv;
            });

            const isAnticipo = concept.toLowerCase().includes('anticipo');
            const nextAnticipo = isAnticipo ? ord.anticipo + amount : ord.anticipo;
            const nextSaldo = isAnticipo ? ord.precioTotal - nextAnticipo : ord.saldoPendiente - amount;

            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
            const newHistoryItem = {
              id: `h_pay_real_${Date.now()}`,
              fecha: timestamp,
              titulo: `Pago Acreditado (Stripe Real): $${amount} MXN`,
              descripcion: `Transacción confirmada en Stripe por concepto de: "${concept}".`,
              autor: 'Stripe API Gateway'
            };

            return {
              ...ord,
              facturas: updatedInvoices,
              anticipo: nextAnticipo,
              saldoPendiente: Math.max(0, nextSaldo),
              estadoStripe: 'paid' as const,
              historial: [newHistoryItem, ...ord.historial]
            };
          }
          return ord;
        });
      });

      // Trigger real-time alert to Admin for live Stripe Return
      const sessionAlert = {
        id: `alert_p_session_${Date.now()}`,
        type: 'payment' as const,
        title: '⚡ Pago Real Confirmado (Retorno de Pasarela)',
        description: `Se ha acreditado el pago real de $${amount} MXN por "${concept}" para la orden ${orderId}.`,
        timestamp: new Date().toLocaleTimeString(),
        read: false
      };
      setAdminAlerts(prev => [sessionAlert, ...prev]);
      setActiveAdminModalAlert(sessionAlert);

      showToast(`¡Transacción Procesada en Stripe Real! Recibimos tu pago de $${amount} MXN.`);
      
      // Clean query parameters to keep the URL elegant
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } else if (paymentStatus === 'canceled') {
      showToast('Transacción cancelada.');
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // Set up polling for pending orders to reconcile Webhook transactions in background
    const interval = setInterval(async () => {
      if (orders && orders.length > 0) {
        for (const order of orders) {
          if (order.estadoStripe !== 'paid') {
            try {
              const res = await fetch(`/api/stripe/webhook-events?orderId=${order.id}`);
              const data = await res.json();
              if (data.found && data.payment?.status === 'paid') {
                const amountPaid = data.payment.amount;
                setOrders(prev => prev.map(ord => {
                  if (ord.id === order.id) {
                    const alreadyPresent = ord.historial.some(h => h.titulo.includes('Acreditado (Stripe Real)'));
                    if (alreadyPresent) return ord;

                    const updatedInvoices = ord.facturas.map(inv => ({ ...inv, estado: 'pagada' as const }));
                    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
                    return {
                      ...ord,
                      facturas: updatedInvoices,
                      anticipo: ord.precioTotal * 0.5,
                      saldoPendiente: 0,
                      estadoStripe: 'paid' as const,
                      historial: [{
                        id: `h_webhook_${Date.now()}`,
                        fecha: timestamp,
                        titulo: `Pago Acreditado (Stripe Real): $${amountPaid} MXN`,
                        descripcion: `Transacción confirmada vía Webhook de producción para el plan contratado.`,
                        autor: 'Stripe Webhook API'
                      }, ...ord.historial]
                    };
                  }
                  return ord;
                }));

                // Trigger real-time alert to Admin for live Stripe Webhook
                const webhookAlert = {
                  id: `alert_p_real_${Date.now()}`,
                  type: 'payment' as const,
                  title: '💳 Pago Real Acreditado (Stripe Webhook)',
                  description: `Se ha recibido una confirmación de pago real de $${amountPaid} MXN para la aplicación "${order.proyecto}" de la empresa "${order.empresa}".`,
                  timestamp: new Date().toLocaleTimeString(),
                  read: false
                };
                setAdminAlerts(prev => [webhookAlert, ...prev]);
                setActiveAdminModalAlert(webhookAlert);

                showToast(`¡Pago verificado por webhook de Stripe para la orden: ${order.proyecto}!`);
              }
            } catch (err) {
              // Silent fail for polling
            }
          }
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [orders, currentUser]);


  const handleSignOut = async () => {
    try {
      localStorage.removeItem('kidria_bypass_user');
      localStorage.removeItem('kidria_current_user');
      localStorage.removeItem('kidria_orders');
      localStorage.removeItem('kidria_tickets');
      localStorage.removeItem('kidria_chats');
      if (currentUser && currentUser.uid) {
        localStorage.removeItem(`kidria_fcm_token_${currentUser.uid}`);
      }
      await signOut(auth);
      setOrders([]);
      setTickets([]);
      setChats([]);
      setCurrentUser({
        uid: 'guest',
        email: 'invitado@kidria.com',
        nombre: 'Visitante',
        empresa: 'Mi Empresa',
        role: 'invitado',
        telefono: '',
        giro: 'General'
      });
      showToast('Sesión cerrada correctamente.');
    } catch (error) {
      console.error(error);
      showToast('Error al cerrar sesión.');
    }
  };

  if (showIntro) {
    return <SplashIntro onComplete={() => setShowIntro(false)} />;
  }

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <KidriaLogo className="w-16 h-16" />
          <p className="text-xs font-semibold text-zinc-400 font-mono tracking-wider uppercase">Estableciendo conexión segura...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans antialiased flex flex-col selection:bg-indigo-600/30 selection:text-indigo-300">
      
      {/* Top Notification Toaster */}
      {notification && (
        <div className="fixed top-5 right-5 bg-zinc-900 border border-indigo-500 text-white px-4 py-3 rounded-xl shadow-2xl z-50 animate-bounce flex items-center gap-2.5 max-w-sm">
          <Bell className="w-5 h-5 text-indigo-400 shrink-0" />
          <p className="text-xs font-semibold">{notification}</p>
        </div>
      )}

      {/* Header / Navbar */}
      <header className="sticky top-0 bg-[#0c0c0e]/95 backdrop-blur-md border-b border-zinc-800 z-40 px-4 py-3 md:px-6 md:py-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center justify-between w-full lg:w-auto gap-3">
          <div className="flex items-center gap-2.5">
            <KidriaLogo className="w-10 h-10" />
            <div>
              <h1 className="text-lg font-black font-display tracking-[0.1em] text-white flex items-center gap-1.5 select-none">
                <span>KIDRIA</span>
                <span className="text-indigo-400 font-light text-[10px] tracking-widest uppercase">Platform</span>
              </h1>
              <p className="text-[10px] text-zinc-500 font-medium">Enterprise SaaS Web PWAs</p>
            </div>
          </div>
        </div>

        {/* User Role Switcher - Super helpful to demo client & admin views */}
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 bg-zinc-900/50 border border-zinc-800 px-3 py-1.5 rounded-2xl sm:rounded-full w-full lg:w-auto justify-center">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-display">Simular Rol:</span>
          <div className="flex flex-wrap justify-center gap-1.5">
            <button
              onClick={() => handleRoleSwitch('invitado')}
              className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                currentUser.role === 'invitado'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
              <span>Visitante / Embudo IA</span>
            </button>
            <button
              onClick={() => handleRoleSwitch('cliente')}
              className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                currentUser.role === 'cliente'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <User className="w-3 h-3" />
              <span>Cliente</span>
            </button>
            <button
              onClick={() => handleRoleSwitch('admin_general')}
              className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                currentUser.role === 'admin_general'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Shield className="w-3 h-3" />
              <span>Administrador</span>
            </button>
          </div>
        </div>

        {/* Real Authenticated User Section with Sign Out */}
        <div className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/80 px-3 py-1.5 rounded-2xl w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2.5 text-left">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center font-black text-xs text-indigo-400 font-display">
              {currentUser.uid === 'guest' ? 'VT' : (currentUser.nombre ? currentUser.nombre.substring(0, 2).toUpperCase() : 'VX')}
            </div>
            <div className="leading-tight">
              <p className="text-xs font-bold text-white max-w-[130px] truncate">{currentUser.uid === 'guest' ? 'Invitado' : (currentUser.nombre || 'Usuario')}</p>
              <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider font-mono">
                {currentUser.role === 'admin_general' ? 'Admin' : currentUser.role === 'invitado' ? 'Visitante' : 'Cliente'}
              </p>
            </div>
          </div>
          {currentUser.uid === 'guest' ? (
            <button
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 text-[11px] font-bold text-white transition-all cursor-pointer shadow-md shadow-indigo-600/15"
              title="Iniciar Sesión"
            >
              <User className="w-3.5 h-3.5" />
              <span>Iniciar Sesión</span>
            </button>
          ) : (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-red-950/20 hover:border-red-500/30 border border-zinc-800 text-[11px] font-bold text-zinc-400 hover:text-red-400 transition-all cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Sandbox Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        {currentUser.role === 'admin_general' ? (
          <AdminDashboard
            orders={orders}
            tickets={tickets}
            chats={chats}
            stepperSteps={stepperSteps}
            currentUser={currentUser}
            paymentSettings={paymentSettings}
            onUpdateOrders={setOrders}
            onUpdateTickets={setTickets}
            onUpdateChats={setChats}
            onUpdateStepperSteps={setStepperSteps}
            onUpdatePaymentSettings={setPaymentSettings}
          />
        ) : (currentUser.role === 'invitado' || (currentUser.role === 'cliente' && showFunnelForClient)) ? (
          <VisitorFunnel
            currentUser={currentUser}
            paymentSettings={paymentSettings}
            onSuccessProvisioning={async (newClient, newOrder) => {
              try {
                // Add new client profile to persistent state
                state.profiles = [newClient, ...state.profiles];
                
                // Add new project order to persistent state
                const updatedOrders = [newOrder, ...orders.filter(o => o.correo !== newClient.email)];
                setOrders(updatedOrders);
                
                // Set new current user (log in as this new client)
                setCurrentUser(newClient);
                setShowFunnelForClient(false);
                
                // Save order securely to Cloud Firestore database via backend proxy
                await saveOrderToDb(newOrder);

                showToast(`¡Felicidades! Se ha provisionado con éxito tu PWA "${newClient.empresa}". Bienvenido a KIDRIA.`);
              } catch (error) {
                console.error("Error creating persistent database records:", error);
                showToast(`¡Felicidades! PWA "${newClient.empresa}" provisionada localmente.`);
              }
            }}
            onInitiatePayment={(amount, concept, orderId) => {
              // Trigger Stripe checkout overlay
              setStripeOverlay({
                show: true,
                amount,
                concept,
                orderId,
                invoiceId: 'inv_prov_1', // custom provisional invoice ID
                isSubscription: true
              });
            }}
            stripeOverlayActive={!!stripeOverlay?.show}
          />
        ) : (
          <ClientDashboard
            order={
              (currentUser && (orders.find(o => o.correo === currentUser.email) || orders.find(o => o.uid === currentUser.uid))) || 
              (currentUser && currentUser.role === 'cliente' && currentUser.uid !== 'guest' ? createDummyNoOrderForUser(currentUser) : orders[0])
            }
            tickets={tickets}
            chats={chats}
            stepperSteps={stepperSteps}
            currentUser={currentUser}
            onUpdateTickets={setTickets}
            onUpdateChats={setChats}
            onUpdateUser={setCurrentUser}
            onUpdateOrder={(updated) => {
              setOrders(orders.map(o => o.id === updated.id ? updated : o));
            }}
            onInitiatePayment={handleInitiatePayment}
            onStartFunnel={() => setShowFunnelForClient(true)}
          />
        )}
      </main>

      {/* Footer credits */}
      <footer className="border-t border-zinc-800 bg-[#0c0c0e] py-8 text-center text-[10px] text-zinc-500 font-display space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-xs text-zinc-400">
          <a 
            href="https://wa.me/524792293687?text=Hola%20KIDRIA,%20me%20gustaría%20saber%20más%20sobre%20sus%20servicios" 
            target="_blank" 
            referrerPolicy="no-referrer"
            className="flex items-center gap-1.5 hover:text-emerald-400 transition-all font-semibold"
          >
            <MessageCircle className="w-4 h-4 fill-emerald-500/10 text-emerald-400" />
            <span>WhatsApp: 479 229 3687</span>
          </a>
          <span className="hidden sm:inline text-zinc-700">|</span>
          <div className="flex items-center gap-4">
            <span className="text-zinc-500 text-[11px]">Síguenos:</span>
            <a 
              href="https://facebook.com/kidria" 
              target="_blank" 
              referrerPolicy="no-referrer"
              className="flex items-center gap-1 hover:text-indigo-400 transition-all"
            >
              <Facebook className="w-4 h-4 text-indigo-400" />
              <span>Facebook</span>
            </a>
            <a 
              href="https://instagram.com/kidria" 
              target="_blank" 
              referrerPolicy="no-referrer"
              className="flex items-center gap-1 hover:text-pink-400 transition-all"
            >
              <Instagram className="w-4 h-4 text-pink-400" />
              <span>Instagram</span>
            </a>
          </div>
        </div>
        <p className="pt-2 border-t border-zinc-900 max-w-xl mx-auto text-[9px] text-zinc-600">
          © {new Date().getFullYear()} KIDRIA Framework v1.0.4 — Enterprise SaaS Dev Platform. Todos los derechos reservados. Powered by Vite & Google Gemini
        </p>
      </footer>

      {/* Stripe Payment Gateway Simulation Modal Overlay */}
      {stripeOverlay?.show && (
        <StripeSimulation
          onClose={() => setStripeOverlay(null)}
          onPaymentSuccess={handlePaymentSuccess}
          amount={stripeOverlay.amount}
          concept={stripeOverlay.concept}
          orderId={stripeOverlay.orderId}
          invoiceId={stripeOverlay.invoiceId}
          isSubscription={stripeOverlay.isSubscription}
        />
      )}

      {/* Global Real-Time Admin Overlay Alert */}
      {activeAdminModalAlert && (
        <div className="fixed inset-0 bg-zinc-950/85 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-indigo-500/60 rounded-3xl w-full max-w-lg p-8 shadow-2xl relative overflow-hidden text-center space-y-6 animate-fade-in">
            
            {/* Ambient background glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            
            {/* Header / Icon */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 relative">
              <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 animate-pulse opacity-30" />
              {activeAdminModalAlert.type === 'ticket' ? (
                <MessageSquare className="w-8 h-8 text-indigo-400" />
              ) : activeAdminModalAlert.type === 'request' ? (
                <Smartphone className="w-8 h-8 text-cyan-400" />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              )}
            </div>

            {/* Notification Source Tag */}
            <span className="inline-block text-[10px] font-bold uppercase tracking-widest bg-zinc-950 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20 font-mono">
              Notificación de Monitoreo Activo
            </span>

            {/* Title & Body */}
            <div className="space-y-2">
              <h3 className="text-xl md:text-2xl font-extrabold tracking-tight text-white leading-tight">
                {activeAdminModalAlert.title}
              </h3>
              <p className="text-zinc-300 text-xs md:text-sm leading-relaxed max-w-md mx-auto">
                {activeAdminModalAlert.description}
              </p>
            </div>

            {/* Timestamp / Footer info */}
            <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-center gap-1.5 bg-zinc-950/40 py-2 px-4 rounded-xl border border-zinc-800/30 w-fit mx-auto">
              <span>Recibido hace un momento</span>
              <span>•</span>
              <span>{activeAdminModalAlert.timestamp}</span>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              <button
                onClick={() => {
                  // Mark as read in list and close modal
                  setAdminAlerts(prev => prev.map(a => a.id === activeAdminModalAlert.id ? { ...a, read: true } : a));
                  setActiveAdminModalAlert(null);
                  showToast('Notificación archivada.');
                }}
                className="border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-400 font-bold py-3 px-4 rounded-2xl text-xs transition-all cursor-pointer"
              >
                Archivar / Cerrar
              </button>
              
              <button
                onClick={() => handleReviewAlert(activeAdminModalAlert)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-2xl text-xs transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                <span>Verificar Panel de Control</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Dynamic Pop-up Login/Register Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-[#09090b] rounded-2xl border border-zinc-800 p-1 shadow-2xl">
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white z-[10000] p-2 hover:bg-zinc-800 rounded-full cursor-pointer transition-colors"
              title="Cerrar"
            >
              <X className="w-4.5 h-4.5" />
            </button>
            <LoginScreen 
              onLoginSuccess={(user) => {
                // Clear any previous session's cached data to prevent leak/crossover between clients and admins
                localStorage.removeItem('kidria_orders');
                localStorage.removeItem('kidria_tickets');
                localStorage.removeItem('kidria_chats');
                localStorage.removeItem('kidria_current_user');
                
                // Set initial states to empty arrays so new data can load cleanly
                setOrders([]);
                setTickets([]);
                setChats([]);
                
                setCurrentUser(user);
                setShowLoginModal(false);
                showToast(`¡Bienvenido de vuelta, ${user.nombre}!`);
              }}
              showToast={showToast}
            />
          </div>
        </div>
      )}
    </div>
  );
}
