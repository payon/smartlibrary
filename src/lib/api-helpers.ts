import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken, type TokenPayload } from '@/lib/admin-auth';

// ============================================================================
// Security headers (no HSTS here; HSTS only in production middleware)
// ============================================================================

export function securityHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      'img-src \'self\' data: blob: https://images.unsplash.com',
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()'].join(', '),
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
}

export function json(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      ...securityHeaders(),
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

// ============================================================================
// Secure random generators (crypto.getRandomValues)
// ============================================================================

function isTrivialPin(pin: string): boolean {
  if (/^(.)\1{3}$/.test(pin)) return true;
  const d = pin.split('').map(Number);
  const up = d[1] - d[0] === 1 && d[2] - d[1] === 1 && d[3] - d[2] === 1;
  const down = d[1] - d[0] === -1 && d[2] - d[1] === -1 && d[3] - d[2] === -1;
  return up || down;
}

export function secureRandomPin(existing: Set<string>): string {
  for (let i = 0; i < 1000; i++) {
    const buf = new Uint16Array(1);
    crypto.getRandomValues(buf);
    const pin = String(buf[0] % 10000).padStart(4, '0');
    if (isTrivialPin(pin)) continue;
    if (existing.has(pin)) continue;
    return pin;
  }
  throw new Error('Failed to generate secure PIN');
}

export function secureCardNumber(): string {
  const buf = new Uint16Array(1);
  crypto.getRandomValues(buf);
  const suffix = String(buf[0] % 10000).padStart(4, '0');
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `LIB-${y}${m}${d}-${suffix}`;
}

// ============================================================================
// Admin auth guard
// ============================================================================

type RequireAdminSuccess = {
  payload: TokenPayload;
  user: { id: string; email: string; role: string; isActive: boolean };
};

type RequireAdminFailure = { error: string; status: number };

export async function requireAdmin(
  request: NextRequest,
  permission?: string
): Promise<RequireAdminSuccess | RequireAdminFailure> {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return { error: '인증이 필요합니다.', status: 401 };

  const payload = await verifyToken(token);
  if (!payload) return { error: '유효하지 않은 토큰입니다.', status: 401 };

  const session = await db.adminSession.findFirst({
    where: { token, expiresAt: { gt: new Date() } },
  });
  if (!session) return { error: '유효하지 않은 토큰입니다.', status: 401 };

  const user = await db.adminUser.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive) return { error: '유효하지 않은 토큰입니다.', status: 401 };

  if (permission && !hasPermission(user.role ?? payload.role, permission)) {
    return { error: '권한이 없습니다.', status: 403 };
  }

  return {
    payload,
    user: { id: user.id, email: user.email, role: user.role, isActive: user.isActive },
  };
}
