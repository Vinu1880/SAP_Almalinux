// app/api/users/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET - Fetch all users with team relations
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const users = await prisma.user.findMany({
      include: {
        team: true,
        leadingTeam: true,
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
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST - Create a new user
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    const userData: any = {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email.toLowerCase(),
      phone: body.phone || null,
      role: body.role || null,
      location: body.location || null,
      workPercent: body.workPercent || 100,
      status: body.status || 'ACTIVE',
      notes: body.notes || null
    };

    // Only set teamId if provided and valid
    if (body.teamId && body.teamId !== 'none') {
      userData.teamId = body.teamId;
    }

    // Store rotation config as JSON
    if (body.rotationConfig && body.rotationConfig.patternId) {
      userData.rotationConfig = {
        patternId: body.rotationConfig.patternId,
        priority: body.rotationConfig.priority || 'medium',
        allowedShiftTypes: body.rotationConfig.allowedShiftTypes || []
      };
    } else {
      userData.rotationConfig = null;
    }

    if (body.availability) {
      userData.availability = body.availability;
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
        data: user
      }
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);

    // Detect duplicate email (Prisma unique constraint violation)
    if (error instanceof Error && error.message.includes('Unique constraint failed on the fields: (`email`)')) {
      return NextResponse.json(
        { error: 'This email is already used by another user', code: 'EMAIL_EXISTS' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
