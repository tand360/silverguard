import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert } from '../types';

interface AlertListProps {
  alerts: Alert[];
  onResolve: (id: string) => void;
}

export const AlertList: React.FC<AlertListProps> = ({ alerts, onResolve }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-red-500 font-mono text-xs uppercase tracking-widest mb-4">Recent Alerts</h3>
      {alerts.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">No Active Alerts</p>
        </div>
      ) : (
        alerts.map((alert) => (
          <div 
            key={alert.id} 
            className={`
              flex items-center justify-between p-4 rounded-xl border-l-4 transition-all duration-300
              ${alert.resolved ? 'bg-zinc-900 border-zinc-800' : 'bg-red-950/20 border-red-600 animate-pulse'}
            `}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${alert.resolved ? 'text-zinc-600' : 'text-red-500'}`}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className={`font-bold ${alert.resolved ? 'text-zinc-500' : 'text-white'}`}>{alert.message}</p>
                <p className="text-zinc-600 text-xs font-mono">
                  {new Date(alert.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            {!alert.resolved && (
              <button
                onClick={() => onResolve(alert.id)}
                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Resolve Alert"
              >
                <CheckCircle2 size={24} />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
};
