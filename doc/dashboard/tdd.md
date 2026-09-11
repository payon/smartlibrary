# 스마트 도서관 키오스크 관리자 대시보드 — 기술 설계 문서 (TDD)

> **버전**: v1.0.0  
> **작성일**: 2026-03-05  
> **상태**: Production-ready  
> **담당**: Dashboard Architecture Team  
> **참조**: [PRD](./prd.md) · [API 명세](./api.md) · [DB 설계](./database.md) · [아키텍처](./architect.md) · [키오스크 TDD](../tdd.md)

---

## 목차

1. [기술 스택](#1-기술-스택)
2. [인증 설계](#2-인증-설계)
3. [CMS 설계](#3-cms-설계)
4. [실시간 동기화 설계](#4-실시간-동기화-설계)
5. [이미지 관리 설계](#5-이미지-관리-설계)
6. [반응형 설계](#6-반응형-설계)
7. [보안 설계](#7-보안-설계)
8. [성능 설계](#8-성능-설계)
9. [오류 처리 설계](#9-오류-처리-설계)
10. [배포 설계](#10-배포-설계)

---

## 1. 기술 스택

### 1.1 코어 프레임워크 (기존 프로젝트와 동일)

| 계층 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **Framework** | Next.js | 16 | App Router, SSR/CSR 하이브리드, API Routes |
| **UI Library** | React | 19 | 컴포넌트 렌더링, Server/Client Components |
| **Language** | TypeScript | 5 | 정적 타입 검증, 인터페이스 정의 |
| **Styling** | Tailwind CSS | 4 | Utility-first CSS, 반응형 브레이크포인트 |
| **Component** | shadcn/ui | latest | Radix UI 기반 접근성 준수 컴포넌트 |
| **State** | Zustand | 5 | 클라이언트 전역 상태 관리 (CMS 캐시, 인증 상태) |
| **ORM** | Prisma | 6 | SQLite 스키마 관리, 타입 안전 쿼리 |
| **Database** | SQLite | 3.x | WAL 모드, 로컬 단일 파일 DB |

### 1.2 관리자 대시보드 추가 의존성

| 패키지 | 버전 | 용도 | 설치 위치 |
|--------|------|------|------------|
| **bcrypt** | ^5.x | 비밀번호 해시 (salt rounds 12) | server-only |
| **jose** | ^5.x | JWT 발급/검증 (HS256, Edge Runtime 호환) | server-only |
| **formidable** | ^3.x | 멀티파트 파일 업로드 파싱 | server-only |
| **recharts** | ^2.x | 대시보드 통계 차트 (BarChart, LineChart, PieChart) | client-only |
| **@tanstack/react-query** | ^5.x | 서버 데이터 캐싱, stale/refetch 관리 | client-only |
| **zod** | ^4.x | API 입력 검증 스키마 | universal |
| **sharp** | ^0.34.x | 이미지 리사이징, 썸네일 생성, WebP 변환 | server-only |
| **dompurify** | ^3.x | SVG 업로드 시 XSS sanitize | server-only |

### 1.3 패키지 의존성 제약

```
bcrypt       → Node.js native addon (bun 호환 확인 필요)
jose         → Pure JS, Edge/Node/Bun 범용
formidable   → Node.js Stream 기반 (Next.js API Route 호환)
recharts     → Client bundle만, dynamic import로 code-split
sharp        → Node.js native addon (이미지 처리 전용)
```

### 1.4 TypeScript 구성

```jsonc
// tsconfig.json 추가 경로
{
  "compilerOptions": {
    "paths": {
      "@/admin/*": ["./src/app/admin/*"],
      "@/lib/admin/*": ["./src/lib/admin/*"],
      "@/stores/admin/*": ["./src/stores/admin/*"],
      "@/hooks/admin/*": ["./src/hooks/admin/*"]
    }
  }
}
```

### 1.5 디렉터리 구조

```
src/
├── app/
│   ├── admin/                          # 관리자 대시보드 라우트
│   │   ├── layout.tsx                  # AdminLayout (사이드바 + 인증 가드)
│   │   ├── page.tsx                    # 대시보드 홈 (통계)
│   │   ├── login/
│   │   │   └── page.tsx                # 로그인 페이지
│   │   ├── content/
│   │   │   └── page.tsx                # CMS 콘텐츠 편집
│   │   ├── books/
│   │   │   ├── page.tsx                # 도서 목록
│   │   │   └── [id]/
│   │   │       └── page.tsx            # 도서 상세/편집
│   │   ├── users/
│   │   │   ├── page.tsx                # 이용자 목록
│   │   │   └── [id]/
│   │   │       └── page.tsx            # 이용자 상세
│   │   ├── accounts/
│   │   │   └── page.tsx                # 관리자 계정 관리
│   │   ├── audit/
│   │   │   └── page.tsx                # 감사 로그
│   │   ├── notices/
│   │   │   └── page.tsx                # 공지 관리
│   │   └── settings/
│   │       └── page.tsx                # 시스템 설정
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts          # POST 로그인
│       │   ├── logout/route.ts         # POST 로그아웃
│       │   └── refresh/route.ts        # POST 토큰 갱신
│       ├── admin/
│       │   ├── cms/
│       │   │   ├── content/route.ts    # GET/PUT CMS 콘텐츠
│       │   │   └── upload/route.ts     # POST 이미지 업로드
│       │   ├── books/route.ts          # CRUD 도서
│       │   ├── users/route.ts          # CRUD 이용자
│       │   ├── accounts/route.ts       # CRUD 관리자 계정
│       │   ├── stats/route.ts          # GET 통계
│       │   ├── audit/route.ts          # GET 감사 로그
│       │   └── notices/route.ts        # CRUD 공지
│       └── cms/
│           └── content/route.ts        # GET 공개 CMS (키오스크용)
├── lib/
│   ├── admin/
│   │   ├── auth.ts                     # JWT 발급/검증, bcrypt 해시
│   │   ├── rbac.ts                     # RBAC 권한 매핑, 미들웨어
│   │   ├── cms-defaults.ts             # CMS 기본값 정의
│   │   ├── audit.ts                    # 감사 로그 기록 헬퍼
│   │   └── upload.ts                   # 파일 업로드, 검증, 저장
│   └── db.ts                           # Prisma 클라이언트 싱글톤
├── stores/
│   └── admin/
│       ├── useAuthStore.ts             # 인증 상태 (Zustand)
│       └── useCmsStore.ts              # CMS 콘텐츠 캐시 (Zustand)
├── hooks/
│   └── admin/
│       ├── useCmsContent.ts            # 단일 CMS 값 조회 훅
│       ├── useCmsPolling.ts            # 키오스크용 CMS 폴링 훅
│       ├── useAdminAuth.ts             # 관리자 인증 가드 훅
│       └── useDebounce.ts             # 디바운스 훅 (검색 입력)
├── components/
│   └── admin/
│       ├── AdminSidebar.tsx             # 사이드바 네비게이션
│       ├── AdminHeader.tsx              # 상단 헤더 (사용자 정보, 로그아웃)
│       ├── CmsFieldRenderer.tsx         # CMS 필드 타입별 렌더러
│       ├── ImageUploader.tsx            # 이미지 업로드 컴포넌트
│       ├── ColorPicker.tsx              # 컬러 피커
│       ├── StatsCard.tsx                # 통계 카드
│       ├── AuditLogTable.tsx            # 감사 로그 테이블
│       └── PermissionGuard.tsx          # 권한 가드 컴포넌트
└── types/
    └── admin.ts                        # 관리자 도메인 타입 정의
```

---

## 2. 인증 설계

### 2.1 인증 아키텍처 개요

관리자 대시보드는 **JWT 기반 stateless 인증**을 사용한다. Access Token은 단기 수명(15분)으로 API 요청 시 `Authorization` 헤더에 전달하고, Refresh Token은 장기 수명(7일)으로 `httpOnly` 쿠키에 저장하여 자동 갱신한다.

```
┌──────────┐  POST /api/auth/login  ┌───────────────────┐
│  Login   │ ──────────────────────►│  bcrypt.compare()  │
│  Page    │                        │  ↓                  │
│          │ ◄────────────────────  │  signAccessToken()  │
│          │  Set-Cookie: refresh   │  signRefreshToken() │
└──────────┘                        └───────────────────┘
     │
     ▼  모든 /api/admin/* 요청
┌──────────────────────────────────────────────────────────┐
│  Authorization: Bearer <accessToken>                     │
│  → verifyJwt() → decode role → checkPermission() → 401/403/next │
└──────────────────────────────────────────────────────────┘
     │ accessToken 만료 (15분)
     ▼
┌──────────┐  POST /api/auth/refresh  ┌───────────────────┐
│  Client  │ ────────────────────────►│  verifyRefresh()   │
│  (자동)  │  Cookie: refreshToken    │  ↓                  │
│          │ ◄──────────────────────  │  signAccessToken()  │
│          │  { accessToken }         │  rotateRefresh()    │
└──────────┘                          └───────────────────┘
```

### 2.2 TypeScript 인터페이스

```typescript
// src/types/admin.ts

/** 관리자 역할 */
export type AdminRole = 'super_admin' | 'admin' | 'operator';

/** JWT Access Token 페이로드 */
export interface AccessTokenPayload {
  sub: string;          // AdminUser.id
  email: string;
  role: AdminRole;
  permissions: string[];  // 미리 계산된 권한 목록
  iat: number;
  exp: number;
}

/** JWT Refresh Token 페이로드 */
export interface RefreshTokenPayload {
  sub: string;          // AdminUser.id
  tokenVersion: number; // 토큰 버전 (강제 무효화용)
  iat: number;
  exp: number;
}

/** 로그인 요청 */
export interface LoginRequest {
  email: string;
  password: string;
}

/** 로그인 응답 */
export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: AdminRole;
    permissions: string[];
  };
}

/** 토큰 갱신 응답 */
export interface RefreshResponse {
  accessToken: string;
}

/** 인증 에러 코드 */
export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_INACTIVE'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'REFRESH_TOKEN_INVALID'
  | 'PERMISSION_DENIED';
```

### 2.3 비밀번호 해시 설계

```typescript
// src/lib/admin/auth.ts

import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/** 비밀번호 해시 생성 (관리자 계정 생성/수정 시) */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/** 비밀번호 검증 (로그인 시) */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/** 비밀번호 정책 검증 */
export function validatePasswordPolicy(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('비밀번호는 8자 이상이어야 합니다.');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('소문자를 포함해야 합니다.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('대문자를 포함해야 합니다.');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('숫자를 포함해야 합니다.');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('특수문자를 포함해야 합니다.');
  }

  return { valid: errors.length === 0, errors };
}
```

### 2.4 JWT 발급 및 검증

```typescript
// src/lib/admin/auth.ts (계속)

import { SignJWT, jwtVerify } from 'jose';

const ACCESS_TOKEN_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET!  // 최소 32바이트 랜덤 문자열
);
const REFRESH_TOKEN_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET! // 최소 32바이트 랜덤 문자열
);

const ACCESS_TOKEN_TTL = '15m';   // 15분
const REFRESH_TOKEN_TTL = '7d';   // 7일

/** Access Token 발급 */
export async function signAccessToken(
  payload: Omit<AccessTokenPayload, 'iat' | 'exp'>
): Promise<string> {
  return new SignJWT({
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
    permissions: payload.permissions,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .setIssuer('smart-library-admin')
    .setAudience('admin-api')
    .sign(ACCESS_TOKEN_SECRET);
}

/** Refresh Token 발급 */
export async function signRefreshToken(
  payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>
): Promise<string> {
  return new SignJWT({
    sub: payload.sub,
    tokenVersion: payload.tokenVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .setIssuer('smart-library-admin')
    .setAudience('admin-refresh')
    .sign(REFRESH_TOKEN_SECRET);
}

/** Access Token 검증 */
export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, ACCESS_TOKEN_SECRET, {
    issuer: 'smart-library-admin',
    audience: 'admin-api',
  });
  return payload as unknown as AccessTokenPayload;
}

/** Refresh Token 검증 */
export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, REFRESH_TOKEN_SECRET, {
    issuer: 'smart-library-admin',
    audience: 'admin-refresh',
  });
  return payload as unknown as RefreshTokenPayload;
}
```

### 2.5 Refresh Token 쿠키 설정

```typescript
// src/lib/admin/auth.ts (계속)

import { cookies } from 'next/headers';

/** Refresh Token을 httpOnly 쿠키로 설정 */
export function setRefreshTokenCookie(token: string): void {
  cookies().set('refresh_token', token, {
    httpOnly: true,        // JS 접근 불가 (XSS 방어)
    secure: process.env.NODE_ENV === 'production',  // HTTPS 전용 (개발은 제외)
    sameSite: 'strict',   // CSRF 방어
    path: '/api/auth',    // /api/auth 경로에서만 전송
    maxAge: 7 * 24 * 60 * 60,  // 7일 (초)
  });
}

/** Refresh Token 쿠키 삭제 (로그아웃) */
export function clearRefreshTokenCookie(): void {
  cookies().delete('refresh_token');
}
```

### 2.6 Token 갱신 흐름

```typescript
// src/app/api/auth/refresh/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from '@/lib/admin/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // 1. 쿠키에서 Refresh Token 추출
    const refreshToken = request.cookies.get('refresh_token')?.value;
    if (!refreshToken) {
      return NextResponse.json(
        { error: { code: 'REFRESH_TOKEN_INVALID', message: 'Refresh token이 없습니다.' } },
        { status: 401 }
      );
    }

    // 2. Refresh Token 검증
    const payload = await verifyRefreshToken(refreshToken);

    // 3. DB에서 관리자 정보 조회 (토큰 버전 확인)
    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });

    if (!admin || !admin.isActive) {
      clearRefreshTokenCookie();
      return NextResponse.json(
        { error: { code: 'ACCOUNT_INACTIVE', message: '비활성화된 계정입니다.' } },
        { status: 401 }
      );
    }

    // 4. 토큰 버전 불일치 → 강제 로그아웃
    if (admin.tokenVersion !== payload.tokenVersion) {
      clearRefreshTokenCookie();
      return NextResponse.json(
        { error: { code: 'REFRESH_TOKEN_INVALID', message: '토큰이 무효화되었습니다.' } },
        { status: 401 }
      );
    }

    // 5. 새 Access Token 발급
    const permissions = getPermissionsForRole(admin.role);
    const accessToken = await signAccessToken({
      sub: admin.id,
      email: admin.email,
      role: admin.role as AdminRole,
      permissions,
    });

    // 6. Refresh Token Rotation (새 Refresh Token 발급)
    const newRefreshToken = await signRefreshToken({
      sub: admin.id,
      tokenVersion: admin.tokenVersion,
    });
    setRefreshTokenCookie(newRefreshToken);

    // 7. 응답
    return NextResponse.json({
      accessToken,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions,
      },
    });
  } catch {
    clearRefreshTokenCookie();
    return NextResponse.json(
      { error: { code: 'TOKEN_INVALID', message: '토큰 검증에 실패했습니다.' } },
      { status: 401 }
    );
  }
}
```

### 2.7 RBAC 미들웨어

```typescript
// src/lib/admin/rbac.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, AccessTokenPayload, AdminRole } from './auth';

// ─── 권한 정의 ───────────────────────────────────────────

/** 시스템 내 모든 권한 식별자 */
export type Permission =
  | 'cms:read'           | 'cms:write'
  | 'books:read'         | 'books:write'
  | 'users:read'         | 'users:write'
  | 'accounts:read'      | 'accounts:write'
  | 'stats:read'         | 'stats:export'
  | 'audit:read'         | 'audit:export'
  | 'notices:read'       | 'notices:write'
  | 'settings:read'      | 'settings:write';

/** 역할별 권한 매핑 (PRD 4.2 기준) */
const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: [
    'cms:read', 'cms:write',
    'books:read', 'books:write',
    'users:read', 'users:write',
    'accounts:read', 'accounts:write',
    'stats:read', 'stats:export',
    'audit:read', 'audit:export',
    'notices:read', 'notices:write',
    'settings:read', 'settings:write',
  ],
  admin: [
    'cms:read', 'cms:write',
    'books:read', 'books:write',
    'users:read', 'users:write',
    'stats:read', 'stats:export',
    'audit:read',
    'notices:read', 'notices:write',
    'settings:read',
  ],
  operator: [
    'cms:read',
    'books:read',
    'users:read',
    'stats:read',
    'notices:read',
  ],
};

/** 역할에 해당하는 권한 목록 반환 */
export function getPermissionsForRole(role: AdminRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** 특정 권한 보유 여부 확인 */
export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// ─── API Route 보호 미들웨어 ─────────────────────────────

type HandlerFn = (request: NextRequest, context: any) => Promise<NextResponse>;

/** 관리자 인증 + 권한 검사 래퍼 */
export function withAdminAuth(
  handler: HandlerFn,
  requiredPermission: Permission
): HandlerFn {
  return async (request: NextRequest, context: any) => {
    try {
      // 1. Authorization 헤더에서 Bearer 토큰 추출
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: { code: 'TOKEN_INVALID', message: '인증 토큰이 필요합니다.' } },
          { status: 401 }
        );
      }

      const token = authHeader.slice(7);

      // 2. Access Token 검증
      const payload: AccessTokenPayload = await verifyAccessToken(token);

      // 3. 권한 확인
      if (!payload.permissions.includes(requiredPermission)) {
        return NextResponse.json(
          { error: { code: 'PERMISSION_DENIED', message: '접근 권한이 없습니다.' } },
          { status: 403 }
        );
      }

      // 4. 핸들러 실행 (페이로드를 context에 주입)
      return handler(request, { ...context, auth: payload });
    } catch (error) {
      // 토큰 만료 또는 무효
      if (error instanceof Error && error.name === 'JWTExpired') {
        return NextResponse.json(
          { error: { code: 'TOKEN_EXPIRED', message: '액세스 토큰이 만료되었습니다.' } },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: { code: 'TOKEN_INVALID', message: '토큰 검증에 실패했습니다.' } },
        { status: 401 }
      );
    }
  };
}
```

### 2.8 클라이언트 인증 상태 관리 (Zustand)

```typescript
// src/stores/admin/useAuthStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AdminRole } from '@/types/admin';

interface AuthState {
  // 상태
  isAuthenticated: boolean;
  accessToken: string | null;
  user: {
    id: string;
    email: string;
    name: string;
    role: AdminRole;
    permissions: string[];
  } | null;

  // 액션
  setAuth: (accessToken: string, user: AuthState['user']) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      accessToken: null,
      user: null,

      setAuth: (accessToken, user) =>
        set({ isAuthenticated: true, accessToken, user }),

      setAccessToken: (token) =>
        set({ accessToken: token }),

      logout: () =>
        set({ isAuthenticated: false, accessToken: null, user: null }),

      hasPermission: (permission) =>
        get().user?.permissions.includes(permission) ?? false,
    }),
    {
      name: 'admin-auth',
      partialize: (state) => ({
        // accessToken은 메모리에만 저장 (persist 제외)
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    }
  )
);
```

### 2.9 클라이언트 자동 Token 갱신 인터셉터

```typescript
// src/lib/admin/api-client.ts

let refreshPromise: Promise<string> | null = null;

/** 만료된 Access Token을 자동 갱신하는 fetch 래퍼 */
export async function adminFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const { accessToken, setAccessToken } = useAuthStore.getState();

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);

  let response = await fetch(url, { ...options, headers });

  // 401 → 자동 갱신 시도
  if (response.status === 401) {
    const body = await response.json();
    if (body.error?.code === 'TOKEN_EXPIRED') {
      // 동시 요청 시 갱신 중복 방지
      const newToken = await (refreshPromise ??= refreshToken());
      refreshPromise = null;

      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(url, { ...options, headers });
    }
  }

  if (!response.ok) {
    const error = await response.json();
    throw new AdminApiError(response.status, error.error?.code, error.error?.message);
  }

  return response.json();
}

/** Refresh Token으로 새 Access Token 발급 */
async function refreshToken(): Promise<string> {
  const res = await fetch('/api/auth/refresh', { method: 'POST' });
  if (!res.ok) {
    useAuthStore.getState().logout();
    window.location.href = '/admin/login';
    throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
  }
  const data = await res.json();
  useAuthStore.getState().setAccessToken(data.accessToken);
  return data.accessToken;
}

/** 관리자 API 에러 클래스 */
export class AdminApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}
```

---

## 3. CMS 설계

### 3.1 Key-Value 콘텐츠 관리 아키텍처

CMS 콘텐츠는 **Key-Value 패턴**으로 관리한다. 각 화면의 텍스트·이미지·색상·규칙이 `CmsContent` 테이블의 개별 레코드로 저장되며, `key` 값(예: `"idle.title_text"`)으로 프론트엔드가 조회한다. DB에 값이 없으면 코드에 정의된 기본값(`constants.ts`)을 사용한다.

```
┌────────────────────┐         ┌──────────────────────────────┐
│  constants.ts      │         │  CmsContent (SQLite)          │
│  (코드 기본값)      │         │  key → value (JSON string)    │
│                    │         │                                │
│  idle.title:       │         │  "idle.title_text" → "도서관"  │
│    "스마트 도서관"  │         │  "menu.borrow_button_color"   │
│                    │         │    → "#2563EB"                 │
└────────────────────┘         └──────────────────────────────┘
         │                                  │
         │  DB 값 없으면 기본값 사용          │  DB 값 있으면 DB 값 우선
         ▼                                  ▼
┌──────────────────────────────────────────────────────────────┐
│  useCmsContent("idle.title_text", "스마트 도서관")             │
│  → "도서관"  (DB 오버라이드)                                   │
│                                                                │
│  useCmsContent("idle.subtitle_text", "도서 대출·반납 키오스크")  │
│  → "도서 대출·반납 키오스크"  (코드 기본값, DB 오버라이드 없음)  │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 TypeScript 인터페이스

```typescript
// src/types/admin.ts (계속)

/** CMS 콘텐츠 타입 */
export type CmsContentType = 'text' | 'image' | 'color' | 'number' | 'boolean' | 'json';

/** CMS 콘텐츠 레코드 (DB 모델 대응) */
export interface CmsContentRecord {
  id: string;
  key: string;              // 예: "idle.title_text"
  type: CmsContentType;
  value: string;            // JSON 문자열 (모든 타입을 String으로 저장)
  updatedAt: Date;
  updatedBy: string;        // AdminUser.id
}

/** CMS 필드 정의 (관리자 UI 렌더링용 메타데이터) */
export interface CmsFieldDefinition {
  key: string;              // "idle.title_text"
  label: string;            // "대기 화면 타이틀"
  type: CmsContentType;
  defaultValue: string;     // "스마트 도서관"
  group: string;            // "idle" (화면별 그룹)
  validation?: {
    maxLength?: number;     // text: 최대 길이
    min?: number;           // number: 최솟값
    max?: number;           // number: 최댓값
    pattern?: string;       // color: HEX 패턴
    maxFileSize?: number;   // image: 최대 파일 크기 (bytes)
    allowedMimes?: string[];// image: 허용 MIME
  };
  description?: string;    // 필드 설명 (UI 툴팁)
}

/** CMS 콘텐츠 그룹 */
export interface CmsContentGroup {
  id: string;               // "idle"
  label: string;            // "대기 화면"
  icon: string;             // "Monitor" (Lucide 아이콘명)
  fields: CmsFieldDefinition[];
}
```

### 3.3 CMS 기본값 정의 (constants)

```typescript
// src/lib/admin/cms-defaults.ts

import type { CmsFieldDefinition, CmsContentGroup } from '@/types/admin';

/** 대기 화면 필드 정의 */
const idleFields: CmsFieldDefinition[] = [
  {
    key: 'idle.logo_image',
    label: '로고 이미지',
    type: 'image',
    defaultValue: '/images/default-logo.svg',
    group: 'idle',
    validation: { maxFileSize: 512000, allowedMimes: ['image/png', 'image/svg+xml'] },
  },
  {
    key: 'idle.title_text',
    label: '타이틀 텍스트',
    type: 'text',
    defaultValue: '스마트 도서관',
    group: 'idle',
    validation: { maxLength: 50 },
  },
  {
    key: 'idle.subtitle_text',
    label: '부제목 텍스트',
    type: 'text',
    defaultValue: '도서 대출·반납 키오스크',
    group: 'idle',
    validation: { maxLength: 100 },
  },
  {
    key: 'idle.bg_color',
    label: '배경색',
    type: 'color',
    defaultValue: '#1E3A5F',
    group: 'idle',
    validation: { pattern: '^#[0-9A-Fa-f]{6}$' },
  },
  {
    key: 'idle.bg_image',
    label: '배경 이미지',
    type: 'image',
    defaultValue: '',
    group: 'idle',
    validation: { maxFileSize: 2097152, allowedMimes: ['image/jpeg', 'image/png'] },
  },
  {
    key: 'idle.touch_prompt',
    label: '터치 안내 텍스트',
    type: 'text',
    defaultValue: '화면을 터치하세요',
    group: 'idle',
    validation: { maxLength: 80 },
  },
  {
    key: 'idle.touch_prompt_color',
    label: '터치 안내 색상',
    type: 'color',
    defaultValue: '#FFFFFF',
    group: 'idle',
    validation: { pattern: '^#[0-9A-Fa-f]{6}$' },
  },
];

/** 대출 규칙 필드 정의 */
const rulesFields: CmsFieldDefinition[] = [
  {
    key: 'rules.max_borrow_count',
    label: '최대 대출 권수',
    type: 'number',
    defaultValue: '5',
    group: 'rules',
    validation: { min: 1, max: 20 },
  },
  {
    key: 'rules.borrow_period_days',
    label: '대출 기간 (일)',
    type: 'number',
    defaultValue: '14',
    group: 'rules',
    validation: { min: 1, max: 90 },
  },
  {
    key: 'rules.overdue_penalty_multiplier',
    label: '연체 배수',
    type: 'number',
    defaultValue: '1.0',
    group: 'rules',
    validation: { min: 1, max: 5 },
  },
  {
    key: 'rules.overdue_enabled',
    label: '연체 페널티 활성화',
    type: 'boolean',
    defaultValue: 'true',
    group: 'rules',
  },
];

/** CMS 콘텐츠 그룹 전체 정의 */
export const CMS_CONTENT_GROUPS: CmsContentGroup[] = [
  { id: 'idle',    label: '대기 화면',       icon: 'Monitor',        fields: idleFields },
  { id: 'menu',    label: '메인 메뉴',       icon: 'LayoutGrid',    fields: menuFields },
  { id: 'auth',    label: '인증 화면',       icon: 'Shield',        fields: authFields },
  { id: 'select',  label: '도서 선택 화면',  icon: 'BookOpen',      fields: selectFields },
  { id: 'borrow',  label: '대출 완료 화면',  icon: 'CheckCircle',   fields: borrowFields },
  { id: 'return',  label: '반납 완료 화면',  icon: 'RotateCcw',     fields: returnFields },
  { id: 'rules',   label: '대출 규칙',       icon: 'Settings',      fields: rulesFields },
];

/** key → 기본값 빠른 조회 맵 */
export const CMS_DEFAULTS_MAP = new Map<string, string>(
  CMS_CONTENT_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f.defaultValue]))
);

/** key → 필드 정의 빠른 조회 맵 */
export const CMS_FIELD_MAP = new Map<string, CmsFieldDefinition>(
  CMS_CONTENT_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f]))
);
```

### 3.4 마이그레이션 전략: 코드 기본값 → DB 오버라이드

```
초기 배포:
  CmsContent 테이블 = 비어 있음
  → 모든 key가 constants.ts의 기본값으로 동작

관리자가 "idle.title_text"를 "도서관"으로 변경:
  → CmsContent에 { key: "idle.title_text", value: '"도서관"' } INSERT
  → 프론트엔드는 DB 값을 우선 사용

새 버전에서 key가 추가됨 (예: "idle.welcome_animation"):
  → CmsContent에 해당 key 레코드 없음
  → constants.ts의 기본값으로 자동 폴백
  → 별도 마이그레이션 불필요 (코드 기본값이 단일 소스 오브 트루스)
```

```typescript
// src/app/api/admin/cms/content/route.ts

import { withAdminAuth } from '@/lib/admin/rbac';
import { CMS_DEFAULTS_MAP } from '@/lib/admin/cms-defaults';
import { prisma } from '@/lib/db';

/** GET /api/admin/cms/content — 전체 CMS 콘텐츠 조회 */
export const GET = withAdminAuth(async (request, { auth }) => {
  // DB에 저장된 모든 CMS 레코드 조회
  const dbContents = await prisma.cmsContent.findMany();

  // key → value 맵 구성
  const dbMap = new Map(dbContents.map((c) => [c.key, c.value]));

  // 기본값과 병합: DB 값 우선, 없으면 기본값
  const merged: Record<string, { value: string; type: string; source: 'db' | 'default' }> = {};

  for (const [key, defaultValue] of CMS_DEFAULTS_MAP) {
    const dbValue = dbMap.get(key);
    merged[key] = {
      value: dbValue ?? defaultValue,
      type: CMS_FIELD_MAP.get(key)!.type,
      source: dbValue ? 'db' : 'default',
    };
  }

  return NextResponse.json({ content: merged });
}, 'cms:read');
```

### 3.5 프론트엔드 통합: useCmsContent 훅

```typescript
// src/hooks/admin/useCmsContent.ts

import { useCmsStore } from '@/stores/admin/useCmsStore';
import { CMS_DEFAULTS_MAP } from '@/lib/admin/cms-defaults';

/**
 * 단일 CMS 콘텐츠 값 조회 훅
 *
 * @param key      CMS 콘텐츠 키 (예: "idle.title_text")
 * @param defaultV 기본값 (constants.ts에서 import)
 * @returns        해석된 값 (타입별 파싱 적용)
 *
 * @example
 * const title = useCmsContent('idle.title_text', '스마트 도서관');
 * // → "도서관" (DB 오버라이드) 또는 "스마트 도서관" (기본값)
 */
export function useCmsContent(key: string, defaultValue: string): string {
  const storeValue = useCmsStore((state) => state.content.get(key));
  return storeValue ?? defaultValue;
}

/** 타입별 파싱 버전 */
export function useCmsNumber(key: string, defaultValue: number): number {
  const raw = useCmsContent(key, String(defaultValue));
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function useCmsBoolean(key: string, defaultValue: boolean): boolean {
  const raw = useCmsContent(key, String(defaultValue));
  return raw === 'true';
}

export function useCmsJson<T>(key: string, defaultValue: T): T {
  const raw = useCmsContent(key, JSON.stringify(defaultValue));
  try {
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}
```

### 3.6 키오스크 컴포넌트에서의 조건부 렌더링

```tsx
// src/components/kiosk/KioskIdleScreen.tsx (수정 예시)

import { useCmsContent, useCmsBoolean, useCmsNumber } from '@/hooks/admin/useCmsContent';

export function KioskIdleScreen() {
  // CMS 값 조회 (DB 오버라이드 ?? 코드 기본값)
  const title       = useCmsContent('idle.title_text', '스마트 도서관');
  const subtitle    = useCmsContent('idle.subtitle_text', '도서 대출·반납 키오스크');
  const bgColor     = useCmsContent('idle.bg_color', '#1E3A5F');
  const bgImage     = useCmsContent('idle.bg_image', '');
  const touchPrompt = useCmsContent('idle.touch_prompt', '화면을 터치하세요');
  const promptColor = useCmsContent('idle.touch_prompt_color', '#FFFFFF');
  const logoImage   = useCmsContent('idle.logo_image', '/images/default-logo.svg');

  return (
    <div
      className="flex flex-col items-center justify-center h-full"
      style={{
        backgroundColor: bgColor,
        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
      }}
    >
      <img src={logoImage} alt="도서관 로고" className="w-32 h-32 mb-8" />
      <h1 className="text-4xl font-bold text-white mb-4">{title}</h1>
      <p className="text-xl text-white/80 mb-12">{subtitle}</p>
      <p
        className="text-2xl animate-pulse"
        style={{ color: promptColor }}
      >
        {touchPrompt}
      </p>
    </div>
  );
}
```

---

## 4. 실시간 동기화 설계

### 4.1 키오스크 폴링 메커니즘 개요

키오스크 프론트엔드는 **3초 간격 폴링**으로 CMS 콘텐츠 변경을 감지한다. 서버는 `ETag` 헤더로 콘텐츠 버전을 관리하고, 클라이언트는 `If-None-Match` 헤더로 조건부 요청을 보내어 변경이 없을 경우 `304 Not Modified`를 수신하여 트래픽을 최소화한다.

```
┌──────────────┐  GET /api/cms/content        ┌──────────────┐
│  Kiosk       │  If-None-Match: "etag_v42"   │  Server      │
│  Frontend    │ ────────────────────────────► │  (Next.js)   │
│              │                               │              │
│              │ ◄── 200 + ETag: "etag_v43"   │  (변경 있음)  │
│              │     { content: {...} }        │              │
│              │                               │              │
│  (3초 후)    │  GET /api/cms/content        │              │
│              │  If-None-Match: "etag_v43"   │              │
│              │ ────────────────────────────► │              │
│              │                               │              │
│              │ ◄── 304 Not Modified          │  (변경 없음)  │
└──────────────┘                               └──────────────┘
```

### 4.2 서버: ETag 기반 공개 CMS API

```typescript
// src/app/api/cms/content/route.ts (키오스크용 공개 API — 인증 불필요)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CMS_DEFAULTS_MAP, CMS_FIELD_MAP } from '@/lib/admin/cms-defaults';
import { createHash } from 'crypto';

export async function GET(request: NextRequest) {
  // 1. DB에서 모든 CMS 레코드 조회
  const dbContents = await prisma.cmsContent.findMany({
    orderBy: { key: 'asc' },
  });

  // 2. 기본값과 병합
  const merged: Record<string, string> = {};
  for (const [key, defaultValue] of CMS_DEFAULTS_MAP) {
    const dbRecord = dbContents.find((c) => c.key === key);
    merged[key] = dbRecord?.value ?? defaultValue;
  }

  // 3. ETag 생성 (내용 해시)
  const contentHash = createHash('md5')
    .update(JSON.stringify(merged))
    .digest('hex');
  const etag = `"${contentHash}"`;

  // 4. 조건부 요청 검사 (If-None-Match)
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag },
    });
  }

  // 5. 변경 있음 → 200 + ETag + 콘텐츠
  return NextResponse.json(
    { content: merged, updatedAt: new Date().toISOString() },
    {
      headers: {
        ETag: etag,
        'Cache-Control': 'no-cache',  // 항상 재검증
      },
    }
  );
}
```

### 4.3 클라이언트: useCmsPolling 훅

```typescript
// src/hooks/admin/useCmsPolling.ts

import { useEffect, useRef, useCallback } from 'react';
import { useCmsStore } from '@/stores/admin/useCmsStore';

const POLLING_INTERVAL_MS = 3000;  // 3초
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;

/**
 * 키오스크용 CMS 콘텐츠 폴링 훅
 *
 * 3초 간격으로 GET /api/cms/content를 호출하고,
 * ETag 기반 조건부 요청으로 불필요한 데이터 전송을 방지한다.
 * 연결 실패 시 지수 백오프로 재시도한다.
 */
export function useCmsPolling(enabled: boolean = true) {
  const etagRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const setContent = useCmsStore((state) => state.setContent);
  const setLastUpdated = useCmsStore((state) => state.setLastUpdated);
  const setConnectionStatus = useCmsStore((state) => state.setConnectionStatus);

  const poll = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (etagRef.current) {
        headers['If-None-Match'] = etagRef.current;
      }

      const response = await fetch('/api/cms/content', { headers });

      if (response.status === 304) {
        // 변경 없음 — 재시도 카운터 리셋
        retryCountRef.current = 0;
        setConnectionStatus('connected');
        return;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // ETag 저장
      const newEtag = response.headers.get('ETag');
      if (newEtag) etagRef.current = newEtag;

      // 콘텐츠 업데이트
      const data = await response.json();
      setContent(new Map(Object.entries(data.content)));
      setLastUpdated(new Date(data.updatedAt));
      setConnectionStatus('connected');

      // 재시도 카운터 리셋
      retryCountRef.current = 0;
    } catch (error) {
      retryCountRef.current++;
      setConnectionStatus('disconnected');

      if (retryCountRef.current >= MAX_RETRIES) {
        setConnectionStatus('failed');
        console.error('[CMS Polling] 최대 재시도 횟수 초과:', error);
        return;
      }

      // 지수 백오프 대기 후 재시도
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCountRef.current - 1);
      console.warn(`[CMS Polling] 재시도 ${retryCountRef.current}/${MAX_RETRIES} (${delay}ms 후)`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }, [setContent, setLastUpdated, setConnectionStatus]);

  useEffect(() => {
    if (!enabled) return;

    // 최초 1회 즉시 실행
    poll();

    // 이후 3초 간격 폴링
    intervalRef.current = setInterval(poll, POLLING_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, poll]);
}
```

### 4.4 Zustand CMS 스토어

```typescript
// src/stores/admin/useCmsStore.ts

import { create } from 'zustand';

type ConnectionStatus = 'connected' | 'disconnected' | 'failed';

interface CmsState {
  /** CMS 콘텐츠 맵 (key → value) */
  content: Map<string, string>;

  /** 마지막 업데이트 시간 */
  lastUpdated: Date | null;

  /** 서버 연결 상태 */
  connectionStatus: ConnectionStatus;

  /** 액션 */
  setContent: (content: Map<string, string>) => void;
  setLastUpdated: (date: Date) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  getValue: (key: string) => string | undefined;
}

export const useCmsStore = create<CmsState>()((set, get) => ({
  content: new Map(),
  lastUpdated: null,
  connectionStatus: 'disconnected',

  setContent: (content) => set({ content }),
  setLastUpdated: (lastUpdated) => set({ lastUpdated }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  getValue: (key) => get().content.get(key),
}));
```

### 4.5 버전 추적 및 변경 감지

```typescript
// CMS 콘텐츠 업데이트 시 updatedAt 타임스탬프 갱신

// src/app/api/admin/cms/content/route.ts (PUT)

export const PUT = withAdminAuth(async (request, { auth }) => {
  const body = await request.json();
  const { key, value } = body as { key: string; value: string };

  // Zod 검증
  const fieldDef = CMS_FIELD_MAP.get(key);
  if (!fieldDef) {
    return NextResponse.json(
      { error: { code: 'INVALID_KEY', message: `알 수 없는 CMS key: ${key}` } },
      { status: 400 }
    );
  }

  // upsert: 존재하면 UPDATE, 없으면 INSERT
  const result = await prisma.cmsContent.upsert({
    where: { key },
    update: {
      value,
      updatedBy: auth.sub,
      updatedAt: new Date(),  // 버전 추적용 타임스탬프
    },
    create: {
      key,
      type: fieldDef.type,
      value,
      updatedBy: auth.sub,
    },
  });

  // 감사 로그 기록
  await recordAuditLog({
    action: 'UPDATE',
    entity: 'CmsContent',
    entityId: result.id,
    oldValue: fieldDef.defaultValue,
    newValue: value,
    performedBy: auth.sub,
  });

  return NextResponse.json({ success: true, content: result });
}, 'cms:write');
```

### 4.6 조건부 렌더링 패턴 요약

```typescript
// 키오스크 컴포넌트에서의 조건부 렌더링 원칙
// CMS 값 ?? 하드코딩 기본값

// ✅ 올바른 패턴
const title = useCmsContent('idle.title_text', '스마트 도서관');
// → DB에 값 있으면 DB 값, 없으면 '스마트 도서관'

// ❌ 잘못된 패턴 (기본값 누락)
const title = useCmsStore((s) => s.content.get('idle.title_text'));
// → DB에 값 없으면 undefined → 렌더링 깨짐

// ❌ 잘못된 패턴 (직접 DB 조회 — 키오스크는 서버 컴포넌트가 아님)
const title = await fetch(`/api/cms/content?key=idle.title_text`);
```

---

## 5. 이미지 관리 설계

### 5.1 이미지 저장 아키텍처

```
┌──────────┐  POST /api/admin/cms/upload   ┌───────────────────────────────┐
│  Admin   │  FormData: file, key, altText  │  Server                       │
│  UI      │ ─────────────────────────────► │                               │
│          │                                 │  1. 파일 검증 (MIME, 크기)      │
│          │                                 │  2. 매직 넘버 검증             │
│          │                                 │  3. 파일명 새니타이징           │
│          │                                 │  4. /public/uploads/cms/ 저장  │
│          │                                 │  5. 썸네일 생성 (sharp)        │
│          │                                 │  6. CmsContent UPDATE         │
│          │ ◄── { url, thumbnailUrl }       │  7. 감사 로그 기록             │
└──────────┘                                 └───────────────────────────────┘
```

### 5.2 TypeScript 인터페이스

```typescript
// src/types/admin.ts (계속)

/** 이미지 업로드 요청 */
export interface ImageUploadRequest {
  file: File;
  key: string;           // CMS key (예: "idle.logo_image")
  altText?: string;      // 대체 텍스트 (접근성)
}

/** 이미지 업로드 응답 */
export interface ImageUploadResponse {
  url: string;           // 원본 이미지 URL
  thumbnailUrl: string;  // 썸네일 URL
  altText?: string;
  size: number;          // 파일 크기 (bytes)
  width: number;
  height: number;
}

/** 허용 MIME 타입 */
export const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
] as const;

/** 파일 크기 제한 */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;  // 5MB

/** 매직 넘버 시그니처 */
export const IMAGE_MAGIC_NUMBERS: Record<string, number[]> = {
  'image/jpeg':  [0xFF, 0xD8, 0xFF],    // JPEG
  'image/png':   [0x89, 0x50, 0x4E, 0x47], // PNG
  'image/webp':  [0x52, 0x49, 0x46, 0x46], // RIFF (WebP container)
  'image/svg+xml': [],                    // SVG는 텍스트 — 별도 검증
};
```

### 5.3 파일명 새니타이징 및 저장 경로

```typescript
// src/lib/admin/upload.ts

import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'cms');

/**
 * 파일명 새니타이징
 * - 한글/특수문자 제거
 * - 공백 → 하이픈
 * - 타임스탬프 프리픽스로 유일성 보장
 */
export function sanitizeFilename(originalName: string): string {
  const sanitized = originalName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // 분해된 악센트 제거
    .replace(/[^a-zA-Z0-9._-]/g, '_') // 안전한 문자만 유지
    .replace(/_+/g, '_')              // 연속 밑줄 → 단일
    .toLowerCase();

  const timestamp = Date.now();
  return `${timestamp}_${sanitized}`;
}

/**
 * 이미지 파일 저장
 * @returns 저장된 파일의 공개 URL 경로
 */
export async function saveImageFile(
  buffer: Buffer,
  originalName: string
): Promise<string> {
  // 업로드 디렉터리 보장
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const filename = sanitizeFilename(originalName);
  const filePath = path.join(UPLOAD_DIR, filename);

  // 파일 저장
  await fs.writeFile(filePath, buffer);

  // 공개 URL 반환 (Next.js가 /public 아래를 정적 서빙)
  return `/uploads/cms/${filename}`;
}
```

### 5.4 매직 넘버 검증 (MIME 스푸핑 방어)

```typescript
// src/lib/admin/upload.ts (계속)

import { IMAGE_MAGIC_NUMBERS, ALLOWED_IMAGE_MIMES, MAX_IMAGE_SIZE } from '@/types/admin';

/**
 * 파일 매직 넘버 검증
 * MIME 헤더만 신뢰하지 않고, 파일의 실제 바이트 시그니처를 확인한다.
 */
export function validateMagicNumber(buffer: Buffer, claimedMime: string): boolean {
  // SVG는 텍스트 포맷 — <svg 태그로 시작하는지 확인
  if (claimedMime === 'image/svg+xml') {
    const head = buffer.toString('utf8', 0, 256).trim();
    return head.startsWith('<?xml') || head.startsWith('<svg');
  }

  const expected = IMAGE_MAGIC_NUMBERS[claimedMime];
  if (!expected || expected.length === 0) return false;

  // 파일 시작 바이트와 매직 넘버 비교
  for (let i = 0; i < expected.length; i++) {
    if (buffer[i] !== expected[i]) return false;
  }

  // WebP는 RIFF + WEBP 시그니처 확인
  if (claimedMime === 'image/webp') {
    const webpSig = buffer.toString('ascii', 8, 12);
    if (webpSig !== 'WEBP') return false;
  }

  return true;
}

/** 이미지 업로드 전체 검증 */
export function validateImageUpload(
  buffer: Buffer,
  claimedMime: string,
  fileSize: number
): { valid: boolean; error?: string } {
  // 1. MIME 타입 허용 여부
  if (!ALLOWED_IMAGE_MIMES.includes(claimedMime as any)) {
    return { valid: false, error: `허용되지 않는 파일 형식: ${claimedMime}` };
  }

  // 2. 파일 크기 제한
  if (fileSize > MAX_IMAGE_SIZE) {
    return { valid: false, error: `파일 크기 초과: ${fileSize} > ${MAX_IMAGE_SIZE} bytes` };
  }

  // 3. 매직 넘버 검증
  if (!validateMagicNumber(buffer, claimedMime)) {
    return { valid: false, error: '파일 시그니처가 MIME 타입과 일치하지 않습니다.' };
  }

  return { valid: true };
}
```

### 5.5 썸네일 생성 (sharp)

```typescript
// src/lib/admin/upload.ts (계속)

import sharp from 'sharp';

const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = 200;

/**
 * 썸네일 이미지 생성
 * 원본 비율 유지, 최대 200×200으로 축소, WebP 포맷 변환
 */
export async function generateThumbnail(
  buffer: Buffer,
  originalName: string
): Promise<string> {
  // SVG는 sharp 처리 불가 — 원본 URL을 썸네일로 사용
  if (originalName.endsWith('.svg')) {
    return ''; // 호출부에서 원본 URL 사용
  }

  const thumbnailBuffer = await sharp(buffer)
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
      fit: 'inside',    // 비율 유지
      withoutEnlargement: true,  // 작은 이미지 확대 금지
    })
    .webp({ quality: 80 })
    .toBuffer();

  const thumbFilename = `thumb_${sanitizeFilename(originalName).replace(/\.[^.]+$/, '.webp')}`;
  const thumbPath = path.join(UPLOAD_DIR, thumbFilename);
  await fs.writeFile(thumbPath, thumbnailBuffer);

  return `/uploads/cms/${thumbFilename}`;
}
```

### 5.6 이미지 업로드 API Route

```typescript
// src/app/api/admin/cms/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/rbac';
import { validateImageUpload, saveImageFile, generateThumbnail } from '@/lib/admin/upload';
import formidable from 'formidable';

