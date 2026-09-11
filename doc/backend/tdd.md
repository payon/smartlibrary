# 스마트 도서관 키오스크 — 백엔드 관리자 대시보드 기술 설계 문서 (TDD)

> **버전**: v1.0.0  
> **작성일**: 2026-03-05  
> **상태**: Production-ready  
> **담당**: Backend Architecture Team  
> **참조**: [대시보드 TDD](../dashboard/tdd.md) · [대시보드 API](../dashboard/api.md) · [DB 설계](../dashboard/database.md) · [키오스크 TDD](../tdd.md)

---

## 목차

1. [기술 스택](#1-기술-스택)
2. [상태 관리 설계](#2-상태-관리-설계)
3. [RBAC 설계](#3-rbac-설계)
4. [콘텐츠 동기화 설계](#4-콘텐츠-동기화-설계)
5. [파일 업로드 설계](#5-파일-업로드-설계)
6. [보안 설계](#6-보안-설계)
7. [성능 설계](#7-성능-설계)
8. [오류 처리 설계](#8-오류-처리-설계)
9. [반응형 설계](#9-반응형-설계)
10. [배포 설계](#10-배포-설계)

---

## 1. 기술 스택

### 1.1 코어 프레임워크

| 계층 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **Framework** | Next.js | 16 | App Router, API Routes (Route Handlers), SSR/CSR 하이브리드 |
| **Language** | TypeScript | 5 | 정적 타입 검증, 인터페이스 정의, 컴파일 타임 검증 |
| **Runtime** | Bun | latest | 패키지 매니저, 개발 서버, 테스트 러너 |
| **Build** | Turbopack | 내장 | HMR, 번들링, 코드 스플리팅 |

### 1.2 프론트엔드 (관리자 대시보드 전용)

| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19 | UI 렌더링, Server/Client Components |
| Tailwind CSS | 4 | Utility-first 스타일링, 반응형 브레이크포인트 |
| shadcn/ui | New York | Radix UI 기반 접근성 준수 컴포넌트 (40+ 프리미티브 + 관리자 전용 확장) |
| Recharts | ^2.x | 대시보드 통계 차트 (BarChart, LineChart, PieChart, AreaChart) |
| React Hook Form | ^7.x | 폼 상태 관리, 성능 최적화 (비제어 컴포넌트) |
| Zod | ^4.x | 폼 검증 스키마, API 입력 검증 (React Hook Form Resolver) |
| Framer Motion | 12.x | 화면 전환 애니메이션, 사이드바 트랜지션 |
| Lucide React | latest | 아이콘 셋 (관리자 메뉴, 액션 버튼) |
| date-fns | latest | 날짜 포맷/계산 (통계 기간 필터, 감사 로그 타임스탬프) |
| Sonner | latest | 토스트 알림 (성공/오류/경고) |

#### shadcn/ui 관리자 전용 추가 컴포넌트

| 컴포넌트 | 용도 | 출처 |
|----------|------|------|
| `DataTable` | 도서/사용자/감사로그 CRUD 테이블 (정렬·필터·페이지네이션) | shadcn/ui Table 확장 |
| `CommandPalette` | 전역 검색·명령 팔레트 (⌘K) | shadcn/ui Command 기반 |
| `ConfirmDialog` | 삭제/비활성화 확인 다이얼로그 | shadcn/ui AlertDialog 래핑 |
| `ColorPicker` | CMS 색상 값 편집 (HEX + 컬러 피커) | 커스텀 (react-color 기반) |
| `ImageUploader` | 드래그앤드롭 이미지 업로드 | 커스텀 (react-dropzone 기반) |
| `StatsCard` | 통계 지표 카드 (값 + 트렌드 + 아이콘) | shadcn/ui Card 확장 |
| `PermissionGuard` | RBAC 권한 가드 래퍼 | 커스텀 |

### 1.3 백엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| Prisma | 6 | ORM, 스키마 관리, 타입 안전 쿼리, 마이그레이션 |
| SQLite | 3.x | WAL 모드, 임베디드 로컬 단일 파일 DB |
| Zod | ^4.x | API Route 입력 검증, 런타임 스키마 검증 |
| bcrypt | ^5.x | 관리자 비밀번호 해시 (salt rounds 12) |
| jose | ^5.x | JWT 발급/검증 (HS256, Edge Runtime 호환, Pure JS) |
| formidable | ^3.x | 멀티파트 파일 업로드 파싱 (이미지 업로드) |
| sharp | ^0.34.x | 이미지 리사이징, 썸네일 생성, WebP 변환 |
| dompurify | ^3.x | SVG 업로드 시 XSS sanitize |

### 1.4 상태 관리

| 기술 | 버전 | 용도 |
|------|------|------|
| Zustand | 5 | 클라이언트 전역 상태 (인증 상태, 사이드바, 알림) |
| TanStack Query | 5 | 서버 상태 캐싱/동기화, stale/refetch 관리, 캐시 무효화 (실시간 동기화) |

### 1.5 인증

| 기술 | 용도 |
|------|------|
| Custom JWT (jose) | Access Token (15분) + Refresh Token (7일, httpOnly 쿠키) |
| bcrypt (salt rounds 12) | 비밀번호 해시 저장/검증 |

### 1.6 패키지 의존성 제약

```
bcrypt       → Node.js native addon (Bun 호환 확인 필요)
jose         → Pure JS, Edge/Node/Bun 범용
formidable   → Node.js Stream 기반 (Next.js API Route 호환)
recharts     → Client bundle만, dynamic import로 code-split
sharp        → Node.js native addon (이미지 처리 전용, server-only)
react-hook-form → 비제어 컴포넌트 기반, 리렌더링 최소화
```

### 1.7 TypeScript 구성

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

### 1.8 디렉터리 구조

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
│       └── content/
│           └── version/route.ts        # GET 콘텐츠 버전 (키오스크 폴링용)
├── lib/
│   ├── admin/
│   │   ├── auth.ts                     # JWT 발급/검증, bcrypt 해시
│   │   ├── rbac.ts                     # RBAC 권한 매핑, 미들웨어
│   │   ├── rate-limit.ts               # Rate Limiting (메모리 기반)
│   │   ├── audit.ts                    # 감사 로그 기록 헬퍼
│   │   ├── upload.ts                   # 파일 업로드, 검증, 저장
│   │   ├── cms-defaults.ts             # CMS 기본값 정의
│   │   └── content-sync.ts            # 콘텐츠 버전 관리, 동기화
│   └── db.ts                           # Prisma 클라이언트 싱글톤
├── stores/
│   └── admin/
│       └── useAdminStore.ts            # 관리자 통합 상태 (Zustand)
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
│       ├── DataTable.tsx                # CRUD 데이터 테이블
│       ├── ConfirmDialog.tsx            # 확인 다이얼로그
│       ├── PermissionGuard.tsx          # 권한 가드 컴포넌트
│       └── CommandPalette.tsx           # 전역 명령 팔레트
└── types/
    └── admin.ts                        # 관리자 도메인 타입 정의
```

---

## 2. 상태 관리 설계

### 2.1 Admin Zustand Store (`useAdminStore`)

관리자 대시보드의 클라이언트 전역 상태는 단일 Zustand 스토어로 관리한다. 서버 데이터(도서, 사용자, CMS 콘텐츠 등)는 TanStack Query가 담당하고, 인증·UI 상태만 Zustand가 관리하는 **관심사 분리** 원칙을 따른다.

```typescript
// src/stores/admin/useAdminStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 관리자 역할 */
export type AdminRole = 'super_admin' | 'admin' | 'operator';

/** 관리자 섹션 (사이드바 메뉴) */
export type AdminSection =
  | 'dashboard'     // 통계 대시보드
  | 'content'       // CMS 콘텐츠 관리
  | 'books'         // 도서 관리
  | 'users'         // 이용자 관리
  | 'accounts'      // 관리자 계정 관리
  | 'audit'         // 감사 로그
  | 'notices'       // 공지 관리
  | 'settings';     // 시스템 설정

/** 관리자 사용자 정보 */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  permissions: string[];
}

/** 알림 항목 */
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: number;
  read: boolean;
}

/** 관리자 스토어 인터페이스 */
export interface AdminStore {
  // ─── 인증 상태 ───────────────────────────────
  user: AdminUser | null;
  isAuthenticated: boolean;
  role: AdminRole | null;
  accessToken: string | null;
  lastActivityAt: number;              // 비활동 감지용

  // ─── UI 상태 ─────────────────────────────────
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;           // 아이콘 전용 모드
  activeSection: AdminSection;
  commandPaletteOpen: boolean;

  // ─── 알림 상태 ───────────────────────────────
  notifications: Notification[];
  unreadCount: number;

  // ─── 인증 액션 ───────────────────────────────
  login: (user: AdminUser, accessToken: string) => void;
  logout: () => void;
  setAccessToken: (token: string) => void;
  updateLastActivity: () => void;

  // ─── 권한 액션 ───────────────────────────────
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (role: AdminRole) => boolean;

  // ─── UI 액션 ─────────────────────────────────
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveSection: (section: AdminSection) => void;
  setCommandPaletteOpen: (open: boolean) => void;

  // ─── 알림 액션 ───────────────────────────────
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
}
```

### 2.2 스토어 구현

```typescript
// src/stores/admin/useAdminStore.ts (계속)

export const useAdminStore = create<AdminStore>()(
  persist(
    (set, get) => ({
      // ─── 초기값 ────────────────────────────────
      user: null,
      isAuthenticated: false,
      role: null,
      accessToken: null,
      lastActivityAt: Date.now(),
      sidebarOpen: true,
      sidebarCollapsed: false,
      activeSection: 'dashboard',
      commandPaletteOpen: false,
      notifications: [],
      unreadCount: 0,

      // ─── 인증 액션 ─────────────────────────────
      login: (user, accessToken) => set({
        user,
        isAuthenticated: true,
        role: user.role,
        accessToken,
        lastActivityAt: Date.now(),
      }),

      logout: () => set({
        user: null,
        isAuthenticated: false,
        role: null,
        accessToken: null,
        lastActivityAt: 0,
        notifications: [],
        unreadCount: 0,
      }),

      setAccessToken: (token) => set({ accessToken: token }),

      updateLastActivity: () => set({ lastActivityAt: Date.now() }),

      // ─── 권한 액션 ─────────────────────────────
      hasPermission: (permission) => {
        const { user } = get();
        return user?.permissions.includes(permission) ?? false;
      },

      hasAnyPermission: (permissions) => {
        const { user } = get();
        return permissions.some(p => user?.permissions.includes(p) ?? false);
      },

      hasRole: (role) => {
        const { user } = get();
        return user?.role === role;
      },

      // ─── UI 액션 ───────────────────────────────
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setActiveSection: (section) => set({ activeSection: section }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      // ─── 알림 액션 ─────────────────────────────
      addNotification: (notification) => set((s) => {
        const newNotification: Notification = {
          ...notification,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          read: false,
        };
        return {
          notifications: [newNotification, ...s.notifications].slice(0, 50),
          unreadCount: s.unreadCount + 1,
        };
      }),

      markNotificationRead: (id) => set((s) => ({
        notifications: s.notifications.map(n =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      })),

      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
    }),
    {
      name: 'admin-store',               // localStorage 키
      partialize: (state) => ({          // 영속화할 필드만 선택
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        role: state.role,
        sidebarCollapsed: state.sidebarCollapsed,
        activeSection: state.activeSection,
      }),
    }
  )
);
```

### 2.3 TanStack Query 설정 (서버 상태)

```typescript
// src/app/admin/providers.tsx

import { QueryClient } from '@tanstack/react-query';

export const adminQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,          // 5분 (CMS 콘텐츠)
      gcTime: 10 * 60 * 1000,            // 10분 (가비지 컬렉션)
      retry: 2,
      refetchOnWindowFocus: false,        // 관리자 대시보드는 수동 갱신
      refetchOnReconnect: true,           // 네트워크 복구 시 자동 갱신
    },
    mutations: {
      retry: 1,
    },
  },
});

/** 쿼리 키 팩토리 */
export const adminQueryKeys = {
  cms: {
    all:      ['admin', 'cms'] as const,
    content:  (key?: string) => ['admin', 'cms', 'content', key] as const,
    version:  ['admin', 'cms', 'version'] as const,
  },
  books: {
    all:      ['admin', 'books'] as const,
    list:     (filters: object) => ['admin', 'books', 'list', filters] as const,
    detail:   (id: string) => ['admin', 'books', 'detail', id] as const,
  },
  users: {
    all:      ['admin', 'users'] as const,
    list:     (filters: object) => ['admin', 'users', 'list', filters] as const,
    detail:   (id: string) => ['admin', 'users', 'detail', id] as const,
  },
  stats: {
    all:      ['admin', 'stats'] as const,
    today:    ['admin', 'stats', 'today'] as const,
    hourly:   (days: number) => ['admin', 'stats', 'hourly', days] as const,
    topBooks: ['admin', 'stats', 'topBooks'] as const,
    recent:   ['admin', 'stats', 'recent'] as const,
  },
  audit: {
    all:      ['admin', 'audit'] as const,
    list:     (filters: object) => ['admin', 'audit', 'list', filters] as const,
  },
  accounts: {
    all:      ['admin', 'accounts'] as const,
    list:     (filters: object) => ['admin', 'accounts', 'list', filters] as const,
  },
  notices: {
    all:      ['admin', 'notices'] as const,
    list:     ['admin', 'notices', 'list'] as const,
  },
};
```

### 2.4 캐시 무효화 전략 (실시간 동기화)

```typescript
// 관리자가 CMS 콘텐츠를 수정한 후 관련 캐시를 즉시 무효화
async function onCmsContentUpdated() {
  await adminQueryClient.invalidateQueries({ queryKey: adminQueryKeys.cms.all });
  await adminQueryClient.invalidateQueries({ queryKey: adminQueryKeys.cms.version });
}

// 도서가 추가/수정/삭제된 후
async function onBooksChanged() {
  await adminQueryClient.invalidateQueries({ queryKey: adminQueryKeys.books.all });
  await adminQueryClient.invalidateQueries({ queryKey: adminQueryKeys.stats.all });
}

// 대출/반납 발생 후 (통계 갱신)
async function onLoanActivity() {
  await adminQueryClient.invalidateQueries({ queryKey: adminQueryKeys.stats.all });
}
```

---

## 3. RBAC 설계

### 3.1 역할 정의

```typescript
// src/types/admin.ts

/** 관리자 역할 enum */
export type AdminRole = 'super_admin' | 'admin' | 'operator';

/** 역할 메타데이터 */
export const ROLE_METADATA: Record<AdminRole, { label: string; description: string; level: number }> = {
  super_admin: {
    label: '슈퍼 관리자',
    description: '시스템 전체 권한. 다른 관리자 계정 생성·권한 부여 가능',
    level: 3,
  },
  admin: {
    label: '관리자',
    description: 'CMS 콘텐츠·도서·사용자 관리 + 통계 조회. 계정 관리 불가',
    level: 2,
  },
  operator: {
    label: '운영자',
    description: '도서·사용자 조회 + 대출·반납 통계만 조회. 콘텐츠 변경 불가',
    level: 1,
  },
};
```

### 3.2 권한 식별자

```typescript
// src/lib/admin/rbac.ts

/** 시스템 내 모든 권한 식별자 */
export type Permission =
  // CMS 콘텐츠
  | 'cms:read'           | 'cms:write'
  // 도서 관리
  | 'books:read'         | 'books:write'       | 'books:delete'      | 'books:import'
  // 이용자 관리
  | 'users:read'         | 'users:write'       | 'users:deactivate'
  // 관리자 계정
  | 'accounts:read'      | 'accounts:write'    | 'accounts:deactivate'
  // 통계
  | 'stats:read'         | 'stats:export'
  // 감사 로그
  | 'audit:read'         | 'audit:export'
  // 공지
  | 'notices:read'       | 'notices:write'     | 'notices:delete'
  // 시스템 설정
  | 'settings:read'      | 'settings:write'    | 'settings:backup'   | 'settings:reset';
```

### 3.3 권한 매트릭스 (Resource × Action → 허용 역할)

| 기능 영역 | 세부 권한 | super_admin | admin | operator |
|-----------|-----------|:-----------:|:-----:|:--------:|
| **CMS 콘텐츠** | `cms:read` | ✅ | ✅ | ✅ |
| | `cms:write` | ✅ | ✅ | ❌ |
| **도서 관리** | `books:read` | ✅ | ✅ | ✅ |
| | `books:write` | ✅ | ✅ | ❌ |
| | `books:delete` | ✅ | ✅ | ❌ |
| | `books:import` | ✅ | ✅ | ❌ |
| **이용자 관리** | `users:read` | ✅ | ✅ | ✅ |
| | `users:write` | ✅ | ✅ | ❌ |
| | `users:deactivate` | ✅ | ✅ | ❌ |
| **관리자 계정** | `accounts:read` | ✅ | ❌ | ❌ |
| | `accounts:write` | ✅ | ❌ | ❌ |
| | `accounts:deactivate` | ✅ | ❌ | ❌ |
| **통계** | `stats:read` | ✅ | ✅ | ✅ |
| | `stats:export` | ✅ | ✅ | ❌ |
| **감사 로그** | `audit:read` | ✅ | ✅ | ❌ |
| | `audit:export` | ✅ | ❌ | ❌ |
| **공지** | `notices:read` | ✅ | ✅ | ✅ |
| | `notices:write` | ✅ | ✅ | ❌ |
| | `notices:delete` | ✅ | ✅ | ❌ |
| **시스템 설정** | `settings:read` | ✅ | ❌ | ❌ |
| | `settings:write` | ✅ | ❌ | ❌ |
| | `settings:backup` | ✅ | ❌ | ❌ |
| | `settings:reset` | ✅ | ❌ | ❌ |

### 3.4 역할-권한 매핑 구현

```typescript
// src/lib/admin/rbac.ts (계속)

/** 역할별 권한 매핑 */
const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: [
    'cms:read', 'cms:write',
    'books:read', 'books:write', 'books:delete', 'books:import',
    'users:read', 'users:write', 'users:deactivate',
    'accounts:read', 'accounts:write', 'accounts:deactivate',
    'stats:read', 'stats:export',
    'audit:read', 'audit:export',
    'notices:read', 'notices:write', 'notices:delete',
    'settings:read', 'settings:write', 'settings:backup', 'settings:reset',
  ],
  admin: [
    'cms:read', 'cms:write',
    'books:read', 'books:write', 'books:delete', 'books:import',
    'users:read', 'users:write', 'users:deactivate',
    'stats:read', 'stats:export',
    'audit:read',
    'notices:read', 'notices:write', 'notices:delete',
  ],
  operator: [
    'cms:read',
    'books:read',
    'users:read',
    'stats:read',
    'notices:read',
  ],
};

/** 역할의 권한 목록 조회 */
export function getPermissionsForRole(role: AdminRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** 권한 보유 여부 확인 */
export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** 여러 권한 중 하나라도 보유한지 확인 */
export function hasAnyPermission(role: AdminRole, permissions: Permission[]): boolean {
  const rolePerms = ROLE_PERMISSIONS[role] ?? [];
  return permissions.some(p => rolePerms.includes(p));
}
```

### 3.5 JWT 토큰 구조

```typescript
/** JWT Access Token 페이로드 */
export interface AccessTokenPayload {
  sub: string;                // AdminUser.id
  email: string;
  role: AdminRole;
  permissions: Permission[];  // 미리 계산된 권한 목록 (매 요청마다 DB 조회 회피)
  iat: number;                // 발급 시각
  exp: number;                // 만료 시각
}

/** JWT Refresh Token 페이로드 */
export interface RefreshTokenPayload {
  sub: string;                // AdminUser.id
  tokenVersion: number;       // 토큰 버전 (강제 무효화용 — 비밀번호 변경 시 증가)
  iat: number;
  exp: number;
}
```

### 3.6 RBAC 미들웨어 구현

```typescript
// src/lib/admin/rbac.ts (계속)

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from './auth';

/** 인증 + 권한 검사 미들웨어 */
export function withAuth(
  handler: (request: NextRequest, context: { params: Record<string, string> }) => Promise<NextResponse>,
  requiredPermission: Permission
) {
  return async (request: NextRequest, context: { params: Record<string, string> }) => {
    try {
      // 1. Authorization 헤더에서 Access Token 추출
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: '인증 토큰이 필요합니다.' } },
          { status: 401 }
        );
      }

      const token = authHeader.slice(7);

      // 2. JWT 검증
      const payload = await verifyAccessToken(token);

      // 3. 권한 검사
      if (!payload.permissions.includes(requiredPermission)) {
        // 감사 로그: 권한 거부 기록
        await logAuditEvent({
          action: 'PERMISSION_DENIED',
          entity: 'RBAC',
          performedBy: payload.sub,
          details: { requiredPermission, userRole: payload.role },
        });

        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' } },
          { status: 403 }
        );
      }

      // 4. 요청 컨텍스트에 사용자 정보 첨부 (커스텀 헤더)
      const response = await handler(request, context);
      return response;

    } catch (error) {
      if (error instanceof Error && error.name === 'JWTExpired') {
        return NextResponse.json(
          { error: { code: 'TOKEN_EXPIRED', message: '인증 토큰이 만료되었습니다.' } },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '유효하지 않은 토큰입니다.' } },
        { status: 401 }
      );
    }
  };
}
```

### 3.7 클라이언트 권한 가드 컴포넌트

```tsx
// src/components/admin/PermissionGuard.tsx

