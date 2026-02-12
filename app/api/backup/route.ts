// app/api/backup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      return NextResponse.json([]);
    }

    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json') && f !== 'backup_latest.json')
      .sort((a, b) => b.localeCompare(a));

    const backups = files.map(fileName => {
      const filePath = path.join(backupsDir, fileName);
      const stats = fs.statSync(filePath);
      let counts = '';
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (content.counts) {
          const c = content.counts;
          counts = `${c.users || 0} users, ${c.shifts || 0} shifts, ${c.teams || 0} teams`;
        }
      } catch {}

      const sizeKB = (stats.size / 1024).toFixed(1);
      return {
        fileName,
        date: stats.mtime.toISOString().split('T')[0] + ' ' + stats.mtime.toTimeString().substring(0, 8),
        size: `${sizeKB} KB`,
        counts
      };
    });

    return NextResponse.json(backups);
  } catch (error) {
    console.error('Error listing backups:', error);
    return NextResponse.json(
      { error: 'Error listing backups' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const data = {
      teams: await prisma.team.findMany(),
      users: await prisma.user.findMany(),
      shifts: await prisma.shift.findMany(),
      piketts: await prisma.pikett.findMany(),
      rotationPatterns: await prisma.rotationPattern.findMany(),
      shiftAssignments: await prisma.shiftAssignment.findMany(),
      outOfOfficeEvents: await prisma.outOfOfficeEvent.findMany(),
      auditLogs: await prisma.auditLog.findMany(),
    };

    // Check user rotation configs
    const usersWithRotation = data.users.filter(u => u.rotationConfig !== null);

    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir);
    }

    const fileName = `backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
    const filePath = path.join(backupsDir, fileName);

    const backup = {
      version: '1.0.0',
      backupDate: new Date().toISOString(),
      counts: {
        teams: data.teams.length,
        users: data.users.length,
        shifts: data.shifts.length,
        piketts: data.piketts.length,
        rotationPatterns: data.rotationPatterns.length,
        shiftAssignments: data.shiftAssignments.length,
        outOfOfficeEvents: data.outOfOfficeEvents.length,
        auditLogs: data.auditLogs.length,
        usersWithRotation: usersWithRotation.length
      },
      data
    };

    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));

    const latestPath = path.join(backupsDir, 'backup_latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(backup, null, 2));

    return NextResponse.json({
      success: true,
      fileName,
      counts: backup.counts,
      details: {
        usersWithRotation: usersWithRotation.length,
        activeShifts: data.shifts.filter(s => s.status === 'ACTIVE').length,
        activePiketts: data.piketts.filter(p => p.status === 'ACTIVE').length,
        totalAssignments: data.shiftAssignments.length
      }
    });

  } catch (error) {
    console.error('Error creating backup:', error);
    return NextResponse.json(
      { error: 'Error creating backup' },
      { status: 500 }
    );
  }
}
