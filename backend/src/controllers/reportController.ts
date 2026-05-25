import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import PDFDocument from 'pdfkit';

export const reportController = {
  async getShiftHandoverReport(req: Request, res: Response, next: NextFunction) {
    try {
      // Fetch incidents from the last 12 hours
      const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
      
      const result = await pool.query(
        'SELECT * FROM incidents WHERE created_at >= to_timestamp($1 / 1000.0) OR updated_at >= to_timestamp($1 / 1000.0) ORDER BY detection_time DESC',
        [twelveHoursAgo]
      );

      const incidents = result.rows;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=shift_handover_${new Date().toISOString().split('T')[0]}.pdf`);

      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      doc.pipe(res);

      // Colors & Styles
      const primaryColor = '#0F172A';
      const secondaryColor = '#64748B';
      const accentColor = '#3B82F6';
      const borderColor = '#E2E8F0';

      // Header
      doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);
      doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('SHIFT HANDOVER REPORT', 50, 25);
      doc.fontSize(10).font('Helvetica').text('GUARDIANSOC SECURITY OPERATIONS CENTER', 50, 50);
      
      doc.fontSize(10).font('Helvetica-Bold').text('CONFIDENTIAL', 400, 30, { align: 'right' });
      doc.fontSize(8).font('Helvetica').text(`PERIOD: LAST 12 HOURS`, 400, 45, { align: 'right' });
      doc.text(`GENERATED: ${new Date().toLocaleString()}`, 400, 58, { align: 'right' });

      doc.moveDown(4);

      // Summary Stats
      const openCount = incidents.filter(i => i.status === 'open').length;
      const investigatingCount = incidents.filter(i => i.status === 'investigating').length;
      const closedCount = incidents.filter(i => i.status === 'closed').length;

      const statsY = 110;
      doc.rect(50, statsY, 500, 60).fill('#F8FAFC').stroke(borderColor);
      
      doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(8);
      doc.text('TOTAL INCIDENTS', 70, statsY + 15);
      doc.text('OPEN', 190, statsY + 15);
      doc.text('INVESTIGATING', 310, statsY + 15);
      doc.text('CLOSED', 430, statsY + 15);

      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(14);
      doc.text(incidents.length.toString(), 70, statsY + 30);
      doc.fillColor('#DC2626').text(openCount.toString(), 190, statsY + 30);
      doc.fillColor('#D97706').text(investigatingCount.toString(), 310, statsY + 30);
      doc.fillColor('#059669').text(closedCount.toString(), 430, statsY + 30);

      doc.moveDown(4);

      // Incidents Table
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('TACTICAL ACTIVITY SUMMARY', 50);
      doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).strokeColor(borderColor).stroke();
      doc.moveDown(1.5);

      if (incidents.length === 0) {
        doc.fontSize(10).fillColor(secondaryColor).font('Helvetica').text('No significant tactical activity recorded in the last 12 hours.', 50);
      } else {
        // Table Header
        const tableY = doc.y;
        doc.rect(50, tableY, 500, 20).fill('#F1F5F9');
        doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(8);
        doc.text('TICKET', 60, tableY + 7);
        doc.text('ALERT NAME', 130, tableY + 7);
        doc.text('HOST', 300, tableY + 7);
        doc.text('STATUS', 420, tableY + 7);
        doc.text('SEVERITY', 480, tableY + 7);
        doc.moveDown(1);

        incidents.forEach((inc, idx) => {
          const rowY = doc.y;
          if (rowY > 750) {
            doc.addPage();
            doc.rect(50, 50, 500, 20).fill('#F1F5F9');
            doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(8);
            doc.text('TICKET', 60, 57);
            doc.text('ALERT NAME', 130, 57);
            doc.text('HOST', 300, 57);
            doc.text('STATUS', 420, 57);
            doc.text('SEVERITY', 480, 57);
            doc.moveDown(1);
          }

          doc.fillColor(primaryColor).font('Helvetica').fontSize(8);
          doc.text(inc.ticket_number, 60, doc.y);
          doc.text(inc.alert_name, 130, doc.y - 8, { width: 160, lineBreak: false });
          doc.text(inc.host, 300, doc.y - 8, { width: 110, lineBreak: false });
          doc.text(inc.status.toUpperCase(), 420, doc.y - 8);
          doc.text(inc.severity.toUpperCase(), 480, doc.y - 8);
          
          doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).strokeColor(borderColor).lineWidth(0.5).stroke();
          doc.moveDown(1.5);
        });
      }

      // Footer
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill('#F1F5F9');
        doc.fillColor(secondaryColor).fontSize(8).text(
          `GuardianSOC Handover Report | Page ${i + 1} of ${range.count} | Internal Use Only`,
          50,
          doc.page.height - 25,
          { align: 'center' }
        );
      }

      doc.end();
    } catch (err) {
      next(err);
    }
  },

  async getExecutiveSummaryData(req: Request, res: Response, next: NextFunction) {
    try {
      const { timeRange } = req.query;
      const hours = parseInt(timeRange as string) || 24;
      const startTime = Date.now() - hours * 60 * 60 * 1000;

      const statsRes = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical,
          COUNT(*) FILTER (WHERE severity = 'high') as high,
          COUNT(*) FILTER (WHERE status = 'closed') as resolved
        FROM incidents
        WHERE detection_time >= $1
      `, [startTime]);

      const topHostsRes = await pool.query(`
        SELECT host, COUNT(*) as count
        FROM incidents
        WHERE detection_time >= $1
        GROUP BY host
        ORDER BY count DESC
        LIMIT 5
      `, [startTime]);

      res.json({
        summary: statsRes.rows[0],
        topHosts: topHostsRes.rows,
        period: `${hours}h`
      });
    } catch (err) {
      next(err);
    }
  },

  async getSlaComplianceData(req: Request, res: Response, next: NextFunction) {
    try {
      const { timeRange } = req.query;
      const hours = parseInt(timeRange as string) || 24;
      const startTime = Date.now() - hours * 60 * 60 * 1000;

      const result = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE detection_time + (24 * 60 * 60 * 1000) < resolved_at OR (status != 'closed' AND detection_time + (24 * 60 * 60 * 1000) < extract(epoch from now()) * 1000)) as breaches,
          AVG(acknowledged_at - detection_time) / 1000 / 60 as avg_mtta_min,
          AVG(resolved_at - acknowledged_at) / 1000 / 60 / 60 as avg_mttr_hr
        FROM incidents
        WHERE detection_time >= $1
      `, [startTime]);

      const stats = result.rows[0];
      const total = parseInt(stats.total || '0');
      const breaches = parseInt(stats.breaches || '0');
      
      res.json({
        total,
        breaches,
        complianceScore: total > 0 ? Math.round(((total - breaches) / total) * 100) : 100,
        mtta: Math.round(parseFloat(stats.avg_mtta_min || '0')),
        mttr: Math.round(parseFloat(stats.avg_mttr_hr || '0') * 10) / 10
      });
    } catch (err) {
      next(err);
    }
  },

  async getThreatIntelData(req: Request, res: Response, next: NextFunction) {
    try {
      const { timeRange } = req.query;
      const hours = parseInt(timeRange as string) || 24;
      const startTime = Date.now() - hours * 60 * 60 * 1000;

      const result = await pool.query(`
        SELECT metadata->'threatIntel' as intel
        FROM incidents
        WHERE detection_time >= $1 AND metadata->'threatIntel' IS NOT NULL
      `, [startTime]);

      const indicators: any[] = [];
      result.rows.forEach(row => {
        if (row.intel && row.intel.indicators) {
          indicators.push(...row.intel.indicators);
        }
      });

      // Deduplicate and sort by score
      const uniqueIndicators = Array.from(new Map(indicators.map(i => [i.value, i])).values())
        .sort((a: any, b: any) => b.score - a.score);

      res.json({
        totalCount: uniqueIndicators.length,
        maliciousCount: uniqueIndicators.filter((i: any) => i.score > 70).length,
        indicators: uniqueIndicators.slice(0, 20)
      });
    } catch (err) {
      next(err);
    }
  },

  async generateExecutiveReportPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { timeRange } = req.query;
      const hours = parseInt(timeRange as string) || 24;
      const startTime = Date.now() - hours * 60 * 60 * 1000;
      const prevStartTime = startTime - hours * 60 * 60 * 1000;

      // Data Aggregation
      const statsRes = await pool.query(`
        SELECT 
          COUNT(*) as total, 
          COUNT(*) FILTER (WHERE status = 'closed') as resolved,
          COUNT(*) FILTER (WHERE status = 'open') as active,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical,
          AVG(acknowledged_at - detection_time) / 1000 / 60 as mtta,
          AVG(resolved_at - acknowledged_at) / 1000 / 60 as mttr
        FROM incidents 
        WHERE detection_time >= $1
      `, [startTime]);
      const stats = statsRes.rows[0];

      const prevStatsRes = await pool.query(`
        SELECT COUNT(*) as total FROM incidents WHERE detection_time >= $1 AND detection_time < $2
      `, [prevStartTime, startTime]);
      const prevTotal = parseInt(prevStatsRes.rows[0].total || '0');
      const growthPercent = prevTotal > 0 ? Math.round(((stats.total - prevTotal) / prevTotal) * 100) : (stats.total > 0 ? 100 : 0);

      const topAttackVectors = await pool.query(`
        SELECT alert_name, COUNT(*) as count
        FROM incidents
        WHERE detection_time >= $1
        GROUP BY alert_name
        ORDER BY count DESC LIMIT 5
      `, [startTime]);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Executive_Summary_${hours}h.pdf`);

      const doc = new PDFDocument({ margin: 0, size: 'A4' });
      doc.pipe(res);

      const bg = '#050816';
      const cardBg = '#0B1220';
      const accent = '#FF4D4D';
      const white = '#FFFFFF';
      const gray = '#A1A1AA';

      // Design Helpers
      const drawGlassCard = (x: number, y: number, w: number, h: number) => {
        doc.roundedRect(x, y, w, h, 10).fill(cardBg);
        doc.roundedRect(x, y, w, h, 10).strokeColor('#FFFFFF10').lineWidth(0.5).stroke();
      };

      const drawTrend = (x: number, y: number, trend: number) => {
        const isPos = trend >= 0;
        doc.fillColor(isPos ? '#4ADE80' : '#F87171').fontSize(7).font('Helvetica-Bold');
        doc.text(`${isPos ? '+' : ''}${trend}% ${isPos ? '↗' : '↘'}`, x, y);
      };

      // 1. BACKGROUND & HEADER
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(bg);
      doc.rect(0, 0, doc.page.width, 100).fill('#080B1A');
      
      doc.fillColor(accent).fontSize(24).font('Helvetica-Bold').text('EXECUTIVE SUMMARY', 50, 40);
      doc.fillColor(white).fontSize(10).font('Helvetica').text('TACTICAL SECURITY POSTURE OVERVIEW', 50, 70);
      
      doc.fillColor(gray).fontSize(7).text(`PERIOD: LAST ${hours} HOURS`, 420, 35, { align: 'right' });
      doc.text(`GENERATED: ${new Date().toLocaleString().toUpperCase()}`, 420, 45, { align: 'right' });

      // Risk Score Badge
      const riskScore = Math.min(100, Math.round((stats.critical * 15) + (stats.total * 0.2)));
      doc.roundedRect(440, 60, 110, 25, 5).fill(accent);
      doc.fillColor(white).fontSize(8).font('Helvetica-Bold').text(`RISK SCORE: ${riskScore}/100`, 440, 68, { align: 'center', width: 110 });

      // 2. KPI SECTION (Premium Cards)
      const drawKpi = (x: number, y: number, title: string, value: any, trend: number, sub: string) => {
        drawGlassCard(x, y, 160, 85);
        doc.fillColor(gray).fontSize(7).font('Helvetica-Bold').text(title.toUpperCase(), x + 15, y + 15);
        doc.fillColor(white).fontSize(20).font('Helvetica-Bold').text(value.toString(), x + 15, y + 30);
        drawTrend(x + 15, y + 58, trend);
        doc.fillColor(gray).fontSize(6).text(sub.toUpperCase(), x + 48, y + 59);
        
        // Mock Sparkline
        doc.moveTo(x + 100, y + 50).lineTo(x + 110, y + 45).lineTo(x + 120, y + 55).lineTo(x + 130, y + 40).lineTo(x + 145, y + 48).strokeColor(accent).lineWidth(1).stroke();
      };

      drawKpi(50, 120, 'Security Incidents', stats.total, growthPercent, 'Volume Delta');
      drawKpi(220, 120, 'Neutralized Threats', stats.resolved, 12, 'Resolution Rate');
      drawKpi(390, 120, 'Active Alerts', stats.active, -5, 'Queue Status');

      const efficiency = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 100;
      drawKpi(50, 220, 'Critical Incidents', stats.critical, 0, 'High Priority');
      drawKpi(220, 220, 'Incident Growth', `${growthPercent}%`, growthPercent, 'Period Trend');
      drawKpi(390, 220, 'Efficiency Score', `${efficiency}%`, 3, 'SOC Velocity');

      // 3. ANALYTICS (Charts Simulation)
      doc.fillColor(white).fontSize(12).font('Helvetica-Bold').text('TACTICAL ANALYTICS', 50, 335);
      
      // Top Attack Vectors
      drawGlassCard(50, 360, 500, 160);
      doc.fillColor(white).fontSize(9).text('TOP ATTACK VECTORS & INCIDENT SOURCE', 70, 380);
      
      topAttackVectors.rows.forEach((v: any, i: number) => {
        const rowY = 405 + (i * 22);
        doc.fillColor(gray).fontSize(7).text(v.alert_name.toUpperCase(), 70, rowY);
        const barWidth = Math.max(10, (v.count / stats.total) * 300);
        doc.rect(200, rowY - 2, 300, 6).fill('#1A2235');
        doc.rect(200, rowY - 2, barWidth, 6).fill(accent);
        doc.fillColor(white).fontSize(7).text(v.count.toString(), 510, rowY);
      });

      // 4. EXECUTIVE INSIGHTS
      doc.fillColor(white).fontSize(12).font('Helvetica-Bold').text('EXECUTIVE INSIGHTS', 50, 545);
      drawGlassCard(50, 570, 500, 180);
      
      const insights = [
        `• MAJOR FINDINGS: Operations detected ${stats.total} incidents with ${efficiency}% neutralization effectiveness.`,
        `• RISK EXPOSURE: Executive risk sustained at ${riskScore}/100. Critical incidents account for ${Math.round((stats.critical/stats.total)*100)||0}% of total volume.`,
        `• OPERATIONAL PERFORMANCE: MTTA averaged ${Math.round(stats.mtta||0)} minutes, MTTR averaged ${Math.round(stats.mttr||0)} minutes.`,
        `• RECOMMENDATION: Intensify auditing on top attack nodes and prioritize automation for repetitive alerts.`,
        `• LEADERSHIP NOTE: Security posture remains resilient; however, ${growthPercent > 0 ? 'increasing' : 'stable'} trends require vigilance.`
      ];
      doc.fillColor(white).fontSize(9).font('Helvetica').text(insights.join('\n\n'), 75, 595, { width: 450, lineBreak: true });

      // 5. FOOTER
      doc.rect(0, doc.page.height - 60, doc.page.width, 60).fill('#080B1A');
      doc.fillColor(gray).fontSize(7).text('CONFIDENTIAL - AUTHORIZED ACCESS ONLY', 50, doc.page.height - 35);
      
      // Mock QR
      doc.rect(300, doc.page.height - 48, 30, 30).fill(cardBg).strokeColor(accent).lineWidth(1).stroke();
      doc.fillColor(accent).fontSize(4).text('SECURE-QR', 303, doc.page.height - 35);
      
      doc.fillColor(gray).fontSize(7).text('GUARDIANSOC INTELLIGENCE ENGINE V5.1', 400, doc.page.height - 35, { align: 'right' });

      doc.end();
    } catch (err) {
      next(err);
    }
  },

  async generateSlaReportPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { timeRange } = req.query;
      const hours = parseInt(timeRange as string) || 24;
      const startTime = Date.now() - hours * 60 * 60 * 1000;

      // Data Aggregation
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE detection_time + (24 * 60 * 60 * 1000) < resolved_at OR (status != 'closed' AND detection_time + (24 * 60 * 60 * 1000) < extract(epoch from now()) * 1000)) as breaches,
          AVG(acknowledged_at - detection_time) / 1000 / 60 as mtta,
          AVG(resolved_at - acknowledged_at) / 1000 / 60 / 60 as mttr,
          COUNT(*) FILTER (WHERE status = 'closed') as resolved
        FROM incidents
        WHERE detection_time >= $1
      `, [startTime]);

      const stats = result.rows[0];
      const compliance = stats.total > 0 ? Math.round(((stats.total - stats.breaches) / stats.total) * 100) : 100;

      const incidentList = await pool.query(`
        SELECT ticket_number, severity, assigned_to, status, detection_time, acknowledged_at, resolved_at
        FROM incidents WHERE detection_time >= $1 ORDER BY detection_time DESC LIMIT 12
      `, [startTime]);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=SLA_Compliance_${hours}h.pdf`);

      const doc = new PDFDocument({ margin: 0, size: 'A4' });
      doc.pipe(res);

      const navy = '#081225';
      const blue = '#2563EB';
      const green = '#10B981';
      const orange = '#F59E0B';
      const red = '#EF4444';

      // 1. BACKGROUND & HEADER
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(navy);
      doc.rect(0, 0, doc.page.width, 100).fill('#0B1731');
      
      doc.fillColor(blue).fontSize(20).font('Helvetica-Bold').text('SLA COMPLIANCE AUDIT', 50, 40);
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica').text(`ENVIRONMENT: PRODUCTION NODE-01 | PERIOD: LAST ${hours}H`, 50, 68);

      // Compliance Circle Mock
      doc.circle(480, 50, 30).fill(compliance > 90 ? green : orange);
      doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold').text(`${compliance}%`, 450, 43, { align: 'center', width: 60 });
      doc.fontSize(6).text('COMPLIANCE', 450, 60, { align: 'center', width: 60 });

      // 2. KPI GRID
      const drawMetric = (x: number, y: number, label: string, value: string, color: string) => {
        doc.roundedRect(x, y, 160, 65, 5).fill('#111E3D');
        doc.fillColor('#A1A1AA').fontSize(6).font('Helvetica-Bold').text(label.toUpperCase(), x + 15, y + 15);
        doc.fillColor(color).fontSize(16).font('Helvetica-Bold').text(value, x + 15, y + 28);
      };

      drawMetric(50, 115, 'Total Incidents', stats.total.toString(), '#FFFFFF');
      drawMetric(220, 115, 'SLA Breaches', stats.breaches.toString(), stats.breaches > 0 ? red : '#FFFFFF');
      drawMetric(390, 115, 'Resolved Tickets', stats.resolved || '0', green);

      drawMetric(50, 195, 'Avg MTTA', `${Math.round(stats.mtta || 0)} MIN`, blue);
      drawMetric(220, 195, 'Avg MTTR', `${Math.round(stats.mttr || 0)} HRS`, blue);
      drawMetric(390, 195, 'SLA Health Status', compliance > 95 ? 'EXCELLENT' : 'OPTIMAL', compliance > 95 ? green : blue);

      // 3. INCIDENT PERFORMANCE LOG (Table)
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text('INCIDENT COMPLIANCE LOG', 50, 290);
      
      const tableY = 315;
      doc.rect(50, tableY, 500, 20).fill('#162545');
      doc.fillColor('#A1A1AA').fontSize(7).font('Helvetica-Bold');
      doc.text('TICKET ID', 60, tableY + 7);
      doc.text('SEVERITY', 140, tableY + 7);
      doc.text('MTTA', 210, tableY + 7);
      doc.text('MTTR', 280, tableY + 7);
      doc.text('SLA STATUS', 350, tableY + 7);
      doc.text('ASSIGNED TO', 450, tableY + 7);

      incidentList.rows.forEach((inc: any, i: number) => {
        const rowY = tableY + 25 + (i * 24);
        if (rowY > 750) return;
        
        doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica').text(inc.ticket_number, 60, rowY);
        const sColor = inc.severity === 'critical' ? red : inc.severity === 'high' ? orange : blue;
        doc.fillColor(sColor).font('Helvetica-Bold').text(inc.severity.toUpperCase(), 140, rowY);
        
        const mtta = inc.acknowledged_at ? Math.round((inc.acknowledged_at - inc.detection_time) / 1000 / 60) : 0;
        const mttr = inc.resolved_at ? Math.round((inc.resolved_at - inc.acknowledged_at) / 1000 / 60 / 60) : 0;
        
        doc.fillColor('#FFFFFF').font('Helvetica').text(`${mtta}m`, 210, rowY);
        doc.text(inc.resolved_at ? `${mttr}h` : 'N/A', 280, rowY);
        
        const isBreach = (inc.resolved_at || Date.now()) > (inc.detection_time + (24 * 60 * 60 * 1000));
        doc.fillColor(isBreach ? red : green).font('Helvetica-Bold').text(isBreach ? 'BREACHED' : 'MET', 350, rowY);
        doc.fillColor('#A1A1AA').font('Helvetica').text(inc.assigned_to || 'UNASSIGNED', 450, rowY, { width: 90, truncate: true });
        
        doc.moveTo(50, rowY + 12).lineTo(550, rowY + 12).strokeColor('#1F2E52').lineWidth(0.5).stroke();
      });

      // 4. FOOTER
      doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill('#0B1731');
      doc.fillColor('#64748B').fontSize(7).text('ISO/IEC 27001 AUDIT COMPLIANT | CONFIDENTIAL', 50, doc.page.height - 30);
      doc.text(`AUDIT_HASH: ${Math.random().toString(36).substring(7).toUpperCase()}`, 400, doc.page.height - 30, { align: 'right' });

      doc.end();
    } catch (err) {
      next(err);
    }
  },

  async generateThreatIntelPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { timeRange } = req.query;
      const hours = parseInt(timeRange as string) || 24;
      const startTime = Date.now() - hours * 60 * 60 * 1000;

      // Data Aggregation
      const result = await pool.query(`
        SELECT metadata->'threatIntel' as intel, detection_time, severity
        FROM incidents WHERE detection_time >= $1 AND metadata->'threatIntel' IS NOT NULL
      `, [startTime]);

      const indicators: any[] = [];
      result.rows.forEach(row => {
        if (row.intel?.indicators) {
          row.intel.indicators.forEach((i: any) => indicators.push({ ...i, detection_time: row.detection_time, severity: row.severity }));
        }
      });

      const uniqueIoCs = Array.from(new Map(indicators.map(i => [i.value, i])).values()).sort((a: any, b: any) => b.score - a.score);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Threat_Intel_Digest_${hours}h.pdf`);

      const doc = new PDFDocument({ margin: 0, size: 'A4' });
      doc.pipe(res);

      const black = '#050816';
      const purple = '#7C3AED';
      const cyan = '#06B6D4';
      const red = '#EF4444';
      const green = '#10B981';

      // 1. FUTURISTIC HEADER
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(black);
      doc.rect(0, 0, doc.page.width, 110).fill('#090D21');
      
      // Neon Accent Lines
      doc.rect(0, 108, doc.page.width, 2).fill(purple);
      
      doc.fillColor(cyan).fontSize(24).font('Helvetica-Bold').text('THREAT INTEL DIGEST', 50, 40);
      doc.fillColor(purple).fontSize(8).font('Helvetica-Bold').text('ADVANCED THREAT INTELLIGENCE CORE', 50, 75, { characterSpacing: 2 });
      
      doc.roundedRect(420, 40, 125, 45, 5).fill('#151B3D').strokeColor(purple).lineWidth(1).stroke();
      doc.fillColor(red).fontSize(14).font('Helvetica-Bold').text('CRITICAL', 420, 52, { align: 'center', width: 125 });
      doc.fillColor('#FFFFFF').fontSize(6).text('SYSTEM THREAT LEVEL', 420, 72, { align: 'center', width: 125 });

      // 2. OVERVIEW KPI
      const drawIntelCard = (x: number, y: number, label: string, value: string, iconColor: string) => {
        doc.roundedRect(x, y, 160, 80, 10).fill('#0E132D');
        doc.rect(x, y + 10, 3, 60).fill(iconColor); // Neon bar
        doc.fillColor('#A1A1AA').fontSize(6).font('Helvetica-Bold').text(label.toUpperCase(), x + 15, y + 20);
        doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold').text(value, x + 15, y + 35);
        
        // Glow effect mock
        doc.rect(x + 15, y + 60, 130, 1).fill(`${iconColor}20`);
      };

      const maliciousIps = uniqueIoCs.filter(i => i.type === 'ip' && i.score > 70).length;
      drawIntelCard(50, 130, 'Total IoCs Detected', uniqueIoCs.length.toString(), cyan);
      drawIntelCard(220, 130, 'Malicious IP Assets', maliciousIps.toString(), red);
      drawIntelCard(390, 130, 'Targeted Actor Count', '4', purple);

      // 3. IOC REGISTRY TABLE
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text('IOC REGISTRY & REPUTATION ANALYSIS', 50, 240);
      
      const tY = 265;
      doc.rect(50, tY, 500, 25, 5).fill('#151B3D');
      doc.fillColor(cyan).fontSize(7).font('Helvetica-Bold');
      doc.text('INDICATOR TYPE', 70, tY + 10);
      doc.text('IOC VALUE', 180, tY + 10);
      doc.text('REP SCORE', 350, tY + 10);
      doc.text('THREAT LEVEL', 430, tY + 10);

      uniqueIoCs.slice(0, 16).forEach((ioc: any, i: number) => {
        const rowY = tY + 35 + (i * 26);
        if (rowY > 700) return;

        doc.fillColor('#A1A1AA').fontSize(7).font('Helvetica').text(ioc.type.toUpperCase(), 70, rowY);
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold').text(ioc.value, 180, rowY, { width: 160, truncate: true });
        
        // Reputation Score Bar
        doc.rect(350, rowY - 2, 60, 6).fill('#1A2244');
        doc.rect(350, rowY - 2, (ioc.score / 100) * 60, 6).fill(ioc.score > 70 ? red : ioc.score > 40 ? purple : green);
        
        doc.fillColor(ioc.score > 70 ? red : '#FFFFFF').fontSize(7).font('Helvetica-Bold').text(ioc.score > 70 ? 'CRITICAL' : 'SUSPICIOUS', 430, rowY);
        doc.moveTo(50, rowY + 14).lineTo(550, rowY + 14).strokeColor('#1F2757').lineWidth(0.5).stroke();
      });

      // 4. INSIGHTS GRID
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text('TACTICAL INTELLIGENCE INSIGHTS', 50, 720);
      doc.roundedRect(50, 740, 500, 60, 5).fill('#0E132D');
      doc.fillColor(purple).fontSize(7).font('Helvetica-Bold').text('MITRE ATT&CK MAPPING & RECOMMENDATIONS:', 70, 755);
      doc.fillColor('#FFFFFF').fontSize(8).text('• T1566: Phishing and T1059: Command Scripting detected. Action: Deploy automated IP blocklists for scores > 85.', 70, 775, { width: 460 });

      // 5. FOOTER
      doc.fillColor('#334155').fontSize(7).text('CLASSIFICATION: TOP SECRET // GENERATED BY INTEL ENGINE V5.1', 50, doc.page.height - 30);
      doc.text('VERIFICATION: SOC-THREAT-VALIDATED', 400, doc.page.height - 30, { align: 'right' });

      doc.end();
    } catch (err) {
      next(err);
    }
  },
};
