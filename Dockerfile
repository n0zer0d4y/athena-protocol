# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm install typescript && \
    npm run build && \
    npm uninstall typescript

# Production stage
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S athena && \
    adduser -S athena -u 1001

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY README.md LICENSE ./

# Set ownership
RUN chown -R athena:athena /app

# Switch to non-root user
USER athena

# Expose port (if using standalone mode)
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Default command (MCP server mode)
CMD ["node", "dist/index.js"]

# To run in standalone mode, use:
# CMD ["node", "dist/standalone-server.js"]

