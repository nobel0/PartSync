
import React, { useState, useEffect, useRef } from 'react';
import { AppConfig, ColumnDefinition, User, Part } from '../types';
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
  const [activeTab, setActiveTab] = useState<'VISUALS' | 'REGISTRY' | 'COLUMNS' | 'PERSONNEL' | 'CLOUD' | 'DATA'>('DATA');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const [newModelItem, setNewModelItem] = useState('');
  const [newShopItem, setNewShopItem] = useState('');
  const [dbCreds, setDbCreds] = useState({ url: '', token: '' });
  
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColKey, setNewColKey] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number' | 'image'>('text');
  const [isPrimaryCol, setIsPrimaryCol] = useState(false);
  
  const [newUser, setNewUser] = useState<Partial<User>>({ role: 'INTERNAL_LOGISTIC', assignedLine: 'ALL' });

  // Use a ref to track the last committed config to prevent overwriting user edits on App re-renders
  const configRef = useRef(config.updatedAt);

  useEffect(() => {
    // Only update internal state if the external config is truly newer than what we have
    if (config.updatedAt > formData.updatedAt) {
      setFormData({ ...config });
      configRef.current = config.updatedAt;
      setHasUnsavedChanges(false);
    }
  }, [config]);

  const handleFormUpdate = (updated: AppConfig) => {
    setFormData(updated);
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    const updatedWithTimestamp = { ...formData, updatedAt: Date.now() };
    onSaveConfig(updatedWithTimestamp);
    setHasUnsavedChanges(false);
    alert("✅ Facility configuration successfully committed to the registry.");
  };

  const moveColumn = (index: number, direction: 'UP' | 'DOWN') => {
    const newColumns = [...formData.columns];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newColumns.length) return;
    [newColumns[index], newColumns[targetIndex]] = [newColumns[targetIndex], newColumns[index]];
    handleFormUpdate({ ...formData, columns: newColumns });
  };

  const addItem = (type: 'carModels' | 'manufacturingShops') => {
    const val = type === 'carModels' ? newModelItem : newShopItem;
    if (!val.trim()) return;
    if (formData[type].includes(val.trim())) return alert("Asset identifier already registered in taxonomy.");
    handleFormUpdate({ ...formData, [type]: [...prevItems(type), val.trim()] });
    if (type === 'carModels') setNewModelItem(''); else setNewShopItem('');
  };
  
  const prevItems = (type: 'carModels' | 'manufacturingShops'): string[] => formData[type];

  const removeItem = (type: 'carModels' | 'manufacturingShops', index: number) => {
    const updated = [...formData[type]];
    updated.splice(index, 1);
    handleFormUpdate({ ...formData, [type]: updated });
  };

  const handleAddUser = () => {
    if (!newUser.username || !newUser.email || !newUser.password || !newUser.role) {
      return alert("Validation Failed: All fields (Name, Email, Passkey, Role) are mandatory for personnel enrollment.");
    }
    const enrolledUser: User = {
      id: `USER_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username: newUser.username!,
      email: newUser.email!,
      password: newUser.password!,
      role: newUser.role as any,
      assignedLine: newUser.assignedLine || 'ALL'
    };
    handleFormUpdate({ ...formData, users: [...formData.users, enrolledUser] });
    setNewUser({ role: 'INTERNAL_LOGISTIC', assignedLine: 'ALL', username: '', email: '', password: '' });
  };

  const handleExportExcel = () => {
    const parts = storageService.getParts();
    const worksheet = (window as any).XLSX.utils.json_to_sheet(parts);
    const workbook = (window as any).XLSX.utils.book_new();
    (window as any).XLSX.utils.book_append_sheet(workbook, worksheet, "Asset_Registry");
    (window as any).XLSX.writeFile(workbook, `PartFlow_Registry_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = (window as any).XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = (window as any).XLSX.utils.sheet_to_json(ws);
        if (data.length > 0) {
          if (confirm(`Detected ${data.length} assets in file. Overwrite/Sync with current registry?`)) {
            await storageService.saveParts(data as Part[]);
            onDataRefresh();
            alert(`✅ Successfully synchronized ${data.length} assets.`);
          }
        }
      } catch (err) { alert("XLSX Engine Error: " + err); }
    };
    reader.readAsBinaryString(file);
  };

  const addOrUpdateColumn = () => {
    if (!newColLabel.trim() || !newColKey.trim()) return;
    const finalKey = newColKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    let updatedColumns = isPrimaryCol ? formData.columns.map(c => ({ ...c, isPrimary: false })) : [...formData.columns];

    if (editingColId) {
      updatedColumns = updatedColumns.map(col => 
        col.id === editingColId ? { ...col, id: finalKey, label: newColLabel.trim(), type: newColType, isPrimary: isPrimaryCol } : col
      );
    } else {
      if (formData.columns.some(c => c.id === finalKey)) return alert("Schema Conflict: System Key ID already exists.");
      updatedColumns.push({ id: finalKey, label: newColLabel.trim(), type: newColType, isCore: false, isPrimary: isPrimaryCol });
    }
    
    handleFormUpdate({ ...formData, columns: updatedColumns });
    setEditingColId(null);
    setNewColLabel(''); setNewColKey(''); setNewColType('text'); setIsPrimaryCol(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900">System Architect</h3>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold flex items-center gap-2">
            Facility Config & Operations Control
            {hasUnsavedChanges && <span className="text-blue-600 animate-pulse bg-blue-50 px-2 py-0.5 rounded ml-2">● Unsaved Changes</span>}
          </p>
        </div>
        <div className="flex gap-4">
          <button onClick={onDataRefresh} className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors">Refresh Mesh</button>
          <button onClick={handleSave} className={`px-10 py-3 rounded-2xl font-black shadow-xl hover:scale-105 transition-all text-[10px] uppercase tracking-widest ${hasUnsavedChanges ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-900 text-white'}`}>
            {hasUnsavedChanges ? 'Save Changes' : 'Commit Config'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto scrollbar-hide">
        <TabButton id="DATA" label="Data Lab" />
        <TabButton id="VISUALS" label="Appearance" />
        <TabButton id="REGISTRY" label="Taxonomy" />
        <TabButton id="COLUMNS" label="Schema" />
        <TabButton id="PERSONNEL" label="Personnel" />
        <TabButton id="CLOUD" label="Mesh Link" />
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl p-8 lg:p-12 min-h-[500px]">
        {activeTab === 'DATA' && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Excel Section */}
              <div className="bg-emerald-900 p-10 rounded-[40px] text-white space-y-8 shadow-xl relative overflow-hidden flex flex-col justify-between h-[380px]">
                <div className="absolute top-0 right-0 p-4 opacity-10 scale-150"><ICONS.Inventory /></div>
                <div>
                  <h4 className="text-2xl font-black">Excel Studio</h4>
                  <p className="text-xs text-emerald-200 opacity-80 mt-2 uppercase tracking-widest font-bold">XLSX Export & Bulk Registry Entry</p>
                  <p className="text-[10px] text-emerald-300/60 mt-4 leading-relaxed italic">Download the facility registry as a spreadsheet for offline auditing, or upload an XLSX file to bulk-enroll parts into the system.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={handleExportExcel} className="flex-1 py-4 bg-white text-emerald-900 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 transition-transform flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export XLSX
                  </button>
                  <label className="flex-1 py-4 bg-emerald-800 text-white border border-emerald-700 rounded-2xl font-black text-[10px] text-center uppercase tracking-widest cursor-pointer hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Import XLSX
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
                  </label>
                </div>
              </div>

              {/* JSON Section */}
              <div className="bg-slate-900 p-10 rounded-[40px] text-white space-y-8 shadow-xl relative overflow-hidden flex flex-col justify-between h-[380px]">
                <div className="absolute top-0 right-0 p-4 opacity-10 scale-150"><ICONS.Dashboard /></div>
                <div>
                  <h4 className="text-2xl font-black">System Backup</h4>
                  <p className="text-xs text-slate-400 mt-2 uppercase tracking-widest font-bold">JSON Full State Snapshots</p>
                  <p className="text-[10px] text-slate-500 mt-4 leading-relaxed italic">The "System Image" is a complete JSON snapshot of all facility data: parts, users, and app configurations. Essential for migrations or recovery.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={() => storageService.exportBackup()} className="flex-1 py-4 bg-slate-800 text-white border border-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export Backup
                  </button>
                  <label className="flex-1 py-4 bg-white text-slate-900 rounded-2xl font-black text-[10px] text-center uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Restore Image
                    <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && window.confirm("CRITICAL WARNING: This will overwrite ALL current registry data, users, and configurations with the snapshot content. Proceed?")) {
                        const success = await storageService.importBackup(file);
                        if (success) {
                          onDataRefresh();
                          alert("✅ System state successfully restored from image.");
                        }
                      }
                    }} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'VISUALS' && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Platform Identity Name</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={formData.appName} onChange={e => handleFormUpdate({ ...formData, appName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Global Brand Accent</label>
                  <input type="color" className="h-14 w-20 rounded-2xl cursor-pointer bg-white p-1 border border-slate-200 shadow-sm" value={formData.primaryColor} onChange={e => handleFormUpdate({ ...formData, primaryColor: e.target.value })} />
                </div>
              </div>
              <div className="bg-slate-50 p-8 rounded-[40px] border border-dashed border-slate-300 flex flex-col items-center justify-center">
                <div className="w-32 h-32 bg-white rounded-3xl mb-6 overflow-hidden flex items-center justify-center border border-slate-100 shadow-sm">
                  {formData.logoUrl ? <img src={formData.logoUrl} className="max-w-[80%] max-h-[80%] object-contain" /> : <ICONS.Inventory />}
                </div>
                <label className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-lg hover:bg-black transition-colors">
                  Change Facility Logo
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => handleFormUpdate({ ...formData, logoUrl: reader.result as string });
                      reader.readAsDataURL(file);
                    }
                  }} />
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'REGISTRY' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 animate-in fade-in duration-500">
            <div className="space-y-6">
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Fleet Asset Taxonomy</h4>
              <div className="flex gap-2">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="New Model ID..." value={newModelItem} onChange={e => setNewModelItem(e.target.value)} />
                <button onClick={() => addItem('carModels')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-[10px] uppercase tracking-widest">Register</button>
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
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Manufacturing Zones</h4>
              <div className="flex gap-2">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="New Shop/Zone..." value={newShopItem} onChange={e => setNewShopItem(e.target.value)} />
                <button onClick={() => addItem('manufacturingShops')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-[10px] uppercase tracking-widest">Register</button>
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

        {activeTab === 'PERSONNEL' && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="bg-slate-900 p-8 rounded-[32px] text-white space-y-6 shadow-2xl">
              <h4 className="text-lg font-black uppercase tracking-tight">Personnel Enrollment Portal</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <input className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Legal Full Name" value={newUser.username || ''} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                <input className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Authorized Email" value={newUser.email || ''} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                <input type="password" className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Secure Passkey" value={newUser.password || ''} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                <select className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}>
                  <option value="INTERNAL_LOGISTIC" className="text-slate-900">Internal Logistic (Warehouse)</option>
                  <option value="ENGINEER" className="text-slate-900">Engineer (Line Access)</option>
                  <option value="ADMIN" className="text-slate-900">System Administrator</option>
                  <option value="SUPPLIER" className="text-slate-900">External Supplier</option>
                </select>
                <div className="col-span-full md:col-span-2 flex gap-4">
                  <select className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white" value={newUser.assignedLine} onChange={e => setNewUser({ ...newUser, assignedLine: e.target.value })}>
                    <option value="ALL" className="text-slate-900">Global Facility Authorization</option>
                    {formData.manufacturingShops.map(s => <option key={s} value={s} className="text-slate-900">{s}</option>)}
                  </select>
                  <button onClick={handleAddUser} className="px-10 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-colors">Enroll Agent</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formData.users.map(u => (
                <div key={u.id} className="p-6 rounded-[24px] border border-slate-100 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-all group">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${u.role === 'ADMIN' ? 'bg-red-100 text-red-600' : u.role === 'ENGINEER' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{u.role.replace('_', ' ')}</span>
                      {u.id !== 'admin_01' && (
                        <button onClick={() => {
                          if (confirm("Revoke access for this agent?")) {
                            handleFormUpdate({...formData, users: formData.users.filter(x => x.id !== u.id)});
                          }
                        }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      )}
                    </div>
                    <h5 className="font-black text-slate-900 mt-2 text-sm">{u.username}</h5>
                    <p className="text-[10px] text-slate-400 font-medium truncate">{u.email}</p>
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">{u.assignedLine === 'ALL' ? 'Plant-Wide Auth' : `Zone: ${u.assignedLine}`}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {hasUnsavedChanges && (
              <div className="sticky bottom-0 bg-blue-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-2xl animate-bounce">
                <span className="text-xs font-black uppercase tracking-widest">Unsaved Personnel Edits Detected</span>
                <button onClick={handleSave} className="bg-white text-blue-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Commit Now</button>
              </div>
            )}
          </div>
        )}

        {/* Other tabs follow the same handleFormUpdate pattern... */}
        {activeTab === 'COLUMNS' && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <div id="schema-form" className="bg-slate-900 p-8 rounded-[32px] text-white shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-end gap-6">
                <div className="flex-1">
                  <label className="block text-[8px] font-black uppercase text-slate-400 mb-2 tracking-widest">Schema Display Label</label>
                  <input className="w-full px-5 py-3 bg-white/10 border border-white/20 rounded-xl font-bold" placeholder="e.g. Batch Number" value={newColLabel} onChange={e => setNewColLabel(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="block text-[8px] font-black uppercase text-slate-400 mb-2 tracking-widest">System Key (Unique ID)</label>
                  <input className="w-full px-5 py-3 bg-white/10 border border-white/20 rounded-xl font-mono text-sm" placeholder="batch_id" value={newColKey} onChange={e => setNewColKey(e.target.value)} />
                </div>
                <div className="w-full md:w-32">
                  <label className="block text-[8px] font-black uppercase text-slate-400 mb-2 tracking-widest">Data Type</label>
                  <select className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white" value={newColType} onChange={e => setNewColType(e.target.value as any)}>
                    <option value="text" className="text-slate-900">String/Text</option>
                    <option value="number" className="text-slate-900">Metric/Number</option>
                    <option value="image" className="text-slate-900">Visual/Image</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 h-12 pb-1">
                  <input type="checkbox" id="isPrimary" checked={isPrimaryCol} onChange={e => setIsPrimaryCol(e.target.checked)} className="w-4 h-4" />
                  <label htmlFor="isPrimary" className="text-[10px] font-black uppercase tracking-widest">Primary ID</label>
                </div>
                <button onClick={addOrUpdateColumn} className="px-10 py-3 bg-blue-600 rounded-xl font-black text-xs uppercase shadow-xl hover:bg-blue-500 transition-colors">
                  {editingColId ? 'Apply Edit' : 'Add Field'}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formData.columns.map((col, idx) => (
                <div key={col.id} className="p-6 rounded-[24px] border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all group">
                  <div>
                    <div className="flex justify-between items-start">
                      <div className="flex gap-1">
                        <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded tracking-widest">{col.type}</span>
                        {col.isPrimary && <span className="text-[10px] font-black text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded tracking-widest">Identity</span>}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => moveColumn(idx, 'UP')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">▲</button>
                         <button onClick={() => moveColumn(idx, 'DOWN')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">▼</button>
                      </div>
                    </div>
                    <h5 className="text-sm font-black text-slate-900 mt-2">{col.label}</h5>
                    <p className="text-[9px] font-mono text-slate-400">{col.id}</p>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <button onClick={() => { setEditingColId(col.id); setNewColLabel(col.label); setNewColKey(col.id); setNewColType(col.type); setIsPrimaryCol(!!col.isPrimary); }} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black hover:bg-slate-900 hover:text-white transition-all uppercase tracking-widest">Edit</button>
                    {!col.isCore && <button onClick={() => handleFormUpdate({...formData, columns: formData.columns.filter(c => c.id !== col.id)})} className="flex-1 py-2 bg-red-50 text-red-500 rounded-lg text-[9px] font-black hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest">Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'CLOUD' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in duration-500">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Facility Mesh Link</h4>
              <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="REST Upstash Endpoint URL" value={dbCreds.url} onChange={e => setDbCreds({ ...dbCreds, url: e.target.value })} />
              <input type="password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="Mesh Authorization Token" value={dbCreds.token} onChange={e => setDbCreds({ ...dbCreds, token: e.target.value })} />
              <button onClick={() => { storageService.setDBCredentials(dbCreds); alert("Cloud Mesh Authorization Committed."); }} className="w-full py-4 bg-slate-900 text-white rounded-[20px] font-black text-xs shadow-lg uppercase tracking-widest hover:bg-black transition-all">Link Registry Mesh</button>
            </div>
            
            <div className="bg-slate-900 rounded-[32px] p-8 text-white h-[450px] flex flex-col">
               <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Synchronization Protocol Logs</h4>
               <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 text-[10px] font-mono">
                  {storageService.getSessionLogs().map((log, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${log.status === 'SUCCESS' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                       <span className="opacity-50">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.type}: {log.message}
                    </div>
                  ))}
                  {storageService.getSessionLogs().length === 0 && <p className="text-slate-600 italic text-center py-10 uppercase tracking-[0.2em] font-black">No mesh activity detected.</p>}
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
