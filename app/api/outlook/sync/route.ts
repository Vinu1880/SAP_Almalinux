// app/api/outlook/sync/route.ts
// Server-side sync route that reads Outlook event responses using delegated permissions
// The client passes the Graph token via X-Graph-Token header
// Uses /users/{mailbox}/events/{eventId} to read attendee responses

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';

// Map Outlook responses to our statuses
function mapOutlookResponseToStatus(response: string): 'ACCEPTED' | 'REFUSED' | 'PENDING' {
  switch (response?.toLowerCase()) {
    case 'accepted':
    case 'tentativelyaccepted':
      return 'ACCEPTED';
    case 'declined':
      return 'REFUSED';
    default:
      return 'PENDING';
  }
}

// POST - Synchronize Outlook responses (called from dashboard)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const graphToken = request.headers.get('X-Graph-Token');
    if (!graphToken) {
      return NextResponse.json(
        { error: 'Missing Graph access token' },
        { status: 401 }
      );
    }

    // Retrieve all PENDING assignments with an outlookEventId
    const pendingAssignments = await prisma.shiftAssignment.findMany({
      where: {
        status: 'PENDING',
        outlookEventId: { not: null }
      },
      include: {
        user: true,
        shift: true
      }
    });

    if (pendingAssignments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending assignments to sync',
        updated: 0,
        errors: 0
      });
    }

    let updatedCount = 0;
    let errorCount = 0;

    for (const assignment of pendingAssignments) {
      try {
        const { outlookEventId, user, shift, id } = assignment;
        if (!outlookEventId) continue;

        // Use /users/{mailbox}/events/{eventId} with delegated token
        const mailbox = shift.senderMailbox || 'me';
        const eventUrl = mailbox === 'me'
          ? `https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`
          : `https://graph.microsoft.com/v1.0/users/${mailbox}/events/${outlookEventId}`;

        const eventResponse = await fetch(eventUrl, {
          headers: {
            'Authorization': `Bearer ${graphToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!eventResponse.ok) {
          if (eventResponse.status === 404) continue;
          errorCount++;
          continue;
        }

        const event = await eventResponse.json();

        // Find the user's response in the attendees
        const attendee = event.attendees?.find(
          (a: any) => a.emailAddress.address.toLowerCase() === user.email.toLowerCase()
        );

        if (!attendee?.status?.response) continue;

        const responseStatus = attendee.status.response;
        const newStatus = mapOutlookResponseToStatus(responseStatus);

        // Only update if the status has changed and is not PENDING
        if (newStatus !== 'PENDING' && newStatus !== assignment.status) {
          await prisma.shiftAssignment.update({
            where: { id },
            data: {
              status: newStatus,
              respondedAt: new Date()
            }
          });

          // If the shift is refused, delete the Outlook event
          if (newStatus === 'REFUSED' && outlookEventId) {
            try {
              const deleteUrl = mailbox === 'me'
                ? `https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`
                : `https://graph.microsoft.com/v1.0/users/${mailbox}/events/${outlookEventId}`;
              await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${graphToken}`
                }
              });
            } catch {
              // Continue even if deletion fails
            }
          }

          // Create an audit log
          await prisma.auditLog.create({
            data: {
              action: 'UPDATE',
              entity: 'SHIFT_ASSIGNMENT',
              entityId: id,
              userId: auth.user.id,
              data: {
                source: 'outlook-sync',
                oldStatus: assignment.status,
                newStatus: newStatus,
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
    return NextResponse.json(
      { error: 'Synchronization failed' },
      { status: 500 }
    );
  }
}
