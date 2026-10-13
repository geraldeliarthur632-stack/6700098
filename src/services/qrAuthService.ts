import { db, auth, doc, setDoc, updateDoc, onSnapshot, getDoc, deleteDoc, signInWithEmailAndPassword, EmailAuthProvider, linkWithCredential, updatePassword } from '../firebase';
import { User } from '../types';
import { User as FirebaseUser } from 'firebase/auth';

export interface QRSessionDeviceInfo {
  browser: string;
  os: string;
  platform: string;
  userAgent: string;
}

export interface QRSessionData {
  id: string;
  secretKey: string;
  status: 'pending' | 'scanned' | 'authenticated' | 'completed' | 'expired';
  createdAt: number;
  expiresAt: number;
  deviceInfo?: QRSessionDeviceInfo;
  authenticatedUid?: string;
  encryptedPayload?: string;
  pairedAt?: number;
}

export interface LinkedDevice {
  id: string;
  deviceName: string;
  platform: string;
  connectedAt: number;
  lastActive: number;
}

// Simple & reliable authenticated encryption using AES-GCM or cipher fallback
async function getCryptoKey(secretKey: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey.padEnd(32, '0').slice(0, 32)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('offgrid-salt-qr-pairing'),
      iterations: 10000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPayload(data: object, secretKey: string): Promise<string> {
  const jsonStr = JSON.stringify(data);
  try {
    if (window.crypto && window.crypto.subtle) {
      const key = await getCryptoKey(secretKey);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(jsonStr)
      );
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      return btoa(String.fromCharCode(...combined));
    }
  } catch (err) {
    console.warn('SubtleCrypto encryption failed, using fallback cipher:', err);
  }

  // Fallback simple reversible obfuscation
  const keyChars = secretKey.split('');
  const result = jsonStr.split('').map((char, i) => {
    return String.fromCharCode(char.charCodeAt(0) ^ keyChars[i % keyChars.length].charCodeAt(0));
  }).join('');
  return 'FALLBACK:' + btoa(encodeURIComponent(result));
}

export async function decryptPayload(cipherText: string, secretKey: string): Promise<any> {
  if (cipherText.startsWith('FALLBACK:')) {
    const raw = decodeURIComponent(atob(cipherText.replace('FALLBACK:', '')));
    const keyChars = secretKey.split('');
    const jsonStr = raw.split('').map((char, i) => {
      return String.fromCharCode(char.charCodeAt(0) ^ keyChars[i % keyChars.length].charCodeAt(0));
    }).join('');
    return JSON.parse(jsonStr);
  }

  try {
    if (window.crypto && window.crypto.subtle) {
      const key = await getCryptoKey(secretKey);
      const binaryString = atob(cipherText);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const iv = bytes.slice(0, 12);
      const data = bytes.slice(12);
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decrypted));
    }
  } catch (err) {
    console.error('Decryption failed:', err);
    throw new Error('Falha ao descriptografar credenciais do QR Code.');
  }

  throw new Error('Ambiente de criptografia indisponível.');
}

