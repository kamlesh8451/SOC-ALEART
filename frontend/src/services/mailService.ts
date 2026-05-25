import { apiJson } from "./apiClient";

export interface MailSettings {
  id?: number;
  host: string;
  port: number;
  ssl: boolean;
  username: string;
  password?: string;
  poll_interval: number;
  is_active: boolean;
  last_sync_at?: string;
  last_sync_status?: string;
  last_error?: string;
}

export const mailService = {
  async getSettings() {
    return apiJson<MailSettings>("/api/mail/settings");
  },

  async updateSettings(settings: MailSettings) {
    return apiJson("/api/mail/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
  },

  async getLogs(incidentId?: string) {
    const url = incidentId ? `/api/mail/logs?incidentId=${incidentId}` : "/api/mail/logs";
    return apiJson<any[]>(url);
  },

  async sendReply(incidentId: string, message: string) {
    return apiJson("/api/mail/reply", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidentId, message })
    });
  }
};
