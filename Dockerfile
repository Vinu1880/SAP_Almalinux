# =============================================
# Dockerfile Multi-Stage pour Next.js + Prisma
# Compatible Windows, Linux (AlmaLinux), macOS
# =============================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci --legacy-peer-deps
RUN ./node_modules/.bin/prisma generate

# =============================================
# Stage 2: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

ARG NEXT_PUBLIC_AZURE_AD_CLIENT_ID
ARG NEXT_PUBLIC_AZURE_AD_TENANT_ID
ARG NEXT_PUBLIC_AZURE_AD_REDIRECT_URI
ARG NEXT_PUBLIC_CRON_SECRET

ENV NEXT_PUBLIC_AZURE_AD_CLIENT_ID=${NEXT_PUBLIC_AZURE_AD_CLIENT_ID}
ENV NEXT_PUBLIC_AZURE_AD_TENANT_ID=${NEXT_PUBLIC_AZURE_AD_TENANT_ID}
ENV NEXT_PUBLIC_AZURE_AD_REDIRECT_URI=${NEXT_PUBLIC_AZURE_AD_REDIRECT_URI}
ENV NEXT_PUBLIC_CRON_SECRET=${NEXT_PUBLIC_CRON_SECRET}

RUN ./node_modules/.bin/prisma generate
RUN npm run build

# =============================================
# Stage 3: Runner (Production)
# standalone output bundles all needed node_modules — only Prisma CLI is extra
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public

# Next.js standalone output (includes server.js + bundled dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma CLI for migrations + generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# i18n files (next-intl)
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/i18n ./i18n

RUN chown -R nextjs:nodejs /app/node_modules

RUN mkdir -p /app/backups && chown nextjs:nodejs /app/backups

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

CMD ["/app/docker-entrypoint.sh"]
