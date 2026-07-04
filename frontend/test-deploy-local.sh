#!/bin/bash

# Frontend Local Deployment Test Script

echo "🧪 Starting Frontend Local Deployment Test..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Test Development Environment
print_status "Testing Development Environment (Port 3001)..."

# No .env file needed - everything is hardcoded

# Stop and clean up existing containers
print_status "Cleaning up existing containers..."
docker-compose -f docker-compose.dev.yml down || true
docker system prune -f

# Build and start development environment
print_status "Building development environment..."
if DOCKER_BUILDKIT=1 docker-compose -f docker-compose.dev.yml build --no-cache; then
    print_status "✅ Development build completed successfully"
else
    print_error "❌ Development build failed"
    exit 1
fi

print_status "Starting development services..."
if docker-compose -f docker-compose.dev.yml up -d; then
    print_status "✅ Development services started"
else
    print_error "❌ Failed to start development services"
    exit 1
fi

# Wait for container to be ready
print_status "Waiting for development container to be ready..."
sleep 30

# Check if container is running
if docker ps --filter "name=frontend-dev" --format "table {{.Names}}\t{{.Status}}" | grep -q "frontend-dev"; then
    print_status "✅ Development container is running"
    docker ps --filter "name=frontend-dev" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    print_error "❌ Development container is not running"
    docker logs frontend-dev
    exit 1
fi

# Health check development
print_status "Testing development health check..."
for i in {1..10}; do
    if curl -f http://localhost:3001/ > /dev/null 2>&1; then
        print_status "✅ Development frontend is accessible on port 3001"
        break
    else
        print_warning "⏳ Waiting for development frontend... ($i/10)"
        sleep 10
    fi
    
    if [ $i -eq 10 ]; then
        print_error "❌ Development frontend health check failed"
        docker logs frontend-dev
        exit 1
    fi
done

# Stop development environment
print_status "Stopping development environment..."
docker-compose -f docker-compose.dev.yml down

# Test Production Environment
print_status "Testing Production Environment (Port 3000)..."

# No .env file needed - everything is hardcoded

# Clean up
print_status "Cleaning up for production test..."
docker system prune -f

# Build and start production environment
print_status "Building production environment..."
if DOCKER_BUILDKIT=1 docker-compose -f docker-compose.production.yml build --no-cache; then
    print_status "✅ Production build completed successfully"
else
    print_error "❌ Production build failed"
    exit 1
fi

print_status "Starting production services..."
if docker-compose -f docker-compose.production.yml up -d; then
    print_status "✅ Production services started"
else
    print_error "❌ Failed to start production services"
    exit 1
fi

# Wait for container to be ready
print_status "Waiting for production container to be ready..."
sleep 30

# Check if container is running
if docker ps --filter "name=frontend-prod" --format "table {{.Names}}\t{{.Status}}" | grep -q "frontend-prod"; then
    print_status "✅ Production container is running"
    docker ps --filter "name=frontend-prod" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    print_error "❌ Production container is not running"
    docker logs frontend-prod
    exit 1
fi

# Health check production
print_status "Testing production health check..."
for i in {1..10}; do
    if curl -f http://localhost:3000/ > /dev/null 2>&1; then
        print_status "✅ Production frontend is accessible on port 3000"
        break
    else
        print_warning "⏳ Waiting for production frontend... ($i/10)"
        sleep 10
    fi
    
    if [ $i -eq 10 ]; then
        print_error "❌ Production frontend health check failed"
        docker logs frontend-prod
        exit 1
    fi
done

# Stop production environment
print_status "Stopping production environment..."
docker-compose -f docker-compose.production.yml down

# Clean up
print_status "Cleaning up test environment..."
docker system prune -f

print_status "🎉 All tests completed successfully!"
print_status "✅ Development environment works on port 3001"
print_status "✅ Production environment works on port 3000"
print_status ""
print_status "Your deployment is ready! You can now:"
print_status "1. Commit and push to 'dev' branch to deploy development"
print_status "2. Commit and push to 'master' branch to deploy production" 