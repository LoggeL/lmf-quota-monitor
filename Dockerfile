# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 (none needed for this project)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
WORKDIR /app/backend
RUN npm ci

WORKDIR /app/frontend
RUN npm ci

# Copy source files
WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Build backend
WORKDIR /app/backend
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy backend dist and deps
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package.json ./backend/

# Copy frontend build
COPY --from=builder /app/frontend/dist ./frontend/dist

WORKDIR /app/backend

# Expose port
EXPOSE 3456

# Start server
CMD ["node", "dist/index.js"]