export const POST = withAdminAuth(async (request, { auth }) => {
  // 1. 멀티파트 폼 데이터 파싱
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const key = formData.get('key') as string;
  const altText = formData.get('altText') as string | null;

  if (!file || !key) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'file과 key는 필수입니다.' } },
      { status: 400 }
    );
  }

  // 2. 파일 버퍼 읽기
  const buffer = Buffer.from(await file.arrayBuffer());

  // 3. 검증
  const validation = validateImageUpload(buffer, file.type, file.size);
  if (!validation.valid) {
    return NextResponse.json(
      { error: { code: 'INVALID_FILE', message: validation.error } },
      { status: 400 }
    );
  }

  // 4. 파일 저장
  const url = await saveImageFile(buffer, file.name);

  // 5. 썸네일 생성
  const thumbnailUrl = await generateThumbnail(buffer, file.name);

  // 6. CMS 콘텐츠 업데이트
  await prisma.cmsContent.upsert({
    where: { key },
    update: { value: JSON.stringify({ url, thumbnailUrl, altText }), updatedBy: auth.sub },
    create: { key, type: 'image', value: JSON.stringify({ url, thumbnailUrl, altText }), updatedBy: auth.sub },
  });

  // 7. 감사 로그
  await recordAuditLog({
    action: 'UPDATE',
    entity: 'CmsContent',
    entityId: key,
    newValue: url,
    performedBy: auth.sub,
  });

  return NextResponse.json({
    url,
    thumbnailUrl: thumbnailUrl || url,  // SVG는 원본 URL
    altText,
    size: file.size,
  });
}, 'cms:write');
```

### 5.7 Alt 텍스트 관리

```typescript
/** 이미지 CMS 값의 JSON 구조 */
interface CmsImageValue {
  url: string;
  thumbnailUrl?: string;
  altText?: string;      // 접근성 대체 텍스트
  width?: number;
  height?: number;
}

/** Alt 텍스트 업데이트 API (이미지 재업로드 없이 텍스트만 변경) */
export async function updateImageAltText(
  key: string,
  altText: string,
  adminId: string
): Promise<void> {
  const record = await prisma.cmsContent.findUnique({ where: { key } });
  if (!record) throw new Error(`CMS key not found: ${key}`);

  const current: CmsImageValue = JSON.parse(record.value);
  current.altText = altText;

  await prisma.cmsContent.update({
    where: { key },
    data: { value: JSON.stringify(current), updatedBy: adminId },
  });
}
```

---

## 6. 반응형 설계

### 6.1 브레이크포인트 정의

```typescript
// tailwind.config.ts

import type { Config } from 'tailwindcss';

export default {
  theme: {
    screens: {
      'mobile':   '375px',    // 스마트폰
      'tablet':   '768px',    // 태블릿
      'kiosk-lg': '1024px',   // 21″ 키오스크 (최소 해상도)
      'kiosk-xl': '1440px',   // 24″ 키오스크
    },
    extend: {
      spacing: {
        'sidebar-collapsed': '64px',   // 태블릿: 아이콘 전용 사이드바
        'sidebar-expanded':  '240px',  // 키오스크: 전체 사이드바
        'preview-panel':     '320px',  // 키오스크: 미리보기 패널
      },
    },
  },
} satisfies Config;
```

### 6.2 CSS Custom Properties (키오스크 특화)

```css
/* src/app/globals.css */

