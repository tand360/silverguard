import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ElderView } from './views/ElderView';
import { CaregiverView } from './views/CaregiverView';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Activity } from 'lucide-react';

const MainContent: React.FC = () => {
  const { user, loading, signIn } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center"
        >
          <Activity className="text-black" size={32} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full space-y-12"
        >
          <div className="space-y-4">
            <div className="w-24 h-24 bg-red-600 rounded-3xl mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(239,68,68,0.2)]">
              <Activity className="text-black" size={48} />
            </div>
            <h1 className="text-5xl font-black tracking-tighter uppercase text-white">SafeGuard</h1>
            <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Silver Economy Health Platform</p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => signIn('elder')}
              className="w-full bg-red-600 text-black py-4 rounded-2xl font-black uppercase tracking-tighter text-xl flex flex-col items-center justify-center hover:bg-red-500 transition-colors"
            >
              <div className="flex items-center gap-3"><LogIn size={24} /> Elder Login</div>
              <span className="text-[10px] font-mono opacity-60">Keksalar uchun panel</span>
            </button>
            <button 
              onClick={() => signIn('caregiver')}
              className="w-full bg-zinc-900 text-red-600 border-2 border-red-600 py-4 rounded-2xl font-black uppercase tracking-tighter text-xl flex flex-col items-center justify-center hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-center gap-3"><Activity size={24} /> Caregiver Login</div>
              <span className="text-[10px] font-mono opacity-60">Qarovchilar uchun panel</span>
            </button>
            <p className="text-zinc-700 text-[10px] uppercase font-bold tracking-widest pt-4">Secure E2E Encryption Enabled</p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-12 border-t border-zinc-900">
            <div className="text-left">
              <p className="text-red-500 font-mono text-[10px] uppercase mb-1">For Elders</p>
              <p className="text-zinc-500 text-xs leading-tight">One-tap SOS and simple reminders.</p>
            </div>
            <div className="text-left">
              <p className="text-red-500 font-mono text-[10px] uppercase mb-1">For Caregivers</p>
              <p className="text-zinc-500 text-xs leading-tight">Real-time biometrics and GPS tracking.</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {user.role === 'elder' ? (
        <motion.div 
          key="elder"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <ElderView />
        </motion.div>
      ) : (
        <motion.div 
          key="caregiver"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <CaregiverView />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
