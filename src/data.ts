import { ProjectOrder, StepperStep, SupportTicket, ChatMessage, UserProfile, PaymentSettings } from './types';

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  mercadoPagoLink: 'https://link.mercadopago.com.mx/kidria',
  depositAccount: {
    banco: 'BBVA Bancomer',
    cuenta: '0123 4567 8901 2345',
    beneficiario: 'KIDRIA Applications S.A. de C.V.'
  },
  transferAccount: {
    banco: 'STP (Sistema de Transferencias y Pagos)',
    clabe: '1381 8000 0294 3810 49',
    beneficiario: 'KIDRIA Applications S.A. de C.V.'
  },
  plans: {
    Starter: { cost: 7990, monthly: 599, promo: '10% de descuento en contratación inmediata' },
    Business: { cost: 14990, monthly: 999, promo: 'Primer mes de soporte y servidores GRATIS' },
    PremiumIA: { cost: 24990, monthly: 1999, promo: 'Dominio .app e IA conversacional sin costo adicional' },
    Enterprise: { cost: 39990, monthly: 3999, promo: 'Soporte 24/7 de alta prioridad y SLAs del 99.99%' }
  }
};


// Steps specified by the user
export const STEPPER_STEPS: StepperStep[] = [
  {
    id: 'step_diseno',
    nombre: 'Diseño e identidad',
    porcentaje: 10,
    completed: false,
    descripcion: 'Definición de paleta de colores, tipografías, maquetación de pantallas y diseño visual de la PWA.',
    fecha: '2026-06-10',
    hora: '14:30',
    responsable: 'Sofia Mendez (Lead UI Designer)',
    notas: 'Paleta seleccionada y aprobada por el cliente. Estilo visual elegante y de alta conversión.',
    archivos: ['figma_visual_assets.pdf', 'branding_guide.png']
  },
  {
    id: 'step_db',
    nombre: 'Base de datos',
    porcentaje: 20,
    completed: false,
    descripcion: 'Diseño del esquema de base de datos relacional y configuración de colecciones óptimas en Firestore.',
    fecha: '2026-06-12',
    hora: '11:00',
    responsable: 'Carlos Ortega (Database Engineer)',
    notas: 'Estructura e índices creados para soportar alta transaccionalidad y búsquedas eficientes.',
    archivos: ['db_schema_v1.pdf']
  },
  {
    id: 'step_backend',
    nombre: 'Desarrollo Backend',
    porcentaje: 30,
    completed: false,
    descripcion: 'Creación de endpoints de API REST, controladores lógicos de negocio y flujos seguros de datos.',
    fecha: '2026-06-15',
    hora: '18:00',
    responsable: 'Marta Gomez (Backend Architect)',
    notas: 'Rutas seguras y middleware de control de peticiones integrados en el core del servidor Express.',
    archivos: []
  },
  {
    id: 'step_frontend',
    nombre: 'Desarrollo Frontend',
    porcentaje: 40,
    completed: false,
    descripcion: 'Maquetación responsiva e interactiva de la interfaz de usuario en React, Tailwind CSS y motion.',
    fecha: '2026-06-18',
    hora: '16:15',
    responsable: 'Lucas Prieto (Senior Frontend Developer)',
    notas: 'Todas las pantallas adaptativas y transiciones fluidas de navegación están implementadas.',
    archivos: ['frontend_milestone_demo.mp4']
  },
  {
    id: 'step_auth',
    nombre: 'Autenticación',
    porcentaje: 50,
    completed: false,
    descripcion: 'Implementación de flujos de seguridad con Firebase Auth, control de accesos, roles y permisos específicos.',
    fecha: '2026-06-20',
    hora: '10:00',
    responsable: 'Marta Gomez (Backend Architect)',
    notas: 'Control de sesiones activo, validaciones por token y reglas de seguridad aplicadas a nivel base.',
    archivos: []
  },
  {
    id: 'step_stripe',
    nombre: 'Integración Stripe',
    porcentaje: 60,
    completed: false,
    descripcion: 'Conexión con pasarela Stripe Connect, flujo de checkout seguro y portal autogestionable de suscripciones.',
    fecha: '2026-06-22',
    hora: '15:45',
    responsable: 'Tomas Ruiz (SaaS Integrations Expert)',
    notas: 'Webhooks configurados correctamente para procesar cobros automáticos estables y cancelaciones.',
    archivos: ['stripe_test_logs.txt']
  },
  {
    id: 'step_ia',
    nombre: 'Inteligencia Artificial',
    porcentaje: 70,
    completed: false,
    descripcion: 'Entrenamiento de modelos con Gemini AI para recomendación inteligente de productos, chatbot autónomo e insights.',
    fecha: '2026-06-24',
    hora: '09:30',
    responsable: 'AI Integration Bot',
    notas: 'Módulo cognitivo conectado con las bases de datos de inventario del negocio para respuestas precisas.',
    archivos: []
  },
  {
    id: 'step_pruebas',
    nombre: 'Pruebas',
    porcentaje: 80,
    completed: false,
    descripcion: 'Pruebas de estrés, flujos de extremo a extremo, pruebas de integración y emulación móvil de la PWA.',
    fecha: '2026-06-26',
    hora: '11:15',
    responsable: 'Sofia Mendez (Lead UI Designer)',
    notas: 'Comenzando ciclos de testing para asegurar total estabilidad en sistemas iOS y Android.',
    archivos: []
  },
  {
    id: 'step_optimization',
    nombre: 'Optimización',
    porcentaje: 90,
    completed: false,
    descripcion: 'Optimización SEO avanzada, tiempos de carga súper veloces (LCP < 1.2s) y compresión de assets de imagen.',
    fecha: '2026-06-27',
    hora: '10:00',
    responsable: 'Lucas Prieto (Senior Frontend Developer)',
    notas: 'Preparado para refactorizar y comprimir el bundle en cuanto pasen las pruebas.',
    archivos: []
  },
  {
    id: 'step_publicacion',
    nombre: 'Publicación',
    porcentaje: 95,
    completed: false,
    descripcion: 'Puesta en producción del servidor Cloud, redirección de dominio formal con certificado SSL activo.',
    fecha: '2026-06-28',
    hora: '09:00',
    responsable: 'Marta Gomez (Backend Architect)',
    notas: 'Configuración DNS lista, hosting auto-escalable en contenedor Docker listo para producción.',
    archivos: []
  },
  {
    id: 'step_entrega',
    nombre: 'Entrega',
    porcentaje: 100,
    completed: false,
    descripcion: 'Capacitación en vivo del cliente, entrega de manual de administración definitivo e inicio de garantía.',
    fecha: '2026-06-29',
    hora: '12:00',
    responsable: 'KIDRIA Team',
    notas: 'Hito final. Publicación y pase formal de llaves del software al cliente.',
    archivos: []
  }
];

