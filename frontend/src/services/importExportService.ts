import { Incident, Severity } from "../types";
import { incidentService } from "./incidentService";
import { toast } from "sonner";

export const importExportService = {
  // Simple CSV Export
  exportIncidentsToCSV(incidents: Incident[]) {
    const headers = ["Ticket", "Alert Name", "Severity", "Host", "Status", "Detection Time"];
    const rows = incidents.map(inc => [
      inc.ticketNumber,
      inc.alertName,
      inc.severity,
      inc.host,
      inc.status,
      new Date(inc.detectionTime).toISOString()
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `incidents_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // Simple CSV Import (Expects: Alert Name, Severity, Host, Description, Domain)
  async importIncidentsFromCSV(file: File) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split("\n").filter(l => l.trim() !== "");
          // Skip header
          const data = lines.slice(1);
          
          let importCount = 0;
          for (const line of data) {
            const [alertName, severity, host, description, domain] = line.split(",");
            if (alertName && severity && host) {
              await incidentService.createIncident({
                alertName: alertName.trim(),
                severity: severity.trim() as Severity,
                host: host.trim(),
                description: (description || "").trim(),
                domain: (domain || "Unknown").trim(),
                ownerId: "import"
              });
              importCount++;
            }
          }
          toast.success(`Successfully imported ${importCount} incidents`);
          resolve(importCount);
        } catch (err) {
          toast.error("Import failed: Checking CSV format");
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }
};
