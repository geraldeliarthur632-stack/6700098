import React, { useState, useRef } from 'react';
import { 
  Database, 
  Cloud, 
  Smartphone, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  FolderArchive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { backupService, AccountBackupInfo, RestoreResult } from '../services/backupService';

interface LoginBackupPromptModalProps {
  isOpen: boolean;
  backupInfo: AccountBackupInfo;
  userUid: string;
  userName?: string;
  onClose: () => void;
  onRestored: () => void;
}

export function LoginBackupPromptModal({
  isOpen,
  backupInfo,
  userUid,
  userName,
  onClose,
  onRestored
}: LoginBackupPromptModalProps) {
  const [isRestoringDatabase, setIsRestoringDatabase] = useState(false);
  const [isRestoringFile, setIsRestoringFile] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Jeito 1: Restaurar do Banco de Dados
  const handleRestoreFromDatabase = async () => {
    setFeedback(null);
    setIsRestoringDatabase(true);
    try {
      const result: RestoreResult = await backupService.restoreFromDatabase(userUid);
      if (result.success) {
        setFeedback({
          type: 'success',
          text: `Sucesso! ${result.chatsRestored} conversas e ${result.messagesRestored} mensagens restauradas do banco de dados.`
        });
        setTimeout(() => {
          onRestored();
        }, 1500);
      } else {
        setFeedback({
          type: 'error',
          text: result.error || 'Nenhum backup encontrado no banco de dados para restaurar.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Falha ao restaurar backup do banco de dados.'
      });
    } finally {
      setIsRestoringDatabase(false);
    }
  };

  // Jeito 2: Mandar o backup pro app a partir de arquivo do celular
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFeedback(null);
    setIsRestoringFile(true);
    try {
      const result = await backupService.importBackupFromFile(file, userUid);
      if (result.success) {
        setFeedback({
          type: 'success',
          text: `Arquivo restaurado com sucesso! ${result.chatsRestored} conversas e ${result.messagesRestored} mensagens prontas.`
        });
        setTimeout(() => {
          onRestored();
        }, 1500);
      } else {
        setFeedback({
          type: 'error',
          text: result.error || 'Arquivo de backup inválido.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Erro ao processar arquivo.'
      });
    } finally {
      setIsRestoringFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Baixar backup no celular
  const handleDownloadToPhone = async () => {
    setFeedback(null);
    setIsDownloading(true);
    try {
      const res = await backupService.downloadBackupToDevice(userUid);
      if (res.success) {
        setFeedback({
          type: 'success',
          text: `Backup baixado no seu dispositivo (${res.filename})!`
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Erro ao baixar cópia do backup.'
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const isBusy = isRestoringDatabase || isRestoringFile || isDownloading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-zinc-200 overflow-hidden"
      >
        {/* Header estilo WhatsApp */}
        <div className="bg-[#00a884] p-6 text-white text-center relative">
          <button 
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="absolute top-4 right-4 rounded-full p-2 bg-black/10 hover:bg-black/20 text-white transition disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-xs mb-3 shadow-inner">
            <FolderArchive className="h-9 w-9 text-white" />
          </div>

          <h2 className="text-xl font-bold tracking-tight">
            Backup Encontrado!
          </h2>
          <p className="text-xs text-white/90 mt-1 max-w-xs mx-auto">
            {userName ? `Olá, ${userName}! ` : ''}Detectamos um backup anterior com suas mensagens e conversas salvas.
          </p>
        </div>

        {/* Detalhes do Backup */}
        <div className="p-6 space-y-4">
          <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
              <span className="flex items-center gap-1.5">
                <Database className="h-4 w-4 text-[#00a884]" />
                Dados do Backup da Conta
              </span>
              <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                {backupInfo.source === 'database' ? 'Banco de Dados' : backupInfo.source === 'local' ? 'Memória Local' : 'Nuvem & Local'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-600 pt-1 border-t border-zinc-200/60">
              <div>
                <span className="text-[10px] text-zinc-400 block font-semibold">DATA DO BACKUP</span>
                <span className="font-medium text-zinc-800">
                  {backupInfo.lastBackupAt ? format(backupInfo.lastBackupAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Recente'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block font-semibold">TAMANHO</span>
                <span className="font-medium text-zinc-800">{formatBytes(backupInfo.sizeBytes)}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block font-semibold">CONVERSAS</span>
                <span className="font-medium text-zinc-800">{backupInfo.totalChats || 0} chats</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block font-semibold">MENSAGENS</span>
                <span className="font-medium text-zinc-800">{backupInfo.totalMessages || 0} mensagens</span>
              </div>
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <div className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 ${
              feedback.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{feedback.text}</span>
            </div>
          )}

          {/* Os dois jeitos para o usuário escolher */}
          <div className="space-y-2.5 pt-1">
            <p className="text-xs font-bold text-zinc-700">
              Como você deseja restaurar?
            </p>

            {/* Jeito 1: Restaurar do Banco de Dados */}
            <button
              type="button"
              onClick={handleRestoreFromDatabase}
              disabled={isBusy}
              className="flex w-full items-center justify-between p-3.5 rounded-2xl bg-[#00a884] text-white shadow-md shadow-[#00a884]/20 hover:bg-[#009272] transition active:scale-[0.98] disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <Database className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold block">1. Restaurar do Banco de Dados</span>
                  <span className="text-[11px] text-white/80 block">Recuperar dados direto da nuvem Firestore</span>
                </div>
              </div>
              {isRestoringDatabase ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <ArrowRight className="h-5 w-5 text-white" />
              )}
            </button>

            {/* Jeito 2: Mandar o backup do celular pro app */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="flex w-full items-center justify-between p-3.5 rounded-2xl bg-zinc-50 hover:bg-zinc-100 border-2 border-zinc-200 text-zinc-900 transition active:scale-[0.98] disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold block">2. Mandar Arquivo do Celular pro App</span>
                  <span className="text-[11px] text-zinc-500 block">Selecionar arquivo de backup .json do celular</span>
                </div>
              </div>
              {isRestoringFile ? (
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              ) : (
                <ArrowRight className="h-5 w-5 text-zinc-400" />
              )}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".json,application/json" 
              className="hidden" 
            />
          </div>

          {/* Opções Auxiliares: Baixar no Celular ou Pular */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={handleDownloadToPhone}
              disabled={isBusy}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition py-1 px-2 rounded-lg hover:bg-zinc-100 disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00a884]" />
              ) : (
                <Smartphone className="h-3.5 w-3.5 text-[#00a884]" />
              )}
              <span>Baixar backup no celular (.json)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="text-xs font-bold text-zinc-400 hover:text-zinc-700 transition py-1 px-2"
            >
              Pular e começar agora
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
