// app/api/users/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, updateUserSchema } from '@/lib/validation';

// GET - Fetch a specific user by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

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

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const { id } = await params;
    const body = await request.json();

    const validation = validateBody(updateUserSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updateData: any = {};

    if (validation.data.firstName !== undefined) updateData.firstName = validation.data.firstName;
    if (validation.data.lastName !== undefined) updateData.lastName = validation.data.lastName;
    if (validation.data.email !== undefined) updateData.email = validation.data.email.toLowerCase();
    if (validation.data.phone !== undefined) updateData.phone = validation.data.phone || null;
    if (validation.data.location !== undefined) updateData.location = validation.data.location || null;
    if (validation.data.role !== undefined) updateData.role = validation.data.role || null;
    if (validation.data.workPercent !== undefined) updateData.workPercent = validation.data.workPercent;
    if (validation.data.status !== undefined) updateData.status = validation.data.status;
    if (validation.data.notes !== undefined) updateData.notes = validation.data.notes || null;

    // Handle teamId - set to null if 'none' or empty
    if (validation.data.teamId !== undefined) {
      updateData.teamId = (!validation.data.teamId || validation.data.teamId === 'none' || validation.data.teamId === '') ? null : validation.data.teamId;
    }

    // Store rotation config as JSON
    if (validation.data.rotationConfig !== undefined) {
      if (validation.data.rotationConfig && validation.data.rotationConfig.patternId) {
        updateData.rotationConfig = {
          patternId: validation.data.rotationConfig.patternId,
          priority: validation.data.rotationConfig.priority || 'medium',
          allowedShiftTypes: validation.data.rotationConfig.allowedShiftTypes || []
        };
      } else {
        updateData.rotationConfig = null;
      }
    }

    if (validation.data.availability !== undefined) {
      updateData.availability = validation.data.availability;
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
        userId: auth.user.id,
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

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const { id } = await params;

    // Check for pending/accepted assignments
    const activeAssignments = await prisma.shiftAssignment.count({
      where: { userId: id, status: { in: ['PENDING', 'ACCEPTED'] } }
    });
    if (activeAssignments > 0) {
      return NextResponse.json(
        { error: `Cannot delete user: ${activeAssignments} active assignment(s) exist. Cancel or reassign them first.` },
        { status: 400 }
      );
    }

    // Check if user is assigned to active piketts
    const activePiketts = await prisma.pikett.count({
      where: { userId: id, status: 'ACTIVE' }
    });
    if (activePiketts > 0) {
      return NextResponse.json(
        { error: `Cannot delete user: assigned to ${activePiketts} active pikett(s). Remove the user from piketts first.` },
        { status: 400 }
      );
    }

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

    // Clean up old cancelled/refused assignments before delete
    await prisma.shiftAssignment.deleteMany({
      where: { userId: id }
    });

    const user = await prisma.user.delete({
      where: { id }
    });

    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'USER',
        entityId: id,
        userId: auth.user.id,
        data: user
      }
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
