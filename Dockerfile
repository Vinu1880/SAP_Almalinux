# =============================================
# Dockerfile Multi-Stage pour Next.js + Prisma
# Compatible Windows, Linux (AlmaLinux), macOS
# =============================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copier les fichiers de dépendances
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Installer les dépendances
RUN npm install --legacy-peer-deps

# Générer le client Prisma
RUN ./node_modules/.bin/prisma generate

# =============================================
# Stage 2: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copier les dépendances du stage précédent
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables d'environnement pour le build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production


ARG NEXT_PUBLIC_AZURE_AD_CLIENT_ID
ARG NEXT_PUBLIC_AZURE_AD_TENANT_ID
ARG NEXT_PUBLIC_AZURE_AD_REDIRECT_URI

ENV NEXT_PUBLIC_AZURE_AD_CLIENT_ID=${NEXT_PUBLIC_AZURE_AD_CLIENT_ID}
ENV NEXT_PUBLIC_AZURE_AD_TENANT_ID=${NEXT_PUBLIC_AZURE_AD_TENANT_ID}
ENV NEXT_PUBLIC_AZURE_AD_REDIRECT_URI=${NEXT_PUBLIC_AZURE_AD_REDIRECT_URI}

# Générer Prisma client (au cas où)
RUN ./node_modules/.bin/prisma generate

# Build de l'application Next.js
RUN npm run build

# =============================================
# Stage 3: Runner (Production)
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Créer un utilisateur non-root pour la sécurité
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Variables d'environnement
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copier les fichiers publics
COPY --from=builder /app/public ./public

# Copier le dossier standalone (Next.js output: 'standalone')
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copier Prisma pour les migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules ./node_modules

# Copier les fichiers i18n (next-intl)
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/i18n ./i18n
RUN chown -R nextjs:nodejs /app/node_modules

# Créer le dossier backups avec les bonnes permissions
RUN mkdir -p /app/backups && chown nextjs:nodejs /app/backups

# Changer vers l'utilisateur non-root
USER nextjs

# Exposer le port
EXPOSE 3000

# Commande par défaut - démarrage direct de Next.js
CMD ["node", "server.js"]
