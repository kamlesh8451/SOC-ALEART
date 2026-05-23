import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Server, Globe, FileText, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Node {
  id: string;
  label: string;
  type: 'incident' | 'host' | 'ip' | 'domain';
  x: number;
  y: number;
}

interface Edge {
  from: string;
  to: string;
}

export function VisualLinkAnalysis({ incident, relatedIncidents }: { incident: any, relatedIncidents: any[] }) {
  // Simple layout logic for the graph
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Central Incident Node
  const centerX = 400;
  const centerY = 300;
  nodes.push({ id: 'main', label: incident.ticketNumber, type: 'incident', x: centerX, y: centerY });

  // Host Node
  nodes.push({ id: 'host', label: incident.host, type: 'host', x: centerX - 150, y: centerY - 100 });
  edges.push({ from: 'main', to: 'host' });

  // Domain Node (if exists)
  if (incident.domain) {
    nodes.push({ id: 'domain', label: incident.domain, type: 'domain', x: centerX + 150, y: centerY - 100 });
    edges.push({ from: 'main', to: 'domain' });
  }

  // IP Nodes from Metadata
  const ips = incident.metadata?.threatIntel?.indicators?.filter((i: any) => i.type === 'ip') || [];
  ips.slice(0, 3).forEach((ip: any, idx: number) => {
    const id = `ip-${idx}`;
    nodes.push({ id, label: ip.value, type: 'ip', x: centerX - 100 + (idx * 100), y: centerY + 150 });
    edges.push({ from: 'main', to: id });
  });

  // Related Incident Nodes
  relatedIncidents.slice(0, 3).forEach((rel: any, idx: number) => {
    const id = `rel-${idx}`;
    nodes.push({ id, label: rel.ticketNumber, type: 'incident', x: centerX + 250, y: centerY + (idx * 60) - 60 });
    edges.push({ from: 'host', to: id });
  });

  return (
    <div className="relative w-full h-[500px] bg-secondary/20 rounded-xl border border-border overflow-hidden group">
      <div className="absolute top-4 left-4 z-10">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
          <Activity className="w-3 h-3" />
          Neural Link Analysis
        </h3>
        <p className="text-[8px] text-muted-foreground uppercase mt-1">Correlation Mapping & Asset Relationships</p>
      </div>

      <svg className="w-full h-full">
        {/* Draw Edges */}
        {edges.map((edge, idx) => {
          const from = nodes.find(n => n.id === edge.from)!;
          const to = nodes.find(n => n.id === edge.to)!;
          return (
            <motion.line
              key={idx}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="currentColor"
              className="text-primary/20"
              strokeWidth="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, delay: idx * 0.2 }}
            />
          );
        })}

        {/* Draw Nodes */}
        {nodes.map((node) => (
          <g key={node.id}>
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={node.type === 'incident' ? 25 : 20}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.5 }}
              className={cn(
                "fill-card stroke-2",
                node.type === 'incident' ? "stroke-primary" : 
                node.type === 'host' ? "stroke-cyan-500" :
                node.type === 'ip' ? "stroke-red-500" : "stroke-purple-500"
              )}
            />
            <foreignObject x={node.x - 40} y={node.y - 40} width={80} height={80} className="pointer-events-none">
              <div className="w-full h-full flex flex-col items-center justify-center">
                {node.type === 'incident' && <Shield className="w-4 h-4 text-primary mb-1" />}
                {node.type === 'host' && <Server className="w-4 h-4 text-cyan-500 mb-1" />}
                {node.type === 'ip' && <Globe className="w-4 h-4 text-red-500 mb-1" />}
                {node.type === 'domain' && <FileText className="w-4 h-4 text-purple-500 mb-1" />}
                <span className="text-[7px] font-bold uppercase text-foreground/80 text-center px-1 truncate w-full">
                  {node.label}
                </span>
              </div>
            </foreignObject>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-[7px] font-bold uppercase text-muted-foreground">Incident</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500" />
          <span className="text-[7px] font-bold uppercase text-muted-foreground">Host</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[7px] font-bold uppercase text-muted-foreground">Threat IP</span>
        </div>
      </div>
    </div>
  );
}
