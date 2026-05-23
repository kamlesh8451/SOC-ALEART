import pool from '../config/db';

export class SyricService {
  /**
   * Syric AI Engine - Automated Incident Analysis and Insight Generation
   */
  static async analyzeIncident(incidentId: string) {
    try {
      console.log(`[SYRIC] Starting AI analysis for incident ${incidentId}...`);
      
      const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [incidentId]);
      if (result.rows.length === 0) return null;
      
      const incident = result.rows[0];
      
      // Mock AI Insight Generation
      // In a real scenario, this would call an LLM (OpenAI, Claude, etc.)
      const aiInsights = {
        summary: `Automated analysis of ${incident.alert_name} on host ${incident.host}. The pattern suggests a potential unauthorized connection attempt.`,
        indicator: incident.alert_name.includes('Connection') ? 'Network Traffic' : 'System Process',
        insight: `The activity originated from ${incident.host} and targeted external endpoints. This behavior deviates from the standard baseline for this host.`,
        recommendations: [
          `Isolate host ${incident.host} from the network immediately.`,
          `Review user sessions active during the detection time.`,
          `Scan for unauthorized executable files on the desktop.`,
          `Check for similar patterns across the ${incident.domain || 'internal'} domain.`
        ],
        mitre: {
          tactic: 'Exfiltration',
          technique: 'Exfiltration Over Alternative Protocol'
        },
        confidence: 0.85,
        generatedAt: Date.now()
      };

      await pool.query(
        'UPDATE incidents SET ai_insights = $1 WHERE id = $2',
        [JSON.stringify(aiInsights), incidentId]
      );
      
      console.log(`[SYRIC] Analysis complete for incident ${incidentId}. Confidence: ${aiInsights.confidence}`);
      return aiInsights;
    } catch (err) {
      console.error('[SYRIC] Analysis failed:', err);
      return null;
    }
  }
}
