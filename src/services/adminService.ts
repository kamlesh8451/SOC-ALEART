import { UserProfile, AssignmentRule, RoleDefinition } from "../types";

export const adminService = {
  // User Management
  async createUser(data: Omit<UserProfile, "id">) {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create user");
    return response.json();
  },

  async updateUser(id: string, data: Partial<Omit<UserProfile, "id">>) {
    const response = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update user");
    return response.json();
  },

  async deleteUser(id: string) {
    const response = await fetch(`/api/users/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete user");
    return response.json();
  },

  subscribeToUsers(callback: (users: UserProfile[]) => void) {
    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/users");
        if (response.ok) {
          const data = await response.json();
          callback(data);
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    };

    fetchUsers();
    const interval = setInterval(fetchUsers, 10000);
    return () => clearInterval(interval);
  },

  // Role Management
  async createRole(data: Omit<RoleDefinition, "id">) {
    const response = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create role");
    return response.json();
  },

  async updateRole(id: string, data: Partial<Omit<RoleDefinition, "id">>) {
    const response = await fetch(`/api/roles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update role");
    return response.json();
  },

  async deleteRole(id: string) {
    const response = await fetch(`/api/roles/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete role");
    return response.json();
  },

  subscribeToRoles(callback: (roles: RoleDefinition[]) => void) {
    const fetchRoles = async () => {
      try {
        const response = await fetch("/api/roles");
        if (response.ok) {
          const data = await response.json();
          callback(data);
        }
      } catch (error) {
        console.error("Failed to fetch roles:", error);
      }
    };

    fetchRoles();
    const interval = setInterval(fetchRoles, 10000);
    return () => clearInterval(interval);
  },

  // Assignment Rules Management
  async createRule(data: Omit<AssignmentRule, "id">) {
    const response = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create rule");
    return response.json();
  },

  async updateRule(id: string, data: Partial<Omit<AssignmentRule, "id">>) {
    // For now, let's use the incident update endpoint pattern or add a dedicated one
    // But server.ts doesn't have PATCH /api/rules/:id yet. I should add it.
    const response = await fetch(`/api/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update rule");
    return response.json();
  },

  async deleteRule(id: string) {
    const response = await fetch(`/api/rules/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete rule");
    return response.json();
  },

  subscribeToRules(callback: (rules: AssignmentRule[]) => void) {
    const fetchRules = async () => {
      try {
        const response = await fetch("/api/rules");
        if (response.ok) {
          const data = await response.json();
          callback(data);
        }
      } catch (error) {
        console.error("Failed to fetch rules:", error);
      }
    };

    fetchRules();
    const interval = setInterval(fetchRules, 10000);
    return () => clearInterval(interval);
  },

  // Logic to find assignment for an incident
  async getAssignmentForIncident(alertName: string, description: string): Promise<{ id: string, name: string } | null> {
    const response = await fetch("/api/rules");
    if (!response.ok) return null;
    const rules = (await response.json()) as AssignmentRule[];
    
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
    
    return null;
  }
};