:root {
  /* 기본 (모바일) */
  --admin-sidebar-width: 0px;
  --admin-content-columns: 1;
  --admin-chart-height: 200px;
  --admin-table-mode: card;    /* card | table */
  --admin-font-scale: 1;
}

@media (min-width: 768px) {
  /* 태블릿 */
  :root {
    --admin-sidebar-width: 64px;
    --admin-content-columns: 2;
    --admin-chart-height: 300px;
    --admin-table-mode: table;
    --admin-font-scale: 1;
  }
}

@media (min-width: 1024px) {
  /* 21″ 키오스크 */
  :root {
    --admin-sidebar-width: 240px;
    --admin-content-columns: 3;
    --admin-chart-height: 400px;
    --admin-table-mode: table;
    --admin-font-scale: 1;
  }
}

@media (min-width: 1440px) {
  /* 24″ 키오스크 */
  :root {
    --admin-sidebar-width: 240px;
    --admin-content-columns: 4;
    --admin-chart-height: 400px;
    --admin-table-mode: table;
    --admin-font-scale: 1.125;  /* 12.5% 더 큰 텍스트 */
  }
}
```

### 6.3 반응형 레이아웃 구현

```tsx
// src/app/admin/layout.tsx

import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { PermissionGuard } from '@/components/admin/PermissionGuard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PermissionGuard>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* 사이드바 */}
        <aside
          className={`
            /* 모바일: 숨김 (햄버거로 토글) */
            hidden mobile:block
            /* 태블릿: 아이콘 전용 64px */
            tablet:w-sidebar-collapsed tablet:block
            /* 키오스크: 전체 240px */
            kiosk-lg:w-sidebar-expanded
            /* 트랜지션 */
            transition-all duration-200 ease-in-out
            border-r border-gray-200 bg-white
          `}
        >
          <AdminSidebar />
        </aside>

        {/* 메인 영역 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminHeader />

          <main
            className="flex-1 overflow-y-auto p-4 tablet:p-6 kiosk-lg:p-8"
            style={{
              /* CSS Grid 컬럼 수 동적 적용 */
              gridTemplateColumns: `repeat(var(--admin-content-columns), 1fr)`,
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </PermissionGuard>
  );
}
```

### 6.4 반응형 UI 동작 매트릭스

| UI 요소 | 모바일 (<768px) | 태블릿 (768~1023px) | 21″ 키오스크 (1024~1439px) | 24″ 키오스크 (≥1440px) |
|---------|:--------------:|:-------------------:|:------------------------:|:---------------------:|
| **사이드바** | 햄버거 메뉴 (슬라이드 오버레이) | 64px 아이콘 전용 (hover 확장) | 240px 고정 노출 | 240px 고정 노출 |
| **콘텐츠 영역** | 1-column flex stack | 2-column CSS Grid | 3-column CSS Grid | 4-column CSS Grid |
| **미리보기 패널** | 모달 오버레이 | 하단 280px 접히식 | 우측 320px 고정 | 우측 320px 고정 |
| **데이터 테이블** | 카드 리스트 뷰 | 주요 컬럼 5개 + 더보기 | 전체 컬럼 노출 | 전체 컬럼 노출 |
| **컬러 피커** | 전체화면 모달 | 인라인 팝오버 | 인라인 팝오버 | 인라인 팝오버 |
| **이미지 업로드** | 카메라+파일 선택 버튼 | 드래그앤드롭 영역 | 드래그앤드롭 영역 | 드래그앤드롭 영역 |
| **통계 그래프** | 100%×200px | 100%×300px | 800×400 | 800×400 |
| **폰트 스케일** | 1.0 | 1.0 | 1.0 | 1.125 (12.5% 더 큼) |
| **페이지네이션** | 무한 스크롤 | 페이지 번호 | 페이지 번호 | 페이지 번호 |

### 6.5 모바일 햄버거 메뉴 (Sheet 컴포넌트)

```tsx
// src/components/admin/AdminSidebar.tsx

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function AdminSidebar() {
  const pathname = usePathname();
  const navItems = [
    { href: '/admin',          label: '대시보드',  icon: LayoutDashboard, permission: 'stats:read' },
    { href: '/admin/content',  label: '콘텐츠 관리', icon: Palette,       permission: 'cms:read' },
    { href: '/admin/books',    label: '도서 관리',  icon: BookOpen,      permission: 'books:read' },
    { href: '/admin/users',    label: '이용자 관리', icon: Users,        permission: 'users:read' },
    { href: '/admin/accounts', label: '계정 관리',  icon: Shield,       permission: 'accounts:read' },
    { href: '/admin/audit',    label: '감사 로그',  icon: FileText,     permission: 'audit:read' },
    { href: '/admin/notices',  label: '공지 관리',  icon: Bell,         permission: 'notices:read' },
    { href: '/admin/settings', label: '시스템 설정', icon: Settings,    permission: 'settings:read' },
  ];

  return (
    <>
      {/* 모바일: 햄버거 → Sheet (슬라이드 오버레이) */}
      <div className="tablet:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <NavList items={navItems} pathname={pathname} />
          </SheetContent>
        </Sheet>
      </div>

      {/* 태블릿+: 인라인 사이드바 */}
      <nav className="hidden tablet:flex flex-col h-full">
        <NavList items={navItems} pathname={pathname} />
      </nav>
    </>
  );
}
```

---

## 7. 보안 설계

### 7.1 보안 계층 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     클라이언트 요청                           │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. HTTPS (TLS)                                             │
│     - 로컬 개발 제외 모든 환경에서 TLS 필수                    │
│     - Self-signed 인증서 허용 (키오스크 내부망)                │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. CSRF 보호 (SameSite Cookie)                             │
│     - Refresh Token: SameSite=Strict                        │
│     - 모든 관리자 쿠키: Secure, HttpOnly, SameSite=Strict    │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. JWT 인증 (jose HS256)                                   │
│     - Access Token: Bearer 헤더, 15분 TTL                    │
│     - Refresh Token: httpOnly 쿠키, 7일 TTL                 │
│     - 토큰 버전 관리 (강제 무효화)                             │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. RBAC 권한 검사                                           │
│     - withAdminAuth(handler, requiredPermission)             │
│     - 역할별 권한 매트릭스 확인                                │
│     - 403 Forbidden on 권한 부족                              │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. 입력 검증 (Zod)                                         │
│     - 모든 API 입력 Zod 스키마로 검증                         │
│     - text 길이, color HEX, image MIME, number 범위          │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  6. 파일 업로드 검증                                         │
│     - MIME 화이트리스트                                      │
│     - 매직 넘버 시그니처 검증                                 │
│     - 파일 크기 제한 (5MB)                                   │
│     - SVG sanitize (DOMPurify)                              │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  7. 감사 로그 기록                                           │
│     - 모든 mutation 작업 AuditLog에 기록                      │
│     - 변경 전후값 (oldValue/newValue) 저장                     │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 비밀번호 해시 (bcrypt)

```typescript
// 설계 상세는 2.3절 참조
// 핵심 파라미터:
// - SALT_ROUNDS = 12  (약 250ms 해시 시간, 보안/성능 균형)
// - 저장: passwordHash 필드에 bcrypt 해시만 저장
// - 검증: bcrypt.compare(입력, 저장된_해시)
// - 평문 비밀번호 절대 로깅/저장 금지
```

### 7.3 JWT 검증 (모든 관리자 API)

```typescript
// 모든 /api/admin/* 경로에 withAdminAuth 래퍼 적용

// ✅ 올바른 사용
export const GET = withAdminAuth(async (req, { auth }) => {
  // auth: AccessTokenPayload (sub, email, role, permissions)
  // 인증 + 권한 검사가 완료된 상태
}, 'books:read');

// ❌ 잘못된 사용 (인증 없이 직접 핸들러)
export async function GET(request: NextRequest) {
  // 인증 우회 — 절대 금지
}
```

### 7.4 RBAC 권한 매트릭스

```typescript
// src/lib/admin/rbac.ts (2.7절 참조)

// 권한 매트릭스 체크 함수
export function checkPermissionMatrix(
  role: AdminRole,
  resource: string,
  action: 'read' | 'write' | 'export'
): boolean {
  const permission = `${resource}:${action}` as Permission;
  return hasPermission(role, permission);
}

// 권한 매트릭스 전체 (PRD 4.2 기준)
//
// | 기능 영역      | 세부 기능         | super_admin | admin | operator |
// |---------------|-------------------|:-----------:|:-----:|:--------:|
// | CMS 콘텐츠    | 읽기              | ✅          | ✅    | ✅       |
// |               | 쓰기              | ✅          | ✅    | ❌       |
// | 도서 관리      | 읽기              | ✅          | ✅    | ✅       |
// |               | 쓰기              | ✅          | ✅    | ❌       |
// | 사용자 관리    | 읽기              | ✅          | ✅    | ✅       |
// |               | 쓰기              | ✅          | ✅    | ❌       |
// | 통계          | 읽기              | ✅          | ✅    | ✅       |
// |               | 내보내기          | ✅          | ✅    | ❌       |
// | 계정 관리      | 읽기/쓰기         | ✅          | ❌    | ❌       |
// | 감사 로그      | 읽기              | ✅          | ✅    | ❌       |
// |               | 내보내기          | ✅          | ❌    | ❌       |
// | 공지 관리      | 읽기              | ✅          | ✅    | ✅       |
// |               | 쓰기              | ✅          | ✅    | ❌       |
// | 시스템 설정    | 읽기/쓰기         | ✅          | ❌    | ❌       |
```

### 7.5 감사 로그 (모든 Mutation)

```typescript
// src/lib/admin/audit.ts

import { prisma } from '@/lib/db';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
type AuditEntity = 'CmsContent' | 'Book' | 'LibraryUser' | 'AdminUser' | 'Notice';

interface AuditLogInput {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  oldValue?: string;    // JSON 직렬화된 변경 전 값
  newValue?: string;    // JSON 직렬화된 변경 후 값
  performedBy: string;  // AdminUser.id
}

/** 감사 로그 기록 */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      oldValue: input.oldValue,
      newValue: input.newValue,
      performedBy: input.performedBy,
    },
  });
}

/** 감사 로그 조회 (관리자 대시보드) */
export async function getAuditLogs(options: {
  entity?: AuditEntity;
  performedBy?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}) {
  const { entity, performedBy, from, to, page = 1, pageSize = 20 } = options;

  const where: any = {};
  if (entity) where.entity = entity;
  if (performedBy) where.performedBy = performedBy;
  if (from || to) {
    where.performedAt = {};
    if (from) where.performedAt.gte = from;
    if (to) where.performedAt.lte = to;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, pageSize };
}
```

### 7.6 CSRF 보호 (SameSite Cookie)

```typescript
// Refresh Token 쿠키 설정 (2.5절 참조)
// 핵심 속성:
// - sameSite: 'strict'  → 크로스사이트 요청에 쿠키 미전송 → CSRF 방어
// - httpOnly: true      → JavaScript 접근 불가 → XSS로 탈취 방어
// - secure: production  → HTTPS에서만 전송 → 중간자 공격 방어
// - path: '/api/auth'   → 인증 엔드포인트에서만 전송 → 공격 표면 축소

// 추가: Double Submit Cookie 패턴 (상태 변경 요청에 적용)
// - 관리자 세션 쿠키 + 커스텀 헤더 X-CSRF-Token 매칭
// - Next.js의 기본 CSRF 보호만으로 충분하므로 P2에서 고급 CSRF 적용
```

### 7.7 파일 업로드 보안 (매직 넘버 검증)

```typescript
// 5.4절 validateMagicNumber() 참조
//
// 보안 검증 체인:
// 1. MIME 헤더 확인 → image/jpeg, image/png, image/webp, image/svg+xml만 허용
// 2. 파일 크기 확인 → 5MB 초과 시 거부
// 3. 매직 넘버 확인 → 실제 바이트 시그니처와 MIME 일치 여부
// 4. SVG sanitize → DOMPurify로 <script>, onerror 등 제거
// 5. 파일명 새니타이징 → 경로 순회(../) 공격 방지

/** SVG sanitize */
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeSvg(svgContent: string): string {
  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
    REMOVE_SCRIPTS: true,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  });
}
```

### 7.8 Rate Limiting

```typescript
// src/lib/admin/rate-limit.ts

interface RateLimitEntry {
  count: number;
  resetAt: number;  // Unix timestamp (ms)
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * 인메모리 Rate Limiter
 * 단일 프로세스 환경(Script 환경)에서 동작
 */
export function checkRateLimit(
  key: string,          // IP + 엔드포인트 조합
  maxRequests: number,  // 최대 요청 수
  windowMs: number      // 시간 윈도 (ms)
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now >= entry.resetAt) {
    // 새 윈도 시작
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    // 한도 초과
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // 한도 내
  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

// 엔드포인트별 Rate Limit 설정
export const RATE_LIMITS = {
  '/api/auth/login':     { max: 10,  windowMs: 60_000 },   // 10회/분 (인증)
  '/api/auth/refresh':   { max: 30,  windowMs: 60_000 },   // 30회/분 (갱신)
  '/api/admin/cms/upload': { max: 20, windowMs: 60_000 },  // 20회/분 (업로드)
  default:               { max: 100, windowMs: 60_000 },   // 100회/분 (일반)
} as const;
```

### 7.9 로그인 실패 잠금

```typescript
// src/lib/admin/auth.ts (계속)

const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;  // 15분

/** 로그인 실패 처리 */
export async function handleLoginFailure(email: string): Promise<{
  locked: boolean;
  remainingAttempts: number;
}> {
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) return { locked: false, remainingAttempts: LOGIN_MAX_FAILURES };

  const newFailCount = (admin.loginFailCount ?? 0) + 1;

  if (newFailCount >= LOGIN_MAX_FAILURES) {
    // 계정 잠금
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        loginFailCount: newFailCount,
        lockedUntil: new Date(Date.now() + LOGIN_LOCK_DURATION_MS),
      },
    });
    return { locked: true, remainingAttempts: 0 };
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { loginFailCount: newFailCount },
  });

  return { locked: false, remainingAttempts: LOGIN_MAX_FAILURES - newFailCount };
}

/** 로그인 성공 시 실패 카운터 리셋 */
export async function resetLoginFailCount(adminId: string): Promise<void> {
  await prisma.adminUser.update({
    where: { id: adminId },
    data: { loginFailCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
}
```

---

## 8. 성능 설계

### 8.1 TanStack Query 설정 (관리자 데이터)

```typescript
// src/lib/admin/query-client.ts

import { QueryClient } from '@tanstack/react-query';

export const adminQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5분 — 데이터를 "신선"으로 간주
      gcTime: 10 * 60 * 1000,         // 10분 — 캐시 가비지 컬렉션
      retry: 2,                        // 실패 시 2회 재시도
      refetchOnWindowFocus: false,     // 윈도우 포커스 시 재조회 비활성화
      refetchOnReconnect: true,        // 네트워크 재연결 시 재조회
    },
    mutations: {
      retry: 1,                        // mutation 실패 시 1회 재시도
    },
  },
});
```

### 8.2 TanStack Query 훅 예시

```typescript
// src/hooks/admin/useAdminStats.ts

import { useQuery } from '@tanstack/react-query';
import { adminFetch } from '@/lib/admin/api-client';

interface DashboardStats {
  todayBorrows: number;
  todayReturns: number;
  activeLoans: number;
  overdueCount: number;
  hourlyData: { hour: number; borrows: number; returns: number }[];
  topBooks: { title: string; author: string; count: number }[];
  recentActivity: {
    id: string;
    type: 'BORROW' | 'RETURN';
    userName: string;
    bookTitle: string;
    timestamp: string;
  }[];
}

export function useAdminStats() {
  return useQuery<DashboardStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminFetch('/api/admin/stats'),
    staleTime: 5 * 60 * 1000,   // 5분
    refetchInterval: 30_000,     // 30초마다 자동 재조회 (실시간 통계)
  });
}

export function useCmsContentList() {
  return useQuery({
    queryKey: ['admin', 'cms', 'content'],
    queryFn: () => adminFetch('/api/admin/cms/content'),
    staleTime: 5 * 60 * 1000,   // 5분
    // CMS는 관리자가 수동 변경하므로 자동 refetch 없음
  });
}
```

### 8.3 ETag 캐싱 (CMS 콘텐츠)

```typescript
// 4.2절 서버 측 ETag 구현 참조
//
// 키오스크 폴링 시:
// - 변경 없음 → 304 Not Modified (본문 없음, ~100바이트)
// - 변경 있음 → 200 + 전체 콘텐츠 (~2KB 전형적)
//
// 효과:
// - 3초 폴링 × 변경 없음 → 304 응답만 → 대역폭 절약
// - 관리자가 저장한 직후에만 전체 전송 → 실시간 반영
```

### 8.4 페이지네이션

```typescript
// src/lib/admin/pagination.ts

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PaginationParams {
  page: number;      // 1-based
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 페이지네이션 파라미터 검증 */
export function validatePagination(params: Partial<PaginationParams>): PaginationParams {
  return {
    page: Math.max(1, params.page ?? 1),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)),
  };
}

/** Prisma findMany + count를 병렬 실행 */
export async function paginateQuery<T>(
  findManyArgs: any,
  countArgs: any,
  pagination: PaginationParams
): Promise<PaginatedResult<T>> {
  const [data, total] = await Promise.all([
    prisma[model].findMany({
      ...findManyArgs,
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma[model].count(countArgs),
  ]);

  return {
    data: data as T[],
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(total / pagination.pageSize),
  };
}
```

### 8.5 디바운스 검색 입력

```typescript
// src/hooks/admin/useDebounce.ts

import { useState, useEffect } from 'react';

/**
 * 디바운스 훅
 * @param value  입력값
 * @param delay  지연 시간 (ms, 기본 300ms)
 * @returns      지연 후 최종값
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// 사용 예시
// const [searchTerm, setSearchTerm] = useState('');
// const debouncedSearch = useDebounce(searchTerm, 300);
//
// const { data } = useQuery({
//   queryKey: ['books', debouncedSearch],
//   queryFn: () => adminFetch(`/api/admin/books?search=${debouncedSearch}`),
//   enabled: debouncedSearch.length >= 2,
// });
```

### 8.6 Lazy Loading (차트 컴포넌트)

```typescript
// src/app/admin/page.tsx (대시보드 홈)

import dynamic from 'next/dynamic';

// recharts 번들을 별도 청크로 분할
const HourlyChart = dynamic(
  () => import('@/components/admin/charts/HourlyChart'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,  // recharts는 클라이언트 전용
  }
);

const TopBooksChart = dynamic(
  () => import('@/components/admin/charts/TopBooksChart'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

function ChartSkeleton() {
  return (
    <div className="animate-pulse bg-gray-200 rounded-lg" style={{ height: 'var(--admin-chart-height)' }} />
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(var(--admin-content-columns), 1fr)` }}>
      {/* 통계 카드 — 즉시 로드 (경량) */}
      <StatsCard title="오늘 대출" value={stats.todayBorrows} />
      <StatsCard title="오늘 반납" value={stats.todayReturns} />
      <StatsCard title="대출 중"   value={stats.activeLoans} />
      <StatsCard title="연체"      value={stats.overdueCount} />

      {/* 차트 — Lazy Load (중량 recharts 번들) */}
      <HourlyChart data={stats.hourlyData} />
      <TopBooksChart data={stats.topBooks} />
    </div>
  );
}
```

### 8.7 성능 목표

| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| **LCP** (Largest Contentful Paint) | ≤ 2초 | Lighthouse (로컬 네트워크) |
| **TTI** (Time to Interactive) | ≤ 3초 | Lighthouse |
| **First Load JS** | ≤ 200KB (gzip) | Next.js 빌드 분석 |
| **API 응답 (목록)** | ≤ 100ms | Server Timing (10,000건 기준) |
| **API 응답 (CMS)** | ≤ 50ms | Server Timing |
| **CMS 폴링 트래픽** | ~100바이트/3초 (변경 없음 시) | 네트워크 탭 |
| **이미지 업로드** | ≤ 3초 (5MB) | 클라이언트 측정 |
| **DB 쿼리** | ≤ 50ms (단건), ≤ 100ms (목록) | Prisma logging |

---

## 9. 오류 처리 설계

### 9.1 에러 분류 체계

```typescript
// src/types/admin.ts (계속)

/** 관리자 API 에러 응답 */
export interface AdminErrorResponse {
  error: {
    code: AdminErrorCode;
    message: string;          // 사용자 표시용 메시지 (한국어)
    details?: Record<string, string>;  // 필드별 검증 에러
    stack?: string;           // 개발 모드에서만 포함
  };
}

/** 에러 코드 체계 */
export type AdminErrorCode =
  // 인증 에러 (401)
  | 'TOKEN_EXPIRED'          | 'TOKEN_INVALID'     | 'REFRESH_TOKEN_INVALID'
  | 'INVALID_CREDENTIALS'    | 'ACCOUNT_LOCKED'    | 'ACCOUNT_INACTIVE'
  // 권한 에러 (403)
  | 'PERMISSION_DENIED'
  // 검증 에러 (400)
  | 'VALIDATION_ERROR'       | 'INVALID_KEY'       | 'INVALID_FILE'
  | 'PASSWORD_POLICY_VIOLATION'
  // 충돌 에러 (409)
  | 'DUPLICATE_RESOURCE'
  // 한도 에러 (429)
  | 'RATE_LIMITED'
  // 서버 에러 (500)
  | 'INTERNAL_ERROR'         | 'DB_ERROR'          | 'UPLOAD_ERROR';
```

### 9.2 통합 에러 핸들러

```typescript
// src/lib/admin/error-handler.ts

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { AdminErrorCode, AdminErrorResponse } from '@/types/admin';

/** 관리자 API 통합 에러 핸들러 */
export function handleAdminError(error: unknown): NextResponse<AdminErrorResponse> {
  // Zod 검증 에러
  if (error instanceof ZodError) {
    const details: Record<string, string> = {};
    error.errors.forEach((e) => {
      details[e.path.join('.')] = e.message;
    });
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: '입력값이 올바르지 않습니다.',
          details,
        },
      },
      { status: 400 }
    );
  }

  // AdminApiError (비즈니스 로직 에러)
  if (error instanceof AdminApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code as AdminErrorCode,
          message: error.message,
        },
      },
      { status: error.status }
    );
  }

  // Prisma 에러
  if (error instanceof Error && error.name === 'PrismaClientKnownRequestError') {
    // P2002: Unique constraint violation
    if ((error as any).code === 'P2002') {
      return NextResponse.json(
        {
          error: {
            code: 'DUPLICATE_RESOURCE',
            message: '이미 존재하는 리소스입니다.',
          },
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        error: {
          code: 'DB_ERROR',
          message: '데이터베이스 오류가 발생했습니다.',
        },
      },
      { status: 500 }
    );
  }

  // 알 수 없는 에러
  console.error('[Admin API] Unhandled error:', error);
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ...(process.env.NODE_ENV === 'development' && {
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
    },
    { status: 500 }
  );
}
```

### 9.3 클라이언트 에러 처리

```tsx
// src/components/admin/ErrorBoundary.tsx

