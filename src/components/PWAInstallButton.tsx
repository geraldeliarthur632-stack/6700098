import React, { useState } from 'react';
import { usePWAInstall, PlatformCategory } from '../hooks/usePWAInstall';
import { 
  Download, 
  Share, 
  PlusSquare, 
  CheckCircle, 
  Smartphone, 
  Laptop, 
  Monitor, 
  X, 
  ArrowRight, 
  Sparkles,
  Check,
  HelpCircle,
  Zap,
  Info
} from 'lucide-react';

interface Props {
  variant?: 'banner' | 'button' | 'compact' | 'icon';
  className?: string;
  showTooltip?: boolean;
}

export const PWAInstallButton: React.FC<Props> = ({ variant = 'button', className = '', showTooltip = true }) => {
  const { isInstallable, isInstalled, platformInfo, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  // If already installed in standalone mode, show clean installed state or hide
  if (isInstalled || installedSuccess) {
    if (variant === 'banner') {
      return (
        <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>OffGrid Link instalado no dispositivo! Pronto para uso offline.</span>
        </div>
      );
    }
    // For 'button', 'compact', and 'icon' variants, completely disappear when already installed
    return null;
  }

  const handleInstallAction = async () => {
    // If the browser supports the automatic native prompt, trigger it directly!
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        setInstalledSuccess(true);
        return;
      }
      if (outcome === 'dismissed') {
        // User dismissed the native dialog, open tutorial modal to assist
        setShowModal(true);
        return;
      }
    }
    // Otherwise open the customized OS tutorial modal
    setShowModal(true);
  };

  // Get icon and label for detected platform
  const getPlatformDetails = () => {
    switch (platformInfo.category) {
      case 'apple':
        return {
          icon: <Smartphone className="h-4 w-4" />,
          label: 'Instalar no iPhone / Apple',
          badge: 'Apple iOS',
          actionText: 'Baixar App (iOS)'
        };
      case 'android':
        return {
          icon: <Smartphone className="h-4 w-4" />,
          label: 'Instalar no Android',
          badge: 'Android',
          actionText: 'Baixar App (Android)'
        };
      case 'pc':
      default:
        return {
          icon: <Monitor className="h-4 w-4" />,
          label: 'Instalar no Computador / PC',
          badge: platformInfo.os || 'PC',
          actionText: `Baixar App (${platformInfo.os || 'PC'})`
        };
    }
  };

  const details = getPlatformDetails();

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={handleInstallAction}
          className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-[#00a884] border border-emerald-200/80 transition-all hover:bg-[#00a884] hover:text-white active:scale-95 shadow-xs ${className}`}
          title={`Baixar / Instalar App PWA (${details.badge})`}
          aria-label={`Baixar / Instalar App PWA (${details.badge})`}
        >
          <Download className="h-5 w-5 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00a884] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00a884]"></span>
          </span>
        </button>

        {showModal && (
          <InstallTutorialModal
            initialCategory={platformInfo.category}
            isInstallable={isInstallable}
            onTriggerInstall={install}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleInstallAction}
          className={`flex items-center gap-1.5 rounded-full bg-[#00a884] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#009272] transition-all active:scale-95 ${className}`}
          title={`Instalar OffGrid Link no seu dispositivo (${platformInfo.name})`}
        >
          <img src="/icon.svg" alt="PWA" className="h-3.5 w-3.5 object-contain" />
          <span>Instalar App</span>
        </button>

        {showModal && (
          <InstallTutorialModal
            initialCategory={platformInfo.category}
            isInstallable={isInstallable}
            onTriggerInstall={install}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  if (variant === 'banner') {
    return (
      <>
        <div className={`relative overflow-hidden rounded-2xl bg-white p-4 text-zinc-900 shadow-xs border border-zinc-200 ${className}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Logo Oficial do PWA */}
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#111B21] p-1.5 shadow-xs border border-zinc-100">
                <img src="/icon.svg" alt="Logo OffGrid Link" className="h-full w-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-zinc-900">Instalar OffGrid Link</p>
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 border border-zinc-200">
                    {details.badge}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Funciona 100% sem internet, em tela cheia e com inicialização rápida.
                </p>
              </div>
            </div>
            
            <button
              onClick={handleInstallAction}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#00a884] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#009272] transition active:scale-95 shadow-xs"
            >
              <Download className="h-4 w-4" />
              <span>Instalar</span>
            </button>
          </div>
        </div>

        {showModal && (
          <InstallTutorialModal
            initialCategory={platformInfo.category}
            isInstallable={isInstallable}
            onTriggerInstall={install}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleInstallAction}
        className={`flex items-center gap-2 rounded-2xl bg-[#00a884] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#009272] transition active:scale-95 ${className}`}
      >
        <img src="/icon.svg" alt="PWA" className="h-4 w-4 object-contain" />
        <span>{details.label}</span>
      </button>

      {showModal && (
        <InstallTutorialModal
          initialCategory={platformInfo.category}
          isInstallable={isInstallable}
          onTriggerInstall={install}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
};

interface InstallModalProps {
  initialCategory: PlatformCategory;
  isInstallable: boolean;
  onTriggerInstall: () => Promise<any>;
  onClose: () => void;
}

function InstallTutorialModal({ initialCategory, isInstallable, onTriggerInstall, onClose }: InstallModalProps) {
  const [selectedTab, setSelectedTab] = useState<PlatformCategory>(initialCategory);
  const [promptMessage, setPromptMessage] = useState<string | null>(null);

  const handlePromptClick = async () => {
    setPromptMessage('Solicitando janela de instalação ao navegador...');
    try {
      const result = await onTriggerInstall();
      if (result === 'accepted') {
        onClose();
        return;
      }
      if (result === 'dismissed') {
        setPromptMessage('Instalação cancelada. Você pode seguir o tutorial passo a passo abaixo.');
      } else {
        setPromptMessage('Siga o tutorial passo a passo abaixo para concluir a instalação.');
      }
    } catch {
      setPromptMessage('Siga o tutorial passo a passo abaixo.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-zinc-200 flex flex-col max-h-[92vh]">
        
        {/* Header com o Logo do PWA */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111B21] p-1.5 shadow-xs">
              <img src="/icon.svg" alt="Logo OffGrid" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-zinc-900">Instalar OffGrid Link</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  PWA
                </span>
              </div>
              <p className="text-xs text-zinc-500">Aplicativo oficial para o seu dispositivo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Abas de Plataforma (Apple, Android, PC) */}
        <div className="flex border-b border-zinc-100 bg-zinc-50/70 p-2 gap-1.5 text-xs font-bold">
          <button
            onClick={() => {
              setSelectedTab('apple');
              setPromptMessage(null);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 rounded-xl transition ${
              selectedTab === 'apple'
                ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200/80 font-extrabold'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>Apple (iOS)</span>
          </button>

          <button
            onClick={() => {
              setSelectedTab('android');
              setPromptMessage(null);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 rounded-xl transition ${
              selectedTab === 'android'
                ? 'bg-white text-[#00a884] shadow-xs border border-zinc-200/80 font-extrabold'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>Android</span>
          </button>

          <button
            onClick={() => {
              setSelectedTab('pc');
              setPromptMessage(null);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 rounded-xl transition ${
              selectedTab === 'pc'
                ? 'bg-white text-blue-600 shadow-xs border border-zinc-200/80 font-extrabold'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Monitor className="h-4 w-4" />
            <span>Computador / PC</span>
          </button>
        </div>

        {/* Corpo do Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {promptMessage && (
            <div className="rounded-xl bg-zinc-100 p-2.5 text-xs text-zinc-700 flex items-center gap-2">
              <Info className="h-4 w-4 text-[#00a884] shrink-0" />
              <span>{promptMessage}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* ABA ANDROID                                              */}
          {/* ======================================================== */}
          {selectedTab === 'android' && (
            <div className="space-y-4">
              
              {/* 1. Botão de Instalação Direta para Android */}
              <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200 p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  Instalação Direta no Android
                </div>
                <p className="text-xs text-emerald-700">
                  Clique no botão abaixo para pedir ao navegador que abra a janela de confirmação de instalação.
                </p>
                <button
                  onClick={handlePromptClick}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00a884] py-3 text-xs font-bold text-white shadow-md hover:bg-[#009272] transition active:scale-95 mt-1"
                >
                  <Download className="h-4 w-4" />
                  <span>Solicitar Instalação no Android (Abrir Janela)</span>
                </button>
              </div>

              {/* 2. Tutorial passo a passo do Android */}
              <div className="pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                  Ou siga o passo a passo no Chrome / Samsung Internet:
                </h4>

                <div className="space-y-2.5 text-xs text-zinc-700">
                  <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-800 font-bold">
                      ⋮
                    </div>
                    <div>
                      <span className="font-bold text-zinc-900 block">Passo 1: Menu do Navegador</span>
                      <span className="text-zinc-600">
                        Toque nos <strong>três pontinhos verticais (⋮)</strong> no canto superior direito do Chrome.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#00a884]">
                      <Download className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-zinc-900 block">Passo 2: "Instalar aplicativo"</span>
                      <span className="text-zinc-600">
                        Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-700">
                      <Check className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-zinc-900 block">Passo 3: Confirmar</span>
                      <span className="text-zinc-600">
                        Toque em <strong>"Instalar"</strong>. O ícone oficial aparecerá na sua lista de aplicativos.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* ABA COMPUTADOR / PC                                      */}
          {/* ======================================================== */}
          {selectedTab === 'pc' && (
            <div className="space-y-4">
              
              {/* 1. Botão de Instalação Direta para PC */}
              <div className="rounded-2xl bg-blue-50/80 border border-blue-200 p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-blue-800 uppercase tracking-wider">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Instalação Direta no Computador
                </div>
                <p className="text-xs text-blue-700">
                  Clique no botão para pedir ao navegador que abra o balão oficial de instalação.
                </p>
                <button
                  onClick={handlePromptClick}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition active:scale-95 mt-1"
                >
                  <Download className="h-4 w-4" />
                  <span>Solicitar Instalação no PC (Abrir Janela)</span>
                </button>
              </div>

              {/* 2. Tutorial passo a passo do PC */}
              <div className="pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                  Ou siga o passo a passo no Chrome / Edge:
                </h4>

                <div className="space-y-2.5 text-xs text-zinc-700">
                  <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Download className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-zinc-900 block">Passo 1: Ícone na Barra de Endereços</span>
                      <span className="text-zinc-600">
                        Na barra de endereços (ao lado da estrela de favoritos), clique no ícone de <strong>Instalar</strong> (monitorzinho com seta ou símbolo ⊕).
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-800 font-bold">
                      ⋮
                    </div>
                    <div>
                      <span className="font-bold text-zinc-900 block">Opção Alternativa via Menu:</span>
                      <span className="text-zinc-600">
                        Clique nos <strong>três pontinhos (⋮) &gt; Salvar e compartilhar &gt; "Instalar OffGrid Link"</strong>.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#00a884]">
                      <Check className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-zinc-900 block">Passo 2: Clique em "Instalar"</span>
                      <span className="text-zinc-600">
                        O app abrirá como uma janela independente e criará atalhos na Barra de Tarefas e menu Iniciar.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* ABA APPLE (iOS / iPhone / iPad / Mac Safari)             */}
          {/* ======================================================== */}
          {selectedTab === 'apple' && (
            <div className="space-y-4">
              
              {/* Botão de Orientação Rápida */}
              <div className="rounded-2xl bg-zinc-100 p-4 text-center space-y-2 border border-zinc-200">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-zinc-800 uppercase tracking-wider">
                  <Smartphone className="h-4 w-4 text-zinc-700" />
                  Instalação no Safari da Apple
                </div>
                <p className="text-xs text-zinc-600">
                  A Apple exige que a instalação seja confirmada pelo menu Compartilhar do Safari.
                </p>
              </div>

              {/* Tutorial do iOS */}
              <div className="space-y-2.5 text-xs text-zinc-700">
                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Share className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Passo 1: Toque em Compartilhar</span>
                    <span className="text-zinc-600">
                      Na barra inferior do Safari, toque no ícone de <strong>Compartilhar</strong> (quadrado com seta apontando para cima).
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <PlusSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Passo 2: "Adicionar à Tela de Início"</span>
                    <span className="text-zinc-600">
                      Role o menu para baixo e selecione <strong>"Adicionar à Tela de Início"</strong>.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-700">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Passo 3: Confirmar</span>
                    <span className="text-zinc-600">
                      No canto superior direito, toque em <strong>"Adicionar"</strong>. O ícone aparecerá no seu início como um app nativo!
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-zinc-500 bg-zinc-50 rounded-xl p-3 border border-zinc-200/80">
                💡 <em>No Mac Safari:</em> Clique no menu superior <strong>Arquivo &gt; Adicionar ao Dock...</strong>
              </p>

            </div>
          )}

          {/* Vantagens do App */}
          <div className="rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200/80 text-[11px] text-zinc-600 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-zinc-800">
              <Zap className="h-3.5 w-3.5 text-[#00a884]" />
              Vantagens do app instalado:
            </div>
            <p>• Abre em tela cheia instantaneamente sem barra do navegador.</p>
            <p>• Funciona mesmo sem internet (comunicação Mesh offline).</p>
            <p>• Notificações em tempo real e melhor desempenho.</p>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 bg-zinc-50/70 p-4 text-center">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-[#00a884] py-3 text-xs font-bold text-white shadow-md hover:bg-[#009272] transition"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
