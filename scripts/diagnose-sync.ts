#!/usr/bin/env tsx

// scripts/diagnose-sync.ts
// Script pour diagnostiquer les problèmes de synchronisation

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Charger les variables d'environnement
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function diagnose() {
  console.log('🔍 Diagnostic de la Synchronisation Outlook\n');
  console.log('=' .repeat(60));

  try {
    // 1. Vérifier les variables d'environnement
    console.log('\n📋 1. Variables d\'environnement');
    console.log('-'.repeat(60));

    const requiredEnvVars = [
      'AZURE_AD_CLIENT_ID',
      'AZURE_AD_CLIENT_SECRET',
      'AZURE_AD_TENANT_ID',
      'CRON_SECRET',
      'NEXT_PUBLIC_CRON_SECRET'
    ];

    const optionalEnvVars = [
      'MICROSOFT_GRAPH_REFRESH_TOKEN',
      'NEXT_PUBLIC_URL'
    ];

    let missingVars = false;

    for (const envVar of requiredEnvVars) {
      const value = process.env[envVar];
      if (!value) {
        console.log(`   ❌ ${envVar}: NON DÉFINI`);
        missingVars = true;
      } else {
        console.log(`   ✅ ${envVar}: ${value.substring(0, 10)}...`);
      }
    }

    for (const envVar of optionalEnvVars) {
      const value = process.env[envVar];
      if (value) {
        console.log(`   ✅ ${envVar}: ${value.substring(0, 20)}...`);
      } else {
        console.log(`   ⚠️  ${envVar}: Non défini (optionnel)`);
      }
    }

    if (missingVars) {
      console.log('\n⚠️  ATTENTION: Des variables d\'environnement requises sont manquantes!');
    }

    // 2. Vérifier les assignments en base
    console.log('\n📊 2. Assignments en base de données');
    console.log('-'.repeat(60));

    const totalAssignments = await prisma.shiftAssignment.count();
    console.log(`   Total d'assignments: ${totalAssignments}`);

    const pendingAssignments = await prisma.shiftAssignment.count({
      where: { status: 'PENDING' }
    });
    console.log(`   Assignments PENDING: ${pendingAssignments}`);

    const withOutlookId = await prisma.shiftAssignment.count({
      where: {
        status: 'PENDING',
        outlookEventId: { not: null }
      }
    });
    console.log(`   PENDING avec outlookEventId: ${withOutlookId}`);

    const withoutOutlookId = await prisma.shiftAssignment.count({
      where: {
        status: 'PENDING',
        outlookEventId: null
      }
    });
    console.log(`   PENDING sans outlookEventId: ${withoutOutlookId}`);

    if (withoutOutlookId > 0) {
      console.log('\n   ⚠️  PROBLÈME: Certains assignments n\'ont pas d\'outlookEventId');
      console.log('   → Ces assignments ne peuvent pas être synchronisés');
      console.log('   → Vérifiez que les invitations Outlook ont bien été envoyées');
    }

    // 3. Afficher les détails des assignments PENDING avec outlookEventId
    console.log('\n📝 3. Détails des assignments à synchroniser');
    console.log('-'.repeat(60));

    const assignmentsToSync = await prisma.shiftAssignment.findMany({
      where: {
        status: 'PENDING',
        outlookEventId: { not: null }
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        shift: {
          select: {
            name: true
          }
        }
      },
      take: 10
    });

    if (assignmentsToSync.length === 0) {
      console.log('   ℹ️  Aucun assignment à synchroniser');
    } else {
      console.log(`   Trouvé ${assignmentsToSync.length} assignment(s) à synchroniser:\n`);

      for (const assignment of assignmentsToSync) {
        console.log(`   • ${assignment.user.firstName} ${assignment.user.lastName}`);
        console.log(`     Email: ${assignment.user.email}`);
        console.log(`     Shift: ${assignment.shift.name}`);
        console.log(`     Date: ${assignment.date.toLocaleDateString('fr-FR')}`);
        console.log(`     Outlook ID: ${assignment.outlookEventId?.substring(0, 30)}...`);
        console.log(`     Créé le: ${assignment.createdAt.toLocaleString('fr-FR')}`);
        console.log('');
      }
    }

    // 4. Vérifier l'historique des syncs
    console.log('\n📜 4. Historique des synchronisations');
    console.log('-'.repeat(60));

    const syncLogs = await prisma.auditLog.findMany({
      where: {
        entity: 'SHIFT_ASSIGNMENT',
        action: 'UPDATE',
        data: {
          path: ['source'],
          equals: 'outlook-sync'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    if (syncLogs.length === 0) {
      console.log('   ℹ️  Aucune synchronisation n\'a encore eu lieu');
    } else {
      console.log(`   Dernières ${syncLogs.length} synchronisations:\n`);

      for (const log of syncLogs) {
        const data = log.data as any;
        console.log(`   • ${log.createdAt.toLocaleString('fr-FR')}`);
        console.log(`     Status: ${data.oldStatus} → ${data.newStatus}`);
        console.log(`     Outlook response: ${data.outlookResponse}`);
        console.log('');
      }
    }

    // 5. Test de l'API
    console.log('\n🔧 5. Test de l\'API de synchronisation');
    console.log('-'.repeat(60));

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';

    console.log(`   URL API: ${baseUrl}/api/cron/sync-outlook-responses`);
    console.log(`   Secret configuré: ${cronSecret.substring(0, 10)}...`);

    // 6. Recommandations
    console.log('\n💡 6. Recommandations');
    console.log('-'.repeat(60));

    if (withOutlookId === 0) {
      console.log('   ⚠️  Aucun assignment n\'a d\'outlookEventId');
      console.log('   → Assurez-vous d\'avoir envoyé les invitations Outlook depuis le planner');
      console.log('   → Les invitations doivent être créées via Microsoft Graph');
    } else if (missingVars) {
      console.log('   ⚠️  Variables d\'environnement manquantes');
      console.log('   → Consultez le fichier .env.example');
      console.log('   → Configurez toutes les variables requises');
    } else {
      console.log('   ✅ Configuration semble correcte');
      console.log('   → Essayez de lancer: npm run sync-outlook');
      console.log('   → Vérifiez les logs du serveur pour plus de détails');
    }

    // 7. Commandes utiles
    console.log('\n🛠️  7. Commandes utiles');
    console.log('-'.repeat(60));
    console.log('   # Lancer la synchronisation manuellement:');
    console.log('   npm run sync-outlook\n');
    console.log('   # Vérifier le statut:');
    console.log('   npm run sync-outlook:status\n');
    console.log('   # Voir les logs du serveur:');
    console.log('   (Dans le terminal où tourne npm run dev)\n');

    console.log('=' .repeat(60));
    console.log('✅ Diagnostic terminé\n');

  } catch (error) {
    console.error('\n❌ Erreur durant le diagnostic:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);

async function main() {
  await diagnose();
}
