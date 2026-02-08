// app/api/webhooks/microsoft-graph/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Validation du webhook Microsoft Graph
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const validationToken = searchParams.get('validationToken');

    if (validationToken) {
      // Microsoft Graph envoie un token de validation lors de la création du webhook
      console.log('Webhook validation requested');
      return new NextResponse(validationToken, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    return NextResponse.json({ error: 'No validation token provided' }, { status: 400 });
  } catch (error) {
    console.error('Error validating webhook:', error);
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}

// POST - Recevoir les notifications du webhook Microsoft Graph
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { value } = body;

    if (!value || !Array.isArray(value)) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    console.log(`Received ${value.length} notification(s) from Microsoft Graph`);

    // Traiter chaque notification
    for (const notification of value) {
      const { changeType, resourceData, resource } = notification;

      // Ignorer les notifications qui ne sont pas liées aux événements
      if (!resource || !resource.includes('/events/')) {
        continue;
      }

      console.log(`Processing notification: ${changeType} for ${resource}`);

      // Extraire l'ID de l'événement depuis l'URL de la ressource
      const eventIdMatch = resource.match(/events\/([^\/]+)/);
      if (!eventIdMatch) {
        console.warn('Could not extract event ID from resource URL:', resource);
        continue;
      }

      const eventId = eventIdMatch[1];

      // Trouver l'assignation correspondante dans la base de données
      const assignment = await prisma.shiftAssignment.findFirst({
        where: { outlookEventId: eventId },
        include: {
          user: true,
          shift: true
        }
      });

      if (!assignment) {
        console.warn(`No assignment found for Outlook event ID: ${eventId}`);
        continue;
      }

      // Si l'événement a été modifié ou mis à jour
      if (changeType === 'updated' || changeType === 'created') {
        try {
          // Récupérer les détails de l'événement depuis Microsoft Graph
          // Note: Vous devrez récupérer et stocker le token d'accès de manière sécurisée
          // Pour l'instant, on va traiter les données du resourceData si disponibles

          if (resourceData && resourceData.responseStatus) {
            const responseStatus = resourceData.responseStatus.response;
            let newStatus: 'PENDING' | 'ACCEPTED' | 'REFUSED' = 'PENDING';

            // Mapper les réponses Outlook vers nos statuts
            if (responseStatus === 'accepted' || responseStatus === 'tentativelyAccepted') {
              newStatus = 'ACCEPTED';
            } else if (responseStatus === 'declined') {
              newStatus = 'REFUSED';
            }

            // Mettre à jour le statut si changé
            if (newStatus !== assignment.status && newStatus !== 'PENDING') {
              await prisma.shiftAssignment.update({
                where: { id: assignment.id },
                data: {
                  status: newStatus,
                  respondedAt: new Date()
                }
              });

              // Créer un log d'audit
              await prisma.auditLog.create({
                data: {
                  action: newStatus === 'ACCEPTED' ? 'ACCEPT' : 'REFUSE',
                  entity: 'SHIFT_ASSIGNMENT',
                  entityId: assignment.id,
                  userId: assignment.userId,
                  data: {
                    source: 'webhook',
                    outlookEventId: eventId,
                    responseStatus
                  }
                }
              });

              console.log(`✓ Updated assignment ${assignment.id} to ${newStatus} via webhook`);
            }
          }
        } catch (error) {
          console.error(`Error processing event ${eventId}:`, error);
        }
      }

      // Si l'événement a été supprimé
      if (changeType === 'deleted') {
        // Optionnel: marquer l'assignation comme annulée
        await prisma.shiftAssignment.update({
          where: { id: assignment.id },
          data: {
            status: 'CANCELLED',
            reason: 'Event deleted from Outlook calendar'
          }
        });

        console.log(`✓ Cancelled assignment ${assignment.id} (event deleted)`);
      }
    }

    // Microsoft Graph attend une réponse 202 Accepted
    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error) {
    console.error('Error processing webhook notification:', error);
    // Toujours retourner 202 pour éviter que Microsoft Graph réessaye
    return NextResponse.json({ error: 'Processing error' }, { status: 202 });
  }
}
