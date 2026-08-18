import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, splitShiftAssignmentSchema } from '@/lib/validation';

const normalizeTime = (t: string) => t.slice(0, 5);

// Replace the assignments of one (date, shift) slot with time segments held by
// different people.
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const body = await request.json();
    const validation = validateBody(splitShiftAssignmentSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { date, shiftId, segments } = validation.data;

    const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    // The segments must span exactly the shift window, otherwise the day would
    // end up partly uncovered without anyone noticing.
    const shiftStart = normalizeTime(shift.startTime);
    const shiftEnd = normalizeTime(shift.endTime);
    if (segments[0].start !== shiftStart || segments[segments.length - 1].end !== shiftEnd) {
      return NextResponse.json(
        { error: `Segments must cover the whole shift (${shiftStart}-${shiftEnd})` },
        { status: 400 }
      );
    }

    const assignmentDate = new Date(date);
    const segmentGroupId = randomUUID();

    // Outlook events must be cancelled by the caller first: revoking them needs
    // a delegated Graph token, which only the browser holds. They are returned
    // in `replaced` so the caller can verify nothing was left orphaned.
    const created = await prisma.$transaction(async (tx) => {
      const previous = await tx.shiftAssignment.findMany({
        where: { date: assignmentDate, shiftId },
        select: { id: true, userId: true, outlookEventId: true },
      });

      await tx.shiftAssignment.deleteMany({ where: { date: assignmentDate, shiftId } });

      await tx.shiftAssignment.createMany({
        data: segments.map((seg, i) => ({
          date: assignmentDate,
          shiftId,
          userId: seg.userId,
          status: 'PENDING' as const,
          segmentStart: seg.start,
          segmentEnd: seg.end,
          segmentGroupId,
          segmentIndex: i + 1,
          sentById: auth.user.id,
        })),
      });

      await tx.auditLog.create({
        data: {
          action: 'SPLIT',
          entity: 'SHIFT_ASSIGNMENT',
          entityId: segmentGroupId,
          userId: auth.user.id,
          data: { date, shiftId, segments, replaced: previous },
        },
      });

      return tx.shiftAssignment.findMany({
        where: { segmentGroupId },
        orderBy: { segmentIndex: 'asc' },
        include: {
          user: { include: { team: true } },
          shift: { include: { team: true } },
        },
      });
    }, { maxWait: 10000, timeout: 10000 });

    return NextResponse.json({ success: true, segmentGroupId, assignments: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to split shift assignment' },
      { status: 500 }
    );
  }
}

// Undo a split: drop every segment of the group, leaving the slot free for the
// planner to reassign.
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const { searchParams } = new URL(request.url);
    const segmentGroupId = searchParams.get('segmentGroupId');
    if (!segmentGroupId) {
      return NextResponse.json({ error: 'segmentGroupId is required' }, { status: 400 });
    }

    const removed = await prisma.shiftAssignment.findMany({ where: { segmentGroupId } });
    if (removed.length === 0) {
      return NextResponse.json({ error: 'Split not found' }, { status: 404 });
    }

    await prisma.shiftAssignment.deleteMany({ where: { segmentGroupId } });

    await prisma.auditLog.create({
      data: {
        action: 'UNSPLIT',
        entity: 'SHIFT_ASSIGNMENT',
        entityId: segmentGroupId,
        userId: auth.user.id,
        data: { removed },
      },
    });

    return NextResponse.json({ success: true, removed: removed.length });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to remove split' },
      { status: 500 }
    );
  }
}
