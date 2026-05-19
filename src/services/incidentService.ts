import { Incident, Severity } from "../types";
import { adminService } from "./adminService";

export const incidentService = {
  // Audit logging helper
  async logAction(action: string, incidentId?: string, ticketNumber?: string, details?: string, userId?: string) {
    // Audit logging is now primarily handled by the server for most actions
    // but we can still have a client-side call if needed
    try {
      // For now, let's assume the server handles most logging.
      // If we want to log custom client actions:
      console.log(`[LOG] ${action}: ${details}`);
    } catch (error) {
      console.error("Audit log failed:", error);
    }
  },

  // Create a new incident
  async createIncident(data: Omit<Incident, "id" | "ticketNumber" | "status" | "detectionTime" | "slaDeadline">) {
    // Keyword based assignment (still done client side for now, or could move to server)
    const assignment = await adminService.getAssignmentForIncident(data.alertName, data.description || "");
    
    const payload = {
      ...data,
      ownerId: data.ownerId || assignment?.id || "unassigned",
      assignedTo: data.assignedTo || assignment?.name || "Unassigned",
    };

    const response = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("Failed to create incident");
    return response.json();
  },

  // Update incident status
  async updateStatus(id: string, status: Incident['status'], evidenceUrl?: string) {
    const response = await fetch(`/api/incidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, evidenceUrl }),
    });

    if (!response.ok) throw new Error("Failed to update status");
    return response.json();
  },

  // Request Extension
  async requestExtension(id: string, reason: string) {
    const response = await fetch(`/api/incidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extensionRequested: true, extensionReason: reason }),
    });

    if (!response.ok) throw new Error("Failed to request extension");
    return response.json();
  },

  // Bulk Update Status
  async bulkUpdateStatus(ids: string[], status: Incident['status'], evidenceUrl?: string) {
    const promises = ids.map(id => this.updateStatus(id, status, evidenceUrl));
    await Promise.all(promises);
  },

  // Escalate Incident
  async escalateIncident(id: string, reason: string) {
    const response = await fetch("/api/tickets/confirm-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ticketId: id, 
        action: 'ESCALATE', 
        evidence: reason,
        role: localStorage.getItem("soc_role") || "soc_analyst"
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Escalation failed");
    }
    return response.json();
  },

  // Robust File Upload via Server
  async uploadEvidence(ticketId: string, file: File) {
    const formData = new FormData();
    formData.append("ticketId", ticketId);
    formData.append("file", file);

    const response = await fetch("/api/tickets/upload-evidence", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Upload failed");
    }

    return response.json();
  },

  // Simulate Email Notification
  async simulateNotification(incident: Incident, type: 'alert' | 'daily_digest' | 'reminder') {
    const response = await fetch('/api/notifications/simulate-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incident, type })
    });
    
    if (!response.ok) throw new Error("Simulation failed");
    return response.json();
  },

  // Real-time listener (simulated with polling)
  subscribeToIncidents(callback: (incidents: Incident[]) => void) {
    const fetchIncidents = async () => {
      try {
        const response = await fetch("/api/incidents");
        if (response.ok) {
          const data = await response.json();
          callback(data);
        }
      } catch (error) {
        console.error("Failed to fetch incidents:", error);
      }
    };

    fetchIncidents();
    const interval = setInterval(fetchIncidents, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }
};
