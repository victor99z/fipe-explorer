FROM oven/bun:1-alpine AS builder
USER root
WORKDIR /app

# Install Chromium from Alpine repos (Puppeteer's bundled Chrome is glibc-linked and won't run on musl)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package.json bun.lock* ./
RUN bun install

COPY . .

RUN mkdir -p data logs

CMD ["bun", "run", "src/index.ts"]
