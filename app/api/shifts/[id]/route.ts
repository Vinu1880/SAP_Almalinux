// app/api/shifts/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, updateShiftSchema } from '@/lib/validation';

// GET - Retrieve a shift by ID
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

    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        team: true,
        assignments: true
      }
    });

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(shift);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch shift' },
      { status: 500 }
    );
  }
}

// PUT - Update a shift
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

    const validation = validateBody(updateShiftSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Prepare update data
    const updateData: any = {};

    if (validation.data.name !== undefined) updateData.name = validation.data.name;
    if (validation.data.description !== undefined) updateData.description = validation.data.description || null;
    if (validation.data.startTime !== undefined) updateData.startTime = validation.data.startTime;
    if (validation.data.endTime !== undefined) updateData.endTime = validation.data.endTime;
    if (validation.data.teamId !== undefined) updateData.teamId = validation.data.teamId;
    if (validation.data.membersRequired !== undefined) updateData.membersRequired = validation.data.membersRequired;
    if (validation.data.priority !== undefined) updateData.priority = validation.data.priority;
    if (validation.data.status !== undefined) updateData.status = validation.data.status;
    if (validation.data.color !== undefined) updateData.color = validation.data.color;
    if (validation.data.senderMailbox !== undefined) updateData.senderMailbox = validation.data.senderMailbox;
    if (validation.data.includedUserIds !== undefined) updateData.includedUserIds = validation.data.includedUserIds;
    if (validation.data.excludedUserIds !== undefined) updateData.excludedUserIds = validation.data.excludedUserIds;
    if (validation.data.daysOfWeek !== undefined) updateData.daysOfWeek = validation.data.daysOfWeek;

    const shift = await prisma.shift.update({
      where: { id },
      data: updateData,
      include: {
        team: true
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'SHIFT',
        entityId: shift.id,
        userId: auth.user.id,
        data: {
          before: body,
          after: shift
        } as any
      }
    });

    return NextResponse.json(shift);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update shift' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a shift
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
      where: { shiftId: id, status: { in: ['PENDING', 'TENTATIVE', 'ACCEPTED'] } }
    });
    if (activeAssignments > 0) {
      return NextResponse.json(
        { error: `Cannot delete shift: ${activeAssignments} active assignment(s) exist. Cancel them first or wait for them to be completed.` },
        { status: 400 }
      );
    }

    // Clean up old cancelled/refused assignments before delete
    await prisma.shiftAssignment.deleteMany({
      where: { shiftId: id }
    });

    // Clean up UserRules that reference this shift in their JSON config
    const allRules = await prisma.userRule.findMany({
      where: { type: { in: ['DOUBLE_SHIFT', 'MAX_LOAD'] } }
    });
    const orphanedRuleIds = allRules
      .filter((r: any) => {
        const cfg = r.config as any;
        return cfg?.triggerShiftId === id || cfg?.linkedShiftId === id || cfg?.shiftId === id;
      })
      .map((r: any) => r.id);
    if (orphanedRuleIds.length > 0) {
      await prisma.userRule.deleteMany({ where: { id: { in: orphanedRuleIds } } });
    }

    const shift = await prisma.shift.delete({
      where: { id }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'SHIFT',
        entityId: id,
        userId: auth.user.id,
        data: shift as any
      }
    });

    return NextResponse.json({ success: true, deleted: shift });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete shift' },
      { status: 500 }
    );
  }
}
