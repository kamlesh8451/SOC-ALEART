import { apiJson } from "./apiClient";

export interface Notification {
  id: number;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  link?: string;
  created_at: string;
}

export const notificationService = {
  async getAll() {
    return apiJson<Notification[]>('/api/notifications');
  },

  async markAsRead(id: number) {
    return apiJson(`/api/notifications/${id}/read`, {
      method: 'PATCH'
    });
  },

  async markAllAsRead() {
    return apiJson('/api/notifications/read-all', {
      method: 'POST'
    });
  },

  async delete(id: number) {
    return apiJson(`/api/notifications/${id}`, {
      method: 'DELETE'
    });
  }
};
