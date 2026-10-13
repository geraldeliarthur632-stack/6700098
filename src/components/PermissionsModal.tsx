import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Bluetooth, 
  Camera, 
  Database, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  Loader2, 
  Waves,
  Wifi,
  Check,
  X,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Smartphone,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { meshNetwork } from '../services/meshNetwork';

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMandatoryInitial?: boolean;
}

export function PermissionsModal({ isOpen, onClose }: PermissionsModalProps) {
  const [notificationGranted, setNotificationGranted] = useState(true);
  const [bluetoothGranted, setBluetoothGranted] = useState(true);
  const [audioGranted, setAudioGranted] = useState(true);
  const [cameraGranted, setCameraGranted] = useState(true);
  const [storageGranted, setStorageGranted] = useState(true);
  const [wifiDirectGranted, setWifiDirectGranted] = useState(true);
  
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [activatedSuccess, setActivatedSuccess] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Tab para o guia explicativo: 'list' (ativação rápida) ou 'guide' (como autorizar tudo explicadinho)
  const [activeTab, setActiveTab] = useState<'list' | 'guide'>('list');
  const [expandedGuideItem, setExpandedGuideItem] = useState<string | null>('bluetooth');

  useEffect(() => {
    if (isOpen) {
      checkCurrentPermissions();
      setActivatedSuccess(false);
      setIsProcessingAll(false);
    }
  }, [isOpen]);

  const checkCurrentPermissions = () => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('offgrid_permissions_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.notifications === 'boolean') setNotificationGranted(parsed.notifications);
        if (typeof parsed.bluetooth === 'boolean') setBluetoothGranted(parsed.bluetooth);
        if (typeof parsed.audio === 'boolean') setAudioGranted(parsed.audio);
        if (typeof parsed.camera === 'boolean') setCameraGranted(parsed.camera);
        if (typeof parsed.storage === 'boolean') setStorageGranted(parsed.storage);
        if (typeof parsed.wifiDirect === 'boolean') setWifiDirectGranted(parsed.wifiDirect);
        return;
      }
    } catch {}

    setNotificationGranted(true);
    setBluetoothGranted(true);
    setAudioGranted(true);
    setCameraGranted(true);
    setStorageGranted(true);
    setWifiDirectGranted(true);
  };

  const saveState = (updates: Partial<{ notifications: boolean; bluetooth: boolean; audio: boolean; camera: boolean; storage: boolean; wifiDirect: boolean }>) => {
    try {
      const current = JSON.parse(localStorage.getItem('offgrid_permissions_state') || '{}');
      const next = { ...current, ...updates };
      localStorage.setItem('offgrid_permissions_state', JSON.stringify(next));
    } catch {}
  };

  const safeRequestNotification = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      if (Notification.permission === 'granted') return;
      const res = Notification.requestPermission();
      if (res && typeof res.then === 'function') {
        res.catch(() => {});
      }
    } catch {}
  };

  const safeRequestCamera = () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    try {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => stream.getTracks().forEach(t => t.stop()))
        .catch(() => {});
    } catch {}
  };

  const safeRequestMicrophone = () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    try {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => stream.getTracks().forEach(t => t.stop()))
        .catch(() => {});
    } catch {}
  };

  const safeRequestStorage = () => {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
    try {
      navigator.storage.persist().catch(() => {});
    } catch {}
  };

  const safeRequestBluetooth = () => {
    try {
      meshNetwork.requestBluetoothDevice().catch(() => {});
    } catch {}
  };

  // Toggles individuais
  const toggleNotification = () => {
    const nextState = !notificationGranted;
    setNotificationGranted(nextState);
    saveState({ notifications: nextState });
    if (nextState) {
      safeRequestNotification();
      setFeedbackNotice('Notificações ativadas!');
    } else {
      setFeedbackNotice('Notificações desativadas');
    }
    setTimeout(() => setFeedbackNotice(null), 2500);
  };

  const toggleBluetooth = () => {
    const nextState = !bluetoothGranted;
    setBluetoothGranted(nextState);
    saveState({ bluetooth: nextState });
    if (nextState) {
      safeRequestBluetooth();
      setFeedbackNotice('Bluetooth Mesh ativado!');
    } else {
      setFeedbackNotice('Bluetooth desativado');
    }
    setTimeout(() => setFeedbackNotice(null), 2500);
  };

  const toggleAudio = () => {
    const nextState = !audioGranted;
    setAudioGranted(nextState);
    saveState({ audio: nextState });
    if (nextState) {
      safeRequestMicrophone();
      setFeedbackNotice('Microfone & modem ultrassom ativados!');
    } else {
      setFeedbackNotice('Microfone desativado');
    }
    setTimeout(() => setFeedbackNotice(null), 2500);
  };

  const toggleCamera = () => {
    const nextState = !cameraGranted;
    setCameraGranted(nextState);
    saveState({ camera: nextState });
    if (nextState) {
      safeRequestCamera();
      setFeedbackNotice('Câmera & scanner QR ativados!');
    } else {
      setFeedbackNotice('Câmera desativada');
    }
    setTimeout(() => setFeedbackNotice(null), 2500);
  };

  const toggleStorage = () => {
    const nextState = !storageGranted;
    setStorageGranted(nextState);
    saveState({ storage: nextState });
    if (nextState) {
      safeRequestStorage();
      setFeedbackNotice('Armazenamento offline persistente ativado!');
    } else {
      setFeedbackNotice('Armazenamento offline desativado');
    }
    setTimeout(() => setFeedbackNotice(null), 2500);
  };

  const toggleWifiDirect = () => {
    const nextState = !wifiDirectGranted;
    setWifiDirectGranted(nextState);
    saveState({ wifiDirect: nextState });
    setFeedbackNotice(nextState ? 'Wi-Fi Direct & Rede Local ativado!' : 'Wi-Fi Direct desativado');
    setTimeout(() => setFeedbackNotice(null), 2500);
  };

  // BOTÃO PRINCIPAL: Ativar tudo e concluir imediatamente
  const handleGrantAllAndEnter = () => {
    setIsProcessingAll(true);

    setNotificationGranted(true);
    setBluetoothGranted(true);
    setAudioGranted(true);
    setCameraGranted(true);
    setStorageGranted(true);
    setWifiDirectGranted(true);

    const allState = {
      notifications: true,
      bluetooth: true,
      audio: true,
      camera: true,
      storage: true,
      wifiDirect: true,
    };

    saveState(allState);
    try {
      localStorage.setItem('offgrid_permissions_configured', 'true');
    } catch {}

    safeRequestNotification();
    safeRequestCamera();
    safeRequestMicrophone();
    safeRequestStorage();

    setActivatedSuccess(true);
    setIsProcessingAll(false);

    setTimeout(() => {
      onClose();
    }, 250);
  };

  const handleFinish = () => {
    try {
      localStorage.setItem('offgrid_permissions_configured', 'true');
    } catch {}
    saveState({
      notifications: notificationGranted,
      bluetooth: bluetoothGranted,
      audio: audioGranted,
      camera: cameraGranted,
      storage: storageGranted,
      wifiDirect: wifiDirectGranted,
    });
    onClose();
  };

  if (!isOpen) return null;

  const permissionsList = [
    {
      id: 'bluetooth',
      title: 'Bluetooth & Rádio Mesh',
      desc: 'Mensagens diretas de celular para celular em até 100 metros sem internet.',
      icon: Bluetooth,
      active: bluetoothGranted,
      onToggle: toggleBluetooth,
      howToAuthorize: {
        step1: 'Ligue o Bluetooth nas configurações rápidas do seu celular.',
        step2: 'Quando o navegador abrir a janelinha pedindo para emparelhar dispositivos, toque em "Permitir / Parear".',
        step3: 'O OffGrid criará automaticamente a rede Mesh com os aparelhos ao seu redor.'
      }
    },
    {
      id: 'wifiDirect',
      title: 'Wi-Fi Direct & Rede Local (Hotspot)',
      desc: 'Troca de dados em alta velocidade pela mesma rede Wi-Fi ou roteador do celular.',
      icon: Wifi,
      active: wifiDirectGranted,
      onToggle: toggleWifiDirect,
      howToAuthorize: {
        step1: 'Conecte seu celular na mesma rede Wi-Fi que seus amigos (não precisa ter internet).',
        step2: 'Ou ligue o Ponto de Acesso (Roteador Wi-Fi) do celular e peça para os outros se conectarem nele.',
        step3: 'O app descobre os outros aparelhos na rede local via WebRTC sem consumir seu plano de dados.'
      }
    },
    {
      id: 'audio',
      title: 'Microfone & Modem Ultrassom',
      desc: 'Comunicação acústica por ondas sonoras inaudíveis quando todos os rádios estiverem desligados.',
      icon: Waves,
      active: audioGranted,
      onToggle: toggleAudio,
      howToAuthorize: {
        step1: 'Quando o navegador exibir a pergunta "Permitir microfone?", selecione "Permitir durante o uso".',
        step2: 'Se bloqueou sem querer, toque no cadeado ao lado do link do app e mude Microfone para "Permitir".',
        step3: 'O app transmitirá pacotes acústicos de alta frequência pelo alto-falante e microfone.'
      }
    },
    {
      id: 'camera',
      title: 'Câmera & Air-Gap Óptico (QR Code)',
      desc: 'Escaneamento de QR Codes animados entre telas para transferir mensagens offline e fotos.',
      icon: Camera,
      active: cameraGranted,
      onToggle: toggleCamera,
      howToAuthorize: {
        step1: 'Quando solicitada a permissão de câmera no navegador, toque em "Permitir".',
        step2: 'Você poderá apontar a câmera para a tela de outro celular para ler códigos QR de mensagens offline.',
        step3: 'Também permite tirar fotos para enviar diretamente no bate-papo.'
      }
    },
    {
      id: 'notifications',
      title: 'Notificações Instantâneas',
      desc: 'Alertas com som e vibração para novas mensagens com o app em segundo plano.',
      icon: Bell,
      active: notificationGranted,
      onToggle: toggleNotification,
      howToAuthorize: {
        step1: 'Toque em "Permitir" na notificação do navegador para receber mensagens em segundo plano.',
        step2: 'No Android, certifique-se de que o navegador tem permissão de notificações nas configurações do sistema.',
        step3: 'Você nunca perderá mensagens quando a tela estiver bloqueada.'
      }
    },
    {
      id: 'storage',
      title: 'Armazenamento Offline Persistente',
      desc: 'Salva mensagens, fotos e banco de dados no aparelho sem que o cache seja limpo.',
      icon: Database,
      active: storageGranted,
      onToggle: toggleStorage,
      howToAuthorize: {
        step1: 'O app solicita ao navegador a persistência de dados no armazenamento local.',
        step2: 'Garante que suas conversas, chaves criptográficas e backups fiquem salvos mesmo reiniciando o aparelho.',
        step3: 'As mensagens são guardadas offline e sincronizam automaticamente ao reconectar.'
      }
    }
  ];

  const totalActive = permissionsList.filter(p => p.active).length;

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleFinish();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-zinc-100 overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-[#00a884] to-[#008f70] p-5 sm:p-6 text-white text-left relative overflow-hidden shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5" />
              Permissões & Modo Offline
            </span>
            
            <div className="flex items-center gap-2">
              <span className="text-xs bg-black/25 rounded-full px-2.5 py-0.5 font-bold font-mono">
                {totalActive}/{permissionsList.length} Ativas
              </span>
              <button
                type="button"
                onClick={handleFinish}
                className="rounded-full p-1.5 text-white/80 hover:bg-black/20 hover:text-white transition active:scale-95"
                title="Fechar e continuar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Permissões de Conexão Offline
          </h2>
          <p className="text-xs text-white/90 mt-1 leading-relaxed">
            Configure para que o OffGrid converse <strong>online pelo servidor</strong> e <strong>100% offline</strong> via Bluetooth, Wi-Fi Direct, Ultrassom e Câmera.
          </p>

          {/* Abas: Ativação Rápida vs Como Autorizar (Explicadinho) */}
          <div className="flex gap-2 mt-4 pt-2 border-t border-white/20">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'list'
                  ? 'bg-white text-[#00a884] shadow-sm'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              <span>Ativação Rápida</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'guide'
                  ? 'bg-white text-[#00a884] shadow-sm'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Como Autorizar (Tutorial)</span>
            </button>
          </div>
        </div>

        {/* Real-time Notice banner */}
        {feedbackNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-fadeIn shrink-0">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{feedbackNotice}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA 1: LISTA COM ATIVAÇÃO RÁPIDA                               */}
        {/* ============================================================== */}
        {activeTab === 'list' && (
          <div className="p-4 sm:p-6 space-y-2.5 overflow-y-auto flex-1">
            {permissionsList.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={item.onToggle}
                  className={`flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.99] ${
                    item.active
                      ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                      : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                      item.active ? 'bg-[#00a884] text-white shadow-xs' : 'bg-zinc-200 text-zinc-600'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-zinc-900 truncate">{item.title}</h4>
                        {item.active && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight truncate sm:whitespace-normal">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      item.onToggle();
                    }}
                    className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 flex items-center gap-1 ${
                      item.active
                        ? 'bg-[#00a884] text-white shadow-xs hover:bg-[#009272]'
                        : 'bg-zinc-900 text-white hover:bg-zinc-800'
                    }`}
                  >
                    {item.active ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Ativado</span>
                      </>
                    ) : (
                      <span>Ativar</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA 2: GUIA COMPLETO E DETALHADO (TUDO EXPLICADINHO)            */}
        {/* ============================================================== */}
        {activeTab === 'guide' && (
          <div className="p-4 sm:p-6 space-y-3 overflow-y-auto flex-1">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 flex items-start gap-2.5 mb-2">
              <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Veja abaixo como autorizar cada recurso no seu celular (Android, iOS ou computador). Toque em cada item para expandir as instruções.
              </span>
            </div>

            {permissionsList.map((item) => {
              const Icon = item.icon;
              const isExpanded = expandedGuideItem === item.id;

              return (
                <div 
                  key={item.id}
                  className="rounded-2xl border border-zinc-200 overflow-hidden bg-white shadow-xs transition"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedGuideItem(isExpanded ? null : item.id)}
                    className="flex w-full items-center justify-between p-3.5 text-left hover:bg-zinc-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl shrink-0 ${
                        item.active ? 'bg-[#00a884] text-white' : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-900">{item.title}</h4>
                        <span className="text-[10px] text-zinc-400 block">{item.desc}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.active ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {item.active ? 'Ativo' : 'Pendente'}
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-4 pb-4 pt-1 bg-zinc-50 border-t border-zinc-100 space-y-2 text-xs text-zinc-700"
                    >
                      <h5 className="font-bold text-zinc-900 text-[11px] uppercase tracking-wider flex items-center gap-1.5 pt-1">
                        <Smartphone className="h-3.5 w-3.5 text-[#00a884]" />
                        Passo a Passo de Como Autorizar:
                      </h5>

                      <ol className="space-y-1.5 pl-2 list-none text-zinc-600 text-[11px]">
                        <li className="flex items-start gap-2">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white text-[9px] font-bold mt-0.5">
                            1
                          </span>
                          <span>{item.howToAuthorize.step1}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white text-[9px] font-bold mt-0.5">
                            2
                          </span>
                          <span>{item.howToAuthorize.step2}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white text-[9px] font-bold mt-0.5">
                            3
                          </span>
                          <span>{item.howToAuthorize.step3}</span>
                        </li>
                      </ol>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            item.onToggle();
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                            item.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-[#00a884] text-white hover:bg-[#009272]'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                          <span>{item.active ? 'Já Autorizado' : 'Testar / Autorizar Agora'}</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-4 sm:p-6 pt-2 border-t border-zinc-100 bg-white flex flex-col gap-2 shrink-0">
          {/* Botão Principal: Ativa tudo e entra no app imediatamente */}
          <button
            type="button"
            onClick={handleGrantAllAndEnter}
            disabled={isProcessingAll}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00a884] py-3.5 sm:py-4 text-sm font-bold text-white shadow-md hover:bg-[#009272] transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isProcessingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Ativando permissões...</span>
              </>
            ) : activatedSuccess ? (
              <>
                <Check className="h-5 w-5" />
                <span>Permissões Ativadas! Entrando...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Ativar Todas as Permissões e Concluir</span>
              </>
            )}
          </button>

          {/* Botão Secundário: Concluir / Pular */}
          <button
            type="button"
            onClick={handleFinish}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-100 py-2.5 sm:py-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 transition-colors active:scale-98 cursor-pointer"
          >
            <span>Concluir e Ir para as Conversas</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
