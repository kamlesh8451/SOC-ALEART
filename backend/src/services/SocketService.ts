import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

export class SocketService {
  private static io: Server | null = null;
  private static incidentViewers: Map<string, Map<string, { id: string, name: string }>> = new Map();

  static init(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`[WS] Client connected: ${socket.id}`);
      
      socket.on('join', (room) => {
        socket.join(room);
        console.log(`[WS] Client ${socket.id} joined room: ${room}`);
      });

      socket.on('view_incident', ({ incidentId, user }) => {
        if (!this.incidentViewers.has(incidentId)) {
          this.incidentViewers.set(incidentId, new Map());
        }
        this.incidentViewers.get(incidentId)!.set(socket.id, user);
        socket.join(`incident:${incidentId}`);
        this.broadcastViewers(incidentId);
      });

      socket.on('stop_viewing', (incidentId) => {
        this.removeViewer(socket.id, incidentId);
        socket.leave(`incident:${incidentId}`);
      });

      socket.on('disconnect', () => {
        console.log(`[WS] Client disconnected: ${socket.id}`);
        this.incidentViewers.forEach((viewers, incidentId) => {
          if (viewers.has(socket.id)) {
            this.removeViewer(socket.id, incidentId);
          }
        });
      });
    });

    console.log('[SYS] Socket.io initialized');
  }

  private static removeViewer(socketId: string, incidentId: string) {
    const viewers = this.incidentViewers.get(incidentId);
    if (viewers && viewers.has(socketId)) {
      viewers.delete(socketId);
      if (viewers.size === 0) {
        this.incidentViewers.delete(incidentId);
      }
      this.broadcastViewers(incidentId);
    }
  }

  private static broadcastViewers(incidentId: string) {
    if (!this.io) return;
    const viewers = this.incidentViewers.get(incidentId);
    const viewerList = viewers ? Array.from(viewers.values()) : [];
    this.io.to(`incident:${incidentId}`).emit('incident_viewers_updated', {
      incidentId,
      viewers: viewerList
    });
  }

  static emit(event: string, data: any, room?: string) {
    if (!this.io) return;
    
    if (room) {
      this.io.to(room).emit(event, data);
    } else {
      this.io.emit(event, data);
    }
  }
}
