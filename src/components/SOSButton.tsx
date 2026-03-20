import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle } from 'lucide-react';

interface SOSButtonProps {
  onPress: () => void;
  isSending: boolean;
  countdown: number | null;
}

export const SOSButton: React.FC<SOSButtonProps> = ({ onPress, isSending, countdown }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onPress}
        disabled={isSending}
        className={`
          w-64 h-64 rounded-full flex flex-col items-center justify-center
          shadow-[0_0_50px_rgba(239,68,68,0.3)]
          border-8 border-red-600 bg-black text-red-600
          transition-colors duration-300
          ${isSending ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600 hover:text-black'}
          ${countdown !== null ? 'bg-red-600 text-black' : ''}
        `}
      >
        {countdown !== null ? (
          <span className="text-8xl font-black">{countdown}</span>
        ) : (
          <>
            <AlertCircle size={80} className="mb-4" />
            <span className="text-5xl font-black tracking-tighter uppercase">SOS</span>
          </>
        )}
      </motion.button>
      <p className="mt-8 text-red-500 font-mono text-sm tracking-widest uppercase text-center">
        {isSending ? 'Sending Alert...' : countdown !== null ? 'Tap to Cancel' : 'Press for Emergency Assistance'}
      </p>
    </div>
  );
};
