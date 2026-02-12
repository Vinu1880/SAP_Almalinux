// app/api/backup/restore/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { safePath } from '@/lib/pathSecurity';
import { decryptBackup, verifySHA256 } from '@/lib/backup-crypto';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { logSecurityEvent } from '@/lib/securityLogger';
import fs from 'fs';
import path from 'path';

// POST - Restore database from a backup file
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.restore);
  if (rl) return rl;

  try {
    const body = await request.json();
    let data;
    let backupSource = 'direct-upload';

    if (body.fileName) {
      const backupsDir = path.join(process.cwd(), 'backups');

      const filePath = safePath(backupsDir, body.fileName);
      if (!filePath) {
        return NextResponse.json(
          { error: 'Invalid file name' },
          { status: 400 }
        );
      }

      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { error: 'Backup file not found' },
          { status: 404 }
        );
      }

      const fileContent = fs.readFileSync(filePath);

      // SHA-256 integrity check
      const checksumPath = filePath + '.sha256';
      if (fs.existsSync(checksumPath)) {
        const expectedHash = fs.readFileSync(checksumPath, 'utf-8').trim();
        if (!verifySHA256(fileContent, expectedHash)) {
          logSecurityEvent({
            type: 'BACKUP_INTEGRITY_FAILURE',
            userEmail: auth.user.mail,
            details: `fileName=${body.fileName}`,
          });
          return NextResponse.json(
            { error: 'Backup integrity check failed. File may be corrupted or tampered with.' },
            { status: 400 }
          );
        }
      }

      // Decrypt if encrypted
      let jsonString: string;
      if (body.fileName.endsWith('.enc')) {
        jsonString = decryptBackup(fileContent);
      } else {
        jsonString = fileContent.toString('utf-8');
      }

      const backup = JSON.parse(jsonString);
      data = backup.data || backup;
      backupSource = body.fileName;
    } else if (body.data) {
      data = body.data;
    } else {
      data = body;
    }

    // Phase 1: Return confirmation preview if not confirmed
    if (!body.confirmed) {
      const counts = {
        teams: data.teams?.length || 0,
        users: data.users?.length || 0,
        shifts: data.shifts?.length || 0,
        piketts: data.piketts?.length || 0,
        rotationPatterns: data.rotationPatterns?.length || 0,
        shiftAssignments: data.shiftAssignments?.length || 0,
        outOfOfficeEvents: data.outOfOfficeEvents?.length || 0,
        auditLogs: data.auditLogs?.length || 0,
      };

      return NextResponse.json({
        requiresConfirmation: true,
        source: backupSource,
        counts,
        warning: 'This will DELETE ALL existing data and replace it with the backup. This action cannot be undone.',
      });
    }

    // Phase 2: Execute restore
    await prisma.auditLog.create({
      data: {
        action: 'RESTORE_START',
        entity: 'BACKUP',
        entityId: backupSource,
        userId: auth.user.id,
        data: { source: backupSource }
      }
    });

    if (!prisma) {
      throw new Error('Prisma client not initialized');
    }

    // STEP 1: Clean the database
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

    // STEP 2: Restore Teams
    if (data.teams?.length > 0) {
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

    // STEP 3: Restore RotationPatterns
    if (data.rotationPatterns?.length > 0) {
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

    // STEP 4: Restore Users in batches of 50
    if (data.users?.length > 0) {
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
            location: user.location || null,
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
      }
    }

    // STEP 5: Restore Shifts in batches of 100
    if (data.shifts?.length > 0) {
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
              senderMailbox: shift.senderMailbox || '',
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
      }
    }

    // STEP 6: Restore Piketts in batches of 100
    if (data.piketts?.length > 0) {
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
      }
    }

    // STEP 7: Restore ShiftAssignments in batches of 200
    if (data.shiftAssignments?.length > 0) {
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
      }
    }

    // STEP 8: Restore OutOfOfficeEvents in batches of 200
    if (data.outOfOfficeEvents?.length > 0) {
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
      }
    }

    // STEP 9: Restore AuditLogs in batches of 500
    if (data.auditLogs?.length > 0) {
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
      }
    }

    // Log successful restore
    await prisma.auditLog.create({
      data: {
        action: 'RESTORE_COMPLETE',
        entity: 'BACKUP',
        entityId: backupSource,
        userId: auth.user.id,
        data: { source: backupSource, success: true }
      }
    });

    logSecurityEvent({
      type: 'BACKUP_RESTORED',
      userEmail: auth.user.mail,
      details: `source=${backupSource}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Database restored successfully'
    });

  } catch (error) {
    console.error('Error restoring backup:', error);
    return NextResponse.json(
      { error: 'Error during restore: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
