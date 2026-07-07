import React, { useState, useEffect } from 'react';
import { 
  Users, Briefcase, DollarSign, Clock, MessageSquare, ShieldAlert,
  Send, Plus, CheckCircle, AlertTriangle, Play, Check, Trash2, Calendar, FileText, Globe, Key, Settings, Bell, Landmark, Smartphone, RefreshCw, Sparkles, Database
} from 'lucide-react';
import { ProjectOrder, SupportTicket, ChatMessage, StepperStep, UserProfile, PaymentSettings } from '../types';
import { requestFcmToken, isFcmSupported, getStoredVapidKey, saveStoredVapidKey, initForegroundNotificationListener, playNotificationSound } from '../lib/fcm';

interface AdminDashboardProps {
  orders: ProjectOrder[];
  tickets: SupportTicket[];
  chats: ChatMessage[];
  stepperSteps: StepperStep[];
  currentUser: UserProfile;
  paymentSettings: PaymentSettings;
  onUpdateOrders: (updatedOrders: ProjectOrder[]) => void;
  onUpdateTickets: (updatedTickets: SupportTicket[]) => void;
  onUpdateChats: (updatedChats: ChatMessage[]) => void;
  onUpdateStepperSteps: (updatedSteps: StepperStep[]) => void;
  onUpdatePaymentSettings: (settings: PaymentSettings) => void;
}

