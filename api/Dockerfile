FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Run any build steps if needed (e.g., if you add TypeScript later)
# RUN npm run build

# Production stage
FROM node:18-alpine

# Set environment to production
ENV NODE_ENV=production

# Use a non-root user for better security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S apiuser -u 1001 -G nodejs

WORKDIR /app

# Copy only production dependencies from builder stage
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

# Copy the rest of the application code
COPY --from=builder /app/src ./src

# Change ownership to non-root user
RUN chown -R apiuser:nodejs /app

# Switch to non-root user
USER apiuser

# Expose the port the app runs on
EXPOSE 3001

# Use a health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

# Start the application
CMD ["node", "src/index.js"] 