import React, { useState, useEffect } from "react";
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
  Link as LinkIcon, Mail
} from "lucide-react";
import { Incident } from "../types";
import { incidentService } from "../services/incidentService";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
  const [uploading, setUploading] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [escalationReason, setEscalationReason] = useState("");
  const [closureComment, setClosureComment] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [relatedIncidents, setRelatedIncidents] = useState<Incident[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchRelated = async () => {
      try {
        const response = await fetch(`/api/incidents/${incident.id}/related`);
        if (response.ok) {
          const data = await response.json();
          setRelatedIncidents(data);
        }
      } catch (e) {
        console.error("Failed to fetch correlations", e);
      }
    };
    
    const fetchLogs = async () => {
      try {
        const response = await fetch(`/api/audit-logs?incidentId=${incident.id}`);
        if (response.ok) {
          const data = await response.json();
          setAuditLogs(data);
        }
      } catch (e) {
        console.error("Failed to fetch audit logs", e);
      }
    };

    fetchRelated();
    fetchLogs();
  }, [incident.id]);

  const handleEscalate = async () => {
    if (!escalationReason.trim()) {
      toast.error("Please provide a reason for escalation");
      return;
    }
    setEscalating(true);
    try {
      const userRole = role || localStorage.getItem('soc-role') || 'soc_analyst';
      
      const response = await fetch("/api/tickets/confirm-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ticketId: incident.id, 
          action: 'ESCALATE', 
          evidence: escalationReason,
          role: userRole
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Escalation failed");
      }

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
    if (!incident.evidenceUrl) {
      toast.error("Closure BLOCKED: Evidence URL is missing.");
      return;
    }

    if (!isValidUrl(incident.evidenceUrl)) {
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
      className="space-y-6"
    >
      <div className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
          <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
          Back to list
        </Button>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-display font-bold text-foreground">{incident.ticketNumber}</h1>
          <Badge className={incident.severity === 'critical' ? 'bg-primary text-white' : 'bg-orange-600 text-white'}>
            {incident.severity}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl font-display font-bold text-foreground">{incident.alertName}</CardTitle>
                  <CardDescription className="text-muted-foreground mt-1">Detected at {new Date(incident.detectionTime).toLocaleString()}</CardDescription>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">SLA Countdown</span>
                  <div className="text-xl font-mono font-bold text-primary">
                    {formatDistanceToNow(incident.slaDeadline)} left
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-8">
                <DetailItem icon={<Server className="w-4 h-4" />} label="Affected Host" value={incident.host} />
                <DetailItem icon={<Shield className="w-4 h-4" />} label="Domain" value={incident.domain} />
                <DetailItem icon={<AlertCircle className="w-4 h-4" />} label="Current Status" value={incident.status.toUpperCase()} />
                <DetailItem icon={<Mail className="w-4 h-4" />} label="Incident Source" value={incident.source || 'MANUAL'} />
              </div>
              
              <div className="p-4 bg-secondary rounded-lg">
                <h3 className="text-sm font-semibold text-foreground/80 mb-2">Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{incident.description}</p>
              </div>

              {/* SLA Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground uppercase tracking-wider">SLA Exposure</span>
                  <span className={slaProgress > 80 ? "text-primary" : "text-muted-foreground"}>{Math.round(slaProgress)}%</span>
                </div>
                <Progress value={slaProgress} className="h-2 bg-secondary" indicatorClassName={slaProgress > 80 ? "bg-primary" : "bg-primary/80"} />
              </div>
            </CardContent>
          </Card>

          {/* System Remediation Guidance Section */}
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="bg-secondary/50 flex flex-row items-center justify-between py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-500" />
                <CardTitle className="text-sm font-display font-bold uppercase tracking-widest text-foreground/80">Remediation Guidance</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
               <div className="space-y-4">
                  <div className="flex gap-4">
                     <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center text-blue-500 text-xs font-bold">1</div>
                     <div className="flex-1">
                        <p className="text-xs font-bold text-foreground/90 uppercase mb-1">Containment</p>
                        <p className="text-xs text-muted-foreground">Isolate the affected host from the internal production network immediately.</p>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center text-blue-500 text-xs font-bold">2</div>
                     <div className="flex-1">
                        <p className="text-xs font-bold text-foreground/90 uppercase mb-1">Eradication</p>
                        <p className="text-xs text-muted-foreground">Rotate all service account credentials associated with {incident.host}.</p>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center text-blue-500 text-xs font-bold">3</div>
                     <div className="flex-1">
                        <p className="text-xs font-bold text-foreground/90 uppercase mb-1">Recovery</p>
                        <p className="text-xs text-muted-foreground">Perform full system scan and restore from valid backup if corruption found.</p>
                     </div>
                  </div>
               </div>
            </CardContent>
          </Card>

          {/* Email Timeline Section */}
          {incident.source === 'EMAIL' && (
            <Card className="bg-card border-border border-t-2 border-t-primary/30">
               <CardHeader className="py-4 border-b border-border flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <CardTitle className="text-sm font-display font-bold uppercase tracking-widest text-foreground/80">Email Communication History</CardTitle>
                  </div>
               </CardHeader>
               <CardContent className="p-0">
                  <EmailTimeline incidentId={incident.id} />
               </CardContent>
            </Card>
          )}

          {/* Correlation Records Section */}
          <Card className="bg-card border-border border-t-2 border-t-blue-500/30">
            <CardHeader className="py-4 border-b border-border flex flex-row items-center justify-between">
               <div className="flex items-center gap-2">
                 <LinkIcon className="w-4 h-4 text-blue-500" />
                 <CardTitle className="text-sm font-display font-bold uppercase tracking-widest text-foreground/80">Correlation Intelligence</CardTitle>
               </div>
               {relatedIncidents.length > 0 && (
                 <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-500 border-none px-2">
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
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                             <span className="text-[11px] font-mono font-black text-blue-500 uppercase tracking-tighter">{related.ticketNumber}</span>
                             <Badge className={cn(
                               "text-[8px] h-3.5 px-1.5 border-none font-bold uppercase",
                               related.severity === 'critical' ? 'bg-red-500' : 'bg-orange-500'
                             )}>
                               {related.severity}
                             </Badge>
                          </div>
                          <span className="text-xs font-bold text-foreground/80 group-hover:text-primary transition-colors">{related.alertName}</span>
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
        </div>

        {/* Right Column: Actions & Evidence */}
        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-display font-bold uppercase tracking-wider text-muted-foreground">Closure Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border-2 border-dashed border-border rounded-lg hover:border-primary/20 transition-colors text-center">
                <FileUp className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground mb-4 font-mono">Evidence Required (Screenshot, PDF, Logs)</p>
                <Label className="cursor-pointer">
                  <Input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  <div className="bg-secondary hover:bg-secondary/80 text-foreground rounded-md h-9 flex items-center justify-center text-sm font-medium transition-colors">
                    {uploading ? "Uploading..." : "Select File"}
                  </div>
                </Label>
              </div>

              {incident.evidenceUrl && (
                <div className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-green-500 truncate">Evidence Verified</p>
                    <p className="text-[10px] text-muted-foreground truncate">{incident.evidenceUrl}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <Label htmlFor="rootCause" className="text-[10px] uppercase font-bold text-muted-foreground mr-1">Root Cause Analysis</Label>
                <textarea 
                  id="rootCause"
                  value={rootCause || incident.rootCause || ""}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="What was the origin of this alert?"
                  className="flex min-h-[60px] w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                  disabled={incident.status === 'closed'}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="closureComment" className="text-[10px] uppercase font-bold text-muted-foreground mr-1">Closure Summary</Label>
                <textarea 
                  id="closureComment"
                  value={closureComment || incident.closureComment || ""}
                  onChange={(e) => setClosureComment(e.target.value)}
                  placeholder="Detail the resolution actions taken..."
                  className="flex min-h-[80px] w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                  disabled={incident.status === 'closed'}
                />
              </div>

              <Button 
                onClick={handleCloseTicket} 
                className="w-full bg-primary hover:opacity-90 h-11 font-bold tracking-tight text-white"
                disabled={!incident.evidenceUrl || incident.status === 'closed'}
              >
                CONFIRM CLOSED
              </Button>
              
              <div className="space-y-3 pt-2">
                <Label htmlFor="escalationReason" className="text-[10px] uppercase font-bold text-muted-foreground mr-1">Escalation Reason</Label>
                <textarea 
                  id="escalationReason"
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  placeholder="Why is level 2 intervention required?"
                  className="flex min-h-[80px] w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                  disabled={escalating || incident.status === 'closed' || incident.status === 'escalated'}
                />
                <Button 
                  variant="outline" 
                  className="w-full border-border bg-secondary h-11 text-muted-foreground font-bold uppercase tracking-tighter"
                  onClick={handleEscalate}
                  disabled={escalating || incident.status === 'closed' || incident.status === 'escalated'}
                >
                  {escalating ? "Escalating..." : "LEVEL 2 ESCALATION"}
                </Button>
              </div>

              {incident.escalationHistory && incident.escalationHistory.length > 0 && (
                <div className="mt-4 space-y-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Escalation History</span>
                  {incident.escalationHistory.map((entry, idx) => (
                    <div key={idx} className="p-3 bg-secondary/50 border border-border rounded-lg text-[11px]">
                      <div className="flex justify-between mb-1">
                        <span className="font-bold text-foreground/80">{entry.userName}</span>
                        <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed italic">"{entry.reason}"</p>
                    </div>
                  ))}
                </div>
              )}

              <Button variant="ghost" className="w-full h-11 text-[10px] text-muted-foreground uppercase font-bold hover:text-primary" onClick={() => simulateEmail('alert')}>
                SIMULATE ALERT EMAIL
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[#0F0F0F] border-white/5">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-white/70">
                <History className="w-4 h-4" />
                Operational Audit Log
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
              {auditLogs.length === 0 ? (
                <div className="text-[10px] text-white/30 italic text-center py-4">No audit entry records found for this unit.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id}>
                    <LogEntry 
                      user={log.userId === 'api-system' ? "System" : "Operative"} 
                      action={`${log.action}: ${log.details}`} 
                      time={formatDistanceToNow(log.timestamp) + " ago"} 
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

function EmailTimeline({ incidentId }: { incidentId: string }) {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const response = await fetch(`/api/mail/logs?incidentId=${incidentId}`);
        if (response.ok) {
          const data = await response.json();
          // Filter logs for this specific incident if backend didn't do it
          setEmails(data.filter((e: any) => e.incident_id === incidentId));
        }
      } catch (e) {
        console.error("Failed to fetch email logs", e);
      } finally {
        setLoading(false);
      }
    };
    fetchEmails();
  }, [incidentId]);

  if (loading) return <div className="p-8 text-center text-xs text-muted-foreground uppercase animate-pulse">Synchronizing Mail Feed...</div>;

  return (
    <div className="divide-y divide-border">
      {emails.map((email) => (
        <div key={email.id} className="p-4 bg-transparent hover:bg-secondary/20 transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[8px] uppercase font-bold tracking-tighter">
                {email.processed_status}
              </Badge>
              <span className="text-[10px] font-mono text-muted-foreground">{email.sender}</span>
            </div>
            <span className="text-[9px] text-muted-foreground">{new Date(email.received_at).toLocaleString()}</span>
          </div>
          <h4 className="text-xs font-bold text-foreground mb-1">{email.subject}</h4>
          <div className="mt-2 p-3 bg-secondary/50 rounded border border-border/50">
             <p className="text-[11px] text-muted-foreground line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
                {/* Simplified view of body if available, or just subject */}
                Incident updated via automated email ingestion.
             </p>
          </div>
        </div>
      ))}
      {emails.length === 0 && (
        <div className="p-8 text-center bg-secondary/20">
          <p className="text-xs text-muted-foreground italic">No automated email records found for this incident thread.</p>
        </div>
      )}
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="p-2 bg-secondary rounded-lg text-muted-foreground">{icon}</div>
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function LogEntry({ user, action, time }: { user: string, action: string, time: string }) {
  return (
    <div className="flex gap-3 text-xs">
      <div className="w-2 h-2 rounded-full bg-border mt-1" />
      <div>
        <p className="text-foreground/80"><span className="font-bold">{user}</span> {action}</p>
        <p className="text-muted-foreground mt-0.5">{time}</p>
      </div>
    </div>
  );
}
