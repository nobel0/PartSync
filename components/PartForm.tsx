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

  const handleGenerateDescription = async () => {
    if (!formData.name || !formData.partNumber) return alert("Enter name and PN first.");
    setIsGenerating(true);
    const desc = await geminiService.generatePartDescription(formData.name, formData.partNumber, formData.carModel || '');
    setFormData((prev: any) => ({ ...prev, description: desc }));
    setIsGenerating(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string = 'imageUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev: any) => ({ ...prev, [fieldName]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(initialData ? { ...initialData, ...formData } : formData);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{initialData ? 'Update Asset' : 'New Asset'}</h2>
        <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="p-10 overflow-y-auto scrollbar-hide flex-1 grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="bg-slate-50 p-8 rounded-[40px] space-y-5 border border-slate-100 shadow-sm">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Registry Schema Data</h4>
            {config.columns.map(col => {
              if (col.id === 'manufacturingShop') {
                return (
                  <div key={col.id}>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">{col.label}</label>
                    <select className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold" value={formData[col.id]} onChange={e => setFormData({ ...formData, [col.id]: e.target.value })}>
                      {config.manufacturingShops.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                );
              }
              if (col.id === 'carModel') {
                return (
                  <div key={col.id}>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Car Model</label>
                    <div className="flex flex-wrap gap-2">
                      {config.carModels.map(m => (
                        <button type="button" key={m} onClick={() => setFormData({ ...formData, carModel: m })} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${formData.carModel === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-500'}`}>{m}</button>
                      ))}
                    </div>
                  </div>
                );
              }

              if (col.type === 'image') {
                return (
                  <div key={col.id}>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">{col.label}</label>
                    <div className="flex gap-4 items-center">
                       <div className="w-16 h-16 bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0 shadow-inner">
                          {formData[col.id] ? <img src={formData[col.id]} className="w-full h-full object-cover" alt="Preview" /> : <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-300">VOID</div>}
                       </div>
                       <label className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-center uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-colors">
                          SELECT FILE
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, col.id)} />
                       </label>
                    </div>
                  </div>
                );
              }

              return (
                <div key={col.id}>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">{col.label}</label>
                  <input type={col.type === 'number' ? 'number' : 'text'} className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold" value={formData[col.id]} onChange={e => setFormData({ ...formData, [col.id]: col.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value })} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-5">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">AI Description Engine</h4>
              <textarea className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl min-h-[140px] text-sm font-medium" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              <button type="button" disabled={isGenerating} onClick={handleGenerateDescription} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all">
                {isGenerating ? "OPTIMIZING..." : "✨ GENERATE AI DESCRIPTION"}
              </button>
           </div>
           
           <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-5">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Primary Asset Visual</h4>
              <div className="h-48 bg-white rounded-3xl border border-slate-200 overflow-hidden relative group shadow-inner">
                <img src={formData.imageUrl} className="w-full h-full object-cover" alt="Main Part" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <label className="bg-white px-5 py-2 rounded-xl text-[10px] font-black cursor-pointer shadow-xl">
                      UPLOAD PHOTO
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'imageUrl')} />
                   </label>
                </div>
              </div>
              <input className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-mono" placeholder="Direct Image URL..." value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} />
           </div>
        </div>

        <div className="col-span-full pt-10 flex justify-end gap-6">
          <button type="button" onClick={onClose} className="text-sm font-bold text-slate-400">Discard Changes</button>
          <button type="submit" className="bg-slate-900 text-white px-14 py-5 rounded-[24px] font-black shadow-xl hover:scale-105 transition-all text-xs uppercase tracking-widest">
            {initialData ? 'COMMIT UPDATE' : 'REGISTER ASSET'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PartForm;