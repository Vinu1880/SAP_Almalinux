import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import {
  validateBody,
  createUserRuleSchema,
  weekParityConfigSchema,
  doubleShiftConfigSchema,
  maxLoadConfigSchema,
} from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

  const { id } = await params;

  try {
    const rules = await prisma.userRule.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(rules);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  const { id } = await params;

  try {
    const body = await request.json();
    const validation = validateBody(createUserRuleSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { type, config, enabled } = validation.data;

    // Validate config based on type
    let configResult;
    switch (type) {
      case 'WEEK_PARITY':
        configResult = weekParityConfigSchema.safeParse(config);
        break;
      case 'DOUBLE_SHIFT':
        configResult = doubleShiftConfigSchema.safeParse(config);
        break;
      case 'MAX_LOAD':
        configResult = maxLoadConfigSchema.safeParse(config);
        break;
    }
    if (!configResult?.success) {
      return NextResponse.json({ error: 'Invalid config for rule type' }, { status: 400 });
    }

    const rule = await prisma.userRule.create({
      data: { userId: id, type, config: configResult.data, enabled },
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'USER_RULE',
        entityId: rule.id,
        userId: auth.user.id,
        data: { type, config: configResult.data, targetUserId: id },
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
  }
}
