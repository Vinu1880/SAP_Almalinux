import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, planningDraftSchema } from '@/lib/validation';

// List every draft. `?withRows=1` also returns the rows, which the planner
// needs to count other drafts as taken when it generates.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

  try {
    const withRows = new URL(request.url).searchParams.get('withRows') === '1';
    const drafts = await prisma.planningDraft.findMany({ orderBy: { updatedAt: 'desc' } });
    return NextResponse.json(drafts.map(d => ({
      id: d.id,
      name: d.name,
      startDate: d.startDate,
      endDate: d.endDate,
      shiftIds: d.shiftIds,
      pikettIds: d.pikettIds,
      rowCount: Array.isArray(d.rows) ? d.rows.length : 0,
      updatedByName: d.updatedByName,
      updatedAt: d.updatedAt,
      ...(withRows ? { rows: d.rows } : {}),
    })));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const validation = validateBody(planningDraftSchema, await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const draft = await prisma.planningDraft.create({
      data: { ...validation.data, updatedByName: auth.user.displayName || auth.user.mail || null },
    });
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'PLANNING_DRAFT',
        entityId: draft.id,
        userId: auth.user.id,
        data: { name: draft.name, rows: validation.data.rows.length },
      },
    });
    return NextResponse.json(draft, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }
}
