import React from 'react';
import { Part, AppConfig } from '../types';
import { ICONS, LOW_STOCK_THRESHOLD } from '../constants';

interface SuppliersViewProps {
  parts: Part[];
  config: AppConfig;
}

const SuppliersView: React.FC<SuppliersViewProps> = ({ parts, config }) => {
  const suppliers = Array.from(new Set(parts.map(p => p.supplierName))).filter(Boolean);
  
  const getSupplierStats = (name: string) => {
    const sParts = parts.filter(p => p.supplierName === name);
    const critical = sParts.filter(p => p.currentStock <= LOW_STOCK_THRESHOLD).length;
    return { total: sParts.length, critical };
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-black text-slate-900 uppercase">{config.labels.suppliersHeadline}</h3>
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{config.labels.suppliersSubline}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.map(s => {
          // Explicitly cast to string to satisfy getSupplierStats type requirement
          const stats = getSupplierStats(s as string);
          return (
            <div key={s as string} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 bg-slate-900 text-white rounded-2xl">
                  <ICONS.Suppliers />
                </div>
                {stats.critical > 0 && (
                  <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse">Needs Restock</span>
                )}
              </div>
              <h4 className="text-xl font-black text-slate-900">{s as string}</h4>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                   <span>Active SKUs</span>
                   <span className="text-slate-900">{stats.total}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-500">
                   <span>Critical Level Items</span>
                   <span className={stats.critical > 0 ? "text-red-600" : "text-emerald-600"}>{stats.critical}</span>
                </div>
              </div>
              <button className="mt-8 w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black border border-slate-100 transition-colors uppercase tracking-widest">View Vendor Portal</button>
            </div>
          );
        })}
        {suppliers.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-30">
            <p className="font-black uppercase text-xs tracking-widest">No Registered Vendors Found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuppliersView;