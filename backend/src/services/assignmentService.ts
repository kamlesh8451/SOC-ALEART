import pool from '../config/db';

export interface AssignmentResult {
  userId?: string;
  userName?: string;
  teamName?: string;
  severityOverride?: string;
  autoSla?: boolean;
}

export async function getAssignmentForIncident(
  alertName: string,
  description: string
): Promise<AssignmentResult | null> {
  const result = await pool.query(
    `SELECT * FROM assignment_rules 
     WHERE active = TRUE 
     ORDER BY priority DESC, name ASC`
  );

  const combinedText = `${alertName} ${description}`.toLowerCase();

  for (const rule of result.rows) {
    const keyword = rule.keyword.toLowerCase();
    const strategy = rule.matching_strategy || 'contains';
    let matched = false;

    try {
      switch (strategy) {
        case 'exact':
          matched = combinedText === keyword;
          break;
        case 'contains':
          matched = combinedText.includes(keyword);
          break;
        case 'regex':
          matched = new RegExp(rule.keyword, 'i').test(combinedText);
          break;
        case 'starts_with':
          matched = combinedText.startsWith(keyword);
          break;
        case 'ends_with':
          matched = combinedText.endsWith(keyword);
          break;
      }
    } catch (err) {
      console.error(`[RULE] Invalid rule execution for ${rule.name}:`, err);
      continue;
    }

    if (matched) {
      console.log(`[RULE] Incident matched rule: ${rule.name}`);
      return {
        userId: rule.assigned_to_user_id || undefined,
        userName: rule.assigned_to_user_name || undefined,
        teamName: rule.assign_to_team || undefined,
        severityOverride: rule.severity_override || undefined,
        autoSla: rule.auto_sla_assignment ?? true
      };
    }
  }

  return null;
}
