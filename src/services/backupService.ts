import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  orderBy 
} from '../firebase';
import { Conversation, Message, User, BackupData } from '../types';

export interface BackupResult {
  success: boolean;
  lastBackupAt: number;
  totalChats: number;
  totalMessages: number;
  sizeBytes: number;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  chatsRestored: number;
  messagesRestored: number;
  error?: string;
}

export interface AccountBackupInfo {
  hasBackup: boolean;
  source?: 'database' | 'local' | 'both';
  lastBackupAt?: number;
  totalChats?: number;
  totalMessages?: number;
  sizeBytes?: number;
  device?: string;
}

export interface EncryptedBackupEnvelope {
  format: 'OFFGRID_ENCRYPTED_BACKUP';
  version: number;
  encryptedAt: number;
  uid: string;
  salt: string; // hex
  iv: string;   // hex
  ciphertext: string; // base64
}

// Helpers criptográficos para AES-GCM 256-bit no navegador
const bufferToHex = (buffer: ArrayBuffer | Uint8Array): string => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

const hexToBuffer = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as ArrayBufferView,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export const backupService = {
  /**
   * Verifica se a conta possui backup disponível no banco de dados (Firestore) ou no armazenamento local
   */
  async checkAccountBackup(uid: string): Promise<AccountBackupInfo> {
    try {
      let cloudBackupData: any = null;
      let hasCloud = false;

      // 1. Verificar no banco de dados Firestore
      try {
        const backupDocRef = doc(db, 'users', uid, 'backups', 'latest');
        const backupSnap = await getDoc(backupDocRef);
        if (backupSnap.exists()) {
          cloudBackupData = backupSnap.data();
          hasCloud = true;
        }
      } catch (cloudErr) {
        console.warn('Verificação de backup na nuvem Firestore:', cloudErr);
      }

      // 2. Verificar nos metadados do usuário
      if (!hasCloud) {
        try {
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists() && userSnap.data()?.backupMetadata?.lastBackupAt) {
            const meta = userSnap.data()?.backupMetadata;
            cloudBackupData = {
              lastBackupAt: meta.lastBackupAt,
              totalChats: meta.totalChats,
              totalMessages: meta.totalMessages,
              sizeBytes: meta.sizeBytes
            };
            hasCloud = true;
          }
        } catch {}
      }

      // 3. Verificar cache local no dispositivo
      let hasLocal = false;
      let localMeta: any = null;
      try {
        const localMetaStr = localStorage.getItem(`offgrid_last_backup_meta_${uid}`);
        const localBackupJson = localStorage.getItem(`offgrid_offline_backup_${uid}`);
        if (localBackupJson && localBackupJson.length > 20) {
          hasLocal = true;
          if (localMetaStr) {
            localMeta = JSON.parse(localMetaStr);
          }
        }
      } catch {}

      if (!hasCloud && !hasLocal) {
        return { hasBackup: false };
      }

      const activeMeta = cloudBackupData || localMeta || {};
      const source: 'database' | 'local' | 'both' = (hasCloud && hasLocal) ? 'both' : (hasCloud ? 'database' : 'local');

      return {
        hasBackup: true,
        source,
        lastBackupAt: activeMeta.lastBackupAt || Date.now(),
        totalChats: activeMeta.totalChats || 0,
        totalMessages: activeMeta.totalMessages || 0,
        sizeBytes: activeMeta.sizeBytes || 0,
        device: activeMeta.device
      };
    } catch (err) {
      console.error('Erro ao checar backup da conta:', err);
      return { hasBackup: false };
    }
  },

  /**
   * Coleta e monta o objeto completo de backup (conversas, mensagens, contatos e perfil)
   */
  async buildBackupPayload(uid: string): Promise<BackupData> {
    // 1. Obter dados do usuário
    const userDocRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userDocRef);
    const userData = (userSnap.exists() ? userSnap.data() : {}) as User;

    // 2. Obter todas as conversas do usuário
    const convsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', uid),
      orderBy('updatedAt', 'desc')
    );
    const convsSnap = await getDocs(convsQuery);
    const conversations: Conversation[] = convsSnap.docs.map(d => ({
      ...(d.data() as Conversation),
      id: d.id
    }));

    // 3. Obter mensagens de cada conversa
    const messagesMap: { [convId: string]: Message[] } = {};

    for (const conv of conversations) {
      try {
        const msgsQuery = query(
          collection(db, 'conversations', conv.id, 'messages'),
          orderBy('createdAt', 'asc')
        );
        const msgsSnap = await getDocs(msgsQuery);
        const msgs: Message[] = msgsSnap.docs.map(md => ({
          ...(md.data() as Message),
          id: md.id
        }));
        messagesMap[conv.id] = msgs;
      } catch (msgErr) {
        console.warn(`Aviso ao ler mensagens da conversa ${conv.id} para backup:`, msgErr);
        messagesMap[conv.id] = [];
      }
    }

    const archivedConversations = userData.archivedConversations || [];
    return {
      version: 1,
      exportedAt: Date.now(),
      user: {
        uid: userData.uid || uid,
        name: userData.name || 'Usuário OffGrid',
        email: userData.email || null,
        photoURL: userData.photoURL || null,
        contacts: userData.contacts || [],
        bio: userData.bio || ''
      },
      archivedConversations,
      conversations,
      messages: messagesMap
    };
  },

  /**
   * Exporta e salva o backup completo para o Banco de Dados (Firestore) e no cache local
   */
  async exportBackupToDatabase(uid: string): Promise<BackupResult> {
    try {
      const backupPayload = await this.buildBackupPayload(uid);
      const conversations = backupPayload.conversations;
      let totalMessages = 0;
      Object.values(backupPayload.messages).forEach((arr: Message[]) => {
        totalMessages += arr.length;
      });

      const jsonStr = JSON.stringify(backupPayload);
      const sizeBytes = new Blob([jsonStr]).size;
      const now = Date.now();

      // Salvar na coleção de backups do usuário no Banco de Dados
      const backupDocRef = doc(db, 'users', uid, 'backups', 'latest');
      await setDoc(backupDocRef, {
        backupJson: jsonStr,
        lastBackupAt: now,
        totalChats: conversations.length,
        totalMessages,
        sizeBytes,
        device: navigator.userAgent
      });

      // Atualizar metadados no documento principal do usuário
      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, {
        backupMetadata: {
          lastBackupAt: now,
          totalChats: conversations.length,
          totalMessages,
          sizeBytes
        }
      });

      // Salvar snapshot local para resiliência offline no aparelho
      try {
        localStorage.setItem(`offgrid_offline_backup_${uid}`, jsonStr);
        localStorage.setItem(`offgrid_last_backup_meta_${uid}`, JSON.stringify({
          lastBackupAt: now,
          totalChats: conversations.length,
          totalMessages,
          sizeBytes
        }));
      } catch (storageErr) {
        console.warn('Aviso ao armazenar backup no localStorage local:', storageErr);
      }

      return {
        success: true,
        lastBackupAt: now,
        totalChats: conversations.length,
        totalMessages,
        sizeBytes
      };
    } catch (err: any) {
      console.error('Erro ao realizar backup no banco de dados:', err);
      return {
        success: false,
        lastBackupAt: 0,
        totalChats: 0,
        totalMessages: 0,
        sizeBytes: 0,
        error: err?.message || 'Falha ao salvar backup no banco de dados.'
      };
    }
  },

  createCloudBackup(uid: string) {
    return this.exportBackupToDatabase(uid);
  },

  /**
   * Exporta todo o histórico de mensagens, conversas, contatos e perfil como um arquivo JSON CRIPTOGRAFADO (.offgrid ou .json)
   * baixado diretamente no armazenamento local do dispositivo.
   */
  async exportEncryptedBackupToFile(uid: string, customPassword?: string): Promise<{ success: boolean; filename: string; sizeBytes: number }> {
    const payload = await this.buildBackupPayload(uid);
    const jsonPlain = JSON.stringify(payload);

    // Chave de criptografia: senha customizada ou chave de segurança padrão vinculada ao uid
    const passphrase = customPassword?.trim() || `offgrid_secure_key_${uid}`;
    
    // Gerar Salt e IV aleatórios seguros
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const aesKey = await deriveAesKey(passphrase, salt);
    const enc = new TextEncoder();
    const encodedData = enc.encode(jsonPlain);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      aesKey,
      encodedData
    );

    const envelope: EncryptedBackupEnvelope = {
      format: 'OFFGRID_ENCRYPTED_BACKUP',
      version: 2,
      encryptedAt: Date.now(),
      uid,
      salt: bufferToHex(salt),
      iv: bufferToHex(iv),
      ciphertext: arrayBufferToBase64(ciphertextBuffer)
    };

    const envelopeJson = JSON.stringify(envelope, null, 2);
    const blob = new Blob([envelopeJson], { type: 'application/json' });
    const sizeBytes = blob.size;

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `offgrid_backup_${uid.slice(0, 6)}_${dateStr}.offgrid`;

    // Download no dispositivo local
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { success: true, filename, sizeBytes };
  },

  /**
   * Baixa o arquivo de backup normal no celular ou computador (.json)
   */
  async downloadBackupToDevice(uid: string): Promise<{ success: boolean; filename: string }> {
    let jsonStr = localStorage.getItem(`offgrid_offline_backup_${uid}`);

    if (!jsonStr) {
      const backupDoc = await getDoc(doc(db, 'users', uid, 'backups', 'latest'));
      if (backupDoc.exists()) {
        jsonStr = backupDoc.data()?.backupJson;
      }
    }

    if (!jsonStr) {
      const genRes = await this.exportBackupToDatabase(uid);
      if (genRes.success) {
        jsonStr = localStorage.getItem(`offgrid_offline_backup_${uid}`);
      }
    }

    if (!jsonStr) {
      throw new Error('Não foi possível gerar os dados do backup para baixar.');
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `offgrid_backup_${uid.slice(0, 6)}_${dateStr}.json`;
    const blob = new Blob([jsonStr], { type: 'application/json' });

    // Download padrão do navegador
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { success: true, filename };
  },

  exportBackupToFile(uid: string) {
    return this.downloadBackupToDevice(uid);
  },

  /**
   * Restaura conversas diretamente do Banco de Dados (Firestore / Nuvem) para o app
   */
  async restoreFromDatabase(uid: string): Promise<RestoreResult> {
    try {
      const backupDocRef = doc(db, 'users', uid, 'backups', 'latest');
      const backupSnap = await getDoc(backupDocRef);

      let backupJson: string | null = null;
      if (backupSnap.exists()) {
        backupJson = backupSnap.data()?.backupJson;
      } else {
        backupJson = localStorage.getItem(`offgrid_offline_backup_${uid}`);
      }

      if (!backupJson) {
        return {
          success: false,
          chatsRestored: 0,
          messagesRestored: 0,
          error: 'Nenhum backup encontrado no banco de dados para esta conta.'
        };
      }

      const backupData = JSON.parse(backupJson) as BackupData;
      return await this.restoreBackupData(backupData, uid);
    } catch (err: any) {
      console.error('Erro ao restaurar backup do banco de dados:', err);
      return {
        success: false,
        chatsRestored: 0,
        messagesRestored: 0,
        error: err?.message || 'Falha ao restaurar backup do banco de dados.'
      };
    }
  },

  restoreFromCloudBackup(uid: string) {
    return this.restoreFromDatabase(uid);
  },

  /**
   * Recebe um arquivo de backup (.json ou .offgrid) do dispositivo, descriptografa se necessário,
   * e restaura conversas e contatos diretamente no banco local e Firestore.
   */
  async importBackupFromFile(file: File, currentUserUid: string, optionalPassword?: string): Promise<RestoreResult> {
    try {
      const text = await file.text();
      let backupData: BackupData | null = null;

      // Verificar se é envelope criptografado (.offgrid ou json com formato OFFGRID_ENCRYPTED_BACKUP)
      if (text.includes('OFFGRID_ENCRYPTED_BACKUP')) {
        try {
          const envelope = JSON.parse(text) as EncryptedBackupEnvelope;
          const passphrase = optionalPassword?.trim() || `offgrid_secure_key_${currentUserUid}`;
          const salt = hexToBuffer(envelope.salt);
          const iv = hexToBuffer(envelope.iv);
          const ciphertext = base64ToArrayBuffer(envelope.ciphertext);

          const aesKey = await deriveAesKey(passphrase, salt);
          const decryptedBuffer = await crypto.subtle.decrypt(
            {
              name: 'AES-GCM',
              iv: iv
            },
            aesKey,
            ciphertext
          );

          const dec = new TextDecoder();
          const decryptedJson = dec.decode(decryptedBuffer);
          backupData = JSON.parse(decryptedJson) as BackupData;
        } catch (decryptErr) {
          // Se falhar com a chave do usuário atual e o envelope tiver outro uid, tentar com a chave original do arquivo
          try {
            const envelope = JSON.parse(text) as EncryptedBackupEnvelope;
            const originalPassphrase = `offgrid_secure_key_${envelope.uid}`;
            const salt = hexToBuffer(envelope.salt);
            const iv = hexToBuffer(envelope.iv);
            const ciphertext = base64ToArrayBuffer(envelope.ciphertext);

            const aesKey = await deriveAesKey(originalPassphrase, salt);
            const decryptedBuffer = await crypto.subtle.decrypt(
              {
                name: 'AES-GCM',
                iv: iv
              },
              aesKey,
              ciphertext
            );

            const dec = new TextDecoder();
            const decryptedJson = dec.decode(decryptedBuffer);
            backupData = JSON.parse(decryptedJson) as BackupData;
          } catch (secErr) {
            throw new Error('Falha ao descriptografar arquivo de backup. Senha ou chave incorreta.');
          }
        }
      } else {
        // Arquivo JSON padrão
        backupData = JSON.parse(text) as BackupData;
      }

      if (!backupData || !backupData.conversations || !backupData.messages) {
        throw new Error('Arquivo de backup inválido ou com formato não reconhecido.');
      }

      // Restaura no banco local e Firestore
      const result = await this.restoreBackupData(backupData, currentUserUid);
      
      if (result.success) {
        // Atualizar snapshot no banco de dados e no cache local
        try {
          const jsonStr = JSON.stringify(backupData);
          const sizeBytes = new Blob([jsonStr]).size;
          const now = Date.now();
          await setDoc(doc(db, 'users', currentUserUid, 'backups', 'latest'), {
            backupJson: jsonStr,
            lastBackupAt: now,
            totalChats: backupData.conversations.length,
            totalMessages: result.messagesRestored,
            sizeBytes,
            device: 'Arquivo Importado (.json/.offgrid)'
          });
          localStorage.setItem(`offgrid_offline_backup_${currentUserUid}`, jsonStr);
        } catch (saveErr) {
          console.warn('Aviso ao sincronizar backup importado no banco de dados:', saveErr);
        }
      }

      return result;
    } catch (err: any) {
      console.error('Erro ao importar arquivo de backup:', err);
      return {
        success: false,
        chatsRestored: 0,
        messagesRestored: 0,
        error: err?.message || 'Falha ao processar arquivo de backup.'
      };
    }
  },

  /**
   * Executa a restauração de conversas, mensagens, contatos e arquivados no banco de dados e local
   */
  async restoreBackupData(backupData: BackupData, targetUid: string): Promise<RestoreResult> {
    let chatsRestored = 0;
    let messagesRestored = 0;

    // 1. Restaurar contatos e arquivados no perfil do usuário
    try {
      const userRef = doc(db, 'users', targetUid);
      const userSnap = await getDoc(userRef);
      const existingArchived: string[] = userSnap.exists() ? (userSnap.data()?.archivedConversations || []) : [];
      const mergedArchived = Array.from(new Set([...existingArchived, ...(backupData.archivedConversations || [])]));
      
      const existingContacts: string[] = userSnap.exists() ? (userSnap.data()?.contacts || []) : [];
      const backupContacts = backupData.user?.contacts || [];
      const mergedContacts = Array.from(new Set([...existingContacts, ...backupContacts]));

      await updateDoc(userRef, { 
        archivedConversations: mergedArchived,
        contacts: mergedContacts
      });
    } catch (err) {
      console.warn('Aviso ao mesclar contatos e conversas arquivadas:', err);
    }

    // 2. Restaurar cada conversa
    for (const conv of backupData.conversations) {
      try {
        const participants = Array.from(new Set([...(conv.participants || []), targetUid]));
        const convRef = doc(db, 'conversations', conv.id);
        
        await setDoc(convRef, {
          id: conv.id,
          participants,
          updatedAt: conv.updatedAt || Date.now(),
          isGroup: !!conv.isGroup,
          groupName: conv.groupName || null,
          groupPhoto: conv.groupPhoto || null,
          adminId: conv.adminId || null,
          archivedBy: conv.archivedBy || []
        }, { merge: true });

        chatsRestored++;

        // 3. Restaurar mensagens da conversa
        const msgs = backupData.messages[conv.id] || [];
        for (const msg of msgs) {
          try {
            const msgRef = doc(db, 'conversations', conv.id, 'messages', msg.id);
            await setDoc(msgRef, {
              ...msg,
              id: msg.id,
              conversationId: conv.id
            }, { merge: true });
            messagesRestored++;
          } catch (mErr) {
            console.warn(`Erro ao restaurar mensagem ${msg.id}:`, mErr);
          }
        }
      } catch (convErr) {
        console.warn(`Erro ao restaurar conversa ${conv.id}:`, convErr);
      }
    }

    return {
      success: true,
      chatsRestored,
      messagesRestored
    };
  }
};
