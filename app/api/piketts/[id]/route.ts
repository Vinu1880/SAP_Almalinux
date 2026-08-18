import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, updatePikettSchema } from '@/lib/validation';

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

    const input = validation.data;
    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description ?? null;
    if (input.startWeek !== undefined) updateData.startWeek = input.startWeek;
    if (input.endWeek !== undefined) updateData.endWeek = input.endWeek ?? null;
    if (input.teamId !== undefined) updateData.teamId = input.teamId;
    if (input.userId !== undefined) updateData.userId = input.userId ?? null;
    if (input.color !== undefined) updateData.color = input.color;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.is24_7 !== undefined) updateData.is24_7 = input.is24_7;
    if (input.senderMailbox !== undefined) updateData.senderMailbox = input.senderMailbox;
    if (input.startHour !== undefined) updateData.startHour = input.startHour;
    if (input.minRestWeeks !== undefined) updateData.minRestWeeks = input.minRestWeeks;
    if (input.avoidSupportSameWeek !== undefined) updateData.avoidSupportSameWeek = input.avoidSupportSameWeek;
    if (input.includedUserIds !== undefined) updateData.includedUserIds = input.includedUserIds;
    if (input.excludedUserIds !== undefined) updateData.excludedUserIds = input.excludedUserIds;

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
    return NextResponse.json(
      { error: 'Failed to update pikett' },
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

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const { id } = await params;

    // Remove UserRules referencing this pikett in their JSON config
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
    return NextResponse.json(
      { error: 'Failed to delete pikett' },
      { status: 500 }
    );
  }
}
