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
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 animate-pulse">Mesh Handshake...</p>
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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-slate-100 bg-white overflow-hidden shrink-0 shadow-sm">
            {config.logoUrl ? (
              <img src={config.logoUrl} className="max-w-[90%] max-h-[90%] object-contain" alt="Logo" />
            ) : (
              <div className="text-slate-900"><ICONS.Inventory /></div>
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
          </div>
          {user.role !== 'SUPPLIER' && <button onClick={() => setShowPartForm(true)} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-xs shadow-lg">+ New Asset</button>}
        </header>

        <section className="flex-1 overflow-y-auto p-4 lg:p-10 bg-[#F8FAFC] pb-24 lg:pb-10">
          {view === 'DASHBOARD' && <Dashboard config={config} parts={parts} notifications={notifications} onViewInventory={() => setView('INVENTORY')} />}
          {view === 'INVENTORY' && (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase">{config.labels.inventoryHeadline}</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{config.labels.inventorySubline}</p>
                </div>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 w-fit h-fit">
                    <button onClick={() => setDisplayMode('GRID')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${displayMode === 'GRID' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>GRID</button>
                    <button onClick={() => setDisplayMode('SHEET')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${displayMode === 'SHEET' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>SHEET</button>
                </div>
              </div>
              {displayMode === 'GRID' ? <Inventory user={user} parts={parts} config={config} onReceive={(id, qty) => handleUpdateStock(id, qty, 'RECEIVE')} onEdit={setEditingPart} /> : <InventorySheet user={user} parts={parts} config={config} onEdit={setEditingPart} onReceive={(id, qty) => handleUpdateStock(id, qty, 'RECEIVE')} onDataRefresh={loadData} />}
            </div>
          )}
          {view === 'TRANSFERS' && <Transfers config={config} user={user} parts={parts} onTransferComplete={loadData} />}
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
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl h-full max-h-[92vh] overflow-hidden">
               <PartForm config={config} onClose={() => { setShowPartForm(false); setEditingPart(null); }} onSave={handleSavePart} initialData={editingPart || undefined} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;