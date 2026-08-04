import Dexie, { type Table } from 'dexie';

export interface User {
  id?: number;
  fullName: string;
  email: string;
  passwordHash: string; // Stored securely if needed locally, though mostly backend
  pin?: string;         // Local app lock PIN (hashed)
  createdAt: Date;
}

export interface Note {
  id?: number;
  title: string;
  description: string;
  type: 'TEXT' | 'VOICE' | 'DOCUMENT';
  voicePath?: string;
  audioBlob?: Blob;
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
  noteId: number;
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
  documentId: number;
  pageNumber: number;
  highlightColor: string;
  noteText?: string;
  createdAt: Date;
}

export interface LedgerEntry {
  id?: number;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: string;
  note?: string;
  date: Date;
  isRecurring: boolean;
  attachedPhotoPath?: string;
  createdAt: Date;
}

export interface UdhaarPayment {
  id: string; // unique string, e.g., Date.now().toString()
  amount: number;
  date: Date;
  note?: string;
}

export interface Udhaar {
  id?: number;
  personName: string;
  amount: number; // total amount
  type: 'TO_GIVE' | 'TO_RECEIVE';
  dueDate?: Date;
  isSettled: boolean;
  payments: UdhaarPayment[]; // tracking partial payments
  note?: string;
  createdAt: Date;
}

export interface Reminder {
  id?: number;
  noteId: number;
  reminderType: 'MEETING' | 'STUDY' | 'WORK' | 'PERSONAL' | 'EVENT';
  dateTime: Date;
  isCompleted: boolean;
}

export class MindVaultDB extends Dexie {
  users!: Table<User>;
  notes!: Table<Note>;
  documents!: Table<Document>;
  annotations!: Table<Annotation>;
  ledgerEntries!: Table<LedgerEntry>;
  udhaar!: Table<Udhaar>;
  reminders!: Table<Reminder>;

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
  }
}

export const db = new MindVaultDB();
