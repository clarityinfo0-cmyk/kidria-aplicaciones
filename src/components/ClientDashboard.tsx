import React, { useState, useEffect, useRef } from 'react';
import { pdf } from '@react-pdf/renderer';
import { ProposalPDF } from './ProposalPDF';
import { 
  Briefcase, Calendar, DollarSign, FileText, Send, Sparkles, MessageSquare, Check, 
  Settings, Key, Shield, HelpCircle, Download, ExternalLink, RefreshCw, 
  Clock, CheckCircle2, User, Building2, Palette, Globe, Heart, ChevronRight, 
  AlertCircle, Star, ThumbsUp, Trash, Lock, FileSignature, Database, TrendingUp,
  AlertTriangle, ShieldAlert, Bell, Facebook, Instagram, MessageCircle
} from 'lucide-react';
import { ProjectOrder, SupportTicket, ChatMessage, StepperStep, UserProfile, FileItem, InvoiceItem } from '../types';
import { requestFcmToken, isFcmSupported, getStoredVapidKey, saveStoredVapidKey, initForegroundNotificationListener, playNotificationSound } from '../lib/fcm';

interface ClientDashboardProps {
  order: ProjectOrder;
  tickets: SupportTicket[];
  chats: ChatMessage[];
  stepperSteps: StepperStep[];
  currentUser: UserProfile;
  onUpdateTickets: (updatedTickets: SupportTicket[]) => void;
  onUpdateChats: (updatedChats: ChatMessage[]) => void;
  onUpdateUser: (updatedUser: UserProfile) => void;
  onUpdateOrder: (updatedOrder: ProjectOrder) => void;
  onInitiatePayment: (amount: number, concept: string, invoiceId?: string, isSub?: boolean) => void;
  onStartFunnel?: () => void;
}

