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
      alert("✅ Cloud mesh established and registry pulled.");
      onDataRefresh();
    } else {
      alert(`❌ Connection issue: ${health.message}`);
    }
    setIsSyncing(false);
  };

  const forcePush = async () => {
    setIsSyncing(true);
    await storageService.pushToCloud();
    alert("Manual cloud push attempted. Check session logs.");
    setIsSyncing(false);
  };

  const addItem = (type: 'carModels' | 'manufacturingShops') => {
    if (!newItem.trim()) return;
    if (formData[type].includes(newItem.trim())) return alert("Item already exists.");
    setFormData({ ...formData, [type]: [...formData[type], newItem.trim()] });
    setNewItem('');
  };

  const removeItem = (type: 'carModels' | 'manufacturingShops', index: number) => {
    const updated = [...formData[type]];
    updated.splice(index, 1);
    setFormData({ ...formData, [type]: updated });
  };

  const addOrUpdateColumn = () => {
    if (!newColLabel.trim() || !newColKey.trim()) return;
    const finalKey = newColKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    if (editingColId) {
      const oldCol = formData.columns.find(c => c.id === editingColId);
      if (!oldCol) return;

      if (finalKey !== editingColId) {
        if (window.confirm(`Rename key "${editingColId}" to "${finalKey}"? Your inventory data will be migrated immediately.`)) {
          storageService.migratePartKey(editingColId, finalKey);
        } else return;
      }

      const updatedColumns = formData.columns.map(col => 
        col.id === editingColId ? { ...col, id: finalKey, label: newColLabel.trim(), type: newColType } : col
      );
      
      setFormData({ ...formData, columns: updatedColumns });
      setEditingColId(null);
      onDataRefresh();
    } else {
      if (formData.columns.some(c => c.id === finalKey)) return alert("System ID collision detected.");
      const newCol: ColumnDefinition = { id: finalKey, label: newColLabel.trim(), type: newColType, isCore: false };
      setFormData({ ...formData, columns: [...formData.columns, newCol] });
    }
    
    setNewColLabel(''); setNewColKey(''); setNewColType('text');
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
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">Registry & Schema Engine</p>
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

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl p-12">
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
                </div>

                <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-200 space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Access Credentials</h4>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Admin Email</label>
                    <input className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs" value={formData.adminEmail} onChange={e => setFormData({ ...formData, adminEmail: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Admin Passkey</label>
                    <input type="password" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs" value={formData.adminPassword} onChange={e => setFormData({ ...formData, adminPassword: e.target.value })} />
                  </div>
                </div>
              </div>
          </div>
        )}

        {activeTab === 'CLOUD' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="p-8 bg-blue-50 rounded-[32px] border border-blue-100">
                <h4 className="text-xl font-black text-blue-900 uppercase">Cloud Mesh Gateway</h4>
                <p className="text-blue-700 text-xs mt-2 font-medium">Link this app to an Upstash Redis database to persist data across sessions.</p>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Redis REST URL</label>
                  <input 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" 
                    placeholder="https://your-db.upstash.io" 
                    value={dbCreds.url} 
                    onChange={e => setDbCreds({ ...dbCreds, url: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">REST Token</label>
                  <input 
                    type="password"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" 
                    placeholder="Your-Secure-Token" 
                    value={dbCreds.token} 
                    onChange={e => setDbCreds({ ...dbCreds, token: e.target.value })} 
                  />
                </div>

                {healthStatus.checked && (
                  <div className={`p-4 rounded-2xl border flex items-center gap-3 ${healthStatus.success ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                    <div className={`w-2 h-2 rounded-full ${healthStatus.success ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{healthStatus.message}</span>
                  </div>
                )}

                <div className="flex gap-4">
                  <button onClick={saveDBCreds} disabled={isSyncing} className="flex-1 py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs shadow-xl hover:bg-blue-700 transition-all">
                    {isSyncing ? 'LINKING...' : 'SAVE & CONNECT'}
                  </button>
                  <button onClick={checkCloudHealth} className="px-6 py-5 bg-slate-100 text-slate-600 rounded-[24px] font-black text-xs border border-slate-200">
                    TEST LINK
                  </button>
                </div>
                <button onClick={forcePush} className="w-full py-4 text-slate-400 text-[10px] font-black uppercase hover:text-slate-900 transition-colors">
                  Force Manual Cloud Push
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-200 flex flex-col h-[500px]">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Sync Session Logs</h4>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                {storageService.getSessionLogs().length > 0 ? (
                  storageService.getSessionLogs().map((log, i) => (
                    <div key={i} className={`p-3 rounded-xl border flex items-start justify-between ${log.status === 'SUCCESS' ? 'bg-white border-slate-100' : 'bg-red-50 border-red-100'}`}>
                      <div>
                        <div className="flex items-center gap-2">
                           <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{log.type}</span>
                           <span className="text-[9px] font-black text-slate-800">{log.message}</span>
                        </div>
                        <span className="text-[8px] text-slate-400 mt-1 block">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 text-[10px] font-black uppercase">No Activity Logged</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'REGISTRY' && (
          <div className="grid grid-cols-2 gap-16">
            <div className="space-y-6">
              <h4 className="text-lg font-black text-slate-900 uppercase">Registered Models</h4>
              <div className="flex gap-2">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Add Model..." value={newItem} onChange={e => setNewItem(e.target.value)} />
                <button onClick={() => addItem('carModels')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-xs">Add</button>
              </div>
              <div className="space-y-2 max-h-48 overflow-auto">
                {formData.carModels.map((m, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-700 text-xs">{m}</span>
                    <button onClick={() => removeItem('carModels', i)} className="text-red-400">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Other tabs follow original logic */}
      </div>
    </div>
  );
};

export default AdminPanel;