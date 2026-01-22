
import React, { useState, useEffect } from 'react';
import { AppConfig, ColumnDefinition, Part, User } from '../types';
import { ICONS } from '../constants';
import { storageService } from '../services/storageService';
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
  const [isPrimary, setIsPrimary] = useState(false);

  const [newUser, setNewUser] = useState<Partial<User>>({ role: 'INTERNAL_LOGISTIC', assignedLine: config.manufacturingShops[0] || 'ALL' });
  const [importPreview, setImportPreview] = useState<{ headers: string[], rows: any[], newHeaders: string[] } | null>(null);

  useEffect(() => {
    const current = storageService.getDBCredentials();
    if (current) setDbCreds(current);
  }, []);

  // Update local form state if prop config changes
  useEffect(() => {
    setFormData({ ...config });
  }, [config]);

  const handleSave = () => {
    onSaveConfig(formData);
    alert("✅ System Configuration Updated Successfully");
  };

  const getXLSX = () => {
    if (XLSXModule && XLSXModule.utils) return XLSXModule;
    // @ts-ignore
    if (XLSXModule && XLSXModule.default && XLSXModule.default.utils) return XLSXModule.default;
    // @ts-ignore
    if (window.XLSX && window.XLSX.utils) return window.XLSX;
    return null;
  };

  const handleExportExcel = () => {
    try {
      const XLSX = getXLSX();
      if (!XLSX) throw new Error("XLSX engine not found.");
      const parts = storageService.getParts();
      const columns = config.columns;
      if (!parts || parts.length === 0) return alert("The registry is empty.");
      
      const EXCEL_CELL_LIMIT = 32767;
      const excelData = parts.map(part => {
        const row: any = {};
        columns.forEach(col => {
          let value = part[col.id] ?? '';
          let stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          if (stringValue.length > EXCEL_CELL_LIMIT) {
            stringValue = stringValue.substring(0, EXCEL_CELL_LIMIT - 3) + "...";
          }
          row[col.label] = stringValue;
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Asset Registry");
      XLSX.writeFile(workbook, `PartFlow_Registry_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      alert(`❌ Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    setIsPrimary(!!col.isPrimary);
    document.getElementById('schema-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const addOrUpdateColumn = () => {
    if (!newColLabel.trim() || !newColKey.trim()) return;
    const finalKey = newColKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    if (editingColId) {
      const updatedColumns = formData.columns.map(col => {
        const isTarget = col.id === editingColId;
        const updated = isTarget ? { ...col, id: finalKey, label: newColLabel.trim(), type: newColType, isPrimary: !!isPrimary } : { ...col };
        if (isPrimary && updated.id !== finalKey) updated.isPrimary = false;
        return updated;
      });
      setFormData({ ...formData, columns: updatedColumns });
      setEditingColId(null);
    } else {
      if (formData.columns.some(c => c.id === finalKey)) return alert("Field ID collision detected.");
      let updatedColumns = isPrimary ? formData.columns.map(c => ({ ...c, isPrimary: false } as ColumnDefinition)) : [...formData.columns];
      updatedColumns.push({ id: finalKey, label: newColLabel.trim(), type: newColType, isCore: false, isPrimary: !!isPrimary });
      setFormData({ ...formData, columns: updatedColumns });
    }
    setNewColLabel(''); setNewColKey(''); setNewColType('text'); setIsPrimary(false);
  };

  const removeColumn = (id: string) => {
    if (window.confirm("Purge column? Field data will be hidden from the registry views.")) {
      setFormData({ ...formData, columns: formData.columns.filter(c => c.id !== id) });
      storageService.clearColumnData(id);
    }
  };

  const handleAddUser = () => {
    if (!newUser.username || !newUser.email || !newUser.password) return alert("Please fill all identity fields.");
    const userToAdd: User = {
      id: `USR_${Date.now()}`,
      username: newUser.username,
      email: newUser.email,
      password: newUser.password,
      role: newUser.role as any,
      assignedLine: newUser.assignedLine || 'ALL'
    };
    setFormData({ ...formData, users: [...formData.users, userToAdd] });
    setNewUser({ role: 'INTERNAL_LOGISTIC', assignedLine: config.manufacturingShops[0] || 'ALL' });
  };

  const handleRemoveUser = (id: string) => {
    if (id === 'admin_01') return alert("Access Denied: Master admin is protected.");
    setFormData({ ...formData, users: formData.users.filter(u => u.id !== id) });
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
        <button onClick={handleSave} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition-all">Save System Config</button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-4xl">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Platform Branding</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={formData.appName} onChange={e => setFormData({ ...formData, appName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">UI Accent Color</label>
                  <input type="color" className="h-14 w-20 rounded-2xl cursor-pointer border-none bg-transparent" value={formData.primaryColor} onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'REGISTRY' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div className="space-y-6">
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Fleet Models</h4>
              <div className="flex gap-2">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Add Model..." value={newModelItem} onChange={e => setNewModelItem(e.target.value)} />
                <button onClick={() => addItem('carModels')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-xs uppercase tracking-widest">Add</button>
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
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Manufacturing Areas</h4>
              <div className="flex gap-2">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Add Area..." value={newShopItem} onChange={e => setNewShopItem(e.target.value)} />
                <button onClick={() => addItem('manufacturingShops')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-xs uppercase tracking-widest">Add</button>
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
                <label className="block text-[8px] font-black uppercase text-slate-400 mb-2 tracking-widest">Display Label</label>
                <input className="w-full px-5 py-3 bg-white/10 border border-white/20 rounded-xl font-bold" placeholder="e.g. Serial Number" value={newColLabel} onChange={e => setNewColLabel(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="block text-[8px] font-black uppercase text-slate-400 mb-2 tracking-widest">Internal Field ID</label>
                <input className="w-full px-5 py-3 bg-white/10 border border-white/20 rounded-xl font-mono text-sm" placeholder="serial_id" value={newColKey} onChange={e => setNewColKey(e.target.value)} />
              </div>
              <button onClick={addOrUpdateColumn} className="px-10 py-3 bg-blue-600 rounded-xl font-black text-xs uppercase shadow-xl hover:bg-blue-500 transition-colors">
                {editingColId ? 'Apply Update' : 'Register Field'}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formData.columns.map((col, idx) => (
                <div key={col.id} className="p-6 rounded-[24px] border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded tracking-widest">{col.type}</span>
                      <div className="flex gap-1">
                         <button 
                            onClick={() => moveColumn(idx, 'UP')} 
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all"
                            title="Move Up"
                         >▲</button>
                         <button 
                            onClick={() => moveColumn(idx, 'DOWN')} 
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all"
                            title="Move Down"
                         >▼</button>
                      </div>
                    </div>
                    <h5 className="text-sm font-black text-slate-900 mt-2">{col.label}</h5>
                    <p className="text-[9px] font-mono text-slate-400">{col.id}</p>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <button onClick={() => startEditColumn(col)} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black hover:bg-slate-900 hover:text-white transition-all uppercase tracking-widest">Edit</button>
                    {!col.isCore && <button onClick={() => removeColumn(col.id)} className="flex-1 py-2 bg-red-50 text-red-500 rounded-lg text-[10px] font-black hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest">Delete</button>}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <input className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Username" value={newUser.username || ''} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                <input className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Email" value={newUser.email || ''} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                <input type="password" className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Passkey" value={newUser.password || ''} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                <select className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}>
                  <option value="INTERNAL_LOGISTIC" className="text-slate-900">Internal Logistic</option>
                  <option value="ADMIN" className="text-slate-900">Facility Admin</option>
                  <option value="SUPPLIER" className="text-slate-900">External Supplier</option>
                </select>
                <select className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white" value={newUser.assignedLine} onChange={e => setNewUser({ ...newUser, assignedLine: e.target.value })}>
                  <option value="ALL" className="text-slate-900">Full Access (Global)</option>
                  {formData.manufacturingShops.map(s => <option key={s} value={s} className="text-slate-900">{s}</option>)}
                </select>
                <button onClick={handleAddUser} className="bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-colors">Enroll User</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formData.users.map(u => (
                <div key={u.id} className="p-6 rounded-[24px] border border-slate-100 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${u.role === 'ADMIN' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{u.role.replace('_', ' ')}</span>
                      {u.id !== 'admin_01' && <button onClick={() => handleRemoveUser(u.id)} className="text-slate-300 hover:text-red-500 transition-colors">✕</button>}
                    </div>
                    <h5 className="font-black text-slate-900 mt-2">{u.username}</h5>
                    <p className="text-[10px] text-slate-400 font-medium">{u.email}</p>
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-700">{u.assignedLine}</span>
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
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mesh Database Link</h4>
              <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="Upstash REST URL" value={dbCreds.url} onChange={e => setDbCreds({ ...dbCreds, url: e.target.value })} />
              <input type="password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="Access Token" value={dbCreds.token} onChange={e => setDbCreds({ ...dbCreds, token: e.target.value })} />
              <button onClick={() => storageService.setDBCredentials(dbCreds)} className="w-full py-4 bg-slate-900 text-white rounded-[20px] font-black text-xs shadow-lg uppercase tracking-widest hover:bg-black transition-all">Link Cloud Sync</button>
            </div>
          </div>
        )}

        {activeTab === 'DATA' && (
           <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-emerald-900 p-10 rounded-[40px] text-white space-y-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><ICONS.Inventory /></div>
                    <h4 className="text-xl font-black">Excel Integration</h4>
                    <p className="text-sm text-emerald-200 opacity-80">Export global asset snapshot for external reporting or auditing.</p>
                    <button onClick={handleExportExcel} className="w-full py-4 bg-white text-emerald-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform">Download Master XLSX</button>
                 </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
