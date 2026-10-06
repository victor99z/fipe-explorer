# ==============================================================================
# FIPEX Explorer - Production Frontend Multi-Stage Dockerfile
# ==============================================================================

# --- Stage 1: Build TypeScript / Vite Application ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies cleanly using lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build production bundle
COPY . .
RUN npm run build

# --- Stage 2: Serve with Lightweight Nginx Alpine ---
FROM nginx:alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend bundle from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Healthcheck checking Nginx status
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --spider -q http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
