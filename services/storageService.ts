import { Part, Notification, AppConfig, ColumnDefinition, User, Conflict, Transfer, Supplier, PartLocation } from '../types';
import { LOW_STOCK_THRESHOLD } from '../constants';

const PARTS_KEY = 'partflow_parts_v7';
const NOTIFICATIONS_KEY = 'partflow_notifications_v7';
const CONFIG_KEY = 'partflow_config_v7';
const USER_KEY = 'partflow_current_user_v7';
const TRANSFERS_KEY = 'partflow_transfers_v7';
const SUPPLIERS_KEY = 'partflow_suppliers_v7';

// Multi-source credential detection (Vite, Vercel, Process)
const getEnv = (key: string) => {
  return (import.meta as any).env?.[`VITE_${key}`] || 
         (import.meta as any).env?.[key] || 
         (process as any).env?.[key];
};

const REDIS_URL = getEnv('UPSTASH_REDIS_REST_URL')?.replace(/\/$/, '');
const REDIS_TOKEN = getEnv('UPSTASH_REDIS_REST_TOKEN');

const syncChannel = new BroadcastChannel('partflow_mesh_sync');

const DEFAULT_CONFIG: AppConfig = {
  appName: "PartFlow Pro",
  logoUrl: "https://cdn-icons-png.flaticon.com/512/2897/2897785.png",
  primaryColor: "#0f172a",
  accentColor: "#3b82f6",
  carModels: ['Apex X1', 'Terra V8', 'Zenith EV'],
  manufacturingShops: ['Front End', 'Front Floor', 'Underbody', 'Rear Floor', 'Subframe'],
  locations: ['SUPPLIER', 'WAREHOUSE', 'BODY_SHOP', 'FE', 'RF', 'FF', 'UB', 'SF'],
  requiredFields: ['partNumber', 'name', 'currentStock'],
  columns: [
    { id: 'partNumber', label: 'Reference ID', type: 'text', isCore: true },
    { id: 'name', label: 'Part Name', type: 'text', isCore: true },
    { id: 'manufacturingShop', label: 'Assigned Shop', type: 'text', isCore: true },
    { id: 'currentLocation', label: 'Current Location', type: 'text', isCore: true },
    { id: 'carModel', label: 'Car Model', type: 'text', isCore: true },
    { id: 'currentStock', label: 'Stock', type: 'number', isCore: true },
    { id: 'targetStock', label: 'Target', type: 'number', isCore: true },
    { id: 'supplierName', label: 'Supplier', type: 'text', isCore: true },
  ],
  labels: { inventory: "Asset Registry", dashboard: "Command Center", suppliers: "Vendor Network" },
  adminEmail: "abdalhady.joharji@gmail.com",
  adminPassword: "admin",
  updatedAt: Date.now()
};

