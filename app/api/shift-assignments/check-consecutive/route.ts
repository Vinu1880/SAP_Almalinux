// app/api/shift-assignments/check-consecutive/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { userId, date } = await request.json();

    if (!userId || !date) {
      return NextResponse.json(
        { error: 'userId et date sont requis' },
        { status: 400 }
      );
    }

    const targetDate = new Date(date);
    const prevDate = new Date(targetDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Chercher des assignations pour cet utilisateur la veille ou le lendemain
    const consecutiveAssignments = await prisma.shiftAssignment.findMany({
      where: {
        userId: userId,
        date: {
          in: [prevDate, nextDate]
        },
        status: {
          not: 'CANCELLED'
        }
      },
      include: {
        shift: true
      }
    });

    return NextResponse.json({
      hasConsecutiveShift: consecutiveAssignments.length > 0,
      consecutiveAssignments: consecutiveAssignments.map(a => ({
        date: a.date,
        shiftName: a.shift.name,
        shiftId: a.shiftId
      }))
    });

  } catch (error) {
    console.error('Error checking consecutive shifts:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la vérification des shifts consécutifs' },
      { status: 500 }
    );
  }
}
