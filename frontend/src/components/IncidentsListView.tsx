import React, { useState, useEffect } from 'react';
import { incidentService } from '../services/incidentService';
import { Incident } from '../types';
import { 
  Ticket, Search, Filter, ArrowUpDown, 
  MoreHorizontal, Eye, Edit2, Trash2,
  AlertTriangle, Clock, CheckCircle, Shield, ChevronLeft
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CreateIncidentDialog } from './CreateIncidentDialog';
import { IncidentDetailView } from './IncidentDetailView';

export const IncidentsListView: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'investigating'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = incidentService.subscribeToIncidents((data) => {
      setIncidents(data);
      setLoading(false);
    }, (err) => {
      toast.error("Telemetry failed: Cannot sync incident stream");
      setLoading(false);
    });
    return unsub;
  }, []);

  if (selectedIncidentId) {
    const incident = incidents.find(i => i.id === selectedIncidentId);
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          onClick={() => setSelectedIncidentId(null)}
          className="text-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/10 gap-2 uppercase font-bold text-[10px]"
        >
          <ChevronLeft size={14} /> Back to Registry
        </Button>
        {incident ? (
          <IncidentDetailView 
            incident={incident} 
            onBack={() => setSelectedIncidentId(null)} 
            onSelectIncident={(inc) => setSelectedIncidentId(inc.id)}
          />
        ) : (
          <div className="p-20 text-center text-cyan-500/20 font-mono uppercase">Ticket not found in active memory</div>
        )}
      </div>
    );
  }

  const filteredIncidents = incidents.filter(inc => {
    const matchesSearch = inc.ticketNumber.toLowerCase().includes(search.toLowerCase()) || 
                          inc.alertName.toLowerCase().includes(search.toLowerCase()) ||
                          inc.host.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || inc.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/40" />
              <Input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="SEARCH REGISTRY..." 
                className="bg-cyan-500/5 border-cyan-500/10 pl-10 h-11 text-xs uppercase tracking-widest w-[300px] text-white"
              />
           </div>
           <div className="flex bg-secondary p-1 rounded-md border border-border">
              {(['all', 'open', 'investigating', 'closed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-bold uppercase tracking-tighter rounded transition-all",
                    filter === f ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f}
                </button>
              ))}
           </div>
        </div>
        <Button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase tracking-widest text-[10px] h-11 px-6 shadow-lg shadow-cyan-600/20"
        >
          <Ticket className="w-4 h-4 mr-2" />
          Manually Inject Incident
        </Button>
      </div>

      <Card className="bg-black/40 border-cyan-500/10 backdrop-blur-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto text-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cyan-500/10 text-[10px] uppercase text-cyan-500/50 font-bold tracking-widest">
                  <th className="p-5 font-bold">Ticket ID</th>
                  <th className="p-5 font-bold">Incident Core</th>
                  <th className="p-5 font-bold">Severity</th>
                  <th className="p-5 font-bold">Host/Node</th>
                  <th className="p-5 font-bold">Detection</th>
                  <th className="p-5 font-bold">SLA status</th>
                  <th className="p-5 font-bold">Protocol</th>
                  <th className="p-5"></th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse border-b border-cyan-500/5">
                      <td colSpan={8} className="p-5 h-16 bg-cyan-500/5" />
                    </tr>
                  ))
                ) : filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-20 text-center">
                       <Shield className="w-12 h-12 text-cyan-500/10 mx-auto mb-4" />
                       <p className="text-cyan-500/40 font-mono text-xs uppercase tracking-widest">No matching records found in secure registry</p>
                    </td>
                  </tr>
                ) : filteredIncidents.map((inc) => (
                  <IncidentRow key={inc.id} inc={inc} onView={() => setSelectedIncidentId(inc.id)} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <CreateIncidentDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
};

const IncidentRow = ({ inc, onView }: { inc: Incident, onView: () => void }) => {
  const isBreached = Date.now() > inc.slaDeadline && inc.status !== 'closed';

  return (
    <tr 
      onClick={onView}
      className="border-b border-cyan-500/5 hover:bg-cyan-500/5 transition-colors group cursor-pointer"
    >
      <td className="p-5 font-mono text-[10px] text-cyan-500 font-bold tracking-tighter">{inc.ticketNumber}</td>
      <td className="p-5">
        <div className="flex flex-col">
          <span className="font-bold text-white/90 truncate max-w-[250px] uppercase">{inc.alertName}</span>
          <span className="text-[9px] text-cyan-500/30 font-mono">{inc.id.slice(0, 8)}</span>
        </div>
      </td>
      <td className="p-5">
        <Badge className={cn(
          "text-[9px] uppercase font-black px-2 py-0.5 rounded-full border-none",
          inc.severity === 'critical' ? 'bg-red-500/10 text-red-500' : 
          inc.severity === 'high' ? 'bg-orange-500/10 text-orange-500' : 
          'bg-yellow-500/10 text-yellow-500'
        )}>
          {inc.severity}
        </Badge>
      </td>
      <td className="p-5">
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/30" />
           <span className="font-mono text-[10px] text-white/60 lowercase">{inc.host}</span>
        </div>
      </td>
      <td className="p-5 text-white/40 font-mono text-[10px]">
        {new Date(inc.detectionTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
      </td>
      <td className="p-5">
        <div className="flex items-center gap-2">
           {isBreached ? (
             <AlertTriangle size={12} className="text-red-500 animate-pulse" />
           ) : (
             <Clock size={12} className="text-cyan-500/40" />
           )}
           <span className={cn(
             "font-mono text-[10px] font-bold",
             isBreached ? "text-red-500" : "text-cyan-400"
           )}>
             {isBreached ? "BREACHED" : "NOMINAL"}
           </span>
        </div>
      </td>
      <td className="p-5">
        <div className="flex items-center gap-1.5">
           <div className={cn(
             "w-1.5 h-1.5 rounded-full animate-pulse",
             inc.status === 'open' ? 'bg-blue-500' : inc.status === 'closed' ? 'bg-green-500' : 'bg-orange-500'
           )} />
           <span className="text-[10px] font-bold uppercase text-cyan-500/70">{inc.status}</span>
        </div>
      </td>
      <td className="p-5 text-right">
         <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-cyan-500/60 hover:text-cyan-400 hover:bg-cyan-500/10"><Eye size={14} /></Button>
         </div>
      </td>
    </tr>
  );
};

