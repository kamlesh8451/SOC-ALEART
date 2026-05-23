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

type ReportType = 'executive' | 'sla' | 'intel';
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
      id: 'intel', 
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
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Module Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
             <div className="h-0.5 w-6 bg-primary/50" />
             <span className="text-[10px] font-mono font-bold text-primary/70 tracking-[0.3em] uppercase">Intelligence Extraction Core</span>
           </div>
           <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Reports HQ</h2>
           <p className="text-muted-foreground text-xs font-mono uppercase tracking-widest mt-1">Cross-Registry Data Synthesis & Tactical Export</p>
        </div>

        <div className="flex bg-secondary/50 p-1 rounded-lg border border-border">
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
           <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Select Template</h3>
           <div className="grid grid-cols-1 gap-3">
              {reportTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => setSelectedReport(template.id as ReportType)}
                  className={cn(
                    "text-left p-5 rounded-xl border transition-all duration-300 group",
                    selectedReport === template.id 
                      ? "bg-primary/5 border-primary shadow-[0_0_20px_rgba(var(--primary),0.05)]" 
                      : "bg-card border-border hover:border-primary/30"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                      selectedReport === template.id ? "bg-primary text-white" : "bg-secondary text-muted-foreground group-hover:text-primary"
                    )}>
                      <template.icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={cn(
                        "text-xs font-bold uppercase tracking-widest",
                        selectedReport === template.id ? "text-primary" : "text-foreground"
                      )}>{template.title}</h4>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed opacity-80">{template.description}</p>
                    </div>
                  </div>
                </button>
              ))}
           </div>

           <Card className="bg-primary/5 border-primary/20 border-dashed">
              <CardContent className="p-4 flex items-center gap-3">
                 <Info className="w-4 h-4 text-primary shrink-0" />
                 <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">
                   Reports are generated in real-time from encrypted registry mirrors. Ensure filters are locked before export.
                 </p>
              </CardContent>
           </Card>
        </div>

        {/* Live Preview Area */}
        <div className="lg:col-span-8">
          <Card className="bg-black/40 border-border h-full flex flex-col backdrop-blur-xl">
             <CardHeader className="border-b border-border flex flex-row items-center justify-between py-4">
                <div>
                   <CardTitle className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-500">Tactical Preview</CardTitle>
                   <CardDescription className="text-[9px] uppercase font-mono">Live Intelligence Matrix Synchronization</CardDescription>
                </div>
                <Button 
                  onClick={handleDownload}
                  disabled={loading || !previewData}
                  className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-[10px] px-6 h-10 shadow-lg shadow-primary/20"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Generate Final Asset
                </Button>
             </CardHeader>
             <CardContent className="flex-1 p-8">
                <AnimatePresence mode="wait">
                   {loading ? (
                     <motion.div 
                       key="loading"
                       initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                       className="h-full flex flex-col items-center justify-center space-y-4"
                     >
                        <div className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <span className="text-[10px] font-mono text-primary/50 uppercase animate-pulse">Aggregating Tactical Data...</span>
                     </motion.div>
                   ) : (
                     <motion.div 
                        key={selectedReport}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="h-full"
                     >
                        {selectedReport === 'executive' && previewData && (
                          <div className="space-y-8">
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatBox label="Total Scanned" value={previewData.summary.total} icon={Activity} />
                                <StatBox label="Neutralized" value={previewData.summary.resolved} icon={CheckCircle} color="text-green-500" />
                                <StatBox label="Critical" value={previewData.summary.critical} icon={ShieldAlert} color="text-red-500" />
                                <StatBox label="High Impact" value={previewData.summary.high} icon={TrendingUp} color="text-orange-500" />
                             </div>
                             
                             <div className="space-y-4">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                   <TrendingUp className="w-3 h-3" />
                                   Host Threat Distribution (Top 5)
                                </h4>
                                <div className="space-y-3">
                                   {previewData.topHosts.map((h: any, idx: number) => (
                                     <div key={idx} className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
                                           <span className="text-white/80">{h.host}</span>
                                           <span className="text-primary">{h.count} Alerts</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                           <div 
                                             className="h-full bg-primary transition-all duration-1000" 
                                             style={{ width: `${(h.count / previewData.summary.total) * 100}%` }} 
                                           />
                                        </div>
                                     </div>
                                   ))}
                                </div>
                             </div>
                          </div>
                        )}

                        {selectedReport === 'sla' && previewData && (
                          <div className="space-y-8">
                             <div className="flex items-center justify-center p-8 bg-secondary/30 rounded-2xl border border-border">
                                <div className="text-center">
                                   <div className="text-6xl font-black text-white tracking-tighter mb-2">{previewData.complianceScore}%</div>
                                   <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Compliance Score</div>
                                </div>
                             </div>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="bg-secondary/20 border-border">
                                   <CardContent className="p-4 flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                                         <ShieldAlert size={20} />
                                      </div>
                                      <div>
                                         <p className="text-[9px] font-bold text-muted-foreground uppercase">SLA Breaches</p>
                                         <p className="text-xl font-bold text-white">{previewData.breaches} Tickets</p>
                                      </div>
                                   </CardContent>
                                </Card>
                                <Card className="bg-secondary/20 border-border">
                                   <CardContent className="p-4 flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500">
                                         <Clock size={20} />
                                      </div>
                                      <div>
                                         <p className="text-[9px] font-bold text-muted-foreground uppercase">Avg Resolution</p>
                                         <p className="text-xl font-bold text-white">{previewData.mttr} Hours</p>
                                      </div>
                                   </CardContent>
                                </Card>
                             </div>
                          </div>
                        )}

                        {selectedReport === 'intel' && previewData && (
                          <div className="space-y-6">
                             <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recent Indicators of Compromise</h4>
                                <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] font-black uppercase">
                                   {previewData.maliciousCount} High Risk Identified
                                </Badge>
                             </div>
                             
                             <div className="bg-secondary/20 rounded-xl border border-border overflow-hidden">
                                <table className="w-full text-left">
                                   <thead>
                                      <tr className="border-b border-border bg-secondary/30 text-[9px] uppercase font-bold text-muted-foreground tracking-widest">
                                         <th className="p-3">Indicator</th>
                                         <th className="p-3 text-center">Type</th>
                                         <th className="p-3 text-right">Rep Score</th>
                                      </tr>
                                   </thead>
                                   <tbody>
                                      {previewData.indicators?.map((i: any, idx: number) => (
                                        <tr key={idx} className="border-b border-border/50 text-[10px] font-mono">
                                           <td className="p-3 text-white font-bold">{i.value}</td>
                                           <td className="p-3 text-center opacity-50 uppercase">{i.type}</td>
                                           <td className="p-3 text-right">
                                              <span className={cn(
                                                "px-2 py-0.5 rounded font-black",
                                                i.score > 70 ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                                              )}>{i.score}</span>
                                           </td>
                                        </tr>
                                      ))}
                                   </tbody>
                                </table>
                             </div>
                          </div>
                        )}
                     </motion.div>
                   )}
                </AnimatePresence>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ label, value, icon: Icon, color = "text-primary" }: any) => (
  <div className="p-4 bg-secondary/20 rounded-xl border border-border group hover:border-primary/30 transition-all">
     <div className="flex items-center justify-between mb-2">
        <Icon size={14} className={color} />
        <span className="text-[8px] font-bold uppercase text-muted-foreground tracking-tighter">{label}</span>
     </div>
     <div className="text-xl font-black text-white tracking-tighter">{value}</div>
  </div>
);
