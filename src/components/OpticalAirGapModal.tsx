import React, { useState, useEffect, useRef } from 'react';
import { Camera, QrCode, X, Check, RefreshCw, Eye, EyeOff, Radio, Sparkles } from 'lucide-react';
import { OpticalMeshService, OpticalMessagePayload } from '../services/opticalMesh';
import { motion, AnimatePresence } from 'motion/react';

interface OpticalAirGapModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageToTransmit?: {
    id: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    text: string;
  } | null;
  onMessageReceived?: (payload: OpticalMessagePayload) => void;
}

export function OpticalAirGapModal({
  isOpen,
  onClose,
  messageToTransmit,
  onMessageReceived
}: OpticalAirGapModalProps) {
  const [tab, setTab] = useState<'transmit' | 'scan'>(messageToTransmit ? 'transmit' : 'scan');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [receivedMsg, setReceivedMsg] = useState<OpticalMessagePayload | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen && messageToTransmit) {
      setTab('transmit');
      OpticalMeshService.generateQR({
        id: messageToTransmit.id,
        conversationId: messageToTransmit.conversationId,
        senderId: messageToTransmit.senderId,
        senderName: messageToTransmit.senderName,
        text: messageToTransmit.text,
        type: 'text',
        timestamp: Date.now()
      }).then(url => setQrDataUrl(url)).catch(console.error);
    }
  }, [isOpen, messageToTransmit]);

  useEffect(() => {
    if (isOpen && tab === 'scan') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, tab]);

  const startCamera = async () => {
    try {
      setIsScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        scanLoop();
      }
    } catch (err) {
      console.warn('Camera error for optical scan:', err);
      setIsScanning(false);
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
    setIsScanning(false);
  };

  const scanLoop = () => {
    if (videoRef.current && canvasRef.current) {
      const result = OpticalMeshService.scanFrame(videoRef.current, canvasRef.current);
      if (result) {
        setReceivedMsg(result);
        stopCamera();
        if (onMessageReceived) {
          onMessageReceived(result);
        }
        return;
      }
    }
    animFrameRef.current = requestAnimationFrame(scanLoop);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-zinc-900">Malha Óptica Air-Gap</h3>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
              100% Offline
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Transfira mensagens entre aparelhos sem sinal de celular, Wi-Fi ou Bluetooth através da câmera e tela.
          </p>
        </div>

        {/* Tab switch */}
        <div className="mb-5 flex rounded-2xl bg-zinc-100 p-1">
          <button
            onClick={() => setTab('transmit')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition ${
              tab === 'transmit' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>Emitir Código QR</span>
          </button>
          <button
            onClick={() => setTab('scan')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition ${
              tab === 'scan' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Camera className="h-4 w-4" />
            <span>Escanear com Câmera</span>
          </button>
        </div>

        {tab === 'transmit' ? (
          <div className="flex flex-col items-center text-center">
            {qrDataUrl ? (
              <div className="p-3 bg-white border-2 border-zinc-200 rounded-2xl shadow-sm mb-3">
                <img src={qrDataUrl} alt="Optical QR Message" className="w-56 h-56 object-contain" />
              </div>
            ) : (
              <div className="h-56 w-56 flex items-center justify-center bg-zinc-100 rounded-2xl mb-3 text-zinc-400">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
            )}
            <p className="text-xs font-medium text-zinc-700 max-w-xs">
              Aponte a câmera do outro celular para esta tela para receber o pacote instantaneamente.
            </p>
            {messageToTransmit && (
              <div className="mt-3 w-full rounded-xl bg-zinc-50 p-2.5 text-left border border-zinc-200">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Conteúdo</span>
                <p className="text-xs text-zinc-800 truncate mt-0.5 font-medium">{messageToTransmit.text}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            {receivedMsg ? (
              <div className="w-full rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center my-3">
                <div className="h-10 w-10 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-2">
                  <Check className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-emerald-900">Mensagem Recebida via Malha Óptica!</h4>
                <p className="text-xs text-emerald-800 mt-2 font-medium">"{receivedMsg.text}"</p>
                <p className="text-[10px] text-emerald-600 mt-1">De: {receivedMsg.senderName}</p>
                <button
                  onClick={() => {
                    setReceivedMsg(null);
                    startCamera();
                  }}
                  className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  Escanear Outro Código
                </button>
              </div>
            ) : (
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black mb-3">
                <video ref={videoRef} className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                {/* Target overlay */}
                <div className="absolute inset-8 border-2 border-dashed border-[#00a884] rounded-2xl pointer-events-none animate-pulse" />
                <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-white/80 font-medium bg-black/40 py-1">
                  Posicione o código QR do outro celular dentro da moldura
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-zinc-100 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