export const INITIAL_PROFILES: UserProfile[] = [
  {
    uid: 'user_cliente_1',
    email: 'contacto@aurasalon.com',
    nombre: 'Ana Laura',
    empresa: 'Aura Belleza & Spa',
    logoUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=120',
    role: 'cliente',
    telefono: '+52 55 4321 8765',
    giro: 'Salón de Belleza, Barbería y Spa',
    colores: {
      primary: '#0f172a', // slate-900
      secondary: '#10b981' // emerald-500
    },
    dominioPropuesto: 'aurasalon.app',
    referralCode: 'KIDRIA-ANA-9230',
    referidosContratados: 3,
    referidosGanancia: 4500,
    twoFactorEnabled: false
  }
];

export const INITIAL_ORDERS: ProjectOrder[] = [
  {
    id: 'order_1',
    cliente: 'Ana Laura',
    correo: 'contacto@aurasalon.com',
    empresa: 'Aura Belleza & Spa',
    telefono: '+52 55 4321 8765',
    giro: 'Salón de Belleza, Barbería y Spa',
    proyecto: 'PWA Aura Salon & Spa Booking System',
    precioTotal: 15000,
    anticipo: 7500,
    saldoPendiente: 7500,
    estado: 'step_diseno', // starts from 0/first phase and advances as admin decrees
    fechaContratacion: '2026-06-05',
    fechaEntrega: '2026-07-05',
    mensualidad: 250,
    estadoStripe: 'active',
    estadoFirebase: 'pending',
    notasInternas: 'El cliente es muy receptivo. Prioridad en catálogo interactivo de servicios, reserva de turnos en línea y recordatorios push automáticos.',
    prioridad: 'alta',
    categoria: 'PWA Premium',
    observaciones: 'Requiere soporte de notificaciones push tanto en Android como iOS PWA.',
    responsableProyecto: 'Lucas Prieto (Senior Frontend Developer)',
    historial: [
      { id: 'h1', fecha: '2026-06-05 10:00', titulo: 'Proyecto Contratado', descripcion: 'Firma de contrato digital y pago de anticipo del 50%.', autor: 'Ingrid Becker' },
      { id: 'h2', fecha: '2026-06-10 16:00', titulo: 'Diseño UI Aprobado', descripcion: 'Manual de marca y prototipo interactivo de Figma aprobado por el cliente.', autor: 'Sofia Mendez' },
      { id: 'h3', fecha: '2026-06-15 11:30', titulo: 'Base de Datos Creada', descripcion: 'Despliegue inicial de colecciones en Firestore y configuración de reglas.', autor: 'Carlos Ortega' },
      { id: 'h4', fecha: '2026-06-22 17:00', titulo: 'Pasarela Stripe Configurada', descripcion: 'Checkout de pagos de prueba y suscripciones mensuales enlazadas con éxito.', autor: 'Tomas Ruiz' }
    ],
    archivos: [
      { id: 'f1', nombre: 'Contrato_Desarrollo_KIDRIA.pdf', categoria: 'contrato', url: '#', size: '2.4 MB', fecha: '2026-06-05' },
      { id: 'f2', nombre: 'Factura_Anticipo_F098.pdf', categoria: 'factura', url: '#', size: '1.1 MB', fecha: '2026-06-05' },
      { id: 'f3', nombre: 'Guia_Diseno_AuraSalon.pdf', categoria: 'branding', url: '#', size: '4.8 MB', fecha: '2026-06-10' },
      { id: 'f4', nombre: 'Manual_Administrador_v1.pdf', categoria: 'manual', url: '#', size: '3.1 MB', fecha: '2026-06-23' },
      { id: 'f5', nombre: 'AuraSalon_Beta_Build.apk', categoria: 'apk', url: '#', size: '28.4 MB', fecha: '2026-06-25' }
    ],
    facturas: [
      { id: 'inv_1', numero: 'INV-2026-001', concepto: 'Anticipo del 50% - Desarrollo PWA', monto: 7500, fechaEmision: '2026-06-05', fechaVencimiento: '2026-06-12', estado: 'pagada' },
      { id: 'inv_2', numero: 'INV-2026-002', concepto: 'Suscripción Mensual Soporte e IA - Junio', monto: 250, fechaEmision: '2026-06-05', fechaVencimiento: '2026-06-12', estado: 'pagada' },
      { id: 'inv_vencida', numero: 'INV-2026-003-SUB', concepto: 'Mensualidad Establecida Soporte y Servidores PWA', monto: 1500, fechaEmision: '2026-06-15', fechaVencimiento: '2026-06-25', estado: 'vencida' },
      { id: 'inv_3', numero: 'INV-2026-003', concepto: 'Suscripción Mensual Soporte e IA - Julio', monto: 250, fechaEmision: '2026-07-05', fechaVencimiento: '2026-07-12', estado: 'pendiente' },
      { id: 'inv_4', numero: 'INV-2026-004', concepto: 'Saldo Pendiente (50% a la Entrega)', monto: 7500, fechaEmision: '2026-07-05', fechaVencimiento: '2026-07-15', estado: 'pendiente' }
    ],
    contractSigned: true,
    contractSignedDate: '2026-06-05',
    contractSignature: 'Ana Laura'
  }
];

