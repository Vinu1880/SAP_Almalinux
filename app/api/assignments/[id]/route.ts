// app/api/assignments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from '@/lib/auth';

// PUT - Mettre à jour le statut d'une assignation (accepter/refuser)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status, reason } = body;

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
        userId: assignment.userId,
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

// DELETE - Annuler une assignation
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

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
