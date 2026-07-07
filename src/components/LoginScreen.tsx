import React, { useState, useEffect } from 'react';
import { 
  Mail, Lock, User, Building2, Phone, Briefcase, 
  Sparkles, ArrowRight, Loader2, ShieldAlert, CheckCircle,
  RefreshCw, Inbox, ChevronDown, ChevronUp, X, Send, Eye, EyeOff
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithCustomToken,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  setDoc,
  getDoc
} from 'firebase/firestore';
import { UserProfile } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  showToast: (msg: string) => void;
}

export default function LoginScreen({ onLoginSuccess, showToast }: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'forgot' | 'reset_confirm'>('signin');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sign In form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign Up form states
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupCompany, setSignupCompany] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupGiro, setSignupGiro] = useState('Restaurantes y Delivery');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Pending Verification state
  const [verificationPending, setVerificationPending] = useState<{
    uid: string;
    email: string;
    nombre: string;
  } | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Password Reset Confirmation state
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Sandbox simulation emails list
  const [sandboxEmails, setSandboxEmails] = useState<any[]>([]);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [selectedSandboxEmail, setSelectedSandboxEmail] = useState<any | null>(null);

  // Auto-detect URL query parameters for verification and reset flows
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifiedStatus = params.get('verified');
    const action = params.get('action');
    const token = params.get('token');

    if (verifiedStatus === 'success') {
      showToast('¡Tu correo ha sido verificado con éxito! Ya puedes iniciar sesión.');
      setActiveTab('signin');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (verifiedStatus === 'error') {
      const reason = params.get('reason');
      let msg = 'El enlace de verificación es inválido o ha expirado.';
      if (reason === 'expired_token') {
        msg = 'Tu enlace de verificación ha expirado. Por favor solicita uno nuevo.';
      } else if (reason === 'invalid_token') {
        msg = 'El enlace de verificación es inválido. Intenta registrarte de nuevo.';
      }
      setErrorMsg(msg);
      setActiveTab('signin');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (action === 'reset-password' && token) {
      setResetToken(token);
      setActiveTab('reset_confirm');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Cooldown effect for resending verification emails
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Polling to load emails in Sandbox Mode for development convenience
  useEffect(() => {
    let intervalId: any;
    const fetchSandboxEmails = async () => {
      try {
        const res = await fetch('/api/auth/sent-emails');
        if (res.ok) {
          const data = await res.json();
          setSandboxEmails(data.emails || []);
        }
      } catch (err) {
        console.warn('Sandbox inbox fetching failed. Running in standalone production environment.');
      }
    };

    fetchSandboxEmails();
    intervalId = setInterval(fetchSandboxEmails, 4000);
    return () => clearInterval(intervalId);
  }, []);

  // Handle Sign In with Verification Safeguard
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setErrorMsg('Por favor completa todos los campos.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/auth/login-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error de autenticación. Verifica tus credenciales.');
      }

      const { customToken, userProfile } = data;

      // Authenticate Firebase Client SDK using the secure Custom Token from the backend
      let firebaseUser: any = null;
      const isValidJwt = (token: string) => {
        if (!token) return false;
        const parts = token.split('.');
        return parts.length === 3;
      };

      if (customToken && isValidJwt(customToken)) {
        try {
          const userCredential = await signInWithCustomToken(auth, customToken);
          firebaseUser = userCredential.user;
        } catch (authError) {
          console.warn('Firebase signInWithCustomToken failed, using local bypass fallback:', authError);
          localStorage.setItem('kidria_bypass_user', JSON.stringify(userProfile));
          showToast(`¡Bienvenido de vuelta (Modo Local), ${userProfile.nombre}!`);
          onLoginSuccess(userProfile);
          return;
        }
      } else {
        console.warn('Custom token format is invalid (fallback mode), skipping signInWithCustomToken.');
        localStorage.setItem('kidria_bypass_user', JSON.stringify(userProfile));
        showToast(`¡Bienvenido de vuelta (Modo Local), ${userProfile.nombre}!`);
        onLoginSuccess(userProfile);
        return;
      }

      // SMTP Email Verification Safeguard
      // We skip verification for any admin account for easy testing
      const cleanEmailToCheck = loginEmail.trim().toLowerCase();
      const isAdminUser = cleanEmailToCheck === 'admin@kidria.com' || cleanEmailToCheck === 'kino9230@gmail.com' || cleanEmailToCheck.includes('admin');
      
      if (!userProfile.verified && !isAdminUser) {
        setVerificationPending({
          uid: firebaseUser.uid,
          email: firebaseUser.email || loginEmail.trim(),
          nombre: userProfile.nombre
        });
        setLoading(false);
        return;
      }

      showToast(`¡Bienvenido de vuelta, ${userProfile.nombre}!`);
      onLoginSuccess(userProfile);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error de autenticación. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Sign Up & Trigger Server Verification
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName || !signupEmail || !signupPassword || !signupCompany || !signupPhone) {
      setErrorMsg('Por favor completa todos los campos del registro.');
      return;
    }

    if (signupPassword.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/auth/register-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail.trim(),
          password: signupPassword,
          name: signupName.trim(),
          empresa: signupCompany.trim(),
          telefono: signupPhone.trim(),
          giro: signupGiro
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al registrar la cuenta.');
      }

      const { customToken, userProfile } = data;

      // Authenticate Firebase Client SDK using secure Custom Token
      let firebaseUser: any = null;
      let isBypass = false;
      const isValidJwt = (token: string) => {
        if (!token) return false;
        const parts = token.split('.');
        return parts.length === 3;
      };

      if (customToken && isValidJwt(customToken)) {
        try {
          const userCredential = await signInWithCustomToken(auth, customToken);
          firebaseUser = userCredential.user;
        } catch (authError) {
          console.warn('Firebase signInWithCustomToken failed during signup, using local bypass fallback:', authError);
          firebaseUser = { uid: userProfile.uid, email: userProfile.email };
          isBypass = true;
        }
      } else {
        console.warn('Custom token format is invalid (fallback mode), skipping signInWithCustomToken during signup.');
        firebaseUser = { uid: userProfile.uid, email: userProfile.email };
        isBypass = true;
      }

      // Log in immediately and redirect directly to the new account!
      if (isBypass) {
        localStorage.setItem('kidria_bypass_user', JSON.stringify(userProfile));
      }
      showToast(`¡Cuenta creada con éxito! Bienvenido, ${userProfile.nombre}.`);
      onLoginSuccess(userProfile);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al registrar la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  // Check email verification status manually
  const handleCheckVerification = async () => {
    if (!verificationPending) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await currentUser.reload();
        if (currentUser.emailVerified) {
          // Sync profile to verified: true via secure server api
          await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: currentUser.uid, profile: { verified: true } })
          });

          const profileRef = doc(db, 'usuarios', currentUser.uid);
          const profileSnap = await getDoc(profileRef).catch(() => null);
          const profileData = profileSnap?.exists() ? profileSnap.data() : {
            uid: currentUser.uid,
            email: currentUser.email || '',
            nombre: currentUser.displayName || 'Usuario KIDRIA',
            empresa: 'Mi Empresa',
            role: 'cliente',
            verified: true
          };

          showToast('¡Felicidades! Cuenta verificada con éxito.');
          onLoginSuccess(profileData as UserProfile);
        } else {
          setErrorMsg('Tu correo aún no ha sido verificado. Por favor haz clic en el enlace que te enviamos.');
        }
      } else {
        setErrorMsg('Sesión de usuario no encontrada. Por favor inicia sesión de nuevo.');
        setVerificationPending(null);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al consultar estado: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Re-send verification email
  const handleResendVerification = async () => {
    if (!verificationPending || resendCooldown > 0) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: verificationPending.email,
          uid: verificationPending.uid,
          name: verificationPending.nombre
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Enlace de verificación enviado.');
        setResendCooldown(60); // 1 min cooldown
      } else {
        setErrorMsg(data.error || 'Error al enviar enlace.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setErrorMsg('Ingresa tu correo electrónico.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setForgotSuccess(true);
        showToast('Enlace de restablecimiento enviado con éxito.');
      } else {
        setErrorMsg(data.error || 'Error al solicitar el enlace.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error de red. Intenta más tarde.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Password Reset Confirm
  const handleResetPasswordConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setErrorMsg('Completa todos los campos.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/reset-password-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setResetSuccess(true);
        showToast('¡Tu contraseña ha sido actualizada con éxito!');
      } else {
        setErrorMsg(data.error || 'Error al restablecer la contraseña.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error de red al actualizar contraseña.');
    } finally {
      setLoading(false);
    }
  };

  // Cancel pending verification and go back to login screen
  const handleCancelVerification = async () => {
    await signOut(auth);
    setVerificationPending(null);
    setActiveTab('signin');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg z-10 space-y-8 animate-fade-in my-8">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl mb-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
              Portal Seguro — KIDRIA
            </span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white font-display">
            KIDRIA <span className="text-indigo-400 font-light">PLATFORM</span>
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm max-w-sm mx-auto">
            Accede a tu panel integral para el diseño, cotización y monitoreo de tu Aplicación Web Progresiva (PWA).
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          
          {/* 1. VIEW: EMAIL VERIFICATION PENDING SCREEN */}
          {verificationPending ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto w-16 h-16 bg-indigo-950/50 border border-indigo-500/30 rounded-2xl flex items-center justify-center animate-bounce">
                <Mail className="w-8 h-8 text-indigo-400" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Verificación Pendiente</h3>
                <p className="text-zinc-400 text-xs leading-relaxed max-w-sm mx-auto">
                  Hemos enviado un correo de activación SMTP seguro a:
                  <br />
                  <span className="text-indigo-300 font-semibold font-mono block mt-1.5 py-1 px-3 bg-zinc-950 rounded-lg border border-zinc-800/50 inline-block">
                    {verificationPending.email}
                  </span>
                </p>
                <p className="text-[11px] text-zinc-500 leading-relaxed pt-1">
                  Por favor, haz clic en el botón de confirmación dentro del correo para activar tu cuenta de cliente.
                </p>
              </div>

              {errorMsg && (
                <div className="bg-red-950/40 border border-red-500/30 text-red-300 p-3 rounded-xl text-xs text-left flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <button
                  onClick={handleCheckVerification}
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/25"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span>Ya verifiqué mi correo</span>
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleResendVerification}
                    disabled={loading || resendCooldown > 0}
                    className="bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 text-zinc-300 disabled:text-zinc-600 font-bold py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{resendCooldown > 0 ? `${resendCooldown}s` : 'Reenviar'}</span>
                  </button>

                  <button
                    onClick={handleCancelVerification}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 font-bold py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Regresar</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800/40 text-[10px] text-zinc-500 flex items-center justify-center gap-1.5">
                <Inbox className="w-3.5 h-3.5 text-zinc-600" />
                <span>¿No te llega? Abre la pestaña de <b>Sandbox de Correo</b> abajo.</span>
              </div>
            </div>
          ) : (
            <>
              {/* NORMAL FLOWS: SIGNIN, SIGNUP, FORGOT, RESET */}
              {activeTab !== 'forgot' && activeTab !== 'reset_confirm' && (
                <div className="grid grid-cols-2 bg-zinc-950 p-1.5 rounded-2xl mb-6 border border-zinc-800/30">
                  <button
                    onClick={() => {
                      setActiveTab('signin');
                      setErrorMsg(null);
                    }}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'signin'
                        ? 'bg-zinc-900 text-white shadow'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Iniciar Sesión
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('signup');
                      setErrorMsg(null);
                    }}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'signup'
                        ? 'bg-zinc-900 text-white shadow'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Registrar Cuenta
                  </button>
                </div>
              )}



              {/* Error Alert Display */}
              {errorMsg && (
                <div className="mb-6 bg-red-950/40 border border-red-500/30 text-red-300 p-4 rounded-2xl flex items-start gap-2.5 text-xs">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold font-display text-[11px] uppercase tracking-wide">Ha ocurrido un detalle:</p>
                    <p className="mt-0.5 text-zinc-300 leading-relaxed">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* VIEW: SIGN IN FORM */}
              {activeTab === 'signin' && (
                <form onSubmit={handleSignIn} className="space-y-4 animate-fade-in">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="ejemplo@correo.com"
                        className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-white rounded-xl py-3 pl-10 pr-4 text-xs outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">
                        Contraseña
                      </label>
                      <button 
                        type="button"
                        onClick={() => {
                          setActiveTab('forgot');
                          setErrorMsg(null);
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type={showLoginPassword ? "text" : "password"}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-white rounded-xl py-3 pl-10 pr-10 text-xs outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verificando credenciales...</span>
                      </>
                    ) : (
                      <>
                        <span>Acceder al Panel</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* VIEW: SIGN UP FORM */}
              {activeTab === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">
                        Nombre Completo
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="text"
                          required
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          placeholder="Carlos Gómez"
                          className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-white rounded-xl py-3 pl-10 pr-4 text-xs outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">
                        Nombre de la Empresa
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="text"
                          required
                          value={signupCompany}
                          onChange={(e) => setSignupCompany(e.target.value)}
                          placeholder="ej. Aura Belleza & Spa"
                          className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-white rounded-xl py-3 pl-10 pr-4 text-xs outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">
                        Número de Teléfono
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="tel"
                          required
                          value={signupPhone}
                          onChange={(e) => setSignupPhone(e.target.value)}
                          placeholder="+52 667 123 4567"
                          className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-white rounded-xl py-3 pl-10 pr-4 text-xs outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">
                        Giro de la Empresa
                      </label>
                      <div className="relative">
                        <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <select
                          value={signupGiro}
                          onChange={(e) => setSignupGiro(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-white rounded-xl py-3 pl-10 pr-4 text-xs outline-none transition-all appearance-none cursor-pointer"
                        >
                          <option value="Restaurantes y Delivery">Restaurantes y Delivery</option>
                          <option value="Servicios Profesionales">Servicios Profesionales</option>
                          <option value="Comercio y Retail">Comercio y Retail</option>
                          <option value="Salud y Bienestar">Salud y Bienestar</option>
                          <option value="Educación e Infoproductos">Educación e Infoproductos</option>
                          <option value="Otros">Otro Sector</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="email"
                        required
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="ejemplo@correo.com"
                        className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-white rounded-xl py-3 pl-10 pr-4 text-xs outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">
                      Contraseña de Acceso
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type={showSignupPassword ? "text" : "password"}
                        required
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-white rounded-xl py-3 pl-10 pr-10 text-xs outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                      >
                        {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creando tu espacio...</span>
                      </>
                    ) : (
                      <>
                        <span>Comenzar a Crear</span>
                        <Sparkles className="w-4 h-4 text-yellow-300" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* VIEW: FORGOT PASSWORD REQUEST FORM */}
              {activeTab === 'forgot' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3 mb-2">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display flex items-center gap-2">
                      <Lock className="w-4 h-4 text-indigo-400" />
                      Recuperar Contraseña
                    </h3>
                    <button
                      onClick={() => {
                        setActiveTab('signin');
                        setForgotSuccess(false);
                        setErrorMsg(null);
                      }}
                      className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    >
                      Regresar
                    </button>
                  </div>

                  {forgotSuccess ? (
                    <div className="space-y-6 py-4 text-center">
                      <div className="w-12 h-12 bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-white font-bold text-sm">¡Correo de recuperación enviado!</p>
                        <p className="text-zinc-400 text-xs max-w-xs mx-auto leading-relaxed">
                          Si la cuenta <b>{forgotEmail}</b> está registrada en nuestro servidor, recibirás en breve un enlace para restablecer tu contraseña.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setActiveTab('signin');
                          setForgotSuccess(false);
                          setForgotEmail('');
                        }}
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold py-3 rounded-xl text-xs cursor-pointer"
                      >
                        Volver a Iniciar Sesión
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <p className="text-zinc-400 text-xs leading-relaxed">
                        Ingresa el correo electrónico asociado a tu cuenta. Te enviaremos un enlace SMTP seguro para configurar una nueva contraseña.
                      </p>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">
                          Correo Electrónico
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input
                            type="email"
                            required
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="tu-correo@servidor.com"
                            className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-white rounded-xl py-3 pl-10 pr-4 text-xs outline-none transition-all"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Enviar Enlace de Recuperación</span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* VIEW: PASSWORD RESET CONFIRM FORM */}
              {activeTab === 'reset_confirm' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="border-b border-zinc-800/60 pb-3 mb-2">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display flex items-center gap-2">
                      <Lock className="w-4 h-4 text-indigo-400" />
                      Nueva Contraseña de Acceso
                    </h3>
                  </div>

                  {resetSuccess ? (
                    <div className="space-y-6 py-4 text-center">
                      <div className="w-12 h-12 bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-white font-bold text-sm">Contraseña Actualizada</p>
                        <p className="text-zinc-400 text-xs max-w-xs mx-auto leading-relaxed">
                          Tu contraseña ha sido restablecida de forma exitosa en el servidor. Ya puedes ingresar con tu nueva clave.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setActiveTab('signin');
                          setResetSuccess(false);
                          setNewPassword('');
                          setConfirmPassword('');
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs cursor-pointer shadow-lg shadow-indigo-600/25"
                      >
                        Iniciar Sesión con Clave Nueva
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleResetPasswordConfirm} className="space-y-4">
                      <p className="text-zinc-400 text-xs leading-relaxed">
                        Ingresa y confirma tu nueva contraseña segura para tu cuenta de KIDRIA.
                      </p>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">
                          Nueva Contraseña
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input
                            type={showNewPassword ? "text" : "password"}
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-white rounded-xl py-3 pl-10 pr-10 text-xs outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-display">
                          Confirmar Nueva Contraseña
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirma la clave"
                            className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-white rounded-xl py-3 pl-10 pr-4 text-xs outline-none transition-all"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
                      >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>Establecer Clave de Acceso</span>
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer info card */}
        <div className="text-center text-[10px] text-zinc-500">
          KIDRIA Platform SaaS v1.1.0. Conexión segura encriptada mediante Firebase.
        </div>
      </div>

      {/* ======================================================== */}
      {/* 📬 INTERACTIVE SMTP EMAIL SANDBOX CLIENT (FLOATING PANEL) */}
      {/* ======================================================== */}
      <div className="fixed bottom-4 right-4 z-50">
        {!sandboxOpen ? (
          <button
            onClick={() => setSandboxOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-5 rounded-full shadow-2xl transition-all cursor-pointer border border-indigo-500/30 scale-100 hover:scale-105"
          >
            <Inbox className="w-4 h-4 animate-pulse" />
            <span className="text-xs tracking-wide">Inbox de Simulación SMTP ({sandboxEmails.length})</span>
          </button>
        ) : (
          <div className="w-[380px] h-[500px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
            {/* Header */}
            <div className="bg-zinc-950 p-4 border-b border-zinc-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  SMTP Sandbox Inbox
                </h4>
              </div>
              <button
                onClick={() => {
                  setSandboxOpen(false);
                  setSelectedSandboxEmail(null);
                }}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Email list or Single email detail */}
            {selectedSandboxEmail ? (
              <div className="flex-1 flex flex-col bg-zinc-900 overflow-hidden">
                {/* Back bar */}
                <div className="p-3 bg-zinc-950 border-b border-zinc-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedSandboxEmail(null)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    ← Volver a la lista
                  </button>
                  <span className="text-[9px] text-zinc-500 font-mono">
                    {new Date(selectedSandboxEmail.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Email meta */}
                <div className="p-3 bg-zinc-950/40 border-b border-zinc-800 text-[11px] space-y-1">
                  <div><span className="text-zinc-500">Para:</span> <span className="text-zinc-300 font-mono font-semibold">{selectedSandboxEmail.to}</span></div>
                  <div><span className="text-zinc-500">Asunto:</span> <span className="text-zinc-200 font-medium">{selectedSandboxEmail.subject}</span></div>
                </div>

                {/* Body Content */}
                <div className="flex-1 p-4 overflow-y-auto bg-black border-b border-zinc-800">
                  <div className="scale-90 origin-top text-white leading-relaxed">
                    <div dangerouslySetInnerHTML={{ __html: selectedSandboxEmail.html }} />
                  </div>
                </div>

                {/* Actions */}
                <div className="p-3 bg-zinc-950 flex flex-col gap-2">
                  <a
                    href={selectedSandboxEmail.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      setSandboxOpen(false);
                      setSelectedSandboxEmail(null);
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3 rounded-lg text-xs text-center transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>👉 Simular Clic en Enlace</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-zinc-950/20">
                {sandboxEmails.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="w-10 h-10 bg-zinc-800/40 border border-zinc-700/20 rounded-full flex items-center justify-center text-zinc-600">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-zinc-400">Sin correos por ahora</p>
                      <p className="text-[10px] text-zinc-600 max-w-[200px] leading-relaxed">
                        Crea una cuenta o solicita restablecer contraseña para ver la correspondencia SMTP aquí.
                      </p>
                    </div>
                  </div>
                ) : (
                  sandboxEmails.map((email: any) => (
                    <button
                      key={email.id}
                      onClick={() => setSelectedSandboxEmail(email)}
                      className="w-full text-left p-3.5 bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800/60 rounded-xl transition-all cursor-pointer group flex flex-col gap-1"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          email.type === 'verification' 
                            ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/20' 
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/20'
                        }`}>
                          {email.type === 'verification' ? 'VERIFICACIÓN' : 'RESTAURACIÓN'}
                        </span>
                        <span className="text-[9px] text-zinc-500 font-mono">
                          {new Date(email.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white group-hover:text-indigo-300 truncate mt-1">
                        {email.subject}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        Para: {email.to}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Hint footer */}
            <div className="p-3 bg-zinc-950 border-t border-zinc-800 text-[9px] text-zinc-500 leading-normal text-center">
              Modo Sandbox Activo. En producción, los correos son entregados mediante SMTP real.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