export const INITIAL_TICKETS: SupportTicket[] = [
  {
    id: 'ticket_1',
    title: 'Error de prueba en webhook de Stripe',
    description: 'A veces el webhook de renovación de suscripción devuelve un código 500 cuando el usuario es nuevo. Favor de verificar si el usuario se está creando en Firebase antes de recibir el evento de Stripe.',
    priority: 'alta',
    category: 'pagos',
    status: 'resuelto',
    createdAt: '2026-06-23 11:20',
    replies: [
      { id: 'tr1', senderName: 'Ana Laura', senderRole: 'cliente', message: 'Tuvimos este problema al registrar la tarjeta de prueba en el flujo.', fecha: '2026-06-23 11:20' },
      { id: 'tr2', senderName: 'Tomas Ruiz', senderRole: 'admin', message: 'Hola Ana, hemos corregido el webhook. El error era una carrera de tiempos (race condition) donde Stripe nos enviaba el evento antes de que se guardara el uid en la base de datos de Firestore. Ya fue solucionado.', fecha: '2026-06-23 15:45' }
    ],
    rating: 5,
    assignedTo: 'Tomas Ruiz'
  },
  {
    id: 'ticket_2',
    title: 'Detalle de notificaciones Push en Safari iOS',
    description: 'Las notificaciones push no se muestran de inmediato en mi iPhone, ¿se necesita instalar la app en la pantalla de inicio primero para que funcione?',
    priority: 'media',
    category: 'bugs',
    status: 'en_progreso',
    createdAt: '2026-06-26 14:10',
    replies: [
      { id: 'tr3', senderName: 'Ana Laura', senderRole: 'cliente', message: 'Sí, confirmamos que al instalar la PWA funciona mejor, pero queremos estar seguros de si hay algún paso adicional.', fecha: '2026-06-26 14:10' },
      { id: 'tr4', senderName: 'Lucas Prieto', senderRole: 'admin', message: 'Correcto, Ana. En iOS, las PWAs requieren agregarse a la pantalla de inicio para habilitar la API de Notificaciones Push. En el siguiente paso optimizaremos un modal popup que le enseñará al usuario exactamente cómo agregarlo en 2 clics.', fecha: '2026-06-26 16:30' }
    ],
    rating: null,
    assignedTo: 'Lucas Prieto'
  }
];

