import React from 'react';
import { Document, Page, Text, View, StyleSheet, Svg, Polygon, Line } from '@react-pdf/renderer';

interface ProposalPDFProps {
  type: 'comercial' | 'tecnica';
  customBusinessName: string;
  analysisData: any;
  selectedPlan: string;
  dateStr: string;
  folioStr: string;
}

// Color Palette
const COLORS = {
  comercial: {
    primary: '#4338ca',   // Deep Indigo
    secondary: '#7c3aed', // Violet
    accent: '#0d9488',    // Teal
    bgLight: '#f5f3ff',
    border: '#c7d2fe'
  },
  tecnica: {
    primary: '#047857',   // Deep Emerald
    secondary: '#10b981', // Emerald
    accent: '#0d9488',    // Teal
    bgLight: '#ecfdf5',
    border: '#a7f3d0'
  },
  neutral: {
    dark: '#0f172a',      // Slate-900
    gray: '#334155',      // Slate-700
    lightGray: '#64748b', // Slate-500
    borderLight: '#e2e8f0', // Slate-200
    bgVeryLight: '#f8fafc', // Slate-50
    redLight: '#fef2f2',
    redBorder: '#fca5a5',
    redText: '#dc2626',
    greenLight: '#f0fdf4',
    greenBorder: '#bbf7d0',
    greenText: '#15803d'
  }
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    paddingTop: 30,
    paddingBottom: 45,
    paddingHorizontal: 40,
    fontSize: 9,
    lineHeight: 1.5,
    color: COLORS.neutral.gray,
    backgroundColor: '#ffffff',
  },
  
  // Header styles
  topColorBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.neutral.borderLight,
  },
  headerLogoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoTextPrimary: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: COLORS.neutral.dark,
    marginLeft: 6,
  },
  logoTextSecondary: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: COLORS.neutral.lightGray,
  },
  headerDocTag: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textAlign: 'right',
  },
  headerMetaText: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: COLORS.neutral.lightGray,
    textAlign: 'right',
    marginTop: 2,
  },

  // Footer styles
  footerContainer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.neutral.borderLight,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 6.5,
    color: COLORS.neutral.lightGray,
  },

  // Layout structures
  titleContainer: {
    marginTop: 15,
    marginBottom: 15,
  },
  mainTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 15,
    lineHeight: 1.3,
  },
  
  // Metadata block
  metadataBlock: {
    backgroundColor: COLORS.neutral.bgVeryLight,
    borderWidth: 0.5,
    borderColor: COLORS.neutral.borderLight,
    borderRadius: 6,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    position: 'relative',
  },
  metadataAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: '3px 0 0 3px',
  },
  metadataColumn: {
    width: '58%',
  },
  metadataColumnRight: {
    width: '38%',
    alignItems: 'flex-end',
  },
  metadataRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  metadataLabel: {
    fontFamily: 'Helvetica-Bold',
    width: 90,
    color: COLORS.neutral.lightGray,
    fontSize: 8,
  },
  metadataValue: {
    fontFamily: 'Helvetica',
    flex: 1,
    color: COLORS.neutral.dark,
    fontSize: 8,
  },

  // Section Headers
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 8,
  },
  sectionHeaderAccent: {
    width: 2.5,
    height: 10,
    marginRight: 6,
  },
  sectionHeaderTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: COLORS.neutral.dark,
  },

  // Paragraph Text
  paragraph: {
    fontSize: 8.5,
    lineHeight: 1.5,
    marginBottom: 10,
    color: COLORS.neutral.gray,
  },

  // Highlight Box / ROI Banner
  roiBanner: {
    backgroundColor: '#f0fdfa', // Teal-50
    borderWidth: 0.5,
    borderColor: '#99f6e2', // Teal-200
    borderRadius: 6,
    padding: 10,
    marginBottom: 15,
    flexDirection: 'row',
  },
  roiBannerAccent: {
    width: 3,
    backgroundColor: '#0d9488', // Teal-600
    marginRight: 8,
    borderRadius: 2,
  },
  roiBannerContent: {
    flex: 1,
  },
  roiTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#0d9488',
    marginBottom: 3,
  },
  roiText: {
    fontSize: 7.8,
    color: COLORS.neutral.dark,
    lineHeight: 1.4,
  },

  // Pain Points cards (Page 2)
  cardContainer: {
    backgroundColor: COLORS.neutral.redLight,
    borderWidth: 0.5,
    borderColor: COLORS.neutral.redBorder,
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
    position: 'relative',
  },
  cardLeftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2.5,
    backgroundColor: COLORS.neutral.redText,
    borderRadius: '3px 0 0 3px',
  },
  cardTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: COLORS.neutral.redText,
    marginBottom: 4,
    paddingLeft: 4,
  },
  cardIssueText: {
    fontSize: 7.8,
    color: COLORS.neutral.dark,
    marginBottom: 6,
    paddingLeft: 4,
    lineHeight: 1.4,
  },
  cardDivider: {
    height: 0.5,
    backgroundColor: COLORS.neutral.redBorder,
    marginVertical: 4,
    marginLeft: 4,
  },
  cardSolutionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: COLORS.neutral.greenText,
    marginTop: 4,
    marginBottom: 4,
    paddingLeft: 4,
  },
  cardSolutionText: {
    fontSize: 7.8,
    color: COLORS.neutral.gray,
    paddingLeft: 4,
    lineHeight: 1.4,
  },

  // Tech list items (Page 3)
  techItem: {
    backgroundColor: COLORS.neutral.bgVeryLight,
    borderWidth: 0.5,
    borderColor: COLORS.neutral.borderLight,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  techDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: 6,
  },
  techText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.8,
    color: COLORS.neutral.dark,
  },

  // Commercial Plans Cards (Page 4)
  planCard: {
    borderWidth: 0.5,
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    position: 'relative',
  },
  planCardLeftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2.5,
    borderRadius: '3px 0 0 3px',
  },
  planHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingLeft: 4,
  },
  planName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
  },
  planCost: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: COLORS.neutral.dark,
  },
  planFeaturesContainer: {
    paddingLeft: 4,
  },
  planFeatureText: {
    fontSize: 7.2,
    color: COLORS.neutral.lightGray,
    marginBottom: 2,
  },

  // Final price box
  paymentTermsBox: {
    backgroundColor: COLORS.neutral.bgVeryLight,
    borderWidth: 0.5,
    borderColor: COLORS.neutral.borderLight,
    borderRadius: 6,
    padding: 10,
    marginBottom: 15,
    position: 'relative',
  },
  paymentTermsAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: '3px 0 0 3px',
  },
  paymentTermsHeader: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: COLORS.neutral.dark,
    marginBottom: 6,
    paddingLeft: 4,
  },
  paymentTermsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingLeft: 4,
  },
  paymentTermsLabel: {
    fontSize: 7.8,
    color: COLORS.neutral.gray,
  },
  paymentTermsValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },

  // Signature Block
  signatureSectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: COLORS.neutral.dark,
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 15,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  signatureColumn: {
    width: '40%',
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.neutral.lightGray,
    marginBottom: 4,
  },
  signatureName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: COLORS.neutral.dark,
    textAlign: 'center',
  },
  signatureRole: {
    fontSize: 6.8,
    color: COLORS.neutral.lightGray,
    textAlign: 'center',
    marginTop: 2,
  }
});

