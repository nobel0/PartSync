
import React from 'react';
import { Notification } from '../types';
import { ICONS } from '../constants';

interface AlertsProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
}

const Alerts: React.FC<AlertsProps> = ({ notifications, onMarkRead }) => {
  const unread = notifications.filter(n => !n.read);
  const read = notifications.filter(n => n.read);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ICONS.Alerts /> Critical Low Stock Warnings
          </h3>
          <span className="text-xs font-bold bg-red-100 text-red-600 px-3 py-1 rounded-full">
            {unread.length} New Alerts
          </span>
        </div>
        
        <div className="divide-y divide-slate-100">
          {unread.length === 0 ? (
             <div className="p-12 text-center">
                <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h4 className="text-slate-800 font-bold">All clear!</h4>
                <p className="text-slate-500 text-sm">No unread stock alerts at the moment.</p>
             </div>
          ) : (
            unread.map(notif => (
              <div key={notif.id} className="p-6 hover:bg-slate-50 transition-colors flex items-start gap-4">
                <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                  <ICONS.Alerts />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800">{notif.partName}</h4>
                    <span className="text-xs text-slate-400">{new Date(notif.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-600 mt-1">{notif.message}</p>
                  <button 
                    onClick={() => onMarkRead(notif.id)}
                    className="mt-3 text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Acknowledge & Clear
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {read.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden opacity-60">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">History</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {read.map(notif => (
              <div key={notif.id} className="p-4 flex items-start gap-4 text-sm">
                <div className="p-2 bg-slate-100 text-slate-400 rounded-lg">
                  <ICONS.Alerts />
                </div>
                <div className="flex-1">
                  <p className="text-slate-700">Stock alert for <span className="font-bold">{notif.partName}</span> acknowledged.</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(notif.timestamp).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Alerts;
