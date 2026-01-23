
import React, { useState } from 'react';
import { Transfer, User, Part, PartLocation, AppConfig } from '../types';
import { storageService } from '../services/storageService';
import { ICONS } from '../constants';

interface TransfersProps {
  user: User;
  parts: Part[];
  config: AppConfig;
  onTransferComplete: () => void;
  onUpdateLabel?: (key: string, val: string) => void;
}

const EditableLabel: React.FC<{
  text: string;
  onSave: (newText: string) => void;
  className?: string;
  adminOnly?: boolean;
  currentUser?: User | null;
}> = ({ text, onSave, className, adminOnly, currentUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(text);
  if (adminOnly && currentUser?.role !== 'ADMIN') return <span className={className}>{text}</span>;
  if (isEditing) {
    return (
      <input
        autoFocus
        className={`bg-white border border-blue-500 rounded px-2 outline-none ${className}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { setIsEditing(false); onSave(value); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { setIsEditing(false); onSave(value); } }}
      />
    );
  }
  return (
    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
      <span className={className}>{text}</span>
      <span className="opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
      </span>
    </div>
  );
};

const Transfers: React.FC<TransfersProps> = ({ user, parts, config, onTransferComplete, onUpdateLabel }) => {
  const [transfers, setTransfers] = useState<Transfer[]>(storageService.getTransfers());
  const [showDispatch, setShowDispatch] = useState(false);
  
  const [selectedPartId, setSelectedPartId] = useState('');
  const [qty, setQty] = useState(1);
  const [toLocation, setToLocation] = useState<PartLocation>('WAREHOUSE');

  const handleDispatch = async () => {
    const part = parts.find(p => p.id === selectedPartId);
    if (!part) return alert("Select part");
    
    await storageService.createTransfer({
      parts: [{ partId: part.id, partNumber: part.partNumber, name: part.name, quantity: qty }],
      fromLocation: 'SUPPLIER',
      toLocation,
      supplierId: user.id,
      supplierName: user.username
    });
    
    setTransfers(storageService.getTransfers());
    setShowDispatch(false);
    onTransferComplete();
  };

  const handleAccept = async (id: string) => {
    await storageService.acceptTransfer(id);
    setTransfers(storageService.getTransfers());
    onTransferComplete();
  };

  const isLogistics = user.role === 'ADMIN' || user.role === 'INTERNAL_LOGISTIC';

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <EditableLabel 
            text={config.labels.transfersHeadline || 'Logistics Exchange'} 
            onSave={(v) => onUpdateLabel?.('transfersHeadline', v)}
            className="text-2xl font-black text-slate-900 uppercase tracking-tight"
            currentUser={user}
            adminOnly
          />
          <EditableLabel 
            text={config.labels.transfersSubline || 'Registry Handshake Protocol'} 
            onSave={(v) => onUpdateLabel?.('transfersSubline', v)}
            className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1 block"
            currentUser={user}
            adminOnly
          />
        </div>
        {user.role === 'SUPPLIER' && (
          <button onClick={() => setShowDispatch(true)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 transition-all">Initiate Dispatch</button>
        )}
      </div>

      <div className="grid gap-4">
        {transfers.map(t => (
          <div key={t.id} className={`p-6 bg-white rounded-3xl border ${t.status === 'PENDING' ? 'border-amber-200 bg-amber-50/20' : 'border-slate-100'} shadow-sm flex flex-col md:flex-row items-center justify-between gap-6`}>
            <div className="flex items-center gap-6">
              <div className={`p-4 rounded-2xl ${t.status === 'PENDING' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                <ICONS.Truck />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-lg">{t.parts.map(p => `${p.quantity}x ${p.name}`).join(', ')}</h4>
                <div className="flex gap-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">
                   <span className="flex items-center gap-1.5"><ICONS.Map /> {t.fromLocation}</span>
                   <span className="text-slate-300">➔</span>
                   <span className="text-blue-600 flex items-center gap-1.5">{t.toLocation}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3 text-right">
               <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest ${t.status === 'PENDING' ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-emerald-100 text-emerald-700'}`}>
                 {t.status === 'PENDING' ? 'Awaiting Handshake' : 'Facility Secured'}
               </span>
               <div className="flex items-center gap-6 mt-1">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Supplier Sign</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{t.supplierSignature}</span>
                  </div>
                  {t.engineerSignature ? (
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Logistic Sign</span>
                      <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-bold">{t.engineerSignature}</span>
                    </div>
                  ) : (
                    isLogistics && t.status === 'PENDING' && (
                      <button onClick={() => handleAccept(t.id)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-lg uppercase tracking-widest hover:bg-blue-700">Counter-Sign</button>
                    )
                  )}
               </div>
            </div>
          </div>
        ))}
        {transfers.length === 0 && (
          <div className="py-24 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <ICONS.Signature />
            </div>
            <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Registry Handshake History Empty</p>
          </div>
        )}
      </div>

      {showDispatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
           <div className="bg-white p-12 rounded-[40px] shadow-2xl w-full max-w-lg space-y-8">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Registry Dispatch</h3>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Initiate Multi-Party Transfer Handshake</p>
              </div>
              <div className="space-y-5">
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Part Identification</label>
                    <select className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700" value={selectedPartId} onChange={e => setSelectedPartId(e.target.value)}>
                        <option value="">Select Asset...</option>
                        {parts.map(p => <option key={p.id} value={p.id}>{p.name} (PN: {p.partNumber})</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Quantity Check</label>
                    <input type="number" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700" value={qty} onChange={e => setQty(parseInt(e.target.value))} placeholder="Dispatch Units" />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Target Facility Location</label>
                    <select className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700" value={toLocation} onChange={e => setToLocation(e.target.value as PartLocation)}>
                        <option value="WAREHOUSE">Facility Central Warehouse</option>
                        <option value="BODY_SHOP">Main Body Shop</option>
                        <option value="FE">Front End Line</option>
                        <option value="RF">Rear Floor Line</option>
                    </select>
                 </div>
              </div>
              <div className="bg-blue-50 p-6 rounded-3xl text-[10px] font-bold text-blue-600 border border-blue-100 leading-relaxed uppercase tracking-widest">
                Protocol: Your digital signature will be appended to this dispatch. Internal logistics will be required to confirm physical receipt at target location.
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setShowDispatch(false)} className="flex-1 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest">Discard</button>
                 <button onClick={handleDispatch} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-colors">Sign & Release</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Transfers;
