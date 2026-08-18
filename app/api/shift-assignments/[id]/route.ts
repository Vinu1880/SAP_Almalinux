// app/api/shift-assignments/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, updateAssignmentSchema } from '@/lib/validation';

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
    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            team: true
          }
        },
        shift: {
          include: {
            team: true
          }
        }
      }
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(assignment);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch shift assignment' },
      { status: 500 }
    );
  }
}

// PUT - Full update (records respondedAt on status change)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl2 = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl2) return rl2;

  try {
    const { id } = await params;
    const body = await request.json();
    const validation = validateBody(updateAssignmentSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const input = validation.data;
    const updateData: any = {};

    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === 'ACCEPTED' || input.status === 'REFUSED' || input.status === 'TENTATIVE') {
        updateData.respondedAt = new Date();
      }
    }

    if (input.reason !== undefined) {
      updateData.reason = input.reason;
    }

    if (input.outlookEventId !== undefined) {
      updateData.outlookEventId = input.outlookEventId;
    }

    const assignment = await prisma.shiftAssignment.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          include: {
            team: true
          }
        },
        shift: {
          include: {
            team: true
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'SHIFT_ASSIGNMENT',
        entityId: assignment.id,
        userId: auth.user.id,
        data: { before: body, after: assignment }
      }
    });

    return NextResponse.json(assignment);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update shift assignment' },
      { status: 500 }
    );
  }
}

// PATCH - Partial update
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl3 = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl3) return rl3;

  try {
    const { id } = await params;
    const body = await request.json();
    const validation = validateBody(updateAssignmentSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const assignment = await prisma.shiftAssignment.update({
      where: { id },
      data: validation.data,
      include: {
        user: {
          include: {
            team: true
          }
        },
        shift: {
          include: {
            team: true
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'PATCH',
        entity: 'SHIFT_ASSIGNMENT',
        entityId: assignment.id,
        userId: auth.user.id,
        data: { changes: validation.data }
      }
    });

    return NextResponse.json(assignment);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to patch shift assignment' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl4 = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl4) return rl4;

  try {
    const { id } = await params;

    const assignment = await prisma.shiftAssignment.delete({
      where: { id }
    });

    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'SHIFT_ASSIGNMENT',
        entityId: id,
        userId: auth.user.id,
        data: assignment
      }
    });

    return NextResponse.json({ success: true, deleted: assignment });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete shift assignment' },
      { status: 500 }
    );
  }
}
