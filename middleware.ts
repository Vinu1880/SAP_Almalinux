import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { logSecurityEvent } from './lib/securityLogger';

const intlMiddleware = createMiddleware(routing);

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_URL || '',
  'https://sap.lab.sr.bnc.ch:8443',
  'https://sap.lab.sr.bnc.ch',
  'http://localhost:3000',
].filter(Boolean);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // Same-origin requests have no Origin header
  return ALLOWED_ORIGINS.includes(origin);
}

function addCorsHeaders(response: NextResponse, origin: string | null) {
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
  response.headers.set('Vary', 'Origin');
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS for API routes
  if (pathname.startsWith('/api')) {
    const origin = request.headers.get('origin');

    // Block requests from disallowed origins
    if (origin && !isAllowedOrigin(origin)) {
      logSecurityEvent({
        type: 'CORS_BLOCKED',
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined,
        path: pathname,
        details: `origin=${origin}`,
      });
      return new NextResponse(null, { status: 403 });
    }

    // Handle preflight OPTIONS requests
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });
      addCorsHeaders(response, origin);
      return response;
    }

    // For other API requests, add CORS headers to the response
    const response = NextResponse.next();
    addCorsHeaders(response, origin);
    return response;
  }

  // i18n middleware for non-API routes
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match API routes for CORS + all non-static paths for i18n
    '/api/:path*',
    '/((?!_next|_vercel|.*\\..*).*)'
  ]
};
