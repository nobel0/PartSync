
import React, { useState, useEffect } from 'react';
import { AppConfig, ColumnDefinition, User } from '../types';
import { storageService } from '../services/storageService';
import { ICONS } from '../constants';
// @ts-ignore
import * as XLSXModule from 'xlsx';

interface AdminPanelProps {
  config: AppConfig;
  onSaveConfig: (config: AppConfig) => void;
  onDataRefresh: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ config, onSaveConfig, onDataRefresh }) => {
  const [formData, setFormData] = useState<AppConfig>({ ...config });
  const [activeTab, setActiveTab] = useState<'VISUALS' | 'REGISTRY' | 'COLUMNS' | 'PERSONNEL' | 'CLOUD' | 'DATA'>('VISUALS');
  
  const [newModelItem, setNewModelItem] = useState('');
  const [newShopItem, setNewShopItem] = useState('');
  const [dbCreds, setDbCreds] = useState({ url: '', token: '' });
  
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColKey, setNewColKey] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number' | 'image'>('text');
  
  const [newUser, setNewUser] = useState<Partial<User>>({ role: 'INTERNAL_LOGISTIC', assignedLine: 'ALL' });

  useEffect(() => {
    const current = storageService.getDBCredentials();
    if (current) setDbCreds(current);
  }, []);

  const handleSave = () => {
    onSaveConfig(formData);
    alert("✅ System Configuration Updated Successfully");
  };

  const moveColumn = (index: number, direction: 'UP' | 'DOWN') => {
    const newColumns = [...formData.columns];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newColumns.length) return;
    [newColumns[index], newColumns[targetIndex]] = [newColumns[targetIndex], newColumns[index]];
    setFormData({ ...formData, columns: newColumns });
  };

  const addItem = (type: 'carModels' | 'manufacturingShops') => {
    const val = type === 'carModels' ? newModelItem : newShopItem;
    if (!val.trim()) return;
    if (formData[type].includes(val.trim())) return alert("Item already exists.");
    setFormData(prev => ({ ...prev, [type]: [...prev[type], val.trim()] }));
    if (type === 'carModels') setNewModelItem(''); else setNewShopItem('');
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
  };

  const addOrUpdateColumn = () => {
    if (!newColLabel.trim() || !newColKey.trim()) return;
    const finalKey = newColKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    if (editingColId) {
      const updatedColumns = formData.columns.map(col => 
        col.id === editingColId ? { ...col, id: finalKey, label: newColLabel.trim(), type: newColType } : col
      );
      setFormData({ ...formData, columns: updatedColumns });
      setEditingColId(null);
    } else {
      if (formData.columns.some(c => c.id === finalKey)) return alert("Field ID collision detected.");
      setFormData({ ...formData, columns: [...formData.columns, { id: finalKey, label: newColLabel.trim(), type: newColType, isCore: false }] });
    }
    setNewColLabel(''); setNewColKey(''); setNewColType('text');
  };

  const handleAddUser = () => {
    if (!newUser.username || !newUser.email || !newUser.password) return alert("Fill all fields.");
    const userToAdd: User = {
      id: `USR_${Date.now()}`,
      username: newUser.username,
      email: newUser.email,
      password: newUser.password,
      role: newUser.role as any,
      assignedLine: newUser.assignedLine || 'ALL'
    };
    setFormData({ ...formData, users: [...formData.users, userToAdd] });
    setNewUser({ role: 'INTERNAL_LOGISTIC', assignedLine: 'ALL' });
  };

  const handleExportExcel = () => {
    try {
      const parts = storageService.getParts();
      const worksheet = (window as any).XLSX.utils.json_to_sheet(parts);
      const workbook = (window as any).XLSX.utils.book_new();
      (window as any).XLSX.utils.book_append_sheet(workbook, worksheet, "Parts Registry");
      (window as any).XLSX.writeFile(workbook, `PartFlow_Master_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      alert("Export failed: " + e);
    }
  };

  const TabButton: React.FC<{ id: typeof activeTab; label: string }> = ({ id, label }) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`px-6 py-4 font-black text-[10px] lg:text-xs transition-all border-b-4 uppercase tracking-widest ${activeTab === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      <div className="flex items-center justify-between bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-3xl font-black text-slate-900">System Architect</h3>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">Facility Config & Personnel Control</p>
        </div>
        <div className="flex gap-4">
          <button onClick={onDataRefresh} className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50">Refresh Data</button>
          <button onClick={handleSave} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition-all text-[10px] uppercase tracking-widest">Save System Config</button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto scrollbar-hide">
        <TabButton id="VISUALS" label="Appearance" />
        <TabButton id="REGISTRY" label="Taxonomy" />
        <TabButton id="COLUMNS" label="Schema" />
        <TabButton id="PERSONNEL" label="Personnel" />
        <TabButton id="CLOUD" label="Cloud Mesh" />
        <TabButton id="DATA" label="Operations" />
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl p-8 lg:p-12 min-h-[500px]">
        {activeTab === 'VISUALS' && (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Platform Branding Name</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={formData.appName} onChange={e => setFormData({ ...formData, appName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Brand Accent Color</label>
                  <input type="color" className="h-14 w-20 rounded-2xl cursor-pointer bg-white p-1 border border-slate-200 shadow-sm" value={formData.primaryColor} onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} />
                </div>
              </div>
              <div className="bg-slate-50 p-8 rounded-[40px] border border-dashed border-slate-300 flex flex-col items-center justify-center">
                <div className="w-32 h-32 bg-white rounded-3xl mb-6 overflow-hidden flex items-center justify-center border border-slate-100 shadow-sm">
                  {formData.logoUrl ? <img src={formData.logoUrl} className="max-w-[80%] max-h-[80%] object-contain" /> : <ICONS.Inventory />}
                </div>
                <label className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-lg hover:bg-black transition-colors">
                  Upload Platform Logo
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => setFormData({ ...formData, logoUrl: reader.result as string });
                      reader.readAsDataURL(file);
                    }
                  }} />
                </label>
                <p className="mt-4 text-[9px] text-slate-400 font-bold uppercase">SVG, PNG or JPG (Max 2MB)</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'REGISTRY' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div className="space-y-6">
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Fleet Models</h4>
              <div className="flex gap-2">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="New Model..." value={newModelItem} onChange={e => setNewModelItem(e.target.value)} />
                <button onClick={() => addItem('carModels')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-[10px] uppercase tracking-widest">Add</button>
              </div>
              <div className="space-y-2">
                {formData.carModels.map((m, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                    <span className="font-bold text-slate-700 text-xs">{m}</span>
                    <button onClick={() => removeItem('carModels', i)} className="text-red-400 hover:text-red-600 px-2 font-black transition-colors">✕</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Manufacturing Shops</h4>
              <div className="flex gap-2">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="New Shop..." value={newShopItem} onChange={e => setNewShopItem(e.target.value)} />
                <button onClick={() => addItem('manufacturingShops')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-[10px] uppercase tracking-widest">Add</button>
              </div>
              <div className="space-y-2">
                {formData.manufacturingShops.map((m, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                    <span className="font-bold text-slate-700 text-xs">{m}</span>
                    <button onClick={() => removeItem('manufacturingShops', i)} className="text-red-400 hover:text-red-600 px-2 font-black transition-colors">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'COLUMNS' && (
          <div className="space-y-10">
            <div id="schema-form" className="bg-slate-900 p-8 rounded-[32px] text-white flex flex-col md:flex-row md:items-end gap-6 shadow-2xl">
              <div className="flex-1">
                <label className="block text-[8px] font-black uppercase text-slate-400 mb-2 tracking-widest">Field Display Label</label>
                <input className="w-full px-5 py-3 bg-white/10 border border-white/20 rounded-xl font-bold" placeholder="e.g. Serial Number" value={newColLabel} onChange={e => setNewColLabel(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="block text-[8px] font-black uppercase text-slate-400 mb-2 tracking-widest">System Key ID</label>
                <input className="w-full px-5 py-3 bg-white/10 border border-white/20 rounded-xl font-mono text-sm" placeholder="serial_id" value={newColKey} onChange={e => setNewColKey(e.target.value)} />
              </div>
              <div className="w-full md:w-32">
                <label className="block text-[8px] font-black uppercase text-slate-400 mb-2 tracking-widest">Type</label>
                <select className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white" value={newColType} onChange={e => setNewColType(e.target.value as any)}>
                   <option value="text" className="text-slate-900">Text</option>
                   <option value="number" className="text-slate-900">Number</option>
                   <option value="image" className="text-slate-900">Image</option>
                </select>
              </div>
              <button onClick={addOrUpdateColumn} className="px-10 py-3 bg-blue-600 rounded-xl font-black text-xs uppercase shadow-xl hover:bg-blue-500 transition-colors">
                {editingColId ? 'Apply Edit' : 'Add Column'}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formData.columns.map((col, idx) => (
                <div key={col.id} className="p-6 rounded-[24px] border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded tracking-widest">{col.type}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => moveColumn(idx, 'UP')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">▲</button>
                         <button onClick={() => moveColumn(idx, 'DOWN')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">▼</button>
                      </div>
                    </div>
                    <h5 className="text-sm font-black text-slate-900 mt-2">{col.label}</h5>
                    <p className="text-[9px] font-mono text-slate-400">{col.id}</p>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <button onClick={() => startEditColumn(col)} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black hover:bg-slate-900 hover:text-white transition-all uppercase tracking-widest">Edit</button>
                    {!col.isCore && <button onClick={() => setFormData({...formData, columns: formData.columns.filter(c => c.id !== col.id)})} className="flex-1 py-2 bg-red-50 text-red-500 rounded-lg text-[9px] font-black hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest">Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'PERSONNEL' && (
          <div className="space-y-10">
            <div className="bg-slate-900 p-8 rounded-[32px] text-white space-y-6 shadow-2xl">
              <h4 className="text-lg font-black uppercase tracking-tight">Personnel Enrollment</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <input className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Full Name" value={newUser.username || ''} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                <input className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Auth Email" value={newUser.email || ''} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                <input type="password" className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Access Passkey" value={newUser.password || ''} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                <select className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}>
                  <option value="INTERNAL_LOGISTIC" className="text-slate-900">Internal Logistic (Warehouse)</option>
                  <option value="ENGINEER" className="text-slate-900">Engineer (Shop Floor)</option>
                  <option value="ADMIN" className="text-slate-900">Facility Admin</option>
                  <option value="SUPPLIER" className="text-slate-900">External Supplier</option>
                </select>
                <div className="col-span-full md:col-span-2 flex gap-4">
                  <select className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white" value={newUser.assignedLine} onChange={e => setNewUser({ ...newUser, assignedLine: e.target.value })}>
                    <option value="ALL" className="text-slate-900">Global Access (Full Plant)</option>
                    {formData.manufacturingShops.map(s => <option key={s} value={s} className="text-slate-900">{s}</option>)}
                  </select>
                  <button onClick={handleAddUser} className="px-8 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-colors">Register Personnel</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formData.users.map(u => (
                <div key={u.id} className="p-6 rounded-[24px] border border-slate-100 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-all group">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${u.role === 'ADMIN' ? 'bg-red-100 text-red-600' : u.role === 'ENGINEER' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{u.role.replace('_', ' ')}</span>
                      {u.id !== 'admin_01' && <button onClick={() => setFormData({...formData, users: formData.users.filter(x => x.id !== u.id)})} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">✕</button>}
                    </div>
                    <h5 className="font-black text-slate-900 mt-2">{u.username}</h5>
                    <p className="text-[10px] text-slate-400 font-medium">{u.email}</p>
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">{u.assignedLine === 'ALL' ? 'Full Plant Access' : `Assigned: ${u.assignedLine}`}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'CLOUD' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mesh Database Credentials</h4>
              <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="Upstash REST URL (https://...)" value={dbCreds.url} onChange={e => setDbCreds({ ...dbCreds, url: e.target.value })} />
              <input type="password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="Database Access Token" value={dbCreds.token} onChange={e => setDbCreds({ ...dbCreds, token: e.target.value })} />
              <button onClick={() => { storageService.setDBCredentials(dbCreds); alert("Cloud Mesh Linked."); }} className="w-full py-4 bg-slate-900 text-white rounded-[20px] font-black text-xs shadow-lg uppercase tracking-widest hover:bg-black transition-all">Connect Global Registry</button>
              
              <div className="pt-6 space-y-4">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Synchronization</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <button onClick={async () => { await storageService.pushToCloud(); alert("Registry Mesh Committed."); }} className="py-4 bg-emerald-600 text-white rounded-[20px] font-black text-[10px] uppercase tracking-widest shadow-lg">Manual Push (Save)</button>
                    <button onClick={async () => { await storageService.syncWithCloud(true); onDataRefresh(); alert("Facility Registry Restored."); }} className="py-4 bg-blue-600 text-white rounded-[20px] font-black text-[10px] uppercase tracking-widest shadow-lg">Cloud Recovery (Pull)</button>
                 </div>
              </div>
            </div>
            
            <div className="bg-slate-900 rounded-[32px] p-8 text-white flex flex-col h-[400px]">
               <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Synchronization Logs</h4>
               <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 text-[10px] font-mono">
                  {storageService.getSessionLogs().map((log, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${log.status === 'SUCCESS' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                       <span className="opacity-50">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.type}: {log.message}
                    </div>
                  ))}
                  {storageService.getSessionLogs().length === 0 && <p className="text-slate-600 italic">No sync events logged in current session.</p>}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'DATA' && (
           <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 <div className="bg-emerald-900 p-10 rounded-[40px] text-white space-y-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-[300px]">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><ICONS.Inventory /></div>
                    <div>
                      <h4 className="text-xl font-black">Master Export</h4>
                      <p className="text-xs text-emerald-200 opacity-80 mt-2">Generate full industrial asset registry snapshot in Excel format for auditing.</p>
                    </div>
                    <button onClick={handleExportExcel} className="w-full py-5 bg-white text-emerald-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl">Download Global Registry (.xlsx)</button>
                 </div>

                 <div className="bg-slate-100 p-10 rounded-[40px] border border-slate-200 space-y-6 h-[300px] flex flex-col justify-between">
                    <div>
                      <h4 className="text-xl font-black text-slate-900">Bulk Import</h4>
                      <p className="text-xs text-slate-500 mt-2">Upload facility CSV or Excel data to bulk update the registry. Template required.</p>
                    </div>
                    <label className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] text-center uppercase tracking-widest cursor-pointer shadow-xl hover:bg-black">
                       Select Registry File
                       <input type="file" className="hidden" onChange={() => alert("Bulk import handler initiated. Mapping system fields...")} />
                    </label>
                 </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
