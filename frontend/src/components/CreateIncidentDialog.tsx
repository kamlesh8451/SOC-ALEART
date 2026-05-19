import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { incidentService } from "../services/incidentService";
import { Severity } from "../types";
import { toast } from "sonner";

// I need to import Dialog from ui/dialog
import { 
  Dialog as ShadDialog, 
  DialogContent as ShadDialogContent, 
  DialogHeader as ShadDialogHeader, 
  DialogTitle as ShadDialogTitle, 
  DialogDescription as ShadDialogDescription, 
  DialogFooter as ShadDialogFooter 
} from "@/components/ui/dialog";

export function CreateIncidentDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    alertName: "",
    severity: "medium" as Severity,
    host: "",
    description: "",
    domain: "Endpoint"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await incidentService.createIncident({
        ...formData,
        ownerId: "system", // In real app, current user ID
      });
      toast.success("Incident created successfully");
      onOpenChange(false);
      setFormData({ alertName: "", severity: "medium", host: "", description: "", domain: "Endpoint" });
    } catch (error) {
      toast.error("Failed to create incident");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ShadDialog open={open} onOpenChange={onOpenChange}>
      <ShadDialogContent className="sm:max-w-[500px] bg-card border-border text-foreground">
        <ShadDialogHeader>
          <ShadDialogTitle>Create New Incident</ShadDialogTitle>
          <ShadDialogDescription className="text-muted-foreground">
            Manually trigger a security incident ticket.
          </ShadDialogDescription>
        </ShadDialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="alertName">Alert Name</Label>
            <Input 
              id="alertName" 
              placeholder="e.g. Unusual Outbound Traffic" 
              className="bg-secondary border-border text-foreground"
              value={formData.alertName}
              onChange={(e) => setFormData({...formData, alertName: e.target.value})}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Severity</Label>
              <Select value={formData.severity} onValueChange={(v) => setFormData({...formData, severity: v as Severity})}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Domain</Label>
              <Select value={formData.domain} onValueChange={(v) => setFormData({...formData, domain: v})}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="Endpoint">Endpoint</SelectItem>
                  <SelectItem value="Identity">Identity</SelectItem>
                  <SelectItem value="Network">Network</SelectItem>
                  <SelectItem value="Cloud">Cloud</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="host">Host / Target</Label>
            <Input 
              id="host" 
              placeholder="e.g. SRV-PROD-99" 
              className="bg-secondary border-border text-foreground"
              value={formData.host}
              onChange={(e) => setFormData({...formData, host: e.target.value})}
              required
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <textarea 
              id="description"
              className="flex min-h-[80px] w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
              placeholder="Provide context for the incident..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>
          
          <ShadDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border hover:bg-secondary text-foreground">
              Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:opacity-90 text-white" disabled={loading}>
              {loading ? "Creating..." : "Create Alert"}
            </Button>
          </ShadDialogFooter>
        </form>
      </ShadDialogContent>
    </ShadDialog>
  );
}
