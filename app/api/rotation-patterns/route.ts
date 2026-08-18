import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, createRotationPatternSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

  try {
    const patterns = await prisma.rotationPattern.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    return NextResponse.json(patterns);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch rotation patterns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const body = await request.json();

    const validation = validateBody(createRotationPatternSchema, body);
    if (validation.success === false) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const input = validation.data;

    const pattern = await prisma.rotationPattern.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        cycleLength: input.cycleLength,
        weeks: input.weeks,
        userShifts: input.userShifts ?? []
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'ROTATION_PATTERN',
        entityId: pattern.id,
        userId: auth.user.id,
        data: pattern
      }
    });

    return NextResponse.json(pattern);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create rotation pattern' }, { status: 500 });
  }
}