export function detectDeviceInfo(): QRSessionDeviceInfo {
  const ua = navigator.userAgent;
  let browser = 'Navegador Web';
  if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
  else if (ua.includes('Edg')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome')) browser = 'Google Chrome';
  else if (ua.includes('Safari')) browser = 'Apple Safari';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  let os = 'Dispositivo';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return {
    browser,
    os,
    platform: navigator.platform || 'Web',
    userAgent: ua.slice(0, 120)
  };
}

export const qrAuthService = {
  /**
   * Generates a new WhatsApp Web style pairing session
   */
  async createSession(): Promise<{ sessionId: string; secretKey: string; qrData: string }> {
    const sessionId = 'session_' + Math.random().toString(36).substring(2, 14) + Date.now().toString(36);
    const secretKey = Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const deviceInfo = detectDeviceInfo();
    const sessionData: QRSessionData = {
      id: sessionId,
      secretKey,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + 120000, // 2 minutes
      deviceInfo
    };

    await setDoc(doc(db, 'qr_sessions', sessionId), sessionData);

    const qrData = `offgrid-webauth:${sessionId}:${secretKey}`;
    return { sessionId, secretKey, qrData };
  },

  /**
   * Listens for changes to the pairing session on the unauthenticated device
   */
  listenToSession(sessionId: string, onUpdate: (data: QRSessionData) => void) {
    const sessionRef = doc(db, 'qr_sessions', sessionId);
    return onSnapshot(sessionRef, (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as QRSessionData);
      }
    });
  },

  /**
   * Mark session as scanned when the camera detects it
   */
  async markAsScanned(sessionId: string) {
    try {
      const sessionRef = doc(db, 'qr_sessions', sessionId);
      await updateDoc(sessionRef, { status: 'scanned' });
    } catch (e) {
      console.warn('Could not mark session as scanned:', e);
    }
  },

  /**
   * Confirm pairing from the authenticated mobile device (WhatsApp Web style)
   */
  async authorizeSession(
    sessionId: string,
    secretKey: string,
    user: User,
    firebaseUser: FirebaseUser
  ): Promise<void> {
    const sessionRef = doc(db, 'qr_sessions', sessionId);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) {
      throw new Error('Sessão QR Code expirada ou inexistente.');
    }
    const sessionData = snap.data() as QRSessionData;
    if (Date.now() > sessionData.expiresAt) {
      throw new Error('Este código QR expirou. Gere um novo código no computador.');
    }

    const email = user.email || firebaseUser.email;
    if (!email) {
      throw new Error('Usuário precisa ter um email vinculado para conectar via QR Code.');
    }

    // Determine or provision password for multi-device sync
    let passwordToUse = user.password;
    if (!passwordToUse) {
      // Generate a strong deterministic or managed app password
      passwordToUse = 'OffGrid#' + user.uid.substring(0, 8) + 'X9@!';
      try {
        const cred = EmailAuthProvider.credential(email, passwordToUse);
        await linkWithCredential(firebaseUser, cred);
      } catch (err: any) {
        // If already linked with email credential, update it
        if (err?.code === 'auth/credential-already-in-use' || err?.code === 'auth/provider-already-linked') {
          try {
            await updatePassword(firebaseUser, passwordToUse);
          } catch {}
        }
      }
      // Persist in user document
      await updateDoc(doc(db, 'users', user.uid), { password: passwordToUse });
    }

    const authPayload = {
      uid: user.uid,
      name: user.name,
      email,
      password: passwordToUse,
      photoURL: user.photoURL || null,
      timestamp: Date.now()
    };

    const encryptedPayload = await encryptPayload(authPayload, secretKey);

    await updateDoc(sessionRef, {
      status: 'authenticated',
      authenticatedUid: user.uid,
      encryptedPayload,
      pairedAt: Date.now()
    });

    // Save to local device manager
    this.addLinkedDevice({
      id: sessionId,
      deviceName: `${sessionData.deviceInfo?.browser || 'Navegador Web'} (${sessionData.deviceInfo?.os || 'PC'})`,
      platform: sessionData.deviceInfo?.platform || 'Web',
      connectedAt: Date.now(),
      lastActive: Date.now()
    });
  },

  /**
   * Complete login on the unauthenticated device using received encrypted credentials
   */
  async loginFromPairing(encryptedPayload: string, secretKey: string, sessionId: string) {
    const credentials = await decryptPayload(encryptedPayload, secretKey);
    if (!credentials || !credentials.email || !credentials.password) {
      throw new Error('Credenciais de login recebidas são inválidas.');
    }

    // Sign in using standard Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);

    // Clean up session
    try {
      await updateDoc(doc(db, 'qr_sessions', sessionId), { status: 'completed' });
    } catch {}

    return userCredential;
  },

  /**
   * Clean up expired session
   */
  async cancelSession(sessionId: string) {
    try {
      await deleteDoc(doc(db, 'qr_sessions', sessionId));
    } catch {}
  },

  /**
   * Linked Devices Management on Mobile (WhatsApp Web devices)
   */
  getLinkedDevices(): LinkedDevice[] {
    try {
      const raw = localStorage.getItem('offgrid_linked_devices');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  addLinkedDevice(device: LinkedDevice) {
    try {
      const devices = this.getLinkedDevices().filter(d => d.id !== device.id);
      devices.unshift(device);
      localStorage.setItem('offgrid_linked_devices', JSON.stringify(devices.slice(0, 10)));
    } catch {}
  },

  removeLinkedDevice(id: string) {
    try {
      const devices = this.getLinkedDevices().filter(d => d.id !== id);
      localStorage.setItem('offgrid_linked_devices', JSON.stringify(devices));
      // Invalidate session in Firestore
      deleteDoc(doc(db, 'qr_sessions', id)).catch(() => {});
    } catch {}
  }
};
