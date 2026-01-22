

export interface User {
  id: string;
  username: string;
  email: string;
  password?: string;
  role: 'ADMIN' | 'INTERNAL_LOGISTIC' | 'ENGINEER' | 'SUPPLIER';
  assignedLine: string; // Shop name or 'ALL'
}

export interface ColumnDefinition {
  id: string;
  label: string;
  type: 'text' | 'number' | 'image';
  isCore?: boolean;
  isPrimary?: boolean;
}

export type PartLocation = 'SUPPLIER' | 'WAREHOUSE' | 'BODY_SHOP' | 'FE' | 'RF' | 'FF' | 'UB' | 'SF';

// Add missing Supplier interface
export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface Part {
  id: string;
  partNumber: string;
  name: string;
  description: string;
  imageUrl: string;
  carModel: string;
  manufacturingShop: string;
  currentLocation: PartLocation;
  currentStock: number;
  targetStock: number;
  supplierName: string;
  lastReceivedAt: string | null;
  history: Transaction[];
  updatedAt: number; 
  lastModifiedBy?: string;
  [key: string]: any;
}

export interface Transfer {
  id: string;
  timestamp: string;
  parts: Array<{ partId: string; partNumber: string; name: string; quantity: number }>;
  fromLocation: PartLocation;
  toLocation: PartLocation;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  supplierId: string;
  supplierName: string;
  supplierSignature?: string;
  engineerId?: string;
  engineerName?: string;
  engineerSignature?: string;
}

export interface Transaction {
  id: string;
  date: string;
  quantity: number;
  type: 'RECEIVE' | 'ISSUE' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  notes?: string;
}

export interface Notification {
  id: string;
  partId: string;
  partName: string;
  message: string;
  type: 'WARNING' | 'INFO' | 'ACTION_REQUIRED';
  timestamp: string;
  read: boolean;
}

export interface AppConfig {
  appName: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  carModels: string[];
  manufacturingShops: string[];
  locations: PartLocation[];
  requiredFields: string[];
  columns: ColumnDefinition[];
  users: User[];
  labels: Record<string, string>;
  updatedAt: number;
}

export type ViewType = 'DASHBOARD' | 'INVENTORY' | 'TRANSFERS' | 'SUPPLIERS' | 'ALERTS' | 'ADMIN';
export type InventoryDisplayMode = 'GRID' | 'SHEET';