'use client';

import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold mb-2">오류가 발생했습니다</h2>
        <p className="text-sm text-gray-500 mb-4">
          {this.state.error?.message ?? '알 수 없는 오류가 발생했습니다.'}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            this.setState({ hasError: false, error: null });
            window.location.reload();
          }}
        >
          다시 시도
        </Button>
      </div>
    );
  }
}
```

### 9.4 API 호출 에러 처리 패턴

```typescript
// src/hooks/admin/useAdminMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch, AdminApiError } from '@/lib/admin/api-client';
import { toast } from 'sonner';

/** 관리자 mutation 훅 (에러 처리 포함) */
export function useAdminMutation<TData, TVariables>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
  options?: {
    invalidateKey?: unknown[];   // 성공 시 무효화할 쿼리 키
    successMessage?: string;     // 성공 토스트 메시지
  }
) {
  const queryClient = useQueryClient();

  return useMutation<TData, AdminApiError, TVariables>({
    mutationFn: (variables) =>
      adminFetch<TData>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(variables),
      }),
    onSuccess: () => {
      if (options?.invalidateKey) {
        queryClient.invalidateQueries({ queryKey: options.invalidateKey });
      }
      if (options?.successMessage) {
        toast.success(options.successMessage);
      }
    },
    onError: (error) => {
      // 에러 코드별 커스텀 메시지
      const messages: Record<string, string> = {
        TOKEN_EXPIRED: '인증이 만료되었습니다. 다시 로그인해주세요.',
        PERMISSION_DENIED: '이 작업을 수행할 권한이 없습니다.',
        VALIDATION_ERROR: '입력값을 확인해주세요.',
        RATE_LIMITED: '요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.',
      };

      toast.error(messages[error.code] ?? error.message);
    },
  });
}
```

### 9.5 에러 처리 매트릭스

| 에러 코드 | HTTP 상태 | 클라이언트 동작 | 사용자 메시지 |
|-----------|-----------|----------------|---------------|
| `TOKEN_EXPIRED` | 401 | 자동 Token 갱신 → 재시도 | (자동 처리, 사용자 인지 없음) |
| `TOKEN_INVALID` | 401 | 로그인 페이지 리다이렉트 | "인증이 만료되었습니다. 다시 로그인해주세요." |
| `PERMISSION_DENIED` | 403 | 토스트 에러 | "이 작업을 수행할 권한이 없습니다." |
| `VALIDATION_ERROR` | 400 | 필드별 에러 표시 | "입력값을 확인해주세요." |
| `INVALID_FILE` | 400 | 토스트 에러 | 필드별 메시지 (크기 초과, MIME 불일치 등) |
| `DUPLICATE_RESOURCE` | 409 | 토스트 에러 | "이미 존재하는 리소스입니다." |
| `RATE_LIMITED` | 429 | 토스트 에러 + 대기 | "요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요." |
| `ACCOUNT_LOCKED` | 401 | 토스트 에러 | "계정이 잠겼습니다. 15분 후 다시 시도해주세요." |
| `INTERNAL_ERROR` | 500 | ErrorBoundary 포착 | "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." |

---

## 10. 배포 설계

### 10.1 단일 프로세스 배포 아키텍처

관리자 대시보드는 **기존 키오스크 Next.js 프로세스 내에 통합**되어 별도 프로세스나 포트 없이 동작한다.

```
┌─────────────────────────────────────────────────────────────┐
│              단일 Next.js 16 프로세스 (port 3000)            │
│                                                             │
│  ┌────────────────────┐    ┌──────────────────────────────┐ │
│  │  키오스크 프론트엔드  │    │  관리자 대시보드              │ │
│  │  / (루트 경로)       │    │  /admin/* (관리자 경로)       │ │
│  │  GET /api/cms/*     │    │  /api/admin/* (관리자 API)   │ │
│  │  GET /api/books/*   │    │  /api/auth/* (인증 API)     │ │
│  │  GET /api/loans/*   │    │                              │ │
│  └────────────────────┘    └──────────────────────────────┘ │
│                           │                                 │
│                     ┌─────▼──────┐                          │
│                     │  Prisma 6  │                          │
│                     │  SQLite    │                          │
│                     │  (WAL 모드) │                          │
│                     └────────────┘                          │
│                           │                                 │
│               ┌───────────▼───────────┐                    │
│               │  /public/uploads/cms/ │                    │
│               │  (정적 이미지 서빙)     │                    │
│               └───────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 빌드 설정

```typescript
// next.config.ts

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',    // 독립 실행 번들 (단일 보드 배포)

  // 관리자 대시보드 전용 이미지 최적화
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [768, 1024, 1280, 1920],  // 반응형 브레이크포인트
  },

  // 번들 분석 (개발 시)
  ...(process.env.ANALYZE === 'true' && {
    experimental: {
      webpackMemoryOptimizations: true,
    },
  }),

  // 보안 헤더
  async headers() {
    return [
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },           // 클릭재킹 방어
          { key: 'X-Content-Type-Options', value: 'nosniff' },  // MIME 스니핑 방어
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },  // 검색엔진 색인 방지
        ],
      },
    ];
  },
};

export default nextConfig;
```

### 10.3 환경 변수

```bash
# .env.production

# ─── 데이터베이스 ───
DATABASE_URL="file:./prod.db"

# ─── JWT 인증 ───
JWT_ACCESS_SECRET="최소32바이트_랜덤_시크릿_문자열"
JWT_REFRESH_SECRET="최소32바이트_다른_랜덤_시크릿_문자열"

# ─── 관리자 초기 계정 (최초 시드 시에만 사용) ───
ADMIN_SEED_EMAIL="admin@library.go.kr"
ADMIN_SEED_PASSWORD="초기_비밀번호_8자이상_대소문자숫자특수문자"
ADMIN_SEED_NAME="시스템 관리자"

# ─── 파일 업로드 ───
UPLOAD_DIR="/public/uploads/cms"
MAX_IMAGE_SIZE_BYTES="5242880"   # 5MB

# ─── 앱 설정 ───
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="production"
```

### 10.4 SQLite 운영 설정

```typescript
// src/lib/db.ts

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { emit: 'stdout', level: 'warn' },
      { emit: 'stdout', level: 'error' },
      ...(process.env.NODE_ENV === 'development'
        ? [{ emit: 'stdout', level: 'query' as const }]
        : []),
    ],
    datasourceUrl: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// SQLite WAL 모드 활성화 (Prisma 미지원 → raw query)
await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL');
await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000');       // 5초 잠금 대기
await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL');       // 성능/안정성 균형
await prisma.$executeRawUnsafe('PRAGMA cache_size = -64000');        // 64MB 캐시
await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');          // FK 제약 활성화
```

### 10.5 정적 이미지 서빙

```typescript
// Next.js가 /public 아래의 파일을 자동으로 정적 서빙한다.
// /public/uploads/cms/ 경로의 이미지는 추가 설정 없이 접근 가능.

// 이미지 정리 스케줄러 (사용되지 않는 이미지 삭제)
// src/lib/admin/cleanup.ts

import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'cms');

/**
 * 사용되지 않는 CMS 이미지 정리
 * DB의 CmsContent에서 참조되지 않는 파일을 삭제
 */
export async function cleanupUnusedImages(): Promise<number> {
  // 1. DB에서 모든 이미지 CMS 값 수집
  const imageRecords = await prisma.cmsContent.findMany({
    where: { type: 'image' },
  });

  const referencedUrls = new Set<string>();
  for (const record of imageRecords) {
    try {
      const parsed = JSON.parse(record.value);
      if (parsed.url) referencedUrls.add(parsed.url);
      if (parsed.thumbnailUrl) referencedUrls.add(parsed.thumbnailUrl);
    } catch {}
  }

  // 2. 업로드 디렉터리의 모든 파일 나열
  const files = await fs.readdir(UPLOAD_DIR);

  // 3. 참조되지 않는 파일 삭제
  let deletedCount = 0;
  for (const file of files) {
    const url = `/uploads/cms/${file}`;
    if (!referencedUrls.has(url)) {
      await fs.unlink(path.join(UPLOAD_DIR, file));
      deletedCount++;
    }
  }

  return deletedCount;
}
```

### 10.6 백업 및 복원

```typescript
// src/app/api/admin/settings/backup/route.ts

import { withAdminAuth } from '@/lib/admin/rbac';
import fs from 'fs/promises';
import path from 'path';

/** DB 백업 다운로드 (super_admin 전용) */
export const GET = withAdminAuth(async (request, { auth }) => {
  const dbPath = path.join(process.cwd(), 'prisma', 'prod.db');

  // SQLite 파일 복사 (WAL 모드에서도 안전한 온라인 백업)
  const buffer = await fs.readFile(dbPath);

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/x-sqlite3',
      'Content-Disposition': `attachment; filename="library-backup-${Date.now()}.db"`,
      'Content-Length': buffer.length.toString(),
    },
  });
}, 'settings:write');
```

### 10.7 배포 체크리스트

| 항목 | 확인 | 비고 |
|------|:----:|------|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` 설정 | ☐ | 프로덕션 전용 랜덤 시크릿 |
| SQLite WAL 모드 활성화 | ☐ | PRAGMA journal_mode = WAL |
| `/public/uploads/cms/` 디렉터리 생성 | ☐ | 쓰기 권한 확인 |
| 초기 super_admin 계정 시드 | ☐ | ADMIN_SEED_* 환경 변수 |
| HTTPS 적용 (Self-signed 또는 Let's Encrypt) | ☐ | 키오스크 내부망 |
| 보안 헤더 설정 (X-Frame-Options 등) | ☐ | next.config.ts headers() |
| 정적 이미지 서빙 확인 | ☐ | /uploads/cms/* 접근 테스트 |
| Rate Limiter 동작 확인 | ☐ | 100회/분 한도 |
| 감사 로그 기록 확인 | ☐ | 모든 mutation → AuditLog |
| 반응형 4개 브레이크포인트 레이아웃 | ☐ | 모바일/태블릿/21″/24″ |
| RBAC 3개 역할 권한 검증 | ☐ | super_admin/admin/operator |
| CMS 변경 → 3초 내 키오스크 반영 | ☐ | ETag 폴링 확인 |
| 번들 크기 ≤ 200KB (gzip) | ☐ | `ANALYZE=true npm run build` |

---

> **변경 이력**

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| v1.0.0 | 2026-03-05 | 최초 작성 | Dashboard Architecture Team |
