import Dexie, { type Table } from 'dexie';

export interface User {
  id?: number;
  fullName: string;
  email: string;
  passwordHash: string; // Stored securely if needed locally, though mostly backend
  pin?: string;         // Local app lock PIN (hashed)
  status?: 'ACTIVE' | 'BANNED';
  license?: 'FREE' | 'PRO' | 'LIFETIME';
  createdAt: Date;
}

export interface Note {
  id?: number;
  syncId?: string;
  title: string;
  description: string;
  type: 'TEXT' | 'VOICE' | 'DOCUMENT';
  voicePath?: string;
  audioBlob?: Blob;
  fileBlob?: Blob;
  filePath?: string;
  category: string;
  tags: string[];
  reminderDateTime?: Date;
  createdAt: Date;
  updatedAt: Date;
  isFavorite: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface Document {
  id?: number;
  syncId?: string;
  noteId: string; // Refers to Note.syncId (UUID)
  fileName: string;
  filePath: string;
  folder: string;
  totalPages: number;
  lastPageRead: number;
  readStatus: 'UNREAD' | 'IN_PROGRESS' | 'COMPLETED';
  bookmarks: number[];
  timeSpentMinutes: number;
  coverThumbnail?: string;
  fileBlob?: Blob;
}

export interface Annotation {
  id?: number;
  syncId?: string;
  documentId: string; // Refers to Document.syncId (UUID)
  pageNumber: number;
  highlightColor: string;
  noteText?: string;
  createdAt: Date;
}

export interface LedgerEntry {
  id?: number;
  syncId?: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: string;
  note?: string;
  date: Date;
  isRecurring: boolean;
  attachedPhotoPath?: string;
  attachedPhotoBlob?: Blob;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface UdhaarPayment {
  id: string; // unique string, e.g., Date.now().toString()
  amount: number;
  date: Date;
  note?: string;
  proofPath?: string;
  proofBlob?: Blob;
}

export interface Udhaar {
  id?: number;
  syncId?: string;
  personName: string;
  amount: number; // total amount
  type: 'TO_GIVE' | 'TO_RECEIVE';
  dueDate?: Date;
  isSettled: boolean;
  payments: UdhaarPayment[]; // tracking partial payments
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface Reminder {
  id?: number;
  syncId?: string;
  noteId: string; // Refers to Note.syncId (UUID)
  reminderType: 'MEETING' | 'STUDY' | 'WORK' | 'PERSONAL' | 'EVENT';
  dateTime: Date;
  isCompleted: boolean;
}

export interface SyncStatus {
  id?: number;
  lastSyncAt: Date;
}

export interface Bill {
  id?: string;
  syncId?: string;
  title: string;
  amount: number;
  dueDate: Date;
  isPaid: boolean;
  category?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface KhataCustomer {
  id?: number;
  syncId?: string;
  name: string;
  phone?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface KhataTransaction {
  id?: number;
  syncId?: string;
  customerId: string; // Refers to KhataCustomer.syncId
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  note?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

export class MindVaultDB extends Dexie {
  users!: Table<User>;
  notes!: Table<Note>;
  documents!: Table<Document>;
  annotations!: Table<Annotation>;
  ledgerEntries!: Table<LedgerEntry>;
  udhaar!: Table<Udhaar>;
  reminders!: Table<Reminder>;
  syncStatus!: Table<SyncStatus>;
  bills!: Table<Bill>;
  khataCustomers!: Table<KhataCustomer>;
  khataTransactions!: Table<KhataTransaction>;

  constructor() {
    super('MindVaultDB');
    this.version(1).stores({
      users: '++id, email',
      notes: '++id, type, category, createdAt, isFavorite, isDeleted',
      documents: '++id, noteId, folder',
      annotations: '++id, documentId, pageNumber',
      ledgerEntries: '++id, type, category, date',
      udhaar: '++id, personName, type, isSettled',
      reminders: '++id, noteId, reminderType, dateTime, isCompleted'
    });

    this.version(2).stores({
      users: '++id, email',
      notes: '++id, type, category, createdAt, updatedAt, isFavorite, isDeleted',
      documents: '++id, noteId, folder',
      annotations: '++id, documentId, pageNumber',
      ledgerEntries: '++id, type, category, date, updatedAt',
      udhaar: '++id, personName, type, isSettled, updatedAt',
      reminders: '++id, noteId, reminderType, dateTime, isCompleted',
      syncStatus: '++id'
    }).upgrade(tx => {
      // Add updatedAt to existing records where missing
      const now = new Date();
      tx.table('ledgerEntries').toCollection().modify(entry => {
        if (!entry.updatedAt) entry.updatedAt = entry.createdAt || now;
      });
      tx.table('udhaar').toCollection().modify(entry => {
        if (!entry.updatedAt) entry.updatedAt = entry.createdAt || now;
      });
    });

    this.version(3).stores({
      users: '++id, email',
      notes: '++id, type, category, createdAt, updatedAt, isFavorite, isDeleted',
      documents: '++id, noteId, folder',
      annotations: '++id, documentId, pageNumber',
      ledgerEntries: '++id, type, category, date, updatedAt',
      udhaar: '++id, personName, type, isSettled, updatedAt',
      reminders: '++id, noteId, reminderType, dateTime, isCompleted',
      syncStatus: '++id',
      bills: '++id, dueDate, isPaid, isDeleted, updatedAt'
    });

    this.version(4).stores({
      users: '++id, email',
      notes: '++id, syncId, type, category, createdAt, updatedAt, isFavorite, isDeleted',
      documents: '++id, syncId, noteId, folder',
      annotations: '++id, syncId, documentId, pageNumber',
      ledgerEntries: '++id, syncId, type, category, date, updatedAt',
      udhaar: '++id, syncId, personName, type, isSettled, updatedAt',
      reminders: '++id, syncId, noteId, reminderType, dateTime, isCompleted',
      syncStatus: '++id',
      bills: '++id, syncId, dueDate, isPaid, isDeleted, updatedAt'
    }).upgrade(async tx => {
      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID();
        }
        // Fallback for older browsers if needed
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      await tx.table('notes').toCollection().modify(record => {
        if (!record.syncId) record.syncId = generateUUID();
      });
      await tx.table('ledgerEntries').toCollection().modify(record => {
        if (!record.syncId) record.syncId = generateUUID();
      });
      await tx.table('udhaar').toCollection().modify(record => {
        if (!record.syncId) record.syncId = generateUUID();
      });
      await tx.table('bills').toCollection().modify(record => {
        if (!record.syncId) record.syncId = generateUUID();
      });
    });

    this.version(5).stores({
      users: '++id, email',
      notes: '++id, syncId, type, category, createdAt, updatedAt, isFavorite, isDeleted',
      documents: '++id, syncId, noteId, folder',
      annotations: '++id, syncId, documentId, pageNumber',
      ledgerEntries: '++id, syncId, type, category, date, updatedAt, isDeleted',
      udhaar: '++id, syncId, personName, type, isSettled, updatedAt, isDeleted',
      reminders: '++id, syncId, noteId, reminderType, dateTime, isCompleted',
      syncStatus: '++id',
      bills: '++id, syncId, dueDate, isPaid, isDeleted, updatedAt'
    }).upgrade(async tx => {
      await tx.table('ledgerEntries').toCollection().modify(record => {
        if (record.isDeleted === undefined) record.isDeleted = false;
      });
      await tx.table('udhaar').toCollection().modify(record => {
        if (record.isDeleted === undefined) record.isDeleted = false;
      });
    });

    this.version(6).stores({
      users: '++id, email',
      notes: '++id, syncId, type, category, createdAt, updatedAt, isFavorite, isDeleted',
      documents: '++id, syncId, noteId, folder',
      annotations: '++id, syncId, documentId, pageNumber',
      ledgerEntries: '++id, syncId, type, category, date, updatedAt, isDeleted',
      udhaar: '++id, syncId, personName, type, isSettled, updatedAt, isDeleted',
      reminders: '++id, syncId, noteId, reminderType, dateTime, isCompleted',
      syncStatus: '++id',
      bills: '++id, syncId, dueDate, isPaid, isDeleted, updatedAt',
      khataCustomers: '++id, syncId, name, phone, updatedAt, isDeleted',
      khataTransactions: '++id, syncId, customerId, type, date, updatedAt, isDeleted'
    });

    this.version(7).stores({
      users: '++id, email',
      notes: '++id, syncId, type, category, createdAt, updatedAt, isFavorite, isDeleted',
      documents: '++id, syncId, noteId, folder',
      annotations: '++id, syncId, documentId, pageNumber',
      ledgerEntries: '++id, syncId, type, category, date, updatedAt, isDeleted',
      udhaar: '++id, syncId, personName, type, isSettled, updatedAt, isDeleted',
      reminders: '++id, syncId, noteId, reminderType, dateTime, isCompleted',
      syncStatus: '++id',
      bills: '++id, syncId, dueDate, isPaid, isDeleted, updatedAt',
      khataCustomers: '++id, syncId, name, phone, updatedAt, isDeleted',
      khataTransactions: '++id, syncId, customerId, type, date, updatedAt, isDeleted'
    }).upgrade(async tx => {
      // 1. Migrate documents.noteId (numeric local ID -> Note.syncId string)
      const notes = await tx.table('notes').toArray();
      const noteIdToSyncIdMap = new Map<number, string>();
      notes.forEach(n => {
        if (n.id && n.syncId) noteIdToSyncIdMap.set(n.id, n.syncId);
      });

      const documents = await tx.table('documents').toArray();
      const docIdToSyncIdMap = new Map<number, string>();
      for (const doc of documents) {
        if (typeof doc.noteId === 'number') {
          const parentSyncId = noteIdToSyncIdMap.get(doc.noteId);
          if (parentSyncId) {
            doc.noteId = parentSyncId;
            await tx.table('documents').put(doc);
          }
        }
        if (doc.id && doc.syncId) docIdToSyncIdMap.set(doc.id, doc.syncId);
      }

      // 2. Migrate annotations.documentId (numeric local ID -> Document.syncId string)
      const annotations = await tx.table('annotations').toArray();
      for (const ann of annotations) {
        if (typeof ann.documentId === 'number') {
          const parentSyncId = docIdToSyncIdMap.get(ann.documentId);
          if (parentSyncId) {
            ann.documentId = parentSyncId;
            await tx.table('annotations').put(ann);
          }
        }
      }

      // 3. Migrate reminders.noteId (numeric local ID -> Note.syncId string)
      const reminders = await tx.table('reminders').toArray();
      for (const rem of reminders) {
        if (typeof rem.noteId === 'number') {
          const parentSyncId = noteIdToSyncIdMap.get(rem.noteId);
          if (parentSyncId) {
            rem.noteId = parentSyncId;
            await tx.table('reminders').put(rem);
          }
        }
      }
    });

    // Automatically generate syncId for new records
    const generateUUID = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    const applySyncIdHook = (table: Table) => {
      table.hook('creating', function (primKey, obj, trans) {
        if (!obj.syncId) {
          obj.syncId = generateUUID();
        }
      });
    };

    applySyncIdHook(this.notes);
    applySyncIdHook(this.documents);
    applySyncIdHook(this.annotations);
    applySyncIdHook(this.ledgerEntries);
    applySyncIdHook(this.udhaar);
    applySyncIdHook(this.reminders);
    applySyncIdHook(this.bills);
    applySyncIdHook(this.khataCustomers);
    applySyncIdHook(this.khataTransactions);
  }
}

export const db = new MindVaultDB();

