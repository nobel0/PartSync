import React, { useState, useEffect } from 'react';
import { User, AppConfig } from '../types';
import { storageService } from '../services/storageService';
import { ICONS } from '../constants';

interface AuthGateProps {
  onAuthenticated: (user: User) => void;
  config: AppConfig;
}

const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated, config }) => {
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP' | 'CHALLENGE'>('LOGIN');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [assignedLine, setAssignedLine] = useState(config.manufacturingShops[0] || 'ALL');
  const [challengeTarget, setChallengeTarget] = useState(0);
  const [challengeValue, setChallengeValue] = useState(50);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'CHALLENGE') setChallengeTarget(Math.floor(Math.random() * 80) + 10);
    setError(null);
  }, [mode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const adminEmail = config.adminEmail || 'abdalhady.joharji@gmail.com';
    const adminPass = config.adminPassword || 'admin';

    if (mode === 'LOGIN') {
      // Check for Admin Credentials
      if (email.toLowerCase().trim() === adminEmail.toLowerCase().trim() && password === adminPass) {
        onAuthenticated({ 
          id: 'admin_01', 
          username: 'System Admin', 
          email: adminEmail, 
          role: 'ADMIN', 
          assignedLine: 'ALL' 
        });
        return;
      }
      
      // Check for Test Engineer
      if (email === 'engineer@test.com' && password === 'pass123') {
        onAuthenticated({ 
          id: 'eng_01', 
          username: 'Test Engineer', 
          email: 'engineer@test.com', 
          role: 'ENGINEER', 
          assignedLine: config.manufacturingShops[0] || 'ALL'
        });
        return;
      }

      // Generic login logic
      onAuthenticated({ 
        id: Math.random().toString(36).substr(2, 9), 
        username: email.split('@')[0], 
        email, 
        role: 'ENGINEER', 
        assignedLine: config.manufacturingShops[0] || 'ALL'
      });
    } else {
      setMode('CHALLENGE');
    }
  };

  const switchToAdminMode = () => {
    setMode('LOGIN');
    setError("Administrator mode activated. Enter secure credentials.");
  };

  const verifyHuman = () => {
    if (Math.abs(challengeValue - challengeTarget) < 5) {
      onAuthenticated({ 
        id: Math.random().toString(36).substr(2, 9), 
        username: username || email.split('@')[0], 
        email, 
        role: 'ENGINEER', 
        assignedLine 
      });
    } else {
      alert("Vector Alignment Error. Please align the sync pulse precisely.");
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
            <div className="w-20 h-20 bg-slate-900 rounded-3xl shadow-xl mb-6 flex items-center justify-center overflow-hidden">
               {config.logoUrl ? <img src={config.logoUrl} className="max-w-[70%] max-h-[70%] object-contain" alt="Logo" /> : <ICONS.Inventory />}
            </div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight text-center leading-none">{config.appName}</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-3 text-center">Engineering Authentication</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase text-center border border-blue-100">
              {error}
            </div>
          )}

          {mode !== 'CHALLENGE' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Identity Identifier (Email)</label>
                <input required type="email" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 ring-blue-50 transition-all font-bold" placeholder="engineer@domain.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Secure Passkey</label>
                <input required type="password" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 ring-blue-50 transition-all font-bold" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
              </div>

              {mode === 'SIGNUP' && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Official Name</label>
                    <input required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 ring-blue-50 transition-all font-bold" placeholder="e.g. John Doe" value={username} onChange={e => setUsername(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Shop/Line Assignment</label>
                    <select className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 ring-blue-50 transition-all font-bold text-slate-700" value={assignedLine} onChange={e => setAssignedLine(e.target.value)}>
                      {config.manufacturingShops.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-4">
                <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all active:scale-95">
                  {mode === 'LOGIN' ? 'AUTHENTICATE SYSTEM' : 'INITIALIZE REGISTRATION'}
                </button>
                
                <button type="button" onClick={switchToAdminMode} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:bg-black transition-all">
                  ADMIN ACCESS PORTAL
                </button>
              </div>

              <div className="pt-6 border-t border-slate-100 text-center">
                <button type="button" onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">
                  {mode === 'LOGIN' ? "New Personnel Registration" : "Return to Login"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-8 text-center">
              <div>
                <h3 className="text-xl font-black text-slate-900">Vector Synchronization</h3>
                <p className="text-slate-500 text-xs mt-2 font-medium">Verify your human identity by aligning the sync pulse.</p>
              </div>

              <div className="relative h-24 bg-slate-50 rounded-2xl border border-slate-200 flex items-center px-6 overflow-hidden">
                 <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #000 0, #000 1px, transparent 1px, transparent 10px)' }}></div>
                 <div className="flex-1 relative h-2 bg-slate-200 rounded-full">
                    <div className="absolute h-6 w-6 bg-blue-500 rounded-full top-1/2 -translate-y-1/2 shadow-lg" style={{ left: `${challengeTarget}%` }}></div>
                    <div className="absolute h-8 w-2 bg-slate-900 rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2 z-10" style={{ left: `${challengeValue}%` }}></div>
                 </div>
              </div>

              <input type="range" min="0" max="100" value={challengeValue} onChange={e => setChallengeValue(parseInt(e.target.value))} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-slate-900" />

              <div className="flex flex-col gap-3">
                 <button onClick={verifyHuman} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-blue-700">AUTHORIZE MESH ACCESS</button>
                 <button onClick={() => setMode('SIGNUP')} className="py-2 text-slate-400 font-bold text-xs uppercase">Reset Challenge</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthGate;