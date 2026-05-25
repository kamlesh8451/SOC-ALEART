import React, { useState, useEffect, useMemo } from "react";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Shield, Clock, Server, AlertCircle, FileUp, CheckCircle2, 
  ArrowRight, ExternalLink, Zap, History, MessageSquare, HardDrive,
  Link as LinkIcon, Mail, Download, Edit2, AlertTriangle, Activity, ShieldAlert,
  Users, Send, Reply, FileText, Eye, Filter, Calendar, X, Maximize2
} from "lucide-react";
import { Incident } from "../types";
import { incidentService } from "../services/incidentService";
import { adminService } from "../services/adminService";
import { mailService } from "../services/mailService";
import { VisualLinkAnalysis } from "./VisualLinkAnalysis";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { apiJson } from "../services/apiClient";
import { useSocket } from "@/lib/useSocket";
import { useAuth } from "@/lib/AuthContext";

import { SLACountdown } from './SLACountdown';

export function IncidentDetailView({ 
  incident, 
  onBack, 
  onSelectIncident,
  role
}: { 
  incident: Incident, 
  onBack: () => void, 
  onSelectIncident: (inc: Incident) => void,
  role?: string
}) {
  const { user: currentUser } = useAuth();
  const { socket } = useSocket();
  const [viewers, setViewers] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [escalationReason, setEscalationReason] = useState("");
  const [closureComment, setClosureComment] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [relatedIncidents, setRelatedIncidents] = useState<Incident[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [featureFlags, setFeatureFlags] = useState<any[]>([]);
  
  // Phase 3 Refinements
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [auditFilter, setAuditFilter] = useState<string>("ALL");

  useEffect(() => {
    if (!socket || !currentUser) return;

    socket.emit('view_incident', { 
      incidentId: incident.id, 
      user: { id: currentUser.id, name: currentUser.name } 
    });

    socket.on('incident_viewers_updated', (data) => {
      if (data.incidentId === incident.id) {
        setViewers(data.viewers.filter((v: any) => v.id !== currentUser.id));
      }
    });

    return () => {
      socket.emit('stop_viewing', incident.id);
      socket.off('incident_viewers_updated');
    };
  }, [socket, incident.id, currentUser]);

  useEffect(() => {
    let isMounted = true;

    const fetchRelated = async () => {
      try {
        const data = await apiJson<Incident[]>(`/api/incidents/${incident.id}/related`);
        if (isMounted) setRelatedIncidents(data);
      } catch (e) {
        console.error("Failed to fetch correlations", e);
      }
    };
    
    const fetchLogs = async () => {
      try {
        const data = await apiJson<any[]>(`/api/audit-logs?incidentId=${incident.id}`);
        if (isMounted) setAuditLogs(data);
      } catch (e) {
        console.error("Failed to fetch audit logs", e);
      }
    };

    const fetchFlags = async () => {
      try {
        const flags = await adminService.getFeatureFlags();
        if (isMounted) setFeatureFlags(flags);
      } catch (e) {
        console.error("Failed to fetch flags");
      }
    };

    fetchRelated();
    fetchLogs();
    fetchFlags();

    return () => {
      isMounted = false;
    };
  }, [incident.id]);

  const filteredLogs = useMemo(() => {
    if (auditFilter === "ALL") return auditLogs;
    return auditLogs.filter(log => {
      if (auditFilter === "SYSTEM") return log.userId === 'api-system' || log.userId === 'system-gateway';
      if (auditFilter === "USER") return log.userId !== 'api-system' && log.userId !== 'system-gateway';
      return log.action.includes(auditFilter);
    });
  }, [auditLogs, auditFilter]);

  const isFeatureEnabled = (name: string) => {
    const flag = featureFlags.find(f => f.name === name);
    return flag ? flag.is_enabled : false;
  };

  const handleExportReport = async () => {
    setExporting(true);
    try {
      toast.loading("Generating full incident report...");
      await incidentService.exportOne(incident.id, incident.ticketNumber);
      toast.dismiss();
      toast.success("Report generated successfully");
    } catch (err) {
      toast.dismiss();
      toast.error("Export failed: System report engine busy");
    } finally {
      setExporting(false);
    }
  };

  const handleEscalate = async () => {
    if (!escalationReason.trim()) {
      toast.error("Please provide a reason for escalation");
      return;
    }
    setEscalating(true);
    try {
      const userRole = role || localStorage.getItem('soc-role') || 'soc_analyst';
      
      await apiJson("/api/tickets/confirm-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ticketId: incident.id, 
          action: 'ESCALATE', 
          evidence: escalationReason,
          role: userRole
        }),
      });

      toast.success("Incident escalated to SOC Lead");
      setEscalationReason("");
    } catch (e: any) {
      toast.error(e.message || "Escalation failed");
    } finally {
      setEscalating(false);
    }
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleCloseTicket = async () => {
    if (incident.evidenceUrl && !isValidUrl(incident.evidenceUrl)) {
      toast.error("Closure BLOCKED: Evidence URL is invalid or malformed.");
      return;
    }

    if (!rootCause.trim()) {
      toast.error("Closure BLOCKED: Root Cause analysis is mandatory.");
      return;
    }

    if (!closureComment.trim()) {
      toast.error("Closure BLOCKED: Closure summary is mandatory.");
      return;
    }

    try {
      await incidentService.updateStatus(incident.id, 'closed', incident.evidenceUrl, closureComment, rootCause);
      toast.success("Incident closed and validated.");
    } catch (error) {
      toast.error("Failed to close ticket");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      await incidentService.uploadEvidence(incident.id, file);
      toast.success("Operational evidence uploaded and validated");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const simulateEmail = async (type: 'alert' | 'daily_digest' | 'reminder') => {
    try {
      const data = await incidentService.simulateNotification(incident, type);
      toast.info(`Email Simulated: ${data.subject}`);
    } catch (e) {
      toast.error("Simulation failed");
    }
  };

  const slaProgress = Math.max(0, Math.min(100, 
    ((Date.now() - incident.detectionTime) / (incident.slaDeadline - incident.detectionTime)) * 100
  ));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
            <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
            Back to list
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold text-foreground">{incident.ticketNumber}</h1>
            <Badge className={incident.severity === 'critical' ? 'bg-error text-white border-none' : 'bg-warning text-white border-none'}>
              {incident.severity}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {viewers.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full"
              >
                <div className="flex -space-x-2 mr-1">
                  {viewers.map((v, i) => (
                    <div 
                      key={v.id} 
                      className="w-6 h-6 rounded-full bg-primary border-2 border-background flex items-center justify-center text-[8px] font-black text-white uppercase shadow-sm"
                      title={`${v.name} is viewing this ticket`}
                    >
                      {v.name.substring(0, 1)}
                    </div>
                  ))}
                </div>
                <span className="text-[9px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                   <Eye size={10} className="animate-pulse" /> {viewers.length} Active Operative{viewers.length > 1 ? 's' : ''}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <Button 
            variant="outline"
            size="sm"
            onClick={handleExportReport}
            disabled={exporting}
            className="border-primary/20 text-primary hover:bg-primary/10 gap-2 uppercase font-bold text-[10px]"
          >
            <Download size={14} />
            {exporting ? "Generating..." : "Export Report"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl font-display font-bold text-foreground">{incident.alertName}</CardTitle>
                  <CardDescription className="text-muted-foreground mt-1">Detected at {new Date(incident.detectionTime).toLocaleString()}</CardDescription>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">SLA Countdown</span>
                  <SLACountdown deadline={incident.slaDeadline} className="text-xl" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <DetailItem icon={<Server className="w-4 h-4" />} label="Affected Host" value={incident.host} />
                <DetailItem icon={<Shield className="w-4 h-4" />} label="Domain" value={incident.domain} />
                <DetailItem icon={<AlertCircle className="w-4 h-4" />} label="Current Status" value={incident.status.toUpperCase()} />
                <DetailItem icon={<Mail className="w-4 h-4" />} label="Incident Source" value={incident.source || 'MANUAL'} />
              </div>
              
              <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                <h3 className="text-sm font-semibold text-foreground/80 mb-2">Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{incident.description}</p>
              </div>

              {/* SLA Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground uppercase tracking-wider">SLA Exposure</span>
                  <span className={slaProgress > 80 ? "text-error" : "text-muted-foreground"}>{Math.round(slaProgress)}%</span>
                </div>
                <Progress value={slaProgress} className="h-2 bg-secondary" indicatorClassName={slaProgress > 80 ? "bg-error" : "bg-primary"} />
              </div>
            </CardContent>
          </Card>

          {/* Email Timeline Section */}
          {incident.source === 'EMAIL' && (
            <Card className="bg-card border-border border-t-2 border-t-primary/30 shadow-sm">
               <CardHeader className="py-4 border-b border-border flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <CardTitle className="text-sm font-display font-bold uppercase tracking-widest text-foreground/80">Email History</CardTitle>
                  </div>
               </CardHeader>
               <CardContent className="p-0">
                  <EmailTimeline incidentId={incident.id} />
               </CardContent>
            </Card>
          )}

          {/* Correlation Records Section */}
          <Card className="bg-card border-border border-t-2 border-t-primary/20 shadow-sm">
            <CardHeader className="py-4 border-b border-border flex flex-row items-center justify-between">
               <div className="flex items-center gap-2">
                 <LinkIcon className="w-4 h-4 text-primary" />
                 <CardTitle className="text-sm font-display font-bold uppercase tracking-widest text-foreground/80">Correlation Intelligence</CardTitle>
               </div>
               {relatedIncidents.length > 0 && (
                 <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-none px-2">
                   {relatedIncidents.length} Related
                 </Badge>
               )}
            </CardHeader>
            <CardContent className="p-0">
              {relatedIncidents.length === 0 ? (
                <div className="p-8 text-center bg-secondary/20">
                  <p className="text-xs text-muted-foreground italic tracking-tight font-medium">No tactical correlations identified within current dataset.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {relatedIncidents.map((related) => (
                    <div 
                      key={related.id} 
                      onClick={() => onSelectIncident(related)}
                      className="flex items-center justify-between p-4 bg-transparent hover:bg-secondary/40 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary opacity-40 group-hover:opacity-100 transition-opacity" />
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                             <span className="text-[11px] font-mono font-black text-primary uppercase tracking-tighter">{related.ticketNumber}</span>
                             <Badge className={cn(
                               "text-[8px] h-3.5 px-1.5 border-none font-bold uppercase",
                               related.severity === 'critical' ? 'bg-error text-white' : 'bg-warning text-white'
                             )}>
                               {related.severity}
                             </Badge>
                          </div>
                          <span className="text-xs font-bold text-foreground/80 group-hover:text-primary transition-colors uppercase">{related.alertName}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Target: {related.host}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-muted-foreground/60">{new Date(related.detectionTime).toLocaleDateString()}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Visual Link Analysis Section (Conditional) */}
          {isFeatureEnabled('graph_intelligence') && (
            <Card className="bg-card border-border border-t-2 border-t-primary/30 shadow-sm">
              <CardHeader className="py-4 border-b border-border flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm font-display font-bold uppercase tracking-widest text-foreground/80">Neural Correlation Graph</CardTitle>
                </div>
                <Badge variant="outline" className="text-[9px] border-primary/30 text-primary uppercase font-black bg-primary/5">
                  LIVE_GRAPH
                </Badge>
              </CardHeader>
              <CardContent className="p-4">
                <VisualLinkAnalysis incident={incident} relatedIncidents={relatedIncidents} />
              </CardContent>
            </Card>
          )}

          {/* Threat Intelligence Enrichment Section */}
          {incident.metadata?.threatIntel && (
            <Card className="bg-card border-border border-t-2 border-t-error/30 shadow-sm">
              <CardHeader className="py-4 border-b border-border flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-error" />
                  <CardTitle className="text-sm font-display font-bold uppercase tracking-widest text-foreground/80">Threat Intel Enrichment</CardTitle>
                </div>
                <Badge variant="outline" className="text-[9px] border-error/30 text-error uppercase font-black bg-error/5">
                  AUTO_ENRICHED
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {incident.metadata.threatIntel.indicators.map((indicator: any, idx: number) => (
                    <div key={idx} className="p-4 flex items-center justify-between hover:bg-error/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded flex items-center justify-center font-bold text-[10px]",
                          indicator.score > 70 ? "bg-error text-white" : 
                          indicator.score > 40 ? "bg-warning text-white" : 
                          "bg-success text-white"
                        )}>
                          {indicator.score}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground/90 font-mono tracking-tight">{indicator.value}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                            {indicator.type} • {indicator.provider}
                          </p>
                        </div>
                      </div>
                      <Badge className={cn(
                        "text-[9px] h-4 font-black px-1.5 border-none",
                        indicator.score > 70 ? "bg-error text-white" : 
                        indicator.score > 40 ? "bg-warning text-white" : 
                        "bg-success text-white"
                      )}>
                        {indicator.score > 70 ? "MALICIOUS" : indicator.score > 40 ? "SUSPICIOUS" : "CLEAN"}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-secondary/30 border-t border-border">
                  <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                    {incident.metadata.threatIntel.summary}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Actions & Evidence */}
        <div className="space-y-6">
          <Card className="bg-card border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground">Forensic & Closure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border-2 border-dashed border-border rounded-lg hover:border-primary/20 transition-colors text-center bg-background/50">
                <FileUp className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground mb-4 font-mono">Select Evidence (Screenshots, logs)</p>
                <Label className="cursor-pointer">
                  <Input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  <div className="bg-secondary hover:bg-secondary/80 text-foreground rounded-md h-9 flex items-center justify-center text-sm font-medium transition-colors border border-border/50">
                    {uploading ? "TRANSMITTING..." : "ATTACH FILE"}
                  </div>
                </Label>
              </div>

              {incident.evidenceUrl && (
                <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg group shadow-inner">
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-black text-success uppercase tracking-tighter">Evidence Attached</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[200px] font-mono">{incident.evidenceUrl.split('/').pop()}</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-success/30 text-success hover:bg-success/10 h-7 text-[9px] uppercase font-black tracking-widest shrink-0"
                    onClick={() => setPreviewUrl(incident.evidenceUrl!)}
                  >
                    <Maximize2 size={10} className="mr-1" /> Preview
                  </Button>
                </div>
              )}

              <div className="space-y-3 pt-2 border-t border-border/50">
                <Label htmlFor="rootCause" className="text-[10px] uppercase font-bold text-muted-foreground mr-1 flex items-center gap-2">
                   <Shield className="w-3 h-3" /> Root Cause Analysis
                </Label>
                <textarea 
                  id="rootCause"
                  value={rootCause || incident.rootCause || ""}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="Identify initial attack vector..."
                  className="flex min-h-[60px] w-full rounded-lg border border-border bg-background px-4 py-3 text-xs font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 text-foreground transition-all placeholder:opacity-20 shadow-inner"
                  disabled={incident.status === 'closed'}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="closureComment" className="text-[10px] uppercase font-bold text-muted-foreground mr-1 flex items-center gap-2">
                   <FileText className="w-3 h-3" /> Tactical Narrative
                </Label>
                <div className="relative group">
                  <textarea 
                    id="closureComment"
                    value={closureComment || incident.closureComment || ""}
                    onChange={(e) => setClosureComment(e.target.value)}
                    placeholder="Technical remediation steps..."
                    className="flex min-h-[120px] w-full rounded-lg border border-border bg-background px-4 py-3 text-xs font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 text-foreground transition-all placeholder:opacity-20 shadow-inner"
                    disabled={incident.status === 'closed'}
                  />
                  <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Badge variant="secondary" className="bg-background text-[7px] border-border/50 uppercase font-black tracking-tighter">MD_SECURE</Badge>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleCloseTicket} 
                className="w-full bg-primary hover:opacity-90 h-11 font-black uppercase tracking-widest text-white shadow-lg shadow-primary/10"
                disabled={incident.status === 'closed'}
              >
                PROCEED TO CLOSURE
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Operational Audit</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu 
                  trigger={<Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground"><Filter size={12} /></Button>}
                  content={
                    <div className="p-2 w-48 space-y-1">
                       <p className="text-[8px] font-black uppercase text-muted-foreground px-2 pb-1 border-b border-border/50 mb-1">Filter by Type</p>
                       {["ALL", "USER", "SYSTEM", "UPDATE", "EMAIL", "ESCALATE"].map(f => (
                         <button 
                          key={f} 
                          onClick={() => setAuditFilter(f)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded text-[10px] font-bold uppercase transition-colors hover:bg-primary/10",
                            auditFilter === f ? "text-primary bg-primary/5" : "text-muted-foreground"
                          )}
                         >
                           {f}
                         </button>
                       ))}
                    </div>
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Audit Heatmap */}
              <div className="pt-2 pb-4">
                 <AuditHeatmap logs={auditLogs} />
              </div>
              
              <div className="max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/10 space-y-4">
                {filteredLogs.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/30 italic text-center py-8">No records match the active tactical filter.</div>
                ) : (
                  filteredLogs.map((log) => (
                    <div key={log.id}>
                      <LogEntry 
                        user={log.userId === 'api-system' || log.userId === 'system-gateway' ? "System" : "Operative"} 
                        action={log.action}
                        rawDetails={log.details}
                        time={formatDistanceToNow(log.timestamp) + " ago"} 
                      />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Evidence Preview Modal */}
      <AnimatePresence>
        {previewUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-5xl h-[85vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
             >
                <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-success/10 rounded-lg"><CheckCircle2 className="w-4 h-4 text-success" /></div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Forensic Evidence Preview</h3>
                        <p className="text-[10px] text-muted-foreground font-mono">{previewUrl.split('/').pop()}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="text-[10px] font-bold gap-2" onClick={() => window.open(previewUrl, '_blank')}>
                        <ExternalLink size={12} /> External Open
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setPreviewUrl(null)} className="hover:bg-error/10 hover:text-error">
                        <X size={18} />
                      </Button>
                   </div>
                </div>
                <div className="flex-1 bg-black/40 overflow-auto flex items-center justify-center p-8">
                   {previewUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                     <img src={previewUrl} alt="Evidence" className="max-w-full max-h-full object-contain rounded shadow-2xl border border-white/5" />
                   ) : (
                     <iframe src={previewUrl} className="w-full h-full border-none rounded bg-white/5" title="Evidence Viewer" />
                   )}
                </div>
                <div className="p-4 bg-secondary/10 border-t border-border text-center">
                   <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 italic">Secure Forensic Sandbox Integrity Active</p>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const AuditHeatmap = ({ logs }: { logs: any[] }) => {
  // Simple hour-based distribution for current day activity
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const intensity = (hour: number) => {
    const count = logs.filter(l => {
      const d = new Date(l.timestamp);
      return d.getHours() === hour;
    }).length;
    if (count === 0) return 'bg-border/20';
    if (count < 3) return 'bg-primary/20';
    if (count < 6) return 'bg-primary/40';
    return 'bg-primary/80 animate-pulse-glow';
  };

  return (
    <div className="space-y-3">
       <div className="flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
             <Calendar size={10} className="text-primary" /> Daily Activity Pulse
          </span>
          <span className="text-[8px] font-mono text-muted-foreground/40 italic">24H_CYCLE_MATRIX</span>
       </div>
       <div className="flex gap-[2px] h-3">
          {hours.map(h => (
            <div 
              key={h} 
              title={`Hour ${h}:00 activity intensity`}
              className={cn("flex-1 rounded-[1px] transition-all", intensity(h))} 
            />
          ))}
       </div>
       <div className="flex justify-between text-[7px] font-black text-muted-foreground/40 px-[1px]">
          <span>00:00</span>
          <span>12:00</span>
          <span>23:59</span>
       </div>
    </div>
  );
};

// Simple custom dropdown since UI components might be limited
const DropdownMenu = ({ trigger, content }: { trigger: React.ReactNode, content: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const click = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', click);
    return () => document.removeEventListener('mousedown', click);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div className="absolute right-0 mt-2 z-[60] bg-card border border-border rounded-lg shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
           {content}
        </div>
      )}
    </div>
  );
};

function EmailTimeline({ incidentId }: { incidentId: string }) {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const fetchEmails = async () => {
    try {
      const data = await apiJson<any[]>(`/api/mail/logs?incidentId=${incidentId}`);
      setEmails(data.filter((e: any) => e.incident_id === incidentId));
    } catch (e) {
      console.error("Failed to fetch email logs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [incidentId]);

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await mailService.sendReply(incidentId, replyText);
      toast.success("Response transmitted to reporter");
      setReplyText("");
      fetchEmails(); // Refresh timeline to show sent email
    } catch (err: any) {
      toast.error("Transmission failure", {
        description: err.message || "Check SMTP configuration in settings."
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs text-muted-foreground uppercase animate-pulse">Synchronizing Mail Feed...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="divide-y divide-border overflow-y-auto max-h-[400px] scrollbar-thin scrollbar-thumb-primary/10">
        {emails.map((email) => (
          <div key={email.id} className="p-4 bg-transparent hover:bg-primary/5 transition-all group border-l-2 border-l-transparent hover:border-l-primary/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant={email.processed_status === 'SENT' ? 'default' : 'secondary'} className={cn(
                  "text-[8px] uppercase font-black tracking-tighter border-none px-2",
                  email.processed_status === 'SENT' ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                )}>
                  {email.processed_status}
                </Badge>
                <span className="text-[10px] font-mono text-muted-foreground font-bold">{email.sender}</span>
              </div>
              <span className="text-[9px] text-muted-foreground opacity-50">{new Date(email.received_at).toLocaleString()}</span>
            </div>
            <h4 className="text-xs font-black text-foreground/90 mb-1 flex items-center gap-2 uppercase tracking-tight">
              {email.processed_status === 'SENT' && <Send size={10} className="text-primary" />}
              {email.subject}
            </h4>
            <div className="mt-2 p-3 bg-secondary/30 rounded border border-border/50 group-hover:border-primary/20 transition-all">
               <p className="text-[11px] text-muted-foreground line-clamp-3 group-hover:line-clamp-none transition-all cursor-pointer leading-relaxed">
                  {email.processed_status === 'SENT' ? "Outgoing secure communication transmitted to reporter via SMTP relay." : "Incident updated via automated secure email ingestion protocol."}
               </p>
            </div>
          </div>
        ))}
        {emails.length === 0 && (
          <div className="p-12 text-center bg-secondary/10">
            <p className="text-xs text-muted-foreground italic opacity-50 font-medium">No automated email records found for this incident thread.</p>
          </div>
        )}
      </div>
      
      {/* Reply Box */}
      <div className="p-4 border-t border-border bg-secondary/30">
         <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Reply size={12} className="text-primary" /> Transmit Tactical Response
               </span>
               <div className="flex gap-1">
                  <Badge variant="outline" className="text-[7px] border-primary/30 text-primary/60 uppercase font-black">SMTP_TLS_ENCRYPTED</Badge>
               </div>
            </div>
            <textarea 
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="COMPOSE TACTICAL RESPONSE..."
              className="flex min-h-[80px] w-full rounded-lg border border-border bg-background px-4 py-3 text-xs font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 text-foreground transition-all placeholder:text-primary/10 shadow-inner"
              disabled={sending}
            />
            <div className="flex justify-end">
               <Button 
                onClick={handleSendReply}
                disabled={sending || !replyText.trim()}
                className="bg-primary hover:opacity-90 text-white font-black uppercase tracking-widest text-[9px] h-9 px-6 shadow-lg shadow-primary/10 transition-all"
               >
                 {sending ? <Loader2 size={12} className="animate-spin mr-2" /> : <Send size={12} className="mr-2" />}
                 TRANSMIT REPLY
               </Button>
            </div>
         </div>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-start gap-4 group">
      <div className="p-2 bg-secondary rounded-lg text-muted-foreground group-hover:text-primary group-hover:bg-primary/5 transition-all shadow-sm border border-border/20">{icon}</div>
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">{label}</p>
        <p className="text-sm font-bold text-foreground mt-0.5 tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function LogEntry({ user, action, rawDetails, time }: { user: string, action: string, rawDetails: string, time: string }) {
  let friendlyAction = action;
  let icon = <Shield className="w-3 h-3 text-primary" />;
  let detailsText = rawDetails;

  const tryParseJSON = (str: string) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  };

  const parsed = tryParseJSON(rawDetails);

  if (action === 'CREATE_INCIDENT') {
    friendlyAction = "Registered a new incident";
    icon = <AlertCircle className="w-3 h-3 text-error" />;
    detailsText = rawDetails;
  } else if (action === 'UPDATE_INCIDENT') {
    friendlyAction = "Modified incident parameters";
    icon = <Edit2 className="w-3 h-3 text-primary" />;
    
    if (parsed) {
      if (parsed.status === 'closed') {
        friendlyAction = "Closed the incident";
        icon = <CheckCircle2 className="w-3 h-3 text-success" />;
        detailsText = `Reason: ${parsed.closureComment || 'Standard workflow closure'}`;
        if (parsed.rootCause) {
           detailsText += ` | Root Cause: ${parsed.rootCause}`;
        }
      } else {
        const keys = Object.keys(parsed)
          .filter(k => k !== 'updatedAt')
          .map(k => k.replace(/([A-Z])/g, ' $1').toLowerCase())
          .join(', ');
        detailsText = `Updated fields: ${keys}`;
      }
    } else {
      // Fallback if not valid JSON
      detailsText = rawDetails || "System state updated";
    }
  } else if (action === 'ESCALATE' || action === 'ESCALATE_INCIDENT') {
    friendlyAction = "Escalated the incident";
    icon = <AlertTriangle className="w-3 h-3 text-warning" />;
    detailsText = rawDetails ? rawDetails.replace("Action via API. Detail: ", "") : "Level 2 intervention requested";
  } else if (action === 'UPLOAD_EVIDENCE') {
    friendlyAction = "Uploaded forensic evidence";
    icon = <FileUp className="w-3 h-3 text-primary" />;
  } else if (action === 'CONFIRM_CLOSED_EMAIL') {
    friendlyAction = "Closed via Email Link";
    icon = <CheckCircle2 className="w-3 h-3 text-success" />;
  } else if (action === 'REQUEST_EXTENSION_EMAIL' || action === 'REQUEST_EXTENSION') {
    friendlyAction = "Requested SLA Extension";
    icon = <Clock className="w-3 h-3 text-warning" />;
  } else if (action === 'ACK_NOT_CLOSED') {
    friendlyAction = "Acknowledged Open Status via Email";
    icon = <Mail className="w-3 h-3 text-primary" />;
  }

  return (
    <div className="flex gap-3 text-xs mb-3 group">
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded-full bg-secondary/50 flex items-center justify-center border border-border group-hover:border-primary/30 transition-colors shadow-sm">
          {icon}
        </div>
        <div className="w-[1px] h-full bg-border mt-1 group-last:hidden" />
      </div>
      <div className="pb-3 flex-1">
        <p className="text-foreground/90 leading-tight">
          <span className="font-bold text-primary mr-1 uppercase">{user}</span>
          {friendlyAction}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1 font-mono bg-secondary/40 p-1.5 rounded inline-block border border-border/50 leading-relaxed max-w-full overflow-hidden text-ellipsis">
          {detailsText}
        </p>
        <p className="text-[8px] text-muted-foreground/40 mt-1 uppercase tracking-widest flex items-center gap-1 font-black">
          <Clock className="w-2 h-2" /> {time}
        </p>
      </div>
    </div>
  );
}
