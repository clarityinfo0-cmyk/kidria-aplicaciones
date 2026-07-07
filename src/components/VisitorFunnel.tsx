import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { pdf } from '@react-pdf/renderer';
import { ProposalPDF } from './ProposalPDF';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Calendar, Users, ShoppingBag, CreditCard, Shield, 
  Activity, FileText, Bot, Wrench, Bell, ArrowRight, Download, 
  Smartphone, CheckCircle2, AlertTriangle, X, ShieldAlert,
  ChevronRight, Lock, Check, HelpCircle, RotateCcw, Landmark, Clock, RefreshCw, Star, ArrowLeft,
  Coins, TrendingUp, CheckCircle, Home, Mail, User, Phone, Eye, EyeOff, Building2
} from 'lucide-react';
import { ProjectOrder, SupportTicket, ChatMessage, UserProfile, StepperStep, PaymentSettings } from '../types';
import { auth, db } from '../lib/firebase';
import { signInWithCustomToken } from 'firebase/auth';

// Map icon string returned by Gemini or Fallback to a Lucide Icon
const iconMap: Record<string, any> = {
  Calendar,
  Users,
  ShoppingBag,
  CreditCard,
  Shield,
  Activity,
  FileText,
  Bot,
  Wrench,
  Bell,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Star,
  Clock,
  TrendingUp,
  CheckCircle,
  Home
};

function renderLucideIcon(iconName: string, className = "w-5 h-5") {
  // normalize casing
  const normalized = Object.keys(iconMap).find(
    k => k.toLowerCase() === iconName.toLowerCase()
  );
  const IconComponent = normalized ? iconMap[normalized] : Bot;
  return <IconComponent className={className} />;
}

interface VisitorFunnelProps {
  onSuccessProvisioning: (newClient: UserProfile, newOrder: ProjectOrder) => void;
  onInitiatePayment: (amount: number, concept: string, orderId: string, isSub?: boolean) => void;
  stripeOverlayActive: boolean;
  currentUser?: UserProfile | null;
  paymentSettings: PaymentSettings;
}

