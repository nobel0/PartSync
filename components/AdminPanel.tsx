
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
    const finalKey = newColKey.trim().toLowerCase().replace(/\s+/g, '_');
    
    if (editingColId) {
      // Logic for editing existing column
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
      // Adding new column
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
        <TabButton id="COLUMNS" label="Schema (Core)" />
        <TabButton id="DATA" label="Data Ops" />
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl p-12">
        {activeTab === 'VISUALS' && (
          <div className="space-y-8 max-w-xl">
             <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Platform Branding</label>
                <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={formData.appName} onChange={e => setFormData({ ...formData, appName: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">UI Accent Hex Code</label>
                <div className="flex gap-4 items-center">
                  <input type="color" className="h-14 w-20 rounded-2xl cursor-pointer border-none bg-transparent" value={formData.primaryColor} onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} />
                  <span className="font-mono text-sm text-slate-500 font-bold">{formData.primaryColor}</span>
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
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 grid grid-cols-3 gap-6 items-end">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Friendly Label</label>
                <input className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold" value={newColLabel} onChange={e => {
                  setNewColLabel(e.target.value);
                  if (!editingColId) setNewColKey(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                }} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1">System ID (Database Key)</label>
                <input disabled={editingColId && formData.columns.find(c => c.id === editingColId)?.isCore} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-mono text-[10px] font-bold disabled:bg-slate-100" value={newColKey} onChange={e => setNewColKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))} />
              </div>
              <div className="flex gap-2">
                 <select className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" value={newColType} onChange={e => setNewColType(e.target.value as any)}>
                    <option value="text">STRING</option>
                    <option value="number">INTEGER</option>
                 </select>
                 <button onClick={addOrUpdateColumn} className="bg-slate-900 text-white px-6 rounded-xl font-black text-xs">
                   {editingColId ? 'UPDATE' : 'CREATE'}
                 </button>
                 {editingColId && <button onClick={() => { setEditingColId(null); setNewColLabel(''); setNewColKey(''); }} className="px-3 text-slate-400">✕</button>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {formData.columns.map(col => (
                <div key={col.id} className={`p-5 bg-white border-2 rounded-2xl flex items-center justify-between ${editingColId === col.id ? 'border-blue-500 shadow-lg' : 'border-slate-100'}`}>
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 text-xs truncate uppercase tracking-tight">{col.label}</p>
                    <p className="text-[8px] text-slate-400 font-mono font-bold">KEY: {col.id} • {col.type.toUpperCase()}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingColId(col.id); setNewColLabel(col.label); setNewColKey(col.id); setNewColType(col.type); }} className="p-2 text-slate-300 hover:text-slate-900">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    {!col.isCore && (
                      <button onClick={() => deleteColumn(col.id)} className="p-2 text-slate-300 hover:text-red-500">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'DATA' && (
          <div className="grid grid-cols-2 gap-10">
            <div className="p-10 bg-slate-50 rounded-[32px] border border-slate-100 text-center">
               <h4 className="text-lg font-black text-slate-900 uppercase">Universal Export</h4>
               <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1 mb-6">Includes Signatures & Handshake Logs</p>
               <button onClick={() => storageService.exportCSV()} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-xl">Download System Report</button>
            </div>
            <div className="p-10 bg-blue-50 rounded-[32px] border border-blue-100 text-center">
               <h4 className="text-lg font-black text-slate-900 uppercase">Mass Asset Intake</h4>
               <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1 mb-6">Import via Standard CSV File</p>
               <label className="w-full py-4 bg-white border-2 border-dashed border-blue-300 text-blue-600 rounded-2xl font-black text-xs cursor-pointer block">
                  <input type="file" className="hidden" onChange={async (e) => {
                    const text = await e.target.files?.[0].text();
                    if(text) { storageService.importCSV(text); onDataRefresh(); alert("Import Success."); }
                  }} />
                  SELECT FILE
               </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
