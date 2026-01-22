
import React, { useState, useMemo } from 'react';
import { Part, AppConfig, User } from '../types';
import { ICONS, LOW_STOCK_THRESHOLD } from '../constants';
import { storageService } from '../services/storageService';
import { EditableLabel } from '../App';

interface InventorySheetProps {
  parts: Part[];
  config: AppConfig;
  user: User;
  onEdit: (part: Part) => void;
  onReceive: (id: string, qty: number) => void;
  onDataRefresh: () => void;
  onUpdateConfig: (config: AppConfig) => void;
}

const InventorySheet: React.FC<InventorySheetProps> = ({ parts, config, user, onEdit, onReceive, onDataRefresh, onUpdateConfig }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredParts = useMemo(() => {
    if (!searchTerm.trim()) return parts;
    const term = searchTerm.toLowerCase();
    return parts.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.partNumber.toLowerCase().includes(term) ||
      p.description.toLowerCase().includes(term) ||
      p.carModel.toLowerCase().includes(term) ||
      p.supplierName.toLowerCase().includes(term) ||
      p.manufacturingShop.toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term)
    );
  }, [parts, searchTerm]);

  const handleDelete = (id: string) => {
    if (window.confirm("Permanent Asset Deletion?")) {
      storageService.deletePart(id);
      onDataRefresh();
    }
  };

  const toggleDelivery = async (partId: string) => {
    await storageService.setLocation(partId, 'WAREHOUSE');
    onDataRefresh();
  };

  const handleUpdateColumnLabel = (id: string, newLabel: string) => {
    const updatedColumns = config.columns.map(col => col.id === id ? { ...col, label: newLabel } : col);
    onUpdateConfig({ ...config, columns: updatedColumns });
  };

  const isLogistics = user.role === 'ADMIN' || user.role === 'INTERNAL_LOGISTIC';

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Search Bar */}
      <div className="bg-white p-4 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="text-slate-400"><ICONS.Search /></div>
        <input 
          type="text" 
          placeholder="Search by ID, Name, Model, Supplier or Description..." 
          className="flex-1 bg-transparent border-none outline-none font-bold text-slate-600 placeholder:text-slate-300"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-[10px] font-black text-slate-300 hover:text-slate-900 transition-colors">CLEAR</button>
        )}
      </div>

      <div className="bg-white rounded-[24px] lg:rounded-[32px] border border-slate-200 shadow-xl overflow-hidden flex flex-col flex-1">
        <div className="overflow-x-auto scrollbar-hide flex-1">
          <table className="w-full text-left border-collapse min-w-[800px] lg:min-w-[1200px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-900 text-white">
                {isLogistics && (
                  <th className="px-4 lg:px-6 py-4 text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-center w-20">Delivered</th>
                )}
                {config.columns.map(col => (
                  <th key={col.id} className="px-4 lg:px-6 py-4 lg:py-5 text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
                    <EditableLabel 
                      text={col.label} 
                      onSave={(v) => handleUpdateColumnLabel(col.id, v)} 
                      currentUser={user}
                      adminOnly
                      className="text-white"
                    />
                  </th>
                ))}
                <th className="px-4 lg:px-6 py-4 lg:py-5 text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-right sticky right-0 bg-slate-900">CMD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParts.map((part, index) => {
                const isDelivered = part.currentLocation === 'WAREHOUSE';
                const hasEditPermission = user.role === 'ADMIN' || user.assignedLine === part.manufacturingShop || user.assignedLine === 'ALL';
                const hasDeletePermission = user.role === 'ADMIN' || user.role === 'INTERNAL_LOGISTIC';
                
                return (
                  <tr key={part.id} className={`transition-colors group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} ${!hasEditPermission ? 'text-slate-400' : 'hover:bg-blue-50/50'}`}>
                    {isLogistics && (
                      <td className="px-4 lg:px-6 py-3 text-center">
                        <button 
                          onClick={() => toggleDelivery(part.id)} 
                          className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${isDelivered ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'border-slate-200 hover:border-emerald-300'}`}
                        >
                          {isDelivered && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </button>
                      </td>
                    )}
                    {config.columns.map(col => {
                      const val = part[col.id];
                      return (
                        <td key={col.id} className="px-4 lg:px-6 py-3 lg:py-4">
                          {col.id === 'name' ? (
                            <div className="flex items-center gap-2 lg:gap-3">
                              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 shrink-0">
                                 <img src={part.imageUrl} className={`w-full h-full object-cover ${!hasEditPermission ? 'grayscale' : ''}`} alt="" />
                              </div>
                              <span className={`font-bold text-xs lg:text-sm line-clamp-1 ${hasEditPermission ? 'text-slate-800' : 'text-slate-400'}`}>{val}</span>
                            </div>
                          ) : col.type === 'image' ? (
                            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm">
                               {val ? <img src={val} className="w-full h-full object-cover" alt="Preview" /> : <div className="w-full h-full flex items-center justify-center text-[7px] font-black text-slate-300 uppercase">Void</div>}
                            </div>
                          ) : col.id === 'currentStock' ? (
                            <div className="flex items-center gap-2">
                               <span className={`text-xs lg:text-sm font-black px-2 py-0.5 rounded-lg ${!hasEditPermission ? 'bg-slate-100 text-slate-400' : (val <= LOW_STOCK_THRESHOLD ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-900')}`}>
                                {val?.toLocaleString()}
                              </span>
                            </div>
                          ) : col.id === 'currentLocation' ? (
                             <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${isDelivered ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'}`}>{val}</span>
                          ) : (
                            <span className="text-xs lg:text-sm font-medium truncate max-w-[150px] block">{val}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 lg:px-6 py-3 lg:py-4 text-right sticky right-0 bg-inherit">
                      <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {hasEditPermission && <button onClick={() => onReceive(part.id, 1)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-colors"><ICONS.Plus /></button>}
                        {hasEditPermission && <button onClick={() => onEdit(part)} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-900 hover:text-white transition-colors"><ICONS.Settings /></button>}
                        {hasDeletePermission && <button onClick={() => handleDelete(part.id)} className="p-2 bg-red-50 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition-colors">✕</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventorySheet;
