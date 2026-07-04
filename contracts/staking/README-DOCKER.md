# 🐳 Monaliens Event Listener Docker Setup

## Quick Start

```bash
# Build and start all services
docker-compose up -d

# Check logs
docker-compose logs -f event-listener

# Stop all services
docker-compose down
```

## Services

### 📊 Event Listener (`localhost:3001`)
- **Health Check**: http://localhost:3001/health
- **Logs**: `docker-compose logs -f event-listener`
- **Restart**: `docker-compose restart event-listener`

### 🍃 MongoDB (`localhost:27017`)
- **Username**: admin
- **Password**: monaliens2025
- **Database**: staking

### 🌐 MongoDB Admin (`localhost:8081`)
- **URL**: http://localhost:8081
- **Username**: monaliens
- **Password**: admin2025

## Commands

```bash
# Start in background
docker-compose up -d

# Start with logs
docker-compose up

# Stop services
docker-compose down

# Stop and remove volumes (CAREFUL: deletes data)
docker-compose down -v

# Rebuild after code changes
docker-compose up -d --build

# Check service status
docker-compose ps

# View logs
docker-compose logs -f event-listener
docker-compose logs -f mongodb

# Shell into container
docker-compose exec event-listener sh
docker-compose exec mongodb mongosh
```

## Environment Variables

Edit `docker-compose.yml` to change:

```yaml
environment:
  # Database
  MONGODB_URI: mongodb://admin:monaliens2025@mongodb:27017/staking?authSource=admin
  
  # Blockchain (already configured for Monad testnet)
  RPC_URL: https://monad-testnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
  STAKING_CONTRACT: 0x8FF40ac5d3A78FB5D8d3a3f47bC719D815F3dB90
  
  # Performance
  EVENT_BATCH_SIZE: 100
  STATS_UPDATE_INTERVAL: 60000
```

## Health Monitoring

### Health Check Endpoint
```bash
curl http://localhost:3001/health
```

### Docker Health Status
```bash
docker-compose ps
# Should show "healthy" for event-listener
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs event-listener

# Rebuild
docker-compose up -d --build
```

### Database connection issues
```bash
# Restart MongoDB
docker-compose restart mongodb

# Check MongoDB logs
docker-compose logs mongodb
```

### Reset everything
```bash
# Stop and remove all data
docker-compose down -v

# Restart fresh
docker-compose up -d
```

## Production Notes

1. **Change passwords** in `docker-compose.yml`
2. **Set resource limits** for containers
3. **Enable log rotation**
4. **Use external MongoDB** for production
5. **Set up monitoring alerts**

## File Structure

```
/home/asus/projects/monaliens/staking-contract/
├── docker-compose.yml          # Main orchestration file
├── event-listener/
│   ├── Dockerfile             # Event listener container
│   ├── .dockerignore          # Docker ignore rules
│   └── ... (app files)
└── README-DOCKER.md           # This file
```