export const INITIAL_CHATS: ChatMessage[] = [
  { id: 'msg1', senderId: 'user_admin_1', senderName: 'Ingrid Becker', senderRole: 'admin', text: '¡Hola Ana Laura! Bienvenido a tu panel de KIDRIA. Aquí daremos seguimiento integral al desarrollo de Aura Belleza & Spa.', fecha: '2026-06-05 10:30', read: true },
  { id: 'msg2', senderId: 'user_cliente_1', senderName: 'Ana Laura', senderRole: 'cliente', text: 'Excelente, muchas gracias. Quedó firmado el contrato y realizado el pago del anticipo por Stripe.', fecha: '2026-06-05 10:45', read: true },
  { id: 'msg3', senderId: 'user_admin_1', senderName: 'Ingrid Becker', senderRole: 'admin', text: 'Perfecto, ya lo visualizamos en el CRM de KIDRIA. Empezamos de inmediato con el diseño de identidad y bases de datos.', fecha: '2026-06-05 11:00', read: true }
];

// Helper functions for persistent state (Local Storage wrapper)
export function getStoredState() {
  const isServer = typeof window === 'undefined';
  if (isServer) {
    return {
      profiles: INITIAL_PROFILES,
      orders: INITIAL_ORDERS,
      tickets: INITIAL_TICKETS,
      chats: INITIAL_CHATS,
      currentUser: INITIAL_PROFILES[0],
      stepperSteps: STEPPER_STEPS,
      settings: DEFAULT_PAYMENT_SETTINGS
    };
  }

  const loadData = <T>(key: string, defaultValue: T): T => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  };

  const saveData = <T>(key: string, data: T) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  const storedState = {
    profiles: loadData<UserProfile[]>('kidria_profiles', INITIAL_PROFILES),
    orders: loadData<ProjectOrder[]>('kidria_orders', INITIAL_ORDERS),
    tickets: loadData<SupportTicket[]>('kidria_tickets', INITIAL_TICKETS),
    chats: loadData<ChatMessage[]>('kidria_chats', INITIAL_CHATS),
    currentUser: loadData<UserProfile>('kidria_current_user', INITIAL_PROFILES[0]),
    stepperSteps: loadData<StepperStep[]>('kidria_stepper_steps', STEPPER_STEPS),
    settings: loadData<PaymentSettings>('kidria_settings', DEFAULT_PAYMENT_SETTINGS)
  };

  return {
    ...storedState,
    save: () => {
      saveData('kidria_profiles', storedState.profiles);
      saveData('kidria_orders', storedState.orders);
      saveData('kidria_tickets', storedState.tickets);
      saveData('kidria_chats', storedState.chats);
      saveData('kidria_current_user', storedState.currentUser);
      saveData('kidria_stepper_steps', storedState.stepperSteps);
      saveData('kidria_settings', storedState.settings);
    }
  };
}
