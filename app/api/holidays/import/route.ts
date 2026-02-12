// app/api/holidays/import/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// POST - Import standard holidays
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { year, cantons } = body;

    if (!year || !cantons || !Array.isArray(cantons)) {
      return NextResponse.json(
        { error: 'Year and cantons array are required' },
        { status: 400 }
      );
    }

    const standardHolidays = getStandardSwissHolidays(year, cantons);
    const createdHolidays = [];

    for (const holidayData of standardHolidays) {
      // Check if the holiday already exists
      const existingHoliday = await prisma.holiday.findFirst({
        where: {
          name: holidayData.name,
          date: new Date(holidayData.date)
        }
      });

      if (!existingHoliday) {
        const holiday = await prisma.holiday.create({
          data: {
            name: holidayData.name,
            date: new Date(holidayData.date),
            cantons: holidayData.cantons,
            type: holidayData.type as 'FEDERAL' | 'CANTONAL',
            recurring: holidayData.recurring
          }
        });
        createdHolidays.push(holiday);
      }
    }

    return NextResponse.json(createdHolidays, { status: 201 });
  } catch (error) {
    console.error('Error importing holidays:', error);
    return NextResponse.json(
      { error: 'Failed to import holidays' },
      { status: 500 }
    );
  }
}

// Generate standard Swiss holidays
function getStandardSwissHolidays(year: number, cantons: string[]) {
  const holidays = [];

  // Federal holidays (for all cantons)
  const federalHolidays = [
    { name: 'Nouvel An', date: `${year}-01-01`, type: 'FEDERAL' },
    { name: 'Fête nationale suisse', date: `${year}-08-01`, type: 'FEDERAL' },
    { name: 'Noël', date: `${year}-12-25`, type: 'FEDERAL' },
    { name: 'Saint-Étienne', date: `${year}-12-26`, type: 'FEDERAL' },
  ];

  federalHolidays.forEach(holiday => {
    holidays.push({
      ...holiday,
      cantons: ['ALL'],
      recurring: true
    });
  });

  // Canton-specific holidays
  if (cantons.includes('BE') || cantons.includes('ALL')) {
    holidays.push(
      {
        name: 'Berchtoldstag',
        date: `${year}-01-02`,
        cantons: ['BE'],
        type: 'CANTONAL',
        recurring: true
      },
      {
        name: 'Fête du Travail',
        date: `${year}-05-01`,
        cantons: ['BE'],
        type: 'CANTONAL',
        recurring: true
      }
    );
  }

  if (cantons.includes('ZH') || cantons.includes('ALL')) {
    holidays.push(
      {
        name: 'Berchtoldstag',
        date: `${year}-01-02`,
        cantons: ['ZH'],
        type: 'CANTONAL',
        recurring: true
      },
      {
        name: 'Fête du Travail',
        date: `${year}-05-01`,
        cantons: ['ZH'],
        type: 'CANTONAL',
        recurring: true
      }
    );
  }

  if (cantons.includes('VD') || cantons.includes('ALL')) {
    holidays.push(
      {
        name: 'Berchtoldstag',
        date: `${year}-01-02`,
        cantons: ['VD'],
        type: 'CANTONAL',
        recurring: true
      },
      {
        name: 'Fête du Travail',
        date: `${year}-05-01`,
        cantons: ['VD'],
        type: 'CANTONAL',
        recurring: true
      },
      {
        name: 'Fête-Dieu',
        date: getCorpusChristiDate(year),
        cantons: ['VD'],
        type: 'CANTONAL',
        recurring: true
      }
    );
  }

  // Easter calculation and related holidays
  const easter = calculateEaster(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);

  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);

  const pentecostMonday = new Date(easter);
  pentecostMonday.setDate(easter.getDate() + 50);

  // Good Friday (most cantons)
  const goodFridayCantons = cantons.filter(c => ['BE', 'ZH', 'VD'].includes(c));
  if (goodFridayCantons.length > 0 || cantons.includes('ALL')) {
    holidays.push({
      name: 'Vendredi Saint',
      date: formatDate(goodFriday),
      cantons: cantons.includes('ALL') ? ['ALL'] : goodFridayCantons,
      type: 'CANTONAL',
      recurring: true
    });
  }

  // Easter Monday (primarily Vaud)
  if (cantons.includes('VD') || cantons.includes('ALL')) {
    holidays.push({
      name: 'Lundi de Pâques',
      date: formatDate(easterMonday),
      cantons: cantons.includes('ALL') ? ['ALL'] : ['VD'],
      type: 'CANTONAL',
      recurring: true
    });
  }

  // Ascension (most cantons)
  const ascensionCantons = cantons.filter(c => ['BE', 'ZH', 'VD'].includes(c));
  if (ascensionCantons.length > 0 || cantons.includes('ALL')) {
    holidays.push({
      name: 'Ascension',
      date: formatDate(ascension),
      cantons: cantons.includes('ALL') ? ['ALL'] : ascensionCantons,
      type: 'CANTONAL',
      recurring: true
    });
  }

  // Whit Monday (primarily Bern and Vaud)
  const pentecostCantons = cantons.filter(c => ['BE', 'VD'].includes(c));
  if (pentecostCantons.length > 0 || cantons.includes('ALL')) {
    holidays.push({
      name: 'Lundi de Pentecôte',
      date: formatDate(pentecostMonday),
      cantons: cantons.includes('ALL') ? ['ALL'] : pentecostCantons,
      type: 'CANTONAL',
      recurring: true
    });
  }

  return holidays;
}

// Easter date calculation (Gauss algorithm)
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

// Corpus Christi date calculation (60 days after Easter)
function getCorpusChristiDate(year: number): string {
  const easter = calculateEaster(year);
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);
  return formatDate(corpusChristi);
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
