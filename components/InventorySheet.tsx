
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

  const handleAction = async (partId: string, newLocation: PartLocation) => {
    await storageService.setLocation(partId, newLocation);
    onDataRefresh();
  };

  const isLogistics = user.role === 'ADMIN' || user.role === 'INTERNAL_LOGISTIC';
  const isEngineer = user.role === 'ADMIN' || user.role === 'ENGINEER';

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="bg-white p-4 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="text-slate-400"><ICONS.Search /></div>
        <input 
          type="text" 
          placeholder="Search by ID, Part #, Name, Model, Supplier..." 
          className="flex-1 bg-transparent border-none outline-none font-bold text-slate-600"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-[24px] lg:rounded-[32px] border border-slate-200 shadow-xl overflow-hidden flex flex-col flex-1">
        <div className="overflow-x-auto scrollbar-hide flex-1">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-900 text-white">
                {isLogistics && <th className="px-6 py-4 text-[10px] font-black uppercase text-center w-24">Logistic Check</th>}
                {isEngineer && <th className="px-6 py-4 text-[10px] font-black uppercase text-center w-24">Issue To Shop</th>}
                {config.columns.map(col => (
                  <th key={col.id} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">{col.label}</th>
                ))}
                <th className="px-6 py-4 text-[10px] font-black uppercase text-right sticky right-0 bg-slate-900">CMD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParts.map((part, index) => {
                const inWarehouse = part.currentLocation === 'WAREHOUSE';
                const inShop = part.currentLocation === part.manufacturingShop;
                
                return (
                  <tr key={part.id} className={`group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    {isLogistics && (
                      <td className="px-6 py-3 text-center">
                        <button 
                          onClick={() => handleAction(part.id, inWarehouse ? 'SUPPLIER' : 'WAREHOUSE')} 
                          className={`w-8 h-8 rounded-xl border-2 transition-all flex items-center justify-center mx-auto ${inWarehouse ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'border-slate-200'}`}
                        >
                          {inWarehouse && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </button>
                      </td>
                    )}
                    {isEngineer && (
                      <td className="px-6 py-3 text-center">
                         <button 
                          disabled={!inWarehouse && !inShop}
                          onClick={() => handleAction(part.id, inShop ? 'WAREHOUSE' : (part.manufacturingShop as PartLocation))} 
                          className={`w-8 h-8 rounded-xl border-2 transition-all flex items-center justify-center mx-auto ${inShop ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : inWarehouse ? 'border-blue-200 text-blue-400 hover:border-blue-400' : 'border-slate-100 text-slate-200 cursor-not-allowed'}`}
                        >
                          <ICONS.Map />
                        </button>
                      </td>
                    )}
                    {config.columns.map(col => (
                      <td key={col.id} className="px-6 py-3 text-xs lg:text-sm font-medium">
                        {col.id === 'currentLocation' ? (
                           <span className={`px-2 py-1 rounded-lg uppercase text-[10px] font-black ${inWarehouse ? 'bg-emerald-50 text-emerald-600' : inShop ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>{part[col.id]}</span>
                        ) : col.id === 'currentStock' ? (
                          <span className={`px-2 py-1 rounded-lg font-black ${part[col.id] <= LOW_STOCK_THRESHOLD ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-700'}`}>{part[col.id]}</span>
                        ) : part[col.id]}
                      </td>
                    ))}
                    <td className="px-6 py-3 text-right sticky right-0 bg-inherit">
                      <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => onEdit(part)} className="p-2 bg-slate-100 text-slate-500 rounded-lg"><ICONS.Settings /></button>
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
