import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, query, where, onSnapshot, orderBy, doc, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../App';
import { Conversation, User } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Search, 
  Plus, 
  User as UserIcon, 
  Users, 
  ShieldCheck, 
  MessageSquare, 
  Globe, 
  Zap, 
  Wifi, 
  WifiOff, 
  Mic, 
  Laptop,
  Archive,
  ArchiveRestore,
  X,
  ChevronRight,
  ArrowLeft,
  CheckCheck,
  Check
} from 'lucide-react';
import { LinkedDevicesModal } from './LinkedDevicesModal';
import { PWAInstallButton } from './PWAInstallButton';

export function ChatList() {
  const { user, connectionStatus, toggleArchiveConversation } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [participantInfo, setParticipantInfo] = useState<Record<string, User>>({});
  const [showLinkedDevices, setShowLinkedDevices] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map(doc => ({
        ...(doc.data() as Conversation),
        id: doc.id
      }));
      setConversations(convs);

      // Buscar informações públicas dos participantes
      convs.forEach(conv => {
        const otherId = conv.participants.find(p => p !== user.uid) || user.uid;
        if (otherId && !participantInfo[otherId]) {
          onSnapshot(doc(db, 'users_public', otherId), (snap) => {
            if (snap.exists()) {
              setParticipantInfo(prev => ({ ...prev, [otherId]: snap.data() as User }));
            }
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `users_public/${otherId}`);
          });
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations');
    });

    return () => unsubscribe();
  }, [user]);

  // Lista de IDs arquivados para o usuário atual
  const archivedIds = useMemo(() => {
    const fromUser = user?.archivedConversations || [];
    return new Set(fromUser);
  }, [user?.archivedConversations]);

  // Conversas ativas vs arquivadas
  const activeConversations = useMemo(() => {
    return conversations.filter(c => {
      const isArchived = archivedIds.has(c.id) || (c.archivedBy && user?.uid && c.archivedBy.includes(user.uid));
      return !isArchived;
    });
  }, [conversations, archivedIds, user?.uid]);

  const archivedConversations = useMemo(() => {
    return conversations.filter(c => {
      const isArchived = archivedIds.has(c.id) || (c.archivedBy && user?.uid && c.archivedBy.includes(user.uid));
      return isArchived;
    });
  }, [conversations, archivedIds, user?.uid]);

  // Filtragem pela barra de pesquisa por nome do contato ou grupo
  const displayedConversations = useMemo(() => {
    const baseList = viewMode === 'archived' ? archivedConversations : activeConversations;
    const term = searchQuery.trim().toLowerCase();
    if (!term) return baseList;

    return baseList.filter(conv => {
      if (conv.isGroup && conv.groupName?.toLowerCase().includes(term)) {
        return true;
      }
      const otherId = conv.participants.find(p => p !== user?.uid) || user?.uid;
      const otherUser = otherId ? participantInfo[otherId] : null;
      if (otherUser?.name?.toLowerCase().includes(term)) return true;
      if (otherUser?.email?.toLowerCase().includes(term)) return true;
      if (otherUser?.bio?.toLowerCase().includes(term)) return true;
      if (conv.lastMessage?.text?.toLowerCase().includes(term)) return true;
      return false;
    });
  }, [viewMode, activeConversations, archivedConversations, searchQuery, user?.uid, participantInfo]);

  const handleToggleArchive = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    await toggleArchiveConversation(convId);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="px-6 pt-6 pb-4">
        {/* Top App Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {viewMode === 'archived' && (
                <button
                  type="button"
                  onClick={() => setViewMode('active')}
                  className="mr-1 -ml-2 rounded-full p-2 text-zinc-600 hover:bg-zinc-100 transition"
                  title="Voltar para todas as conversas"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                {viewMode === 'archived' ? 'Arquivadas' : 'Conversas'}
              </h1>
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => navigate('/connections')}
                className="flex items-center gap-1.5 transition hover:opacity-80"
                title="Configurar conexões offline e mesh"
              >
                {connectionStatus.internet ? (
                  <span className="flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider border border-emerald-500/20">
                    <Wifi className="h-3 w-3 text-emerald-600" />
                    Online com Wi-Fi
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-md bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider border border-amber-500/30 animate-pulse">
                    <WifiOff className="h-3 w-3 text-amber-600" />
                    Offline (Rede Mesh)
                  </span>
                )}
                {connectionStatus.wifiDirect && (
                  <span className="text-[10px] text-blue-500 font-bold hidden sm:inline">
                    • Wi-Fi Direct
                  </span>
                )}
                {connectionStatus.bluetooth && (
                  <span className="text-[10px] text-indigo-500 font-bold hidden sm:inline">
                    • Bluetooth
                  </span>
                )}
                {connectionStatus.ultrasound && (
                  <span className="text-[10px] text-purple-500 font-bold hidden sm:inline">
                    • Ultrassom
                  </span>
                )}
                {connectionStatus.opticalQR && (
                  <span className="text-[10px] text-teal-600 font-bold hidden sm:inline">
                    • QR Óptico
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton variant="icon" />
            <button 
              onClick={() => setShowLinkedDevices(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition-colors hover:bg-zinc-200"
              title="Aparelhos Conectados (WhatsApp Web)"
            >
              <Laptop className="h-5 w-5" />
            </button>
            <button 
              onClick={() => navigate('/new-group')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition-colors hover:bg-zinc-200"
              title="Novo Grupo"
            >
              <Users className="h-5 w-5" />
            </button>
            <button 
              onClick={() => navigate('/contacts')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition-colors hover:bg-zinc-200"
              title="Novo Contato"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Barra de Pesquisa */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={viewMode === 'archived' ? "Buscar nas arquivadas..." : "Buscar conversas por nome..."}
            className="w-full rounded-2xl bg-zinc-100 py-3 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]/40 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 transition"
              title="Limpar pesquisa"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-2">
        {/* Pasta / Barra de Arquivadas quando no modo principal */}
        {viewMode === 'active' && archivedConversations.length > 0 && !searchQuery && (
          <button
            type="button"
            onClick={() => setViewMode('archived')}
            className="flex w-full items-center justify-between px-4 py-3 mb-1 rounded-2xl hover:bg-zinc-50 transition border-b border-zinc-100 group"
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-[#00a884] group-hover:bg-[#00a884]/10 transition">
                <Archive className="h-5 w-5" />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold text-zinc-900 block">Arquivadas</span>
                <span className="text-[11px] text-zinc-400 block">Conversas ocultas da tela principal</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-bold">
                {archivedConversations.length}
              </span>
              <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:translate-x-0.5 transition" />
            </div>
          </button>
        )}

        {/* Dica no modo arquivado */}
        {viewMode === 'archived' && (
          <div className="mx-2 mb-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200/60 text-xs text-zinc-500 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Archive className="h-4 w-4 text-[#00a884] shrink-0" />
              <span>Estas conversas estão arquivadas e salvas na sua conta. Toque no ícone para desarquivar.</span>
            </div>
            <button
              onClick={() => setViewMode('active')}
              className="text-[#00a884] font-bold shrink-0 hover:underline ml-2"
            >
              Voltar
            </button>
          </div>
        )}

        {displayedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            {searchQuery ? (
              <>
                <Search className="mb-3 h-10 w-10 opacity-30 text-zinc-400" />
                <p className="text-sm font-medium text-zinc-600">Nenhuma conversa encontrada para &quot;{searchQuery}&quot;.</p>
                <button 
                  onClick={() => setSearchQuery('')}
                  className="mt-3 text-xs font-bold text-[#00a884] hover:underline"
                >
                  Limpar pesquisa
                </button>
              </>
            ) : viewMode === 'archived' ? (
              <>
                <Archive className="mb-3 h-10 w-10 opacity-30 text-zinc-400" />
                <p className="text-sm">Nenhuma conversa arquivada.</p>
                <button 
                  onClick={() => setViewMode('active')}
                  className="mt-3 text-xs font-bold text-[#00a884] hover:underline"
                >
                  Voltar para conversas ativas
                </button>
              </>
            ) : (
              <>
                <MessageSquare className="mb-4 h-12 w-12 opacity-20" />
                <p className="text-sm">Nenhuma conversa ainda.</p>
                <button 
                  onClick={() => navigate('/contacts')}
                  className="mt-4 text-sm font-semibold text-zinc-900 underline underline-offset-4"
                >
                  Adicionar Contato
                </button>
              </>
            )}
          </div>
        ) : (
          displayedConversations.map((conv) => {
            const otherId = conv.participants.find(p => p !== user?.uid) || user?.uid;
            const otherUser = otherId ? participantInfo[otherId] : null;
            const isConvArchived = archivedIds.has(conv.id) || (conv.archivedBy && user?.uid && conv.archivedBy.includes(user.uid));
            const lastMsg = conv.lastMessage;
            const isLastMsgMe = lastMsg?.senderId === user?.uid;

            return (
              <div
                key={conv.id}
                onClick={() => navigate(`/chat/${conv.id}`)}
                className="group relative flex w-full items-center gap-3.5 rounded-3xl p-3.5 transition-colors hover:bg-zinc-50 active:bg-zinc-100 cursor-pointer"
              >
                <div className="relative h-13 w-13 flex-shrink-0">
                  {conv.isGroup ? (
                    <div className="flex h-full w-full items-center justify-center rounded-2xl bg-zinc-900 text-white">
                      <Users className="h-6 w-6" />
                    </div>
                  ) : otherUser?.photoURL ? (
                    <img
                      src={otherUser.photoURL}
                      alt={otherUser.name}
                      className="h-full w-full rounded-2xl object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
                      <UserIcon className="h-6 w-6" />
                    </div>
                  )}
                  {!conv.isGroup && otherUser?.status === 'online' && otherId !== user?.uid && (
                    <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500" />
                  )}
                </div>

                <div className="flex flex-1 flex-col items-start overflow-hidden min-w-0 pr-8">
                  <div className="flex w-full items-center justify-between">
                    <span className="truncate font-semibold text-zinc-900 text-sm">
                      {conv.isGroup ? conv.groupName : (otherUser?.name || 'Carregando...')}
                      {!conv.isGroup && otherId === user?.uid && ' (você)'}
                    </span>
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider ml-2 shrink-0">
                      {formatDistanceToNow(conv.updatedAt, { locale: ptBR })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 w-full mt-0.5">
                    {/* Indicador de check da última mensagem se enviada por mim */}
                    {isLastMsgMe && lastMsg && (
                      <span className="shrink-0">
                        {lastMsg.seen || lastMsg.status === 'read' ? (
                          <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] stroke-[2.5]" />
                        ) : lastMsg.delivered || lastMsg.status === 'delivered' ? (
                          <CheckCheck className="h-3.5 w-3.5 text-zinc-400 stroke-[2]" />
                        ) : (
                          <Check className="h-3.5 w-3.5 text-zinc-400 stroke-[2]" />
                        )}
                      </span>
                    )}

                    <p className="truncate text-xs text-zinc-500 flex-1">
                      {lastMsg?.isEncrypted ? (
                        '🔒 Mensagem criptografada'
                      ) : lastMsg?.type === 'audio' ? (
                        '🎤 Áudio'
                      ) : lastMsg?.type === 'image' ? (
                        '📷 Imagem'
                      ) : lastMsg?.type === 'video' ? (
                        '🎥 Vídeo'
                      ) : lastMsg?.type === 'file' ? (
                        '📎 Arquivo'
                      ) : (
                        lastMsg?.text || 'Inicie uma conversa'
                      )}
                    </p>
                  </div>
                </div>

                {/* Botão de Arquivar / Desarquivar */}
                <button
                  type="button"
                  onClick={(e) => handleToggleArchive(e, conv.id)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-zinc-400 opacity-60 hover:opacity-100 hover:bg-zinc-200/80 hover:text-zinc-700 transition"
                  title={isConvArchived ? "Desarquivar conversa" : "Arquivar conversa"}
                >
                  {isConvArchived ? (
                    <ArchiveRestore className="h-4 w-4 text-[#00a884]" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      <LinkedDevicesModal 
        isOpen={showLinkedDevices} 
        onClose={() => setShowLinkedDevices(false)} 
      />
    </div>
  );
}
