// app/api/cron/sync-outlook-responses/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toJsonString } from '@/lib/json-helpers';

// Fonction pour obtenir un access token valide
async function getAccessToken(): Promise<string> {
  const clientId = process.env.AZURE_AD_CLIENT_ID!;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET!;
  const tenantId = process.env.AZURE_AD_TENANT_ID!;
  const refreshToken = process.env.MICROSOFT_GRAPH_REFRESH_TOKEN;

  if (refreshToken) {
    // Utiliser le refresh token pour obtenir un nouveau access token
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
    // Utiliser Client Credentials (application permissions)
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

// Mapper les réponses Outlook vers nos statuts
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

// POST - Synchroniser les réponses Outlook
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification (optionnel : ajouter un secret pour sécuriser)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[SYNC] Starting Outlook responses synchronization...');
    console.log('[SYNC] Using credentials:', {
      hasClientId: !!process.env.AZURE_AD_CLIENT_ID,
      hasClientSecret: !!process.env.AZURE_AD_CLIENT_SECRET,
      hasTenantId: !!process.env.AZURE_AD_TENANT_ID,
      hasRefreshToken: !!process.env.MICROSOFT_GRAPH_REFRESH_TOKEN
    });

    // Récupérer toutes les assignments PENDING avec un outlookEventId
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

    console.log(`[SYNC] Found ${pendingAssignments.length} pending assignments to check`);

    if (pendingAssignments.length > 0) {
      console.log('[SYNC] First assignment details:', {
        id: pendingAssignments[0].id,
        userEmail: pendingAssignments[0].user.email,
        shiftName: pendingAssignments[0].shift.name,
        outlookEventId: pendingAssignments[0].outlookEventId?.substring(0, 30) + '...'
      });
    }

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

        console.log(`[SYNC] Processing assignment ${id} for ${user.email}`);

        if (!outlookEventId) {
          console.log(`[SYNC] No outlookEventId for assignment ${id}, skipping`);
          continue;
        }

        // Récupérer les détails de l'événement depuis Microsoft Graph
        // IMPORTANT: Les événements sont créés dans le calendrier du créateur (token owner)
        // donc on utilise toujours /me/events
        const eventUrl = `https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`;

        console.log(`[SYNC] Fetching event from: ${eventUrl}`);

        const eventResponse = await fetch(eventUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`[SYNC] Event response status: ${eventResponse.status}`);

        if (!eventResponse.ok) {
          if (eventResponse.status === 404) {
            console.log(`[SYNC] Event not found for assignment ${id}, skipping...`);
            continue;
          }
          const errorText = await eventResponse.text();
          console.error(`[SYNC] Failed to fetch event: ${eventResponse.statusText}`, errorText);
          throw new Error(`Failed to fetch event: ${eventResponse.statusText}`);
        }

        const event = await eventResponse.json();
        console.log(`[SYNC] Event fetched successfully. Attendees count: ${event.attendees?.length || 0}`);

        // Trouver la réponse de l'utilisateur dans les attendees
        const attendee = event.attendees?.find(
          (a: any) => a.emailAddress.address.toLowerCase() === user.email.toLowerCase()
        );

        if (!attendee) {
          console.log(`[SYNC] No attendee found matching ${user.email} in event ${id}`);
          if (event.attendees) {
            console.log(`[SYNC] Available attendees:`, event.attendees.map((a: any) => a.emailAddress.address));
          }
          continue;
        }

        console.log(`[SYNC] Attendee found: ${attendee.emailAddress.address}`);
        console.log(`[SYNC] Attendee status:`, attendee.status);

        if (!attendee.status) {
          console.log(`[SYNC] No response status found for assignment ${id}`);
          continue;
        }

        const responseStatus = attendee.status.response;
        console.log(`[SYNC] Response status: ${responseStatus}`);

        const newStatus = mapOutlookResponseToStatus(responseStatus);
        console.log(`[SYNC] Mapped to: ${newStatus}`);

        // Ne mettre à jour que si le statut a changé et n'est pas PENDING
        if (newStatus !== 'PENDING' && newStatus !== assignment.status) {
          await prisma.shiftAssignment.update({
            where: { id },
            data: {
              status: newStatus,
              respondedAt: new Date()
            }
          });

          // Si le shift est refusé, supprimer l'événement Outlook du calendrier du sender
          if (newStatus === 'REFUSED' && outlookEventId) {
            try {
              console.log(`[SYNC] Shift refusé, suppression de l'événement Outlook ${outlookEventId}`);

              const deleteUrl = `https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`;
              const deleteResponse = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                }
              });

              if (deleteResponse.ok || deleteResponse.status === 204) {
                console.log(`[SYNC] ✅ Événement Outlook supprimé avec succès`);
              } else {
                const errorText = await deleteResponse.text();
                console.error(`[SYNC] ⚠️ Erreur lors de la suppression de l'événement: ${deleteResponse.status}`, errorText);
              }
            } catch (deleteError) {
              console.error(`[SYNC] ⚠️ Erreur lors de la suppression de l'événement Outlook:`, deleteError);
              // On continue même si la suppression échoue
            }
          }

          // Créer un audit log
          await prisma.auditLog.create({
            data: {
              action: 'UPDATE',
              entity: 'SHIFT_ASSIGNMENT',
              entityId: id,
              userId: user.id,
              data: toJsonString({
                source: 'outlook-sync',
                oldStatus: assignment.status,
                newStatus: newStatus,
                outlookResponse: responseStatus,
                outlookEventDeleted: newStatus === 'REFUSED'
              })
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

          console.log(`[SYNC] Updated assignment ${id}: ${assignment.status} -> ${newStatus}`);
        } else {
          console.log(`[SYNC] No change needed for assignment ${id} (response: ${responseStatus})`);
        }

      } catch (error) {
        errorCount++;
        console.error(`[SYNC] Error processing assignment ${assignment.id}:`, error);
        results.push({
          success: false,
          assignmentId: assignment.id,
          userEmail: assignment.user.email,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[SYNC] Synchronization completed: ${updatedCount} updated, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      message: 'Synchronization completed',
      checked: pendingAssignments.length,
      updated: updatedCount,
      errors: errorCount,
      results
    });

  } catch (error) {
    console.error('[SYNC] Error during synchronization:', error);
    return NextResponse.json(
      {
        error: 'Synchronization failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET - Vérifier le statut de la synchronisation
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
          contains: 'outlook-sync'
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
    console.error('[SYNC] Error checking sync status:', error);
    return NextResponse.json(
      {
        error: 'Failed to check sync status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
