import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { 
  User as UserIcon, 
  LogOut, 
  Shield, 
  Bell, 
  HelpCircle, 
  ChevronRight, 
  Camera, 
  Edit2, 
  Check, 
  X, 
  Lock, 
  Loader2, 
  Download, 
  Laptop, 
  QrCode, 
  Smartphone, 
  Cloud,
  Database,
  Upload,
  FileCheck,
  ShieldCheck,
  AlertCircle,
  FolderArchive,
  RefreshCw,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ref, uploadBytes, getDownloadURL, storage } from '../firebase';
import { PWAInstallButton } from './PWAInstallButton';
import { LinkedDevicesModal } from './LinkedDevicesModal';
import { BackupModal } from './BackupModal';
import { backupService, RestoreResult } from '../services/backupService';

export function Settings() {
  const { user, logout, updateProfile, openPermissionsModal, syncOfflineMessagesNow } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showLinkedDevices, setShowLinkedDevices] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para Backup Local & Criptografado
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingEncrypted, setIsExportingEncrypted] = useState(false);
  const [isImportingFile, setIsImportingFile] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [showPasswordField, setShowPasswordField] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  const [editData, setEditData] = useState({
    name: user?.name || '',
    photoURL: user?.photoURL || '',
    bio: user?.bio || '',
    password: user?.password || ''
  });
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setSaveError(null);
    try {
      const storageRef = ref(storage, `profiles/${user.uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setEditData({ ...editData, photoURL: downloadURL });
    } catch (error) {
      console.error('Error uploading file:', error);
      setSaveError('Erro ao fazer upload da imagem.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    const trimmedName = editData.name.trim();
    const nameParts = trimmedName.split(/\s+/).filter(part => part.length > 0);
    
    if (nameParts.length < 2) {
      setSaveError('Por favor, insira seu nome e sobrenome para facilitar a busca de contatos.');
      return;
    }

    setLoading(true);
    try {
      await updateProfile(editData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaveError('Erro ao salvar alterações do perfil.');
    } finally {
      setLoading(false);
    }
  };

  // 1. Exportar todo o histórico de mensagens e dados do perfil como arquivo JSON criptografado (.offgrid)
  const handleExportEncryptedBackup = async () => {
    if (!user) return;
    setBackupFeedback(null);
    setIsExportingEncrypted(true);
    try {
      const res = await backupService.exportEncryptedBackupToFile(user.uid, backupPassword || undefined);
      if (res.success) {
        setBackupFeedback({
          type: 'success',
          text: `Backup criptografado gerado e baixado no seu dispositivo (${res.filename})! Suas mensagens e perfil estão protegidos com criptografia AES-GCM 256-bit.`
        });
      }
    } catch (err: any) {
      console.error('Erro ao exportar backup criptografado:', err);
      setBackupFeedback({
        type: 'error',
        text: err?.message || 'Falha ao gerar o arquivo de backup criptografado.'
      });
    } finally {
      setIsExportingEncrypted(false);
    }
  };

  // 2. Seletor de arquivo (.json ou .offgrid) para restaurar conversas e contatos diretamente no banco local
  const handleSelectBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setBackupFeedback(null);
    setIsImportingFile(true);
    try {
      const res: RestoreResult = await backupService.importBackupFromFile(file, user.uid, backupPassword || undefined);
      if (res.success) {
        setBackupFeedback({
          type: 'success',
          text: `Restauração concluída com sucesso! ${res.chatsRestored} conversas e ${res.messagesRestored} mensagens foram restauradas diretamente no banco de dados local.`
        });
      } else {
        setBackupFeedback({
          type: 'error',
          text: res.error || 'Não foi possível restaurar os dados do arquivo selecionado.'
        });
      }
    } catch (err: any) {
      console.error('Erro ao importar arquivo de backup:', err);
      setBackupFeedback({
        type: 'error',
        text: err?.message || 'Erro ao processar o arquivo de backup.'
      });
    } finally {
      setIsImportingFile(false);
      if (backupFileInputRef.current) backupFileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#f0f2f5] overflow-y-auto">
      {/* Header */}
      <div className="bg-[#00a884] p-4 text-white shadow-sm flex items-center justify-between">
        <h1 className="text-xl font-bold">Configurações</h1>
        <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-semibold">
          OffGrid Link
        </span>
      </div>

      <div className="p-4 max-w-2xl mx-auto w-full space-y-4">
        {/* Perfil Card */}
        <div className="flex flex-col items-center p-6 bg-white rounded-3xl shadow-xs border border-zinc-200">
          <div className="relative mb-4">
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-[#00a884] bg-zinc-100 flex items-center justify-center shadow-md">
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
              ) : editData.photoURL || user?.photoURL ? (
                <img 
                  src={isEditing ? editData.photoURL : user?.photoURL} 
                  alt={user?.name} 
                  className="h-full w-full object-cover" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-400">
                  <UserIcon className="h-10 w-10" />
                </div>
              )}
            </div>
            {isEditing && (
              <>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept="image/*"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-lg transition-transform hover:scale-110 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          <AnimatePresence mode="wait">
            {!isEditing ? (
              <motion.div
                key="view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full text-center"
              >
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{user?.name}</h2>
                <p className="text-sm text-zinc-500 mb-2">{user?.email || user?.phoneNumber}</p>
                {user?.bio && (
                  <p className="text-sm text-zinc-600 italic max-w-xs mx-auto">"{user.bio}"</p>
                )}
                <button
                  onClick={() => setIsEditing(true)}
                  className="mt-4 flex items-center gap-2 mx-auto text-xs font-bold uppercase tracking-widest text-[#00a884] hover:text-[#008f70]"
                >
                  <Edit2 className="h-3 w-3" />
                  Editar Perfil
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="edit"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-xs space-y-4"
              >
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  placeholder="Nome Completo"
                  className="w-full rounded-xl bg-zinc-100 px-4 py-2 text-sm font-bold text-center outline-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-[#00a884] text-zinc-900"
                />
                <textarea
                  value={editData.bio}
                  onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                  placeholder="Recado / Bio"
                  rows={2}
                  className="w-full rounded-xl bg-zinc-100 px-4 py-2 text-xs text-center outline-none ring-1 ring-zinc-200 focus:ring-2 focus:ring-[#00a884] text-zinc-900 resize-none"
                />
                {saveError && (
                  <p className="text-xs text-rose-500 font-semibold text-center">{saveError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setSaveError(null);
                      setEditData({
                        name: user?.name || '',
                        photoURL: user?.photoURL || '',
                        bio: user?.bio || '',
                        password: user?.password || ''
                      });
                    }}
                    className="flex-1 rounded-xl bg-zinc-100 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading || uploading}
                    className="flex-1 rounded-xl bg-[#00a884] py-2 text-xs font-bold text-white shadow-md hover:bg-[#008f70] disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Salvar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ============================================================== */}
        {/* SEÇÃO PRINCIPAL: BACKUP E RESTAURAÇÃO LOCAL / ARQUIVOS           */}
        {/* ============================================================== */}
        <div className="rounded-3xl bg-white p-5 border border-zinc-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <FolderArchive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Backup & Restauração no Dispositivo
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Exporte seu histórico criptografado ou selecione um arquivo para restaurar no banco local
                </p>
              </div>
            </div>
            <span className="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
              Local
            </span>
          </div>

          {/* Feedback de Importação / Exportação */}
          {backupFeedback && (
            <div className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 ${
              backupFeedback.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {backupFeedback.type === 'success' ? (
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{backupFeedback.text}</span>
            </div>
          )}

          {/* Campo de Senha Opcional para Criptografia */}
          <div>
            <button
              type="button"
              onClick={() => setShowPasswordField(!showPasswordField)}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
            >
              <Key className="h-3 w-3" />
              <span>{showPasswordField ? 'Ocultar senha de criptografia' : 'Definir senha personalizada para o backup (opcional)'}</span>
            </button>
            {showPasswordField && (
              <div className="mt-2">
                <input
                  type="password"
                  value={backupPassword}
                  onChange={(e) => setBackupPassword(e.target.value)}
                  placeholder="Senha para proteger seu arquivo .offgrid"
                  className="w-full rounded-xl bg-zinc-50 border border-zinc-200 px-3.5 py-2 text-xs text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-zinc-400 mt-1">
                  Se deixar em branco, o arquivo será criptografado com a chave de segurança única da sua conta.
                </p>
              </div>
            )}
          </div>

          {/* Grid com os 2 botões solicitados: Seletor de Arquivos e Exportar Criptografado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            
            {/* BOTÃO 1: EXPORTAR HISTÓRICO CRIPTOGRAFADO PARA O ARMAZENAMENTO LOCAL */}
            <button
              type="button"
              onClick={handleExportEncryptedBackup}
              disabled={isExportingEncrypted || isImportingFile}
              className="group flex flex-col justify-between p-4 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition active:scale-[0.98] disabled:opacity-50 text-left"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                    {isExportingEncrypted ? (
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    ) : (
                      <ShieldCheck className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <Download className="h-4 w-4 text-white/80 group-hover:translate-y-0.5 transition" />
                </div>
                <h4 className="text-xs font-bold text-white">
                  Exportar Histórico Criptografado
                </h4>
                <p className="text-[10px] text-white/80 mt-1 leading-relaxed">
                  Baixa mensagens e dados do perfil como arquivo <strong>.offgrid</strong> criptografado no armazenamento local.
                </p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-white bg-white/20 px-2.5 py-1 rounded-lg self-start">
                {isExportingEncrypted ? 'Gerando arquivo...' : 'Baixar no Dispositivo'}
              </span>
            </button>

            {/* BOTÃO 2: SELETOR DE ARQUIVOS (.json ou .offgrid) PARA RESTAURAR NO BANCO LOCAL */}
            <button
              type="button"
              onClick={() => backupFileInputRef.current?.click()}
              disabled={isExportingEncrypted || isImportingFile}
              className="group flex flex-col justify-between p-4 rounded-2xl bg-zinc-50 border-2 border-dashed border-zinc-300 hover:border-[#00a884] hover:bg-emerald-50/30 transition active:scale-[0.98] disabled:opacity-50 text-left"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00a884]/15 text-[#00a884]">
                    {isImportingFile ? (
                      <Loader2 className="h-5 w-5 animate-spin text-[#00a884]" />
                    ) : (
                      <Upload className="h-5 w-5 text-[#00a884]" />
                    )}
                  </div>
                  <FileCheck className="h-4 w-4 text-zinc-400 group-hover:text-[#00a884] transition" />
                </div>
                <h4 className="text-xs font-bold text-zinc-900 group-hover:text-[#00a884] transition">
                  Selecionar Arquivo de Backup
                </h4>
                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                  Escolha um arquivo <strong>.json</strong> ou <strong>.offgrid</strong> do dispositivo para restaurar conversas e contatos no banco local.
                </p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#00a884] bg-[#00a884]/10 px-2.5 py-1 rounded-lg self-start">
                {isImportingFile ? 'Restaurando...' : 'Selecionar Arquivo (.json / .offgrid)'}
              </span>
            </button>

            {/* Input file escondido com suporte a .json e .offgrid */}
            <input
              type="file"
              ref={backupFileInputRef}
              onChange={handleSelectBackupFile}
              accept=".json,.offgrid,application/json"
              className="hidden"
            />
          </div>

          {/* Atalho para o Gerenciador Completo de Backup da Nuvem */}
          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">
              Quer sincronizar ou restaurar pela nuvem?
            </span>
            <button
              type="button"
              onClick={() => setShowBackupModal(true)}
              className="text-xs font-bold text-[#00a884] hover:underline flex items-center gap-1"
            >
              <Cloud className="h-3.5 w-3.5" />
              <span>Abrir Gerenciador na Nuvem</span>
            </button>
          </div>
        </div>

        {/* Conectar Dispositivo (WhatsApp Web) */}
        <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white p-5 border border-emerald-500/20 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#00a884] text-white shadow-md shadow-[#00a884]/20">
              <Laptop className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900">
                  Conectar Dispositivo
                </h3>
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[9px] font-bold uppercase">
                  QR Web
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                Use seu celular para escanear e conectar o computador igual ao WhatsApp Web.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowLinkedDevices(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00a884] py-3.5 px-4 text-xs font-bold text-white shadow-sm hover:bg-[#009272] transition-all active:scale-[0.98] cursor-pointer"
          >
            <QrCode className="h-4 w-4" />
            <span>Conectar Dispositivo via Código QR</span>
          </button>
        </div>

        {/* Lista de Opções */}
        <div className="rounded-3xl bg-white overflow-hidden border border-zinc-200 shadow-xs">
          <button 
            onClick={() => setShowLinkedDevices(true)}
            className="flex w-full items-center justify-between p-4 hover:bg-zinc-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-50 text-[#00a884] flex items-center justify-center">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-zinc-900 block">Aparelhos Conectados</span>
                <span className="text-[11px] text-zinc-400 block">Gerenciar conexões e sessões ativas</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          </button>

          <button 
            onClick={openPermissionsModal}
            className="flex w-full items-center justify-between p-4 hover:bg-zinc-50 transition-colors border-t border-zinc-100"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-[#00a884] flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-zinc-900 block">Permissões & Conexões Offline</span>
                <span className="text-[11px] text-zinc-400 block">Como autorizar Bluetooth, Wi-Fi Direct, Microfone e Câmera</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          </button>

          <button 
            onClick={openPermissionsModal}
            className="flex w-full items-center justify-between p-4 hover:bg-zinc-50 transition-colors border-t border-zinc-100"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <Bell className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-zinc-900 block">Notificações e Sons</span>
                <span className="text-[11px] text-zinc-400 block">Alertas de mensagens e toques</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          </button>

          <button 
            type="button"
            onClick={() => setShowBackupModal(true)}
            className="flex w-full items-center justify-between p-4 hover:bg-zinc-50 transition-colors border-t border-zinc-100 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-[#00a884] flex items-center justify-center">
                <Cloud className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-900 block">Backup de Conversas & Nuvem</span>
                  {user?.backupMetadata?.lastBackupAt && (
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[9px] font-bold">
                      Salvo
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-400 block">
                  {user?.backupMetadata?.lastBackupAt 
                    ? `Último backup: ${new Date(user.backupMetadata.lastBackupAt).toLocaleDateString('pt-BR')}`
                    : 'Salvar mensagens no banco de dados e baixar cópia'}
                </span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          </button>

          <div className="flex w-full items-center justify-between p-4 border-t border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Download className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-zinc-900 block">Instalar no Dispositivo</span>
                <span className="text-[11px] text-zinc-400 block">App offline progressivo (PWA)</span>
              </div>
            </div>
            <PWAInstallButton variant="button" />
          </div>
        </div>

        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-red-600 hover:bg-red-50 transition-colors border border-zinc-200 shadow-xs"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-bold uppercase tracking-wider">Sair da Conta</span>
        </button>

        <div className="pt-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">OffGrid Link v1.2</p>
          <p className="text-[10px] text-zinc-400 mt-1">Desenvolvido para comunicação resiliente</p>
        </div>
      </div>

      <LinkedDevicesModal 
        isOpen={showLinkedDevices} 
        onClose={() => setShowLinkedDevices(false)} 
      />

      <BackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
      />
    </div>
  );
}
