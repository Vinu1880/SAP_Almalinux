// app/api/piketts/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, updatePikettSchema } from '@/lib/validation';

// PUT - Update a pikett by ID
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

    const validation = validateBody(updatePikettSchema, body);
    if (validation.success === false) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.startWeek !== undefined) updateData.startWeek = body.startWeek;
    if (body.endWeek !== undefined) updateData.endWeek = body.endWeek || null;
    if (body.teamId !== undefined) updateData.teamId = body.teamId;
    if (body.userId !== undefined) updateData.userId = body.userId || null;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.is24_7 !== undefined) updateData.is24_7 = body.is24_7;
    if (body.includedUserIds !== undefined) updateData.includedUserIds = body.includedUserIds;
    if (body.excludedUserIds !== undefined) updateData.excludedUserIds = body.excludedUserIds;
    if (body.daysOfWeek !== undefined) updateData.daysOfWeek = body.daysOfWeek;

    const pikett = await prisma.pikett.update({
      where: { id },
      data: updateData,
      include: {
        team: true
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'PIKETT',
        entityId: pikett.id,
        userId: auth.user.id,
        data: pikett
      }
    });

    return NextResponse.json(pikett);
  } catch (error) {
    console.error('Error updating pikett:', error);
    return NextResponse.json(
      { error: 'Failed to update pikett' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a pikett by ID
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

    await prisma.pikett.delete({
      where: { id }
    });

    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'PIKETT',
        entityId: id,
        userId: auth.user.id,
        data: { id }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pikett:', error);
    return NextResponse.json(
      { error: 'Failed to delete pikett' },
      { status: 500 }
    );
  }
}