import { useAdminStore } from '@/stores/admin/useAdminStore';

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
  const hasPermission = useAdminStore((s) => s.hasPermission(permission));

  if (!hasPermission) return <>{fallback}</>;
  return <>{children}</>;
}

// 사용 예시:
// <PermissionGuard permission="books:write" fallback={<ReadOnlyView />}>
//   <BookEditForm />
// </PermissionGuard>
```

---

## 4. 콘텐츠 동기화 설계

### 4.1 콘텐츠 버저닝 메커니즘

관리자가 CMS 콘텐츠를 수정할 때마다 **글로벌 버전 카운터**가 증가한다. 키오스크는 주기적으로 이 버전을 폴링하여, 자신이 보유한 캐시 버전과 다르면 전체 콘텐츠를 재조회한다.

```typescript
// src/lib/admin/content-sync.ts

import { prisma } from '@/lib/db';

/** 콘텐츠 버전 조회 */
export async function getContentVersion(): Promise<number> {
  const setting = await prisma.systemSetting.upsert({
    where: { key: 'content_version' },
    create: { key: 'content_version', value: '1', updatedAt: new Date() },
    update: {},
  });
  return parseInt(setting.value, 10);
}

/** 콘텐츠 버전 증가 (관리자가 콘텐츠를 수정할 때 호출) */
export async function incrementContentVersion(): Promise<number> {
  const current = await getContentVersion();
  const next = current + 1;

  await prisma.systemSetting.upsert({
    where: { key: 'content_version' },
    create: { key: 'content_version', value: String(next), updatedAt: new Date() },
    update: { value: String(next), updatedAt: new Date() },
  });

  return next;
}

/** 콘텐츠 해시 조회 (선택적 — 대규모 콘텐츠에서 diff 감지용) */
export async function getContentHash(): Promise<string> {
  const contents = await prisma.cmsContent.findMany({
    orderBy: { key: 'asc' },
    select: { key: true, value: true, updatedAt: true },
  });

  // 간단한 해시 (버전 + 레코드 수 + 최근 수정 시각의 조합)
  const version = await getContentVersion();
  const lastUpdated = contents[contents.length - 1]?.updatedAt?.getTime() ?? 0;
  return `v${version}:n${contents.length}:t${lastUpdated}`;
}
```

### 4.2 폴링 전략 (키오스크 → 서버)

```
┌──────────────┐   GET /api/content/version   ┌───────────────────┐
│  Kiosk Client │ ───────────────────────────► │  Next.js API      │
│  (every 30s)  │                              │                   │
│              │ ◄─────────────────────────── │  { version: 42 }  │
└──────────────┘                              └───────────────────┘
     │
     │ localVersion !== serverVersion
     ▼
┌──────────────┐   GET /api/cms/content       ┌───────────────────┐
│  Kiosk Client │ ───────────────────────────► │  Next.js API      │
│              │ ◄─────────────────────────── │  { contents: [] } │
│              │   cache: update local store   │                   │
└──────────────┘                              └───────────────────┘
```

### 4.3 키오스크 폴링 훅

```typescript
// src/hooks/admin/useCmsPolling.ts

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const POLLING_INTERVAL = 30_000;  // 30초

