/**
 * 관리자 인증 모듈
 *
 * [기능]
 * - JWT 토큰 생성 및 검증
 * - 비밀번호 해시 및 검증 (bcryptjs 사용)
 * - 역할 기반 권한 관리 (super_admin, admin, operator)
 * - 세션 관리
 */

import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

// ============================================================================
// JWT 토큰 관리
// ============================================================================

/** JWT 페이로드 타입 */
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/** JWT 시크릿 키 (운영 환경에서는 환경변수 사용) */
const JWT_SECRET = process.env.JWT_SECRET || 'smart-library-admin-secret-key-2024';

/** 토큰 만료 시간 (24시간) */
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Base64URL 인코딩
 */
function base64UrlEncode(data: string): string {
  return Buffer.from(data).toString('base64url');
}

/**
 * Base64URL 디코딩
 */
function base64UrlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8');
}

/**
 * JWT 토큰 생성
 * HMAC-SHA256 알고리즘을 사용합니다.
 *
 * @param payload - 토큰에 포함할 데이터
 * @returns JWT 토큰 문자열
 */
export async function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Date.now();
  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + TOKEN_EXPIRY_MS,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(fullPayload));

  // Bun의 crypto를 사용한 HMAC-SHA256 서명
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${header}.${body}`)
  );
  const sig = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));

  return `${header}.${body}.${sig}`;
}

/**
 * JWT 토큰 검증
 *
 * @param token - 검증할 JWT 토큰
 * @returns 검증된 페이로드 또는 null
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts;

    // 서명 검증
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const expectedSig = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${header}.${body}`)
    );
    const expectedSigStr = base64UrlEncode(String.fromCharCode(...new Uint8Array(expectedSig)));

    if (sig !== expectedSigStr) return null;

    // 페이로드 디코딩
    const payload: TokenPayload = JSON.parse(base64UrlDecode(body));

    // 만료 확인
    if (payload.exp && Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

// ============================================================================
// 비밀번호 관리
// ============================================================================

/**
 * 비밀번호 해시 생성
 * bcryptjs를 사용하여 안전하게 해시합니다.
 *
 * @param password - 평문 비밀번호
 * @returns 해시된 비밀번호
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

/**
 * 비밀번호 검증
 * bcryptjs를 사용하여 해시된 비밀번호와 비교합니다.
 *
 * @param password - 평문 비밀번호
 * @param hash - 해시된 비밀번호
 * @returns 일치하면 true
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// ============================================================================
// 권한 관리
// ============================================================================

/** 역할 계층 구조 (높을수록 더 많은 권한) */
const ROLE_HIERARCHY: Record<string, number> = {
  operator: 1,
  admin: 2,
  super_admin: 3,
};

/** 역할별 허용 액션 정의 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'], // 모든 권한
  admin: [
    'content:read', 'content:write',
    'books:read', 'books:write',
    'users:read',
    'loans:read',
    'analytics:read',
    'audit:read',
    'settings:read', 'settings:write',
    'notifications:read', 'notifications:write',
    'kiosk-users:read',
  ],
  operator: [
    'content:read',
    'books:read',
    'users:read',
    'loans:read',
    'analytics:read',
    'audit:read',
    'settings:read',
    'notifications:read',
    'kiosk-users:read',
  ],
};

/**
 * 권한 확인
 *
 * @param role - 사용자 역할
 * @param permission - 확인할 권한 (예: 'content:write')
 * @returns 권한이 있으면 true
 */
export function hasPermission(role: string, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  // super_admin은 모든 권한 보유
  if (permissions.includes('*')) return true;

  return permissions.includes(permission);
}

/**
 * 역할 계층 비교
 *
 * @param userRole - 사용자 역할
 * @param requiredRole - 필요한 최소 역할
 * @returns 사용자가 필요한 역할 이상이면 true
 */
export function hasRoleLevel(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

// ============================================================================
// 세션 관리
// ============================================================================

/**
 * 세션 생성
 *
 * @param userId - 관리자 사용자 ID
 * @param token - JWT 토큰
 * @param ipAddress - 클라이언트 IP 주소
 * @param userAgent - 클라이언트 User-Agent
 */
export async function createSession(
  userId: string,
  token: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await db.adminSession.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
      ipAddress,
      userAgent,
    },
  });
}

/**
 * 세션 삭제
 *
 * @param token - 삭제할 세션의 토큰
 */
export async function deleteSession(token: string): Promise<void> {
  await db.adminSession.deleteMany({
    where: { token },
  });
}

/**
 * 만료된 세션 정리
 */
export async function cleanupExpiredSessions(): Promise<void> {
  await db.adminSession.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
}
