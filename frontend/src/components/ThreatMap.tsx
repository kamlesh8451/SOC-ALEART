import React from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertCircle, Zap, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThreatMap() {
  const [activePing, setActivePing] = React.useState<number | null>(null);

  // Simulated nodes for the threat map
  const nodes = [
    { id: 1, x: 20, y: 30, label: 'APAC-GATE-01', status: 'online', threat: 'none' },
    { id: 2, x: 50, y: 20, label: 'EU-CORE-02', status: 'warning', threat: 'medium' },
    { id: 3, x: 80, y: 40, label: 'US-EAST-04', status: 'alert', threat: 'critical' },
    { id: 4, x: 40, y: 60, label: 'LATAM-EDGE-01', status: 'online', threat: 'none' },
    { id: 5, x: 70, y: 70, label: 'AFRICA-NODE-09', status: 'online', threat: 'low' },
    { id: 6, x: 15, y: 80, label: 'VPN-EXIT-JP', status: 'warning', threat: 'high' },
  ];

  React.useEffect(() => {
    const interval = setInterval(() => {
      setActivePing(Math.floor(Math.random() * nodes.length) + 1);
      setTimeout(() => setActivePing(null), 1000);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-[400px] bg-card/30 rounded-xl border border-border overflow-hidden group shadow-[inset_0_0_50px_rgba(6,182,212,0.05)]">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
      
      {/* Radar Scan Effect */}
      <motion.div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-primary/5 to-transparent rounded-full origin-center"
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      {/* SVG Connections */}
      <svg className="absolute inset-0 w-full h-full opacity-20">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {nodes.map((node, i) => (
          nodes.slice(i + 1).map((target) => (
            <line 
              key={`${node.id}-${target.id}`}
              x1={`${node.x}%`} y1={`${node.y}%`}
              x2={`${target.x}%`} y2={`${target.y}%`}
              stroke="var(--primary)"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
          ))
        ))}
      </svg>

      {/* Nodes */}
      {nodes.map((node) => (
        <motion.div
          key={node.id}
          className="absolute flex flex-col items-center gap-2 -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          whileHover={{ scale: 1.2 }}
        >
          <div className="relative">
            {(node.threat !== 'none' || activePing === node.id) && (
              <motion.div 
                className={cn(
                  "absolute -inset-4 rounded-full blur-md opacity-50",
                  node.threat === 'critical' ? 'bg-red-500' : 
                  activePing === node.id ? 'bg-cyan-400' : 'bg-orange-500'
                )}
                animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <div className={cn(
              "w-4 h-4 rounded-sm border rotate-45 flex items-center justify-center transition-colors duration-500",
              node.threat === 'critical' ? 'bg-red-500 border-red-400' : 
              node.threat === 'high' ? 'bg-orange-600 border-orange-400' :
              activePing === node.id ? 'bg-cyan-500 border-cyan-300' : 'bg-secondary border-border'
            )}>
              <div className="w-1 h-1 bg-white rounded-full shadow-[0_0_5px_white]" />
            </div>
          </div>
          
          <div className="bg-black/90 backdrop-blur-md border border-cyan-500/20 px-2 py-1 rounded text-[8px] font-mono text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl">
            {node.label} [{node.status.toUpperCase()}]
          </div>
        </motion.div>
      ))}

      {/* Legend / Overlay */}
      <div className="absolute bottom-4 left-4 p-3 bg-black/60 backdrop-blur-md border border-border rounded-lg flex flex-col gap-2">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
           <span className="text-[10px] font-bold uppercase text-white">Active Breach</span>
        </div>
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 bg-orange-500 rounded-full" />
           <span className="text-[10px] font-bold uppercase text-muted-foreground">Unauthorized Access</span>
        </div>
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-4">
         <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono text-primary font-bold">GRID_STATUS: NOMINAL</span>
            <span className="text-[8px] font-mono text-muted-foreground uppercase">Scanning 42 Nodes...</span>
         </div>
         <Globe className="w-8 h-8 text-primary opacity-50" />
      </div>
    </div>
  );
}
