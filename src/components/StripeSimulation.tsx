import React, { useState } from 'react';
import { CreditCard, CheckCircle2, Lock, ArrowLeft, Landmark, Smartphone, ExternalLink, RefreshCw } from 'lucide-react';
import { getStoredState } from '../data';

interface StripeSimulationProps {
  onClose: () => void;
  onPaymentSuccess: (invoiceId?: string) => void;
  amount: number;
  concept: string;
  orderId: string;
  invoiceId?: string;
  isSubscription?: boolean;
}

export default function StripeSimulation({
  onClose,
  onPaymentSuccess,
  amount,
  concept,
  orderId,
  invoiceId,
  isSubscription = false
}: StripeSimulationProps) {
  const [storedData] = useState(() => getStoredState());
  const settings = storedData.settings;
  
  const [activeMethod, setActiveMethod] = useState<'transferencia' | 'deposito' | 'mercadopago'>('transferencia');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setSuccess(true);
      setTimeout(() => {
        onPaymentSuccess(invoiceId);
      }, 1500);
    }, 1800);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl transition-all">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-semibold font-display">Portal de Pago KIDRIA</h2>
              <p className="text-slate-400 text-xs">Acreditación Oficial de Transacciones</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {!success ? (
          <div className="p-6 space-y-6">
            {/* Summary */}
            <div className="bg-slate-950/30 border border-slate-800/80 p-4 rounded-xl space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider font-mono">Concepto de Pago</p>
                  <p className="text-white font-medium text-xs mt-0.5">{concept}</p>
                </div>
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase font-mono">
                  {isSubscription ? 'Suscripción Recurrente' : 'Pago Único'}
                </span>
              </div>
              <div className="border-t border-slate-800/80 pt-2 flex justify-between items-center">
                <span className="text-slate-400 text-xs">Total a pagar:</span>
                <span className="text-xl font-bold font-display text-white">
                  ${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-slate-400">MXN</span>
                </span>
              </div>
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveMethod('transferencia')}
                className={`py-2 px-1.5 rounded-lg text-[10.5px] font-bold font-display flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeMethod === 'transferencia'
                    ? 'bg-slate-800 text-emerald-400 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                }`}
              >
                <Landmark className="w-4 h-4" />
                <span>SPEI Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMethod('deposito')}
                className={`py-2 px-1.5 rounded-lg text-[10.5px] font-bold font-display flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeMethod === 'deposito'
                    ? 'bg-slate-800 text-emerald-400 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Depósito</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMethod('mercadopago')}
                className={`py-2 px-1.5 rounded-lg text-[10.5px] font-bold font-display flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  activeMethod === 'mercadopago'
                    ? 'bg-slate-800 text-cyan-400 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Mercado Pago</span>
              </button>
            </div>

            {/* Method Details Pane */}
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-4">
              {activeMethod === 'transferencia' && (
                <div className="space-y-3 text-xs animate-fade-in">
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Realice una transferencia electrónica (SPEI) desde la app de su banco preferido con los siguientes datos:
                  </p>
                  
                  <div className="space-y-2 bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-left font-mono text-[11px]">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">Banco:</span>
                      <span className="text-white font-semibold">{settings.transferAccount.banco}</span>
                    </div>
                    
                    <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">CLABE:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold">{settings.transferAccount.clabe}</span>
                        <button
                          onClick={() => handleCopy(settings.transferAccount.clabe, 'CLABE')}
                          className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded cursor-pointer"
                        >
                          {copiedText === 'CLABE' ? '¡Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">Beneficiario:</span>
                      <span className="text-zinc-300 text-[10.5px] truncate max-w-[200px] text-right">{settings.transferAccount.beneficiario}</span>
                    </div>

                    <div className="flex justify-between items-center pt-0.5">
                      <span className="text-slate-500">Monto exacto:</span>
                      <span className="text-white font-bold">${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</span>
                    </div>
                  </div>
                </div>
              )}

              {activeMethod === 'deposito' && (
                <div className="space-y-3 text-xs animate-fade-in">
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Realice su depósito directamente en ventanilla bancaria o tiendas de conveniencia autorizadas:
                  </p>
                  
                  <div className="space-y-2 bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-left font-mono text-[11px]">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">Banco:</span>
                      <span className="text-white font-semibold">{settings.depositAccount.banco}</span>
                    </div>
                    
                    <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">No. Cuenta:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-400 font-bold">{settings.depositAccount.cuenta}</span>
                        <button
                          onClick={() => handleCopy(settings.depositAccount.cuenta, 'CUENTA')}
                          className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded cursor-pointer"
                        >
                          {copiedText === 'CUENTA' ? '¡Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">Beneficiario:</span>
                      <span className="text-zinc-300 text-[10.5px] truncate max-w-[200px] text-right">{settings.depositAccount.beneficiario}</span>
                    </div>

                    <div className="flex justify-between items-center pt-0.5">
                      <span className="text-slate-500">Monto exacto:</span>
                      <span className="text-white font-bold">${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</span>
                    </div>
                  </div>
                </div>
              )}

              {activeMethod === 'mercadopago' && (
                <div className="space-y-4 text-xs animate-fade-in text-center">
                  <p className="text-slate-400 text-[11px] leading-relaxed text-left">
                    Haga clic en el siguiente enlace oficial para realizar su transacción segura de forma instantánea a través de la pasarela de <b>Mercado Pago</b>:
                  </p>
                  
                  <div className="py-2.5">
                    <a
                      href={settings.mercadoPagoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg shadow-cyan-500/10 transition-all font-display transform active:scale-95 cursor-pointer text-xs"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Ir a Pagar en Mercado Pago</span>
                    </a>
                  </div>

                  <p className="text-[10px] text-slate-500 italic max-w-xs mx-auto">
                    Una vez completado el pago en la pestaña externa, regrese aquí para confirmar su acreditación en el sistema.
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <button
              onClick={handlePay}
              disabled={processing}
              className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-bold py-3 px-4 rounded-xl transition-all transform active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-display shadow-lg shadow-emerald-500/15 cursor-pointer text-xs uppercase tracking-wider"
            >
              {processing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validando transacción bancaria...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Pago de ${amount.toLocaleString('es-MX')} MXN</span>
                </>
              )}
            </button>

            <p className="text-center text-slate-500 text-[9.5px] flex items-center justify-center gap-1.5 font-mono">
              <span>Soporte de pagos KIDRIA Connect</span>
              <span>•</span>
              <span>Validación instantánea</span>
            </p>
          </div>
        ) : (
          <div className="p-12 text-center space-y-4 flex flex-col items-center">
            <div className="w-16 h-16 bg-emerald-500/15 text-emerald-400 rounded-full flex items-center justify-center mb-2 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold font-display text-white">¡Transacción Registrada!</h3>
            <p className="text-slate-400 text-xs max-w-xs mx-auto leading-relaxed">
              El pago se ha reportado y validado en el sistema con éxito. Redirigiendo a KIDRIA y actualizando el estatus de sus servicios...
            </p>
            <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden mt-4">
              <div className="h-full bg-emerald-500 animate-infinite-loading w-1/2 rounded-full"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
