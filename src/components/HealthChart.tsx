import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { HealthData } from '../types';

interface HealthChartProps {
  data: HealthData[];
  type: 'heartRate' | 'bloodPressure';
  title: string;
}

export const HealthChart: React.FC<HealthChartProps> = ({ data, type, title }) => {
  return (
    <div className="bg-zinc-900 border border-red-900/30 rounded-2xl p-6 h-[300px]">
      <h3 className="text-red-500 font-mono text-xs uppercase tracking-widest mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
          <XAxis 
            dataKey="timestamp" 
            stroke="#666" 
            fontSize={10}
            tickFormatter={(str) => new Date(str).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          />
          <YAxis stroke="#666" fontSize={10} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #450a0a', borderRadius: '8px' }}
            itemStyle={{ color: '#ef4444' }}
          />
          {type === 'heartRate' ? (
            <Line 
              type="monotone" 
              dataKey="heartRate" 
              stroke="#ef4444" 
              strokeWidth={2} 
              dot={false} 
              animationDuration={1000}
            />
          ) : (
            <>
              <Line 
                type="monotone" 
                dataKey="bloodPressureSystolic" 
                stroke="#ef4444" 
                strokeWidth={2} 
                dot={false} 
              />
              <Line 
                type="monotone" 
                dataKey="bloodPressureDiastolic" 
                stroke="#991b1b" 
                strokeWidth={2} 
                dot={false} 
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
