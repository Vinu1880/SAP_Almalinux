// Server-side scheduler: ticks each minute, runs DB-configured backup when due (idempotent per minute via lastRunAt)

import { prisma } from './prisma';
import fs from 'fs';
import path from 'path';

let started = false;
let intervalHandle: NodeJS.Timeout | null = null;
let cachedSchedule: any = null;
let cacheAt = 0;

const CACHE_TTL_MS = 60_000;

async function loadSchedule() {
  const now = Date.now();
  if (cachedSchedule && now - cacheAt < CACHE_TTL_MS) return cachedSchedule;
  try {
    cachedSchedule = await prisma.backupSchedule.findUnique({ where: { id: 'default' } });
  } catch {
    cachedSchedule = null;
  }
  cacheAt = now;
  return cachedSchedule;
}

export async function updateSchedulerCache() {
  cachedSchedule = null;
  cacheAt = 0;
  return loadSchedule();
}

function isDueNow(schedule: any, now: Date): boolean {
  if (!schedule || !schedule.enabled) return false;
  const [h, m] = (schedule.hour || '02:00').split(':').map(Number);
  if (now.getHours() !== h || now.getMinutes() !== (m || 0)) return false;
  // idempotence: skip if last run was in the same minute
  if (schedule.lastRunAt) {
    const last = new Date(schedule.lastRunAt);
    if (last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth() &&
        last.getDate() === now.getDate() &&
        last.getHours() === now.getHours() &&
        last.getMinutes() === now.getMinutes()) return false;
  }
  if (schedule.frequency === 'daily') return true;
  if (schedule.frequency === 'weekly') return now.getDay() === (schedule.dayOfWeek ?? 1);
  if (schedule.frequency === 'monthly') return now.getDate() === (schedule.dayOfMonth ?? 1);
  return false;
}

async function runBackup(schedule: any) {
  // Invalidate cache so concurrent ticks read fresh state
  cachedSchedule = null;
  cacheAt = 0;
  const maxBackups = schedule.maxBackups ?? 10;
  const data = {
    teams: await prisma.team.findMany(),
    users: await prisma.user.findMany(),
    shifts: await prisma.shift.findMany(),
    piketts: await prisma.pikett.findMany(),
    rotationPatterns: await prisma.rotationPattern.findMany(),
    shiftAssignments: await prisma.shiftAssignment.findMany(),
    pikettAssignments: await prisma.pikettAssignment.findMany(),
    outOfOfficeEvents: await prisma.outOfOfficeEvent.findMany(),
    auditLogs: await prisma.auditLog.findMany(),
    userRules: await prisma.userRule.findMany(),
    holidays: await prisma.holiday.findMany(),
  } as any;

  const backup = {
    version: '1.0.0',
    backupDate: new Date().toISOString(),
    source: 'server-scheduler',
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, (v as any[]).length])),
    data,
  };

  const backupsDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().substring(0, 8).replace(/:/g, '');
  const fileName = `backup_ShiftPilot_${dateStr}_${timeStr}.json`;
  const jsonString = JSON.stringify(backup, null, 2);
  fs.writeFileSync(path.join(backupsDir, fileName), jsonString, 'utf-8');
  fs.writeFileSync(path.join(backupsDir, 'backup_latest.json'), jsonString, 'utf-8');

  // Rotate
  const allBackups = fs.readdirSync(backupsDir)
    .filter(f => f.startsWith('backup_ShiftPilot_') && f.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a));
  const deleted: string[] = [];
  if (allBackups.length > maxBackups) {
    for (const old of allBackups.slice(maxBackups)) {
      try { fs.unlinkSync(path.join(backupsDir, old)); deleted.push(old); } catch {}
    }
  }

  await prisma.backupSchedule.update({
    where: { id: 'default' },
    data: { lastRunAt: now },
  });

  await prisma.auditLog.create({
    data: {
      action: 'CREATE',
      entity: 'BACKUP',
      entityId: fileName,
      userId: 'server-scheduler',
      data: { fileName, source: 'server-scheduler', counts: backup.counts, deleted },
    },
  });
  cachedSchedule = null;
}

async function tick() {
  try {
    const schedule = await loadSchedule();
    const now = new Date();
    if (isDueNow(schedule, now)) {
      await runBackup(schedule);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[backupScheduler] tick error', err);
  }
}

export function startBackupScheduler() {
  if (started) return;
  started = true;
  intervalHandle = setInterval(tick, 60_000);
  // Initial catch-up run for any missed schedule
  setTimeout(tick, 5_000);
}

// Counterpart to startBackupScheduler — keeps a clean way to release the
// interval (tests, hot reload) rather than leaking the handle.
export function stopBackupScheduler() {
  if (intervalHandle) clearInterval(intervalHandle);
  started = false;
}
