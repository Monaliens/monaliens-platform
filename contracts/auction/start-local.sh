#!/bin/bash

# Auction Platform - Local Development Startup Script
# Usage: ./start-local.sh

set -e

echo "🚀 Starting Auction Platform (Local Development)"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker.${NC}"
    exit 1
fi

# Step 1: Start Hardhat Node (in background)
echo -e "${YELLOW}Step 1: Starting Hardhat Node...${NC}"
cd contracts

# Kill existing hardhat node if running
pkill -f "hardhat node" 2>/dev/null || true
sleep 1

# Start hardhat node in background
npx hardhat node > /tmp/hardhat-node.log 2>&1 &
HARDHAT_PID=$!
echo "   Hardhat node started (PID: $HARDHAT_PID)"
sleep 3

# Check if hardhat is running
if ! ps -p $HARDHAT_PID > /dev/null; then
    echo -e "${RED}❌ Hardhat node failed to start. Check /tmp/hardhat-node.log${NC}"
    exit 1
fi
echo -e "${GREEN}   ✓ Hardhat node running on http://localhost:8545${NC}"

# Step 2: Deploy Contracts
echo ""
echo -e "${YELLOW}Step 2: Deploying contracts...${NC}"
npx hardhat run scripts/deploy/01-deploy-all.js --network localhost

# Step 3: Update backend .env with contract addresses
echo ""
echo -e "${YELLOW}Step 3: Updating backend .env with contract addresses...${NC}"
cd ../backend
node scripts/update-env-from-deploy.js

# Step 4: Start Docker (MongoDB + Backend)
echo ""
echo -e "${YELLOW}Step 4: Starting Docker containers...${NC}"

# Stop existing containers
docker-compose down 2>/dev/null || true

# Build and start
docker-compose up -d --build

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "Services:"
echo "  - Hardhat Node:  http://localhost:8545"
echo "  - MongoDB:       mongodb://localhost:27017"
echo "  - Backend API:   http://localhost:5555"
echo "  - Health Check:  http://localhost:5555/health"
echo ""
echo "Logs:"
echo "  - Hardhat:  tail -f /tmp/hardhat-node.log"
echo "  - Backend:  docker logs -f auction-backend"
echo ""
echo "To stop: ./stop-local.sh"
