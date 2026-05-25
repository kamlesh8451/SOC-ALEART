import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, Trash2, Edit2, 
  Zap, Shield, Target, ArrowRight, Save, X, Loader2, Filter
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { adminService } from '@/services/adminService';
import { toast } from 'sonner';
import { AssignmentRule } from '../types';
import { cn } from '@/lib/utils';

export const RoutingRulesView: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentRule, setCurrentRule] = useState<any>(null);
  const [formData, setFormData] = useState<Omit<AssignmentRule, 'id'> & { name: string; severityOverride: string; autoSlaAssignment: boolean; sendNotifications: boolean }>({
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

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      adminService.subscribeToRules((data) => {
        setRules(data);
        setLoading(false);
      });
    } catch (err) {
      toast.error('Failed to load routing rules');
      setLoading(false);
    }
  };

  const handleOpenDialog = (rule: any = null) => {
    if (rule) {
      setCurrentRule(rule);
      setFormData({
        name: rule.name || '',
        keyword: rule.keyword || '',
        matchingStrategy: rule.matchingStrategy || rule.matching_strategy || 'contains',
        priority: rule.priority || 0,
        active: rule.active !== undefined ? rule.active : true,
        assignedToUserId: rule.assignedToUserId || rule.assigned_to_user_id || 'unassigned',
        assignedToUserName: rule.assignedToUserName || rule.assigned_to_user_name || '',
        severityOverride: rule.severityOverride || rule.severity_override || 'none',
        autoSlaAssignment: rule.autoSlaAssignment !== undefined ? rule.autoSlaAssignment : (rule.auto_sla_assignment !== undefined ? rule.auto_sla_assignment : true),
        sendNotifications: rule.sendNotifications !== undefined ? rule.sendNotifications : (rule.send_notifications !== undefined ? rule.send_notifications : true)
      });
    } else {
      setCurrentRule(null);
      setFormData({
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
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (currentRule) {
        await adminService.updateRule(currentRule.id, formData);
        toast.success('Rule updated successfully');
      } else {
        await adminService.createRule(formData);
        toast.success('Rule created successfully');
      }
      setIsDialogOpen(false);
      fetchRules();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save rule');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await adminService.deleteRule(id);
      toast.success('Rule deleted');
      fetchRules();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete rule');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 text-foreground">
      <div className="flex justify-between items-end border-b border-border pb-6">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">Routing Rule Engine</h2>
          <p className="text-primary/50 text-[10px] font-mono uppercase tracking-widest mt-1">Configure automated incident assignment & prioritization</p>
        </div>
        <Button 
          onClick={() => handleOpenDialog()}
          className="bg-primary hover:opacity-90 text-white font-bold uppercase text-[10px] tracking-widest gap-2 h-9 border-none shadow-lg shadow-primary/10"
        >
          <Plus size={14} /> Create New Rule
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-50">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Synchronizing engine...</p>
          </div>
        ) : rules.map((rule) => (
          <Card key={rule.id} className="bg-card border-border group hover:border-primary/30 transition-all shadow-sm overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                    <Zap size={20} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                       <h3 className="font-bold uppercase tracking-tight">{rule.name || 'Unnamed Rule'}</h3>
                       <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] uppercase font-black px-2">
                         {rule.priority} PRIORITY
                       </Badge>
                       {!rule.active && <Badge className="bg-error/10 text-error border-error/20 text-[9px] uppercase font-black">INACTIVE</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">
                      <Target size={12} className="text-primary/40" />
                      IF KEYWORD <span className="text-primary font-bold px-1.5 py-0.5 bg-primary/5 rounded border border-primary/10">"{rule.keyword}"</span> 
                      USING <span className="text-foreground font-bold">{rule.matching_strategy}</span> MATCH
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right space-y-1">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest opacity-60">ASSIGN DIRECT TO</p>
                    <div className="flex items-center gap-2 justify-end">
                       <span className="text-xs font-bold uppercase">{rule.assigned_to_user_name || 'Unassigned'}</span>
                       <ArrowRight size={12} className="text-primary" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleOpenDialog(rule)}
                      size="icon" variant="ghost" className="w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button 
                      onClick={() => handleDelete(rule.id)}
                      size="icon" variant="ghost" className="w-8 h-8 rounded-lg border border-error/20 text-muted-foreground hover:text-error hover:bg-error/10 transition-all"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-border/50 flex items-center gap-8">
                <div className="flex items-center gap-2">
                   <Shield size={12} className="text-primary/40" />
                   <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Severity Override:</span>
                   <span className="text-[10px] font-bold text-foreground uppercase tracking-tighter">{rule.severity_override || 'None'}</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className={cn("w-2 h-2 rounded-full", rule.auto_sla_assignment ? 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-muted')} />
                   <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Auto-SLA:</span>
                   <span className="text-[10px] font-bold text-foreground uppercase tracking-tighter">{rule.auto_sla_assignment ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className={cn("w-2 h-2 rounded-full", rule.send_notifications ? 'bg-primary shadow-[0_0_8px_var(--primary-glow)]' : 'bg-muted')} />
                   <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Notifications:</span>
                   <span className="text-[10px] font-bold text-foreground uppercase tracking-tighter">{rule.send_notifications ? 'Live' : 'Muted'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {rules.length === 0 && !loading && (
          <div className="h-64 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center space-y-4 opacity-50 bg-secondary/10">
             <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center">
                <Filter size={24} className="text-muted-foreground" />
             </div>
             <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">No routing rules configured</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tighter">
              {currentRule ? 'Edit Tactical Rule' : 'Deploy New Rule'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold">
              Define matching parameters and automated response actions
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Rule Designation</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="bg-background/50 border-border text-xs focus:border-primary/40" 
                  placeholder="e.g., Ransomware Alert"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Matching Keyword</Label>
                <Input 
                  value={formData.keyword}
                  onChange={(e) => setFormData({...formData, keyword: e.target.value})}
                  className="bg-background/50 border-border text-xs focus:border-primary/40" 
                  placeholder="e.g., cobalt_strike"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Match Strategy</Label>
                <Select 
                  value={formData.matchingStrategy || (formData as any).matching_strategy} 
                  onValueChange={(v) => setFormData({...formData, matchingStrategy: v as any})}
                >
                  <SelectTrigger className="bg-background/50 border-border text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="exact">Exact Match</SelectItem>
                    <SelectItem value="regex">Regex Pattern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Priority Weight</Label>
                <Input 
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value) || 0})}
                  className="bg-background/50 border-border text-xs focus:border-primary/40" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Severity Override</Label>
                <Select 
                  value={formData.severityOverride || (formData as any).severity_override} 
                  onValueChange={(v) => setFormData({...formData, severityOverride: v})}
                >
                  <SelectTrigger className="bg-background/50 border-border text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="none">Inherit (Default)</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Assign To Analyst</Label>
                <Input 
                  value={formData.assignedToUserName || (formData as any).assigned_to_user_name}
                  onChange={(e) => setFormData({...formData, assignedToUserName: e.target.value})}
                  className="bg-background/50 border-border text-xs focus:border-primary/40" 
                  placeholder="e.g., SOC Admin"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button 
              variant="ghost" 
              onClick={() => setIsDialogOpen(false)}
              className="text-[10px] uppercase font-bold hover:bg-secondary/50"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-primary hover:opacity-90 text-white font-bold uppercase text-[10px] tracking-widest px-8 border-none"
            >
              <Save size={14} className="mr-2" />
              {currentRule ? 'Update Engine' : 'Deploy Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
