export type DeliveryMethod = 
  | 'internet' 
  | 'wifi-direct' 
  | 'bluetooth' 
  | 'mesh' 
  | 'ultrasound' 
  | 'optical-qr' 
  | 'local-lan';

export type User = {
  uid: string;
  name: string;
  photoURL?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  contacts: string[]; // List of uids
  status: 'online' | 'offline' | 'mesh';
  lastSeen: number;
  isTyping?: boolean;
  publicKey?: string; // For E2EE
  bio?: string;
  password?: string; // Optional app password
  role?: 'admin' | 'user';
  archivedConversations?: string[]; // IDs of conversations archived by user
  permissionsConfigured?: boolean;
  profileCompleted?: boolean;
  backupMetadata?: {
    lastBackupAt: number;
    totalChats: number;
    totalMessages: number;
    sizeBytes: number;
  };
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string; // Encrypted or plain text
  type: 'text' | 'image' | 'video' | 'file' | 'audio';
  fileUrl?: string;
  createdAt: number;
  expiresAt: number; // 26 hours from creation
  delivered: boolean;
  seen: boolean;
  readAt?: number; // Timestamp when message was read by recipient
  status?: 'sent' | 'delivered' | 'read'; // Explicit status for check marks
  deliveryMethod: DeliveryMethod;
  isEncrypted: boolean;
  duration?: number; // For audio messages
  reactions?: { [uid: string]: string }; // emoji
  offlineSynced?: boolean;
  pendingOfflineSync?: boolean;
};

export type Status = {
  id: string;
  uid: string;
  userName: string;
  userPhoto?: string | null;
  content: string; // text or image URL
  type: 'text' | 'image';
  createdAt: number;
  expiresAt: number;
  seenBy: string[]; // List of uids
};

export type Conversation = {
  id: string;
  participants: string[];
  lastMessage?: Message | null;
  updatedAt: number;
  isGroup?: boolean;
  groupName?: string;
  groupPhoto?: string;
  adminId?: string;
  archivedBy?: string[]; // UIDs of users who have archived this chat
};

export type ConnectionStatus = {
  internet: boolean;
  bluetooth: boolean;
  wifiDirect: boolean;
  ultrasound: boolean;
  opticalQR: boolean;
  localLan: boolean;
  meshRelay: boolean;
};

export type AppPermissions = {
  notifications: 'granted' | 'denied' | 'default';
  bluetooth: boolean;
  audio: boolean;
  camera: boolean;
  storagePersist: boolean;
  completedAt?: number;
};

export type BackupData = {
  version: number;
  exportedAt: number;
  user: {
    uid: string;
    name: string;
    email?: string | null;
    photoURL?: string | null;
    contacts: string[];
    bio?: string;
  };
  archivedConversations: string[];
  conversations: Conversation[];
  messages: { [conversationId: string]: Message[] };
};
