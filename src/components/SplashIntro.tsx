import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface SplashIntroProps {
  onComplete: () => void;
}

export default function SplashIntro({ onComplete }: SplashIntroProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Sequence of animations:
    // Step 0: Black screen (0.6s)
    // Step 1: K logo appears with neon glow (1.6s)
    // Step 2: "KIDRIA" text & subtitle appears (1.8s)
    // Step 3: "No desarrollamos aplicaciones..." appears (2.2s)
    // Step 4: "Descubrimos cuál necesita tu empresa." appears (2.2s)
    // Step 5: "Bienvenido a KIDRIA" with pulse glow (2.2s)
    // Step 6: Trigger onComplete

    const timers = [
      setTimeout(() => setStep(1), 600),   // Show logo
      setTimeout(() => setStep(2), 2200),  // Show logo + KIDRIA name
      setTimeout(() => setStep(3), 4000),  // Show "No desarrollamos aplicaciones..."
      setTimeout(() => setStep(4), 6200),  // Show "Descubrimos cuál necesita tu empresa."
      setTimeout(() => setStep(5), 8400),  // Show "Bienvenido a KIDRIA"
      setTimeout(() => onComplete(), 10600) // Transition to panel
    ];

    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, [onComplete]);

  // Handle immediate skip
  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-[#040406] z-50 flex flex-col items-center justify-center overflow-hidden font-sans">
      
      {/* Ambient background particles or grid */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40" />

      {/* Futuristic floating lines */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent animate-pulse" />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/20 to-transparent animate-pulse" />

      <AnimatePresence mode="wait">
        {/* Step 1 & 2: Branding Sequence */}
        {(step === 1 || step === 2) && (
          <motion.div
            key="branding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center justify-center text-center px-4"
          >
            {/* Custom SVG logo mimicking the uploaded KIDRIA logo */}
            <motion.div
              initial={{ scale: 0.7, y: 15, filter: 'blur(10px)' }}
              animate={{ scale: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ 
                type: 'spring', 
                stiffness: 70, 
                damping: 15,
                delay: 0.1 
              }}
              className="relative w-40 h-40 md:w-48 md:h-48 flex items-center justify-center drop-shadow-[0_0_25px_rgba(99,102,241,0.25)]"
            >
              <svg viewBox="0 0 120 120" fill="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  {/* Gradients */}
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="120" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#00c6ff" />
                    <stop offset="100%" stopColor="#0072ff" />
                  </linearGradient>
                  <linearGradient id="purpleGrad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#d946ef" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                  {/* Outer Glow */}
                  <filter id="glow-effect" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Left Side: Futuristic Slanted Pillar (Blue Gradient) */}
                <path 
                  d="M40 25 H52 L44 53 L52 81 H40 L32 53 Z" 
                  fill="url(#blueGrad)" 
                  filter="url(#glow-effect)"
                  className="opacity-95"
                />

                {/* Right Side: Sleek Inverted Chevron Arms (Purple/Purple-Blue Gradient) */}
                <path 
                  d="M52 53 L78 25 H92 L64 53 L92 81 H78 Z" 
                  fill="url(#purpleGrad)" 
                  filter="url(#glow-effect)"
                  className="opacity-95"
                />
              </svg>

              {/* Dynamic light streak behind */}
              <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full animate-pulse -z-10" />
            </motion.div>

            {/* KIDRIA Typography with Shiny Neon Glow */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="mt-6 flex flex-col items-center"
              >
                <h1 className="text-4xl md:text-5xl font-black font-display tracking-[0.25em] text-white flex items-center justify-center relative select-none">
                  KIDRIA
                  {/* Subtle purple dots/glow indicator */}
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-16 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
                </h1>

                {/* Tagline */}
                <p className="text-[10px] md:text-xs text-zinc-400 font-mono tracking-[0.35em] mt-4 uppercase">
                  <span className="text-cyan-400">Inteligencia</span> • <span className="text-purple-400">Innovación</span> • Impacto
                </p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Step 3: Message 1 */}
        {step === 3 && (
          <motion.div
            key="msg1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="text-center px-6 max-w-2xl flex flex-col items-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-spin" style={{ animationDuration: '4s' }} />
            </div>
            <h2 className="text-2xl md:text-4xl font-extrabold font-display leading-tight text-white tracking-tight">
              &ldquo;No desarrollamos aplicaciones...&rdquo;
            </h2>
            <p className="text-zinc-500 text-sm font-mono mt-4 tracking-widest uppercase">KIDRIA Vision</p>
          </motion.div>
        )}

        {/* Step 4: Message 2 */}
        {step === 4 && (
          <motion.div
            key="msg2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="text-center px-6 max-w-2xl flex flex-col items-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6">
              <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
            </div>
            <h2 className="text-2xl md:text-4xl font-extrabold font-display leading-tight text-white tracking-tight">
              &ldquo;Descubrimos cuál <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">necesita tu empresa</span>.&rdquo;
            </h2>
            <p className="text-zinc-500 text-sm font-mono mt-4 tracking-widest uppercase">KIDRIA Strategy</p>
          </motion.div>
        )}

        {/* Step 5: Message 3 (Welcome) */}
        {step === 5 && (
          <motion.div
            key="msg3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-center px-6 flex flex-col items-center justify-center relative"
          >
            {/* Massive pulsing background glow */}
            <div className="absolute -z-10 w-96 h-96 bg-gradient-to-tr from-cyan-500/10 to-purple-500/15 rounded-full blur-3xl animate-ping opacity-50" style={{ animationDuration: '3s' }} />
            
            <svg viewBox="0 0 120 120" fill="none" className="w-24 h-24 mb-6 drop-shadow-[0_0_15px_rgba(147,51,234,0.3)]" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M40 25 H52 L44 53 L52 81 H40 L32 53 Z" 
                fill="url(#blueGrad)" 
              />
              <path 
                d="M52 53 L78 25 H92 L64 53 L92 81 H78 Z" 
                fill="url(#purpleGrad)" 
              />
            </svg>

            <h3 className="text-xs text-indigo-400 font-mono tracking-[0.4em] uppercase mb-2">Bienvenido a</h3>
            <h1 className="text-4xl md:text-6xl font-black font-display tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-100 to-indigo-200">
              KIDRIA
            </h1>
            
            <p className="text-zinc-500 text-xs font-mono mt-6 animate-pulse">Accediendo a la Plataforma de Control...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern, elegant Skip Button */}
      <button 
        onClick={handleSkip}
        className="absolute bottom-8 right-8 px-4 py-1.5 rounded-full border border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all text-xs font-mono tracking-wider flex items-center gap-1.5 select-none cursor-pointer"
      >
        Saltar intro 
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="13 17 18 12 13 7"></polyline>
          <polyline points="6 17 11 12 6 7"></polyline>
        </svg>
      </button>
    </div>
  );
}
