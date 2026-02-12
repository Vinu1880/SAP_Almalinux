// app/api/holidays/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, createHolidaySchema } from '@/lib/validation';

// GET - Fetch holidays with optional year and canton filters
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const canton = searchParams.get('canton');

    let whereClause: any = {};

    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      whereClause.date = {
        gte: startDate,
        lte: endDate
      };
    }

    const holidays = await prisma.holiday.findMany({
      where: whereClause,
      orderBy: { date: 'asc' }
    });

    // Filter by canton if specified
    let filteredHolidays = holidays;
    if (canton && canton !== 'ALL') {
      filteredHolidays = holidays.filter((holiday: any) =>
        holiday.cantons.includes('ALL') || holiday.cantons.includes(canton)
      );
    }

    return NextResponse.json(filteredHolidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return NextResponse.json(
      { error: 'Failed to fetch holidays' },
      { status: 500 }
    );
  }
}

// POST - Create a new holiday
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl2 = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl2) return rl2;

  try {
    const body = await request.json();
    const validation = validateBody(createHolidaySchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { name, date, cantons, type, recurring, description } = validation.data;

    const holiday = await prisma.holiday.create({
      data: {
        name,
        date: new Date(date),
        cantons,
        type,
        recurring: recurring || false,
        description: description || null
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'HOLIDAY',
        entityId: holiday.id,
        userId: auth.user.id,
        data: { name, date, cantons, type }
      }
    });

    return NextResponse.json(holiday, { status: 201 });
  } catch (error) {
    console.error('Error creating holiday:', error);
    return NextResponse.json(
      { error: 'Failed to create holiday', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
