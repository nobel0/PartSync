
import React, { useState, useMemo } from 'react';
import { Part, AppConfig, User } from '../types';
import { ICONS, LOW_STOCK_THRESHOLD } from '../constants';
import { storageService } from '../services/storageService';

interface InventoryProps {
  parts: Part[];
  config: AppConfig;
  user: User;
  onReceive: (id: string, qty: number, notes?: string) => void;
  onEdit: (part: Part) => void;
}

const Inventory: React.FC<InventoryProps> = ({ parts, config, user, onReceive, onEdit }) => {
  const [filterShop, setFilterShop] = useState<string | 'ALL'>( 'ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [receivingPartId, setReceivingPartId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState(1);

  const filteredParts = useMemo(() => {
    let result = parts;
    
    // 1. Apply Shop Filter
    if (filterShop !== 'ALL') {
      result = result.filter(p => p.manufacturingShop === filterShop);
    }
    
    // 2. Token-Based Search (Words, not just substring)
    if (searchTerm.trim()) {
      const tokens = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
      result = result.filter(p => {
        // Create a large string of all searchable primitive values
        const searchableText = Object.entries(p)
          .map(([key, value]) => {
            if (['history', 'imageUrl', 'updatedAt', 'lastReceivedAt', 'id'].includes(key)) return '';
            if (typeof value === 'string' || typeof value === 'number') return value.toString().toLowerCase();
            return '';
          })
          .join(' ');

        // Check if EVERY token exists in the searchable text
        return tokens.every(token => searchableText.includes(token));
      });
    }
    return result;
  }, [parts, filterShop, searchTerm]);

  const uniqueShops = Array.from(new Set(parts.map(p => p.manufacturingShop))).filter(Boolean);

  const canEdit = (partLine: string) => user.role === 'ADMIN' || user.assignedLine === partLine || user.assignedLine === 'ALL';
  const canDelete = user.role === 'ADMIN' || user.role === 'INTERNAL_LOGISTIC';

  const handleDelete = (id: string) => {
    if (window.confirm("Permanent Asset Deletion?")) {
      storageService.deletePart(id);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-4 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100">
           <div className="text-slate-400"><ICONS.Search /></div>
           <input 
              type="text" 
              placeholder="Search registry (e.g. 'Rear Axle' or 'P700 Engine')..." 
              className="flex-1 bg-transparent border-none outline-none font-bold text-slate-600"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
           />
           {searchTerm && (
             <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-900 px-2 text-[10px] font-black uppercase">Clear</button>
           )}
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Facility Filter:</span>
          <button onClick={() => setFilterShop('ALL')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${filterShop === 'ALL' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'}`}>Global View</button>
          {uniqueShops.map(shop => (
            <button key={shop} onClick={() => setFilterShop(shop)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${filterShop === shop ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'}`}>{shop}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredParts.map(part => {
          const hasPermission = canEdit(part.manufacturingShop);
          return (
            <div key={part.id} className={`bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col group transition-all ${!hasPermission ? 'opacity-80' : 'hover:-translate-y-1'}`}>
              <div className="relative h-48 bg-slate-100">
                <img src={part.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt={part.name} />
                <div className="absolute top-4 left-4 flex flex-col gap-1">
                  <span className="bg-white/90 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm">{part.manufacturingShop}</span>
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1"><ICONS.Map /> {part.currentLocation}</span>
                </div>
                {canDelete && (
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(part.id); }} className="absolute top-4 right-4 p-2 bg-red-600 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-700">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                )}
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h4 className="font-black text-slate-900 text-lg truncate">{part.name}</h4>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{part.partNumber}</p>
                <div className="mt-4 flex items-center justify-between">
                   <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase">Stock</span>
                      <span className={`text-2xl font-black ${part.currentStock <= LOW_STOCK_THRESHOLD ? 'text-red-600' : 'text-slate-900'}`}>{part.currentStock}</span>
                   </div>
                   <div className="text-right">
                      <span className="text-[8px] font-black text-slate-400 uppercase">Vendor</span>
                      <span className="text-xs font-bold text-slate-700 block truncate max-w-[100px]">{part.supplierName}</span>
                   </div>
                </div>
                {receivingPartId === part.id ? (
                  <div className="flex gap-2 mt-6">
                    <input type="number" autoFocus className="w-16 px-3 py-2 bg-slate-50 border rounded-xl font-bold" value={receiveQty} onChange={e => setReceiveQty(parseInt(e.target.value) || 0)} />
                    <button onClick={() => { onReceive(part.id, receiveQty); setReceivingPartId(null); }} className="flex-1 bg-emerald-600 text-white rounded-xl text-[10px] font-black">Commit</button>
                    <button onClick={() => setReceivingPartId(null)} className="p-2 text-slate-400">✕</button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-6">
                    <button disabled={!hasPermission} onClick={() => setReceivingPartId(part.id)} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${hasPermission ? 'bg-slate-900 text-white hover:bg-black shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                      {hasPermission ? 'QUICK INTAKE' : 'READ ONLY'}
                    </button>
                    {hasPermission && <button onClick={() => onEdit(part)} className="p-3 bg-slate-50 border rounded-xl text-slate-400 hover:text-slate-900 transition-colors"><ICONS.Settings /></button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filteredParts.length === 0 && (
          <div className="col-span-full py-20 text-center animate-in fade-in duration-500">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                <ICONS.Search />
             </div>
             <p className="text-slate-400 font-black text-xs uppercase tracking-[0.2em]">No matches found for "{searchTerm}"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;
