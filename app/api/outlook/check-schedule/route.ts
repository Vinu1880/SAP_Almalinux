// app/api/outlook/check-schedule/route.ts
// Server-side route that checks user schedules using application permissions
// Returns a map of email -> availability status (oof/busy/free)

import { NextRequest, NextResponse } from 'next/server';
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

// POST - Check schedule availability for a list of users on a specific date
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

  try {
    const body = await request.json();
    const { emails, date } = body;

    if (!emails || !Array.isArray(emails) || !date) {
      return NextResponse.json(
        { error: 'Missing emails array or date' },
        { status: 400 }
      );
    }

    const accessToken = await getAppAccessToken();

    // Use a service account or any user mailbox to call getSchedule with app permissions
    // With application permissions, we use /users/{id}/calendar/getSchedule
    const adminEmail = process.env.SYNC_ADMIN_EMAIL;
    if (!adminEmail) {
      return NextResponse.json(
        { error: 'SYNC_ADMIN_EMAIL not configured' },
        { status: 500 }
      );
    }

    const unavailableMap: Record<string, string> = {};

    // Process in batches of 20 (Graph API limit)
    const batchSize = 20;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      const scheduleResponse = await fetch(
        `https://graph.microsoft.com/v1.0/users/${adminEmail}/calendar/getSchedule`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'outlook.timezone="Europe/Zurich"'
          },
          body: JSON.stringify({
            schedules: batch,
            startTime: {
              dateTime: date + 'T00:00:00',
              timeZone: 'Europe/Zurich'
            },
            endTime: {
              dateTime: date + 'T23:59:59',
              timeZone: 'Europe/Zurich'
            },
            availabilityViewInterval: 1440
          })
        }
      );

      if (!scheduleResponse.ok) {
        const errBody = await scheduleResponse.json().catch(() => ({}));
        continue;
      }

      const scheduleData = await scheduleResponse.json();

      if (!scheduleData.value) continue;

      for (const userSchedule of scheduleData.value) {
        const userEmail = (userSchedule.scheduleId || '').toLowerCase();

        // Method 1: Check availabilityView (most reliable)
        // Codes: 0=free, 1=tentative, 2=busy, 3=oof, 4=workingElsewhere
        if (userSchedule.availabilityView) {
          const viewCodes = userSchedule.availabilityView.split('');
          if (viewCodes.some((c: string) => c === '3')) {
            unavailableMap[userEmail] = 'oof';
            continue;
          }
          if (viewCodes.some((c: string) => c === '2')) {
            unavailableMap[userEmail] = 'busy';
            continue;
          }
        }

        // Method 2: Check scheduleItems as fallback
        if (userSchedule.scheduleItems) {
          for (const item of userSchedule.scheduleItems) {
            if (item.status === 'oof') {
              unavailableMap[userEmail] = 'oof';
              break;
            }
            if (item.status === 'busy') {
              unavailableMap[userEmail] = 'busy';
              break;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      unavailable: unavailableMap
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check schedules' },
      { status: 500 }
    );
  }
}
