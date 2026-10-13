import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../App';
import { db, collection, query, where, onSnapshot, orderBy, addDoc, doc, updateDoc, arrayUnion, handleFirestoreError, OperationType } from '../firebase';
import { Status, User } from '../types';
import { Plus, Camera, Search, MoreVertical, ChevronRight, Loader2, X, Send, Edit2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { ref, uploadBytes, getDownloadURL, storage } from '../firebase';

export function StatusList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myStatuses, setMyStatuses] = useState<Status[]>([]);
  const [contactsStatuses, setContactsStatuses] = useState<{ [uid: string]: Status[] }>({});
  const [contacts, setContacts] = useState<{ [uid: string]: User }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showStatusType, setShowStatusType] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Fetch my statuses
    const myQ = query(
      collection(db, 'status'),
      where('uid', '==', user.uid),
      where('expiresAt', '>', Date.now()),
      orderBy('createdAt', 'desc')
    );

    const unsubMy = onSnapshot(myQ, (snap) => {
      setMyStatuses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Status)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'status/my');
    });

    // Fetch contacts' statuses
    if (user.contacts.length > 0) {
      const contactsQ = query(
        collection(db, 'status'),
        where('uid', 'in', user.contacts),
        where('expiresAt', '>', Date.now()),
        orderBy('createdAt', 'desc')
      );

      const unsubContacts = onSnapshot(contactsQ, (snap) => {
        const grouped: { [uid: string]: Status[] } = {};
        snap.docs.forEach(d => {
          const s = { id: d.id, ...d.data() } as Status;
          if (!grouped[s.uid]) grouped[s.uid] = [];
          grouped[s.uid].push(s);
        });
        setContactsStatuses(grouped);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'status/contacts');
      });

      // Fetch contacts info
      const usersQ = query(collection(db, 'users_public'), where('uid', 'in', user.contacts));
      const unsubUsers = onSnapshot(usersQ, (snap) => {
        const info: { [uid: string]: User } = {};
        snap.docs.forEach(d => {
          const u = d.data() as User;
          info[u.uid] = u;
        });
        setContacts(info);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users_public/contacts');
      });

      return () => {
        unsubMy();
        unsubContacts();
        unsubUsers();
      };
    }

    return () => unsubMy();
  }, [user]);

  const handleCreateStatus = async () => {
    if (!user) return;
    const text = prompt('O que você está pensando?');
    if (!text) return;

    await addDoc(collection(db, 'status'), {
      uid: user.uid,
      userName: user.name,
      userPhoto: user.photoURL,
      content: text,
      type: 'text',
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      seenBy: []
    });
  };

  const handleImageStatus = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `status/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      await addDoc(collection(db, 'status'), {
        uid: user.uid,
        userName: user.name,
        userPhoto: user.photoURL,
        content: downloadURL,
        type: 'image',
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        seenBy: []
      });
      setShowStatusType(false);
    } catch (error) {
      console.error('Error uploading status image:', error);
      alert('Erro ao postar status.');
    } finally {
      setUploading(false);
    }
  };

  const filteredContactsStatuses = Object.entries(contactsStatuses).filter(([uid, statuses]) => {
    const contact = contacts[uid];
    if (!contact) return false;
    if (!searchQuery.trim()) return true;
    return contact.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      <header className="px-6 py-8 bg-white border-b border-zinc-100">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold tracking-tight">Status</h1>
          <div className="flex gap-4">
            <button 
              onClick={() => setIsSearching(!isSearching)}
              className="p-2 rounded-full hover:bg-zinc-100"
            >
              <Search className="h-5 w-5 text-zinc-500" />
            </button>
            <button className="p-2 rounded-full hover:bg-zinc-100">
              <MoreVertical className="h-5 w-5 text-zinc-500" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isSearching && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar contatos..."
                  className="w-full rounded-2xl bg-zinc-100 py-3 pl-10 pr-4 text-sm focus:outline-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* My Status */}
        <div className="p-4">
          <div className="flex items-center gap-4 p-2 rounded-2xl hover:bg-white transition-all cursor-pointer group relative">
            <div className="relative" onClick={() => myStatuses.length > 0 && navigate(`/status/${user?.uid}`)}>
              <div className={cn(
                "h-14 w-14 rounded-full p-0.5",
                myStatuses.length > 0 ? "bg-zinc-900" : "bg-zinc-100"
              )}>
                <img
                  src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`}
                  alt="My Status"
                  className="h-full w-full rounded-full object-cover border-2 border-white"
                  referrerPolicy="no-referrer"
                />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowStatusType(!showStatusType); }}
                className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-zinc-900 text-white flex items-center justify-center border-2 border-white"
              >
                {showStatusType ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              </button>
            </div>
            <div className="flex-1" onClick={() => myStatuses.length > 0 && navigate(`/status/${user?.uid}`)}>
              <h3 className="font-bold">Meu Status</h3>
              <p className="text-xs text-zinc-500">
                {myStatuses.length > 0 
                  ? `Há ${formatDistanceToNow(myStatuses[0].createdAt, { locale: ptBR })}`
                  : 'Toque para adicionar uma atualização'}
              </p>
            </div>

            <AnimatePresence>
              {showStatusType && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute right-4 flex gap-2"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageStatus} 
                    className="hidden" 
                    accept="image/*"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-5 w-5" />}
                  </button>
                  <button 
                    onClick={handleCreateStatus}
                    className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 hover:bg-zinc-200"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Recent Updates */}
        <div className="px-6 py-2">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-4">Atualizações Recentes</h2>
          <div className="space-y-4">
            {filteredContactsStatuses.map(([uid, statuses]) => {
              const contact = contacts[uid];
              if (!contact) return null;
              const lastStatus = statuses[0];
              const allSeen = statuses.every(s => s.seenBy.includes(user?.uid || ''));

              return (
                <div 
                  key={uid}
                  onClick={() => navigate(`/status/${uid}`)}
                  className="flex items-center gap-4 p-2 rounded-2xl hover:bg-white transition-all cursor-pointer"
                >
                  <div className={cn(
                    "h-14 w-14 rounded-full p-0.5",
                    allSeen ? "bg-zinc-200" : "bg-zinc-900"
                  )}>
                    <img
                      src={contact.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.uid}`}
                      alt={contact.name}
                      className="h-full w-full rounded-full object-cover border-2 border-white"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{contact.name}</h3>
                    <p className="text-xs text-zinc-500">
                      Há {formatDistanceToNow(lastStatus.createdAt, { locale: ptBR })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-300" />
                </div>
              );
            })}

            {filteredContactsStatuses.length === 0 && (
              <div className="text-center py-12">
                <Camera className="h-12 w-12 text-zinc-200 mx-auto mb-4" />
                <p className="text-sm text-zinc-400">Nenhuma atualização de status</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
