import React, { useState, useEffect } from 'react';
import { incidentService } from '../services/incidentService';
import { Incident } from '../types';
import { 
  Ticket, Search, Filter, ArrowUpDown, 
  MoreHorizontal, Eye, Edit2, Trash2,
  AlertTriangle, Clock, CheckCircle, Shield, ChevronLeft,
  Download, Upload, GitMerge, Loader2
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CreateIncidentDialog } from './CreateIncidentDialog';
import { IncidentDetailView } from './IncidentDetailView';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '@/lib/AuthContext';

import { FilterBar, FilterState } from './FilterBar';

export const IncidentsListView: React.FC<{ initialIncidentId?: string | null }> = ({ initialIncidentId }) => {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'investigating'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const isAdmin = user?.role === 'admin';

  const constructQuery = (f: FilterState) => {
    const parts = [];
    if (f.search) parts.push(f.search);
    if (f.severity.length > 0) parts.push(`severity:${f.severity.join(',')}`);
    if (f.status.length > 0) parts.push(`status:${f.status.join(',')}`);
    if (f.host) parts.push(`host:${f.host}`);
    if (f.assignedTo) parts.push(`assignedTo:${f.assignedTo}`);
    return parts.join(' ');
  };

  const handleFilterChange = (f: FilterState) => {
    const query = constructQuery(f);
    setSearch(query);
  };

  useEffect(() => {
    if (initialIncidentId) {
      setSelectedIncidentId(initialIncidentId);
    }
  }, [initialIncidentId]);

  useEffect(() => {
    // If query is structured (contains colon) or not empty, hit the server
    const isComplex = search.includes(':') || search.length > 2;
    
    if (isComplex) {
      const timer = setTimeout(async () => {
        setIsSearchingServer(true);
        try {
          const data = await incidentService.search(search);
          setIncidents(Array.isArray(data) ? data : []);
          // When searching, we might not have full pagination from search endpoint
          setPagination({ total: data.length, page: 1, limit: 50, totalPages: 1 });
        } catch (err) {
          console.error("Structured search failed");
        } finally {
          setIsSearchingServer(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else if (search === '') {
      // Refresh default list if search cleared
      incidentService.getIncidents(pagination?.page || 1, pagination?.limit || 50).then(res => {
        if (res && res.data && res.pagination) {
          setIncidents(res.data);
          setPagination(res.pagination);
        } else if (Array.isArray(res)) {
          setIncidents(res);
          setPagination({ total: res.length, page: 1, limit: 50, totalPages: 1 });
        }
      });
    }
  }, [search, pagination?.page]);

  useEffect(() => {
    const unsub = incidentService.subscribeToIncidents((res) => {
      // Only update if not currently searching with structure
      if (!search.includes(':')) {
        if (res && res.data && res.pagination) {
          setIncidents(res.data);
          setPagination(res.pagination);
        } else if (Array.isArray(res)) {
          setIncidents(res);
          setPagination({ total: res.length, page: 1, limit: 50, totalPages: 1 });
        }
        setLoading(false);
      }
    }, (err) => {
      toast.error("Telemetry failed: Cannot sync incident stream");
      setLoading(false);
    }, pagination?.page || 1, pagination?.limit || 50);
    return unsub;
  }, [search, pagination?.page]);

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
   if (!confirm(`WARNING: Permanently purge ${selectedIds.length} records from registry?`)) return;
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

  const [mergingParentId, setMergingParentId] = useState<string | null>(null);

  const handleMerge = async () => {
   if (selectedIds.length < 2) return toast.error("Select at least 2 incidents to merge");

   toast.info("Select the PRIMARY (Parent) ticket from your selection to merge others into it", {
     duration: 5000
   });
   setMergingParentId('SELECTING');
  };

  const finalizeMerge = async (parentId: string) => {
   const childIds = selectedIds.filter(id => id !== parentId);
   try {
     toast.loading("Consolidating investigation threads...");
     await incidentService.merge(parentId, childIds);
     toast.dismiss();
     toast.success(`Successfully merged ${childIds.length} incidents into ${incidents.find(i => i.id === parentId)?.ticketNumber}`);
     setSelectedIds([]);
     setMergingParentId(null);
   } catch (err) {
     toast.dismiss();
     toast.error("Merge operation aborted: System conflict");
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
          className="text-primary hover:text-primary/80 hover:bg-primary/10 gap-2 uppercase font-bold text-[10px]"
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
          <div className="p-20 text-center text-primary/20 font-mono uppercase">Ticket not found in active memory</div>
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
    <div className="space-y-6 pb-10">
      <FilterBar onFilterChange={handleFilterChange} />
      
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
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
            className="border-primary/20 text-primary hover:bg-primary/10 font-bold uppercase tracking-widest text-[10px] h-11 px-4"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            variant="outline"
            onClick={handleImport}
            className="border-primary/20 text-primary hover:bg-primary/10 font-bold uppercase tracking-widest text-[10px] h-11 px-4"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button 
            onClick={() => setIsCreateOpen(true)}
            className="bg-primary hover:opacity-90 text-white font-bold uppercase tracking-widest text-[10px] h-11 px-6 shadow-lg shadow-primary/20 border-none"
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
               {mergingParentId === 'SELECTING' ? (
                 <Button 
                   onClick={() => setMergingParentId(null)}
                   className="bg-warning hover:opacity-90 text-white font-bold uppercase tracking-widest text-[9px] h-8 px-4 animate-pulse border-none"
                 >
                   Cancel Merge
                 </Button>
               ) : (
                 <Button 
                   onClick={handleMerge}
                   className="bg-primary hover:opacity-90 text-white font-bold uppercase tracking-widest text-[9px] h-8 px-4 border-none"
                 >
                   <GitMerge className="w-3 h-3 mr-2" />
                   Merge
                 </Button>
               )}
               <Button 
                 onClick={handleBulkClose}
                 className="bg-success hover:opacity-90 text-white font-bold uppercase tracking-widest text-[9px] h-8 px-4 border-none"
               >
                 <CheckCircle className="w-3 h-3 mr-2" />
                 Bulk Close
               </Button>
               <Button 
                 onClick={handleBulkDelete}
                 variant="destructive"
                 className="font-bold uppercase tracking-widest text-[9px] h-8 px-4 shadow-sm"
               >
                 <Trash2 className="w-3 h-3 mr-2" />
                 Bulk Purge
               </Button>
               <Button 
                 variant="ghost" 
                 onClick={() => setSelectedIds([])}
                 className="text-muted-foreground hover:text-foreground text-[9px] font-bold uppercase h-8"
               >
                 Deselect
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase text-muted-foreground font-bold tracking-widest bg-secondary/30">
                  {isAdmin && (
                    <th className="p-5 w-10">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.length === filteredIncidents.length && filteredIncidents.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-border bg-background text-primary"
                      />
                    </th>
                  )}
                  <th className="p-5 font-black">Ticket ID</th>
                  <th className="p-5 font-black">Incident Core</th>
                  <th className="p-5 font-black">Severity</th>
                  <th className="p-5 font-black">Host/Node</th>
                  <th className="p-5 font-black">Detection</th>
                  <th className="p-5 font-black">SLA Status</th>
                  <th className="p-5 font-black">Protocol</th>
                  <th className="p-5"></th>
                </tr>
              </thead>
              <tbody className="text-xs text-foreground/90">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse border-b border-border/50">
                      <td colSpan={isAdmin ? 9 : 8} className="p-5 h-16 bg-secondary/20" />
                    </tr>
                  ))
                ) : filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} className="p-20 text-center opacity-30">
                       <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
                       <p className="text-primary font-mono text-xs uppercase tracking-widest">No matching records found in secure registry</p>
                    </td>
                  </tr>
                ) : filteredIncidents.map((inc) => (
                  <IncidentRow 
                    key={inc.id} 
                    inc={inc} 
                    onView={() => setSelectedIncidentId(inc.id)} 
                    isAdmin={isAdmin}
                    isSelected={selectedIds.includes(inc.id)}
                    isMerging={mergingParentId === 'SELECTING'}
                    onSelect={(checked) => {
                      if (checked) setSelectedIds(prev => [...prev, inc.id]);
                      else setSelectedIds(prev => prev.filter(id => id !== inc.id));
                    }}
                    onFinalizeMerge={() => finalizeMerge(inc.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="flex items-center justify-between p-4 border-t border-border bg-secondary/10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Showing {(((pagination?.page || 1) - 1) * (pagination?.limit || 50)) + 1} - {Math.min((pagination?.page || 1) * (pagination?.limit || 50), pagination?.total || 0)} of {pagination?.total || 0} records
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={(pagination?.page || 1) <= 1}
                onClick={() => setPagination(prev => ({ ...prev, page: (prev?.page || 1) - 1 }))}
                className="h-8 text-[10px] font-bold uppercase border-border hover:bg-primary/10"
              >
                Previous
              </Button>
              <div className="text-[10px] font-bold uppercase tracking-tighter w-20 text-center">
                Page {pagination?.page || 1} / {pagination?.totalPages || 1}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={(pagination?.page || 1) >= (pagination?.totalPages || 1)}
                onClick={() => setPagination(prev => ({ ...prev, page: (prev?.page || 1) + 1 }))}
                className="h-8 text-[10px] font-bold uppercase border-border hover:bg-primary/10"
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <CreateIncidentDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
};

import { SLACountdown } from './SLACountdown';

const IncidentRow = ({ inc, onView, isAdmin, isSelected, isMerging, onSelect, onFinalizeMerge }: { 
  inc: Incident, 
  onView: () => void, 
  isAdmin?: boolean,
  isSelected?: boolean,
  isMerging?: boolean,
  onSelect?: (checked: boolean) => void,
  onFinalizeMerge?: () => void
}) => {
  return (
    <tr 
      onClick={onView}
      className={cn(
        "border-b border-border/40 hover:bg-primary/[0.03] transition-colors group cursor-pointer",
        isSelected && "bg-primary/[0.05]"
      )}
    >
      {isAdmin && (
        <td className="p-5" onClick={(e) => e.stopPropagation()}>
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={(e) => onSelect?.(e.target.checked)}
            className="rounded border-border bg-background text-primary"
          />
        </td>
      )}
      <td className="p-5 font-mono text-[11px] text-primary font-bold tracking-tighter uppercase">{inc.ticketNumber}</td>
      <td className="p-5">
        <div className="flex flex-col">
          <span className="font-bold text-foreground/90 truncate max-w-[250px] uppercase tracking-tight">{inc.alertName}</span>
          <span className="text-[9px] text-muted-foreground/40 font-mono">{inc.id.slice(0, 8)}</span>
        </div>
      </td>
      <td className="p-5">
        <Badge className={cn(
          "text-[9px] uppercase font-black px-2 py-0.5 rounded-full border-none shadow-sm",
          inc.severity === 'critical' ? 'bg-error text-white' : 
          inc.severity === 'high' ? 'bg-warning text-white' : 
          'bg-secondary text-muted-foreground'
        )}>
          {inc.severity}
        </Badge>
      </td>
      <td className="p-5">
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-primary/30" />
           <span className="font-mono text-[10px] text-muted-foreground lowercase">{inc.host}</span>
        </div>
      </td>
      <td className="p-5 text-muted-foreground/60 font-mono text-[10px]">
        {new Date(inc.detectionTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
      </td>
      <td className="p-5">
        <SLACountdown deadline={inc.slaDeadline} className="text-[10px]" />
      </td>
      <td className="p-5">
        <div className="flex items-center gap-1.5">
           <div className={cn(
             "w-1.5 h-1.5 rounded-full",
             inc.status === 'open' ? "bg-primary animate-pulse shadow-[0_0_8px_var(--primary-glow)]" : 
             inc.status === 'closed' ? "bg-success" : "bg-warning"
           )} />
           <span className="text-[10px] font-black uppercase text-muted-foreground">{inc.status}</span>
        </div>
      </td>
      <td className="p-5 text-right">
         <div className="flex gap-1 justify-end">
            {isMerging && isSelected ? (
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  onFinalizeMerge?.();
                }}
                className="h-8 bg-primary hover:opacity-90 text-white font-black uppercase text-[9px] border-none"
              >
                Set Parent
              </Button>
            ) : (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-primary/60 hover:text-primary hover:bg-primary/10"
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
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary/60 hover:text-primary hover:bg-primary/10"><Eye size={14} /></Button>
              </div>
            )}
         </div>
      </td>
    </tr>
  );
};
