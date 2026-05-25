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
  async updateStatus(id: string, status: Incident['status'], evidenceUrl?: string, closureComment?: string, rootCause?: string) {
    return apiJson(`/api/incidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, evidenceUrl, closureComment, rootCause }),
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
    return apiJson<{ subject: string; body: string }>('/api/notifications/simulate-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incident, type })
    });
  },

  // Real-time listener (simulated with polling)
  subscribeToIncidents(
    callback: (data: { data: Incident[]; pagination: any }) => void,
    onError?: (error: Error) => void,
    page = 1,
    limit = 50
  ) {
    let cancelled = false;
    let delayMs = 5000;
    let errorNotified = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await apiJson<{ data: Incident[]; pagination: any }>(`/api/incidents?page=${page}&limit=${limit}`);
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
      investigating: number;
      closed: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
      compliance: number;
      velocity: Array<{ name: string; open: number; closed: number }>;
    }>("/api/incidents/stats");
  },

  async getAnalytics() {
    return apiJson<{
      mtta: number;
      mttr: number;
    }>("/api/incidents/analytics");
  },

  async exportAll() {
    const response = await apiFetch("/api/incidents/export");
    if (!response.ok) throw new Error("Failed to export incidents");
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incidents_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async exportOne(id: string, ticketNumber: string) {
    const response = await apiFetch(`/api/incidents/${id}/export`);
    if (!response.ok) throw new Error("Failed to export incident report");
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident_${ticketNumber}_report.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async getHandoverReport() {
    const response = await apiFetch("/api/reports/handover");
    if (!response.ok) throw new Error("Failed to generate shift handover report");
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shift_handover_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async importCsv(csvData: string) {
    return apiJson<{ success: boolean; count: number }>("/api/incidents/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csvData }),
    });
  },

  async bulkDelete(ids: string[]) {
    return apiJson("/api/incidents/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  },

  async bulkUpdateStatus(ids: string[], status: string) {
    return apiJson("/api/incidents/bulk/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, status }),
    });
  },

  // Fetch current incident registry
  async getIncidents(page = 1, limit = 50) {
    return apiJson<{ data: Incident[]; pagination: any }>(`/api/incidents?page=${page}&limit=${limit}`);
  },

  async search(query: string) {
    return apiJson<Incident[]>(`/api/incidents/search?q=${encodeURIComponent(query)}`);
  },

  async merge(parentId: string, childIds: string[]) {
    return apiJson("/api/incidents/merge", {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId, childIds }),
    });
  }
};
