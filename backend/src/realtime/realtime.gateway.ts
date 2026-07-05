import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  branchId?: string | null;
  roleName?: string;
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private readonly logger = new Logger('RealtimeGateway');
  // userId → Set of socket IDs (one user can have multiple browser tabs)
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) { client.disconnect(); return; }

      const payload = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      }) as any;

      client.userId  = payload.sub;
      client.branchId = payload.branchId;
      client.roleName = payload.roleName;

      // Join rooms: personal room + branch room + role room
      client.join(`user:${payload.sub}`);
      if (payload.branchId) client.join(`branch:${payload.branchId}`);
      client.join(`role:${payload.roleName}`);

      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);

      this.logger.log(`Connected: ${payload.email} (${client.id})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const sockets = this.userSockets.get(client.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.userSockets.delete(client.userId);
      }
    }
    this.logger.log(`Disconnected: ${client.id}`);
  }

  // ── Emit helpers called by other services ────────────────────────────

  /** Send to a single user (all their tabs) */
  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /** Send to everyone in a branch */
  emitToBranch(branchId: string, event: string, data: unknown) {
    this.server.to(`branch:${branchId}`).emit(event, data);
  }

  /** Send to everyone with a given role (e.g. all OWNER users) */
  emitToRole(roleName: string, event: string, data: unknown) {
    this.server.to(`role:${roleName}`).emit(event, data);
  }

  /** Broadcast to every connected client */
  broadcast(event: string, data: unknown) {
    this.server.emit(event, data);
  }

  // ── Client-initiated messages ─────────────────────────────────────────

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    client.emit('pong', { ts: Date.now() });
  }
}
