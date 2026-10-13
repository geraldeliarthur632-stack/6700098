import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  onSnapshot, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc, 
  updateDoc, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { User, Conversation, Message, ConnectionStatus } from './types';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { ProfileSetup } from './components/ProfileSetup';
import { ChatList } from './components/ChatList';
import { ChatRoom } from './components/ChatRoom';
import { ContactList } from './components/ContactList';
import { Connections } from './components/Connections';
import { Settings } from './components/Settings';
import { StatusList } from './components/StatusList';
import { StatusView } from './components/StatusView';
import NewGroup from './components/NewGroup';
import { PermissionsModal } from './components/PermissionsModal';
import { LoginBackupPromptModal } from './components/LoginBackupPromptModal';
import { backupService, AccountBackupInfo } from './services/backupService';
import { meshNetwork } from './services/meshNetwork';
import { audioStorage } from './services/audioStorage';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  toggleArchiveConversation: (conversationId: string) => Promise<boolean>;
  connectionStatus: ConnectionStatus;
  setConnectionStatus: React.Dispatch<React.SetStateAction<ConnectionStatus>>;
  openPermissionsModal: () => void;
  syncOfflineMessagesNow: () => Promise<number>;
  checkBackupForAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  // Estado de verificação de backup no login
  const [backupPromptState, setBackupPromptState] = useState<{
    isOpen: boolean;
    info: AccountBackupInfo;
    userUid: string;
    userName?: string;
  } | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    internet: typeof navigator !== 'undefined' ? navigator.onLine : true,
    bluetooth: true,
    wifiDirect: true,
    ultrasound: true,
    opticalQR: true,
    localLan: true,
    meshRelay: true,
  });

  const syncOfflineMessagesNow = async (): Promise<number> => {
    if (!user) return 0;
    const msgSynced = await meshNetwork.flushOutboxToServer(user.uid);
    const audioSynced = await audioStorage.syncPendingAudios(user.uid);
    return msgSynced + audioSynced;
  };

  // Função para verificar se a conta tem backup salvo
  const verifyAccountBackup = async (uid: string, name?: string) => {
    try {
      const backupInfo = await backupService.checkAccountBackup(uid);
      if (backupInfo.hasBackup) {
        const alreadyPrompted = sessionStorage.getItem(`offgrid_backup_prompt_dismissed_${uid}`);
        if (!alreadyPrompted) {
          setBackupPromptState({
            isOpen: true,
            info: backupInfo,
            userUid: uid,
            userName: name
          });
        }
      }
    } catch (err) {
      console.warn('Aviso ao checar backup no login:', err);
    }
  };

  useEffect(() => {
    const handleOnline = async () => {
      setConnectionStatus(prev => ({ ...prev, internet: true }));
      if (user) {
        try {
          await updateDoc(doc(db, 'users', user.uid), { status: 'online', lastSeen: Date.now() });
        } catch {}
        const synced = await meshNetwork.flushOutboxToServer(user.uid);
        const syncedAudios = await audioStorage.syncPendingAudios(user.uid);
        if (synced > 0 || syncedAudios > 0) {
          console.log(`Auto-synced ${synced} messages and ${syncedAudios} offline voice notes to Firestore server.`);
        }
      }
    };

    const handleOffline = () => {
      setConnectionStatus(prev => ({ ...prev, internet: false }));
      if (user) {
        updateDoc(doc(db, 'users', user.uid), { status: 'offline', lastSeen: Date.now() }).catch(() => {});
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  useEffect(() => {
    let userUnsub: (() => void) | null = null;

    const unsubscribe = auth.onAuthStateChanged(async (fUser) => {
      setFirebaseUser(fUser);
      if (userUnsub) {
        userUnsub();
        userUnsub = null;
      }

      if (fUser) {
        const userRef = doc(db, 'users', fUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            // Se usuário novo no Google ou Email: cria registro inicial mas direciona para confirmação de Nome e Foto
            const publicKey = btoa(Math.random().toString(36).substring(2) + Date.now());
            const newUser: User = {
              uid: fUser.uid,
              name: fUser.displayName || '',
              photoURL: fUser.photoURL || null,
              email: fUser.email || null,
              phoneNumber: fUser.phoneNumber || null,
              contacts: [],
              status: 'online',
              lastSeen: Date.now(),
              isTyping: false,
              bio: 'Conectado via OffGrid',
              publicKey,
              role: 'user',
              permissionsConfigured: false,
              profileCompleted: false, // Força pedir nome e foto
              archivedConversations: []
            };
            await setDoc(userRef, newUser);
            await setDoc(doc(db, 'users_public', fUser.uid), {
              uid: newUser.uid,
              name: newUser.name,
              photoURL: newUser.photoURL,
              status: newUser.status,
              lastSeen: newUser.lastSeen,
              isTyping: false,
              publicKey: newUser.publicKey
            });
            if (newUser.email) {
              await setDoc(doc(db, 'users_search', newUser.email), { uid: newUser.uid });
            }
            setUser(newUser);
            setNeedsOnboarding(true); // Pede nome e foto sempre que terminar de logar novo usuário

            // Verificar se a conta já possui backup no banco de dados para restaurar
            verifyAccountBackup(fUser.uid, newUser.name);
          } else {
            const userData = userSnap.data() as User;
            setUser(userData);
            
            // Pede nome e foto se o perfil ainda não tiver sido concluído ou se não tiver nome completo
            const reqOnboarding = !userData.profileCompleted || !userData.name || userData.name === 'Anonymous' || userData.name.trim().split(/\s+/).length < 2;
            setNeedsOnboarding(reqOnboarding);
            
            // Garantir que permissões configuradas sejam sincronizadas entre dispositivos
            if (userData.permissionsConfigured) {
              localStorage.setItem('offgrid_permissions_configured', 'true');
            }

            const configured = localStorage.getItem('offgrid_permissions_configured') === 'true';
            if (!reqOnboarding && !configured && !userData.permissionsConfigured) {
              setShowPermissionsModal(true);
            }

            // Atualizar status online
            await updateDoc(userRef, { status: 'online', lastSeen: Date.now(), isTyping: false });
            
            // Sincronizar fila offline
            if (navigator.onLine) {
              meshNetwork.flushOutboxToServer(userData.uid).catch(console.warn);
            }

            // Verificar se esta conta tem backup salvo no banco de dados ou local
            verifyAccountBackup(fUser.uid, userData.name);
          }

          // Subscrever para atualizações em tempo real do perfil para manter tudo idêntico
          userUnsub = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
              const freshData = snapshot.data() as User;
              setUser(freshData);
              if (freshData.name && freshData.name !== 'Anonymous') {
                setNeedsOnboarding(false);
              }
              if (freshData.permissionsConfigured) {
                localStorage.setItem('offgrid_permissions_configured', 'true');
              }
            }
          }, (err) => {
            console.warn('Snapshot de usuário offline/aviso:', err);
          });

        } catch (error) {
          console.error('Error fetching user data on auth change:', error);
          setNeedsOnboarding(true);
          setUser(null);
        }
      } else {
        setUser(null);
        setNeedsOnboarding(false);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (userUnsub) userUnsub();
    };
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.warn('Sign in notice:', error?.code || error?.message);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      console.warn('Sign in with email notice:', error?.code || error?.message);
      throw error;
    }
  };

  const signUpWithEmail = async (name: string, email: string, password: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (cred.user) {
        const userRef = doc(db, 'users', cred.user.uid);
        const publicRef = doc(db, 'users_public', cred.user.uid);
        const publicKey = btoa(Math.random().toString(36).substring(2) + Date.now());
        
        const newUser: User = {
          uid: cred.user.uid,
          name: name.trim() || 'Usuário OffGrid',
          photoURL: null,
          email: cred.user.email || email.trim(),
          phoneNumber: null,
          contacts: [],
          status: 'online',
          lastSeen: Date.now(),
          isTyping: false,
          bio: 'Conectado via OffGrid',
          publicKey,
          role: 'user',
          permissionsConfigured: false,
          profileCompleted: false,
          archivedConversations: []
        };

        await setDoc(userRef, newUser);
        await setDoc(publicRef, {
          uid: newUser.uid,
          name: newUser.name,
          photoURL: newUser.photoURL,
          status: newUser.status,
          lastSeen: newUser.lastSeen,
          isTyping: false,
          publicKey: newUser.publicKey
        });

        if (newUser.email) {
          await setDoc(doc(db, 'users_search', newUser.email), { uid: newUser.uid });
        }

        setUser(newUser);
        setNeedsOnboarding(true); // Redireciona para confirmação de nome e escolha de foto

        // Verificar se há backup prévio associado
        verifyAccountBackup(cred.user.uid, newUser.name);
      }
    } catch (error: any) {
      if (error?.code === 'auth/email-already-in-use') {
        // Tentar autenticar diretamente caso a senha já coincida com a conta existente
        try {
          const signInCred = await signInWithEmailAndPassword(auth, email.trim(), password);
          if (signInCred.user) {
            return;
          }
        } catch {
          // Senha não coincide ou login falhou, repassar o erro normalmente sem poluir logs
        }
      }
      console.warn('Sign up with email notice:', error?.code || error?.message);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!firebaseUser) return;
    const userRef = doc(db, 'users', firebaseUser.uid);
    const publicRef = doc(db, 'users_public', firebaseUser.uid);
    const userSnap = await getDoc(userRef);
    
    const publicData = {
      uid: firebaseUser.uid,
      name: data.name || (userSnap.exists() ? userSnap.data().name : (firebaseUser.displayName || 'Anonymous')),
      photoURL: data.photoURL || (userSnap.exists() ? userSnap.data().photoURL : (firebaseUser.photoURL || null)),
      status: data.status || (userSnap.exists() ? userSnap.data().status : 'online'),
      lastSeen: data.lastSeen || (userSnap.exists() ? userSnap.data().lastSeen : Date.now()),
      isTyping: data.isTyping || (userSnap.exists() ? userSnap.data().isTyping : false),
      publicKey: data.publicKey || (userSnap.exists() ? userSnap.data().publicKey : null)
    };

    if (!userSnap.exists()) {
      const publicKey = btoa(Math.random().toString(36).substring(2) + Date.now());
      
      const newUser: User = {
        uid: firebaseUser.uid,
        name: data.name || firebaseUser.displayName || 'Anonymous',
        photoURL: data.photoURL || firebaseUser.photoURL || null,
        email: firebaseUser.email || null,
        phoneNumber: firebaseUser.phoneNumber || null,
        contacts: [],
        status: 'online',
        lastSeen: Date.now(),
        isTyping: false,
        bio: data.bio || '',
        password: data.password || '',
        publicKey,
        role: 'user',
        permissionsConfigured: true,
        archivedConversations: []
      };
      await setDoc(userRef, newUser);
      await setDoc(publicRef, publicData);

      if (newUser.email) {
        await setDoc(doc(db, 'users_search', newUser.email), { uid: newUser.uid });
      }
      if (newUser.phoneNumber) {
        await setDoc(doc(db, 'users_search', newUser.phoneNumber), { uid: newUser.uid });
      }

      setUser(newUser);
    } else {
      await updateDoc(userRef, data);
      await updateDoc(publicRef, publicData);

      if (data.email) {
        await setDoc(doc(db, 'users_search', data.email), { uid: firebaseUser.uid });
      }
      if (data.phoneNumber) {
        await setDoc(doc(db, 'users_search', data.phoneNumber), { uid: firebaseUser.uid });
      }

      setUser(prev => prev ? { ...prev, ...data } : null);
    }

    setNeedsOnboarding(false);
    
    // Abrir modal de permissões imediatamente após a conclusão do perfil
    if (data.profileCompleted) {
      setShowPermissionsModal(true);
    } else {
      const configured = localStorage.getItem('offgrid_permissions_configured') === 'true';
      if (!configured) {
        setShowPermissionsModal(true);
      }
    }
  };

  const toggleArchiveConversation = async (conversationId: string): Promise<boolean> => {
    if (!user || !firebaseUser) return false;
    const currentArchived = user.archivedConversations || [];
    const isArchived = currentArchived.includes(conversationId);
    const updated = isArchived 
      ? currentArchived.filter(id => id !== conversationId)
      : [...currentArchived, conversationId];
    
    setUser(prev => prev ? { ...prev, archivedConversations: updated } : null);

    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userRef, { archivedConversations: updated });
      
      const convRef = doc(db, 'conversations', conversationId);
      const convSnap = await getDoc(convRef);
      if (convSnap.exists()) {
        const convData = convSnap.data() as Conversation;
        const currentBy = convData.archivedBy || [];
        const updatedBy = isArchived 
          ? currentBy.filter(id => id !== firebaseUser.uid)
          : Array.from(new Set([...currentBy, firebaseUser.uid]));
        await updateDoc(convRef, { archivedBy: updatedBy });
      }
      return !isArchived;
    } catch (err) {
      console.warn('Erro ao alternar arquivamento:', err);
      return isArchived;
    }
  };

  const logout = async () => {
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { status: 'offline', lastSeen: Date.now() });
      } catch {}
      // Limpar flags de sessão para que o próximo login volte a checar backup limpo
      sessionStorage.removeItem(`offgrid_backup_prompt_dismissed_${user.uid}`);
    }
    await signOut(auth);
  };

  useEffect(() => {
    if (!user) return;

    // Listen for new messages across all conversations for notifications
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const conv = change.doc.data() as Conversation;
          const lastMsg = conv.lastMessage;
          
          if (lastMsg && lastMsg.senderId !== user.uid && !lastMsg.seen) {
            const isInChat = window.location.pathname === `/chat/${conv.id}`;
            
            if (!isInChat && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('Nova mensagem (OffGrid)', {
                  body: lastMsg.text,
                  icon: '/icon.svg'
                });
              } catch {}
            }
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations/notifications');
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#00a884]" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      firebaseUser, 
      loading, 
      signIn, 
      signInWithEmail,
      signUpWithEmail,
      resetPassword,
      logout, 
      updateProfile, 
      toggleArchiveConversation,
      connectionStatus, 
      setConnectionStatus,
      openPermissionsModal: () => setShowPermissionsModal(true),
      syncOfflineMessagesNow,
      checkBackupForAccount: async () => {
        if (user) await verifyAccountBackup(user.uid, user.name);
      }
    }}>
      <Router>
        <Routes>
          <Route path="/login" element={!firebaseUser ? <Login /> : (needsOnboarding ? <ProfileSetup /> : <Navigate to="/" />)} />
          <Route path="/" element={firebaseUser ? (needsOnboarding ? <ProfileSetup /> : <Layout />) : <Navigate to="/login" />}>
            <Route index element={<ChatList />} />
            <Route path="chat/:conversationId" element={<ChatRoom />} />
            <Route path="contacts" element={<ContactList />} />
            <Route path="connections" element={<Connections />} />
            <Route path="settings" element={<Settings />} />
            <Route path="status" element={<StatusList />} />
            <Route path="status/:uid" element={<StatusView />} />
            <Route path="new-group" element={<NewGroup />} />
          </Route>
        </Routes>

        <PermissionsModal
          isOpen={showPermissionsModal}
          onClose={() => setShowPermissionsModal(false)}
          isMandatoryInitial={true}
        />

        {/* Modal de Verificação de Backup no Login */}
        {backupPromptState && backupPromptState.isOpen && (
          <LoginBackupPromptModal
            isOpen={backupPromptState.isOpen}
            backupInfo={backupPromptState.info}
            userUid={backupPromptState.userUid}
            userName={backupPromptState.userName}
            onClose={() => {
              sessionStorage.setItem(`offgrid_backup_prompt_dismissed_${backupPromptState.userUid}`, 'true');
              setBackupPromptState(prev => prev ? { ...prev, isOpen: false } : null);
            }}
            onRestored={() => {
              sessionStorage.setItem(`offgrid_backup_prompt_dismissed_${backupPromptState.userUid}`, 'true');
              setBackupPromptState(prev => prev ? { ...prev, isOpen: false } : null);
              // Recarregar estado se necessário
              if (user) {
                getDoc(doc(db, 'users', user.uid)).then(snap => {
                  if (snap.exists()) setUser(snap.data() as User);
                }).catch(() => {});
              }
            }}
          />
        )}
      </Router>
    </AuthContext.Provider>
  );
}
