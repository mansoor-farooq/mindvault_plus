import Dexie, { type Table } from 'dexie';

export interface User {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  fullName: string;
  email: string;
  passwordHash: string;
  pin?: string;
  status?: 'ACTIVE' | 'BANNED';
  role?: 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER';
  license?: 'FREE' | 'STARTER' | 'PRO' | 'PRO_PLUS' | 'UNLIMITED' | 'LIFETIME';
  licenseExpiry?: Date | string | null;
  country?: string;
  city?: string;
  religion?: 'muslim' | 'other' | 'prefer_not_to_say';
  namazRemindersEnabled?: boolean;
  businessType?: 'RETAIL_SHOP' | 'MANUFACTURING' | 'RESTAURANT' | 'WHOLESALE' | 'OTHER';
  accountType?: 'INDIVIDUAL' | 'ORGANIZATION';
  organizationName?: string;
  orgRole?: 'OWNER' | 'MEMBER';
  createdAt: Date | string;
}

export interface Note {
  id?: number;
  syncId?: string;
  title: string;
  description: string;
  type?: 'TEXT' | 'VOICE' | 'DOCUMENT';
  voicePath?: string;
  audioBlob?: Blob;
  fileBlob?: Blob;
  filePath?: string;
  category: string;
  tags: string[];
  summary?: string;
  reminderDateTime?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  isFavorite: boolean;
  isDeleted: boolean;
  deletedAt?: Date | string;
}