export default function VisitorFunnel({ onSuccessProvisioning, onInitiatePayment, stripeOverlayActive, currentUser, paymentSettings }: VisitorFunnelProps) {
  const [step, setStep] = useState<'hero' | 'loading' | 'results' | 'proposal_mockup' | 'declined'>('hero');
  const [businessInput, setBusinessInput] = useState('');
  const [customBusinessName, setCustomBusinessName] = useState('');
  const [loadingStage, setLoadingStage] = useState('Analizando mercado...');
  const [loadingProgress, setLoadingProgress] = useState(10);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [showNothingPrognosis, setShowNothingPrognosis] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAllNiches, setShowAllNiches] = useState(false);
  
  // Commercial Flow State
  const [selectedPlan, setSelectedPlan] = useState<'Starter' | 'Business' | 'PremiumIA' | 'Enterprise'>('Business');
  const [paymentMethod, setPaymentMethod] = useState<'deposito' | 'mercadopago' | 'transferencia' | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningProgress, setProvisioningProgress] = useState(0);
  const [provisioningStage, setProvisioningStage] = useState('');

  // Interactive Project Calculator & Queue States
  const [selectedModules, setSelectedModules] = useState<{ [key: string]: boolean }>({
    agenda: true,
    inventario: false,
    stripe: true,
    ia: false,
    multiusuarios: false,
    dashboard: true,
    reportes: false,
    api: false,
    publicacion: true
  });

  const [activeProjects, setActiveProjects] = useState([
    { id: 'p1', name: 'Restaurante El Sazón PWA', progress: 75, status: 'desarrollo', daysRemaining: 8 },
    { id: 'p2', name: 'Taller Mecánico Solís PWA', progress: 40, status: 'desarrollo', daysRemaining: 15 },
    { id: 'p3', name: 'Boutique Bella PWA', progress: 15, status: 'espera', daysRemaining: 32 }
  ]);

  const [agreedMonthly, setAgreedMonthly] = useState(false);
  const [agreedExclusions, setAgreedExclusions] = useState(false);
  const [agreedWarranty, setAgreedWarranty] = useState(false);

  // Interactive Mockup State
  const [mockupTab, setMockupTab] = useState<string>('home');
  const [mockCitas, setMockCitas] = useState<{ id: string; cliente: string; hora: string; servicio: string }[]>([
    { id: '1', cliente: 'Roberto Gómez', hora: '11:00', servicio: 'Servicio Básico' },
    { id: '2', cliente: 'Camila Torres', hora: '14:30', servicio: 'Especial' }
  ]);
  const [newCitaClient, setNewCitaClient] = useState('');
  const [newCitaTime, setNewCitaTime] = useState('16:00');
  const [newCitaServ, setNewCitaServ] = useState('');
  const [mockupLogs, setMockupLogs] = useState<string[]>(['Sistema listo', 'Sincronización en la nube OK']);
  const [mockupNotification, setMockupNotification] = useState<string | null>(null);

  // User Registration & Security identification states for checkout
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBusiness, setRegBusiness] = useState('');
  const [isRegLoading, setIsRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<'deposito' | 'mercadopago' | 'transferencia' | null>(null);
  const [registeredClientData, setRegisteredClientData] = useState<{
    uid: string;
    email: string;
    nombre: string;
    empresa: string;
    telefono: string;
    passwordHash?: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // New High-Fidelity Interactive Mockup States
  const [mockFormValues, setMockFormValues] = useState<{[key: string]: string}>({});
  const [customRecords, setCustomRecords] = useState<{ id: string; title: string; subtitle: string; badge: string }[]>([]);
  const [customTrackerStep, setCustomTrackerStep] = useState<number>(1);
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'bot'; text: string }[]>([]);
  const [chatIsTyping, setChatIsTyping] = useState<boolean>(false);

  // KIDRIA Continuous Learning Memory States
  const [pastInvestigations, setPastInvestigations] = useState<any[]>([]);
  const [isLoadingPast, setIsLoadingPast] = useState(false);

  const fetchPastInvestigations = async () => {
    setIsLoadingPast(true);
    try {
      const res = await fetch('/api/gemini/previous-investigations');
      if (res.ok) {
        const data = await res.json();
        setPastInvestigations(data);
      }
    } catch (err) {
      console.error('Error fetching past investigations:', err);
    } finally {
      setIsLoadingPast(false);
    }
  };

  useEffect(() => {
    if (step === 'hero') {
      fetchPastInvestigations();
    }
  }, [step]);

  const defaultMockupTabs = [
    {
      id: "home",
      label: "Inicio",
      icon: "Home",
      type: "dashboard",
      content: {
        welcomeTitle: "¡Hola, Cliente!",
        welcomeSubtitle: `Sincronización de ${customBusinessName}`,
        cards: [
          { title: "Control de Citas", value: "Pendiente", icon: "Calendar", desc: "Digitaliza tu agenda" },
          { title: "Historial de Clientes", value: "Activo", icon: "Users", desc: "Registra preferencias" },
          { title: "Pasarela Stripe", value: "0% comisiones", icon: "CreditCard", desc: "Recibe cobros" },
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
        successNotification: "¡Registro completado! Hemos enviado la liga de confirmación por WhatsApp.",
        formFields: [
          { name: "cliente", label: "Tu Nombre Completo", type: "text", placeholder: "Ej. Elena Rodríguez" },
          { name: "servicio", label: "Servicio Requerido", type: "select", options: ["Asesoría de Negocios", "Atención al Cliente", "Soporte Técnico"] },
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
          { id: "h1", title: "Elena Rodríguez", subtitle: "Servicio Básico", badge: "11:00" },
          { id: "h2", title: "Roberto Gómez", subtitle: "Atención Técnica", badge: "14:30" }
        ]
      }
    },
    {
      id: "soporte",
      label: "Asistente",
      icon: "Bot",
      type: "chat",
      content: {
        chatTitle: "Consultor de IA",
        botName: "Asistente IA",
        welcomeMessage: `¡Hola! Bienvenido al asistente virtual de ${customBusinessName}. ¿En qué te puedo ayudar hoy?`,
        predefinedResponses: [
          { userMessage: "servicios", botReply: "Ofrecemos soluciones de automatización de agendas, pagos y CRM." },
          { userMessage: "pago", botReply: "Aceptamos cobros seguros con Stripe y Mercado Pago." }
        ]
      }
    }
  ];

  // Master database of business niches with categories and expert specifications
  const businessCategories = [
    { id: 'all', name: 'Todos los giros 🌐' },
    { id: 'salud', name: 'Salud y Bienestar 🏥' },
    { id: 'servicios', name: 'Servicios y Oficios 🛠️' },
    { id: 'gastronomia', name: 'Gastronomía 🍔' },
    { id: 'comercio', name: 'Comercio y Retail 🛍️' },
    { id: 'inmobiliaria', name: 'Inmobiliaria y Alojamiento 🏠' },
    { id: 'automotriz', name: 'Automotriz y Transporte 🚗' }
  ];

  const allBusinessNiches = [
    // Salud y Bienestar
    { label: 'Veterinaria 🐾', text: 'Tengo una clínica veterinaria de mascotas y estética canina', category: 'salud', desc: 'Control de vacunas, expedientes clínicos de mascotas y agendamiento de estética.' },
    { label: 'Dentista / Odontología 🩺', text: 'Tengo un consultorio dental de ortodoncia, limpiezas y prótesis', category: 'salud', desc: 'Recordatorios de citas automáticos por WhatsApp y control de expedientes clínicos.' },
    { label: 'Gimnasio / CrossFit 💪', text: 'Tengo un gimnasio de entrenamiento funcional, pesas y crossfit', category: 'salud', desc: 'Suscripciones y membresías mensuales, agendamiento de clases y control de accesos.' },
    { label: 'Estética / Barbería ✂️', text: 'Tengo un salón de belleza, barbería y tratamientos de spa', category: 'salud', desc: 'Reservación de estilistas, turnos en línea y catálogo de productos de belleza.' },
    { label: 'Psicología / Terapia 🧠', text: 'Tengo un consultorio de terapia psicológica individual y familiar', category: 'salud', desc: 'Agenda de sesiones semanales, cobro de honorarios y expedientes protegidos.' },
    { label: 'Nutrición / Dietas 🍎', text: 'Tengo un consultorio de nutrición, consulta clínica y planes de dieta', category: 'salud', desc: 'Agendamiento, seguimiento de metas corporales y envío de dietas digitales.' },
    { label: 'Fisioterapia 🏃', text: 'Tengo un centro de fisioterapia y rehabilitación física deportiva', category: 'salud', desc: 'Control de paquetes de sesiones, asignación de terapeutas y agendas integradas.' },
    { label: 'Spa y Masajes 💆', text: 'Tengo un centro de spa, masajes terapéuticos y masoterapia', category: 'salud', desc: 'Apartado de cabinas y terapeutas, tarjetas de regalo y venta de aceites.' },

    // Servicios y Oficios
    { label: 'Taller Mecánico 🛠️', text: 'Tengo un taller mecánico automotriz multimarca de reparación', category: 'servicios', desc: 'Estatus de reparaciones del vehículo en tiempo real y cotización de refacciones.' },
    { label: 'Despacho Contable ⚖️', text: 'Tengo un despacho de contadores públicos y consultores fiscales', category: 'servicios', desc: 'Envío de estados de cuenta, recepción de facturas e impuestos programados.' },
    { label: 'Escuela / Cursos 🎓', text: 'Tengo una escuela de idiomas, regularización y cursos de capacitación', category: 'servicios', desc: 'Inscripción de estudiantes, cobro recurrente de colegiaturas y clases grabadas.' },
    { label: 'Agencia de Software 💻', text: 'Tengo una agencia de desarrollo de software, diseño y marketing digital', category: 'servicios', desc: 'Aprobación de propuestas, cotizador inteligente interactivo e integraciones.' },
    { label: 'Estudio de Fotografía 📸', text: 'Tengo un estudio de fotografía profesional y vídeo para eventos', category: 'servicios', desc: 'Galería de fotos digitales para clientes, reserva de fechas y anticipos.' },
    { label: 'Plomería / Electricidad / AC ⚡', text: 'Tengo una empresa de plomería, servicios eléctricos y aire acondicionado', category: 'servicios', desc: 'Despacho de técnicos a domicilio con geolocalización y órdenes de trabajo.' },
    { label: 'Consultoría de Negocios 📊', text: 'Tengo una firma de consultoría y coaching ejecutivo o mentorías', category: 'servicios', desc: 'Diagnóstico en línea, sesiones de coaching automatizadas y materiales PDF.' },
    { label: 'Reparación de Celulares 📱', text: 'Tengo un taller de reparación técnica de celulares y computadoras', category: 'servicios', desc: 'Control de órdenes de servicio, rastreo de equipo con ID de cliente.' },

    // Gastronomía y Alimentos
    { label: 'Restaurante / Bar 🍔', text: 'Tengo un restaurante familiar de comida mexicana, snacks y bar', category: 'gastronomia', desc: 'Menú digital QR con pedidos directos, reservación de mesas y comandero.' },
    { label: 'Cafetería de Especialidad ☕', text: 'Tengo una cafetería de especialidad y postres artesanales', category: 'gastronomia', desc: 'Pedidos exprés para llevar en línea, monedero digital y combos.' },
    { label: 'Pastelería sobre Pedido 🍰', text: 'Tengo una pastelería fina, cupcakes y repostería personalizada', category: 'gastronomia', desc: 'Cotización inteligente de pasteles para eventos y agendas de entrega.' },
    { label: 'Dark Kitchen 🛵', text: 'Tengo una cocina oculta de hamburguesas, alitas y sushi a domicilio', category: 'gastronomia', desc: 'Canal de ventas propio por WhatsApp sin comisiones abusivas de Uber o Rappi.' },
    { label: 'Catering y Banquetes 🍽️', text: 'Tengo una empresa de banquetes y organización de catering para eventos', category: 'gastronomia', desc: 'Estructuración de menús interactivos, presupuestos y reservación de fechas.' },
    { label: 'Pizzería Artesanal 🍕', text: 'Tengo una pizzería a la leña con reparto a domicilio y restaurante', category: 'gastronomia', desc: 'Armador de pizzas personalizado con ingredientes adicionales en el menú.' },

    // Comercio y Retail
    { label: 'Boutique de Ropa 👗', text: 'Tengo una tienda de ropa de moda, calzado y accesorios de vestir', category: 'comercio', desc: 'E-commerce integrado con catálogo de tallas, colores y pasarelas de pago.' },
    { label: 'Papelería / Imprenta 📚', text: 'Tengo una papelería escolar, oficina y centro de copiado digital', category: 'comercio', desc: 'Carga de archivos PDF para impresión exprés y cotizador de mayoreo.' },
    { label: 'Ferretería 🔨', text: 'Tengo una ferretería de herramientas, pintura y conexiones de plomería', category: 'comercio', desc: 'Buscador de refacciones, inventario sincronizado y cotización al momento.' },
    { label: 'Florería 🌸', text: 'Tengo una florería de arreglos de diseño y regalos con entrega', category: 'comercio', desc: 'Suscripción de flores semanal/mensual, dedicatoria digital y entregas.' },
    { label: 'Joyería y Relojes 💎', text: 'Tengo una joyería de plata, oro y taller de grabado personalizado', category: 'comercio', desc: 'Visualizador de joyas en alta definición, certificados y pagos con tarjeta.' },
    { label: 'Juguetería / Coleccionables 🧸', text: 'Tengo una tienda de juguetes, figuras y juegos de mesa coleccionables', category: 'comercio', desc: 'Preventas, apartados automáticos y envíos nacionales rastreables.' },
    { label: 'Tienda de Mascotas 🐶', text: 'Tengo una tienda de alimento premium y accesorios para mascotas', category: 'comercio', desc: 'Planes recurrentes de alimento de mascotas y entregas calendarizadas.' },
    { label: 'Óptica y Lentes 👓', text: 'Tengo una óptica de lentes de sol, graduados y exámenes oftalmológicos', category: 'comercio', desc: 'Agendamiento de exámenes de vista y registro del historial clínico óptico.' },

    // Inmobiliaria y Alojamiento
    { label: 'Agencia Inmobiliaria 🏠', text: 'Tengo una agencia de bienes raíces y corretaje de propiedades', category: 'inmobiliaria', desc: 'Catálogo de propiedades inmobiliarias con filtros de precio y mapa.' },
    { label: 'Airbnb / Hotel Boutique 🛌', text: 'Tengo un conjunto de departamentos vacacionales y hotel boutique', category: 'inmobiliaria', desc: 'Motor de reservas directas para ahorrar el 15% de comisión de Airbnb o Booking.' },
    { label: 'Salón para Eventos 🎉', text: 'Tengo un salón de fiestas infantiles y renta de mobiliario', category: 'inmobiliaria', desc: 'Calendario de disponibilidad, cotización de paquetes y extras de comida.' },
    { label: 'Coworking / Oficinas 🏢', text: 'Tengo un espacio de coworking, oficinas privadas y salas de juntas', category: 'inmobiliaria', desc: 'Reserva automática de salas de juntas por hora y pases diarios coworking.' },

    // Automotriz y Transporte
    { label: 'Autolavado / Car Wash 🧼', text: 'Tengo un autolavado ecológico y centro de detallado automotriz', category: 'automotriz', desc: 'Turnos express con notificaciones automáticas y membresía ilimitada de lavado.' },
    { label: 'Renta de Autos / Chofer 🚘', text: 'Tengo un negocio de renta de vehículos y traslados ejecutivos', category: 'automotriz', desc: 'Carga de licencias de conducir e INE y firma de contratos digitales.' },
    { label: 'Escuela de Manejo 🚙', text: 'Tengo una escuela de manejo vial, clases prácticas y teóricas', category: 'automotriz', desc: 'Calendario de instructores de manejo, coches disponibles y paquetes.' },
    { label: 'Grúas y Auxilio Vial 🚛', text: 'Tengo un servicio de grúas de arrastre y asistencia en carretera', category: 'automotriz', desc: 'Solicitud de auxilio vial inmediato compartiendo geolocalización por móvil.' }
  ];

  // Progressive loading text sequence
  useEffect(() => {
    if (step !== 'loading') return;

    const stages = [
      { text: 'Iniciando agente de investigación IA...', progress: 15 },
      { text: 'Analizando problemas y flujos operativos tradicionales...', progress: 30 },
      { text: 'Evaluando nivel de digitalización de la competencia...', progress: 45 },
      { text: 'Diseñando arquitectura de base de datos óptima...', progress: 60 },
      { text: 'Estructurando módulos interactivos y propuesta comercial...', progress: 75 },
      { text: 'Generando mockup visual y paleta de colores personalizada...', progress: 90 },
      { text: 'Compilando reporte ejecutivo definitivo...', progress: 98 }
    ];

    let currentStageIndex = 0;
    const interval = setInterval(() => {
      if (currentStageIndex < stages.length) {
        setLoadingStage(stages[currentStageIndex].text);
        setLoadingProgress(stages[currentStageIndex].progress);
        currentStageIndex++;
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [step]);

  // Sync selected modules dynamically when AI analysis finishes
  useEffect(() => {
    if (analysisData) {
      const initial: { [key: string]: boolean } = {
        agenda: !!analysisData.recommendedFeatures?.some((f: string) => f.toLowerCase().includes('agenda') || f.toLowerCase().includes('cita') || f.toLowerCase().includes('reserv')),
        inventario: !!analysisData.recommendedFeatures?.some((f: string) => f.toLowerCase().includes('invent') || f.toLowerCase().includes('stock') || f.toLowerCase().includes('catálogo')),
        stripe: !!analysisData.recommendedFeatures?.some((f: string) => f.toLowerCase().includes('pago') || f.toLowerCase().includes('stripe') || f.toLowerCase().includes('tarjeta')),
        ia: !!analysisData.recommendedFeatures?.some((f: string) => f.toLowerCase().includes('ia') || f.toLowerCase().includes('inteligencia') || f.toLowerCase().includes('gemini') || f.toLowerCase().includes('asistente')),
        multiusuarios: !!analysisData.recommendedFeatures?.some((f: string) => f.toLowerCase().includes('usuario') || f.toLowerCase().includes('rol') || f.toLowerCase().includes('permiso')),
        dashboard: true,
        reportes: !!analysisData.recommendedFeatures?.some((f: string) => f.toLowerCase().includes('report') || f.toLowerCase().includes('grafic') || f.toLowerCase().includes('estadistic')),
        api: !!analysisData.recommendedFeatures?.some((f: string) => f.toLowerCase().includes('api') || f.toLowerCase().includes('integrac') || f.toLowerCase().includes('whatsapp') || f.toLowerCase().includes('notific')),
        publicacion: true
      };
      setSelectedModules(initial);

      // Initialize dynamic mockup tab to first tab if present
      if (analysisData.mockup?.tabs && analysisData.mockup.tabs.length > 0) {
        setMockupTab(analysisData.mockup.tabs[0].id);
      } else {
        setMockupTab('home');
      }

      // Initialize custom chat messages
      const chatTab = analysisData.mockup?.tabs?.find((t: any) => t.type === 'chat');
      if (chatTab?.content) {
        setChatMessages([
          { sender: 'bot', text: chatTab.content.welcomeMessage || '¡Hola! ¿En qué te puedo ayudar hoy?' }
        ]);
      } else {
        setChatMessages([
          { sender: 'bot', text: '¡Hola! Bienvenido al asistente virtual. ¿En qué puedo apoyarte hoy?' }
        ]);
      }

      // Initialize custom records list
      const recordsTab = analysisData.mockup?.tabs?.find((t: any) => t.type === 'records');
      if (recordsTab?.content?.initialRecords) {
        setCustomRecords(recordsTab.content.initialRecords);
      } else {
        setCustomRecords([
          { id: '1', title: 'Elena Rodríguez', subtitle: 'Servicio Básico', badge: '11:00' },
          { id: '2', title: 'Roberto Gómez', subtitle: 'Atención Técnica', badge: '14:30' }
        ]);
      }

      // Reset tracker and form values
      const trackerTab = analysisData.mockup?.tabs?.find((t: any) => t.type === 'tracker');
      if (trackerTab?.content?.currentStepIndex !== undefined) {
        setCustomTrackerStep(trackerTab.content.currentStepIndex);
      } else {
        setCustomTrackerStep(1);
      }
      setMockFormValues({});
    }
  }, [analysisData]);

  // Handle business analysis submission
  const handleStartAnalysis = async (inputText: string) => {
    if (!inputText.trim()) return;
    setBusinessInput(inputText);
    // Suggest a default brand name
    const cleanWord = inputText.replace(/tengo una|tengo un|mi negocio es|una|un/gi, '').trim();
    const capitalized = cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1);
    setCustomBusinessName(capitalized ? `SaaS ${capitalized}` : 'Mi Negocio Digital');
    
    setStep('loading');
    setLoadingProgress(10);
    setLoadingStage('Conectando con el Consultor de Negocios de KIDRIA...');

    try {
      const response = await fetch('/api/gemini/analyze-visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessType: inputText })
      });
      const data = await response.json();
      setAnalysisData(data);
      
      // Update custom business name if generated by Gemini
      if (data.mockup?.title) {
        setCustomBusinessName(data.mockup.title);
      }

      // Prepopulate default booking services based on business
      if (data.businessType.toLowerCase().includes('veterinaria')) {
        setNewCitaServ('Consulta Médica');
        setMockCitas([
          { id: '1', cliente: 'Roberto Gómez (Milo 🐶)', hora: '11:00', servicio: 'Consulta y Vacuna' },
          { id: '2', cliente: 'Camila Torres (Luna 🐱)', hora: '14:30', servicio: 'Baño y Estética' }
        ]);
      } else if (data.businessType.toLowerCase().includes('taller')) {
        setNewCitaServ('Afinación Mayor');
        setMockCitas([
          { id: '1', cliente: 'Roberto Gómez (Mazda 3)', hora: '11:00', servicio: 'Cambio de Aceite' },
          { id: '2', cliente: 'Camila Torres (Honda CR-V)', hora: '14:30', servicio: 'Ajuste de Frenos' }
        ]);
      } else {
        setNewCitaServ('Impresión a Color');
        setMockCitas([
          { id: '1', cliente: 'Roberto Gómez', hora: '11:00', servicio: 'Engargolado' },
          { id: '2', cliente: 'Camila Torres', hora: '14:30', servicio: 'Paquete Escolar' }
        ]);
      }

      setStep('results');
    } catch (error) {
      console.error('Error analyzing business:', error);
      setStep('hero');
    }
  };

  // Add simulated Booking appointment
  const handleAddMockCita = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCitaClient.trim()) return;

    const appointment = {
      id: Date.now().toString(),
      cliente: newCitaClient,
      hora: newCitaTime,
      servicio: newCitaServ || 'Servicio Express'
    };

    setMockCitas([...mockCitas, appointment]);
    setMockupLogs([`Cita agendada: ${newCitaClient} - ${appointment.servicio} (${newCitaTime} hrs)`, ...mockupLogs]);
    
    // Alert Notification in the smartphone screen
    setMockupNotification(`🔔 WhatsApp Alerta: Se envió confirmación de cita a ${newCitaClient}.`);
    setTimeout(() => setMockupNotification(null), 6000);

    setNewCitaClient('');
  };

  // Handle Chatbot interactive responses
  const handleSelectChatOption = (userMessage: string, botReply: string) => {
    if (chatIsTyping) return;
    
    // Add User Message
    setChatMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setChatIsTyping(true);
    setMockupLogs(prev => [`Chatbot [Usuario]: "${userMessage}"`, ...prev]);

    setTimeout(() => {
      setChatIsTyping(false);
      // Add Bot Message
      setChatMessages(prev => [...prev, { sender: 'bot', text: botReply }]);
      setMockupLogs(prev => [`Chatbot [Respuesta]: "${botReply.substring(0, 40)}..."`, ...prev]);
      setMockupNotification(`💬 Bot: Respuesta inteligente enviada.`);
      setTimeout(() => setMockupNotification(null), 4000);
    }, 800);
  };

  // Handle Dynamic Forms submission in high-fidelity preview
  const handleMockFormSubmit = (e: React.FormEvent, tabId: string, content: any) => {
    e.preventDefault();
    const title = content.formTitle || "Registro";
    const notification = content.successNotification || "¡Guardado con éxito!";
    
    // Create custom record title & subtitle from form fields
    const nameField = content.formFields?.find((f: any) => f.name === 'cliente' || f.name === 'nombre' || f.type === 'text');
    const serviceField = content.formFields?.find((f: any) => f.name === 'servicio' || f.name === 'giro' || f.type === 'select');
    
    const clientName = mockFormValues[`${tabId}_${nameField?.name || 'cliente'}`] || 'Cliente Nuevo';
    const selectedService = mockFormValues[`${tabId}_${serviceField?.name || 'servicio'}`] || 'Servicio General';
    const randomTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Update Simulated Logs
    setMockupLogs(prev => [
      `Formulario "${title}" enviado por ${clientName}`,
      ...prev
    ]);

    // Push new record to the "records" tab in high fidelity
    const newRecord = {
      id: Date.now().toString(),
      title: clientName,
      subtitle: selectedService,
      badge: randomTime
    };
    setCustomRecords(prev => [newRecord, ...prev]);

    // Send WhatsApp Push Notification
    setMockupNotification(`🔔 WhatsApp Alerta: ${notification}`);
    setTimeout(() => setMockupNotification(null), 5000);

    // Reset inputs for this tab
    const cleared = { ...mockFormValues };
    content.formFields?.forEach((f: any) => {
      delete cleared[`${tabId}_${f.name}`];
    });
    setMockFormValues(cleared);
  };

  // Handle catalog purchases
  const handleMockCatalogPurchase = (itemName: string, itemPrice: number, emoji: string) => {
    setMockupLogs(prev => [
      `Servicio/Producto seleccionado: ${itemName} ($${itemPrice} MXN)`,
      ...prev
    ]);
    setMockupNotification(`🛒 Carrito: Se agregó "${itemName}" (${emoji}) por $${itemPrice} MXN.`);
    setTimeout(() => setMockupNotification(null), 4000);
  };

  // Handle active progress step tracking increment
  const handleAdvanceTrackerStep = (steps: string[]) => {
    const nextStep = (customTrackerStep + 1) % steps.length;
    setCustomTrackerStep(nextStep);
    setMockupLogs(prev => [
      `Estado actualizado: "${steps[nextStep]}"`,
      ...prev
    ]);
    setMockupNotification(`🔄 Notificación de Estado: Tu proceso cambió a "${steps[nextStep]}".`);
    setTimeout(() => setMockupNotification(null), 4000);
  };

  // Professional Vector PDF Proposal Generator using @react-pdf/renderer (Prevents spacing/alignment bugs completely!)
  const [proposalPrinting, setProposalPrinting] = useState<Record<string, boolean>>({});

  const handlePrintProposal = async (type: 'comercial' | 'tecnica') => {
    if (!analysisData) return;
    setProposalPrinting(prev => ({ ...prev, [type]: true }));

    try {
      const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
      const folioStr = `VX-${type === 'comercial' ? 'COM' : 'TECH'}-${Date.now().toString().slice(-6)}`;
      const docTitle = type === 'comercial' 
        ? `Propuesta_Comercial_${customBusinessName.replace(/\s+/g, '_')}`
        : `Propuesta_Tecnica_${customBusinessName.replace(/\s+/g, '_')}`;

      // Instantiate ProposalPDF component and generate blob
      const docInstance = (
        <ProposalPDF
          type={type}
          customBusinessName={customBusinessName}
          analysisData={analysisData}
          selectedPlan={selectedPlan}
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
      console.error("Error generating proposal PDF:", err);
      alert("Error al generar PDF. Por favor, intente de nuevo.");
    } finally {
      setProposalPrinting(prev => ({ ...prev, [type]: false }));
    }
  };

  // Modular specification lists
  const MODULES_INFO = [
    { id: 'agenda', name: 'Agenda e Reservas', cost: 2000, points: 15, desc: 'Agendas en tiempo real para citas, control de cupos y horarios.' },
    { id: 'inventario', name: 'Inventario y Catálogo', cost: 3500, points: 25, desc: 'Gestión en la nube de stock, categorías y alertas de stock mínimo.' },
    { id: 'stripe', name: 'Pasarela Stripe', cost: 2500, points: 20, desc: 'Procesamiento de tarjetas de crédito/débito y suscripciones recurrentes.' },
    { id: 'ia', name: 'Inteligencia Artificial', cost: 6000, points: 45, desc: 'Asistente Gemini AI integrado para automatizar respuestas o analizar datos.' },
    { id: 'multiusuarios', name: 'Multiusuarios y Roles', cost: 2000, points: 15, desc: 'Accesos independientes para personal con control de roles y permisos.' },
    { id: 'dashboard', name: 'Dashboard de Administración', cost: 2500, points: 20, desc: 'Consola web completa para gestionar el negocio, clientes y configuraciones.' },
    { id: 'reportes', name: 'Reportes y Analíticas', cost: 2000, points: 15, desc: 'Gráficas de ventas, exportación Excel/PDF y métricas de crecimiento.' },
    { id: 'api', name: 'Notificaciones WhatsApp API', cost: 4000, points: 30, desc: 'Envío de confirmaciones y recordatorios automáticos por WhatsApp.' },
    { id: 'publicacion', name: 'Instalación PWA Móvil', cost: 3000, points: 15, desc: 'Configuración para instalar como App en pantalla de inicio sin depender de tiendas.' }
  ];

  const getCustomProjectPrice = () => {
    let basePrice = paymentSettings.plans[selectedPlan]?.cost || 14990;

    let extraCost = 0;
    let extraPoints = 0;

    const isIncluded = (moduleId: string) => {
      if (selectedPlan === 'Enterprise') return true;
      if (selectedPlan === 'PremiumIA') {
        return ['dashboard', 'publicacion', 'multiusuarios', 'agenda', 'stripe', 'reportes', 'ia', 'api'].includes(moduleId);
      }
      if (selectedPlan === 'Business') {
        return ['dashboard', 'publicacion', 'multiusuarios', 'agenda', 'stripe', 'reportes'].includes(moduleId);
      }
      if (selectedPlan === 'Starter') {
        return ['dashboard', 'publicacion', 'multiusuarios'].includes(moduleId);
      }
      return false;
    };

    MODULES_INFO.forEach(mod => {
      if (selectedModules[mod.id] && !isIncluded(mod.id)) {
        extraCost += mod.cost;
        extraPoints += mod.points;
      }
    });

    const totalCost = basePrice + extraCost;
    const basePoints = selectedPlan === 'Starter' ? 50 : selectedPlan === 'Business' ? 100 : selectedPlan === 'PremiumIA' ? 180 : 250;
    const totalPoints = basePoints + extraPoints;

    return { totalCost, totalPoints };
  };

  const getSupportPlanCost = () => {
    return paymentSettings.plans[selectedPlan]?.monthly || 999;
  };

  const getQueueWaitTime = () => {
    let activeDays = 0;
    activeProjects.forEach(p => {
      if (p.status === 'desarrollo') {
        activeDays += p.daysRemaining;
      } else if (p.status === 'espera') {
        activeDays += p.daysRemaining * 0.5;
      }
    });
    return Math.max(3, Math.ceil(activeDays / 1.5));
  };

  const formatDateSpanish = (date: Date) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} de ${month}, ${year}`;
  };

  const getTimelineDates = (devDays: number, waitDays: number) => {
    const today = new Date();
    
    const startDate = new Date();
    startDate.setDate(today.getDate() + waitDays);
    
    const deliveryDate = new Date();
    deliveryDate.setDate(startDate.getDate() + devDays);
    
    return {
      todayStr: formatDateSpanish(today),
      startStr: formatDateSpanish(startDate),
      deliveryStr: formatDateSpanish(deliveryDate)
    };
  };

  // Sync custom business name with registration state
  useEffect(() => {
    if (customBusinessName && !regBusiness) {
      setRegBusiness(customBusinessName);
    }
  }, [customBusinessName]);

  // Handle client sign-up / login from checkout flow
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setIsRegLoading(true);

    try {
      if (authTab === 'register') {
        if (!regName.trim() || !regEmail.trim() || !regPassword.trim() || !regPhone.trim() || !regBusiness.trim()) {
          throw new Error('Todos los campos son requeridos para identificar formalmente tu negocio.');
        }
        if (regPassword.length < 6) {
          throw new Error('La contraseña de seguridad debe contener al menos 6 caracteres.');
        }

        const response = await fetch('/api/auth/register-custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: regEmail.trim(),
            password: regPassword,
            name: regName.trim(),
            empresa: regBusiness.trim(),
            telefono: regPhone.trim(),
            giro: analysisData?.businessType || 'General'
          })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Ocurrió un error al registrar tu cuenta.');
        }

        // Authenticate client
        const isValidJwt = (token: string) => {
          if (!token) return false;
          const parts = token.split('.');
          return parts.length === 3;
        };
        if (data.customToken && isValidJwt(data.customToken)) {
          try {
            await signInWithCustomToken(auth, data.customToken);
          } catch (authErr) {
            console.warn('Authentication token skipped, using local bypass mechanism:', authErr);
          }
        } else {
          console.warn('Custom token format is invalid (fallback mode), skipping signInWithCustomToken.');
        }

        localStorage.setItem('kidria_bypass_user', JSON.stringify(data.userProfile));
        setRegisteredClientData(data.userProfile);
        setCustomBusinessName(data.userProfile.empresa); // Live propagate custom business name!
        setShowAuthForm(false);

        // Auto-resume payment
        if (pendingPaymentMethod) {
          const methodToResume = pendingPaymentMethod;
          setPendingPaymentMethod(null);
          setTimeout(() => {
            handleSelectPayment(methodToResume);
          }, 300);
        }
      } else {
        // Login flow
        if (!regEmail.trim() || !regPassword.trim()) {
          throw new Error('Ingresa tu correo y contraseña registrados.');
        }

        const response = await fetch('/api/auth/login-custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: regEmail.trim(),
            password: regPassword
          })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Credenciales de acceso incorrectas.');
        }

        const isValidJwt = (token: string) => {
          if (!token) return false;
          const parts = token.split('.');
          return parts.length === 3;
        };
        if (data.customToken && isValidJwt(data.customToken)) {
          try {
            await signInWithCustomToken(auth, data.customToken);
          } catch (authErr) {
            console.warn('Authentication login token skipped, using local bypass mechanism:', authErr);
          }
        } else {
          console.warn('Custom token format is invalid (fallback mode), skipping signInWithCustomToken.');
        }

        localStorage.setItem('kidria_bypass_user', JSON.stringify(data.userProfile));
        setRegisteredClientData(data.userProfile);
        setCustomBusinessName(data.userProfile.empresa); // Live propagate custom business name!
        setShowAuthForm(false);

        // Auto-resume payment
        if (pendingPaymentMethod) {
          const methodToResume = pendingPaymentMethod;
          setPendingPaymentMethod(null);
          setTimeout(() => {
            handleSelectPayment(methodToResume);
          }, 300);
        }
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || '';
      if (authTab === 'register' && (errMsg.includes('ya está registrado') || errMsg.includes('registrado en KIDRIA Studio') || errMsg.includes('already-in-use') || errMsg.includes('email-already-in-use'))) {
        setAuthTab('login');
        setRegPassword('');
        setRegError('Este correo electrónico ya está registrado. Hemos cambiado a la pestaña "Ya tengo Cuenta" para que ingreses tu contraseña y procedas con el pago de forma segura.');
      } else {
        setRegError(errMsg || 'Error de comunicación.');
      }
    } finally {
      setIsRegLoading(false);
    }
  };

  // Trigger simulated paid step
  const handleSelectPayment = (method: 'deposito' | 'mercadopago' | 'transferencia') => {
    // Intercept with secure authentication form if user is guest/unregistered
    const isGuest = !currentUser || currentUser.uid === 'guest';
    if (isGuest && !registeredClientData) {
      setPendingPaymentMethod(method);
      setShowAuthForm(true);
      return;
    }

    setPaymentMethod(method);
  };

  // Handle manual confirmation of simulated cash transfer or MercadoPago
  const handleConfirmSuccessfulPayment = () => {
    setIsProvisioning(true);
    setStep('proposal_mockup'); // make sure we're in this visual container
    setProvisioningProgress(5);
    setProvisioningStage('Inicializando infraestructura Cloud Run...');

    const stages = [
      { text: 'Registrando cliente en base de datos CRM...', progress: 20 },
      { text: 'Creando nuevo proyecto de desarrollo activo en KIDRIA...', progress: 40 },
      { text: 'Generando contrato digital firmado y carpetas del repositorio...', progress: 60 },
      { text: 'Configurando base de datos relacional Firestore...', progress: 80 },
      { text: 'Creando credenciales de usuario y sincronizando ambiente...', progress: 95 },
      { text: 'Provisionamiento completado de forma exitosa. Redireccionando...', progress: 100 }
    ];

    let currentStageIndex = 0;
    const interval = setInterval(() => {
      if (currentStageIndex < stages.length) {
        setProvisioningStage(stages[currentStageIndex].text);
        setProvisioningProgress(stages[currentStageIndex].progress);
        
        if (stages[currentStageIndex].progress === 100) {
          clearInterval(interval);
          setTimeout(() => {
            // Trigger automatic conversion to client!
            provisionNewAccount();
          }, 1500);
        }
        currentStageIndex++;
      }
    }, 1200);
  };

  // Actual state mutation mapping Visitor -> Client Dashboard
  const provisionNewAccount = () => {
    const { totalCost, totalPoints } = getCustomProjectPrice();
    const anticipoVal = Math.round(totalCost * 0.5);
    const balanceVal = totalCost - anticipoVal;
    const monthlyFee = getSupportPlanCost();

    // Map profile data dynamically using registered client details
    const activeUID = registeredClientData?.uid || (currentUser && currentUser.uid !== 'guest' ? currentUser.uid : `user_cliente_${Date.now()}`);
    const activeEmail = registeredClientData?.email || (currentUser && currentUser.uid !== 'guest' ? currentUser.email : 'cliente@kidria.com');
    const activeNombre = registeredClientData?.nombre || (currentUser && currentUser.uid !== 'guest' ? currentUser.nombre : 'Cliente KIDRIA');
    const activeEmpresa = registeredClientData?.empresa || customBusinessName || 'Mi Empresa';
    const activeTelefono = registeredClientData?.telefono || (currentUser && currentUser.uid !== 'guest' ? currentUser.telefono : '+52 55 ' + Math.floor(10000000 + Math.random() * 90000000));

    // Create a custom User Profile
    const newClientProfile: UserProfile = {
      uid: activeUID,
      email: activeEmail,
      nombre: activeNombre,
      empresa: activeEmpresa,
      logoUrl: undefined,
      role: 'cliente',
      telefono: activeTelefono,
      giro: analysisData?.businessType || 'General',
      colores: {
        primary: analysisData?.recommendedColors?.primary || '#4f46e5',
        secondary: analysisData?.recommendedColors?.secondary || '#10b981'
      },
      dominioPropuesto: `${activeEmpresa.toLowerCase().replace(/\s+/g, '')}.app`,
      referralCode: `KIDRIA-${activeEmpresa.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      referidosContratados: 0,
      referidosGanancia: 0,
      twoFactorEnabled: false
    };

    // Construct a custom project order
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    
    // Dynamic queue calculation
    const devDaysBase = Math.ceil(totalPoints / 10);
    const devDaysWithMargin = Math.ceil(devDaysBase * 1.15);
    const waitDays = getQueueWaitTime();
    
    const today = new Date();
    const deliveryDate = new Date();
    deliveryDate.setDate(today.getDate() + waitDays + devDaysWithMargin);
    const formattedDelivery = deliveryDate.toISOString().substring(0, 10);

    const newOrder: ProjectOrder = {
      id: `order_${Date.now()}`,
      cliente: activeNombre,
      correo: activeEmail,
      empresa: activeEmpresa,
      telefono: activeTelefono,
      giro: analysisData?.businessType || 'General',
      proyecto: `PWA Integral - ${activeEmpresa}`,
      precioTotal: totalCost,
      anticipo: anticipoVal,
      saldoPendiente: balanceVal,
      estado: 'step_diseno', // Starting on first phase (Design)
      fechaContratacion: new Date().toISOString().substring(0, 10),
      fechaEntrega: formattedDelivery,
      mensualidad: monthlyFee,
      estadoStripe: 'active',
      estadoFirebase: 'pending',
      notasInternas: `Proyecto autogenerado vía funnel en MXN. Plan: ${selectedPlan}. Complejidad: ${totalPoints} puntos. Tiempo de cola: ${waitDays} días.`,
      prioridad: 'alta',
      categoria: selectedPlan === 'Starter' ? 'PWA Básica' : selectedPlan === 'Business' ? 'PWA Premium' : selectedPlan === 'PremiumIA' ? 'PWA Inteligencia Artificial' : 'SaaS Enterprise',
      observaciones: 'Automatización completa del CRM y del embudo. Contrato generado digitalmente tras el pago.',
      responsableProyecto: 'Lucas Prieto (Senior Frontend Developer)',
      historial: [
        { id: `h_prov_1`, fecha: timestamp, titulo: 'Proyecto Inicializado', descripcion: 'Estructuración automática del CRM, carpetas, DNS de dominio y asignación de servidores por KIDRIA IA.', autor: 'KIDRIA Automation Engine' },
        { id: `h_prov_2`, fecha: timestamp, titulo: 'Anticipo Recibido', descripcion: `Acreditado el pago del 50% ($${anticipoVal} MXN) por concepto de anticipo del plan ${selectedPlan}.`, autor: 'Stripe webhook' }
      ],
      archivos: [
        { id: `f_prov_1`, nombre: `Contrato_Servicio_${activeEmpresa.replace(/\s+/g, '_')}.pdf`, categoria: 'contrato', url: '#', size: '1.2 MB', fecha: new Date().toISOString().substring(0, 10) },
        { id: `f_prov_2`, nombre: `Propuesta_IA_Tecnica.pdf`, categoria: 'branding', url: '#', size: '2.5 MB', fecha: new Date().toISOString().substring(0, 10) }
      ],
      facturas: [
        { id: `inv_prov_1`, numero: `INV-${new Date().getFullYear()}-001`, concepto: `Anticipo 50% - Desarrollo PWA ${activeEmpresa}`, monto: anticipoVal, fechaEmision: new Date().toISOString().substring(0, 10), fechaVencimiento: new Date().toISOString().substring(0, 10), estado: 'pagada' },
        { id: `inv_prov_2`, numero: `INV-${new Date().getFullYear()}-002`, concepto: `Suscripción Mensual - Soporte e Infraestructura ${selectedPlan}`, monto: monthlyFee, fechaEmision: new Date().toISOString().substring(0, 10), fechaVencimiento: new Date().toISOString().substring(0, 10), estado: 'pendiente' }
      ],
      contractSigned: true,
      contractSignedDate: new Date().toISOString().substring(0, 10),
      contractSignature: activeNombre
    };

    // Callback to let app update global state
    onSuccessProvisioning(newClientProfile, newOrder);
  };

  return (
    <div id="visitor_funnel_root" className="w-full text-zinc-100 max-w-6xl mx-auto space-y-12">
      
      {/* Step 1: Hero Section */}
      {step === 'hero' && (
        <div className="text-center py-12 md:py-20 space-y-8 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold tracking-wider uppercase animate-pulse">
            <Sparkles className="w-4 h-4" />
            <span>Consultoría de Negocio Inteligente</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-extrabold font-display tracking-tight text-white leading-tight">
            ¿Quieres saber cómo la <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Inteligencia Artificial</span> puede potenciar tu negocio?
          </h2>

          <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
            Analiza gratis la madurez digital de tu empresa. Nuestro consultor cognitivo estructurará al instante un diagnóstico detallado, una propuesta comercial y un prototipo funcional personalizado listo para operar.
          </p>

          <div className="bg-zinc-900/40 p-6 md:p-8 rounded-2xl border border-zinc-800 space-y-6 shadow-xl text-left">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Giro o Nicho Comercial</h3>
                <p className="text-zinc-500 text-xs font-medium">Escribe tu giro personalizado o navega por nuestro catálogo inteligente de negocios.</p>
              </div>
              {businessInput && (
                <button 
                  onClick={() => setBusinessInput('')}
                  className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 self-start md:self-auto transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={businessInput}
                onChange={(e) => setBusinessInput(e.target.value)}
                placeholder="Ej. 'Tengo una veterinaria de mascotas' o 'Tengo un taller mecánico'..."
                className="flex-1 bg-[#09090b] border border-zinc-700 hover:border-zinc-500 focus:border-indigo-500 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-500 outline-none transition-colors shadow-inner"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleStartAnalysis(businessInput);
                }}
              />
              <button
                onClick={() => handleStartAnalysis(businessInput)}
                disabled={!businessInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-6 py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/15 cursor-pointer transition-all active:scale-95 duration-150 shrink-0"
              >
                <span>Analizar gratis mi negocio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Comprehensive Interactive Directory */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Directorio de Especialidades Predefinidas
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  Filtrado en tiempo real
                </span>
              </div>

              {/* Category Pills Rail */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 border-b border-zinc-800/40 select-none scrollbar-none">
                {businessCategories.map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setShowAllNiches(false); // Reset pagination on category change
                      }}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                          : 'bg-zinc-950/60 border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>

              {/* Live matching catalog list */}
              {(() => {
                const filteredNiches = allBusinessNiches.filter((n) => {
                  const matchesCategory = selectedCategory === 'all' || n.category === selectedCategory;
                  const matchesSearch = !businessInput.trim() || 
                    n.label.toLowerCase().includes(businessInput.toLowerCase()) || 
                    n.text.toLowerCase().includes(businessInput.toLowerCase()) ||
                    n.desc.toLowerCase().includes(businessInput.toLowerCase());
                  return matchesCategory && matchesSearch;
                });

                const limit = showAllNiches ? filteredNiches.length : 6;
                const visibleNiches = filteredNiches.slice(0, limit);

                if (filteredNiches.length === 0) {
                  return (
                    <div className="bg-zinc-950/80 p-5 rounded-xl border border-dashed border-zinc-800 text-center space-y-1.5 animate-fade-in">
                      <p className="text-zinc-300 text-xs font-semibold">🔍 Giro personalizado detectado</p>
                      <p className="text-zinc-500 text-[11px] max-w-md mx-auto leading-relaxed">
                        "{businessInput}" no coincide exactamente con nuestro catálogo de especialidades pre-cargado, pero nuestro Consultor IA estructurará al instante cualquier modelo de negocio personalizado. ¡Haz clic en el botón de arriba para iniciar!
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {visibleNiches.map((n, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setBusinessInput(n.text);
                            handleStartAnalysis(n.text);
                          }}
                          className="group relative flex flex-col text-left p-4 bg-zinc-950/80 hover:bg-zinc-900/60 rounded-xl border border-zinc-800 hover:border-indigo-500/30 transition-all cursor-pointer animate-fade-in focus:outline-none focus:border-indigo-500/40"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="font-bold text-zinc-200 text-xs group-hover:text-indigo-300 transition-colors">
                              {n.label}
                            </span>
                            <span className="text-[9px] uppercase font-mono text-zinc-500 group-hover:text-zinc-400 transition-colors shrink-0">
                              {n.category === 'salud' ? 'Salud' :
                               n.category === 'servicios' ? 'Servicio' :
                               n.category === 'gastronomia' ? 'Comida' :
                               n.category === 'comercio' ? 'Retail' :
                               n.category === 'inmobiliaria' ? 'Inmueble' : 'Autos'}
                            </span>
                          </div>
                          
                          <p className="text-zinc-400 text-[11px] leading-relaxed line-clamp-2 pr-4">
                            {n.desc}
                          </p>

                          <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-indigo-400 font-bold flex items-center gap-0.5 font-mono">
                              Iniciar <ArrowRight className="w-2.5 h-2.5" />
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {filteredNiches.length > 6 && (
                      <div className="flex justify-center pt-1 border-t border-zinc-800/20">
                        <button
                          type="button"
                          onClick={() => setShowAllNiches(!showAllNiches)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-950/40 border border-zinc-850 hover:border-zinc-800 transition-all cursor-pointer"
                        >
                          <span>{showAllNiches ? 'Mostrar menos giros' : `Ver todos los giros (${filteredNiches.length})`}</span>
                          <ChevronRight className={`w-3.5 h-3.5 transform transition-transform ${showAllNiches ? 'rotate-90' : ''}`} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* GUÍA TECNOLÓGICA PWA: Seguridad y Ventajas sin virus */}
          <div className="pt-12 border-t border-zinc-800/60 text-left space-y-8 animate-fade-in">
            <div className="text-center space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/10">
                Guía Tecnológica KIDRIA
              </span>
              <h3 className="text-2xl md:text-3xl font-extrabold font-display tracking-tight text-white">
                ¿Por qué una PWA es infinitamente mejor y más segura?
              </h3>
              <p className="text-zinc-400 text-xs md:text-sm max-w-xl mx-auto leading-relaxed">
                Descubre cómo las Progressive Web Apps (PWAs) de última generación transforman la experiencia móvil sin las fricciones ni los riesgos de seguridad de las tiendas tradicionales.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 rounded-xl border border-zinc-800/80 space-y-3.5 hover:border-indigo-500/30 transition-all group">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <Shield className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                  100% Libre de Virus y Malware
                </h4>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Al no requerir la descarga ni instalación de archivos binarios sospechosos (<code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded text-[10px]">.apk</code> o <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded text-[10px]">.ipa</code>), se ejecuta de manera segura bajo el estricto entorno de aislamiento (Sandbox) de navegadores como Safari o Chrome. Es imposible que acceda a tus claves, archivos o infecte tu teléfono móvil.
                </p>
              </div>

              <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 rounded-xl border border-zinc-800/80 space-y-3.5 hover:border-indigo-500/30 transition-all group">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                  Multiplataforma Nativa (iOS & Android)
                </h4>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Funciona perfectamente tanto en iPhone como en Android desde una única base de código. Se agrega a la pantalla de inicio de tus clientes con su propio ícono de app, splash screen personalizado y soporte de almacenamiento offline para una experiencia fluida y rápida.
                </p>
              </div>

              <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 rounded-xl border border-zinc-800/80 space-y-3.5 hover:border-indigo-500/30 transition-all group">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                  Actualizaciones al Instante (Over-the-Air)
                </h4>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Evita los engorrosos tiempos de revisión y aprobación de Apple App Store o Google Play. Cada vez que realices una mejora o cambio en tu aplicación, el usuario la recibe de forma automática y transparente al instante, sin descargas pesadas ni esperas inútiles.
                </p>
              </div>
            </div>

            {/* Cuadro comparativo rápido */}
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-lg w-full">
              <div className="bg-zinc-900/40 px-5 py-3 border-b border-zinc-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">Tabla Comparativa: PWAs vs Apps de Tienda (Legacy)</h4>
              </div>
              <div className="overflow-x-auto w-full">
                <div className="divide-y divide-zinc-900 text-[11px] font-mono min-w-[640px]">
                  <div className="grid grid-cols-3 p-4 bg-zinc-900/10">
                    <span className="text-zinc-500">Característica</span>
                    <span className="text-indigo-400 font-bold">KIDRIA PWA Framework</span>
                    <span className="text-zinc-400">Aplicación Tradicional (Stores)</span>
                  </div>
                  <div className="grid grid-cols-3 p-4 hover:bg-zinc-900/20 transition-colors">
                    <span className="text-zinc-300">Riesgo de Virus y Malware</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">🛡️ 0% (Aislamiento Seguro)</span>
                    <span className="text-amber-500">Medio/Alto (Ejecutables pesados)</span>
                  </div>
                  <div className="grid grid-cols-3 p-4 hover:bg-zinc-900/20 transition-colors">
                    <span className="text-zinc-300">Instalación / Fricción</span>
                    <span className="text-indigo-300 flex items-center gap-1">⚡ 1 Click (Pantalla de Inicio)</span>
                    <span className="text-zinc-500">Largo (Ir a tienda, buscar, clave, esperar)</span>
                  </div>
                  <div className="grid grid-cols-3 p-4 hover:bg-zinc-900/20 transition-colors">
                    <span className="text-zinc-300">Peso en Memoria</span>
                    <span className="text-indigo-300">1 - 3 Megabytes (Súper ligero)</span>
                    <span className="text-zinc-500">50 - 250 Megabytes (Consumo alto)</span>
                  </div>
                  <div className="grid grid-cols-3 p-4 hover:bg-zinc-900/20 transition-colors">
                    <span className="text-zinc-300">Costos de Licencia / Comisiones</span>
                    <span className="text-emerald-400 font-semibold">Gratis y Directo</span>
                    <span className="text-zinc-500">Comisión del 15% al 30% + Pago anual de Desarrollador</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* GALERÍA DE APLICACIONES EXITOSAS */}
          <div className="pt-12 space-y-8 text-left border-t border-zinc-800/40">
            <div className="text-center space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/10">
                Portafolio Exitoso
              </span>
              <h3 className="text-2xl md:text-3xl font-extrabold font-display tracking-tight text-white">
                Casos de Éxito Creados con KIDRIA
              </h3>
              <p className="text-zinc-400 text-xs md:text-sm max-w-xl mx-auto leading-relaxed">
                Nuestros clientes ya están transformando sus negocios con Progressive Web Apps ultrarrápidas, integradas con Pasarela de Pagos Stripe e Inteligencia Artificial.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ejemplo 1 */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl space-y-4 hover:border-zinc-700 transition-all flex flex-col justify-between group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/10">GastroApp PWA</span>
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Activo en Producción
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white font-display group-hover:text-indigo-300 transition-colors">GastroApp - Menú, Pedidos & Comandas</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Sistema integral para restaurantes con reserva de mesas en tiempo real, menús QR dinámicos auto-administrados, notificaciones automáticas de pedidos e integración directa de cobros con pasarela de pago.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-800/80">
                    <div>
                      <span className="text-zinc-500 block">Velocidad de carga:</span>
                      <span className="text-white">0.4 segundos</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Retención de Clientes:</span>
                      <span className="text-emerald-400 font-bold">+42% mensual</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setBusinessInput('Quiero una app para un restaurante con reserva y pedidos en línea');
                    window.scrollTo({ top: 100, behavior: 'smooth' });
                  }}
                  className="mt-4 border border-indigo-500/30 hover:border-indigo-500 hover:bg-indigo-600/10 text-indigo-300 font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>Generar propuesta similar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Ejemplo 2 */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl space-y-4 hover:border-zinc-700 transition-all flex flex-col justify-between group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/10">ClinicaDental PWA</span>
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Activo en Producción
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white font-display group-hover:text-cyan-300 transition-colors">Clínica Dental Rivera - Gestión de Citas</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    PWA instalable que permite a los pacientes agendar consultas, recibir recordatorios inteligentes vía WhatsApp, consultar expedientes médicos dentales de forma segura y pagar anticipos.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-800/80">
                    <div>
                      <span className="text-zinc-500 block">Notificaciones:</span>
                      <span className="text-white">Push & SMS integradas</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Ausencias Reducidas:</span>
                      <span className="text-emerald-400 font-bold">-75% menos faltas</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setBusinessInput('Quiero una app para agendar citas en un consultorio odontológico');
                    window.scrollTo({ top: 100, behavior: 'smooth' });
                  }}
                  className="mt-4 border border-cyan-500/30 hover:border-cyan-500 hover:bg-cyan-600/10 text-cyan-300 font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>Generar propuesta similar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Ejemplo 3 */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl space-y-4 hover:border-zinc-700 transition-all flex flex-col justify-between group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/10">VetCare PWA</span>
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Activo en Producción
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white font-display group-hover:text-pink-300 transition-colors">PetLover Vet - Mascotas Inteligentes</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Plataforma para clínicas veterinarias que automatiza la ficha de salud de mascotas, programa recordatorios de vacunas de manera proactiva con IA y procesa pagos recurrentes de planes de salud con Stripe.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-800/80">
                    <div>
                      <span className="text-zinc-500 block">Instalaciones:</span>
                      <span className="text-white">Más de 2,400 usuarios</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Aumento de Ventas:</span>
                      <span className="text-emerald-400 font-bold">+28% en servicios</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setBusinessInput('Quiero una app para una clínica veterinaria con vacunas e historial');
                    window.scrollTo({ top: 100, behavior: 'smooth' });
                  }}
                  className="mt-4 border border-pink-500/30 hover:border-pink-500 hover:bg-pink-600/10 text-pink-300 font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>Generar propuesta similar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Ejemplo 4 */}
              <div className="bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl space-y-4 hover:border-zinc-700 transition-all flex flex-col justify-between group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/10">FitLife PWA</span>
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Activo en Producción
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white font-display group-hover:text-emerald-300 transition-colors">Gym Matrix - Membresías y Rutinas</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Gimnasio digitalizado con control de accesos offline por código QR, rutinas interactivas personalizadas, alertas automáticas de renovación de planes de suscripción y pasarela integrada.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-800/80">
                    <div>
                      <span className="text-zinc-500 block">Suscripciones:</span>
                      <span className="text-white">Stripe Checkout + Portal</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Retorno de Inversión:</span>
                      <span className="text-emerald-400 font-bold">1.5 meses</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setBusinessInput('Quiero una app para un gimnasio con rutinas y membresías de stripe');
                    window.scrollTo({ top: 100, behavior: 'smooth' });
                  }}
                  className="mt-4 border border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-600/10 text-emerald-300 font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>Generar propuesta similar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN DE APRENDIZAJE CONTINUO - MEMORIA COGNITIVA EN FIRESTORE */}
          <div className="pt-12 space-y-8 text-left border-t border-zinc-800/40">
            <div className="text-center space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/10 animate-pulse">
                KIDRIA AI Core Memory
              </span>
              <h3 className="text-2xl md:text-3xl font-extrabold font-display tracking-tight text-white">
                Base de Conocimiento y Aprendizaje Continuo de KIDRIA AI
              </h3>
              <p className="text-zinc-400 text-xs md:text-sm max-w-xl mx-auto leading-relaxed">
                Cada diagnóstico que realizas alimenta de forma absoluta la memoria global de KIDRIA. La IA se entrena y adapta continuamente con estos casos reales para ser el asistente de negocios más confiable del mercado.
              </p>
            </div>

            {/* Panel de Estado del Aprendizaje */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block font-mono">ESTADO DEL ROL</span>
                  <span className="text-emerald-400 text-xs font-bold font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Aprendizaje Activo
                  </span>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block font-mono">MEMORIA DE CONTEXTO</span>
                  <span className="text-white text-xs font-bold font-mono">
                    Firestore RAG Engine
                  </span>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400 border border-pink-500/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] block font-mono">NEGOCIOS EN BD</span>
                  <span className="text-white text-xs font-bold font-mono">
                    {pastInvestigations.length > 0 ? `${12 + pastInvestigations.length} Analizados` : 'Sincronizando...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Listado de Investigaciones Almacenadas en Tiempo Real */}
            <div className="bg-zinc-900/20 border border-zinc-800/60 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  Registro de Investigaciones Recientes
                </h4>
                <span className="text-[10px] font-mono text-zinc-500">Actualizado en tiempo real</span>
              </div>

              {isLoadingPast ? (
                <div className="text-center py-8 space-y-2">
                  <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto"></div>
                  <span className="text-xs text-zinc-500 font-mono">Cargando base de conocimiento...</span>
                </div>
              ) : pastInvestigations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-500 text-xs font-mono">
                    Aún no hay diagnósticos registrados en esta sesión. ¡Sé el primero en analizar tu negocio para iniciar el ciclo de aprendizaje!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pastInvestigations.map((inv, idx) => (
                    <div 
                      key={inv.id || idx} 
                      className="bg-zinc-950/80 hover:bg-zinc-950 border border-zinc-800 hover:border-indigo-500/30 p-4 rounded-xl flex flex-col justify-between space-y-3 transition-all group animate-fade-in"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                            ID: #{inv.id ? inv.id.substring(0, 6).toUpperCase() : `INV-${idx}`}
                          </span>
                          <span className="text-[9px] text-zinc-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-zinc-600" />
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h5 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                          {inv.businessType}
                        </h5>
                        <p className="text-zinc-400 text-[11px] leading-relaxed line-clamp-2">
                          Propuesta: <strong className="text-zinc-300">{inv.mockupTitle}</strong> — {inv.mockupSubtitle}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-[10px] font-mono">
                        <div className="flex gap-3">
                          <div>
                            <span className="text-zinc-500 font-sans text-[10px]">Madurez: </span>
                            <span className="text-white font-bold">{inv.digitizationLevel}%</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 font-sans text-[10px]">Automatizable: </span>
                            <span className="text-emerald-400 font-bold">{inv.automationPotential}%</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setBusinessInput(inv.businessType);
                            handleStartAnalysis(inv.businessType);
                            window.scrollTo({ top: 100, behavior: 'smooth' });
                          }}
                          className="text-indigo-400 hover:text-white font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-all cursor-pointer"
                        >
                          <span>Re-analizar</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Loading State */}
      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center text-center py-20 space-y-6 max-w-lg mx-auto">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-zinc-800 border-t-indigo-500 animate-spin"></div>
            <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-indigo-400 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">Investigación IA en Progreso</h3>
            <p className="text-zinc-400 text-xs font-mono h-8">{loadingStage}</p>
          </div>

          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">{loadingProgress}% completado</span>
        </div>
      )}

      {/* Step 3: Analysis Results */}
      {step === 'results' && analysisData && (
        <div className="space-y-8 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
            <div>
              <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">Auditoría Digital Inteligente</span>
              <h2 className="text-2xl md:text-3xl font-extrabold font-display text-white">
                Diagnóstico Estratégico: <span className="text-indigo-400">{analysisData.businessType}</span>
              </h2>
            </div>
            
            <button 
              onClick={() => {
                setStep('hero');
                setBusinessInput('');
              }}
              className="text-zinc-500 hover:text-white text-xs flex items-center gap-1.5 self-start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Realizar otro análisis</span>
            </button>
          </div>

          {/* Diagnosis Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Main stats */}
            <div className="md:col-span-8 bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6 space-y-6">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span>Indicadores de Operación</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Madurez Digital</div>
                    <div className="flex items-baseline justify-center gap-1.5 mt-1">
                      <span className="text-2xl font-extrabold font-mono text-indigo-400">
                        {analysisData.digitalMaturity?.current || analysisData.digitizationLevel || 62}%
                      </span>
                      <span className="text-zinc-500 text-[10px]">Actual</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-center items-center gap-0.5 font-mono text-xs select-none">
                      {Array.from({ length: 10 }).map((_, idx) => {
                        const currentVal = analysisData.digitalMaturity?.current || analysisData.digitizationLevel || 62;
                        const blockThreshold = (idx + 1) * 10;
                        const isFilled = currentVal >= blockThreshold;
                        return (
                          <span key={idx} className={isFilled ? "text-indigo-400" : "text-zinc-850"}>
                            █
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-zinc-500 font-mono px-1">
                      <span>Mínimo</span>
                      <span className="text-indigo-400">Objetivo: {analysisData.digitalMaturity?.target || 90}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center space-y-1">
                  <div className="text-[10px] text-zinc-500 uppercase font-mono">Crecimiento</div>
                  <div className="text-lg font-bold text-emerald-400">{analysisData.growthOpportunity}</div>
                  <div className="text-[9px] text-zinc-500">Oportunidad Potencial</div>
                </div>

                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center space-y-1">
                  <div className="text-[10px] text-zinc-500 uppercase font-mono">Competencia</div>
                  <div className="text-lg font-bold text-amber-400">{analysisData.digitalCompetition}</div>
                  <div className="text-[9px] text-zinc-500">Rivalidad en el sector</div>
                </div>

                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center space-y-1">
                  <div className="text-[10px] text-zinc-500 uppercase font-mono">Automatización</div>
                  <div className="text-2xl font-bold font-mono text-cyan-400">{analysisData.automationPotential || 90}%</div>
                  <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden mt-2">
                    <div className="bg-cyan-500 h-1" style={{ width: `${analysisData.automationPotential || 90}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Detected issues list with Urgency Tagging */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Priorización Operativa: Cuellos de Botella Detectados</span>
                  </h4>
                  <span className="text-[10px] text-zinc-500 font-mono">¿Qué corregir primero?</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analysisData.detectedIssues?.map((issue: any, i: number) => {
                    const isObj = typeof issue === 'object' && issue !== null;
                    const title = isObj ? issue.title : `Dolor de cabeza ${i + 1}`;
                    const description = isObj ? issue.description : issue;
                    const urgency = isObj ? (issue.urgency || "Medio") : (i === 0 ? "Critico" : i === 1 ? "Alto" : "Medio");

                    let badgeColor = "bg-red-500/15 text-red-400 border-red-500/20";
                    let urgencyText = "🔴 Crítico";
                    if (urgency.toLowerCase().includes('crit') || urgency.toLowerCase() === 'crítico') {
                      badgeColor = "bg-red-500/15 text-red-400 border-red-500/20";
                      urgencyText = "🔴 Crítico";
                    } else if (urgency.toLowerCase().includes('alt')) {
                      badgeColor = "bg-orange-500/15 text-orange-400 border-orange-500/20";
                      urgencyText = "🟠 Alto";
                    } else if (urgency.toLowerCase().includes('med')) {
                      badgeColor = "bg-yellow-500/15 text-yellow-400 border-yellow-500/20";
                      urgencyText = "🟡 Medio";
                    } else if (urgency.toLowerCase().includes('baj')) {
                      badgeColor = "bg-green-500/15 text-green-400 border-green-500/20";
                      urgencyText = "🟢 Bajo";
                    }

                    return (
                      <div key={i} className="flex flex-col gap-1.5 p-3.5 bg-zinc-950/80 rounded-xl border border-zinc-800/80 hover:border-zinc-700/60 transition-all text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white tracking-tight">{title}</span>
                          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                            {urgencyText}
                          </span>
                        </div>
                        <p className="text-zinc-400 text-[11px] leading-relaxed">{description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recommended features chips */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Módulos Tecnológicos Recomendados para Implementar</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysisData.recommendedFeatures?.map((feat: string, i: number) => (
                    <span 
                      key={i} 
                      className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs px-3 py-1.5 rounded-lg border border-indigo-500/20 flex items-center gap-1 animate-fade-in"
                    >
                      <Check className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{feat}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Strategy, Payments & AI Integrations Block */}
              <div className="border-t border-zinc-800 pt-6 space-y-4">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 shrink-0" />
                  <span>Estrategias Clave de Automatización y Monetización</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pasarela y Pagos Recurrentes */}
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <CreditCard className="w-4.5 h-4.5" />
                      <span className="text-xs font-bold uppercase tracking-wider">Pasarela & Recurrentes</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {analysisData.howToPay || "Configura cobros de anticipos en línea e integra cobros automáticos estables."}
                    </p>
                    {analysisData.recurringIdeas && analysisData.recurringIdeas.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] text-zinc-500 uppercase font-mono">Ideas de Suscripción / Membresía:</div>
                        <div className="space-y-1 text-xs">
                          {analysisData.recurringIdeas.map((idea: string, i: number) => (
                            <div key={i} className="flex items-center gap-1.5 text-zinc-300">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                              <span>{idea}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* IA e Integraciones */}
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <Bot className="w-4.5 h-4.5" />
                      <span className="text-xs font-bold uppercase tracking-wider">Inteligencia Artificial</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {analysisData.aiUsage || "Sincroniza un modelo inteligente para responder de inmediato consultas frecuentes de tus clientes."}
                    </p>
                    {analysisData.automations && analysisData.automations.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] text-zinc-500 uppercase font-mono">Automatizaciones Recomendadas:</div>
                        <div className="space-y-1 text-xs">
                          {analysisData.automations.map((auto: string, i: number) => (
                            <div key={i} className="flex items-center gap-1.5 text-zinc-300">
                              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
                              <span>{auto}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Beneficio de Dueño */}
                {analysisData.ownerBenefit && (
                  <div className="bg-zinc-950 p-4 rounded-xl border border-emerald-500/15 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Retorno de Tiempo y Paz Mental para el Dueño</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      {analysisData.ownerBenefit}
                    </p>
                  </div>
                )}
              </div>

              {/* Lost Money / Cost of Inaction Section */}
              {analysisData.stayingSameCost && (
                <div className="bg-gradient-to-r from-red-950/20 to-zinc-900/60 p-5 rounded-2xl border border-red-500/15 space-y-4 animate-fade-in shadow-xl shadow-red-500/5">
                  <div className="flex items-center justify-between border-b border-red-500/10 pb-3">
                    <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 shrink-0" />
                      <span>Fuga de Dinero Mensual por Seguir Igual</span>
                    </h4>
                    <span className="text-[10px] text-zinc-400 uppercase font-mono bg-red-500/10 px-2 py-0.5 rounded border border-red-500/15">
                      Pérdidas Silenciosas
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800 text-center space-y-1">
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">Tiempo Desperdiciado</div>
                      <div className="text-xl font-bold font-mono text-zinc-200">
                        {analysisData.stayingSameCost.hoursLost || 42} hrs <span className="text-xs font-normal text-zinc-500">/ mes</span>
                      </div>
                      <div className="text-[9px] text-zinc-500">Costo Estimado en Operación:</div>
                      <div className="text-xs font-bold font-mono text-red-400">
                        ${(analysisData.stayingSameCost.timeCost || 18500).toLocaleString('es-MX')} MXN
                      </div>
                    </div>

                    <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800 text-center space-y-1">
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">Ventas Perdidas</div>
                      <div className="text-xl font-bold font-mono text-red-400">
                        ${(analysisData.stayingSameCost.lostSales || 12300).toLocaleString('es-MX')} MXN
                      </div>
                      <div className="text-[9px] text-zinc-500">Fuga por Atención Tardía</div>
                    </div>

                    <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800 text-center space-y-1">
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">Errores Administrativos</div>
                      <div className="text-xl font-bold font-mono text-red-400">
                        ${(analysisData.stayingSameCost.adminErrors || 6200).toLocaleString('es-MX')} MXN
                      </div>
                      <div className="text-[9px] text-zinc-500">Multas, mermas y no-shows</div>
                    </div>

                    <div className="bg-gradient-to-b from-red-950/30 to-red-950/10 p-3.5 rounded-xl border border-red-500/20 text-center flex flex-col justify-center items-center space-y-1">
                      <div className="text-[10px] text-red-400 uppercase tracking-wider font-bold">TOTAL ESTIMADO</div>
                      <div className="text-2xl font-extrabold font-mono text-red-500 tracking-tight">
                        ${(analysisData.stayingSameCost.totalMonthlyLoss || 37000).toLocaleString('es-MX')} MXN
                      </div>
                      <div className="text-[9px] text-zinc-400">Mensuales desperdiciados</div>
                    </div>
                  </div>

                  <p className="text-red-400/80 text-[11px] leading-relaxed italic bg-red-500/5 p-2.5 rounded-lg border border-red-500/10">
                    💡 <strong>¿Por qué ocurre esto?</strong> Seguir gestionando tu negocio mediante chats manuales y cuadernos te cuesta más de lo que cuesta el software de automatización de grado empresarial completo en sus primeros 3 meses.
                  </p>
                </div>
              )}

              {/* Phased Development Roadmap */}
              <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 rounded-2xl border border-zinc-800 space-y-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                  <div className="space-y-1 text-left">
                    <span className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest font-mono">Plan de Despliegue Técnico</span>
                    <h4 className="text-base font-bold text-white">Cronograma de Implementación y Fases</h4>
                  </div>
                  <div className="bg-indigo-500/10 border border-indigo-500/25 px-4 py-2 rounded-xl text-center">
                    <div className="text-[9px] text-zinc-400 uppercase font-mono">Tiempo Total Estimado</div>
                    <div className="text-sm font-bold text-indigo-300 font-mono">
                      {analysisData.developmentTimeDays || 46} Días Hábiles
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(analysisData.roadmapPhases || [
                    { phase: "Fase 1: Estructuración & Core PWA", progress: 60, description: "Estructuración de base de datos de usuarios, catálogos y panel interactivo." },
                    { phase: "Fase 2: Pasarela & Notificaciones", progress: 30, description: "Integración de pagos Stripe y automatización de alertas instantáneas por WhatsApp." },
                    { phase: "Fase 3: Inteligencia Artificial", progress: 10, description: "Despliegue del chatbot automatizado integrado para atención y ventas 24/7." }
                  ]).map((item: any, idx: number) => (
                    <div key={idx} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 space-y-3.5 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-zinc-200">{item.phase || item.phaseName}</span>
                          <span className="text-[10px] text-indigo-400 font-mono">{item.progress}%</span>
                        </div>
                        <p className="text-zinc-400 text-[11px] leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <div className="flex items-center gap-0.5 font-mono text-xs select-none">
                          {Array.from({ length: 12 }).map((_, bIdx) => {
                            const blockThreshold = Math.round((bIdx + 1) * (100 / 12));
                            const isFilled = item.progress >= blockThreshold;
                            return (
                              <span key={bIdx} className={isFilled ? "text-indigo-400" : "text-zinc-855"}>
                                █
                              </span>
                            );
                          })}
                        </div>
                        <div className="text-[9px] text-zinc-500 font-mono">
                          {item.progress === 100 ? "Listo para Lanzamiento" : "Avance de Fase"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-indigo-950/10 p-3 rounded-lg border border-indigo-900/20 text-[10px] text-zinc-400 leading-relaxed text-center">
                  🛡️ <strong>Aviso de Planificación:</strong> Este cronograma interactivo es ilustrativo y se activa de inmediato con el anticipo formal de tu plan seleccionado. No requiere ningún compromiso previo para su visualización.
                </div>
              </div>

              {/* Prognosis of Inaction Section */}
              <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-left">
                    <h4 className="text-sm font-bold text-zinc-300">¿Tienes dudas de dar el paso tecnológico hoy?</h4>
                    <p className="text-zinc-500 text-xs">Descubre las consecuencias proyectadas de posponer la digitalización de tus canales.</p>
                  </div>
                  <button
                    onClick={() => setShowNothingPrognosis(!showNothingPrognosis)}
                    className="w-full sm:w-auto bg-zinc-800/80 hover:bg-red-950/20 hover:text-red-400 hover:border-red-500/30 text-zinc-300 text-xs font-semibold px-4 py-2.5 rounded-xl border border-zinc-700/80 cursor-pointer flex items-center justify-center gap-2 transition-all shrink-0"
                  >
                    <span>{showNothingPrognosis ? 'Ocultar Pronóstico' : '¿Qué pasa si no hago nada?'}</span>
                    <HelpCircle className="w-4 h-4 shrink-0" />
                  </button>
                </div>

                <AnimatePresence>
                  {showNothingPrognosis && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 border-t border-zinc-800/80 space-y-4">
                        <div className="bg-[#120a0a] p-4 rounded-xl border border-red-900/20 space-y-3">
                          <span className="text-xs font-bold text-red-400 block uppercase tracking-wider">
                            En los próximos 24 meses probablemente ocurrirá lo siguiente:
                          </span>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(analysisData.ifYouDoNothingPrognosis || [
                              "Seguirás perdiendo más de 40 horas al mes en agendamientos y aclaraciones manuales.",
                              "Necesitarás contratar a otro empleado administrativo solo para gestionar llamadas y recordatorios.",
                              "Tus competidores directos automatizarán sus canales y absorberán tu cartera de clientes.",
                              "Aumentarás los errores de registro de servicios, citas cruzadas y mermas operativas."
                            ]).map((progText: string, idx: number) => (
                              <div key={idx} className="flex gap-2.5 items-start bg-zinc-950/80 p-3 rounded-lg border border-red-500/10 text-xs text-zinc-400 animate-fade-in">
                                <span className="text-red-500 font-bold shrink-0 mt-0.5">⚠️</span>
                                <span className="leading-relaxed">{progText}</span>
                              </div>
                            ))}
                          </div>

                          <p className="text-zinc-500 text-[10px] leading-relaxed border-t border-red-500/10 pt-2 text-center italic">
                            No te quedes atrás. La inacción es la decisión empresarial más cara de todas.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Income increase estimates and purchase call to action */}
            <div className="md:col-span-4 flex flex-col justify-between bg-gradient-to-b from-[#151525] to-zinc-950 rounded-2xl border border-indigo-500/20 p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Retorno Estimado de Inversión</span>
                </h3>
                
                <div className="bg-emerald-500/5 rounded-xl border border-emerald-500/25 p-4 space-y-3.5">
                  <div className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider border-b border-emerald-500/10 pb-2">Proyecciones de Impacto (ROI)</div>
                  
                  <div className="space-y-3">
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[11px] font-bold text-emerald-500">
                        <span>🛡️ Escenario conservador</span>
                        <span className="font-mono text-zinc-400 font-normal">Mínimo</span>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed bg-[#0c1a12] p-2 rounded-lg border border-emerald-950/40">
                        {analysisData.scenarios?.conservador || "+12% a +18% de optimización operativa de recursos"}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[11px] font-bold text-indigo-400">
                        <span>🚀 Escenario probable</span>
                        <span className="font-mono text-zinc-400 font-normal">Resultado</span>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed bg-[#0f1122] p-2 rounded-lg border border-indigo-950/40">
                        {analysisData.scenarios?.probable || "+25% a +35% de incremento de ingresos directos"}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[11px] font-bold text-cyan-400">
                        <span>🔥 Escenario optimista</span>
                        <span className="font-mono text-zinc-400 font-normal">Máximo</span>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed bg-[#0b171f] p-2 rounded-lg border border-cyan-950/40">
                        {analysisData.scenarios?.optimista || "+40% a +55% de captación expandida de mercado"}
                      </p>
                    </div>
                  </div>

                  <p className="text-zinc-500 text-[9px] leading-relaxed italic border-t border-emerald-500/10 pt-2">
                    *Las proyecciones anteriores representan escenarios de optimización basados en modelos de negocio de giro similar y no constituyen una garantía legal de resultados.
                  </p>
                </div>

                <div className="flex items-start gap-1.5 text-[10px] text-zinc-500 italic">
                  <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-zinc-600" />
                  <span>
                    El impacto real depende estrictamente de la adopción de los módulos, integración del WhatsApp y uso de la pasarela de pagos.
                  </span>
                </div>
              </div>

              {/* Do you want this app? CTA */}
              <div className="space-y-3 pt-4 border-t border-zinc-800">
                <div className="text-center font-bold text-white text-sm">
                  ¿Te gustaría desarrollar y desplegar esta aplicación para tu negocio?
                </div>
                
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setStep('proposal_mockup')}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs font-display flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/15 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Sí, iniciar propuesta</span>
                  </button>
                  
                  <button
                    onClick={() => setStep('declined')}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-medium py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    <span>No por el momento</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Declined feedback */}
      {step === 'declined' && (
        <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-8 max-w-xl mx-auto text-center space-y-6">
          <div className="mx-auto w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
            <X className="w-6 h-6" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">Entendemos perfectamente</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Tu diagnóstico de negocio permanecerá guardado temporalmente en la caché de este navegador en caso de que desees revisarlo más tarde o iniciar tu propuesta en el futuro. ¡Le deseamos el mayor de los éxitos en tu negocio local!
            </p>
          </div>

          <button
            onClick={() => setStep('hero')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg text-xs transition-all cursor-pointer"
          >
            Regresar al inicio
          </button>
        </div>
      )}

      {/* Step 5: Proposal & Customized Mockup View */}
      {step === 'proposal_mockup' && analysisData && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Header row */}
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
            <button 
              onClick={() => setStep('results')}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Volver al análisis"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">Embudo de Adquisición Digital</span>
              <h2 className="text-xl md:text-2xl font-bold text-white">Propuesta Comercial & Prototipo Interactivo</h2>
            </div>
          </div>

          {/* Infrastructure Provisioning Loading Overlay */}
          {isProvisioning && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center">
              <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 shadow-2xl">
                <div className="relative mx-auto w-16 h-16">
                  <div className="absolute inset-0 border-4 border-zinc-800 border-t-indigo-500 rounded-full animate-spin"></div>
                  <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-indigo-400 animate-pulse" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">Automatización de Provisionamiento</h3>
                  <p className="text-zinc-400 text-xs font-mono h-8">{provisioningStage}</p>
                </div>

                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    style={{ width: `${provisioningProgress}%` }}
                  ></div>
                </div>

                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>KIDRIA-PROVISION-SYS</span>
                  <span>{provisioningProgress}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Two Columns: Left Proposal & Plan, Right Smartphone Mockup */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Hand: Proposal Details & Pricing */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* PDF Document Preview Card */}
              <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 p-6 space-y-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 rounded-full blur-2xl"></div>
                
                {/* Proposal Cover Page Style */}
                <div className="border-b border-zinc-800 pb-4 flex justify-between items-start gap-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">{analysisData.proposal.title}</h3>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Propuesta Técnica por KIDRIA IA</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => handlePrintProposal('comercial')}
                      disabled={proposalPrinting['comercial']}
                      className="bg-indigo-950/50 hover:bg-indigo-900/50 disabled:opacity-50 text-indigo-400 hover:text-indigo-300 text-[10px] uppercase font-bold py-1.5 px-3 rounded-lg border border-indigo-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Descargar Propuesta Comercial"
                    >
                      <Download className="w-3.5 h-3.5 animate-bounce" />
                      <span>{proposalPrinting['comercial'] ? 'Generando...' : 'Propuesta Comercial'}</span>
                    </button>
                    <button 
                      onClick={() => handlePrintProposal('tecnica')}
                      disabled={proposalPrinting['tecnica']}
                      className="bg-emerald-950/50 hover:bg-emerald-900/50 disabled:opacity-50 text-emerald-400 hover:text-emerald-300 text-[10px] uppercase font-bold py-1.5 px-3 rounded-lg border border-emerald-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Descargar Propuesta Técnica"
                    >
                      <Download className="w-3.5 h-3.5 animate-bounce" />
                      <span>{proposalPrinting['tecnica'] ? 'Generando...' : 'Propuesta Técnica'}</span>
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                <div className="space-y-4 text-xs text-zinc-300 max-h-72 overflow-y-auto pr-2">
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase">Descripción del Alcance</div>
                    <p className="leading-relaxed">{analysisData.proposal.description}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase">Objetivos Técnicos</div>
                    <ul className="list-disc pl-4 space-y-1">
                      {analysisData.proposal.objectives?.map((obj: string, i: number) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase">Funciones Integradas</div>
                    <ul className="list-decimal pl-4 space-y-1">
                      {analysisData.proposal.features?.map((feat: string, i: number) => (
                        <li key={i}>{feat}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase">Tecnologías de Producción</div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {analysisData.proposal.technologies?.map((tech: string, i: number) => (
                        <span key={i} className="bg-zinc-850 text-zinc-400 px-2 py-0.5 rounded text-[9px] border border-zinc-800">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom line meta */}
                <div className="pt-3 border-t border-zinc-800 flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>TIEMPO DE ENTREGA: {analysisData.proposal.timeline}</span>
                  <span>PRESUPUESTO: ${analysisData.proposal.cost.toLocaleString('es-MX')} MXN</span>
                </div>
              </div>

              {/* Plan Recommended Selector */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Selecciona tu Plan Comercial</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Starter */}
                  <div 
                    onClick={() => setSelectedPlan('Starter')}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedPlan === 'Starter' 
                        ? 'bg-zinc-900 border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.1)]' 
                        : 'bg-zinc-950 border-zinc-850 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">Starter</div>
                    <div className="text-lg font-mono font-bold text-indigo-400 mt-1">
                      ${paymentSettings.plans.Starter.cost.toLocaleString('es-MX')} MXN
                    </div>
                    <p className="text-[9px] text-emerald-400 mt-1.5 font-bold leading-tight">{paymentSettings.plans.Starter.promo}</p>
                    <div className="h-px bg-zinc-800 my-2.5"></div>
                    <ul className="text-[9px] text-zinc-400 space-y-1">
                      {analysisData.proposal.plans.Starter.features.slice(0, 3).map((f: string, i: number) => (
                        <li key={i} className="flex items-center gap-1">
                          <Check className="w-2.5 h-2.5 text-indigo-400" />
                          <span className="truncate">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Business (Recommended) */}
                  <div 
                    onClick={() => setSelectedPlan('Business')}
                    className={`p-4 rounded-xl border relative transition-all cursor-pointer ${
                      selectedPlan === 'Business' 
                        ? 'bg-indigo-950/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                        : 'bg-zinc-950 border-zinc-850 hover:border-zinc-700'
                    }`}
                  >
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Recomendado
                    </div>
                    <div className="text-xs font-bold text-white">Business</div>
                    <div className="text-lg font-mono font-bold text-indigo-400 mt-1">
                      ${paymentSettings.plans.Business.cost.toLocaleString('es-MX')} MXN
                    </div>
                    <p className="text-[9px] text-emerald-400 mt-1.5 font-bold leading-tight">{paymentSettings.plans.Business.promo}</p>
                    <div className="h-px bg-zinc-800 my-2.5"></div>
                    <ul className="text-[9px] text-zinc-400 space-y-1">
                      {analysisData.proposal.plans.Business.features.slice(0, 4).map((f: string, i: number) => (
                        <li key={i} className="flex items-center gap-1">
                          <Check className="w-2.5 h-2.5 text-indigo-400" />
                          <span className="truncate">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Enterprise */}
                  <div 
                    onClick={() => setSelectedPlan('Enterprise')}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedPlan === 'Enterprise' 
                        ? 'bg-zinc-900 border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.1)]' 
                        : 'bg-zinc-950 border-zinc-850 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">Enterprise</div>
                    <div className="text-lg font-mono font-bold text-indigo-400 mt-1">
                      ${paymentSettings.plans.Enterprise.cost.toLocaleString('es-MX')} MXN
                    </div>
                    <p className="text-[9px] text-emerald-400 mt-1.5 font-bold leading-tight">{paymentSettings.plans.Enterprise.promo}</p>
                    <div className="h-px bg-zinc-800 my-2.5"></div>
                    <ul className="text-[9px] text-zinc-400 space-y-1">
                      {analysisData.proposal.plans.Enterprise.features.slice(0, 3).map((f: string, i: number) => (
                        <li key={i} className="flex items-center gap-1">
                          <Check className="w-2.5 h-2.5 text-indigo-400" />
                          <span className="truncate">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Anticipo & Checkout Trigger */}
              <div className="bg-zinc-900/40 rounded-xl border border-zinc-800 p-5 space-y-4 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
                {showAuthForm ? (
                  <form onSubmit={handleAuthSubmit} className="space-y-4 animate-fade-in text-left">
                    <div className="border-b border-zinc-850 pb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-indigo-400">
                        <Lock className="w-4 h-4" />
                        <h4 className="text-xs font-bold uppercase tracking-wider">Registro de Seguridad del Cliente</h4>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => { setShowAuthForm(false); setRegError(null); }}
                        className="text-zinc-500 hover:text-zinc-300 text-[10px] uppercase font-mono tracking-wider cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>

                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      Por seguridad corporativa y control legal, debes registrar los datos de tu negocio antes de proceder con el pago del anticipo. Esto te identificará formalmente en las propuestas y creará tu acceso inmediato al monitoreo live del proyecto.
                    </p>

                    {/* Tabs */}
                    <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-950 rounded-lg border border-zinc-850">
                      <button
                        type="button"
                        onClick={() => { setAuthTab('register'); setRegError(null); }}
                        className={`py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${authTab === 'register' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Crear Cuenta Cliente
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAuthTab('login'); setRegError(null); }}
                        className={`py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${authTab === 'login' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Ya tengo Cuenta
                      </button>
                    </div>

                    {regError && (
                      <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-400 flex items-center gap-2 animate-fade-in">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        <span>{regError}</span>
                      </div>
                    )}

                    <div className="space-y-3">
                      {authTab === 'register' && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-1 tracking-wider">Nombre de tu Negocio *</label>
                              <div className="relative">
                                <Building2 className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                                <input
                                  type="text"
                                  value={regBusiness}
                                  onChange={(e) => {
                                    setRegBusiness(e.target.value);
                                    setCustomBusinessName(e.target.value); // Live updates proposals and PDFs!
                                  }}
                                  placeholder="Ej. Mi Negocio S.A."
                                  className="w-full bg-zinc-950 border border-zinc-850 rounded-lg py-2 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
                                  required
                                />
                              </div>
                              <span className="text-[8px] text-zinc-500 mt-1 block leading-tight">Las propuestas técnicas y el membrete se actualizarán con este nombre.</span>
                            </div>

                            <div>
                              <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-1 tracking-wider">Tu Nombre Completo *</label>
                              <div className="relative">
                                <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                                <input
                                  type="text"
                                  value={regName}
                                  onChange={(e) => setRegName(e.target.value)}
                                  placeholder="Ej. Juan Pérez"
                                  className="w-full bg-zinc-950 border border-zinc-850 rounded-lg py-2 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                                  required
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-1 tracking-wider">Correo Electrónico *</label>
                              <div className="relative">
                                <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                                <input
                                  type="email"
                                  value={regEmail}
                                  onChange={(e) => setRegEmail(e.target.value)}
                                  placeholder="juan@ejemplo.com"
                                  className="w-full bg-zinc-950 border border-zinc-850 rounded-lg py-2 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                                  required
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-1 tracking-wider">Teléfono (WhatsApp) *</label>
                              <div className="relative">
                                <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                                <input
                                  type="tel"
                                  value={regPhone}
                                  onChange={(e) => setRegPhone(e.target.value)}
                                  placeholder="+52 55 1234 5678"
                                  className="w-full bg-zinc-950 border border-zinc-850 rounded-lg py-2 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {authTab === 'login' && (
                        <div>
                          <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-1 tracking-wider">Correo Electrónico registrado</label>
                          <div className="relative">
                            <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                            <input
                              type="email"
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              placeholder="juan@ejemplo.com"
                              className="w-full bg-zinc-950 border border-zinc-850 rounded-lg py-2 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                              required
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[9px] text-zinc-500 uppercase font-mono mb-1 tracking-wider">Contraseña de Acceso *</label>
                        <div className="relative">
                          <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                          <input
                            type={showPassword ? "text" : "password"}
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-lg py-2 pl-8 pr-10 text-xs text-white focus:outline-none focus:border-indigo-500"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isRegLoading}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer mt-2"
                    >
                      {isRegLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Identificando y Autenticando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{authTab === 'register' ? 'Registrarme e Iniciar Pago' : 'Acceder e Iniciar Pago'}</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase">¿Quieres pagar el anticipo?</h4>
                        <p className="text-[10px] text-zinc-400 mt-1">Suscripción e inicio de desarrollo con el 50% del plan seleccionado</p>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-[10px] text-zinc-500 uppercase font-mono">Pago Inicial (Anticipo 50%)</div>
                        <div className="text-xl font-bold font-mono text-emerald-400">
                          ${Math.round((paymentSettings.plans[selectedPlan]?.cost || 15000) * 0.5).toLocaleString('es-MX')} MXN
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        onClick={() => handleSelectPayment('mercadopago')}
                        className={`text-xs font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          paymentMethod === 'mercadopago'
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border border-zinc-700'
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>Mercado Pago</span>
                      </button>

                      <button
                        onClick={() => handleSelectPayment('transferencia')}
                        className={`text-xs font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          paymentMethod === 'transferencia'
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-zinc-700'
                        }`}
                      >
                        <Landmark className="w-4 h-4" />
                        <span>SPEI / Transferencia</span>
                      </button>

                      <button
                        onClick={() => handleSelectPayment('deposito')}
                        className={`text-xs font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          paymentMethod === 'deposito'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700'
                        }`}
                      >
                        <Coins className="w-4 h-4" />
                        <span>Depósito Bancario</span>
                      </button>
                    </div>

                    {/* Display payment forms if cash methods selected */}
                    {paymentMethod === 'mercadopago' && (
                      <div className="bg-zinc-950 p-4 rounded-xl border border-cyan-500/20 text-center space-y-3 animate-fade-in">
                        <div className="text-xs font-semibold text-white">Pago Seguro vía Mercado Pago</div>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                          Haz clic en el siguiente enlace seguro de Mercado Pago para liquidar tu anticipo de <strong>${Math.round((paymentSettings.plans[selectedPlan]?.cost || 15000) * 0.5).toLocaleString('es-MX')} MXN</strong>:
                        </p>
                        
                        <div className="py-2">
                          <a 
                            href={paymentSettings.mercadoPagoLink}
                            target="_blank"
                            referrerPolicy="no-referrer"
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold px-5 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all transform hover:scale-102 cursor-pointer shadow-md shadow-cyan-500/10"
                          >
                            <Smartphone className="w-4 h-4" />
                            Pagar con Mercado Pago
                          </a>
                        </div>
                        
                        <div className="h-px bg-zinc-900 my-2"></div>
                        <p className="text-[10px] text-zinc-500">Una vez completado el pago en el portal de Mercado Pago, regresa aquí y confirma para iniciar tu aprovisionamiento instantáneo.</p>
                        <button 
                          onClick={handleConfirmSuccessfulPayment}
                          className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-bold py-2 rounded transition-colors cursor-pointer"
                        >
                          Confirmar Pago en Pantalla
                        </button>
                      </div>
                    )}

                    {paymentMethod === 'transferencia' && (
                      <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-700 space-y-3 animate-fade-in text-xs">
                        <div className="font-semibold text-white">Datos de Transferencia Bancaria (SPEI)</div>
                        <div className="space-y-1.5 text-[11px] text-zinc-400 bg-zinc-900/60 p-3 rounded border border-zinc-800 text-left">
                          <div><strong>Banco:</strong> {paymentSettings.transferAccount.banco}</div>
                          <div className="flex items-center justify-between">
                            <div><strong>CLABE Interbancaria:</strong> <span className="font-mono text-white text-xs">{paymentSettings.transferAccount.clabe}</span></div>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(paymentSettings.transferAccount.clabe);
                                alert('¡CLABE copiada!');
                              }}
                              className="text-[9px] bg-slate-800 text-slate-300 hover:bg-slate-700 px-1.5 py-0.5 rounded transition-colors"
                            >
                              Copiar
                            </button>
                          </div>
                          <div><strong>Beneficiario:</strong> {paymentSettings.transferAccount.beneficiario}</div>
                          <div><strong>Concepto de Pago:</strong> ANTICIPO {customBusinessName.substring(0, 10).toUpperCase()}</div>
                        </div>
                        <p className="text-[10px] text-zinc-500">Transfiere la cantidad exacta de <strong>${Math.round((paymentSettings.plans[selectedPlan]?.cost || 15000) * 0.5).toLocaleString('es-MX')} MXN</strong> y oprime confirmar.</p>
                        <button 
                          onClick={handleConfirmSuccessfulPayment}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 rounded transition-colors cursor-pointer"
                        >
                          Confirmar Transferencia Realizada
                        </button>
                      </div>
                    )}

                    {paymentMethod === 'deposito' && (
                      <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-700 space-y-3 animate-fade-in text-xs">
                        <div className="font-semibold text-white">Datos de Depósito Bancario</div>
                        <div className="space-y-1.5 text-[11px] text-zinc-400 bg-zinc-900/60 p-3 rounded border border-zinc-800 text-left">
                          <div><strong>Banco:</strong> {paymentSettings.depositAccount.banco}</div>
                          <div className="flex items-center justify-between">
                            <div><strong>Número de Cuenta:</strong> <span className="font-mono text-white text-xs">{paymentSettings.depositAccount.cuenta}</span></div>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(paymentSettings.depositAccount.cuenta);
                                alert('¡Cuenta copiada!');
                              }}
                              className="text-[9px] bg-slate-800 text-slate-300 hover:bg-slate-700 px-1.5 py-0.5 rounded transition-colors"
                            >
                              Copiar
                            </button>
                          </div>
                          <div><strong>Beneficiario:</strong> {paymentSettings.depositAccount.beneficiario}</div>
                          <div><strong>Concepto de Pago:</strong> DEPOSITO {customBusinessName.substring(0, 10).toUpperCase()}</div>
                        </div>
                        <p className="text-[10px] text-zinc-500">Deposita la cantidad exacta de <strong>${Math.round((paymentSettings.plans[selectedPlan]?.cost || 15000) * 0.5).toLocaleString('es-MX')} MXN</strong> en ventanilla o corresponsal y oprime confirmar.</p>
                        <button 
                          onClick={handleConfirmSuccessfulPayment}
                          className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-1.5 rounded transition-colors cursor-pointer"
                        >
                          Confirmar Depósito Realizado
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Right Hand: Customized Cellular Prototype Mockup Preview */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <span className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-2">Simulación de Prototipo Generado</span>
              
              {/* Smartphone Container Mockup */}
              <div className="w-full max-w-[320px] bg-zinc-950 rounded-[40px] border-[10px] border-zinc-800 p-2 shadow-2xl relative">
                
                {/* Speaker top notch */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-800 h-4 w-28 rounded-full z-15 flex items-center justify-center">
                  <div className="bg-zinc-950 h-1 w-8 rounded-full"></div>
                </div>

                {/* Simulated Screen */}
                <div className="bg-zinc-950 rounded-[32px] overflow-hidden min-h-[500px] flex flex-col relative text-zinc-100 selection:bg-indigo-500/10">
                  
                  {/* Status Bar */}
                  <div className="h-8 bg-zinc-950 flex items-center justify-between px-6 pt-3 text-[9px] font-mono text-zinc-400">
                    <span>10:20 AM</span>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-1.5 bg-emerald-500 rounded-sm"></span>
                      <span>5G</span>
                    </div>
                  </div>

                  {/* App Header (colored dynamically by analysis colors!) */}
                  <div 
                    className="p-4 pt-2 text-center text-white relative shadow-md"
                    style={{ 
                      background: `linear-gradient(135deg, ${analysisData.recommendedColors?.primary || '#4f46e5'}ee, ${analysisData.recommendedColors?.primary || '#4f46e5'}88)`
                    }}
                  >
                    <h3 className="font-extrabold text-sm tracking-tight drop-shadow-sm">
                      {analysisData.mockup?.title || customBusinessName}
                    </h3>
                    <p className="text-[9px] opacity-80 italic">
                      {analysisData.mockup?.subtitle || 'PWA Inteligente'}
                    </p>
                  </div>

                  {/* Smartphone App Body Contents */}
                  <div className="flex-1 p-3.5 space-y-3 overflow-y-auto max-h-[380px] bg-zinc-950 text-left">
                    
                    {/* Simulated Push Notification Toast inside the App */}
                    <AnimatePresence>
                      {mockupNotification && (
                        <motion.div 
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="bg-indigo-950 border border-indigo-500 p-2 rounded-lg text-[9px] text-indigo-200 shadow-md flex items-start gap-1.5 z-20 relative"
                        >
                          <Bell className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                          <span>{mockupNotification}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {(() => {
                      const tabs = analysisData?.mockup?.tabs || defaultMockupTabs;
                      
                      // Handle explicit log console tab
                      if (mockupTab === '__console__') {
                        return (
                          <div className="space-y-2 animate-fade-in text-[10px] font-mono">
                            <div className="text-xs font-bold text-white mb-2 font-sans">Logs de Sincronización</div>
                            <div className="bg-black/80 rounded-xl p-2.5 max-h-[220px] overflow-y-auto space-y-1.5 border border-zinc-850 text-emerald-400 text-[8px] leading-relaxed">
                              {mockupLogs.map((log, i) => (
                                <div key={i} className="flex gap-1.5">
                                  <span className="text-zinc-600">[{new Date().toLocaleTimeString().slice(0, 5)}]</span>
                                  <span className="flex-1 truncate">{log}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      const activeTab = tabs.find((t: any) => t.id === mockupTab) || tabs[0];
                      if (!activeTab) return null;

                      const { type, content } = activeTab;

                      // TYPE: DASHBOARD
                      if (type === 'dashboard') {
                        return (
                          <div className="space-y-3.5 animate-fade-in text-[11px]">
                            <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-850 space-y-1">
                              <span className="text-zinc-500 text-[9px] uppercase font-mono">Panel Principal</span>
                              <div className="font-bold text-white text-xs">{content?.welcomeTitle || "¡Hola Elena!"}</div>
                              <p className="text-[10px] text-zinc-400">{content?.welcomeSubtitle || "Estado de Sincronización"}</p>
                            </div>

                            {/* Analysis custom cards */}
                            <div className="grid grid-cols-2 gap-2">
                              {content?.cards?.map((card: any, i: number) => (
                                <div key={i} className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-850 space-y-1 flex flex-col justify-between min-h-[75px]">
                                  <div className="flex items-center justify-between text-zinc-400 text-[9px] font-semibold truncate">
                                    <span className="truncate max-w-[80px]">{card.title}</span>
                                    <div style={{ color: analysisData?.recommendedColors?.secondary || '#10b981' }}>
                                      {renderLucideIcon(card.icon, "w-3 h-3")}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="font-bold text-white font-mono text-[11px] truncate">{card.value}</div>
                                    <p className="text-[8px] text-zinc-500 leading-tight truncate">{card.desc}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      // TYPE: CATALOG
                      if (type === 'catalog') {
                        return (
                          <div className="space-y-3.5 animate-fade-in text-[11px]">
                            <div className="text-xs font-bold text-white mb-1 flex items-center justify-between">
                              <span>{content?.catalogTitle || "Catálogo de Servicios"}</span>
                              <span className="text-[8px] text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">Autoservicio</span>
                            </div>
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
                              {content?.items?.map((item: any, i: number) => (
                                <div key={i} className="p-2.5 bg-zinc-900 rounded-xl border border-zinc-850 flex items-center justify-between gap-2">
                                  <div className="space-y-0.5 flex-1 min-w-0">
                                    <div className="font-bold text-white text-[10px] flex items-center gap-1.5">
                                      <span>{item.emoji || "📦"}</span>
                                      <span className="truncate">{item.name}</span>
                                    </div>
                                    <p className="text-[8px] text-zinc-500 truncate">{item.desc}</p>
                                    <div className="text-[9px] font-mono font-bold text-indigo-400">${item.price} MXN</div>
                                  </div>
                                  <button
                                    onClick={() => handleMockCatalogPurchase(item.name, item.price, item.emoji)}
                                    className="bg-zinc-850 hover:bg-zinc-800 text-zinc-200 text-[8px] px-2 py-1 rounded border border-zinc-700 font-bold transition-colors shrink-0 cursor-pointer"
                                  >
                                    {content?.buttonText || "Elegir"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      // TYPE: FORM
                      if (type === 'form') {
                        return (
                          <div className="space-y-3 animate-fade-in text-[11px]">
                            <div className="text-xs font-bold text-white mb-1 flex items-center gap-1">
                              {renderLucideIcon(activeTab.icon, "w-3.5 h-3.5 text-indigo-400")}
                              <span>{content?.formTitle || "Formulario de Solicitud"}</span>
                            </div>

                            <form onSubmit={(e) => handleMockFormSubmit(e, activeTab.id, content)} className="space-y-2 bg-zinc-900 p-2.5 rounded-xl border border-zinc-850">
                              {content?.formFields?.map((field: any, i: number) => (
                                <div key={i} className="space-y-1">
                                  <label className="text-[8px] text-zinc-400 uppercase font-mono block">{field.label}</label>
                                  {field.type === 'select' ? (
                                    <div className="relative">
                                      <select
                                        value={mockFormValues[`${activeTab.id}_${field.name}`] || ''}
                                        onChange={(e) => setMockFormValues(prev => ({ ...prev, [`${activeTab.id}_${field.name}`]: e.target.value }))}
                                        className="w-full bg-zinc-950 border border-zinc-800 text-[10px] px-2 py-1.5 rounded outline-none text-white focus:border-indigo-500 appearance-none cursor-pointer"
                                        required
                                      >
                                        <option value="">Seleccione opción...</option>
                                        {field.options?.map((opt: string, idx: number) => (
                                          <option key={idx} value={opt}>{opt}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : (
                                    <input 
                                      type="text" 
                                      required
                                      value={mockFormValues[`${activeTab.id}_${field.name}`] || ''}
                                      onChange={(e) => setMockFormValues(prev => ({ ...prev, [`${activeTab.id}_${field.name}`]: e.target.value }))}
                                      placeholder={field.placeholder || "Escribe aquí..."} 
                                      className="w-full bg-zinc-950 border border-zinc-800 text-[10px] px-2 py-1.5 rounded outline-none text-white placeholder-zinc-700 focus:border-indigo-500"
                                    />
                                  )}
                                </div>
                              ))}

                              <button 
                                type="submit" 
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold py-1.5 px-2 rounded-md cursor-pointer transition-colors mt-1"
                              >
                                {content?.buttonText || "Enviar Solicitud"}
                              </button>
                            </form>
                          </div>
                        );
                      }

                      // TYPE: RECORDS
                      if (type === 'records') {
                        const recordsToRender = customRecords.length > 0 ? customRecords : (content?.initialRecords || []);
                        return (
                          <div className="space-y-2.5 animate-fade-in text-[11px]">
                            <div className="text-xs font-bold text-white mb-1 flex items-center justify-between">
                              <span>{content?.recordsTitle || "Lista de Registros"}</span>
                              <span className="text-[8px] bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-mono">Base de Datos</span>
                            </div>

                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
                              {recordsToRender.map((record: any, idx: number) => (
                                <div key={record.id || idx} className="p-2 bg-zinc-900 rounded-lg border border-zinc-850 flex items-center justify-between gap-1.5 hover:bg-zinc-850 transition-colors">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-white text-[10px] truncate">{record.title}</div>
                                    <div className="text-[8px] text-zinc-500 truncate">{record.subtitle}</div>
                                  </div>
                                  <span className="text-[9px] font-mono bg-zinc-950 text-indigo-400 px-1.5 py-0.5 rounded border border-zinc-850 whitespace-nowrap shrink-0">
                                    {record.badge}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      // TYPE: TRACKER
                      if (type === 'tracker') {
                        const steps = content?.steps || ["Pendiente", "Procesando", "Completado"];
                        const currentStep = steps[customTrackerStep % steps.length];
                        return (
                          <div className="space-y-3 animate-fade-in text-[11px]">
                            <div className="text-xs font-bold text-white mb-1 flex items-center justify-between">
                              <span>{content?.trackerTitle || "Estatus del Servicio"}</span>
                              <span className="text-[8px] text-zinc-500">Actualización en vivo</span>
                            </div>

                            <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-3 space-y-3">
                              <div className="space-y-0.5">
                                <span className="text-[8px] font-mono text-zinc-500 uppercase">Orden de Trabajo</span>
                                <div className="text-[10px] font-bold text-zinc-100">{content?.activeProcessName || "Servicio en Curso"}</div>
                              </div>

                              {/* Stepper Display */}
                              <div className="space-y-2.5 relative pl-3.5 border-l border-zinc-800 ml-1.5">
                                {steps.map((st: string, idx: number) => {
                                  const isActive = idx === customTrackerStep;
                                  const isCompleted = idx < customTrackerStep;
                                  return (
                                    <div key={idx} className="relative text-[9px]">
                                      {/* Stepper Node Bullet */}
                                      <div 
                                        className="absolute -left-[19.5px] top-1 w-2.5 h-2.5 rounded-full border flex items-center justify-center transition-colors duration-300"
                                        style={{
                                          backgroundColor: isActive ? (analysisData?.recommendedColors?.secondary || '#10b981') : isCompleted ? (analysisData?.recommendedColors?.primary || '#4f46e5') : '#18181b',
                                          borderColor: isActive || isCompleted ? 'transparent' : '#27272a'
                                        }}
                                      >
                                        {isCompleted && <Check className="w-1.5 h-1.5 text-white stroke-[3px]" />}
                                      </div>
                                      <span className={`font-semibold ${isActive ? 'text-white font-bold' : isCompleted ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                        {st}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAdvanceTrackerStep(steps)}
                                className="w-full bg-zinc-850 hover:bg-zinc-800 text-zinc-100 text-[9px] py-1.5 rounded border border-zinc-750 font-bold transition-colors cursor-pointer"
                              >
                                Simular Avance de Estado 🔄
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // TYPE: CHAT (IA BOT)
                      if (type === 'chat') {
                        return (
                          <div className="flex flex-col h-[270px] animate-fade-in text-[10px]">
                            <div className="text-xs font-bold text-zinc-200 mb-1 flex items-center gap-1">
                              <Bot className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{content?.chatTitle || "Asistente Inteligente PWA"}</span>
                            </div>

                            {/* Chat bubble screen area */}
                            <div className="flex-1 bg-zinc-950/60 border border-zinc-850 rounded-xl p-2.5 overflow-y-auto space-y-2 max-h-[170px] min-h-[140px]">
                              {chatMessages.map((msg, i) => (
                                <div 
                                  key={i} 
                                  className={`p-2 rounded-lg text-[9px] max-w-[85%] leading-snug break-words ${
                                    msg.sender === 'user' 
                                      ? 'bg-indigo-600/30 border border-indigo-500/20 text-indigo-100 ml-auto' 
                                      : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                                  }`}
                                >
                                  <div className="font-bold text-[8px] text-zinc-500 mb-0.5">
                                    {msg.sender === 'user' ? 'Tú' : (content?.botName || 'Asistente IA')}
                                  </div>
                                  {msg.text}
                                </div>
                              ))}
                              
                              {chatIsTyping && (
                                <div className="bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-[9px] max-w-[50px] text-zinc-500 italic animate-pulse">
                                  ...
                                </div>
                              )}
                            </div>

                            {/* Clickable Quick Questions */}
                            <div className="mt-2 space-y-1">
                              <span className="text-[7.5px] text-zinc-500 uppercase font-mono block pl-1">Preguntas Predefinidas (IA)</span>
                              <div className="flex flex-wrap gap-1">
                                {content?.predefinedResponses?.map((resp: any, i: number) => (
                                  <button
                                    type="button"
                                    key={i}
                                    onClick={() => handleSelectChatOption(resp.userMessage, resp.botReply)}
                                    disabled={chatIsTyping}
                                    className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[8.5px] text-zinc-300 px-2 py-1 rounded transition-colors cursor-pointer text-left truncate max-w-[130px]"
                                  >
                                    💬 {resp.userMessage}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })()}

                  </div>

                  {/* Smartphone Navigation Bar */}
                  <div className="h-14 border-t border-zinc-900 bg-zinc-950 flex items-center justify-around px-2 text-[9px]">
                    {(() => {
                      const tabs = analysisData?.mockup?.tabs || defaultMockupTabs;
                      return tabs.map((tab: any) => {
                        const isSelected = mockupTab === tab.id;
                        return (
                          <button 
                            type="button"
                            key={tab.id}
                            onClick={() => setMockupTab(tab.id)}
                            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors max-w-[65px] ${
                              isSelected 
                                ? 'text-indigo-400 font-bold' 
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            <div className="p-0.5">
                              {renderLucideIcon(tab.icon, `w-4 h-4 ${isSelected ? 'scale-110' : ''}`)}
                            </div>
                            <span className="truncate max-w-[60px] text-[8px]">{tab.label}</span>
                          </button>
                        );
                      });
                    })()}
                    
                    {/* Persistent synchronization / logs tab console toggle */}
                    <button 
                      type="button"
                      onClick={() => setMockupTab('__console__')}
                      className={`flex flex-col items-center gap-1 cursor-pointer transition-colors max-w-[65px] ${
                        mockupTab === '__console__' 
                          ? 'text-indigo-400 font-bold' 
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <div className="p-0.5">
                        <Activity className={`w-4 h-4 ${mockupTab === '__console__' ? 'scale-110' : ''}`} />
                      </div>
                      <span className="truncate max-w-[60px] text-[8px]">Logs</span>
                    </button>
                  </div>

                </div>

                {/* Smartphone Home Button bar */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-24 bg-zinc-800 rounded-full"></div>
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
