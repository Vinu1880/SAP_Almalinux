// app/api/backup/restore/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    let data;

    // Si on a un fileName, on lit depuis le fichier
    if (body.fileName) {
      const backupsDir = path.join(process.cwd(), 'backups');
      const filePath = path.join(backupsDir, body.fileName);

      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { error: 'Fichier de sauvegarde non trouvé' },
          { status: 404 }
        );
      }

      const backup = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      data = backup.data || backup;
    }
    // Sinon, on utilise les données directement depuis le body
    else if (body.data) {
      data = body.data;
    }
    // Fallback : le body est directement les données
    else {
      data = body;
    }
    
    // Vérifier que prisma est disponible
    if (!prisma) {
      throw new Error('Prisma client not initialized');
    }
    
    console.log('🔄 Début de la restauration...');
    
    // ÉTAPE 1 : Nettoyer la base (transaction rapide)
    console.log('🗑️  Nettoyage de la base...');
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany();
      await tx.shiftAssignment.deleteMany();
      await tx.pikett.deleteMany();
      await tx.shift.deleteMany();
      await tx.outOfOfficeEvent.deleteMany();
      await tx.user.deleteMany();
      await tx.team.deleteMany();
      await tx.rotationPattern.deleteMany();
    }, {
      maxWait: 10000,
      timeout: 10000,
    });
    
    // ÉTAPE 2 : Restaurer Teams (transaction rapide)
    if (data.teams?.length > 0) {
      console.log(`📦 Restauration de ${data.teams.length} équipes...`);
      await prisma.$transaction(async (tx) => {
        for (const team of data.teams) {
          const { lead, members, shifts, piketts, ...teamData } = team;
          await tx.team.create({ data: teamData });
        }
      }, {
        maxWait: 10000,
        timeout: 10000,
      });
    }
    
    // ÉTAPE 3 : Restaurer RotationPatterns
    if (data.rotationPatterns?.length > 0) {
      console.log(`📦 Restauration de ${data.rotationPatterns.length} patterns...`);
      await prisma.$transaction(async (tx) => {
        await tx.rotationPattern.createMany({
          data: data.rotationPatterns.map((pattern: any) => ({
            id: pattern.id,
            name: pattern.name,
            description: pattern.description,
            cycleLength: pattern.cycleLength,
            weeks: pattern.weeks,
            createdAt: new Date(pattern.createdAt),
            updatedAt: new Date(pattern.updatedAt)
          }))
        });
      }, {
        maxWait: 10000,
        timeout: 10000,
      });
    }
    
    // ÉTAPE 4 : Restaurer Users par lots de 50
    if (data.users?.length > 0) {
      console.log(`👥 Restauration de ${data.users.length} utilisateurs...`);
      const batchSize = 50;
      for (let i = 0; i < data.users.length; i += batchSize) {
        const batch = data.users.slice(i, i + batchSize);
        await prisma.$transaction(async (tx) => {
          await tx.user.createMany({
          data: batch.map((user: any) => ({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            location: user.location || null,  // Ajout du champ location
            role: user.role,
            workPercent: user.workPercent,
            status: user.status,
            notes: user.notes,
            rotationConfig: user.rotationConfig || null,
            availability: user.availability || null,
            teamId: user.teamId,
            createdAt: new Date(user.createdAt),
            updatedAt: new Date(user.updatedAt)
          }))
        });
        }, {
          maxWait: 10000,
          timeout: 10000,
        });
        console.log(`  ✓ ${Math.min(i + batchSize, data.users.length)}/${data.users.length}`);
      }
    }
    
    // ÉTAPE 5 : Restaurer Shifts par lots de 100
    if (data.shifts?.length > 0) {
      console.log(`⏰ Restauration de ${data.shifts.length} shifts...`);
      const batchSize = 100;
      for (let i = 0; i < data.shifts.length; i += batchSize) {
        const batch = data.shifts.slice(i, i + batchSize);
        await prisma.$transaction(async (tx) => {
          await tx.shift.createMany({
            data: batch.map((shift: any) => ({
              id: shift.id,
              name: shift.name,
              description: shift.description,
              startTime: shift.startTime,
              endTime: shift.endTime,
              daysOfWeek: shift.daysOfWeek,
              membersRequired: shift.membersRequired,
              priority: shift.priority,
              status: shift.status,
              color: shift.color,
              includedUserIds: shift.includedUserIds,
              excludedUserIds: shift.excludedUserIds,
              teamId: shift.teamId,
              usageCount: shift.usageCount,
              lastUsedAt: shift.lastUsedAt ? new Date(shift.lastUsedAt) : null,
              createdAt: new Date(shift.createdAt),
              updatedAt: new Date(shift.updatedAt)
            }))
          });
        }, {
          maxWait: 10000,
          timeout: 10000,
        });
        console.log(`  ✓ ${Math.min(i + batchSize, data.shifts.length)}/${data.shifts.length}`);
      }
    }
    
    // ÉTAPE 6 : Restaurer Piketts par lots de 100
    if (data.piketts?.length > 0) {
      console.log(`🔔 Restauration de ${data.piketts.length} piketts...`);
      const batchSize = 100;
      for (let i = 0; i < data.piketts.length; i += batchSize) {
        const batch = data.piketts.slice(i, i + batchSize);
        await prisma.$transaction(async (tx) => {
          await tx.pikett.createMany({
            data: batch.map((pikett: any) => ({
              id: pikett.id,
              name: pikett.name,
              description: pikett.description,
              startWeek: pikett.startWeek,
              daysOfWeek: pikett.daysOfWeek,
              endWeek: pikett.endWeek,
              color: pikett.color,
              status: pikett.status,
              is24_7: pikett.is24_7,
              teamId: pikett.teamId,
              userId: pikett.userId,
              includedUserIds: pikett.includedUserIds,
              excludedUserIds: pikett.excludedUserIds,
              createdAt: new Date(pikett.createdAt),
              updatedAt: new Date(pikett.updatedAt)
            }))
          });
        }, {
          maxWait: 10000,
          timeout: 10000,
        });
        console.log(`  ✓ ${Math.min(i + batchSize, data.piketts.length)}/${data.piketts.length}`);
      }
    }
    
    // ÉTAPE 7 : Restaurer ShiftAssignments par lots de 200
    if (data.shiftAssignments?.length > 0) {
      console.log(`📋 Restauration de ${data.shiftAssignments.length} assignations...`);
      const batchSize = 200;
      for (let i = 0; i < data.shiftAssignments.length; i += batchSize) {
        const batch = data.shiftAssignments.slice(i, i + batchSize);
        await prisma.$transaction(async (tx) => {
          await tx.shiftAssignment.createMany({
            data: batch.map((assignment: any) => ({
              id: assignment.id,
              date: new Date(assignment.date),
              status: assignment.status,
              reason: assignment.reason,
              respondedAt: assignment.respondedAt ? new Date(assignment.respondedAt) : null,
              shiftId: assignment.shiftId,
              userId: assignment.userId,
              createdAt: new Date(assignment.createdAt),
              updatedAt: new Date(assignment.updatedAt)
            }))
          });
        }, {
          maxWait: 10000,
          timeout: 10000,
        });
        console.log(`  ✓ ${Math.min(i + batchSize, data.shiftAssignments.length)}/${data.shiftAssignments.length}`);
      }
    }
    
    // ÉTAPE 8 : Restaurer OutOfOfficeEvents par lots de 200
    if (data.outOfOfficeEvents?.length > 0) {
      console.log(`📅 Restauration de ${data.outOfOfficeEvents.length} événements OOO...`);
      const batchSize = 200;
      for (let i = 0; i < data.outOfOfficeEvents.length; i += batchSize) {
        const batch = data.outOfOfficeEvents.slice(i, i + batchSize);
        await prisma.$transaction(async (tx) => {
          await tx.outOfOfficeEvent.createMany({
            data: batch.map((event: any) => ({
              id: event.id,
              userEmail: event.userEmail,
              subject: event.subject,
              startDate: new Date(event.startDate),
              endDate: new Date(event.endDate),
              isAllDay: event.isAllDay,
              outlookId: event.outlookId,
              calendarName: event.calendarName,
              syncedAt: new Date(event.syncedAt),
              createdAt: new Date(event.createdAt),
              updatedAt: new Date(event.updatedAt)
            }))
          });
        }, {
          maxWait: 10000,
          timeout: 10000,
        });
        console.log(`  ✓ ${Math.min(i + batchSize, data.outOfOfficeEvents.length)}/${data.outOfOfficeEvents.length}`);
      }
    }
    
    // ÉTAPE 9 : Restaurer AuditLogs par lots de 500
    if (data.auditLogs?.length > 0) {
      console.log(`📝 Restauration de ${data.auditLogs.length} logs...`);
      const batchSize = 500;
      for (let i = 0; i < data.auditLogs.length; i += batchSize) {
        const batch = data.auditLogs.slice(i, i + batchSize);
        await prisma.$transaction(async (tx) => {
          await tx.auditLog.createMany({
            data: batch.map((log: any) => ({
              id: log.id,
              action: log.action,
              entity: log.entity,
              entityId: log.entityId,
              userId: log.userId,
              data: log.data,
              createdAt: new Date(log.createdAt)
            }))
          });
        }, {
          maxWait: 10000,
          timeout: 10000,
        });
        console.log(`  ✓ ${Math.min(i + batchSize, data.auditLogs.length)}/${data.auditLogs.length}`);
      }
    }
    
    console.log('✅ Restauration terminée avec succès!');
    
    return NextResponse.json({ 
      success: true,
      message: 'Base de données restaurée avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la restauration: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}