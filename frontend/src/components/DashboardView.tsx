import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useSocket } from '@/lib/useSocket';
import { useTheme } from '@/lib/ThemeContext';
import { incidentService } from '@/services/incidentService';
import { adminService } from '@/services/adminService';
import { Incident } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Shield, AlertTriangle, CheckCircle, Clock, 
  LayoutDashboard, Ticket, Settings, ShieldAlert,
  Activity, MoreHorizontal, LogOut, Search, Bell, ShieldCheck,
  FileBarChart, Zap, TrendingUp, History, UserCheck, Layout, Lock, Unlock, Sun
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { RoutingRulesView } from './RoutingRulesView';
import { AdminSettings } from './AdminSettings';
import { IncidentsListView } from './IncidentsListView';
import { ThreatMap } from './ThreatMap';
import { ReportsHubView } from './ReportsHubView';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

export const DashboardView: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { socket, isConnected } = useSocket();
  const [currentView, setCurrentView] = useState<'dashboard' | 'incidents' | 'rules' | 'admin' | 'intel' | 'reports'>('dashboard');
  const [initialIncidentId, setInitialIncidentId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [featureFlags, setFeatureFlags] = useState<any[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  
  // Custom Layout States
  const [isLayoutLocked, setIsLayoutLocked] = useState(true);
  const [kpiOrder, setKpiOrder] = useState<string[]>(['threats', 'compliance', 'mtta', 'mttr']);
  const [openOrder, setOpenOrder] = useState<string[]>(['critical', 'high', 'medium', 'low']);
  const [closedOrder, setClosedOrder] = useState<string[]>(['critical', 'high', 'medium', 'low']);

  useEffect(() => {
    const savedKpi = localStorage.getItem('gsoc_kpi_order');
    const savedOpen = localStorage.getItem('gsoc_open_order');
    const savedClosed = localStorage.getItem('gsoc_closed_order');
    
    if (savedKpi) setKpiOrder(JSON.parse(savedKpi));
    if (savedOpen) setOpenOrder(JSON.parse(savedOpen));
    if (savedClosed) setClosedOrder(JSON.parse(savedClosed));
  }, []);

  const saveLayout = (type: 'kpi' | 'open' | 'closed', order: string[]) => {
    if (type === 'kpi') {
      setKpiOrder(order);
      localStorage.setItem('gsoc_kpi_order', JSON.stringify(order));
    } else if (type === 'open') {
      setOpenOrder(order);
      localStorage.setItem('gsoc_open_order', JSON.stringify(order));
    } else if (type === 'closed') {
      setClosedOrder(order);
      localStorage.setItem('gsoc_closed_order', JSON.stringify(order));
    }
  };

  const pieData = stats ? [
    { name: 'Critical', value: (stats.criticalOpen || 0) + (stats.criticalClosed || 0), color: '#ef4444' },
    { name: 'High', value: (stats.highOpen || 0) + (stats.highClosed || 0), color: '#f97316' },
    { name: 'Medium', value: (stats.mediumOpen || 0) + (stats.mediumClosed || 0), color: '#eab308' },
    { name: 'Low', value: (stats.lowOpen || 0) + (stats.lowClosed || 0), color: '#3b82f6' },
  ].filter(d => d.value > 0) : [];

  useEffect(() => {
    // Basic Deep Linking for email buttons
    const params = new URLSearchParams(window.location.search);
    const incidentId = params.get('incidentId');
    if (incidentId) {
      handleViewIncident(incidentId);
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

  const fetchData = async (isMounted: boolean) => {
    try {
      console.log('[TELEMETRY] Initiating tactical sync...');
      const [statsData, analyticsData, incidentsData, flagsData] = await Promise.all([
        incidentService.getStats(),
        incidentService.getAnalytics(),
        incidentService.getIncidents(),
        adminService.getFeatureFlags()
      ]);
      
      if (isMounted) {
        console.log('[TELEMETRY] Stats Received:', statsData);
        console.log('[TELEMETRY] Flags Received:', flagsData?.length);
        
        setStats(statsData);
        setAnalytics(analyticsData);
        setRecentIncidents(incidentsData.slice(0, 5));
        setFeatureFlags(flagsData);
        setLoading(false);
      }
    } catch (e: any) {
      if (isMounted) {
        console.error("[CRIT] Telemetry sync aborted:", e.message);
        toast.error(`Tactical Sync Failure: ${e.message}`, {
          description: "Check secure connection or contact HQ systems admin."
        });
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchData(isMounted);
    const statsInterval = setInterval(() => fetchData(isMounted), 30000);

    const unsub = incidentService.subscribeToIncidents((data) => {
      if (isMounted) setRecentIncidents(data.slice(0, 5));
    });

    if (socket) {
      socket.on('incidents_updated', (data) => {
        console.log('[WS] Tactical update:', data);
        fetchData(isMounted);
      });
    }

    return () => {
      isMounted = false;
      unsub();
      clearInterval(statsInterval);
      if (socket) socket.off('incidents_updated');
    };
  }, [socket]);

  const isEnabled = (flagName: string) => {
    const flag = featureFlags.find(f => f.name === flagName);
    return flag ? flag.is_enabled : true; // Default to true if not found
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case 'rules': return <RoutingRulesView />;
      case 'admin': return <AdminSettings onViewIncident={handleViewIncident} />;
      case 'incidents': return <IncidentsListView initialIncidentId={initialIncidentId} />;
      case 'intel': return (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
             <div>
                <h2 className="text-xl font-bold uppercase tracking-tighter text-foreground">Live Threat Intelligence</h2>
                <p className="text-[10px] text-primary/50 font-mono">Global Node Status Visualization</p>
             </div>
             <Badge className="bg-success/10 text-success border-success/20">NETWORK_NOMINAL</Badge>
          </div>
          <ThreatMap incidents={recentIncidents} onSelectIncident={handleViewIncident} />
        </div>
      );
      case 'reports': return <ReportsHubView />;
      case 'dashboard':
      default:
        return (
          <div className="space-y-12 pb-20">
            {/* Custom Layout Control */}
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Layout size={14} className="text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground/70">Visual Workspace</span>
                </div>
                {!isLayoutLocked && (
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[8px] animate-pulse">EDIT_MODE_ACTIVE</Badge>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsLayoutLocked(!isLayoutLocked)}
                className={cn(
                  "h-8 gap-2 text-[10px] font-black uppercase tracking-tighter border transition-all",
                  isLayoutLocked 
                    ? "text-primary/40 border-border hover:text-primary hover:border-primary/30" 
                    : "text-warning border-warning/30 bg-warning/5 hover:bg-warning/10"
                )}
              >
                {isLayoutLocked ? <Lock size={12} /> : <Unlock size={12} />}
                {isLayoutLocked ? "Unlock Layout" : "Lock Workspace"}
              </Button>
            </div>

            {/* Tier 1: Core Operational Intelligence */}
            <Reorder.Group 
              axis="x" 
              values={kpiOrder} 
              onReorder={(order) => saveLayout('kpi', order)}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {kpiOrder.map((id) => {
                if (id === 'threats' && isEnabled('widget_active_threats')) {
                  return (
                    <Reorder.Item key="threats" value="threats" dragListener={!isLayoutLocked}>
                      <KPICard 
                        title="ACTIVE THREATS" 
                        value={stats?.activeThreats} 
                        subValue={`${stats?.open || 0} New / ${stats?.investigating || 0} Active`} 
                        icon={<AlertTriangle className="text-error" />} 
                        color="error" 
                        isDraggable={!isLayoutLocked}
                      />
                    </Reorder.Item>
                  );
                }
                if (id === 'compliance' && isEnabled('widget_closed_total')) {
                  return (
                    <Reorder.Item key="compliance" value="compliance" dragListener={!isLayoutLocked}>
                      <KPICard 
                        title="All CLOSED TICKETS" 
                        value={stats?.closed} 
                        trend="Total Life Cycle" 
                        icon={<ShieldCheck className="text-purple-500" />} 
                        color="purple" 
                        isDraggable={!isLayoutLocked}
                      />
                    </Reorder.Item>
                  );
                }
                if (id === 'mtta' && isEnabled('widget_mtta')) {
                  return (
                    <Reorder.Item key="mtta" value="mtta" dragListener={!isLayoutLocked}>
                      <KPICard 
                        title="AVG ACK (MTTA)" 
                        value={`${analytics?.mtta || 0}m`} 
                        trend="Target < 15m" 
                        icon={<Activity className="text-primary" />} 
                        color="primary" 
                        isDraggable={!isLayoutLocked}
                      />
                    </Reorder.Item>
                  );
                }
                if (id === 'mttr' && isEnabled('widget_mttr')) {
                  return (
                    <Reorder.Item key="mttr" value="mttr" dragListener={!isLayoutLocked}>
                      <KPICard 
                        title="AVG RESOLVE (MTTR)" 
                        value={`${analytics?.mttr || 0}h`} 
                        trend="Target < 24h" 
                        icon={<History className="text-success" />} 
                        color="success" 
                        isDraggable={!isLayoutLocked}
                      />
                    </Reorder.Item>
                  );
                }
                return null;
              })}
            </Reorder.Group>

            {/* Tier 2: Live Exposure Matrix (Open) */}
            {isEnabled('widget_open_matrix') && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                   <div className="w-1 h-4 bg-error rounded-full" />
                   <h3 className="text-xs font-black uppercase tracking-[0.3em] text-error/80">Live Exposure Matrix (Open)</h3>
                </div>
                <Reorder.Group 
                  axis="x" 
                  values={openOrder} 
                  onReorder={(order) => saveLayout('open', order)}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  {openOrder.map((id) => {
                    if (id === 'critical') return <Reorder.Item key="critical" value="critical" dragListener={!isLayoutLocked}><MetricCard label="Critical Open" value={stats?.criticalOpen} show={isEnabled('widget_critical_open')} color="red" icon={<Zap className="w-3 h-3" />} isDraggable={!isLayoutLocked} /></Reorder.Item>;
                    if (id === 'high') return <Reorder.Item key="high" value="high" dragListener={!isLayoutLocked}><MetricCard label="High Open" value={stats?.highOpen} show={isEnabled('widget_high_open')} color="orange" icon={<ShieldAlert className="w-3 h-3" />} isDraggable={!isLayoutLocked} /></Reorder.Item>;
                    if (id === 'medium') return <Reorder.Item key="medium" value="medium" dragListener={!isLayoutLocked}><MetricCard label="Medium Open" value={stats?.mediumOpen} show={isEnabled('widget_medium_open')} color="yellow" icon={<Activity className="w-3 h-3" />} isDraggable={!isLayoutLocked} /></Reorder.Item>;
                    if (id === 'low') return <Reorder.Item key="low" value="low" dragListener={!isLayoutLocked}><MetricCard label="Low Open" value={stats?.lowOpen} show={isEnabled('widget_low_open')} color="blue" icon={<Shield className="w-3 h-3" />} isDraggable={!isLayoutLocked} /></Reorder.Item>;
                    return null;
                  })}
                </Reorder.Group>
              </div>
            )}

            {/* Tier 3: Neutralization History (Closed) */}
            {isEnabled('widget_closed_matrix') && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                   <div className="w-1 h-4 bg-success rounded-full" />
                   <h3 className="text-xs font-black uppercase tracking-[0.3em] text-success/80">Neutralization History (Closed)</h3>
                </div>
                <Reorder.Group 
                  axis="x" 
                  values={closedOrder} 
                  onReorder={(order) => saveLayout('closed', order)}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                  {closedOrder.map((id) => {
                    if (id === 'critical') return <Reorder.Item key="critical" value="critical" dragListener={!isLayoutLocked}><MetricCard label="Critical Closed" value={stats?.criticalClosed} show={isEnabled('widget_critical_closed')} color="red" icon={<CheckCircle className="w-3 h-3" />} isDraggable={!isLayoutLocked} /></Reorder.Item>;
                    if (id === 'high') return <Reorder.Item key="high" value="high" dragListener={!isLayoutLocked}><MetricCard label="High Closed" value={stats?.highClosed} show={isEnabled('widget_high_closed')} color="orange" icon={<CheckCircle className="w-3 h-3" />} isDraggable={!isLayoutLocked} /></Reorder.Item>;
                    if (id === 'medium') return <Reorder.Item key="medium" value="medium" dragListener={!isLayoutLocked}><MetricCard label="Medium Closed" value={stats?.mediumClosed} show={isEnabled('widget_medium_closed')} color="yellow" icon={<CheckCircle className="w-3 h-3" />} isDraggable={!isLayoutLocked} /></Reorder.Item>;
                    if (id === 'low') return <Reorder.Item key="low" value="low" dragListener={!isLayoutLocked}><MetricCard label="Low Closed" value={stats?.lowClosed} show={isEnabled('widget_low_closed')} color="blue" icon={<CheckCircle className="w-3 h-3" />} isDraggable={!isLayoutLocked} /></Reorder.Item>;
                    return null;
                  })}
                </Reorder.Group>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 bg-card border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary/70">Incident Velocity (7D)</CardTitle>
                </CardHeader>
                <CardContent className="w-full">
                  <div className="h-[300px] min-h-[300px] w-full">
                    {isClient && stats && (
                      <ResponsiveContainer width="99%" height="100%">
                        <BarChart data={stats?.velocity || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} vertical={false} />
                          <XAxis dataKey="name" stroke="currentColor" strokeOpacity={0.3} fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis stroke="currentColor" strokeOpacity={0.3} fontSize={10} axisLine={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '10px' }}
                            cursor={{ fill: 'var(--primary)', fillOpacity: 0.02 }}
                          />
                          <Bar dataKey="open" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary/70">Alert Severity Mix</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center relative w-full h-[300px] min-h-[300px]">
                  {isClient && stats && pieData.length > 0 ? (
                    <ResponsiveContainer width="99%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '10px' }}
                          itemStyle={{ fontSize: '10px', textTransform: 'uppercase' }}
                        />
                        <Legend 
                          formatter={(value) => <span className="text-[10px] font-bold uppercase tracking-tighter text-primary/70">{value}</span>}
                          verticalAlign="bottom" 
                          align="center"
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center space-y-2 opacity-20">
                      <Shield className="w-12 h-12 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">No Severity Signal</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card border-border shadow-sm">
               <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary/70">Recent Tactical Activity</CardTitle>
                  <Button variant="ghost" onClick={() => setCurrentView('incidents')} className="text-[10px] uppercase font-bold text-primary gap-2 h-7 px-2">
                    Access Registry <MoreHorizontal size={12} />
                  </Button>
               </CardHeader>
               <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border text-[10px] uppercase text-primary/50 font-bold tracking-widest">
                          <th className="pb-4 pl-2 font-bold">Ticket ID</th>
                          <th className="pb-4 font-bold">Alert Name</th>
                          <th className="pb-4 font-bold">Severity</th>
                          <th className="pb-4 font-bold">Node</th>
                          <th className="pb-4 pr-2 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs text-foreground/80">
                        {loading ? (
                          <tr><td colSpan={5} className="py-8 text-center text-primary/20 font-mono">Synchronizing...</td></tr>
                        ) : recentIncidents.length === 0 ? (
                          <tr><td colSpan={5} className="py-8 text-center text-primary/20 font-mono uppercase tracking-widest">Secure registry is empty</td></tr>
                        ) : recentIncidents.map(inc => (
                          <tr key={inc.id} onClick={() => handleViewIncident(inc.id)} className="border-b border-border/40 hover:bg-primary/5 transition-colors group cursor-pointer">
                            <td className="py-4 pl-2 font-mono text-[10px] text-primary font-bold tracking-tighter">{inc.ticketNumber}</td>
                            <td className="py-4 font-bold uppercase">{inc.alertName}</td>
                            <td className="py-4">
                              <Badge className={cn(
                                "text-[9px] uppercase font-black px-2 py-0.5 rounded-full border-none shadow-sm",
                                inc.severity === 'critical' ? 'bg-error text-white' : 
                                inc.severity === 'high' ? 'bg-warning text-white' : 
                                'bg-primary/20 text-primary'
                              )}>
                                {inc.severity}
                              </Badge>
                            </td>
                            <td className="py-4 opacity-50 lowercase">{inc.host}</td>
                            <td className="py-4 pr-2">
                              <div className="flex items-center gap-1.5">
                                 <div className={cn(
                                   "w-1.5 h-1.5 rounded-full",
                                   inc.status === 'open' ? "bg-primary shadow-[0_0_8px_var(--primary-glow)] animate-pulse" : inc.status === 'closed' ? "bg-success" : "bg-warning"
                                 )} />
                                 <span className="text-[10px] font-bold uppercase text-primary/70">{inc.status}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-500">
      <aside className="w-64 border-r border-border bg-card/40 backdrop-blur-md flex flex-col shadow-2xl z-20">
        <div className="p-6 flex items-center gap-3 border-b border-border">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tighter uppercase text-foreground">GuardianSOC</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <NavItem icon={<Ticket size={18} />} label="Incidents" active={currentView === 'incidents'} onClick={() => setCurrentView('incidents')} />
          <NavItem icon={<Activity size={18} />} label="Live Intel" active={currentView === 'intel'} onClick={() => setCurrentView('intel')} />
          <NavItem icon={<FileBarChart size={18} />} label="Intel Reports" active={currentView === 'reports'} onClick={() => setCurrentView('reports')} />
          <NavItem icon={<Settings size={18} />} label="System Rules" active={currentView === 'rules'} onClick={() => setCurrentView('rules')} />
          <NavItem icon={<ShieldAlert size={18} />} label="Security Settings" active={currentView === 'admin'} onClick={() => setCurrentView('admin')} />
        </nav>

        {/* Theme Switcher */}
        <div className="px-4 py-2 border-t border-border/50">
           <div className="flex items-center justify-between p-1 bg-background/50 rounded-lg border border-border/50">
              <ThemeBtn active={theme === 'cyber'} onClick={() => setTheme('cyber')} icon={<Zap size={12} />} label="Stealth" />
              <ThemeBtn active={theme === 'neon'} onClick={() => setTheme('neon')} icon={<Activity size={12} />} label="Neon" />
              <ThemeBtn active={theme === 'light'} onClick={() => setTheme('light')} icon={<Sun size={12} />} label="Paper" />
           </div>
        </div>

        <div className="p-4 border-t border-border">
          <div className="bg-secondary/50 rounded-xl p-3 border border-border space-y-3">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-black uppercase shadow-lg shadow-primary/20">
                  {(user?.name || user?.email || '??').substring(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{user?.name || user?.email || 'Unknown User'}</p>
                  <p className="text-[10px] text-muted-foreground uppercase truncate font-mono">{user?.role || 'User'}</p>
                </div>
             </div>
             <Button 
              variant="ghost" 
              className="w-full justify-start text-xs font-bold text-error hover:text-error/80 hover:bg-error/10 h-8 gap-2 p-2"
              onClick={logout}
             >
               <LogOut size={14} />
               TERMINATE SESSION
             </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 relative scrollbar-thin scrollbar-thumb-primary/20">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex justify-between items-end border-b border-border pb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-[1px] w-8 bg-primary/50" />
                <span className="text-[10px] font-mono font-bold text-primary/70 tracking-[0.3em] uppercase">Tactical Operations Command</span>
              </div>
              <h1 className="text-4xl font-black uppercase tracking-tighter text-foreground">HQ Command Center</h1>
              <p className="text-muted-foreground text-[9px] font-mono uppercase tracking-[0.25em] mt-2 max-w-xl leading-relaxed">Centralized Security Orchestration Hub v5.0.0-PRO</p>
            </div>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card shadow-sm">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_var(--primary-glow)]",
                    isConnected ? "bg-success animate-pulse" : "bg-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  )} />
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-widest",
                    isConnected ? "text-success" : "text-warning"
                  )}>
                    {isConnected ? "LIVE SYNC" : "RECONNECTING"}
                  </span>
               </div>
               <GlobalSearch onSelectIncident={handleViewIncident} />
               <NotificationBell onSelectIncident={handleViewIncident} />
            </div>
          </div>
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

const ThemeBtn = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex-1 flex flex-col items-center justify-center py-1.5 rounded-md transition-all gap-1",
      active ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
    )}
  >
    {icon}
    <span className="text-[7px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);

const NavItem = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group border",
      active 
        ? "bg-primary/10 text-primary border-primary/20 shadow-[inset_0_0_12px_rgba(var(--primary),0.05)]" 
        : "text-muted-foreground border-transparent hover:text-foreground hover:bg-white/5 hover:border-white/5"
    )}
  >
    <div className={cn(
      "transition-colors",
      active ? "text-primary" : "text-inherit group-hover:text-primary"
    )}>{icon}</div>
    <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary-glow)]" />}
  </button>
);

const KPICard = ({ title, value, subValue, trend, icon, color, isDraggable }: any) => (
  <Card className={cn(
    "bg-card border-border relative overflow-hidden group hover:border-primary/30 transition-all shadow-sm",
    isDraggable ? "cursor-grab active:cursor-grabbing border-warning/20 ring-1 ring-warning/5" : "cursor-default"
  )}>
    <div className={cn(
      "absolute top-0 left-0 w-1 h-full opacity-30 group-hover:opacity-100 transition-opacity",
      color === 'error' ? "bg-error" : color === 'success' ? "bg-success" : color === 'purple' ? "bg-purple-500" : "bg-primary"
    )} />
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{title}</CardTitle>
      <div className="p-2 bg-secondary/50 rounded-lg group-hover:scale-110 transition-transform">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-black text-foreground tracking-tighter">{value || 0}</div>
      {subValue && <p className="text-[9px] font-mono text-primary/50 uppercase mt-1 tracking-tighter">{subValue}</p>}
      {trend && (
        <p className={cn(
          "text-[10px] font-bold mt-1",
          trend.includes('-') || trend.includes('<') ? 'text-primary/70' : 'text-success'
        )}>
          {trend} <span className="text-muted-foreground/30 ml-1 font-normal tracking-tight uppercase">KPI STATUS</span>
        </p>
      )}
    </CardContent>
  </Card>
);

const MetricCard = ({ label, value, icon, color, show, isDraggable }: any) => {
  if (!show) return null;
  
  const colorMap: Record<string, string> = {
    red: 'text-error border-error/20 bg-error/5',
    orange: 'text-warning border-warning/20 bg-warning/5',
    yellow: 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5',
    blue: 'text-primary border-primary/20 bg-primary/5',
    green: 'text-success border-success/20 bg-success/5',
    purple: 'text-purple-500 border-purple-500/20 bg-purple-500/5',
    cyan: 'text-primary border-primary/20 bg-primary/5'
  };

  const activeColor = colorMap[color] || colorMap.blue;

  return (
    <Card className={cn(
      "bg-card border backdrop-blur-xl group hover:scale-[1.02] transition-all duration-300 shadow-sm", 
      activeColor.split(' ')[1],
      isDraggable ? "cursor-grab active:cursor-grabbing border-warning/20" : "cursor-default"
    )}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className={cn("p-1.5 rounded-md bg-secondary/50 shadow-inner", activeColor.split(' ')[0])}>
            {icon}
          </div>
          <Badge variant="outline" className={cn("text-[7px] font-black uppercase tracking-tighter border-none bg-secondary/30", activeColor.split(' ')[0])}>LIVE_DATA</Badge>
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
           <span className={cn("text-3xl font-black tracking-tighter", activeColor.split(' ')[0])}>{value || 0}</span>
           <span className="text-[8px] font-mono text-muted-foreground/40">UNITS</span>
        </div>
      </CardContent>
    </Card>
  );
};
