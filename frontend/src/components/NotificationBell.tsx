import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCircle, AlertTriangle, Info, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { notificationService, Notification } from '../services/notificationService';
import { useSocket } from '../lib/useSocket';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

interface NotificationBellProps {
  onSelectIncident?: (id: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onSelectIncident }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();

  const fetchNotifications = async () => {
    try {
      const data = await notificationService.getAll();
      setNotifications(data);
    } catch (err: any) {
      console.error('Failed to fetch notifications:', err.message);
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (socket) {
      socket.on('incidents_updated', () => {
        // Refresh when incidents change as it might trigger new notifications
        setTimeout(fetchNotifications, 1000);
      });
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [socket]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (err) {}
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await notificationService.delete(id);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {}
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.read) handleMarkAsRead(n.id);
    
    if (n.link && n.link.includes('id=')) {
      const id = n.link.split('id=')[1];
      if (onSelectIncident) onSelectIncident(id);
      setIsOpen(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="text-red-500 w-4 h-4" />;
      case 'warning': return <AlertTriangle className="text-orange-500 w-4 h-4" />;
      case 'success': return <CheckCircle className="text-green-500 w-4 h-4" />;
      default: return <Info className="text-blue-500 w-4 h-4" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button 
        size="icon" 
        variant="ghost" 
        className={cn(
          "relative text-primary border border-primary/10 hover:bg-primary/10 transition-all",
          isOpen && "bg-primary/10 border-primary/30"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center bg-error rounded-full text-[8px] font-black text-white border border-background shadow-[0_0_8px_rgba(var(--error),0.8)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-4 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl"
          >
            <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
               <div className="flex items-center gap-2">
                 <Bell size={14} className="text-primary" />
                 <h3 className="text-xs font-black uppercase tracking-widest">Tactical Updates</h3>
               </div>
               {unreadCount > 0 && (
                 <Button 
                  variant="ghost" 
                  className="h-6 text-[9px] font-bold text-primary/70 hover:text-primary p-0"
                  onClick={handleMarkAllRead}
                 >
                   MARK ALL READ
                 </Button>
               )}
            </div>

            <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20">
              {notifications.length === 0 ? (
                <div className="p-10 flex flex-col items-center justify-center text-center space-y-2 opacity-30">
                  <CheckCircle size={32} className="text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-tighter">Zero active alerts in queue</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div 
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "p-4 border-b border-border/50 cursor-pointer transition-colors hover:bg-primary/5 group relative",
                      !n.read && "bg-primary/[0.03]"
                    )}
                  >
                    {!n.read && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_8px_var(--primary-glow)]" />
                    )}
                    <div className="flex gap-3">
                      <div className="mt-1">{getIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                           <p className={cn("text-[11px] font-bold truncate leading-tight uppercase tracking-tight", n.read ? "text-muted-foreground" : "text-foreground")}>{n.title}</p>
                           <span className="text-[8px] font-mono text-primary/40 whitespace-nowrap">
                             {formatDistanceToNow(new Date(n.created_at), { addSuffix: true }).toUpperCase()}
                           </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 leading-normal line-clamp-2 opacity-80">{n.message}</p>
                        
                        <div className="flex items-center gap-3 mt-3">
                           {n.link && (
                             <div className="flex items-center gap-1 text-[8px] font-black text-primary/60 uppercase">
                                <ExternalLink size={10} /> View Incident
                             </div>
                           )}
                           <button 
                            onClick={(e) => handleDelete(e, n.id)}
                            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-error"
                           >
                             <Trash2 size={12} />
                           </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-3 bg-secondary/10 border-t border-border text-center">
               <p className="text-[8px] text-muted-foreground opacity-30 font-black uppercase tracking-[0.2em]">End of Notification Stream</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
