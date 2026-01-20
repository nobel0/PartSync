import React from 'react';
import { Part, AppConfig, User } from '../types';
import { ICONS, LOW_STOCK_THRESHOLD } from '../constants';
import { storageService } from '../services/storageService';

interface InventorySheetProps {
  parts: Part[];
  config: AppConfig;
  user: User;
  onEdit: (part: Part) => void;
  onReceive: (id: string, qty: number) => void;
  onDataRefresh: () => void;
}

const InventorySheet: React.FC<InventorySheetProps> = ({ parts, config, user, onEdit, onReceive, onDataRefresh }) => {
  const handleDelete = (id: string) => {
    if (window.confirm("Permanent Asset Deletion? Data recovery will require a previous CSV restore.")) {
      storageService.deletePart(id);
      onDataRefresh();
    }
  };

  const canEdit = (partLine: string) => {
    return user.role === 'ADMIN' || user.assignedLine === partLine;
  };

  return (
    <div className="bg-white rounded-[24px] lg:rounded-[32px] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full max-h-[calc(100vh-180px)] lg:max-h-[calc(100vh-280px)]">
      <div className="overflow-x-auto scrollbar-hide flex-1">
        <table className="w-full text-left border-collapse min-w-[800px] lg:min-w-[1200px]">
          <thead className="sticky top-0 z-20">
            <tr className="bg-slate-900 text-white">
              {config.columns.map(col => (
                <th key={col.id} className="px-4 lg:px-6 py-4 lg:py-5 text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
                  {col.label}
                </th>
              ))}
              <th className="px-4 lg:px-6 py-4 lg:py-5 text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-right sticky right-0 bg-slate-900">CMD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {parts.map((part, index) => {
              const hasPermission = canEdit(part.manufacturingShop);
              
              return (
                <tr key={part.id} className={`transition-colors group ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} ${!hasPermission ? 'text-slate-400' : 'hover:bg-blue-50/50'}`}>
                  {config.columns.map(col => {
                    const val = part[col.id];
                    return (
                      <td key={col.id} className="px-4 lg:px-6 py-3 lg:py-4">
                        {col.id === 'name' ? (
                          <div className="flex items-center gap-2 lg:gap-3">
                            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 shrink-0">
                               <img src={part.imageUrl} className={`w-full h-full object-cover ${!hasPermission ? 'grayscale' : ''}`} alt="" />
                            </div>
                            <span className={`font-bold text-xs lg:text-sm line-clamp-1 ${hasPermission ? 'text-slate-800' : 'text-slate-400'}`}>{val}</span>
                          </div>
                        ) : col.type === 'image' ? (
                          <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm">
                             {val ? <img src={val} className="w-full h-full object-cover" alt="Preview" /> : <div className="w-full h-full flex items-center justify-center text-[7px] font-black text-slate-300 uppercase">Void</div>}
                          </div>
                        ) : col.id === 'currentStock' ? (
                          <div className="flex items-center gap-2">
                             <span className={`text-xs lg:text-sm font-black px-2 py-0.5 rounded-lg ${!hasPermission ? 'bg-slate-100 text-slate-400' : (val <= LOW_STOCK_THRESHOLD ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-900')}`}>
                              {val?.toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs lg:text-sm font-medium truncate max-w-[150px] block">{val}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 lg:px-6 py-3 lg:py-4 text-right sticky right-0 bg-inherit shadow-[-10px_0_15px_rgba(0,0,0,0.02)] lg:shadow-none">
                    <div className={`flex justify-end gap-1.5 transition-all ${hasPermission ? 'lg:opacity-0 lg:group-hover:opacity-100' : 'hidden'}`}>
                      <button onClick={() => onReceive(part.id, 1)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-colors"><ICONS.Plus /></button>
                      <button onClick={() => onEdit(part)} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-900 hover:text-white transition-colors"><ICONS.Settings /></button>
                      <button onClick={() => handleDelete(part.id)} className="p-2 bg-red-50 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition-colors">✕</button>
                    </div>
                    {!hasPermission && (
                       <span className="text-[8px] font-black text-slate-300 uppercase">ReadOnly</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {parts.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-slate-400 font-black uppercase text-xs tracking-[0.2em]">No Assets Detected</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventorySheet;