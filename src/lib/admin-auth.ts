/**
 * 관리자 인증 모듈
 *
 * [기능]
 * - JWT 토큰 생성 및 검증 (jose 사용, HS256)
 * - 비밀번호 해시 및 검증 (bcryptjs 사용)
 * - 역할 기반 권한 관리 (super_admin, admin, operator)
 * - 세션 관리
 */

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { db } from '@/lib/db';
import { ROLE_HIERARCHY, ROLE_PERMISSIONS } from '@/lib/permissions';

// ============================================================================
// JWT 토큰 관리
// ============================================================================

/** JWT 시크릿 키 — 런타임에 해석 (빌드 시점 강제 종료 방지) */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || '';
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[SECURITY] JWT_SECRET 환경변수가 설정되지 않았습니다. .env에 JWT_SECRET를 추가하세요.'
      );
    }
    console.warn('[SECURITY] JWT_SECRET이 설정되지 않았습니다. 개발용 기본값을 사용합니다.');
    return 'dev-only-insecure-jwt-secret-do-not-use-in-prod';
  }
  return secret;
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

/** JWT 페이로드 타입 */
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/** 토큰 만료 시간 (24시간, 초 단위) */
const TOKEN_EXPIRY_SECONDS = 24 * 60 * 60;

/**
 * JWT 토큰 생성
 * jose SignJWT (HS256)를 사용합니다. iat/exp는 초 단위입니다.
 *
 * @param payload - 토큰에 포함할 데이터
 * @returns JWT 토큰 문자열
 */
export async function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_EXPIRY_SECONDS}s`)
    .sign(getSecretKey());
}

/**
 * JWT 토큰 검증
 *
 * @param token - 검증할 JWT 토큰
 * @returns 검증된 페이로드 또는 null
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.userId !== 'string' || typeof payload.email !== 'string' || typeof payload.role !== 'string') {
      return null;
    }
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
      iat: typeof payload.iat === 'number' ? payload.iat : undefined,
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    };
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
 * 관리자 비밀번호 복잡도 검증 (8자 이상 + 4종 중 3종)
 * @returns 오류 메시지 또는 null (정상)
 */
export function validateAdminPassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return '비밀번호는 8자 이상이어야 합니다.';
  }
  if (password.length > 128) {
    return '비밀번호는 128자를 초과할 수 없습니다.';
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const kinds = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
  if (kinds < 3) {
    return '비밀번호는 대문자, 소문자, 숫자, 특수문자 중 3가지 이상을 포함해야 합니다.';
  }
  return null;
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
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_SECONDS * 1000),
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
