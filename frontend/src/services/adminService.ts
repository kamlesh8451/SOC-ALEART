import { UserProfile, AssignmentRule, RoleDefinition } from "../types";
import { apiJson } from "./apiClient";

export const adminService = {
  // User Management
  async createUser(data: Omit<UserProfile, "id">) {
    return apiJson("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async updateUser(id: string, data: Partial<Omit<UserProfile, "id">>) {
    return apiJson(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id: string) {
    return apiJson(`/api/users/${id}`, {
      method: "DELETE",
    });
  },

  async getUsers() {
    return apiJson<UserProfile[]>("/api/users");
  },

  subscribeToUsers(callback: (users: UserProfile[]) => void) {
    const fetchUsers = async () => {
      try {
        const data = await this.getUsers();
        callback(data);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    };

    fetchUsers();
    const interval = setInterval(fetchUsers, 10000);
    return () => clearInterval(interval);
  },

  // Role Management
  async getRoles() {
    return apiJson<RoleDefinition[]>("/api/roles");
  },

  async createRole(data: Omit<RoleDefinition, "id">) {
    return apiJson("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async updateRole(id: string, data: Partial<Omit<RoleDefinition, "id">>) {
    return apiJson(`/api/roles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async deleteRole(id: string) {
    return apiJson(`/api/roles/${id}`, {
      method: "DELETE",
    });
  },

  subscribeToRoles(callback: (roles: RoleDefinition[]) => void) {
    const fetchRoles = async () => {
      try {
        const data = await this.getRoles();
        callback(data);
      } catch (error) {
        console.error("Failed to fetch roles:", error);
      }
    };

    fetchRoles();
    const interval = setInterval(fetchRoles, 10000);
    return () => clearInterval(interval);
  },

  // Assignment Rules Management
  async getRules() {
    return apiJson<AssignmentRule[]>("/api/rules");
  },

  async createRule(data: Omit<AssignmentRule, "id">) {
    return apiJson("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async updateRule(id: string, data: Partial<Omit<AssignmentRule, "id">>) {
    return apiJson(`/api/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async deleteRule(id: string) {
    return apiJson(`/api/rules/${id}`, {
      method: "DELETE",
    });
  },

  subscribeToRules(callback: (rules: AssignmentRule[]) => void) {
    const fetchRules = async () => {
      try {
        const data = await this.getRules();
        callback(data);
      } catch (error) {
        console.error("Failed to fetch rules:", error);
      }
    };

    fetchRules();
    const interval = setInterval(fetchRules, 10000);
    return () => clearInterval(interval);
  },

  // Feature Flags
  async getFeatureFlags() {
    return apiJson<Array<{ name: string, is_enabled: boolean, description: string }>>("/api/settings/features");
  },

  async updateFeatureFlag(name: string, isEnabled: boolean) {
    return apiJson(`/api/settings/features/${name}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled }),
    });
  },

  // Logic to find assignment for an incident
  async getAssignmentForIncident(alertName: string, description: string): Promise<{ id: string, name: string } | null> {
    try {
      const rules = await this.getRules();
      
      // Sort by priority descending (default 0 if not set)
      const activeRules = rules.filter(r => r.active);
      const sortedRules = [...activeRules].sort((a, b) => (b.priority || 0) - (a.priority || 0));
      
      const combinedText = `${alertName} ${description}`.toLowerCase();
      
      for (const rule of sortedRules) {
        const keyword = rule.keyword.toLowerCase();
        const strategy = rule.matchingStrategy || 'exact';
        let matched = false;

        try {
          if (strategy === 'exact') {
            matched = combinedText.includes(keyword);
          } else if (strategy === 'regex') {
            const re = new RegExp(rule.keyword, 'i');
            matched = re.test(combinedText);
          } else if (strategy === 'fuzzy') {
            const words = keyword.split(/\s+/).filter(w => w.length > 0);
            matched = words.every(word => combinedText.includes(word));
          }
        } catch (e) {
          console.error(`Error applying rule ${rule.id}:`, e);
        }

        if (matched) {
          return { id: rule.assignedToUserId, name: rule.assignedToUserName };
        }
      }
    } catch (err) {
      console.error("Failed to load rules for assignment:", err);
    }
    
    return null;
  },

  // Session Management
  async getSessions() {
    return apiJson<any[]>('/api/auth/sessions');
  },

  async terminateSession(id: string) {
    return apiJson(`/api/auth/sessions/${id}`, {
      method: 'DELETE'
    });
  }
};
