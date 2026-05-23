import React, { useState, useEffect } from 'react';
import { incidentService } from '../services/incidentService';
import { Incident } from '../types';
import { 
  Ticket, Search, Filter, ArrowUpDown, 
  MoreHorizontal, Eye, Edit2, Trash2,
  AlertTriangle, Clock, CheckCircle, Shield, ChevronLeft,
  Download, Upload
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CreateIncidentDialog } from './CreateIncidentDialog';
import { IncidentDetailView } from './IncidentDetailView';

import { useAuth } from '@/lib/AuthContext';

export const IncidentsListView: React.FC<{ initialIncidentId?: string | null }> = ({ initialIncidentId }) => {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'investigating'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (initialIncidentId) {
      setSelectedIncidentId(initialIncidentId);
    }
  }, [initialIncidentId]);

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

  const handleBulkClose = async () => {
    if (!isAdmin || selectedIds.length === 0) return;
    try {
      toast.loading(`Neutralizing ${selectedIds.length} threats...`);
      await incidentService.bulkUpdateStatus(selectedIds, 'closed');
      toast.dismiss();
      toast.success(`${selectedIds.length} tickets archived`);
      setSelectedIds([]);
    } catch (err) {
      toast.dismiss();
      toast.error("Bulk action failed");
    }
  };

  const handleBulkDelete = async () => {
    if (!isAdmin || selectedIds.length === 0) return;
    if (!confirm(`WARNIING: Permanently purge ${selectedIds.length} records from registry?`)) return;
    try {
      toast.loading(`Sanitizing registry...`);
      await incidentService.bulkDelete(selectedIds);
      toast.dismiss();
      toast.success(`${selectedIds.length} records purged`);
      setSelectedIds([]);
    } catch (err) {
      toast.dismiss();
      toast.error("Sanitization pipeline failure");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredIncidents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredIncidents.map(i => i.id));
    }
  };

  const handleExport = async () => {
    try {
      toast.loading("Preparing secure export...");
      await incidentService.exportAll();
      toast.dismiss();
      toast.success("Registry export complete");
    } catch (err) {
      toast.dismiss();
      toast.error("Export failed: Secure link unavailable");
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        const csvData = event.target?.result as string;
        try {
          toast.loading("Parsing and injecting records...");
          const res = await incidentService.importCsv(csvData);
          toast.dismiss();
          toast.success(`Successfully imported ${res.count} records`);
        } catch (err) {
          toast.dismiss();
          toast.error("Import failed: Data corruption detected");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

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
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => {
              toast.loading("Generating handover report...");
              incidentService.getHandoverReport()
                .then(() => { toast.dismiss(); toast.success("Handover report ready"); })
                .catch(() => { toast.dismiss(); toast.error("Report generation failed"); });
            }}
            className="border-primary/20 text-primary hover:bg-primary/10 font-bold uppercase tracking-widest text-[10px] h-11 px-4"
          >
            <Download className="w-4 h-4 mr-2" />
            Shift Report
          </Button>
          <Button 
            variant="outline"
            onClick={handleExport}
            className="border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/10 font-bold uppercase tracking-widest text-[10px] h-11 px-4"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            variant="outline"
            onClick={handleImport}
            className="border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/10 font-bold uppercase tracking-widest text-[10px] h-11 px-4"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button 
            onClick={() => setIsCreateOpen(true)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase tracking-widest text-[10px] h-11 px-6 shadow-lg shadow-cyan-600/20"
          >
            <Ticket className="w-4 h-4 mr-2" />
            Inject
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-primary/10 border border-primary/20 p-3 rounded-lg flex items-center justify-between shadow-xl shadow-primary/5"
          >
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                {selectedIds.length} incidents locked in sequence
              </span>
            </div>
            <div className="flex items-center gap-3">
               <Button 
                 onClick={handleBulkClose}
                 className="bg-green-500 hover:bg-green-600 text-white font-bold uppercase tracking-widest text-[9px] h-8 px-4"
               >
                 <CheckCircle className="w-3 h-3 mr-2" />
                 Bulk Close
               </Button>
               <Button 
                 onClick={handleBulkDelete}
                 variant="destructive"
                 className="font-bold uppercase tracking-widest text-[9px] h-8 px-4"
               >
                 <Trash2 className="w-3 h-3 mr-2" />
                 Bulk Purge
               </Button>
               <Button 
                 variant="ghost" 
                 onClick={() => setSelectedIds([])}
                 className="text-muted-foreground hover:text-white text-[9px] font-bold uppercase h-8"
               >
                 Deselect
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="bg-black/40 border-cyan-500/10 backdrop-blur-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto text-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-cyan-500/10 text-[10px] uppercase text-cyan-500/50 font-bold tracking-widest">
                  {isAdmin && (
                    <th className="p-5 w-10">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.length === filteredIncidents.length && filteredIncidents.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-cyan-500/20 bg-transparent text-primary"
                      />
                    </th>
                  )}
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
                      <td colSpan={isAdmin ? 9 : 8} className="p-5 h-16 bg-cyan-500/5" />
                    </tr>
                  ))
                ) : filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} className="p-20 text-center">
                       <Shield className="w-12 h-12 text-cyan-500/10 mx-auto mb-4" />
                       <p className="text-cyan-500/40 font-mono text-xs uppercase tracking-widest">No matching records found in secure registry</p>
                    </td>
                  </tr>
                ) : filteredIncidents.map((inc) => (
                  <IncidentRow 
                    key={inc.id} 
                    inc={inc} 
                    onView={() => setSelectedIncidentId(inc.id)} 
                    isAdmin={isAdmin}
                    isSelected={selectedIds.includes(inc.id)}
                    onSelect={(checked) => {
                      if (checked) setSelectedIds(prev => [...prev, inc.id]);
                      else setSelectedIds(prev => prev.filter(id => id !== inc.id));
                    }}
                  />
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

const IncidentRow = ({ inc, onView, isAdmin, isSelected, onSelect }: { 
  inc: Incident, 
  onView: () => void, 
  isAdmin?: boolean,
  isSelected?: boolean,
  onSelect?: (checked: boolean) => void 
}) => {
  const isBreached = Date.now() > inc.slaDeadline && inc.status !== 'closed';

  return (
    <tr 
      onClick={onView}
      className={cn(
        "border-b border-cyan-500/5 hover:bg-cyan-500/5 transition-colors group cursor-pointer",
        isSelected && "bg-primary/5"
      )}
    >
      {isAdmin && (
        <td className="p-5" onClick={(e) => e.stopPropagation()}>
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={(e) => onSelect?.(e.target.checked)}
            className="rounded border-cyan-500/20 bg-transparent text-primary"
          />
        </td>
      )}
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
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-cyan-500/60 hover:text-cyan-400 hover:bg-cyan-500/10"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  toast.loading("Generating secure report...");
                  await incidentService.exportOne(inc.id, inc.ticketNumber);
                  toast.dismiss();
                  toast.success("Report export complete");
                } catch (err) {
                  toast.dismiss();
                  toast.error("Export failed");
                }
              }}
              title="Export Specific Report"
            >
              <Download size={14} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-cyan-500/60 hover:text-cyan-400 hover:bg-cyan-500/10"><Eye size={14} /></Button>
         </div>
      </td>
    </tr>
  );
};


