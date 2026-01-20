export interface User {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'ENGINEER' | 'SUPPLIER';
  assignedLine: string; // Shop name or 'ALL' or Supplier Name
}

export interface Supplier {
  id: string;
  name: string;
  contactEmail: string;
  assignedParts: string[]; // List of part IDs
  performanceRating: number;
}

export interface ColumnDefinition {
  id: string;
  label: string;
  type: 'text' | 'number' | 'image';
  isCore?: boolean;
  isPrimary?: boolean;
}

export type PartLocation = 'SUPPLIER' | 'WAREHOUSE' | 'BODY_SHOP' | 'FE' | 'RF' | 'FF' | 'UB' | 'SF';

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

export interface TransferPart {
  partId: string;
  partNumber: string;
  name: string;
  quantity: number;
}

export interface Transfer {
  id: string;
  timestamp: string;
  parts: TransferPart[];
  fromLocation: PartLocation;
  toLocation: PartLocation;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  supplierId: string;
  supplierName: string;
  supplierSignature?: string; // Digital token (Excel friendly)
  engineerId?: string;
  engineerName?: string;
  engineerSignature?: string; // Digital token (Excel friendly)
}

export interface Conflict {
  partId: string;
  localVersion: Part;
  remoteVersion: Part;
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
  labels: {
    inventory: string;
    dashboard: string;
    suppliers: string;
    transfers: string;
    alerts: string;
    admin: string;
    dashboardHeadline?: string;
    dashboardSubline?: string;
    inventoryHeadline?: string;
    inventorySubline?: string;
    transfersHeadline?: string;
    transfersSubline?: string;
    suppliersHeadline?: string;
    suppliersSubline?: string;
  };
  adminEmail?: string;
  adminPassword?: string;
  updatedAt: number;
}

export type ViewType = 'DASHBOARD' | 'INVENTORY' | 'TRANSFERS' | 'SUPPLIERS' | 'ALERTS' | 'ADMIN';
export type InventoryDisplayMode = 'GRID' | 'SHEET';