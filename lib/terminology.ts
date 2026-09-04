import { User } from './db';

export type TermKey = 'staff' | 'inventory' | 'pos' | 'customers' | 'vendors' | 'dashboard' | 'finance' | 'production';

export function getTerm(user: User | null, key: TermKey): string {
  const type = user?.businessType || 'OTHER';

  const dict: Record<string, Record<TermKey, string>> = {
    'MANUFACTURING': {
      staff: 'Factory Staff',
      inventory: 'Raw Materials',
      pos: 'Factory Billing',
      customers: 'Client Khata',
      vendors: 'Raw Material Suppliers',
      dashboard: 'Factory Overview',
      finance: 'Factory Finance',
      production: 'Manufacturing Engine',
    },
    'RESTAURANT': {
      staff: 'Restaurant Staff',
      inventory: 'Ingredients & Pantry',
      pos: 'Dine-in / Takeaway',
      customers: 'Customer Tabs',
      vendors: 'Food Vendors',
      dashboard: 'Restaurant Dashboard',
      finance: 'Restaurant Cashier',
      production: 'Kitchen Assembly',
    },
    'RETAIL_SHOP': {
      staff: 'Shop Staff',
      inventory: 'Shop Inventory',
      pos: 'Retail POS',
      customers: 'Customer Khata',
      vendors: 'Wholesalers',
      dashboard: 'Shop Dashboard',
      finance: 'Till & Cash Ledger',
      production: 'Kit Assembly',
    },
    'WHOLESALE': {
      staff: 'Warehouse Staff',
      inventory: 'Warehouse Stock',
      pos: 'B2B Billing',
      customers: 'Retailer Khata',
      vendors: 'Manufacturers',
      dashboard: 'Wholesale Overview',
      finance: 'B2B Ledger',
      production: 'Packaging & Kitting',
    },
    'OTHER': {
      staff: 'Staff & HR',
      inventory: 'Inventory',
      pos: 'ERP & Billing (POS)',
      customers: 'Customer Khata',
      vendors: 'Suppliers (Purchases)',
      dashboard: 'Dashboard',
      finance: 'Cash Ledger',
      production: 'Production & Assembly',
    }
  };

  return dict[type][key] || dict['OTHER'][key];
}

