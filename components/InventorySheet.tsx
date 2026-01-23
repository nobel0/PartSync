
import React, { useState, useMemo } from 'react';
import { Part, AppConfig, User, PartLocation } from '../types';
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
    
    return parts.filter(p => {
      // Scan every field for the search term
      return Object.entries(p).some(([key, value]) => {
        if (key === 'history' || key === 'imageUrl' || value === null || value === undefined) return false;
        return value.toString().toLowerCase().includes(term);
      });
    });
  }, [parts, searchTerm]);

  const handleAction = async (partId: string, newLocation: PartLocation) => {
    await storageService.setLocation(partId, newLocation);
    onDataRefresh();
  };

  const isLogistics = user.role === 'ADMIN' || user.role === 'INTERNAL_LOGISTIC';
  const isEngineer = user.role === 'ADMIN' || user.role === 'ENGINEER';

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="bg-white p-4 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="text-slate-400 pl-2"><ICONS.Search /></div>
        <input 
          type="text" 
          placeholder="Omni-Search Registry (Scans all IDs, Shops, Names, and Custom Fields)..." 
          className="flex-1 bg-transparent border-none outline-none font-bold text-slate-600 placeholder:text-slate-300"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && <button onClick={() => setSearchTerm('')} className="pr-4 text-[10px] font-black text-slate-300 hover:text-slate-900 transition-colors uppercase">Clear</button>}
      </div>

      <div className="bg-white rounded-[24px] lg:rounded-[32px] border border-slate-200 shadow-xl overflow-hidden flex flex-col flex-1">
        <div className="overflow-x-auto scrollbar-hide flex-1">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-900 text-white">
                {isLogistics && <th className="px-6 py-5 text-[10px] font-black uppercase text-center w-32 tracking-[0.2em] border-r border-white/5">Warehouse Check</th>}
                {isEngineer && <th className="px-6 py-5 text-[10px] font-black uppercase text-center w-32 tracking-[0.2em] border-r border-white/5">Issue Release</th>}
                {config.columns.map(col => (
                  <th key={col.id} className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">{col.label}</th>
                ))}
                <th className="px-6 py-5 text-[10px] font-black uppercase text-right sticky right-0 bg-slate-900 w-24">CMD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParts.map((part, index) => {
                const inWarehouse = part.currentLocation === 'WAREHOUSE';
                const shopLocation = part.manufacturingShop as PartLocation;
                const inShop = part.currentLocation === shopLocation;
                
                return (
                  <tr key={part.id} className={`group transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-blue-50/30`}>
                    {isLogistics && (
                      <td className="px-6 py-3 text-center border-r border-slate-100">
                        <button 
                          onClick={() => handleAction(part.id, inWarehouse ? 'SUPPLIER' : 'WAREHOUSE')} 
                          title={inWarehouse ? "Move back to Supplier status" : "Confirm Warehouse Delivery"}
                          className={`w-10 h-10 rounded-2xl border-2 transition-all flex items-center justify-center mx-auto shadow-sm ${inWarehouse ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-200' : 'border-slate-200 bg-white hover:border-emerald-300 text-slate-300'}`}
                        >
                          {inWarehouse ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : <ICONS.Truck />}
                        </button>
                      </td>
                    )}
                    {isEngineer && (
                      <td className="px-6 py-3 text-center border-r border-slate-100">
                         <button 
                          disabled={!inWarehouse && !inShop}
                          onClick={() => handleAction(part.id, inShop ? 'WAREHOUSE' : shopLocation)} 
                          title={inShop ? "Return to Warehouse" : `Issue to ${part.manufacturingShop}`}
                          className={`w-10 h-10 rounded-2xl border-2 transition-all flex items-center justify-center mx-auto shadow-sm ${inShop ? 'bg-blue-600 border-blue-600 text-white shadow-blue-200' : inWarehouse ? 'border-blue-300 bg-white text-blue-500 hover:bg-blue-50' : 'border-slate-100 bg-slate-50 text-slate-200 cursor-not-allowed'}`}
                        >
                          <ICONS.Map />
                        </button>
                      </td>
                    )}
                    {config.columns.map(col => (
                      <td key={col.id} className="px-6 py-4 text-xs font-medium text-slate-700">
                        {col.id === 'currentLocation' ? (
                           <span className={`px-2 py-1 rounded-lg uppercase text-[10px] font-black tracking-widest ${inWarehouse ? 'bg-emerald-50 text-emerald-600' : inShop ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>{part[col.id]}</span>
                        ) : col.id === 'currentStock' ? (
                          <span className={`px-3 py-1 rounded-lg font-black ${part[col.id] <= LOW_STOCK_THRESHOLD ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-900'}`}>{part[col.id]?.toLocaleString()}</span>
                        ) : col.id === 'name' ? (
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 shrink-0">
                                 <img src={part.imageUrl} className="w-full h-full object-cover" alt="" />
                              </div>
                              <span className="font-bold truncate max-w-[200px] text-slate-900">{part[col.id]}</span>
                           </div>
                        ) : part[col.id]}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-right sticky right-0 bg-white/90 backdrop-blur-sm group-hover:bg-blue-50/90 transition-colors">
                      <button onClick={() => onEdit(part)} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                        <ICONS.Settings />
                      </button>
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
