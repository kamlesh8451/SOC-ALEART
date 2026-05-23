import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

export class SocketService {
  private static io: Server | null = null;

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

      socket.on('disconnect', () => {
        console.log(`[WS] Client disconnected: ${socket.id}`);
      });
    });

    console.log('[SYS] Socket.io initialized');
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
