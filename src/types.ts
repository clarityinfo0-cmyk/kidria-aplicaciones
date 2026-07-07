export type UserRole = 'admin_general' | 'admin' | 'cliente' | 'invitado';

export interface UserProfile {
  uid: string;
  email: string;
  nombre: string;
  empresa: string;
  logoUrl?: string;
  role: UserRole;
  telefono?: string;
  giro?: string;
  colores?: {
    primary: string;
    secondary: string;
  };
  dominioPropuesto?: string;
  referralCode?: string;
  referidosContratados?: number;
  referidosGanancia?: number;
  twoFactorEnabled?: boolean;
}

export interface HistoryItem {
  id: string;
  fecha: string;
  titulo: string;
  descripcion: string;
  autor: string;
}

export interface FileItem {
  id: string;
  nombre: string;
  categoria: 'contrato' | 'factura' | 'manual' | 'apk' | 'pwa' | 'branding' | 'otros';
  url: string;
  size: string;
  fecha: string;
}

export interface StepperStep {
  id: string;
  nombre: string;
  porcentaje: number;
  completed: boolean;
  descripcion: string;
  fecha: string;
  hora: string;
  responsable: string;
  notas: string;
  archivos: string[];
}

export interface InvoiceItem {
  id: string;
  numero: string;
  concepto: string;
  monto: number;
  fechaEmision: string;
  fechaVencimiento: string;
  estado: 'pagada' | 'pendiente' | 'vencida';
  stripeUrl?: string;
}

export interface ProjectOrder {
  id: string;
  cliente: string;
  correo: string;
  empresa: string;
  telefono: string;
  giro: string;
  proyecto: string;
  precioTotal: number;
  anticipo: number;
  saldoPendiente: number;
  estado: string; // ID of current StepperStep
  fechaContratacion: string;
  fechaEntrega: string;
  mensualidad: number;
  estadoStripe: 'active' | 'pending' | 'canceled' | 'paid';
  estadoFirebase: 'configured' | 'pending';
  notasInternas: string;
  prioridad: 'alta' | 'media' | 'baja';
  categoria: string;
  observaciones: string;
  responsableProyecto: string;
  historial: HistoryItem[];
  archivos: FileItem[];
  facturas: InvoiceItem[];
  contractSigned: boolean;
  contractSignedDate?: string;
  contractSignedByName?: string;
  contractSignature?: string; // base64 image or name
  estadoApp?: 'activo' | 'pausado';
  isDummy?: boolean;
}

export interface TicketReply {
  id: string;
  senderName: string;
  senderRole: UserRole;
  message: string;
  fecha: string;
  adjuntoUrl?: string;
}

export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  priority: 'alta' | 'media' | 'baja';
  category: 'pagos' | 'desarrollo' | 'bugs' | 'ia' | 'otros';
  status: 'abierto' | 'en_progreso' | 'resuelto';
  createdAt: string;
  replies: TicketReply[];
  rating: number | null;
  assignedTo?: string;
  userEmail?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  fecha: string;
  read: boolean;
  file?: {
    nombre: string;
    url: string;
    tipo: 'image' | 'pdf' | 'other';
  };
}

export interface DomainStatus {
  domainName: string;
  available: boolean;
  price?: number;
  status: 'active' | 'expired' | 'pending' | 'none';
  dnsConfig?: {
    type: string;
    host: string;
    value: string;
    ttl: number;
  }[];
  sslActive: boolean;
  vencimiento?: string;
}

export interface PlanSettings {
  cost: number;
  monthly: number;
  promo: string;
}

export interface PaymentSettings {
  mercadoPagoLink: string;
  depositAccount: {
    banco: string;
    cuenta: string;
    beneficiario: string;
  };
  transferAccount: {
    banco: string;
    clabe: string;
    beneficiario: string;
  };
  plans: {
    Starter: PlanSettings;
    Business: PlanSettings;
    PremiumIA: PlanSettings;
    Enterprise: PlanSettings;
  };
}