/** 키오스크 CMS 폴링 훅 */
export function useCmsPolling() {
  const queryClient = useQueryClient();
  const localVersionRef = useRef<number>(0);

  // 버전 폴링
  const { data: versionData } = useQuery({
    queryKey: ['cms', 'version'],
    queryFn: async () => {
      const res = await fetch('/api/content/version');
      return res.json() as Promise<{ version: number; hash: string }>;
    },
    refetchInterval: POLLING_INTERVAL,
    staleTime: POLLING_INTERVAL,
  });

  // 버전 변경 감지 → 전체 콘텐츠 갱신
  useEffect(() => {
    if (versionData && versionData.version !== localVersionRef.current) {
      localVersionRef.current = versionData.version;
      // TanStack Query 캐시 무효화 → 자동 refetch
      queryClient.invalidateQueries({ queryKey: ['cms', 'content'] });
    }
  }, [versionData, queryClient]);
}
```

### 4.4 관리자 콘텐츠 업데이트 흐름

```
┌────────────┐  PUT /api/admin/cms/content   ┌─────────────────────┐
│  Admin UI  │ ─────────────────────────────► │  API Route          │
│            │                                │  1. RBAC 검사        │
│            │                                │  2. Zod 스키마 검증   │
│            │                                │  3. DB 업데이트      │
│            │                                │  4. version 증가     │
│            │                                │  5. 감사 로그 기록   │
│            │ ◄───────────────────────────── │  6. 캐시 무효화     │
│            │  { success: true, version: 43 } │  7. 응답            │
└────────────┘                                └─────────────────────┘
```

### 4.5 TanStack Query 실시간 동기화 통합

```typescript
// CMS 콘텐츠 갱신 뮤테이션
const updateCmsMutation = useMutation({
  mutationFn: async (data: { key: string; value: string }) => {
    const token = useAdminStore.getState().accessToken;
    const res = await fetch('/api/admin/cms/content', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('CMS 업데이트 실패');
    return res.json();
  },
  onSuccess: () => {
    // 관리자 대시보드: 로컬 캐시 무효화 → 즉시 UI 갱신
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.cms.all });
    // 키오스크: 다음 폴링 주기(≤30초)에 자동 감지
    // 버전은 서버에서 이미 증가됨
  },
});
```

### 4.6 동기화 타이밍 요구사항

| 항목 | 값 | 설명 |
|------|-----|------|
| 폴링 간격 | 30초 | 키오스크가 `/api/content/version` 조회 주기 |
| 반영 지연 | ≤ 30초 | 관리자 저장 후 키오스크 반영까지 최대 시간 |
| 관리자 UI | 즉시 | TanStack Query 캐시 무효화로 관리자 화면은 즉시 갱신 |
| 버전 증가 | 원자적 | SQLite 쓰기 직렬화로 동시 업데이트 시 버전 누락 없음 |

---

## 5. 파일 업로드 설계

### 5.1 이미지 업로드 흐름

```
┌──────────────┐   FormData (multipart)    ┌───────────────────────┐
│  Admin UI    │ ─────────────────────────► │  POST /api/admin/cms/ │
│  (Drag&Drop  │                            │       upload          │
│   or Select) │                            │  1. MIME 검증         │
│              │                            │  2. 파일 크기 검증     │
│              │                            │  3. SVG sanitize      │
│              │                            │  4. Sharp 리사이즈     │
│              │                            │  5. WebP 변환          │
│              │                            │  6. /public/uploads/   │
│              │                            │     저장               │
│              │ ◄───────────────────────── │  7. DB CmsImage 레코드│
│              │  { url, thumbnailUrl }      │  8. 응답              │
└──────────────┘                            └───────────────────────┘
```

### 5.2 지원 포맷 및 제한

| 포맷 | MIME 타입 | 최대 크기 | 용도 |
|------|-----------|-----------|------|
| **PNG** | `image/png` | 2MB | 로고, 아이콘 (투명 배경) |
| **JPEG** | `image/jpeg` | 2MB | 배경 이미지, 사진 |
| **SVG** | `image/svg+xml` | 50KB | 버튼 아이콘, 벡터 그래픽 |
| **WebP** | `image/webp` | 2MB | 최적화된 래스터 이미지 |

### 5.3 이미지 업로드 API 구현

```typescript
// src/lib/admin/upload.ts

import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import DOMPurify from 'dompurify';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_FILE_SIZE = 2 * 1024 * 1024;     // 2MB
const MAX_SVG_SIZE = 50 * 1024;             // 50KB
const THUMBNAIL_WIDTH = 200;

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/webp',
]);

/** 파일 검증 */
export function validateUpload(file: File): { valid: boolean; error?: string } {
  // MIME 타입 검증
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { valid: false, error: `지원하지 않는 파일 형식입니다: ${file.type}` };
  }

  // 파일 크기 검증
  const maxSize = file.type === 'image/svg+xml' ? MAX_SVG_SIZE : MAX_FILE_SIZE;
  if (file.size > maxSize) {
    const maxLabel = file.type === 'image/svg+xml' ? '50KB' : '2MB';
    return { valid: false, error: `파일 크기가 ${maxLabel}를 초과합니다.` };
  }

  return { valid: true };
}

