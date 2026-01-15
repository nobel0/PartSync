
import React, { useState } from 'react';
import { Part, AppConfig, User } from '../types';
import { ICONS, LOW_STOCK_THRESHOLD } from '../constants';

interface InventoryProps {
  parts: Part[];
  config: AppConfig;
  user: User;
  onReceive: (id: string, qty: number, notes?: string) => void;
  onEdit: (part: Part) => void;
}

const Inventory: React.FC<InventoryProps> = ({ parts, config, user, onReceive, onEdit }) => {
  const [filterShop, setFilterShop] = useState<string | 'ALL'>('ALL');
  const [receivingPartId, setReceivingPartId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState(1);

  const filteredParts = parts.filter(p => filterShop === 'ALL' || p.manufacturingShop === filterShop);
  const uniqueShops = Array.from(new Set(parts.map(p => p.manufacturingShop))).filter(Boolean);

  const canEdit = (partLine: string) => user.role === 'ADMIN' || user.assignedLine === partLine;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap gap-4 items-center bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm overflow-x-auto scrollbar-hide">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Area Filter:</span>
        <button onClick={() => setFilterShop('ALL')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${filterShop === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500'}`}>All Shops</button>
        {uniqueShops.map(shop => (
          <button key={shop} onClick={() => setFilterShop(shop)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${filterShop === shop ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-500'}`}>{shop}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredParts.map(part => {
          const hasPermission = canEdit(part.manufacturingShop);
          return (
            <div key={part.id} className={`bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col group transition-all ${!hasPermission ? 'opacity-80' : 'hover:-translate-y-1'}`}>
              <div className="relative h-48 bg-slate-100">
                <img src={part.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute top-4 left-4 flex flex-col gap-1">
                  <span className="bg-white/90 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm">{part.manufacturingShop}</span>
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1"><ICONS.Map /> {part.currentLocation}</span>
                </div>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h4 className="font-black text-slate-900 text-lg truncate">{part.name}</h4>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{part.partNumber}</p>
                <div className="mt-4 flex items-center justify-between">
                   <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase">Availability</span>
                      <span className={`text-2xl font-black ${part.currentStock <= LOW_STOCK_THRESHOLD ? 'text-red-600' : 'text-slate-900'}`}>{part.currentStock}</span>
                   </div>
                   <div className="text-right">
                      <span className="text-[8px] font-black text-slate-400 uppercase">Vendor</span>
                      <span className="text-xs font-bold text-slate-700 block truncate max-w-[100px]">{part.supplierName}</span>
                   </div>
                </div>
                {receivingPartId === part.id ? (
                  <div className="flex gap-2 mt-6">
                    <input type="number" autoFocus className="w-16 px-3 py-2 bg-slate-50 border rounded-xl font-bold" value={receiveQty} onChange={e => setReceiveQty(parseInt(e.target.value))} />
                    <button onClick={() => { onReceive(part.id, receiveQty); setReceivingPartId(null); }} className="flex-1 bg-emerald-600 text-white rounded-xl text-[10px] font-black">Commit</button>
                    <button onClick={() => setReceivingPartId(null)} className="p-2 text-slate-400">✕</button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-6">
                    <button disabled={!hasPermission} onClick={() => setReceivingPartId(part.id)} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${hasPermission ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {hasPermission ? 'INTAKE' : 'READ ONLY'}
                    </button>
                    {hasPermission && <button onClick={() => onEdit(part)} className="p-3 bg-slate-50 border rounded-xl text-slate-400 hover:text-slate-900"><ICONS.Settings /></button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Inventory;
