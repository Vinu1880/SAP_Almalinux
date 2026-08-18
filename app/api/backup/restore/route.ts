import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { safePath } from '@/lib/pathSecurity';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { logSecurityEvent } from '@/lib/securityLogger';
import fs from 'fs';
import path from 'path';

// Restore database from a backup file
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

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const backup = JSON.parse(fileContent);
      data = backup.data || backup;
      backupSource = body.fileName;
    } else if (body.data) {
      data = body.data;
    } else {
      data = body;
    }

    // Preview counts when not yet confirmed
    if (!body.confirmed) {
      const counts = {
        teams: data.teams?.length || 0,
        users: data.users?.length || 0,
        shifts: data.shifts?.length || 0,
        piketts: data.piketts?.length || 0,
        rotationPatterns: data.rotationPatterns?.length || 0,
        shiftAssignments: data.shiftAssignments?.length || 0,
        pikettAssignments: data.pikettAssignments?.length || 0,
        outOfOfficeEvents: data.outOfOfficeEvents?.length || 0,
        auditLogs: data.auditLogs?.length || 0,
        userRules: data.userRules?.length || 0,
        holidays: data.holidays?.length || 0,
      };

      return NextResponse.json({
        requiresConfirmation: true,
        source: backupSource,
        counts,
        warning: 'This will DELETE ALL existing data and replace it with the backup. This action cannot be undone.',
      });
    }

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

    // Clear the database
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany();
      await tx.userRule.deleteMany();
      await tx.shiftAssignment.deleteMany();
      await tx.pikettAssignment.deleteMany();
      await tx.pikett.deleteMany();
      await tx.shift.deleteMany();
      await tx.outOfOfficeEvent.deleteMany();
      await tx.holiday.deleteMany();
      await tx.user.deleteMany();
      await tx.team.deleteMany();
      await tx.rotationPattern.deleteMany();
    }, {
      maxWait: 10000,
      timeout: 10000,
    });

    // Restore Teams
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

    // Restore RotationPatterns
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

    // Restore Users
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

    // Restore Shifts
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
              minConsecutiveDays: shift.minConsecutiveDays ?? 1,
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

    // Restore Piketts
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
              endWeek: pikett.endWeek,
              color: pikett.color,
              status: pikett.status,
              is24_7: pikett.is24_7,
              senderMailbox: pikett.senderMailbox || '',
              startHour: pikett.startHour || '08:00',
              minRestWeeks: pikett.minRestWeeks ?? 3,
              avoidSupportSameWeek: pikett.avoidSupportSameWeek ?? true,
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

    // Restore ShiftAssignments
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
              outlookEventId: assignment.outlookEventId ?? null,
              resent: assignment.resent ?? false,
              resentAt: assignment.resentAt ? new Date(assignment.resentAt) : null,
              resentFromId: assignment.resentFromId ?? null,
              sentById: assignment.sentById ?? null,
              segmentStart: assignment.segmentStart ?? null,
              segmentEnd: assignment.segmentEnd ?? null,
              segmentGroupId: assignment.segmentGroupId ?? null,
              segmentIndex: assignment.segmentIndex ?? null,
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

    if (data.pikettAssignments?.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < data.pikettAssignments.length; i += batchSize) {
        const batch = data.pikettAssignments.slice(i, i + batchSize);
        await prisma.$transaction(async (tx) => {
          await tx.pikettAssignment.createMany({
            data: batch.map((assignment: any) => ({
              id: assignment.id,
              date: new Date(assignment.date),
              status: assignment.status,
              reason: assignment.reason,
              respondedAt: assignment.respondedAt ? new Date(assignment.respondedAt) : null,
              pikettId: assignment.pikettId,
              userId: assignment.userId,
              createdAt: new Date(assignment.createdAt),
              updatedAt: new Date(assignment.updatedAt),
              outlookEventId: assignment.outlookEventId || null,
              resent: assignment.resent ?? false,
              resentAt: assignment.resentAt ? new Date(assignment.resentAt) : null,
              resentFromId: assignment.resentFromId || null,
              sentById: assignment.sentById ?? null,
            })),
            skipDuplicates: true,
          });
        }, {
          maxWait: 10000,
          timeout: 10000,
        });
      }
    }

    // Restore OutOfOfficeEvents
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

    // Restore AuditLogs
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

    // Restore UserRules
    if (data.userRules?.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.userRule.createMany({
          data: data.userRules.map((rule: any) => ({
            id: rule.id,
            userId: rule.userId,
            type: rule.type,
            config: rule.config,
            enabled: rule.enabled,
            createdAt: new Date(rule.createdAt),
            updatedAt: new Date(rule.updatedAt)
          }))
        });
      }, {
        maxWait: 10000,
        timeout: 10000,
      });
    }

    // Restore Holidays
    if (data.holidays?.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.holiday.createMany({
          data: data.holidays.map((holiday: any) => ({
            id: holiday.id,
            name: holiday.name,
            date: new Date(holiday.date),
            cantons: holiday.cantons,
            type: holiday.type,
            recurring: holiday.recurring,
            description: holiday.description,
            createdAt: new Date(holiday.createdAt),
            updatedAt: new Date(holiday.updatedAt)
          }))
        });
      }, {
        maxWait: 10000,
        timeout: 10000,
      });
    }

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
    return NextResponse.json(
      { error: 'Failed to restore backup' },
      { status: 500 }
    );
  }
}
