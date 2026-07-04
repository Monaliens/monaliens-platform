FROM node:20-alpine

WORKDIR /app

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source
COPY . .

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 5555

# Start server
CMD ["npm", "start"]
