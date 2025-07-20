import { openDB, IDBPDatabase } from 'idb';
import CryptoJS from 'crypto-js';

export interface Memory {
  id: string;
  photoUrl: string;
  photoBlob: Blob;
  textMemory?: string;
  audioBlob?: Blob;
  unlockDate?: string;
  isEncrypted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  darkMode: boolean;
  encryptionEnabled: boolean;
  encryptionKey?: string;
}

const DB_NAME = 'SmartMemoriesDB';
const DB_VERSION = 1;
const MEMORIES_STORE = 'memories';
const SETTINGS_STORE = 'settings';

let dbInstance: IDBPDatabase | null = null;

export async function initDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create memories store
      if (!db.objectStoreNames.contains(MEMORIES_STORE)) {
        const memoriesStore = db.createObjectStore(MEMORIES_STORE, {
          keyPath: 'id',
        });
        memoriesStore.createIndex('createdAt', 'createdAt');
        memoriesStore.createIndex('unlockDate', 'unlockDate');
      }

      // Create settings store
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, {
          keyPath: 'key',
        });
      }
    },
  });

  return dbInstance;
}

export async function saveMemory(memory: Memory): Promise<void> {
  const db = await initDB();
  await db.put(MEMORIES_STORE, memory);
}

export async function getAllMemories(): Promise<Memory[]> {
  const db = await initDB();
  return await db.getAll(MEMORIES_STORE);
}

export async function getMemoryById(id: string): Promise<Memory | undefined> {
  const db = await initDB();
  return await db.get(MEMORIES_STORE, id);
}

export async function deleteMemory(id: string): Promise<void> {
  const db = await initDB();
  await db.delete(MEMORIES_STORE, id);
}

export async function getSettings(): Promise<AppSettings> {
  const db = await initDB();
  const settings = await db.get(SETTINGS_STORE, 'app-settings');
  return settings?.value || {
    darkMode: false,
    encryptionEnabled: false,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await initDB();
  await db.put(SETTINGS_STORE, {
    key: 'app-settings',
    value: settings,
  });
}

// Encryption utilities
const ENCRYPTION_KEY = 'smart-memories-app-key';

export function encryptText(text: string, userKey?: string): string {
  const key = userKey || ENCRYPTION_KEY;
  return CryptoJS.AES.encrypt(text, key).toString();
}

export function decryptText(encryptedText: string, userKey?: string): string {
  const key = userKey || ENCRYPTION_KEY;
  const bytes = CryptoJS.AES.decrypt(encryptedText, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// Utility functions
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || '';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}