
import React, { useState, useEffect } from 'react';
import { Part, AppConfig, PartLocation } from '../types';
import { ICONS } from '../constants';
import { geminiService } from '../services/geminiService';

interface PartFormProps {
  onClose: () => void;
  onSave: (part: any) => void;
  initialData?: Part;
  config: AppConfig;
}

const PartForm: React.FC<PartFormProps> = ({ onClose, onSave, initialData, config }) => {
  const [formData, setFormData] = useState<any>(() => {
    const state: any = {
      description: initialData?.description || '',
      imageUrl: initialData?.imageUrl || `https://picsum.photos/seed/${Math.random()}/400/300`,
      currentLocation: initialData?.currentLocation || 'SUPPLIER',
    };
    config.columns.forEach(col => {
      state[col.id] = initialData?.[col.id] ?? (col.type === 'number' ? 0 : '');
    });
    return state;
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
  }, []);

  const handleGenerateDescription = async () => {
    if (!formData.name || !formData.partNumber) return alert("Enter name and PN first.");
    setIsGenerating(true);
    const desc = await geminiService.generatePartDescription(formData.name, formData.partNumber, formData.carModel);
    setFormData((prev: any) => ({ ...prev, description: desc }));
    setIsGenerating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(initialData ? { ...initialData, ...formData } : formData);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-black text-slate-900">{initialData ? 'Update Asset' : 'Register Asset'}</h2>
        <button onClick={onClose} className="p-2 text-slate-400">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="p-10 overflow-y-auto scrollbar-hide flex-1 grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-[32px] space-y-4">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Base Data</h4>
            {config.columns.map(col => {
              if (col.id === 'manufacturingShop') {
                return (
                  <div key={col.id}>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">{col.label}</label>
                    <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold" value={formData[col.id]} onChange={e => setFormData({ ...formData, [col.id]: e.target.value })}>
                      {config.manufacturingShops.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                );
              }
              if (col.id === 'currentLocation') {
                return (
                  <div key={col.id}>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Global Positioning</label>
                    <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold" value={formData[col.id]} onChange={e => setFormData({ ...formData, [col.id]: e.target.value })}>
                      {config.locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                    </select>
                  </div>
                );
              }
              if (col.id === 'carModel') {
                return (
                  <div key={col.id}>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Model Link</label>
                    <div className="flex flex-wrap gap-2">
                      {config.carModels.map(m => (
                        <button type="button" key={m} onClick={() => setFormData({ ...formData, carModel: m })} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border ${formData.carModel === m ? 'bg-slate-900 text-white' : 'bg-white'}`}>{m}</button>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <div key={col.id}>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">{col.label}</label>
                  <input type={col.type} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold" value={formData[col.id]} onChange={e => setFormData({ ...formData, [col.id]: col.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value })} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-slate-50 p-6 rounded-[32px] space-y-4">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">AI Intelligence</h4>
              <textarea className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl min-h-[120px] text-sm" placeholder="Engineering specs..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              <button type="button" onClick={handleGenerateDescription} className="w-full py-3 border-2 border-blue-500 text-blue-600 rounded-xl font-black text-[10px] uppercase">✨ Optimize with Gemini</button>
           </div>
           <div className="bg-slate-50 p-6 rounded-[32px] h-48 overflow-hidden relative">
              <img src={formData.imageUrl} className="w-full h-full object-cover" />
              <button type="button" onClick={() => setFormData({ ...formData, imageUrl: `https://picsum.photos/seed/${Math.random()}/400/300` })} className="absolute bottom-4 right-4 bg-white px-4 py-1.5 rounded-lg text-[10px] font-black shadow-lg">New Mockup</button>
           </div>
        </div>

        <div className="col-span-full pt-10 border-t border-slate-100 flex justify-end gap-4">
          <button type="button" onClick={onClose} className="px-8 font-bold text-slate-400">Discard</button>
          <button type="submit" className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-black shadow-xl">Commit Asset</button>
        </div>
      </form>
    </div>
  );
};

export default PartForm;
