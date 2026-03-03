// lib/auth.ts - Azure AD token validation with local JWKS + cache
import { NextRequest, NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { logSecurityEvent } from './securityLogger';

export interface AuthUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

// JWKS setup (jose handles caching and key rotation automatically)
const tenantId = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID || process.env.AZURE_AD_TENANT_ID;
const clientId = process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID;
const JWKS_URI = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
const ISSUER = `https://login.microsoftonline.com/${tenantId}/v2.0`;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJWKS() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(JWKS_URI));
  }
  return jwks;
}

// In-memory token validation cache
interface CachedAuth {
  user: AuthUser;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedAuth>();
const CACHE_MARGIN_MS = 60_000;

// Periodic cleanup
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of tokenCache) {
      if (now > entry.expiresAt) {
        tokenCache.delete(key);
      }
    }
  }, 60_000);
}

/**
 * Validates an Azure AD token using local JWKS validation with Graph API fallback.
 * Caches validated tokens to avoid repeated crypto operations.
 */
async function validateToken(request: NextRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  if (!token) return null;

  // Check cache first
  const cached = tokenCache.get(token);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.user;
  }

  // Try local JWT validation with JWKS
  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: ISSUER,
      audience: clientId,
    });

    const user: AuthUser = {
      id: (payload.oid as string) || (payload.sub as string) || '',
      displayName: (payload.name as string) || '',
      mail: (payload.preferred_username as string) || (payload.email as string) || '',
      userPrincipalName: (payload.upn as string) || (payload.preferred_username as string) || '',
    };

    if (!user.id) return null;

    const exp = payload.exp ? payload.exp * 1000 : Date.now() + 3600_000;
    tokenCache.set(token, { user, expiresAt: exp - CACHE_MARGIN_MS });
    return user;
  } catch (jwksErr) {
    // Fallback to Graph API validation (handles Graph API access tokens)
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.error(`[Auth] JWKS failed: ${(jwksErr as Error)?.message} | Graph /me fallback: ${response.status}`);
        return null;
      }

      const profile = await response.json();
      const user: AuthUser = {
        id: profile.id,
        displayName: profile.displayName,
        mail: profile.mail || profile.userPrincipalName,
        userPrincipalName: profile.userPrincipalName,
      };

      tokenCache.set(token, { user, expiresAt: Date.now() + 5 * 60_000 });
      return user;
    } catch (graphErr) {
      console.error(`[Auth] JWKS: ${(jwksErr as Error)?.message} | Graph /me error: ${(graphErr as Error)?.message}`);
      return null;
    }
  }
}

/**
 * Middleware function to protect API routes.
 * Returns a 401 response if the token is invalid, or the user object if valid.
 */
export async function requireAuth(request: NextRequest): Promise<{ user: AuthUser } | NextResponse> {
  const user = await validateToken(request);

  if (!user) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || undefined;
    logSecurityEvent({
      type: 'AUTH_FAILURE',
      ip,
      path: request.nextUrl.pathname,
    });
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return { user };
}
