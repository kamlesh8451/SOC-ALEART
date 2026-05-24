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
  ShieldAlert
} from "lucide-react";
import { adminService } from "../services/adminService";
import { mailService } from "../services/mailService";
import { UserProfile, AssignmentRule, UserRole, RoleDefinition } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function AdminSettings({ onViewIncident }: { onViewIncident?: (incidentId: string) => void }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [featureFlags, setFeatureFlags] = useState<Array<{ name: string, is_enabled: boolean, description: string }>>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'rules' | 'roles' | 'mail' | 'features' | 'sessions' | 'sla'>('users');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // Track specific action loading
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  
  const [newUser, setNewUser] = useState<Omit<UserProfile, 'id'>>({ email: '', name: '', role: '', permissions: [], password: '' });
  const [newRule, setNewRule] = useState<Omit<AssignmentRule, 'id'>>({
    name: '',
    keyword: '',
    assignedToUserId: '',
    assignedToUserName: '',
    active: true,
    matchingStrategy: 'exact',
    priority: 0,
    severityOverride: 'none',
    autoSlaAssignment: true,
    sendNotifications: true
  });  const [newRole, setNewRole] = useState<Omit<RoleDefinition, 'id'>>({ name: '', permissions: [], description: '' });

  const [mailSettings, setMailSettings] = useState<any>({ host: '', port: 993, ssl: true, username: '', password: '', poll_interval: 60, is_active: true, spam_filters: [] });
  const [mailLogs, setMailLogs] = useState<any[]>([]);
  const [slaPolicies, setSlaPolicies] = useState<any[]>([]);
  const [newSpamFilter, setNewSpamFilter] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubUsers = adminService.subscribeToUsers(setUsers);
    const unsubRules = adminService.subscribeToRules(setRules);
    const unsubRoles = adminService.subscribeToRoles(setRoles);
    fetchFeatureFlags();
    fetchSlaPolicies();
    return () => {
      unsubUsers();
      unsubRules();
      unsubRoles();
    };
  }, []);

  const fetchSlaPolicies = async () => {
    try {
      const data = await apiJson<any[]>('/api/sla');
      setSlaPolicies(data);
    } catch (e) {
      console.error("Failed to fetch SLA policies");
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
      fetchSlaPolicies();
    } catch (e) {
      toast.error("Failed to update policy");
    }
  };

  const fetchFeatureFlags = async () => {
    try {
      const flags = await adminService.getFeatureFlags();
      setFeatureFlags(flags);
    } catch (e) {
      console.error("Failed to fetch feature flags");
    }
  };

  const handleToggleFeature = async (name: string, currentStatus: boolean) => {
    try {
      await adminService.updateFeatureFlag(name, !currentStatus);
      toast.success(`Feature ${name} updated`);
      fetchFeatureFlags();
    } catch (e) {
      toast.error("Failed to update feature");
    }
  };

  useEffect(() => {
    if (activeTab === 'mail') {
      fetchMailData();
    } else if (activeTab === 'sessions') {
      fetchSessions();
    }
  }, [activeTab]);

  const fetchSessions = async () => {
    try {
      const data = await adminService.getSessions();
      setSessions(data);
    } catch (e) {
      toast.error("Failed to fetch active sessions");
    }
  };

  const handleRevokeSession = async (id: string) => {
    if (!confirm("Forcefully terminate this user session?")) return;
    setActionLoading(id);
    try {
      await adminService.revokeSession(id);
      toast.info("Session terminated successfully");
      fetchSessions();
    } catch (e) {
      toast.error("Revocation failed");
    } finally {
      setActionLoading(null);
    }
  };

  const fetchMailData = async () => {
    try {
      const [settings, logs] = await Promise.all([
        mailService.getSettings(),
        mailService.getLogs()
      ]);
      if (settings) setMailSettings({ ...settings, password: '' });
      setMailLogs(logs);
    } catch (e) {
      toast.error("Failed to fetch mail data");
    }
  };

  const handleSaveMailSettings = async () => {
    setLoading(true);
    try {
      const payload = { ...mailSettings };
      // Don't send empty password if user didn't type one
      if (!payload.password || payload.password.trim().length === 0) {
        delete payload.password;
      }
      
      await mailService.updateSettings(payload);
      toast.success("Mail integration updated and service synchronized");
      // Clear password field for security after successful save
      setMailSettings({ ...mailSettings, password: '' });
      fetchMailData();
    } catch (e) {
      toast.error("Protocol synchronization failed. Check server logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedRuleIds([]);
    setSearchFilter('');
  }, [activeTab]);

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.name || !newUser.role) return toast.error("Fill all required user fields");
    if (!editingId && !newUser.password) return toast.error("Initial password required for new operatives");
    
    setLoading(true);
    try {
      const payload = { ...newUser };
      if (editingId && !payload.password) {
        delete payload.password; // Don't update password if empty during edit
      }

      if (editingId) {
        await adminService.updateUser(editingId, payload);
        toast.success("Operative credentials updated");
        setEditingId(null);
      } else {
        await adminService.createUser(payload);
        toast.success("User provisioned successfully");
      }
      setNewUser({ email: '', name: '', role: '', permissions: [], password: '' });
    } catch (e) {
      toast.error(editingId ? "Update failed" : "Provisioning failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    if (!newRule.keyword || !newRule.assignedToUserId) return toast.error("Fill all rule fields");
    
    // Regex Validation
    if (newRule.matchingStrategy === 'regex') {
      try {
        new RegExp(newRule.keyword);
      } catch (e) {
        return toast.error("Invalid Regex pattern provided");
      }
    }

    setLoading(true);
    try {
      if (editingId) {
        await adminService.updateRule(editingId, newRule);
        toast.success("Routing logic re-calibrated");
        setEditingId(null);
      } else {
        await adminService.createRule(newRule);
        toast.success("Strategic routing rule established");
      }
      setNewRule({ 
        name: '',
        keyword: '', 
        assignedToUserId: '', 
        assignedToUserName: '', 
        active: true,
        matchingStrategy: 'exact',
        priority: 0 
      });
    } catch (e) {
      toast.error("Process failure");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    const roleName = newRole.name.trim();
    if (!roleName) return toast.error("Role name is required for blueprinting");
    
    if (newRole.permissions.length === 0) {
      return toast.error("Mission failure: At least one authorization must be assigned to this role");
    }

    // Role name must be unique (case-insensitive)
    const isDuplicate = roles.some(r => r.name.toLowerCase() === roleName.toLowerCase() && r.id !== editingId);
    if (isDuplicate) {
      return toast.error("Security Conflict: This role designation already exists in the command registry");
    }

    setLoading(true);
    try {
      if (editingId) {
        await adminService.updateRole(editingId, { ...newRole, name: roleName });
        toast.success("Operational role updated and synchronized");
        setEditingId(null);
      } else {
        await adminService.createRole({ ...newRole, name: roleName });
        toast.success("New operational role defined and deployed");
      }
      setNewRole({ name: '', permissions: [], description: '' });
    } catch (e) {
      toast.error("Process failure: Definition could not be committed");
    } finally {
      setLoading(false);
    }
  };

  const startEditUser = (user: UserProfile) => {
    setEditingId(user.id);
    setNewUser({ email: user.email, name: user.name, role: user.role, permissions: user.permissions || [], password: '' });
    setActiveTab('users');
  };

  const startEditRole = (role: RoleDefinition) => {
    setEditingId(role.id);
    setNewRole({ name: role.name, permissions: role.permissions, description: role.description || '' });
    setActiveTab('roles');
  };

  const startEditRule = (rule: AssignmentRule) => {
    setEditingId(rule.id);
    setNewRule({ 
      name: rule.name || '',
      keyword: rule.keyword, 
      assignedToUserId: rule.assignedToUserId, 
      assignedToUserName: rule.assignedToUserName, 
      active: rule.active,
      matchingStrategy: rule.matchingStrategy || 'exact',
      priority: rule.priority || 0
    });
    setActiveTab('rules');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewUser({ email: '', name: '', role: '', permissions: [], password: '' });
    setNewRule({ 
      name: '',
      keyword: '', 
      assignedToUserId: '', 
      assignedToUserName: '', 
      active: true,
      matchingStrategy: 'exact',
      priority: 0 
    });
    setNewRole({ name: '', permissions: [], description: '' });
  };

  const togglePermission = (perm: string, type: 'user' | 'role') => {
    if (type === 'user') {
      const perms = newUser.permissions || [];
      setNewUser({
        ...newUser,
        permissions: perms.includes(perm) ? perms.filter(p => p !== perm) : [...perms, perm]
      });
    } else {
      const perms = newRole.permissions || [];
      setNewRole({
        ...newRole,
        permissions: perms.includes(perm) ? perms.filter(p => p !== perm) : [...perms, perm]
      });
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm("Permanently deactivate this operative?")) {
      setActionLoading(id);
      try {
        await adminService.deleteUser(id);
        toast.info("Operative removed from active duty");
      } catch (e) {
        toast.error("Deletion failed");
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (confirm("Delete this routing logic?")) {
      setActionLoading(id);
      try {
        await adminService.deleteRule(id);
        toast.info("Routing rule purged");
      } catch (e) {
        toast.error("Cleanup failed");
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (confirm("Delete this custom role? This might affect users assigned to it.")) {
      setActionLoading(id);
      try {
        await adminService.deleteRole(id);
        toast.info("Role definition deleted");
      } catch (e) {
        toast.error("Removal failed");
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleToggleRuleActive = async (id: string, currentStatus: boolean, keyword: string) => {
    try {
      await adminService.updateRule(id, { active: !currentStatus });
      toast.success(`Rule "${keyword}" is now ${!currentStatus ? 'ACTIVE' : 'INACTIVE'}`);
    } catch (e) {
      toast.error("Status update failed");
    }
  };

  const handleBulkToggleActive = async (active: boolean) => {
    setLoading(true);
    try {
      await Promise.all(selectedRuleIds.map(id => adminService.updateRule(id, { active })));
      toast.success(`Batch execution complete: ${selectedRuleIds.length} rules synchronized`);
      setSelectedRuleIds([]);
    } catch (e) {
      toast.error("Bulk update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Sanitize command registry: Permanently delete ${selectedRuleIds.length} rules?`)) return;
    setLoading(true);
    try {
      await Promise.all(selectedRuleIds.map(id => adminService.deleteRule(id)));
      toast.info("Routing table cleaned");
      setSelectedRuleIds([]);
    } catch (e) {
      toast.error("Cleanup pipeline error");
    } finally {
      setLoading(false);
    }
  };

  const toggleRuleSelection = (id: string) => {
    setSelectedRuleIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllRules = () => {
    const filteredRules = rules.filter(r => r.keyword.toLowerCase().includes(searchFilter.toLowerCase()) || r.assignedToUserName.toLowerCase().includes(searchFilter.toLowerCase()));
    if (selectedRuleIds.length === filteredRules.length && filteredRules.length > 0) {
      setSelectedRuleIds([]);
    } else {
      setSelectedRuleIds(filteredRules.map(r => r.id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-display font-bold tracking-tighter uppercase flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          HQ Command Center
        </h1>
        <div className="flex bg-secondary p-1 rounded-md border border-border overflow-x-auto">
          {[
            { id: 'users', label: 'Operatives', icon: Users },
            { id: 'roles', label: 'Roles & Perms', icon: Key },
            { id: 'sessions', label: 'Active Sessions', icon: ShieldAlert },
            { id: 'rules', label: 'Tactical Routing', icon: Database },
            { id: 'sla', label: 'SLA Policies', icon: Clock },
            { id: 'mail', label: 'Mail Automation', icon: Mail },
            { id: 'features', label: 'Advanced Features', icon: Zap }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all whitespace-nowrap",
                activeTab === tab.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Creation Panel */}
        <div className="lg:col-span-4">
          <Card className="bg-card border-border border-l-primary border-l-2 sticky top-6">
            <CardHeader>
              <CardTitle className="text-xs font-display font-bold uppercase tracking-[0.15em] text-primary flex items-center justify-between">
                <span>{editingId ? 'Modify Strategy' : activeTab === 'users' ? 'Provision Account' : activeTab === 'roles' ? 'Define Role' : activeTab === 'mail' ? 'Configure Mail Node' : 'Inject Routing Rule'}</span>
                {editingId && (
                  <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </CardTitle>
              <CardDescription className="text-[10px] uppercase text-muted-foreground">
                {editingId ? `Refining ID: ${editingId.slice(0, 8)}` : 'Secure configuration interface'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {activeTab === 'sla' && (
                <div className="space-y-4">
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg">
                    <p className="text-[9px] text-primary/80 uppercase font-bold flex items-center gap-2">
                       <Clock className="w-3 h-3" />
                       SLA Engine Control
                    </p>
                    <p className="text-[8px] text-muted-foreground mt-1 uppercase">Adjust response and resolution targets. Changes apply to all new incidents immediately.</p>
                  </div>
                  <div className="space-y-4">
                    {slaPolicies.map((policy) => (
                      <div key={policy.id} className="p-4 bg-secondary/30 border border-border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge className={cn(
                            "text-[10px] font-black uppercase px-2 py-0.5",
                            policy.severity === 'critical' ? 'bg-red-500' : 
                            policy.severity === 'high' ? 'bg-orange-500' :
                            policy.severity === 'medium' ? 'bg-blue-500' : 'bg-slate-500'
                          )}>
                            {policy.severity}
                          </Badge>
                          <span className="text-[8px] font-mono text-muted-foreground">ID: {policy.id}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[8px] font-bold text-muted-foreground uppercase">Response (Hrs)</label>
                            <Input 
                              type="number" 
                              value={policy.response_time_hours} 
                              onChange={(e) => {
                                const next = [...slaPolicies];
                                const p = next.find(p => p.id === policy.id);
                                p.response_time_hours = parseInt(e.target.value) || 0;
                                setSlaPolicies(next);
                              }}
                              className="h-8 text-xs bg-background" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[8px] font-bold text-muted-foreground uppercase">Resolution (Hrs)</label>
                            <Input 
                              type="number" 
                              value={policy.resolution_time_hours} 
                              onChange={(e) => {
                                const next = [...slaPolicies];
                                const p = next.find(p => p.id === policy.id);
                                p.resolution_time_hours = parseInt(e.target.value) || 0;
                                setSlaPolicies(next);
                              }}
                              className="h-8 text-xs bg-background" 
                            />
                          </div>
                        </div>
                        <Button 
                          onClick={() => handleUpdateSla(policy.id, policy.response_time_hours, policy.resolution_time_hours)}
                          className="w-full h-8 text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                        >
                          Commit Calibration
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'mail' && (
                <div className="space-y-6">
                   <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">IMAP Server Host</label>
                      <Input 
                        value={mailSettings.host} 
                        onChange={e => setMailSettings({...mailSettings, host: e.target.value})} 
                        placeholder="imap.gmail.com" 
                        className="bg-secondary border-border h-10 text-xs font-mono" 
                      />
                    </div>
                    {/* ... rest of existing mail fields ... */}
                   </div>

                   <div className="pt-4 border-t border-border/50">
                      <label className="text-[9px] font-bold text-primary uppercase tracking-widest mb-3 block">Tactical Noise Filter (Spam)</label>
                      <div className="flex gap-2 mb-3">
                         <Input 
                           value={newSpamFilter}
                           onChange={e => setNewSpamFilter(e.target.value)}
                           placeholder="Keyword or /regex/" 
                           className="bg-secondary border-border h-9 text-xs" 
                         />
                         <Button 
                           onClick={() => {
                             if (!newSpamFilter.trim()) return;
                             const filters = [...(mailSettings.spam_filters || []), newSpamFilter.trim()];
                             setMailSettings({...mailSettings, spam_filters: filters});
                             setNewSpamFilter('');
                           }}
                           variant="outline" 
                           className="h-9 px-3 border-primary/30 text-primary"
                         >
                           <Plus size={14} />
                         </Button>
                      </div>
                      <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                         {(mailSettings.spam_filters || []).map((filter: string, idx: number) => (
                           <div key={idx} className="flex items-center justify-between p-2 bg-secondary/50 rounded border border-border group">
                              <span className="text-[10px] font-mono text-muted-foreground">{filter}</span>
                              <button 
                                onClick={() => {
                                  const filters = mailSettings.spam_filters.filter((_: any, i: number) => i !== idx);
                                  setMailSettings({...mailSettings, spam_filters: filters});
                                }}
                                className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <X size={12} />
                              </button>
                           </div>
                         ))}
                         {(mailSettings.spam_filters || []).length === 0 && (
                           <p className="text-[9px] text-muted-foreground italic text-center py-4">No noise filters established.</p>
                         )}
                      </div>
                   </div>
                </div>
              )}
              {activeTab === 'users' && (
                <>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Full Identity</label>
                      <Input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="Agent Name" className="bg-secondary border-border h-10 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Digital Address (Email)</label>
                      <Input value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="agent@command.mil" className="bg-secondary border-border h-10 text-xs font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Secure Access Key (Password)</label>
                      <Input 
                        type="password" 
                        value={newUser.password} 
                        onChange={e => setNewUser({...newUser, password: e.target.value})} 
                        placeholder={editingId ? "Leave blank to keep current" : "Set initial password"} 
                        className="bg-secondary border-border h-10 text-xs font-mono" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Operational Role Designation</label>
                      <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted">
                        {roles.map(r => (
                          <div 
                            key={r.id} 
                            onClick={() => setNewUser({...newUser, role: r.name})}
                            className={cn(
                              "p-3 rounded-lg border transition-all cursor-pointer group flex flex-col gap-1",
                              newUser.role === r.name 
                                ? "bg-primary/10 border-primary shadow-sm" 
                                : "bg-secondary/30 border-transparent hover:border-border"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-tight",
                                newUser.role === r.name ? "text-primary" : "text-foreground"
                              )}>{r.name}</span>
                              {newUser.role === r.name && <Check className="w-3 h-3 text-primary" />}
                            </div>
                            <p className="text-[9px] text-muted-foreground leading-tight">{r.description || "No mission description provided."}</p>
                          </div>
                        ))}
                        <div 
                          onClick={() => setNewUser({...newUser, role: 'admin'})}
                          className={cn(
                            "p-3 rounded-lg border transition-all cursor-pointer group flex flex-col gap-1",
                            newUser.role === 'admin' 
                              ? "bg-red-500/10 border-red-500 shadow-sm" 
                              : "bg-secondary/30 border-transparent hover:border-border"
                          )}
                        >
                           <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-tight",
                                newUser.role === 'admin' ? "text-red-500" : "text-foreground"
                              )}>Global Admin</span>
                              {newUser.role === 'admin' && <Check className="w-3 h-3 text-red-500" />}
                            </div>
                            <p className="text-[9px] text-muted-foreground leading-tight">Unrestricted access to command infrastructure and user management.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Authorization Matrix</label>
                    </div>
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
                      {PERMISSION_GROUPS.map(group => (
                        <div key={group.name} className="space-y-2 group/perm">
                          <div className="flex items-center justify-between border-b border-border/50 pb-1">
                            <h4 className="text-[8px] font-bold text-primary/70 uppercase tracking-widest">{group.name}</h4>
                            <button 
                              type="button"
                              onClick={() => {
                                const allSelected = group.permissions.every(p => newUser.permissions?.includes(p));
                                const current = newUser.permissions || [];
                                const next = allSelected 
                                  ? current.filter(p => !group.permissions.includes(p))
                                  : Array.from(new Set([...current, ...group.permissions]));
                                setNewUser({ ...newUser, permissions: next });
                              }}
                              className="text-[7px] font-bold text-muted-foreground hover:text-primary uppercase tracking-tighter"
                            >
                               {group.permissions.every(p => newUser.permissions?.includes(p)) ? "Deselect Group" : "Select Group"}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {group.permissions.map(p => (
                              <label 
                                key={p} 
                                className={cn(
                                  "flex items-center gap-2 p-1.5 rounded-sm border transition-all cursor-pointer",
                                  newUser.permissions?.includes(p) 
                                    ? "bg-primary/5 border-primary/20" 
                                    : "bg-secondary/30 border-transparent hover:border-border/50"
                                )}
                              >
                                <input 
                                  type="checkbox" 
                                  checked={newUser.permissions?.includes(p)} 
                                  onChange={() => togglePermission(p, 'user')} 
                                  className="rounded border-border bg-transparent text-primary w-2.5 h-2.5" 
                                />
                                <span className="text-[9px] text-muted-foreground capitalize leading-none">{p.replace(/_/g, ' ')}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleCreateUser} disabled={loading} className="w-full bg-primary hover:opacity-90 text-white font-bold uppercase tracking-widest text-[10px] h-11 mt-2 shadow-lg shadow-primary/20">
                    {loading ? "Syncing..." : editingId ? <><ShieldCheck className="w-4 h-4 mr-2" /> Update Operative</> : <><UserPlus className="w-4 h-4 mr-2" /> Commit Provisioning</>}
                  </Button>
                  {editingId && (
                    <Button variant="ghost" onClick={cancelEdit} className="w-full text-muted-foreground text-[10px] font-bold uppercase h-8">
                       Cancel Operation
                    </Button>
                  )}
                </>
              )}

              {activeTab === 'roles' && (
                <>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Role Designation</label>
                      <Input value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})} placeholder="e.g. THREAT_HUNTER" className="bg-secondary border-border h-10 text-xs font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Mission Description</label>
                      <Input value={newRole.description} onChange={e => setNewRole({...newRole, description: e.target.value})} placeholder="Primary objectives..." className="bg-secondary border-border h-10 text-xs" />
                    </div>
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Permission Blueprint</label>
                    </div>
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
                      {PERMISSION_GROUPS.map(group => (
                        <div key={group.name} className="space-y-2 group/perm">
                          <div className="flex items-center justify-between border-b border-border/50 pb-1">
                            <h4 className="text-[8px] font-bold text-primary/70 uppercase tracking-widest">{group.name}</h4>
                            <button 
                              type="button"
                              onClick={() => {
                                const allSelected = group.permissions.every(p => newRole.permissions.includes(p));
                                const current = newRole.permissions;
                                const next = allSelected 
                                  ? current.filter(p => !group.permissions.includes(p))
                                  : Array.from(new Set([...current, ...group.permissions]));
                                setNewRole({ ...newRole, permissions: next });
                              }}
                              className="text-[7px] font-bold text-muted-foreground hover:text-primary uppercase tracking-tighter"
                            >
                               {group.permissions.every(p => newRole.permissions.includes(p)) ? "Release Group" : "Append Group"}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {group.permissions.map(p => (
                              <label 
                                key={p} 
                                className={cn(
                                  "flex items-center gap-2 p-1.5 rounded-sm border transition-all cursor-pointer",
                                  newRole.permissions.includes(p) 
                                    ? "bg-primary/5 border-primary/20" 
                                    : "bg-secondary/30 border-transparent hover:border-border/50"
                                )}
                              >
                                <input 
                                  type="checkbox" 
                                  checked={newRole.permissions.includes(p)} 
                                  onChange={() => togglePermission(p, 'role')} 
                                  className="rounded border-border bg-transparent text-primary w-2.5 h-2.5" 
                                />
                                <span className="text-[9px] text-muted-foreground capitalize leading-none">{p.replace(/_/g, ' ')}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleCreateRole} disabled={loading} className="w-full bg-primary hover:opacity-90 text-white font-bold uppercase tracking-widest text-[10px] h-11 mt-2 shadow-lg shadow-primary/20">
                    {loading ? "Authorizing..." : editingId ? <><ShieldCheck className="w-4 h-4 mr-2" /> Update Protocol</> : <><ShieldCheck className="w-4 h-4 mr-2" /> Blueprint New Role</>}
                  </Button>
                  {editingId && (
                    <Button variant="ghost" onClick={cancelEdit} className="w-full text-muted-foreground text-[10px] font-bold uppercase h-8">
                       Cancel Operation
                    </Button>
                  )}
                </>
              )}

              {activeTab === 'rules' && (
                <>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Rule Designation (Name)</label>
                      <Input 
                        value={newRule.name} 
                        onChange={e => setNewRule({...newRule, name: e.target.value})} 
                        placeholder="e.g. Cobalt Strike Alert" 
                        className="bg-secondary border-border h-10 text-xs font-mono" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Tactical Keyword / Pattern</label>
                      <Input 
                        value={newRule.keyword} 
                        onChange={e => setNewRule({...newRule, keyword: e.target.value})} 
                        placeholder={newRule.matchingStrategy === 'regex' ? "e.g. ^auth_failure.*" : "e.g. SQL_INJECTION"} 
                        className={cn(
                          "bg-secondary border-border h-10 text-xs font-mono transition-all",
                          newRule.matchingStrategy !== 'regex' && "uppercase"
                        )} 
                      />
                      {newRule.matchingStrategy === 'regex' && (
                        <p className="text-[8px] text-muted-foreground italic flex items-center gap-1">
                          <AlertCircle className="w-2 h-2" />
                          Pattern is evaluated case-insensitively ('i' flag enabled).
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Matching Strategy</label>
                        <Select
                          value={newRule.matchingStrategy || 'exact'}
                          onValueChange={(v) =>
                            setNewRule({
                              ...newRule,
                              matchingStrategy: v as AssignmentRule['matchingStrategy'],
                            })
                          }
                        >
                          <SelectTrigger className="w-full h-10 bg-secondary border-border text-foreground text-xs">
                            <SelectValue placeholder="Choose strategy" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground z-[200]">
                            <SelectItem value="exact">Exact (Includes)</SelectItem>
                            <SelectItem value="regex">Regex (Pattern)</SelectItem>
                            <SelectItem value="fuzzy">Fuzzy (All Words)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Priority (Higher = First)</label>
                        <Input 
                          type="number" 
                          value={newRule.priority} 
                          onChange={e => setNewRule({...newRule, priority: parseInt(e.target.value) || 0})} 
                          className="bg-secondary border-border h-10 text-xs focus:ring-1 focus:ring-primary" 
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-md border border-border">
                      <button 
                        type="button"
                        onClick={() => setNewRule({...newRule, active: !newRule.active})}
                        className={cn(
                          "flex h-5 w-9 items-center rounded-full p-1 transition-colors outline-none",
                          newRule.active ? "bg-primary" : "bg-muted"
                        )}
                      >
                        <div className={cn("h-3 w-3 rounded-full bg-white transition-transform", newRule.active ? "translate-x-4" : "translate-x-0")} />
                      </button>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Rule remains active</span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Assign Direct To</label>
                      <Select
                        value={newRule.assignedToUserId || "unassigned"}
                        onValueChange={(userId) => {
                          const user = users.find((u) => u.id === userId);
                          setNewRule({
                            ...newRule,
                            assignedToUserId: userId === "unassigned" ? "" : userId,
                            assignedToUserName: user?.name || '',
                          });
                        }}
                      >
                        <SelectTrigger className="w-full h-10 bg-secondary border-border text-foreground text-xs">
                          <SelectValue placeholder="Select target operative..." />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground z-[200]">
                          {users.length === 0 ? (
                            <SelectItem value="unassigned" disabled>
                              No operatives — add a user first
                            </SelectItem>
                          ) : (
                            <>
                              <SelectItem value="unassigned" disabled>Select target operative...</SelectItem>
                              {users.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.name} [{u.role}]
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      {users.length === 0 && (
                        <p className="text-[8px] text-amber-500/90 flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                          Provision at least one user under Operatives before creating routes.
                        </p>
                      )}
                    </div>
                  </div>
                  <Button onClick={handleCreateRule} disabled={loading} className="w-full bg-primary hover:opacity-90 text-white font-bold uppercase tracking-widest text-[10px] h-11 mt-6 shadow-lg shadow-primary/20">
                    {loading ? "Hardwiring..." : editingId ? <><Database className="w-4 h-4 mr-2" /> Update Routing</> : <><Database className="w-4 h-4 mr-2" /> establish persistent Route</>}
                  </Button>
                  {editingId && (
                    <Button variant="ghost" onClick={cancelEdit} className="w-full text-muted-foreground text-[10px] font-bold uppercase h-8">
                       Cancel Operation
                    </Button>
                  )}
                </>
              )}

              {activeTab === 'mail' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">IMAP Host</label>
                      <Input value={mailSettings.host} onChange={e => setMailSettings({...mailSettings, host: e.target.value})} placeholder="imap.gmail.com" className="bg-secondary border-border h-10 text-xs font-mono" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Port</label>
                        <Input type="number" value={mailSettings.port} onChange={e => setMailSettings({...mailSettings, port: parseInt(e.target.value) || 993})} className="bg-secondary border-border h-10 text-xs" />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <button 
                          onClick={() => setMailSettings({...mailSettings, ssl: !mailSettings.ssl})}
                          className={cn("w-8 h-4 rounded-full relative transition-colors", mailSettings.ssl ? "bg-primary" : "bg-muted")}
                        >
                          <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", mailSettings.ssl ? "left-4.5" : "left-0.5")} />
                        </button>
                        <span className="text-[9px] font-bold uppercase text-muted-foreground">SSL/TLS</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Username</label>
                      <Input value={mailSettings.username} onChange={e => setMailSettings({...mailSettings, username: e.target.value})} placeholder="soc-alerts@company.com" className="bg-secondary border-border h-10 text-xs font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Password / App Key</label>
                      <Input type="password" value={mailSettings.password} onChange={e => setMailSettings({...mailSettings, password: e.target.value})} placeholder="••••••••••••••••" className="bg-secondary border-border h-10 text-xs font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Poll Interval (seconds)</label>
                      <Input type="number" value={mailSettings.poll_interval} onChange={e => setMailSettings({...mailSettings, poll_interval: parseInt(e.target.value) || 60})} className="bg-secondary border-border h-10 text-xs" />
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg border border-border">
                       <button 
                         onClick={() => setMailSettings({...mailSettings, is_active: !mailSettings.is_active})}
                         className={cn("w-10 h-5 rounded-full relative transition-colors", mailSettings.is_active ? "bg-green-500" : "bg-muted")}
                       >
                         <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", mailSettings.is_active ? "left-6" : "left-1")} />
                       </button>
                       <span className="text-[10px] font-bold uppercase text-foreground">Automation Active</span>
                    </div>
                  </div>
                  <Button onClick={handleSaveMailSettings} disabled={loading} className="w-full bg-primary hover:opacity-90 text-white font-bold uppercase tracking-widest text-[10px] h-11 mt-4 shadow-lg shadow-primary/20">
                    {loading ? "Syncing..." : "Commit Mail Protocol"}
                  </Button>
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg">
                    <p className="text-[9px] text-primary/80 leading-relaxed uppercase font-bold flex items-center gap-2">
                       <ShieldCheck className="w-3 h-3" />
                       Security Protocol Enabled
                    </p>
                    <p className="text-[8px] text-muted-foreground mt-1 uppercase">Credentials are encrypted and never exposed in the front-end interface after saving.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Intelligence feed (Lists) */}
        <div className="lg:col-span-8 space-y-4">
           {/* Search Bar */}
           <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder={`Search ${activeTab}...`} 
                className="bg-background border-border pl-10 h-11 text-xs uppercase tracking-widest focus-visible:ring-primary/20"
              />
           </div>

           <AnimatePresence mode="wait">
             <motion.div 
               key={activeTab}
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -20 }}
               transition={{ duration: 0.2 }}
               className="space-y-4"
             >
              {activeTab === 'rules' && rules.length > 0 && (
                 <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                       <button 
                         onClick={handleSelectAllRules}
                         className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-2"
                       >
                         <div className={cn(
                           "w-3.5 h-3.5 rounded border flex items-center justify-center transition-all",
                           selectedRuleIds.length > 0 ? "bg-primary border-primary" : "border-border"
                         )}>
                           {selectedRuleIds.length === rules.filter(r => r.keyword.toLowerCase().includes(searchFilter.toLowerCase()) || r.assignedToUserName.toLowerCase().includes(searchFilter.toLowerCase())).length && rules.length > 0 && <Check className="w-2.5 h-2.5 text-white" />}
                           {selectedRuleIds.length > 0 && selectedRuleIds.length < rules.filter(r => r.keyword.toLowerCase().includes(searchFilter.toLowerCase()) || r.assignedToUserName.toLowerCase().includes(searchFilter.toLowerCase())).length && <div className="w-1.5 h-0.5 bg-white" />}
                         </div>
                         {selectedRuleIds.length === 0 ? "Select All Protocol" : `Selected ${selectedRuleIds.length} Nodes`}
                       </button>
                    </div>
                    
                    <AnimatePresence>
                      {selectedRuleIds.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md p-1 px-2 shadow-sm"
                        >
                           <button onClick={() => handleBulkToggleActive(true)} disabled={loading} className="text-[8px] font-bold text-primary hover:text-primary/70 uppercase px-2 py-1 disabled:opacity-50">Activate</button>
                           <div className="w-[1px] h-3 bg-primary/20" />
                           <button onClick={() => handleBulkToggleActive(false)} disabled={loading} className="text-[8px] font-bold text-muted-foreground hover:text-foreground uppercase px-2 py-1 disabled:opacity-50">Deactivate</button>
                           <div className="w-[1px] h-3 bg-primary/20" />
                           <button onClick={handleBulkDelete} disabled={loading} className="text-[8px] font-bold text-red-500 hover:text-red-600 uppercase px-2 py-1 disabled:opacity-50">Purge</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>
              )}

              {activeTab === 'users' && users
                .filter(u => u.name.toLowerCase().includes(searchFilter.toLowerCase()) || u.email.toLowerCase().includes(searchFilter.toLowerCase()))
                .map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-lg group hover:border-primary/30 transition-all duration-300">
                  <div className="flex items-center gap-5">
                     <div className="relative">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                           {user.name.charAt(0)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" title="Connected" />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground uppercase tracking-tight">{user.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground mt-0.5">{user.email}</span>
                        <div className="flex gap-1 mt-2">
                           {user.permissions?.slice(0, 3).map(p => (
                             <span key={p} className="text-[8px] bg-secondary px-1.5 py-0.5 rounded-full text-muted-foreground capitalize">{p.replace(/_/g, ' ')}</span>
                           ))}
                           {(user.permissions?.length || 0) > 3 && <span className="text-[8px] text-muted-foreground/60">+{user.permissions!.length - 3} more</span>}
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center gap-6">
                     <div className="text-right flex flex-col items-end">
                        <Badge className="bg-primary/20 text-primary border-none text-[8px] h-5 rounded-sm uppercase tracking-[0.2em] px-2">
                          {user.role}
                        </Badge>
                     </div>
                     <div className="flex gap-2">
                        <Button onClick={() => startEditUser(user)} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground transition-opacity" disabled={actionLoading === user.id}><Edit2 className="w-3.5 h-3.5" /></Button>
                        <Button onClick={() => handleDeleteUser(user.id)} variant="ghost" size="icon" className={cn("h-8 w-8 text-muted-foreground hover:text-red-500 transition-opacity", actionLoading === user.id && "animate-pulse")} disabled={actionLoading === user.id}><Trash2 className="w-3.5 h-3.5" /></Button>
                     </div>
                  </div>
                </div>
              ))}

              {activeTab === 'roles' && roles
                .filter(r => r.name.toLowerCase().includes(searchFilter.toLowerCase()) || r.description?.toLowerCase().includes(searchFilter.toLowerCase()))
                .map(role => (
                <div key={role.id} className="p-5 bg-background border border-border rounded-lg group hover:border-purple-500/30 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-purple-500/10 rounded-md text-purple-500">
                          <Key className="w-4 h-4" />
                       </div>
                       <div>
                          <h3 className="text-sm font-display font-bold text-foreground uppercase tracking-widest">{role.name}</h3>
                          <p className="text-[10px] text-muted-foreground">{role.description || "No mission brief provided."}</p>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <Button onClick={() => startEditRole(role)} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" disabled={actionLoading === role.id}><Edit2 className="w-3.5 h-3.5" /></Button>
                       <Button onClick={() => handleDeleteRole(role.id)} variant="ghost" size="icon" className={cn("h-8 w-8 text-muted-foreground hover:text-red-500 text-purple-500", actionLoading === role.id && "animate-pulse")} disabled={actionLoading === role.id}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                     {role.permissions.map(p => (
                       <Badge key={p} variant="secondary" className="bg-secondary text-muted-foreground border-border text-[9px] rounded-full px-2.5 py-0.5 capitalize shadow-inner">
                         {p.replace(/_/g, ' ')}
                       </Badge>
                     ))}
                  </div>
                </div>
              ))}

              {activeTab === 'rules' && rules
                .filter(r => r.keyword.toLowerCase().includes(searchFilter.toLowerCase()) || r.assignedToUserName.toLowerCase().includes(searchFilter.toLowerCase()))
                .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                .map(rule => (
                <div key={rule.id} className={cn(
                  "flex items-center justify-between p-5 bg-background border rounded-lg group transition-all duration-300",
                  rule.active ? "border-green-500/10 shadow-sm" : "border-border bg-secondary/20 grayscale(0.5) opacity-70",
                  selectedRuleIds.includes(rule.id) && "ring-1 ring-primary/50 border-primary/40 bg-primary/[0.02]"
                )}>
                  <div className="flex items-center gap-5">
                    <div 
                      onClick={() => toggleRuleSelection(rule.id)}
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-all shrink-0",
                        selectedRuleIds.includes(rule.id) ? "bg-primary border-primary" : "border-border hover:border-primary/50 bg-secondary/30"
                      )}
                    >
                       {selectedRuleIds.includes(rule.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex items-center gap-8">
                     <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                           <Database className={cn("w-3 h-3", rule.active ? "text-green-500" : "text-muted-foreground")} />
                           <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-bold uppercase tracking-tighter border-primary/30 text-primary/70">
                                {rule.matchingStrategy || 'exact'}
                              </Badge>
                              <Badge variant="secondary" className="text-[8px] h-4 px-1.5 font-bold bg-secondary text-muted-foreground border-none">
                                Priority {rule.priority || 0}
                              </Badge>
                           </div>
                           <span className={cn(
                             "text-[10px] font-bold uppercase tracking-widest",
                             rule.active ? "text-primary/70" : "text-muted-foreground"
                           )}>
                             Operational Protocol
                           </span>
                        </div>
                        <span className={cn(
                          "text-lg font-mono font-bold uppercase tracking-tighter",
                          rule.active ? "text-foreground" : "text-muted-foreground"
                        )}>"{rule.keyword}"</span>
                     </div>
                     <div className="h-8 w-[1px] bg-border hidden md:block" />
                     <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Target Operative</span>
                        <div className="flex items-center gap-2">
                           <User className="w-3 h-3 text-primary" />
                           <span className="text-sm font-medium text-muted-foreground">{rule.assignedToUserName}</span>
                        </div>
                     </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                     <button 
                       onClick={() => handleToggleRuleActive(rule.id, rule.active, rule.keyword)}
                       className={cn(
                         "flex items-center gap-2 px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest transition-all",
                         rule.active ? "bg-green-500/10 text-green-500 border border-green-500/20 shadow-sm" : "bg-secondary text-muted-foreground border border-border"
                       )}
                     >
                       {rule.active ? <><Check className="w-3.5 h-3.5" /> Functional</> : <><AlertCircle className="w-3.5 h-3.5" /> Deactivated</>}
                     </button>
                     <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button onClick={() => startEditRule(rule)} variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" disabled={actionLoading === rule.id}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => handleDeleteRule(rule.id)} variant="ghost" size="icon" className={cn("h-9 w-9 text-muted-foreground hover:text-red-500", actionLoading === rule.id && "animate-pulse")} disabled={actionLoading === rule.id}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                     </div>
                  </div>
                </div>
              ))}
              
              {activeTab === 'sessions' && (
                <div className="space-y-4">
                   <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="w-4 h-4 text-primary" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Command Access Registry (Active Sessions)</h3>
                  </div>
                  <div className="space-y-3">
                    {sessions.filter(s => s.name.toLowerCase().includes(searchFilter.toLowerCase()) || s.email.toLowerCase().includes(searchFilter.toLowerCase())).map((session) => (
                      <div key={session.id} className="p-4 bg-background border border-border rounded-lg flex items-center justify-between group hover:border-primary/20 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                            <User className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground uppercase tracking-tight">{session.name}</span>
                              <Badge className="bg-primary/10 text-primary border-none text-[7px] h-3.5 px-1 uppercase">{session.role}</Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                               <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
                                 <Globe className="w-2.5 h-2.5" /> {session.ip_address}
                               </span>
                               <span className="text-[9px] font-mono text-muted-foreground/60 flex items-center gap-1 max-w-[200px] truncate">
                                 <Monitor className="w-2.5 h-2.5" /> {session.user_agent}
                               </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="text-right">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">Authorization Issued</p>
                              <p className="text-[10px] font-mono text-foreground">{new Date(session.created_at).toLocaleString()}</p>
                           </div>
                           <Button 
                             onClick={() => handleRevokeSession(session.id)}
                             variant="ghost" 
                             size="sm"
                             className="text-red-500 hover:text-red-400 hover:bg-red-500/10 font-bold uppercase text-[9px] h-8 px-3 border border-transparent hover:border-red-500/20"
                             disabled={actionLoading === session.id}
                           >
                             {actionLoading === session.id ? "Terminating..." : "Terminate Session"}
                           </Button>
                        </div>
                      </div>
                    ))}
                    {sessions.length === 0 && (
                      <div className="p-20 text-center border-2 border-dashed border-border rounded-xl">
                         <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-30">No Active Sessions Detected</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'features' && (
                <div className="space-y-8">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-primary/80">Command & Control (Feature Matrix)</h3>
                  </div>

                  {/* Dashboard Widgets Category */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b border-border/50 pb-2 flex items-center gap-2">
                       <LayoutDashboard className="w-3 h-3" /> Tactical Dashboard Widgets
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {featureFlags.filter(f => f.name.startsWith('widget_')).map((feature) => (
                        <div key={feature.name} className="p-4 bg-background border border-border rounded-lg flex items-center justify-between hover:border-primary/20 transition-all group">
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
                              <p className="text-[8px] text-muted-foreground uppercase leading-tight mt-0.5">{feature.description}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleToggleFeature(feature.name, feature.is_enabled)}
                            className={cn(
                              "w-9 h-4.5 rounded-full relative transition-all duration-300",
                              feature.is_enabled ? "bg-primary" : "bg-secondary border border-border"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all duration-300",
                              feature.is_enabled ? "left-5" : "left-0.5"
                            )} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Analysis Engines Category */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b border-border/50 pb-2 flex items-center gap-2">
                       <Shield className="w-3 h-3" /> Analysis & Logic Engines
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      {featureFlags.filter(f => !f.name.startsWith('widget_')).map((feature) => (
                        <div key={feature.name} className="p-5 bg-background border border-border rounded-lg flex items-center justify-between hover:border-primary/20 transition-all group">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center border transition-all",
                              feature.is_enabled ? "bg-primary/10 border-primary/20 text-primary shadow-lg shadow-primary/5" : "bg-secondary/50 border-border text-muted-foreground"
                            )}>
                              <Shield className={cn("w-6 h-6", feature.is_enabled && "animate-pulse")} />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-foreground uppercase tracking-tighter flex items-center gap-2">
                                {feature.name.replace(/_/g, ' ')}
                                {feature.is_enabled && <Badge className="bg-primary/10 text-primary border-primary/20 text-[7px] h-3.5 px-1 font-black">ACTIVE</Badge>}
                              </h4>
                              <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[400px]">{feature.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn("text-[9px] font-bold uppercase tracking-widest", feature.is_enabled ? "text-primary" : "text-muted-foreground")}>
                              {feature.is_enabled ? 'ENABLED' : 'DISABLED'}
                            </span>
                            <button 
                              onClick={() => handleToggleFeature(feature.name, feature.is_enabled)}
                              className={cn(
                                "w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner",
                                feature.is_enabled ? "bg-primary" : "bg-secondary border border-border"
                              )}
                            >
                              <div className={cn(
                                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm",
                                feature.is_enabled ? "left-7" : "left-1"
                              )} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {featureFlags.length === 0 && (
                    <div className="p-20 text-center border-2 border-dashed border-border rounded-xl">
                      <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-30" />
                      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No Signal from Command Registry</h3>
                      <p className="text-xs text-muted-foreground/60 mt-1">Check database synchronization protocols.</p>
                    </div>
                  )}
                </div>
              )}
             </motion.div>
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
