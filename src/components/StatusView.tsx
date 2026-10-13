import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { db, collection, query, where, onSnapshot, orderBy, doc, updateDoc, arrayUnion, handleFirestoreError, OperationType } from '../firebase';
import { Status, User } from '../types';
import { X, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

export function StatusView() {
  const { uid } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, 'status'),
      where('uid', '==', uid),
      where('expiresAt', '>', Date.now()),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const s = snap.docs.map(d => ({ id: d.id, ...d.data() } as Status));
      setStatuses(s);
      setLoading(false);
      if (s.length === 0) navigate('/status');
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `status/${uid}`);
    });

    return () => unsubscribe();
  }, [uid, navigate]);

  useEffect(() => {
    if (statuses.length === 0) return;

    const currentStatus = statuses[currentIndex];
    if (user && !currentStatus.seenBy.includes(user.uid)) {
      updateDoc(doc(db, 'status', currentStatus.id), {
        seenBy: arrayUnion(user.uid)
      });
    }

    setProgress(0);
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          if (currentIndex < statuses.length - 1) {
            setCurrentIndex(prevIdx => prevIdx + 1);
            return 0;
          } else {
            navigate('/status');
            return 100;
          }
        }
        return prev + 1;
      });
    }, 50); // 5 seconds total (100 * 50ms)

    return () => clearInterval(timer);
  }, [currentIndex, statuses, user, navigate]);

  const handleNext = () => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      navigate('/status');
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (loading || statuses.length === 0) return null;

  const currentStatus = statuses[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white select-none">
      {/* Progress Bars */}
      <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
        {statuses.map((_, idx) => (
          <div key={idx} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-50 linear"
              style={{ 
                width: idx < currentIndex ? '100%' : (idx === currentIndex ? `${progress}%` : '0%') 
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="absolute top-8 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/status')} className="p-1">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <img
            src={currentStatus.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentStatus.uid}`}
            alt={currentStatus.userName}
            className="h-10 w-10 rounded-full border border-white/20"
            referrerPolicy="no-referrer"
          />
          <div>
            <h3 className="font-bold text-sm">{currentStatus.userName}</h3>
            <p className="text-[10px] text-white/60 uppercase tracking-widest">
              {formatDistanceToNow(currentStatus.createdAt, { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <button className="p-1">
            <MoreVertical className="h-5 w-5" />
          </button>
          <button onClick={() => navigate('/status')} className="p-1">
            <X className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-8 relative">
        <div className="absolute inset-y-0 left-0 w-1/3 z-20" onClick={handlePrev} />
        <div className="absolute inset-y-0 right-0 w-1/3 z-20" onClick={handleNext} />
        
        <div className="max-w-md w-full text-center">
          {currentStatus.type === 'text' ? (
            <p className="text-3xl font-bold leading-tight">{currentStatus.content}</p>
          ) : (
            <img 
              src={currentStatus.content} 
              alt="Status content" 
              className="max-h-[80vh] w-full object-contain rounded-2xl"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
      </main>

      {/* Footer / Reply */}
      <footer className="p-8 text-center">
        <div className="bg-white/10 backdrop-blur-md rounded-full px-6 py-3 border border-white/10">
          <p className="text-sm text-white/60">Responder...</p>
        </div>
      </footer>
    </div>
  );
}