export const storageService = {
  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser: (user: User | null) => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  },

  onSync: (callback: () => void) => {
    syncChannel.onmessage = (event) => {
      if (event.data === 'update') callback();
    };
  },

  notifySync: () => {
    syncChannel.postMessage('update');
  },

  syncWithCloud: async (): Promise<boolean> => {
    if (!REDIS_URL || !REDIS_TOKEN) {
      console.warn("Cloud credentials missing. Storage is LOCAL ONLY.");
      return false;
    }
    try {
      // Use the standard Redis GET command
      const response = await fetch(`${REDIS_URL}/get/partflow_master_v7`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
      });
      const data = await response.json();
      
      if (data && data.result) {
        const remoteState = JSON.parse(data.result);
        
        // Safety check: only sync if remote data actually has parts or config
        if (remoteState.parts || remoteState.config) {
          if (remoteState.parts) localStorage.setItem(PARTS_KEY, JSON.stringify(remoteState.parts));
          if (remoteState.transfers) localStorage.setItem(TRANSFERS_KEY, JSON.stringify(remoteState.transfers));
          if (remoteState.suppliers) localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(remoteState.suppliers));
          if (remoteState.config) localStorage.setItem(CONFIG_KEY, JSON.stringify(remoteState.config));
          
          storageService.notifySync();
          console.log("Cloud Sync: Success. State refreshed.");
          return true;
        }
      }
      return true; // No data yet, but call succeeded
    } catch (e) { 
      console.error("Cloud Sync: Network Error.", e);
      return false;
    }
  },

  pushToCloud: async () => {
    if (!REDIS_URL || !REDIS_TOKEN) return;
    try {
      const parts = storageService.getParts();
      const transfers = storageService.getTransfers();
      const suppliers = storageService.getSuppliers();
      const config = storageService.getConfig();
      
      const payload = JSON.stringify({ parts, transfers, suppliers, config, lastPushAt: Date.now() });
      
      // Use standard Redis SET command
      const response = await fetch(`${REDIS_URL}/set/partflow_master_v7`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${REDIS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Cloud Push Error: ${response.status}`);
      }
      console.log("Cloud Push: Success. Registry updated.");
    } catch (e) {
      console.error("Cloud Push: Failed. Data remains in local cache.", e);
    }
  },

  getParts: (): Part[] => JSON.parse(localStorage.getItem(PARTS_KEY) || '[]'),
  getTransfers: (): Transfer[] => JSON.parse(localStorage.getItem(TRANSFERS_KEY) || '[]'),
  getSuppliers: (): Supplier[] => JSON.parse(localStorage.getItem(SUPPLIERS_KEY) || '[]'),
  getConfig: (): AppConfig => {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) return DEFAULT_CONFIG;
    try {
      return JSON.parse(stored);
    } catch (e) {
      return DEFAULT_CONFIG;
    }
  },

  savePart: (part: Part) => {
    const parts = storageService.getParts();
    const user = storageService.getCurrentUser();
    const updatedPart = { 
      ...part, 
      id: part.id || `PART_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      updatedAt: Date.now(), 
      lastModifiedBy: user?.username || 'System' 
    };
    const idx = parts.findIndex(p => p.id === updatedPart.id);
    if (idx >= 0) parts[idx] = updatedPart; else parts.push(updatedPart);
    localStorage.setItem(PARTS_KEY, JSON.stringify(parts));
    storageService.checkLowStock(updatedPart);
    storageService.notifySync();
    storageService.pushToCloud();
  },

  deletePart: (id: string) => {
    const parts = storageService.getParts();
    const updated = parts.filter(p => p.id !== id);
    localStorage.setItem(PARTS_KEY, JSON.stringify(updated));
    storageService.notifySync();
    storageService.pushToCloud();
  },

  saveConfig: (c: AppConfig) => { 
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...c, updatedAt: Date.now() })); 
    storageService.notifySync();
    storageService.pushToCloud(); 
  },

  updateStock: (partId: string, quantity: number, type: 'RECEIVE' | 'ISSUE', notes?: string, newLocation?: PartLocation) => {
    const parts = storageService.getParts();
    const idx = parts.findIndex(p => p.id === partId);
    if (idx === -1) return;
    const user = storageService.getCurrentUser();
    const part = parts[idx];
    const newStock = type === 'RECEIVE' ? part.currentStock + quantity : part.currentStock - quantity;
    
    parts[idx] = {
      ...part,
      currentStock: Math.max(0, newStock),
      currentLocation: newLocation || part.currentLocation,
      updatedAt: Date.now(),
      lastModifiedBy: user?.username || 'System',
      history: [{ 
        id: Math.random().toString(36).substr(2, 9), 
        date: new Date().toISOString(), 
        quantity, 
        type: (type === 'RECEIVE' ? 'TRANSFER_IN' : 'TRANSFER_OUT') as any, 
        notes 
      }, ...part.history || []].slice(0, 50)
    };
    localStorage.setItem(PARTS_KEY, JSON.stringify(parts));
    storageService.checkLowStock(parts[idx]);
    storageService.notifySync();
    storageService.pushToCloud();
  },

  createTransfer: (transfer: Omit<Transfer, 'id' | 'timestamp' | 'status' | 'supplierSignature'>) => {
    const transfers = storageService.getTransfers();
    const newTransfer: Transfer = {
      ...transfer,
      id: `TRF_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      status: 'PENDING',
      supplierSignature: `SIG_${Math.random().toString(36).substr(2, 8).toUpperCase()}`
    };
    transfers.unshift(newTransfer);
    localStorage.setItem(TRANSFERS_KEY, JSON.stringify(transfers.slice(0, 100)));
    storageService.notifySync();
    storageService.pushToCloud();
  },

  acceptTransfer: (id: string) => {
    const transfers = storageService.getTransfers();
    const idx = transfers.findIndex(t => t.id === id);
    if (idx === -1) return;
    
    const user = storageService.getCurrentUser();
    const transfer = transfers[idx];
    if (transfer.status !== 'PENDING') return;

    transfers[idx] = {
      ...transfer,
      status: 'COMPLETED',
      engineerId: user?.id,
      engineerName: user?.username,
      engineerSignature: `SIG_${Math.random().toString(36).substr(2, 8).toUpperCase()}`
    };

    localStorage.setItem(TRANSFERS_KEY, JSON.stringify(transfers));

    transfer.parts.forEach(p => {
      storageService.updateStock(
        p.partId, 
        p.quantity, 
        'RECEIVE', 
        `Transfer completed from ${transfer.fromLocation}`, 
        transfer.toLocation
      );
    });

    storageService.notifySync();
    storageService.pushToCloud();
  },

  checkLowStock: (part: Part) => {
    if (part.currentStock <= LOW_STOCK_THRESHOLD) {
      storageService.addNotification({
        partId: part.id,
        partName: part.name,
        message: `ALARM: ${part.name} critically low (${part.currentStock}).`,
        type: 'WARNING'
      });
    }
  },

  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const notifications = storageService.getNotifications();
    notifications.unshift({ ...n, id: Math.random().toString(36).substr(2, 9), timestamp: new Date().toISOString(), read: false });
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 50)));
    storageService.notifySync();
  },

  getNotifications: (): Notification[] => JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]'),
  
  markAsRead: (id: string) => {
    const notifications = storageService.getNotifications();
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.map(n => n.id === id ? { ...n, read: true } : n)));
    storageService.notifySync();
  },

  migratePartKey: (oldKey: string, newKey: string) => {
    const parts = storageService.getParts();
    const updated = parts.map(p => {
      const pObj = p as Record<string, any>;
      const val = pObj[oldKey];
      const newPart: any = { ...p, [newKey]: val, updatedAt: Date.now() };
      delete newPart[oldKey];
      return newPart as Part;
    });
    localStorage.setItem(PARTS_KEY, JSON.stringify(updated));
    storageService.notifySync();
    storageService.pushToCloud();
  },

  clearColumnData: (key: string) => {
    const parts = storageService.getParts();
    const updated = parts.map(p => {
      const newPart: any = { ...p, updatedAt: Date.now() };
      delete newPart[key];
      return newPart as Part;
    });
    localStorage.setItem(PARTS_KEY, JSON.stringify(updated));
    storageService.notifySync();
    storageService.pushToCloud();
  },

  wipeAllInventory: () => {
    localStorage.setItem(PARTS_KEY, JSON.stringify([]));
    localStorage.setItem(TRANSFERS_KEY, JSON.stringify([]));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([]));
    storageService.notifySync();
    storageService.pushToCloud();
  },

  importCSV: (csvText: string) => {
    const config = storageService.getConfig();
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const parts = storageService.getParts();
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const part: any = { 
        id: `PART_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, 
        history: [], 
        updatedAt: Date.now(), 
        currentLocation: 'SUPPLIER',
        currentStock: 0,
        targetStock: 0
      };
      headers.forEach((header, idx) => {
        const col = config.columns.find(c => c.label === header || c.id === header);
        if (col) part[col.id] = col.type === 'number' ? parseInt(values[idx]) || 0 : values[idx];
      });
      parts.push(part as Part);
    }
    localStorage.setItem(PARTS_KEY, JSON.stringify(parts));
    storageService.notifySync();
    storageService.pushToCloud();
  },

  exportCSV: () => {
    const config = storageService.getConfig();
    const parts = storageService.getParts();
    let csv = config.columns.map(c => c.label).join(',') + "\n";
    parts.forEach(p => { 
      const pObj = p as Record<string, any>;
      csv += config.columns.map(c => `"${String(pObj[c.id] || '').replace(/"/g, '""')}"`).join(',') + "\n"; 
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }
};