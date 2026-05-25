import React, { useState, useEffect } from "react";
import { 
  Users, 
  User,
  Settings, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  ShieldCheck,
  UserPlus,
  Key,
  Database,
  Eye,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Search,
  Mail,
  FileText,
  CheckCircle2,
  Clock,
  RefreshCw,
  Shield,
  Zap,
  Globe,
  Monitor,
  ShieldAlert,
  Activity,
  LayoutDashboard,
  Filter,
  Save
} from "lucide-react";
import { adminService } from "../services/adminService";
import { mailService } from "../services/mailService";
import { apiJson } from "../services/apiClient";
import { UserProfile, AssignmentRule, UserRole, RoleDefinition } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const PERMISSION_GROUPS = [
  {
    name: "Incident Operations",
    permissions: ["create_incident", "view_all_incidents", "modify_incident", "delete_incident", "escalate_incident"]
  },
  {
    name: "Command & Control",
    permissions: ["manage_users", "manage_rules"]
  },
  {
    name: "Monitoring & Audit",
    permissions: ["view_audit_logs"]
  }
];

const FeatureToggle = ({ feature, onToggle, compact = false }: { feature: any, onToggle: (n: string, s: boolean) => void, compact?: boolean }) => {
  return (
    <div className={cn(
      "p-4 bg-card border border-border rounded-lg flex items-center justify-between hover:border-primary/20 transition-all group shadow-sm",
      compact && "p-2"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center border transition-all",
          feature.is_enabled ? "bg-primary/10 border-primary/20 text-primary" : "bg-secondary/50 border-border text-muted-foreground"
        )}>
          <Activity className={cn("w-4 h-4", feature.is_enabled && "animate-pulse")} />
        </div>
        <div>
          <h4 className="text-[10px] font-bold text-foreground uppercase tracking-tight">
            {feature.name.replace('widget_', '').replace(/_/g, ' ')}
          </h4>
          {!compact && <p className="text-[8px] text-muted-foreground uppercase leading-tight mt-0.5 opacity-60">{feature.description}</p>}
        </div>
      </div>
      <button 
        onClick={() => onToggle(feature.name, feature.is_enabled)}
        className={cn(
          "w-9 h-4.5 rounded-full relative transition-all duration-300 shadow-inner",
          feature.is_enabled ? "bg-primary" : "bg-secondary border border-border"
        )}
      >
        <div className={cn(
          "absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all duration-300 shadow-sm",
          feature.is_enabled ? "left-5" : "left-0.5"
        )} />
      </button>
    </div>
  );
};

