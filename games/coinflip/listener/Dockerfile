FROM node:20-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Expose ports (API + WebSocket)
EXPOSE 3090 10001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3090
ENV HOSTNAME="0.0.0.0"

# Start both listener and API
CMD ["npm", "run", "start:all"]
