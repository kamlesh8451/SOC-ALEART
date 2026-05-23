import { Incident, Severity } from "../types";
import { adminService } from "./adminService";
import { apiJson, apiFetch } from "./apiClient";

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

    return apiJson("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  // Update incident status
  async updateStatus(id: string, status: Incident['status'], evidenceUrl?: string) {
    return apiJson(`/api/incidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, evidenceUrl }),
    });
  },

  // Request Extension
  async requestExtension(id: string, reason: string) {
    return apiJson(`/api/incidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extensionRequested: true, extensionReason: reason }),
    });
  },

  // Bulk Update Status
  async bulkUpdateStatus(ids: string[], status: Incident['status'], evidenceUrl?: string) {
    const promises = ids.map(id => this.updateStatus(id, status, evidenceUrl));
    await Promise.all(promises);
  },

  // Escalate Incident
  async escalateIncident(id: string, reason: string) {
    return apiJson("/api/tickets/confirm-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ticketId: id, 
        action: 'ESCALATE', 
        evidence: reason,
        role: localStorage.getItem("soc-role") || "soc_analyst"
      }),
    });
  },

  // Robust File Upload via Server
  async uploadEvidence(ticketId: string, file: File) {
    const formData = new FormData();
    formData.append("ticketId", ticketId);
    formData.append("file", file);

    return apiJson("/api/tickets/upload-evidence", {
      method: "POST",
      body: formData,
    });
  },

  // Simulate Email Notification
  async simulateNotification(incident: Incident, type: 'alert' | 'daily_digest' | 'reminder') {
    return apiJson('/api/notifications/simulate-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incident, type })
    });
  },

  // Real-time listener (simulated with polling)
  subscribeToIncidents(
    callback: (incidents: Incident[]) => void,
    onError?: (error: Error) => void
  ) {
    let cancelled = false;
    let delayMs = 5000;
    let errorNotified = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await apiJson<Incident[]>("/api/incidents");
        delayMs = 5000;
        errorNotified = false;
        callback(data);
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Failed to fetch incidents");
        delayMs = 15000;
        if (!errorNotified) {
          errorNotified = true;
          console.warn("Failed to fetch incidents:", err.message);
          onError?.(err);
        }
      }
      if (!cancelled) {
        setTimeout(poll, delayMs);
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  },

  async getStats() {
    return apiJson<{
      open: number;
      closed: number;
      critical: number;
      total: number;
      compliance: number;
      velocity: Array<{ name: string; open: number; closed: number }>;
    }>("/api/incidents/stats");
  }
};
