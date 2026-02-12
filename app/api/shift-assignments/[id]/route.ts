// app/api/shift-assignments/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, updateAssignmentSchema } from '@/lib/validation';

// GET - Retrieve a specific assignment
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
    console.error('Error fetching shift assignment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shift assignment' },
      { status: 500 }
    );
  }
}

// PUT - Update an assignment (typically the status)
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

    const updateData: any = {};

    if (body.status !== undefined) {
      updateData.status = body.status;

      // If the status changes to ACCEPTED or REFUSED, record the response date
      if (body.status === 'ACCEPTED' || body.status === 'REFUSED') {
        updateData.respondedAt = new Date();
      }
    }

    if (body.reason !== undefined) {
      updateData.reason = body.reason;
    }

    if (body.outlookEventId !== undefined) {
      updateData.outlookEventId = body.outlookEventId;
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

    // Audit log
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
    console.error('Error updating shift assignment:', error);
    return NextResponse.json(
      { error: 'Failed to update shift assignment' },
      { status: 500 }
    );
  }
}

// PATCH - Partially update an assignment (e.g., outlookEventId)
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

    // Audit log
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
    console.error('Error patching shift assignment:', error);
    return NextResponse.json(
      { error: 'Failed to patch shift assignment' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an assignment
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

    // Audit log
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
    console.error('Error deleting shift assignment:', error);
    return NextResponse.json(
      { error: 'Failed to delete shift assignment' },
      { status: 500 }
    );
  }
}
