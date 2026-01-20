import React, { useMemo, useState } from 'react';
import { Part, Notification, AppConfig, User } from '../types';
import { ICONS, LOW_STOCK_THRESHOLD } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface DashboardProps {
  parts: Part[];
  notifications: Notification[];
  config: AppConfig;
  onViewInventory: () => void;
  onUpdateLabel?: (key: string, val: string) => void;
  currentUser?: User | null;
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
      <span className="opacity-0 group-hover:opacity-100 text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></span>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ parts, notifications, config, onViewInventory, onUpdateLabel, currentUser }) => {
  const lowStockParts = parts.filter(p => p.currentStock <= LOW_STOCK_THRESHOLD);
  const totalStock = parts.reduce((acc, p) => acc + p.currentStock, 0);
  
  const modelStats = useMemo(() => {
    const statsMap: Record<string, number> = {};
    parts.forEach(p => {
      if (p.carModel) {
        statsMap[p.carModel] = (statsMap[p.carModel] || 0) + 1;
      }
    });
    return Object.entries(statsMap).map(([name, value]) => ({ name, value }));
  }, [parts]);

  const stockChartData = useMemo(() => 
    parts.slice(0, 8).map(p => ({
      name: p.partNumber,
      fullName: p.name,
      stock: p.currentStock,
      target: p.targetStock,
    })), [parts]
  );

  const COLORS = ['#2563eb', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];

  return (
    <div className="space-y-6 lg:space-y-8 pb-12">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        <StatCard label="Registry" value={parts.length.toString()} icon={<ICONS.Inventory />} trend="Unique IDs" color="blue" />
        <StatCard label="Critical" value={lowStockParts.length.toString()} icon={<ICONS.Alerts />} trend="Low Stock" color={lowStockParts.length > 0 ? "red" : "green"} />
        <StatCard label="Total Vol" value={totalStock.toLocaleString()} icon={<ICONS.Dashboard />} trend="Stock Units" color="indigo" />
        <StatCard label="Activity" value={notifications.length.toString()} icon={<ICONS.Suppliers />} trend="Logged events" color="cyan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Inventory Levels Bar Chart */}
        <div className="lg:col-span-2 bg-white p-6 lg:p-8 rounded-[24px] lg:rounded-[32px] border border-slate-200 shadow-sm min-w-0">
          <div className="flex items-center justify-between mb-6 lg:mb-8">
            <div>
              <EditableLabel 
                text={config.labels.dashboardHeadline || ''} 
                onSave={(v) => onUpdateLabel?.('dashboardHeadline', v)} 
                className="text-lg lg:text-xl font-black text-slate-900" 
                currentUser={currentUser}
                adminOnly
              />
              <EditableLabel 
                text={config.labels.dashboardSubline || ''} 
                onSave={(v) => onUpdateLabel?.('dashboardSubline', v)} 
                className="text-[10px] lg:text-sm text-slate-500 uppercase font-bold tracking-widest" 
                currentUser={currentUser}
                adminOnly
              />
            </div>
            <button onClick={onViewInventory} className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-600 text-[10px] font-bold transition-all border border-slate-200">Manage</button>
          </div>
          <div className="h-64 lg:h-80 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={stockChartData} margin={{ top: 10, right: 0, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 9, fontWeight: 700}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '8px', fontSize: '10px' }} />
                <Bar dataKey="stock" radius={[4, 4, 0, 0]} fill="#2563eb" name="In Stock" barSize={24} />
                <Bar dataKey="target" radius={[4, 4, 0, 0]} fill="#e2e8f0" name="Target" barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fleet Distribution Pie Chart */}
        <div className="bg-white p-6 lg:p-8 rounded-[24px] lg:rounded-[32px] border border-slate-200 shadow-sm flex flex-col min-w-0">
          <div className="mb-6 lg:mb-8">
            <h3 className="text-lg lg:text-xl font-black text-slate-900">Fleet Allocation</h3>
            <p className="text-[10px] lg:text-sm text-slate-500 uppercase font-bold tracking-widest">Model Distribution</p>
          </div>
          <div className="flex-1 h-48 lg:h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie data={modelStats.length > 0 ? modelStats : [{name: 'Empty', value: 1}]} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={8} dataKey="value">
                  {modelStats.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                  {modelStats.length === 0 && <Cell fill="#f1f5f9" />}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 lg:mt-8 space-y-2">
            {modelStats.slice(0, 3).map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}}></div>
                  <span className="text-[10px] font-bold text-slate-600 truncate max-w-[80px]">{item.name}</span>
                </div>
                <span className="text-[10px] font-black text-slate-900">{item.value}</span>
              </div>
            ))}
            {modelStats.length === 0 && <p className="text-center text-[10px] text-slate-400 font-bold uppercase py-2">No Active Models</p>}
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-white p-6 lg:p-8 rounded-[24px] lg:rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg lg:text-xl font-black text-slate-900">Security & Operational Log</h3>
            <p className="text-[10px] lg:text-sm text-slate-500 uppercase font-bold tracking-widest">Real-time Facility Events</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
          {notifications.slice(0, 4).map(notif => (
            <div key={notif.id} className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className={`p-2 rounded-lg shrink-0 ${notif.type === 'WARNING' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                {notif.type === 'WARNING' ? <ICONS.Alerts /> : <ICONS.Suppliers />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 line-clamp-1">{notif.message}</p>
                <div className="flex items-center gap-2 mt-1">
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode; trend: string; color: string }> = ({ label, value, icon, trend, color }) => {
  const colorMap: Record<string, string> = { blue: 'text-blue-600 bg-blue-50', red: 'text-red-600 bg-red-50', indigo: 'text-indigo-600 bg-indigo-50', cyan: 'text-cyan-600 bg-cyan-50', green: 'text-emerald-600 bg-emerald-50' };
  return (
    <div className="bg-white p-5 lg:p-8 rounded-[20px] lg:rounded-[32px] border border-slate-200 shadow-sm active:scale-95 transition-all">
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <div className={`p-2 lg:p-4 rounded-lg lg:rounded-2xl ${colorMap[color]}`}>{icon}</div>
        <span className="hidden lg:inline text-[9px] font-black px-2 py-1 bg-slate-50 text-slate-400 rounded-full uppercase">{trend}</span>
      </div>
      <div>
        <h4 className="text-[8px] lg:text-xs text-slate-400 font-bold uppercase tracking-widest">{label}</h4>
        <p className="text-xl lg:text-4xl font-black text-slate-900 mt-1">{value}</p>
      </div>
    </div>
  );
};

export default Dashboard;