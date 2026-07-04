import { Server as SocketIOServer, Socket } from 'socket.io';
import { WebSocketEvents } from '../types';

export class WebSocketService {
  private io: SocketIOServer;
  private connectedClients: Map<string, Socket> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(` Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, socket);

      // Handle client subscription to specific offers
      socket.on('subscribe-offer', (offerId: number) => {
        socket.join(`offer-${offerId}`);
        console.log(` Client ${socket.id} subscribed to offer ${offerId}`);
      });

      // Handle client subscription to user-specific updates
      socket.on('subscribe-user', (userAddress: string) => {
        socket.join(`user-${userAddress.toLowerCase()}`);
        console.log(` Client ${socket.id} subscribed to user ${userAddress}`);
      });

      // Handle client subscription to collection updates
      socket.on('subscribe-collection', (collectionAddress: string) => {
        socket.join(`collection-${collectionAddress.toLowerCase()}`);
        console.log(` Client ${socket.id} subscribed to collection ${collectionAddress}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(` Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });

      // Send welcome message
      socket.emit('connected', {
        message: 'Connected to P2P Trade WebSocket',
        timestamp: Date.now(),
      });
    });
  }

  // Broadcast to all connected clients
  public broadcast<K extends keyof WebSocketEvents>(
    event: K,
    data: WebSocketEvents[K]
  ): void {
    this.io.emit(event, {
      ...data,
      timestamp: Date.now(),
    });
    console.log(` Broadcasted ${event} to all clients`);
  }

  // Send to specific offer subscribers
  public sendToOfferSubscribers<K extends keyof WebSocketEvents>(
    offerId: number,
    event: K,
    data: WebSocketEvents[K]
  ): void {
    this.io.to(`offer-${offerId}`).emit(event, {
      ...data,
      timestamp: Date.now(),
    });
    console.log(` Sent ${event} to offer ${offerId} subscribers`);
  }

  // Send to specific user subscribers
  public sendToUserSubscribers<K extends keyof WebSocketEvents>(
    userAddress: string,
    event: K,
    data: WebSocketEvents[K]
  ): void {
    this.io.to(`user-${userAddress.toLowerCase()}`).emit(event, {
      ...data,
      timestamp: Date.now(),
    });
    console.log(` Sent ${event} to user ${userAddress} subscribers`);
  }

  // Send to specific collection subscribers
  public sendToCollectionSubscribers<K extends keyof WebSocketEvents>(
    collectionAddress: string,
    event: K,
    data: WebSocketEvents[K]
  ): void {
    this.io.to(`collection-${collectionAddress.toLowerCase()}`).emit(event, {
      ...data,
      timestamp: Date.now(),
    });
    console.log(` Sent ${event} to collection ${collectionAddress} subscribers`);
  }

  // Get connected clients count
  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  // Send error to specific client
  public sendError(socketId: string, error: string, code?: string): void {
    const socket = this.connectedClients.get(socketId);
    if (socket) {
      socket.emit('error', {
        message: error,
        code,
        timestamp: Date.now(),
      });
    }
  }
} 