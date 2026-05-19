import React, { useEffect, useState, cloneElement } from "react";
import { 
  Shield, AlertTriangle, CheckCircle, Clock, Search, Filter, 
  Menu, Bell, User, LayoutDashboard, Ticket, Settings, 
  ArrowUpRight, ArrowDownRight, Activity, ShieldAlert,
  ChevronRight, MoreHorizontal, Download, Upload, Cpu,
  Database, Zap, Signal, Globe, Box, ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/utils";
import { incidentService } from "./services/incidentService";
import { Incident } from "./types";
import { CreateIncidentDialog } from "./components/CreateIncidentDialog";
import { IncidentDetailView } from "./components/IncidentDetailView";
import { AdminSettings } from "./components/AdminSettings";
import { importExportService } from "./services/importExportService";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from "recharts";

// Utility for colors
const SEVERITY_COLORS = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-600 text-white",
  medium: "bg-yellow-600 text-black",
  low: "bg-blue-600 text-white"
};

const STATUS_COLORS = {
  open: "border-red-500 text-red-500",
  pending: "border-yellow-500 text-yellow-500",
  closed: "border-green-500 text-green-500",
  escalated: "border-purple-500 text-purple-500"
};

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'cyber' | 'light' | 'midnight'>('cyber');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const unsubscribe = incidentService.subscribeToIncidents((data) => {
      setIncidents(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Update selected incident if data changes
  useEffect(() => {
    if (selectedIncident) {
      const updated = incidents.find(i => i.id === selectedIncident.id);
      if (updated) setSelectedIncident(updated);
    }
  }, [incidents]);

  const filteredIncidents = incidents.filter(inc => 
    inc.alertName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inc.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inc.host.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    open: incidents.filter(i => i.status === 'open').length,
    critical: incidents.filter(i => i.severity === 'critical' && i.status !== 'closed').length,
    closed: incidents.filter(i => i.status === 'closed').length,
    compliance: incidents.length > 0 
      ? Math.round((incidents.filter(i => Date.now() < i.slaDeadline || i.status === 'closed').length / incidents.length) * 100)
      : 100
  };

  const handleExport = () => {
    importExportService.exportIncidentsToCSV(incidents);
    toast.success("Security Database exported to CSV");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importExportService.importIncidentsFromCSV(file);
    }
  };

  return (
    <div className="min-h-screen transition-colors duration-300">
      <Toaster position="top-right" theme={theme === 'light' ? 'light' : 'dark'} richColors />
      
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 border-r border-border bg-card z-50 hidden md:block">
        <div className="p-6 flex items-center gap-3 border-b border-border">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tighter uppercase">GuardianSOC</span>
        </div>
        
        <nav className="p-4 space-y-1">
          <NavItem 
            icon={<LayoutDashboard className="w-4 h-4" />} 
            label="Dashboard" 
            active={activeTab === "dashboard"} 
            onClick={() => { setActiveTab("dashboard"); setSelectedIncident(null); }} 
          />
          <NavItem 
            icon={<Ticket className="w-4 h-4" />} 
            label="Incidents" 
            active={activeTab === "incidents"} 
            onClick={() => { setActiveTab("incidents"); setSelectedIncident(null); }} 
          />
          <NavItem 
            icon={<ShieldAlert className="w-4 h-4" />} 
            label="Escalations" 
            active={activeTab === "escalations"} 
            onClick={() => setActiveTab("escalations")} 
          />
          <NavItem 
            icon={<ShieldCheck className="w-4 h-4" />} 
            label="Admin" 
            active={activeTab === "admin"} 
            onClick={() => { setActiveTab("admin"); setSelectedIncident(null); }} 
          />
          <NavItem 
            icon={<Activity className="w-4 h-4" />} 
            label="Live Intel" 
            active={activeTab === "intel"} 
            onClick={() => { setActiveTab("intel"); setSelectedIncident(null); }} 
          />
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
           <div className="flex flex-col gap-4">
              <div className="p-3 bg-secondary rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  <span className="text-[10px] font-bold uppercase text-primary">Live Status</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed uppercase">Connected to Global Threat Feed v4.2</p>
              </div>
              <div className="flex items-center gap-3 p-2">
                 <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">ADM</div>
                 <div>
                    <p className="text-xs font-bold">SOC Lead Admin</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">unlimitedstorage84@gmail.com</p>
                 </div>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 min-h-screen relative">
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-8">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Query incident metadata..." 
                className="pl-10 bg-secondary border-border text-xs h-9 focus:ring-primary/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex bg-secondary p-1 rounded-md border border-border mr-2">
               <button onClick={() => setTheme('cyber')} className={cn("px-2 py-1 text-[8px] uppercase font-bold rounded transition-all", theme === 'cyber' ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground")}>Cyber</button>
               <button onClick={() => setTheme('midnight')} className={cn("px-2 py-1 text-[8px] uppercase font-bold rounded transition-all", theme === 'midnight' ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground")}>Midnight</button>
               <button onClick={() => setTheme('light')} className={cn("px-2 py-1 text-[8px] uppercase font-bold rounded transition-all", theme === 'light' ? "bg-gray-200 text-black" : "text-muted-foreground hover:text-foreground")}>Light</button>
            </div>
            <div className="hidden lg:flex items-center gap-2 mr-4">
               <div className="flex items-center gap-1.5 px-2 py-1 bg-secondary rounded border border-border">
                  <Database className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-mono text-muted-foreground">POSTGRES_LIVE</span>
               </div>
            </div>
            <Button 
              className="bg-primary hover:opacity-90 h-9 px-4 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              Manual Alert
            </Button>
          </div>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {selectedIncident ? (
              <IncidentDetailView 
                incident={selectedIncident} 
                onBack={() => setSelectedIncident(null)} 
                onSelectIncident={setSelectedIncident}
              />
            ) : (
              <>
                {activeTab === "dashboard" && (
                  <DashboardView 
                    incidents={incidents} 
                    stats={stats} 
                    onViewTickets={() => setActiveTab("incidents")} 
                    onSelectIncident={setSelectedIncident}
                    onExport={handleExport}
                    onImport={handleImport}
                  />
                )}
                {activeTab === "incidents" && (
                  <IncidentsListView 
                    incidents={filteredIncidents} 
                    onSelectIncident={setSelectedIncident} 
                  />
                )}
                {activeTab === "admin" && <AdminSettings />}
                {activeTab === "intel" && <LiveIntelView />}
              </>
            )}
          </AnimatePresence>
        </div>
      </main>

      <CreateIncidentDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-200 group",
        active 
          ? "bg-primary/10 text-primary" 
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      )}
    >
      <span className={cn("transition-transform group-hover:scale-110", active ? "text-primary" : "text-muted-foreground")}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function DashboardView({ incidents, stats, onViewTickets, onSelectIncident, onExport, onImport }: any) {
  const chartData = [
    { name: "Mon", open: 4, closed: 8 },
    { name: "Tue", open: 6, closed: 10 },
    { name: "Wed", open: 3, closed: 12 },
    { name: "Thu", open: 8, closed: 5 },
    { name: "Fri", open: 2, closed: 18 },
    { name: "Sat", open: 4, closed: 4 },
    { name: "Sun", open: 1, closed: 2 },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-sm font-display font-bold uppercase tracking-[0.2em] text-primary mb-1">Mission Control</h2>
           <h1 className="text-3xl font-display font-bold tracking-tighter text-foreground italic">SOC COMMAND CENTER</h1>
        </div>
        <div className="flex items-center gap-2">
           <Label className="cursor-pointer">
              <Input type="file" className="hidden" onChange={onImport} />
              <div className="h-9 px-4 flex items-center gap-2 border border-border rounded-md bg-secondary text-xs font-bold uppercase hover:opacity-80 transition-colors">
                 <Upload className="w-3 h-3" />
                 Import
              </div>
           </Label>
           <Button variant="outline" size="sm" onClick={onExport} className="h-9 px-4 border border-border bg-secondary text-xs font-bold uppercase hover:opacity-80">
              <Download className="w-3 h-3 mr-2" />
              Export
           </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Live Alerts" value={stats.open} trend="+4" icon={<AlertTriangle className="text-red-500" />} />
        <StatCard label="Critical Risk" value={stats.critical} trend={stats.critical > 5 ? "high" : "low"} icon={<ShieldAlert className="text-red-600" />} />
        <StatCard label="Resolution Rate" value={`${stats.compliance}%`} trend="98.2%" icon={<CheckCircle className="text-green-500" />} />
        <StatCard label="MTTR" value="4.2h" trend="-15m" icon={<Clock className="text-blue-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card border-border p-6 h-[400px]">
          <div className="flex justify-between items-start mb-6">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Incident Velocity</CardTitle>
          </div>
          <ResponsiveContainer width="100%" height="80%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} vertical={false} />
              <XAxis dataKey="name" stroke="currentColor" strokeOpacity={0.15} fontSize={10} axisLine={false} tickLine={false} />
              <YAxis stroke="currentColor" strokeOpacity={0.15} fontSize={10} axisLine={false} tickLine={false} />
              <RechartsTooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", fontSize: "10px", color: "var(--foreground)" }} />
              <Area type="monotone" dataKey="open" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.1} />
              <Area type="monotone" dataKey="closed" stroke="#22c55e" fill="#22c55e" fillOpacity={0.05} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="bg-card border-border p-6">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Recent Alerts</CardTitle>
          <div className="space-y-4">
            {incidents.slice(0, 4).map((inc: Incident) => (
              <div 
                key={inc.id} 
                onClick={() => onSelectIncident(inc)}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/20 bg-secondary cursor-pointer transition-all group"
              >
                <div className="flex flex-col gap-1 overflow-hidden">
                  <span className="text-[10px] font-mono text-muted-foreground">{inc.ticketNumber}</span>
                  <span className="text-xs font-bold text-foreground truncate">{inc.alertName}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            ))}
            <Button 
              variant="ghost" 
              className="w-full text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground"
              onClick={onViewTickets}
            >
              View All Queue
            </Button>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

function LiveIntelView() {
   const feeds = [
      { id: 1, type: 'SIEM', msg: 'Successful Brute Force Attempt on VPN-GATE-01', time: '1s ago', level: 'high' },
      { id: 2, type: 'AWS', msg: 'S3 Bucket "corp-internal-data" permissions modified', time: '5s ago', level: 'medium' },
      { id: 3, type: 'EDR', msg: 'Mimikatz-style process memory dump detected on HR-PC-04', time: '12s ago', level: 'critical' },
      { id: 4, type: 'WAF', msg: 'Large volume of SQL injection attempts blocks from 185.x.x.x', time: '30s ago', level: 'low' },
   ];

   return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 max-w-4xl mx-auto">
         <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-display font-bold italic tracking-tighter uppercase flex items-center gap-3">
               <Signal className="w-6 h-6 text-primary animate-pulse" />
               Global Security Feed
            </h1>
            <p className="text-xs text-muted-foreground font-mono">ENCRYPTED TACTICAL DATA STREAM // SOURCE: SIEM-CORRELATOR-01</p>
         </div>

         <div className="space-y-3">
            {feeds.map((f) => (
               <div key={f.id} className="p-4 bg-card border border-border rounded-lg flex items-center justify-between group hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-4">
                     <div className={cn(
                        "w-10 h-10 rounded bg-secondary flex items-center justify-center font-bold text-[10px]",
                        f.level === 'critical' ? 'text-primary border border-primary/20' : 'text-muted-foreground'
                     )}>
                        {f.type}
                     </div>
                     <div>
                        <p className={cn("text-sm font-bold", f.level === 'critical' ? 'text-foreground' : 'text-foreground/80')}>{f.msg}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{f.time} · {f.level.toUpperCase()} PRIORITY</p>
                     </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-[10px] font-bold uppercase text-muted-foreground hover:text-primary group-hover:bg-primary/10">Analyze</Button>
               </div>
            ))}
         </div>

         <div className="grid grid-cols-3 gap-6 mt-12">
            <IntelMetric label="Network Throuput" value="1.2 Gbps" icon={<Globe />} />
            <IntelMetric label="Blocked Assets" value="14,204" icon={<Box />} />
            <IntelMetric label="Active Threat Actors" value="02" icon={<ShieldAlert />} />
         </div>
      </motion.div>
   );
}

function IntelMetric({ label, value, icon }: any) {
  return (
    <div className="p-4 bg-secondary border border-border rounded-lg text-center">
      <div className="flex justify-center mb-2 text-muted-foreground">{icon}</div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">{label}</p>
      <h4 className="text-lg font-mono font-bold text-foreground mt-1">{value}</h4>
    </div>
  );
}

function StatCard({ label, value, trend, icon }: any) {
  return (
    <Card className="bg-card border-border p-5 hover:opacity-90 transition-opacity">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
        {icon}
      </div>
      <div className="flex items-baseline justify-between mt-2">
        <h3 className="text-2xl font-mono font-bold">{value}</h3>
        <span className="text-[10px] text-muted-foreground">{trend}</span>
      </div>
    </Card>
  );
}
function IncidentsListView({ incidents, onSelectIncident }: any) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === incidents.length) setSelectedIds([]);
    else setSelectedIds(incidents.map((i: any) => i.id));
  };

  const handleBulkClose = async () => {
    if (selectedIds.length === 0) return;
    try {
      await incidentService.bulkUpdateStatus(selectedIds, 'closed');
      toast.success(`Closed ${selectedIds.length} tickets`);
      setSelectedIds([]);
    } catch (e) {
      toast.error("Bulk action failed");
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
           <h1 className="text-2xl font-display font-bold tracking-tighter uppercase text-foreground">Incident Queue</h1>
           {selectedIds.length > 0 && (
             <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-md">
                <span className="text-[10px] font-bold text-primary uppercase">{selectedIds.length} Selected</span>
                <div className="h-3 w-[1px] bg-primary/20 mx-1" />
                <button onClick={handleBulkClose} className="text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase transition-colors">Bulk Close</button>
                <button className="text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase transition-colors">Escalate</button>
             </motion.div>
           )}
        </div>
        <div className="flex gap-2">
           <Input placeholder="Filter by host..." className="w-64 bg-secondary border-border h-8 text-xs font-mono" />
        </div>
      </div>

      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="bg-secondary/50 border-b border-border">
            <tr>
              <th className="p-4 w-10">
                 <input 
                  type="checkbox" 
                  className="rounded border-border bg-secondary text-primary focus:ring-primary"
                  checked={selectedIds.length === incidents.length && incidents.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Ticket Ref</th>
              <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Alert Identity</th>
              <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Target Node</th>
              <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Level</th>
              <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Lifecycle</th>
              <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Response SLA</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {incidents.map((inc: Incident) => (
              <tr 
                key={inc.id} 
                className={cn(
                  "group transition-colors cursor-pointer",
                  selectedIds.includes(inc.id) ? "bg-primary/[0.05]" : "hover:bg-primary/[0.02]"
                )}
              >
                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      className="rounded border-border bg-secondary text-primary focus:ring-primary"
                      checked={selectedIds.includes(inc.id)}
                      onChange={() => toggleSelect(inc.id)}
                    />
                </td>
                <td className="p-4 font-mono text-xs text-muted-foreground" onClick={() => onSelectIncident(inc)}>{inc.ticketNumber}</td>
                <td className="p-4" onClick={() => onSelectIncident(inc)}>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">{inc.alertName}</span>
                    <span className="text-[10px] text-muted-foreground">{inc.domain}</span>
                  </div>
                </td>
                <td className="p-4 font-mono text-xs text-muted-foreground italic" onClick={() => onSelectIncident(inc)}>{inc.host}</td>
                <td className="p-4" onClick={() => onSelectIncident(inc)}>
                  <Badge className={cn("text-[9px] font-bold uppercase tracking-tighter px-2 h-5 rounded-full text-white", SEVERITY_COLORS[inc.severity as keyof typeof SEVERITY_COLORS])}>
                    {inc.severity}
                  </Badge>
                </td>
                <td className="p-4" onClick={() => onSelectIncident(inc)}>
                  <span className={cn("text-[10px] font-bold uppercase border-l-2 pl-2 h-4 flex items-center", STATUS_COLORS[inc.status as keyof typeof STATUS_COLORS])}>
                    {inc.status}
                  </span>
                </td>
                <td className="p-4" onClick={() => onSelectIncident(inc)}>
                  <div className="w-24">
                    <SlaBadge incident={inc} />
                  </div>
                </td>
                <td className="p-4 text-right">
                  <Button variant="ghost" size="icon" className="text-muted-foreground opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); onSelectIncident(inc); }}>
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function SlaBadge({ incident }: { incident: Incident }) {
  const timeLeft = incident.slaDeadline - Date.now();
  const isBreached = timeLeft < 0;
  const isRisk = timeLeft < 2 * 60 * 60 * 1000 && !isBreached;
  
  const percentage = Math.max(0, Math.min(100, (timeLeft / (24 * 60 * 60 * 1000)) * 100));

  return (
    <div className="flex flex-col gap-1.5">
       <div className="flex items-center justify-between mb-0.5">
          <span className={cn(
             "text-[9px] font-bold font-mono",
             isBreached ? "text-primary" : isRisk ? "text-orange-500" : "text-muted-foreground"
          )}>
            {isBreached ? "BREACHED" : isRisk ? "RISK" : "ON TIME"}
          </span>
       </div>
       <Progress value={percentage} className="h-1 bg-secondary" indicatorClassName={cn(isBreached ? "bg-primary" : isRisk ? "bg-orange-500" : "bg-green-500")} />
    </div>
  );
}

