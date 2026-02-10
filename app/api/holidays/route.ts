// app/api/holidays/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { toJsonString, fromJsonString } from '@/lib/json-helpers';

// GET - Récupérer les jours fériés
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

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

    // Parse cantons from string to array for each holiday
    const normalizedHolidays = holidays.map(h => ({
      ...h,
      cantons: fromJsonString(h.cantons) || []
    }));

    console.log(`=== HOLIDAYS FETCHED ===`);
    console.log(`Year filter: ${year || 'none'}`);
    console.log(`Canton filter: ${canton || 'none'}`);
    console.log(`Total holidays found: ${normalizedHolidays.length}`);
    normalizedHolidays.forEach(h => {
      const cantonsArr = Array.isArray(h.cantons) ? h.cantons : [];
      console.log(`- ${h.name} (${new Date(h.date).toISOString().split('T')[0]}) - Cantons: ${cantonsArr.join(', ')}`);
    });
    console.log(`========================`);

    // Filtrer par canton si spécifié
    let filteredHolidays = normalizedHolidays;
    if (canton && canton !== 'ALL') {
      filteredHolidays = normalizedHolidays.filter((holiday: any) => {
        const cantonsArr = Array.isArray(holiday.cantons) ? holiday.cantons : [];
        return cantonsArr.includes('ALL') || cantonsArr.includes(canton);
      });
      console.log(`After canton filter (${canton}): ${filteredHolidays.length} holidays`);
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

// POST - Créer un nouveau jour férié
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { name, date, cantons, type, recurring, description } = body;

    console.log('=== CREATING HOLIDAY ===');
    console.log('Body received:', JSON.stringify(body, null, 2));

    if (!name || !date || !cantons || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, date, cantons, type' },
        { status: 400 }
      );
    }

    const holiday = await prisma.holiday.create({
      data: {
        name,
        date: new Date(date),
        cantons: toJsonString(cantons),
        type,
        recurring: recurring || false,
        description: description || null
      }
    });

    console.log('Holiday created successfully:', holiday);
    console.log('========================');

    return NextResponse.json(holiday, { status: 201 });
  } catch (error) {
    console.error('Error creating holiday:', error);
    return NextResponse.json(
      { error: 'Failed to create holiday', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}