FROM node:20-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Copy package files from root
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Copy backend source code
COPY backend/ ./backend/

# Expose port
EXPOSE 9597

# Set environment variables
ENV NODE_ENV=production
ENV PORT=9597
ENV HOSTNAME="0.0.0.0"

# Start server
CMD ["node", "backend/server.js"]
