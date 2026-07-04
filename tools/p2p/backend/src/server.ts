import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { config, validateConfig } from './config';
import { connectDatabase } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './middleware/logger';
import { WebSocketService } from './services/websocket';
import { BlockchainEventListener } from './services/eventListener';
import { SettlementService } from './services/settlement';
import { redisCache } from './services/redisCache';

// Routes
import healthRoutes from './routes/health';
import offersRoutes from './routes/offers';

class Server {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;
  private io!: SocketIOServer;
  private websocketService!: WebSocketService;
  private eventListener!: BlockchainEventListener;
  private settlementService!: SettlementService;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.setupSocketIO();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupServices();
  }

  private setupSocketIO(): void {
    const allowedOrigins = [
      config.server.corsOrigin,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3020',
      process.env.FRONTEND_URL || 'https://your-domain',
      process.env.FRONTEND_URL_WWW || 'https://www.your-domain',
      process.env.API_URL || 'https://your-api-url',
      process.env.DEV_API_URL || 'https://dev.your-api-url',
      process.env.DEV_FRONTEND_URL || 'https://dev.your-domain',
      process.env.FRONTEND_URL || 'https://your-domain',
      'https://monfront-bay.vercel.app'
    ];

    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.websocketService = new WebSocketService(this.io);
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));

    // CORS
    const allowedOrigins = [
      config.server.corsOrigin,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3020',
      process.env.FRONTEND_URL || 'https://your-domain',
      process.env.FRONTEND_URL_WWW || 'https://www.your-domain',
      process.env.API_URL || 'https://your-api-url',
      process.env.DEV_API_URL || 'https://dev.your-api-url',
      process.env.DEV_FRONTEND_URL || 'https://dev.your-domain',
      process.env.FRONTEND_URL || 'https://your-domain',
      'https://monfront-bay.vercel.app'
    ];
    
    this.app.use(cors({
      origin: allowedOrigins,
      credentials: true,
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    this.app.use(logger);

    // Request context
    this.app.use((req, res, next) => {
      res.locals.timestamp = Date.now();
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.use('/api/health', healthRoutes);
    
    // Main API routes
    this.app.use('/api/offers', offersRoutes);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
        code: 'ROUTE_NOT_FOUND',
        timestamp: Date.now(),
      });
    });

    // Error handler (must be last)
    this.app.use(errorHandler);
  }

  private setupServices(): void {
    // Initialize blockchain event listener
    this.eventListener = new BlockchainEventListener(this.websocketService);
    
    // Initialize settlement service
    this.settlementService = new SettlementService(this.websocketService);
  }

  public async start(): Promise<void> {
    try {
      // Validate configuration
      validateConfig();

      // Connect to database
      await connectDatabase();

      // Connect to Redis cache
      await redisCache.connect();

      // Start services with Alchemy RPC (WebSocket + subscription support)
      console.log(' Enabling EventListener with Alchemy RPC for real-time cache invalidation...');
      await this.eventListener.initialize();
      await this.settlementService.start();

      // Start HTTP server
      this.httpServer.listen(config.server.port, () => {
        console.log(` Server running on port ${config.server.port}`);
        console.log(` Environment: ${config.server.nodeEnv}`);
        console.log(` WebSocket server ready`);
        console.log(` API available at http://localhost:${config.server.port}/api`);
      });

      // Graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      console.error(' Failed to start server:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      console.log('\n Shutting down server...');

      try {
        // Stop services
        await this.settlementService?.stop();
        await this.eventListener?.stop();

        // Disconnect Redis
        await redisCache.disconnect();

        // Close WebSocket connections
        this.io?.close();

        // Close HTTP server
        this.httpServer?.close(() => {
          console.log(' Server shut down gracefully');
          process.exit(0);
        });

      } catch (error) {
        console.error(' Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
}

// Start server
const server = new Server();
server.start().catch((error) => {
  console.error(' Server startup failed:', error);
  process.exit(1);
});

export default Server; 