export default function AdminDashboard({
  orders,
  tickets,
  chats,
  stepperSteps,
  currentUser,
  paymentSettings,
  onUpdateOrders,
  onUpdateTickets,
  onUpdateChats,
  onUpdateStepperSteps,
  onUpdatePaymentSettings
}: AdminDashboardProps) {
  const [selectedOrder, setSelectedOrder] = useState<ProjectOrder>(orders[0] || null);
  const [activeTab, setActiveTab] = useState<'crm' | 'tickets' | 'chats' | 'stats' | 'mensualidades' | 'config'>('crm');

  // Form States for adding updates
  const [newHistoryTitle, setNewHistoryTitle] = useState('');
  const [newHistoryDesc, setNewHistoryDesc] = useState('');
  
  // Chat state
  const [adminReplyText, setAdminReplyText] = useState('');

  // Ticket reply state
  const [activeTicketId, setActiveTicketId] = useState<string | null>(tickets[0]?.id || null);
  const [ticketReplyText, setTicketReplyText] = useState('');
  
  // Feedback state for administrative alerts
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'warning' | 'info'; message: string } | null>(null);

  const triggerFeedback = (type: 'success' | 'warning' | 'info', message: string) => {
    setActionFeedback({ type, message });
    setTimeout(() => {
      setActionFeedback(null);
    }, 6000);
  };

  // FCM Push Notifications State
  const [fcmSupported, setFcmSupported] = useState<boolean | null>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [customVapidKey, setCustomVapidKey] = useState<string>(getStoredVapidKey());
  const [subscribingFcm, setSubscribingFcm] = useState<boolean>(false);
  const [testNotificationStatus, setTestNotificationStatus] = useState<string | null>(null);
  const [testNotificationLoading, setTestNotificationLoading] = useState<boolean>(false);

  // Admin User Management State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [usersError, setUsersError] = useState<string>('');
  const [showAddAdminForm, setShowAddAdminForm] = useState<boolean>(false);
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');
  const [newAdminNombre, setNewAdminNombre] = useState<string>('');
  const [newAdminPassword, setNewAdminPassword] = useState<string>('');
  const [submittingAdmin, setSubmittingAdmin] = useState<boolean>(false);
  const [adminActionError, setAdminActionError] = useState<string>('');
  const [adminActionSuccess, setAdminActionSuccess] = useState<string>('');

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setUsersError('');
    try {
      const res = await fetch(`/api/users?requesterUid=${currentUser.uid}`);
      const data = await res.json();
      if (data.success) {
        setUsersList(data.users || []);
      } else {
        setUsersError(data.error || 'Error al obtener usuarios.');
      }
    } catch (err: any) {
      setUsersError('Error de red al consultar usuarios.');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'config') {
      fetchUsers();
    }
  }, [activeTab]);

  const handleUpdateUserRole = async (targetUid: string, currentRole: string) => {
    const newRole = currentRole === 'admin_general' ? 'cliente' : 'admin_general';
    try {
      const res = await fetch('/api/users/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterUid: currentUser.uid,
          targetUid,
          newRole
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerFeedback('success', `Rol actualizado correctamente a ${newRole === 'admin_general' ? 'Administrador' : 'Cliente'}.`);
        fetchUsers();
      } else {
        triggerFeedback('warning', data.error || 'Error al actualizar el rol.');
      }
    } catch (err) {
      triggerFeedback('warning', 'Error de red al actualizar rol.');
    }
  };

  const handleDeleteUser = async (targetUid: string, targetName: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario "${targetName}"?`)) {
      return;
    }
    try {
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterUid: currentUser.uid,
          targetUid
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerFeedback('success', `Usuario "${targetName}" eliminado correctamente.`);
        fetchUsers();
      } else {
        triggerFeedback('warning', data.error || 'Error al eliminar usuario.');
      }
    } catch (err) {
      triggerFeedback('warning', 'Error de red al eliminar usuario.');
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminNombre || !newAdminPassword) {
      setAdminActionError('Todos los campos son obligatorios.');
      return;
    }
    setSubmittingAdmin(true);
    setAdminActionError('');
    setAdminActionSuccess('');
    try {
      const res = await fetch('/api/users/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterUid: currentUser.uid,
          email: newAdminEmail,
          nombre: newAdminNombre,
          password: newAdminPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        setAdminActionSuccess(`Administrador "${newAdminNombre}" creado correctamente.`);
        setNewAdminEmail('');
        setNewAdminNombre('');
        setNewAdminPassword('');
        setShowAddAdminForm(false);
        fetchUsers();
        triggerFeedback('success', 'Nuevo administrador creado con éxito.');
      } else {
        setAdminActionError(data.error || 'Error al crear administrador.');
      }
    } catch (err) {
      setAdminActionError('Error de red al crear administrador.');
    } finally {
      setSubmittingAdmin(false);
    }
  };

  // Check FCM support and subscribe to foreground notifications
  useEffect(() => {
    const initFcm = async () => {
      const supported = await isFcmSupported();
      setFcmSupported(supported);
      if (supported) {
        // Silently sync/update token registration to prevent session/role conflicts
        if (Notification.permission === 'granted') {
          try {
            const token = await requestFcmToken(
              currentUser.uid,
              currentUser.email,
              currentUser.role,
              customVapidKey
            );
            if (token) {
              setFcmToken(token);
              localStorage.setItem(`kidria_fcm_token_${currentUser.uid}`, token);
            }
          } catch (err) {
            console.warn('[FCM Silent Sync Error]', err);
          }
        } else {
          const savedToken = localStorage.getItem(`kidria_fcm_token_${currentUser.uid}`);
          if (savedToken) {
            setFcmToken(savedToken);
          }
        }

        // Initialize foreground listener
        const unsubscribe = await initForegroundNotificationListener((payload) => {
          console.log('[AdminDashboard] Intercepted foreground FCM message:', payload);
          
          // Strict reception-side filtering: Admin only receives 'ticket', 'proyecto_nuevo' or 'chat_mensaje'
          const category = payload.data?.category;
          if (category && category !== 'ticket' && category !== 'proyecto_nuevo' && category !== 'chat_mensaje') {
            console.log('[AdminDashboard] Reception-side filter blocked notification of category:', category);
            return;
          }

          playNotificationSound();
          triggerFeedback('success', `🔔 Notificación Push Recibida: ${payload.notification?.title || ''}. ${payload.notification?.body || ''}`);
        });
        return unsubscribe;
      }
    };
    initFcm();
  }, [currentUser.uid, currentUser.email, currentUser.role]);

  const handleTogglePushSubscription = async () => {
    if (fcmToken) {
      setSubscribingFcm(true);
      try {
        await fetch('/api/fcm-token/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: fcmToken })
        });
        localStorage.removeItem(`kidria_fcm_token_${currentUser.uid}`);
        setFcmToken(null);
        setTestNotificationStatus('Suscripción cancelada exitosamente.');
      } catch (err) {
        console.error('[FCM] Error unsubscribing:', err);
      } finally {
        setSubscribingFcm(false);
      }
    } else {
      setSubscribingFcm(true);
      setTestNotificationStatus(null);
      try {
        const token = await requestFcmToken(
          currentUser.uid,
          currentUser.email,
          currentUser.role,
          customVapidKey
        );
        if (token) {
          setFcmToken(token);
          localStorage.setItem(`kidria_fcm_token_${currentUser.uid}`, token);
          setTestNotificationStatus('✓ ¡Notificaciones push activadas exitosamente!');
        } else {
          setTestNotificationStatus('No se concedieron permisos o no se pudo generar el token.');
        }
      } catch (err: any) {
        console.error('[FCM] Error subscribing:', err);
        setTestNotificationStatus(`Error: ${err.message || 'No se pudo activar.'}`);
      } finally {
        setSubscribingFcm(false);
      }
    }
  };

  const handleSendTestPush = async (title: string, body: string) => {
    if (!fcmToken) return;
    setTestNotificationLoading(true);
    setTestNotificationStatus('Enviando notificación de prueba...');
    try {
      const res = await fetch('/api/send-test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email,
          title,
          body,
          link: window.location.origin + '/?tab=tickets'
        })
      });
      if (res.ok) {
        setTestNotificationStatus('✓ Notificación push de prueba enviada exitosamente.');
      } else {
        const errData = await res.json();
        setTestNotificationStatus(`Error: ${errData.error || 'No se pudo enviar.'}`);
      }
    } catch (err: any) {
      console.error('[FCM] Error testing push:', err);
      setTestNotificationStatus(`Error: ${err.message || 'Error de conexión.'}`);
    } finally {
      setTestNotificationLoading(false);
    }
  };

  // Config states initialized from props
  const [mercadoPagoLink, setMercadoPagoLink] = useState(paymentSettings.mercadoPagoLink);
  const [depBanco, setDepBanco] = useState(paymentSettings.depositAccount.banco);
  const [depCuenta, setDepCuenta] = useState(paymentSettings.depositAccount.cuenta);
  const [depBeneficiario, setDepBeneficiario] = useState(paymentSettings.depositAccount.beneficiario);

  const [transBanco, setTransBanco] = useState(paymentSettings.transferAccount.banco);
  const [transClabe, setTransClabe] = useState(paymentSettings.transferAccount.clabe);
  const [transBeneficiario, setTransBeneficiario] = useState(paymentSettings.transferAccount.beneficiario);

  // Starter
  const [starterCost, setStarterCost] = useState(paymentSettings.plans.Starter.cost);
  const [starterMonthly, setStarterMonthly] = useState(paymentSettings.plans.Starter.monthly);
  const [starterPromo, setStarterPromo] = useState(paymentSettings.plans.Starter.promo);

  // Business
  const [businessCost, setBusinessCost] = useState(paymentSettings.plans.Business.cost);
  const [businessMonthly, setBusinessMonthly] = useState(paymentSettings.plans.Business.monthly);
  const [businessPromo, setBusinessPromo] = useState(paymentSettings.plans.Business.promo);

  // PremiumIA
  const [premiumIACost, setPremiumIACost] = useState(paymentSettings.plans.PremiumIA.cost);
  const [premiumIAMonthly, setPremiumIAMonthly] = useState(paymentSettings.plans.PremiumIA.monthly);
  const [premiumIAPromo, setPremiumIAPromo] = useState(paymentSettings.plans.PremiumIA.promo);

  // Enterprise
  const [enterpriseCost, setEnterpriseCost] = useState(paymentSettings.plans.Enterprise.cost);
  const [enterpriseMonthly, setEnterpriseMonthly] = useState(paymentSettings.plans.Enterprise.monthly);
  const [enterprisePromo, setEnterprisePromo] = useState(paymentSettings.plans.Enterprise.promo);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings: PaymentSettings = {
      mercadoPagoLink,
      depositAccount: {
        banco: depBanco,
        cuenta: depCuenta,
        beneficiario: depBeneficiario
      },
      transferAccount: {
        banco: transBanco,
        clabe: transClabe,
        beneficiario: transBeneficiario
      },
      plans: {
        Starter: { cost: Number(starterCost), monthly: Number(starterMonthly), promo: starterPromo },
        Business: { cost: Number(businessCost), monthly: Number(businessMonthly), promo: businessPromo },
        PremiumIA: { cost: Number(premiumIACost), monthly: Number(premiumIAMonthly), promo: premiumIAPromo },
        Enterprise: { cost: Number(enterpriseCost), monthly: Number(enterpriseMonthly), promo: enterprisePromo }
      }
    };
    onUpdatePaymentSettings(updatedSettings);
    triggerFeedback('success', '¡La configuración de cobros, cuentas y precios de planes se ha guardado correctamente!');
  };

  const handleSendPaymentReminder = (order: ProjectOrder, invoice: any) => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const newHistoryItem = {
      id: `h_rem_${Date.now()}`,
      fecha: timestamp,
      titulo: '⚠️ Recordatorio de Pago Enviado',
      descripcion: `Se notificó al cliente de cobro por la mensualidad establecida de $${invoice.monto} MXN (${invoice.concepto}) vencida el ${invoice.fechaVencimiento}.`,
      autor: currentUser.nombre
    };

    const updatedOrders = orders.map(ord => {
      if (ord.id === order.id) {
        return {
          ...ord,
          historial: [newHistoryItem, ...ord.historial]
        };
      }
      return ord;
    });
    
    onUpdateOrders(updatedOrders);
    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder({
        ...selectedOrder,
        historial: [newHistoryItem, ...selectedOrder.historial]
      });
    }

    // Append an automated message to the chat
    const reminderMsg: ChatMessage = {
      id: `msg_rem_${Date.now()}`,
      senderId: currentUser.uid,
      senderName: currentUser.nombre,
      senderRole: 'admin',
      text: `⚠️ AVISO DE KIDRIA BILLING: Estimado ${order.cliente} (${order.empresa}), le informamos que presenta un saldo vencido de $${invoice.monto} MXN correspondiente a su mensualidad de soporte. Le solicitamos amablemente realizar el pago desde su panel (sección Finanzas) para evitar la suspensión de su PWA y base de datos. ¡Muchas gracias!`,
      fecha: timestamp,
      read: false
    };
    onUpdateChats([...chats, reminderMsg]);

    triggerFeedback('success', `¡Notificación de Cobro Enviada con éxito a ${order.cliente}! Se ha enviado recordatorio al chat.`);
  };

  const handleToggleAppState = (order: ProjectOrder) => {
    const nextStatus: 'activo' | 'pausado' = order.estadoApp === 'pausado' ? 'activo' : 'pausado';
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const newHistoryItem = {
      id: `h_state_${Date.now()}`,
      fecha: timestamp,
      titulo: nextStatus === 'pausado' ? '🚫 Aplicación Pausada Temporalmente' : '🟢 Aplicación Reactivada',
      descripcion: nextStatus === 'pausado' 
        ? 'Se suspendió temporalmente el servicio de la PWA por mensualidad vencida sin pagar.'
        : 'Servicios de servidores en la nube reactivados con éxito.',
      autor: currentUser.nombre
    };

    const updatedOrders = orders.map(ord => {
      if (ord.id === order.id) {
        return {
          ...ord,
          estadoApp: nextStatus,
          historial: [newHistoryItem, ...ord.historial]
        };
      }
      return ord;
    });
    
    onUpdateOrders(updatedOrders);
    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder({
        ...selectedOrder,
        estadoApp: nextStatus,
        historial: [newHistoryItem, ...selectedOrder.historial]
      });
    }

    triggerFeedback(nextStatus === 'pausado' ? 'warning' : 'success', `La aplicación de ${order.empresa} ha sido ${nextStatus === 'pausado' ? 'PAUSADA' : 'ACTIVADA'} correctamente.`);
  };

  const handleSendManualPush = (order: ProjectOrder) => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    
    // Calculate past due or generic monthly fee
    const vencidaInv = order.facturas?.find(inv => inv.estado === 'vencida');
    const pendienteInv = order.facturas?.find(inv => inv.estado === 'pendiente');
    const invoiceToRemind = vencidaInv || pendienteInv;
    const montoMsg = invoiceToRemind ? `$${invoiceToRemind.monto.toLocaleString()} MXN` : "$1,500 MXN";
    const conceptoMsg = invoiceToRemind ? invoiceToRemind.concepto : "Mensualidad de Servidores y Soporte Técnico PWA";

    // 1. Save push notification details in localStorage for the client's screen to intercept
    const pushKey = `kidria_push_${order.id}`;
    const newPush = {
      id: `push_${Date.now()}`,
      title: '🚨 Recordatorio de Pago Urgente',
      message: `Estimado(a) ${order.cliente}, le recordamos que su mensualidad establecida (${conceptoMsg}) por un monto de ${montoMsg} se encuentra pendiente. Realice su pago para evitar la suspensión o pausa de los servicios en la nube de ${order.empresa}.`,
      date: timestamp,
      amount: invoiceToRemind?.monto || 1500,
      concept: conceptoMsg,
      invoiceId: invoiceToRemind?.id || 'inv_vencida',
      read: false
    };
    localStorage.setItem(pushKey, JSON.stringify(newPush));

    // 2. Add activity to order history
    const newHistoryItem = {
      id: `h_push_${Date.now()}`,
      fecha: timestamp,
      titulo: '🔔 Notificación Push Enviada',
      descripcion: `Se envió alerta de pago push manual (Recordatorio de Cobro: ${montoMsg}) al dispositivo móvil y navegador del cliente.`,
      autor: currentUser.nombre
    };

    const updatedOrders = orders.map(ord => {
      if (ord.id === order.id) {
        return {
          ...ord,
          historial: [newHistoryItem, ...ord.historial]
        };
      }
      return ord;
    });
    
    onUpdateOrders(updatedOrders);
    if (selectedOrder && selectedOrder.id === order.id) {
      setSelectedOrder({
        ...selectedOrder,
        historial: [newHistoryItem, ...selectedOrder.historial]
      });
    }

    // 3. Add system automated log to communication channel
    const pushChatMsg: ChatMessage = {
      id: `msg_push_${Date.now()}`,
      senderId: currentUser.uid,
      senderName: 'KIDRIA Automation',
      senderRole: 'admin',
      text: `🔔 [NOTIFICACIÓN PUSH ENVIADA AL CLIENTE] • Se ha enviado una alerta emergente directamente al dispositivo de ${order.cliente} recordando la mensualidad vencida/pendiente de ${montoMsg} MXN por el concepto "${conceptoMsg}".`,
      fecha: timestamp,
      read: false
    };
    onUpdateChats([...chats, pushChatMsg]);

    triggerFeedback('success', `¡Notificación Push enviada al smartphone y navegador de ${order.cliente} con éxito!`);
  };

  React.useEffect(() => {
    const checkTab = () => {
      const savedTab = sessionStorage.getItem('admin_initial_tab');
      if (savedTab && (savedTab === 'crm' || savedTab === 'tickets' || savedTab === 'chats' || savedTab === 'stats')) {
        setActiveTab(savedTab);
        sessionStorage.removeItem('admin_initial_tab');
      }
      const savedTicketId = sessionStorage.getItem('admin_initial_ticket_id');
      if (savedTicketId) {
        setActiveTicketId(savedTicketId);
        sessionStorage.removeItem('admin_initial_ticket_id');
      }
    };
    
    checkTab();
    window.addEventListener('admin_tab_switch', checkTab);
    return () => window.removeEventListener('admin_tab_switch', checkTab);
  }, [activeTicketId]);

  React.useEffect(() => {
    if (tickets.length > 0 && !activeTicketId) {
      setActiveTicketId(tickets[0].id);
    }
  }, [tickets, activeTicketId]);

  // New Client Order Form State
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [newOrderClient, setNewOrderClient] = useState('');
  const [newOrderEmail, setNewOrderEmail] = useState('');
  const [newOrderEmpresa, setNewOrderEmpresa] = useState('');
  const [newOrderProject, setNewOrderProject] = useState('');
  const [newOrderPrice, setNewOrderPrice] = useState(8500);

  const handleAdvanceStep = (orderId: string, currentStepId: string) => {
    // Find index of current step in STEPPER_STEPS
    const currentIndex = stepperSteps.findIndex(s => s.id === currentStepId);
    if (currentIndex === -1 || currentIndex === stepperSteps.length - 1) return;
    
    const nextStep = stepperSteps[currentIndex + 1];
    
    // Update step completion
    const updatedSteps = stepperSteps.map((step, idx) => {
      if (idx <= currentIndex + 1) {
        return { ...step, completed: true };
      }
      return step;
    });
    onUpdateStepperSteps(updatedSteps);

    // Update the order with the new step
    const updatedOrders = orders.map(ord => {
      if (ord.id === orderId) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const newHistoryItem = {
          id: `h_adv_${Date.now()}`,
          fecha: timestamp,
          titulo: `Hito Alcanzado: ${nextStep.nombre}`,
          descripcion: `El proyecto avanzó automáticamente al hito de ${nextStep.nombre} (${nextStep.porcentaje}%).`,
          autor: currentUser.nombre
        };

        return {
          ...ord,
          estado: nextStep.id,
          historial: [newHistoryItem, ...ord.historial]
        };
      }
      return ord;
    });

    onUpdateOrders(updatedOrders);
    const updatedSelected = updatedOrders.find(o => o.id === orderId);
    if (updatedSelected) setSelectedOrder(updatedSelected);
  };

  const handleToggleFirebaseStatus = (orderId: string) => {
    const updatedOrders = orders.map(ord => {
      if (ord.id === orderId) {
        const nextStatus: 'pending' | 'configured' = ord.estadoFirebase === 'configured' ? 'pending' : 'configured';
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const newHistoryItem = {
          id: `h_fb_${Date.now()}`,
          fecha: timestamp,
          titulo: `Firebase Configuración`,
          descripcion: `Estado de Firebase actualizado a: ${nextStatus === 'configured' ? 'CONFIGURADO' : 'PENDIENTE'}`,
          autor: currentUser.nombre
        };
        return {
          ...ord,
          estadoFirebase: nextStatus,
          historial: [newHistoryItem, ...ord.historial]
        };
      }
      return ord;
    });
    onUpdateOrders(updatedOrders);
    const updatedSelected = updatedOrders.find(o => o.id === orderId);
    if (updatedSelected) setSelectedOrder(updatedSelected);
  };

  const handleAddTimelineUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHistoryTitle || !newHistoryDesc || !selectedOrder) return;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const newItem = {
      id: `h_custom_${Date.now()}`,
      fecha: timestamp,
      titulo: newHistoryTitle,
      descripcion: newHistoryDesc,
      autor: currentUser.nombre
    };

    const updatedOrders = orders.map(ord => {
      if (ord.id === selectedOrder.id) {
        return {
          ...ord,
          historial: [newItem, ...ord.historial]
        };
      }
      return ord;
    });

    onUpdateOrders(updatedOrders);
    setSelectedOrder({
      ...selectedOrder,
      historial: [newItem, ...selectedOrder.historial]
    });
    setNewHistoryTitle('');
    setNewHistoryDesc('');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminReplyText.trim()) return;

    const newMsg: ChatMessage = {
      id: `chat_${Date.now()}`,
      senderId: currentUser.uid,
      senderName: currentUser.nombre,
      senderRole: 'admin',
      text: adminReplyText,
      fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
      read: true
    };

    onUpdateChats([...chats, newMsg]);
    setAdminReplyText('');
  };

  const handleSendTicketReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketReplyText.trim() || !activeTicketId) return;

    const updatedTickets = tickets.map(t => {
      if (t.id === activeTicketId) {
        return {
          ...t,
          status: 'en_progreso' as const,
          replies: [
            ...t.replies,
            {
              id: `tr_rep_${Date.now()}`,
              senderName: currentUser.nombre,
              senderRole: 'admin' as any,
              message: ticketReplyText,
              fecha: new Date().toISOString().replace('T', ' ').substring(0, 16)
            }
          ]
        };
      }
      return t;
    });

    onUpdateTickets(updatedTickets);
    setTicketReplyText('');
  };

  const handleResolveTicket = (ticketId: string) => {
    const updatedTickets = tickets.map(t => {
      if (t.id === ticketId) {
        return { ...t, status: 'resuelto' as const };
      }
      return t;
    });
    onUpdateTickets(updatedTickets);
  };

  const handleCreateNewOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderClient || !newOrderEmail || !newOrderEmpresa || !newOrderProject) return;

    const newOrder: ProjectOrder = {
      id: `order_${Date.now()}`,
      cliente: newOrderClient,
      correo: newOrderEmail,
      empresa: newOrderEmpresa,
      telefono: '+52 55 1234 5678',
      giro: 'Negocio Local',
      proyecto: newOrderProject,
      precioTotal: newOrderPrice,
      anticipo: newOrderPrice / 2,
      saldoPendiente: newOrderPrice / 2,
      estado: 'step_diseno',
      fechaContratacion: new Date().toISOString().substring(0, 10),
      fechaEntrega: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      mensualidad: 250,
      estadoStripe: 'pending',
      estadoFirebase: 'pending',
      notasInternas: 'Nuevo prospecto registrado en el CRM de KIDRIA.',
      prioridad: 'media',
      categoria: 'PWA Standard',
      observaciones: 'Listo para iniciar hito 1.',
      responsableProyecto: 'Lucas Prieto (Senior Frontend Developer)',
      historial: [
        { id: `h_init_${Date.now()}`, fecha: new Date().toISOString().replace('T', ' ').substring(0, 16), titulo: 'Registro del Proyecto', descripcion: 'Proyecto cargado con éxito en el ecosistema de KIDRIA.', autor: currentUser.nombre }
      ],
      archivos: [],
      facturas: [
        { id: `inv_new_${Date.now()}`, numero: 'INV-TEMP-001', concepto: 'Anticipo del 50%', monto: newOrderPrice / 2, fechaEmision: new Date().toISOString().substring(0, 10), fechaVencimiento: new Date().toISOString().substring(0, 10), estado: 'pendiente' }
      ],
      contractSigned: false
    };

    onUpdateOrders([newOrder, ...orders]);
    setSelectedOrder(newOrder);
    setShowNewOrderModal(false);
    setNewOrderClient('');
    setNewOrderEmail('');
    setNewOrderEmpresa('');
    setNewOrderProject('');
  };

  // Math helper stats
  const totalRevenue = orders.reduce((acc, curr) => acc + curr.anticipo + (curr.estadoStripe === 'paid' ? curr.saldoPendiente : 0), 0);
  const pendingCollections = orders.reduce((acc, curr) => acc + curr.saldoPendiente, 0);
  const activeProjectsCount = orders.filter(o => o.estado !== 'step_entrega').length;
  const closedTicketsCount = tickets.filter(t => t.status === 'resuelto').length;
  const openTicketsCount = tickets.filter(t => t.status !== 'resuelto').length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Metrics Header Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Ingresos Totales</p>
            <h3 className="text-2xl font-bold font-display text-white mt-1">${totalRevenue.toLocaleString()} MXN</h3>
          </div>
          <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-lg">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Por Cobrar</p>
            <h3 className="text-2xl font-bold font-display text-white mt-1">${pendingCollections.toLocaleString()} MXN</h3>
          </div>
          <div className="bg-amber-500/10 text-amber-400 p-3 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Proyectos Activos</p>
            <h3 className="text-2xl font-bold font-display text-white mt-1">{activeProjectsCount}</h3>
          </div>
          <div className="bg-indigo-500/10 text-indigo-400 p-3 rounded-lg">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Soporte Tickets</p>
            <h3 className="text-2xl font-bold font-display text-white mt-1">
              {openTicketsCount} <span className="text-xs font-normal text-slate-500">/ {tickets.length}</span>
            </h3>
          </div>
          <div className="bg-red-500/10 text-red-400 p-3 rounded-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Alertas de Morosidad y Acciones de Suspensión (Admin) */}
      {orders.some(ord => ord.facturas?.some(inv => inv.estado === 'vencida')) && (
        <div className="bg-slate-900 border border-red-500/30 p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
              <h3 className="text-white font-bold font-display text-sm">Control Administrativo de Deudores (Mensualidades Vencidas)</h3>
            </div>
            <span className="text-red-400 text-xs font-semibold bg-red-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
              Requiere Atención
            </span>
          </div>

          <div className="space-y-3">
            {orders.map(ord => {
              const vencidaInv = ord.facturas?.find(inv => inv.estado === 'vencida');
              if (!vencidaInv) return null;

              const isPausado = ord.estadoApp === 'pausado';

              return (
                <div key={ord.id} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="bg-red-500/10 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-red-500/20 font-mono">
                        DEUDOR ACTIVO
                      </span>
                      <h4 className="text-white font-bold text-xs">{ord.cliente} • {ord.empresa}</h4>
                      <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                        isPausado ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {isPausado ? '🚫 App Suspendida' : '⚠️ App Activa (En Riesgo)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-slate-400 text-[11px]">
                      <p><span className="text-slate-500">Concepto:</span> <strong className="text-slate-200">{vencidaInv.concepto}</strong></p>
                      <p><span className="text-slate-500">Mensualidad:</span> <strong className="text-red-400 font-mono">${vencidaInv.monto.toLocaleString()} MXN</strong></p>
                      <p><span className="text-slate-500">Venció el:</span> <strong className="text-slate-200 font-mono">{vencidaInv.fechaVencimiento}</strong></p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 self-end lg:self-center">
                    <button
                      onClick={() => handleSendPaymentReminder(ord, vencidaInv)}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs font-display flex items-center gap-1.5 transition-all transform active:scale-98 cursor-pointer"
                      title="Enviar recordatorio automático al chat privado del cliente"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Notificar Cobro</span>
                    </button>

                    <button
                      onClick={() => handleToggleAppState(ord)}
                      className={`font-bold px-3 py-1.5 rounded-lg text-xs font-display flex items-center gap-1.5 transition-all transform active:scale-98 cursor-pointer ${
                        isPausado 
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950' 
                          : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40'
                      }`}
                      title={isPausado ? "Restablecer acceso público a la aplicación" : "Suspender temporalmente el hosting y base de datos"}
                    >
                      {isPausado ? <Play className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      <span>{isPausado ? 'Reactivar App' : 'Pausar App'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Local Feedback Toast Alert */}
      {actionFeedback && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 animate-fade-in ${
          actionFeedback.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        }`}>
          {actionFeedback.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5 animate-pulse" />}
          <p className="text-xs font-medium">{actionFeedback.message}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-800 flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('crm')}
            className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
              activeTab === 'crm' 
                ? 'border-emerald-500 text-emerald-400' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Gestión CRM (Clientes)
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
              activeTab === 'tickets' 
                ? 'border-emerald-500 text-emerald-400' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Tickets de Soporte
            {openTicketsCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {openTicketsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('chats')}
            className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
              activeTab === 'chats' 
                ? 'border-emerald-500 text-emerald-400' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Chat Directo
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
              activeTab === 'stats' 
                ? 'border-emerald-500 text-emerald-400' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Métricas del Sistema
          </button>
          <button
            onClick={() => setActiveTab('mensualidades')}
            className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all flex items-center gap-1.5 transition-all ${
              activeTab === 'mensualidades' 
                ? 'border-emerald-500 text-emerald-400' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>Cobros y Mensualidades</span>
            {orders.some(o => o.facturas?.some(i => i.estado === 'vencida')) && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            )}
            {orders.filter(o => o.facturas?.some(i => i.estado === 'vencida')).length > 0 && (
              <span className="bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold border border-red-500/30">
                {orders.filter(o => o.facturas?.some(i => i.estado === 'vencida')).length} deudor(es)
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all flex items-center gap-1.5 transition-all ${
              activeTab === 'config' 
                ? 'border-emerald-500 text-emerald-400' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configuración de Pagos y Planes</span>
          </button>
        </div>

        <button
          onClick={() => setShowNewOrderModal(true)}
          className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-semibold px-4 py-1.5 rounded-lg text-xs font-display flex items-center gap-1.5 transition-all transform active:scale-98 shadow-md shadow-emerald-500/10"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* TAB CONTENTS */}

      {activeTab === 'crm' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* List of active orders */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-[600px] flex flex-col">
            <h3 className="text-white font-semibold font-display text-sm mb-3">Expedientes de Clientes (SaaS)</h3>
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {orders.map(order => {
                const currentStep = stepperSteps.find(s => s.id === order.estado);
                const isSelected = selectedOrder?.id === order.id;
                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-2 ${
                      isSelected 
                        ? 'bg-slate-950 border-emerald-500/50 shadow-lg' 
                        : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-950/80 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-white font-medium text-sm leading-tight">{order.empresa}</h4>
                        <p className="text-slate-500 text-xs mt-0.5">{order.cliente}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                        order.prioridad === 'alta' 
                          ? 'bg-red-500/15 text-red-400 border border-red-500/20' 
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {order.prioridad}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${currentStep?.porcentaje || 0}%` }}
                        ></div>
                      </div>
                      <span className="text-slate-400 font-mono text-[10px] font-medium whitespace-nowrap">
                        {currentStep?.porcentaje || 0}%
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-400 mt-0.5 pt-2 border-t border-slate-800/50">
                      <span className="truncate max-w-[140px] text-emerald-400">{currentStep?.nombre}</span>
                      <span className="font-mono text-slate-500">{order.fechaEntrega}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CRM Detail view */}
          {selectedOrder ? (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                {/* Header detail */}
                <div className="flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-medium font-mono px-2.5 py-0.5 rounded-full">
                      ID: {selectedOrder.id}
                    </span>
                    <h2 className="text-xl font-bold font-display text-white mt-1.5">{selectedOrder.proyecto}</h2>
                    <p className="text-slate-400 text-sm mt-0.5">Empresa: {selectedOrder.empresa} • Cliente: {selectedOrder.cliente}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleFirebaseStatus(selectedOrder.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-display border transition-all flex items-center gap-1.5 ${
                        selectedOrder.estadoFirebase === 'configured'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      <span>Firebase: {selectedOrder.estadoFirebase === 'configured' ? 'CONFIGURADO' : 'PENDIENTE'}</span>
                    </button>

                    <button
                      onClick={() => handleAdvanceStep(selectedOrder.id, selectedOrder.estado)}
                      disabled={selectedOrder.estado === 'step_entrega'}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold px-4 py-1.5 rounded-lg text-xs font-display flex items-center gap-1.5 transition-all transform active:scale-98"
                    >
                      <Play className="fill-slate-950 w-3 h-3" />
                      <span>Siguiente Hito</span>
                    </button>
                  </div>
                </div>

                {/* Grid details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-950/40 border border-slate-800/80 p-3 rounded-lg text-center">
                    <p className="text-slate-500 text-[10px] uppercase font-semibold">Total Contrato</p>
                    <p className="text-white font-bold text-base mt-0.5">${selectedOrder.precioTotal.toLocaleString()} MXN</p>
                  </div>
                  <div className="bg-slate-950/40 border border-slate-800/80 p-3 rounded-lg text-center">
                    <p className="text-slate-500 text-[10px] uppercase font-semibold">Anticipo Pago</p>
                    <p className="text-emerald-400 font-bold text-base mt-0.5">${selectedOrder.anticipo.toLocaleString()} MXN</p>
                  </div>
                  <div className="bg-slate-950/40 border border-slate-800/80 p-3 rounded-lg text-center">
                    <p className="text-slate-500 text-[10px] uppercase font-semibold">Saldo Pendiente</p>
                    <p className="text-amber-400 font-bold text-base mt-0.5">${selectedOrder.saldoPendiente.toLocaleString()} MXN</p>
                  </div>
                  <div className="bg-slate-950/40 border border-slate-800/80 p-3 rounded-lg text-center">
                    <p className="text-slate-500 text-[10px] uppercase font-semibold">Mensualidad Soporte</p>
                    <p className="text-indigo-400 font-bold text-base mt-0.5">${selectedOrder.mensualidad} MXN/mes</p>
                  </div>
                </div>

                {/* Notes and observations */}
                <div className="space-y-3 bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl">
                  <h4 className="text-white font-semibold font-display text-xs uppercase tracking-wider">Notas del Administrador & Observaciones</h4>
                  <p className="text-slate-300 text-xs leading-relaxed">{selectedOrder.notasInternas}</p>
                  <div className="border-t border-slate-800 pt-3 flex flex-wrap gap-4 text-xs">
                    <p className="text-slate-400"><span className="text-slate-500">Responsable:</span> {selectedOrder.responsableProyecto}</p>
                    <p className="text-slate-400"><span className="text-slate-500">Categoría:</span> {selectedOrder.categoria}</p>
                    <p className="text-slate-400"><span className="text-slate-500">Email:</span> {selectedOrder.correo}</p>
                  </div>
                </div>

                {/* Actions: Add custom timeline milestone */}
                <form onSubmit={handleAddTimelineUpdate} className="space-y-3 bg-slate-950/20 border border-slate-800 p-4 rounded-xl">
                  <h4 className="text-white font-semibold font-display text-xs uppercase tracking-wider">Publicar en Línea de Tiempo del Cliente</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newHistoryTitle}
                      onChange={(e) => setNewHistoryTitle(e.target.value)}
                      placeholder="Título del hito (ej. Prototipo Figma Finalizado)"
                      className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full"
                    />
                    <input
                      type="text"
                      value={newHistoryDesc}
                      onChange={(e) => setNewHistoryDesc(e.target.value)}
                      placeholder="Descripción técnica del avance..."
                      className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold py-2 px-3 rounded-lg text-xs font-display flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Send className="w-3 h-3" />
                    <span>Publicar Actualización</span>
                  </button>
                </form>

                {/* Invoices overview */}
                <div className="space-y-3">
                  <h4 className="text-white font-semibold font-display text-xs uppercase tracking-wider">Facturas y Suscripciones (Stripe Connect)</h4>
                  <div className="space-y-2">
                    {selectedOrder.facturas.map(inv => (
                      <div key={inv.id} className="bg-slate-950/40 border border-slate-800/50 px-4 py-3 rounded-xl flex justify-between items-center text-xs">
                        <div className="space-y-1">
                          <p className="text-white font-medium">{inv.concepto}</p>
                          <p className="text-slate-500 text-[10px] font-mono">{inv.numero} • Vence el {inv.fechaVencimiento}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-white font-bold">${inv.monto} MXN</p>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                            inv.estado === 'pagada'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}>
                            {inv.estado}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* File archives for download */}
                <div className="space-y-3">
                  <h4 className="text-white font-semibold font-display text-xs uppercase tracking-wider">Archivos Vinculados</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedOrder.archivos.map(file => (
                      <div key={file.id} className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs">
                        <div className="truncate pr-2">
                          <p className="text-slate-300 font-medium truncate">{file.nombre}</p>
                          <p className="text-slate-500 text-[10px] mt-0.5 uppercase">{file.categoria} • {file.size}</p>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{file.fecha}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 font-display">
              No hay clientes registrados en KIDRIA.
            </div>
          )}
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Support Tickets list */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-[600px] flex flex-col">
            <h3 className="text-white font-semibold font-display text-sm mb-3">Tickets de Soporte Abiertos</h3>
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {tickets.map(ticket => {
                const isSelected = activeTicketId === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setActiveTicketId(ticket.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-2 ${
                      isSelected 
                        ? 'bg-slate-950 border-emerald-500/50 shadow-lg' 
                        : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-950/80 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        ticket.priority === 'alta' 
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {ticket.priority}
                      </span>
                      <span className={`text-[10px] font-medium uppercase ${
                        ticket.status === 'resuelto' 
                          ? 'text-emerald-400' 
                          : ticket.status === 'en_progreso'
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="text-white font-medium text-xs leading-snug truncate">{ticket.title}</h4>
                    <p className="text-slate-400 text-[11px] line-clamp-1">{ticket.description}</p>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-800/50 pt-2 mt-0.5">
                      <span className="font-mono">{ticket.createdAt}</span>
                      <span>{ticket.replies.length} mensajes</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ticket conversation view */}
          {activeTicketId ? (
            (() => {
              const ticket = tickets.find(t => t.id === activeTicketId);
              if (!ticket) return null;
              return (
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col h-[600px]">
                  {/* Header */}
                  <div className="flex justify-between items-start pb-4 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2 py-0.5 rounded font-semibold uppercase">{ticket.category}</span>
                        <h3 className="text-white font-bold font-display text-base">{ticket.title}</h3>
                      </div>
                      <p className="text-slate-400 text-xs mt-1">Ticket ID: {ticket.id} • Creado el {ticket.createdAt}</p>
                    </div>
                    {ticket.status !== 'resuelto' && (
                      <button
                        onClick={() => handleResolveTicket(ticket.id)}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                      >
                        Marcar Resuelto
                      </button>
                    )}
                  </div>

                  {/* Body - messages list */}
                  <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-1">
                    {/* Customer original issue */}
                    <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-xl space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-emerald-400 font-semibold font-display">Cliente: {ticket.replies[0]?.senderName || 'Carlos Gómez'}</span>
                        <span className="text-slate-500 font-mono">{ticket.createdAt}</span>
                      </div>
                      <p className="text-slate-300 text-xs leading-relaxed">{ticket.description}</p>
                    </div>

                    {/* Replies */}
                    {ticket.replies.map(reply => {
                      const isAdminReply = reply.senderRole === 'admin';
                      return (
                        <div 
                          key={reply.id} 
                          className={`p-4 rounded-xl border text-xs space-y-2 max-w-[85%] ${
                            isAdminReply
                              ? 'ml-auto bg-emerald-500/5 border-emerald-500/10 text-right'
                              : 'mr-auto bg-slate-950/60 border-slate-800/80 text-left'
                          }`}
                        >
                          <div className={`flex justify-between gap-4 text-[10px] text-slate-500 ${isAdminReply ? 'flex-row-reverse' : ''}`}>
                            <span className="font-semibold text-slate-300">{reply.senderName}</span>
                            <span className="font-mono">{reply.fecha}</span>
                          </div>
                          <p className="text-slate-300 leading-relaxed">{reply.message}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reply Input Form */}
                  {ticket.status !== 'resuelto' ? (
                    <form onSubmit={handleSendTicketReply} className="flex gap-2 pt-3 border-t border-slate-800">
                      <input
                        type="text"
                        value={ticketReplyText}
                        onChange={(e) => setTicketReplyText(e.target.value)}
                        placeholder="Escribe tu respuesta de soporte técnico..."
                        className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2.5 text-xs focus:border-emerald-500 focus:outline-none flex-1"
                      />
                      <button
                        type="submit"
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-4 py-2.5 rounded-lg text-xs font-display flex items-center gap-1.5 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar</span>
                      </button>
                    </form>
                  ) : (
                    <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl text-center text-xs text-slate-500 font-display">
                      Este ticket fue resuelto y cerrado. El cliente otorgó una calificación de: {'★'.repeat(ticket.rating || 5)} ({ticket.rating || 5}/5).
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 font-display h-[600px] flex items-center justify-center">
              Selecciona un ticket de soporte de la lista para gestionarlo.
            </div>
          )}
        </div>
      )}

      {activeTab === 'chats' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-[600px] flex flex-col max-w-4xl mx-auto">
          {/* Header */}
          <div className="pb-4 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-white font-bold font-display text-base">Canal Privado de Comunicación</h3>
              <p className="text-slate-400 text-xs mt-1">Chat de administración con {selectedOrder?.empresa || 'Cliente'} ({selectedOrder?.cliente || 'Contacto'})</p>
            </div>
            <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Soporte Online
            </span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-1">
            {chats.map(msg => {
              const isAdminMsg = msg.senderRole === 'admin';
              return (
                <div 
                  key={msg.id} 
                  className={`flex flex-col max-w-[70%] space-y-1 ${isAdminMsg ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                >
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="font-semibold text-slate-400">{msg.senderName}</span>
                    <span className="font-mono">{msg.fecha}</span>
                  </div>
                  <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    isAdminMsg 
                      ? 'bg-emerald-500 text-slate-950 font-medium rounded-tr-none shadow-lg shadow-emerald-500/5' 
                      : 'bg-slate-950 border border-slate-800 text-white rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                  {msg.read && isAdminMsg && (
                    <span className="text-[9px] text-slate-500 italic mt-0.5">Leído ✓</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reply Form */}
          <form onSubmit={handleSendChat} className="flex gap-2 pt-3 border-t border-slate-800">
            <input
              type="text"
              value={adminReplyText}
              onChange={(e) => setAdminReplyText(e.target.value)}
              placeholder={`Escribe tu mensaje privado hacia ${selectedOrder?.cliente || 'el cliente'}...`}
              className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2.5 text-xs focus:border-emerald-500 focus:outline-none flex-1"
            />
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-4 py-2.5 rounded-lg text-xs font-display flex items-center gap-1.5 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar</span>
            </button>
          </form>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h3 className="text-white font-bold font-display text-sm">Distribución de Proyectos Activos</h3>
            <div className="space-y-3">
              {orders.map(order => {
                const currentStep = stepperSteps.find(s => s.id === order.estado);
                return (
                  <div key={order.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white font-medium">{order.empresa}</span>
                      <span className="text-slate-400 font-mono">{currentStep?.porcentaje || 0}%</span>
                    </div>
                    <div className="bg-slate-950 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${currentStep?.porcentaje || 0}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h3 className="text-white font-bold font-display text-sm">Resumen Operativo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl text-center space-y-1">
                <p className="text-slate-500 font-semibold">TICKETS RESUELTOS</p>
                <p className="text-2xl font-bold font-display text-emerald-400">{closedTicketsCount}</p>
              </div>
              <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl text-center space-y-1">
                <p className="text-slate-500 font-semibold">TICKETS ABIERTOS</p>
                <p className="text-2xl font-bold font-display text-red-400">{openTicketsCount}</p>
              </div>
              <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl text-center space-y-1">
                <p className="text-slate-500 font-semibold">VALOR TOTAL CONTRATADO</p>
                <p className="text-2xl font-bold font-display text-white">
                  ${orders.reduce((acc, c) => acc + c.precioTotal, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl text-center space-y-1">
                <p className="text-slate-500 font-semibold">COBERTURA FIREBASE</p>
                <p className="text-2xl font-bold font-display text-indigo-400">
                  {orders.filter(o => o.estadoFirebase === 'configured').length} / {orders.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'mensualidades' && (
        <div className="space-y-6">
          {/* Tarjetas Informativas Superiores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <p className="text-slate-500 text-xs font-semibold uppercase font-mono">Total Clientes Activos</p>
                <p className="text-3xl font-extrabold font-display text-white">{orders.length}</p>
                <p className="text-slate-400 text-[10px]">Expedientes registrados en el CRM</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 text-emerald-400 p-3 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <p className="text-slate-500 text-xs font-semibold uppercase font-mono">Al Corriente / Pagado</p>
                <p className="text-3xl font-extrabold font-display text-emerald-400">
                  {orders.filter(ord => !ord.facturas?.some(inv => inv.estado === 'vencida' || inv.estado === 'pendiente')).length}
                </p>
                <p className="text-slate-400 text-[10px]">Sin facturas vencidas o pendientes</p>
              </div>
              <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-xl border border-emerald-500/20">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <p className="text-slate-500 text-xs font-semibold uppercase font-mono">Deudores / Mensualidades Pendientes</p>
                <p className="text-3xl font-extrabold font-display text-red-400">
                  {orders.filter(ord => ord.facturas?.some(inv => inv.estado === 'vencida' || inv.estado === 'pendiente')).length}
                </p>
                <p className="text-slate-400 text-[10px]">Sujetos a envío de recordatorios push</p>
              </div>
              <div className="bg-red-500/15 text-red-400 p-3 rounded-xl border border-red-500/20">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Tabla de Clientes y Mensualidades */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/20">
              <div>
                <h3 className="text-white font-bold font-display text-sm">Control General de Mensualidades PWA</h3>
                <p className="text-slate-400 text-xs mt-0.5">Envía recordatorios push y administra el estado público de sus aplicaciones.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-mono text-[10.5px] uppercase tracking-wider">
                    <th className="py-4 px-5">Cliente / Empresa</th>
                    <th className="py-4 px-5">Proyecto</th>
                    <th className="py-4 px-5">Mensualidad Establecida</th>
                    <th className="py-4 px-5">Estado de Pago</th>
                    <th className="py-4 px-5">Fecha de Vencimiento</th>
                    <th className="py-4 px-5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orders.map(ord => {
                    // Search for active monthly fee or pending/due invoice
                    const vencidaInv = ord.facturas?.find(inv => inv.estado === 'vencida');
                    const pendienteInv = ord.facturas?.find(inv => inv.estado === 'pendiente');
                    const activeInvoice = vencidaInv || pendienteInv;

                    let statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Check className="w-3 h-3" />
                        Al Corriente
                      </span>
                    );
                    let vencimientoDate = "Siguiente ciclo";
                    let montoText = "$1,500 MXN"; // Default established monthly rate

                    if (vencidaInv) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          Moroso Vencido
                        </span>
                      );
                      vencimientoDate = vencidaInv.fechaVencimiento;
                      montoText = `$${vencidaInv.monto.toLocaleString()} MXN`;
                    } else if (pendienteInv) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3" />
                          Pendiente de Pago
                        </span>
                      );
                      vencimientoDate = pendienteInv.fechaVencimiento;
                      montoText = `$${pendienteInv.monto.toLocaleString()} MXN`;
                    }

                    // Look up for a standard "Suscripción" concept inside invoice logs to fetch established payment amount
                    const subInvoice = ord.facturas?.find(inv => inv.concepto.toLowerCase().includes('suscripción') || inv.concepto.toLowerCase().includes('mensualidad'));
                    if (subInvoice && !activeInvoice) {
                      montoText = `$${subInvoice.monto.toLocaleString()} MXN`;
                    }

                    return (
                      <tr key={ord.id} className="hover:bg-slate-950/30 transition-all">
                        <td className="py-4.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold font-display border border-emerald-500/20 uppercase">
                              {ord.empresa.substring(0, 2)}
                            </div>
                            <div>
                              <p className="text-white font-bold">{ord.cliente}</p>
                              <p className="text-slate-500 text-[11px] font-mono">{ord.correo}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4.5 px-5">
                          <div className="space-y-0.5">
                            <p className="text-slate-300 font-semibold">{ord.empresa}</p>
                            <p className="text-slate-500 text-[10px]">Giro: {ord.giro}</p>
                          </div>
                        </td>

                        <td className="py-4.5 px-5 font-mono font-bold text-slate-300">
                          {montoText}
                        </td>

                        <td className="py-4.5 px-5">
                          {statusBadge}
                          {ord.estadoApp === 'pausado' && (
                            <span className="block text-[9.5px] text-red-500 font-bold mt-1 uppercase animate-pulse">
                              🚫 App Suspendida
                            </span>
                          )}
                        </td>

                        <td className="py-4.5 px-5 font-mono text-slate-400">
                          {vencimientoDate}
                        </td>

                        <td className="py-4.5 px-5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSendManualPush(ord)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-[11px] font-display flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer shadow-md shadow-emerald-500/10"
                              title="Enviar notificación push inmediata al teléfono móvil y navegador"
                            >
                              <Bell className="w-3.5 h-3.5 animate-bounce" />
                              <span>Notificación Push</span>
                            </button>

                            <button
                              onClick={() => {
                                // Jump into Chat Tab with this client
                                setActiveTab('chats');
                              }}
                              className="bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold px-2.5 py-1.5 rounded-lg text-[11px] transition-all cursor-pointer"
                              title="Ir al chat privado de soporte"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>

                            {activeInvoice && (
                              <button
                                onClick={() => handleToggleAppState(ord)}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] transition-all font-semibold cursor-pointer ${
                                  ord.estadoApp === 'pausado'
                                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                                }`}
                                title={ord.estadoApp === 'pausado' ? 'Reactivar aplicación' : 'Pausar aplicación por adeudo'}
                              >
                                {ord.estadoApp === 'pausado' ? <Play className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'config' && (
        <div className="space-y-6 animate-fade-in text-left">
          {/* Tarjeta de Consola Firebase - Default Gemini Project */}
          <div className="bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3 text-left">
                <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-lg border border-indigo-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold font-display text-sm uppercase tracking-wide">Consola de Firebase (Default Gemini Project)</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Acceso administrativo directo a la base de datos Firestore y Autenticación en vivo</p>
                </div>
              </div>
              <a
                href="https://console.firebase.google.com/project/gen-lang-client-0651099895/firestore/databases/ai-studio-vortexapps-5bf502cd-f6ef-4bba-9f38-124a2ac9a689/data"
                target="_blank"
                referrerPolicy="no-referrer"
                className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-xs font-display flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/15 cursor-pointer text-center whitespace-nowrap self-start sm:self-center"
              >
                <Globe className="w-4 h-4" />
                <span>Abrir Consola Firestore</span>
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950/30 p-3 rounded-lg border border-slate-800/80">
                <p className="text-slate-500 text-[10px] uppercase font-mono">Nombre del Proyecto</p>
                <p className="text-slate-200 font-bold mt-1">Default Gemini Project</p>
              </div>
              <div className="bg-slate-950/30 p-3 rounded-lg border border-slate-800/80">
                <p className="text-slate-500 text-[10px] uppercase font-mono">ID del Proyecto GCP</p>
                <p className="text-slate-200 font-mono mt-1">gen-lang-client-0651099895</p>
              </div>
              <div className="bg-slate-950/30 p-3 rounded-lg border border-slate-800/80">
                <p className="text-slate-500 text-[10px] uppercase font-mono">ID Base de Datos Firestore</p>
                <p className="text-cyan-400 font-mono mt-1 break-all">ai-studio-vortexapps-5bf502cd-f6ef-4bba-9f38-124a2ac9a689</p>
              </div>
            </div>

            <div className="bg-slate-950/40 p-3 rounded-lg text-[11px] text-indigo-300 leading-relaxed border border-indigo-500/10">
              💡 <strong>Monitoreo y Control:</strong> Esta base de datos es compartida en tiempo real entre la plataforma de desarrollo SaaS y la PWA del cliente. Todos los cambios realizados en esta consola (nuevos clientes, tickets de soporte y chats) se sincronizarán de manera instantánea.
            </div>
          </div>

          {/* Tarjeta de Gestión de Administradores y Equipo */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3 text-left">
                <div className="bg-amber-500/10 text-amber-400 p-2.5 rounded-lg border border-amber-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold font-display text-sm uppercase tracking-wide">Administradores y Equipo</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Gestione los administradores generales y personal con privilegios de acceso</p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => setShowAddAdminForm(!showAddAdminForm)}
                className="bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs font-display flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap self-start sm:self-center"
              >
                <Plus className="w-4 h-4" />
                <span>Crear Administrador</span>
              </button>
            </div>

            {/* Slide-down form to create a new administrator */}
            {showAddAdminForm && (
              <form onSubmit={handleCreateAdmin} className="bg-slate-950/40 p-5 rounded-xl border border-slate-800 space-y-4 animate-fade-in">
                <h4 className="text-amber-400 font-bold font-display text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Nuevo Administrador General
                </h4>

                {adminActionError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
                    ⚠️ {adminActionError}
                  </div>
                )}

                {adminActionSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-lg">
                    ✅ {adminActionSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      placeholder="Ej. Juan Pérez"
                      value={newAdminNombre}
                      onChange={(e) => setNewAdminNombre(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs focus:border-amber-500 focus:outline-none transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      placeholder="ejemplo@kidria.com"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs focus:border-amber-500 focus:outline-none transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Contraseña de Acceso</label>
                    <input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs focus:border-amber-500 focus:outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddAdminForm(false);
                      setAdminActionError('');
                      setAdminActionSuccess('');
                    }}
                    className="border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold px-4 py-2 rounded-lg text-xs font-display cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAdmin}
                    className="bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs font-display flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {submittingAdmin ? 'Guardando...' : 'Guardar Administrador'}
                  </button>
                </div>
              </form>
            )}

            {/* List of registered administrators and users */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500 uppercase font-mono px-2">
                <span>Nombre / Correo</span>
                <span className="mr-24 sm:mr-32">Rol / Acciones</span>
              </div>

              {loadingUsers ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                  <span>Cargando lista de usuarios...</span>
                </div>
              ) : usersError ? (
                <div className="bg-red-500/10 border border-red-500/25 p-4 rounded-xl text-xs text-red-400">
                  {usersError}
                </div>
              ) : usersList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No se encontraron usuarios registrados.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
                  {usersList.map((usr) => {
                    const isSelf = usr.uid === currentUser.uid;
                    const isAdminUser = usr.role === 'admin_general';
                    const isProtectedSuperAdmin = usr.email === 'kino9230@gmail.com' || usr.uid === '6L3VhkgBB2hwMQOlVVYdzSW7Nz03';

                    return (
                      <div key={usr.uid} className="flex items-center justify-between p-3.5 hover:bg-slate-950/40 transition-colors text-xs">
                        <div className="flex flex-col space-y-1 text-left min-w-0 pr-4">
                          <span className="text-slate-200 font-bold truncate flex items-center gap-1.5">
                            {usr.nombre || 'Sin Nombre'}
                            {isSelf && (
                              <span className="bg-slate-800 text-slate-400 text-[9px] px-1.5 py-0.5 rounded border border-slate-700 uppercase font-mono tracking-wider font-normal">Tú</span>
                            )}
                          </span>
                          <span className="text-slate-400 text-[11px] font-mono truncate">{usr.email}</span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Role badge */}
                          {isAdminUser ? (
                            <span className="bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 font-bold font-display text-[10px] uppercase px-2 py-1 rounded-md flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" />
                              <span>Admin</span>
                            </span>
                          ) : (
                            <span className="bg-slate-800 border border-slate-700 text-slate-400 font-bold font-display text-[10px] uppercase px-2 py-1 rounded-md">
                              Cliente
                            </span>
                          )}

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 ml-2">
                            <button
                              type="button"
                              onClick={() => handleUpdateUserRole(usr.uid, usr.role)}
                              disabled={isSelf || isProtectedSuperAdmin}
                              title={isAdminUser ? "Degradar a Cliente" : "Promover a Administrador"}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isSelf || isProtectedSuperAdmin
                                  ? 'opacity-40 cursor-not-allowed border-transparent text-slate-600'
                                  : isAdminUser
                                  ? 'border-amber-500/20 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500 hover:text-slate-950 text-amber-400'
                                  : 'border-slate-800 hover:border-indigo-500 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-400'
                              }`}
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(usr.uid, usr.nombre)}
                              disabled={isSelf || isProtectedSuperAdmin}
                              title="Eliminar Cuenta"
                              className={`p-1.5 rounded-lg border transition-all ${
                                isSelf || isProtectedSuperAdmin
                                  ? 'opacity-40 cursor-not-allowed border-transparent text-slate-600'
                                  : 'border-slate-800 hover:border-red-500 hover:bg-red-500/10 text-slate-400 hover:text-red-400'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            
            {/* Payment Accounts Configuration Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold font-display text-sm uppercase tracking-wide">Cuentas de Depósito, Transferencia y Mercado Pago</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Configure la información financiera que visualizan los clientes al realizar pagos</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bank Transfer SPEI */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-4">
                  <h4 className="text-emerald-400 font-bold font-display text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Cuenta de Transferencia (SPEI)
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Nombre del Banco</label>
                      <input
                        type="text"
                        value={transBanco}
                        onChange={(e) => setTransBanco(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs focus:border-emerald-500 focus:outline-none transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">CLABE Interbancaria (18 dígitos)</label>
                      <input
                        type="text"
                        value={transClabe}
                        onChange={(e) => setTransClabe(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none transition-colors"
                        maxLength={22}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Nombre del Beneficiario</label>
                      <input
                        type="text"
                        value={transBeneficiario}
                        onChange={(e) => setTransBeneficiario(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs focus:border-emerald-500 focus:outline-none transition-colors"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Bank Deposit Account */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-4">
                  <h4 className="text-emerald-400 font-bold font-display text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Cuenta de Depósito Bancario
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Nombre del Banco</label>
                      <input
                        type="text"
                        value={depBanco}
                        onChange={(e) => setDepBanco(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs focus:border-emerald-500 focus:outline-none transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Número de Cuenta Bancaria</label>
                      <input
                        type="text"
                        value={depCuenta}
                        onChange={(e) => setDepCuenta(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Nombre del Beneficiario</label>
                      <input
                        type="text"
                        value={depBeneficiario}
                        onChange={(e) => setDepBeneficiario(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs focus:border-emerald-500 focus:outline-none transition-colors"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Mercado Pago link */}
              <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-800/80 space-y-3">
                <h4 className="text-cyan-400 font-bold font-display text-xs flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Pasarela Digital: Enlace de Mercado Pago (Botón Directo)
                </h4>
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Link de Cobro o Botón Seguro de Mercado Pago</label>
                  <input
                    type="url"
                    value={mercadoPagoLink}
                    onChange={(e) => setMercadoPagoLink(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 focus:outline-none transition-colors font-mono"
                    placeholder="https://link.mercadopago.com.mx/..."
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    Este link se usará directamente para los botones de checkout rápido y flujos de liquidación en el dashboard de clientes.
                  </p>
                </div>
              </div>
            </div>

            {/* Plans, Prices and Promotions configuration Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="bg-cyan-500/10 text-cyan-400 p-2 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold font-display text-sm uppercase tracking-wide">Configuración de Planes, Precios y Promociones</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Modifique el costo inicial de setup, el precio mensual recurrente de soporte e infraestructura y el texto promocional</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* STARTER PLAN */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h4 className="text-slate-200 font-bold font-display text-xs">Plan Starter (PWA Básica)</h4>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono font-bold">1</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">Precio Inicial ($ MXN)</label>
                      <input
                        type="number"
                        value={starterCost}
                        onChange={(e) => setStarterCost(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">Mensualidad ($ MXN)</label>
                      <input
                        type="number"
                        value={starterMonthly}
                        onChange={(e) => setStarterMonthly(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs font-bold"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">Promoción Activa</label>
                    <input
                      type="text"
                      value={starterPromo}
                      onChange={(e) => setStarterPromo(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs"
                      required
                    />
                  </div>
                </div>

                {/* BUSINESS PLAN */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h4 className="text-emerald-400 font-bold font-display text-xs">Plan Business (PWA Premium)</h4>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">Recomendado</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">Precio Inicial ($ MXN)</label>
                      <input
                        type="number"
                        value={businessCost}
                        onChange={(e) => setBusinessCost(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">Mensualidad ($ MXN)</label>
                      <input
                        type="number"
                        value={businessMonthly}
                        onChange={(e) => setBusinessMonthly(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs font-bold"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">Promoción Activa</label>
                    <input
                      type="text"
                      value={businessPromo}
                      onChange={(e) => setBusinessPromo(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs"
                      required
                    />
                  </div>
                </div>

                {/* PREMIUM IA PLAN */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h4 className="text-cyan-400 font-bold font-display text-xs">Plan Premium IA (Inteligente)</h4>
                    <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-mono font-bold">IA Ready</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">Precio Inicial ($ MXN)</label>
                      <input
                        type="number"
                        value={premiumIACost}
                        onChange={(e) => setPremiumIACost(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">Mensualidad ($ MXN)</label>
                      <input
                        type="number"
                        value={premiumIAMonthly}
                        onChange={(e) => setPremiumIAMonthly(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs font-bold"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">Promoción Activa</label>
                    <input
                      type="text"
                      value={premiumIAPromo}
                      onChange={(e) => setPremiumIAPromo(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs"
                      required
                    />
                  </div>
                </div>

                {/* ENTERPRISE PLAN */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h4 className="text-zinc-200 font-bold font-display text-xs">Plan Enterprise (Corporativo)</h4>
                    <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded font-mono font-bold">Custom</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">Precio Inicial ($ MXN)</label>
                      <input
                        type="number"
                        value={enterpriseCost}
                        onChange={(e) => setEnterpriseCost(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">Mensualidad ($ MXN)</label>
                      <input
                        type="number"
                        value={enterpriseMonthly}
                        onChange={(e) => setEnterpriseMonthly(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs font-bold"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1">Promoción Activa</label>
                    <input
                      type="text"
                      value={enterprisePromo}
                      onChange={(e) => setEnterprisePromo(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold px-8 py-3.5 rounded-xl font-display text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all transform active:scale-98 cursor-pointer"
              >
                Guardar Configuración Global de Pagos
              </button>
            </div>
          </form>

          {/* FCM Push Notifications Control Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-bold font-display text-sm uppercase tracking-wide">Notificaciones Push de Administración</h3>
                <p className="text-slate-400 text-xs mt-0.5">Gestione su suscripción para recibir alertas inmediatas de nuevos tickets y mensajes de clientes</p>
              </div>
            </div>

            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-4 text-xs">
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Al activar las notificaciones push de administración, recibirá alertas en tiempo real en su dispositivo cada vez que un cliente cree un nuevo ticket de soporte, responda a un ticket existente o realice acciones críticas sobre su proyecto.
              </p>

              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Soporte del Navegador:</span>
                  {fcmSupported === null ? (
                    <span className="text-slate-500">Verificando...</span>
                  ) : fcmSupported ? (
                    <span className="text-emerald-400 font-medium">Compatible ✓</span>
                  ) : (
                    <span className="text-rose-400 font-medium">No compatible (Requiere HTTPS / PWA) ✗</span>
                  )}
                </div>

                {fcmSupported && (
                  <>
                    {/* VAPID Key input */}
                    <div className="space-y-1">
                      <label className="block text-slate-400 text-[11px]">Llave Pública VAPID (Opcional):</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Llave VAPID por defecto de KIDRIA"
                          value={customVapidKey}
                          onChange={(e) => {
                            setCustomVapidKey(e.target.value);
                            saveStoredVapidKey(e.target.value);
                          }}
                          className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none w-full font-mono text-[10px]"
                        />
                        {customVapidKey && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomVapidKey('');
                              saveStoredVapidKey('');
                            }}
                            className="text-slate-500 hover:text-slate-300 text-[10px] px-1"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Subscribe & Status buttons */}
                    <div className="flex flex-wrap gap-2 pt-1 items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-slate-400">Estado de Alertas Admin:</span>
                        {fcmToken ? (
                          <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Suscrito</span>
                        ) : (
                          <span className="text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">Inactivo</span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={subscribingFcm}
                        onClick={handleTogglePushSubscription}
                        className={`px-3 py-1.5 rounded text-xs font-semibold font-display transition-all ${
                          fcmToken
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20'
                            : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                        }`}
                      >
                        {subscribingFcm ? 'Configurando...' : fcmToken ? 'Desactivar Notificaciones' : 'Habilitar Notificaciones'}
                      </button>
                    </div>

                    {/* Test Push dispatch */}
                    {fcmToken && (
                      <div className="border-t border-slate-800/60 pt-3 space-y-2">
                        <label className="block text-slate-300 text-[11px] font-medium">Prueba tu Notificación de Administrador:</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={testNotificationLoading}
                            onClick={() => handleSendTestPush('¡Notificación de Admin! 🔑', 'Las alertas de administración para KIDRIA están funcionando de manera impecable.')}
                            className="bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 hover:text-white px-3 py-1.5 rounded text-[11px] transition-all flex items-center gap-1.5"
                          >
                            {testNotificationLoading ? 'Enviando...' : 'Probar Notificación de Admin'}
                          </button>
                        </div>
                        {testNotificationStatus && (
                          <p className={`text-[10px] ${testNotificationStatus.includes('exitosamente') ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {testNotificationStatus}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showNewOrderModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateNewOrder} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transition-all p-6 space-y-4">
            <div className="pb-3 border-b border-slate-800">
              <h3 className="text-white font-bold font-display text-base">Registrar Nuevo Cliente SaaS</h3>
              <p className="text-slate-400 text-xs mt-0.5">Carga inicial en CRM KIDRIA</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Nombre Completo del Cliente</label>
                <input
                  type="text"
                  required
                  value={newOrderClient}
                  onChange={(e) => setNewOrderClient(e.target.value)}
                  placeholder="ej. Carlos Gómez"
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={newOrderEmail}
                  onChange={(e) => setNewOrderEmail(e.target.value)}
                  placeholder="ej. cliente@correo.com"
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Nombre de la Empresa</label>
                <input
                  type="text"
                  required
                  value={newOrderEmpresa}
                  onChange={(e) => setNewOrderEmpresa(e.target.value)}
                  placeholder="ej. Aura Belleza & Spa"
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Nombre del Proyecto</label>
                <input
                  type="text"
                  required
                  value={newOrderProject}
                  onChange={(e) => setNewOrderProject(e.target.value)}
                  placeholder="ej. PWA Aura Salon & Spa Booking System"
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Precio Total del Proyecto (MXN)</label>
                <input
                  type="number"
                  required
                  value={newOrderPrice}
                  onChange={(e) => setNewOrderPrice(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowNewOrderModal(false)}
                className="bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold py-2 px-4 rounded-lg text-xs font-display flex-1 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold py-2 px-4 rounded-lg text-xs font-display flex-1 transition-all"
              >
                Crear Expediente
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