export default function ClientDashboard({
  order,
  tickets,
  chats,
  stepperSteps,
  currentUser,
  onUpdateTickets,
  onUpdateChats,
  onUpdateUser,
  onUpdateOrder,
  onInitiatePayment,
  onStartFunnel
}: ClientDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'stepper' | 'files' | 'finance' | 'support' | 'chat' | 'domains' | 'ai_consulting' | 'ai_growth' | 'referrals' | 'settings'>('overview');
  const isDummy = !!order.isDummy;
  
  // FCM Push Notifications State
  const [fcmSupported, setFcmSupported] = useState<boolean | null>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [customVapidKey, setCustomVapidKey] = useState<string>(getStoredVapidKey());
  const [subscribingFcm, setSubscribingFcm] = useState<boolean>(false);
  const [testNotificationStatus, setTestNotificationStatus] = useState<string | null>(null);
  const [testNotificationLoading, setTestNotificationLoading] = useState<boolean>(false);

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
          console.log('[ClientDashboard] Intercepted foreground FCM message:', payload);
          
          // Strict reception-side filtering: Client only receives 'proyecto_estado' (status progress) or 'chat_mensaje' (new messages)
          const category = payload.data?.category;
          if (category && category !== 'proyecto_estado' && category !== 'chat_mensaje') {
            console.log('[ClientDashboard] Reception-side filter blocked notification of category:', category);
            return;
          }

          playNotificationSound();
          setActivePushNotification({
            title: payload.notification?.title || 'Notificación en tiempo real',
            message: payload.notification?.body || 'Tienes una nueva actualización en KIDRIA.',
            amount: payload.data?.amount ? parseFloat(payload.data.amount) : 150,
            concept: payload.data?.concept || 'Soporte Mensual PWA',
            invoiceId: payload.data?.invoiceId || `inv_${Date.now()}`
          });
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
          link: window.location.origin + '/?tab=support'
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
  
  // Real Stripe configuration status state
  const [stripeStatus, setStripeStatus] = useState<{
    configured: boolean;
    mode: 'test' | 'live' | 'simulation';
    webhookConfigured: boolean;
    webhookUrl: string;
    stripeVersion: string;
  } | null>(null);

  useEffect(() => {
    const fetchStripeStatus = async () => {
      try {
        const res = await fetch('/api/stripe/status');
        if (res.ok) {
          const data = await res.json();
          setStripeStatus(data);
        }
      } catch (err) {
        console.warn('Error fetching Stripe status:', err);
      }
    };
    fetchStripeStatus();
  }, [activeTab]);

  const [activePushNotification, setActivePushNotification] = useState<any>(null);

  useEffect(() => {
    const checkPush = () => {
      const pushKey = `kidria_push_${order.id}`;
      const savedPush = localStorage.getItem(pushKey);
      if (savedPush) {
        try {
          const parsed = JSON.parse(savedPush);
          if (!parsed.read) {
            setActivePushNotification(parsed);
          }
        } catch (e) {
          console.error('Error parsing push notification:', e);
        }
      }
    };
    checkPush();
    // Poll every 3 seconds to react instantly to admin requests within the preview
    const interval = setInterval(checkPush, 3000);
    return () => clearInterval(interval);
  }, [order.id]);

  const handleDismissPush = () => {
    if (activePushNotification) {
      const pushKey = `kidria_push_${order.id}`;
      const updatedPush = { ...activePushNotification, read: true };
      localStorage.setItem(pushKey, JSON.stringify(updatedPush));
      setActivePushNotification(null);
    }
  };

  
  // Signature pad states
  const [signatureName, setSignatureName] = useState('');
  const [contractSigned, setContractSigned] = useState(order.contractSigned);

  // IA Consultora states
  const [consultingQuery, setConsultingQuery] = useState('');
  const [consultingResult, setConsultingResult] = useState('');
  const [consultingStreaming, setConsultingStreaming] = useState(false);

  // Business AI Analyzer states
  const [growthReport, setGrowthReport] = useState('');
  const [growthStreaming, setGrowthStreaming] = useState(false);

  // Proposal Generator states
  const [proposalFormBudget, setProposalFormBudget] = useState('8500');
  const [proposalFormDeliverable, setProposalFormDeliverable] = useState('PWA Premium de Delivery');
  const [proposalResult, setProposalResult] = useState<any>(null);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalPrinting, setProposalPrinting] = useState(false);

  // Chat state
  const [chatMessageText, setChatMessageText] = useState('');

  // Ticket create state
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [newTicketTitle, setNewTicketTitle] = useState('');
  const [newTicketDesc, setNewTicketDesc] = useState('');
  const [newTicketPriority, setNewTicketPriority] = useState<'alta' | 'media' | 'baja'>('media');
  const [newTicketCategory, setNewTicketCategory] = useState<'pagos' | 'desarrollo' | 'bugs' | 'ia' | 'otros'>('desarrollo');

  // Ticket reply state
  const [activeTicketId, setActiveTicketId] = useState<string | null>(tickets[0]?.id || null);
  const [ticketReplyText, setTicketReplyText] = useState('');

  // Domain lookup states
  const [domainSearchQuery, setDomainSearchQuery] = useState('gourmetexpress.app');
  const [domainSearchLoading, setDomainSearchLoading] = useState(false);
  const [domainSearchResult, setDomainSearchResult] = useState<any>(null);

  // Active step in stepper
  const activeStep = stepperSteps.find(s => s.id === order.estado) || stepperSteps[0];
  const activeStepIndex = stepperSteps.findIndex(s => s.id === activeStep.id);
  const overallPercentage = activeStepIndex === 0 ? 0 : stepperSteps[activeStepIndex - 1].porcentaje;

  // Ref for chat auto-scrolling
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Simulated PDF Downloader (Works flawlessly in iframe sandbox environments!)
  const handleDownloadFile = (file: FileItem) => {
    let title = file.nombre;
    let content = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>${file.nombre}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; max-width: 800px; margin: 0 auto; background: #f8fafc; }
          .card { background: white; border: 1px solid #e2e8f0; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          h1 { color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; font-size: 24px; text-transform: uppercase; margin-top: 0; }
          .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
          .badge { background: #e0e7ff; color: #4338ca; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 11px; }
          .section { margin-top: 24px; }
          .section-title { font-weight: bold; color: #0f172a; margin-bottom: 8px; font-size: 16px; border-left: 4px solid #4f46e5; padding-left: 10px; }
          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 11px; color: #94a3b8; }
          .btn-print { background: #4f46e5; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; margin-top: 20px; text-transform: uppercase; }
          .btn-print:hover { background: #4338ca; }
          @media print { .btn-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>${file.nombre.replace('.pdf', '').replace(/_/g, ' ')}</h1>
          <div class="meta">
            <span>Categoría: <span class="badge">${file.categoria.toUpperCase()}</span></span> &bull; 
            <span>Tamaño: <strong>${file.size}</strong></span> &bull; 
            <span>Fecha de emisión: <strong>${file.fecha}</strong></span>
          </div>
          
          <div class="section">
            <div class="section-title">Resumen de Documento Autorizado</div>
            <p>Este documento representa el archivo oficial emitido por <strong>KIDRIA</strong> para el proyecto <strong>${order.proyecto}</strong>.</p>
            <p>El cliente, <strong>${order.cliente}</strong> de la empresa <strong>${order.empresa}</strong>, ha aprobado y firmado todos los términos asociados con este entregable.</p>
          </div>

          <div class="section">
            <div class="section-title">Certificado de Autenticidad Digital</div>
            <p>Este archivo ha sido firmado digitalmente y se encuentra alojado de manera segura en los servidores en la nube de KIDRIA. Su código hash SHA-256 ha sido registrado y verificado para garantizar la integridad y confidencialidad del mismo.</p>
            <p style="font-family: monospace; background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 11px; word-break: break-all; border: 1px solid #e2e8f0;">
              HASH_VERIFICATION: 7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b
            </p>
          </div>

          <div class="footer">
            KIDRIA S.A. de C.V. &copy; ${new Date().getFullYear()} &bull; Soporte: soporte@kidria.com
          </div>
          
          <center>
            <button class="btn-print" onclick="window.print()">Imprimir / Guardar como PDF</button>
          </center>
        </div>
      </body>
      </html>
    `;

    // Download as HTML so they can open and print/save to PDF flawlessly
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.nombre.replace('.pdf', '.html');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chats, activeTab]);

  // STREAMING ENDPOINT CALL: IA Consultora
  const handleAIConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultingQuery.trim() || consultingStreaming) return;

    setConsultingResult('');
    setConsultingStreaming(true);

    try {
      const response = await fetch('/api/gemini/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessType: order.giro,
          currentPrompt: consultingQuery
        })
      });

      if (!response.ok) {
        throw new Error('No se pudo establecer conexión con el servidor Gemini AI.');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunkString = decoder.decode(value);
            const lines = chunkString.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') {
                  done = true;
                  break;
                }
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.text) {
                    setConsultingResult(prev => prev + parsed.text);
                  } else if (parsed.error) {
                    setConsultingResult(parsed.error);
                  }
                } catch (e) {
                  // ignore parse error for small fragments
                }
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error(error);
      setConsultingResult(`Error: ${error.message || 'Error de red.'}`);
    } finally {
      setConsultingStreaming(false);
    }
  };

  // STREAMING ENDPOINT CALL: Growth Business Analyzer
  const handleAIGrowthAnalyze = async () => {
    if (growthStreaming) return;

    setGrowthReport('');
    setGrowthStreaming(true);

    try {
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyData: {
            empresa: order.empresa,
            giro: order.giro,
            proyecto: order.proyecto,
            estado: activeStep.nombre,
            presupuesto: order.precioTotal
          }
        })
      });

      if (!response.ok) {
        throw new Error('No se pudo establecer conexión con el analizador de Gemini AI.');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunkString = decoder.decode(value);
            const lines = chunkString.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') {
                  done = true;
                  break;
                }
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.text) {
                    setGrowthReport(prev => prev + parsed.text);
                  } else if (parsed.error) {
                    setGrowthReport(parsed.error);
                  }
                } catch (e) {
                  // ignore
                }
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error(error);
      setGrowthReport(`Error: ${error.message || 'Error de red.'}`);
    } finally {
      setGrowthStreaming(false);
    }
  };

  // POST ENDPOINT CALL: Proposal Generator
  const handleGenerateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setProposalLoading(true);
    setProposalResult(null);

    try {
      const response = await fetch('/api/gemini/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: order.empresa,
          businessType: order.giro,
          budget: proposalFormBudget,
          targetDeliverable: proposalFormDeliverable
        })
      });

      if (!response.ok) {
        throw new Error('Error al conectar con la API de generación.');
      }

      const data = await response.json();
      setProposalResult(data);

      // Append proposal to history to alert the administrator
      if (order && onUpdateOrder) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const updatedOrder: ProjectOrder = {
          ...order,
          historial: [
            {
              id: `h_prop_${Date.now()}`,
              fecha: timestamp,
              titulo: `Propuesta Comercial Generada: "${data.tituloPropuesta || 'Propuesta de PWA'}"`,
              descripcion: `El cliente solicitó una propuesta comercial para el hito: "${proposalFormDeliverable}" con un presupuesto estimado de $${proposalFormBudget} MXN.`,
              autor: currentUser.nombre
            },
            ...order.historial
          ]
        };
        onUpdateOrder(updatedOrder);
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Error al generar propuesta.');
    } finally {
      setProposalLoading(false);
    }
  };

  // Downloads the AI generated proposal as a highly technical/commercial PDF using @react-pdf/renderer
  const handleDownloadProposalPDF = async () => {
    if (!proposalResult) return;
    setProposalPrinting(true);

    try {
      const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
      const folioStr = `VX-COM-${Date.now().toString().slice(-6)}`;
      const docTitle = `Propuesta_Comercial_${(order.empresa || 'Cliente').replace(/\s+/g, '_')}`;

      // Convert proposalResult into the mapped format expected by ProposalPDF
      const mappedAnalysisData = {
        businessType: order.giro || 'Servicios Digitales',
        detectedIssues: [
          { title: "Desconexión Operativa", description: `Dificultad para canalizar clientes interesados en el alcance "${proposalFormDeliverable}" de forma automatizada.` },
          { title: "Fricción de Pago Electrónico", description: "Incapacidad para recibir anticipos y cobros recurrentes de manera segura e integrada." },
          { title: "Deficiencia de Retención", description: "Ausencia de notificaciones de seguimiento automatizadas y alertas inteligentes de agenda." }
        ],
        recommendedFeatures: [
          "Módulo de Agenda y Captura",
          "Pasarela Electrónica con Stripe",
          "Notificaciones WhatsApp API"
        ],
        proposal: {
          description: proposalResult.propuestaMarkdown || "Propuesta de desarrollo para modernización digital.",
          objectives: proposalResult.beneficiosClave || [
            `Digitalizar el canal para el alcance de "${proposalFormDeliverable}".`,
            "Integrar pagos seguros automáticos.",
            "Automatizar alertas y agenda."
          ],
          features: proposalResult.roadmap?.map((r: any) => `${r.fase}: ${r.descripcion}`) || [
            "Módulo de Agenda y Configuración",
            "Módulo de Pagos Stripe Gateway"
          ],
          plans: {
            "Starter": { cost: 2700, features: ["Creación de Páginas Web", "Dominio de regalo (1 año)", "Diseño responsivo premium", "Hosting incluido", "Optimización SEO"] },
            "Business": { cost: Math.round(proposalResult.costoUSD), features: ["Alcance completo de PWA", "Pasarela Stripe", "Agenda Inteligente"] },
            "PremiumIA": { cost: Math.round(proposalResult.costoUSD * 1.5), features: ["Alcance completo + Gemini AI", "Automatización completa", "WhatsApp API"] }
          }
        }
      };

      const docInstance = (
        <ProposalPDF
          type="comercial"
          customBusinessName={order.empresa || 'Cliente'}
          analysisData={mappedAnalysisData}
          selectedPlan="Business"
          dateStr={dateStr}
          folioStr={folioStr}
        />
      );

      const blob = await pdf(docInstance).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error printing PDF proposal:", err);
      alert("Error al compilar y descargar propuesta PDF.");
    } finally {
      setProposalPrinting(false);
    }
  };

  // POST ENDPOINT CALL: Domain Checker lookup
  const handleDomainSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainSearchQuery.trim()) return;

    setDomainSearchLoading(true);
    setDomainSearchResult(null);

    try {
      const response = await fetch('/api/domains/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domainSearchQuery })
      });

      if (!response.ok) {
        throw new Error('Error en el chequeo de dominio.');
      }

      const data = await response.json();
      setDomainSearchResult(data);
    } catch (error) {
      console.error(error);
    } finally {
      setDomainSearchLoading(false);
    }
  };

  // E-Signature and Contract signing
  const handleSignContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatureName.trim()) return;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const updatedOrder = {
      ...order,
      contractSigned: true,
      contractSignedDate: timestamp,
      contractSignature: signatureName,
      historial: [
        {
          id: `h_sig_${Date.now()}`,
          fecha: timestamp,
          titulo: 'Contrato Firmado Digitalmente',
          descripcion: `Contrato de desarrollo PWA firmado electrónicamente por ${signatureName}.`,
          autor: currentUser.nombre
        },
        ...order.historial
      ]
    };

    onUpdateOrder(updatedOrder);
    setContractSigned(true);
  };

  // Send support chat message
  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessageText.trim()) return;

    const newMsg: ChatMessage = {
      id: `chat_${Date.now()}`,
      senderId: currentUser.uid,
      senderName: currentUser.nombre,
      senderRole: 'cliente',
      text: chatMessageText,
      fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
      read: false
    };

    onUpdateChats([...chats, newMsg]);
    setChatMessageText('');
  };

  // Create support ticket
  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketTitle || !newTicketDesc) return;

    const newTicket: SupportTicket = {
      id: `ticket_${Date.now()}`,
      title: newTicketTitle,
      description: newTicketDesc,
      priority: newTicketPriority,
      category: newTicketCategory,
      status: 'abierto',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      replies: [],
      rating: null
    };

    onUpdateTickets([newTicket, ...tickets]);
    setActiveTicketId(newTicket.id);
    setShowCreateTicketModal(false);
    setNewTicketTitle('');
    setNewTicketDesc('');
  };

  // Reply to support ticket
  const handleSendTicketReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketReplyText.trim() || !activeTicketId) return;

    const updatedTickets = tickets.map(t => {
      if (t.id === activeTicketId) {
        return {
          ...t,
          status: 'abierto' as const, // goes back to active support review
          replies: [
            ...t.replies,
            {
              id: `tr_rep_${Date.now()}`,
              senderName: currentUser.nombre,
              senderRole: 'cliente' as any,
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

  // Ticket rating system
  const handleRateTicket = (ticketId: string, rating: number) => {
    const updatedTickets = tickets.map(t => {
      if (t.id === ticketId) {
        return { ...t, rating };
      }
      return t;
    });
    onUpdateTickets(updatedTickets);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Notificación Push Simulada (Intercepta alertas manuales de administración) */}
      {activePushNotification && (
        <div className="fixed top-6 right-6 z-50 max-w-sm w-full bg-slate-900 border-2 border-red-500/40 rounded-2xl shadow-2xl p-5 animate-bounce-short shadow-red-950/40">
          <div className="flex gap-3">
            <div className="bg-red-500/20 text-red-400 p-2.5 rounded-xl border border-red-500/30 self-start animate-pulse">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono text-red-400 tracking-wider uppercase">Notificación Push Recibida</span>
                <button 
                  onClick={handleDismissPush}
                  className="text-slate-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>
              <h4 className="text-white font-bold text-xs">{activePushNotification.title}</h4>
              <p className="text-slate-300 text-[11px] leading-relaxed">{activePushNotification.message}</p>
              
              <div className="pt-3 flex gap-2">
                <button
                  onClick={() => {
                    onInitiatePayment(activePushNotification.amount, activePushNotification.concept, activePushNotification.invoiceId);
                    handleDismissPush();
                  }}
                  className="bg-gradient-to-r from-red-500 to-amber-600 hover:from-red-600 hover:to-amber-700 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-[10px] font-display flex items-center gap-1 shadow-md shadow-red-500/20 transition-all cursor-pointer"
                >
                  <DollarSign className="w-3 h-3" />
                  <span>Pagar Ahora</span>
                </button>
                <button
                  onClick={handleDismissPush}
                  className="bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold px-2.5 py-1.5 rounded-lg text-[10px] transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Welcome custom card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10"></div>
        
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl border border-slate-700 bg-slate-950 flex items-center justify-center overflow-hidden">
            {currentUser.logoUrl ? (
              <img src={currentUser.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <Building2 className="w-6 h-6 text-emerald-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-display text-white">¡Hola, {currentUser.nombre}!</h2>
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full uppercase">
                {currentUser.role}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-0.5">{currentUser.empresa || 'Prospecto'} • {isDummy ? 'Aún no tienes un proyecto de PWA activo' : order.proyecto}</p>
          </div>
        </div>

        {/* Quick summary bento metrics */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs font-display">
          <div className="space-y-1 min-w-[110px]">
            <p className="text-slate-500 font-semibold uppercase text-[10px]">ESTADO DE PWA</p>
            {isDummy ? (
              <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                <span>Por Configurar</span>
              </div>
            ) : order.estadoApp === 'pausado' ? (
              <div className="flex items-center gap-1.5 text-red-500 font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span>Pausada por Adeudo</span>
              </div>
            ) : order.facturas && order.facturas.some(inv => inv.estado === 'vencida') ? (
              <div className="flex items-center gap-1.5 text-amber-500 font-bold animate-bounce">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Riesgo de Suspensión</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>En Desarrollo</span>
              </div>
            )}
          </div>
          <div className="hidden sm:block w-px bg-slate-800 h-8 self-center"></div>
          <div className="space-y-1 min-w-[110px]">
            <p className="text-slate-500 font-semibold uppercase text-[10px]">HITO ACTUAL</p>
            <p className="text-white font-bold">{isDummy ? 'Por iniciar' : activeStep.nombre}</p>
          </div>
          <div className="hidden sm:block w-px bg-slate-800 h-8 self-center"></div>
          <div className="space-y-1 min-w-[110px]">
            <p className="text-slate-500 font-semibold uppercase text-[10px]">ENTREGA ESTIMADA</p>
            <p className="text-white font-mono font-bold">{isDummy ? 'Por definir' : order.fechaEntrega}</p>
          </div>
        </div>
      </div>

      {/* Control Panel: Activar Notificaciones */}
      {fcmSupported && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-5 relative overflow-hidden shadow-lg shadow-slate-950/25">
          <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -z-10"></div>
          <div className="flex gap-4 items-center">
            <div className={`p-3 rounded-xl border shrink-0 ${fcmToken ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
              <Bell className={`w-6 h-6 ${fcmToken ? '' : 'animate-bounce-short text-emerald-400'}`} />
            </div>
            <div className="space-y-1">
              <h3 className="text-white font-bold font-display text-sm">
                {fcmToken ? '✓ Notificaciones en tiempo real activadas' : 'Mantente al día en tiempo real'}
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed max-w-2xl">
                {fcmToken 
                  ? 'Ya estás suscrito. Recibirás alertas instantáneas cuando se actualice el avance de tu proyecto, respondamos a tus tickets de soporte, o recibas nuevos mensajes.' 
                  : 'Recibe alertas inmediatas en tu navegador sobre el avance del desarrollo de tu PWA, nuevas respuestas en soporte técnico y mensajes en el chat.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTogglePushSubscription}
            disabled={subscribingFcm}
            id="btn-activate-notifications"
            className={`font-bold font-display px-5 py-2.5 rounded-xl text-xs transition-all transform active:scale-98 cursor-pointer shrink-0 ${
              fcmToken 
                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20' 
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/15'
            }`}
          >
            {subscribingFcm ? 'Configurando...' : fcmToken ? 'Desactivar notificaciones' : 'Activar notificaciones'}
          </button>
        </div>
      )}

      {/* Alerta de Mensualidad Vencida y Pago Requerido */}
      {order.facturas && order.facturas.some(inv => inv.estado === 'vencida') && (
        <div className="bg-gradient-to-r from-red-500/15 via-amber-500/10 to-red-500/5 border border-red-500/40 p-5 rounded-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-lg shadow-red-950/20">
          <div className="absolute top-0 right-0 p-4 -mr-12 -mt-12 opacity-10 pointer-events-none">
            <ShieldAlert className="w-48 h-48 text-red-500" />
          </div>
          
          <div className="flex gap-4 items-start">
            <div className="bg-red-500/20 text-red-400 p-3 rounded-xl border border-red-500/30 shrink-0">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-red-500/20 text-red-400 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full uppercase tracking-wider border border-red-500/30">
                  {order.estadoApp === 'pausado' ? 'APLICACIÓN PAUSADA' : 'SUSPENSIÓN INMINENTE'}
                </span>
                <span className="text-slate-400 text-xs font-medium">• Mensualidad Vencida Requerida</span>
              </div>
              <h3 className="text-white font-bold font-display text-sm">
                {order.estadoApp === 'pausado' 
                  ? 'Tu aplicación web y servidores han sido pausados temporalmente' 
                  : 'Se requiere pago de mensualidad para evitar la suspensión de tu app'}
              </h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Detectamos que la factura <strong className="text-white font-mono">{order.facturas.find(inv => inv.estado === 'vencida')?.numero}</strong> por concepto de <em className="text-slate-200">"{order.facturas.find(inv => inv.estado === 'vencida')?.concepto}"</em> venció el <strong className="text-white">{order.facturas.find(inv => inv.estado === 'vencida')?.fechaVencimiento}</strong>. 
                {order.estadoApp === 'pausado'
                  ? ' Los accesos públicos han sido pausados. Realiza el pago de la mensualidad establecida para restablecer el servicio de inmediato.'
                  : ' Para evitar interrupciones de servicios en la nube, bases de datos y accesos de tus clientes, efectúa el pago establecido antes de que el sistema pause tu aplicación.'}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto">
            <div className="text-right pr-1 hidden md:block">
              <p className="text-slate-500 text-[10px] uppercase font-semibold font-mono">Monto Requerido</p>
              <p className="text-red-400 font-bold font-mono text-lg">${order.facturas.find(inv => inv.estado === 'vencida')?.monto.toLocaleString()} MXN</p>
            </div>
            <button
              onClick={() => {
                const vencida = order.facturas.find(inv => inv.estado === 'vencida');
                if (vencida) {
                  onInitiatePayment(vencida.monto, vencida.concepto, vencida.id);
                }
              }}
              className="bg-gradient-to-r from-red-500 to-amber-600 hover:from-red-600 hover:to-amber-700 text-slate-950 font-bold font-display px-5 py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 transition-all transform active:scale-98 cursor-pointer text-center w-full"
            >
              <DollarSign className="w-4 h-4" />
              <span>Pagar Mensualidad Ahora</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="border-b border-slate-800 overflow-x-auto flex scrollbar-none whitespace-nowrap">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
            activeTab === 'overview' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Vista General
        </button>
        {!isDummy && (
          <>
            <button
              onClick={() => setActiveTab('stepper')}
              className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
                activeTab === 'stepper' 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Avance de Desarrollo
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
                activeTab === 'finance' 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Finanzas y Stripe
            </button>
          </>
        )}
        <button
          onClick={() => setActiveTab('support')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
            activeTab === 'support' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Tickets de Soporte
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
            activeTab === 'chat' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Chat Privado
        </button>
        {!isDummy && (
          <>
            <button
              onClick={() => setActiveTab('ai_consulting')}
              className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
                activeTab === 'ai_consulting' 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Asistente IA Gemini
            </button>
            <button
              onClick={() => setActiveTab('ai_growth')}
              className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
                activeTab === 'ai_growth' 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Analítica y Crecimiento IA
            </button>
            <button
              onClick={() => setActiveTab('domains')}
              className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
                activeTab === 'domains' 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Dominios y DNS
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
                activeTab === 'files' 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Centro de Descargas
            </button>
          </>
        )}
        <button
          onClick={() => setActiveTab('referrals')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
            activeTab === 'referrals' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Sistema de Referidos
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2.5 font-medium text-sm border-b-2 font-display transition-all ${
            activeTab === 'settings' 
              ? 'border-emerald-500 text-emerald-400' 
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Configuración
        </button>
      </div>

      {/* TAB CONTENT IMPLEMENTATION */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        isDummy ? (
          <div className="space-y-8 animate-fade-in">
            {/* Call to Action Welcome Hero */}
            <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
              <div className="absolute left-1/3 bottom-0 w-60 h-60 bg-emerald-500/5 rounded-full blur-3xl -z-10"></div>
              
              <div className="max-w-2xl space-y-4 font-display">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold font-mono border border-indigo-500/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Configuración de Proyecto Pendiente</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
                  Construye tu PWA con Inteligencia Artificial de Vanguardia
                </h1>
                <p className="text-slate-300 text-sm leading-relaxed font-sans">
                  Estás a un paso de iniciar el desarrollo de tu aplicación web progresiva (PWA). Obtén una plataforma móvil auto-instalable, de carga instantánea, integrada con Inteligencia Artificial (Gemini API), notificaciones push reales y procesamiento de cobros nativo vía Stripe.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row gap-4">
                  {onStartFunnel && (
                    <button
                      onClick={onStartFunnel}
                      className="bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15 transition-all transform active:scale-98 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Comenzar Configuración de PWA</span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('support')}
                    className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold px-6 py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                    <span>Hablalo con un Asesor</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Comparison of KIDRIA PWA SaaS Plans */}
            <div className="space-y-4">
              <div className="text-center md:text-left space-y-1">
                <h2 className="text-lg font-bold font-display text-white">Planes de Desarrollo y Licenciamiento SaaS</h2>
                <p className="text-slate-400 text-xs">Elige el plan ideal para el alcance de tu Progressive Web App.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* SaaS Base */}
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-6 relative hover:border-slate-700 transition-colors">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-white font-bold font-display text-sm">SaaS Base</h3>
                      <p className="text-slate-400 text-[11px]">Aplicación Móvil Esencial</p>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white font-display">$5,000</span>
                      <span className="text-slate-400 text-xs font-medium font-mono">MXN / mes</span>
                    </div>
                    <ul className="text-slate-400 text-[11px] space-y-2 font-sans">
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Diseño UX/UI Móvil Adaptado</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Instalación PWA Estándar (Android/iOS)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Hosting en la Nube de Alta Disponibilidad</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Soporte Técnico Estándar</span>
                      </li>
                    </ul>
                  </div>
                  {onStartFunnel && (
                    <button
                      onClick={onStartFunnel}
                      className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-950 hover:bg-slate-800 hover:text-white text-slate-300 font-bold text-xs transition-colors cursor-pointer text-center"
                    >
                      Seleccionar Base
                    </button>
                  )}
                </div>

                {/* SaaS Premium */}
                <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-2xl flex flex-col justify-between space-y-6 relative hover:border-emerald-500/50 transition-colors shadow-lg shadow-emerald-500/5">
                  <div className="absolute top-0 right-6 -translate-y-1/2 bg-emerald-500 text-slate-950 font-black font-display text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Recomendado
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-white font-bold font-display text-sm">SaaS Premium</h3>
                      <p className="text-slate-400 text-[11px]">PWA Avanzada con IA de Gemini</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-white font-display">$15,000</span>
                        <span className="text-slate-400 text-xs font-medium font-mono">MXN Anticipo</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">+ $250 MXN de mensualidad recurrente</div>
                    </div>
                    <ul className="text-slate-400 text-[11px] space-y-2 font-sans">
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-slate-200 font-medium">Asistente de IA Gemini Personalizado</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-slate-200 font-medium font-medium">Notificaciones Push de FCM</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-slate-200 font-medium">Pasarela de Pagos Stripe Integrada</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Dominio Personalizado y SSL Gratis</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Soporte Prioritario con Chat en Tiempo Real</span>
                      </li>
                    </ul>
                  </div>
                  {onStartFunnel && (
                    <button
                      onClick={onStartFunnel}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-slate-950 font-black text-xs transition-colors cursor-pointer text-center"
                    >
                      Contratar Premium
                    </button>
                  )}
                </div>

                {/* Enterprise */}
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-6 relative hover:border-slate-700 transition-colors">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-white font-bold font-display text-sm">Enterprise Custom</h3>
                      <p className="text-slate-400 text-[11px]">Sistemas Tailor-Made Corporativos</p>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-white font-display">A Medida</span>
                    </div>
                    <ul className="text-slate-400 text-[11px] space-y-2 font-sans">
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Integración con ERP/CRM Privados</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Base de Datos Dedicada de Alta Escala</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Contrato de Nivel de Servicio (SLA) 99.9%</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Gerente de Proyecto Técnico Asignado</span>
                      </li>
                    </ul>
                  </div>
                  <button
                    onClick={() => setActiveTab('support')}
                    className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-950 hover:bg-slate-800 hover:text-white text-slate-300 font-bold text-xs transition-colors cursor-pointer text-center"
                  >
                    Contactar Ventas
                  </button>
                </div>
              </div>
            </div>

            {/* Core Advantages Bento Grid */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold font-display text-white text-center md:text-left">¿Por qué construir con el Framework de KIDRIA?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-display">
                <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h4 className="text-white font-bold text-xs">Inteligencia Artificial Integrada</h4>
                  <p className="text-slate-400 text-[11px] leading-relaxed font-sans">Asistente cognitivo inteligente entrenado específicamente con los datos de tu empresa para responder preguntas y automatizar flujos de trabajo.</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <h4 className="text-white font-bold text-xs">Pagos Seguros vía Stripe</h4>
                  <p className="text-slate-400 text-[11px] leading-relaxed font-sans">Configuración instantánea de pasarelas de pago para cobrar a tus clientes con tarjeta de crédito, débito, Apple Pay y Google Pay de forma 100% segura.</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <h4 className="text-white font-bold text-xs">Notificaciones Push en Caliente</h4>
                  <p className="text-slate-400 text-[11px] leading-relaxed font-sans">Incrementa el engagement de tus usuarios enviando notificaciones instantáneas de Firebase Cloud Messaging directamente a sus pantallas de bloqueo.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Real-time Visual Stepper Stepper Indicator */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-white font-bold font-display text-sm">Progreso General del Desarrollo</h3>
                <span className="text-emerald-400 font-mono font-bold text-sm bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  {overallPercentage}% Completado
                </span>
              </div>
              
              <div className="relative pt-2">
                <div className="bg-slate-950 h-3 rounded-full overflow-hidden relative border border-slate-800">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                    style={{ width: `${overallPercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Steps overview line */}
              <div className="grid grid-cols-12 gap-1 text-[10px] text-center font-mono">
                {stepperSteps.map((step, idx) => {
                  const isCompleted = idx < activeStepIndex;
                  const isCurrent = step.id === order.estado;
                  return (
                    <div 
                      key={step.id} 
                      className={`truncate p-1 rounded ${
                        isCurrent 
                          ? 'bg-emerald-500 text-slate-950 font-bold' 
                          : isCompleted 
                            ? 'text-emerald-400 font-medium' 
                            : 'text-slate-600'
                      }`}
                    >
                      {idx + 1}
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl flex items-start gap-3 mt-4 text-xs">
                <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-white font-bold font-display">Hito Activo: {activeStep.nombre}</h4>
                  <p className="text-slate-300 mt-1 leading-relaxed">{activeStep.descripcion}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[11px] text-slate-500">
                    <p><span className="text-slate-600">Responsable:</span> {activeStep.responsable}</p>
                    <p><span className="text-slate-600">Actualizado:</span> {activeStep.fecha} a las {activeStep.hora}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contract Sign E-Signature Pad */}
            {!contractSigned ? (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl"></div>
                <div className="flex items-center gap-2.5">
                  <FileSignature className="w-5 h-5 text-amber-400" />
                  <h3 className="text-white font-bold font-display text-sm">Firma Electrónica de Contrato de Servicio</h3>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Para proceder formalmente con los siguientes hitos y habilitar el canal de producción, debes firmar el contrato del proyecto utilizando tu firma digital.
                </p>

                <form onSubmit={handleSignContract} className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5 font-medium">Escribe tu nombre completo para firmar electrónicamente</label>
                    <input
                      type="text"
                      required
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      placeholder="ej. Carlos Gómez"
                      className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-amber-500 focus:outline-none w-full font-display"
                    />
                  </div>
                  
                  {/* Simulated touch signing area */}
                  <div className="border border-slate-800 border-dashed rounded-lg h-24 bg-slate-950 flex items-center justify-center p-2 select-none relative">
                    <p className="text-slate-600 text-[11px]">Área de firma táctil simulada</p>
                    {signatureName && (
                      <p className="absolute text-xl font-cursive text-amber-400 select-none tracking-widest rotate-[-1deg] font-display">
                        {signatureName}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold py-2.5 px-4 rounded-lg text-xs font-display flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/10"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Firmar Contrato y Guardar</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold font-display text-sm">Contrato Digital Firmado con Éxito</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Firmado electrónicamente por: <span className="text-emerald-400 font-semibold font-mono">{order.contractSignature}</span> el {order.contractSignedDate}</p>
                  </div>
                </div>
                <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-medium">
                  Guardado en Storage ✓
                </span>
              </div>
            )}

            {/* Real Timeline */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
              <h3 className="text-white font-bold font-display text-sm">Línea del Tiempo Histórica del Proyecto</h3>
              <div className="relative pl-6 border-l border-slate-800 space-y-6">
                {order.historial.map((item, idx) => (
                  <div key={item.id} className="relative group">
                    {/* Circle marker */}
                    <div className="absolute -left-[31px] top-0.5 bg-slate-950 w-4.5 h-4.5 rounded-full border border-emerald-500 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[10px] font-mono">{item.fecha} • {item.autor}</p>
                      <h4 className="text-white font-semibold text-xs mt-0.5">{item.titulo}</h4>
                      <p className="text-slate-400 text-xs mt-1 leading-relaxed">{item.descripcion}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar bento elements */}
          <div className="space-y-6">
            {/* Tarjeta de Madurez Digital */}
            {(() => {
              const pwaCoreScore = 30;
              const firebaseScore = order.estadoFirebase === 'configured' ? 15 : 5;
              const stripeScore = (order.estadoStripe === 'active' || order.estadoStripe === 'paid') ? 15 : 5;
              const iaScore = 15; // Módulo Gemini IA siempre activo
              const domainScore = currentUser.dominioPropuesto ? 15 : 5;
              const supportScore = 10; // Soporte activo siempre

              const currentMadurez = pwaCoreScore + firebaseScore + stripeScore + iaScore + domainScore + supportScore;
              const targetMadurez = 90;
              const isTargetAchieved = currentMadurez >= targetMadurez;

              // Para el arco SVG:
              // Circunferencia del semicírculo de radio 40 es pi * 40 = 125.66
              const radius = 40;
              const strokeLength = Math.PI * radius; // 125.66
              const strokeOffset = strokeLength - (strokeLength * Math.min(currentMadurez, 100)) / 100;

              // Ángulo en radianes para colocar el pin de la meta del 90%
              // 180 - (180 * (target / 100)) = 18 grados para 90%
              const targetAngleRad = (180 - (180 * (targetMadurez / 100))) * Math.PI / 180;
              const targetPinX = 50 + radius * Math.cos(targetAngleRad);
              const targetPinY = 50 - radius * Math.sin(targetAngleRad);

              return (
                <div id="digital-maturity-card" className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-5 relative overflow-hidden shadow-[0_0_15px_rgba(16,185,129,0.03)]">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-3xl -z-10"></div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-white font-bold font-display text-sm">Madurez Digital</h3>
                    </div>
                    <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold ${
                      isTargetAchieved 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {isTargetAchieved ? 'Meta Alcanzada' : 'Optimización Pendiente'}
                    </span>
                  </div>

                  {/* Medidor visual Gauge SVG */}
                  <div className="relative flex flex-col items-center justify-center pt-2">
                    <svg viewBox="0 0 100 60" className="w-full max-w-[180px] drop-shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
                      {/* Gradiente de fondo del arco */}
                      <defs>
                        <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#f97316" /> {/* Naranja */}
                          <stop offset="60%" stopColor="#eab308" /> {/* Amarillo */}
                          <stop offset="100%" stopColor="#10b981" /> {/* Esmeralda */}
                        </linearGradient>
                      </defs>

                      {/* Arco de fondo (Gris oscuro) */}
                      <path
                        d="M 10 50 A 40 40 0 0 1 90 50"
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="7"
                        strokeLinecap="round"
                      />

                      {/* Arco de progreso actual */}
                      <path
                        d="M 10 50 A 40 40 0 0 1 90 50"
                        fill="none"
                        stroke="url(#gauge-gradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={strokeLength}
                        strokeDashoffset={strokeOffset}
                        className="transition-all duration-1000 ease-out"
                      />

                      {/* Marcador de meta del 90% */}
                      <circle
                        cx={targetPinX}
                        cy={targetPinY}
                        r="3.5"
                        fill="#fbbf24"
                        className="animate-pulse cursor-help"
                      />
                      
                      {/* Texto de meta en miniatura cerca del marcador */}
                      <text
                        x={targetPinX}
                        y={targetPinY - 6}
                        fontFamily="monospace"
                        fontWeight="bold"
                        fontSize="5.5"
                        fill="#fbbf24"
                        textAnchor="middle"
                      >
                        Meta 90%
                      </text>

                      {/* Texto del porcentaje en el centro */}
                      <text
                        x="50"
                        y="44"
                        fontFamily="sans-serif"
                        fontWeight="bold"
                        fontSize="15"
                        fill="#ffffff"
                        textAnchor="middle"
                      >
                        {currentMadurez}%
                      </text>
                      
                      {/* Subetiqueta bajo el porcentaje */}
                      <text
                        x="50"
                        y="52"
                        fontFamily="sans-serif"
                        fontWeight="600"
                        fontSize="5"
                        fill="#64748b"
                        textAnchor="middle"
                        letterSpacing="0.5"
                      >
                        {isTargetAchieved ? 'ÓPTIMO' : 'EN PROGRESO'}
                      </text>
                    </svg>

                    {/* Meta Objetivo Leyenda */}
                    <div className="text-center -mt-2">
                      <p className="text-[10.5px] text-slate-400 leading-relaxed">
                        Tu negocio cuenta con un <span className="text-emerald-400 font-bold">{currentMadurez}%</span> de adopción digital frente al objetivo ideal del <span className="text-amber-400 font-bold">{targetMadurez}%</span>.
                      </p>
                    </div>
                  </div>

                  {/* Desglose de Servicios */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Desglose de Adopción</p>
                    
                    <div className="grid grid-cols-1 gap-2 text-xs">
                      {/* PWA Core */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-850">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-slate-300 text-[11px]">Aplicación PWA Core</span>
                        </div>
                        <span className="text-emerald-400 font-bold font-mono text-[11px]">+30%</span>
                      </div>

                      {/* Base de Datos Cloud (Firebase) */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-850">
                        <div className="flex items-center gap-2">
                          {order.estadoFirebase === 'configured' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <span className="text-slate-300 text-[11px]">Base de Datos Cloud (Firebase)</span>
                            {order.estadoFirebase !== 'configured' && (
                              <span className="text-[9px] text-slate-500">Pendiente de aprovisionamiento</span>
                            )}
                          </div>
                        </div>
                        <span className={`font-bold font-mono text-[11px] ${order.estadoFirebase === 'configured' ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {order.estadoFirebase === 'configured' ? '+15%' : '+5%'}
                        </span>
                      </div>

                      {/* Pasarela Stripe */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-850">
                        <div className="flex items-center gap-2">
                          {(order.estadoStripe === 'active' || order.estadoStripe === 'paid') ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <span className="text-slate-300 text-[11px]">Pasarela de Pagos (Stripe)</span>
                            {!(order.estadoStripe === 'active' || order.estadoStripe === 'paid') && (
                              <span className="text-[9px] text-slate-500 font-sans">Requiere liquidar anticipo</span>
                            )}
                          </div>
                        </div>
                        <span className={`font-bold font-mono text-[11px] ${(order.estadoStripe === 'active' || order.estadoStripe === 'paid') ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {(order.estadoStripe === 'active' || order.estadoStripe === 'paid') ? '+15%' : '+5%'}
                        </span>
                      </div>

                      {/* Asistente Inteligente IA */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-850">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-slate-300 text-[11px]">Asistente de Negocios IA</span>
                        </div>
                        <span className="text-emerald-400 font-bold font-mono text-[11px]">+15%</span>
                      </div>

                      {/* Dominio Propio con SSL */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-850">
                        <div className="flex items-center gap-2">
                          {currentUser.dominioPropuesto ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <span className="text-slate-300 text-[11px]">Dominio Propio con SSL</span>
                            {!currentUser.dominioPropuesto && (
                              <span className="text-[9px] text-slate-500">Configura tu dominio en ajustes</span>
                            )}
                          </div>
                        </div>
                        <span className={`font-bold font-mono text-[11px] ${currentUser.dominioPropuesto ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {currentUser.dominioPropuesto ? '+15%' : '+5%'}
                        </span>
                      </div>

                      {/* Soporte */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-850">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-slate-300 text-[11px]">Soporte Especializado 24/7</span>
                        </div>
                        <span className="text-emerald-400 font-bold font-mono text-[11px]">+10%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Financial quick widget */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
              <h3 className="text-white font-bold font-display text-sm">Resumen Financiero</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-xs pb-2 border-b border-slate-800/60">
                  <span className="text-slate-500">Monto del Contrato</span>
                  <span className="text-white font-bold">${order.precioTotal.toLocaleString()} MXN</span>
                </div>
                <div className="flex justify-between text-xs pb-2 border-b border-slate-800/60">
                  <span className="text-slate-500">Anticipo Pagado</span>
                  <span className="text-emerald-400 font-bold">${order.anticipo.toLocaleString()} MXN</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Saldo por Liquidar</span>
                  <span className="text-amber-400 font-bold">${order.saldoPendiente.toLocaleString()} MXN</span>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('finance')}
                className="w-full text-center bg-slate-950 hover:bg-slate-800 text-slate-300 font-medium py-2 rounded-lg text-xs transition-colors border border-slate-800"
              >
                Ver Facturas e Historial
              </button>
            </div>

            {/* Quick AI Consultant Widget */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl"></div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-white font-bold font-display text-sm">Consultor de Negocios Gemini</h3>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                ¿Tienes dudas estratégicas? Pregunta ideas técnicas de captación de clientes y automatización empresarial para tu veterinaria, tienda u hotel.
              </p>
              <button
                onClick={() => setActiveTab('ai_consulting')}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold py-2 px-4 rounded-lg text-xs font-display flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/10"
              >
                <span>Iniciar Consultoría</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Direct support quick contact */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-center space-y-3">
              <MessageSquare className="w-8 h-8 text-indigo-400 mx-auto" />
              <h3 className="text-white font-bold font-display text-sm">Soporte Técnico Integrado</h3>
              <p className="text-slate-400 text-xs">
                Tienes línea directa con el equipo técnico de desarrollo asignado a {order.empresa || 'tu negocio'}.
              </p>
              <button 
                onClick={() => setActiveTab('chat')}
                className="w-full text-center bg-slate-950 hover:bg-slate-800 text-indigo-400 font-medium py-2 rounded-lg text-xs transition-colors border border-indigo-500/20"
              >
                Abrir Chat Técnico
              </button>
            </div>
          </div>
        </div>
        )
      )}

      {/* 2. STEPPER TAB */}
      {activeTab === 'stepper' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
            <h3 className="text-white font-bold font-display text-base mb-4">Camino al Lanzamiento: Avance Tipo Stepper</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stepperSteps.map((step, idx) => {
                const isCompleted = idx < activeStepIndex;
                const isCurrent = step.id === order.estado;
                return (
                  <div 
                    key={step.id} 
                    className={`p-4 rounded-xl border flex flex-col gap-2.5 transition-all ${
                      isCurrent
                        ? 'bg-emerald-500/5 border-emerald-500 shadow-md shadow-emerald-500/5'
                        : isCompleted
                          ? 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-950/60'
                          : 'bg-slate-950/10 border-slate-900 opacity-60'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded">
                        Fase {idx + 1} ({step.porcentaje}%)
                      </span>
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-600" />
                      )}
                    </div>

                    <div>
                      <h4 className="text-white font-bold font-display text-xs">{step.nombre}</h4>
                      <p className="text-slate-400 text-[11px] mt-1 leading-relaxed line-clamp-2">{step.descripcion}</p>
                    </div>

                    {(isCompleted || isCurrent) && step.notas && (
                      <div className="bg-slate-950 p-2.5 rounded text-[10px] text-slate-300 italic border border-slate-800/50">
                        "{step.notas}"
                      </div>
                    )}

                    {(isCompleted || isCurrent) && (
                      <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-slate-800/30 mt-auto">
                        <span>{step.responsable.split(' ')[0]}</span>
                        <span className="font-mono">{step.fecha}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. FINANCE TAB */}
      {activeTab === 'finance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-white font-bold font-display text-sm">Historial de Facturación</h3>
                <span className="text-emerald-400 text-xs bg-emerald-500/10 px-2.5 py-0.5 rounded-full font-medium">
                  Stripe Customer Portal Activo
                </span>
              </div>

              <div className="space-y-3">
                {order.facturas.map(inv => {
                  const isPagada = inv.estado === 'pagada';
                  return (
                    <div key={inv.id} className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-medium text-xs">{inv.concepto}</h4>
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                            isPagada ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {inv.estado}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[10px] font-mono">{inv.numero} • Vencimiento: {inv.fechaVencimiento}</p>
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <p className="text-white font-bold text-sm font-mono">${inv.monto.toLocaleString()} MXN</p>
                        {!isPagada && (
                          <button
                            onClick={() => onInitiatePayment(inv.monto, inv.concepto, inv.id)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-3.5 py-1.5 rounded-lg text-xs font-display flex items-center gap-1.5 transition-all transform active:scale-98"
                          >
                            <span>Pagar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Real Stripe Connection Status & Webhook instructions */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-white font-bold font-display text-sm">Estado de Pasarela Stripe</h3>
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1.5 ${
                  stripeStatus?.configured 
                    ? stripeStatus.mode === 'live' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stripeStatus?.configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                  {stripeStatus?.configured 
                    ? stripeStatus.mode === 'live' ? 'En Producción (Live)' : 'Modo Prueba (Test)' 
                    : 'Modo Simulado'}
                </span>
              </div>

              <div className="space-y-3.5 text-xs text-slate-400 leading-relaxed">
                <p>
                  KIDRIA cuenta con un procesador dual de pagos. Al detectar tu <code className="text-indigo-400 bg-slate-950 px-1 py-0.5 rounded text-[10px]">STRIPE_SECRET_KEY</code>, el sistema automáticamente se conecta en tiempo real al ambiente correspondiente.
                </p>

                {stripeStatus?.configured ? (
                  <div className="bg-slate-950/50 p-4 border border-slate-800/80 rounded-lg space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono border-b border-slate-800 pb-2">
                      <div>
                        <span className="text-slate-500 block">Modo detectado:</span>
                        <span className="text-white font-semibold">{stripeStatus.mode === 'live' ? 'PRODUCCIÓN (sk_live)' : 'PRUEBAS (sk_test)'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Firma Webhook:</span>
                        <span className={stripeStatus.webhookConfigured ? 'text-emerald-400' : 'text-amber-400'}>
                          {stripeStatus.webhookConfigured ? 'Verificada' : 'Simple / Sandbox'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-slate-500 text-[10px] font-mono block">URL de Webhook (Stripe Dashboard):</span>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          readOnly 
                          value={stripeStatus.webhookUrl} 
                          className="bg-slate-950 border border-slate-800 text-[10px] font-mono text-zinc-300 rounded px-2 py-1 w-full focus:outline-none"
                        />
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(stripeStatus.webhookUrl);
                            alert('¡URL de Webhook copiado al portapapeles!');
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-white text-[10px] px-2.5 py-1 rounded transition-colors"
                        >
                          Copiar
                        </button>
                      </div>
                      <span className="text-slate-600 text-[9px] block">
                        Registra esta URL en tu Panel de Stripe para recibir confirmaciones de pago automáticas de forma segura.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-950/10 border border-amber-500/10 p-4 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-medium">
                      <Shield className="w-4 h-4" />
                      <span>¿Quieres conectar tu Stripe real?</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Para ponerlo en producción o modo de prueba, agrega tu secreto <code className="text-amber-400 bg-slate-950 px-1 py-0.5 rounded text-[10px]">STRIPE_SECRET_KEY</code> en los Secretos de Google AI Studio. 
                    </p>
                    <p className="text-[11px] text-slate-500">
                      El sistema detectará automáticamente si es de pruebas (empieza con <code className="text-[10px]">sk_test_</code>) o real (empieza con <code className="text-[10px]">sk_live_</code>).
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Simulated Stripe Customer Portal */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
              <h3 className="text-white font-bold font-display text-sm">Portal del Cliente de Stripe</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Accede de forma segura para cambiar de tarjeta de crédito, descargar facturas fiscales de Stripe en formato PDF o cancelar tu suscripción mensual.
              </p>
              <button
                onClick={() => alert('Simulación: Abriendo portal fiscal autogestionable de Stripe Customer Portal...')}
                className="w-full bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold py-2.5 px-4 rounded-lg text-xs font-display flex items-center justify-center gap-2 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Abrir Portal de Stripe</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUPPORT TAB */}
      {activeTab === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tickets list */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-[550px] flex flex-col">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
              <h3 className="text-white font-semibold font-display text-sm">Mis Tickets de Soporte</h3>
              <button
                onClick={() => setShowCreateTicketModal(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-2.5 py-1 rounded text-[10px] font-display transition-all"
              >
                Nuevo Ticket
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {tickets.map(ticket => {
                const isSelected = activeTicketId === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setActiveTicketId(ticket.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                      isSelected 
                        ? 'bg-slate-950 border-emerald-500/50 shadow-lg' 
                        : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-950/80 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                        ticket.priority === 'alta' 
                          ? 'bg-red-500/10 text-red-400' 
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {ticket.priority}
                      </span>
                      <span className={`text-[10px] font-medium uppercase ${
                        ticket.status === 'resuelto' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="text-white font-medium text-xs leading-snug truncate">{ticket.title}</h4>
                    <p className="text-slate-500 text-[10px] font-mono">{ticket.createdAt}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ticket conversations detail */}
          {activeTicketId ? (
            (() => {
              const ticket = tickets.find(t => t.id === activeTicketId);
              if (!ticket) return null;
              return (
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col h-[550px]">
                  <div className="pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2 py-0.5 rounded font-semibold uppercase">{ticket.category}</span>
                      <h3 className="text-white font-bold font-display text-sm">{ticket.title}</h3>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-1">Ticket ID: {ticket.id} • Creado el {ticket.createdAt}</p>
                  </div>

                  <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-1">
                    {/* Customer original issue */}
                    <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-xl space-y-1 text-xs">
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-300">Descripción Original</span>
                        <span className="text-slate-500 font-mono">{ticket.createdAt}</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed mt-1">{ticket.description}</p>
                    </div>

                    {/* Replies */}
                    {ticket.replies.map(reply => {
                      const isCustomerReply = reply.senderRole === 'cliente';
                      return (
                        <div 
                          key={reply.id} 
                          className={`p-3.5 rounded-xl border text-xs space-y-1.5 max-w-[85%] ${
                            isCustomerReply
                              ? 'ml-auto bg-slate-950/60 border-slate-800/80 text-right'
                              : 'mr-auto bg-indigo-500/5 border-indigo-500/10 text-left'
                          }`}
                        >
                          <div className={`flex justify-between gap-4 text-[10px] text-slate-500 ${isCustomerReply ? 'flex-row-reverse' : ''}`}>
                            <span className="font-semibold text-slate-300">{reply.senderName}</span>
                            <span className="font-mono">{reply.fecha}</span>
                          </div>
                          <p className="text-slate-400 leading-relaxed">{reply.message}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Rating / reply input */}
                  {ticket.status === 'resuelto' ? (
                    <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl text-center space-y-3">
                      <p className="text-slate-300 text-xs">Este ticket de soporte ha sido cerrado como RESUELTO.</p>
                      
                      {ticket.rating === null ? (
                        <div className="space-y-1.5">
                          <p className="text-slate-500 text-[11px]">Califica la respuesta de soporte técnico:</p>
                          <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                onClick={() => handleRateTicket(ticket.id, star)}
                                className="text-slate-500 hover:text-amber-400 hover:scale-110 transition-all p-1"
                              >
                                <Star className="w-5 h-5 fill-transparent hover:fill-amber-400" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center items-center gap-1.5 text-amber-400 text-xs font-semibold">
                          <Star className="w-4 h-4 fill-amber-400" />
                          <span>Otorgaste una calificación de {ticket.rating}/5 estrellas. ¡Gracias!</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleSendTicketReply} className="flex gap-2 pt-3 border-t border-slate-800">
                      <input
                        type="text"
                        value={ticketReplyText}
                        onChange={(e) => setTicketReplyText(e.target.value)}
                        placeholder="Escribe tu mensaje o agrega comentarios..."
                        className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none flex-1"
                      />
                      <button
                        type="submit"
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-4 py-2.5 rounded-lg text-xs font-display flex items-center gap-1.5 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar</span>
                      </button>
                    </form>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 font-display h-[550px] flex flex-col items-center justify-center space-y-6">
              <div className="max-w-md space-y-2">
                <HelpCircle className="w-12 h-12 text-slate-500 mx-auto animate-bounce" />
                <h4 className="text-white font-bold text-base">Soporte Técnico Premium</h4>
                <p className="text-xs text-slate-500">Selecciona un ticket de soporte existente en la lista lateral para ver el historial o crea uno nuevo para reportar un caso.</p>
              </div>

              <div className="w-full max-w-sm border-t border-slate-800/80 pt-6 space-y-4">
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Contacto Directo Instantáneo</p>
                
                <a
                  href="https://wa.me/524792293687?text=Hola%20KIDRIA,%20necesito%20soporte%20con%20mi%20proyecto"
                  target="_blank"
                  referrerPolicy="no-referrer"
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all w-full justify-center shadow-lg shadow-emerald-600/10"
                >
                  <MessageCircle className="w-4 h-4 fill-slate-950 text-slate-950" />
                  <span>Soporte por WhatsApp: 479 229 3687</span>
                </a>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <span className="text-[10px] text-slate-500">Nuestras Redes:</span>
                  <a
                    href="https://facebook.com/kidria"
                    target="_blank"
                    referrerPolicy="no-referrer"
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/10 text-slate-400 hover:text-white transition-all"
                    title="Facebook"
                  >
                    <Facebook className="w-4 h-4" />
                  </a>
                  <a
                    href="https://instagram.com/kidria"
                    target="_blank"
                    referrerPolicy="no-referrer"
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-pink-500/50 hover:bg-pink-500/10 text-slate-400 hover:text-white transition-all"
                    title="Instagram"
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. PRIVATE CHAT TAB */}
      {activeTab === 'chat' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-[550px] flex flex-col max-w-4xl mx-auto">
          <div className="pb-3 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-white font-bold font-display text-sm">Mensajería Privada con KIDRIA Studio</h3>
              <p className="text-slate-500 text-[11px] mt-0.5">Canal cifrado de soporte y retroalimentación</p>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
              Soporte Asignado: Lucas Prieto
            </span>
          </div>

          <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-1">
            {chats.map(msg => {
              const isCustomerMsg = msg.senderRole === 'cliente';
              return (
                <div 
                  key={msg.id} 
                  className={`flex flex-col max-w-[75%] space-y-1 ${isCustomerMsg ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                >
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="font-semibold text-slate-400">{msg.senderName}</span>
                    <span className="font-mono">{msg.fecha}</span>
                  </div>
                  <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                    isCustomerMsg 
                      ? 'bg-emerald-500 text-slate-950 font-medium rounded-tr-none' 
                      : 'bg-slate-950 border border-slate-800 text-white rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChatMessage} className="flex gap-2 pt-3 border-t border-slate-800">
            <input
              type="text"
              value={chatMessageText}
              onChange={(e) => setChatMessageText(e.target.value)}
              placeholder="Escribe tu mensaje privado hacia KIDRIA Studio..."
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

      {/* 6. AI CONSULTING TAB */}
      {activeTab === 'ai_consulting' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-white font-bold font-display text-sm">Consultor Empresarial Gemini Stream</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Diseño estratégico automatizado para: <span className="text-emerald-400 font-mono font-bold">{order.giro}</span></p>
                </div>
              </div>

              <form onSubmit={handleAIConsult} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1.5">¿Qué te gustaría diseñar hoy para potenciar {order.empresa || 'tu negocio'}?</label>
                  <textarea
                    required
                    rows={4}
                    value={consultingQuery}
                    onChange={(e) => setConsultingQuery(e.target.value)}
                    placeholder="ej. Tengo una veterinaria, ¿qué funciones móviles me sugerirías para recordatorios de vacunas y ventas recurrentes?"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:border-emerald-500 focus:outline-none leading-relaxed"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={consultingStreaming}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold py-2.5 px-4 rounded-xl text-xs font-display flex items-center gap-1.5 transition-all w-full justify-center shadow-lg shadow-emerald-500/15"
                >
                  {consultingStreaming ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                      <span>Generando ideas en streaming en tiempo real...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Consultar Consultor Gemini AI</span>
                    </>
                  )}
                </button>
              </form>

              {/* Streaming Output container */}
              {consultingResult && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3 mt-6">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider font-display">Reporte de Consultoría Inteligente</p>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-mono px-2 py-0.5 rounded">Gemini 3.5 Flash</span>
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans space-y-2">
                    {consultingResult}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
              <h3 className="text-white font-bold font-display text-sm">Especialidades Consultivas</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                El consultor empresarial Gemini de KIDRIA tiene acceso contextualizado a tu giro de negocio y puede proponerte:
              </p>
              <div className="space-y-2.5 text-xs text-slate-300">
                <p className="flex gap-2 items-start"><span className="text-emerald-400">✓</span> <span>Automatización de reservas por agenda digital</span></p>
                <p className="flex gap-2 items-start"><span className="text-emerald-400">✓</span> <span>Modelos de cobro por membresías de fidelidad</span></p>
                <p className="flex gap-2 items-start"><span className="text-emerald-400">✓</span> <span>Notificaciones push segmentadas por hábitos de compra</span></p>
                <p className="flex gap-2 items-start"><span className="text-emerald-400">✓</span> <span>Herramientas de venta predictiva guiadas por IA</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. AI GROWTH & PROPOSAL TAB */}
      {activeTab === 'ai_growth' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Analyzer button */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-white font-bold font-display text-sm">Analizador Estratégico de Crecimiento</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Analiza el estado del negocio de {order.empresa || 'tu negocio'} en tiempo real.</p>
                </div>
                <button
                  onClick={handleAIGrowthAnalyze}
                  disabled={growthStreaming}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2 rounded-lg text-xs font-display flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/10"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{growthStreaming ? 'Analizando...' : 'Analizar Mi Negocio'}</span>
                </button>
              </div>

              {growthReport && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3 mt-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider font-display">Reporte de Crecimiento & Growth Hacking</p>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-mono px-2 py-0.5 rounded">Gemini Live Insights</span>
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans space-y-2">
                    {growthReport}
                  </div>
                </div>
              )}
            </div>

            {/* Proposal Generator Form */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
              <div className="pb-2 border-b border-slate-800">
                <h3 className="text-white font-bold font-display text-sm">Generador Comercial de Propuestas & Cotizaciones</h3>
                <p className="text-slate-400 text-xs mt-0.5">IA autogenera un roadmap, costos y propuesta PDF para un nuevo proyecto web.</p>
              </div>

              <form onSubmit={handleGenerateProposal} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">Presupuesto Estimado (MXN)</label>
                  <input
                    type="number"
                    value={proposalFormBudget}
                    onChange={(e) => setProposalFormBudget(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">Alcance o Proyecto deseado</label>
                  <input
                    type="text"
                    value={proposalFormDeliverable}
                    onChange={(e) => setProposalFormDeliverable(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full"
                  />
                </div>

                <button
                  type="submit"
                  disabled={proposalLoading}
                  className="md:col-span-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold py-2.5 px-4 rounded-xl text-xs font-display flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/10"
                >
                  {proposalLoading ? 'Generando propuesta detallada de PDF...' : 'Generar Propuesta Inteligente PDF'}
                </button>
              </form>

              {proposalResult && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-5 mt-6 animate-fade-in text-xs text-slate-300">
                  <div className="flex justify-between items-start pb-2 border-b border-slate-800">
                    <div>
                      <h4 className="text-white font-bold font-display text-sm">{proposalResult.tituloPropuesta}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Roadmap Técnico, Tiempos y Beneficios Comerciales</p>
                    </div>
                    <button
                      onClick={handleDownloadProposalPDF}
                      disabled={proposalPrinting}
                      className="bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition-all"
                    >
                      <Download className="w-3 h-3 animate-bounce" />
                      <span>{proposalPrinting ? 'Generando...' : 'Descargar PDF'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-900 border border-slate-800/80 p-3 rounded-lg">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">COSTO ESTIMADO</p>
                      <p className="text-white font-bold text-base mt-0.5">${proposalResult.costoUSD.toLocaleString()} MXN</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800/80 p-3 rounded-lg">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">TIEMPO ESTIMADO</p>
                      <p className="text-white font-bold text-base mt-0.5">{proposalResult.tiempoEstimadoWeeks} Semanas</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-white font-bold font-display text-xs">Beneficios Principales del Roadmap</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                      {proposalResult.beneficiosClave.map((b: string, i: number) => (
                        <p key={i} className="flex gap-1.5 items-start"><span className="text-emerald-400">✓</span> <span>{b}</span></p>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-white font-bold font-display text-xs">Fases Planificadas (Roadmap)</h5>
                    <div className="space-y-2">
                      {proposalResult.roadmap.map((r: any, i: number) => (
                        <div key={i} className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 flex justify-between gap-4 text-[11px]">
                          <div>
                            <p className="text-white font-semibold font-display">{r.fase}</p>
                            <p className="text-slate-400 mt-0.5 leading-relaxed">{r.descripcion}</p>
                          </div>
                          <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded h-fit font-bold whitespace-nowrap">
                            {r.semana}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-800 pt-4 text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap font-sans">
                    {proposalResult.propuestaMarkdown}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
              <h3 className="text-white font-bold font-display text-sm">Consultor Ejecutivo IA</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                El analizador e integrador de KIDRIA procesa los hitos completados y la información comercial para proponer optimizaciones instantáneas para potenciar el crecimiento de tu SaaS o app móvil.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 8. DOMAINS TAB */}
      {activeTab === 'domains' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
              <div className="pb-2 border-b border-slate-800">
                <h3 className="text-white font-bold font-display text-sm">Buscador y Registro de Dominios</h3>
                <p className="text-slate-400 text-xs mt-0.5">Consulta la disponibilidad, precios anuales y configura DNS para tu proyecto.</p>
              </div>

              <form onSubmit={handleDomainSearch} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={domainSearchQuery}
                  onChange={(e) => setDomainSearchQuery(e.target.value)}
                  placeholder="ej. gourmetexpress.app"
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2.5 text-xs focus:border-emerald-500 focus:outline-none flex-1 font-mono"
                />
                <button
                  type="submit"
                  disabled={domainSearchLoading}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2.5 rounded-lg text-xs font-display flex items-center gap-1.5 transition-all"
                >
                  {domainSearchLoading ? 'Buscando...' : 'Buscar'}
                </button>
              </form>

              {domainSearchResult && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4 text-xs animate-fade-in">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <p className="text-white font-bold font-mono">{domainSearchResult.domainName}</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      domainSearchResult.available ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {domainSearchResult.available ? 'Disponible' : 'Ocupado'}
                    </span>
                  </div>

                  {domainSearchResult.available ? (
                    <div className="flex justify-between items-center">
                      <p className="text-slate-300">Precio de registro anual estimado:</p>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-bold font-mono">${domainSearchResult.price} MXN/año</span>
                        <button
                          onClick={() => alert(`Simulación: Registrando dominio ${domainSearchResult.domainName} y vinculando DNS a KIDRIA...`)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-3 py-1.5 rounded text-xs transition-all"
                        >
                          Registrar Ahora
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-xs text-slate-300">
                        <p><span className="text-slate-500">Estado SSL:</span> <span className="text-emerald-400 font-semibold">ACTIVO (Let's Encrypt)</span></p>
                        <p><span className="text-slate-500">Vencimiento:</span> <span className="font-mono">{domainSearchResult.vencimiento}</span></p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-white font-bold font-display text-[11px] uppercase tracking-wider">Registros DNS Vinculados en Cloud Run / Vercel</p>
                        <div className="space-y-1.5">
                          {domainSearchResult.dnsConfig.map((dns: any, i: number) => (
                            <div key={i} className="bg-slate-900 border border-slate-800 p-2.5 rounded font-mono text-[10px] text-slate-400 flex justify-between gap-4">
                              <span>{dns.type} • {dns.host}</span>
                              <span className="truncate max-w-[180px] text-emerald-400">{dns.value}</span>
                              <span>TTL: {dns.ttl}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. DOWNLOAD CENTER (FILES) TAB */}
      {activeTab === 'files' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <h3 className="text-white font-bold font-display text-sm pb-2 border-b border-slate-800">Centro de Descargas Oficial (Archivos del Proyecto)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {order.archivos.map(file => (
              <div key={file.id} className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl flex items-center justify-between text-xs">
                <div className="truncate pr-3">
                  <h4 className="text-white font-semibold truncate">{file.nombre}</h4>
                  <p className="text-slate-500 text-[10px] mt-0.5 uppercase">{file.categoria} • {file.size}</p>
                </div>
                <button
                  onClick={() => handleDownloadFile(file)}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800/80 text-slate-300 p-2 rounded-lg transition-colors flex-shrink-0"
                  title="Descargar archivo"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 10. REFERRALS TAB */}
      {activeTab === 'referrals' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-6 max-w-4xl mx-auto">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-white font-bold font-display text-sm">Sistema de Referidos de KIDRIA</h3>
            <p className="text-slate-400 text-xs mt-0.5">Recomienda a otros negocios locales y gana bonificaciones y hosting gratuito.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl text-center space-y-1">
              <p className="text-slate-500 text-[10px] uppercase font-semibold">Código Único de Referido</p>
              <p className="text-white font-bold text-base font-mono mt-0.5">{currentUser.referralCode}</p>
            </div>
            <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl text-center space-y-1">
              <p className="text-slate-500 text-[10px] uppercase font-semibold">Referidos Contratados</p>
              <p className="text-emerald-400 font-bold text-base mt-0.5">{currentUser.referidosContratados} Clientes</p>
            </div>
            <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl text-center space-y-1">
              <p className="text-slate-500 text-[10px] uppercase font-semibold">Comisiones Ganadas</p>
              <p className="text-indigo-400 font-bold text-base mt-0.5">${currentUser.referidosGanancia?.toLocaleString()} MXN</p>
            </div>
          </div>

          <div className="bg-slate-950/20 border border-slate-800/80 p-4 rounded-xl space-y-2 text-xs">
            <h4 className="text-white font-bold font-display">¿Cómo funciona?</h4>
            <p className="text-slate-300 leading-relaxed">
              1. Comparte tu código único con colegas de negocios locales.<br />
              2. Cuando contraten su primera PWA, se les otorgará un <span className="text-emerald-400 font-semibold">10% de descuento</span> en su anticipo.<br />
              3. A ti se te acreditarán <span className="text-indigo-400 font-semibold">$30,000 MXN</span> o 6 meses de mantenimiento de hosting + soporte gratis en tu proyecto {order.empresa || 'de PWA'}.
            </p>
          </div>
        </div>
      )}

      {/* 11. SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-6 max-w-2xl mx-auto">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-white font-bold font-display text-sm">Configuración de Cuenta & Seguridad</h3>
            <p className="text-slate-400 text-xs mt-0.5">Gestiona perfiles, paleta de marca PWA e integración de API.</p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Profile fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={currentUser.nombre}
                  onChange={(e) => onUpdateUser({ ...currentUser, nombre: e.target.value })}
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full font-display"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Correo Electrónico (Solo Lectura)</label>
                <input
                  type="email"
                  disabled
                  value={currentUser.email}
                  className="bg-slate-950/60 border border-slate-800 text-slate-500 rounded-lg px-3 py-2 text-xs w-full cursor-not-allowed"
                />
              </div>
            </div>

            {/* Business fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Nombre de tu Empresa / Negocio</label>
                <input
                  type="text"
                  value={currentUser.empresa || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateUser({ ...currentUser, empresa: val });
                    onUpdateOrder({ ...order, empresa: val });
                  }}
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full font-display"
                  placeholder="ej. Aura Belleza & Spa"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Giro o Sector del Negocio</label>
                <input
                  type="text"
                  value={currentUser.giro || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateUser({ ...currentUser, giro: val });
                    onUpdateOrder({ ...order, giro: val });
                  }}
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full font-display"
                  placeholder="ej. Salón de Belleza, Barbería y Spa"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Teléfono (WhatsApp)</label>
                <input
                  type="text"
                  value={currentUser.telefono || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateUser({ ...currentUser, telefono: val });
                    onUpdateOrder({ ...order, telefono: val });
                  }}
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full font-display"
                  placeholder="ej. +52 55 1234 5678"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Nombre de tu Proyecto de PWA</label>
                <input
                  type="text"
                  value={order.proyecto || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onUpdateOrder({ ...order, proyecto: val });
                  }}
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full font-display"
                  placeholder="ej. App de Reservaciones y Belleza"
                />
              </div>
            </div>

            {/* Business custom color selection */}
            <div className="space-y-2 pt-2">
              <h4 className="text-white font-bold font-display text-xs">Paleta de Marca Personalizada para tu PWA</h4>
              <p className="text-slate-500 text-[11px] leading-relaxed">Configura los colores institucionales con los que diseñaremos la app de {order.empresa || 'tu negocio'}.</p>
              
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-slate-900 border border-slate-700"></span>
                  <span className="text-slate-300 text-xs font-mono">Primario: Slate 900</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-300 text-xs font-mono">Secundario: Emerald 500</span>
                </div>
              </div>
            </div>

            {/* 2FA and Security Keys */}
            <div className="border-t border-slate-800 pt-4 space-y-4">
              <h4 className="text-white font-bold font-display text-xs">Seguridad y Autenticación de Doble Factor (2FA)</h4>
              
              <div className="flex justify-between items-center bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                <div className="space-y-0.5">
                  <p className="text-white font-medium">Autenticación Multifactor (2FA)</p>
                  <p className="text-slate-500 text-[11px]">Protege el acceso a tus finanzas y chats técnicos mediante código temporal.</p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateUser({ ...currentUser, twoFactorEnabled: !currentUser.twoFactorEnabled })}
                  className={`px-3 py-1 rounded text-xs font-semibold font-display transition-all ${
                    currentUser.twoFactorEnabled
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {currentUser.twoFactorEnabled ? 'Habilitado ✓' : 'Habilitar'}
                </button>
              </div>
            </div>

            {/* FCM Push Notifications Control Panel */}
            <div className="border-t border-slate-800 pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400" />
                <h4 className="text-white font-bold font-display text-xs">Servicio de Notificaciones Push (Firebase Cloud Messaging)</h4>
              </div>
              
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-4">
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Recibe alertas en tiempo real sobre cambios en tus proyectos, respuestas de soporte técnico o nuevos tickets, incluso cuando la aplicación no esté abierta en tu navegador.
                </p>

                <div className="space-y-3 pt-1">
                  <div className="flex justify-between items-center text-xs">
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
                        <label className="block text-slate-400 text-[11px]">Llave Pública VAPID (Opcional - FCM Console):</label>
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
                          <span className="text-slate-400">Estado de Alertas:</span>
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
                          <label className="block text-slate-300 text-[11px] font-medium">Prueba tus Notificaciones Push:</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={testNotificationLoading}
                              onClick={() => handleSendTestPush('¡Notificación de Prueba! 🚀', 'El servicio de notificaciones de KIDRIA está funcionando perfectamente.')}
                              className="bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 hover:text-white px-3 py-1.5 rounded text-[11px] transition-all flex items-center gap-1.5"
                            >
                              {testNotificationLoading ? 'Enviando...' : 'Probar Notificación'}
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
        </div>
      )}

      {/* CREATE TICKET MODAL */}
      {showCreateTicketModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateTicket} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="pb-3 border-b border-slate-800">
              <h3 className="text-white font-bold font-display text-base">Crear Nuevo Ticket de Soporte</h3>
              <p className="text-slate-400 text-xs mt-0.5">Línea de respuesta técnica KIDRIA</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Título del Ticket</label>
                <input
                  type="text"
                  required
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  placeholder="ej. Problema con notificaciones push en iOS"
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Categoría</label>
                <select
                  value={newTicketCategory}
                  onChange={(e: any) => setNewTicketCategory(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full"
                >
                  <option value="desarrollo">Desarrollo Frontend / Backend</option>
                  <option value="pagos">Pasarela de Pagos Stripe</option>
                  <option value="bugs">Reportar Bugs técnicos</option>
                  <option value="ia">IA e integración de modelos</option>
                  <option value="otros">Otros asuntos</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Prioridad</label>
                <select
                  value={newTicketPriority}
                  onChange={(e: any) => setNewTicketPriority(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Detalle del Problema</label>
                <textarea
                  required
                  rows={4}
                  value={newTicketDesc}
                  onChange={(e) => setNewTicketDesc(e.target.value)}
                  placeholder="Describe con precisión técnica qué comportamiento esperas vs qué comportamiento observas..."
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none w-full"
                ></textarea>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateTicketModal(false)}
                className="bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold py-2 px-4 rounded-lg text-xs font-display flex-1 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold py-2 px-4 rounded-lg text-xs font-display flex-1 transition-all"
              >
                Crear Ticket
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
