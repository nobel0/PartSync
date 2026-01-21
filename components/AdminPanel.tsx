import React, { useState, useEffect } from 'react';
import { AppConfig, ColumnDefinition, Part } from '../types';
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
  const [activeTab, setActiveTab] = useState<'VISUALS' | 'REGISTRY' | 'COLUMNS' | 'WORDING' | 'CLOUD' | 'DATA'>('VISUALS');
  
  const [newModelItem, setNewModelItem] = useState('');
  const [newShopItem, setNewShopItem] = useState('');

  const [isSyncing, setIsSyncing] = useState(false);
  const [dbCreds, setDbCreds] = useState({ url: '', token: '' });
  
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColKey, setNewColKey] = useState('');
  const [newColType, setNewColType] = useState<'text' | 'number' | 'image'>('text');
  const [isPrimary, setIsPrimary] = useState(false);

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

  /**
   * Robustly gets the XLSX library instance from module or global scope
   */
  const getXLSX = () => {
    // Check module import first
    if (XLSXModule && XLSXModule.utils) return XLSXModule;
    // @ts-ignore - check default export (some ESM providers)
    if (XLSXModule && XLSXModule.default && XLSXModule.default.utils) return XLSXModule.default;
    // @ts-ignore - check global window (fallback script)
    if (window.XLSX && window.XLSX.utils) return window.XLSX;
    return null;
  };

  // --- EXCEL LOGIC ---
  const handleExportExcel = () => {
    try {
      const XLSX = getXLSX();
      if (!XLSX) {
        throw new Error("XLSX engine not found in module or global scope.");
      }

      const parts = storageService.getParts();
      const columns = config.columns;
      
      if (!parts || parts.length === 0) {
        alert("The registry is currently empty. Add parts before exporting.");
        return;
      }

      // Excel has a hard limit of 32,767 characters per cell.
      const EXCEL_CELL_LIMIT = 32767;

      const excelData = parts.map(part => {
        const row: any = {};
        columns.forEach(col => {
          let value = part[col.id] ?? '';
          
          // Ensure value is a string or number for length check
          let stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

          // Truncate if it exceeds Excel's limit to prevent the engine from crashing
          if (stringValue.length > EXCEL_CELL_LIMIT) {
            console.warn(`Truncating field "${col.label}" for part ${part.partNumber} as it exceeds 32k characters.`);
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
      console.error("Excel Export Failure Detail:", error);
      alert(`❌ Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const XLSX = getXLSX();
    if (!XLSX) return alert("Spreadsheet engine not ready. Please try again in a moment.");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
        if (!jsonData || jsonData.length === 0) return alert("The selected sheet appears to be empty.");

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

        if (newHeaders.length > 0) {
          setImportPreview({ headers: rawHeaders, rows: mappedRows, newHeaders });
        } else {
          processImport(mappedRows, []);
        }
      } catch (error) {
        console.error("Import Error:", error);
        alert("❌ Import failed: Invalid Excel format.");
      }
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
        updatedConfig.columns.push({
          id,
          label: h,
          type: 'text',
          isCore: false
        });
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

    alert(`✅ Successfully imported ${rows.length} assets into the registry.`);
    setImportPreview(null);
    onDataRefresh();
  };

  const handleExportJSON = () => {
    const backup = {
      parts: storageService.getParts(),
      transfers: storageService.getTransfers(),
      suppliers: storageService.getSuppliers(),
      config: storageService.getConfig(),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partflow_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (window.confirm("CRITICAL: Overwrite all local registry data with this JSON backup?")) {
          if (data.parts) localStorage.setItem('partflow_parts_v10', JSON.stringify(data.parts));
          if (data.transfers) localStorage.setItem('partflow_transfers_v10', JSON.stringify(data.transfers));
          if (data.config) localStorage.setItem('partflow_config_v10', JSON.stringify(data.config));
          alert("✅ Data Manifest Restored.");
          await storageService.pushToCloud();
          onDataRefresh();
          window.location.reload();
        }
      } catch (err) { alert("❌ JSON restoration failed."); }
    };
    reader.readAsText(file);
  };

  const handleNuclearReset = async () => {
    if (window.confirm("NUCLEAR OPTION: Purge ALL data in this facility registry?")) {
      if (window.confirm("CONFIRM DELETION: Data will be lost forever if not cloud-synced.")) {
        localStorage.removeItem('partflow_parts_v10');
        localStorage.removeItem('partflow_transfers_v10');
        localStorage.removeItem('partflow_notifications_v10');
        await storageService.pushToCloud();
        alert("Facility Registry Wiped.");
        onDataRefresh();
        window.location.reload();
      }
    }
  };

  const saveDBCreds = () => {
    storageService.setDBCredentials(dbCreds);
    alert("Cloud Mesh Credentials Updated.");
    onDataRefresh();
  };

  const forcePull = async () => {
    setIsSyncing(true);
    const { success } = await storageService.syncWithCloud(true);
    setIsSyncing(false);
    if (success) alert("Cloud Recovery Merged.");
    else alert("Sync Failed. Check credentials.");
    onDataRefresh();
  };

  const forcePush = async () => {
    setIsSyncing(true);
    const success = await storageService.pushToCloud();
    setIsSyncing(false);
    if (success) alert("Registry committed to cloud mesh.");
    else alert("Push Failed.");
    onDataRefresh();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, logoUrl: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const addItem = (type: 'carModels' | 'manufacturingShops') => {
    const val = type === 'carModels' ? newModelItem : newShopItem;
    if (!val.trim()) return;
    if (formData[type].includes(val.trim())) return alert("Item exists.");
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
      if (formData.columns.some(c => c.id === finalKey)) return alert("ID collision.");
      let updatedColumns = isPrimary ? formData.columns.map(c => ({ ...c, isPrimary: false } as ColumnDefinition)) : [...formData.columns];
      updatedColumns.push({ id: finalKey, label: newColLabel.trim(), type: newColType, isCore: false, isPrimary: !!isPrimary });
      setFormData({ ...formData, columns: updatedColumns });
    }
    setNewColLabel(''); setNewColKey(''); setNewColType('text'); setIsPrimary(false);
  };

  const removeColumn = (id: string) => {
    if (window.confirm("Purge column? Field data will be hidden from view.")) {
      setFormData({ ...formData, columns: formData.columns.filter(c => c.id !== id) });
      storageService.clearColumnData(id);
    }
  };

  const TabButton: React.FC<{ id: typeof activeTab; label: string }> = ({ id, label }) => (
    <button onClick={() => setActiveTab(id)} className={`px-6 py-3 font-black text-[10px] lg:text-xs transition-all border-b-4 uppercase tracking-widest ${activeTab === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{label}</button>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      <div className="flex items-center justify-between bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-3xl font-black text-slate-900">System Architect</h3>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">Cloud Mesh & Data Schema</p>
        </div>
        <button onClick={handleSave} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition-all">Save System Config</button>
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
                <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-200 space-y-4 shadow-inner">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Logo</h4>
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-transparent rounded-3xl border border-dashed border-slate-200 flex items-center justify-center overflow-hidden shadow-sm relative">
                      {formData.logoUrl ? <img src={formData.logoUrl} className="max-w-[90%] max-h-[90%] object-contain" alt="Preview" /> : <div className="text-[10px] font-black text-slate-300">NO LOGO</div>}
                    </div>
                    <div className="flex-1 space-y-3">
                      <label className="block w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black text-center uppercase tracking-widest cursor-pointer hover:bg-black transition-colors">
                        Upload Logo
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      </label>
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
                <button onClick={() => addItem('carModels')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-xs">Add</button>
              </div>
              <div className="space-y-2">
                {formData.carModels.map((m, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-700 text-xs">{m}</span>
                    <button onClick={() => removeItem('carModels', i)} className="text-red-400 hover:text-red-600">✕</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <h4 className="text-lg font-black text-slate-900 uppercase">Manufacturing Shops</h4>
              <div className="flex gap-2">
                <input className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" placeholder="Add Shop..." value={newShopItem} onChange={e => setNewShopItem(e.target.value)} />
                <button onClick={() => addItem('manufacturingShops')} className="bg-slate-900 text-white px-6 rounded-xl font-black text-xs">Add</button>
              </div>
              <div className="space-y-2">
                {formData.manufacturingShops.map((m, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-700 text-xs">{m}</span>
                    <button onClick={() => removeItem('manufacturingShops', i)} className="text-red-400 hover:text-red-600">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'COLUMNS' && (
          <div className="space-y-10">
            <div id="schema-form" className="bg-slate-900 p-8 rounded-[32px] text-white flex flex-col md:flex-row md:items-end gap-6 shadow-2xl border border-white/5">
              <div className="flex-1">
                <label className="block text-[8px] font-black uppercase text-slate-400 mb-2">Display Label</label>
                <input className="w-full px-5 py-3 bg-white/10 border border-white/20 rounded-xl font-bold" placeholder="e.g. Serial" value={newColLabel} onChange={e => setNewColLabel(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="block text-[8px] font-black uppercase text-slate-400 mb-2">Field ID (Unique)</label>
                <input className="w-full px-5 py-3 border rounded-xl font-mono text-sm bg-white/10 border-white/20" placeholder="serial_id" value={newColKey} onChange={e => setNewColKey(e.target.value)} />
              </div>
              <div className="w-full md:w-48">
                <label className="block text-[8px] font-black uppercase text-slate-400 mb-2">Format</label>
                <select className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl font-bold text-sm text-white appearance-none" value={newColType} onChange={e => setNewColType(e.target.value as any)}>
                  <option value="text" className="text-slate-900">Text (String)</option>
                  <option value="number" className="text-slate-900">Number (Int)</option>
                  <option value="image" className="text-slate-900">Image (File)</option>
                </select>
              </div>
              <button onClick={addOrUpdateColumn} className="px-10 py-3 bg-blue-600 rounded-xl font-black text-xs uppercase shadow-xl whitespace-nowrap hover:bg-blue-500 transition-colors">{editingColId ? 'Apply Update' : 'Register Field'}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formData.columns.map(col => (
                <div key={col.id} className="p-6 rounded-[24px] border border-slate-100 bg-white flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
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

        {activeTab === 'WORDING' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {Object.entries(formData.labels).map(([k, v]) => (
              <div key={k}>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">{k}</label>
                <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs" value={v || ''} onChange={e => setFormData({ ...formData, labels: { ...formData.labels, [k]: e.target.value } })} />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'CLOUD' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="Upstash REST URL" value={dbCreds.url} onChange={e => setDbCreds({ ...dbCreds, url: e.target.value })} />
              <input type="password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs" placeholder="Master Access Token" value={dbCreds.token} onChange={e => setDbCreds({ ...dbCreds, token: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <button onClick={saveDBCreds} className="py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs shadow-xl hover:bg-blue-500">LINK MESH</button>
                <button onClick={forcePull} className="py-5 bg-emerald-600 text-white rounded-[24px] font-black text-xs shadow-xl hover:bg-emerald-500">RECOVER CLOUD</button>
              </div>
              <button onClick={forcePush} className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs shadow-xl hover:bg-black">MANUAL CLOUD PUSH</button>
            </div>
            <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-200 h-[500px] overflow-auto shadow-inner">
              <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4">Cloud Mesh Logs</h4>
              {storageService.getSessionLogs().map((log, i) => (
                <div key={i} className="p-3 bg-white border border-slate-100 rounded-xl mb-2 text-[10px] font-bold flex gap-3">
                  <span className="text-slate-300">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className={log.status === 'ERROR' ? 'text-red-500' : 'text-blue-500'}>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'DATA' && (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* EXCEL CARD */}
              <div className="bg-emerald-900 p-10 rounded-[40px] text-white space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                   <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div className="w-16 h-16 bg-emerald-800 rounded-2xl flex items-center justify-center">
                   <ICONS.Truck />
                </div>
                <div>
                  <h4 className="text-xl font-black">Excel Data Terminal</h4>
                  <p className="text-sm text-emerald-200 mt-2">Export registry to XLSX or bulk-import assets with automatic schema alignment.</p>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <button onClick={handleExportExcel} className="w-full py-4 bg-white text-emerald-900 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">Export to Excel (.xlsx)</button>
                  <label className="block w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs text-center uppercase shadow-xl hover:scale-105 transition-all cursor-pointer">
                    Bulk Import Excel File
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
                  </label>
                </div>
              </div>

              {/* MASTER BACKUP CARD */}
              <div className="bg-slate-50 p-10 rounded-[40px] border border-slate-200 space-y-6 shadow-sm">
                <div className="w-16 h-16 bg-slate-200 text-slate-900 rounded-2xl flex items-center justify-center">
                   <ICONS.Inventory />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900">System JSON Backups</h4>
                  <p className="text-sm text-slate-500 mt-2">Export a master manifest containing all configuration, transfers, and asset snapshots.</p>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <button onClick={handleExportJSON} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase hover:bg-black transition-all">Download Master Backup</button>
                  <label className="block w-full py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl font-black text-xs text-center uppercase cursor-pointer hover:bg-slate-50 transition-all">
                    Restore from JSON
                    <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-red-50 p-10 rounded-[40px] border border-red-100 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shrink-0">
                   <ICONS.Alerts />
                </div>
                <div>
                  <h4 className="text-xl font-black text-red-900">Nuclear System Reset</h4>
                  <p className="text-sm text-red-600 font-bold">This permanently purges all local asset logs and facility transfers.</p>
                </div>
              </div>
              <button onClick={handleNuclearReset} className="px-10 py-5 bg-red-600 text-white rounded-[24px] font-black text-xs uppercase shadow-xl hover:bg-red-700 transition-all">Purge Registry</button>
            </div>
          </div>
        )}
      </div>

      {/* IMPORT MODAL FOR NEW HEADERS */}
      {importPreview && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[300] flex items-center justify-center p-6">
          <div className="bg-white rounded-[40px] p-10 w-full max-w-2xl space-y-8 shadow-2xl border border-blue-500">
             <div className="text-center">
                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                   <ICONS.Plus />
                </div>
                <h2 className="text-2xl font-black text-slate-900 uppercase">New Schema Detected</h2>
                <p className="text-slate-500 font-bold mt-2">The imported Excel file contains columns that are not registered in the system.</p>
             </div>

             <div className="bg-slate-50 p-6 rounded-3xl space-y-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Fields Identified:</span>
                <div className="flex flex-wrap gap-2">
                   {importPreview.newHeaders.map(h => (
                     <span key={h} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold">{h}</span>
                   ))}
                </div>
             </div>

             <div className="bg-amber-50 p-6 rounded-3xl text-amber-700 text-sm font-medium border border-amber-100">
               Accepting these will automatically expand your facility schema to accommodate this new data structure.
             </div>

             <div className="flex gap-4">
                <button onClick={() => setImportPreview(null)} className="flex-1 py-5 text-slate-400 font-black uppercase text-xs">Cancel Import</button>
                <button onClick={() => processImport(importPreview.rows, importPreview.newHeaders)} className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all">Accept Schema & Import</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;