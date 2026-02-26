import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import {
  validateBody,
  updateUserRuleSchema,
  weekParityConfigSchema,
  doubleShiftConfigSchema,
  maxLoadConfigSchema,
} from '@/lib/validation';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  const { id, ruleId } = await params;

  try {
    const existing = await prisma.userRule.findFirst({
      where: { id: ruleId, userId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    const body = await request.json();
    const validation = validateBody(updateUserRuleSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const data: any = {};
    if (validation.data.enabled !== undefined) data.enabled = validation.data.enabled;
    if (validation.data.type) data.type = validation.data.type;

    if (validation.data.config) {
      const type = validation.data.type || existing.type;
      let configResult;
      switch (type) {
        case 'WEEK_PARITY':
          configResult = weekParityConfigSchema.safeParse(validation.data.config);
          break;
        case 'DOUBLE_SHIFT':
          configResult = doubleShiftConfigSchema.safeParse(validation.data.config);
          break;
        case 'MAX_LOAD':
          configResult = maxLoadConfigSchema.safeParse(validation.data.config);
          break;
      }
      if (!configResult?.success) {
        return NextResponse.json({ error: 'Invalid config for rule type' }, { status: 400 });
      }
      data.config = configResult.data;
    }

    const rule = await prisma.userRule.update({
      where: { id: ruleId },
      data,
    });

    return NextResponse.json(rule);
  } catch {
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  const { id, ruleId } = await params;

  try {
    const existing = await prisma.userRule.findFirst({
      where: { id: ruleId, userId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    await prisma.userRule.delete({ where: { id: ruleId } });

    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'USER_RULE',
        entityId: ruleId,
        userId: auth.user.id,
        data: { type: existing.type, targetUserId: id },
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
}
