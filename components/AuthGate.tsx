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
  const [showPassword, setShowPassword] = useState(false);
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
    setEmail(''); 
    setPassword('');
    setError("Administrator secure portal activated. Please enter master credentials.");
  };

  // Fix: Removed stray text 'verification failed;' which was causing syntax errors.
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
      alert("Vector Alignment Error. Please align the signal pulse.");
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
                 <div className="text-slate-900">
                   <ICONS.Inventory />
                 </div>
               )}
            </div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight text-center leading-none">{config.appName}</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-3 text-center">Cloud Mesh Terminal</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase text-center border border-white/10 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              {error}
            </div>
          )}

          {mode !== 'CHALLENGE' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Identity Identifier</label>
                <input required type="email" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 ring-blue-50 transition-all font-bold" placeholder="email@domain.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2 relative">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Secure Passkey</label>
                <input required type={showPassword ? "text" : "password"} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 ring-blue-50 transition-all font-bold" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 bottom-4 text-slate-400 hover:text-slate-600">
                   {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all active:scale-95">
                  INITIALIZE SESSION
                </button>
                <button type="button" onClick={switchToAdminMode} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:bg-black transition-all">
                  ADMIN ACCESS PORTAL
                </button>
              </div>

              <div className="pt-6 border-t border-slate-100 text-center">
                <button type="button" onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">
                  {mode === 'LOGIN' ? "New Personnel Enrollment" : "Return to Login"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-8 text-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase">Vector Sync</h3>
                <p className="text-slate-500 text-xs mt-2 font-medium">Align the pulse to verify biometric integrity.</p>
              </div>
              <div className="relative h-24 bg-slate-50 rounded-2xl border border-slate-200 flex items-center px-6 overflow-hidden">
                 <div className="flex-1 relative h-2 bg-slate-200 rounded-full">
                    <div className="absolute h-6 w-6 bg-blue-500 rounded-full top-1/2 -translate-y-1/2 shadow-lg" style={{ left: `${challengeTarget}%` }}></div>
                    <div className="absolute h-8 w-2 bg-slate-900 rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2 z-10" style={{ left: `${challengeValue}%` }}></div>
                 </div>
              </div>
              <input type="range" min="0" max="100" value={challengeValue} onChange={e => setChallengeValue(parseInt(e.target.value))} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-slate-900" />
              <button onClick={verifyHuman} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-blue-700">AUTHORIZE MESH ACCESS</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthGate;