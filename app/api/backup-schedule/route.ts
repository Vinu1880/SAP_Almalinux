// DB-stored backup schedule read/written here so the server scheduler honours it without a browser

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { updateSchedulerCache } from '@/lib/backupScheduler';

const SINGLETON_ID = 'default';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  let row = await prisma.backupSchedule.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) {
    row = await prisma.backupSchedule.create({
      data: { id: SINGLETON_ID, enabled: false, frequency: 'daily', hour: '02:00', dayOfWeek: 1, dayOfMonth: 1, maxBackups: 10 },
    });
  }
  return NextResponse.json(row);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const data: any = {};
  if (body.enabled !== undefined) data.enabled = !!body.enabled;
  if (body.frequency !== undefined) data.frequency = String(body.frequency);
  if (body.hour !== undefined) data.hour = String(body.hour);
  if (body.dayOfWeek !== undefined) data.dayOfWeek = Number(body.dayOfWeek);
  if (body.dayOfMonth !== undefined) data.dayOfMonth = Number(body.dayOfMonth);
  if (body.maxBackups !== undefined) data.maxBackups = Number(body.maxBackups);

  const row = await prisma.backupSchedule.upsert({
    where: { id: SINGLETON_ID },
    update: data,
    create: {
      id: SINGLETON_ID,
      enabled: data.enabled ?? false,
      frequency: data.frequency ?? 'daily',
      hour: data.hour ?? '02:00',
      dayOfWeek: data.dayOfWeek ?? 1,
      dayOfMonth: data.dayOfMonth ?? 1,
      maxBackups: data.maxBackups ?? 10,
    },
  });

  // Refresh scheduler cache so next tick sees the update
  await updateSchedulerCache();

  return NextResponse.json(row);
}
