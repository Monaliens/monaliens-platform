FROM node:20-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 9596

# Set environment variables
ENV NODE_ENV=production
ENV PORT=9596
ENV HOSTNAME="0.0.0.0"

# Start server
CMD ["npm", "start"]
