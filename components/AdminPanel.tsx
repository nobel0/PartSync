import React, { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState<'VISUALS' | 'REGISTRY' | 'COLUMNS' | 'DATA'>('VISUALS');
  const [newItem, setNewItem] = useState('');
  
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColKey, setNewColKey] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number'>('text');

  const handleSave = () => {
    onSaveConfig(formData);
    alert("✅ System Configuration Updated Successfully");
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

  const deleteColumn = (id: string) => {
    if (!window.confirm("Remove this attribute? Data associated with this key will remain but hidden from UI.")) return;
    setFormData({ ...formData, columns: formData.columns.filter(c => c.id !== id) });
  };

  const clearDataForKey = (id: string) => {
    if (window.confirm(`Permanently wipe all data stored under "${id}" across all assets? This cannot be undone.`)) {
      storageService.clearColumnData(id);
      onDataRefresh();
      alert("Column data cleared.");
    }
  };

  const wipeAllData = () => {
    if (window.confirm("CRITICAL: This will permanently delete ALL assets, transfers, and notifications. Proceed?")) {
      storageService.wipeAllInventory();
      onDataRefresh();
      alert("System purged.");
    }
  }

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

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-4">Identity Logo</label>
                <div className="flex items-center gap-10 bg-slate-50 p-6 rounded-[32px] border border-slate-100 max-w-4xl">
                  <div className="w-24 h-24 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    <img src={formData.logoUrl} className="max-w-[80%] max-h-[80%] object-contain" alt="Preview" />
                  </div>
                  <div className="space-y-4 flex-1">
                    <input className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" placeholder="Logo URL..." value={formData.logoUrl} onChange={e => setFormData({ ...formData, logoUrl: e.target.value })} />
                    <label className="inline-block bg-white px-6 py-3 rounded-xl text-[10px] font-black border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                      UPLOAD BRAND IMAGE
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  </div>
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
            <div className="space-y-6">
              <h4 className="text-lg font-black text-slate-900 uppercase">Registered Shops</h4>
              <div className="flex gap-2">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Add Shop..." value={newItem} onChange={e => setNewItem(e.target.value)} />
                <button onClick={() => addItem('manufacturingShops')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-xs">Add</button>
              </div>
              <div className="space-y-2 max-h-48 overflow-auto">
                {formData.manufacturingShops.map((s, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-700 text-xs">{s}</span>
                    <button onClick={() => removeItem('manufacturingShops', i)} className="text-red-400">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'COLUMNS' && (
          <div className="space-y-8">
            <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 grid grid-cols-3 gap-6 items-end">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Friendly Label</label>
                <input className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold shadow-sm" placeholder="e.g. Material" value={newColLabel} onChange={e => {
                  setNewColLabel(e.target.value);
                  if (!editingColId) setNewColKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                }} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">System ID (Database Key)</label>
                <input 
                  disabled={!!(editingColId && formData.columns.find(c => c.id === editingColId)?.isCore)} 
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-mono text-[10px] font-bold disabled:bg-slate-100 shadow-sm" 
                  value={newColKey} 
                  onChange={e => setNewColKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} 
                />
              </div>
              <div className="flex gap-2">
                 <select className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-sm" value={newColType} onChange={e => setNewColType(e.target.value as any)}>
                    <option value="text">STRING</option>
                    <option value="number">NUMBER</option>
                 </select>
                 <button onClick={addOrUpdateColumn} className="bg-slate-900 text-white px-6 rounded-xl font-black text-xs shadow-lg">
                   {editingColId ? 'UPDATE' : 'CREATE'}
                 </button>
                 {editingColId && <button onClick={() => { setEditingColId(null); setNewColLabel(''); setNewColKey(''); }} className="px-3 text-slate-400">✕</button>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {formData.columns.map(col => (
                <div key={col.id} className={`p-5 bg-white border-2 rounded-2xl flex items-center justify-between ${editingColId === col.id ? 'border-blue-500 shadow-lg' : 'border-slate-100'}`}>
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 text-xs truncate uppercase tracking-tight">{col.label}</p>
                    <p className="text-[8px] text-slate-400 font-mono font-bold">KEY: {col.id} • {col.type.toUpperCase()}</p>
                  </div>
                  <div className="flex gap-1">
                    <button title="Clear Column Data" onClick={() => clearDataForKey(col.id)} className="p-2 text-slate-300 hover:text-amber-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                    <button title="Edit Schema" onClick={() => { setEditingColId(col.id); setNewColLabel(col.label); setNewColKey(col.id); setNewColType(col.type); }} className="p-2 text-slate-300 hover:text-slate-900">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    {!col.isCore && (
                      <button title="Delete Key" onClick={() => deleteColumn(col.id)} className="p-2 text-slate-300 hover:text-red-500">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'DATA' && (
          <div className="grid grid-cols-2 gap-10">
            <div className="p-10 bg-slate-50 rounded-[32px] border border-slate-100 flex flex-col items-center">
               <h4 className="text-lg font-black text-slate-900 uppercase">Export Registry</h4>
               <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1 mb-6 text-center">Download current database to CSV</p>
               <button onClick={() => storageService.exportCSV()} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-xl">DOWNLOAD CSV</button>
            </div>
            <div className="p-10 bg-blue-50 rounded-[32px] border border-blue-100 flex flex-col items-center">
               <h4 className="text-lg font-black text-slate-900 uppercase">Import Registry</h4>
               <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1 mb-6 text-center">Batch load assets via CSV</p>
               <label className="w-full py-4 bg-white border-2 border-dashed border-blue-300 text-blue-600 rounded-2xl font-black text-xs cursor-pointer block text-center">
                  <input type="file" className="hidden" onChange={async (e) => {
                    const text = await e.target.files?.[0].text();
                    if(text) { storageService.importCSV(text); onDataRefresh(); alert("Import Success."); }
                  }} />
                  SELECT FILE
               </label>
            </div>
            <div className="col-span-2 mt-4 p-8 bg-red-50 rounded-[32px] border border-red-100 flex items-center justify-between">
              <div>
                <h4 className="text-red-900 font-black uppercase">Factory Reset</h4>
                <p className="text-red-700 text-xs font-bold mt-1">Erase all inventory data. Configuration settings will be preserved.</p>
              </div>
              <button onClick={wipeAllData} className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black text-xs shadow-lg">PURGE SYSTEM DATA</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;