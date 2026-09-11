import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BarChart3, Bell, Bot, ChevronDown, Download, MessageCircle, PackageCheck, QrCode, Scissors, ShieldCheck, ShoppingBag, Store, UserRound, Wrench } from 'lucide-react';

interface PublicHomeProps {
  onLogin: () => void;
  onStartDiagnosis: () => void;
  onDemoAccess: (role: 'cliente' | 'admin_general') => void;
  onInstall: () => void;
  isInstalled: boolean;
}

const businessTypes = ['Restaurante o cafetería', 'Tienda o comercio', 'Servicios profesionales', 'Salud y bienestar', 'Otro negocio'];
const clamp = (value: number) => Math.min(1, Math.max(0, value));

function LogoMark() {
  return <svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><path d="M38 21h16L45 53l9 34H38L27 53Z" fill="#d8ff62"/><path d="M52 53 80 21h16L66 53l30 34H80Z" fill="#75f3dd"/></svg>;
}

function Phone({ phase }: { phase: number }) {
  const pwa = phase >= 2;
  const automation = phase >= 3;
  return (
    <div className="story-phone">
      <div className="phone-frame">
        <div className="phone-speaker" />
        <div className="phone-screen">
          <div className="screen-top"><span>KIDRIA</span><span className="live-dot" /></div>
          {!pwa && <div className="website-ui"><div className="website-glow"/><small>CAFÉ NORTE</small><h3>Hecho para disfrutarse.</h3><button>Ver menú</button><div className="site-cards"><i/><i/><i/></div></div>}
          {pwa && !automation && <div className="pwa-ui"><div className="hello">Buenos días, Ana <span>●</span></div><h3>Tu negocio, hoy</h3><div className="metric"><b>24</b><small>pedidos activos</small><em>+18%</em></div><div className="app-grid"><div><ShoppingBag/><span>Pedidos</span></div><div><UserRound/><span>Clientes</span></div><div><Bell/><span>Avisos</span></div><div><PackageCheck/><span>Catálogo</span></div></div></div>}
          {automation && <div className="automation-ui"><div className="chat client">Hola, ¿tienen espacio hoy?</div><div className="chat bot"><Bot/> Sí, a las 4:30. ¿Lo reservo?</div><div className="flow-line"/><div className="order-done"><PackageCheck/><div><b>Pedido registrado</b><small>Notificación enviada</small></div></div></div>}
        </div>
      </div>
    </div>
  );
}

