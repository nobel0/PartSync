
import React, { useState, useEffect, useCallback } from 'react';
import { Part, Notification, ViewType, AppConfig, InventoryDisplayMode, User } from './types';
import { storageService } from './services/storageService';
import { ICONS } from './constants';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import InventorySheet from './components/InventorySheet';
import Alerts from './components/Alerts';
import PartForm from './components/PartForm';
import AdminPanel from './components/AdminPanel';
import AuthGate from './components/AuthGate';
import Transfers from './components/Transfers';
import SuppliersView from './components/SuppliersView';

// Centralized Reusable Editable Component for Wordings
export const EditableLabel: React.FC<{
  text: string;
  onSave: (newText: string) => void;
  className?: string;
  adminOnly?: boolean;
  currentUser?: User | null;
}> = ({ text, onSave, className, adminOnly, currentUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(text);

  const canEdit = !adminOnly || (currentUser?.role === 'ADMIN');

  if (!canEdit) {
    return <span className={className}>{text}</span>;
  }

  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-2">
        <input
          autoFocus
          className={`bg-white border-2 border-blue-500 rounded px-2 py-1 outline-none text-slate-900 shadow-lg ${className}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            setIsEditing(false);
            if (value !== text) onSave(value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setIsEditing(false);
              if (value !== text) onSave(value);
            }
            if (e.key === 'Escape') {
              setIsEditing(false);
              setValue(text);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div 
      className={`inline-flex items-center gap-2 group cursor-pointer hover:bg-slate-100/50 rounded transition-colors px-1 -ml-1 ${className}`} 
      onClick={() => setIsEditing(true)}
      title="Click to edit wording"
    >
      <span>{text}</span>
      <span className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
      </span>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(storageService.getCurrentUser());
  const [view, setView] = useState<ViewType>('DASHBOARD');
  const [displayMode, setDisplayMode] = useState<InventoryDisplayMode>('GRID');
  const [parts, setParts] = useState<Part[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [config, setConfig] = useState<AppConfig>(storageService.getConfig());
  const [showPartForm, setShowPartForm] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dbMode, setDbMode] = useState<'CLOUD' | 'LOCAL'>('LOCAL');
  const [cloudStatus, setCloudStatus] = useState<'IDLE' | 'SYNCING' | 'ERROR'>('IDLE');
  const [isInitializing, setIsInitializing] = useState(true);

  const loadData = useCallback(() => {
    const currentConfig = storageService.getConfig();
    setConfig(currentConfig);
    setParts(storageService.getParts());
    setNotifications(storageService.getNotifications());
    document.documentElement.style.setProperty('--primary-color', currentConfig.primaryColor);
    
    const creds = storageService.getDBCredentials();
    setDbMode(creds ? 'CLOUD' : 'LOCAL');
  }, []);
  
  // Effect to update browser title dynamically
  useEffect(() => {
    if (config.browserTitle) {
      document.title = config.browserTitle;
    }
  }, [config.browserTitle]);

  const triggerCloudSync = useCallback(async () => {
    setCloudStatus('SYNCING');
    const { success, mode } = await storageService.syncWithCloud();
    setDbMode(mode);
    setCloudStatus(success ? 'IDLE' : 'ERROR');
    loadData();
  }, [loadData]);

  const handleManualPush = async () => {
    setCloudStatus('SYNCING');
    const success = await storageService.pushToCloud();
    setCloudStatus(success ? 'IDLE' : 'ERROR');
    if (success) {
      alert("✅ Registry mesh successfully synchronized to cloud database.");
      loadData();
    } else {
      alert("❌ Sync failed. Check network connection or cloud credentials.");
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const init = async () => {
      await triggerCloudSync();
      setIsInitializing(false);
    };
    init();
    storageService.onSync(loadData);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData, triggerCloudSync]);

  const updateLabel = async (key: string, val: string) => {
    const newConfig = { ...config, labels: { ...config.labels, [key]: val } };
    setConfig(newConfig);
    await storageService.saveConfig(newConfig);
  };

  const updateAppName = async (val: string) => {
    const newConfig = { ...config, appName: val };
    setConfig(newConfig);
    await storageService.saveConfig(newConfig);
  };

  if (isInitializing) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white p-10 text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-8"></div>
        <h2 className="text-xl font-black uppercase tracking-widest mb-2">{config.loadingHeadline || "PartFlow Protocol"}</h2>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 animate-pulse">{config.loadingSubline || "Syncing Facility Registry via Cloud Mesh..."}</p>
      </div>
    );
  }

  if (!user) return <AuthGate config={config} onAuthenticated={(u) => { storageService.setCurrentUser(u); setUser(u); }} />;

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleSavePart = async (p: Part) => {
    setCloudStatus('SYNCING');
    const success = await storageService.savePart(p);
    setCloudStatus(success ? 'IDLE' : 'ERROR');
    loadData();
    setShowPartForm(false);
    setEditingPart(null);
    if (success) {
       console.log("Part saved and synced to cloud.");
    }
  };

  const handleUpdateStock = async (id: string, qty: number, type: 'RECEIVE' | 'ISSUE') => {
    setCloudStatus('SYNCING');
    const success = await storageService.updateStock(id, qty, type);
    setCloudStatus(success ? 'IDLE' : 'ERROR');
    loadData();
  };

  const NavItem = ({ id, labelKey, icon: Icon, badge }: { id: ViewType, labelKey: keyof AppConfig['labels'], icon: any, badge?: number }) => (
    <button onClick={() => setView(id)} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all relative ${view === id ? 'bg-[var(--primary-color)] text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}>
      <Icon /> 
      <EditableLabel 
        text={config.labels[labelKey] || id} 
        onSave={(v) => updateLabel(labelKey, v)}
        currentUser={user}
        adminOnly
        className="text-sm font-bold truncate"
      />
      {badge ? <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{badge}</span> : null}
    </button>
  );

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#F1F5F9] overflow-hidden" style={{'--primary-color': config.primaryColor} as any}>
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col p-6 shadow-xl z-30">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-transparent bg-transparent overflow-hidden shrink-0">
            {config.logoUrl ? (
              <img src={config.logoUrl} className="max-w-[90%] max-h-[90%] object-contain" alt="Logo" />
            ) : (
              <div className="text-slate-900"><ICONS.Inventory /></div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <EditableLabel 
              text={config.appName} 
              onSave={updateAppName} 
              currentUser={user}
              adminOnly
              className="text-lg font-black text-slate-900 leading-tight truncate block" 
            />
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{user.username}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          <NavItem id="DASHBOARD" labelKey="dashboard" icon={ICONS.Dashboard} />
          <NavItem id="INVENTORY" labelKey="inventory" icon={ICONS.Inventory} />
          <NavItem id="TRANSFERS" labelKey="transfers" icon={ICONS.Truck} />
          <NavItem id="SUPPLIERS" labelKey="suppliers" icon={ICONS.Suppliers} />
          <NavItem id="ALERTS" labelKey="alerts" icon={ICONS.Alerts} badge={unreadCount} />
          {user.role === 'ADMIN' && <NavItem id="ADMIN" labelKey="admin" icon={ICONS.Settings} />}
        </nav>
        <button onClick={() => { storageService.setCurrentUser(null); setUser(null); }} className="mt-auto flex items-center gap-3 w-full px-4 py-3 rounded-xl text-slate-400 hover:text-red-600 transition-colors font-bold text-sm">Sign Out</button>
      </aside>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-[100] px-4 py-2 flex items-center justify-between shadow-2xl">
        <button onClick={() => setView('DASHBOARD')} className={`flex flex-col items-center flex-1 py-1 ${view === 'DASHBOARD' ? 'text-blue-600' : 'text-slate-400'}`}><ICONS.Dashboard /><span className="text-[9px] font-bold">{config.labels.dashboard}</span></button>
        <button onClick={() => setView('INVENTORY')} className={`flex flex-col items-center flex-1 py-1 ${view === 'INVENTORY' ? 'text-blue-600' : 'text-slate-400'}`}><ICONS.Inventory /><span className="text-[9px] font-bold">{config.labels.inventory}</span></button>
        <button onClick={() => setView('TRANSFERS')} className={`flex flex-col items-center flex-1 py-1 ${view === 'TRANSFERS' ? 'text-blue-600' : 'text-slate-400'}`}><ICONS.Truck /><span className="text-[9px] font-bold">{config.labels.transfers}</span></button>
        <button onClick={() => setView('ALERTS')} className={`flex flex-col items-center flex-1 py-1 ${view === 'ALERTS' ? 'text-blue-600' : 'text-slate-400'}`}><ICONS.Alerts /><span className="text-[9px] font-bold">{config.labels.alerts}</span></button>
        {user.role === 'ADMIN' && <button onClick={() => setView('ADMIN')} className={`flex flex-col items-center flex-1 py-1 ${view === 'ADMIN' ? 'text-blue-600' : 'text-slate-400'}`}><ICONS.Settings /><span className="text-[9px] font-bold">{config.labels.admin}</span></button>}
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0 shadow-sm z-40">
          <div className="flex items-center gap-4">
            <h2 className="text-base lg:text-xl font-black text-slate-800 uppercase tracking-tight">{view}</h2>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-colors ${cloudStatus === 'ERROR' ? 'bg-red-50 border-red-100 text-red-600' : dbMode === 'CLOUD' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
               <div className={`w-1.5 h-1.5 rounded-full ${cloudStatus === 'ERROR' ? 'bg-red-500' : dbMode === 'CLOUD' ? 'bg-emerald-500' : 'bg-amber-500'} ${cloudStatus === 'SYNCING' ? 'animate-pulse' : ''}`}></div>
               <span className="text-[9px] font-black uppercase tracking-widest">
                {cloudStatus === 'SYNCING' ? 'SYNCING...' : cloudStatus === 'ERROR' ? 'SYNC FAILED' : dbMode === 'CLOUD' ? 'MESH ONLINE' : 'LOCAL CACHE'}
               </span>
            </div>
          </div>
          <div className="flex gap-4">
             <button onClick={handleManualPush} className="bg-white border-2 border-slate-900 text-slate-900 px-6 py-2 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
               Save & Sync Cloud
             </button>
             {user.role !== 'SUPPLIER' && <button onClick={() => setShowPartForm(true)} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-xs hover:bg-black transition-colors shadow-lg">+ New Asset</button>}
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-4 lg:p-10 bg-[#F8FAFC] pb-24 lg:pb-10">
          {view === 'DASHBOARD' && <Dashboard config={config} parts={parts} notifications={notifications} onViewInventory={() => setView('INVENTORY')} onUpdateLabel={updateLabel} currentUser={user} />}
          {view === 'INVENTORY' && (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <EditableLabel 
                    text={config.labels.inventoryHeadline || ''} 
                    onSave={(v) => updateLabel('inventoryHeadline', v)}
                    className="text-xl font-black text-slate-900 uppercase"
                    currentUser={user}
                    adminOnly
                  />
                  <EditableLabel 
                    text={config.labels.inventorySubline || ''} 
                    onSave={(v) => updateLabel('inventorySubline', v)}
                    className="text-[10px] text-slate-400 font-black uppercase tracking-widest block"
                    currentUser={user}
                    adminOnly
                  />
                </div>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 w-fit h-fit shadow-sm">
                    <button onClick={() => setDisplayMode('GRID')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${displayMode === 'GRID' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>GRID VIEW</button>
                    <button onClick={() => setDisplayMode('SHEET')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${displayMode === 'SHEET' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>SHEET VIEW</button>
                </div>
              </div>
              {displayMode === 'GRID' ? <Inventory user={user} parts={parts} config={config} onReceive={(id, qty) => handleUpdateStock(id, qty, 'RECEIVE')} onEdit={setEditingPart} /> : <InventorySheet user={user} parts={parts} config={config} onEdit={setEditingPart} onReceive={(id, qty) => handleUpdateStock(id, qty, 'RECEIVE')} onDataRefresh={loadData} onUpdateConfig={async (c) => { await storageService.saveConfig(c); loadData(); }} />}
            </div>
          )}
          {view === 'TRANSFERS' && <Transfers config={config} user={user} parts={parts} onTransferComplete={loadData} onUpdateLabel={updateLabel} />}
          {view === 'SUPPLIERS' && <SuppliersView config={config} parts={parts} onUpdateLabel={updateLabel} currentUser={user} />}
          {view === 'ALERTS' && <Alerts notifications={notifications} onMarkRead={(id) => { storageService.markAsRead(id); loadData(); }} />}
          {view === 'ADMIN' && <AdminPanel config={config} onSaveConfig={async (c) => { 
            setCloudStatus('SYNCING');
            await storageService.saveConfig(c);
            setCloudStatus('IDLE');
            loadData(); 
          }} onDataRefresh={loadData} />}
        </section>

        {(showPartForm || editingPart) && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl h-full max-h-[92vh] overflow-hidden flex flex-col">
               <PartForm config={config} onClose={() => { setShowPartForm(false); setEditingPart(null); }} onSave={handleSavePart} initialData={editingPart || undefined} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
