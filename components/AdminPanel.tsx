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
  const [activeTab, setActiveTab] = useState<'VISUALS' | 'REGISTRY' | 'COLUMNS' | 'WORDING' | 'CLOUD' | 'DATA'>('VISUALS');
  
  const [newModelItem, setNewModelItem] = useState('');
  const [newShopItem, setNewShopItem] = useState('');

  const [isSyncing, setIsSyncing] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{ checked: boolean; success: boolean; message: string }>({ checked: false, success: false, message: '' });
  
  const [dbCreds, setDbCreds] = useState({ url: '', token: '' });
  
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColKey, setNewColKey] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number' | 'image'>('text');
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    const current = storageService.getDBCredentials();
    if (current) setDbCreds(current);
  }, []);

  const handleSave = () => {
    onSaveConfig(formData);
    alert("✅ System Configuration Updated Successfully");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const forcePull = async () => {
    if (!window.confirm("WARNING: Overwrite local session with cloud?")) return;
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

  const forcePush = async () => {
    if (!window.confirm("CRITICAL: Overwrite remote data with local?")) return;
    setIsSyncing(true);
    const success = await storageService.pushToCloud();
    if (success) {
      alert("✅ Local state committed to cloud master.");
    } else {
      alert("❌ Push failed. Verify cloud link.");
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
      alert("✅ Cloud mesh established.");
      onDataRefresh();
    } else {
      alert(`❌ Connection issue: ${health.message}`);
    }
    setIsSyncing(false);
  };

  const addItem = (type: 'carModels' | 'manufacturingShops') => {
    const val = type === 'carModels' ? newModelItem : newShopItem;
    if (!val.trim()) return;
    if (formData[type].includes(val.trim())) return alert("Item exists.");
    
    setFormData(prev => ({
      ...prev,
      [type]: [...prev[type], val.trim()]
    }));
    
    if (type === 'carModels') setNewModelItem(''); 
    else setNewShopItem('');
  };

  const removeItem = (type: 'carModels' | 'manufacturingShops', index: number) => {
    const updated = [...formData[type]];
    updated.splice(index, 1);
    setFormData(prev => ({ ...prev, [type]: updated }));
  };

  const startEditColumn = (col: ColumnDefinition) => {
    setEditingColId(col.id);
    setNewColLabel(col.label);
    setNewColKey(col.id);
    setNewColType(col.type);
    setIsPrimary(!!col.isPrimary);
    const formElement = document.getElementById('schema-form');
    if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  };

  const addOrUpdateColumn = () => {
    if (!newColLabel.trim() || !newColKey.trim()) return;
    const finalKey = newColKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    if (editingColId) {
      const updatedColumns: ColumnDefinition[] = formData.columns.map(col => {
        const isTarget = col.id === editingColId;
        const updatedCol: ColumnDefinition = isTarget 
          ? { ...col, id: finalKey, label: newColLabel.trim(), type: newColType, isPrimary: !!isPrimary } 
          : { ...col };
        if (isPrimary && updatedCol.id !== finalKey) updatedCol.isPrimary = false;
        return updatedCol;
      });
      setFormData({ ...formData, columns: updatedColumns });
      setEditingColId(null);
      onDataRefresh();
    } else {
      if (formData.columns.some(c => c.id === finalKey)) return alert("ID collision.");
      const newCol: ColumnDefinition = { id: finalKey, label: newColLabel.trim(), type: newColType, isCore: false, isPrimary: !!isPrimary };
      let updatedColumns = isPrimary ? formData.columns.map(c => ({ ...c, isPrimary: false } as ColumnDefinition)) : [...formData.columns];
      updatedColumns.push(newCol);
      setFormData({ ...formData, columns: updatedColumns });
    }
    setNewColLabel(''); setNewColKey(''); setNewColType('text'); setIsPrimary(false);
  };

  const removeColumn = (id: string) => {
    if (window.confirm("Purge column? This action will hide data associated with this field.")) {
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
        <button onClick={handleSave} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition-all">
          Commit System Changes
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto scrollbar-hide">
        <TabButton id="VISUALS" label="Appearance" />
        <TabButton id="REGISTRY" label="Taxonomy" />
        <TabButton id="COLUMNS" label="Schema" />
        <TabButton id="WORDING" label="Wording" />
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
              </div>
              <div className="space-y-6">
                <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-200 space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Logo</h4>
                  <div className="flex items-center gap-6">
                     <div className="w-24 h-24 bg-transparent rounded-3xl border border-dashed border-slate-200 flex items-center justify-center overflow-hidden shadow-sm relative">
                        {formData.logoUrl ? <img src={formData.logoUrl} className="max-w-[90%] max-h-[90%] object-contain" alt="Preview" /> : <div className="text-[10px] font-black text-slate-300">NO LOGO</div>}
                     </div>
                     <div className="flex-1 space-y-3">
                        <label className="block w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black text-center uppercase tracking-widest cursor-pointer hover:bg-black transition-colors">
                          Upload from Device
                          <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        </label>
                        <input className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-mono text-[10px]" placeholder="Direct URL..." value={formData.logoUrl || ''} onChange={e => setFormData({ ...formData, logoUrl: e.target.value })} />
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
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Add Model..." value={newModelItem} onChange={e => setNewModelItem(e.target.value)} />
                <button type="button" onClick={() => addItem('carModels')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-xs">Add</button>
              </div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {formData.carModels.map((m, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-transparent hover:border-slate-200">
                    <span className="font-bold text-slate-700 text-xs">{m}</span>
                    <button type="button" onClick={() => removeItem('carModels', i)} className="text-red-400 hover:text-red-600 transition-colors">✕</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <h4 className="text-lg font-black text-slate-900 uppercase">Manufacturing Areas</h4>
              <div className="flex gap-2">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Add Shop..." value={newShopItem} onChange={e => setNewShopItem(e.target.value)} />
                <button type="button" onClick={() => addItem('manufacturingShops')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-xs">Add</button>
              </div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {formData.manufacturingShops.map((m, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-transparent hover:border-slate-200">
                    <span className="font-bold text-slate-700 text-xs">{m}</span>
                    <button type="button" onClick={() => removeItem('manufacturingShops', i)} className="text-red-400 hover:text-red-600 transition-colors">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'COLUMNS' && (
          <div className="space-y-10">
            <div id="schema-form" className="bg-slate-900 p-8 rounded-[32px] text-white flex flex-col md:flex-row md:items-end gap-6 border border-white/10 shadow-2xl transition-all duration-500">
              <div className="flex-1">
                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Display Label</label>
                <input className="w-full px-5 py-3 bg-white/10 border border-white/20 rounded-xl font-bold text-sm outline-none focus:ring-2 ring-blue-500 transition-all" placeholder="e.g. Serial" value={newColLabel} onChange={e => setNewColLabel(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Field ID (Unique)</label>
                <input className="w-full px-5 py-3 border rounded-xl font-mono text-sm bg-white/10 border-white/20 outline-none focus:ring-2 ring-blue-500 transition-all" placeholder="serial_id" value={newColKey} onChange={e => setNewColKey(e.target.value)} />
              </div>
              <div className="w-full md:w-48">
                <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Data Format</label>
                <div className="relative">
                  <select className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl font-bold text-sm appearance-none text-white outline-none focus:ring-2 ring-blue-500 transition-all cursor-pointer" value={newColType} onChange={e => setNewColType(e.target.value as any)}>
                    <option value="text" className="text-slate-900">Text (String)</option>
                    <option value="number" className="text-slate-900">Number (Int)</option>
                    <option value="image" className="text-slate-900">Image (File)</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                 <button type="button" onClick={addOrUpdateColumn} className="px-10 py-3 bg-blue-600 rounded-xl font-black text-xs uppercase shadow-xl hover:bg-blue-500 transition-all whitespace-nowrap">{editingColId ? 'APPLY UPDATE' : 'REGISTER FIELD'}</button>
                 {editingColId && <button type="button" onClick={() => { setEditingColId(null); setNewColLabel(''); setNewColKey(''); }} className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest text-center">Cancel Edit</button>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formData.columns.map(col => (
                <div key={col.id} className="p-6 rounded-[24px] border border-slate-100 bg-white flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow group">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">{col.type}</span>
                      {col.isCore && <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SYSTEM CORE</span>}
                    </div>
                    <h5 className="text-sm font-black text-slate-900">{col.label}</h5>
                    <p className="text-[9px] font-mono text-slate-400 mt-1">{col.id}</p>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <button type="button" onClick={() => startEditColumn(col)} className="flex-1 py-2 bg-slate-100 text-slate-900 rounded-lg text-[10px] font-black uppercase hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"><ICONS.Signature />Edit</button>
                    <button type="button" onClick={() => removeColumn(col.id)} className="flex-1 py-2 bg-red-50 text-red-500 rounded-lg text-[10px] font-black uppercase hover:bg-red-100 transition-colors">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'WORDING' && (
          <div className="space-y-8 max-w-4xl">
             <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl mb-4">
               <p className="text-xs font-bold text-amber-700 flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                 Quick Tip: You can also edit many titles directly on the pages by clicking the pencil icon next to them!
               </p>
             </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {Object.entries(formData.labels).map(([k, v]) => (
                <div key={k}>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">{k}</label>
                  <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 ring-blue-500" value={v || ''} onChange={e => setFormData({ ...formData, labels: { ...formData.labels, [k]: e.target.value } })} />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'CLOUD' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="Upstash URL" value={dbCreds.url} onChange={e => setDbCreds({ ...dbCreds, url: e.target.value })} />
              <input type="password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="Token" value={dbCreds.token} onChange={e => setDbCreds({ ...dbCreds, token: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <button onClick={saveDBCreds} className="py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs shadow-xl">LINK MESH</button>
                <button onClick={forcePull} className="py-5 bg-emerald-600 text-white rounded-[24px] font-black text-xs shadow-xl">RECOVER CLOUD</button>
              </div>
              <button onClick={forcePush} className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs shadow-xl">MANUAL CLOUD PUSH</button>
            </div>
            <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-200 flex flex-col h-[500px] overflow-auto">
              <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4">Cloud Operation Log</h4>
              {storageService.getSessionLogs().map((log, i) => (
                <div key={i} className="p-3 bg-white border border-slate-100 rounded-xl mb-2 text-[10px] font-bold flex gap-3"><span className="text-slate-300">[{new Date(log.timestamp).toLocaleTimeString()}]</span><span className={log.status === 'ERROR' ? 'text-red-500' : 'text-blue-500'}>{log.message}</span></div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;