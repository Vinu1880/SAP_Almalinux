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

# Synchroniser le schéma Prisma (db push = additive, no data loss)
echo "[2/4] Synchronisation du schéma Prisma..."
PRISMA="node node_modules/prisma/build/index.js"

# Le schéma doit être en place avant que l'app ne serve quoi que ce soit.
# Laisser passer un échec la fait tourner avec des colonnes manquantes : les
# pages concernées se vident et le diagnostic se fait à l'aveugle, en prod.
# Un db push en échec ne modifie rien, donc s'arrêter ici laisse la base intacte.
if ! $PRISMA db push 2>&1; then
    echo "==================================="
    echo "ERREUR FATALE: la synchronisation du schéma a échoué."
    echo "L'application ne démarre pas : tourner avec un schéma incomplet"
    echo "viderait les pages concernées sans erreur visible."
    echo ""
    echo "Causes fréquentes :"
    echo "  - changement destructif -> relancer db push --accept-data-loss,"
    echo "    APRES avoir pris un backup"
    echo "  - base inaccessible ou droits insuffisants"
    echo "==================================="
    exit 1
fi

# Fix permissions on mounted backup volume (host may own as root)
echo "[3/4] Correction des permissions du dossier backups..."
chown -R nextjs:nodejs /app/backups 2>/dev/null || true

echo "[4/4] Démarrage de l'application Next.js..."
echo "==================================="
echo "Application disponible sur http://0.0.0.0:3000"
echo "==================================="

# Drop to nextjs user and run the app
exec su -s /bin/sh nextjs -c "node server.js"
