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
    if (canton) {
      filteredHolidays = holidays.filter((holiday: any) =>
        holiday.cantons.includes(canton)
      );
    }

    return NextResponse.json(filteredHolidays);
  } catch (error) {
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

    // Check for duplicate (same date — prevents importing same day twice regardless of name)
    const existing = await prisma.holiday.findFirst({
      where: { date: new Date(date) }
    });
    if (existing) {
      return NextResponse.json({ error: 'Holiday already exists for this date', duplicate: true }, { status: 409 });
    }

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
    return NextResponse.json(
      { error: 'Failed to create holiday' },
      { status: 500 }
    );
  }
}

// DELETE - Delete all holidays (with optional year filter)
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl3 = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl3) return rl3;

  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    let whereClause: any = {};
    if (year) {
      whereClause.date = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`)
      };
    }

    const result = await prisma.holiday.deleteMany({ where: whereClause });

    await prisma.auditLog.create({
      data: {
        action: 'DELETE_ALL',
        entity: 'HOLIDAY',
        userId: auth.user.id,
        data: { year: year || 'all', deletedCount: result.count }
      }
    });

    return NextResponse.json({ success: true, deletedCount: result.count });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete holidays' },
      { status: 500 }
    );
  }
}
