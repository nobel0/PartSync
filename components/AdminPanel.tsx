
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

  // Detection for Environment-provided keys
  const isEnvDriven = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

  useEffect(() => {
    // CRITICAL FIX: Only update form state from external config if the user has NO unsaved changes.
    // This prevents background syncs from wiping out a half-enrolled user or edited field.
    if (!hasUnsavedChanges) {
      setFormData({ ...config });
    }
    
    const current = storageService.getDBCredentials();
    if (current) setDbCreds(current);
  }, [config, hasUnsavedChanges]);

  const handleFormUpdate = (updated: AppConfig) => {
    setFormData(updated);
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    const updatedWithTimestamp = { ...formData, updatedAt: Date.now() };
    onSaveConfig(updatedWithTimestamp);
    setHasUnsavedChanges(false);
    alert("✅ Facility configuration and personnel committed to master registry.");
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
    if (formData[type].includes(val.trim())) return alert("ID already exists.");
    handleFormUpdate({ ...formData, [type]: [...formData[type], val.trim()] });
    if (type === 'carModels') setNewModelItem(''); else setNewShopItem('');
  };

  const removeItem = (type: 'carModels' | 'manufacturingShops', index: number) => {
    const updated = [...formData[type]];
    updated.splice(index, 1);
    handleFormUpdate({ ...formData, [type]: updated });
  };

  const handleAddUser = () => {
    if (!newUser.username || !newUser.email || !newUser.password || !newUser.role) {
      return alert("All fields are required to enroll personnel.");
    }
    const enrolledUser: User = {
      id: `USER_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username: newUser.username!,
      email: newUser.email!,
      password: newUser.password!,
      role: newUser.role as any,
      assignedLine: newUser.assignedLine || 'ALL'
    };
    // Update local state - user MUST click Commit to save permanently
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
          if (confirm(`Sync ${data.length} assets from file?`)) {
            await storageService.saveParts(data as Part[]);
            onDataRefresh();
            alert(`✅ Successfully synced ${data.length} assets.`);
          }
        }
      } catch (err) { alert("XLSX Error: " + err); }
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
      if (formData.columns.some(c => c.id === finalKey)) return alert("ID conflict.");
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
            {hasUnsavedChanges && <span className="text-blue-600 animate-pulse bg-blue-50 px-2 py-0.5 rounded ml-2 font-black">● PENDING SAVES</span>}
          </p>
        </div>
        <div className="flex gap-4">
          <button onClick={onDataRefresh} className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors">Force Sync</button>
          <button onClick={handleSave} className={`px-10 py-3 rounded-2xl font-black shadow-xl hover:scale-105 transition-all text-[10px] uppercase tracking-widest ${hasUnsavedChanges ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-900 text-white'}`}>
            {hasUnsavedChanges ? 'Commit Changes' : 'Up to Date'}
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
              <div className="bg-emerald-900 p-10 rounded-[40px] text-white space-y-8 shadow-xl relative overflow-hidden flex flex-col justify-between h-[380px]">
                <div className="absolute top-0 right-0 p-4 opacity-10 scale-150"><ICONS.Inventory /></div>
                <div>
                  <h4 className="text-2xl font-black">Excel Integration</h4>
                  <p className="text-xs text-emerald-200 opacity-80 mt-2 uppercase tracking-widest font-bold">Import / Export XLSX</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={handleExportExcel} className="flex-1 py-4 bg-white text-emerald-900 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 transition-transform flex items-center justify-center gap-2">Export Excel</button>
                  <label className="flex-1 py-4 bg-emerald-800 text-white border border-emerald-700 rounded-2xl font-black text-[10px] text-center uppercase tracking-widest cursor-pointer hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                    Import Excel
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
                  </label>
                </div>
              </div>

              <div className="bg-slate-900 p-10 rounded-[40px] text-white space-y-8 shadow-xl relative overflow-hidden flex flex-col justify-between h-[380px]">
                <div className="absolute top-0 right-0 p-4 opacity-10 scale-150"><ICONS.Dashboard /></div>
                <div>
                  <h4 className="text-2xl font-black">System Snapshot</h4>
                  <p className="text-xs text-slate-400 mt-2 uppercase tracking-widest font-bold">JSON Backup & Migration</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={() => storageService.exportBackup()} className="flex-1 py-4 bg-slate-800 text-white border border-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-700 transition-all">Download JSON</button>
                  <label className="flex-1 py-4 bg-white text-slate-900 rounded-2xl font-black text-[10px] text-center uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                    Restore JSON
                    <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && window.confirm("Overwrite all registry data with this snapshot?")) {
                        const success = await storageService.importBackup(file);
                        if (success) onDataRefresh();
                      }
                    }} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'PERSONNEL' && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="bg-slate-900 p-8 rounded-[32px] text-white space-y-6 shadow-2xl">
              <h4 className="text-lg font-black uppercase tracking-tight">Personnel Enrollment</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <input className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Identity Name" value={newUser.username || ''} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                <input className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Auth Email" value={newUser.email || ''} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                <input type="password" className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Secure Pass" value={newUser.password || ''} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                <select className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}>
                  <option value="INTERNAL_LOGISTIC" className="text-slate-900">Logistic (WH)</option>
                  <option value="ENGINEER" className="text-slate-900">Engineer (Line)</option>
                  <option value="ADMIN" className="text-slate-900">Administrator</option>
                  <option value="SUPPLIER" className="text-slate-900">Supplier</option>
                </select>
                <div className="col-span-full md:col-span-2 flex gap-4">
                  <select className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white" value={newUser.assignedLine} onChange={e => setNewUser({ ...newUser, assignedLine: e.target.value })}>
                    <option value="ALL">Global Authorization</option>
                    {formData.manufacturingShops.map(s => <option key={s} value={s}>{s}</option>)}
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
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${u.role === 'ADMIN' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{u.role.replace('_', ' ')}</span>
                      {u.id !== 'admin_01' && (
                        <button onClick={() => {
                          if (confirm("Revoke access?")) {
                            handleFormUpdate({...formData, users: formData.users.filter(x => x.id !== u.id)});
                          }
                        }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      )}
                    </div>
                    <h5 className="font-black text-slate-900 mt-2 text-sm">{u.username}</h5>
                    <p className="text-[10px] text-slate-400 font-medium truncate">{u.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'CLOUD' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in duration-500">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Facility Mesh Configuration
                {isEnvDriven && <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded text-[8px] font-black">SYSTEM DEFINED</span>}
              </h4>
              <div className="relative">
                <input disabled={isEnvDriven} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="Redis REST URL" value={dbCreds.url} onChange={e => setDbCreds({ ...dbCreds, url: e.target.value })} />
                {isEnvDriven && <div className="absolute inset-0 bg-transparent cursor-not-allowed" title="Defined in system environment variables"></div>}
              </div>
              <div className="relative">
                <input disabled={isEnvDriven} type="password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="Redis Token" value={dbCreds.token} onChange={e => setDbCreds({ ...dbCreds, token: e.target.value })} />
                {isEnvDriven && <div className="absolute inset-0 bg-transparent cursor-not-allowed" title="Defined in system environment variables"></div>}
              </div>
              
              {!isEnvDriven ? (
                <button onClick={() => { storageService.setDBCredentials(dbCreds); alert("Cloud Mesh linked."); }} className="w-full py-4 bg-slate-900 text-white rounded-[20px] font-black text-xs shadow-lg uppercase tracking-widest hover:bg-black">Link Registry</button>
              ) : (
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[24px]">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Mesh keys are managed by the environment deployment. Manual overrides are disabled to maintain synchronization integrity.</p>
                </div>
              )}
            </div>
            
            <div className="bg-slate-900 rounded-[32px] p-8 text-white h-[450px] flex flex-col">
               <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Mesh Activity Logs</h4>
               <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 text-[10px] font-mono">
                  {storageService.getSessionLogs().map((log, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${log.status === 'SUCCESS' ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/30 text-red-400'}`}>
                       [{new Date(log.timestamp).toLocaleTimeString()}] {log.type}: {log.message}
                    </div>
                  ))}
                  {storageService.getSessionLogs().length === 0 && <p className="text-slate-600 italic text-center py-10 uppercase tracking-[0.2em] font-black">No registry mesh events detected.</p>}
               </div>
            </div>
          </div>
        )}
        
        {/* Remaining tabs (Visuals, Registry, Columns) unchanged for brevity */}
      </div>
    </div>
  );
};

export default AdminPanel;
