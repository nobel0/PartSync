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

  // Sync favicon with branding
  useEffect(() => {
    const favicon = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (favicon && config.logoUrl) {
      favicon.href = config.logoUrl;
    }
  }, [config.logoUrl]);

  const loadData = useCallback(() => {
    const currentConfig = storageService.getConfig();
    setConfig(currentConfig);
    setParts(storageService.getParts());
    setNotifications(storageService.getNotifications());
    document.documentElement.style.setProperty('--primary-color', currentConfig.primaryColor);
    
    const creds = storageService.getDBCredentials();
    setDbMode(creds ? 'CLOUD' : 'LOCAL');
  }, []);

  const triggerCloudSync = useCallback(async () => {
    setCloudStatus('SYNCING');
    const { success, mode } = await storageService.syncWithCloud();
    setDbMode(mode);
    setCloudStatus(success ? 'IDLE' : 'ERROR');
    loadData();
  }, [loadData]);

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

  if (isInitializing) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white p-10 text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-8"></div>
        <h2 className="text-xl font-black uppercase tracking-widest mb-2">PartFlow Protocol</h2>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 animate-pulse">Syncing Facility Registry via Cloud Mesh...</p>
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
  };

  const handleUpdateStock = async (id: string, qty: number, type: 'RECEIVE' | 'ISSUE') => {
    setCloudStatus('SYNCING');
    const success = await storageService.updateStock(id, qty, type);
    setCloudStatus(success ? 'IDLE' : 'ERROR');
    loadData();
  };

  const NavItem = ({ id, label, icon: Icon, badge }: { id: ViewType, label: string, icon: any, badge?: number }) => (
    <button onClick={() => setView(id)} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all relative ${view === id ? 'bg-[var(--primary-color)] text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}>
      <Icon /> <span className="text-sm font-bold">{label}</span>
      {badge ? <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{badge}</span> : null}
    </button>
  );

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#F1F5F9] overflow-hidden" style={{'--primary-color': config.primaryColor} as any}>
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col p-6 shadow-xl z-30">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg bg-[var(--primary-color)] overflow-hidden shrink-0">
            {config.logoUrl ? (
              <img src={config.logoUrl} className="max-w-[80%] max-h-[80%] object-contain" alt="Logo" />
            ) : (
              <ICONS.Inventory />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-slate-900 leading-tight truncate">{config.appName}</h1>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{user.username}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          <NavItem id="DASHBOARD" label={config.labels.dashboard} icon={ICONS.Dashboard} />
          <NavItem id="INVENTORY" label={config.labels.inventory} icon={ICONS.Inventory} />
          <NavItem id="TRANSFERS" label="Transfers" icon={ICONS.Truck} />
          <NavItem id="SUPPLIERS" label={config.labels.suppliers} icon={ICONS.Suppliers} />
          <NavItem id="ALERTS" label="Alerts" icon={ICONS.Alerts} badge={unreadCount} />
          {user.role === 'ADMIN' && <NavItem id="ADMIN" label="System" icon={ICONS.Settings} />}
        </nav>
        <button onClick={() => { storageService.setCurrentUser(null); setUser(null); }} className="mt-auto flex items-center gap-3 w-full px-4 py-3 rounded-xl text-slate-400 hover:text-red-600 transition-colors font-bold text-sm">Sign Out</button>
      </aside>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-[100] px-4 py-2 flex items-center justify-between shadow-2xl">
        <button onClick={() => setView('DASHBOARD')} className={`flex flex-col items-center flex-1 py-1 ${view === 'DASHBOARD' ? 'text-blue-600' : 'text-slate-400'}`}><ICONS.Dashboard /><span className="text-[9px] font-bold">Center</span></button>
        <button onClick={() => setView('INVENTORY')} className={`flex flex-col items-center flex-1 py-1 ${view === 'INVENTORY' ? 'text-blue-600' : 'text-slate-400'}`}><ICONS.Inventory /><span className="text-[9px] font-bold">Assets</span></button>
        <button onClick={() => setView('TRANSFERS')} className={`flex flex-col items-center flex-1 py-1 ${view === 'TRANSFERS' ? 'text-blue-600' : 'text-slate-400'}`}><ICONS.Truck /><span className="text-[9px] font-bold">Transfers</span></button>
        <button onClick={() => setView('ALERTS')} className={`flex flex-col items-center flex-1 py-1 ${view === 'ALERTS' ? 'text-blue-600' : 'text-slate-400'}`}><ICONS.Alerts /><span className="text-[9px] font-bold">Alerts</span></button>
        {user.role === 'ADMIN' && <button onClick={() => setView('ADMIN')} className={`flex flex-col items-center flex-1 py-1 ${view === 'ADMIN' ? 'text-blue-600' : 'text-slate-400'}`}><ICONS.Settings /><span className="text-[9px] font-bold">System</span></button>}
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-base lg:text-xl font-black text-slate-800 uppercase tracking-tight">{view}</h2>
            
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-colors ${cloudStatus === 'ERROR' ? 'bg-red-50 border-red-100 text-red-600' : dbMode === 'CLOUD' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
               <div className={`w-1.5 h-1.5 rounded-full ${cloudStatus === 'ERROR' ? 'bg-red-500' : dbMode === 'CLOUD' ? 'bg-emerald-500' : 'bg-amber-500'} ${cloudStatus === 'SYNCING' ? 'animate-pulse' : ''}`}></div>
               <span className="text-[9px] font-black uppercase tracking-widest">
                {cloudStatus === 'SYNCING' ? 'SYNCING...' : cloudStatus === 'ERROR' ? 'SYNC FAILED' : dbMode === 'CLOUD' ? 'MESH ONLINE' : 'LOCAL CACHE'}
               </span>
            </div>

            {!isOnline && <div className="flex items-center gap-2 text-red-500"><div className="w-2 h-2 bg-red-500 rounded-full"></div><span className="text-[9px] font-black uppercase tracking-widest">Offline Mode</span></div>}
          </div>
          <div className="flex gap-4">
             {user.role !== 'SUPPLIER' && <button onClick={() => setShowPartForm(true)} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-xs hover:bg-black transition-colors shadow-lg">+ New Asset</button>}
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-4 lg:p-10 bg-[#F8FAFC] pb-24 lg:pb-10">
          {view === 'DASHBOARD' && <Dashboard parts={parts} notifications={notifications} onViewInventory={() => setView('INVENTORY')} />}
          {view === 'INVENTORY' && (
            <div className="space-y-4">
               <div className="flex bg-white p-1 rounded-xl border border-slate-200 w-fit">
                  <button onClick={() => setDisplayMode('GRID')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${displayMode === 'GRID' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>GRID VIEW</button>
                  <button onClick={() => setDisplayMode('SHEET')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${displayMode === 'SHEET' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>SHEET VIEW</button>
                </div>
              {displayMode === 'GRID' ? <Inventory user={user} parts={parts} config={config} onReceive={(id, qty) => handleUpdateStock(id, qty, 'RECEIVE')} onEdit={setEditingPart} /> : <InventorySheet user={user} parts={parts} config={config} onEdit={setEditingPart} onReceive={(id, qty) => handleUpdateStock(id, qty, 'RECEIVE')} onDataRefresh={loadData} />}
            </div>
          )}
          {view === 'TRANSFERS' && <Transfers user={user} parts={parts} onTransferComplete={loadData} />}
          {view === 'SUPPLIERS' && <SuppliersView config={config} parts={parts} />}
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