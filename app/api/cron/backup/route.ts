// app/api/cron/backup/route.ts
// Automated scheduled backup with rotation (delete old backups beyond maxBackups)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logSecurityEvent } from '@/lib/securityLogger';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// GET - Check scheduled backup status
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret') || new URL(request.url).searchParams.get('secret');
  const expected = process.env.CRON_SECRET;

  if (!expected || expected === 'dev-secret-change-in-production') {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  if (!secret || !crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
    logSecurityEvent({ type: 'CRON_AUTH_FAILURE', userEmail: 'cron', details: 'backup endpoint' });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const backupsDir = path.join(process.cwd(), 'backups');
  const files = fs.existsSync(backupsDir)
    ? fs.readdirSync(backupsDir)
        .filter(f => f.startsWith('backup_ShiftAutoPlanner_') && f.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a))
    : [];

  return NextResponse.json({
    backupCount: files.length,
    latestBackup: files[0] || null,
    backups: files.slice(0, 5),
  });
}

// POST - Create a scheduled backup with rotation
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret') || new URL(request.url).searchParams.get('secret');
  const expected = process.env.CRON_SECRET;

  if (!expected || expected === 'dev-secret-change-in-production') {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  if (!secret || !crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
    logSecurityEvent({ type: 'CRON_AUTH_FAILURE', userEmail: 'cron', details: 'backup endpoint' });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const maxBackups = body?.maxBackups || 10;

    // Fetch all data
    const data = {
      teams: await prisma.team.findMany(),
      users: await prisma.user.findMany(),
      shifts: await prisma.shift.findMany(),
      piketts: await prisma.pikett.findMany(),
      rotationPatterns: await prisma.rotationPattern.findMany(),
      shiftAssignments: await prisma.shiftAssignment.findMany(),
      outOfOfficeEvents: await prisma.outOfOfficeEvent.findMany(),
      auditLogs: await prisma.auditLog.findMany(),
      userRules: await prisma.userRule.findMany(),
      holidays: await prisma.holiday.findMany(),
    };

    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir);
    }

    const backup = {
      version: '1.0.0',
      backupDate: new Date().toISOString(),
      source: 'scheduled',
      counts: {
        teams: data.teams.length,
        users: data.users.length,
        shifts: data.shifts.length,
        piketts: data.piketts.length,
        rotationPatterns: data.rotationPatterns.length,
        shiftAssignments: data.shiftAssignments.length,
        outOfOfficeEvents: data.outOfOfficeEvents.length,
        auditLogs: data.auditLogs.length,
        userRules: data.userRules.length,
        holidays: data.holidays.length,
      },
      data,
    };

    const jsonString = JSON.stringify(backup, null, 2);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().substring(0, 8).replace(/:/g, '');
    const fileName = `backup_ShiftAutoPlanner_${dateStr}_${timeStr}.json`;
    const filePath = path.join(backupsDir, fileName);

    fs.writeFileSync(filePath, jsonString, 'utf-8');

    // Update latest
    const latestPath = path.join(backupsDir, 'backup_latest.json');
    fs.writeFileSync(latestPath, jsonString, 'utf-8');

    // Rotate: delete old backups beyond maxBackups
    const allBackups = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('backup_ShiftAutoPlanner_') && f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));

    const deleted: string[] = [];
    if (allBackups.length > maxBackups) {
      for (const old of allBackups.slice(maxBackups)) {
        fs.unlinkSync(path.join(backupsDir, old));
        deleted.push(old);
      }
    }

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'BACKUP',
        entityId: fileName,
        userId: 'cron',
        data: { fileName, source: 'scheduled', counts: backup.counts, deleted },
      },
    });

    logSecurityEvent({
      type: 'BACKUP_CREATED',
      userEmail: 'cron',
      details: `scheduled backup=${fileName}, kept=${maxBackups}, deleted=${deleted.length}`,
    });

    return NextResponse.json({
      success: true,
      fileName,
      counts: backup.counts,
      deleted,
      remaining: allBackups.length - deleted.length,
    });
  } catch (error) {
    console.error('[CRON /api/cron/backup] Error:', error);
    return NextResponse.json({ error: 'Failed to create scheduled backup' }, { status: 500 });
  }
}
