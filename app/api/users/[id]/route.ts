// app/api/users/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET - Fetch a specific user by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        team: true,
        leadingTeam: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Normalize JSON fields that may have been stored as strings
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

    return NextResponse.json({
      ...user,
      rotationConfig: normalizedRotationConfig,
      availability: normalizedAvailability
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PUT - Update a user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: any = {};

    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;
    if (body.email !== undefined) updateData.email = body.email.toLowerCase();
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.location !== undefined) updateData.location = body.location || null;
    if (body.role !== undefined) updateData.role = body.role || null;
    if (body.workPercent !== undefined) updateData.workPercent = body.workPercent;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes || null;

    // Handle teamId - set to null if 'none' or empty
    if (body.teamId !== undefined) {
      updateData.teamId = (!body.teamId || body.teamId === 'none' || body.teamId === '') ? null : body.teamId;
    }

    // Store rotation config as JSON
    if (body.rotationConfig !== undefined) {
      if (body.rotationConfig && body.rotationConfig.patternId) {
        updateData.rotationConfig = {
          patternId: body.rotationConfig.patternId,
          priority: body.rotationConfig.priority || 'medium',
          allowedShiftTypes: body.rotationConfig.allowedShiftTypes || []
        };
      } else {
        updateData.rotationConfig = null;
      }
    }

    if (body.availability !== undefined) {
      updateData.availability = body.availability;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        team: true,
        leadingTeam: true
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'USER',
        entityId: user.id,
        data: { before: body, after: user }
      }
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error updating user:', error);

    // Detect duplicate email (Prisma unique constraint violation)
    if (error instanceof Error && error.message.includes('Unique constraint failed on the fields: (`email`)')) {
      return NextResponse.json(
        { error: 'This email is already used by another user', code: 'EMAIL_EXISTS' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Remove user as team lead if applicable
    const teamsLed = await prisma.team.findMany({
      where: { leadId: id }
    });

    if (teamsLed.length > 0) {
      await prisma.team.updateMany({
        where: { leadId: id },
        data: { leadId: null }
      });
    }

    const user = await prisma.user.delete({
      where: { id }
    });

    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'USER',
        entityId: id,
        data: user
      }
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
