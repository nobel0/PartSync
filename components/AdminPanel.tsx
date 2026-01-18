import React, { useState, useEffect } from 'react';
import { AppConfig, ColumnDefinition } from '../types';
import { ICONS } from '../constants';
import { storageService } from '../services/storageService';

interface AdminPanelProps {
  config: AppConfig;
  onSaveConfig: (config: AppConfig) => void;
  onDataRefresh: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ config, onSaveConfig, onDataRefresh }) => {
  const [formData, setFormData] = useState<AppConfig>({ ...config });
  const [activeTab, setActiveTab] = useState<'VISUALS' | 'REGISTRY' | 'COLUMNS' | 'CLOUD' | 'DATA'>('VISUALS');
  const [newItem, setNewItem] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{ checked: boolean; success: boolean; message: string }>({ checked: false, success: false, message: '' });
  
  const [dbCreds, setDbCreds] = useState({ url: '', token: '' });
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColKey, setNewColKey] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number'>('text');
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    const current = storageService.getDBCredentials();
    if (current) setDbCreds(current);
  }, []);

  const handleSave = () => {
    onSaveConfig(formData);
    alert("✅ System Configuration Updated Successfully");
  };

  const checkCloudHealth = async () => {
    setIsSyncing(true);
    const result = await storageService.testConnection();
    setHealthStatus({ checked: true, ...result });
    setIsSyncing(false);
  };

  const forcePull = async () => {
    if (!window.confirm("WARNING: This will overwrite your current local session data with the cloud master registry. Proceed?")) return;
    setIsSyncing(true);
    const { success } = await storageService.syncWithCloud(true);
    if (success) {
      alert("✅ Registry recovered from cloud.");
      onDataRefresh();
    } else {
      alert("❌ Cloud recovery failed.");
    }
    setIsSyncing(false);
  };

  const saveDBCreds = async () => {
    if (!dbCreds.url || !dbCreds.token) {
      storageService.setDBCredentials(null);
      alert("Database link cleared.");
      return;
    }
    
    setIsSyncing(true);
    storageService.setDBCredentials(dbCreds);
    
    const { success } = await storageService.syncWithCloud();
    const health = await storageService.testConnection();
    setHealthStatus({ checked: true, ...health });
    
    if (success && health.success) {
      alert("✅ Cloud mesh established and registry verified.");
      onDataRefresh();
    } else {
      alert(`❌ Connection issue: ${health.message}`);
    }
    setIsSyncing(false);
  };

  const forcePush = async () => {
    if (!window.confirm("WARNING: This will push your local session data to the cloud, potentially overwriting other users' changes. Proceed?")) return;
    setIsSyncing(true);
    const success = await storageService.pushToCloud();
    if (success) {
      alert("Manual cloud push confirmed. State committed.");
    } else {
      alert("Push failed. Check connection logs.");
    }
    setIsSyncing(false);
  };

  const addItem = (type: 'carModels' | 'manufacturingShops') => {
    if (!newItem.trim()) return;
    const currentList = formData[type];
    if (currentList.includes(newItem.trim())) return alert("Item already exists.");
    
    setFormData(prev => ({
      ...prev,
      [type]: [...currentList, newItem.trim()]
    }));
    setNewItem('');
  };

  const removeItem = (type: 'carModels' | 'manufacturingShops', index: number) => {
    const updatedList = [...formData[type]];
    updatedList.splice(index, 1);
    
    setFormData(prev => ({
      ...prev,
      [type]: updatedList
    }));
  };

  const addOrUpdateColumn = () => {
    if (!newColLabel.trim() || !newColKey.trim()) return;
    const finalKey = newColKey.trim();
    
    if (editingColId) {
      const oldCol = formData.columns.find(c => c.id === editingColId);
      if (!oldCol) return;

      // Handle Key Migration
      if (finalKey !== editingColId) {
        const warningMessage = oldCol.isCore 
          ? `WARNING: You are changing a CORE SYSTEM KEY ("${editingColId}" -> "${finalKey}"). This will migrate all data to the new key. Proceed?`
          : `Renaming Key "${editingColId}" to "${finalKey}" will migrate all existing inventory data. Proceed?`;
          
        if (window.confirm(warningMessage)) {
          storageService.migratePartKey(editingColId, finalKey);
        } else return;
      }

      const updatedColumns = formData.columns.map(col => {
        let update = col.id === editingColId ? { ...col, id: finalKey, label: newColLabel.trim(), type: newColType, isPrimary } : col;
        // Ensure only one primary column exists
        if (isPrimary && update.id !== finalKey) update.isPrimary = false;
        return update;
      });
      
      setFormData({ ...formData, columns: updatedColumns });
      setEditingColId(null);
      onDataRefresh();
    } else {
      if (formData.columns.some(c => c.id === finalKey)) return alert("System ID collision detected.");
      const newCol: ColumnDefinition = { id: finalKey, label: newColLabel.trim(), type: newColType, isCore: false, isPrimary };
      const updatedColumns = isPrimary 
        ? formData.columns.map(c => ({...c, isPrimary: false})).concat(newCol)
        : [...formData.columns, newCol];
      setFormData({ ...formData, columns: updatedColumns });
    }
    
    setNewColLabel(''); setNewColKey(''); setNewColType('text'); setIsPrimary(false);
  };

  const removeColumn = (id: string) => {
    const col = formData.columns.find(c => c.id === id);
    if (col?.isCore) {
      if (!window.confirm("CRITICAL: This is a CORE SYSTEM field. Deleting it might break built-in logic. Are you absolutely sure?")) return;
    }
    if (window.confirm("Permanently delete this column? Data associated with this field in existing parts will be purged.")) {
      setFormData({ ...formData, columns: formData.columns.filter(c => c.id !== id) });
      storageService.clearColumnData(id);
      onDataRefresh();
    }
  };

  const TabButton: React.FC<{ id: typeof activeTab; label: string }> = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-6 py-3 font-black text-[10px] lg:text-xs transition-all border-b-4 uppercase tracking-widest ${activeTab === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      <div className="flex items-center justify-between bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-3xl font-black text-slate-900">System Architect</h3>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">Cloud Mesh & Data Schema</p>
        </div>
        <button onClick={handleSave} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all">
          Commit System Changes
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto scrollbar-hide">
        <TabButton id="VISUALS" label="Appearance" />
        <TabButton id="REGISTRY" label="Taxonomy" />
        <TabButton id="COLUMNS" label="Schema" />
        <TabButton id="CLOUD" label="Cloud Mesh" />
        <TabButton id="DATA" label="Operations" />
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl p-8 lg:p-12 min-h-[500px]">
        {activeTab === 'VISUALS' && (
          <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-4xl">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Platform Branding</label>
                    <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={formData.appName} onChange={e => setFormData({ ...formData, appName: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">UI Accent Color</label>
                    <div className="flex gap-4 items-center">
                      <input type="color" className="h-14 w-20 rounded-2xl cursor-pointer border-none bg-transparent" value={formData.primaryColor} onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} />
                      <span className="font-mono text-sm text-slate-500 font-bold">{formData.primaryColor}</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Navigation Labels</label>
                    <div className="grid grid-cols-2 gap-4">
                      <input className="px-4 py-2 bg-slate-50 border rounded-xl text-xs font-bold" placeholder="Dashboard Label" value={formData.labels.dashboard} onChange={e => setFormData({ ...formData, labels: { ...formData.labels, dashboard: e.target.value } })} />
                      <input className="px-4 py-2 bg-slate-50 border rounded-xl text-xs font-bold" placeholder="Inventory Label" value={formData.labels.inventory} onChange={e => setFormData({ ...formData, labels: { ...formData.labels, inventory: e.target.value } })} />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-200 space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Logo / Favicon</h4>
                    <div className="flex items-center gap-6">
                       <div className="w-20 h-20 bg-white rounded-2xl border flex items-center justify-center overflow-hidden shadow-sm">
                          {formData.logoUrl ? <img src={formData.logoUrl} className="max-w-[80%] max-h-[80%] object-contain" alt="Preview" /> : <div className="text-[10px] font-black text-slate-300">NO LOGO</div>}
                       </div>
                       <div className="flex-1">
                          <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Logo Resource URL</label>
                          <input className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-mono text-[10px]" placeholder="https://..." value={formData.logoUrl} onChange={e => setFormData({ ...formData, logoUrl: e.target.value })} />
                       </div>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        )}

        {activeTab === 'REGISTRY' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div className="space-y-6">
              <h4 className="text-lg font-black text-slate-900 uppercase">Registered Models</h4>
              <div className="flex gap-2">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Add Model..." value={newItem} onChange={e => setNewItem(e.target.value)} />
                <button onClick={() => addItem('carModels')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-xs">Add</button>
              </div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {formData.carModels.map((m, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-700 text-xs">{m}</span>
                    <button onClick={() => removeItem('carModels', i)} className="text-red-400">✕</button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-6">
              <h4 className="text-lg font-black text-slate-900 uppercase">Manufacturing Areas</h4>
              <div className="flex gap-2">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Add Shop..." value={newItem} onChange={e => setNewItem(e.target.value)} />
                <button onClick={() => addItem('manufacturingShops')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-xs">Add</button>
              </div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {formData.manufacturingShops.map((m, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-700 text-xs">{m}</span>
                    <button onClick={() => removeItem('manufacturingShops', i)} className="text-red-400">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'COLUMNS' && (
          <div className="space-y-10">
            <div className="bg-slate-900 p-8 rounded-[32px] text-white flex flex-col md:flex-row md:items-end gap-6">
              <div className="flex-1">
                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Display Label</label>
                <input className="w-full px-5 py-3 bg-white/10 border border-white/20 rounded-xl font-bold text-sm" placeholder="e.g. Serial Number" value={newColLabel} onChange={e => setNewColLabel(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Data Key (ID)</label>
                <input 
                  className={`w-full px-5 py-3 border rounded-xl font-mono text-sm bg-white/10 border-white/20`} 
                  placeholder="serial_number" 
                  value={newColKey} 
                  onChange={e => setNewColKey(e.target.value)} 
                />
              </div>
              <div className="w-full md:w-32">
                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Data Type</label>
                <select className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl font-bold text-sm appearance-none" value={newColType} onChange={e => setNewColType(e.target.value as any)}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                </select>
              </div>
              <div className="flex items-center gap-2 mb-2">
                 <input type="checkbox" id="isPrimary" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} className="w-4 h-4" />
                 <label htmlFor="isPrimary" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Primary display</label>
              </div>
              <button onClick={addOrUpdateColumn} className="px-10 py-3 bg-blue-600 rounded-xl font-black text-xs uppercase shadow-xl hover:bg-blue-500 transition-all">
                {editingColId ? 'Apply Update' : 'Register Field'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formData.columns.map(col => (
                <div key={col.id} className={`p-6 rounded-[24px] border border-slate-100 flex flex-col justify-between ${col.isPrimary ? 'bg-blue-50 border-blue-200' : 'bg-white shadow-sm'}`}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{col.type}</span>
                       {col.isPrimary && <span className="text-[8px] font-black px-2 py-0.5 bg-blue-600 text-white rounded uppercase">Primary</span>}
                       {col.isCore && <span className="text-[8px] font-black px-2 py-0.5 bg-slate-900 text-white rounded uppercase ml-1">Core</span>}
                    </div>
                    <h5 className="text-sm font-black text-slate-900">{col.label}</h5>
                    <p className="text-[10px] font-mono text-slate-400 mt-1">{col.id}</p>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <button onClick={() => { setEditingColId(col.id); setNewColLabel(col.label); setNewColKey(col.id); setNewColType(col.type); setIsPrimary(!!col.isPrimary); }} className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black">EDIT</button>
                    <button onClick={() => removeColumn(col.id)} className="p-2 bg-red-50 text-red-500 rounded-lg">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'CLOUD' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="p-8 bg-blue-50 rounded-[32px] border border-blue-100">
                <h4 className="text-xl font-black text-blue-900 uppercase">Cloud Mesh Dashboard</h4>
                <p className="text-blue-700 text-xs mt-2 font-medium">Link this app to Upstash Redis for global persistence.</p>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Redis REST URL</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="https://your-db.upstash.io" value={dbCreds.url} onChange={e => setDbCreds({ ...dbCreds, url: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">REST Token</label>
                  <input type="password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="Your-Secure-Token" value={dbCreds.token} onChange={e => setDbCreds({ ...dbCreds, token: e.target.value })} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={saveDBCreds} disabled={isSyncing} className="py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs shadow-xl hover:bg-blue-700 transition-all">
                    {isSyncing ? 'LINKING...' : 'SAVE & SYNC'}
                  </button>
                  <button onClick={forcePull} disabled={isSyncing} className="py-5 bg-emerald-600 text-white rounded-[24px] font-black text-xs shadow-xl hover:bg-emerald-700 transition-all">
                    RECOVER FROM CLOUD
                  </button>
                </div>
                <button onClick={forcePush} className="w-full py-4 bg-slate-100 text-slate-400 text-[10px] font-black uppercase rounded-2xl border border-slate-200 hover:text-red-600 hover:border-red-200 transition-colors">Emergency Cloud Override (Push Local)</button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-200 flex flex-col h-[500px]">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Activity Stream</h4>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                {storageService.getSessionLogs().map((log, i) => (
                    <div key={i} className={`p-3 rounded-xl border flex items-start justify-between ${log.status === 'SUCCESS' ? 'bg-white border-slate-100' : 'bg-red-50 border-red-100'}`}>
                      <div>
                        <div className="flex items-center gap-2">
                           <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{log.type}</span>
                           <span className="text-[9px] font-black text-slate-800">{log.message}</span>
                        </div>
                        <span className="text-[8px] text-slate-400 mt-1 block">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'DATA' && (
          <div className="max-w-4xl space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-10 bg-slate-50 rounded-[40px] border border-slate-200 text-center space-y-6">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-slate-900"><ICONS.Inventory /></div>
                <h4 className="text-xl font-black text-slate-900 uppercase">Registry Export</h4>
                <p className="text-slate-500 text-xs font-medium">Download your entire asset database as a structured CSV for offline auditing or Excel analysis.</p>
                <button onClick={() => storageService.exportCSV()} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all">Download Master CSV</button>
              </div>

              <div className="p-10 bg-slate-50 rounded-[40px] border border-slate-200 text-center space-y-6">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-blue-600"><ICONS.Plus /></div>
                <h4 className="text-xl font-black text-slate-900 uppercase">Bulk Ingestion</h4>
                <p className="text-slate-500 text-xs font-medium">Upload a CSV file with headers matching your current system schema to import new assets in bulk.</p>
                <label className="block w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-blue-700 transition-all">
                  Upload CSV Source
                  <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const text = await file.text();
                      await storageService.importCSV(text);
                      onDataRefresh();
                      alert("Import process complete.");
                    }
                  }} />
                </label>
              </div>
            </div>

            <div className="p-10 bg-red-50 rounded-[40px] border border-red-100 flex items-center justify-between">
              <div className="max-w-md">
                <h4 className="text-lg font-black text-red-900 uppercase">Emergency Registry Purge</h4>
                <p className="text-red-700 text-xs font-medium mt-1">This operation wipes all parts, history, and notifications. This is irreversible unless you have a CSV backup.</p>
              </div>
              <button onClick={() => { if(window.confirm("PURGE ALL DATA? Type 'DELETE' to confirm.")) { storageService.wipeAllInventory(); onDataRefresh(); } }} className="px-10 py-4 bg-red-600 text-white rounded-2xl font-black text-xs shadow-lg hover:bg-red-700 transition-all">Wipe Global Registry</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;