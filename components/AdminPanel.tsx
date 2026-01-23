
import React, { useState, useEffect } from 'react';
import { AppConfig, User, Part, AdminTab } from '../types';
import { storageService } from '../services/storageService';
import { ICONS } from '../constants';
// @ts-ignore
import * as XLSXModule from 'xlsx';
// @ts-ignore
import ExcelJS from 'exceljs';
// @ts-ignore
import saveAs from 'file-saver';

interface AdminPanelProps {
  config: AppConfig;
  onSaveConfig: (config: AppConfig) => void;
  onDataRefresh: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ config, onSaveConfig, onDataRefresh }) => {
  // Initialize state directly from storage
  const [formData, setFormData] = useState<AppConfig>({ ...config });
  const [dbCreds, setDbCreds] = useState(() => storageService.getDBCredentials() || { url: '', token: '' });
  const [activeTab, setActiveTab] = useState<string>('CLOUD');
  const [isExporting, setIsExporting] = useState(false);
  
  // Local UI state for Schema
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColKey, setNewColKey] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number' | 'image'>('text');
  
  // Local UI state for Registry
  const [newModelItem, setNewModelItem] = useState('');
  const [newShopItem, setNewShopItem] = useState('');
  const [newUser, setNewUser] = useState<Partial<User>>({ role: 'INTERNAL_LOGISTIC', assignedLine: 'ALL' });
  
  const isEnvDriven = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

  useEffect(() => {
    setFormData(config);
    // Ensure we start on a valid tab. If current activeTab isn't in the config list, reset to first available.
    if (config.adminTabs && config.adminTabs.length > 0) {
       if (!config.adminTabs.find(t => t.id === activeTab)) {
          setActiveTab(config.adminTabs[0].id);
       }
    } else {
       // Fallback if adminTabs is empty/undefined (legacy config)
       setActiveTab('CLOUD'); 
    }
    
    const current = storageService.getDBCredentials();
    if (current) setDbCreds(current);
  }, [config]);

  const handleSave = () => {
    const updated = { ...formData, updatedAt: Date.now() };
    onSaveConfig(updated);
    alert("✅ System configuration committed successfully.");
  };

  // --- Column / Schema Logic ---

  const handleAddOrUpdateColumn = () => {
    if (!newColLabel.trim() || !newColKey.trim()) return;
    const finalKey = newColKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    // Check duplication only if adding new
    if (!editingColId && formData.columns.some(c => c.id === finalKey)) return alert("Column ID already exists.");
    
    if (editingColId) {
       // Update existing
       const updatedCols = formData.columns.map(c => 
         c.id === editingColId ? { ...c, label: newColLabel.trim(), type: newColType } : c
       );
       setFormData({ ...formData, columns: updatedCols });
       setEditingColId(null);
    } else {
       // Add new
       const newCols = [...formData.columns, { 
         id: finalKey, 
         label: newColLabel.trim(), 
         type: newColType, 
         isCore: false 
       }];
       setFormData({ ...formData, columns: newCols });
    }
    setNewColLabel(''); setNewColKey(''); setEditingColId(null);
  };

  const handleEditColumn = (col: { id: string, label: string, type: any }) => {
    setEditingColId(col.id);
    setNewColKey(col.id); // ID acts as key
    setNewColLabel(col.label);
    setNewColType(col.type);
  };

  const handleRemoveColumn = (id: string) => {
    if (confirm("Delete this column? Data in this field may be hidden.")) {
      setFormData({ ...formData, columns: formData.columns.filter(c => c.id !== id) });
    }
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newCols = [...formData.columns];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newCols.length) return;
    [newCols[index], newCols[target]] = [newCols[target], newCols[index]];
    setFormData({ ...formData, columns: newCols });
  };

  // --- Registry Logic ---

  const addItem = (type: 'carModels' | 'manufacturingShops') => {
    const val = type === 'carModels' ? newModelItem : newShopItem;
    if (!val.trim()) return;
    if (formData[type].includes(val.trim())) return alert("Duplicate item.");
    setFormData({ ...formData, [type]: [...formData[type], val.trim()] });
    if (type === 'carModels') setNewModelItem(''); else setNewShopItem('');
  };

  const removeItem = (type: 'carModels' | 'manufacturingShops', index: number) => {
    const updated = [...formData[type]];
    updated.splice(index, 1);
    setFormData({ ...formData, [type]: updated });
  };

  const handleAddUser = () => {
    if (!newUser.username || !newUser.email || !newUser.password) return alert("Fill all user fields.");
    const user: User = {
      id: `U_${Date.now()}`,
      username: newUser.username!,
      email: newUser.email!,
      password: newUser.password!,
      role: newUser.role as any,
      assignedLine: newUser.assignedLine || 'ALL'
    };
    setFormData({ ...formData, users: [...formData.users, user] });
    setNewUser({ role: 'INTERNAL_LOGISTIC', assignedLine: 'ALL', username: '', email: '', password: '' });
  };

  // --- Tab Management Logic ---

  const moveTab = (index: number, direction: 'up' | 'down') => {
    const newTabs = [...(formData.adminTabs || [])];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= newTabs.length) return;
    [newTabs[index], newTabs[target]] = [newTabs[target], newTabs[index]];
    setFormData({ ...formData, adminTabs: newTabs });
  };

  const updateTabLabel = (index: number, val: string) => {
    const newTabs = [...(formData.adminTabs || [])];
    newTabs[index].label = val;
    setFormData({ ...formData, adminTabs: newTabs });
  };

  // --- Excel handlers ---

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Create Workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Inventory');

      // Define Columns
      worksheet.columns = formData.columns.map(col => ({
        header: col.label,
        key: col.id,
        width: col.type === 'image' ? 18 : 30 // Narrower for image column, image will float
      }));

      const parts = storageService.getParts();

      // Process Data
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const row = worksheet.addRow(part);
        
        let hasImage = false;

        // Check for images
        formData.columns.forEach((col, colIndex) => {
          if (col.type === 'image') {
            const cellValue = part[col.id];
            
            // Only process Base64 images
            if (cellValue && typeof cellValue === 'string' && cellValue.startsWith('data:image')) {
              try {
                // Determine extension (png/jpeg)
                const extension = cellValue.split(';')[0].split('/')[1] || 'png';
                
                const imageId = workbook.addImage({
                  base64: cellValue,
                  extension: extension as any,
                });

                // Add image to worksheet at specific cell
                worksheet.addImage(imageId, {
                  tl: { col: colIndex, row: row.number - 1 + 0.1 }, // Top-left with slight padding
                  br: { col: colIndex + 1, row: row.number - 0.1 }  // Bottom-right
                });

                // Clear the text content so user doesn't see base64 string
                row.getCell(col.id).value = '';
                hasImage = true;
              } catch (e) {
                console.error("Failed to add image to excel", e);
              }
            }
          }
        });

        // Increase row height if it contains an image
        if (hasImage) {
          row.height = 80;
          // Center align content vertically
          row.eachCell((cell: any) => {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          });
        }
      }

      // Generate Buffer and Save
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `PartFlow_Export_${new Date().toISOString().slice(0,10)}.xlsx`);

    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. See console.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const r = new FileReader();
      r.onload = (evt) => {
        const wb = (window as any).XLSX.read(evt.target?.result, {type:'binary'});
        const data = (window as any).XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if(confirm(`Import ${data.length} items?`)) {
          storageService.saveParts(data);
          onDataRefresh();
        }
      };
      r.readAsBinaryString(f);
    }
  };

  const TabButton: React.FC<{ id: string; label: string }> = ({ id, label }) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`px-6 py-4 font-black text-[10px] lg:text-xs transition-all border-b-4 uppercase tracking-widest whitespace-nowrap ${activeTab === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
    >
      {label}
    </button>
  );

  // Fallback for missing adminTabs in legacy configs
  const tabsToRender = formData.adminTabs || [];

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900">System Architect</h3>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">Facility Config & Governance</p>
        </div>
        <div className="flex gap-4">
          <button onClick={onDataRefresh} className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors shadow-sm">Refresh View</button>
          <button onClick={handleSave} className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black shadow-xl hover:scale-105 transition-all text-[10px] uppercase tracking-widest">
            Commit Changes
          </button>
        </div>
      </div>

      {/* Dynamic Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto scrollbar-hide">
        {tabsToRender.map(tab => (
            <TabButton key={tab.id} id={tab.id} label={tab.label} />
        ))}
      </div>

      {/* Tab Content Area */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl p-8 lg:p-12 min-h-[500px]">
        
        {/* 1. CLOUD MESH TAB */}
        {activeTab === 'CLOUD' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in duration-500">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Facility Mesh Protocol
                {isEnvDriven && <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded text-[8px] font-black">ENV_LOCKED</span>}
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">Redis REST URL</label>
                  <input 
                    disabled={isEnvDriven} 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-700" 
                    placeholder="https://..." 
                    value={dbCreds.url} 
                    onChange={e => setDbCreds({ ...dbCreds, url: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">Redis REST Token</label>
                  <input 
                    disabled={isEnvDriven} 
                    type="password" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-700" 
                    placeholder="********" 
                    value={dbCreds.token} 
                    onChange={e => setDbCreds({ ...dbCreds, token: e.target.value })} 
                  />
                </div>
                
                {!isEnvDriven ? (
                  <button onClick={() => { storageService.setDBCredentials(dbCreds); alert("Cloud Mesh Authorization Committed."); }} className="w-full py-4 bg-slate-900 text-white rounded-[20px] font-black text-xs shadow-lg uppercase tracking-widest hover:bg-black transition-all">Link Registry</button>
                ) : (
                  <div className="p-6 bg-slate-50 border border-slate-100 rounded-[24px]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">System keys are injected via deployment variables. Manual overrides are restricted.</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-slate-900 rounded-[32px] p-8 text-white h-[450px] flex flex-col shadow-inner">
               <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Synchronization Logs</h4>
               <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 text-[10px] font-mono">
                  {storageService.getSessionLogs().map((log, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${log.status === 'SUCCESS' ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/30 text-red-400'}`}>
                       [{new Date(log.timestamp).toLocaleTimeString()}] {log.type}: {log.message}
                    </div>
                  ))}
                  {storageService.getSessionLogs().length === 0 && <p className="text-slate-600 italic text-center py-10 uppercase tracking-[0.2em] font-black">No registry mesh events.</p>}
               </div>
            </div>
          </div>
        )}

        {/* 2. COLUMNS / SCHEMA TAB */}
        {activeTab === 'COLUMNS' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                    {editingColId ? 'Edit Existing Field' : 'Add Custom Field'}
                </h4>
                <div className="flex flex-col md:flex-row items-end gap-4">
                   <div className="flex-1 w-full">
                      <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">Display Label</label>
                      <input className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-xs" value={newColLabel} onChange={e => setNewColLabel(e.target.value)} placeholder="e.g. Serial Number" />
                   </div>
                   <div className="flex-1 w-full">
                      <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">System Key {editingColId && '(Locked)'}</label>
                      <input disabled={!!editingColId} className={`w-full px-4 py-3 border border-slate-200 rounded-xl font-mono text-xs ${editingColId ? 'bg-slate-100 text-slate-400' : 'bg-white'}`} value={newColKey} onChange={e => setNewColKey(e.target.value)} placeholder="e.g. serial_no" />
                   </div>
                   <div className="w-full md:w-32">
                      <label className="block text-[8px] font-black uppercase text-slate-400 mb-1">Data Type</label>
                      <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-xs" value={newColType} onChange={e => setNewColType(e.target.value as any)}>
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="image">Image</option>
                      </select>
                   </div>
                   <button onClick={handleAddOrUpdateColumn} className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 shadow-md">
                      {editingColId ? 'Update Field' : 'Add Field'}
                   </button>
                   {editingColId && <button onClick={() => { setEditingColId(null); setNewColLabel(''); setNewColKey(''); }} className="px-4 py-3 text-slate-400 font-black text-[10px] uppercase">Cancel</button>}
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {formData.columns.map((col, idx) => (
                   <div key={col.id} className="p-5 border border-slate-100 bg-white rounded-2xl flex items-center justify-between shadow-sm group">
                      <div className="flex items-center gap-4">
                         <div className="flex flex-col gap-1">
                            <button onClick={() => moveColumn(idx, 'up')} disabled={idx === 0} className="text-slate-400 hover:text-slate-900 disabled:opacity-20 text-[8px] px-1 bg-slate-50 rounded hover:bg-slate-200 transition-colors">▲</button>
                            <button onClick={() => moveColumn(idx, 'down')} disabled={idx === formData.columns.length - 1} className="text-slate-400 hover:text-slate-900 disabled:opacity-20 text-[8px] px-1 bg-slate-50 rounded hover:bg-slate-200 transition-colors">▼</button>
                         </div>
                         <span className="w-6 h-6 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center text-[10px] font-black">{idx + 1}</span>
                         <div>
                            <p className="text-xs font-black text-slate-900 uppercase">{col.label}</p>
                            <p className="text-[9px] font-mono text-slate-400">{col.id} • {col.type}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <button onClick={() => handleEditColumn(col)} className="text-blue-400 hover:text-blue-600 px-2 font-bold text-[10px] uppercase tracking-wider">Edit</button>
                         {!col.isCore && (
                           <button onClick={() => handleRemoveColumn(col.id)} className="text-slate-300 hover:text-red-500 transition-colors">✕</button>
                         )}
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {/* 3. VISUALS / APPEARANCE TAB */}
        {activeTab === 'VISUALS' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in duration-500">
             <div className="space-y-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Branding</h4>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Platform Label</label>
                   <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800" value={formData.appName} onChange={e => setFormData({ ...formData, appName: e.target.value })} />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Brand Accent Color</label>
                   <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                      <input type="color" className="h-12 w-20 rounded-xl cursor-pointer bg-white p-1 border border-slate-200" value={formData.primaryColor} onChange={e => setFormData({ ...formData, primaryColor: e.target.value })} />
                      <span className="font-mono text-xs font-bold text-slate-500">{formData.primaryColor}</span>
                   </div>
                </div>
             </div>

             <div className="space-y-6">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Panel Navigation</h4>
                 <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 space-y-2">
                    {formData.adminTabs && formData.adminTabs.map((tab, idx) => (
                        <div key={tab.id} className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                           <div className="flex flex-col gap-1">
                              <button onClick={() => moveTab(idx, 'up')} disabled={idx === 0} className="text-slate-400 hover:text-slate-900 disabled:opacity-20 text-[8px]">▲</button>
                              <button onClick={() => moveTab(idx, 'down')} disabled={idx === formData.adminTabs.length - 1} className="text-slate-400 hover:text-slate-900 disabled:opacity-20 text-[8px]">▼</button>
                           </div>
                           <input 
                              className="flex-1 text-xs font-bold text-slate-700 bg-transparent outline-none" 
                              value={tab.label}
                              onChange={(e) => updateTabLabel(idx, e.target.value)}
                           />
                           <span className="text-[9px] font-mono text-slate-300">{tab.id}</span>
                        </div>
                    ))}
                 </div>
             </div>
          </div>
        )}

        {/* 4. REGISTRY TAB (Models/Shops) */}
        {activeTab === 'REGISTRY' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in duration-500">
             <div className="space-y-4">
                <h4 className="font-black uppercase text-xs tracking-widest text-slate-400">Fleet Models</h4>
                <div className="flex gap-2">
                   <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" value={newModelItem} onChange={e => setNewModelItem(e.target.value)} placeholder="New Model Name" />
                   <button onClick={() => addItem('carModels')} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase">Add</button>
                </div>
                <div className="space-y-2">
                  {formData.carModels.map((m, i) => (
                     <div key={i} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <span className="text-xs font-bold text-slate-700">{m}</span>
                        <button onClick={() => removeItem('carModels', i)} className="text-slate-300 hover:text-red-600">✕</button>
                     </div>
                  ))}
                </div>
             </div>
             <div className="space-y-4">
                <h4 className="font-black uppercase text-xs tracking-widest text-slate-400">Facility Shops</h4>
                <div className="flex gap-2">
                   <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" value={newShopItem} onChange={e => setNewShopItem(e.target.value)} placeholder="New Shop Name" />
                   <button onClick={() => addItem('manufacturingShops')} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase">Add</button>
                </div>
                <div className="space-y-2">
                  {formData.manufacturingShops.map((m, i) => (
                     <div key={i} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <span className="text-xs font-bold text-slate-700">{m}</span>
                        <button onClick={() => removeItem('manufacturingShops', i)} className="text-slate-300 hover:text-red-600">✕</button>
                     </div>
                  ))}
                </div>
             </div>
          </div>
        )}

        {/* 5. PERSONNEL TAB */}
        {activeTab === 'PERSONNEL' && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="bg-slate-900 p-8 rounded-[32px] text-white space-y-6 shadow-2xl">
              <h4 className="text-lg font-black uppercase tracking-tight">Personnel Enrollment</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <input className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Full Identity Name" value={newUser.username || ''} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                <input className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Authorized Email" value={newUser.email || ''} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                <input type="password" className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold" placeholder="Secure Passkey" value={newUser.password || ''} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                <select className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}>
                  <option value="INTERNAL_LOGISTIC" className="text-slate-900">Logistic Ops</option>
                  <option value="ENGINEER" className="text-slate-900">Engineering</option>
                  <option value="ADMIN" className="text-slate-900">Administrator</option>
                  <option value="SUPPLIER" className="text-slate-900">External Vendor</option>
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
                          if (confirm("Revoke access for this identity?")) {
                            setFormData({...formData, users: formData.users.filter(x => x.id !== u.id)});
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

        {/* 6. DATA TAB */}
        {activeTab === 'DATA' && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-emerald-900 p-10 rounded-[40px] text-white space-y-8 shadow-xl relative overflow-hidden flex flex-col justify-between h-[380px]">
                <div className="absolute top-0 right-0 p-4 opacity-10 scale-150"><ICONS.Inventory /></div>
                <div>
                  <h4 className="text-2xl font-black">XLSX Exchange</h4>
                  <p className="text-xs text-emerald-200 opacity-80 mt-2 uppercase tracking-widest font-bold">Bulk Asset Management</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={handleExport} disabled={isExporting} className="flex-1 py-4 bg-white text-emerald-900 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 transition-transform flex items-center justify-center gap-2">
                    {isExporting ? 'Building Sheet...' : 'Export Registry'}
                  </button>
                  <label className="flex-1 py-4 bg-emerald-800 text-white border border-emerald-700 rounded-2xl font-black text-[10px] text-center uppercase tracking-widest cursor-pointer hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                    Import Registry
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImport} />
                  </label>
                </div>
              </div>

              <div className="bg-slate-900 p-10 rounded-[40px] text-white space-y-8 shadow-xl relative overflow-hidden flex flex-col justify-between h-[380px]">
                <div className="absolute top-0 right-0 p-4 opacity-10 scale-150"><ICONS.Dashboard /></div>
                <div>
                  <h4 className="text-2xl font-black">System Backup</h4>
                  <p className="text-xs text-slate-400 mt-2 uppercase tracking-widest font-bold">JSON Full State Snapshots</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={() => storageService.exportBackup()} className="flex-1 py-4 bg-slate-800 text-white border border-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-700 transition-all">Download State</button>
                  <label className="flex-1 py-4 bg-white text-slate-900 rounded-2xl font-black text-[10px] text-center uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                    Restore State
                    <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && window.confirm("Overwrite ALL data with this snapshot?")) {
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
      </div>
    </div>
  );
};

export default AdminPanel;
