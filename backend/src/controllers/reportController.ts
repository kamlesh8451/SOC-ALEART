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
  }
};
