import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, createUserSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

  try {
    const users = await prisma.user.findMany({
      include: {
        team: true,
        leadingTeam: true,
        rules: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    });

    // Normalize JSON fields that may have been stored as strings
    const normalizedUsers = users.map(user => {
      let normalizedRotationConfig = user.rotationConfig;
      if (typeof user.rotationConfig === 'string') {
        try {
          normalizedRotationConfig = JSON.parse(user.rotationConfig);
        } catch {
          normalizedRotationConfig = null;
        }
      }

      let normalizedAvailability = user.availability;
      if (typeof user.availability === 'string') {
        try {
          normalizedAvailability = JSON.parse(user.availability);
        } catch {
          normalizedAvailability = null;
        }
      }

      return {
        ...user,
        rotationConfig: normalizedRotationConfig,
        availability: normalizedAvailability
      };
    });

    return NextResponse.json(normalizedUsers);
  } catch (error) {
    console.error('[GET /api/users] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
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

    const validation = validateBody(createUserSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const userData: any = {
      firstName: validation.data.firstName,
      lastName: validation.data.lastName,
      email: validation.data.email.toLowerCase(),
      phone: validation.data.phone || null,
      role: validation.data.role || null,
      location: validation.data.location || null,
      workPercent: validation.data.workPercent || 100,
      status: validation.data.status || 'ACTIVE',
      notes: validation.data.notes || null
    };

    // Only set teamId if provided and valid
    if (validation.data.teamId && validation.data.teamId !== 'none') {
      userData.teamId = validation.data.teamId;
    }

    // Store rotation config as JSON
    if (validation.data.rotationConfig && validation.data.rotationConfig.patternId) {
      userData.rotationConfig = {
        patternId: validation.data.rotationConfig.patternId,
        allowedShiftTypes: validation.data.rotationConfig.allowedShiftTypes || []
      };
    } else {
      userData.rotationConfig = null;
    }

    if (validation.data.availability) {
      userData.availability = validation.data.availability;
    }

    const user = await prisma.user.create({
      data: userData,
      include: {
        team: true,
        leadingTeam: true
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'USER',
        entityId: user.id,
        userId: auth.user.id,
        data: user
      }
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    // Detect duplicate email (Prisma unique constraint violation)
    if (error instanceof Error && error.message.includes('Unique constraint failed on the fields: (`email`)')) {
      return NextResponse.json(
        { error: 'This email is already used by another user', code: 'EMAIL_EXISTS' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
