import React, { useState, useRef } from 'react';
import { 
  Cloud, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  Database,
  Smartphone,
  ArrowRight,
  HardDrive,
  RefreshCw,
  Share2
} from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { backupService, BackupResult, RestoreResult } from '../services/backupService';
import { useAuth } from '../App';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BackupModal({ isOpen, onClose }: BackupModalProps) {
  const { user } = useAuth();
  const [isDatabaseExporting, setIsDatabaseExporting] = useState(false);
  const [isDatabaseRestoring, setIsDatabaseRestoring] = useState(false);
  const [isDownloadingToPhone, setIsDownloadingToPhone] = useState(false);
  const [isFileRestoring, setIsFileRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !user) return null;

  const metadata = user.backupMetadata;

  // 1. Jeito 1: Exportar Backup para o Banco de Dados
  const handleExportToDatabase = async () => {
    setStatusMessage(null);
    setIsDatabaseExporting(true);
    try {
      const result: BackupResult = await backupService.exportBackupToDatabase(user.uid);
      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: `Backup exportado com sucesso para o banco de dados! ${result.totalChats} conversas e ${result.totalMessages} mensagens salvas.`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Falha ao salvar backup no banco de dados.'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Erro inesperado ao exportar para o banco de dados.'
      });
    } finally {
      setIsDatabaseExporting(false);
    }
  };

  // Jeito 1: Restaurar Backup do Banco de Dados pro App
  const handleRestoreFromDatabase = async () => {
    setStatusMessage(null);
    setIsDatabaseRestoring(true);
    try {
      const result: RestoreResult = await backupService.restoreFromDatabase(user.uid);
      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: `Restauração do banco de dados concluída! ${result.chatsRestored} conversas e ${result.messagesRestored} mensagens restauradas no app.`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Nenhum backup encontrado no banco de dados para restaurar.'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Erro ao restaurar do banco de dados.'
      });
    } finally {
      setIsDatabaseRestoring(false);
    }
  };

  // 2. Jeito 2: Baixar o backup no celular / dispositivo
  const handleDownloadToPhone = async () => {
    setStatusMessage(null);
    setIsDownloadingToPhone(true);
    try {
      const res = await backupService.downloadBackupToDevice(user.uid);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `Backup baixado no celular com sucesso (${res.filename})! Você pode guardá-lo nos seus arquivos.`
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Erro ao baixar backup no celular.'
      });
    } finally {
      setIsDownloadingToPhone(false);
    }
  };

  // Jeito 2: Mandar o backup pro app (importar arquivo do celular)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(null);
    setIsFileRestoring(true);
    try {
      const result = await backupService.importBackupFromFile(file, user.uid);
      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: `Backup enviado pro app com sucesso! ${result.chatsRestored} conversas e ${result.messagesRestored} mensagens restauradas.`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Arquivo de backup inválido.'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Erro ao mandar o backup pro app.'
      });
    } finally {
      setIsFileRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isBusy = isDatabaseExporting || isDatabaseRestoring || isDownloadingToPhone || isFileRestoring;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-zinc-200 overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 bg-zinc-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-[#00a884]">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Backup de Conversas</h2>
              <p className="text-xs text-zinc-500">Escolha o jeito que preferir para salvar ou restaurar</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Status Atual do Backup */}
          <div className="rounded-2xl bg-zinc-50 p-4 border border-zinc-200/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <Cloud className="h-4 w-4 text-[#00a884]" />
                Status do Backup da Conta
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {metadata?.lastBackupAt ? 'Sincronizado' : 'Disponível'}
              </span>
            </div>

            <div className="text-xs text-zinc-600 space-y-1">
              <p>
                <strong>Último backup:</strong>{' '}
                {metadata?.lastBackupAt ? (
                  format(metadata.lastBackupAt, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })
                ) : (
                  'Nenhum backup registrado no banco ainda'
                )}
              </p>
              {metadata && (
                <p className="text-[11px] text-zinc-500">
                  {metadata.totalChats} conversas • {metadata.totalMessages} mensagens • {formatBytes(metadata.sizeBytes)}
                </p>
              )}
            </div>
          </div>

          {/* Feedback Alert */}
          {statusMessage && (
            <div className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* JEITO 1: BANCO DE DADOS (FIRESTORE)                             */}
          {/* ============================================================== */}
          <div className="rounded-2xl border-2 border-emerald-500/20 bg-emerald-50/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00a884] text-white text-xs font-bold">
                  1
                </span>
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
                  Jeito 1: Banco de Dados (Nuvem)
                </h3>
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-full">
                Automático & Online
              </span>
            </div>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Exporta todas as suas conversas e mensagens direto para o banco de dados ou recupera o que já está salvo na sua conta.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Exportar para o Banco de Dados */}
              <button
                type="button"
                onClick={handleExportToDatabase}
                disabled={isBusy}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#00a884] py-2.5 px-3 text-xs font-bold text-white shadow-xs hover:bg-[#009272] transition active:scale-95 disabled:opacity-50"
              >
                {isDatabaseExporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Exportando...</span>
                  </>
                ) : (
                  <>
                    <Database className="h-3.5 w-3.5" />
                    <span>Exportar pro Banco</span>
                  </>
                )}
              </button>

              {/* Restaurar do Banco de Dados pro App */}
              <button
                type="button"
                onClick={handleRestoreFromDatabase}
                disabled={isBusy}
                className="flex items-center justify-center gap-2 rounded-xl bg-white border border-emerald-300 py-2.5 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition active:scale-95 disabled:opacity-50"
              >
                {isDatabaseRestoring ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                    <span>Restaurando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Restaurar do Banco</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ============================================================== */}
          {/* JEITO 2: MANDAR PRO APP OU BAIXAR NO CELULAR                    */}
          {/* ============================================================== */}
          <div className="rounded-2xl border-2 border-indigo-500/20 bg-indigo-50/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
                  2
                </span>
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
                  Jeito 2: Arquivo no Celular (.json)
                </h3>
              </div>
              <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-100/80 px-2 py-0.5 rounded-full">
                Armazenamento do Aparelho
              </span>
            </div>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Baixe o arquivo de backup no seu celular para guardar com segurança ou envie um arquivo de backup do celular para o app restaurar.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Baixar no Celular */}
              <button
                type="button"
                onClick={handleDownloadToPhone}
                disabled={isBusy}
                className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 px-3 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50"
              >
                {isDownloadingToPhone ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Baixando no celular...</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>Baixar no Celular</span>
                  </>
                )}
              </button>

              {/* Mandar Backup pro App */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="flex items-center justify-center gap-2 rounded-xl bg-white border border-indigo-300 py-2.5 px-3 text-xs font-bold text-indigo-800 hover:bg-indigo-50 transition active:scale-95 disabled:opacity-50"
              >
                {isFileRestoring ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                    <span>Restaurando...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Mandar Backup pro App</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".json,application/json" 
            className="hidden" 
          />

          <div className="pt-1 text-center">
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Dica: Você pode usar ambos os jeitos! Ter uma cópia no banco de dados e baixar no celular garante que suas mensagens nunca se percam.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
