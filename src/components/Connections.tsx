import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { 
  Wifi, 
  Bluetooth, 
  Zap, 
  Globe, 
  Shield, 
  RefreshCw, 
  Radio, 
  CheckCircle2, 
  XCircle, 
  Signal, 
  Smartphone, 
  Send, 
  AlertTriangle,
  Info,
  Sliders,
  Share2,
  Waves,
  QrCode,
  ShieldCheck,
  Sparkles,
  Play,
  Battery,
  BatteryCharging,
  Cpu,
  Trash2,
  Users,
  Activity,
  HardDrive,
  Layers
} from 'lucide-react';
import { cn } from '../lib/utils';
import { meshNetwork, LocalPeer, OfflineRelayPacket, HardwareStatus } from '../services/meshNetwork';
import { ultrasoundService } from '../services/ultrasoundAudio';
import { OpticalAirGapModal } from './OpticalAirGapModal';
import { WebRTCPairModal } from './WebRTCPairModal';
import { MeshTopologyViewer } from './MeshTopologyViewer';
import { db, collection, query, limit, onSnapshot } from '../firebase';

interface OnlineUserNode {
  uid: string;
  name: string;
  photoURL?: string | null;
  status: string;
  lastSeen?: number;
}

export function Connections() {
  const { connectionStatus, setConnectionStatus, user, openPermissionsModal, syncOfflineMessagesNow } = useAuth();
  const [peers, setPeers] = useState<LocalPeer[]>([]);
  const [onlineCloudUsers, setOnlineCloudUsers] = useState<OnlineUserNode[]>([]);
  const [hardwareStatus, setHardwareStatus] = useState<HardwareStatus | null>(null);
  const [scanning, setScanning] = useState(false);
  const [broadcastInput, setBroadcastInput] = useState('');
  const [offlinePackets, setOfflinePackets] = useState<OfflineRelayPacket[]>([]);
  const [activeTab, setActiveTab] = useState<'interfaces' | 'peers' | 'topology' | 'radar'>('interfaces');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showOpticalModal, setShowOpticalModal] = useState(false);
  const [showWebRTCModal, setShowWebRTCModal] = useState(false);
  const [isSyncingServer, setIsSyncingServer] = useState(false);
  const [isPlayingUltrasound, setIsPlayingUltrasound] = useState(false);

  useEffect(() => {
    if (user?.name) {
      meshNetwork.setClientInfo(user.name);
    }
  }, [user?.name]);

  useEffect(() => {
    const unsub = meshNetwork.subscribePeers(setPeers);
    const unsubPackets = meshNetwork.subscribePackets((pkt) => {
      setOfflinePackets(prev => [pkt, ...prev].slice(0, 30));
    });
    setOfflinePackets(meshNetwork.getOutbox().slice(-30).reverse());

    // Fetch real hardware sensors
    meshNetwork.getRealHardwareStatus().then(setHardwareStatus);
    const intervalHw = setInterval(() => {
      meshNetwork.getRealHardwareStatus().then(setHardwareStatus);
    }, 10000);

    return () => {
      unsub();
      unsubPackets();
      clearInterval(intervalHw);
    };
  }, []);

  // Fetch real online users from Firestore if internet is on
  useEffect(() => {
    if (!connectionStatus.internet) return;

    try {
      const q = query(collection(db, 'users_public'), limit(20));
      const unsub = onSnapshot(q, (snapshot) => {
        const usersList: OnlineUserNode[] = [];
        snapshot.forEach((doc) => {
          const d = doc.data();
          if (d.uid !== user?.uid) {
            usersList.push({
              uid: d.uid,
              name: d.name || 'Usuário OffGrid',
              photoURL: d.photoURL,
              status: d.status || 'offline',
              lastSeen: d.lastSeen
            });
          }
        });
        setOnlineCloudUsers(usersList);
      }, (err) => {
        console.log('Online users query notice:', err);
      });

      return () => unsub();
    } catch {}
  }, [connectionStatus.internet, user?.uid]);

  const toggleStatus = (key: keyof typeof connectionStatus) => {
    setConnectionStatus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleScan = async () => {
    setScanning(true);
    setStatusMessage('Buscando dispositivos reais ao redor via Web Bluetooth, rede local e sinais de rádio...');
    const result = await meshNetwork.scanForDevices();
    setScanning(false);
    setStatusMessage(result.message);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handlePairBluetooth = async () => {
    setStatusMessage('Abrindo seletor nativo de Bluetooth do sistema operacional...');
    const result = await meshNetwork.requestBluetoothDevice();
    setStatusMessage(result.message);
    setTimeout(() => setStatusMessage(null), 4500);
  };

  const handleTestUltrasound = async () => {
    setIsPlayingUltrasound(true);
    setStatusMessage('Emitindo pulso de teste acústico ultrassônico de 18.5kHz pelos alto-falantes...');
    try {
      await ultrasoundService.transmitPacket({
        id: `chirp-${Date.now()}`,
        senderName: user?.name || 'Operador',
        text: 'PING_ULTRASSOM_REAL',
        timestamp: Date.now()
      }, true);
      setStatusMessage('Pulso acústico emitido com sucesso pelo hardware de som!');
    } catch {
      setStatusMessage('Erro ao emitir sinal acústico.');
    } finally {
      setIsPlayingUltrasound(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handleManualSync = async () => {
    setIsSyncingServer(true);
    try {
      const count = await syncOfflineMessagesNow();
      setStatusMessage(`Sincronização concluída: ${count} mensagens enviadas ao servidor.`);
    } catch {
      setStatusMessage('Falha ao sincronizar com o servidor. Verifique a internet.');
    } finally {
      setIsSyncingServer(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastInput.trim() || !user) return;

    meshNetwork.broadcastPacket({
      id: `mesh-broadcast-${Date.now()}`,
      conversationId: 'mesh-broadcast-channel',
      senderId: user.uid,
      senderName: user.name || 'Operador OffGrid',
      text: broadcastInput.trim(),
      type: 'text',
      timestamp: Date.now(),
      transport: 'mesh'
    });

    setBroadcastInput('');
    setStatusMessage('Mensagem transmitida em tempo real para todos os dispositivos e canais conectados!');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const activePeersCount = peers.filter(p => p.connected).length;
  const pendingOutboxCount = meshNetwork.getOutbox().filter(p => !p.syncedToServer && p.conversationId !== 'mesh-broadcast-channel').length;

  return (
    <div className="flex h-full flex-col bg-zinc-50 overflow-y-auto">
      {/* Header */}
      <header className="px-6 py-6 bg-white border-b border-zinc-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                Rádios & Redes Offline
              </h1>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                100% Conexões Reais
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Bluetooth nativo, WebRTC P2P direto, Ultrassom via microfone e Malha Óptica sem simulações.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 transition"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", scanning && "animate-spin text-[#00a884]")} />
              <span>{scanning ? 'Varrendo...' : 'Varrer'}</span>
            </button>
          </div>
        </div>

        {/* Status Toast Alert */}
        {statusMessage && (
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 flex items-center gap-2 animate-fadeIn">
            <Radio className="h-4 w-4 shrink-0 text-emerald-600 animate-pulse" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mt-4 flex gap-2 border-b border-zinc-100 pb-1">
          <button
            onClick={() => setActiveTab('interfaces')}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-lg transition-colors",
              activeTab === 'interfaces'
                ? "bg-[#00a884] text-white"
                : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            Interfaces & Hardware
          </button>
          <button
            onClick={() => setActiveTab('peers')}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer",
              activeTab === 'peers'
                ? "bg-[#00a884] text-white"
                : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            <span>Dispositivos Pareados</span>
            <span className="rounded-full bg-zinc-200 px-1.5 text-[9px]">
              {activePeersCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('topology')}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer",
              activeTab === 'topology'
                ? "bg-[#00a884] text-white"
                : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            <span>Topologia Mesh & Relays</span>
            <span className={cn(
              "rounded-full px-1.5 text-[9px] font-bold",
              activeTab === 'topology' ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
            )}>
              Saltos
            </span>
          </button>
          <button
            onClick={() => setActiveTab('radar')}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer",
              activeTab === 'radar'
                ? "bg-[#00a884] text-white"
                : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            Transmissão & Fila
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-5 space-y-5">
        {activeTab === 'interfaces' && (
          <>
            {/* Real Hardware Sensor Telemetry Card */}
            {hardwareStatus && (
              <div className="rounded-2xl bg-white p-4 border border-zinc-200 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#00a884]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                      Sensores & Hardware Real do Aparelho
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400">Leitura direta do sistema</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Battery */}
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-zinc-500 mb-1">
                      <span className="text-[10px] font-medium">Bateria Real</span>
                      {hardwareStatus.isCharging ? (
                        <BatteryCharging className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Battery className="h-4 w-4 text-zinc-600" />
                      )}
                    </div>
                    <span className="text-sm font-bold text-zinc-800">
                      {hardwareStatus.batteryLevel !== null ? `${hardwareStatus.batteryLevel}%` : 'Disponível'}
                      {hardwareStatus.isCharging && <span className="text-[10px] text-emerald-600 ml-1">⚡ Carregando</span>}
                    </span>
                  </div>

                  {/* Bluetooth API */}
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-zinc-500 mb-1">
                      <span className="text-[10px] font-medium">Rádio Bluetooth</span>
                      <Bluetooth className="h-4 w-4 text-indigo-600" />
                    </div>
                    <span className="text-sm font-bold text-zinc-800">
                      {hardwareStatus.bluetoothSupported ? (
                        <span className="text-indigo-600">Suportado</span>
                      ) : (
                        <span className="text-zinc-500 text-xs">Via PWA / WebRTC</span>
                      )}
                    </span>
                  </div>

                  {/* WebRTC P2P */}
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-zinc-500 mb-1">
                      <span className="text-[10px] font-medium">Túnel WebRTC P2P</span>
                      <Zap className="h-4 w-4 text-amber-500" />
                    </div>
                    <span className="text-sm font-bold text-emerald-600">
                      {hardwareStatus.webRTCSupported ? 'Ativo & Pronto' : 'Não Suportado'}
                    </span>
                  </div>

                  {/* Network / Carrier */}
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-zinc-500 mb-1">
                      <span className="text-[10px] font-medium">Rede do Sistema</span>
                      <Globe className="h-4 w-4 text-cyan-600" />
                    </div>
                    <span className="text-sm font-bold text-zinc-800">
                      {hardwareStatus.networkType}
                      {hardwareStatus.rttMs !== null && (
                        <span className="text-[10px] text-zinc-400 block font-normal">{hardwareStatus.rttMs}ms latência</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions & Live Hardware Pairing */}
            <div className="rounded-2xl bg-white p-4 border border-zinc-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Pareamento Físico & Ferramentas P2P
                </h3>
                <span className="text-[11px] text-emerald-600 font-semibold">Sem simuladores</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handlePairBluetooth}
                  className="flex items-center gap-2 rounded-xl bg-indigo-50 text-indigo-700 px-3.5 py-2.5 text-xs font-bold hover:bg-indigo-100 transition shadow-xs"
                >
                  <Bluetooth className="h-4 w-4" />
                  <span>Parear Dispositivo Bluetooth Real</span>
                </button>

                <button
                  onClick={() => setShowWebRTCModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-800 px-3.5 py-2.5 text-xs font-bold hover:bg-emerald-100 transition shadow-xs"
                >
                  <Zap className="h-4 w-4 text-emerald-600" />
                  <span>Conectar Celular P2P Direto (WebRTC)</span>
                </button>

                <button
                  onClick={handleTestUltrasound}
                  disabled={isPlayingUltrasound}
                  className="flex items-center gap-2 rounded-xl bg-purple-50 text-purple-700 px-3 py-2 text-xs font-semibold hover:bg-purple-100 transition disabled:opacity-50"
                >
                  <Waves className={cn("h-4 w-4", isPlayingUltrasound && "animate-spin")} />
                  <span>Testar Pulso Ultrassom Acústico</span>
                </button>

                <button
                  onClick={() => setShowOpticalModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-cyan-50 text-cyan-800 px-3 py-2 text-xs font-semibold hover:bg-cyan-100 transition"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Scanner Óptico Air-Gap (Câmera)</span>
                </button>

                <button
                  onClick={() => setActiveTab('topology')}
                  className="flex items-center gap-2 rounded-xl bg-zinc-900 text-white px-3.5 py-2.5 text-xs font-bold hover:bg-zinc-800 transition shadow-xs cursor-pointer"
                >
                  <Layers className="h-4 w-4 text-[#00a884]" />
                  <span>Ver Topologia Mesh & Saltos</span>
                </button>
              </div>
            </div>

            {/* Primary Connectivity Grid (All Methods) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* 1. Internet (Cloud Sync) */}
              <button
                onClick={() => toggleStatus('internet')}
                className={cn(
                  "flex flex-col items-start justify-between rounded-2xl p-4 transition-all border text-left",
                  connectionStatus.internet
                    ? "bg-white border-emerald-500 shadow-md ring-1 ring-emerald-500"
                    : "bg-zinc-100 border-zinc-200 opacity-60"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    connectionStatus.internet ? "bg-emerald-50 text-emerald-600" : "bg-zinc-200 text-zinc-400"
                  )}>
                    <Globe className="h-5 w-5" />
                  </div>
                  {connectionStatus.internet ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 block">
                    1. Servidor Normal (Internet)
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    {connectionStatus.internet ? 'Envio em tempo real via Firestore' : 'Pausado (usando modo offline)'}
                  </span>
                </div>
              </button>

              {/* 2. Wi-Fi Direct / WebRTC */}
              <button
                onClick={() => toggleStatus('wifiDirect')}
                className={cn(
                  "flex flex-col items-start justify-between rounded-2xl p-4 transition-all border text-left",
                  connectionStatus.wifiDirect
                    ? "bg-white border-blue-500 shadow-md ring-1 ring-blue-500"
                    : "bg-zinc-100 border-zinc-200 opacity-60"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    connectionStatus.wifiDirect ? "bg-blue-50 text-blue-600" : "bg-zinc-200 text-zinc-400"
                  )}>
                    <Wifi className="h-5 w-5" />
                  </div>
                  {connectionStatus.wifiDirect ? (
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 block">
                    2. Wi-Fi Direct & P2P
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    {connectionStatus.wifiDirect ? 'Conexão direta WebRTC e mesma rede' : 'Desativado'}
                  </span>
                </div>
              </button>

              {/* 3. Bluetooth LE */}
              <button
                onClick={() => toggleStatus('bluetooth')}
                className={cn(
                  "flex flex-col items-start justify-between rounded-2xl p-4 transition-all border text-left",
                  connectionStatus.bluetooth
                    ? "bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500"
                    : "bg-zinc-100 border-zinc-200 opacity-60"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    connectionStatus.bluetooth ? "bg-indigo-50 text-indigo-600" : "bg-zinc-200 text-zinc-400"
                  )}>
                    <Bluetooth className="h-5 w-5" />
                  </div>
                  {connectionStatus.bluetooth ? (
                    <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 block">
                    3. Bluetooth Nativo
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    {connectionStatus.bluetooth ? 'Web Bluetooth API com pareamento real' : 'Desativado'}
                  </span>
                </div>
              </button>

              {/* 4. Ultrassom Acústico */}
              <button
                onClick={() => toggleStatus('ultrasound')}
                className={cn(
                  "flex flex-col items-start justify-between rounded-2xl p-4 transition-all border text-left",
                  connectionStatus.ultrasound
                    ? "bg-white border-purple-500 shadow-md ring-1 ring-purple-500"
                    : "bg-zinc-100 border-zinc-200 opacity-60"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    connectionStatus.ultrasound ? "bg-purple-50 text-purple-600" : "bg-zinc-200 text-zinc-400"
                  )}>
                    <Waves className="h-5 w-5" />
                  </div>
                  {connectionStatus.ultrasound ? (
                    <CheckCircle2 className="h-4 w-4 text-purple-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 block">
                    4. Modem Ultrassom Físico
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    {connectionStatus.ultrasound ? 'Ondas acústicas 18.5kHz via alto-falante' : 'Desativado'}
                  </span>
                </div>
              </button>

              {/* 5. Malha Óptica Air-Gap */}
              <button
                onClick={() => toggleStatus('opticalQR')}
                className={cn(
                  "flex flex-col items-start justify-between rounded-2xl p-4 transition-all border text-left",
                  connectionStatus.opticalQR
                    ? "bg-white border-emerald-500 shadow-md ring-1 ring-emerald-500"
                    : "bg-zinc-100 border-zinc-200 opacity-60"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    connectionStatus.opticalQR ? "bg-emerald-50 text-emerald-600" : "bg-zinc-200 text-zinc-400"
                  )}>
                    <QrCode className="h-5 w-5" />
                  </div>
                  {connectionStatus.opticalQR ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 block">
                    5. Malha Óptica Air-Gap
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    {connectionStatus.opticalQR ? 'Troca via câmera/QR (zero rádio)' : 'Desativado'}
                  </span>
                </div>
              </button>

              {/* 6. Rede Local Hotspot / LAN */}
              <button
                onClick={() => toggleStatus('localLan')}
                className={cn(
                  "flex flex-col items-start justify-between rounded-2xl p-4 transition-all border text-left",
                  connectionStatus.localLan
                    ? "bg-white border-cyan-500 shadow-md ring-1 ring-cyan-500"
                    : "bg-zinc-100 border-zinc-200 opacity-60"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    connectionStatus.localLan ? "bg-cyan-50 text-cyan-600" : "bg-zinc-200 text-zinc-400"
                  )}>
                    <Globe className="h-5 w-5" />
                  </div>
                  {connectionStatus.localLan ? (
                    <CheckCircle2 className="h-4 w-4 text-cyan-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 block">
                    6. Hotspot & LAN Local
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    {connectionStatus.localLan ? 'Sub-rede local e roteador sem internet' : 'Desativado'}
                  </span>
                </div>
              </button>
            </div>
          </>
        )}

        {/* Tab: Real Nearby Peers */}
        {activeTab === 'peers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 block">
                  Aparelhos Reais Pareados ({peers.length})
                </span>
                <span className="text-[11px] text-zinc-500">
                  Apenas dispositivos reais conectados fisicamente ao seu aparelho.
                </span>
              </div>
              <div className="flex items-center gap-2">
                {peers.length > 0 && (
                  <button
                    onClick={() => meshNetwork.clearAllPeers()}
                    className="text-xs text-rose-500 hover:text-rose-700 font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Limpar
                  </button>
                )}
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="text-xs text-[#00a884] font-bold hover:underline"
                >
                  Atualizar
                </button>
              </div>
            </div>

            {peers.length === 0 ? (
              <div className="rounded-3xl bg-white p-8 border border-zinc-200 text-center space-y-4 shadow-xs">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
                  <Smartphone className="h-7 w-7" />
                </div>
                <div className="max-w-md mx-auto">
                  <h4 className="text-sm font-bold text-zinc-900">Nenhum dispositivo emparelhado no momento</h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    O aplicativo agora utiliza conexões 100% reais sem dados simulados. Você pode parear um dispositivo Bluetooth ou conectar outro celular diretamente via WebRTC P2P.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                  <button
                    onClick={handlePairBluetooth}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition"
                  >
                    <Bluetooth className="h-4 w-4" />
                    <span>Parear Bluetooth Real</span>
                  </button>
                  <button
                    onClick={() => setShowWebRTCModal(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#00a884] px-4 py-2.5 text-xs font-bold text-[#111b21] hover:bg-[#009272] transition"
                  >
                    <Zap className="h-4 w-4" />
                    <span>Conectar Celular P2P Direto (QR)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {peers.map((peer) => (
                  <div
                    key={peer.id}
                    className="flex items-center justify-between rounded-2xl bg-white p-4 border border-zinc-200 shadow-xs"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl",
                        peer.type === 'bluetooth' ? "bg-indigo-50 text-indigo-600" :
                        peer.type === 'webrtc-p2p' ? "bg-emerald-50 text-emerald-600" :
                        peer.type === 'ultrasound' ? "bg-purple-50 text-purple-600" :
                        peer.type === 'local-lan' ? "bg-cyan-50 text-cyan-600" : "bg-blue-50 text-blue-600"
                      )}>
                        {peer.type === 'bluetooth' ? <Bluetooth className="h-5 w-5" /> :
                         peer.type === 'webrtc-p2p' ? <Zap className="h-5 w-5" /> :
                         peer.type === 'ultrasound' ? <Waves className="h-5 w-5" /> :
                         peer.type === 'local-lan' ? <Globe className="h-5 w-5" /> : <Wifi className="h-5 w-5" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-zinc-900">{peer.name}</h4>
                          <span className="rounded-full bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.2 font-bold">
                            REAL
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {peer.distanceApprox && (
                            <span className="text-[10px] text-zinc-500">
                              {peer.distanceApprox}
                            </span>
                          )}
                          {peer.batteryLevel !== undefined && (
                            <span className="text-[10px] text-emerald-600 font-bold">
                              • 🔋 {peer.batteryLevel}%
                            </span>
                          )}
                          {peer.details && (
                            <span className="text-[10px] text-zinc-400">
                              • {peer.details}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => meshNetwork.togglePeerConnection(peer.id)}
                        className={cn(
                          "rounded-xl px-3 py-1.5 text-xs font-bold transition",
                          peer.connected
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-zinc-100 text-zinc-500"
                        )}
                      >
                        {peer.connected ? 'Ativo' : 'Desconectado'}
                      </button>

                      <button
                        onClick={() => meshNetwork.removePeer(peer.id)}
                        className="rounded-xl p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Desconectar e remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Real Registered Users currently Online in Firestore */}
            {connectionStatus.internet && onlineCloudUsers.length > 0 && (
              <div className="mt-6 rounded-2xl bg-white p-4 border border-zinc-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#00a884]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                      Outros Usuários Reais Conectados na Nuvem ({onlineCloudUsers.length})
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold">Base Firestore Real</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {onlineCloudUsers.map((u) => (
                    <div key={u.uid} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                      <div className="relative h-9 w-9 rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold text-xs overflow-hidden shrink-0">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.name} className="h-full w-full object-cover" />
                        ) : (
                          u.name.substring(0, 2).toUpperCase()
                        )}
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-zinc-800 block truncate">{u.name}</span>
                        <span className="text-[10px] text-emerald-600 font-medium block">Online no OffGrid</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Mesh Topology & Relays */}
        {activeTab === 'topology' && (
          <MeshTopologyViewer onOpenPairModal={() => setShowWebRTCModal(true)} />
        )}

        {/* Tab: Mesh Radar & Outbox Queue */}
        {activeTab === 'radar' && (
          <div className="space-y-4">
            {/* Outbox Queue status */}
            <div className="rounded-2xl bg-white p-4 border border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Fila Offline Persistente (Store-and-Forward)
                </span>
                <button
                  onClick={handleManualSync}
                  className="text-xs font-bold text-[#00a884] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Sincronizar no Servidor
                </button>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Mensagens enviadas quando offline ficam seguras no seu dispositivo e são enviadas ao servidor automaticamente assim que você tiver internet.
              </p>
            </div>

            {/* Broadcast Sender */}
            <form onSubmit={handleSendBroadcast} className="rounded-2xl bg-white p-4 border border-zinc-200 space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
                Transmissão Geral Mesh (Broadcast)
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Escreva uma mensagem para transmitir a todos os rádios..."
                  value={broadcastInput}
                  onChange={(e) => setBroadcastInput(e.target.value)}
                  className="flex-1 rounded-xl bg-zinc-100 px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-[#00a884]"
                />
                <button
                  type="submit"
                  disabled={!broadcastInput.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-[#00a884] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#009272] transition disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Enviar</span>
                </button>
              </div>
            </form>

            {/* Recent Packets Transmitted */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
                Últimos Pacotes Processados ({offlinePackets.length})
              </span>
              {offlinePackets.length === 0 ? (
                <div className="rounded-2xl bg-white p-6 border border-zinc-200 text-center text-xs text-zinc-400">
                  Nenhum pacote recente transmitido.
                </div>
              ) : (
                offlinePackets.map((pkt) => (
                  <div key={pkt.id} className="rounded-xl bg-white p-3 border border-zinc-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-zinc-900">{pkt.senderName}: </span>
                      <span className="text-zinc-600">{pkt.text}</span>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500">
                      {pkt.transport}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Scanner Óptico */}
      <OpticalAirGapModal
        isOpen={showOpticalModal}
        onClose={() => setShowOpticalModal(false)}
      />

      {/* Modal WebRTC P2P Direto Real */}
      <WebRTCPairModal
        isOpen={showWebRTCModal}
        onClose={() => setShowWebRTCModal(false)}
        myUserName={user?.name}
      />
    </div>
  );
}
