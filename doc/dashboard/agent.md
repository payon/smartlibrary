# 관리자 대시보드 에이전트 설정

> 스마트 도서관 무인 키오스크 — 관리자 대시보드 Agent Configuration Document  
> **버전**: v1.0.0  
> **작성일**: 2026-03-05  
> **상태**: Production-ready  
> **상위 문서**: [기본 에이전트 설정](../agent.md)  
> **참조**: [대시보드 아키텍처](./architect.md) · [API 명세](./api.md) · [DB 설계](./database.md) · [PRD](./prd.md)

---

> **📌 본 문서는 `/doc/agent.md`의 대시보드 확장입니다. 공통 에이전트 지침은 상위 문서를 참조하고,  
> 본 문서는 대시보드(`/admin/*`) 개발에 특화된 역할·워크플로우·지침을 정의합니다.**

---

## 목차

1. [에이전트 개요](#1-에이전트-개요)
2. [워크플로우](#2-워크플로우)
3. [작업 추적](#3-작업-추적)
4. [서브에이전트 지침](#4-서브에이전트-지침)
5. [디버깅 가이드](#5-디버깅-가이드)
6. [배포 체크리스트](#6-배포-체크리스트)

---

## 1. 에이전트 개요

### 1.1 역할 정의

대시보드 개발에 투입되는 에이전트와 역할을 정의한다. 기본 에이전트 설정의 역할을 계승하며, 대시보드 특성에 맞게 역할 범위를 한정한다.

| 에이전트 | 역할 | 기술 | 대시보드 담당 영역 |
|---|---|---|---|
| **개발 에이전트** | 관리자 UI + API 전체 구현 | full-stack-developer | Prisma schema, Admin API Routes, Admin UI 컴포넌트, JWT/RBAC, CMS CRUD, 통계/감사 로그 |
| **스타일링 에이전트** | 반응형 관리자 레이아웃, 차트 스타일링 | frontend-styling-expert | 21"/24" 데스크톱, 태블릿(768px), 모바일(375px) 반응형, recharts 테마, shadcn/ui 커스터마이징 |
| **브라우저 에이전트** | 대시보드 E2E 검증 | agent-browser | 로그인 플로우, CMS 편집→키오스크 반영, RBAC 권한 차단, 반응형 레이아웃 스냅샷 |

### 1.2 에이전트 책임 매트릭스

```
                        개발      스타일링    브라우저
                        에이전트   에이전트    에이전트
─────────────────────────────────────────────────────────
Prisma 스키마 설계        ●         ○         ○
DB 마이그레이션           ●         ○         ○
Admin API Route          ●         ○         ○
JWT 인증 구현            ●         ○         ○
RBAC 권한 체계           ●         ○         ○
Admin UI 컴포넌트        ●         △         ○
shadcn/ui 커스터마이징    △         ●         ○
반응형 레이아웃          △         ●         △
recharts 차트 스타일      ○         ●         ○
CMS 편집 인터페이스      ●         △         ○
이미지 업로드             ●         ○         ○
통계 대시보드             ●         △         ○
감사 로그 UI             ●         △         ○
E2E 로그인 플로우        ○         ○         ●
E2E CMS→키오스크 반영    ○         ○         ●
E2E RBAC 차단 확인       ○         ○         ●
반응형 스냅샷 검증       ○         ○         ●

● = 주 담당   △ = 협업   ○ = 미참여
```

### 1.3 에이전트 간 통신 규칙

```
1. 개발 에이전트가 API 구현 완료 → 브라우저 에이전트에 E2E 검증 요청
2. 개발 에이전트가 UI 컴포넌트 작성 완료 → 스타일링 에이전트에 반응형 조정 요청
3. 스타일링 에이전트 조정 완료 → 브라우저 에이전트에 반응형 스냅샷 검증 요청
4. 브라우저 에이전트 오류 발견 → 개발 에이전트에 수정 요청 (워크로그에 기록)
5. 모든 에이전트는 worklog.md를 통해 비동기적으로 상태 공유
```

---

## 2. 워크플로우

### 2.1 대시보드 개발 워크플로우 (7 Phase)

```
요청 수신: 관리자 대시보드 기능 구현
    │
    ▼
┌────────────────────────────────────┐
│ Phase 1: Prisma Schema + DB       │
│ 마이그레이션                       │
│                                    │
│ • AdminUser, AdminRole 모델 정의   │
│ • CmsContent, CmsImage 모델 정의   │
│ • AuditLog, SystemSetting 정의     │
│ • DashboardStat, Notice 정의       │
│ • npx prisma migrate dev 실행     │
│ • npx prisma generate 실행         │
│ • 시드 스크립트 작성               │
└──────────────┬─────────────────────┘
                │
                ▼
┌────────────────────────────────────┐
│ Phase 2: Admin Auth                │
│                                    │
│ • JWT 발급/검증 미들웨어 구현      │
│ • withAdminAuth 미들웨어 작성      │
│ • RBAC 권한 검사 미들웨어 작성     │
│ • /api/admin/auth/login 구현       │
│ • /api/admin/auth/logout 구현      │
│ • /api/admin/auth/me 구현          │
│ • 로그인 페이지 UI 작성            │
│ • AdminLayout (사이드바+헤더) 작성  │
└──────────────┬─────────────────────┘
                │
                ▼
┌────────────────────────────────────┐
│ Phase 3: CMS API + Kiosk Polling   │
│                                    │
│ • /api/admin/cms CRUD 구현         │
│ • /api/cms (공개, 키오스크용) 구현  │
│ • ETag 기반 조건부 요청 로직       │
│ • Polling 인터벌 설정 로직         │
│ • useCmsContent() 훅 작성          │
│ • CMS 편집 → 키오스크 즉시 반영    │
│   동기화 로직                      │
└──────────────┬─────────────────────┘
                │
                ▼
┌────────────────────────────────────┐
│ Phase 4: Admin Dashboard UI        │
│                                    │
│ • /admin 대시보드 홈 (통계 카드)   │
│ • /admin/cms 콘텐츠 관리 페이지    │
│ • /admin/books 도서 관리 페이지    │
│ • /admin/users 사용자 관리 페이지  │
│ • /admin/notices 공지 관리 페이지  │
│ • /admin/settings 시스템 설정      │
│ • /admin/audit 감사 로그 페이지    │
│ • /admin/admins 관리자 계정 관리   │
│   (super_admin 전용)               │
└──────────────┬─────────────────────┘
                │
                ▼
┌────────────────────────────────────┐
│ Phase 5: Image Upload              │
│                                    │
│ • /api/admin/cms/images 구현       │
│ • /public/uploads/cms/ 디렉토리    │
│ • 파일 크기 검증 (최대 5MB)        │
│ • MIME 타입 검증                   │
│ • CmsImage DB 레코드 생성          │
│ • 클라이언트 이미지 프리뷰         │
│ • 업로드 실패 시 에러 처리          │
└──────────────┬─────────────────────┘
                │
                ▼
┌────────────────────────────────────┐
│ Phase 6: Statistics + Audit Log    │
│                                    │
│ • /api/admin/stats 엔드포인트      │
│ • 대출/반납 추이 차트 (recharts)   │
│ • 도서 카테고리 분포 차트          │
│ • 일별 이용 통계 차트              │
│ • withAuditLog 래퍼 구현          │
│ • 모든 mutation에 감사 로그 자동   │
│   기록 연결                        │
│ • 감사 로그 조회/필터 UI           │
└──────────────┬─────────────────────┘
                │
                ▼
┌────────────────────────────────────┐
│ Phase 7: E2E 검증                  │
│                                    │
│ • 브라우저 에이전트로 로그인 플로우 │
│   검증                             │
│ • CMS 편집 → 키오스크 폴링 반영    │
│   E2E 검증                         │
│ • RBAC 권한 차단 E2E 검증          │
│ • 반응형 레이아웃 스냅샷 검증      │
│   (375px, 768px, 1024px, 1920px)   │
│ • 이미지 업로드 E2E 검증           │
│ • 감사 로그 기록 E2E 검증          │
└──────────────┬─────────────────────┘
                │
                ▼
            완료
```

### 2.2 Phase 간 병렬 실행 전략

Phase 내에서 독립적인 작업은 병렬로 실행한다:

```
Phase 1 (직렬):
  └── 스키마 작성 → 마이그레이션 → 시드 (순차 의존)

Phase 2 (병렬 그룹 A):
  ├── JWT/RBAC 미들웨어 구현
  └── Admin API 인증 엔드포인트 구현

Phase 2 (병렬 그룹 B, A 완료 후):
  ├── 로그인 페이지 UI 작성
  └── AdminLayout 컴포넌트 작성

Phase 3 (병렬 그룹 A):
  ├── /api/admin/cms CRUD 구현
  └── /api/cms (공개) 구현

Phase 3 (병렬 그룹 B, A 완료 후):
  ├── useCmsContent() 훅 작성
  └── Polling/ETag 로직 구현

Phase 4 (병렬 — 페이지 간 독립):
  ├── /admin 대시보드 홈
  ├── /admin/cms 콘텐츠 관리
  ├── /admin/books 도서 관리
  ├── /admin/users 사용자 관리
  ├── /admin/notices 공지 관리
  └── /admin/settings 시스템 설정

Phase 5 (직렬):
  └── 업로드 API → 프리뷰 UI → 에러 처리

Phase 6 (병렬 그룹 A):
  ├── 통계 API + 차트 컴포넌트
  └── 감사 로그 API + UI

Phase 7 (직렬 — 순차 검증):
  └── 로그인 → CMS → RBAC → 반응형 → 업로드 → 감사 로그
```

### 2.3 Phase 전환 조건

| 현재 Phase | 완료 조건 | 다음 Phase |
|---|---|---|
| Phase 1 | `npx prisma migrate dev` 성공, 시드 데이터 조회 확인 | Phase 2 |
| Phase 2 | 로그인 → JWT 발급 → `/api/admin/auth/me` 응답 성공 | Phase 3 |
| Phase 3 | CMS CRUD 동작, `/api/cms` ETag 응답 확인 | Phase 4 |
| Phase 4 | 모든 `/admin/*` 페이지 렌더링, 네비게이션 동작 | Phase 5 |
| Phase 5 | 이미지 업로드 → DB 레코드 → 파일 저장 확인 | Phase 6 |
| Phase 6 | 통계 차트 렌더링, 감사 로그 자동 기록 확인 | Phase 7 |
| Phase 7 | 모든 E2E 검증 통과 | **완료** |

---

## 3. 작업 추적

### 3.1 Todo 시스템 — 대시보드 확장

기본 에이전트 설정의 Todo 시스템을 계승하며, 대시보드 Phase 기반 Task ID 체계를 사용한다.

```typescript
interface DashboardTodo {
  id: string;           // "{phase}-{seq}" 형식
                       // 예: "1-1" (Phase 1, 작업 1)
                       //     "2-a" (Phase 2, 병렬 A)
                       //     "2-b" (Phase 2, 병렬 B)
                       //     "4-3" (Phase 4, 페이지 3)
  content: string;      // 작업 설명 (한국어)
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7;  // 대시보드 Phase 번호
  agent: 'dev' | 'style' | 'browser';  // 담당 에이전트
  blocks?: string[];    // 차단하는 후속 Task ID 목록
  blockedBy?: string[]; // 선행 Task ID 목록
}
```

### 3.2 Phase별 기본 Todo 목록

```typescript
const dashboardTodos: DashboardTodo[] = [
  // Phase 1: Prisma Schema + DB Migration
  { id: "1-1", content: "AdminUser, AdminRole 모델 정의",           phase: 1, agent: "dev",    priority: "high" },
  { id: "1-2", content: "CmsContent, CmsImage 모델 정의",           phase: 1, agent: "dev",    priority: "high" },
  { id: "1-3", content: "AuditLog, SystemSetting, DashboardStat 정의", phase: 1, agent: "dev",    priority: "high" },
  { id: "1-4", content: "Notice, KioskDevice 모델 정의",            phase: 1, agent: "dev",    priority: "high" },
  { id: "1-5", content: "prisma migrate dev + generate 실행",       phase: 1, agent: "dev",    priority: "high" },
  { id: "1-6", content: "시드 스크립트 작성 및 실행",               phase: 1, agent: "dev",    priority: "high" },

  // Phase 2: Admin Auth
  { id: "2-a1", content: "JWT 발급/검증 미들웨어 구현",             phase: 2, agent: "dev",    priority: "high" },
  { id: "2-a2", content: "withAdminAuth 미들웨어 작성",             phase: 2, agent: "dev",    priority: "high" },
  { id: "2-a3", content: "RBAC 권한 검사 미들웨어 작성",            phase: 2, agent: "dev",    priority: "high" },
  { id: "2-a4", content: "/api/admin/auth/login·logout·me 구현",    phase: 2, agent: "dev",    priority: "high" },
  { id: "2-b1", content: "로그인 페이지 UI 작성",                   phase: 2, agent: "dev",    priority: "high" },
  { id: "2-b2", content: "AdminLayout (사이드바+헤더+RBAC 네비) 작성", phase: 2, agent: "dev",  priority: "high" },

  // Phase 3: CMS API + Kiosk Polling
  { id: "3-a1", content: "/api/admin/cms CRUD 구현",                phase: 3, agent: "dev",    priority: "high" },
  { id: "3-a2", content: "/api/cms (공개, 키오스크용) 구현",        phase: 3, agent: "dev",    priority: "high" },
  { id: "3-b1", content: "ETag 기반 조건부 요청 로직",              phase: 3, agent: "dev",    priority: "medium" },
  { id: "3-b2", content: "useCmsContent() 훅 작성",                 phase: 3, agent: "dev",    priority: "high" },
  { id: "3-b3", content: "Polling 인터벌 설정 로직",                phase: 3, agent: "dev",    priority: "medium" },

  // Phase 4: Admin Dashboard UI
  { id: "4-1", content: "/admin 대시보드 홈 (통계 카드)",           phase: 4, agent: "dev",    priority: "high" },
  { id: "4-2", content: "/admin/cms 콘텐츠 관리 페이지",            phase: 4, agent: "dev",    priority: "high" },
  { id: "4-3", content: "/admin/books 도서 관리 페이지",            phase: 4, agent: "dev",    priority: "high" },
  { id: "4-4", content: "/admin/users 사용자 관리 페이지",          phase: 4, agent: "dev",    priority: "medium" },
  { id: "4-5", content: "/admin/notices 공지 관리 페이지",          phase: 4, agent: "dev",    priority: "medium" },
  { id: "4-6", content: "/admin/settings 시스템 설정 페이지",       phase: 4, agent: "dev",    priority: "medium" },
  { id: "4-7", content: "/admin/audit 감사 로그 페이지",            phase: 4, agent: "dev",    priority: "medium" },
  { id: "4-8", content: "/admin/admins 관리자 계정 관리 (super_admin)", phase: 4, agent: "dev", priority: "low" },

  // Phase 5: Image Upload
  { id: "5-1", content: "/api/admin/cms/images 업로드 API 구현",    phase: 5, agent: "dev",    priority: "high" },
  { id: "5-2", content: "파일 크기·MIME 검증 + 에러 처리",         phase: 5, agent: "dev",    priority: "high" },
  { id: "5-3", content: "클라이언트 이미지 프리뷰 UI",             phase: 5, agent: "dev",    priority: "medium" },

  // Phase 6: Statistics + Audit Log
  { id: "6-a1", content: "/api/admin/stats 엔드포인트 구현",        phase: 6, agent: "dev",    priority: "medium" },
  { id: "6-a2", content: "recharts 통계 차트 컴포넌트",             phase: 6, agent: "dev",    priority: "medium" },
  { id: "6-b1", content: "withAuditLog 래퍼 구현",                  phase: 6, agent: "dev",    priority: "high" },
  { id: "6-b2", content: "감사 로그 자동 기록 연결",                phase: 6, agent: "dev",    priority: "high" },
  { id: "6-b3", content: "감사 로그 조회/필터 UI",                  phase: 6, agent: "dev",    priority: "medium" },

  // Phase 7: E2E 검증
  { id: "7-1", content: "로그인 플로우 E2E 검증",                   phase: 7, agent: "browser", priority: "high" },
  { id: "7-2", content: "CMS 편집 → 키오스크 반영 E2E 검증",       phase: 7, agent: "browser", priority: "high" },
  { id: "7-3", content: "RBAC 권한 차단 E2E 검증",                  phase: 7, agent: "browser", priority: "high" },
  { id: "7-4", content: "반응형 레이아웃 스냅샷 검증",             phase: 7, agent: "browser", priority: "medium" },
  { id: "7-5", content: "이미지 업로드 E2E 검증",                   phase: 7, agent: "browser", priority: "medium" },
  { id: "7-6", content: "감사 로그 기록 E2E 검증",                  phase: 7, agent: "browser", priority: "medium" },
];
```

### 3.3 상태 전환 규칙

기본 에이전트 설정의 규칙을 계승. 대시보드 확장 규칙:

```
1. Phase N의 모든 Todo가 completed여야 Phase N+1의 Todo를 in_progress로 전환 가능
2. blockedBy가 지정된 Todo는 선행 Todo가 모두 completed여야 in_progress로 전환 가능
3. 브라우저 에이전트 Todo는 개발 에이전트가 해당 Phase 완료 후에만 in_progress로 전환
4. 오류로 인한 수정 시, 해당 Phase의 관련 Todo를 in_progress로 재설정 가능
```

### 3.4 우선순위 기준 (대시보드 확장)

| 우선순위 | 기준 | 대시보드 예시 |
|---|---|---|
| **high** | 인증/인가 차단, 데이터 무결성, 코어 플로우 차단 | JWT 발급 실패, CMS 저장 불가, RBAC 미적용 |
| **medium** | 기능 동작, UI 가시성, 규칙 준수 | 차트 미렌더링, 반응형 깨짐, 감사 로그 누락 |
| **low** | 관리 편의, 개선 사항, 한정적 영향 | 관리자 계정 관리 UI, 컬러 테마 조정 |

---

## 4. 서브에이전트 지침

### 4.1 공통 지침 (대시보드 모든 서브에이전트)

기본 에이전트 설정의 공통 지침(`6.1`)을 모두 계승. 추가 지침:

```
1. Admin API Route는 반드시 /api/admin/* 경로에 위치
2. Admin 페이지는 반드시 /admin/* 경로에 위치 (app/admin/ 디렉토리)
3. 모든 관리자 API는 withAdminAuth 미들웨어로 보호
4. 모든 mutation(생성/수정/삭제)은 AuditLog 레코드 생성
5. CMS 콘텐츠 key는 CmsContent 테이블 key 형식 준수
   (예: "idle_title", "main_menu_subtitle", "loan_guide_text")
6. 키오스크 컴포넌트에서 CMS 콘텐츠 참조 시 useCmsContent() 훅 사용
7. 한국어 UI 텍스트 유지 (관리자 UI도 한국어)
8. 에러 응답은 공통 에러 형식 준수
   { error: { code: "ERROR_CODE", message: "...", details: {} } }
```

### 4.2 개발 에이전트 추가 지침

기본 에이전트 설정의 개발 에이전트 지침(`6.2`)을 계승. 대시보드 추가 지침:

```
1. [인증] Admin API Route에 withAdminAuth 미들웨어 필수 적용
   - 예: export const GET = withAdminAuth(handler, 'content.read')
   - 인증 없는 공개 API는 /api/cms/* 경로 사용

2. [RBAC] 권한이 필요한 엔드포인트에 requiredPermission 지정
   - super_admin: 모든 권한
   - admin: content.*, book.*, user.read, notice.*, settings.read
   - viewer: *.read 만 허용

3. [감사 로그] 모든 mutation 핸들러에 withAuditLog 래퍼 적용
   - 예: export const PUT = withAuditLog(withAdminAuth(handler, 'content.update'))
   - 자동으로 AuditLog 테이블에 action, entity, entityId, changes 기록

4. [CMS 키] CmsContent.key 네이밍 컨벤션
   - 형식: "{screen}_{element}" (snake_case)
   - 예시:
     * idle_title, idle_subtitle, idle_background_image
     * main_menu_subtitle, main_menu_help_text
     * loan_guide_title, loan_guide_text
     * return_complete_message
   - 신규 키 추가 시 반드시 시드 데이터에도 포함

5. [키오스크 연동] 키오스크에서 CMS 콘텐츠 사용 시
   - useCmsContent("idle_title") 훅 호출
   - 훅이 /api/cms 엔드포인트에서 폴링으로 데이터 갱신
   - ETag 기반 조건부 요청으로 불필요한 전송 최소화
   - 직접 하드코딩 금지 (대체 텍스트만 기본값으로 허용)

6. [API Route 구조] 파일 업로드를 제외한 모든 요청은 JSON
   - Content-Type: application/json
   - 이미지 업로드만 multipart/form-data 허용

7. [Prisma] 트랜잭션이 필요한 mutation은 prisma.$transaction 사용
   - CMS 콘텐츠 bulk update
   - 관리자 계정 생성 (AdminUser + AdminRole 매핑)
   - 감사 로그 + 실제 mutation 동시 실행

8. [shadcn/ui] 관리자 UI 컴포넌트는 shadcn/ui 우선 사용
   - DataTable: 데이터 목록 (정렬, 필터, 페이지네이션)
   - Form: 폼 입력 (react-hook-form + zod 검증)
   - Dialog: 모달 (삭제 확인, 상세 보기)
   - Card: 통계 카드, 정보 카드
   - Badge: 상태 표시
   - Tabs: 탭 전환 (CMS 카테고리 등)
   - Select: 드롭다운 (역할 선택 등)
   - Toast: 알림 (저장 성공, 에러)
   - Avatar: 관리자 프로필

9. [recharts] 통계 차트 컴포넌트
   - LineChart: 대출/반납 일별 추이
   - BarChart: 카테고리별 도서 수
   - PieChart: 대출 상태 분포
   - AreaChart: 시간대별 이용량
   - 반응형: Container width 기반 auto-resize
```

### 4.3 스타일링 에이전트 추가 지침

기본 에이전트 설정의 스타일링 에이전트 지침(`6.3`)을 계승. 대시보드 추가 지침:

```
1. [반응형 브레이크포인트] 관리자 대시보드 전용 브레이크포인트
   - 모바일: 375px ~ 767px (단 컬럼, 사이드바 숨김, 햄버거 메뉴)
   - 태블릿: 768px ~ 1023px (2 컬럼, 축소 사이드바)
   - 소형 데스크톱: 1024px ~ 1279px (사이드바 + 메인, 통계 카드 2열)
   - 대형 데스크톱: 1280px ~ 1919px (21" 모니터, 통계 카드 4열)
   - 풀 HD: 1920px+ (24" 모니터, 최대 너비 제한 1440px)

2. [반응형 테스트 필수] 모든 페이지는 아해 4개 너비에서 레이아웃 확인
   - 375px (iPhone SE)
   - 768px (iPad)
   - 1024px (소형 노트북)
   - 1920px (24" 모니터)

3. [AdminLayout 반응형]
   - 768px 미만: 사이드바 숨김, 햄버거 버튼으로 토글
   - 768px~1023px: 사이드바 축소 (아이콘만 표시)
   - 1024px+: 사이드바 확장 (아이콘 + 라벨)

4. [shadcn/ui 테마] 관리자 대시보드 테마
   - 라이트 모드 기본 (다크 모드는 Phase 2에서 고려)
   - Primary: 도서관 브랜드 컬러 (ECO 초록 계열과 구분)
   - 차트 컬러: recharts 기본 팔레트 + 브랜드 컬러

5. [차트 반응형]
   - recharts <ResponsiveContainer> 사용
   - 최소 너비: 300px (모바일)
   - 모바일에서는 범례(legend) 축소 또는 숨김
   - 태블릿 이상에서 툴팁(tooltip) 표시

6. [DataTable 반응형]
   - 768px 미만: 카드 레이아웃으로 전환 (행 단위 카드)
   - 768px+: 테이블 레이아웃 유지
   - 페이지네이션: 모바일에서는 "더 보기" 버튼, 데스크톱에서는 페이지 번호

7. [폼 반응형]
   - 입력 필드: 모바일에서는 전체 너비
   - 데스크톱에서는 라벨-입력 2컬럼 레이아웃
   - 제출 버튼: 모바일 하단 고정 (sticky)

8. [Tailwind CSS 4] 문법 준수
   - @theme 지시문으로 커스텀 토큰 정의
   - CSS 변수 기반 컬러 토큰 사용
   - 관리자 전용 유틸리티 클래스는 .admin-* 접두사
```

### 4.4 브라우저 에이전트 추가 지침

기본 에이전트 설정의 브라우저 에이전트 지침(`6.4`)을 계승. 대시보드 추가 지침:

```
1. [시작 경로] /admin 에서 시작 (비인증 상태 → 로그인 페이지 리다이렉트 확인)

2. [로그인 플로우 E2E]
   a. /admin 접근 → 로그인 페이지 리다이렉트 확인
   b. 잘못된 자격증명 입력 → 에러 메시지 확인
   c. 올바른 자격증명 입력 → 대시보드 홈 리다이렉트 확인
   d. JWT 만료 상태에서 API 호출 → 401 응답 → 로그인 페이지 리다이렉트 확인
   e. 로그아웃 → 로그인 페이지 리다이렉트 확인

3. [CMS 편집 → 키오스크 반영 E2E]
   a. /admin/cms 접근 → 콘텐츠 목록 로드 확인
   b. 대기 화면 제목("idle_title") 편집 → 저장
   c. 새 탭에서 / (키오스크) 열기 → 변경된 제목 반영 확인
   d. Polling 인터벌 대기 후 자동 갱신 확인

4. [RBAC 권한 차단 E2E]
   a. viewer 역할로 로그인
   b. /admin/cms 접근 → 읽기 가능, 편집 버튼 비활성화 확인
   c. 편집 API 직접 호출 → 403 Forbidden 응답 확인
   d. /admin/admins 접근 → 접근 차단 또는 메뉴 숨김 확인

5. [반응형 레이아웃 스냅샷 E2E]
   a. 375px 너비에서 /admin 열기 → 모바일 레이아웃 스냅샷
   b. 768px 너비에서 /admin 열기 → 태블릿 레이아웃 스냅샷
   c. 1024px 너비에서 /admin 열기 → 소형 데스크톱 스냅샷
   d. 1920px 너비에서 /admin 열기 → 풀 HD 스냅샷
   e. 각 너비에서 사이드바 동작 확인 (숨김/축소/확장)

6. [이미지 업로드 E2E]
   a. /admin/cms 이미지 업로드 영역 확인
   b. 정상 이미지 (PNG, <5MB) 업로드 → 성공 확인
   c. 초과 이미지 (JPG, >5MB) 업로드 → 에러 메시지 확인
   d. 허용되지 않은 파일 (.txt) 업로드 → 에러 메시지 확인

7. [감사 로그 기록 E2E]
   a. /admin/cms에서 콘텐츠 수정
   b. /admin/audit 접근 → 방금 수정한 내용의 AuditLog 레코드 확인
   c. 로그에 action, entity, entityId, adminEmail, timestamp 포함 확인

8. [콘솔 오류 확인]
   - 모든 E2E 검증 후 브라우저 콘솔에 에러/경고 0건 확인
   - React hydration 미스매치 없음 확인
   - 네트워크 요청 실패 0건 확인
```

### 4.5 에이전트별 금지 사항

```
[개발 에이전트]
✗ /api/admin/* 이외의 경로에 관리자 API 배치
✗ withAdminAuth 없는 Admin API Route 작성
✗ AuditLog 기록 없는 mutation 핸들러 작성
✗ 키오스크 컴포넌트에 CMS 콘텐츠 하드코딩
✗ CmsContent.key에 camelCase 또는 한국어 사용
✗ 파일 업로드 시 /public/uploads/cms/ 이외 경로 사용

[스타일링 에이전트]
✗ 키오스크 프레임 (.kiosk-frame) 스타일 수정
✗ ECO 색상 팔레트를 관리자 UI에 적용
✗ 375px 미만 너비 미고려
✗ shadcn/ui 컴포넌트 구조 임의 변경
✗ recharts 없이 자체 차트 구현

[브라우저 에이전트]
✗ 키오스크 코어 플로우(대출/반납) 생략
✗ 관리자 자격증명을 소스코드에 하드코딩
✗ 1920px 반응형 검증 생략
✗ 감사 로그 기록 확인 생략
```

---

## 5. 디버깅 가이드

### 5.1 대시보드 특화 오류 대응

| 오류 | 원인 | 대응 | 담당 에이전트 |
|---|---|---|---|
| **JWT token expired** | JWT 만료 (기본 8시간) | 1. `/api/admin/auth/login` 재호출로 갱신<br>2. 클라이언트에서 401 감지 시 자동 리다이렉트<br>3. JWT_EXPIRES_IN 환경변수 확인 | 개발 |
| **RBAC permission denied** | 역할에 권한 없음 | 1. AdminRole.permissions 필드 확인<br>2. withAdminAuth의 requiredPermission 파라미터 확인<br>3. super_admin으로 로그인 후 권한 재확인 | 개발 |
| **CMS content not reflecting** | 키오스크에 변경 미반영 | 1. Polling 인터벌 확인 (기본 30초)<br>2. ETag 응답 헤더 확인 (304 vs 200)<br>3. /api/cms 응답 데이터 확인<br>4. useCmsContent() 훅 마운트 상태 확인<br>5. 브라우저 캐시 강제 갱신 (Ctrl+Shift+R) | 개발 |
| **Image upload fail — file size** | 파일 크기 초과 (최대 5MB) | 1. 클라이언트에서 파일 크기 사전 검증<br>2. MAX_UPLOAD_SIZE 환경변수 확인<br>3. 서버에서 Content-Length 확인 | 개발 |
| **Image upload fail — MIME type** | 허용되지 않은 파일 형식 | 1. ALLOWED_MIME_TYPES 확인 (image/jpeg, image/png, image/webp, image/svg+xml)<br>2. 파일 확장자와 실제 MIME 일치 확인 | 개발 |
| **Audit log missing** | withAuditLog 래퍼 미적용 | 1. mutation 핸들러에 withAuditLog 적용 여부 확인<br>2. withAuditLog 내부에서 트랜잭션 롤백 시 AuditLog도 롤백되는지 확인<br>3. prisma.auditLog.create 호출 확인 | 개발 |
| **Admin page blank** | 인증 미완료 또는 컴포넌트 오류 | 1. JWT localStorage 존재 확인<br>2. 브라우저 콘솔 React 에러 확인<br>3. AdminLayout 렌더링 조건 확인 | 개발 |
| **Sidebar navigation broken** | RBAC 필터링 오류 | 1. 사용자 역할의 permissions 확인<br>2. 메뉴 항목의 requiredPermission 확인<br>3. AdminLayout 내 네비게이션 필터 로직 확인 | 개발 |
| **Chart not rendering** | recharts 데이터 형식 오류 | 1. API 응답 데이터 구조 확인<br>2. recharts 컴포넌트 data prop 형식 확인<br>3. ResponsiveContainer 높이 설정 확인<br>4. 데이터 빈 배열 시 빈 상태 UI 확인 | 스타일링 |
| **Responsive layout broken** | 브레이크포인트 누락 | 1. Tailwind 반응형 클래스(sm/md/lg/xl/2xl) 확인<br>2. 지정 너비(375/768/1024/1920)에서 렌더링 확인<br>3. AdminLayout 사이드바 상태 확인 | 스타일링 |

### 5.2 인증/인가 디버깅 순서

```
1. 브라우저 localStorage에서 JWT 존재 확인
   localStorage.getItem('admin_token')

2. JWT 디코딩으로 만료 시간 확인
   // jwt.io에서 수동 디코딩 또는
   JSON.parse(atob(token.split('.')[1]))

3. /api/admin/auth/me 호출로 토큰 유효성 확인
   curl -H "Authorization: Bearer {token}" http://localhost:3000/api/admin/auth/me

4. AdminUser 레코드 확인
   npx prisma studio → AdminUser 테이블

5. AdminRole.permissions 확인
   npx prisma studio → AdminRole 테이블

6. withAdminAuth 미들웨어 동작 확인
   - 콘솔에 디버그 로그 추가
   - requiredPermission 파라미터 확인
```

### 5.3 CMS 동기화 디버깅 순서

```
1. 관리자 대시보드에서 CMS 편집 → 저장 성공 확인

2. /api/cms 엔드포인트 직접 호출로 데이터 확인
   curl http://localhost:3000/api/cms

3. ETag 응답 헤더 확인
   curl -I http://localhost:3000/api/cms
   # ETag: "..." 헤더 존재 확인

4. 조건부 요청 (If-None-Match) 테스트
   curl -H "If-None-Match: {etag}" http://localhost:3000/api/cms
   # 304 Not Modified 응답 확인

5. useCmsContent() 훅 폴링 동작 확인
   - 브라우저 Network 탭에서 /api/cms 요청 간격 확인
   - 기본 인터벌: 30초 (KioskSetting에서 설정 가능)

6. 키오스크 화면에서 변경 내용 반영 확인
   - 강제 갱신: /api/cms?nocache=1
   - 키오스크 컴포넌트 remount: 화면 전환 후 복귀
```

### 5.4 감사 로그 디버깅 순서

```
1. /api/admin/audit-log 호출로 최근 로그 확인
   curl -H "Authorization: Bearer {token}" \
     http://localhost:3000/api/admin/audit-log?limit=10

2. 특정 mutation 후 AuditLog 레코드 존재 확인
   npx prisma studio → AuditLog 테이블

3. withAuditLog 래퍼 적용 여부 확인
   - 핸들러 소스 코드에서 withAuditLog 호출 확인
   - 래퍼 순서: withAuditLog(withAdminAuth(handler, perm))

4. AuditLog 필드 확인
   - action: "CREATE" | "UPDATE" | "DELETE"
   - entity: "CmsContent" | "Book" | "AdminUser" | ...
   - entityId: 변경 대상 ID
   - adminEmail: 실행자 이메일
   - changes: 변경 전후 값 (JSON)
   - timestamp: 실행 시간
```

### 5.5 로그 확인 순서 (대시보드 확장)

기본 에이전트 설정의 로그 확인 순서(`7.2`)를 확장:

```
1. dev.log 최신 로그 읽기
2. 브라우저 콘솔 오류 확인 (특히 /admin/* 페이지)
3. API 응답 상태 코드 확인 (401/403에 주목)
4. JWT 토큰 유효성 확인 (만료, 서명 오류)
5. RBAC 권한 확인 (role.permissions 필드)
6. Prisma 쿼리 로그 확인 (log: ['query'] 변경)
7. AuditLog 최신 레코드 확인 (감사 추적)
8. /api/cms 응답 ETag 확인 (캐시 동작)
```

---

## 6. 배포 체크리스트

### 6.1 대시보드 릴리즈 전 확인

```markdown
□ 1. Admin 시드 데이터 생성
     - AdminUser: super_admin 1명, admin 1명, viewer 1명
     - AdminRole: 3개 역할과 권한 매핑
     - 시드 스크립트: npx tsx prisma/seed-admin.ts

□ 2. CMS 기본값 DB 마이그레이션
     - CmsContent: 모든 화면 키별 기본값 INSERT
     - KioskSetting: polling 인터벌, 기본 설정값
     - 시드 스크립트: npx tsx prisma/seed-cms.ts

□ 3. JWT Secret 환경변수 설정
     - JWT_SECRET: 32자 이상 랜덤 문자열
     - JWT_EXPIRES_IN: "8h" (운영 환경)
     - .env.production에 설정 확인

□ 4. Admin 로그인 동작 확인
     - /admin → 로그인 페이지 리다이렉트
     - 올바른 자격증명 → 대시보드 홈 리다이렉트
     - 잘못된 자격증명 → 에러 메시지 표시
     - 로그아웃 → 로그인 페이지 리다이렉트

□ 5. CMS 편집 → 키오스크 반영 확인
     - /admin/cms에서 콘텐츠 수정 → 저장
     - / (키오스크)에서 변경 내용 반영 확인
     - Polling 인터벌(30초) 내 자동 갱신 확인
     - ETag 기반 304 응답 동작 확인

□ 6. RBAC 권한 적용 확인
     - super_admin: 모든 기능 접근 가능
     - admin: 콘텐츠/도서/공지/설정 편집 가능, 관리자 계정 관리 불가
     - viewer: 읽기 전용, 편집 버튼 비활성화
     - 권한 없는 API 직접 호출 → 403 응답

□ 7. 반응형 레이아웃 확인 (모든 /admin/* 페이지)
     - 375px: 모바일 레이아웃 (사이드바 숨김)
     - 768px: 태블릿 레이아웃 (사이드바 축소)
     - 1024px: 소형 데스크톱 (사이드바 확장)
     - 1920px: 풀 HD (최적 레이아웃)

□ 8. Audit 로깅 동작 확인
     - CMS 콘텐츠 수정 → AuditLog 레코드 생성
     - 도서 정보 수정 → AuditLog 레코드 생성
     - 관리자 계정 생성 → AuditLog 레코드 생성
     - /admin/audit에서 로그 조회 가능

□ 9. 이미지 업로드 동작 확인
     - 정상 이미지 업로드 → /public/uploads/cms/ 저장
     - CmsImage DB 레코드 생성 확인
     - 파일 크기 초과 → 에러 메시지
     - 허용되지 않은 MIME → 에러 메시지

□ 10. 통계 대시보드 동작 확인
     - 대출/반납 추이 차트 렌더링
     - 카테고리 분포 차트 렌더링
     - 데이터 없을 시 빈 상태 UI 표시

□ 11. 콘솔 오류 0건 확인
     - /admin/* 모든 페이지에서 콘솔 에러/경고 0건
     - React hydration 미스매치 0건
     - 네트워크 요청 실패 0건

□ 12. bun run lint 통과
     - ESLint 오류 0건
     - TypeScript 타입 오류 0건

□ 13. worklog.md 최신 상태
     - 모든 Phase 작업 완료 기록
     - 워크로그에 배포 체크리스트 결과 기록
```

### 6.2 환경변수 체크리스트

```bash
# 필수 환경변수
JWT_SECRET=          # 32자 이상 랜덤 문자열 (운영 필수)
JWT_EXPIRES_IN=8h    # JWT 만료 시간 (기본 8시간)
MAX_UPLOAD_SIZE=5242880  # 최대 업로드 크기 (5MB, 바이트)
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,image/svg+xml

# 선택 환경변수
CMS_POLLING_INTERVAL=30000  # 키오스크 폴링 인터벌 (ms, 기본 30초)
ADMIN_SESSION_TIMEOUT=28800 # 세션 타임아웃 (초, 기본 8시간)
UPLOAD_DIR=/public/uploads/cms  # 업로드 디렉토리 (기본값)
```

### 6.3 알려진 제약 (대시보드 확장)

```
1. JWT는 localStorage에 저장 (XSS 공격에 취약, httpOnly 쿠키 미사용)
   → 차기 개선: httpOnly + Secure 쿠키 전환 검토

2. 이미지 업로드는 로컬 파일시스템에 저장 (클라우드 스토리지 미사용)
   → 차기 개선: S3/OSS 클라우드 스토리지 연동 검토

3. RBAC 권한은 코드에 정적 정의 (동적 권한 할당 미지원)
   → 차기 개선: 관리자 UI에서 권한 편집 기능 검토

4. CMS 폴링은 클라이언트 기반 (WebSocket 미사용)
   → 차기 개선: Server-Sent Events 또는 WebSocket 도입 검토

5. 통계 데이터는 실시간 집계 (별도 집계 테이블 미사용)
   → 차기 개선: DashboardStat 테이블로 배치 집계 검토

6. 다국어 미지원 (관리자 UI 한국어만)
   → 차기 개선: i18n 도입 검토

7. 관리자 대시보드와 키오스크가 동일 포트(3000)에서 실행
   → 분리 불가, Next.js 라우팅으로 경로 분리만 가능

8. 감사 로그 보관 기간 미설정 (무한 증가 가능)
   → 차기 개선: 보관 기간 설정 + 자동 삭제 검토
```

### 6.4 롤백 절차

```
1. DB 롤백
   npx prisma migrate resolve --rolled-back <migration_name>

2. 시드 데이터 재적재
   npx tsx prisma/seed-admin.ts
   npx tsx prisma/seed-cms.ts

3. 환경변수 확인
   - JWT_SECRET 변경 시 모든 관리자 재로그인 필요
   - CMS_POLLING_INTERVAL 변경 시 키오스크 새로고침 필요

4. 업로드 파일 롤백
   - /public/uploads/cms/ 디렉토리 백업 복원
   - CmsImage 테이블 레코드와 파일 동기화 확인
```

---

> **문서 끝** — 본 문서는 `/doc/agent.md`와 함께 읽으세요. 공통 에이전트 지침, 워크로그 형식, 스킬 활용 가이드는 상위 문서를 참조합니다.
