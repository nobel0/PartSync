
import React, { useState } from 'react';
import { Transfer, User, Part, PartLocation } from '../types';
import { storageService } from '../services/storageService';
import { ICONS } from '../constants';

interface TransfersProps {
  user: User;
  parts: Part[];
  onTransferComplete: () => void;
}

const Transfers: React.FC<TransfersProps> = ({ user, parts, onTransferComplete }) => {
  const [transfers, setTransfers] = useState<Transfer[]>(storageService.getTransfers());
  const [showDispatch, setShowDispatch] = useState(false);
  
  // Dispatch Form State
  const [selectedPartId, setSelectedPartId] = useState('');
  const [qty, setQty] = useState(1);
  const [toLocation, setToLocation] = useState<PartLocation>('WAREHOUSE');

  const handleDispatch = () => {
    const part = parts.find(p => p.id === selectedPartId);
    if (!part) return alert("Select part");
    
    storageService.createTransfer({
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

  const handleAccept = (id: string) => {
    storageService.acceptTransfer(id);
    setTransfers(storageService.getTransfers());
    onTransferComplete();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-slate-900">Transfer Handshake System</h3>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Multi-Party Digital Validation</p>
        </div>
        {user.role === 'SUPPLIER' && (
          <button onClick={() => setShowDispatch(true)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold shadow-xl">Initiate Dispatch</button>
        )}
      </div>

      <div className="grid gap-4">
        {transfers.map(t => (
          <div key={t.id} className={`p-6 bg-white rounded-3xl border ${t.status === 'PENDING' ? 'border-amber-200 bg-amber-50/20' : 'border-slate-100'} shadow-sm flex flex-col md:flex-row items-center justify-between gap-6`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${t.status === 'PENDING' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                <ICONS.Truck />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">{t.parts.map(p => `${p.quantity}x ${p.name}`).join(', ')}</h4>
                <div className="flex gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                   <span>From: {t.fromLocation}</span>
                   <span>➔</span>
                   <span className="text-blue-600">To: {t.toLocation}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 text-right">
               <span className={`text-[10px] font-black px-3 py-1 rounded-full ${t.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                 {t.status === 'PENDING' ? 'WAITING FOR SIGNATURE' : 'COMPLETED'}
               </span>
               <div className="flex items-center gap-4 mt-2">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-300 uppercase">Supplier Sign</span>
                    <span className="text-[9px] font-mono text-slate-400 truncate max-w-[100px]">{t.supplierSignature}</span>
                  </div>
                  {t.engineerSignature ? (
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-300 uppercase">Engineer Sign</span>
                      <span className="text-[9px] font-mono text-slate-400 truncate max-w-[100px]">{t.engineerSignature}</span>
                    </div>
                  ) : (
                    user.role === 'ENGINEER' && t.status === 'PENDING' && (
                      <button onClick={() => handleAccept(t.id)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg">ACKNOWLEDGE & SIGN</button>
                    )
                  )}
               </div>
            </div>
          </div>
        ))}
        {transfers.length === 0 && (
          <div className="py-20 text-center opacity-40">
            <ICONS.Signature />
            <p className="mt-2 font-black text-[10px] uppercase">No Transaction Logs</p>
          </div>
        )}
      </div>

      {showDispatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
           <div className="bg-white p-10 rounded-[40px] shadow-2xl w-full max-w-lg space-y-6">
              <h3 className="text-xl font-black text-slate-900">Dispatch Initiation</h3>
              <div className="space-y-4">
                 <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={selectedPartId} onChange={e => setSelectedPartId(e.target.value)}>
                    <option value="">Select Part...</option>
                    {parts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.partNumber})</option>)}
                 </select>
                 <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={qty} onChange={e => setQty(parseInt(e.target.value))} placeholder="Quantity" />
                 <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={toLocation} onChange={e => setToLocation(e.target.value as PartLocation)}>
                    <option value="WAREHOUSE">Warehouse</option>
                    <option value="BODY_SHOP">Body Shop</option>
                    <option value="FE">Front End Line</option>
                    <option value="RF">Rear Floor Line</option>
                 </select>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl text-[10px] font-bold text-blue-600 border border-blue-100">
                Action: Dispatch will be signed as {user.username}. Waiting for Engineer signature upon arrival.
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setShowDispatch(false)} className="flex-1 py-4 text-slate-400 font-bold">Cancel</button>
                 <button onClick={handleDispatch} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl">Sign & Ship</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Transfers;