// Helper for cleaning text strings of weird symbols
const cleanForPDF = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/✓/g, '[OK]')
    .replace(/•/g, '-')
    .replace(/»/g, '>')
    .replace(/—/g, '-')
    .replace(/…/g, '...')
    .trim();
};

export function ProposalPDF({
  type,
  customBusinessName,
  analysisData,
  selectedPlan,
  dateStr,
  folioStr
}: ProposalPDFProps) {
  const isCom = type === 'comercial';
  const theme = isCom ? COLORS.comercial : COLORS.tecnica;
  const brandColorCode = theme.primary;

  const planCost = analysisData?.proposal?.plans?.[selectedPlan]?.cost || analysisData?.proposal?.cost || 14990;
  const initialDeposit = Math.round(planCost * 0.5);
  const balanceDue = planCost - initialDeposit;

  // Header Component for all pages
  const Header = ({ pageNum }: { pageNum: number }) => (
    <View fixed>
      <View style={[styles.topColorBar, { backgroundColor: brandColorCode }]} />
      <View style={styles.headerContainer}>
        <View style={styles.headerLogoGroup}>
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Polygon points="2,2 14,12 2,22" fill={brandColorCode} />
            <Polygon points="8,2 20,12 8,22" fill={theme.secondary} opacity={0.8} />
          </Svg>
          <Text style={styles.logoTextPrimary}>KIDRIA <Text style={styles.logoTextSecondary}>PLATFORM</Text></Text>
        </View>
        <View>
          <Text style={[styles.headerDocTag, { color: brandColorCode }]}>
            {isCom ? "PROPUESTA COMERCIAL PWA" : "ESPECIFICACION TECNICA PWA"}
          </Text>
          <Text style={styles.headerMetaText}>
            FOLIO: {folioStr}  |  EMISION: {dateStr}
          </Text>
        </View>
      </View>
    </View>
  );

  // Footer Component for all pages
  const Footer = ({ pageNum }: { pageNum: number }) => (
    <View style={styles.footerContainer} fixed>
      <Text style={styles.footerText}>KIDRIA S.A. DE C.V. - Propuesta digital confidencial con validez de 30 días.</Text>
      <Text style={styles.footerText}>Página {pageNum} de 4</Text>
    </View>
  );

  return (
    <Document>
      {/* PAGE 1: COVER & EXECUTIVE SUMMARY */}
      <Page size="A4" style={styles.page}>
        <Header pageNum={1} />
        
        <View style={styles.titleContainer}>
          <Text style={[styles.mainTitle, { color: brandColorCode }]}>
            {isCom 
              ? "PROPUESTA DE DESARROLLO PWA & TRANSFORMACIÓN DIGITAL" 
              : "DIAGNÓSTICO TÉCNICO Y ARQUITECTURA DE SOFTWARE CLOUD"}
          </Text>
        </View>

        {/* Metadata Block */}
        <View style={styles.metadataBlock}>
          <View style={[styles.metadataAccentBar, { backgroundColor: brandColorCode }]} />
          <View style={styles.metadataColumn}>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Proyecto / Cliente:</Text>
              <Text style={styles.metadataValue}>{cleanForPDF(customBusinessName)}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Giro comercial:</Text>
              <Text style={styles.metadataValue}>{cleanForPDF(analysisData?.businessType || 'Giro General')}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Consultor Líder:</Text>
              <Text style={styles.metadataValue}>KIDRIA Cognitivo AI Expert System</Text>
            </View>
          </View>
          <View style={styles.metadataColumnRight}>
            <Text style={{ fontSize: 7.5, color: COLORS.neutral.lightGray }}>Fecha: {dateStr}</Text>
            <Text style={{ fontSize: 7.5, color: COLORS.neutral.lightGray, marginTop: 3 }}>Folio ID: {folioStr}</Text>
          </View>
        </View>

        {/* Resumen Ejecutivo */}
        <View style={styles.sectionHeaderContainer}>
          <View style={[styles.sectionHeaderAccent, { backgroundColor: brandColorCode }]} />
          <Text style={styles.sectionHeaderTitle}>1. Resumen Ejecutivo de Transformación</Text>
        </View>
        <Text style={styles.paragraph}>
          {cleanForPDF(analysisData?.proposal?.description || 'A través de esta propuesta planteamos una reestructuración digital robusta, conectando su negocio local con una plataforma de aplicaciones progresivas (PWA) de nivel empresarial.')}
        </Text>

        {/* ROI Banner */}
        <View style={styles.sectionHeaderContainer}>
          <View style={[styles.sectionHeaderAccent, { backgroundColor: brandColorCode }]} />
          <Text style={styles.sectionHeaderTitle}>2. Proyección de Retorno de Inversión (ROI)</Text>
        </View>
        
        <View style={styles.roiBanner}>
          <View style={styles.roiBannerAccent} />
          <View style={styles.roiBannerContent}>
            <Text style={styles.roiTitle}>Incremento Estimado de Ingresos: +28% a +45% (Escenario Analítico)</Text>
            <Text style={styles.roiText}>
              {cleanForPDF(analysisData?.projectionText || 'La automatización de procesos disminuye la fricción operativa de su negocio, eliminando llamadas de recordatorio manuales y agendando citas en canales automatizados las 24 horas del día.')}
            </Text>
          </View>
        </View>

        <Footer pageNum={1} />
      </Page>

      {/* PAGE 2: PAIN POINTS & PROBLEMS */}
      <Page size="A4" style={styles.page}>
        <Header pageNum={2} />

        <View style={styles.sectionHeaderContainer}>
          <View style={[styles.sectionHeaderAccent, { backgroundColor: brandColorCode }]} />
          <Text style={styles.sectionHeaderTitle}>3. Análisis de Dolores de Cabeza de tu Negocio & Soluciones KIDRIA</Text>
        </View>
        <Text style={[styles.paragraph, { color: COLORS.neutral.lightGray, marginBottom: 12 }]}>
          Nuestra ingeniería de software se enfoca en resolver los cuellos de botella reales de tu sector comercial. Desglosamos las problemáticas operativas detectadas para tu negocio y la solución integrada de KIDRIA:
        </Text>

        {/* Cards for Pain Points */}
        {(analysisData?.detectedIssues || []).slice(0, 3).map((issue: any, index: number) => {
          const isObj = typeof issue === 'object' && issue !== null;
          const issueTitle = isObj ? (issue.title || `Dolor de cabeza ${index + 1}`) : `Dolor de cabeza ${index + 1}`;
          let cleanIssue = isObj ? (issue.description || '') : issue;

          const recommendedModule = (analysisData?.recommendedFeatures && analysisData.recommendedFeatures[index]) 
            ? analysisData.recommendedFeatures[index]
            : "Automatización de Procesos KIDRIA";
            
          const cleanSol = `Erradicación mediante la implementación del módulo "${recommendedModule}". Se automatiza la captura de información, alertas de recordatorio vía WhatsApp y el procesamiento seguro de datos, recuperando la pérdida silenciosa de ingresos y reduciendo hasta un 85% de la carga administrativa.`;

          return (
            <View style={styles.cardContainer} key={index}>
              <View style={styles.cardLeftAccent} />
              <Text style={styles.cardTitle}>DOLOR DE NEGOCIO #{index + 1}: {cleanForPDF(issueTitle).toUpperCase()}</Text>
              <Text style={styles.cardIssueText}>{cleanForPDF(cleanIssue)}</Text>
              <View style={styles.cardDivider} />
              <Text style={styles.cardSolutionTitle}>SOLUCIÓN DE INGENIERÍA KIDRIA:</Text>
              <Text style={styles.cardSolutionText}>{cleanForPDF(cleanSol)}</Text>
            </View>
          );
        })}

        <Footer pageNum={2} />
      </Page>

      {/* PAGE 3: OBJECTIVES, MODULES & TECH STACK */}
      <Page size="A4" style={styles.page}>
        <Header pageNum={3} />

        <View style={styles.sectionHeaderContainer}>
          <View style={[styles.sectionHeaderAccent, { backgroundColor: brandColorCode }]} />
          <Text style={styles.sectionHeaderTitle}>4. Objetivos y Alcances de la Plataforma PWA</Text>
        </View>
        <Text style={[styles.paragraph, { color: COLORS.neutral.lightGray, marginBottom: 10 }]}>
          La aplicación se construirá bajo un diseño modular y responsivo a la medida. Esto garantiza escalabilidad infinita y la integración nativa de las siguientes directrices operativas:
        </Text>

        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: COLORS.neutral.dark, marginBottom: 4 }}>Objetivos Estratégicos:</Text>
        {(analysisData?.proposal?.objectives || [
          "Digitalizar de forma amigable el 100% del catálogo de servicios y opciones operativas.",
          "Facilitar un canal de agendamiento y retención autónomo 24/7 sin llamadas repetitivas.",
          "Estabilizar cobros recurrentes de membresías o anticipos de servicios por Stripe."
        ]).map((obj: string, i: number) => (
          <Text key={i} style={[styles.paragraph, { fontSize: 7.8, marginBottom: 4, paddingLeft: 6 }]}>• {cleanForPDF(obj)}</Text>
        ))}

        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: COLORS.neutral.dark, marginTop: 8, marginBottom: 4 }}>Módulos de Sistema Compilados Nativamente:</Text>
        {(analysisData?.proposal?.features || [
          "Módulo de Agenda Inteligente en Tiempo Real",
          "Historial y Base de Datos Integrada en la Nube",
          "Pasarela Electrónica con Stripe Gateway",
          "Chatbot de Inteligencia Artificial para Ventas",
          "Instalación Móvil como App Nativa (PWA)"
        ]).map((feat: string, idx: number) => (
          <Text key={idx} style={[styles.paragraph, { fontSize: 7.8, marginBottom: 4, paddingLeft: 6 }]}>[{idx + 1}] {cleanForPDF(feat)}</Text>
        ))}

        <View style={styles.sectionHeaderContainer}>
          <View style={[styles.sectionHeaderAccent, { backgroundColor: brandColorCode }]} />
          <Text style={styles.sectionHeaderTitle}>5. Arquitectura del Software e Infraestructura Cloud</Text>
        </View>
        <Text style={[styles.paragraph, { color: COLORS.neutral.lightGray, marginBottom: 10 }]}>
          Para asegurar una inmunidad del 99.9% contra caídas de sistema, alta velocidad de procesamiento de datos y un desempeño fluido en dispositivos iOS y Android, la solución utiliza el siguiente stack tecnológico homologado:
        </Text>

        {(type === 'tecnica' 
          ? (analysisData?.proposal?.technologies || [
              "Vite + React 18 con Compilación TypeScript",
              "Google Cloud Firestore Realtime Database",
              "Firebase Authentication Protocol & Secure Rules",
              "Node.js & Express API Gateway Server",
              "Stripe Payments API & Webhook Controller"
            ]) 
          : [
              "Progressive Web App (PWA) Mobile Engine",
              "Firebase Firestore Realtime Database",
              "Google Cloud Functions (Servidor API)",
              "Stripe Gateway Integration API",
              "Gemini Pro AI Cognitive Engine",
              "Notificaciones Cloud WhatsApp API"
            ]
        ).map((tech: string, i: number) => (
          <View style={styles.techItem} key={i}>
            <View style={[styles.techDot, { backgroundColor: brandColorCode }]} />
            <Text style={styles.techText}>{cleanForPDF(tech)}</Text>
          </View>
        ))}

        <Footer pageNum={3} />
      </Page>

      {/* PAGE 4: COMMERCIAL PLANS / TECHNICAL PLAN & SIGNATURES */}
      <Page size="A4" style={styles.page}>
        <Header pageNum={4} />

        {isCom ? (
          <>
            <View style={styles.sectionHeaderContainer}>
              <View style={[styles.sectionHeaderAccent, { backgroundColor: brandColorCode }]} />
              <Text style={styles.sectionHeaderTitle}>6. Modelos de Contratación y Planes Comerciales</Text>
            </View>
            <Text style={[styles.paragraph, { color: COLORS.neutral.lightGray, marginBottom: 10 }]}>
              Nuestros esquemas financieros se adaptan con total transparencia a la escala operativa de su negocio. Todos los precios están expresados estrictamente en Pesos Mexicanos (MXN):
            </Text>

            {Object.entries(analysisData?.proposal?.plans || {
              "Starter": { cost: 2700, features: ["Creación de Páginas Web", "Dominio de regalo (1 año)", "Diseño responsivo premium", "Hosting incluido", "Optimización SEO"] },
              "Business": { cost: 14990, features: ["Todo lo de Starter", "Agenda inteligente", "Control de Usuarios", "Stripe Connect"] },
              "PremiumIA": { cost: 24990, features: ["Todo lo de Business", "IA entrenada (Gemini)", "Automatizaciones", "WhatsApp API"] }
            }).map(([key, val]: [string, any]) => {
              const isSelected = key === selectedPlan;
              const planFeatures = val.features || [];
              const cardBg = isSelected ? theme.bgLight : COLORS.neutral.bgVeryLight;
              const cardBorder = isSelected ? theme.primary : COLORS.neutral.borderLight;
              const cardBorderWidth = isSelected ? 0.6 : 0.3;

              return (
                <View style={[styles.planCard, { backgroundColor: cardBg, borderColor: cardBorder, borderWidth: cardBorderWidth }]} key={key}>
                  {isSelected && <View style={[styles.planCardLeftAccent, { backgroundColor: theme.primary }]} />}
                  <View style={styles.planHeaderRow}>
                    <Text style={[styles.planName, { color: isSelected ? theme.primary : COLORS.neutral.dark }]}>
                      PLAN {key.toUpperCase()} {isSelected ? '(MÓDULO SELECCIONADO)' : ''}
                    </Text>
                    <Text style={styles.planCost}>${val.cost.toLocaleString('es-MX')} MXN</Text>
                  </View>
                  <View style={styles.planFeaturesContainer}>
                    <Text style={styles.planFeatureText}>
                      • {planFeatures.slice(0, 4).map((f: string) => cleanForPDF(f)).join('  |  • ')}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Price breakdown */}
            <View style={styles.paymentTermsBox}>
              <View style={[styles.paymentTermsAccent, { backgroundColor: theme.primary }]} />
              <Text style={styles.paymentTermsHeader}>PLAN ADQUIRIDO DE INICIO: Plan {selectedPlan}</Text>
              <View style={styles.paymentTermsRow}>
                <Text style={styles.paymentTermsLabel}>Inversión Total Planificada:</Text>
                <Text style={[styles.paymentTermsValue, { color: COLORS.neutral.dark }]}>${planCost.toLocaleString('es-MX')} MXN</Text>
              </View>
              <View style={styles.paymentTermsRow}>
                <Text style={styles.paymentTermsLabel}>Anticipo de Ingeniería (50%):</Text>
                <Text style={[styles.paymentTermsValue, { color: COLORS.neutral.greenText }]}>${initialDeposit.toLocaleString('es-MX')} MXN</Text>
              </View>
              <View style={styles.paymentTermsRow}>
                <Text style={styles.paymentTermsLabel}>Liquidación contra Entrega (50%):</Text>
                <Text style={[styles.paymentTermsValue, { color: theme.primary }]}>${balanceDue.toLocaleString('es-MX')} MXN</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.sectionHeaderContainer}>
              <View style={[styles.sectionHeaderAccent, { backgroundColor: brandColorCode }]} />
              <Text style={styles.sectionHeaderTitle}>6. Plan de Despliegue y Sprints de Ingeniería</Text>
            </View>
            <Text style={[styles.paragraph, { color: COLORS.neutral.lightGray, marginBottom: 12 }]}>
              El desarrollo iterativo de KIDRIA avanza mediante hitos semanales estables y funcionales:
            </Text>

            {[
              { hito: "Hito 1 (Semana 1)", desc: "Aprovisionamiento de base de datos Firestore y configuración de reglas de seguridad." },
              { hito: "Hito 2 (Semana 2)", desc: "Desarrollo del panel de control de usuarios, roles de acceso y pasarela de cobros Stripe." },
              { hito: "Hito 3 (Semana 3)", desc: "Integración de Inteligencia Artificial (Gemini SDK) y flujos masivos de WhatsApp API." },
              { hito: "Hito 4 (Semana 4)", desc: "Optimización SEO, velocidad LCP < 1.2s, pruebas generales y entrega formal llave en mano." }
            ].map((h, i) => (
              <View key={i} style={{ marginBottom: 6, paddingLeft: 6 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: COLORS.neutral.dark }}>{h.hito}:</Text>
                <Text style={{ fontSize: 7.5, color: COLORS.neutral.gray, marginTop: 1 }}>{h.desc}</Text>
              </View>
            ))}

            <View style={styles.sectionHeaderContainer}>
              <View style={[styles.sectionHeaderAccent, { backgroundColor: brandColorCode }]} />
              <Text style={styles.sectionHeaderTitle}>7. Acuerdo de Niveles de Servicio (SLA) & Soporte</Text>
            </View>
            <Text style={[styles.paragraph, { fontSize: 8 }]}>
              Garantizamos un soporte integral de nivel corporativo para asegurar la continuidad del negocio. Incluye soporte directo vía ticket, monitoreo constante de latencia en la nube de Google Cloud y optimización de base de datos mensual.
            </Text>
          </>
        )}

        {/* Signature Blocks */}
        <Text style={styles.signatureSectionTitle}>FIRMAS DE CONFORMIDAD Y ACUERDO FORMAL</Text>
        <View style={styles.signatureRow}>
          <View style={styles.signatureColumn}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>Ing. Alejandro Torres</Text>
            <Text style={styles.signatureRole}>Líder de Ingeniería KIDRIA</Text>
          </View>
          <View style={styles.signatureColumn}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{cleanForPDF(customBusinessName).toUpperCase()}</Text>
            <Text style={styles.signatureRole}>Representante Autorizado / Cliente</Text>
          </View>
        </View>

        <Footer pageNum={4} />
      </Page>
    </Document>
  );
}
