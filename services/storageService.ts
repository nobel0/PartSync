
import { Part, Notification, AppConfig, User, Transfer, Supplier, PartLocation } from '../types';
import { LOW_STOCK_THRESHOLD } from '../constants';

const PARTS_KEY = 'partflow_parts_v10';
const NOTIFICATIONS_KEY = 'partflow_notifications_v10';
const CONFIG_KEY = 'partflow_config_v10';
const USER_KEY = 'partflow_current_user_v10';
const TRANSFERS_KEY = 'partflow_transfers_v10';
const SUPPLIERS_KEY = 'partflow_suppliers_v10';
const DB_CRED_KEY = 'partflow_db_credentials_v10';
const LAST_SYNC_KEY = 'partflow_last_updated_v10';
const MASTER_DB_KEY = 'partflow_master_v10';

interface DBCredentials {
  url: string;
  token: string;
}

interface CloudLog {
  timestamp: number;
  type: 'PUSH' | 'PULL' | 'TEST' | 'ERROR' | 'BACKUP' | 'RESTORE' | 'IMPORT';
  status: 'SUCCESS' | 'ERROR';
  message: string;
}

const syncChannel = new BroadcastChannel('partflow_mesh_sync');
let sessionLogs: CloudLog[] = [];

// Simplified validity check to ensure keys aren't accidentally rejected
const isValid = (val: any) => val && typeof val === 'string' && val.trim().length > 2;

