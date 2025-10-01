# Multi-stage Dockerfile for TeamBeat SvelteKit application

# Stage 1: Builder - Install dependencies and build the application
FROM node:20-alpine AS builder

# Install build tools for native dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Generate database types and build the application
RUN npm run db:generate || true
RUN npm run build

# Stage 2: Runtime - Create production image
FROM node:20-alpine AS runtime

# Install SQLite and other runtime dependencies
RUN apk add --no-cache sqlite sqlite-dev dumb-init

# Create app user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 sveltekit

WORKDIR /app

# Create database directory with proper permissions
RUN mkdir -p /db && chown -R sveltekit:nodejs /db

# Copy package files for production install
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm install drizzle-kit && \
    npm cache clean --force

# Copy built application and necessary files from builder stage
COPY --from=builder --chown=sveltekit:nodejs /app/build ./build
COPY --from=builder --chown=sveltekit:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=sveltekit:nodejs /app/drizzle.config.sqlite.ts ./
COPY --from=builder --chown=sveltekit:nodejs /app/drizzle.config.postgres.ts ./
COPY --from=builder --chown=sveltekit:nodejs /app/scripts/start.sh ./scripts/
RUN chmod +x ./scripts/start.sh

# Switch to non-root user
USER sveltekit

# Expose port 3000
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/db/teambeat.db

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "const http = require('http'); const options = { hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET', timeout: 5000 }; const req = http.request(options, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { try { const json = JSON.parse(data); process.exit(json.success && res.statusCode === 200 ? 0 : 1); } catch(e) { process.exit(1); }}); }); req.on('error', () => process.exit(1)); req.on('timeout', () => process.exit(1)); req.end();"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Use startup script to handle database initialization and start the app
CMD ["./scripts/start.sh"]
