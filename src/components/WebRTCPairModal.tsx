import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  Camera, 
  Smartphone, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  Copy, 
  Check, 
  RefreshCw, 
  ArrowRight,
  Radio,
  Zap,
  ShieldCheck
} from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { meshNetwork } from '../services/meshNetwork';

interface WebRTCPairModalProps {
  isOpen: boolean;
  onClose: () => void;
  myUserName?: string;
}

export function WebRTCPairModal({ isOpen, onClose, myUserName }: WebRTCPairModalProps) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [step, setStep] = useState<'generate' | 'scan_answer' | 'connected'>('generate');
  
  // Host state
  const [offerCode, setOfferCode] = useState<string>('');
  const [qrOfferDataUrl, setQrOfferDataUrl] = useState<string>('');
  const [isGeneratingOffer, setIsGeneratingOffer] = useState(false);
  const [copiedOffer, setCopiedOffer] = useState(false);
  const [answerInput, setAnswerInput] = useState('');
  
  // Joiner state
  const [joinInput, setJoinInput] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [qrAnswerDataUrl, setQrAnswerDataUrl] = useState('');
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  
  // Camera scanning state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // WebRTC references
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [connectedPeerName, setConnectedPeerName] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (mode === 'create') {
        generateOfferTicket();
      }
    } else {
      cleanup();
    }
    return () => cleanup();
  }, [isOpen, mode]);

  const cleanup = () => {
    stopCamera();
    if (pcRef.current && pcRef.current.connectionState !== 'connected') {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.oniceconnectionstatechange = () => {
      console.log('ICE Connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionStatus('Conexão P2P estabelecida!');
        setStep('connected');
      }
    };

    return pc;
  };

  // 1. HOST: Gera Oferta e QR Code
  const generateOfferTicket = async () => {
    setIsGeneratingOffer(true);
    setConnectionStatus('Criando túnel WebRTC direto...');

    try {
      const pc = createPeerConnection();
      pcRef.current = pc;

      const dc = pc.createDataChannel('offgrid_direct_mesh', { ordered: true });
      dcRef.current = dc;

      dc.onopen = () => {
        const peerId = `p2p-${Date.now()}`;
        const name = connectedPeerName || 'Celular Conectado (WebRTC)';
        meshNetwork.registerWebRTCDataChannel(peerId, name, dc);
        setStep('connected');
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Aguarda candidatos ICE reunidos (ou timeout de 1.5s para P2P local)
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkState);
          setTimeout(() => resolve(), 1500);
        }
      });

      const payload = JSON.stringify({
        t: 'offer',
        u: myUserName || 'Operador',
        sdp: pc.localDescription?.sdp
      });

      setOfferCode(payload);

      const qrUrl = await QRCode.toDataURL(payload, {
        margin: 2,
        width: 320,
        color: { dark: '#00a884', light: '#ffffff' }
      });
      setQrOfferDataUrl(qrUrl);
      setStep('generate');
      setConnectionStatus('Aguardando o outro celular escanear o QR Code...');
    } catch (err: any) {
      console.error('Erro ao gerar oferta:', err);
      setConnectionStatus('Erro ao inicializar WebRTC: ' + err.message);
    } finally {
      setIsGeneratingOffer(false);
    }
  };

  // HOST: Aplica resposta do outro aparelho
  const applyAnswerTicket = async (answerPayloadStr: string) => {
    try {
      const parsed = JSON.parse(answerPayloadStr);
      if (!parsed.sdp) throw new Error('Ticket de resposta inválido');
      if (!pcRef.current) throw new Error('Conexão original não encontrada');

      setConnectedPeerName(parsed.u || 'Celular Conectado');
      await pcRef.current.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: parsed.sdp
      }));

      setConnectionStatus('Finalizando sincronização P2P...');
    } catch (err: any) {
      alert('Código de resposta inválido: ' + err.message);
    }
  };

  // 2. JOINER: Processa Oferta e gera Resposta (Answer)
  const processOfferAndGenerateAnswer = async (offerPayloadStr: string) => {
    try {
      const parsed = JSON.parse(offerPayloadStr);
      if (!parsed.sdp) throw new Error('Código de oferta inválido');

      setConnectedPeerName(parsed.u || 'Celular Principal');

      const pc = createPeerConnection();
      pcRef.current = pc;

      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dcRef.current = dc;

        dc.onopen = () => {
          const peerId = `p2p-client-${Date.now()}`;
          const name = parsed.u ? `${parsed.u} (WebRTC P2P)` : 'Celular Pareado (WebRTC P2P)';
          meshNetwork.registerWebRTCDataChannel(peerId, name, dc);
          setStep('connected');
        };
      };

      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: parsed.sdp
      }));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const check = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', check);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', check);
          setTimeout(() => resolve(), 1500);
        }
      });

      const answerPayload = JSON.stringify({
        t: 'answer',
        u: myUserName || 'Convidado',
        sdp: pc.localDescription?.sdp
      });

      setAnswerCode(answerPayload);
      const qrUrl = await QRCode.toDataURL(answerPayload, {
        margin: 2,
        width: 320,
        color: { dark: '#00a884', light: '#ffffff' }
      });
      setQrAnswerDataUrl(qrUrl);
      setConnectionStatus('Mostre este QR de resposta para o primeiro celular escanear!');
    } catch (err: any) {
      alert('Erro ao processar oferta: ' + err.message);
    }
  };

  // Câmera scanner para escanear QR codes
  const startCamera = async (onScanSuccess: (code: string) => void) => {
    setIsCameraActive(true);
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        scanVideoFrame(onScanSuccess);
      }
    } catch (err: any) {
      console.warn('Erro ao acessar câmera:', err);
      setCameraError('Permissão da câmera necessária para escanear o código.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const scanVideoFrame = (onScanSuccess: (code: string) => void) => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        stopCamera();
        onScanSuccess(code.data);
        return;
      }
    }

    animFrameRef.current = requestAnimationFrame(() => scanVideoFrame(onScanSuccess));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md rounded-3xl bg-[#111b21] p-6 text-white shadow-2xl border border-zinc-800 flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00a884]/20 text-[#00a884]">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Pareamento WebRTC P2P Real</h3>
            <p className="text-xs text-[#8696a0]">Conexão direta celular-a-celular sem servidor</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2 mb-4 bg-[#202c33] p-1 rounded-2xl">
          <button
            onClick={() => {
              setMode('create');
              setStep('generate');
              stopCamera();
            }}
            className={`py-2 rounded-xl text-xs font-bold transition ${
              mode === 'create' ? 'bg-[#00a884] text-[#111b21]' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            1. Criar Convite (Aparelho A)
          </button>
          <button
            onClick={() => {
              setMode('join');
              setStep('generate');
              stopCamera();
            }}
            className={`py-2 rounded-xl text-xs font-bold transition ${
              mode === 'join' ? 'bg-[#00a884] text-[#111b21]' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            2. Conectar (Aparelho B)
          </button>
        </div>

        {/* Status indicator */}
        {connectionStatus && (
          <div className="mb-4 rounded-xl bg-[#202c33] p-2.5 text-xs text-[#00a884] border border-[#00a884]/30 flex items-center gap-2">
            <Radio className="h-4 w-4 animate-pulse shrink-0" />
            <span>{connectionStatus}</span>
          </div>
        )}

        {/* SUCCESS STATE */}
        {step === 'connected' ? (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Dispositivo Conectado com Sucesso!</h4>
              <p className="text-xs text-[#8696a0] mt-1">
                O túnel P2P direto WebRTC está ativo. As mensagens agora trafegam em tempo real entre os dois aparelhos sem passar por nenhum servidor.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-2xl bg-[#00a884] py-3 text-sm font-bold text-[#111b21] hover:bg-[#009272]"
            >
              Concluir & Voltar para Conexões
            </button>
          </div>
        ) : mode === 'create' ? (
          /* HOST / CREATOR FLOW */
          <div className="space-y-4">
            {isGeneratingOffer ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#00a884]" />
                <span className="text-xs text-[#8696a0]">Criando canal P2P direto...</span>
              </div>
            ) : qrOfferDataUrl ? (
              <div className="flex flex-col items-center space-y-3">
                <div className="rounded-2xl bg-white p-3 shadow-lg">
                  <img src={qrOfferDataUrl} alt="QR Code P2P" className="h-56 w-56 object-contain" />
                </div>
                <p className="text-[11px] text-[#8696a0] text-center max-w-xs">
                  Peça para o outro celular abrir a aba "2. Conectar" e apontar a câmera para este QR Code.
                </p>

                {/* Ou copiar código */}
                <div className="w-full flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(offerCode);
                      setCopiedOffer(true);
                      setTimeout(() => setCopiedOffer(false), 2000);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#202c33] py-2.5 text-xs font-semibold text-white hover:bg-[#2a3942]"
                  >
                    {copiedOffer ? <Check className="h-3.5 w-3.5 text-[#00a884]" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedOffer ? 'Copiado!' : 'Copiar Código de Convite'}</span>
                  </button>
                </div>

                {/* Passo final do Host: Ler resposta do Aparelho B */}
                <div className="w-full border-t border-zinc-800 pt-3 space-y-2">
                  <span className="text-xs font-bold text-white block">
                    Passo 2: Ler Resposta do outro celular
                  </span>

                  {isCameraActive ? (
                    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                      <video ref={videoRef} className="h-full w-full object-cover" />
                      <canvas ref={canvasRef} className="hidden" />
                      <button
                        onClick={stopCamera}
                        className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => startCamera(applyAnswerTicket)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#00a884]/20 border border-[#00a884]/40 py-2.5 text-xs font-bold text-[#00a884] hover:bg-[#00a884]/30"
                      >
                        <Camera className="h-4 w-4" />
                        <span>Escanear QR de Resposta</span>
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ou cole o código de resposta aqui..."
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                      className="flex-1 rounded-xl bg-[#202c33] px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-[#00a884]"
                    />
                    <button
                      onClick={() => applyAnswerTicket(answerInput)}
                      disabled={!answerInput.trim()}
                      className="rounded-xl bg-[#00a884] px-3 py-2 text-xs font-bold text-[#111b21] disabled:opacity-50"
                    >
                      Conectar
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          /* JOINER FLOW */
          <div className="space-y-4">
            {qrAnswerDataUrl ? (
              <div className="flex flex-col items-center space-y-3">
                <div className="rounded-2xl bg-white p-3 shadow-lg">
                  <img src={qrAnswerDataUrl} alt="QR Code Resposta" className="h-56 w-56 object-contain" />
                </div>
                <p className="text-[11px] text-[#8696a0] text-center max-w-xs">
                  Agora aponte o primeiro aparelho para este QR Code de resposta para concluir a conexão direta!
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(answerCode);
                    setCopiedAnswer(true);
                    setTimeout(() => setCopiedAnswer(false), 2000);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#202c33] py-2.5 text-xs font-semibold text-white hover:bg-[#2a3942]"
                >
                  {copiedAnswer ? <Check className="h-3.5 w-3.5 text-[#00a884]" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedAnswer ? 'Copiado!' : 'Copiar Código de Resposta'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#8696a0]">
                  Escaneie o QR Code exibido na tela do outro aparelho ou cole o código de convite abaixo:
                </p>

                {isCameraActive ? (
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                    <video ref={videoRef} className="h-full w-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    <button
                      onClick={stopCamera}
                      className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startCamera(processOfferAndGenerateAnswer)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#00a884] py-3 text-xs font-bold text-[#111b21] hover:bg-[#009272]"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Escanear QR Code do Aparelho A</span>
                  </button>
                )}

                {cameraError && (
                  <p className="text-xs text-rose-400 text-center">{cameraError}</p>
                )}

                <div className="flex items-center gap-2 my-2">
                  <div className="h-[1px] flex-1 bg-zinc-800" />
                  <span className="text-[10px] text-zinc-500 uppercase">ou colar código</span>
                  <div className="h-[1px] flex-1 bg-zinc-800" />
                </div>

                <textarea
                  rows={3}
                  placeholder="Cole o código do convite aqui..."
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  className="w-full rounded-2xl bg-[#202c33] p-3 text-xs text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-[#00a884]"
                />

                <button
                  onClick={() => processOfferAndGenerateAnswer(joinInput)}
                  disabled={!joinInput.trim()}
                  className="w-full rounded-2xl bg-[#202c33] border border-zinc-700 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  Processar Convite & Gerar Resposta
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
