import React, { useState } from 'react';
import { Filter, X, Search, Calendar, Shield, Server, User, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface FilterState {
  severity: string[];
  status: string[];
  host: string;
  assignedTo: string;
  domain: string;
  search: string;
}

export function FilterBar({ onFilterChange }: { onFilterChange: (filters: FilterState) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    severity: [],
    status: [],
    host: '',
    assignedTo: '',
    domain: '',
    search: ''
  });

  const toggleSeverity = (sev: string) => {
    const next = filters.severity.includes(sev)
      ? filters.severity.filter(s => s !== sev)
      : [...filters.severity, sev];
    updateFilters({ ...filters, severity: next });
  };

  const toggleStatus = (stat: string) => {
    const next = filters.status.includes(stat)
      ? filters.status.filter(s => s !== stat)
      : [...filters.status, stat];
    updateFilters({ ...filters, status: next });
  };

  const updateFilters = (next: FilterState) => {
    setFilters(next);
    onFilterChange(next);
  };

  const activeCount = 
    filters.severity.length + 
    filters.status.length + 
    (filters.host ? 1 : 0) + 
    (filters.assignedTo ? 1 : 0) + 
    (filters.domain ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search secure registry (e.g. ticket ID, host, or free text)..." 
            className="pl-10 bg-secondary/30 border-border h-11 text-xs focus:border-primary/50 transition-all"
            value={filters.search}
            onChange={(e) => updateFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <Button 
          variant={isOpen ? "secondary" : "outline"} 
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "h-11 px-5 gap-2 uppercase font-black text-[10px] tracking-widest transition-all",
            activeCount > 0 && !isOpen && "border-primary/50 text-primary"
          )}
        >
          <Filter size={14} />
          Tactical Filters
          {activeCount > 0 && (
            <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center bg-primary text-white border-none text-[8px]">
              {activeCount}
            </Badge>
          )}
        </Button>
        {activeCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => updateFilters({ severity: [], status: [], host: '', assignedTo: '', domain: '', search: '' })}
            className="h-11 text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-error"
          >
            Clear
          </Button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 bg-secondary/20 border border-border rounded-xl grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 flex items-center gap-2">
                  <Shield size={12} /> Severity Matrix
                </h4>
                <div className="flex flex-wrap gap-2">
                  {['critical', 'high', 'medium', 'low'].map(sev => (
                    <button
                      key={sev}
                      onClick={() => toggleSeverity(sev)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter border transition-all",
                        filters.severity.includes(sev)
                          ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                          : "bg-background border-border text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 flex items-center gap-2">
                  <Zap size={12} /> Operational Status
                </h4>
                <div className="flex flex-wrap gap-2">
                  {['open', 'investigating', 'closed'].map(stat => (
                    <button
                      key={stat}
                      onClick={() => toggleStatus(stat)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter border transition-all",
                        filters.status.includes(stat)
                          ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                          : "bg-background border-border text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      {stat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 flex items-center gap-2">
                  <Server size={12} /> Resource Mapping
                </h4>
                <div className="grid grid-cols-1 gap-3">
                   <div className="relative">
                      <Server className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
                      <input 
                        placeholder="Host Identifier..." 
                        className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded text-[10px] font-mono focus:border-primary/30 outline-none"
                        value={filters.host}
                        onChange={(e) => updateFilters({ ...filters, host: e.target.value })}
                      />
                   </div>
                   <div className="relative">
                      <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
                      <input 
                        placeholder="Assigned Operative..." 
                        className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded text-[10px] font-mono focus:border-primary/30 outline-none"
                        value={filters.assignedTo}
                        onChange={(e) => updateFilters({ ...filters, assignedTo: e.target.value })}
                      />
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
