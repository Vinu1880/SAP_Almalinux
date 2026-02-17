#!/bin/sh
# =============================================
# Script d'entrée Docker pour Autoplanner
# =============================================

set -e

echo "==================================="
echo "Autoplanner - Démarrage du conteneur"
echo "==================================="

# Attendre que la base de données soit prête
echo "[1/3] Vérification de la connexion à la base de données..."

max_retries=30
retry_count=0

while [ $retry_count -lt $max_retries ]; do
    if node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.\$connect()
            .then(() => { console.log('DB connectée'); process.exit(0); })
            .catch(() => process.exit(1));
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

# Exécuter les migrations Prisma
echo "[2/3] Application des migrations Prisma..."
npx prisma migrate deploy 2>/dev/null || {
    echo "Note: Pas de nouvelles migrations à appliquer ou première exécution"
    echo "Synchronisation du schéma..."
    npx prisma db push --accept-data-loss 2>/dev/null || true
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
