// lib/rateLimit.ts - In-memory sliding window rate limiter
import { NextResponse } from 'next/server';
import { logSecurityEvent } from './securityLogger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, 60_000);
}

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): NextResponse | null {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now > entry.resetAt) {
    store.set(identifier, {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    });
    return null;
  }

  entry.count++;

  if (entry.count > config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    logSecurityEvent({
      type: 'RATE_LIMIT_HIT',
      ip: identifier,
      details: `limit=${config.limit}/${config.windowSeconds}s count=${entry.count}`,
    });
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  return null;
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : (request.headers.get('x-real-ip') || 'unknown');
  // Include pathname so rate limits are per-route, not shared across all APIs
  const url = new URL(request.url);
  return `${ip}:${url.pathname}`;
}

// Pre-configured rate limit profiles
export const RATE_LIMITS = {
  standard: { limit: 100, windowSeconds: 60 } as RateLimitConfig,
  write: { limit: 30, windowSeconds: 60 } as RateLimitConfig,
  backup: { limit: 5, windowSeconds: 60 } as RateLimitConfig,
  restore: { limit: 2, windowSeconds: 300 } as RateLimitConfig,
};
