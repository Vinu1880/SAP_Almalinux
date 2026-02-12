// app/api/assignments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, updateAssignmentSchema } from '@/lib/validation';

// PUT - Update the status of an assignment (accept/refuse)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const validation = validateBody(updateAssignmentSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { status, reason } = validation.data;

    const assignment = await prisma.shiftAssignment.update({
      where: { id },
      data: {
        status,
        reason,
        respondedAt: new Date(),
      },
      include: {
        shift: true,
        user: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: status === "ACCEPTED" ? "ACCEPT" : "REFUSE",
        entity: "ASSIGNMENT",
        entityId: assignment.id,
        userId: auth.user.id,
        data: { status, reason },
      },
    });

    return NextResponse.json(assignment);
  } catch (error) {
    console.error("Error updating assignment:", error);
    return NextResponse.json(
      { error: "Failed to update assignment" },
      { status: 500 }
    );
  }
}

// DELETE - Cancel an assignment
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl2 = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl2) return rl2;

  try {
    const { id } = await context.params;

    const assignment = await prisma.shiftAssignment.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "ASSIGNMENT",
        entityId: id,
        userId: auth.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling assignment:", error);
    return NextResponse.json(
      { error: "Failed to cancel assignment" },
      { status: 500 }
    );
  }
}
