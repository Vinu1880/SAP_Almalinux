// app/api/shift-assignments/check-consecutive/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, checkConsecutiveSchema } from '@/lib/validation';

// POST - Check if a user has consecutive shift assignments
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const body = await request.json();
    const validation = validateBody(checkConsecutiveSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { userId, date } = validation.data;

    const targetDate = new Date(date);
    const prevDate = new Date(targetDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Convert to ISO string format (YYYY-MM-DD)
    const prevDateStr = prevDate.toISOString().split('T')[0];
    const nextDateStr = nextDate.toISOString().split('T')[0];

    // Search for assignments for this user on the previous or next day
    const consecutiveAssignments = await prisma.shiftAssignment.findMany({
      where: {
        userId: userId,
        date: {
          in: [prevDateStr, nextDateStr]
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
    return NextResponse.json(
      { error: 'Error checking consecutive shifts' },
      { status: 500 }
    );
  }
}
