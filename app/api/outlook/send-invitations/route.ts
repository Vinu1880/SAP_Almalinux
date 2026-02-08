// app/api/outlook/send-invitations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Fonction pour obtenir un access token valide
async function getAccessToken(): Promise<string> {
  // Option 1: Utiliser un refresh token stocké en base de données
  // Option 2: Utiliser un service principal Azure (Client Credentials)

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

// POST - Envoyer les invitations Outlook
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { assignments } = body; // Array des assignations avec user et shift

    if (!assignments || !Array.isArray(assignments)) {
      return NextResponse.json(
        { error: 'Invalid assignments data' },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    for (const assignment of assignments) {
      try {
        const { user, shift, date, assignmentId, isPikett } = assignment;

        const shiftStartTime = shift.startTime || '00:00';
        const shiftEndTime = shift.endTime || '23:59';

        const [startHour, startMinute] = shiftStartTime.split(':');
        const [endHour, endMinute] = shiftEndTime.split(':');

        const startDateTime = new Date(date);
        startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0);

        const endDateTime = new Date(date);
        endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0);

        // Si le shift se termine après minuit, ajouter 1 jour
        if (endDateTime <= startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }

        const event = {
          subject: `${shift.name}${isPikett ? ' 🛡️ PIKETT' : ''}`,
          body: {
            contentType: 'HTML',
            content: `
              <h2>${shift.name}</h2>
              <p><strong>Date:</strong> ${new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p><strong>Horaires:</strong> ${shiftStartTime} - ${shiftEndTime}</p>
              ${shift.description ? `<p><strong>Description:</strong> ${shift.description}</p>` : ''}
              ${isPikett ? '<p><strong>⚠️ PIKETT - Astreinte 24/7</strong></p>' : ''}
              <hr>
              <p><em>Cette invitation a été générée automatiquement par le système de planification.</em></p>
            `
          },
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: 'Europe/Zurich'
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: 'Europe/Zurich'
          },
          attendees: [
            {
              emailAddress: {
                address: user.email,
                name: user.displayName || `${user.firstName} ${user.lastName}`
              },
              type: 'required'
            }
          ],
          location: {
            displayName: shift.location || user.location || 'Non spécifié'
          },
          isReminderOn: true,
          reminderMinutesBeforeStart: 1440, // 24h avant
          responseRequested: true,
          allowNewTimeProposals: false,
          showAs: isPikett ? 'oof' : 'busy',
          categories: [
            isPikett ? 'PIKETT' : 'Shift',
            shift.name
          ]
        };

        // Créer l'événement dans Outlook
        const outlookResponse = await fetch('https://graph.microsoft.com/v1.0/me/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(event)
        });

        if (outlookResponse.ok) {
          const createdEvent = await outlookResponse.json();
          successCount++;

          // Mettre à jour l'assignation avec l'outlookEventId
          if (assignmentId) {
            await prisma.shiftAssignment.update({
              where: { id: assignmentId },
              data: { outlookEventId: createdEvent.id }
            });
          }

          results.push({
            success: true,
            userEmail: user.email,
            shiftName: shift.name,
            date,
            outlookEventId: createdEvent.id
          });
        } else {
          const error = await outlookResponse.json();
          errorCount++;
          results.push({
            success: false,
            userEmail: user.email,
            shiftName: shift.name,
            date,
            error: error.error?.message || 'Unknown error'
          });
        }
      } catch (error) {
        errorCount++;
        results.push({
          success: false,
          userEmail: assignment.user?.email,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      successCount,
      errorCount,
      results
    });
  } catch (error) {
    console.error('Error sending Outlook invitations:', error);
    return NextResponse.json(
      {
        error: 'Failed to send invitations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
