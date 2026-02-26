// app/api/outlook/sync/route.ts
// Syncs Outlook attendee responses back to DB assignments
// Reads attendee accept/decline status from shared mailbox calendar events

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';

function mapOutlookResponseToStatus(response: string): 'ACCEPTED' | 'TENTATIVE' | 'REFUSED' | 'PENDING' {
  switch (response?.toLowerCase()) {
    case 'accepted':
      return 'ACCEPTED';
    case 'tentativelyaccepted':
      return 'TENTATIVE';
    case 'declined':
      return 'REFUSED';
    default:
      return 'PENDING';
  }
}

// POST - Sync all pending assignments with their Outlook event responses
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const graphToken = request.headers.get('X-Graph-Token');
    if (!graphToken) {
      return NextResponse.json({ error: 'Missing Graph access token' }, { status: 401 });
    }

    const pendingAssignments = await prisma.shiftAssignment.findMany({
      where: {
        status: { in: ['PENDING', 'TENTATIVE'] },
        outlookEventId: { not: null }
      },
      include: { user: true, shift: true }
    });

    if (pendingAssignments.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending assignments to sync', updated: 0, errors: 0 });
    }

    let updatedCount = 0;
    let errorCount = 0;

    for (const assignment of pendingAssignments) {
      try {
        const { outlookEventId, user, shift, id } = assignment;
        if (!outlookEventId) continue;

        const mailbox = shift.senderMailbox || 'me';
        const eventUrl = mailbox === 'me'
          ? `https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`
          : `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/calendar/events/${outlookEventId}`;

        const eventResponse = await fetch(eventUrl, {
          headers: { 'Authorization': `Bearer ${graphToken}` }
        });

        if (!eventResponse.ok) {
          if (eventResponse.status === 404) continue;
          errorCount++;
          continue;
        }

        const event = await eventResponse.json();

        console.log(`[outlook/sync] Event ${outlookEventId}: subject="${event.subject}", attendees=${JSON.stringify(event.attendees?.map((a: any) => ({ email: a.emailAddress?.address, response: a.status?.response })))}`);
        console.log(`[outlook/sync] Looking for user email: "${user.email}"`);

        const attendee = event.attendees?.find(
          (a: any) => a.emailAddress?.address?.toLowerCase() === user.email.toLowerCase()
        );

        if (!attendee?.status?.response) {
          console.log(`[outlook/sync] No matching attendee found or no response yet`);
          continue;
        }

        const responseStatus = attendee.status.response;
        const newStatus = mapOutlookResponseToStatus(responseStatus);
        console.log(`[outlook/sync] Attendee response: "${responseStatus}" -> mapped to: "${newStatus}", current DB status: "${assignment.status}"`);

        if (newStatus !== 'PENDING' && newStatus !== assignment.status) {
          await prisma.shiftAssignment.update({
            where: { id },
            data: { status: newStatus, respondedAt: new Date() }
          });

          // Cancel the calendar event when the shift is declined
          if (newStatus === 'REFUSED' && outlookEventId) {
            try {
              const cancelRes = await fetch(`${eventUrl}/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${graphToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: 'Shift declined' }),
              });
              if (!cancelRes.ok && cancelRes.status !== 202) {
                await fetch(eventUrl, { method: 'DELETE', headers: { 'Authorization': `Bearer ${graphToken}` } });
              }
            } catch { /* continue */ }
          }

          await prisma.auditLog.create({
            data: {
              action: 'UPDATE',
              entity: 'SHIFT_ASSIGNMENT',
              entityId: id,
              userId: auth.user.id,
              data: {
                source: 'outlook-sync',
                oldStatus: assignment.status,
                newStatus,
                outlookResponse: responseStatus,
                outlookEventDeleted: newStatus === 'REFUSED'
              }
            }
          });

          updatedCount++;
        }
      } catch {
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Synchronization completed',
      checked: pendingAssignments.length,
      updated: updatedCount,
      errors: errorCount
    });

  } catch (error) {
    console.error('[outlook/sync] Synchronization failed:', error);
    return NextResponse.json({ error: 'Synchronization failed', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
