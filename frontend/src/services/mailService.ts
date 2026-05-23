import { apiJson } from "./apiClient";

export const mailService = {
  async getSettings() {
    return apiJson("/api/mail/settings");
  },

  async updateSettings(settings: any) {
    return apiJson("/api/mail/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
  },

  async getLogs() {
    return apiJson("/api/mail/logs");
  }
};
