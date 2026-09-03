import React, { useMemo, useState } from 'react';
import {
  ArrowRight, BarChart3, Check, ChevronDown, Globe2,
  Download, IdCard, Menu, MessageCircle, Nfc, QrCode, ShieldCheck,
  Store, X, Zap
} from 'lucide-react';

interface PublicHomeProps {
  onLogin: () => void;
  onStartDiagnosis: () => void;
  onDemoAccess: (role: 'cliente' | 'admin_general') => void;
  onInstall: () => void;
  isInstalled: boolean;
}

const services = [
  {
    icon: Globe2,
    title: 'Aplicaciones para tu negocio',
    description: 'Reservas, pedidos, catálogo, clientes, pagos y operación diaria en una solución hecha para tu forma de trabajar.',
    tag: 'A tu medida'
  },
  {
    icon: QrCode,
    title: 'Menús y catálogos QR',
    description: 'Actualiza precios, productos y promociones sin volver a imprimir. Tus clientes escanean y ven todo al instante.',
    tag: 'Sin app adicional'
  },
  {
    icon: Nfc,
    title: 'Experiencias NFC',
    description: 'Tarjetas, placas o exhibidores que abren tu menú, catálogo, reseñas, pagos o la experiencia que necesites.',
    tag: 'Un toque'
  },
  {
    icon: IdCard,
    title: 'Tarjetas de presentación NFC',
    description: 'Comparte contacto, redes, portafolio y WhatsApp con un toque. Edita tu información sin reemplazar la tarjeta.',
    tag: 'Siempre vigente'
  }
];

const businessTypes = ['Restaurante o cafetería', 'Tienda o comercio', 'Servicios profesionales', 'Salud y bienestar', 'Otro negocio'];

function PublicLogo() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-lime-300/20 bg-[#0b1713] p-2">
      <svg viewBox="0 0 120 120" fill="none" className="h-full w-full" aria-hidden="true">
        <path d="M40 25H52L44 53L52 81H40L32 53Z" fill="#bef264" />
        <path d="M52 53L78 25H92L64 53L92 81H78Z" fill="#67e8f9" />
      </svg>
    </div>
  );
}

