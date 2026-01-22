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

  const [isSyncing, setIsSyncing] = useState(false);
  const [dbCreds, setDbCreds] = useState({ url: '', token: '' });
  
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColKey, setNewColKey] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number' | 'image'>('text');
  const [isPrimary, setIsPrimary] = useState(false);

  // User Management State
  const [newUser, setNewUser] = useState<Partial<User>>({ role: 'ENGINEER', assignedLine: config.manufacturingShops[0] || 'ALL' });

  // Excel State
  const [importPreview, setImportPreview] = useState<{ headers: string[], rows: any[], newHeaders: string[] } | null>(null);

  useEffect(() => {
    const current = storageService.getDBCredentials();
    if (current) setDbCreds(current);
  }, []);

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

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const XLSX = getXLSX();
    if (!XLSX) return alert("Spreadsheet engine not ready.");
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
        if (!jsonData || jsonData.length === 0) return alert("Sheet is empty.");
        
        const rawHeaders = Object.keys(jsonData[0]);
        const existingLabels = config.columns.map(c => c.label.toLowerCase());
        const newHeaders = rawHeaders.filter(h => h && !existingLabels.includes(h.toLowerCase()));
        
        const mappedRows = jsonData.map(row => {
          const obj: any = {};
          rawHeaders.forEach(header => {
            const existingCol = config.columns.find(c => c.label.toLowerCase() === header.toLowerCase());
            const key = existingCol ? existingCol.id : header.toLowerCase().replace(/[^a-z0-9]/g, '_');
            obj[key] = row[header];
          });
          return obj;
        });
        
        if (newHeaders.length > 0) setImportPreview({ headers: rawHeaders, rows: mappedRows, newHeaders });
        else processImport(mappedRows, []);
      } catch (error) { alert("❌ Import failed."); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const processImport = async (rows: any[], headersToAdd: string[]) => {
    setIsSyncing(true);
    let updatedConfig = { ...config };
    if (headersToAdd.length > 0) {
      headersToAdd.forEach(h => {
        const id = h.toLowerCase().replace(/[^a-z0-9]/g, '_');
        updatedConfig.columns.push({ id, label: h, type: 'text', isCore: false });
      });
      await storageService.saveConfig(updatedConfig);
      setFormData(updatedConfig);
    }
    const newPartsList: Part[] = rows.map(row => ({
      id: `PART_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      partNumber: row.partNumber || row.reference_id || row['Reference ID'] || `IMP-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      name: row.name || row.part_name || row['Part Name'] || "Imported Part",
      description: row.description || "",
      imageUrl: row.imageUrl || "https://picsum.photos/seed/import/400/300",
      carModel: row.carModel || row['Car Model'] || config.carModels[0],
      manufacturingShop: row.manufacturingShop || row['Assigned Shop'] || config.manufacturingShops[0],
      currentLocation: row.currentLocation || row['Current Location'] || 'WAREHOUSE',
      currentStock: parseInt(row.currentStock || row.Stock) || 0,
      targetStock: parseInt(row.targetStock || row.Target) || 10,
      supplierName: row.supplierName || row.Supplier || "Imported Vendor",
      lastReceivedAt: new Date().toISOString(),
      history: [],
      updatedAt: Date.now(),
      ...row 
    }));
    await storageService.saveParts(newPartsList);
    setIsSyncing(false);
    alert(`✅ Imported ${rows.length} assets.`);
    setImportPreview(null);
    onDataRefresh();
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
    setNewUser({ role: 'ENGINEER', assignedLine: config.manufacturingShops[0] || 'ALL' });
  };

  const handleRemoveUser = (id: string) => {
    if (id === 'admin_01') return alert("Access Denied: The master administrator account cannot be deleted.");
    setFormData({ ...formData, users: formData.users.filter(u => u.id !== id) });
  };

  const handleNuclearReset = async () => {
    if (window.confirm("CRITICAL WARNING: This will permanently purge ALL registry data on this device. Proceed?")) {
      localStorage.removeItem('partflow_parts_v10');
      localStorage.removeItem('partflow_transfers_v10');
      localStorage.removeItem('partflow_notifications_v10');
      await storageService.pushToCloud();
      alert("Facility Registry Wiped Successfully.");
      onDataRefresh();
      window.location.reload();
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
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Platform Branding</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" value={formData.appName} onChange={e => setFormData({ ...formData, appName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">UI Accent Color</label>
                  <input type="color" className="h-14 w-20 rounded-2xl cursor-pointer border-none bg-transparent" value={formData.primaryColor} onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} />
                </div>
              </div>
              <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-200 flex flex-col items-center justify-center shadow-inner">
                  <div className="w-24 h-24 bg-white rounded-3xl border border-dashed border-slate-200 flex items-center justify-center overflow-hidden mb-4 shadow-sm">
                    {formData.logoUrl ? <img src={formData.logoUrl} className="max-w-[90%] max-h-[90%] object-contain" /> : <div className="text-[10px] font-black text-slate-300">NO LOGO</div>}
                  </div>
                  <label className="py-3 px-6 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-black transition-colors">
                    Upload Facility Logo
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if(file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setFormData({ ...formData, logoUrl: reader.result as string });
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'REGISTRY' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div className="space-y-6">
              <h4 className="text-lg font-black text-slate-900 uppercase">Registered Models</h4>
              <div className="flex gap-2">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="New Model..." value={newModelItem} onChange={e => setNewModelItem(e.target.value)} />
                <button onClick={() => addItem('carModels')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-xs">Add</button>
              </div>
              <div className="space-y-2">
                {formData.carModels.map((m, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-bold text-slate-700 text-xs">{m}</span>
                    <button onClick={() => removeItem('carModels', i)} className="text-red-400 hover:text-red-600 px-2 font-black">✕</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <h4 className="text-lg font-black text-slate-900 uppercase">Manufacturing Areas</h4>
              <div className="flex gap-2">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="New Area..." value={newShopItem} onChange={e => setNewShopItem(e.target.value)} />
                <button onClick={() => addItem('manufacturingShops')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-xs">Add</button>
              </div>
              <div className="space-y-2">
                {formData.manufacturingShops.map((m, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-bold text-slate-700 text-xs">{m}</span>
                    <button onClick={() => removeItem('manufacturingShops', i)} className="text-red-400 hover:text-red-600 px-2 font-black">✕</button>
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
                <label className="block text-[8px] font-black uppercase text-slate-400 mb-2">Display Label</label>
                <input className="w-full px-5 py-3 bg-white/10 border border-white/20 rounded-xl font-bold" placeholder="e.g. Serial Number" value={newColLabel} onChange={e => setNewColLabel(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="block text-[8px] font-black uppercase text-slate-400 mb-2">Field ID (Internal)</label>
                <input className="w-full px-5 py-3 bg-white/10 border border-white/20 rounded-xl font-mono text-sm" placeholder="serial_id" value={newColKey} onChange={e => setNewColKey(e.target.value)} />
              </div>
              <div className="w-full md:w-48">
                <label className="block text-[8px] font-black uppercase text-slate-400 mb-2">Data Type</label>
                <select className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl font-bold text-sm text-white" value={newColType} onChange={e => setNewColType(e.target.value as any)}>
                  <option value="text" className="text-slate-900">Text</option>
                  <option value="number" className="text-slate-900">Number</option>
                  <option value="image" className="text-slate-900">Image Upload</option>
                </select>
              </div>
              <button onClick={addOrUpdateColumn} className="px-10 py-3 bg-blue-600 rounded-xl font-black text-xs uppercase shadow-xl hover:bg-blue-500 transition-colors">
                {editingColId ? 'Apply Update' : 'Register Field'}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formData.columns.map(col => (
                <div key={col.id} className="p-6 rounded-[24px] border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded">{col.type}</span>
                    <h5 className="text-sm font-black text-slate-900 mt-2">{col.label}</h5>
                    <p className="text-[9px] font-mono text-slate-400">{col.id}</p>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <button onClick={() => startEditColumn(col)} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black hover:bg-slate-900 hover:text-white transition-all">Edit</button>
                    {!col.isCore && <button onClick={() => removeColumn(col.id)} className="flex-1 py-2 bg-red-50 text-red-500 rounded-lg text-[10px] font-black hover:bg-red-600 hover:text-white transition-all">Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'PERSONNEL' && (
          <div className="space-y-10">
            <div className="bg-slate-900 p-8 rounded-[32px] text-white space-y-6 shadow-2xl">
              <h4 className="text-lg font-black uppercase tracking-tight">Enroll Facility Personnel</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <input className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Full Username" value={newUser.username || ''} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                <input className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Contact Email" value={newUser.email || ''} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                <input type="password" className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Master Passkey" value={newUser.password || ''} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                <select className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}>
                  <option value="ENGINEER" className="text-slate-900">Operations Personnel / Engineer</option>
                  <option value="ADMIN" className="text-slate-900">Facility Administrator</option>
                  <option value="SUPPLIER" className="text-slate-900">External Supplier</option>
                </select>
                <select className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white" value={newUser.assignedLine} onChange={e => setNewUser({ ...newUser, assignedLine: e.target.value })}>
                  <option value="ALL" className="text-slate-900">Global Access (All Shops)</option>
                  {formData.manufacturingShops.map(s => <option key={s} value={s} className="text-slate-900">{s}</option>)}
                </select>
                <button onClick={handleAddUser} className="bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-lg">Enlist Personnel</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formData.users.map(u => (
                <div key={u.id} className="p-6 rounded-[24px] border border-slate-100 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${u.role === 'ADMIN' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{u.role}</span>
                      {u.id !== 'admin_01' && <button onClick={() => handleRemoveUser(u.id)} className="text-slate-300 hover:text-red-500 transition-colors">✕</button>}
                    </div>
                    <h5 className="font-black text-slate-900 mt-2">{u.username}</h5>
                    <p className="text-[10px] text-slate-400 font-medium">{u.email}</p>
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[8px] font-black text-slate-400 uppercase block tracking-widest mb-1">Managed Sector</span>
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
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Database Credentials</label>
              <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="Upstash REST URL" value={dbCreds.url} onChange={e => setDbCreds({ ...dbCreds, url: e.target.value })} />
              <input type="password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="Master Access Token" value={dbCreds.token} onChange={e => setDbCreds({ ...dbCreds, token: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => storageService.setDBCredentials(dbCreds)} className="py-4 bg-blue-600 text-white rounded-[20px] font-black text-xs shadow-lg hover:bg-blue-500">LINK CLOUD</button>
                <button onClick={() => storageService.syncWithCloud(true)} className="py-4 bg-emerald-600 text-white rounded-[20px] font-black text-xs shadow-lg hover:bg-emerald-500">FORCE PULL</button>
              </div>
              <button onClick={() => storageService.pushToCloud()} className="w-full py-4 bg-slate-900 text-white rounded-[20px] font-black text-xs shadow-lg hover:bg-black transition-all">MANUAL CLOUD PUSH</button>
              <div className="bg-blue-50 p-6 rounded-[24px] border border-blue-100">
                 <h5 className="text-[10px] font-black text-blue-800 uppercase mb-2">Sync Status</h5>
                 <p className="text-xs text-blue-600 font-bold leading-relaxed">The cloud mesh ensures your registry data is persisted across multiple facility terminals in real-time.</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-200 h-[500px] overflow-auto shadow-inner">
              <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Cloud Communication Logs</h4>
              {storageService.getSessionLogs().map((log, i) => (
                <div key={i} className="p-3 bg-white border border-slate-100 rounded-xl mb-2 text-[10px] font-bold flex gap-3 shadow-sm">
                  <span className="text-slate-300">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className={log.status === 'ERROR' ? 'text-red-500' : 'text-blue-500'}>{log.message}</span>
                </div>
              ))}
              {storageService.getSessionLogs().length === 0 && <div className="h-full flex items-center justify-center text-[10px] font-black text-slate-300 uppercase italic">No active session logs</div>}
            </div>
          </div>
        )}

        {activeTab === 'DATA' && (
           <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-emerald-900 p-10 rounded-[40px] text-white space-y-6 shadow-xl relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
                    <h4 className="text-xl font-black">Excel Terminal</h4>
                    <p className="text-sm text-emerald-200 opacity-80">Export global snapshot or ingest bulk assets via spreadsheet.</p>
                    <button onClick={handleExportExcel} className="w-full py-4 bg-white text-emerald-900 rounded-2xl font-black text-xs uppercase hover:scale-[1.02] transition-transform">Export Registry (XLSX)</button>
                    <label className="block w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs text-center uppercase cursor-pointer hover:bg-emerald-400 transition-all">
                        Bulk Import Registry
                        <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
                    </label>
                 </div>
                 <div className="bg-red-50 p-10 rounded-[40px] border border-red-100 flex flex-col justify-between shadow-sm">
                    <div className="space-y-4">
                      <h4 className="text-xl font-black text-red-900">Nuclear System Reset</h4>
                      <p className="text-sm text-red-600 font-bold leading-relaxed">Permanently destroy all local cached asset data, transfers, and security notifications. This action cannot be reversed without a cloud pull.</p>
                    </div>
                    <button onClick={handleNuclearReset} className="w-full mt-8 py-5 bg-red-600 text-white rounded-[24px] font-black text-xs uppercase shadow-xl hover:bg-red-700 transition-all">Purge Local Registry</button>
                 </div>
              </div>
           </div>
        )}
      </div>

      {importPreview && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[300] flex items-center justify-center p-6">
          <div className="bg-white rounded-[40px] p-10 w-full max-w-2xl space-y-8 shadow-2xl">
             <div className="text-center">
                <h2 className="text-2xl font-black text-slate-900 uppercase">Schema Alignment Required</h2>
                <p className="text-slate-500 font-bold mt-2">New fields detected in the import file. Expansion required.</p>
             </div>
             <div className="bg-slate-50 p-6 rounded-3xl flex flex-wrap gap-2">
                {importPreview.newHeaders.map(h => (
                   <span key={h} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase">{h}</span>
                ))}
             </div>
             <div className="flex gap-4">
                <button onClick={() => setImportPreview(null)} className="flex-1 py-5 text-slate-400 font-black uppercase text-xs">Abort</button>
                <button onClick={() => processImport(importPreview.rows, importPreview.newHeaders)} className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl">Confirm & Import</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;