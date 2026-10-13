import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, query, onSnapshot, setDoc, doc, handleFirestoreError, OperationType, where } from '../firebase';
import { useAuth } from '../App';
import { User, Conversation } from '../types';
import { ChevronLeft, Search, Check, Users, Camera } from 'lucide-react';

export default function NewGroup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [step, setStep] = useState(1); // 1: Select members, 2: Group info
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || user.contacts.length === 0) {
      setContacts([]);
      return;
    }
    
    const q = query(
      collection(db, 'users_public'), 
      where('uid', 'in', user.contacts)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs
        .map(docSnap => ({ uid: docSnap.id, ...docSnap.data() } as User))
        .filter(u => u.uid !== user.uid);
      setContacts(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users_public');
    });
    return () => unsubscribe();
  }, [user]);

  const toggleUser = (uid: string) => {
    setSelectedUsers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const createGroup = async () => {
    if (!user || !groupName.trim() || selectedUsers.length === 0) return;
    setLoading(true);

    try {
      const participants = [user.uid, ...selectedUsers];
      const convRef = doc(collection(db, 'conversations'));
      const now = Date.now();
      
      const groupData: Conversation = {
        id: convRef.id,
        participants,
        isGroup: true,
        groupName: groupName.trim(),
        adminId: user.uid,
        updatedAt: now,
        lastMessage: {
          id: `msg-${now}`,
          conversationId: convRef.id,
          senderId: user.uid,
          text: 'Grupo criado',
          type: 'text',
          createdAt: now,
          expiresAt: now + (26 * 60 * 60 * 1000),
          delivered: true,
          seen: false,
          deliveryMethod: 'internet',
          isEncrypted: false,
        }
      };

      await setDoc(convRef, groupData);
      navigate(`/chat/${convRef.id}`);
    } catch (error) {
      console.error('Error creating group:', error);
      handleFirestoreError(error, OperationType.CREATE, 'conversations');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-zinc-100 p-4">
        <button onClick={() => step === 1 ? navigate(-1) : setStep(1)} className="rounded-full p-1 hover:bg-zinc-100">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-lg font-bold">{step === 1 ? 'Novo Grupo' : 'Informações do Grupo'}</h1>
          <p className="text-xs text-zinc-500">
            {step === 1 ? `${selectedUsers.length} selecionados` : 'Adicione um nome e imagem'}
          </p>
        </div>
      </div>

      {step === 1 ? (
        <>
          {/* Search */}
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Pesquisar contatos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl bg-zinc-100 py-2 pl-10 pr-4 text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Selected Users Horizontal List */}
          {selectedUsers.length > 0 && (
            <div className="flex gap-4 overflow-x-auto border-b border-zinc-100 px-4 py-2">
              {selectedUsers.map(uid => {
                const contact = contacts.find(c => c.uid === uid);
                return (
                  <div key={uid} className="flex flex-col items-center gap-1">
                    <div className="relative h-12 w-12 shrink-0">
                      {contact?.photoURL ? (
                        <img src={contact.photoURL} alt="" className="h-full w-full rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
                          <Users className="h-6 w-6" />
                        </div>
                      )}
                      <button 
                        onClick={() => toggleUser(uid)}
                        className="absolute -right-1 -top-1 rounded-full bg-zinc-900 p-0.5 text-white shadow-sm"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="max-w-[60px] truncate text-[10px]">{contact?.name}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {filteredContacts.map(contact => (
              <button
                key={contact.uid}
                onClick={() => toggleUser(contact.uid)}
                className="flex w-full items-center gap-4 px-4 py-3 hover:bg-zinc-50"
              >
                <div className="relative h-12 w-12">
                  {contact.photoURL ? (
                    <img src={contact.photoURL} alt={contact.name} className="h-full w-full rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
                      <Users className="h-6 w-6" />
                    </div>
                  )}
                  {selectedUsers.includes(contact.uid) && (
                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-sm font-bold">{contact.name}</h3>
                  <p className="text-xs text-zinc-500">{contact.status || 'Disponível'}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Floating Action Button */}
          {selectedUsers.length > 0 && (
            <button
              onClick={() => setStep(2)}
              className="absolute bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00a884] text-white shadow-xl transition-transform active:scale-90"
            >
              <ChevronLeft className="h-6 w-6 rotate-180" />
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-1 flex-col p-6">
          <div className="mb-8 flex flex-col items-center gap-4">
            <div className="relative h-24 w-24">
              <div className="flex h-full w-full items-center justify-center rounded-3xl bg-zinc-100 text-zinc-400">
                <Camera className="h-10 w-10" />
              </div>
            </div>
            <p className="text-xs text-zinc-500">Foto do grupo (opcional)</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Nome do Grupo</label>
              <input
                type="text"
                placeholder="Ex: Família, Trabalho, Expedição..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full border-b-2 border-zinc-200 py-2 text-lg font-bold focus:border-[#00a884] focus:outline-none"
                autoFocus
              />
            </div>
            <p className="text-xs text-zinc-400">
              Forneça um nome para o grupo com suporte à comunicação online e em rede mesh.
            </p>
          </div>

          <div className="mt-auto">
            <button
              onClick={createGroup}
              disabled={!groupName.trim() || loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00a884] py-4 font-bold text-white shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Check className="h-5 w-5" />
              <span>{loading ? 'Criando...' : 'Criar Grupo'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const XIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);
