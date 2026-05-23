import pool from '../config/db';

export class ThreatIntelService {
  /**
   * Automatically extracts indicators (IPs, domains) from text
   * and provides a reputation score.
   */
  static async enrichIncident(incidentId: string, text: string) {
    try {
      const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
      const domainRegex = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;

      const ips = Array.from(new Set(text.match(ipRegex) || []));
      const domains = Array.from(new Set(text.match(domainRegex) || []));

      if (ips.length === 0 && domains.length === 0) return null;

      // Mock Enrichment Data (In a real scenario, call AbuseIPDB, VirusTotal, etc.)
      const threatIntel = {
        indicators: [
          ...ips.map(ip => ({ type: 'ip', value: ip, score: Math.floor(Math.random() * 100), provider: 'AbuseIPDB (Mock)' })),
          ...domains.map(domain => ({ type: 'domain', value: domain, score: Math.floor(Math.random() * 100), provider: 'VirusTotal (Mock)' }))
        ],
        lastUpdated: Date.now(),
        summary: 'Indicators extracted and analyzed via automated threat intelligence feed.'
      };

      // Update incident metadata
      const result = await pool.query('SELECT metadata FROM incidents WHERE id = $1', [incidentId]);
      const currentMetadata = result.rows[0]?.metadata || {};
      
      const newMetadata = {
        ...currentMetadata,
        threatIntel
      };

      await pool.query('UPDATE incidents SET metadata = $1 WHERE id = $2', [JSON.stringify(newMetadata), incidentId]);
      console.log(`[INTEL] Incident ${incidentId} enriched with ${ips.length + domains.length} indicators.`);
      
      return threatIntel;
    } catch (err) {
      console.error('[INTEL] Enrichment failed:', err);
      return null;
    }
  }
}
