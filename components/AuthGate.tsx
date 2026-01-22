
import React, { useState, useEffect } from 'react';
import { User, AppConfig } from '../types';
import { storageService } from '../services/storageService';
import { ICONS } from '../constants';

interface AuthGateProps {
  onAuthenticated: (user: User) => void;
  config: AppConfig;
}

const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated, config }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const user = config.users.find(u => 
      u.email.toLowerCase().trim() === email.toLowerCase().trim() && 
      u.password === password
    );

    if (user) {
      onAuthenticated(user);
    } else {
      setError("Authorization denied. Invalid personnel credentials or locked account.");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
         <div className="h-full w-full" style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden relative border border-white/20">
        <div className="p-10 lg:p-12">
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 mb-6 flex items-center justify-center border border-slate-100 bg-white rounded-2xl overflow-hidden shrink-0">
               {config.logoUrl ? (
                 <img src={config.logoUrl} className="max-w-full max-h-full object-contain" alt="Logo" />
               ) : (
                 <div className="text-slate-900"><ICONS.Inventory /></div>
               )}
            </div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight text-center leading-none">{config.appName}</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-3 text-center">Managed Access Terminal</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase text-center border border-red-100 flex items-center justify-center gap-2 animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Identity identifier (Email)</label>
              <input required type="email" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 ring-blue-50 transition-all font-bold" placeholder="email@domain.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2 relative">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Secure Passkey</label>
              <input required type={showPassword ? "text" : "password"} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 ring-blue-50 transition-all font-bold" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 bottom-4 text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase">
                 {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95 mt-4">
              Authorize Session
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100">
             <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-widest">Enrollment is restricted to facility administrators. Please contact your supervisor for access credentials.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthGate;
