// scripts/update-resent.ts
// Script pour marquer un shift comme "resent" pour testing

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Trouver les shifts du 04/11/2025 avec status REFUSED ou PENDING
    const targetDate = new Date('2025-11-04');

    console.log('Recherche des shifts pour le', targetDate.toLocaleDateString());

    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        date: targetDate,
        OR: [
          { status: 'REFUSED' },
          { status: 'PENDING' }
        ]
      },
      include: {
        shift: true,
        user: true
      }
    });

    console.log(`\nTrouvé ${assignments.length} shift(s):\n`);

    assignments.forEach((a, index) => {
      console.log(`${index + 1}. ${a.shift.name} - ${a.user.firstName} ${a.user.lastName} - Status: ${a.status}`);
      console.log(`   ID: ${a.id}`);
    });

    if (assignments.length === 0) {
      console.log('\nAucun shift trouvé pour cette date.');
      return;
    }

    // Mettre à jour le premier (ou tous) avec resent = true
    console.log('\n🔄 Mise à jour des shifts avec resent = true...\n');

    for (const assignment of assignments) {
      await prisma.shiftAssignment.update({
        where: { id: assignment.id },
        data: {
          resent: true,
          resentAt: new Date()
        }
      });

      console.log(`✅ ${assignment.shift.name} - ${assignment.user.firstName} ${assignment.user.lastName} marqué comme renvoyé`);
    }

    console.log('\n✨ Mise à jour terminée avec succès!');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
