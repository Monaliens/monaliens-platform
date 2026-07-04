#!/bin/bash

# Auction Platform - Stop Local Development
# Usage: ./stop-local.sh

echo "🛑 Stopping Auction Platform..."

# Stop Docker containers
cd backend
docker-compose down 2>/dev/null || true

# Kill Hardhat node
pkill -f "hardhat node" 2>/dev/null || true

echo "✅ All services stopped"