export interface Budget {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  category: string;
  limitAmount: number;
  month: string; // 'YYYY-MM'
  isDeleted: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Employee {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  name: string;
  role: string; // e.g., 'Stitcher', 'Cutter', 'Helper', 'Manager'
  phone: string;
  baseSalary: number; // Monthly fixed salary
  isActive: boolean;
  isDeleted?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Attendance {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  employeeId: string; // syncId of Employee
  date: string; // YYYY-MM-DD
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY';
  isDeleted?: boolean;
  deletedAt?: Date | string;
  createdAt: Date | string;
}

export interface Advance {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  employeeId: string; // syncId of Employee
  amount: number;
  date: string; // YYYY-MM-DD
  description: string;
  isDeducted: boolean; // True when settled in monthly salary
  isDeleted?: boolean;
  deletedAt?: Date | string;
  createdAt: Date | string;
}

export interface Kameti {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  name: string;
  poolAmount: number;
  perMemberAmount: number;
  memberCount: number; // For backwards compatibility, though now it's number of slots/duration
  durationMonths: number;
  drawDate?: number; // 1-31 (Date of the month)
  status?: 'PENDING' | 'ACTIVE' | 'COMPLETED';
  startDate: string; // YYYY-MM-DD
  members: string[]; // List of names in payout order (index = month - 1)
  isDeleted?: boolean;
  deletedAt?: Date | string;
  createdAt: Date | string;
}

export interface KametiPayment {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  kametiId: string; // syncId of the Kameti
  memberName: string;
  monthNumber: number; // 1 to memberCount
  isPaid: boolean;
  paidAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface SaleSearchHistory {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  brand: string;
  category: string;
  createdAt: Date | string;
}

export interface ChatMessage {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  noteId: string; // Refers to Note.syncId (mandatory FK)
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date | string;
}

export interface Document {
  companyCode?: string; // Tenant Isolation ID
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
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  documentId: string; // Refers to Document.syncId (UUID)
  pageNumber: number;
  highlightColor: string;
  noteText?: string;
  createdAt: Date | string;
}

export interface LedgerEntry {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: string;
  note?: string;
  date: Date | string;
  isRecurring: boolean;
  attachedPhotoPath?: string;
  attachedPhotoBlob?: Blob;
  createdAt: Date | string;
  updatedAt: Date | string;
  isDeleted: boolean;
  deletedAt?: Date | string;
}

export interface UdhaarPayment {
  companyCode?: string; // Tenant Isolation ID
  id: string; // unique string, e.g., Date.now().toString()
  amount: number;
  date: Date | string;
  note?: string;
  proofPath?: string;
  proofBlob?: Blob;
}

export interface Udhaar {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  personName: string;
  amount: number; // total amount
  type: 'TO_GIVE' | 'TO_RECEIVE';
  dueDate?: Date | string;
  isSettled: boolean;
  payments: UdhaarPayment[]; // tracking partial payments
  note?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  isDeleted: boolean;
  deletedAt?: Date | string;
}

export interface Reminder {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  noteId: string; // Refers to Note.syncId (UUID)
  reminderType: 'MEETING' | 'STUDY' | 'WORK' | 'PERSONAL' | 'EVENT';
  dateTime: Date | string;
  isCompleted: boolean;
}

export interface SyncStatus {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  lastSyncAt: Date | string;
}

export interface Bill {
  companyCode?: string; // Tenant Isolation ID
  id?: string;
  syncId?: string;
  title: string;
  amount: number;
  dueDate: Date | string;
  isPaid: boolean;
  category?: string;
  note?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  isDeleted: boolean;
  deletedAt?: Date | string;
}

export interface KhataCustomer {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  name: string;
  phone?: string;
  address?: string;
  openingBalance?: number;
  balance?: number;
  customerType?: 'PERSON' | 'SHOP';
  locationId?: string; // Refers to Location.syncId
  createdAt: Date | string;
  updatedAt: Date | string;
  isDeleted: boolean;
  deletedAt?: Date | string;
}

export interface Location {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  name: string;
  locationType?: 'WAREHOUSE' | 'BRANCH' | 'SHOP' | 'OTHER';
  address?: string;
  city?: string;
  isActive: boolean;
  isDefault?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  isDeleted: boolean;
  deletedAt?: Date | string;
}

export interface Category {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  name: string;
  parentId?: string; // Refers to Category.syncId (self-reference, unlimited depth)
  icon?: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  isDeleted: boolean;
  deletedAt?: Date | string;
}

export interface KhataTransaction {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  customerId: string; // Refers to KhataCustomer.syncId
  type: 'CREDIT' | 'DEBIT' | 'GIVEN' | 'RECEIVED';
  amount: number;
  note?: string;
  description?: string;
  date: Date | string;
  productId?: string;
  quantity?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface Vendor {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  name: string;
  companyName: string;
  phone: string;
  openingBalance: number; // Positive means we owe them
  createdAt: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface PurchaseItem {
  companyCode?: string; // Tenant Isolation ID
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PurchaseOrder {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  vendorId: string;
  poNumber: string;
  date: Date | string;
  items: PurchaseItem[];
  totalAmount: number;
  amountPaid: number; // If amountPaid < totalAmount, it adds to vendor balance
  status: 'PENDING' | 'COMPLETED';
  isDeleted?: boolean;
  deletedAt?: Date | string;
  createdAt: Date | string;
}

export interface Gulluck {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  name: string; // e.g., 'New iPhone 15'
  targetAmount: number;
  savedAmount: number;
  isDeleted?: boolean;
  deletedAt?: Date | string;
  createdAt: Date | string;
}

export interface InvoiceItem {
  id?: string;
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  invoiceNumber: string;
  customerId?: string; // Links to KhataCustomer
  customerName?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'CASH' | 'KHATA' | 'BANK';
  date: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
  createdAt: Date | string;
}

export interface Wallet {
  id?: number;
  companyCode?: string;
  syncId?: string;
  name: string; // e.g., 'Main Cash Drawer', 'Meezan Bank', 'EasyPaisa'
  type: 'CASH' | 'BANK' | 'MOBILE';
  balance: number;
  currency?: string;
  isDefault?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface Expense {
  id?: number;
  companyCode?: string;
  syncId?: string;
  category: string; // Dynamic: 'Tea', 'Fuel', 'Electricity'
  amount: number;
  walletId: string; // References Wallet.syncId
  date: string;
  description: string;
  loggedBy: string; // References User
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface AuditLog {
  id?: number;
  companyCode?: string;
  syncId?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN';
  entity: string; // e.g., 'INVOICE', 'EXPENSE', 'SETTINGS'
  entityId: string;
  userId: string;
  details: string; // JSON string of what changed
  timestamp: string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface BillOfMaterial {
  id?: number;
  companyCode?: string;
  syncId?: string;
  finishedProductId: string; // References Product.syncId
  version?: number;
  status?: 'draft' | 'active' | 'deprecated';
  laborTimeEstimateMinutes?: number;
  overheadRatePerUnit?: number;
  notes?: string;
  rawMaterials?: string; // Kept for backwards compatibility
  costToProduce?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface BOMLineItem {
  id?: number;
  companyCode?: string;
  syncId?: string;
  bomId: string; // References BillOfMaterial.syncId
  componentProductId: string; // References Product.syncId
  quantityPerUnit: number;
  unit?: string;
  wastagePercent?: number;
  notes?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface WorkCenter {
  id?: number;
  companyCode?: string;
  syncId?: string;
  name: string;
  type?: 'MACHINE' | 'ASSEMBLY_LINE' | 'PACKAGING' | 'MANUAL';
  capacityPerHour: number;
  shiftHoursPerDay?: number;
  status?: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
  hourlyCostRate?: number;
  notes?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface WorkOrder {
  id?: number;
  companyCode?: string;
  syncId?: string;
  orderNumber: string;
  productId: string; // References Product.syncId
  bomId: string; // References BillOfMaterial.syncId
  bomVersionSnapshot: number;
  quantityPlanned: number;
  quantityProduced?: number;
  status: 'planned' | 'released' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  scheduledStartDate?: Date | string;
  scheduledEndDate?: Date | string;
  actualStartDate?: Date | string;
  actualEndDate?: Date | string;
  notes?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface WorkOrderOperation {
  id?: number;
  companyCode?: string;
  syncId?: string;
  workOrderId: string; // References WorkOrder.syncId
  workCenterId: string; // References WorkCenter.syncId
  sequenceNumber: number;
  plannedDurationMinutes: number;
  actualStartTime?: Date | string;
  actualEndTime?: Date | string;
  quantityCompleted?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  operatorNotes?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface MachineDowntimeLog {
  id?: number;
  companyCode?: string;
  syncId?: string;
  workCenterId: string; // References WorkCenter.syncId
  startTime: Date | string;
  endTime?: Date | string;
  durationMinutes?: number;
  reasonCode: 'breakdown' | 'maintenance' | 'material_wait' | 'changeover' | 'power_outage' | 'other';
  notes?: string;
  loggedByUserId?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface MaterialConsumption {
  id?: number;
  companyCode?: string;
  syncId?: string;
  workOrderId: string; // References WorkOrder.syncId
  componentProductId: string; // References Product.syncId
  quantityReserved?: number;
  quantityConsumed: number;
  lotNumber?: string;
  serialNumber?: string;
  stockMovementId?: string;
  notes?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface WorkInstruction {
  id?: number;
  companyCode?: string;
  syncId?: string;
  bomId?: string;
  workCenterId?: string;
  title: string;
  version: number;
  content: string;
  effectiveDate?: Date | string;
  status: 'active' | 'superseded';
  createdAt?: Date | string;
  updatedAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface QualityDefectLog {
  id?: number;
  companyCode?: string;
  syncId?: string;
  workOrderId: string; // References WorkOrder.syncId
  workOrderOperationId?: string; // References WorkOrderOperation.syncId
  defectType: 'dimensional' | 'surface' | 'material' | 'assembly' | 'packaging' | 'other';
  quantityDefective: number;
  lotNumber?: string;
  notes?: string;
  loggedByUserId?: number;
  timestamp: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface WorkOrderCostPosting {
  id?: number;
  companyCode?: string;
  syncId?: string;
  workOrderId: string; // References WorkOrder.syncId
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  ledgerEntryId: string;
  postedAt: Date | string;
  postedByUserId: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface ProductionLog {
  id?: number;
  companyCode?: string;
  syncId?: string;
  finishedProductId: string;
  quantityProduced: number;
  date: string;
  loggedBy: string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface PdfTemplate {
  id?: number;
  companyCode?: string;
  syncId?: string;
  name: string;
  elementsData: string; // JSON string of the CanvasElement[]
  createdAt: string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface Product {
  companyCode?: string; // Tenant Isolation ID
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
  price?: number; // Alias for sellingPrice
  stockQuantity?: number; // Current stock count
  currency?: string;
  unit: string;
  lowStockThreshold: number;
  reorderPoint: number;
  barcode?: string;
  imageUrls?: string[];
  supplierName?: string;
  supplierContact?: string;
  warehouseLocation?: string;
  expiryDate?: Date | string;
  weight?: number;
  tags?: string[];
  taxRate?: number;
  discountPercent?: number;
  isActive: boolean;
  locationId?: string; // Refers to Location.syncId
  createdAt: Date | string;
  updatedAt: Date | string;
  isDeleted: boolean;
  deletedAt?: Date | string;
}

export interface ProductVariant {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  productId: string; // Refers to Product.syncId (mandatory)
  name: string; // e.g. "Small", "Red / Medium"
  sku?: string;
  priceOverride?: number; // falls back to the parent Product.sellingPrice when unset
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  isDeleted: boolean;
  deletedAt?: Date | string;
}

export interface StockMovement {
  companyCode?: string; // Tenant Isolation ID
  id?: number;
  syncId?: string;
  productId: string; // Refers to Product.syncId
  variantId?: string; // Refers to ProductVariant.syncId (optional)
  type: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'IN' | 'OUT';
  quantity: number;
  reason?: string;
  note?: string;
  date?: string;
  locationId?: string; // Refers to Location.syncId
  lotNumber?: string;
  serialNumber?: string;
  workOrderId?: string; // Refers to WorkOrder.syncId
  deliveryCost?: number;
  deliveryNote?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
}

export interface FeatureUsage {
  featureKey: string;
  usedCount: number;
  bonusQuota: number;
  dailyAdViews: number;
  lastAdViewAt?: Date | string;
}

export interface Task {
  companyCode?: string;
  id?: number;
  syncId?: string;
  title: string;
  description?: string;
  category: 'PURCHASE' | 'STAFF' | 'FINANCE' | 'INVENTORY' | 'GENERAL' | 'URGENT';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
  dueDate?: string; // YYYY-MM-DD
  completedAt?: Date | string;
  assignedTo?: string; // name or role
  isDeleted?: boolean;
  deletedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ServiceType {
  companyCode?: string;
  id?: number;
  syncId?: string;
  name: string; // e.g. "Doodh", "Kachra", "Pani Tanker", "Newspaper"
  unit: 'litre' | 'trip' | 'fixed' | 'custom' | string;
  defaultRate: number;
  isDeleted?: boolean;
  deletedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ServiceSubscription {
  companyCode?: string;
  id?: number;
  syncId?: string;
  customerId: string; // syncId FK -> khataCustomers
  serviceTypeId: string; // syncId FK -> serviceTypes
  startDate: string; // YYYY-MM-DD
  frequency: 'daily' | 'alternate_days' | 'custom';
  customDays?: number[]; // [1, 2, 3, 4, 5] (0=Sun, 1=Mon, ..., 6=Sat)
  agreedRate: number;
  defaultQuantity?: number;
  status: 'active' | 'paused' | 'ended';
  isDeleted?: boolean;
  deletedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface DeliveryLog {
  companyCode?: string;
  id?: number;
  syncId?: string;
  subscriptionId: string; // syncId FK -> serviceSubscriptions
  date: string; // YYYY-MM-DD
  status: 'received' | 'not_received' | 'skipped';
  quantity?: number;
  markedBy: 'owner' | 'staff' | 'customer';
  markedByUserId?: string | null;
  source: 'app' | 'whatsapp_link';
  verificationToken?: string;
  confirmedAt?: Date | string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Role {
  id?: number;
  companyCode?: string;
  syncId?: string;
  businessId: number;
  name: string;
  description?: string;
  isSystemDefault: boolean;
  isDeleted?: boolean;
  deletedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RoleModulePermission {
  id?: number;
  roleId: string;
  moduleKey: string;
  accessLevel: 'none' | 'view' | 'full';
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface UserRoleAssignment {
  id?: number;
  companyCode?: string;
  syncId?: string;
  userId: number;
  roleId: string;
  businessId: number;
  assignedBy?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PermissionAuditLog {
  id?: number;
  companyCode?: string;
  syncId?: string;
  businessId: number;
  actorUserId: number;
  action: string;
  targetType: string;
  targetId: string;
  details?: any;
  createdAt: Date | string;
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
  wallets!: Table<Wallet>;
  expenses!: Table<Expense>;
  auditLogs!: Table<AuditLog>;
  boms!: Table<BillOfMaterial>;
  productionLogs!: Table<ProductionLog>;
  pdfTemplates!: Table<PdfTemplate>;
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
  employees!: Table<Employee>;
  attendance!: Table<Attendance>;
  get attendances(): Table<Attendance> {
    return this.attendance;
  }
  advances!: Table<Advance>;
  invoices!: Table<Invoice>;
  gullucks!: Table<Gulluck>;
  vendors!: Table<Vendor>;
  purchaseOrders!: Table<PurchaseOrder>;
  tasks!: Table<Task>;
  serviceTypes!: Table<ServiceType>;
  serviceSubscriptions!: Table<ServiceSubscription>;
  deliveryLogs!: Table<DeliveryLog>;
  roles!: Table<Role>;
  roleModulePermissions!: Table<RoleModulePermission>;
  userRoleAssignments!: Table<UserRoleAssignment>;
  permissionAuditLogs!: Table<PermissionAuditLog>;
  bomLineItems!: Table<BOMLineItem>;
  workCenters!: Table<WorkCenter>;
  workOrders!: Table<WorkOrder>;
  workOrderOperations!: Table<WorkOrderOperation>;
  machineDowntimeLogs!: Table<MachineDowntimeLog>;
  materialConsumptions!: Table<MaterialConsumption>;
  workInstructions!: Table<WorkInstruction>;
  qualityDefectLogs!: Table<QualityDefectLog>;
  workOrderCostPostings!: Table<WorkOrderCostPosting>;

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

    this.version(27).stores({
      users: '++id, companyCode, email',
      notes: '++id, companyCode, syncId, category, isPinned',
      documents: '++id, companyCode, syncId, noteId, folder',
      annotations: '++id, companyCode, syncId, documentId, pageNumber',
      ledgerEntries: '++id, companyCode, syncId, type, date',
      udhaar: '++id, companyCode, syncId, personName, type, isSettled',
      reminders: '++id, companyCode, syncId, noteId, reminderType, dateTime',
      syncStatus: '++id, companyCode',
      bills: '++id, companyCode, syncId, dueDate, isPaid',
      budgets: '++id, companyCode, syncId, month',
      saleSearchHistory: '++id, companyCode, syncId, timestamp',
      kametis: '++id, companyCode, syncId, status',
      kametiPayments: '++id, companyCode, syncId, kametiId, memberId, monthIndex',
      employees: '++id, companyCode, syncId, isActive',
      attendance: '++id, companyCode, syncId, employeeId, date',
      advances: '++id, companyCode, syncId, employeeId, isDeducted',
      vendors: '++id, companyCode, syncId, name',
      purchaseOrders: '++id, companyCode, syncId, vendorId, poNumber',
      invoices: '++id, companyCode, syncId, invoiceNumber, customerId, date',
      gullucks: '++id, companyCode, syncId, name',
      khataCustomers: '++id, companyCode, syncId, name',
      khataTransactions: '++id, companyCode, syncId, customerId, date',
      products: '++id, companyCode, syncId, categoryId, name',
      productVariants: '++id, companyCode, syncId, productId',
      stockMovements: '++id, companyCode, syncId, productId, type, date',
      featureUsage: '++id, companyCode, syncId, featureKey',
      locations: '++id, companyCode, syncId, name',
      categories: '++id, companyCode, syncId, name, parentId',
      chatMessages: '++id, companyCode, syncId, noteId',
      pdfTemplates: '++id, companyCode, syncId, name',
      wallets: '++id, companyCode, syncId, type',
      expenses: '++id, companyCode, syncId, walletId, date',
      auditLogs: '++id, companyCode, syncId, entity, timestamp',
      boms: '++id, companyCode, syncId, finishedProductId',
      productionLogs: '++id, companyCode, syncId, finishedProductId, date',
    });

    this.version(28).stores({
      tasks: '++id, companyCode, syncId, status, priority, category, dueDate',
    });
    
    this.version(29).stores({
      notes: '++id, companyCode, syncId, category, isPinned, updatedAt'
    });
    
    this.version(30).stores({
      chatMessages: '++id, companyCode, syncId, noteId, createdAt'
    });
    
    
    this.version(31).stores({
      users: '++id, companyCode, email, createdAt, updatedAt, deletedAt, isDeleted',
      notes: '++id, companyCode, syncId, category, isPinned, createdAt, updatedAt, deletedAt, isDeleted',
      documents: '++id, companyCode, syncId, noteId, folder, createdAt, updatedAt, deletedAt, isDeleted',
      annotations: '++id, companyCode, syncId, documentId, pageNumber, createdAt, updatedAt, deletedAt, isDeleted',
      ledgerEntries: '++id, companyCode, syncId, type, date, createdAt, updatedAt, deletedAt, isDeleted',
      udhaar: '++id, companyCode, syncId, personName, type, isSettled, createdAt, updatedAt, deletedAt, isDeleted',
      reminders: '++id, companyCode, syncId, noteId, reminderType, dateTime, createdAt, updatedAt, deletedAt, isDeleted',
      syncStatus: '++id, companyCode, createdAt, updatedAt, deletedAt, isDeleted',
      bills: '++id, companyCode, syncId, dueDate, isPaid, createdAt, updatedAt, deletedAt, isDeleted',
      budgets: '++id, companyCode, syncId, month, createdAt, updatedAt, deletedAt, isDeleted',
      saleSearchHistory: '++id, companyCode, syncId, timestamp, createdAt, updatedAt, deletedAt, isDeleted',
      kametis: '++id, companyCode, syncId, status, createdAt, updatedAt, deletedAt, isDeleted',
      kametiPayments: '++id, companyCode, syncId, kametiId, memberId, monthIndex, createdAt, updatedAt, deletedAt, isDeleted',
      employees: '++id, companyCode, syncId, isActive, createdAt, updatedAt, deletedAt, isDeleted',
      attendance: '++id, companyCode, syncId, employeeId, date, createdAt, updatedAt, deletedAt, isDeleted',
      advances: '++id, companyCode, syncId, employeeId, isDeducted, createdAt, updatedAt, deletedAt, isDeleted',
      vendors: '++id, companyCode, syncId, name, createdAt, updatedAt, deletedAt, isDeleted',
      purchaseOrders: '++id, companyCode, syncId, vendorId, poNumber, createdAt, updatedAt, deletedAt, isDeleted',
      invoices: '++id, companyCode, syncId, invoiceNumber, customerId, date, createdAt, updatedAt, deletedAt, isDeleted',
      gullucks: '++id, companyCode, syncId, name, createdAt, updatedAt, deletedAt, isDeleted',
      khataCustomers: '++id, companyCode, syncId, name, createdAt, updatedAt, deletedAt, isDeleted',
      khataTransactions: '++id, companyCode, syncId, customerId, date, createdAt, updatedAt, deletedAt, isDeleted',
      products: '++id, companyCode, syncId, categoryId, name, createdAt, updatedAt, deletedAt, isDeleted',
      productVariants: '++id, companyCode, syncId, productId, createdAt, updatedAt, deletedAt, isDeleted',
      stockMovements: '++id, companyCode, syncId, productId, type, date, createdAt, updatedAt, deletedAt, isDeleted',
      featureUsage: '++id, companyCode, syncId, featureKey, createdAt, updatedAt, deletedAt, isDeleted',
      locations: '++id, companyCode, syncId, name, createdAt, updatedAt, deletedAt, isDeleted',
      categories: '++id, companyCode, syncId, name, parentId, createdAt, updatedAt, deletedAt, isDeleted',
      chatMessages: '++id, companyCode, syncId, noteId, createdAt, updatedAt, deletedAt, isDeleted',
      pdfTemplates: '++id, companyCode, syncId, name, createdAt, updatedAt, deletedAt, isDeleted',
      wallets: '++id, companyCode, syncId, type, createdAt, updatedAt, deletedAt, isDeleted',
      expenses: '++id, companyCode, syncId, walletId, date, createdAt, updatedAt, deletedAt, isDeleted',
      auditLogs: '++id, companyCode, syncId, entity, timestamp, createdAt, updatedAt, deletedAt, isDeleted',
      boms: '++id, companyCode, syncId, finishedProductId, createdAt, updatedAt, deletedAt, isDeleted',
      productionLogs: '++id, companyCode, syncId, finishedProductId, date, createdAt, updatedAt, deletedAt, isDeleted',
      tasks: '++id, companyCode, syncId, status, priority, category, dueDate, createdAt, updatedAt, deletedAt, isDeleted'
    });

    this.version(32).stores({
      serviceTypes: '++id, companyCode, syncId, name, unit, defaultRate, createdAt, updatedAt, deletedAt, isDeleted',
      serviceSubscriptions: '++id, companyCode, syncId, customerId, serviceTypeId, startDate, frequency, status, createdAt, updatedAt, deletedAt, isDeleted',
      deliveryLogs: '++id, companyCode, syncId, subscriptionId, date, status, markedBy, source, verificationToken, [subscriptionId+date], createdAt, updatedAt, deletedAt, isDeleted',
    });

    this.version(33).stores({
      roles: '++id, companyCode, syncId, businessId, name, isSystemDefault, createdAt, updatedAt, deletedAt, isDeleted',
      roleModulePermissions: '++id, roleId, moduleKey, accessLevel, [roleId+moduleKey], createdAt, updatedAt',
      userRoleAssignments: '++id, companyCode, syncId, userId, roleId, businessId, [userId+businessId], createdAt, updatedAt',
      permissionAuditLogs: '++id, companyCode, syncId, businessId, actorUserId, action, createdAt'
    });

    this.version(34).stores({
      boms: '++id, companyCode, syncId, finishedProductId, status, version, createdAt, updatedAt, deletedAt, isDeleted',
      bomLineItems: '++id, companyCode, syncId, bomId, componentProductId, createdAt, updatedAt, deletedAt, isDeleted',
      workCenters: '++id, companyCode, syncId, name, type, status, createdAt, updatedAt, deletedAt, isDeleted',
      workOrders: '++id, companyCode, syncId, orderNumber, productId, bomId, status, priority, createdAt, updatedAt, deletedAt, isDeleted',
      workOrderOperations: '++id, companyCode, syncId, workOrderId, workCenterId, sequenceNumber, status, createdAt, updatedAt, deletedAt, isDeleted',
      machineDowntimeLogs: '++id, companyCode, syncId, workCenterId, reasonCode, startTime, createdAt, updatedAt, deletedAt, isDeleted',
      materialConsumptions: '++id, companyCode, syncId, workOrderId, componentProductId, lotNumber, serialNumber, createdAt, updatedAt, deletedAt, isDeleted',
      workInstructions: '++id, companyCode, syncId, bomId, workCenterId, status, version, createdAt, updatedAt, deletedAt, isDeleted',
      qualityDefectLogs: '++id, companyCode, syncId, workOrderId, workOrderOperationId, defectType, timestamp, createdAt, updatedAt, deletedAt, isDeleted',
      workOrderCostPostings: '++id, companyCode, syncId, workOrderId, ledgerEntryId, createdAt, updatedAt, deletedAt, isDeleted',
      stockMovements: '++id, companyCode, syncId, productId, variantId, locationId, lotNumber, serialNumber, workOrderId, type, date, createdAt, updatedAt, deletedAt, isDeleted',
    });

    const generateUUID = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    const applyTenantHooks = (table?: Table) => {
      if (!table || typeof table.hook !== 'function') return;
      table.hook('creating', function (primKey, obj, trans) {
        if (!obj.syncId) {
          obj.syncId = generateUUID();
        }
      });
    };

    applyTenantHooks(this.notes);
    applyTenantHooks(this.documents);
    applyTenantHooks(this.annotations);
    applyTenantHooks(this.ledgerEntries);
    applyTenantHooks(this.udhaar);
    applyTenantHooks(this.budgets);
    applyTenantHooks(this.saleSearchHistory);
    applyTenantHooks(this.kametis);
    applyTenantHooks(this.kametiPayments);
    applyTenantHooks(this.employees);
    applyTenantHooks(this.attendance);
    applyTenantHooks(this.advances);
    applyTenantHooks(this.invoices);
    applyTenantHooks(this.gullucks);
    applyTenantHooks(this.vendors);
    applyTenantHooks(this.purchaseOrders);
    applyTenantHooks(this.reminders);
    applyTenantHooks(this.bills);
    applyTenantHooks(this.khataCustomers);
    applyTenantHooks(this.khataTransactions);
    applyTenantHooks(this.products);
    applyTenantHooks(this.stockMovements);
    applyTenantHooks(this.locations);
    applyTenantHooks(this.categories);
    applyTenantHooks(this.productVariants);
    applyTenantHooks(this.chatMessages);
    applyTenantHooks(this.pdfTemplates);
    applyTenantHooks(this.wallets);
    applyTenantHooks(this.expenses);
    applyTenantHooks(this.auditLogs);
    applyTenantHooks(this.boms);
    applyTenantHooks(this.productionLogs);
    applyTenantHooks(this.tasks);
    applyTenantHooks(this.serviceTypes);
    applyTenantHooks(this.serviceSubscriptions);
    applyTenantHooks(this.deliveryLogs);
    applyTenantHooks(this.roles);
    applyTenantHooks(this.userRoleAssignments);
    applyTenantHooks(this.permissionAuditLogs);
    applyTenantHooks(this.bomLineItems);
    applyTenantHooks(this.workCenters);
    applyTenantHooks(this.workOrders);
    applyTenantHooks(this.workOrderOperations);
    applyTenantHooks(this.machineDowntimeLogs);
    applyTenantHooks(this.materialConsumptions);
    applyTenantHooks(this.workInstructions);
    applyTenantHooks(this.qualityDefectLogs);
    applyTenantHooks(this.workOrderCostPostings);
  }
}

export const db = new MindVaultDB();
