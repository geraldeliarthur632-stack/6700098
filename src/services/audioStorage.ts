import { db, doc, setDoc, updateDoc } from '../firebase';
import { Message, DeliveryMethod } from '../types';

export interface OfflineAudioRecord {
  id: string; // message ID
  conversationId: string;
  senderId: string;
  blob: Blob;
  dataUrl?: string; // base64 representation
  mimeType: string;
  duration: number; // seconds
  createdAt: number;
  synced: boolean;
  deliveryMethod?: DeliveryMethod;
}

const DB_NAME = 'offgrid_audio_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_records';

class AudioStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private urlCache: Map<string, string> = new Map();

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB não suportado neste navegador'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('conversationId', 'conversationId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Salva uma gravação de áudio no IndexedDB local antes de sincronizar
   */
  async saveAudio(record: OfflineAudioRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const request = store.put(record);

      request.onsuccess = () => {
        // Criar e cachear o Blob URL local para reprodução imediata sem rede
        try {
          const blobUrl = URL.createObjectURL(record.blob);
          this.urlCache.set(record.id, blobUrl);
        } catch {}
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtém o registro de áudio salvo no IndexedDB
   */
  async getAudio(id: string): Promise<OfflineAudioRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retorna uma URL para reproduzir o áudio (Blob URL ou dataURL) a partir do IndexedDB
   */
  async getAudioBlobUrl(id: string): Promise<string | null> {
    if (this.urlCache.has(id)) {
      return this.urlCache.get(id)!;
    }

    try {
      const record = await this.getAudio(id);
      if (record && record.blob) {
        const blobUrl = URL.createObjectURL(record.blob);
        this.urlCache.set(id, blobUrl);
        return blobUrl;
      }
      if (record && record.dataUrl) {
        return record.dataUrl;
      }
    } catch (err) {
      console.warn('Erro ao carregar blob de áudio do IndexedDB:', err);
    }

    return null;
  }

  /**
   * Retorna todos os áudios gravados offline pendentes de sincronização
   */
  async getPendingAudios(senderId?: string): Promise<OfflineAudioRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(false));

      request.onsuccess = () => {
        let results: OfflineAudioRecord[] = request.result || [];
        if (senderId) {
          results = results.filter(r => r.senderId === senderId);
        }
        resolve(results);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Marca o áudio como sincronizado no IndexedDB
   */
  async markAudioSynced(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const data = getReq.result as OfflineAudioRecord | undefined;
        if (data) {
          data.synced = true;
          store.put(data);
        }
        resolve();
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  /**
   * Sincroniza áudios offline pendentes com o Firestore quando a internet retornar
   */
  async syncPendingAudios(currentUserId: string): Promise<number> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;

    let synced = 0;
    try {
      const pendings = await this.getPendingAudios(currentUserId);
      if (pendings.length === 0) return 0;

      for (const rec of pendings) {
        try {
          const msgRef = doc(db, 'conversations', rec.conversationId, 'messages', rec.id);
          const convRef = doc(db, 'conversations', rec.conversationId);

          const syncedMsg: Message = {
            id: rec.id,
            conversationId: rec.conversationId,
            senderId: rec.senderId,
            text: rec.dataUrl || '',
            fileUrl: rec.dataUrl || '',
            type: 'audio',
            duration: rec.duration,
            createdAt: rec.createdAt,
            expiresAt: rec.createdAt + (26 * 60 * 60 * 1000),
            delivered: true,
            seen: false,
            deliveryMethod: rec.deliveryMethod || 'internet',
            isEncrypted: false,
            offlineSynced: true,
            pendingOfflineSync: false
          };

          await setDoc(msgRef, syncedMsg, { merge: true });
          await updateDoc(convRef, {
            lastMessage: syncedMsg,
            updatedAt: Date.now()
          }).catch(() => {});

          await this.markAudioSynced(rec.id);
          synced++;
        } catch (itemErr) {
          console.warn(`Erro ao sincronizar áudio ${rec.id}:`, itemErr);
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar fila de áudios offline do IndexedDB:', err);
    }

    return synced;
  }

  /**
   * Remove um áudio do IndexedDB
   */
  async deleteAudio(id: string): Promise<void> {
    const db = await this.getDB();
    if (this.urlCache.has(id)) {
      try {
        URL.revokeObjectURL(this.urlCache.get(id)!);
      } catch {}
      this.urlCache.delete(id);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const audioStorage = new AudioStorageService();
