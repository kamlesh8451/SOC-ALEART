import pool from '../config/db';

export interface AssignmentMatch {
  id: string;
  name: string;
}

export async function getAssignmentForIncident(
  alertName: string,
  description: string
): Promise<AssignmentMatch | null> {
  const result = await pool.query(
    `SELECT * FROM assignment_rules WHERE active = TRUE ORDER BY priority DESC`
  );

  const combinedText = `${alertName} ${description}`.toLowerCase();

  for (const rule of result.rows) {
    const keyword = (rule.keyword as string).toLowerCase();
    const strategy = (rule.matching_strategy as string) || 'exact';
    let matched = false;

    try {
      if (strategy === 'exact') {
        matched = combinedText.includes(keyword);
      } else if (strategy === 'regex') {
        matched = new RegExp(rule.keyword as string, 'i').test(combinedText);
      } else if (strategy === 'fuzzy') {
        const words = keyword.split(/\s+/).filter((w: string) => w.length > 0);
        matched = words.every((word: string) => combinedText.includes(word));
      }
    } catch {
      continue;
    }

    if (matched) {
      return {
        id: rule.assigned_to_user_id,
        name: rule.assigned_to_user_name,
      };
    }
  }

  return null;
}