export function AdminSettings() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [featureFlags, setFeatureFlags] = useState<Array<{ name: string, is_enabled: boolean, description: string }>>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'rules' | 'roles' | 'mail' | 'features' | 'sessions' | 'sla' | 'templates'>('users');
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  
  const [newUser, setNewUser] = useState<Omit<UserProfile, 'id'>>({ email: '', name: '', role: '', permissions: [], password: '' });
  const [newRule, setNewRule] = useState<Omit<AssignmentRule, 'id'>>({
    name: '',
    keyword: '',
    matchingStrategy: 'contains',
    priority: 0,
    active: true,
    assignedToUserId: 'unassigned',
    assignedToUserName: '',
    severityOverride: 'none',
    autoSlaAssignment: true,
    sendNotifications: true
  });
  const [newRole, setNewRole] = useState<Omit<RoleDefinition, 'id'>>({ name: '', permissions: [], description: '' });

  const [mailSettings, setMailSettings] = useState<any>({ host: '', port: 993, ssl: true, username: '', password: '', poll_interval: 60, is_active: true });
  const [mailLogs, setMailLogs] = useState<any[]>([]);
  const [slaPolicies, setSlaPolicies] = useState<any[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchMailData = async () => {
    try {
      const [settings, logs] = await Promise.all([mailService.getSettings(), mailService.getLogs()]);
      if (settings) setMailSettings({ ...settings, password: '' });
      setMailLogs(logs);
    } catch (e) {
      console.warn("[MAIL] Telemetry sync failed");
    }
  };

  const fetchSessions = async () => {
    try {
      const data = await adminService.getSessions();
      setSessions(data);
    } catch (e) {
      console.warn("[AUTH] Session registry sync failed");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const syncTask = async <T,>(promise: Promise<T>, setter: (v: T) => void, label: string) => {
        try {
          const data = await promise;
          setter(data);
        } catch (e) {
          console.warn(`[SYNC] Failed to synchronize ${label}`);
        }
      };

      await Promise.all([
        syncTask(adminService.getUsers(), setUsers, 'Personnel'),
        syncTask(adminService.getRules(), setRules, 'Routing'),
        syncTask(adminService.getRoles(), setRoles, 'Roles'),
        syncTask(adminService.getFeatureFlags(), setFeatureFlags, 'Features'),
        syncTask(apiJson<any[]>('/api/sla'), setSlaPolicies, 'Benchmarks'),
        syncTask(apiJson<any[]>('/api/templates'), setEmailTemplates, 'Templates')
      ]);
    } catch (e) {
      toast.error("Critical failure during tactical data synchronization");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const unsubUsers = adminService.subscribeToUsers((data) => isMounted && setUsers(data));
    const unsubRules = adminService.subscribeToRules((data) => isMounted && setRules(data));
    const unsubRoles = adminService.subscribeToRoles((data) => isMounted && setRoles(data));
    
    fetchData();
    
    return () => {
      isMounted = false;
      unsubUsers();
      unsubRules();
      unsubRoles();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'mail') fetchMailData();
    else if (activeTab === 'sessions') fetchSessions();
  }, [activeTab]);

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    setLoading(true);
    try {
      await apiJson(`/api/templates/${editingTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTemplate)
      });
      toast.success(`Tactical template '${editingTemplate.name}' updated`);
      const updated = await apiJson<any[]>('/api/templates');
      setEmailTemplates(updated);
      setEditingTemplate(null);
    } catch (e) {
      toast.error("Template synchronization failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await adminService.updateRule(editingId, newRule);
        toast.success("Routing protocol updated");
        setEditingId(null);
      } else {
        await adminService.createRule(newRule);
        toast.success("New tactical routing rule active");
      }
      setNewRule({
        name: '', keyword: '', matchingStrategy: 'contains', priority: 0, active: true,
        assignedToUserId: 'unassigned', assignedToUserName: '', severityOverride: 'none',
        autoSlaAssignment: true, sendNotifications: true
      });
    } catch (e) {
      toast.error("Failed to commit routing rule");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await adminService.updateRole(editingId, newRole);
        toast.success("Role definition updated");
        setEditingId(null);
      } else {
        await adminService.createRole(newRole);
        toast.success("New authorization role created");
      }
      setNewRole({ name: '', permissions: [], description: '' });
    } catch (e) {
      toast.error("Failed to commit role definition");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await adminService.updateUser(editingId, newUser);
        toast.success("Operative record updated");
        setEditingId(null);
      } else {
        await adminService.createUser(newUser);
        toast.success("New operative authorized");
      }
      setNewUser({ email: '', name: '', role: '', permissions: [], password: '' });
    } catch (e: any) {
      toast.error(e.message || "Failed to commit operative record");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSla = async (id: string, response: number, resolution: number) => {
    try {
      await apiJson(`/api/sla/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_time_hours: response, resolution_time_hours: resolution })
      });
      toast.success("SLA policy re-calibrated");
      const data = await apiJson<any[]>('/api/sla');
      setSlaPolicies(data);
    } catch (e) {
      toast.error("Failed to update policy");
    }
  };

  const handleToggleFeature = async (name: string, currentStatus: boolean) => {
    try {
      await adminService.updateFeatureFlag(name, !currentStatus);
      toast.success(`Feature ${name} updated`);
      const flags = await adminService.getFeatureFlags();
      setFeatureFlags(flags);
    } catch (e) {
      toast.error("Failed to update feature");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('DEACTIVATE OPERATIVE: Are you sure you want to revoke access for this node?')) return;
    try {
      await adminService.deleteUser(id);
      toast.success("Operative access revoked");
    } catch (e) {
      toast.error("Deactivation failed: System authority required");
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm('PURGE ROLE: This will affect all operatives currently assigned to this framework. Proceed?')) return;
    try {
      await adminService.deleteRole(id);
      toast.success("Authorization framework purged");
    } catch (e) {
      toast.error("Purge failed: Framework in active use");
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('DECOMMISSION RULE: Tactical routing for this pattern will cease immediately. Proceed?')) return;
    try {
      await adminService.deleteRule(id);
      toast.success("Routing protocol decommissioned");
    } catch (e) {
      toast.error("Decommission failed: Protocol lock active");
    }
  };

  const handleTerminateSession = async (id: string) => {
    if (!confirm('TERMINATE SESSION: Force immediate logout for this operative?')) return;
    try {
      await adminService.terminateSession(id);
      toast.success("Remote session terminated");
      fetchSessions();
    } catch (e) {
      toast.error("Termination failed: Session already inactive");
    }
  };

  const handleSaveMailSettings = async () => {
    setLoading(true);
    try {
      const payload = { ...mailSettings };
      if (!payload.password) delete payload.password;
      await mailService.updateSettings(payload);
      toast.success("Global SMTP/IMAP protocols updated");
    } catch (e) {
      toast.error("Protocol synchronization failure");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-6 gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Security Operations Management</h2>
          <p className="text-primary/50 text-[10px] font-mono uppercase tracking-widest mt-1">Configure system protocols and authorized personnel</p>
        </div>
        <div className="flex flex-wrap bg-secondary/50 p-1 rounded-lg border border-border shadow-sm">
          {[
            { id: 'users', label: 'Personnel', icon: <Users size={12} /> },
            { id: 'roles', label: 'Roles', icon: <ShieldCheck size={12} /> },
            { id: 'rules', label: 'Routing', icon: <Zap size={12} /> },
            { id: 'templates', label: 'Templates', icon: <FileText size={12} /> },
            { id: 'mail', label: 'Mail-Ops', icon: <Mail size={12} /> },
            { id: 'sla', label: 'Benchmarks', icon: <Clock size={12} /> },
            { id: 'features', label: 'Advanced', icon: <Settings size={12} /> },
            { id: 'sessions', label: 'Sessions', icon: <Key size={12} /> }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id as any); setEditingId(null); }}
              className={cn(
                "px-3 py-2 text-[9px] font-bold uppercase tracking-widest rounded flex items-center gap-2 transition-all",
                activeTab === t.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.icon}
              <span className="hidden lg:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
           <AnimatePresence mode="wait">
              {activeTab === 'users' && (
                <motion.div key="users" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <Card className="bg-card border-border shadow-sm overflow-hidden">
                    <CardHeader className="bg-secondary/20 border-b border-border">
                       <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-foreground/80">
                         <Users className="w-4 h-4 text-primary" /> Active Duty Operatives
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                       <div className="divide-y divide-border">
                          {users.map(u => (
                            <div key={u.id} className="p-4 flex items-center justify-between hover:bg-primary/5 transition-all group">
                               <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-black text-primary border border-border">
                                    {u.name.substring(0, 1).toUpperCase()}
                                  </div>
                                  <div>
                                     <p className="text-xs font-bold uppercase tracking-tight">{u.name}</p>
                                     <p className="text-[10px] text-muted-foreground font-mono">{u.email}</p>
                                  </div>
                               </div>
                               <div className="flex items-center gap-4">
                                  <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-primary/30 text-primary bg-primary/5">
                                    {u.role}
                                  </Badge>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => { setEditingId(u.id); setNewUser({...u, password: ''}); }}><Edit2 size={12} /></Button>
                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-error hover:bg-error/10" onClick={() => handleDeleteUser(u.id)}><Trash2 size={12} /></Button>
                                  </div>
                               </div>
                            </div>
                          ))}
                       </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {activeTab === 'roles' && (
                <motion.div key="roles" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <Card className="bg-card border-border shadow-sm overflow-hidden">
                    <CardHeader className="bg-secondary/20 border-b border-border">
                       <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-foreground/80">
                         <ShieldCheck className="w-4 h-4 text-primary" /> Authorization Framework
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                       <div className="divide-y divide-border">
                          {roles.map(r => (
                            <div key={r.id} className="p-6 hover:bg-primary/5 transition-all group">
                               <div className="flex items-center justify-between mb-4">
                                  <div>
                                     <h4 className="text-xs font-black uppercase tracking-widest text-primary">{r.name}</h4>
                                     <p className="text-[10px] text-muted-foreground mt-1">{r.description || 'No operational description'}</p>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => { setEditingId(r.id); setNewRole(r); }}><Edit2 size={12} /></Button>
                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-error hover:bg-error/10" onClick={() => handleDeleteRole(r.id)}><Trash2 size={12} /></Button>
                                  </div>
                               </div>
                               <div className="flex flex-wrap gap-2">
                                  {r.permissions.map(p => (
                                    <Badge key={p} variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-border bg-secondary/30">
                                      {p.replace(/_/g, ' ')}
                                    </Badge>
                                  ))}
                               </div>
                            </div>
                          ))}
                       </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {activeTab === 'rules' && (
                <motion.div key="rules" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <Card className="bg-card border-border shadow-sm overflow-hidden">
                    <CardHeader className="bg-secondary/20 border-b border-border">
                       <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-foreground/80">
                         <Zap className="w-4 h-4 text-primary" /> Tactical Routing Protocols
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                       <div className="divide-y divide-border">
                          {rules.length === 0 ? (
                            <div className="p-20 text-center opacity-30">
                               <Zap className="w-12 h-12 text-primary mx-auto mb-4" />
                               <p className="text-[10px] font-black uppercase tracking-widest">No active routing rules detected</p>
                            </div>
                          ) : rules.map(rule => (
                            <div key={rule.id} className="p-4 flex items-center justify-between hover:bg-primary/5 transition-all group">
                               <div className="flex items-center gap-4">
                                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center border", rule.active ? "bg-primary/10 border-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>
                                     <Zap size={14} className={rule.active ? "animate-pulse" : ""} />
                                  </div>
                                  <div>
                                     <p className="text-xs font-bold uppercase tracking-tight">{rule.name}</p>
                                     <p className="text-[10px] text-muted-foreground font-mono">KW: <span className="text-primary">{rule.keyword}</span> ({rule.matchingStrategy})</p>
                                  </div>
                               </div>
                               <div className="flex items-center gap-4">
                                  <div className="text-right">
                                     <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Assign To</p>
                                     <p className="text-[10px] font-bold text-primary uppercase tracking-tighter">{rule.assignedToUserName || 'Global Pool'}</p>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => { setEditingId(rule.id); setNewRule(rule); }}><Edit2 size={12} /></Button>
                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-error hover:bg-error/10" onClick={() => handleDeleteRule(rule.id)}><Trash2 size={12} /></Button>
                                  </div>
                               </div>
                            </div>
                          ))}
                       </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {activeTab === 'sessions' && (
                <motion.div key="sessions" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                   <Card className="bg-card border-border shadow-sm overflow-hidden">
                      <CardHeader className="bg-secondary/20 border-b border-border flex flex-row items-center justify-between">
                         <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-foreground/80">
                           <Key className="w-4 h-4 text-primary" /> Active Duty Telemetry
                         </CardTitle>
                         <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={fetchSessions}><RefreshCw size={14} /></Button>
                      </CardHeader>
                      <CardContent className="p-0">
                         <div className="divide-y divide-border">
                            {sessions.map(session => (
                              <div key={session.id} className="p-4 flex items-center justify-between hover:bg-primary/5 transition-all">
                                 <div className="flex items-center gap-4">
                                    <div className="relative">
                                       <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-black text-primary border border-border">
                                          {session.user_name?.substring(0, 1).toUpperCase()}
                                       </div>
                                       <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-success rounded-full border-2 border-card shadow-sm" />
                                    </div>
                                    <div>
                                       <p className="text-xs font-bold uppercase tracking-tight">{session.user_name}</p>
                                       <p className="text-[10px] text-muted-foreground font-mono">{session.ip_address || 'Internal Node'} • {session.user_agent?.split(' ')[0]}</p>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <div className="text-right">
                                       <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Active Since</p>
                                       <p className="text-[10px] font-mono opacity-60">{formatDistanceToNow(new Date(session.created_at))} ago</p>
                                    </div>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 text-muted-foreground hover:text-error hover:bg-error/10"
                                      onClick={() => handleTerminateSession(session.id)}
                                    >
                                       <X size={12} />
                                    </Button>
                                 </div>
                              </div>
                            ))}
                         </div>
                      </CardContent>
                   </Card>
                </motion.div>
              )}

              {activeTab === 'mail' && (
                <motion.div key="mail" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
                   <Card className="bg-card border-border shadow-sm">
                      <CardHeader className="bg-secondary/20 border-b border-border flex flex-row items-center justify-between">
                         <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-foreground/80">
                           <Mail className="w-4 h-4 text-primary" /> SMTP/IMAP Node Status
                         </CardTitle>
                         <div className="flex items-center gap-2">
                           <div className={cn(
                             "w-2 h-2 rounded-full",
                             mailSettings.last_sync_status === 'CONNECTED' ? "bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-error"
                           )} />
                           <span className="text-[10px] font-black uppercase tracking-widest text-foreground/70">
                             {mailSettings.last_sync_status || 'UNKNOWN'}
                           </span>
                         </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                         {mailSettings.last_error && (
                           <div className="p-3 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
                             <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                             <div className="text-[10px] font-bold text-error uppercase leading-tight">
                               Connection Fault: {mailSettings.last_error}
                             </div>
                           </div>
                         )}

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                               <Label className="text-[10px] uppercase font-bold text-muted-foreground">Ingestion Host</Label>
                               <Input value={mailSettings.host} onChange={e => setMailSettings({...mailSettings, host: e.target.value})} className="bg-background/50 border-border text-xs focus:border-primary/50" placeholder="imap.gmail.com" />
                            </div>
                            <div className="space-y-2">
                               <Label className="text-[10px] uppercase font-bold text-muted-foreground">Secure Port</Label>
                               <Input type="number" value={mailSettings.port} onChange={e => setMailSettings({...mailSettings, port: parseInt(e.target.value)})} className="bg-background/50 border-border text-xs focus:border-primary/50" />
                            </div>
                            <div className="space-y-2">
                               <Label className="text-[10px] uppercase font-bold text-muted-foreground">Command Email</Label>
                               <Input value={mailSettings.username} onChange={e => setMailSettings({...mailSettings, username: e.target.value})} className="bg-background/50 border-border text-xs focus:border-primary/50" placeholder="soc@company.com" />
                            </div>
                            <div className="space-y-2">
                               <Label className="text-[10px] uppercase font-bold text-muted-foreground">Secret Token</Label>
                               <Input type="password" value={mailSettings.password} onChange={e => setMailSettings({...mailSettings, password: e.target.value})} className="bg-background/50 border-border text-xs focus:border-primary/50" placeholder="••••••••" />
                            </div>
                         </div>
                         
                         <div className="flex items-center justify-between">
                           <Button onClick={handleSaveMailSettings} disabled={loading} className="bg-primary hover:opacity-90 text-white font-black uppercase tracking-widest text-[10px] h-10 px-8 border-none shadow-lg shadow-primary/10">
                             {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                             Update Ingestion Node
                           </Button>

                           {mailSettings.last_sync_at && (
                             <div className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest opacity-60">
                               Last synchronization: {new Date(mailSettings.last_sync_at).toLocaleString()}
                             </div>
                           )}
                         </div>
                      </CardContent>
                   </Card>
                </motion.div>
              )}

              {activeTab === 'features' && (
                <motion.div key="features" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {featureFlags.map(f => (
                        <FeatureToggle key={f.name} feature={f} onToggle={handleToggleFeature} />
                      ))}
                   </div>
                </motion.div>
              )}
              
              {activeTab === 'sla' && (
                <motion.div key="sla" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                   <Card className="bg-card border-border shadow-sm">
                      <CardHeader className="bg-secondary/20 border-b border-border flex flex-row items-center justify-between">
                         <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                           <Clock className="w-4 h-4 text-primary" /> Performance Benchmarks
                         </CardTitle>
                         <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={fetchData}><RefreshCw size={14} /></Button>
                      </CardHeader>
                      <CardContent className="p-0">
                         <div className="divide-y divide-border">
                            {slaPolicies.map(policy => (
                              <div key={policy.id} className="p-6 flex items-center justify-between hover:bg-primary/5 transition-all">
                                 <div className="flex items-center gap-4">
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-[10px] shadow-lg", 
                                      policy.severity === 'critical' ? 'bg-error shadow-error/20' : 
                                      policy.severity === 'high' ? 'bg-warning shadow-warning/20' : 
                                      'bg-primary shadow-primary/20'
                                    )}>
                                      {policy.severity.substring(0, 3).toUpperCase()}
                                    </div>
                                    <div>
                                       <h4 className="text-xs font-black uppercase tracking-widest text-foreground">{policy.severity} Severity</h4>
                                       <p className="text-[10px] text-muted-foreground font-mono">Protocol Enforcement Cycle</p>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-8">
                                    <div className="text-center">
                                       <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">ACK Limit</p>
                                       <div className="flex items-center gap-2">
                                          <input 
                                            type="number" 
                                            className="w-12 bg-background border border-border rounded text-center text-xs font-black text-primary p-1 focus:border-primary/50" 
                                            defaultValue={policy.response_time_hours}
                                            onBlur={(e) => handleUpdateSla(policy.id, parseInt(e.target.value), policy.resolution_time_hours)}
                                          />
                                          <span className="text-[9px] font-bold text-muted-foreground">HRS</span>
                                       </div>
                                    </div>
                                    <div className="text-center">
                                       <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">RES Limit</p>
                                       <div className="flex items-center gap-2">
                                          <input 
                                            type="number" 
                                            className="w-12 bg-background border border-border rounded text-center text-xs font-black text-primary p-1 focus:border-primary/50" 
                                            defaultValue={policy.resolution_time_hours}
                                            onBlur={(e) => handleUpdateSla(policy.id, policy.response_time_hours, parseInt(e.target.value))}
                                          />
                                          <span className="text-[9px] font-bold text-muted-foreground">HRS</span>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                            ))}
                         </div>
                      </CardContent>
                   </Card>
                </motion.div>
              )}

              {activeTab === 'templates' && (
                <motion.div key="templates" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                   <Card className="bg-card border-border shadow-sm overflow-hidden">
                      <CardHeader className="bg-secondary/20 border-b border-border">
                         <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-foreground/80">
                           <FileText className="w-4 h-4 text-primary" /> Tactical Communication Protocols
                         </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                         <div className="divide-y divide-border">
                            {emailTemplates.map(template => (
                              <div key={template.id} className="p-6 hover:bg-primary/5 transition-all group">
                                 <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                       <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                                          <Mail size={14} />
                                       </div>
                                       <div>
                                          <h4 className="text-xs font-black uppercase tracking-widest text-foreground">{template.name}</h4>
                                          <p className="text-[10px] text-muted-foreground font-mono">ID: {template.id}</p>
                                       </div>
                                    </div>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => setEditingTemplate(template)}
                                      className="h-8 text-[10px] font-bold uppercase border-border hover:bg-primary/10"
                                    >
                                       Reconfigure Template
                                    </Button>
                                 </div>
                                 <div className="p-3 bg-background border border-border rounded font-mono text-[10px] opacity-70 group-hover:opacity-100 transition-opacity">
                                    <p className="text-primary font-bold mb-1">SUBJECT: {template.subject}</p>
                                    <p className="line-clamp-2">{template.body.replace(/<[^>]*>?/gm, '')}</p>
                                 </div>
                              </div>
                            ))}
                         </div>
                      </CardContent>
                   </Card>
                </motion.div>
              )}
           </AnimatePresence>
        </div>

        <div className="lg:col-span-4 space-y-6">
           {activeTab === 'templates' && editingTemplate && (
             <Card className="bg-card border-border shadow-xl sticky top-8 animate-in slide-in-from-right duration-300">
                <CardHeader className="border-b border-border bg-primary/5">
                   <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center justify-between">
                     Tactical Editor: {editingTemplate.name}
                     <Button variant="ghost" size="icon" onClick={() => setEditingTemplate(null)} className="h-6 w-6"><X size={14} /></Button>
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                   <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Alert Subject Line</Label>
                      <Input 
                        value={editingTemplate.subject} 
                        onChange={e => setEditingTemplate({...editingTemplate, subject: e.target.value})} 
                        className="bg-background/50 border-border text-xs font-bold" 
                      />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tactical Narrative (HTML Body)</Label>
                      <textarea 
                        value={editingTemplate.body} 
                        onChange={e => setEditingTemplate({...editingTemplate, body: e.target.value})} 
                        className="w-full h-[300px] bg-background/50 border border-border rounded-md p-3 text-[10px] font-mono focus:border-primary/50 focus:outline-none scrollbar-thin"
                      />
                   </div>
                   
                   <div className="p-3 bg-secondary/20 rounded border border-border">
                      <p className="text-[9px] font-black uppercase text-muted-foreground mb-2 flex items-center gap-1">
                        <Zap size={10} className="text-primary" /> Dynamic Signal Tokens
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                         {['ticketNumber', 'alertName', 'severity', 'host', 'description', 'detectionTime', 'slaDeadline', 'appUrl'].map(token => (
                           <Badge key={token} variant="outline" className="text-[8px] font-mono border-border lowercase opacity-70">{'{{'}{token}{'}}'}</Badge>
                         ))}
                      </div>
                   </div>

                   <Button 
                    onClick={handleUpdateTemplate} 
                    disabled={loading} 
                    className="w-full bg-primary hover:opacity-90 text-white font-black uppercase tracking-widest text-[10px] h-10 border-none shadow-lg shadow-primary/10"
                   >
                     {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                     Commit Operational Protocol
                   </Button>
                </CardContent>
             </Card>
           )}

           {activeTab === 'users' && (
             <Card className="bg-card border-border shadow-xl sticky top-8">
                <CardHeader className="border-b border-border bg-secondary/30">
                   <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary/80">
                     {editingId ? 'Modify Credentials' : 'Provision New Operative'}
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                   <form onSubmit={handleSaveUser} className="space-y-5">
                      <div className="space-y-2">
                         <Label className="text-[10px] uppercase font-bold text-muted-foreground">Full Designation</Label>
                         <Input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="bg-background/50 border-border text-xs focus:border-primary/50" placeholder="John Doe" required />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] uppercase font-bold text-muted-foreground">Secure Email</Label>
                         <Input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="bg-background/50 border-border text-xs focus:border-primary/50" placeholder="j.doe@guardiansoc.local" required />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] uppercase font-bold text-muted-foreground">Access Level</Label>
                         <Select value={newUser.role} onValueChange={v => setNewUser({...newUser, role: v as UserRole})}>
                            <SelectTrigger className="bg-background/50 border-border text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-card border-border"><SelectItem value="analyst">SOC Analyst</SelectItem><SelectItem value="lead">SOC Lead</SelectItem><SelectItem value="admin">System Admin</SelectItem></SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] uppercase font-bold text-muted-foreground">Encryption Key (Password)</Label>
                         <Input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="bg-background/50 border-border text-xs focus:border-primary/50" placeholder="••••••••" required={!editingId} />
                      </div>
                      <div className="flex gap-2 pt-2">
                         <Button type="submit" disabled={loading} className="flex-1 bg-primary hover:opacity-90 text-white font-black uppercase tracking-widest text-[10px] h-10 border-none shadow-lg shadow-primary/10">
                           {editingId ? 'COMMIT CHANGES' : 'AUTHORIZE ACCESS'}
                         </Button>
                         {editingId && <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setNewUser({ email: '', name: '', role: '', permissions: [], password: '' }); }} className="text-[10px] font-bold uppercase">Cancel</Button>}
                      </div>
                   </form>
                </CardContent>
             </Card>
           )}

           {activeTab === 'roles' && (
             <Card className="bg-card border-border shadow-xl sticky top-8">
                <CardHeader className="border-b border-border bg-secondary/30">
                   <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary/80">
                     {editingId ? 'Refine Authorization' : 'Define New Role'}
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                   <form onSubmit={handleSaveRole} className="space-y-5">
                      <div className="space-y-2">
                         <Label className="text-[10px] uppercase font-bold text-muted-foreground">Role Designation</Label>
                         <Input value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})} className="bg-background/50 border-border text-xs focus:border-primary/50" placeholder="e.g. Threat Hunter" required />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] uppercase font-bold text-muted-foreground">Operational Scope</Label>
                         <Input value={newRole.description} onChange={e => setNewRole({...newRole, description: e.target.value})} className="bg-background/50 border-border text-xs focus:border-primary/50" placeholder="Brief description of duties..." />
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] uppercase font-bold text-muted-foreground">Permission Matrix</Label>
                         <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                            {PERMISSION_GROUPS.map(group => (
                              <div key={group.name} className="space-y-2">
                                 <p className="text-[8px] font-black text-primary/60 uppercase tracking-widest border-b border-primary/10 pb-1">{group.name}</p>
                                 <div className="grid grid-cols-1 gap-1.5">
                                    {group.permissions.map(p => (
                                      <label key={p} className="flex items-center gap-2 p-2 rounded bg-secondary/20 border border-border/50 hover:border-primary/30 cursor-pointer transition-all">
                                         <input 
                                           type="checkbox" 
                                           checked={newRole.permissions.includes(p)}
                                           onChange={(e) => {
                                              const next = e.target.checked 
                                                ? [...newRole.permissions, p]
                                                : newRole.permissions.filter(x => x !== p);
                                              setNewRole({...newRole, permissions: next});
                                           }}
                                           className="rounded border-border bg-background text-primary"
                                         />
                                         <span className="text-[9px] font-bold uppercase text-foreground/70">{p.replace(/_/g, ' ')}</span>
                                      </label>
                                    ))}
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                         <Button type="submit" disabled={loading} className="flex-1 bg-primary hover:opacity-90 text-white font-black uppercase tracking-widest text-[10px] h-10 border-none shadow-lg shadow-primary/10">
                           {editingId ? 'COMMIT ROLE' : 'ACTIVATE ROLE'}
                         </Button>
                         {editingId && <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setNewRole({ name: '', permissions: [], description: '' }); }} className="text-[10px] font-bold uppercase">Cancel</Button>}
                      </div>
                   </form>
                </CardContent>
             </Card>
           )}

           {activeTab === 'rules' && (
             <Card className="bg-card border-border shadow-xl sticky top-8">
                <CardHeader className="border-b border-border bg-secondary/30">
                   <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary/80">
                     {editingId ? 'Reconfigure Routing' : 'New Tactical Protocol'}
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                   <form onSubmit={handleSaveRule} className="space-y-5">
                      <div className="space-y-2">
                         <Label className="text-[10px] uppercase font-bold text-muted-foreground">Protocol Name</Label>
                         <Input value={newRule.name} onChange={e => setNewRule({...newRule, name: e.target.value})} className="bg-background/50 border-border text-xs focus:border-primary/50" placeholder="e.g. Malware Containment" required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Keyword/Pattern</Label>
                            <Input value={newRule.keyword} onChange={e => setNewRule({...newRule, keyword: e.target.value})} className="bg-background/50 border-border text-xs font-mono" placeholder="MALWARE" required />
                         </div>
                         <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Strategy</Label>
                            <Select value={newRule.matchingStrategy} onValueChange={v => setNewRule({...newRule, matchingStrategy: v as any})}>
                               <SelectTrigger className="bg-background/50 border-border text-xs"><SelectValue /></SelectTrigger>
                               <SelectContent className="bg-card border-border"><SelectItem value="contains">Contains</SelectItem><SelectItem value="regex">Regex</SelectItem><SelectItem value="exact">Exact Match</SelectItem></SelectContent>
                            </Select>
                         </div>
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] uppercase font-bold text-muted-foreground">Automated Assignment</Label>
                         <Select value={newRule.assignedToUserId} onValueChange={v => {
                            const user = users.find(u => u.id === v);
                            setNewRule({...newRule, assignedToUserId: v, assignedToUserName: user?.name || 'Unassigned'});
                         }}>
                            <SelectTrigger className="bg-background/50 border-border text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-card border-border">
                               <SelectItem value="unassigned">Global Dispatch Pool</SelectItem>
                               {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>)}
                            </SelectContent>
                         </Select>
                      </div>
                      <div className="flex gap-2 pt-2">
                         <Button type="submit" disabled={loading} className="flex-1 bg-primary hover:opacity-90 text-white font-black uppercase tracking-widest text-[10px] h-10 border-none shadow-lg shadow-primary/10">
                           {editingId ? 'RECOMMIT RULE' : 'INITIALIZE RULE'}
                         </Button>
                         {editingId && <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setNewRule({ name: '', keyword: '', matchingStrategy: 'contains', priority: 0, active: true, assignedToUserId: 'unassigned', assignedToUserName: '', severityOverride: 'none', autoSlaAssignment: true, sendNotifications: true }); }} className="text-[10px] font-bold uppercase">Cancel</Button>}
                      </div>
                   </form>
                </CardContent>
             </Card>
           )}
        </div>
      </div>
    </div>
  );
}
