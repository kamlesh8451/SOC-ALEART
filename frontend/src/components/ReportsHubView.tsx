import React, { useState, useEffect } from 'react';
import { 
  FileBarChart, Shield, Clock, ShieldAlert, 
  Download, Activity, Calendar, ExternalLink,
  CheckCircle, AlertTriangle, TrendingUp, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { apiJson, apiFetch } from '@/services/apiClient';
import { motion, AnimatePresence } from 'framer-motion';

type ReportType = 'executive' | 'sla' | 'threat-intel';
type TimeRange = '24h' | '168h' | '720h' | 'all';

export const ReportsHubView: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<ReportType>('executive');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const reportTemplates = [
    { 
      id: 'executive', 
      title: 'Executive Summary', 
      description: 'High-level tactical trends, volume analysis, and neutralization rates for leadership.',
      icon: FileBarChart,
      color: 'blue'
    },
    { 
      id: 'sla', 
      title: 'SLA Compliance Audit', 
      description: 'Detailed analysis of MTTA/MTTR, response deadlines, and critical breaches.',
      icon: Clock,
      color: 'orange'
    },
    { 
      id: 'threat-intel', 
      title: 'Threat Intel Digest', 
      description: 'Aggregated Indicators of Compromise (IoCs) and malicious entity reputation scores.',
      icon: ShieldAlert,
      color: 'red'
    }
  ];

  useEffect(() => {
    fetchPreviewData();
  }, [selectedReport, timeRange]);

  const fetchPreviewData = async () => {
    setLoading(true);
    try {
      const hours = timeRange === 'all' ? 8760 : parseInt(timeRange);
      const endpoint = `/api/reports/${selectedReport}-data?timeRange=${hours}`;
      const data = await apiJson<any>(endpoint);
      setPreviewData(data);
    } catch (e) {
      console.error("[REPORTS] Load failure:", e);
      toast.error("Failed to load tactical preview");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      toast.loading(`Synthesizing Final ${selectedReport.toUpperCase()} PDF...`);
      const hours = timeRange === 'all' ? 8760 : parseInt(timeRange);
      const response = await apiFetch(`/api/reports/${selectedReport}-pdf?timeRange=${hours}`);
      
      if (!response.ok) throw new Error("Export pipeline failure");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReport.toUpperCase()}_Report_${timeRange}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.dismiss();
      toast.success("Intelligence asset downloaded successfully");
    } catch (err) {
      toast.dismiss();
      toast.error("Encryption/Export error: File link broken");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10 text-foreground">
      {/* Module Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
             <div className="h-0.5 w-6 bg-primary/50" />
             <span className="text-[10px] font-mono font-bold text-primary/70 tracking-[0.3em] uppercase">Intelligence Extraction Core</span>
           </div>
           <h2 className="text-3xl font-black uppercase tracking-tighter">Reports HQ</h2>
           <p className="text-muted-foreground text-xs font-mono uppercase tracking-widest mt-1">Cross-Registry Data Synthesis & Tactical Export</p>
        </div>

        <div className="flex bg-secondary/50 p-1 rounded-lg border border-border shadow-inner">
          {[
            { id: '24h', label: '24 Hours' },
            { id: '168h', label: '7 Days' },
            { id: '720h', label: '30 Days' },
            { id: 'all', label: 'Terminal' }
          ].map(r => (
            <button
              key={r.id}
              onClick={() => setTimeRange(r.id as TimeRange)}
              className={cn(
                "px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all",
                timeRange === r.id ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Template Gallery */}
        <div className="lg:col-span-4 space-y-4">
           <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1 opacity-60">Select Template</h3>
           <div className="grid grid-cols-1 gap-3">
              {reportTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => setSelectedReport(template.id as ReportType)}
                  className={cn(
                    "text-left p-5 rounded-xl border transition-all duration-300 group",
                    selectedReport === template.id 
                      ? "bg-primary/[0.03] border-primary shadow-[0_0_20px_var(--primary-glow)]" 
                      : "bg-card border-border hover:border-primary/30"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center transition-all shadow-sm",
                      selectedReport === template.id ? "bg-primary text-white" : "bg-secondary text-muted-foreground group-hover:text-primary group-hover:bg-primary/5"
                    )}>
                      <template.icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={cn(
                        "text-xs font-bold uppercase tracking-widest transition-colors",
                        selectedReport === template.id ? "text-primary" : "text-foreground/90"
                      )}>{template.title}</h4>
                      <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed opacity-70">{template.description}</p>
                    </div>
                  </div>
                </button>
              ))}
           </div>

           <Card className="bg-primary/5 border-primary/20 border-dashed shadow-inner">
              <CardContent className="p-4 flex items-center gap-3">
                 <Info className="w-4 h-4 text-primary shrink-0 opacity-50" />
                 <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter leading-tight">
                   Reports are generated in real-time from encrypted registry mirrors. Ensure filters are locked before export.
                 </p>
              </CardContent>
           </Card>
        </div>

        {/* Live Preview Area */}
        <div className="lg:col-span-8">
          <Card className="bg-card border-border h-full flex flex-col backdrop-blur-xl shadow-xl overflow-hidden">
             <CardHeader className="border-b border-border flex flex-col sm:flex-row items-center justify-between py-5 bg-secondary/20">
                <div>
                   <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-primary/80">Tactical Preview</CardTitle>
                   <CardDescription className="text-[9px] uppercase font-mono mt-1 opacity-60">Live Intelligence Matrix Synchronization</CardDescription>
                </div>
                <Button 
                  onClick={handleDownload}
                  disabled={loading || !previewData}
                  className="bg-primary hover:opacity-90 text-white font-black uppercase tracking-[0.2em] text-[10px] px-8 h-10 shadow-lg shadow-primary/20 border-none mt-4 sm:mt-0"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Synthesize PDF
                </Button>
             </CardHeader>
             <CardContent className="flex-1 p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/10">
                <AnimatePresence mode="wait">
                   {loading ? (
                     <motion.div 
                       key="loading"
                       initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                       className="h-full flex flex-col items-center justify-center space-y-4 py-20"
                     >
                        <div className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin shadow-[0_0_10px_var(--primary-glow)]" />
                        <span className="text-[10px] font-mono text-primary/50 uppercase animate-pulse font-black tracking-widest">Aggregating Tactical Data...</span>
                     </motion.div>
                   ) : (
                     <motion.div 
                        key={selectedReport}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="h-full"
                     >
                        {selectedReport === 'executive' && previewData?.summary && (
                          <div className="space-y-10">
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatBox label="Total Scanned" value={previewData.summary?.total || 0} icon={Activity} />
                                <StatBox label="Neutralized" value={previewData.summary?.resolved || 0} icon={CheckCircle} color="text-success" />
                                <StatBox label="Critical" value={previewData.summary?.critical || 0} icon={ShieldAlert} color="text-error" />
                                <StatBox label="High Impact" value={previewData.summary?.high || 0} icon={TrendingUp} color="text-warning" />
                             </div>
                             
                             <div className="space-y-5 bg-secondary/20 p-6 rounded-2xl border border-border shadow-inner">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 opacity-60">
                                   <TrendingUp className="w-3 h-3 text-primary" />
                                   Host Threat Distribution (Top 5)
                                </h4>
                                <div className="space-y-5">
                                   {(previewData.topHosts || []).map((h: any, idx: number) => (
                                     <div key={idx} className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
                                           <span className="text-foreground/70">{h.host}</span>
                                           <span className="text-primary font-black">{h.count} Alerts</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden shadow-inner">
                                           <motion.div 
                                             initial={{ width: 0 }}
                                             animate={{ width: `${(h.count / Math.max(previewData.summary?.total || 1, 1)) * 100}%` }}
                                             transition={{ duration: 1.5, ease: "easeOut" }}
                                             className="h-full bg-primary shadow-[0_0_8px_var(--primary-glow)]" 
                                           />
                                        </div>
                                     </div>
                                   ))}
                                </div>
                             </div>
                          </div>
                        )}

                        {selectedReport === 'sla' && previewData && (
                          <div className="space-y-10">
                             <div className="flex items-center justify-center p-12 bg-secondary/30 rounded-3xl border border-border shadow-inner relative overflow-hidden group">
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                <div className="text-center relative z-10">
                                   <div className="text-7xl font-black text-foreground tracking-tighter mb-2 drop-shadow-sm">{previewData.complianceScore || 0}%</div>
                                   <div className="text-[11px] font-black uppercase tracking-[0.4em] text-primary">Compliance Score</div>
                                </div>
                             </div>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="bg-card border-border shadow-md hover:border-warning/30 transition-all">
                                   <CardContent className="p-6 flex items-center gap-5">
                                      <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center text-warning shadow-inner">
                                         <ShieldAlert size={24} />
                                      </div>
                                      <div>
                                         <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">SLA Breaches</p>
                                         <p className="text-2xl font-black text-foreground tracking-tighter">{previewData.breaches || 0} Tickets</p>
                                      </div>
                                   </CardContent>
                                </Card>
                                <Card className="bg-card border-border shadow-md hover:border-primary/30 transition-all">
                                   <CardContent className="p-6 flex items-center gap-5">
                                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                                         <Clock size={24} />
                                      </div>
                                      <div>
                                         <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Avg Resolution</p>
                                         <p className="text-2xl font-black text-foreground tracking-tighter">{previewData.mttr || 0} Hours</p>
                                      </div>
                                   </CardContent>
                                </Card>
                             </div>
                          </div>
                        )}

                        {selectedReport === 'threat-intel' && previewData && (
                          <div className="space-y-8">
                             <div className="flex items-center justify-between px-1">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Recent Indicators of Compromise</h4>
                                <Badge className="bg-error/10 text-error border-error/20 text-[9px] font-black uppercase px-2 h-5">
                                   {previewData.maliciousCount || 0} High Risk Identified
                                </Badge>
                             </div>
                             
                             <div className="bg-secondary/20 rounded-2xl border border-border overflow-hidden shadow-inner">
                                <table className="w-full text-left border-collapse">
                                   <thead>
                                      <tr className="border-b border-border bg-secondary/50 text-[10px] font-black uppercase text-muted-foreground tracking-[0.1em]">
                                         <th className="p-4 pl-6">Indicator</th>
                                         <th className="p-4 text-center">Type</th>
                                         <th className="p-4 pr-6 text-right">Reputation</th>
                                      </tr>
                                   </thead>
                                   <tbody>
                                      {(previewData.indicators || []).map((i: any, idx: number) => (
                                        <tr key={idx} className="border-b border-border/40 text-[11px] font-mono hover:bg-primary/5 transition-colors group">
                                           <td className="p-4 pl-6 text-foreground/90 font-bold uppercase tracking-tighter">{i.value}</td>
                                           <td className="p-4 text-center">
                                              <Badge variant="outline" className="text-[8px] font-black border-border/50 uppercase tracking-widest group-hover:border-primary/30 transition-colors">
                                                 {i.type}
                                              </Badge>
                                           </td>
                                           <td className="p-4 pr-6 text-right">
                                              <span className={cn(
                                                "px-2.5 py-1 rounded-full font-black shadow-sm text-[10px]",
                                                i.score > 70 ? "bg-error text-white" : 
                                                i.score > 40 ? "bg-warning text-white" : 
                                                "bg-success text-white"
                                              )}>{i.score}</span>
                                           </td>
                                        </tr>
                                      ))}
                                   </tbody>
                                </table>
                                {(!previewData.indicators || previewData.indicators.length === 0) && (
                                  <div className="p-10 text-center text-muted-foreground/30 italic text-[10px] uppercase font-bold tracking-widest">No IoC data available for the selected range</div>
                                )}
                             </div>
                          </div>
                        )}

                        {!previewData && !loading && (
                          <div className="h-full flex flex-col items-center justify-center space-y-4 py-20 opacity-30">
                             <Shield className="w-16 h-16 text-primary" />
                             <p className="text-[10px] font-black uppercase tracking-widest">No Intelligence Data Found</p>
                          </div>
                        )}
                     </motion.div>
                   )}
                </AnimatePresence>
             </CardContent>
             <div className="p-3 bg-secondary/10 border-t border-border/50 text-center">
                <p className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/20">Secure Intelligence Synthesis Pipeline Ready</p>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ label, value, icon: Icon, color = "text-primary" }: any) => (
  <div className="p-5 bg-card rounded-2xl border border-border group hover:border-primary/30 transition-all shadow-sm relative overflow-hidden">
     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
     <div className="flex items-center justify-between mb-3">
        <div className={cn("p-1.5 rounded-lg bg-secondary/50 shadow-inner group-hover:scale-110 transition-transform", color)}>
          <Icon size={16} />
        </div>
        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter opacity-50">{label}</span>
     </div>
     <div className="text-2xl font-black text-foreground tracking-tighter drop-shadow-sm">{value || 0}</div>
  </div>
);
