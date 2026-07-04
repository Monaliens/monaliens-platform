# Frontend Deployment Guide

This document explains how to deploy the Monaliens Frontend application using Docker and GitHub Actions.

## 🚀 Deployment Overview

The deployment system supports two environments:
- **Development**: Deployed from `dev` branch to port `3001`
- **Production**: Deployed from `master` branch to port `3000`

## 📋 Prerequisites

### Server Requirements
- Ubuntu 20.04+ or similar Linux distribution
- Docker 20.10+
- Docker Compose 2.0+
- Git

### GitHub Secrets Required
Set these secrets in your GitHub repository settings:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SERVER_IP` | Your server IP address | `192.168.1.100` |
| `SERVER_USER` | SSH username | `root` |
| `SSH_PRIVATE_KEY` | SSH private key for server access | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

## 🔧 Local Testing

Before deploying to the server, test the setup locally:

### 1. Make the test script executable
```bash
chmod +x test-deploy-local.sh
```

### 2. Run the test script
```bash
./test-deploy-local.sh
```

This script will:
- Test both development and production builds
- Verify that containers start correctly
- Check health endpoints
- Clean up after testing

## 🌍 Configuration

All configuration is hardcoded in the application. No environment variables are needed.

## 🚀 Deployment Process

### Development Deployment
1. Push changes to the `dev` branch
2. GitHub Actions automatically triggers deployment
3. Application is deployed to port `3001`
4. Access at: `http://your-server:3001`

### Production Deployment
1. Push changes to the `master` branch
2. GitHub Actions automatically triggers deployment
3. Application is deployed to port `3000`
4. Access at: `http://your-server:3000`

## 📁 File Structure

```
Frontend/
├── .github/
│   └── workflows/
│       ├── deploy-dev.yml          # Development deployment workflow
│       └── deploy-prod.yml         # Production deployment workflow
├── docker-compose.dev.yml          # Development Docker Compose
├── docker-compose.production.yml   # Production Docker Compose
├── Dockerfile.dev                  # Development Dockerfile
├── Dockerfile.production          # Production Dockerfile

├── test-deploy-local.sh           # Local testing script
└── .dockerignore                  # Docker ignore file
```

## 🔍 Manual Deployment Commands

### Development Environment
```bash
# Clone and navigate to project
git clone -b dev https://github.com/Monaliens/Frontend.git frontend-dev
cd frontend-dev

# Deploy (no .env needed - everything hardcoded)
docker-compose -f docker-compose.dev.yml up -d --build
```

### Production Environment
```bash
# Clone and navigate to project
git clone -b master https://github.com/Monaliens/Frontend.git frontend-prod
cd frontend-prod

# Deploy (no .env needed - everything hardcoded)
docker-compose -f docker-compose.production.yml up -d --build
```

## 🔧 Troubleshooting

### Check Container Status
```bash
# Development
docker ps --filter "name=frontend-dev"
docker logs frontend-dev

# Production
docker ps --filter "name=frontend-prod"
docker logs frontend-prod
```

### Health Checks
```bash
# Development
curl http://localhost:3001/health

# Production
curl http://localhost:3000/health
```

### Restart Services
```bash
# Development
docker-compose -f docker-compose.dev.yml restart

# Production
docker-compose -f docker-compose.production.yml restart
```

### Clean Rebuild
```bash
# Stop all containers and clean up
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.production.yml down
docker system prune -f

# Rebuild
docker-compose -f docker-compose.dev.yml up -d --build
docker-compose -f docker-compose.production.yml up -d --build
```



## 📊 Monitoring

### Container Health
```bash
docker stats frontend-dev frontend-prod
```

### Application Logs
```bash
# Follow logs
docker logs -f frontend-dev
docker logs -f frontend-prod

# Get recent logs
docker logs --tail 100 frontend-dev
docker logs --tail 100 frontend-prod
```

## 🔐 Security Notes

1. Both Dockerfiles run as non-root users
2. No sensitive data is exposed in the image
3. Source maps are disabled in production

## 📝 Customization

### Modifying Configuration
All configuration is hardcoded in the application source code.

### Changing Ports
1. Update the port mapping in docker-compose files
2. Update the health check URLs in workflows

### Adding New Environments
1. Create new docker-compose file (e.g., `docker-compose.staging.yml`)
2. Create new workflow file (e.g., `.github/workflows/deploy-staging.yml`)
3. Update branch triggers and port configurations

## 🆘 Support

If you encounter issues:
1. Check the GitHub Actions logs
2. Verify server has sufficient resources
3. Ensure all required secrets are set
4. Check Docker and Docker Compose versions
5. Review container logs for application-specific errors 