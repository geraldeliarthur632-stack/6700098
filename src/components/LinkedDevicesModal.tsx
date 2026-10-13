import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { 
  Laptop, 
  Smartphone, 
  QrCode, 
  Plus, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Camera, 
  RefreshCw, 
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsQR from 'jsqr';
import { qrAuthService, LinkedDevice } from '../services/qrAuthService';

interface LinkedDevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LinkedDevicesModal({ isOpen, onClose }: LinkedDevicesModalProps) {
  const { user, firebaseUser } = useAuth();
  const [devices, setDevices] = useState<LinkedDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<'scan' | 'confirm' | 'pairing' | 'success'>('scan');
  const [scannedSession, setScannedSession] = useState<{ sessionId: string; secretKey: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    } else {
      stopCamera();
    }
  }, [isOpen]);

  const loadDevices = () => {
    setDevices(qrAuthService.getLinkedDevices());
  };

  const startCamera = async () => {
    setErrorMsg(null);
    setIsScanning(true);
    setScanStep('scan');
    setScannedSession(null);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        });
      } catch {
        // Fallback para webcams de notebook / PC sem câmera traseira
        stream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        scanQRCode();
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setErrorMsg('Não foi possível acessar a câmera. Verifique as permissões.');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const scanQRCode = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data.startsWith('offgrid-webauth:')) {
          // Found QR Code!
          const parts = code.data.split(':');
          if (parts.length >= 3) {
            const sessionId = parts[1];
            const secretKey = parts[2];
            setScannedSession({ sessionId, secretKey });
            qrAuthService.markAsScanned(sessionId);
            stopCamera();
            setScanStep('confirm');
            return;
          }
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanQRCode);
  };

  const handleConfirmPairing = async () => {
    if (!scannedSession || !user || !firebaseUser) return;
    setScanStep('pairing');
    setErrorMsg(null);

    try {
      await qrAuthService.authorizeSession(
        scannedSession.sessionId,
        scannedSession.secretKey,
        user,
        firebaseUser
      );
      setScanStep('success');
      loadDevices();
      setTimeout(() => {
        setScanStep('scan');
        setScannedSession(null);
      }, 2000);
    } catch (err: any) {
      console.error('Pairing error:', err);
      setErrorMsg(err?.message || 'Falha ao autorizar o aparelho.');
      setScanStep('confirm');
    }
  };

  const handleRemoveDevice = (id: string) => {
    if (window.confirm('Deseja desconectar este aparelho?')) {
      qrAuthService.removeLinkedDevice(id);
      loadDevices();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-zinc-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#00a884]/10 text-[#00a884]">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Aparelhos Conectados</h2>
              <p className="text-xs text-zinc-500">OffGrid Web & Multi-dispositivos</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Scanner View */}
          {isScanning && (
            <div className="space-y-4">
              <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black shadow-inner">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Viewfinder Overlay */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-56 w-56 rounded-2xl border-2 border-[#00a884] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#00a884] animate-pulse shadow-[0_0_8px_#00a884]" />
                  </div>
                </div>

                <div className="absolute bottom-4 inset-x-0 text-center">
                  <span className="inline-block rounded-full bg-black/60 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                    Aponte para o QR Code na tela do computador
                  </span>
                </div>
              </div>

              <button
                onClick={stopCamera}
                className="w-full rounded-2xl bg-zinc-100 py-3 text-xs font-bold text-zinc-700 hover:bg-zinc-200 transition"
              >
                Cancelar Leitura
              </button>
            </div>
          )}

          {/* Confirm Pairing Step */}
          {scanStep === 'confirm' && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00a884]/15 text-[#00a884]">
                <Laptop className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Vincular Novo Aparelho?</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  O aparelho terá acesso a todas as suas conversas do OffGrid Link.
                </p>
              </div>

              <div className="rounded-xl bg-white p-3 border border-zinc-200/80 text-left text-xs space-y-1">
                <div className="flex justify-between text-zinc-500">
                  <span>Conta vinculada:</span>
                  <span className="font-bold text-zinc-800">{user?.name}</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Email:</span>
                  <span className="font-medium text-zinc-800">{user?.email || firebaseUser?.email}</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>Segurança:</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Criptografia Ponta a Ponta
                  </span>
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-red-50 p-2.5 text-xs text-red-600 flex items-center gap-2 text-left">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setScanStep('scan');
                    setScannedSession(null);
                  }}
                  className="flex-1 rounded-xl bg-zinc-200 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmPairing}
                  className="flex-1 rounded-xl bg-[#00a884] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#009272]"
                >
                  Conectar Aparelho
                </button>
              </div>
            </div>
          )}

          {/* Pairing in progress */}
          {scanStep === 'pairing' && (
            <div className="py-10 text-center space-y-3">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#00a884]" />
              <h3 className="text-sm font-bold text-zinc-900">Transmitindo credenciais com segurança...</h3>
              <p className="text-xs text-zinc-500">Aguarde a validação no outro aparelho.</p>
            </div>
          )}

          {/* Success step */}
          {scanStep === 'success' && (
            <div className="py-8 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-zinc-900">Aparelho conectado com sucesso!</h3>
              <p className="text-xs text-zinc-500">Suas conversas já estão abertas na tela do computador.</p>
            </div>
          )}

          {/* Main Hero & Action (when not scanning) */}
          {!isScanning && scanStep === 'scan' && (
            <>
              <div className="flex flex-col items-center text-center p-4 rounded-3xl bg-gradient-to-b from-zinc-50 to-white border border-zinc-200">
                <div className="relative mb-3 flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600">
                    <Laptop className="h-8 w-8" />
                  </div>
                  <div className="flex h-10 w-10 -ml-3 mt-4 items-center justify-center rounded-xl bg-[#00a884] text-white shadow-md">
                    <Smartphone className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="text-sm font-bold text-zinc-900">Conecte seu computador ou tablet</h3>
                <p className="text-xs text-zinc-500 max-w-xs mt-1">
                  Acesse suas mensagens em tempo real no navegador web escaneando o código QR.
                </p>

                <button
                  onClick={startCamera}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00a884] py-3 text-xs font-bold text-white shadow-md hover:bg-[#009272] transition active:scale-95"
                >
                  <Camera className="h-4 w-4" />
                  <span>Conectar um Aparelho</span>
                </button>
              </div>

              {/* Linked Devices List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Status dos Aparelhos ({devices.length})
                </h4>

                {devices.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-zinc-400">
                    <QrCode className="mx-auto h-8 w-8 opacity-30 mb-2" />
                    <p className="text-xs">Nenhum aparelho conectado no momento.</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Toque em "Conectar um Aparelho" para vincular um computador via QR Code.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {devices.map((dev) => (
                      <div
                        key={dev.id}
                        className="flex items-center justify-between rounded-2xl border border-zinc-200 p-3.5 bg-white shadow-2xs hover:border-zinc-300 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                            <Laptop className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-zinc-800">{dev.deviceName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[10px] text-zinc-400">
                                Ativo • {new Date(dev.connectedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveDevice(dev.id)}
                          className="rounded-xl p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition"
                          title="Desconectar este aparelho"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Security Banner */}
          <div className="rounded-2xl bg-zinc-50 border border-zinc-200/60 p-3.5 flex items-start gap-2.5 text-zinc-500">
            <ShieldCheck className="h-4 w-4 text-[#00a884] shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Suas mensagens são sincronizadas de forma segura e protegidas com criptografia de ponta a ponta.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
