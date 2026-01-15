
import { Part, Notification, Transaction, AppConfig, ColumnDefinition } from './types';

const PARTS_KEY = 'partflow_parts_v3';
const NOTIFICATIONS_KEY = 'partflow_notifications_v3';
const CONFIG_KEY = 'partflow_config_v3';

const DEFAULT_COLUMNS: ColumnDefinition[] = [
  { id: 'partNumber', label: 'Reference ID', type: 'text', isCore: true },
  { id: 'name', label: 'Part Name', type: 'text', isCore: true },
  { id: 'manufacturingShop', label: 'Shop/Line', type: 'text', isCore: true },
  { id: 'carModel', label: 'Car Model', type: 'text', isCore: true },
  { id: 'currentStock', label: 'Stock', type: 'number', isCore: true },
  { id: 'targetStock', label: 'Target', type: 'number', isCore: true },
  { id: 'supplierName', label: 'Supplier', type: 'text', isCore: true },
];

// Added missing locations property to DEFAULT_CONFIG to comply with AppConfig interface
const DEFAULT_CONFIG: AppConfig = {
  appName: "PartFlow Enterprise",
  primaryColor: "#0f172a",
  accentColor: "#3b82f6",
  carModels: ['Apex X1', 'Terra V8', 'Zenith EV'],
  manufacturingShops: ['Front End (FE)', 'Front Floor (FF)', 'Underbody Mainline (UB)', 'Rear Floor (RF)', 'Subframe (SF)'],
  locations: ['SUPPLIER', 'WAREHOUSE', 'BODY_SHOP', 'FE', 'RF', 'FF', 'UB', 'SF'],
  requiredFields: ['partNumber', 'name', 'currentStock'],
  columns: DEFAULT_COLUMNS,
  labels: {
    inventory: "Asset Registry",
    dashboard: "Command Center",
    suppliers: "Vendor Network"
  },
  updatedAt: Date.now()
};

export const storageService = {
  getConfig: (): AppConfig => {
    const data = localStorage.getItem(CONFIG_KEY);
    return data ? JSON.parse(data) : DEFAULT_CONFIG;
  },

  saveConfig: (config: AppConfig) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    document.documentElement.style.setProperty('--primary-color', config.primaryColor);
  },

  getParts: (): Part[] => {
    const data = localStorage.getItem(PARTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  savePart: (part: Part) => {
    const parts = storageService.getParts();
    const index = parts.findIndex(p => p.id === part.id);
    if (index >= 0) parts[index] = part;
    else parts.push(part);
    localStorage.setItem(PARTS_KEY, JSON.stringify(parts));
    storageService.checkLowStock(part);
  },

  deletePart: (id: string) => {
    const parts = storageService.getParts();
    const updated = parts.filter(p => p.id !== id);
    localStorage.setItem(PARTS_KEY, JSON.stringify(updated));
  },

  importCSV: (csvText: string): number => {
    const config = storageService.getConfig();
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return 0;
    
    const parseRow = (row: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else current += char;
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const headers = parseRow(lines[0]);
    const newParts: Part[] = [];

    const labelToId: Record<string, string> = {};
    config.columns.forEach(col => labelToId[col.label] = col.id);

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseRow(lines[i]);
      const part: any = { 
        id: Math.random().toString(36).substr(2, 9), 
        history: [], 
        description: '', 
        imageUrl: `https://picsum.photos/seed/${Math.random()}/400/300`,
        lastReceivedAt: null
      };
      
      headers.forEach((label, idx) => {
        const id = labelToId[label] || label; 
        const val = values[idx];
        const colDef = config.columns.find(c => c.id === id);
        if (colDef?.type === 'number') part[id] = parseInt(val) || 0;
        else part[id] = val || '';
      });
      newParts.push(part as Part);
    }

    const existingParts = storageService.getParts();
    localStorage.setItem(PARTS_KEY, JSON.stringify([...existingParts, ...newParts]));
    return newParts.length;
  },

  exportCSV: () => {
    const config = storageService.getConfig();
    const parts = storageService.getParts();
    if (parts.length === 0) return alert("No data to export");

    const exportHeaders = config.columns.map(c => c.label);
    const exportKeys = config.columns.map(c => c.id);

    const rows = parts.map(p => {
      return exportKeys.map(k => `"${String((p as any)[k] || '').replace(/"/g, '""')}"`).join(',');
    }).join('\n');

    const csvContent = "data:text/csv;charset=utf-8," + exportHeaders.join(',') + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_master_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  updateStock: (partId: string, quantity: number, type: 'RECEIVE' | 'ISSUE', notes?: string) => {
    const parts = storageService.getParts();
    const partIndex = parts.findIndex(p => p.id === partId);
    if (partIndex === -1) return;
    const part = parts[partIndex];
    const newStock = type === 'RECEIVE' ? part.currentStock + quantity : part.currentStock - quantity;
    const updatedPart = {
      ...part,
      currentStock: Math.max(0, newStock),
      lastReceivedAt: type === 'RECEIVE' ? new Date().toISOString() : part.lastReceivedAt,
      history: [{ id: Math.random().toString(36).substr(2, 9), date: new Date().toISOString(), quantity, type, notes }, ...part.history].slice(0, 50)
    };
    parts[partIndex] = updatedPart;
    localStorage.setItem(PARTS_KEY, JSON.stringify(parts));
    storageService.checkLowStock(updatedPart);
    return updatedPart;
  },

  getNotifications: (): Notification[] => JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]'),

  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const notifications = storageService.getNotifications();
    const newNotif = { ...notification, id: Math.random().toString(36).substr(2, 9), timestamp: new Date().toISOString(), read: false };
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([newNotif, ...notifications].slice(0, 100)));
  },

  markAsRead: (id: string) => {
    const notifications = storageService.getNotifications();
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.map(n => n.id === id ? { ...n, read: true } : n)));
  },

  checkLowStock: (part: Part) => {
    if (part.currentStock <= 5) {
      storageService.addNotification({ partId: part.id, partName: part.name, message: `Low Stock Alert: ${part.name} is at ${part.currentStock} units.`, type: 'WARNING' });
    }
  }
};
