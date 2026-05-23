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

export const RoutingRulesView: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentRule, setCurrentRule] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    keyword: '',
    matching_strategy: 'contains',
    priority: 0,
    active: true,
    assigned_to_user_name: '',
    severity_override: 'none',
    auto_sla_assignment: true,
    send_notifications: true
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
        matching_strategy: rule.matching_strategy || 'contains',
        priority: rule.priority || 0,
        active: rule.active !== undefined ? rule.active : true,
        assigned_to_user_name: rule.assigned_to_user_name || '',
        severity_override: rule.severity_override || 'none',
        auto_sla_assignment: rule.auto_sla_assignment !== undefined ? rule.auto_sla_assignment : true,
        send_notifications: rule.send_notifications !== undefined ? rule.send_notifications : true
      });
    } else {
      setCurrentRule(null);
      setFormData({
        name: '',
        keyword: '',
        matching_strategy: 'contains',
        priority: 0,
        active: true,
        assigned_to_user_name: '',
        severity_override: 'none',
        auto_sla_assignment: true,
        send_notifications: true
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Routing Rule Engine</h2>
          <p className="text-cyan-500/50 text-[10px] font-mono uppercase tracking-widest mt-1">Configure automated incident assignment & prioritization</p>
        </div>
        <Button 
          onClick={() => handleOpenDialog()}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase text-[10px] tracking-widest gap-2 h-9"
        >
          <Plus size={14} /> Create New Rule
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-50">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/40">Synchronizing engine...</p>
          </div>
        ) : rules.map((rule) => (
          <Card key={rule.id} className="bg-black/40 border-cyan-500/10 backdrop-blur-xl group hover:border-cyan-500/30 transition-all">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/5 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Zap size={20} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                       <h3 className="font-bold text-white uppercase tracking-tight">{rule.name || 'Unnamed Rule'}</h3>
                       <Badge className="bg-cyan-500/10 text-cyan-500 border-cyan-500/20 text-[9px] uppercase font-black">
                         {rule.priority} PRIORITY
                       </Badge>
                       {!rule.active && <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] uppercase font-black">INACTIVE</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase font-mono tracking-tighter">
                      <Target size={12} className="text-cyan-500/40" />
                      IF KEYWORD <span className="text-cyan-400 font-bold px-1.5 py-0.5 bg-cyan-500/5 rounded border border-cyan-500/10">"{rule.keyword}"</span> 
                      USING <span className="text-white/60 font-bold">{rule.matching_strategy}</span> MATCH
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right space-y-1">
                    <p className="text-[9px] uppercase font-bold text-cyan-500/40 tracking-widest">ASSIGN DIRECT TO</p>
                    <div className="flex items-center gap-2 justify-end">
                       <span className="text-xs font-bold text-white uppercase">{rule.assigned_to_user_name || 'Unassigned'}</span>
                       <ArrowRight size={12} className="text-cyan-500" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleOpenDialog(rule)}
                      size="icon" variant="ghost" className="w-8 h-8 rounded-lg border border-cyan-500/10 text-cyan-500/40 hover:text-cyan-400 hover:bg-cyan-500/10"
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button 
                      onClick={() => handleDelete(rule.id)}
                      size="icon" variant="ghost" className="w-8 h-8 rounded-lg border border-red-500/10 text-red-500/40 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-cyan-500/5 flex items-center gap-8">
                <div className="flex items-center gap-2">
                   <Shield size={12} className="text-cyan-500/40" />
                   <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">Severity Override:</span>
                   <span className="text-[10px] font-bold text-white uppercase tracking-tighter">{rule.severity_override || 'None'}</span>
                </div>
                <div className="flex items-center gap-2">
                   <Badge className={`w-2 h-2 rounded-full p-0 ${rule.auto_sla_assignment ? 'bg-green-500' : 'bg-white/10'}`} />
                   <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">Auto-SLA:</span>
                   <span className="text-[10px] font-bold text-white uppercase tracking-tighter">{rule.auto_sla_assignment ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex items-center gap-2">
                   <Badge className={`w-2 h-2 rounded-full p-0 ${rule.send_notifications ? 'bg-cyan-500 shadow-[0_0_4px_rgba(6,182,212,0.8)]' : 'bg-white/10'}`} />
                   <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">Notifications:</span>
                   <span className="text-[10px] font-bold text-white uppercase tracking-tighter">{rule.send_notifications ? 'Live' : 'Muted'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {rules.length === 0 && !loading && (
          <div className="h-64 rounded-2xl border-2 border-dashed border-cyan-500/10 flex flex-col items-center justify-center space-y-4 opacity-50">
             <div className="w-12 h-12 rounded-full bg-cyan-500/5 flex items-center justify-center">
                <Filter size={24} className="text-cyan-500/20" />
             </div>
             <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/40">No routing rules configured</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#050505] border-cyan-500/20 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tighter">
              {currentRule ? 'Edit Tactical Rule' : 'Deploy New Rule'}
            </DialogTitle>
            <DialogDescription className="text-cyan-500/50 text-[10px] uppercase tracking-widest">
              Define matching parameters and automated response actions
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-cyan-500/70">Rule Designation</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="bg-cyan-500/5 border-cyan-500/10 text-xs focus:border-cyan-500/40" 
                  placeholder="e.g., Ransomware Alert"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-cyan-500/70">Matching Keyword</Label>
                <Input 
                  value={formData.keyword}
                  onChange={(e) => setFormData({...formData, keyword: e.target.value})}
                  className="bg-cyan-500/5 border-cyan-500/10 text-xs focus:border-cyan-500/40" 
                  placeholder="e.g., cobalt_strike"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-cyan-500/70">Match Strategy</Label>
                <Select 
                  value={formData.matching_strategy} 
                  onValueChange={(v) => setFormData({...formData, matching_strategy: v})}
                >
                  <SelectTrigger className="bg-cyan-500/5 border-cyan-500/10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-cyan-500/20 text-white">
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="exact">Exact Match</SelectItem>
                    <SelectItem value="regex">Regex Pattern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-cyan-500/70">Priority Weight</Label>
                <Input 
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value) || 0})}
                  className="bg-cyan-500/5 border-cyan-500/10 text-xs focus:border-cyan-500/40" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-cyan-500/70">Severity Override</Label>
                <Select 
                  value={formData.severity_override} 
                  onValueChange={(v) => setFormData({...formData, severity_override: v})}
                >
                  <SelectTrigger className="bg-cyan-500/5 border-cyan-500/10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-cyan-500/20 text-white">
                    <SelectItem value="none">Inherit (Default)</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-cyan-500/70">Assign To Analyst</Label>
                <Input 
                  value={formData.assigned_to_user_name}
                  onChange={(e) => setFormData({...formData, assigned_to_user_name: e.target.value})}
                  className="bg-cyan-500/5 border-cyan-500/10 text-xs focus:border-cyan-500/40" 
                  placeholder="e.g., SOC Admin"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setIsDialogOpen(false)}
              className="text-[10px] uppercase font-bold hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase text-[10px] tracking-widest px-8"
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
