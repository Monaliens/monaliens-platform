FROM node:20-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ wget

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 9598

# Set environment variables
ENV NODE_ENV=production
ENV PORT=9598
ENV HOSTNAME="0.0.0.0"

# Start server
CMD ["npm", "start"]