export default function PublicHome({ onLogin, onStartDiagnosis, onDemoAccess, onInstall, isInstalled }: PublicHomeProps) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [businessType, setBusinessType] = useState(businessTypes[0]);
  const [need, setNeed] = useState('');
  const [sent, setSent] = useState(false);

  const whatsappUrl = useMemo(() => {
    const detail = need.trim() ? ` Necesito ayuda con: ${need.trim()}` : '';
    return `https://wa.me/524792293687?text=${encodeURIComponent(`Hola KIDRIA, tengo un ${businessType.toLowerCase()} y quiero conocer qué solución me conviene.${detail}`)}`;
  }, [businessType, need]);

  const sendRequest = (event: React.FormEvent) => {
    event.preventDefault();
    const request = { businessType, need: need.trim(), createdAt: new Date().toISOString() };
    const previous = JSON.parse(localStorage.getItem('kidria_public_requests') || '[]');
    localStorage.setItem('kidria_public_requests', JSON.stringify([request, ...previous].slice(0, 20)));
    setSent(true);
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#07110e] text-[#f5f7f1] selection:bg-lime-300 selection:text-[#07110e]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#07110e]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="#inicio" className="flex items-center gap-3" aria-label="KIDRIA inicio">
            <PublicLogo />
            <div>
              <span className="block font-display text-lg font-black tracking-[0.16em]">KIDRIA</span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.22em] text-lime-300">Impulso para negocios</span>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-medium text-white/70 md:flex">
            <a className="transition hover:text-white" href="#soluciones">Soluciones</a>
            <a className="transition hover:text-white" href="#metodo">Cómo trabajamos</a>
            <a className="transition hover:text-white" href="#demo">Probar la app</a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {!isInstalled && <button onClick={onInstall} className="inline-flex items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/8 px-4 py-2 text-sm font-bold text-lime-200 transition hover:bg-lime-300/15"><Download className="h-4 w-4" /> Instalar app</button>}
            <button onClick={onLogin} className="rounded-full px-4 py-2 text-sm font-semibold text-white/80 transition hover:text-white">Ingresar</button>
            <a href="#contacto" className="rounded-full bg-lime-300 px-5 py-2.5 text-sm font-extrabold text-[#07110e] transition hover:bg-lime-200">Hablar de mi negocio</a>
          </div>

          <button onClick={() => setMobileMenu(!mobileMenu)} className="rounded-xl border border-white/10 p-2.5 md:hidden" aria-label="Abrir menú">
            {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenu && (
          <div className="border-t border-white/10 bg-[#07110e] px-5 py-5 md:hidden">
            <div className="flex flex-col gap-4 text-sm">
              <a href="#soluciones" onClick={() => setMobileMenu(false)}>Soluciones</a>
              <a href="#metodo" onClick={() => setMobileMenu(false)}>Cómo trabajamos</a>
              <a href="#demo" onClick={() => setMobileMenu(false)}>Probar la app</a>
              <button onClick={onLogin} className="rounded-xl border border-white/15 py-3 font-bold">Ingresar</button>
              {!isInstalled && <button onClick={onInstall} className="flex items-center justify-center gap-2 rounded-xl bg-lime-300 py-3 font-black text-[#07110e]"><Download className="h-4 w-4" /> Instalar Kidria</button>}
            </div>
          </div>
        )}
      </header>

      <main>
        <section id="inicio" className="relative overflow-hidden px-5 pb-20 pt-36 lg:px-8 lg:pb-28 lg:pt-44">
          <div className="pointer-events-none absolute left-1/2 top-16 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-lime-300/[0.07] blur-[110px]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.08fr_.92fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/10 px-3.5 py-2 text-xs font-bold text-lime-200">
                <Store className="h-4 w-4" /> Tecnología entendible para negocios reales
              </div>
              <h1 className="max-w-4xl font-display text-5xl font-black leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                Tu negocio puede avanzar. <span className="text-lime-300">Kidria lo hace posible.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/66 sm:text-xl">
                Entendemos cómo trabajas, detectamos dónde pierdes tiempo o ventas y construimos la solución que necesitas. La inteligencia artificial ayuda; el cambio lo diseña e implementa Kidria contigo.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="#contacto" className="inline-flex items-center justify-center gap-2 rounded-full bg-lime-300 px-6 py-3.5 font-extrabold text-[#07110e] transition hover:-translate-y-0.5 hover:bg-lime-200">
                  Cuéntanos qué necesitas <ArrowRight className="h-4 w-4" />
                </a>
                <button onClick={onStartDiagnosis} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 py-3.5 font-bold transition hover:bg-white/[0.08]">
                  Explorar diagnóstico
                </button>
              </div>
              {!isInstalled && <button onClick={onInstall} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-lime-200 transition hover:text-lime-100"><Download className="h-4 w-4" /> Instalar Kidria en este dispositivo</button>}
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/55">
                {['Hablas con personas', 'Propuesta clara', 'Acompañamiento continuo'].map(item => (
                  <span key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-lime-300" />{item}</span>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-lime-300/15 to-cyan-300/5 blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-[#0d1b16] p-5 shadow-2xl sm:p-7">
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-lime-300">Ruta Kidria</p><p className="mt-1 text-sm text-white/50">Del problema al resultado</p></div>
                  <BarChart3 className="h-8 w-8 text-lime-300" />
                </div>
                <div className="mt-6 space-y-4">
                  {[
                    ['01', 'Entender', 'Escuchamos tu operación y tus objetivos.'],
                    ['02', 'Resolver', 'Diseñamos la herramienta correcta, sin tecnología innecesaria.'],
                    ['03', 'Mejorar', 'Medimos, acompañamos y hacemos crecer la solución.']
                  ].map(([number, title, text], index) => (
                    <div key={number} className="flex gap-4 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === 2 ? 'bg-lime-300 text-[#07110e]' : 'bg-white/8 text-white/60'}`}>{number}</span>
                      <div><h3 className="font-display font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-white/52">{text}</p></div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl bg-lime-300 p-4 text-[#07110e]">
                  <div className="flex items-center gap-3"><Zap className="h-5 w-5" /><p className="text-sm font-black">La IA potencia la solución. Kidria dirige el cambio.</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="soluciones" className="border-y border-white/8 bg-white/[0.025] px-5 py-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">Soluciones que sí se usan</p>
              <h2 className="mt-4 font-display text-3xl font-black tracking-tight sm:text-5xl">Lo que tu negocio necesita, conectado en un solo lugar.</h2>
              <p className="mt-5 text-lg leading-8 text-white/58">Puedes comenzar con algo sencillo y crecer después. No tienes que comprar un sistema enorme para resolver un problema concreto.</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {services.map(({ icon: Icon, title, description, tag }) => (
                <article key={title} className="group rounded-[1.75rem] border border-white/10 bg-[#0b1713] p-6 transition hover:-translate-y-1 hover:border-lime-300/30 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-300/12 text-lime-300"><Icon className="h-6 w-6" /></div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/45">{tag}</span>
                  </div>
                  <h3 className="mt-7 font-display text-xl font-bold">{title}</h3>
                  <p className="mt-3 leading-7 text-white/55">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="metodo" className="px-5 py-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">El método Kidria</p>
                <h2 className="mt-4 font-display text-3xl font-black tracking-tight sm:text-5xl">No empezamos hablando de IA. Empezamos hablando de tu negocio.</h2>
              </div>
              <div className="space-y-4 text-white/60">
                <p className="text-lg leading-8">Una herramienta solo vale si mejora algo real: atender más rápido, vender mejor, reducir errores o dar una mejor experiencia.</p>
                <p className="text-lg leading-8">Por eso Kidria analiza primero, propone con claridad, implementa y acompaña. Si la IA aporta valor, la integramos de forma responsable; si no, elegimos una solución más simple.</p>
              </div>
            </div>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['1', 'Conversamos', 'Nos cuentas qué pasa hoy.'],
                ['2', 'Priorizamos', 'Elegimos el cambio de mayor impacto.'],
                ['3', 'Construimos', 'Implementamos y capacitamos.'],
                ['4', 'Acompañamos', 'Medimos y mejoramos contigo.']
              ].map(([n, title, text]) => (
                <div key={n} className="rounded-2xl border border-white/10 p-5"><span className="text-sm font-black text-lime-300">0{n}</span><h3 className="mt-8 font-display text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/50">{text}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section id="demo" className="px-5 pb-24 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#10231b] to-[#09120f] p-7 sm:p-10 lg:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_.9fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/10 px-3 py-1.5 text-xs font-bold text-cyan-200"><ShieldCheck className="h-4 w-4" /> Entorno de demostración</div>
                <h2 className="mt-5 font-display text-3xl font-black sm:text-4xl">Mira la experiencia desde ambos lados.</h2>
                <p className="mt-4 max-w-xl leading-7 text-white/55">Prueba el seguimiento que recibe un negocio o entra al panel de gestión de Kidria. Los accesos son demostrativos y no modifican cuentas reales.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={() => onDemoAccess('cliente')} className="rounded-2xl bg-white p-5 text-left text-[#07110e] transition hover:-translate-y-1">
                  <Store className="h-6 w-6" /><span className="mt-8 block text-xs font-bold uppercase tracking-wider text-black/45">Demo usuario</span><strong className="mt-1 block font-display text-lg">Ver panel del negocio</strong>
                </button>
                <button onClick={() => onDemoAccess('admin_general')} className="rounded-2xl bg-lime-300 p-5 text-left text-[#07110e] transition hover:-translate-y-1">
                  <BarChart3 className="h-6 w-6" /><span className="mt-8 block text-xs font-bold uppercase tracking-wider text-black/45">Demo administración</span><strong className="mt-1 block font-display text-lg">Ver panel Kidria</strong>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="contacto" className="border-t border-white/8 bg-[#0a1511] px-5 py-24 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">Empecemos por escucharte</p>
              <h2 className="mt-4 font-display text-3xl font-black tracking-tight sm:text-5xl">¿Qué quieres mejorar en tu negocio?</h2>
              <p className="mt-5 leading-7 text-white/55">Cuéntanos en palabras simples. Te responderemos por WhatsApp para entenderlo mejor, sin compromiso y sin tecnicismos.</p>
              <div className="mt-7 flex items-center gap-3 text-sm text-white/55"><MessageCircle className="h-5 w-5 text-lime-300" /> Atención directa de Kidria</div>
            </div>
            <form onSubmit={sendRequest} className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
              <label className="block text-sm font-bold" htmlFor="business-type">¿Qué tipo de negocio tienes?</label>
              <div className="relative mt-3">
                <select id="business-type" value={businessType} onChange={e => setBusinessType(e.target.value)} className="w-full appearance-none rounded-xl border border-white/12 bg-[#07110e] px-4 py-3.5 text-sm text-white outline-none focus:border-lime-300">
                  {businessTypes.map(type => <option key={type}>{type}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-4 h-4 w-4 text-white/40" />
              </div>
              <label className="mt-6 block text-sm font-bold" htmlFor="business-need">¿Qué te gustaría resolver?</label>
              <textarea id="business-need" value={need} onChange={e => setNeed(e.target.value)} rows={4} placeholder="Ejemplo: quiero actualizar mi menú sin imprimirlo cada vez y recibir pedidos por WhatsApp..." className="mt-3 w-full resize-none rounded-xl border border-white/12 bg-[#07110e] px-4 py-3.5 text-sm leading-6 text-white outline-none placeholder:text-white/28 focus:border-lime-300" />
              <button type="submit" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-5 py-3.5 font-extrabold text-[#07110e] transition hover:bg-lime-200">Enviar por WhatsApp <ArrowRight className="h-4 w-4" /></button>
              {sent && <p className="mt-3 text-center text-xs text-lime-200">Solicitud guardada. Abrimos WhatsApp para continuar.</p>}
              <p className="mt-4 text-center text-xs text-white/35">No compartiremos tu información con terceros.</p>
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/8 px-5 py-8 text-sm text-white/42 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Kidria. Tecnología con propósito para negocios.</p>
          <div className="flex gap-5"><a href="https://www.facebook.com/share/1ZDvStpF3R/" target="_blank" rel="noreferrer">Facebook</a><a href="https://www.instagram.com/kidria.ia" target="_blank" rel="noreferrer">Instagram</a><button onClick={onLogin}>Acceso clientes</button></div>
        </div>
      </footer>
    </div>
  );
}
