import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertCircle, Zap, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Incident } from '@/types';

// Deterministic pseudo-random number generator for stable node placement
const seededRandom = (seedStr: string) => {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  return () => {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
};

export function ThreatMap({ incidents = [], onSelectIncident }: { incidents?: Incident[], onSelectIncident?: (id: string) => void }) {
  const [activePing, setActivePing] = React.useState<string | null>(null);

  const nodes = useMemo(() => {
    if (incidents.length === 0) {
      // Fallback/idle nodes if no active incidents
      return [
        { id: '1', x: 20, y: 30, label: 'APAC-GATE-01', status: 'online', threat: 'none' },
        { id: '2', x: 50, y: 20, label: 'EU-CORE-02', status: 'online', threat: 'none' },
        { id: '3', x: 80, y: 40, label: 'US-EAST-04', status: 'online', threat: 'none' },
        { id: '4', x: 40, y: 60, label: 'LATAM-EDGE-01', status: 'online', threat: 'none' },
      ];
    }

    return incidents.map(inc => {
      const rand = seededRandom(inc.id)();
      const x = 10 + (rand % 80); // 10% to 90%
      const y = 10 + ((rand / 100) % 80); // 10% to 90%
      
      return {
        id: inc.id,
        x,
        y,
        label: inc.host || inc.ticketNumber,
        status: inc.status,
        threat: inc.severity,
        incident: inc
      };
    });
  }, [incidents]);

  React.useEffect(() => {
    if (nodes.length === 0) return;
    const interval = setInterval(() => {
      const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
      setActivePing(randomNode.id);
      setTimeout(() => setActivePing(null), 1000);
    }, 3000);
    return () => clearInterval(interval);
  }, [nodes]);

  return (
    <div className="relative w-full h-[400px] bg-secondary/10 rounded-xl border border-border overflow-hidden group shadow-inner">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-[0.05]" 
           style={{ backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
      
      {/* Radar Scan Effect */}
      <motion.div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-primary/5 to-transparent rounded-full origin-center"
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      {/* SVG Connections */}
      <svg className="absolute inset-0 w-full h-full opacity-20">
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
          onClick={() => { if (onSelectIncident && node.incident) onSelectIncident(node.id); }}
        >
          <div className="relative">
            {(node.threat !== 'none' || activePing === node.id) && (
              <motion.div 
                className={cn(
                  "absolute -inset-4 rounded-full blur-md opacity-50",
                  node.threat === 'critical' ? 'bg-error' : 
                  activePing === node.id ? 'bg-primary' : 'bg-warning'
                )}
                animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <div className={cn(
              "w-4 h-4 rounded-sm border rotate-45 flex items-center justify-center transition-all duration-500 shadow-sm",
              node.threat === 'critical' ? 'bg-error border-error shadow-[0_0_10px_rgba(var(--color-error),0.8)]' : 
              node.threat === 'high' ? 'bg-warning border-warning shadow-[0_0_10px_rgba(var(--color-warning),0.8)]' :
              activePing === node.id ? 'bg-primary border-primary shadow-[0_0_10px_var(--primary-glow)]' : 'bg-secondary border-border'
            )}>
              <div className="w-1 h-1 bg-white rounded-full shadow-[0_0_5px_white]" />
            </div>
          </div>
          
          <div className="bg-card/90 backdrop-blur-md border border-border px-2 py-1 rounded text-[8px] font-mono text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl">
            {node.label} [{node.status.toUpperCase()}]
            {node.incident && <div className="text-muted-foreground text-[6px] mt-0.5">Click for tactical intel</div>}
          </div>
        </motion.div>
      ))}

      {/* Legend / Overlay */}
      <div className="absolute bottom-4 left-4 p-3 bg-card/60 backdrop-blur-md border border-border rounded-lg flex flex-col gap-2 shadow-lg">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground/70">
           <div className="w-2 h-2 bg-error rounded-full animate-pulse shadow-[0_0_5px_var(--color-error)]" />
           Critical
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground/70">
           <div className="w-2 h-2 bg-warning rounded-full shadow-[0_0_5px_var(--color-warning)]" />
           High Risk
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground/70 opacity-50">
           <div className="w-2 h-2 bg-secondary border border-border rounded-full" />
           Nominal
        </div>
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-4 bg-card/40 backdrop-blur-sm p-3 rounded-xl border border-border shadow-sm">
         <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono text-primary font-black uppercase tracking-tighter">GRID_STATUS: {incidents.length > 0 ? 'ACTIVE_THREATS' : 'NOMINAL'}</span>
            <span className="text-[8px] font-mono text-muted-foreground uppercase opacity-60 font-bold tracking-widest">Tracking {nodes.length} Nodes</span>
         </div>
         <Globe className="w-8 h-8 text-primary opacity-40" />
      </div>
    </div>
  );
}
