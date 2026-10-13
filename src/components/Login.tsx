import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { 
  MessageSquare, 
  Shield, 
  Zap, 
  Globe, 
  ArrowRight, 
  Loader2, 
  Check, 
  Mail, 
  Lock, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  KeyRound, 
  AlertCircle,
  CheckCircle2,
  QrCode,
  Laptop,
  Smartphone,
  RefreshCw,
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';
import QRCode from 'qrcode';
import { qrAuthService, QRSessionData } from '../services/qrAuthService';
import { NetworkStatusBar } from './NetworkStatusBar';
import { PWAInstallButton } from './PWAInstallButton';

export function Login() {
  const { signIn, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  
  // Login Tabs: 'welcome' (default start) | 'qr' (WhatsApp Web) | 'email' | 'register' | 'forgot_password'
  const [activeTab, setActiveTab] = useState<'welcome' | 'qr' | 'email' | 'register' | 'forgot_password'>('welcome');
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  
  // Feedback states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // QR Code pairing states
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<'loading' | 'pending' | 'scanned' | 'authenticated' | 'expired'>('loading');
  const [timeLeft, setTimeLeft] = useState<number>(120);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeSessionRef = useRef<(() => void) | null>(null);

  const cleanFeedback = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Start or reload QR pairing session
  const initQRSession = async () => {
    if (unsubscribeSessionRef.current) {
      unsubscribeSessionRef.current();
      unsubscribeSessionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setQrStatus('loading');
    setQrCodeUrl(null);
    setTimeLeft(120);

    try {
      const session = await qrAuthService.createSession();
      setSessionId(session.sessionId);
      setSecretKey(session.secretKey);

      // Generate visual QR code
      const dataUrl = await QRCode.toDataURL(session.qrData, {
        width: 320,
        margin: 1,
        color: {
          dark: '#111b21',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      });
      setQrCodeUrl(dataUrl);
      setQrStatus('pending');

      // Countdown timer
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setQrStatus('expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Listen for mobile scan and authentication
      unsubscribeSessionRef.current = qrAuthService.listenToSession(session.sessionId, async (data: QRSessionData) => {
        if (data.status === 'scanned') {
          setQrStatus('scanned');
        } else if (data.status === 'authenticated' && data.encryptedPayload) {
          setQrStatus('authenticated');
          if (timerRef.current) clearInterval(timerRef.current);

          try {
            // Decrypt and log in
            await qrAuthService.loginFromPairing(data.encryptedPayload, session.secretKey, session.sessionId);
          } catch (loginErr: any) {
            console.error('QR Login completion error:', loginErr);
            setErrorMsg('Erro ao autenticar com o QR code: ' + (loginErr?.message || 'Tente novamente.'));
            setQrStatus('expired');
          }
        }
      });
    } catch (err: any) {
      console.error('Error initiating QR session:', err);
      setErrorMsg('Não foi possível gerar a sessão QR. Verifique a conexão com o Firebase.');
      setQrStatus('expired');
    }
  };

  useEffect(() => {
    if (activeTab === 'qr') {
      initQRSession();
    } else {
      if (unsubscribeSessionRef.current) {
        unsubscribeSessionRef.current();
        unsubscribeSessionRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (unsubscribeSessionRef.current) unsubscribeSessionRef.current();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTab]);

  const mapAuthError = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email ou senha incorretos. Verifique suas credenciais.';
      case 'auth/email-already-in-use':
        return 'Este email já está cadastrado. Faça login ou recupere sua senha.';
      case 'auth/weak-password':
        return 'A senha é muito fraca. Ela deve conter pelo menos 6 caracteres.';
      case 'auth/invalid-email':
        return 'O endereço de email informado não é válido.';
      case 'auth/missing-password':
        return 'Por favor, informe sua senha.';
      case 'auth/operation-not-allowed':
        return 'O login por Email/Senha precisa estar ativado no Firebase Console.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
      case 'auth/popup-closed-by-user':
        return 'A janela de autenticação do Google foi fechada.';
      case 'auth/cancelled-popup-request':
        return 'Solicitação cancelada. Tente novamente.';
      default:
        return err?.message || 'Ocorreu um erro ao processar sua solicitação.';
    }
  };

  const handleGoogleSignIn = async () => {
    cleanFeedback();
    setLoading(true);
    try {
      await signIn();
    } catch (err: any) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    cleanFeedback();

    if (!email.trim()) {
      setErrorMsg('Por favor, informe seu email.');
      return;
    }

    if (activeTab === 'forgot_password') {
      setLoading(true);
      try {
        await resetPassword(email);
        setSuccessMsg('Email de recuperação enviado! Verifique sua caixa de entrada e spam.');
      } catch (err: any) {
        setErrorMsg(mapAuthError(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password) {
      setErrorMsg('Por favor, digite sua senha.');
      return;
    }

    if (activeTab === 'register') {
      if (!name.trim()) {
        setErrorMsg('Por favor, informe seu nome completo.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('As senhas digitadas não coincidem.');
        return;
      }

      setLoading(true);
      try {
        await signUpWithEmail(name, email, password);
      } catch (err: any) {
        setErrorMsg(mapAuthError(err));
      } finally {
        setLoading(false);
      }
    } else {
      // Login with Email
      setLoading(true);
      try {
        await signInWithEmail(email, password);
      } catch (err: any) {
        setErrorMsg(mapAuthError(err));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f2f5] text-zinc-900 font-sans selection:bg-[#00a884] selection:text-white">
      
      {/* Top Network Status & Live Clock Bar */}
      <NetworkStatusBar />

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        
        {/* ========================================================================= */}
        {/* 1. TELA INICIAL: BEM-VINDO AO OFFGRID COM OS DOIS BOTÕES                   */}
        {/* ========================================================================= */}
        {activeTab === 'welcome' && (
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-10 shadow-2xl border border-zinc-200/80 text-center animate-fadeIn flex flex-col items-center">
            
            {/* Logo do OffGrid */}
            <div className="relative mb-6">
              <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-3xl bg-[#00a884] shadow-xl shadow-[#00a884]/25 p-4 transform transition hover:scale-105">
                <img 
                  src="/icon.svg" 
                  alt="Logo OffGrid Link" 
                  className="h-full w-full object-contain filter drop-shadow-sm" 
                />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md border border-zinc-100">
                <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>

            {/* Título */}
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
              Bem vindo ao OffGrid!
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-zinc-500 max-w-sm leading-relaxed">
              Mensagens privadas com suporte online e modo offline via Wi-Fi Direct, Bluetooth e rede Mesh.
            </p>

            {/* OS DOIS BOTÕES PRINCIPAIS */}
            <div className="w-full space-y-3.5 mt-8">
              
              {/* Botão 1: Logar com Google / Email e Senha */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('email');
                  cleanFeedback();
                }}
                className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-white border-2 border-zinc-200 p-4 text-left shadow-xs transition hover:border-[#00a884] hover:bg-zinc-50/70 active:scale-[0.98]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 border border-zinc-200 group-hover:bg-white">
                    <img 
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                      alt="Google" 
                      className="h-5 w-5" 
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 group-hover:text-[#00a884] transition">
                      Logar com Google / Email e Senha
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Entrar com sua conta Google ou email cadastrado
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-zinc-400 group-hover:text-[#00a884] group-hover:translate-x-1 transition" />
              </button>

              {/* Botão 2: Logar com Código QR */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('qr');
                  cleanFeedback();
                }}
                className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-[#00a884] text-white p-4 text-left shadow-lg shadow-[#00a884]/20 hover:bg-[#009475] transition active:scale-[0.98]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs text-white border border-white/20">
                    <QrCode className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Logar com Código QR
                    </h3>
                    <p className="text-[11px] text-white/80">
                      Escaneie com seu celular igual ao WhatsApp Web
                    </p>
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white group-hover:translate-x-1 transition">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </button>

            </div>

            {/* Badges de Destaque */}
            <div className="mt-8 pt-6 border-t border-zinc-100 flex flex-wrap items-center justify-center gap-4 text-zinc-400 text-[11px]">
              <span className="flex items-center gap-1.5 font-medium">
                <Shield className="h-3.5 w-3.5 text-[#00a884]" />
                Criptografia E2EE
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Zap className="h-3.5 w-3.5 text-[#00a884]" />
                Modo Offline Mesh
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Laptop className="h-3.5 w-3.5 text-[#00a884]" />
                WhatsApp Web Link
              </span>
              <PWAInstallButton variant="icon" className="h-8 w-8" />
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. TELA DE LOGIN COM CÓDIGO QR (SOMENTE QR CODE E O TEXTO, SEM ABAS)      */}
        {/* ========================================================================= */}
        {activeTab === 'qr' && (
          <div className="w-full max-w-4xl my-auto rounded-3xl bg-white shadow-xl border border-zinc-200/80 overflow-hidden flex flex-col animate-fadeIn">
            
            {/* Top Bar com apenas o botão de voltar ao início */}
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-6 py-3.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('welcome');
                  cleanFeedback();
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900 transition px-2 py-1 rounded-lg hover:bg-zinc-200/60"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Voltar ao início</span>
              </button>

              <span className="text-[11px] font-bold uppercase tracking-wider text-[#00a884] bg-[#00a884]/10 px-3 py-1 rounded-full">
                WhatsApp Web Link
              </span>
            </div>

            {/* Alertas */}
            {errorMsg && (
              <div className="mx-6 mt-6 rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Conteúdo: Somente o QR Code e o texto/instruções */}
            <div className="p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8 sm:gap-12">
              
              {/* Coluna Esquerda: Texto e instruções */}
              <div className="flex-1 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
                    Use o OffGrid Link no computador
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    Conecte seu celular ao navegador sem digitar senhas, igual ao WhatsApp Web.
                  </p>
                </div>

                <ol className="space-y-4 text-sm text-zinc-700">
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#00a884]/15 text-[#00a884] text-xs font-bold">
                      1
                    </span>
                    <span>Abra o <strong>OffGrid Link</strong> no seu celular ou aparelho já conectado.</span>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#00a884]/15 text-[#00a884] text-xs font-bold">
                      2
                    </span>
                    <span>
                      Toque em <strong>Ajustes</strong> ou no ícone <strong>Aparelhos Conectados</strong> (ícone de computador no topo das conversas).
                    </span>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#00a884]/15 text-[#00a884] text-xs font-bold">
                      3
                    </span>
                    <span>
                      Toque em <strong>Conectar um Aparelho</strong> e aponte sua câmera para esta tela.
                    </span>
                  </li>
                </ol>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-600 select-none">
                    <input
                      type="checkbox"
                      checked={keepLoggedIn}
                      onChange={(e) => setKeepLoggedIn(e.target.checked)}
                      className="h-4 w-4 rounded-md border-zinc-300 text-[#00a884] focus:ring-[#00a884]"
                    />
                    <span>Mantenha-me conectado neste navegador</span>
                  </label>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-400 pt-1">
                  <ShieldCheck className="h-4 w-4 text-[#00a884]" />
                  <span>Criptografado de ponta a ponta</span>
                </div>
              </div>

              {/* Coluna Direita: Caixa do QR Code dinâmico */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative flex flex-col items-center justify-center rounded-3xl bg-zinc-50 border-2 border-zinc-200 p-6 shadow-md">
                  
                  <div className="relative flex h-64 w-64 items-center justify-center rounded-2xl bg-white p-3 shadow-inner">
                    {qrStatus === 'loading' && (
                      <div className="flex flex-col items-center gap-2 text-zinc-400">
                        <Loader2 className="h-8 w-8 animate-spin text-[#00a884]" />
                        <span className="text-xs">Gerando QR Code...</span>
                      </div>
                    )}

                    {qrStatus === 'pending' && qrCodeUrl && (
                      <div className="relative group">
                        <img
                          src={qrCodeUrl}
                          alt="WhatsApp Web QR Code"
                          className="h-56 w-56 object-contain rounded-lg"
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5 shadow-md border border-zinc-200">
                            <img src="/icon.svg" alt="OffGrid" className="h-full w-full object-contain" />
                          </div>
                        </div>
                      </div>
                    )}

                    {qrStatus === 'scanned' && (
                      <div className="flex flex-col items-center gap-3 p-4 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <Check className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-bold text-zinc-900">QR Code escaneado!</p>
                        <p className="text-xs text-zinc-500">
                          Toque em <strong>Conectar Aparelho</strong> no seu celular para autorizar.
                        </p>
                        <Loader2 className="h-5 w-5 animate-spin text-[#00a884] mt-2" />
                      </div>
                    )}

                    {qrStatus === 'authenticated' && (
                      <div className="flex flex-col items-center gap-3 p-4 text-center">
                        <Loader2 className="h-10 w-10 animate-spin text-[#00a884]" />
                        <p className="text-sm font-bold text-zinc-900">Conexão autorizada!</p>
                        <p className="text-xs text-zinc-500">Entrando na conta...</p>
                      </div>
                    )}

                    {qrStatus === 'expired' && (
                      <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
                        <p className="text-xs font-bold text-zinc-700">O código QR expirou</p>
                        <button
                          type="button"
                          onClick={initQRSession}
                          className="flex items-center gap-2 rounded-2xl bg-[#00a884] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#009272] transition active:scale-95"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Recarregar Código QR
                        </button>
                      </div>
                    )}
                  </div>

                  {qrStatus === 'pending' && (
                    <div className="mt-4 flex items-center justify-between w-full px-2 text-[11px] text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Aguardando leitura
                      </span>
                      <span className="font-mono text-zinc-400">
                        Expira em {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. TELA DE LOGIN COM GOOGLE OU EMAIL E SENHA                               */}
        {/* ========================================================================= */}
        {activeTab === 'email' && (
          <div className="w-full max-w-md my-auto rounded-3xl bg-white shadow-xl border border-zinc-200/80 overflow-hidden flex flex-col animate-fadeIn">
            
            {/* Top Bar apenas com o botão de voltar ao início */}
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-6 py-3.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('welcome');
                  cleanFeedback();
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900 transition px-2 py-1 rounded-lg hover:bg-zinc-200/60"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Voltar ao início</span>
              </button>

              <span className="text-[11px] font-bold text-zinc-400">Login OffGrid</span>
            </div>

            {/* Conteúdo do Formulário */}
            <div className="p-6 sm:p-8 space-y-6">
              
              <div className="text-center">
                <h2 className="text-xl font-bold tracking-tight text-zinc-900">Entrar na sua conta</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Acesse suas conversas com sua conta Google ou email e senha.
                </p>
              </div>

              {/* Alertas */}
              {errorMsg && (
                <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Botão de Login com Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white border border-zinc-200 py-3 text-xs font-bold text-zinc-700 shadow-xs transition hover:bg-zinc-50 active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#00a884]" />
                ) : (
                  <>
                    <img 
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                      alt="Google" 
                      className="h-4 w-4" 
                    />
                    <span>Continuar com o Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-zinc-200" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">ou com email e senha</span>
                <div className="h-px flex-1 bg-zinc-200" />
              </div>

              {/* Formulário com as posições solicitadas:
                  1. EM CIMA DO EMAIL: botão "Não tem conta? Cadastre-se"
                  2. Campo de Email
                  3. EM BAIXO DO EMAIL: botão "Esqueceu a senha?"
                  4. Campo de Senha
              */}
              <form onSubmit={handleEmailAuth} className="space-y-4">
                
                {/* 1. EM CIMA DO EMAIL: botão "Não tem conta? Cadastre-se" */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-zinc-700">Email</label>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('register');
                        cleanFeedback();
                      }}
                      className="text-xs font-bold text-[#00a884] hover:underline transition"
                    >
                      Não tem conta, cadastre-se
                    </button>
                  </div>
                  
                  {/* 2. Campo de Email */}
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="email"
                      required
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 border border-zinc-200 py-2.5 pl-10 pr-4 text-xs text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                    />
                  </div>
                </div>

                {/* 3. EM BAIXO DO EMAIL: botão "Esqueceu a senha?" */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-zinc-700">Senha</label>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('forgot_password');
                        cleanFeedback();
                      }}
                      className="text-xs font-semibold text-[#00a884] hover:underline transition"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  
                  {/* 4. Campo de Senha */}
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 border border-zinc-200 py-2.5 pl-10 pr-10 text-xs text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Botão de Entrar */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00a884] py-3 text-xs font-bold text-white shadow-md hover:bg-[#009272] transition active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Entrar no OffGrid</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. TELA DE CADASTRO                                                       */}
        {/* ========================================================================= */}
        {activeTab === 'register' && (
          <div className="w-full max-w-md my-auto rounded-3xl bg-white shadow-xl border border-zinc-200/80 overflow-hidden flex flex-col animate-fadeIn">
            
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-6 py-3.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('email');
                  cleanFeedback();
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900 transition px-2 py-1 rounded-lg hover:bg-zinc-200/60"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Voltar para login</span>
              </button>

              <span className="text-[11px] font-bold text-zinc-400">Criar Conta</span>
            </div>

            <div className="p-6 sm:p-8 space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-bold tracking-tight text-zinc-900">Criar Conta no OffGrid Link</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Comunicação rápida e resiliente online e offline.
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                    <span className="flex-1">{errorMsg}</span>
                  </div>
                  {errorMsg.includes('já está cadastrado') && (
                    <div className="flex items-center gap-2 pt-1 border-t border-red-200/60">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('email');
                          cleanFeedback();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#00a884] text-white font-bold text-[11px] hover:bg-[#009272] transition cursor-pointer"
                      >
                        Fazer login com este email &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleEmailAuth} className="space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-700">Nome Completo</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="text"
                      required
                      placeholder="Seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 border border-zinc-200 py-2.5 pl-10 pr-4 text-xs text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-700">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="email"
                      required
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 border border-zinc-200 py-2.5 pl-10 pr-4 text-xs text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-700">Senha (mínimo 6 caracteres)</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 border border-zinc-200 py-2.5 pl-10 pr-10 text-xs text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-700">Confirmar Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Repita sua senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 border border-zinc-200 py-2.5 pl-10 pr-4 text-xs text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00a884] py-3 text-xs font-bold text-white shadow-md hover:bg-[#009272] transition active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Criar Minha Conta</span>
                      <Check className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 text-center">
                <p className="text-xs text-zinc-500">
                  Já tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('email');
                      cleanFeedback();
                    }}
                    className="font-bold text-[#00a884] hover:underline"
                  >
                    Fazer login
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. TELA DE ESQUECEU A SENHA                                               */}
        {/* ========================================================================= */}
        {activeTab === 'forgot_password' && (
          <div className="w-full max-w-md my-auto rounded-3xl bg-white shadow-xl border border-zinc-200/80 overflow-hidden flex flex-col animate-fadeIn">
            
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-6 py-3.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('email');
                  cleanFeedback();
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900 transition px-2 py-1 rounded-lg hover:bg-zinc-200/60"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Voltar para login</span>
              </button>

              <span className="text-[11px] font-bold text-zinc-400">Recuperação</span>
            </div>

            <div className="p-6 sm:p-8 space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-bold tracking-tight text-zinc-900">Recuperar Senha</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Informe seu email cadastrado para redefinir sua senha.
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-zinc-700">Email Cadastrado</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="email"
                      required
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 border border-zinc-200 py-2.5 pl-10 pr-4 text-xs text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00a884] py-3 text-xs font-bold text-white shadow-md hover:bg-[#009272] transition active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      <span>Enviar Link de Recuperação</span>
                    </>
                  )}
                </button>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('email');
                    cleanFeedback();
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-900 font-bold"
                >
                  ← Voltar para o Login
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-zinc-400 text-xs">
        <p className="text-[11px] font-semibold text-zinc-400">
          OffGrid Link v1.2 • Comunicação Resiliente Online e Offline
        </p>
      </footer>

    </div>
  );
}
