import Dexie, { type Table } from 'dexie';

export interface User {
  id?: number;
  fullName: string;
  email: string;
  passwordHash: string; // Stored securely if needed locally, though mostly backend
  pin?: string;         // Local app lock PIN (hashed)
  status?: 'ACTIVE' | 'BANNED';
  license?: 'FREE' | 'PRO' | 'LIFETIME';
  country?: string;
  city?: string;
  religion?: 'muslim' | 'other' | 'prefer_not_to_say';
  namazRemindersEnabled?: boolean;
  businessType?: 'RETAIL_SHOP' | 'MANUFACTURING' | 'RESTAURANT' | 'WHOLESALE' | 'OTHER';
  accountType?: 'INDIVIDUAL' | 'ORGANIZATION';
  organizationName?: string; // only used at registration time to create the org server-side
  orgRole?: 'OWNER' | 'MEMBER';
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
  summary?: string;
  reminderDateTime?: Date;
  createdAt: Date;
  updatedAt: Date;
  isFavorite: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface Budget {
  id?: number;
  syncId?: string;
  category: string;
  limitAmount: number;
  month: string; // 'YYYY-MM'
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Kameti {
  id?: number;
  syncId?: string;
  name: string;
  poolAmount: number;
  perMemberAmount: number;
  memberCount: number;
  startDate: string; // YYYY-MM-DD
  members: string[]; // List of names in payout order
  createdAt: Date;
}

export interface KametiPayment {
  id?: number;
  syncId?: string;
  kametiId: string; // syncId of the Kameti
  memberName: string;
  monthNumber: number; // 1 to memberCount
  isPaid: boolean;
  paidAt?: Date;
}

export interface SaleSearchHistory {
  id?: number;
  syncId?: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  brand: string;
  category: string;
  createdAt: Date;
}

export interface ChatMessage {
  id?: number;
  syncId?: string;
  noteId: string; // Refers to Note.syncId (mandatory FK)
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
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
  openingBalance?: number;
  customerType?: 'PERSON' | 'SHOP';
  locationId?: string; // Refers to Location.syncId
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface Location {
  id?: number;
  syncId?: string;
  name: string;
  locationType?: 'WAREHOUSE' | 'BRANCH' | 'SHOP' | 'OTHER';
  address?: string;
  city?: string;
  isActive: boolean;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface Category {
  id?: number;
  syncId?: string;
  name: string;
  parentId?: string; // Refers to Category.syncId (self-reference, unlimited depth)
  icon?: string;
  isActive: boolean;
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
  productId?: string;
  quantity?: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface Product {
  id?: number;
  syncId?: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  categoryId?: string; // Refers to Category.syncId (structured FK alongside the free-text category name)
  brand?: string;
  costPrice?: number;
  sellingPrice: number;
  currency?: string;
  unit: string;
  lowStockThreshold: number;
  reorderPoint: number;
  barcode?: string;
  imageUrls?: string[];
  supplierName?: string;
  supplierContact?: string;
  warehouseLocation?: string;
  expiryDate?: Date;
  weight?: number;
  tags?: string[];
  taxRate?: number;
  discountPercent?: number;
  isActive: boolean;
  locationId?: string; // Refers to Location.syncId
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface ProductVariant {
  id?: number;
  syncId?: string;
  productId: string; // Refers to Product.syncId (mandatory)
  name: string; // e.g. "Small", "Red / Medium"
  sku?: string;
  priceOverride?: number; // falls back to the parent Product.sellingPrice when unset
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface StockMovement {
  id?: number;
  syncId?: string;
  productId: string; // Refers to Product.syncId
  variantId?: string; // Refers to ProductVariant.syncId (optional)
  type: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';
  quantity: number;
  reason?: string;
  locationId?: string; // Refers to Location.syncId
  deliveryCost?: number;
  deliveryNote?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface FeatureUsage {
  id?: number;
  featureKey: string;
  usedCount: number;
  bonusQuota: number;
  dailyAdViews: number;
  lastAdViewAt?: Date;
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
  products!: Table<Product>;
  stockMovements!: Table<StockMovement>;
  featureUsage!: Table<FeatureUsage>;
  locations!: Table<Location>;
  categories!: Table<Category>;
  productVariants!: Table<ProductVariant>;
  chatMessages!: Table<ChatMessage>;
  budgets!: Table<Budget>;
  saleSearchHistory!: Table<SaleSearchHistory>;
  kametis!: Table<Kameti>;
  kametiPayments!: Table<KametiPayment>;

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

    this.version(8).stores({
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
      khataTransactions: '++id, syncId, customerId, type, date, updatedAt, isDeleted',
      products: '++id, syncId, sku, name, category, isDeleted, updatedAt',
      stockMovements: '++id, syncId, productId, type, isDeleted',
      featureUsage: '++id, featureKey'
    });

    this.version(9).stores({
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
      khataTransactions: '++id, syncId, customerId, type, date, updatedAt, isDeleted',
      products: '++id, syncId, sku, name, category, isDeleted, createdAt, updatedAt',
      stockMovements: '++id, syncId, productId, type, isDeleted, createdAt, updatedAt',
      featureUsage: '++id, featureKey'
    });

    this.version(10).stores({
      users: '++id, email',
      notes: '++id, syncId, type, category, createdAt, updatedAt, isFavorite, isDeleted',
      documents: '++id, syncId, noteId, folder',
      annotations: '++id, syncId, documentId, pageNumber',
      ledgerEntries: '++id, syncId, type, category, date, updatedAt, isDeleted',
      udhaar: '++id, syncId, personName, type, isSettled, updatedAt, isDeleted',
      reminders: '++id, syncId, noteId, reminderType, dateTime, isCompleted',
      syncStatus: '++id',
      bills: '++id, syncId, dueDate, isPaid, isDeleted, updatedAt',
      khataCustomers: '++id, syncId, name, phone, customerType, updatedAt, isDeleted',
      khataTransactions: '++id, syncId, customerId, type, date, productId, updatedAt, isDeleted',
      products: '++id, syncId, sku, name, category, isDeleted, createdAt, updatedAt',
      stockMovements: '++id, syncId, productId, type, isDeleted, createdAt, updatedAt',
      featureUsage: '++id, featureKey'
    });

    // v11: adds Note.summary, written by the AI Note Assistant (Gemini-backed
    // /api/ai/notes/summarize). No index needed - only ever read/written by id.
    this.version(11).stores({
      notes: '++id, syncId, type, category, createdAt, updatedAt, isFavorite, isDeleted'
    });

    // v12: adds User.country/city/religion/namazRemindersEnabled, collected at
    // registration. None are queried by value, so no new index is needed.
    this.version(12).stores({
      users: '++id, email'
    });

    // v13: adds Location (structured branch/warehouse entity), plus optional
    // locationId on Product/StockMovement/KhataCustomer, businessType on User, and
    // deliveryCost/deliveryNote on StockMovement. All new fields are optional, so
    // no .upgrade() is needed - existing rows are valid with them left undefined.
    this.version(13).stores({
      locations: '++id, syncId, name, isDeleted, updatedAt',
      products: '++id, syncId, sku, name, category, isDeleted, createdAt, updatedAt, locationId',
      stockMovements: '++id, syncId, productId, type, isDeleted, createdAt, updatedAt, locationId',
      khataCustomers: '++id, syncId, name, phone, customerType, updatedAt, isDeleted, locationId',
      users: '++id, email'
    });

    // v14: adds Category (self-referencing, unlimited-depth tree via parentId), plus
    // optional categoryId on Product for a structured FK alongside the existing free-text
    // category field (kept for backward-compat display). No .upgrade() needed - categoryId
    // is optional so existing product rows are valid with it left undefined.
    this.version(14).stores({
      categories: '++id, syncId, name, parentId, isDeleted, updatedAt',
      products: '++id, syncId, sku, name, category, isDeleted, createdAt, updatedAt, locationId, categoryId',
    });

    // v15: adds ProductVariant (optional per-product size/color options, e.g.
    // Small/Medium/Large), plus optional variantId on StockMovement so a variant can
    // carry its own stock. Variants are opt-in - a product with none behaves exactly as
    // before. variantId is optional, so no .upgrade() is needed - existing stock
    // movement rows are valid with it left undefined.
    this.version(15).stores({
      productVariants: '++id, syncId, productId, isDeleted, updatedAt',
      stockMovements: '++id, syncId, productId, type, isDeleted, createdAt, updatedAt, locationId, variantId',
    });

    // v16: adds ChatMessage (per-note AI chat thread - "continue chatting to enhance this
    // idea"). Brand new table, no .upgrade() needed.
    this.version(16).stores({
      chatMessages: '++id, syncId, noteId, createdAt',
    });

    this.version(17).stores({
      budgets: '++id, syncId, category, month, isDeleted'
    });

    this.version(18).stores({
      saleSearchHistory: '++id, syncId, brand, category, createdAt'
    });

    this.version(19).stores({
      kametis: '++id, syncId, name, startDate',
      kametiPayments: '++id, syncId, kametiId, memberName, monthNumber, isPaid'
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
    applySyncIdHook(this.budgets);
    applySyncIdHook(this.saleSearchHistory);
    applySyncIdHook(this.kametis);
    applySyncIdHook(this.kametiPayments);
    applySyncIdHook(this.reminders);
    applySyncIdHook(this.bills);
    applySyncIdHook(this.khataCustomers);
    applySyncIdHook(this.khataTransactions);
    applySyncIdHook(this.products);
    applySyncIdHook(this.stockMovements);
    applySyncIdHook(this.locations);
    applySyncIdHook(this.categories);
    applySyncIdHook(this.productVariants);
    applySyncIdHook(this.chatMessages);
  }
}

export const db = new MindVaultDB();




