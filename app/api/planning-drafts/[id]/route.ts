import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, updatePlanningDraftSchema } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

  try {
    const { id } = await params;
    const draft = await prisma.planningDraft.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    return NextResponse.json(draft);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch draft' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const { id } = await params;
    const validation = validateBody(updatePlanningDraftSchema, await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const existing = await prisma.planningDraft.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

    const draft = await prisma.planningDraft.update({
      where: { id },
      data: { ...validation.data, updatedByName: auth.user.displayName || auth.user.mail || null },
    });
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'PLANNING_DRAFT',
        entityId: id,
        userId: auth.user.id,
        data: { name: draft.name, rows: Array.isArray(draft.rows) ? draft.rows.length : 0 },
      },
    });
    return NextResponse.json(draft);
  } catch {
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const { id } = await params;
    const existing = await prisma.planningDraft.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!existing) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    await prisma.planningDraft.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'PLANNING_DRAFT',
        entityId: id,
        userId: auth.user.id,
        data: { name: existing.name },
      },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
}
