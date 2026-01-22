
import React, { useState } from 'react';
import { User, AppConfig } from '../types';
import { ICONS } from '../constants';

interface AuthGateProps {
  onAuthenticated: (user: User) => void;
  config: AppConfig;
}

const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated, config }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = config.users.find(u => u.email.toLowerCase().trim() === email.toLowerCase().trim() && u.password === password);
    if (user) onAuthenticated(user);
    else setError("Invalid credentials.");
  };

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-10 lg:p-12">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 mb-6 bg-slate-50 rounded-2xl flex items-center justify-center overflow-hidden">
            {config.logoUrl ? <img src={config.logoUrl} className="max-w-full" /> : <ICONS.Inventory />}
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight text-center">{config.appName}</h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-3">Facility Access Portal</p>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase text-center border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <input required type="email" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input required type="password" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" placeholder="Passkey" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black">Sign In</button>
        </form>
      </div>
    </div>
  );
};

export default AuthGate;
