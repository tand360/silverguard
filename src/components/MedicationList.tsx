import React from 'react';
import { CheckCircle, Clock, Volume2 } from 'lucide-react';
import { Medication } from '../types';

interface MedicationListProps {
  medications: Medication[];
  onTake: (id: string) => void;
  onListen?: (med: Medication) => void;
}

export const MedicationList: React.FC<MedicationListProps> = ({ medications, onTake, onListen }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-red-500 font-mono text-xs uppercase tracking-widest mb-4">Medication Reminders</h3>
      {medications.map((med) => (
        <div 
          key={med.id} 
          className={`
            flex items-center justify-between p-6 rounded-2xl border-2 transition-all duration-300
            ${med.taken ? 'bg-zinc-900 border-zinc-800 opacity-50' : 'bg-black border-red-600 shadow-[0_0_20px_rgba(239,68,68,0.1)]'}
          `}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${med.taken ? 'bg-zinc-800 text-zinc-600' : 'bg-red-600 text-black'}`}>
              <Clock size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{med.name}</p>
              <p className="text-zinc-500 font-mono">{med.dosage} • {med.time}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!med.taken && onListen && (
              <button
                onClick={() => onListen(med)}
                className="p-3 bg-zinc-800 text-zinc-400 rounded-xl hover:bg-zinc-700 hover:text-white transition-colors"
                title="Listen to reminder"
              >
                <Volume2 size={24} />
              </button>
            )}
            <button
              onClick={() => onTake(med.id)}
              disabled={med.taken}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-tighter
                ${med.taken ? 'text-zinc-600 cursor-not-allowed' : 'bg-red-600 text-black hover:bg-red-500'}
              `}
            >
              <CheckCircle size={20} />
              {med.taken ? 'Taken' : 'Take Now'}
            </button>
          </div>
        </div>
      ))}
      {medications.length === 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 border-dashed p-12 rounded-3xl text-center">
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">Hali dori-darmonlar belgilanmagan</p>
        </div>
      )}
    </div>
  );
};
