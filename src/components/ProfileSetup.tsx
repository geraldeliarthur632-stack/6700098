import React, { useState, useRef } from 'react';
import { useAuth } from '../App';
import { User as UserIcon, Loader2, Check, ArrowRight, Camera, X, Image as ImageIcon, Sparkles, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ref, uploadBytes, getDownloadURL, storage } from '../firebase';

export function ProfileSetup() {
  const { updateProfile, firebaseUser, user, openPermissionsModal } = useAuth();
  const [step, setStep] = useState<'name' | 'photo'>('name');
  const [name, setName] = useState(firebaseUser?.displayName || user?.name || '');
  const [loading, setLoading] = useState(false);
  const [customPhotoURL, setCustomPhotoURL] = useState<string | null>(firebaseUser?.photoURL || user?.photoURL || null);
  const [uploading, setUploading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;

    setUploading(true);
    try {
      // Create local preview immediately for fast feedback
      const localUrl = URL.createObjectURL(file);
      setCustomPhotoURL(localUrl);

      // Upload to Firebase Storage in background
      const storageRef = ref(storage, `profiles/${firebaseUser.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setCustomPhotoURL(downloadURL);
    } catch (error) {
      console.warn('Upload error, using local/data preview if available:', error);
      // Fallback: read as data URL so it still works even if storage rules/network fail
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomPhotoURL(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  const handleNext = () => {
    setNameError(null);
    const trimmedName = name.trim();
    const nameParts = trimmedName.split(/\s+/).filter(part => part.length > 0);
    if (nameParts.length >= 2) {
      setStep('photo');
    } else {
      setNameError('Por favor, insira seu nome e sobrenome para facilitar a busca de contatos.');
    }
  };

  const handleSubmit = async (photo: string | null) => {
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      // Salva nome, foto e marca profileCompleted como true
      await updateProfile({ 
        name: name.trim(), 
        photoURL: photo || null,
        profileCompleted: true
      });

      // Em seguida, abre as permissões com todas as explicações de offline
      openPermissionsModal();
    } catch (error) {
      console.error('Error setting up profile:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111b21] p-6 text-white font-sans">
      <AnimatePresence mode="wait">
        
        {/* PASSO 1: NOME COMPLETO */}
        {step === 'name' ? (
          <motion.div
            key="name"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-md space-y-8 text-center"
          >
            <div className="flex flex-col items-center">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-[#00a884] p-3 shadow-xl shadow-[#00a884]/20">
                <img src="/icon.svg" alt="OffGrid" className="h-full w-full object-contain" />
              </div>
              <h2 className="mb-2 text-3xl font-bold">Qual o seu nome?</h2>
              <p className="text-[#8696a0] text-sm">
                Insira seu nome e sobrenome para que seus contatos possam te reconhecer no OffGrid.
              </p>
            </div>

            <div className="relative">
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Nome e Sobrenome"
                className="w-full border-b-2 border-[#00a884] bg-transparent py-4 text-center text-2xl font-medium text-white placeholder-[#8696a0] outline-none transition-all focus:border-[#00a884]"
              />
              {nameError && (
                <p className="mt-2 text-xs text-rose-400 font-medium">{nameError}</p>
              )}
            </div>

            <button
              onClick={handleNext}
              disabled={!name.trim()}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#00a884] py-4 text-base font-bold text-[#111b21] transition-transform active:scale-95 disabled:opacity-50 hover:bg-[#009272] cursor-pointer"
            >
              <span>Avançar para foto</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </motion.div>
        ) : (
          
          /* PASSO 2: FOTO DO PERFIL */
          <motion.div
            key="photo"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-md space-y-6 text-center"
          >
            <div className="flex flex-col items-center">
              <h2 className="mb-2 text-2xl sm:text-3xl font-bold">Foto do Perfil</h2>
              <p className="text-[#8696a0] text-sm max-w-xs">
                Selecione uma foto da sua galeria/câmera ou continue com o avatar padrão.
              </p>
            </div>

            {/* Avatar Preview */}
            <div className="relative mx-auto my-2 group flex flex-col items-center justify-center">
              <div className="relative h-36 w-36 overflow-hidden rounded-full border-4 border-[#00a884] bg-[#202c33] shadow-2xl flex items-center justify-center">
                {uploading ? (
                  <Loader2 className="h-10 w-10 animate-spin text-[#00a884]" />
                ) : customPhotoURL ? (
                  <img
                    src={customPhotoURL}
                    alt="Foto do Perfil"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#8696a0]">
                    <UserIcon className="h-20 w-20 stroke-[1.5]" />
                  </div>
                )}

                {/* Remove photo button if custom chosen */}
                {customPhotoURL && !uploading && (
                  <button
                    type="button"
                    onClick={() => setCustomPhotoURL(null)}
                    className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition"
                    title="Remover foto e usar padrão"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Status indicator below avatar */}
              <p className="mt-3 text-xs text-[#8696a0]">
                {customPhotoURL 
                  ? 'Foto selecionada' 
                  : 'Foto simples padrão de contato ativa'}
              </p>
            </div>

            {/* Input file escondido */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*"
            />

            {/* Ações para a foto */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#202c33] border border-[#2a3942] py-3.5 text-sm font-bold text-white hover:bg-[#2a3942] transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[#00a884]" />
                ) : (
                  <Camera className="h-5 w-5 text-[#00a884]" />
                )}
                <span>{customPhotoURL ? 'Trocar de Foto' : 'Escolher Foto da Galeria / Câmera'}</span>
              </button>

              {/* Botão de Salvar Perfil e avançar pras permissões */}
              <button
                type="button"
                onClick={() => handleSubmit(customPhotoURL)}
                disabled={loading || uploading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00a884] py-4 text-base font-bold text-[#111b21] shadow-lg hover:bg-[#009272] transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    <span>Concluir Perfil e Ver Permissões</span>
                  </>
                )}
              </button>

              {/* Opção sem foto */}
              {customPhotoURL && (
                <button
                  type="button"
                  onClick={() => handleSubmit(null)}
                  disabled={loading}
                  className="text-xs text-[#8696a0] hover:text-white transition py-1 underline underline-offset-4 cursor-pointer"
                >
                  Continuar sem foto personalizada
                </button>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setStep('name')}
                disabled={loading}
                className="text-xs text-[#8696a0] hover:text-white transition"
              >
                ← Voltar para alterar o nome
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