export const storageService = {
  getDBCredentials: (): DBCredentials | null => {
    // Priority 1: Environment Variables
    const envUrl = process.env.UPSTASH_REDIS_REST_URL;
    const envToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (isValid(envUrl) && isValid(envToken)) {
      return { 
        url: envUrl!.trim().replace(/\/$/, ''), 
        token: envToken!.trim() 
      };
    }
    
    // Priority 2: Local Storage
    const stored = localStorage.getItem(DB_CRED_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.token) {
          return { 
            url: parsed.url.trim().replace(/\/$/, ''), 
            token: parsed.token.trim() 
          };
        }
      } catch (e) { return null; }
    }
    return null;
  },

  setDBCredentials: (creds: DBCredentials | null) => {
    if (creds && creds.url && creds.token) {
      localStorage.setItem(DB_CRED_KEY, JSON.stringify({ 
        url: creds.url.trim().replace(/\/$/, ''), 
        token: creds.token.trim() 
      }));
    } else {
      localStorage.removeItem(DB_CRED_KEY);
    }
    storageService.notifySync();
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser: (user: User | null) => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  },

  onSync: (callback: () => void) => {
    syncChannel.onmessage = (event) => { if (event.data === 'update') callback(); };
  },

  notifySync: () => { syncChannel.postMessage('update'); },

  getSessionLogs: () => sessionLogs,

  syncWithCloud: async (force: boolean = false): Promise<{ success: boolean; mode: 'CLOUD' | 'LOCAL' }> => {
    const creds = storageService.getDBCredentials();
    if (!creds) return { success: true, mode: 'LOCAL' };
    try {
      const response = await fetch(`${creds.url}/get/${MASTER_DB_KEY}`, { 
        headers: { Authorization: `Bearer ${creds.token}` } 
      });
      if (!response.ok) throw new Error(`Mesh Fetch Error: ${response.status}`);
      const data = await response.json();
      
      if (!data.result) {
        // Initial setup - if cloud is empty, push local state up
        const localParts = storageService.getParts();
        if (localParts.length > 0) {
          await storageService.pushToCloud();
        }
        return { success: true, mode: 'CLOUD' };
      }

      const remoteState = JSON.parse(data.result);
      const localUpdatedAt = parseInt(localStorage.getItem(LAST_SYNC_KEY) || '0');
      const remoteUpdatedAt = remoteState.lastPushAt || 0;

      // Only pull if remote is newer or forced
      if (remoteUpdatedAt > localUpdatedAt || force) {
        if (remoteState.parts) localStorage.setItem(PARTS_KEY, JSON.stringify(remoteState.parts));
        if (remoteState.transfers) localStorage.setItem(TRANSFERS_KEY, JSON.stringify(remoteState.transfers));
        if (remoteState.suppliers) localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(remoteState.suppliers));
        if (remoteState.config) localStorage.setItem(CONFIG_KEY, JSON.stringify(remoteState.config));
        localStorage.setItem(LAST_SYNC_KEY, remoteUpdatedAt.toString());
        storageService.notifySync();
        sessionLogs.unshift({ timestamp: Date.now(), type: 'PULL', status: 'SUCCESS', message: 'Facility registry synchronized.' });
      }
      return { success: true, mode: 'CLOUD' };
    } catch (e) { 
      sessionLogs.unshift({ timestamp: Date.now(), type: 'PULL', status: 'ERROR', message: `Sync disruption: ${String(e)}` });
      return { success: false, mode: 'LOCAL' };
    }
  },

  pushToCloud: async (): Promise<boolean> => {
    const creds = storageService.getDBCredentials();
    if (!creds) return false;
    try {
      const timestamp = Date.now();
      const payload = {
        parts: storageService.getParts(),
        transfers: storageService.getTransfers(),
        suppliers: storageService.getSuppliers(),
        config: storageService.getConfig(),
        lastPushAt: timestamp
      };
      const response = await fetch(`${creds.url}/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(["SET", MASTER_DB_KEY, JSON.stringify(payload)])
      });
      if (response.ok) {
        localStorage.setItem(LAST_SYNC_KEY, timestamp.toString());
        sessionLogs.unshift({ timestamp, type: 'PUSH', status: 'SUCCESS', message: 'Registry mesh committed to cloud.' });
        return true;
      }
      return false;
    } catch (e) { return false; }
  },

  exportBackup: () => {
    const state = {
      parts: storageService.getParts(),
      transfers: storageService.getTransfers(),
      suppliers: storageService.getSuppliers(),
      config: storageService.getConfig(),
      timestamp: Date.now()
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partflow_system_image_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  },

  importBackup: async (file: File) => {
    return new Promise<boolean>((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const state = JSON.parse(e.target?.result as string);
          if (state.parts) localStorage.setItem(PARTS_KEY, JSON.stringify(state.parts));
          if (state.transfers) localStorage.setItem(TRANSFERS_KEY, JSON.stringify(state.transfers));
          if (state.suppliers) localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(state.suppliers));
          if (state.config) localStorage.setItem(CONFIG_KEY, JSON.stringify(state.config));
          localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
          storageService.notifySync();
          await storageService.pushToCloud();
          resolve(true);
        } catch (err) { resolve(false); }
      };
      reader.readAsText(file);
    });
  },

  getParts: (): Part[] => {
    try { return JSON.parse(localStorage.getItem(PARTS_KEY) || '[]'); } catch (e) { return []; }
  },
  
  getTransfers: (): Transfer[] => {
    try { return JSON.parse(localStorage.getItem(TRANSFERS_KEY) || '[]'); } catch (e) { return []; }
  },

  getSuppliers: (): Supplier[] => {
    try { return JSON.parse(localStorage.getItem(SUPPLIERS_KEY) || '[]'); } catch (e) { return []; }
  },
  
  createTransfer: async (transferData: Omit<Transfer, 'id' | 'timestamp' | 'status' | 'supplierSignature' | 'engineerId' | 'engineerName' | 'engineerSignature'>) => {
    const transfers = storageService.getTransfers();
    const newTransfer: Transfer = {
      ...transferData,
      id: `TR_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      status: 'PENDING',
      supplierSignature: `SIG_${Date.now().toString(36).substr(2, 6).toUpperCase()}`
    };
    transfers.unshift(newTransfer);
    localStorage.setItem(TRANSFERS_KEY, JSON.stringify(transfers));
    storageService.notifySync();
    return await storageService.pushToCloud();
  },

  acceptTransfer: async (transferId: string) => {
    const transfers = storageService.getTransfers();
    const idx = transfers.findIndex(t => t.id === transferId);
    if (idx === -1) return false;
    
    const transfer = transfers[idx];
    if (transfer.status !== 'PENDING') return false;

    const user = storageService.getCurrentUser();
    
    // Update transfer status
    transfers[idx] = {
      ...transfer,
      status: 'COMPLETED',
      engineerId: user?.id,
      engineerName: user?.username,
      engineerSignature: `SIG_${Date.now().toString(36).substr(2, 6).toUpperCase()}`
    };
    localStorage.setItem(TRANSFERS_KEY, JSON.stringify(transfers));

    // Update parts stock
    for (const item of transfer.parts) {
      await storageService.updateStock(
        item.partId, 
        item.quantity, 
        'RECEIVE', 
        `Transfer ${transfer.id} received from ${transfer.supplierName}`, 
        transfer.toLocation
      );
    }
    
    storageService.notifySync();
    return await storageService.pushToCloud();
  },

  getConfig: (): AppConfig => {
    const stored = localStorage.getItem(CONFIG_KEY);
    const defaultConf: AppConfig = {
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
        { id: 'name', label: 'Part Name', type: 'text', isCore: true, isPrimary: true },
        { id: 'manufacturingShop', label: 'Assigned Shop', type: 'text', isCore: true },
        { id: 'currentLocation', label: 'Current Location', type: 'text', isCore: true },
        { id: 'carModel', label: 'Car Model', type: 'text', isCore: true },
        { id: 'currentStock', label: 'Stock', type: 'number', isCore: true },
        { id: 'targetStock', label: 'Target', type: 'number', isCore: true },
        { id: 'supplierName', label: 'Supplier', type: 'text', isCore: true },
      ],
      users: [
        { id: 'admin_01', username: 'Administrator', email: 'abdalhady.joharji@gmail.com', password: 'admin', role: 'ADMIN', assignedLine: 'ALL' }
      ],
      labels: { 
        inventory: "Asset Registry", 
        dashboard: "Command Center", 
        suppliers: "Vendor Network",
        transfers: "Logistics",
        alerts: "Security Alerts",
        admin: "Facility Controls",
        dashboardHeadline: "Inventory Equilibrium",
        dashboardSubline: "Levels vs Target Thresholds",
        inventoryHeadline: "Master Registry",
        inventorySubline: "Global Asset Inventory",
        transfersHeadline: "Transfer Handshake System",
        transfersSubline: "Multi-Party Digital Validation",
        suppliersHeadline: "Vendor Management",
        suppliersSubline: "Supplier Performance Registry"
      },
      updatedAt: Date.now()
    };
    if (!stored) return defaultConf;
    try { 
      const parsed = JSON.parse(stored);
      return { ...defaultConf, ...parsed, labels: { ...defaultConf.labels, ...(parsed.labels || {}) } };
    } catch (e) { return defaultConf; }
  },

  savePart: async (part: Part) => {
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
    return await storageService.pushToCloud();
  },

  saveParts: async (newParts: Part[]) => {
    const parts = storageService.getParts();
    const timestamp = Date.now();
    const user = storageService.getCurrentUser()?.username || 'Import';
    
    newParts.forEach(np => {
      const part = { ...np, updatedAt: timestamp, lastModifiedBy: user };
      const idx = parts.findIndex(p => p.id === part.id || (p.partNumber === part.partNumber && part.partNumber !== ''));
      if (idx >= 0) parts[idx] = { ...parts[idx], ...part };
      else parts.push({ ...part, id: part.id || `PART_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` });
    });
    
    localStorage.setItem(PARTS_KEY, JSON.stringify(parts));
    storageService.notifySync();
    return await storageService.pushToCloud();
  },

  deletePart: async (id: string) => {
    const parts = storageService.getParts();
    const updated = parts.filter(p => p.id !== id);
    localStorage.setItem(PARTS_KEY, JSON.stringify(updated));
    storageService.notifySync();
    return await storageService.pushToCloud();
  },

  saveConfig: async (c: AppConfig) => { 
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...c, updatedAt: Date.now() })); 
    storageService.notifySync();
    return await storageService.pushToCloud(); 
  },

  updateStock: async (partId: string, quantity: number, type: 'RECEIVE' | 'ISSUE', notes?: string, newLocation?: PartLocation) => {
    const parts = storageService.getParts();
    const idx = parts.findIndex(p => p.id === partId);
    if (idx === -1) return;
    const part = parts[idx];
    const newStock = type === 'RECEIVE' ? part.currentStock + quantity : part.currentStock - quantity;
    parts[idx] = {
      ...part,
      currentStock: Math.max(0, newStock),
      currentLocation: newLocation || part.currentLocation,
      updatedAt: Date.now(),
      lastModifiedBy: storageService.getCurrentUser()?.username || 'System',
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
    return await storageService.pushToCloud();
  },

  setLocation: async (partId: string, location: PartLocation) => {
    const parts = storageService.getParts();
    const idx = parts.findIndex(p => p.id === partId);
    if (idx === -1) return;
    const part = parts[idx];
    parts[idx] = {
      ...part,
      currentLocation: location,
      updatedAt: Date.now(),
      lastModifiedBy: storageService.getCurrentUser()?.username || 'System',
    };
    localStorage.setItem(PARTS_KEY, JSON.stringify(parts));
    storageService.notifySync();
    return await storageService.pushToCloud();
  },

  checkLowStock: (part: Part) => {
    if (part.currentStock <= LOW_STOCK_THRESHOLD) {
      const notifications = storageService.getNotifications();
      const existing = notifications.find(n => n.partId === part.id && !n.read);
      if (!existing) {
        notifications.unshift({ 
          id: Math.random().toString(36).substr(2, 9), 
          partId: part.id, 
          partName: part.name, 
          message: `CRITICAL: ${part.name} is below threshold (${part.currentStock}).`, 
          type: 'WARNING',
          timestamp: new Date().toISOString(),
          read: false 
        });
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 50)));
      }
    }
  },

  getNotifications: (): Notification[] => {
    try { return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]'); } catch (e) { return []; }
  },

  markAsRead: (id: string) => {
    const notifications = storageService.getNotifications();
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.map(n => n.id === id ? { ...n, read: true } : n)));
    storageService.notifySync();
  },
};
