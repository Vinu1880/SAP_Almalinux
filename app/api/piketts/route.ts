import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, createPikettSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

  try {
    const piketts = await prisma.pikett.findMany({
      include: {
        team: true,
        user: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(piketts);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch piketts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const body = await request.json();

    const validation = validateBody(createPikettSchema, body);
    if (validation.success === false) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const pikett = await prisma.pikett.create({
      data: {
        name: body.name,
        description: body.description || null,
        startWeek: body.startWeek || '',
        endWeek: body.endWeek || null,
        teamId: body.teamId,
        color: body.color || '#dc2626',
        status: body.status || 'ACTIVE',
        is24_7: body.is24_7 !== undefined ? body.is24_7 : true,
        senderMailbox: body.senderMailbox || '',
        startHour: body.startHour || '08:00',
        minRestWeeks: body.minRestWeeks !== undefined ? body.minRestWeeks : 3,
        avoidSupportSameWeek: body.avoidSupportSameWeek !== undefined ? body.avoidSupportSameWeek : true,
        includedUserIds: body.includedUserIds || [],
        excludedUserIds: body.excludedUserIds || [],
      },
      include: {
        team: true
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'PIKETT',
        entityId: pikett.id,
        userId: auth.user.id,
        data: pikett
      }
    });

    return NextResponse.json(pikett, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create pikett' },
      { status: 500 }
    );
  }
}
