// app/api/outlook/sync/route.ts
// Server-side sync route that reads Outlook event responses using application permissions
// Uses /users/{mailbox}/events/{eventId} to read attendee responses

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';

// Get application-level access token using client credentials
async function getAppAccessToken(): Promise<string> {
  const clientId = process.env.AZURE_AD_CLIENT_ID!;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET!;
  const tenantId = process.env.AZURE_AD_TENANT_ID!;

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        scope: 'https://graph.microsoft.com/.default',
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      })
    }
  );

  if (!tokenResponse.ok) {
    throw new Error('Failed to get app access token');
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

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

    const accessToken = await getAppAccessToken();

    let updatedCount = 0;
    let errorCount = 0;

    for (const assignment of pendingAssignments) {
      try {
        const { outlookEventId, user, shift, id } = assignment;
        if (!outlookEventId) continue;

        // Use /users/{mailbox}/events/{eventId} with application permissions
        const mailbox = shift.senderMailbox || process.env.SYNC_ADMIN_EMAIL || 'me';
        const eventUrl = mailbox === 'me'
          ? `https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`
          : `https://graph.microsoft.com/v1.0/users/${mailbox}/events/${outlookEventId}`;

        const eventResponse = await fetch(eventUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
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
                  'Authorization': `Bearer ${accessToken}`
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
