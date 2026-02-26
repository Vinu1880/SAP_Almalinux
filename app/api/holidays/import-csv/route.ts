// app/api/holidays/import-csv/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';

// POST - Batch import holidays from parsed CSV data
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const { holidays: holidayList } = await request.json();

    if (!Array.isArray(holidayList) || holidayList.length === 0) {
      return NextResponse.json({ error: 'No holidays provided' }, { status: 400 });
    }

    const createdHolidays = [];
    let skippedCount = 0;

    for (const h of holidayList) {
      if (!h.name || !h.date || !h.cantons || h.cantons.length === 0) {
        skippedCount++;
        continue;
      }

      // Check for duplicate by date
      const existing = await prisma.holiday.findFirst({
        where: { date: new Date(h.date) }
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      const holiday = await prisma.holiday.create({
        data: {
          name: h.name,
          date: new Date(h.date),
          cantons: h.cantons,
          type: h.type || 'CUSTOM',
          recurring: h.recurring || false,
          description: h.description || null
        }
      });
      createdHolidays.push(holiday);
    }

    await prisma.auditLog.create({
      data: {
        action: 'IMPORT_CSV',
        entity: 'HOLIDAY',
        userId: auth.user.id,
        data: { importedCount: createdHolidays.length, skippedCount }
      }
    });

    return NextResponse.json(createdHolidays, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to import holidays' },
      { status: 500 }
    );
  }
}