export default function PublicHome({ onLogin, onStartDiagnosis, onDemoAccess, onInstall, isInstalled }: PublicHomeProps) {
  const storyRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [businessType, setBusinessType] = useState(businessTypes[0]);
  const [need, setNeed] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = storyRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setProgress(clamp(-rect.top / Math.max(1, el.offsetHeight - window.innerHeight)));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, []);

  const scene = Math.min(5, Math.floor(progress * 5.99));
  const whatsappUrl = useMemo(() => `https://wa.me/524792293687?text=${encodeURIComponent(`Hola KIDRIA, tengo un ${businessType.toLowerCase()} y quiero mejorar mi negocio.${need.trim() ? ` Necesito ayuda con: ${need.trim()}` : ''}`)}`, [businessType, need]);
  const sendRequest = (event: React.FormEvent) => {
    event.preventDefault();
    const request = { businessType, need: need.trim(), createdAt: new Date().toISOString() };
    const previous = JSON.parse(localStorage.getItem('kidria_public_requests') || '[]');
    localStorage.setItem('kidria_public_requests', JSON.stringify([request, ...previous].slice(0, 20)));
    setSent(true);
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="cinematic-home">
      <header className="story-nav">
        <a href="#pelicula" className="nav-brand"><span><LogoMark/></span><b>KIDRIA</b></a>
        <div><button onClick={onLogin}>Ingresar</button>{!isInstalled && <button className="install-pill" onClick={onInstall}><Download/> Instalar</button>}</div>
      </header>
      <main>
        <div id="pelicula" ref={storyRef} className="scroll-story">
          <div className="story-stage">
            <div className="ambient"><i/><i/><i/><i/><i/><i/></div>
            <section className={`story-copy opening ${scene === 0 ? 'active' : ''}`}>
              <div className="hero-mark"><LogoMark/></div><p className="eyebrow">KIDRIA</p>
              <h1>El futuro de tu negocio<br/> <span>no debería verse como el pasado.</span></h1>
              <div className="swipe"><ChevronDown/> Desliza para comenzar</div>
            </section>
            <div className={`phone-wrap ${scene >= 1 && scene <= 4 ? 'visible' : ''}`} style={{ transform: `translate3d(${scene === 4 ? 0 : 15}vw, ${scene === 1 ? 3 : 0}vh, 0) rotateY(${scene === 1 ? -12 : scene === 2 ? 8 : 0}deg) rotateX(${scene === 1 ? 4 : 0}deg) scale(${scene === 4 ? .72 : 1})` }}><Phone phase={scene}/></div>
            <section className={`story-copy side ${scene === 1 ? 'active' : ''}`}><p className="eyebrow">Presencia digital</p><h2>Tu negocio,<br/>imposible de ignorar.</h2><p>Una experiencia real, diseñada alrededor de tu identidad y de tus clientes.</p></section>
            <section className={`story-copy side ${scene === 2 ? 'active' : ''}`}><p className="eyebrow">Aplicación instalable</p><h2>De vitrina<br/>a herramienta.</h2><p>Pedidos, clientes, notificaciones y catálogo. Todo en la mano.</p><div className="mini-tags"><span>Sin tienda de apps</span><span>Siempre actualizada</span></div></section>
            <section className={`story-copy side automation-scene ${scene === 3 ? 'active' : ''}`}><p className="eyebrow">Automatización inteligente</p><h2>Mientras tú trabajas,<br/><span>Kidria conecta todo.</span></h2><p>La IA ayuda a atender. Kidria convierte esa conversación en un proceso que tu negocio puede usar.</p></section>
            <section className={`ecosystem ${scene === 4 ? 'active' : ''}`}>
              <div className="business-orbit o1"><Store/><span>Restaurante</span></div><div className="business-orbit o2"><Scissors/><span>Estética</span></div><div className="business-orbit o3"><Wrench/><span>Taller</span></div><div className="business-orbit o4"><ShoppingBag/><span>Tienda</span></div>
              <div className="ecosystem-copy"><p className="eyebrow">Cada negocio es distinto</p><h2>No adaptamos tu negocio al software.<br/><span>Creamos el software alrededor de tu negocio.</span></h2></div>
            </section>
            <section className={`story-copy finale ${scene === 5 ? 'active' : ''}`}><div className="final-mark"><LogoMark/></div><p className="eyebrow">El siguiente paso es simple</p><h2>Tu negocio puede<br/><span>hacer mucho más.</span></h2><a href="#contacto">Cuéntanos qué necesita <ArrowRight/></a><small>Sin tecnicismos. Sin compromiso.</small></section>
            <div className="progress-rail"><span style={{ height: `${progress * 100}%` }}/></div>
          </div>
        </div>

        <section className="after-story">
          <div className="after-intro"><p className="eyebrow">Ahora sí, hablemos de posibilidades</p><h2>Una experiencia bonita llama la atención.<br/><span>Una solución correcta cambia el negocio.</span></h2><p>Kidria escucha primero, identifica la mejora de mayor impacto y construye una herramienta que el equipo realmente pueda usar.</p></div>
          <div className="capability-grid"><article><QrCode/><small>Conecta</small><h3>QR y NFC</h3><p>Menús, catálogos, reseñas, pagos o tarjetas de presentación que se actualizan sin volver a imprimir.</p></article><article><Bot/><small>Mejora</small><h3>Diagnóstico con IA</h3><p>Explora oportunidades concretas. La IA encuentra señales; Kidria diseña e implementa el cambio.</p><button onClick={onStartDiagnosis}>Iniciar diagnóstico <ArrowRight/></button></article><article><MessageCircle/><small>Automatiza</small><h3>Atención y operación</h3><p>Convierte preguntas, reservas y pedidos en acciones claras dentro del negocio.</p></article></div>
          <div className="demo-panel"><div><ShieldCheck/><p className="eyebrow">Demos interactivas</p><h2>No tienes que imaginarlo.<br/>Puedes entrar.</h2><p>Conoce la experiencia del negocio y el panel desde el que Kidria acompaña la operación.</p></div><div className="demo-actions"><button onClick={() => onDemoAccess('cliente')}><Store/><span><small>Demo cliente</small>Panel del negocio</span><ArrowRight/></button><button onClick={() => onDemoAccess('admin_general')}><BarChart3/><span><small>Demo gestión</small>Panel Kidria</span><ArrowRight/></button></div></div>
        </section>
        <section id="contacto" className="contact-cinema"><div><p className="eyebrow">La primera conversación</p><h2>¿Qué quieres mejorar<br/>en tu negocio?</h2><p>Cuéntanoslo como se lo contarías a una persona. Te responderemos directamente por WhatsApp.</p>{!isInstalled && <button className="install-secondary" onClick={onInstall}><Download/> Instalar KIDRIA en este dispositivo</button>}</div><form onSubmit={sendRequest}><label htmlFor="business-type">Tengo un...</label><select id="business-type" value={businessType} onChange={e => setBusinessType(e.target.value)}>{businessTypes.map(type => <option key={type}>{type}</option>)}</select><label htmlFor="business-need">Quiero mejorar...</label><textarea id="business-need" value={need} onChange={e => setNeed(e.target.value)} rows={4} placeholder="Ejemplo: recibir pedidos, mostrar mi menú o atender más rápido..."/><button type="submit">Continuar por WhatsApp <ArrowRight/></button>{sent && <small>Solicitud guardada. Abrimos WhatsApp para continuar.</small>}</form></section>
      </main>
      <footer><span>© {new Date().getFullYear()} KIDRIA</span><span>Tecnología construida alrededor de negocios reales.</span><button onClick={onLogin}>Acceso clientes</button></footer>
    </div>
  );
}
