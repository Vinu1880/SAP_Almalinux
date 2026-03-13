#!/bin/sh
# =============================================
# Script d'entrée Docker pour ShiftPilot
# =============================================

set -e

echo "==================================="
echo "ShiftPilot - Démarrage du conteneur"
echo "==================================="

# Attendre que la base de données soit prête
echo "[1/4] Vérification de la connexion à la base de données..."

max_retries=30
retry_count=0

# Extract host and port from DATABASE_URL for pg_isready-style check
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_HOST="${DB_HOST:-sap-postgres}"
DB_PORT="${DB_PORT:-5432}"

while [ $retry_count -lt $max_retries ]; do
    if node -e "
        const net = require('net');
        const s = new net.Socket();
        s.setTimeout(2000);
        s.connect($DB_PORT, '$DB_HOST', () => { s.destroy(); process.exit(0); });
        s.on('error', () => process.exit(1));
        s.on('timeout', () => { s.destroy(); process.exit(1); });
    " 2>/dev/null; then
        echo "Base de données connectée!"
        break
    fi

    retry_count=$((retry_count + 1))
    echo "Tentative $retry_count/$max_retries - En attente de la base de données..."
    sleep 2
done

if [ $retry_count -eq $max_retries ]; then
    echo "ERREUR: Impossible de se connecter à la base de données après $max_retries tentatives"
    exit 1
fi

# Synchroniser le schéma Prisma (migrate deploy = safe, no data loss)
echo "[2/4] Synchronisation du schéma Prisma..."
PRISMA="node node_modules/prisma/build/index.js"
$PRISMA migrate deploy 2>&1 || {
    echo "WARN: migrate deploy a échoué, fallback sur db push (sans --accept-data-loss)..."
    $PRISMA db push 2>&1 || echo "ERREUR: prisma db push a échoué!"
}

# Fix permissions on mounted backup volume (host may own as root)
echo "[3/4] Correction des permissions du dossier backups..."
chown -R nextjs:nodejs /app/backups 2>/dev/null || true

echo "[4/4] Démarrage de l'application Next.js..."
echo "==================================="
echo "Application disponible sur http://0.0.0.0:3000"
echo "==================================="

# Drop to nextjs user and run the app
exec su -s /bin/sh nextjs -c "node server.js"
