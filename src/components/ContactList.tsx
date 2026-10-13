import React, { useState, useEffect } from 'react';
import { db, collection, query, where, getDocs, addDoc, doc, updateDoc, setDoc, getDoc, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../App';
import { User } from '../types';
import { cn } from '../lib/utils';
import { Search, UserPlus, User as UserIcon, Check, Loader2, Users, MessageSquare, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ContactList() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [myContacts, setMyContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const fetchContacts = async () => {
      if (!user) return;
      const contactsData: User[] = [];
      try {
        const uniqueContactIds = [...new Set(user.contacts)];
        for (const contactId of uniqueContactIds) {
          const snap = await getDoc(doc(db, 'users_public', contactId));
          if (snap.exists()) contactsData.push(snap.data() as User);
        }
        setMyContacts(contactsData);
      } catch (error) {
        console.error('Error fetching contacts:', error);
      }
    };
    fetchContacts();
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = searchQuery.trim();
    if (!queryStr) return;
    setLoading(true);
    
    try {
      // Search in users_search collection
      const searchRef = doc(db, 'users_search', queryStr);
      const searchSnap = await getDoc(searchRef);
      
      if (searchSnap.exists()) {
        const { uid } = searchSnap.data();
        const publicSnap = await getDoc(doc(db, 'users_public', uid));
        if (publicSnap.exists()) {
          const foundUser = publicSnap.data() as User;
          // Add the search query as email/phone for display if missing
          if (!foundUser.email && queryStr.includes('@')) foundUser.email = queryStr;
          if (!foundUser.phoneNumber && !queryStr.includes('@')) foundUser.phoneNumber = queryStr;
          setSearchResults([foundUser]);
        } else {
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users_search');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSMS = () => {
    const message = `Olá! Junte-se a mim no OffGrid Link, o app de mensagens que funciona até sem internet! Baixe aqui: ${window.location.origin}`;
    window.location.href = `sms:?body=${encodeURIComponent(message)}`;
  };

  const createGroup = async () => {
    if (!user || !groupName.trim() || selectedParticipants.length === 0) return;
    
    const convRef = doc(collection(db, 'conversations'));
    const newGroup = {
      id: convRef.id,
      participants: [user.uid, ...selectedParticipants],
      updatedAt: Date.now(),
      isGroup: true,
      groupName: groupName.trim(),
      adminId: user.uid
    };

    try {
      await setDoc(convRef, newGroup);
      navigate(`/chat/${convRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'conversations');
    }
  };

  const toggleParticipant = (uid: string) => {
    setSelectedParticipants(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const addContact = async (contact: User) => {
    if (!user || user.contacts.includes(contact.uid)) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const newContacts = [...new Set([...user.contacts, contact.uid])];
      await updateDoc(userRef, { contacts: newContacts });
      setMyContacts(prev => {
        if (prev.find(u => u.uid === contact.uid)) return prev;
        return [...prev, contact];
      });
      setSearchResults(prev => prev.filter(u => u.uid !== contact.uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const startChat = async (contact: User) => {
    if (!user) return;
    
    try {
      // Check if conversation already exists
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user.uid)
      );
      const snap = await getDocs(q);
      const existing = snap.docs.find(doc => {
        const data = doc.data();
        if (data.isGroup) return false;
        if (contact.uid === user.uid) {
          return data.participants.length === 2 && data.participants.every((p: string) => p === user.uid);
        }
        return data.participants.length === 2 && data.participants.includes(contact.uid);
      });

      if (existing) {
        navigate(`/chat/${existing.id}`);
      } else {
        const convRef = doc(collection(db, 'conversations'));
        const newConv = {
          id: convRef.id,
          participants: [user.uid, contact.uid],
          updatedAt: Date.now()
        };
        await setDoc(convRef, newConv);
        navigate(`/chat/${convRef.id}`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'conversations');
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="px-6 py-8">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">Contatos</h1>
        
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por email..."
            className="w-full rounded-2xl bg-zinc-100 py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-200"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />}
        </form>
      </header>

      <div className="flex-1 overflow-y-auto px-2">
        {isCreatingGroup ? (
          <div className="px-4 py-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nome do Grupo</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ex: Família, Trabalho..."
                className="w-full rounded-2xl bg-zinc-100 py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Selecionar Participantes</label>
              {myContacts.map(contact => (
                <button
                  key={`participant-${contact.uid}`}
                  onClick={() => toggleParticipant(contact.uid)}
                  className="flex w-full items-center justify-between p-2 rounded-2xl transition-colors hover:bg-zinc-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400">
                      {contact.photoURL ? <img src={contact.photoURL} className="h-full w-full rounded-xl" /> : <UserIcon />}
                    </div>
                    <span className="text-sm font-semibold">{contact.name}</span>
                  </div>
                  <div className={cn(
                    "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors",
                    selectedParticipants.includes(contact.uid) ? "bg-zinc-900 border-zinc-900 text-white" : "border-zinc-200"
                  )}>
                    {selectedParticipants.includes(contact.uid) && <Check className="h-3 w-3" />}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setIsCreatingGroup(false)}
                className="flex-1 rounded-2xl bg-zinc-100 py-4 font-bold text-zinc-900"
              >
                Cancelar
              </button>
              <button
                onClick={createGroup}
                disabled={!groupName.trim() || selectedParticipants.length === 0}
                className="flex-1 rounded-2xl bg-zinc-900 py-4 font-bold text-white disabled:opacity-50"
              >
                Criar Grupo
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 mb-6 flex gap-3">
              <button
                onClick={() => setIsCreatingGroup(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-4 text-sm font-bold text-white shadow-lg active:scale-95"
              >
                <Users className="h-4 w-4" />
                Novo Grupo
              </button>
            </div>

            {searchResults.length === 0 && searchQuery.trim() && !loading && (
              <div className="px-4 mb-8">
                <div className="rounded-3xl bg-zinc-50 p-6 text-center border border-zinc-100">
                  <UserPlus className="mx-auto mb-4 h-12 w-12 text-zinc-200" />
                  <p className="text-sm font-semibold text-zinc-900 mb-1">Usuário não encontrado</p>
                  <p className="text-xs text-zinc-500 mb-6">Este contato ainda não usa o OffGrid Link.</p>
                  <button
                    onClick={handleInviteSMS}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white border border-zinc-200 py-3 text-sm font-bold text-zinc-900 shadow-sm active:scale-95"
                  >
                    <Share2 className="h-4 w-4" />
                    Convidar via SMS
                  </button>
                </div>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="mb-8">
                <h3 className="px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Resultados</h3>
                {searchResults.map(result => (
                  <div key={`search-${result.uid}`} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400">
                        <UserIcon />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {result.name} {result.uid === user?.uid && '(você)'}
                        </p>
                        <p className="text-xs text-zinc-500">{result.email || result.phoneNumber}</p>
                      </div>
                    </div>
                    {result.uid !== user?.uid && !user?.contacts.includes(result.uid) && (
                      <button 
                        onClick={() => addContact(result)}
                        className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-bold text-white"
                      >
                        Adicionar
                      </button>
                    )}
                    {(result.uid === user?.uid || user?.contacts.includes(result.uid)) && (
                      <button 
                        onClick={() => startChat(result)}
                        className="rounded-full bg-zinc-100 px-4 py-1.5 text-xs font-bold text-zinc-900"
                      >
                        Conversar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h3 className="px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Meus Contatos</h3>
            {myContacts.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-400">
                Nenhum contato salvo.
              </div>
            ) : (
              myContacts.map(contact => (
                <button
                  key={`contact-${contact.uid}`}
                  onClick={() => startChat(contact)}
                  className="flex w-full items-center gap-4 p-4 transition-colors hover:bg-zinc-50"
                >
                  <div className="h-12 w-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400">
                    {contact.photoURL ? <img src={contact.photoURL} className="h-full w-full rounded-2xl" /> : <UserIcon />}
                  </div>
                  <div className="flex flex-col items-start">
                    <p className="text-sm font-semibold">{contact.name}</p>
                    <p className="text-xs text-zinc-500">{contact.status === 'online' ? 'Online' : 'Offline'}</p>
                  </div>
                </button>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
