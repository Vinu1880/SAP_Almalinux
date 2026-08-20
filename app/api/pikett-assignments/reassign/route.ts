import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, reassignPikettDaysSchema } from '@/lib/validation';
import { resolveLocalUserId } from '@/lib/resolveUser';

/**
 * Hand part of a pikett week over to someone else, day by day.
 *
 * A pikett normally runs Monday 08:00 to the next Monday 08:00 and stays with
 * one person. When that person falls ill mid-week, the remaining days need a
 * new holder without disturbing the days already covered. Rows are stored per
 * day, so reassigning is a matter of moving the selected dates — no schema
 * change, and the handover always lands on the pikett's start hour.
 *
 * Outlook events are cancelled and re-sent by the caller, which holds the
 * delegated Graph token.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const body = await request.json();
    const validation = validateBody(reassignPikettDaysSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { pikettId, dates, newUserId, ccUserIds } = validation.data;

    const [pikett, newUser] = await Promise.all([
      prisma.pikett.findUnique({ where: { id: pikettId } }),
      prisma.user.findUnique({ where: { id: newUserId } }),
    ]);
    if (!pikett) return NextResponse.json({ error: 'Pikett not found' }, { status: 404 });
    if (!newUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const days = dates.map(d => new Date(d));
    const sentById = await resolveLocalUserId(auth.user);

    const result = await prisma.$transaction(async (tx) => {
      // Only the live rows are replaced. REFUSED and CANCELLED ones are the
      // history the resend dialog reads to know who already declined the slot.
      const replaceable = {
        in: ['PENDING', 'ACCEPTED', 'TENTATIVE'] as ('PENDING' | 'ACCEPTED' | 'TENTATIVE')[],
      };

      const previous = await tx.pikettAssignment.findMany({
        where: { pikettId, date: { in: days }, status: replaceable },
        select: { id: true, date: true, userId: true, outlookEventId: true },
      });

      // Drop the old holders for those days before inserting, so the unique
      // (date, pikettId, userId) constraint cannot trip on a partial overlap.
      await tx.pikettAssignment.deleteMany({
        where: { pikettId, date: { in: days }, status: replaceable },
      });

      await tx.pikettAssignment.createMany({
        data: days.map(date => ({
          date,
          pikettId,
          userId: newUserId,
          status: 'PENDING' as const,
          sentById,
          ccUserIds: ccUserIds ?? [],
        })),
      });

      await tx.auditLog.create({
        data: {
          action: 'REASSIGN',
          entity: 'PIKETT_ASSIGNMENT',
          entityId: pikettId,
          userId: auth.user.id,
          data: { dates, newUserId, replaced: previous },
        },
      });

      return {
        replaced: previous,
        created: await tx.pikettAssignment.findMany({
          where: { pikettId, date: { in: days }, userId: newUserId },
          orderBy: { date: 'asc' },
          include: {
            user: { include: { team: true } },
            pikett: { include: { team: true } },
          },
        }),
      };
    }, { maxWait: 10000, timeout: 10000 });

    return NextResponse.json({
      success: true,
      reassigned: result.created.length,
      replaced: result.replaced,
      assignments: result.created,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to reassign pikett days' },
      { status: 500 }
    );
  }
}
