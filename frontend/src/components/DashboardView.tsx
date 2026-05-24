import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useSocket } from '@/lib/useSocket';
import { incidentService } from '@/services/incidentService';
import { Incident } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Shield, AlertTriangle, CheckCircle, Clock, 
  LayoutDashboard, Ticket, Settings, ShieldAlert,
  Activity, MoreHorizontal, LogOut, Search, Bell, ShieldCheck,
  FileBarChart
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { RoutingRulesView } from './RoutingRulesView';
import { AdminSettings } from './AdminSettings';
import { IncidentsListView } from './IncidentsListView';
import { ThreatMap } from './ThreatMap';
import { ReportsHubView } from './ReportsHubView';
import { GlobalSearch } from './GlobalSearch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const DashboardView: React.FC = () => {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const [currentView, setCurrentView] = useState<'dashboard' | 'incidents' | 'rules' | 'admin' | 'intel' | 'reports'>('dashboard');
  const [initialIncidentId, setInitialIncidentId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    // Basic Deep Linking for email buttons
    const params = new URLSearchParams(window.location.search);
    const incidentId = params.get('incidentId');
    if (incidentId) {
      handleViewIncident(incidentId);
      // Clean up the URL to prevent re-triggering on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  const handleViewIncident = (id: string) => {
    setInitialIncidentId(id);
    setCurrentView('incidents');
  };

  useEffect(() => {
    if (currentView !== 'incidents') {
      setInitialIncidentId(null);
    }
  }, [currentView]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, analyticsData, incidentsData] = await Promise.all([
          incidentService.getStats(),
          incidentService.getAnalytics(),
          incidentService.getIncidents()
        ]);
        setStats(statsData);
        setAnalytics(analyticsData);
        setRecentIncidents(incidentsData.slice(0, 5));
        setLoading(false);
      } catch (e) {
        console.error("Sync error", e);
      }
    };

    fetchData();
    const statsInterval = setInterval(fetchData, 30000); // Refresh every 30s

    // Set up real-time listener for updates (polling fallback)
    const unsub = incidentService.subscribeToIncidents((data) => {
      setRecentIncidents(data.slice(0, 5));
      setLoading(false);
      // stats refresh handled by statsInterval or socket
    });

    // High-Reflectivity Socket Listener
    if (socket) {
      socket.on('incidents_updated', (data) => {
        console.log('[WS] High-priority update received:', data);
        toast.info(`Tactical update: ${data.type}`, {
          description: "Syncing incident registry...",
          duration: 3000
        });
        fetchData(); // Trigger immediate full refresh (stats + list)
      });
    }

    return () => {
      unsub();
      clearInterval(statsInterval);
      if (socket) {
        socket.off('incidents_updated');
      }
    };
  }, [socket]);

  const renderContent = () => {
    switch (currentView) {
      case 'rules':
        return <RoutingRulesView />;
      case 'admin':
        return <AdminSettings onViewIncident={handleViewIncident} />;
      case 'incidents':
        return <IncidentsListView initialIncidentId={initialIncidentId} />;
      case 'intel':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-cyan-500/10 pb-4">
               <div>
                  <h2 className="text-xl font-bold uppercase tracking-tighter text-white">Live Threat Intelligence</h2>
                  <p className="text-[10px] text-cyan-500/50 font-mono">Global Node Status & Real-time Attack Surface Visualization</p>
               </div>
               <Badge className="bg-green-500/10 text-green-500 border-green-500/20">NETWORK_NOMINAL</Badge>
            </div>
            <ThreatMap incidents={recentIncidents} onSelectIncident={handleViewIncident} />
          </div>
        );
      case 'reports':
        return <ReportsHubView />;
      case 'dashboard':
      default:
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard title="ACTIVE THREATS" value={stats?.open || '0'} trend="+3.2%" icon={<AlertTriangle className="text-red-500" />} color="red" />
              <KPICard title="AVG ACK (MTTA)" value={`${analytics?.mtta || 0}m`} trend="Target < 15m" icon={<Activity className="text-cyan-500" />} color="cyan" />
              <KPICard title="AVG RESOLVE (MTTR)" value={`${analytics?.mttr || 0}h`} trend="Target < 24h" icon={<CheckCircle className="text-green-500" />} color="green" />
              <KPICard title="CLOSED TICKETS" value={stats?.closed || '0'} trend="+12.4%" icon={<ShieldCheck className="text-purple-500" />} color="purple" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 bg-black/40 border-cyan-500/10 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-cyan-500/70">Incident Velocity (7D)</CardTitle>
                </CardHeader>
                <CardContent className="w-full" style={{ height: 300 }}>
                  {stats && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.velocity || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="name" stroke="#67e8f950" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis stroke="#67e8f950" fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000', border: '1px solid #67e8f930', borderRadius: '8px', fontSize: '10px' }}
                          cursor={{ fill: '#67e8f905' }}
                        />
                        <Bar dataKey="open" fill="url(#colorAlerts)" radius={[4, 4, 0, 0]} />
                        <defs>
                          <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-black/40 border-cyan-500/10 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-cyan-500/70">Alert Severity Mix</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center relative w-full" style={{ height: 300 }}>
                  {stats && (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Critical', value: stats?.critical || 0, color: '#ef4444' },
                              { name: 'High', value: stats?.high || 0, color: '#f97316' },
                              { name: 'Medium', value: stats?.medium || 0, color: '#eab308' },
                              { name: 'Low', value: stats?.low || 0, color: '#3b82f6' },
                            ].filter(d => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {[
                              { name: 'Critical', color: '#ef4444' },
                              { name: 'High', color: '#f97316' },
                              { name: 'Medium', color: '#eab308' },
                              { name: 'Low', color: '#3b82f6' },
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #67e8f930', borderRadius: '8px', fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-2 gap-4 mt-6 w-full">
                         {[
                            { name: 'Critical', color: '#ef4444' },
                            { name: 'High', color: '#f97316' },
                            { name: 'Medium', color: '#eab308' },
                            { name: 'Low', color: '#3b82f6' },
                         ].map((item) => (
                           <div key={item.name} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-[10px] font-bold text-white/70 uppercase tracking-tighter">{item.name}</span>
                              <span className="text-[10px] text-white ml-auto">{stats?.[item.name.toLowerCase()] || 0}</span>
                           </div>
                         ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-black/40 border-cyan-500/10 backdrop-blur-xl">
               <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-cyan-500/70">Recent Tactical Activity</CardTitle>
                  <Button variant="ghost" onClick={() => setCurrentView('incidents')} className="text-[10px] uppercase font-bold text-cyan-500 gap-2 h-7 px-2">
                    Access Registry <MoreHorizontal size={12} />
                  </Button>
               </CardHeader>
               <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-cyan-500/10 text-[10px] uppercase text-cyan-500/50 font-bold tracking-widest">
                          <th className="pb-4 pl-2 font-bold">Ticket ID</th>
                          <th className="pb-4 font-bold">Alert Name</th>
                          <th className="pb-4 font-bold">Severity</th>
                          <th className="pb-4 font-bold">Node</th>
                          <th className="pb-4 pr-2 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs">
                        {loading ? (
                          <tr><td colSpan={5} className="py-8 text-center text-cyan-500/20 font-mono">Synchronizing...</td></tr>
                        ) : recentIncidents.length === 0 ? (
                          <tr><td colSpan={5} className="py-8 text-center text-cyan-500/20 font-mono uppercase tracking-widest">Secure registry is empty</td></tr>
                        ) : recentIncidents.map(inc => (
                          <tr key={inc.id} onClick={() => handleViewIncident(inc.id)} className="border-b border-cyan-500/5 hover:bg-cyan-500/5 transition-colors group cursor-pointer">
                            <td className="py-4 pl-2 font-mono text-[10px] text-cyan-500 font-bold tracking-tighter">{inc.ticketNumber}</td>
                            <td className="py-4 font-bold text-white/90 truncate max-w-[200px] uppercase">{inc.alertName}</td>
                            <td className="py-4">
                              <Badge className={cn(
                                "text-[9px] uppercase font-black px-2 py-0.5 rounded-full",
                                inc.severity === 'critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                                inc.severity === 'high' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 
                                'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                              )}>
                                {inc.severity}
                              </Badge>
                            </td>
                            <td className="py-4 text-white/50 lowercase">{inc.host}</td>
                            <td className="py-4 pr-2">
                              <div className="flex items-center gap-1.5">
                                 <div className={cn(
                                   "w-1.5 h-1.5 rounded-full animate-pulse",
                                   inc.status === 'open' ? 'bg-blue-500' : inc.status === 'closed' ? 'bg-green-500' : 'bg-orange-500'
                                 )} />
                                 <span className="text-[10px] font-bold uppercase text-cyan-500/70">{inc.status}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </CardContent>
            </Card>
          </>
        );
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans">
      <aside className="w-64 border-r border-cyan-500/10 bg-black/40 backdrop-blur-md flex flex-col shadow-2xl">
        <div className="p-6 flex items-center gap-3 border-b border-cyan-500/10">
          <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Shield className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold text-lg tracking-tighter uppercase text-white">GuardianSOC</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <NavItem icon={<Ticket size={18} />} label="Incidents" active={currentView === 'incidents'} onClick={() => setCurrentView('incidents')} />
          <NavItem icon={<Activity size={18} />} label="Live Intel" active={currentView === 'intel'} onClick={() => setCurrentView('intel')} />
          <NavItem icon={<FileBarChart size={18} />} label="Intel Reports" active={currentView === 'reports'} onClick={() => setCurrentView('reports')} />
          <NavItem icon={<Settings size={18} />} label="System Rules" active={currentView === 'rules'} onClick={() => setCurrentView('rules')} />
          <NavItem icon={<ShieldAlert size={18} />} label="Security Settings" active={currentView === 'admin'} onClick={() => setCurrentView('admin')} />
        </nav>

        <div className="p-4 border-t border-cyan-500/10">
          <div className="bg-cyan-500/5 rounded-xl p-3 border border-cyan-500/10 space-y-3">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-[10px] font-bold text-black uppercase shadow-lg shadow-cyan-500/20">
                  {(user?.name || user?.email || '??').substring(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{user?.name || user?.email || 'Unknown User'}</p>
                  <p className="text-[10px] text-cyan-500/50 uppercase truncate font-mono">{user?.role || 'User'}</p>
                </div>
             </div>
             <Button 
              variant="ghost" 
              className="w-full justify-start text-xs font-bold text-red-500 hover:text-red-400 hover:bg-red-500/10 h-8 gap-2 p-2"
              onClick={logout}
             >
               <LogOut size={14} />
               TERMINATE SESSION
             </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 relative scrollbar-thin scrollbar-thumb-cyan-500/20">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex justify-between items-end border-b border-cyan-500/20 pb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-[1px] w-8 bg-cyan-500/50" />
                <span className="text-[10px] font-mono font-bold text-cyan-500/70 tracking-[0.3em] uppercase">Tactical Operations Command</span>
              </div>
              <h1 className="text-4xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-cyan-500/80">HQ Command Center</h1>
              <p className="text-cyan-500/40 text-[9px] font-mono uppercase tracking-[0.25em] mt-2 max-w-xl leading-relaxed">Centralized Security Orchestration Hub v4.2.1-STABLE</p>
            </div>
            <div className="flex items-center gap-4">
               <GlobalSearch onSelectIncident={handleViewIncident} />
               <Button 
                 size="icon" 
                 variant="ghost" 
                 className="relative text-cyan-500 border border-cyan-500/10 hover:bg-cyan-500/10 transition-all"
                 onClick={() => setCurrentView('incidents')}
               >
                 <Bell size={18} />
                 <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-black shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
               </Button>
            </div>
          </div>
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

const NavItem = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group border",
      active 
        ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[inset_0_0_12px_rgba(6,182,212,0.05)]" 
        : "text-white/40 border-transparent hover:text-white hover:bg-white/5 hover:border-white/5"
    )}
  >
    <div className={cn(
      "transition-colors",
      active ? "text-cyan-400" : "text-inherit group-hover:text-cyan-400"
    )}>{icon}</div>
    <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />}
  </button>
);

const KPICard = ({ title, value, trend, icon, color }: any) => (
  <Card className="bg-black/40 border-cyan-500/10 backdrop-blur-xl relative overflow-hidden group hover:border-cyan-500/30 transition-all cursor-default">
    <div className={`absolute top-0 left-0 w-1 h-full bg-${color}-500 opacity-30 group-hover:opacity-100 transition-opacity`} />
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-white/50">{title}</CardTitle>
      <div className="p-2 bg-white/5 rounded-lg group-hover:scale-110 transition-transform">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-black text-white tracking-tighter">{value}</div>
      <p className={cn(
        "text-[10px] font-bold mt-1",
        trend.startsWith('+') ? 'text-green-500' : 'text-red-500'
      )}>
        {trend} <span className="text-white/20 ml-1 font-normal tracking-tight">VS LAST SESSION</span>
      </p>
    </CardContent>
  </Card>
);
