import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Ticket, Shield, X, AlertTriangle } from 'lucide-react';
import { Incident } from '../types';
import { incidentService } from '../services/incidentService';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

export function GlobalSearch({ onSelectIncident }: { onSelectIncident: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const data = await incidentService.search(query);
        setResults(data);
      } catch (e) {
        console.error("Search failed");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative group">
        <Search size={16} className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 transition-colors",
          isOpen ? "text-cyan-400" : "text-cyan-500/40"
        )} />
        <input 
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="bg-cyan-500/5 border border-cyan-500/10 rounded-full pl-10 pr-10 py-2 text-xs focus:border-cyan-500/40 transition-all outline-none w-64 text-white placeholder:text-cyan-500/20 font-mono tracking-wider" 
          placeholder="QUERY THREAT DATABASE..." 
        />
        {query && (
          <button 
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-500/40 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (query.length >= 2 || loading) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full right-0 mt-2 w-96 bg-[#0a0a0a] border border-cyan-500/20 rounded-xl shadow-2xl z-[500] overflow-hidden backdrop-blur-xl"
          >
            <div className="p-3 border-b border-cyan-500/10 bg-cyan-500/5 flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-widest text-cyan-500/60 flex items-center gap-2">
                 <Shield size={10} /> Search Intelligence
              </span>
              {loading && <Loader2 size={10} className="text-cyan-500 animate-spin" />}
            </div>

            <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/20">
              {results.length > 0 ? (
                results.map((inc) => (
                  <div 
                    key={inc.id}
                    onClick={() => {
                      onSelectIncident(inc.id);
                      setIsOpen(false);
                    }}
                    className="p-3 border-b border-cyan-500/5 hover:bg-cyan-500/10 cursor-pointer transition-all flex items-start gap-3 group"
                  >
                    <div className={cn(
                      "mt-1 w-2 h-2 rounded-full shrink-0",
                      inc.severity === 'critical' ? 'bg-red-500' : 
                      inc.severity === 'high' ? 'bg-orange-500' : 'bg-blue-500'
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono font-bold text-cyan-400 group-hover:text-cyan-300">{inc.ticketNumber}</span>
                        <Badge className="bg-transparent border-cyan-500/20 text-[7px] h-3.5 px-1 uppercase">{inc.status}</Badge>
                      </div>
                      <p className="text-[11px] font-bold text-white/90 truncate uppercase tracking-tight">{inc.alertName}</p>
                      <p className="text-[9px] text-cyan-500/40 font-mono mt-0.5 lowercase">{inc.host}</p>
                    </div>
                  </div>
                ))
              ) : !loading ? (
                <div className="p-10 text-center space-y-2">
                   <AlertTriangle className="w-8 h-8 text-cyan-500/20 mx-auto" />
                   <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/40">No Signal Detected</p>
                </div>
              ) : null}
            </div>

            {results.length > 0 && (
              <div className="p-2 bg-black/40 text-center">
                 <p className="text-[8px] text-cyan-500/30 uppercase font-black tracking-[0.2em]">End of results</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