/** SVG sanitize */
export function sanitizeSvg(svgContent: string): string {
  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}

/** 이미지 처리 및 저장 */
export async function processAndSaveImage(
  file: File,
  category: string   // 'logos' | 'icons' | 'backgrounds' | 'covers'
): Promise<{ url: string; thumbnailUrl: string | null }> {
  // 업로드 디렉터리 보장
  const categoryDir = path.join(UPLOAD_DIR, category);
  await mkdir(categoryDir, { recursive: true });

  const fileId = crypto.randomUUID();
  const isSvg = file.type === 'image/svg+xml';

  if (isSvg) {
    // SVG: sanitize 후 그대로 저장
    const content = await file.text();
    const sanitized = sanitizeSvg(content);
    const filename = `${fileId}.svg`;
    await writeFile(path.join(categoryDir, filename), sanitized);
    return {
      url: `/uploads/${category}/${filename}`,
      thumbnailUrl: null,   // SVG는 썸네일 불필요
    };
  }

  // 래스터 이미지: Sharp로 리사이즈 + WebP 변환
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${fileId}.webp`;

  // 원본 저장 (WebP 변환, 최대 1920px)
  await sharp(buffer)
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(path.join(categoryDir, filename));

  // 썸네일 생성
  const thumbFilename = `${fileId}_thumb.webp`;
  await sharp(buffer)
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_WIDTH, { fit: 'inside' })
    .webp({ quality: 70 })
    .toFile(path.join(categoryDir, thumbFilename));

  return {
    url: `/uploads/${category}/${filename}`,
    thumbnailUrl: `/uploads/${category}/${thumbFilename}`,
  };
}
```

### 5.4 이미지 최적화 전략

| 단계 | 처리 | 도구 |
|------|------|------|
| 업로드 시 | WebP 변환 (85% 품질) | Sharp |
| 업로드 시 | 최대 너비 1920px 리사이즈 | Sharp |
| 업로드 시 | 200px 썸네일 자동 생성 | Sharp |
| 렌더링 시 | Next.js `<Image>` 자동 srcset | Next.js Image Optimization |
| SVG | XSS sanitize (script/event 핸들러 제거) | DOMPurify |

### 5.5 파일 시스템 구조

```
public/
└── uploads/
    ├── logos/          # 로고 이미지
    │   ├── {uuid}.webp
    │   └── {uuid}_thumb.webp
    ├── icons/          # 버튼 아이콘 (SVG 포함)
    │   ├── {uuid}.webp
    │   ├── {uuid}.svg
    │   └── {uuid}_thumb.webp
    ├── backgrounds/    # 배경 이미지
    │   ├── {uuid}.webp
    │   └── {uuid}_thumb.webp
    └── covers/         # 도서 표지
        ├── {uuid}.webp
        └── {uuid}_thumb.webp
```

---

## 6. 보안 설계

### 6.1 비밀번호 해시

```typescript
// src/lib/admin/auth.ts

import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;   // 보안 강도: 연산 시간 ~300ms

/** 비밀번호 해시 생성 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/** 비밀번호 검증 */
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

  if (password.length < 8)                errors.push('비밀번호는 8자 이상이어야 합니다.');
  if (!/[a-z]/.test(password))            errors.push('소문자를 포함해야 합니다.');
  if (!/[A-Z]/.test(password))            errors.push('대문자를 포함해야 합니다.');
  if (!/[0-9]/.test(password))            errors.push('숫자를 포함해야 합니다.');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
                                          errors.push('특수문자를 포함해야 합니다.');

  return { valid: errors.length === 0, errors };
}
```

### 6.2 JWT 토큰 관리

```typescript
// src/lib/admin/auth.ts (계속)

import { SignJWT, jwtVerify } from 'jose';

const ACCESS_TOKEN_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
const REFRESH_TOKEN_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET!);

const ACCESS_TOKEN_TTL = '15m';    // 15분
const REFRESH_TOKEN_TTL = '7d';    // 7일

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
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, ACCESS_TOKEN_SECRET, {
    issuer: 'smart-library-admin',
    audience: 'admin-api',
  });
  return payload as unknown as AccessTokenPayload;
}
```

### 6.3 Refresh Token 쿠키 설정

```typescript
// src/lib/admin/auth.ts (계속)

import { cookies } from 'next/headers';

/** Refresh Token을 httpOnly 쿠키로 설정 */
export function setRefreshTokenCookie(token: string): void {
  cookies().set('refresh_token', token, {
    httpOnly: true,                             // JS 접근 불가 (XSS 방어)
    secure: process.env.NODE_ENV === 'production',  // HTTPS 전용 (개발은 제외)
    sameSite: 'strict',                        // CSRF 방어
    path: '/api/auth',                         // /api/auth 경로에서만 전송
    maxAge: 7 * 24 * 60 * 60,                  // 7일 (초)
  });
}

/** Refresh Token 쿠키 삭제 (로그아웃) */
export function clearRefreshTokenCookie(): void {
  cookies().delete('refresh_token');
}
```

### 6.4 토큰 수명 및 보안 파라미터

| 항목 | 값 | 설명 |
|------|-----|------|
| Access Token 수명 | 15분 | 짧은 수명으로 탈취 시 피해 최소화 |
| Refresh Token 수명 | 7일 | httpOnly + SameSite=Strict 쿠키 |
| Refresh Token Rotation | 매 갱신 시 새 토큰 발급 | 이전 토큰 무효화 (재사용 탐지) |
| Token Version | 비밀번호 변경 시 증가 | 모든 기존 Refresh Token 강제 무효화 |
| 비활동 로그아웃 | 30분 | 클라이언트에서 `lastActivityAt` 기반 |
| 로그인 실패 잠금 | 5회 연속 실패 → 15분 잠금 | 브루트포스 방지 |

### 6.5 CSRF 보호

```typescript
// Double Submit Cookie 패턴
// 1. Refresh Token: SameSite=Strict + httpOnly → CSRF 자동 방어
// 2. Access Token: Authorization 헤더 (쿠키 아님) → CSRF 영향 없음
// 3. 추가 보호: 커스텀 X-CSRF-Token 헤더 + 쿠키 매칭

/** CSRF 토큰 생성 (세션 시작 시) */
export function generateCsrfToken(): string {
  return crypto.randomUUID();
}

/** CSRF 토큰 검증 */
export function validateCsrfToken(
  headerToken: string | null,
  cookieToken: string | null
): boolean {
  if (!headerToken || !cookieToken) return false;
  return headerToken === cookieToken;
}
```

### 6.6 Rate Limiting (관리자 API)

```typescript
// src/lib/admin/rate-limit.ts

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** 메모리 기반 Rate Limiter */
export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();

  constructor(
    private windowMs: number,     // 윈도우 시간 (ms)
    private maxRequests: number,  // 윈도우 내 최대 요청 수
  ) {}

  /** 요청 허용 여부 확인 */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // 윈도우 만료 → 카운터 리셋
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + this.windowMs;
      this.store.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt };
    }

    // 카운터 증가
    entry.count++;
    const remaining = Math.max(0, this.maxRequests - entry.count);
    return {
      allowed: entry.count <= this.maxRequests,
      remaining,
      resetAt: entry.resetAt,
    };
  }
}

/** 엔드포인트별 Rate Limiter 인스턴스 */
export const rateLimiters = {
  // 관리자 인증 API: 10회/5분 (브루트포스 방지)
  auth:     new RateLimiter(5 * 60_000, 10),
  // 일반 관리자 API: 100회/1분
  api:      new RateLimiter(60_000, 100),
  // 이미지 업로드: 20회/1분 (서버 부하 방지)
  upload:   new RateLimiter(60_000, 20),
  // PIN 검증: 5회/5분 (키오스크)
  pin:      new RateLimiter(5 * 60_000, 5),
};
```

### 6.7 콘텐츠 sanitize

```typescript
// 모든 사용자 입력에 대한 sanitize

/** 텍스트 콘텐츠 sanitize */
export function sanitizeText(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/** HEX 색상 값 검증 */
export function validateHexColor(value: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value);
}

/** URL 화이트리스트 검증 */
export function validateImageUrl(url: string): boolean {
  // /uploads/ 경로만 허용
  return /^\/uploads\/[a-z]+\/[a-f0-9-]+(\.webp|\.svg|\.png|\.jpg|_thumb\.webp)$/.test(url);
}
```

### 6.8 보안 헤더

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';

X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 6.9 로그인 실패 잠금 메커니즘

```typescript
// 로그인 실패 추적 (DB 기반)
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;  // 15분

/** 로그인 실패 처리 */
async function handleLoginFailure(email: string): Promise<{ locked: boolean; remainingAttempts: number }> {
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) return { locked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS };

  const newAttempts = (admin.loginAttempts ?? 0) + 1;
  const locked = newAttempts >= MAX_LOGIN_ATTEMPTS;

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      loginAttempts: newAttempts,
      lockedUntil: locked ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
    },
  });

  return {
    locked,
    remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - newAttempts),
  };
}

/** 잠금 상태 확인 */
async function isAccountLocked(email: string): Promise<boolean> {
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) return false;
  if (!admin.lockedUntil) return false;
  if (new Date() > admin.lockedUntil) {
    // 잠금 만료 → 리셋
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });
    return false;
  }
  return true;
}
```

---

## 7. 성능 설계

### 7.1 관리자 대시보드 Lazy Loading

```typescript
// src/app/admin/layout.tsx

import dynamic from 'next/dynamic';

// 통계 차트는 초기 번들에 포함하지 않음
const StatsCharts = dynamic(
  () => import('@/components/admin/StatsCharts'),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,   // Recharts는 CSR 전용
  }
);

// 감사 로그 테이블
const AuditLogTable = dynamic(
  () => import('@/components/admin/AuditLogTable'),
  { loading: () => <TableSkeleton rows={10} /> }
);

// 화면 미리보기 패널
const PreviewPanel = dynamic(
  () => import('@/components/admin/PreviewPanel'),
  { ssr: false }
);
```

### 7.2 번들 스플리팅 전략

| 모듈 | 로딩 전략 | 사유 |
|------|-----------|------|
| Recharts | `dynamic import` + `ssr: false` | 200KB+ 번들, 통계 페이지에서만 필요 |
| React Hook Form | 경로 기반 code-split | 폼 페이지에서만 필요 |
| Command Palette | `dynamic import` | ⌘K 단축키 활성화 시 로드 |
| Preview Panel | `dynamic import` + `ssr: false` | iframe, CMS 편집 시만 필요 |
| DOMPurify | server-only | 클라이언트 번들 미포함 |

### 7.3 이미지 최적화

| 단계 | 처리 | 예상 크기 감소 |
|------|------|----------------|
| 업로드 | Sharp WebP 변환 (85%) | PNG → WebP: ~30% 감소 |
| 업로드 | 최대 1920px 리사이즈 | 불필요한 고해상도 제거 |
| 썸네일 | 200px WebP (70%) | 목록 조회 시 대역폭 절약 |
| 렌더링 | Next.js `<Image>` 자동 srcset | 뷰포트에 맞는 크기 로드 |
| 렌더링 | `loading="lazy"` 기본값 | 뷰포트 외 이미지 지연 로드 |

### 7.4 콘텐츠 캐싱 전략

| 대상 | 캐시 계층 | TTL | 무효화 트리거 |
|------|-----------|-----|---------------|
| CMS 콘텐츠 (전체) | TanStack Query | 5분 (staleTime) | 관리자 PUT, 버전 변경 |
| CMS 콘텐츠 버전 | TanStack Query | 30초 (키오스크 폴링) | 자동 refetchInterval |
| 도서 목록 | TanStack Query | 5분 | CRUD mutation 성공 |
| 통계 데이터 | TanStack Query | 2분 | 대출/반납 발생 |
| 감사 로그 | TanStack Query | 1분 | 관리자 액션 발생 |
| DB 연결 | Prisma 싱글톤 | 프로세스 생존 | — |
| 정적 이미지 | Next.js Static | 무기한 (파일명에 UUID) | 파일 교체 시 새 URL |

### 7.5 통계 쿼리 최적화

```sql
-- 오늘의 대출 건수 (인덱스 활용)
SELECT COUNT(*) FROM SimLoan
WHERE date(loanDate) = date('now') AND status = 'active';

-- 시간대별 대출/반납 (단일 쿼리로 7일치 집계)
SELECT
  strftime('%H', loanDate) AS hour,
  COUNT(*) AS count
FROM SimLoan
WHERE loanDate >= date('now', '-7 days')
GROUP BY hour
ORDER BY hour;

-- 인기 도서 TOP 10 (인덱스 활용)
SELECT b.title, b.author, COUNT(l.id) AS loanCount
FROM SimLoan l
JOIN Book b ON b.id = l.bookId
WHERE l.loanDate >= date('now', '-30 days')
GROUP BY l.bookId
ORDER BY loanCount DESC
LIMIT 10;
```

### 7.6 데이터베이스 인덱스 전략

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| `SimLoan` | `(loanDate, status)` | 오늘 대출/반납 통계 |
| `SimLoan` | `(bookId, loanDate)` | 인기 도서 집계 |
| `SimLoan` | `(userId, status)` | 사용자 대출 현황 |
| `CmsContent` | `(key)` UNIQUE | 키 기반 단일 조회 |
| `AuditLog` | `(performedAt, entity)` | 감사 로그 기간 필터 |
| `AdminUser` | `(email)` UNIQUE | 로그인 이메일 조회 |

### 7.7 성능 지표 목표

| 항목 | 목표 | 측정 방법 |
|------|------|-----------|
| LCP (초기 로드) | ≤ 2초 | Lighthouse, 로컬 네트워크 |
| TTI | ≤ 3초 | Lighthouse |
| First Load JS | ≤ 200KB (gzip) | `next build` 출력 |
| DB 쿼리 (목록) | ≤ 100ms | 10,000건 기준 |
| DB 쿼리 (통계) | ≤ 200ms | 30일 집계 기준 |
| 이미지 업로드 | ≤ 3초 | 2MB 파일 기준 |
| CMS 반영 지연 | ≤ 30초 | 키오스크 폴링 주기 |

---

## 8. 오류 처리 설계

### 8.1 관리자 API 오류 응답 형식

```typescript
/** 통일된 API 오류 응답 */
interface ApiErrorResponse {
  error: {
    code: string;         // 기계 판독용 오류 코드
    message: string;      // 사람이 읽을 수 있는 한국어 메시지
    details?: unknown;    // 추가 정보 (검증 오류 필드 목록 등)
  };
}
```

### 8.2 관리자 API 오류 코드 체계

| 코드 | HTTP 상태 | 설명 | 클라이언트 액션 |
|------|-----------|------|-----------------|
| `BAD_REQUEST` | 400 | 잘못된 요청 파라미터 | 폼 오류 표시 |
| `VALIDATION_ERROR` | 400 | Zod 스키마 검증 실패 | 필드별 오류 하이라이트 |
| `UNAUTHORIZED` | 401 | JWT 누락/무효 | 로그인 페이지 리다이렉트 |
| `TOKEN_EXPIRED` | 401 | Access Token 만료 | 자동 Refresh Token 갱신 |
| `FORBIDDEN` | 403 | RBAC 권한 부족 | 권한 없음 토스트 |
| `NOT_FOUND` | 404 | 리소스 미존재 | 404 페이지 |
| `CONFLICT` | 409 | 중복 리소스 (이메일, ISBN) | 중복 안내 토스트 |
| `RATE_LIMITED` | 429 | 요청 한도 초과 | 재시도 안내 토스트 |
| `ACCOUNT_LOCKED` | 423 | 로그인 실패 잠금 | 잠금 해제 시간 안내 |
| `ACCOUNT_INACTIVE` | 403 | 비활성화 계정 | 관리자 연락 안내 |
| `UPLOAD_TOO_LARGE` | 413 | 파일 크기 초과 | 크기 제한 안내 |
| `INVALID_FILE_TYPE` | 415 | 지원하지 않는 MIME | 허용 포맷 안내 |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 | 오류 페이지 + 리포트 |

### 8.3 Zod 폼 검증 오류 처리

```typescript
// React Hook Form + Zod Resolver 통합
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 도서 등록 스키마
const bookSchema = z.object({
  title: z.string().min(1, '도서명을 입력하세요.').max(200, '도서명은 200자 이내입니다.'),
  author: z.string().min(1, '저자를 입력하세요.').max(100, '저자는 100자 이내입니다.'),
  isbn: z.string().regex(/^\d{13}$/, 'ISBN-13 형식이 아닙니다.'),
  category: z.string().min(1, '카테고리를 선택하세요.'),
  publisher: z.string().max(100, '출판사는 100자 이내입니다.').optional(),
  publishYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  totalCopies: z.number().int().min(1, '최소 1권 이상이어야 합니다.').max(100),
});

type BookFormData = z.infer<typeof bookSchema>;

// 폼 초기화
const form = useForm<BookFormData>({
  resolver: zodResolver(bookSchema),
  defaultValues: { title: '', author: '', isbn: '', category: '', totalCopies: 1 },
});

// 폼 제출 시 서버 검증 오류 매핑
function handleServerValidationError(errors: Record<string, string>) {
  Object.entries(errors).forEach(([field, message]) => {
    form.setError(field as keyof BookFormData, { message });
  });
}
```

### 8.4 API Route 오류 처리 패턴

```typescript
// src/app/api/admin/books/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/admin/rbac';
import { z } from 'zod';

const createBookSchema = z.object({
  title: z.string().min(1).max(200),
  author: z.string().min(1).max(100),
  isbn: z.string().regex(/^\d{13}$/),
  category: z.string().min(1),
  totalCopies: z.number().int().min(1).max(100).default(1),
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    // 1. 요청 본문 파싱
    const body = await request.json();

    // 2. Zod 스키마 검증
    const data = createBookSchema.parse(body);

    // 3. 비즈니스 로직
    const book = await prisma.book.create({ data });

    // 4. 감사 로그
    await logAudit('CREATE', 'Book', book.id, null, data);

    // 5. 성공 응답
    return NextResponse.json({ data: book }, { status: 201 });

  } catch (error) {
    // Zod 검증 오류
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '입력 검증에 실패했습니다.',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        },
        { status: 400 }
      );
    }

    // Prisma 고유 제약 위반 (중복 ISBN)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: '이미 존재하는 ISBN입니다.' } },
        { status: 409 }
      );
    }

    // 기타 서버 오류
    console.error('[POST /api/admin/books]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}, 'books:write');  // required permission
```

### 8.5 토스트 알림 패턴

```typescript
// src/lib/admin/toast-patterns.ts

import { toast } from 'sonner';

/** 성공 토스트 */
export function showSuccess(message: string) {
  toast.success(message, { duration: 3000 });
}

/** 오류 토스트 */
export function showError(message: string, code?: string) {
  toast.error(message, {
    duration: 5000,
    description: code ? `오류 코드: ${code}` : undefined,
  });
}

/** 권한 오류 토스트 */
export function showPermissionError() {
  toast.error('접근 권한이 없습니다.', {
    duration: 4000,
    description: '관리자에게 문의하세요.',
  });
}

/** 네트워크 오류 토스트 */
export function showNetworkError() {
  toast.error('네트워크 연결에 실패했습니다.', {
    duration: 5000,
    action: { label: '재시도', onClick: () => window.location.reload() },
  });
}

/** 뮤테이션 성공/실패 자동 처리 */
export function handleMutationResult<T>(
  result: T,
  options: { successMessage: string; errorMessage?: string }
) {
  if (result) {
    showSuccess(options.successMessage);
  } else if (options.errorMessage) {
    showError(options.errorMessage);
  }
}
```

### 8.6 React Hook Form + API 오류 통합

```typescript
// 뮤테이션 onMutate → optimistic update
// 뮤테이션 onError → rollback + toast
// 뮤테이션 onSuccess → invalidate + toast

const updateBookMutation = useMutation({
  mutationFn: (data: BookFormData) => updateBook(bookId, data),
  onMutate: async (newData) => {
    // Optimistic update: 캐시를 먼저 업데이트
    await queryClient.cancelQueries({ queryKey: adminQueryKeys.books.detail(bookId) });
    const previousData = queryClient.getQueryData(adminQueryKeys.books.detail(bookId));
    queryClient.setQueryData(adminQueryKeys.books.detail(bookId), newData);
    return { previousData };
  },
  onError: (error, _variables, context) => {
    // Rollback: 이전 데이터 복원
    if (context?.previousData) {
      queryClient.setQueryData(adminQueryKeys.books.detail(bookId), context.previousData);
    }
    showError(error.message || '도서 수정에 실패했습니다.');
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: adminQueryKeys.books.all });
    showSuccess('도서 정보가 수정되었습니다.');
  },
});
```

---

## 9. 반응형 설계

### 9.1 관리자 레이아웃 브레이크포인트

| 명칭 | 대상 기기 | 해상도 | 방향 | 레이아웃 전략 |
|------|-----------|--------|------|---------------|
| **kiosk-xl** | 24″ 키오스크 관리자 | 1920×1080 | 가로 | 3-column grid (사이드바 + 메인 + 미리보기) |
| **kiosk-lg** | 21″ 키오스크 관리자 | 1280~1919 | 가로 | 3-column grid (폰트 살짝 축소) |
| **tablet** | 10″ 태블릿 | 768~1279 | 세로 | 2-column grid (사이드바 접힘 + 메인 전체) |
| **mobile** | 스마트폰 | ≤767 | 세로 | 1-column stack (햄버거 메뉴 + 풀스크린) |

### 9.2 Tailwind CSS 브레이크포인트 매핑

```typescript
// tailwind.config.ts
export default {
  theme: {
    screens: {
      'mobile':  '375px',    // 스마트폰
      'tablet':  '768px',    // 태블릿
      'kiosk-lg': '1280px',  // 21″ 키오스크 (최소)
      'kiosk-xl': '1920px',  // 24″ 키오스크
    },
  },
};
```

### 9.3 사이드바 동작 상세

| 브레이크포인트 | 사이드바 상태 | 너비 | 전환 애니메이션 | 접근 방식 |
|----------------|---------------|------|-----------------|-----------|
| kiosk-xl (≥1920px) | 고정 노출 | 240px | — | 항상 표시 |
| kiosk-lg (1280~1919px) | 고정 노출 | 240px | — | 항상 표시 |
| tablet (768~1279px) | 아이콘 전용 (접힘) | 64px | width 240→64px (200ms ease) | Hover 시 확장 (오버레이) |
| mobile (≤767px) | 숨김 | 0px | slide-in from left (300ms) | 햄버거 아이콘 터치 |

```tsx
// src/components/admin/AdminSidebar.tsx

export function AdminSidebar() {
  const { sidebarOpen, sidebarCollapsed, toggleSidebar, activeSection, setActiveSection } = useAdminStore();

  return (
    <aside
      className={cn(
        'h-full border-r bg-card transition-all duration-200',
        // 태블릿: 아이콘 전용 모드
        sidebarCollapsed ? 'w-16' : 'w-60',
        // 모바일: 오버레이
        'mobile:fixed mobile:inset-y-0 mobile:left-0 mobile:z-50',
        'mobile:transform mobile:transition-transform mobile:duration-300',
        sidebarOpen ? 'mobile:translate-x-0' : 'mobile:-translate-x-full',
      )}
    >
      {/* 네비게이션 아이템 */}
      <nav className="flex flex-col gap-1 p-2">
        {menuItems.map((item) => (
          <SidebarItem
            key={item.section}
            icon={item.icon}
            label={item.label}
            active={activeSection === item.section}
            collapsed={sidebarCollapsed}
            onClick={() => setActiveSection(item.section)}
          />
        ))}
      </nav>
    </aside>
  );
}
```

### 9.4 반응형 UI 요소 동작

| UI 요소 | kiosk-xl/lg (≥1280px) | tablet (768~1279px) | mobile (≤767px) |
|---------|------------------------|----------------------|------------------|
| 사이드바 | 240px 고정 노출 | 64px 아이콘 전용 (hover 확장) | 햄버거 메뉴 (슬라이드 오버레이) |
| 콘텐츠 영역 | 3-column CSS Grid | 2-column CSS Grid | 1-column flex stack |
| 미리보기 패널 | 우측 320px 고정 | 하단 280px 접히식 | 모달 오버레이 |
| 데이터 테이블 | 전체 컬럼 노출 | 주요 컬럼 5개 + 더보기 | 카드 리스트 뷰로 전환 |
| 컬러 피커 | 인라인 팝오버 | 인라인 팝오버 | 전체화면 모달 |
| 이미지 업로드 | 드래그앤드롭 영역 | 드래그앤드롭 영역 | 카메라 + 파일 선택 버튼 |
| 통계 그래프 | 800×400 영역 | 100% 너비 × 300px | 100% 너비 × 200px |
| 폼 레이아웃 | 2-column (라벨+입력) | 2-column | 1-column stack |
| 확인 다이얼로그 | 중앙 모달 (480px) | 중앙 모달 (100% - 32px) | 풀스크린 바텀시트 |

### 9.5 키오스크 관리자 터치 최적화

키오스크 환경에서 관리자가 터치로 조작할 수 있도록 아래 기준을 적용한다:

| 요소 | 최소 크기 | 간격 | 설명 |
|------|-----------|------|------|
| 터치 타겟 (버튼, 링크) | 44×44px | 8px | WCAG 2.5.5 Target Size |
| 사이드바 메뉴 아이템 | 48px 높이 | 4px | 터치 오조작 방지 |
| 폼 입력 필드 | 48px 높이 | 16px (아래) | 터치 포커스 용이 |
| 아이콘 버튼 | 40×40px | 8px | 아이콘 + 패딩 포함 |
| 스와이프 제스처 | — | — | 모바일: 사이드바 스와이프 닫기 |

### 9.6 AdminLayout 반응형 구조

```tsx
// src/app/admin/layout.tsx

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      {/* 사이드바 */}
      <AdminSidebar />

      {/* 메인 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 헤더 */}
        <AdminHeader />

        {/* 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* 반응형 그리드 */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 kiosk-lg:grid-cols-3 gap-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
```

---

## 10. 배포 설계

### 10.1 환경 변수

| 변수 | 설명 | 기본값 | 필수 |
|------|------|--------|------|
| `DATABASE_URL` | SQLite 경로 | `file:./dev.db` | ✅ |
| `JWT_ACCESS_SECRET` | Access Token 서명 키 (≥32바이트) | — | ✅ |
| `JWT_REFRESH_SECRET` | Refresh Token 서명 키 (≥32바이트) | — | ✅ |
| `NEXTAUTH_SECRET` | 호환성 유지용 | — | ❌ |
| `NEXTAUTH_URL` | 호환성 유지용 | `http://localhost:3000` | ❌ |
| `UPLOAD_MAX_SIZE` | 최대 업로드 크기 (바이트) | `2097152` (2MB) | ❌ |
| `UPLOAD_DIR` | 업로드 디렉터리 | `./public/uploads` | ❌ |
| `RATE_LIMIT_WINDOW` | Rate Limit 윈도우 (ms) | `60000` | ❌ |
| `RATE_LIMIT_MAX` | Rate Limit 최대 요청 수 | `100` | ❌ |
| `INACTIVITY_TIMEOUT` | 비활동 로그아웃 시간 (ms) | `1800000` (30분) | ❌ |

### 10.2 개발 환경

```
Next.js Dev Server (port 3000)
  ├── / (SPA — 키오스크 UI)
  ├── /admin/* (SPA — 관리자 대시보드)
  └── /api/*
      ├── /api/auth/*        (인증 API)
      ├── /api/admin/*       (관리자 API — JWT + RBAC)
      ├── /api/content/*     (공개 CMS — 키오스크 폴링용)
      └── /api/*             (기존 키오스크 API)
```

### 10.3 프로덕션 빌드

```
next build → .next/
  ├── static/                (정적 자산)
  │   ├── _next/static/      (JS/CSS 번들)
  │   └── uploads/           (업로드 이미지)
  └── server/                (SSR/API Route Handlers)
```

### 10.4 Caddy 리버스 프록시

```
# Caddyfile
localhost:3000 {
  reverse_proxy localhost:3000

  # 보안 헤더
  header X-Frame-Options DENY
  header X-Content-Type-Options nosniff
  header Strict-Transport-Security "max-age=31536000"

  # 정적 파일 캐시
  @static path *.webp *.svg *.png *.jpg
  header @static Cache-Control "public, max-age=31536000, immutable"

  # API 캐시 금지
  @api path /api/*
  header @api Cache-Control "no-store"
}
```

### 10.5 데이터 백업 전략

| 대상 | 방법 | 주기 | 보관 |
|------|------|------|------|
| SQLite DB | 파일 복사 (hot backup) | 수동 (관리자 트리거) | 최근 5개 |
| 업로드 이미지 | 디렉터리 tar | 수동 | 최근 3개 |
| 감사 로그 | DB 내 보관 | 자동 | 1년 (SQLite 보관) |

### 10.6 시드 데이터 (초기 관리자 계정)

```typescript
// prisma/seed-admin.ts

async function seedSuperAdmin() {
  const email = 'admin@smart-library.local';
  const password = 'Admin@2026!';  // 초기 비밀번호 (첫 로그인 후 변경 권장)
  const hashedPassword = await hashPassword(password);

  await prisma.adminUser.upsert({
    where: { email },
    create: {
      email,
      passwordHash: hashedPassword,
      name: '슈퍼 관리자',
      role: 'super_admin',
      isActive: true,
      tokenVersion: 1,
    },
    update: {},
  });
}
```

---

> **변경 이력**

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| v1.0.0 | 2026-03-05 | 최초 작성 | Backend Architecture Team |
