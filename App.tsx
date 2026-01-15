
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Part, Notification, ViewType, AppConfig, InventoryDisplayMode, User, Conflict } from './types';
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
  const [cloudStatus, setCloudStatus] = useState<'IDLE' | 'SYNCING' | 'ERROR'>('IDLE');

  const loadData = useCallback(() => {
    setParts(storageService.getParts());
    setNotifications(storageService.getNotifications());
    const currentConfig = storageService.getConfig();
    setConfig(currentConfig);
    document.documentElement.style.setProperty('--primary-color', currentConfig.primaryColor);
  }, []);

  const triggerCloudSync = useCallback(async () => {
    setCloudStatus('SYNCING');
    const success = await storageService.syncWithCloud();
    setCloudStatus(success ? 'IDLE' : 'ERROR');
    if (success) loadData();
  }, [loadData]);

  useEffect(() => {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
    if (user) {
      loadData();
      triggerCloudSync();
      storageService.onSync(loadData);
    }
  }, [user, loadData, triggerCloudSync]);

  if (!user) return <AuthGate config={config} onAuthenticated={(u) => { storageService.setCurrentUser(u); setUser(u); }} />;

  const unreadCount = notifications.filter(n => !n.read).length;

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
              <img src={config.logoUrl} className="max-w-[70%] max-h-[70%] object-contain invert grayscale" alt="Logo" />
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
          <NavItem id="DASHBOARD" label="Center" icon={ICONS.Dashboard} />
          <NavItem id="INVENTORY" label="Assets" icon={ICONS.Inventory} />
          <NavItem id="TRANSFERS" label="Transfers" icon={ICONS.Truck} />
          <NavItem id="SUPPLIERS" label="Vendors" icon={ICONS.Suppliers} />
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
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-base lg:text-xl font-black text-slate-800 uppercase tracking-tight">{view}</h2>
            {cloudStatus === 'SYNCING' && <div className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div><span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Mesh Sync Active</span></div>}
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
              {displayMode === 'GRID' ? <Inventory user={user} parts={parts} config={config} onReceive={(id, qty) => { storageService.updateStock(id, qty, 'RECEIVE'); loadData(); }} onEdit={setEditingPart} /> : <InventorySheet user={user} parts={parts} config={config} onEdit={setEditingPart} onReceive={(id, qty) => { storageService.updateStock(id, qty, 'RECEIVE'); loadData(); }} onDataRefresh={loadData} />}
            </div>
          )}
          {view === 'TRANSFERS' && <Transfers user={user} parts={parts} onTransferComplete={loadData} />}
          {view === 'SUPPLIERS' && <SuppliersView config={config} parts={parts} />}
          {view === 'ALERTS' && <Alerts notifications={notifications} onMarkRead={(id) => { storageService.markAsRead(id); loadData(); }} />}
          {view === 'ADMIN' && <AdminPanel config={config} onSaveConfig={(c) => { storageService.saveConfig(c); loadData(); }} onDataRefresh={loadData} />}
        </section>

        {(showPartForm || editingPart) && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl h-full max-h-[92vh] overflow-hidden flex flex-col">
               <PartForm config={config} onClose={() => { setShowPartForm(false); setEditingPart(null); }} onSave={(p) => { storageService.savePart(p); loadData(); setShowPartForm(false); setEditingPart(null); }} initialData={editingPart || undefined} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
