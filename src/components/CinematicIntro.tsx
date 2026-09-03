import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { BarChart3, CreditCard, Nfc, QrCode, ShoppingBag } from 'lucide-react';

interface CinematicIntroProps { onComplete: () => void; }

const labels = ['Entendemos tu negocio', 'Construimos la solución', 'Conectamos cada oportunidad', 'Tu negocio avanza'];

export default function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const [elapsed, setElapsed] = useState(0);
  const completed = useRef(false);
  const scene = elapsed < 1700 ? 0 : elapsed < 3900 ? 1 : elapsed < 5900 ? 2 : 3;
  const finish = () => {
    if (completed.current) return;
    completed.current = true;
    onComplete();
  };

  useEffect(() => {
    const started = performance.now();
    const ticker = window.setInterval(() => setElapsed(performance.now() - started), 50);
    const ending = window.setTimeout(finish, 7600);
    return () => { window.clearInterval(ticker); window.clearTimeout(ending); };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-[#030907] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_65%,rgba(190,242,100,.12),transparent_42%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(190,242,100,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(190,242,100,.12)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,transparent,black_35%,black)]" />

      <div className="absolute left-5 top-5 z-20 flex items-center gap-3 sm:left-8 sm:top-7">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-lime-300/20 bg-white/5 p-2">
          <svg viewBox="0 0 120 120" fill="none" className="h-full w-full"><path d="M40 25H52L44 53L52 81H40L32 53Z" fill="#bef264" /><path d="M52 53L78 25H92L64 53L92 81H78Z" fill="#67e8f9" /></svg>
        </div>
        <div><p className="font-display text-sm font-black tracking-[.2em]">KIDRIA</p><p className="text-[8px] font-bold uppercase tracking-[.22em] text-lime-300">Construyendo futuro</p></div>
      </div>

      <div className="relative flex h-full flex-col items-center justify-center px-5 pb-24 pt-24">
        <div className="relative h-[310px] w-full max-w-3xl sm:h-[400px]">
          <motion.div initial={{ opacity: 0, scale: .75 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .8 }} className="absolute inset-x-0 bottom-5 mx-auto h-6 w-4/5 rounded-[50%] bg-lime-300/10 blur-xl" />
          <motion.div initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: 'easeOut' }} className="absolute inset-x-0 bottom-8 mx-auto h-44 w-[78%] max-w-xl rounded-t-3xl border border-white/15 bg-[#0c1b15] shadow-2xl sm:h-56">
            <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: .65, duration: .7 }} className="absolute inset-x-5 top-0 h-16 origin-bottom -translate-y-full rounded-t-2xl border border-b-0 border-lime-300/25 bg-gradient-to-b from-lime-300/15 to-[#0c1b15] sm:h-20" />
            <div className="absolute inset-x-8 top-7 flex justify-between sm:inset-x-14 sm:top-10">
              {[0, 1, 2].map(i => <motion.div key={i} initial={{ opacity: 0, scale: .4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.1 + i * .18 }} className="h-14 w-14 rounded-lg border border-cyan-300/20 bg-cyan-300/5 sm:h-20 sm:w-20" />)}
            </div>
            <motion.div initial={{ height: 0 }} animate={{ height: '42%' }} transition={{ delay: 1.5, duration: .6 }} className="absolute bottom-0 left-1/2 w-16 -translate-x-1/2 rounded-t-xl border border-b-0 border-lime-300/30 bg-lime-300/10 sm:w-20" />
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7 }} className="absolute left-1/2 top-1 -translate-x-1/2 -translate-y-full whitespace-nowrap pb-5 font-display text-xs font-black tracking-[.3em] text-lime-200 sm:text-sm">TU NEGOCIO</motion.div>
          </motion.div>

          {scene >= 2 && <>
            <motion.div initial={{ opacity: 0, x: -90 }} animate={{ opacity: 1, x: 0 }} className="absolute left-[4%] top-[10%] rounded-2xl border border-white/15 bg-[#0d2119]/95 p-3 shadow-xl sm:left-[8%] sm:p-4"><QrCode className="h-6 w-6 text-lime-300 sm:h-8 sm:w-8" /><span className="mt-2 block text-[9px] font-bold uppercase tracking-wider text-white/55">Menú QR</span></motion.div>
            <motion.div initial={{ opacity: 0, x: 90 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .15 }} className="absolute right-[4%] top-[15%] rounded-2xl border border-white/15 bg-[#0d2119]/95 p-3 shadow-xl sm:right-[8%] sm:p-4"><Nfc className="h-6 w-6 text-cyan-300 sm:h-8 sm:w-8" /><span className="mt-2 block text-[9px] font-bold uppercase tracking-wider text-white/55">NFC</span></motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .3 }} className="absolute bottom-[7%] left-[1%] rounded-full border border-white/10 bg-white/5 p-3 sm:left-[10%]"><ShoppingBag className="h-5 w-5 text-white/70" /></motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .45 }} className="absolute bottom-[5%] right-[1%] rounded-full border border-white/10 bg-white/5 p-3 sm:right-[10%]"><CreditCard className="h-5 w-5 text-white/70" /></motion.div>
          </>}
          {scene === 3 && <motion.div initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-lime-300/40 bg-[#07110e]/90 shadow-[0_0_80px_rgba(190,242,100,.3)] sm:h-32 sm:w-32"><BarChart3 className="h-10 w-10 text-lime-300 sm:h-14 sm:w-14" /></motion.div>}
        </div>

        <motion.div key={scene} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[.3em] text-lime-300">{String(scene + 1).padStart(2, '0')} / 04</p>
          <h1 className="mt-3 font-display text-2xl font-black tracking-tight sm:text-4xl">{labels[scene]}</h1>
          <p className="mt-2 text-xs text-white/45 sm:text-sm">Kidria convierte necesidades reales en soluciones que funcionan.</p>
        </motion.div>
      </div>

      <div className="absolute inset-x-5 bottom-6 z-20 sm:inset-x-8">
        <div className="h-0.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-cyan-300 to-lime-300" style={{ width: `${Math.min(100, elapsed / 76)}%` }} /></div>
        <div className="mt-4 flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[.2em] text-white/30">Una transformación Kidria</p><button onClick={finish} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white/65 transition hover:bg-white/10 hover:text-white">Omitir intro</button></div>
      </div>
    </div>
  );
}
