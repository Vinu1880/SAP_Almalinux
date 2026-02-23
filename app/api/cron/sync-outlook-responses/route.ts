// app/api/cron/sync-outlook-responses/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { logSecurityEvent } from '@/lib/securityLogger';

// Get a valid access token
async function getAccessToken(): Promise<string> {
  const clientId = process.env.AZURE_AD_CLIENT_ID!;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET!;
  const tenantId = process.env.AZURE_AD_TENANT_ID!;
  const refreshToken = process.env.MICROSOFT_GRAPH_REFRESH_TOKEN;

  if (refreshToken) {
    // Use the refresh token to obtain a new access token
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          scope: 'https://graph.microsoft.com/.default',
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          client_secret: clientSecret
        })
      }
    );

    if (!tokenResponse.ok) {
      throw new Error('Failed to refresh token');
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } else {
    // Use Client Credentials (application permissions)
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
      throw new Error('Failed to get access token');
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  }
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

// POST - Synchronize Outlook responses
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || cronSecret === 'dev-secret-change-in-production') {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const expectedValue = `Bearer ${cronSecret}`;
    if (
      !authHeader ||
      authHeader.length !== expectedValue.length ||
      !crypto.timingSafeEqual(
        Buffer.from(authHeader, 'utf-8'),
        Buffer.from(expectedValue, 'utf-8')
      )
    ) {
      logSecurityEvent({
        type: 'CRON_AUTH_FAILURE',
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
        path: '/api/cron/sync-outlook-responses',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Retrieve all PENDING assignments with an outlookEventId
    const pendingAssignments = await prisma.shiftAssignment.findMany({
      where: {
        status: 'PENDING',
        outlookEventId: {
          not: null
        }
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

    const accessToken = await getAccessToken();

    let updatedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const assignment of pendingAssignments) {
      try {
        const { outlookEventId, user, shift, id } = assignment;

        if (!outlookEventId) {
          continue;
        }

        // Fetch event details from Microsoft Graph
        // IMPORTANT: Events are created in the creator's calendar (token owner)
        // so we always use /me/events
        const eventUrl = `https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`;

        const eventResponse = await fetch(eventUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!eventResponse.ok) {
          if (eventResponse.status === 404) {
            continue;
          }
          throw new Error(`Failed to fetch event: ${eventResponse.statusText}`);
        }

        const event = await eventResponse.json();

        // Find the user's response in the attendees
        const attendee = event.attendees?.find(
          (a: any) => a.emailAddress.address.toLowerCase() === user.email.toLowerCase()
        );

        if (!attendee) {
          continue;
        }

        if (!attendee.status) {
          continue;
        }

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

          // If the shift is refused, delete the Outlook event from the sender's calendar
          if (newStatus === 'REFUSED' && outlookEventId) {
            try {
              const deleteUrl = `https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`;
              const deleteResponse = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                }
              });

              if (!deleteResponse.ok && deleteResponse.status !== 204) {
                // Event deletion failed but we continue
              }
            } catch (deleteError) {
              // Continue even if deletion fails
            }
          }

          // Create an audit log
          await prisma.auditLog.create({
            data: {
              action: 'UPDATE',
              entity: 'SHIFT_ASSIGNMENT',
              entityId: id,
              userId: user.id,
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
          results.push({
            success: true,
            assignmentId: id,
            userEmail: user.email,
            shiftName: shift.name,
            oldStatus: assignment.status,
            newStatus: newStatus,
            outlookResponse: responseStatus,
            outlookEventDeleted: newStatus === 'REFUSED'
          });
        }

      } catch (error) {
        errorCount++;
        results.push({
          success: false,
          assignmentId: assignment.id,
          userEmail: assignment.user.email,
          error: 'Failed to process assignment'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Synchronization completed',
      checked: pendingAssignments.length,
      updated: updatedCount,
      errors: errorCount,
      results
    });

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Synchronization failed'
      },
      { status: 500 }
    );
  }
}

// GET - Check synchronization status
export async function GET(request: NextRequest) {
  try {
    const pendingCount = await prisma.shiftAssignment.count({
      where: {
        status: 'PENDING',
        outlookEventId: {
          not: null
        }
      }
    });

    const recentSyncLogs = await prisma.auditLog.findMany({
      where: {
        entity: 'SHIFT_ASSIGNMENT',
        action: 'UPDATE',
        data: {
          path: ['source'],
          equals: 'outlook-sync'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    return NextResponse.json({
      pendingAssignments: pendingCount,
      recentSyncs: recentSyncLogs.length,
      lastSync: recentSyncLogs[0]?.createdAt || null
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to check sync status'
      },
      { status: 500 }
    );
  }
}
