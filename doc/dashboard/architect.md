# 스마트 도서관 관리자 대시보드 — 아키텍처 문서

> **버전**: v1.0.0  
> **작성일**: 2026-03-05  
> **상태**: Production-ready  
> **담당**: Dashboard Architecture Team  
> **참조**: [PRD](./prd.md) · [DB 설계](./database.md) · [키오스크 아키텍처](../architect.md)

---

## 목차

1. [시스템 전체 구조](#1-시스템-전체-구조)
2. [모듈 아키텍처](#2-모듈-아키텍처)
3. [데이터 흐름 아키텍처](#3-데이터-흐름-아키텍처)
4. [인증 아키텍처](#4-인증-아키텍처)
5. [컴포넌트 아키텍처](#5-컴포넌트-아키텍처)
6. [실시간 동기화 아키텍처](#6-실시간-동기화-아키텍처)
7. [반응형 아키텍처](#7-반응형-아키텍처)
8. [API 아키텍처](#8-api-아키텍처)
9. [배포 아키텍처](#9-배포-아키텍처)
10. [ADR (Architecture Decision Records)](#10-adr-architecture-decision-records)

---

## 1. 시스템 전체 구조

### 1.1 아키텍처 개요

관리자 대시보드는 **기존 Next.js 16 키오스크 애플리케이션 내에 `/admin/*` 경로로 통합**되는 모듈이다. 별도 프로세스나 포트 없이 동일한 SQLite 데이터베이스와 Prisma 클라이언트를 공유하며, 관리자가 변경한 CMS 콘텐츠가 키오스크 프론트엔드에 실시간으로 반영되는 구조를 갖는다.

### 1.2 전체 시스템 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Single Next.js 16 Process (port 3000)               │
│                                                                             │
│  ┌──────────────────────────────┐    ┌──────────────────────────────────┐   │
│  │   KIOSK FRONTEND (기존)       │    │   ADMIN DASHBOARD (신규)         │   │
│  │   / (루트 경로)                │    │   /admin/* (관리자 경로)           │   │
│  │                              │    │                                  │   │
│  │  ┌─────────┐ ┌───────────┐  │    │  ┌────────────┐ ┌────────────┐  │   │
│  │  │IdleScreen│ │ MainMenu  │  │    │  │ AdminLayout│ │ ContentMgr │  │   │
│  │  └─────────┘ └───────────┘  │    │  └────────────┘ └────────────┘  │   │
│  │  ┌─────────┐ ┌───────────┐  │    │  ┌────────────┐ ┌────────────┐  │   │
│  │  │AuthScan │ │LoanSelect │  │    │  │ BookManager│ │ UserManager│  │   │
│  │  └─────────┘ └───────────┘  │    │  └────────────┘ └────────────┘  │   │
│  │         ...                  │    │  ┌────────────┐ ┌────────────┐  │   │
│  │                              │    │  │  Settings  │ │  AuditLog   │  │   │
│  │  ┌──────────────────────┐   │    │  └────────────┘ └────────────┘  │   │
│  │  │  useAppStore (Zustand)│   │    │  ┌──────────────────────────┐  │   │
│  │  │  screen, user, books  │   │    │  │  useAdminStore (Zustand) │  │   │
│  │  └──────────────────────┘   │    │  │  cms, auth, sidebar, ui  │  │   │
│  └──────────────┬───────────────┘    │  └──────────────────────────┘  │   │
│                 │                     └──────────────┬───────────────────┘   │
│                 │  폴링 (3s ETag)  ◄─────────────────┘                     │
│                 │  CMS 변경 전파 ─────────────────►                       │
│                 │                                                         │
│  ┌──────────────┴──────────────────────────────────────────────────────┐   │
│  │                     API LAYER (Next.js Route Handlers)               │   │
│  │                                                                     │   │
│  │  ┌─── Kiosk API (기존) ───┐  ┌─── Admin API (신규) ──────────────┐ │   │
│  │  │ GET  /api/books        │  │ POST   /api/admin/auth/login      │ │   │
│  │  │ GET  /api/loans        │  │ POST   /api/admin/auth/logout     │ │   │
│  │  │ POST /api/loans        │  │ GET    /api/admin/cms             │ │   │
│  │  │ POST /api/loans/[id]/return│ │  │ PATCH  /api/admin/cms/:key       │ │   │
│  │  │ GET  /api/users        │  │ POST   /api/admin/cms/upload      │ │   │
│  │  │ POST /api/users        │  │ GET    /api/admin/books           │ │   │
│  │  │ ...                    │  │ POST   /api/admin/books           │ │   │
│  │  └────────────────────────┘  │ GET    /api/admin/users           │ │   │
│  │                               │ GET    /api/admin/dashboard      │ │   │
│  │                               │ GET    /api/admin/audit-log       │ │   │
│  │                               │ GET    /api/admin/settings       │ │   │
│  │                               │ PATCH  /api/admin/settings       │ │   │
│  │                               └──────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │  ┌─── Shared CMS API ────────────────────────────────────────────┐ │   │
│  │  │ GET  /api/cms/content    ← 키오스크가 3초 간격으로 폴링        │ │   │
│  │  │ GET  /api/cms/content/:key                                    │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────┬───────────────────────────────┘   │
│                                        │ Prisma Client (싱글톤)            │
│                                        ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    DATA LAYER (SQLite via Prisma)                     │   │
│  │                                                                     │   │
│  │  ┌─── Kiosk Core ───┐  ┌─── Admin Ops ──┐  ┌─── System Infra ───┐  │   │
│  │  │ SimUser           │  │ AdminUser      │  │ SystemSetting      │  │   │
│  │  │ Book              │  │ CmsContent     │  │ AuditLog           │  │   │
│  │  │ SimLoan           │  │ CmsImage       │  │ KioskDevice        │  │   │
│  │  │ LearningProgress  │  │                │  │ Notice             │  │   │
│  │  │ Scenario          │  │                │  │                    │  │   │
│  │  └───────────────────┘  └────────────────┘  └────────────────────┘  │   │
│  │                         custom.db (SQLite WAL)                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 관리자→키오스크 변경 전파 흐름

```
┌──────────────┐     ① 저장      ┌──────────────────┐     ② Prisma WRITE     ┌──────────┐
│  Admin UI    │ ──────────────► │ POST /api/admin/ │ ─────────────────────► │ CmsContent│
│  (편집 폼)   │                 │ cms/:key         │                        │  (SQLite) │
└──────────────┘                 └──────────────────┘                        └────┬─────┘
                                                                                    │
                                               ③ 키오스크 폴링 (3s 간격)             │
┌──────────────┐     ⑥ Re-render  ┌───────────────┐    ⑤ Zustand set()   ┌────▼─────┐
│  Kiosk UI    │ ◄─────────────── │ useCmsStore   │ ◄──────────────────  │ GET      │
│  (IdleScreen │                   │ (Zustand)     │    ④ JSON + ETag     │ /api/cms/│
│   etc.)      │                   └───────────────┘                       │ content  │
└──────────────┘                                                            └──────────┘
```

| 단계 | 설명 | 지연 |
|------|------|------|
| ① | 관리자가 편집 폼에서 값 변경 후 "저장" 클릭 | 사용자 액션 |
| ② | Admin API가 Prisma로 `CmsContent` 테이블에 UPSERT | ~5ms |
| ③ | 키오스크 프론트엔드가 3초 간격으로 `GET /api/cms/content` 폴링 | ≤3s |
| ④ | 서버가 ETag 기반 변경 감지, 변경 시에만 새 데이터 응답 (304 아니면 200) | ~2ms |
| ⑤ | Zustand `useCmsStore.setCmsContent()` 호출로 전역 상태 갱신 | ~1ms |
| ⑥ | React가 상태 변경 감지, 해당 CMS 값을 사용하는 컴포넌트만 Re-render | ~16ms |

**총 전파 지연**: CMS 저장 후 **≤3초** 내 키오스크 화면에 반영 보장

---

## 2. 모듈 아키텍처

### 2.1 디렉토리 구조

```
src/
├── app/
│   ├── layout.tsx                          # 루트 레이아웃 (기존, 변경 없음)
│   ├── page.tsx                            # 키오스크 진입점 (기존)
│   ├── globals.css                         # 글로벌 스타일 (기존)
│   │
│   ├── admin/                              # ★ 관리자 대시보드 라우트 그룹
│   │   ├── layout.tsx                      #   AdminLayout (인증 가드 + 사이드바)
│   │   ├── page.tsx                        #   /admin → 대시보드 홈 (통계)
│   │   ├── login/
│   │   │   └── page.tsx                    #   /admin/login (인증 전 화면)
│   │   ├── content/
│   │   │   └── page.tsx                    #   /admin/content (CMS 콘텐츠 관리)
│   │   ├── books/
│   │   │   └── page.tsx                    #   /admin/books (도서 관리)
│   │   ├── users/
│   │   │   └── page.tsx                    #   /admin/users (이용자 관리)
│   │   ├── settings/
│   │   │   └── page.tsx                    #   /admin/settings (시스템 설정)
│   │   └── audit-log/
│   │       └── page.tsx                    #   /admin/audit-log (감사 로그)
│   │
│   └── api/
│       ├── books/route.ts                  # 기존 키오스크 API
│       ├── loans/...                       # 기존 키오스크 API
│       ├── users/...                       # 기존 키오스크 API
│       │
│       ├── cms/                            # ★ 공유 CMS 읽기 API (키오스크 폴링 대상)
│       │   ├── content/
│       │   │   └── route.ts                #   GET /api/cms/content (전체)
│       │   └── content/[key]/
│       │       └── route.ts                #   GET /api/cms/content/:key (단일)
│       │
│       └── admin/                          # ★ 관리자 전용 API (인증 필요)
│           ├── auth/
│           │   ├── login/route.ts          #   POST /api/admin/auth/login
│           │   ├── logout/route.ts         #   POST /api/admin/auth/logout
│           │   └── me/route.ts             #   GET  /api/admin/auth/me (세션 확인)
│           ├── cms/
│           │   ├── route.ts                #   GET /api/admin/cms (전체 조회)
│           │   └── [key]/
│           │       └── route.ts            #   PATCH /api/admin/cms/:key (업데이트)
│           ├── cms-upload/
│           │   └── route.ts                #   POST /api/admin/cms-upload (이미지)
│           ├── books/
│           │   ├── route.ts                #   GET/POST /api/admin/books
│           │   └── [id]/
│           │       └── route.ts            #   GET/PATCH/DELETE /api/admin/books/:id
│           ├── users/
│           │   ├── route.ts                #   GET/POST /api/admin/users
│           │   └── [id]/
│           │       └── route.ts            #   GET/PATCH /api/admin/users/:id
│           ├── dashboard/
│           │   └── route.ts                #   GET /api/admin/dashboard (통계)
│           ├── audit-log/
│           │   └── route.ts                #   GET /api/admin/audit-log
│           ├── settings/
│           │   └── route.ts                #   GET/PATCH /api/admin/settings
│           └── accounts/
│               ├── route.ts                #   GET/POST /api/admin/accounts
│               └── [id]/
│                   └── route.ts            #   PATCH /api/admin/accounts/:id
│
├── components/
│   ├── kiosk/                              # 기존 키오스크 컴포넌트 (변경 없음)
│   ├── ui/                                 # 기존 shadcn/ui 프리미티브 (변경 없음)
│   │
│   └── admin/                              # ★ 관리자 대시보드 컴포넌트
│       ├── AdminLayout.tsx                 #   레이아웃 셸 (사이드바+헤더+메인)
│       ├── AdminSidebar.tsx                #   사이드바 내비게이션
│       ├── AdminHeader.tsx                 #   상단 헤더 (사용자 정보, 로그아웃)
│       ├── AdminGuard.tsx                  #   인증 가드 (미인증 시 /admin/login 리다이렉트)
│       │
│       ├── dashboard/                      #   대시보드 홈
│       │   ├── StatsCards.tsx              #     오늘의 현황 4개 지표 카드
│       │   ├── HourlyChart.tsx             #     시간대별 대출·반납 그래프
│       │   ├── TopBooksList.tsx            #     인기 도서 TOP 10
│       │   └── RecentActivity.tsx          #     최근 활동 로그
│       │
│       ├── content/                        #   CMS 콘텐츠 관리
│       │   ├── ContentEditor.tsx           #     콘텐츠 편집 메인
│       │   ├── ContentGroup.tsx            #     화면별 콘텐츠 그룹 (Idle, Menu, Auth…)
│       │   ├── TextFieldEditor.tsx         #     텍스트 타입 편집기
│       │   ├── ColorFieldEditor.tsx        #     컬러 피커 편집기
│       │   ├── ImageFieldEditor.tsx        #     이미지 업로드/교체 편집기
│       │   ├── NumberFieldEditor.tsx       #     숫자 입력 편집기
│       │   ├── BooleanFieldEditor.tsx      #     토글 스위치 편집기
│       │   ├── JsonFieldEditor.tsx         #     JSON 에디터 (카테고리 목록 등)
│       │   └── ContentDiffViewer.tsx       #     변경 전후 diff 뷰어
│       │
│       ├── books/                          #   도서 관리
│       │   ├── BookTable.tsx               #     도서 목록 테이블
│       │   ├── BookForm.tsx                #     도서 등록/수정 폼
│       │   └── BookImport.tsx              #     CSV 일괄 가져오기
│       │
│       ├── users/                          #   이용자 관리
│       │   ├── UserTable.tsx               #     이용자 목록 테이블
│       │   └── UserForm.tsx                #     이용자 등록/수정 폼
│       │
│       ├── settings/                       #   시스템 설정
│       │   ├── BorrowRulesEditor.tsx       #     대출 규칙 편집
│       │   └── SystemSettingsPanel.tsx     #     시스템 설정 패널
│       │
│       ├── audit-log/                      #   감사 로그
│       │   ├── AuditLogTable.tsx           #     감사 로그 테이블
│       │   └── AuditLogDetail.tsx          #     감사 로그 상세 (diff 뷰)
│       │
│       └── shared/                         #   관리자 공통 컴포넌트
│           ├── AdminDataTable.tsx           #     공통 데이터 테이블 (정렬/필터/페이지)
│           ├── AdminFormLayout.tsx          #     공통 폼 레이아웃
│           ├── AdminConfirmDialog.tsx       #     확인 다이얼로그
│           └── AdminEmptyState.tsx          #     빈 상태 플레이스홀더
│
├── stores/
│   ├── useAppStore.ts                      # 기존 키오스크 스토어 (변경 없음)
│   ├── useAdminStore.ts                    # ★ 관리자 대시보드 스토어
│   └── useCmsStore.ts                      # ★ CMS 콘텐츠 스토어 (키오스크에서 사용)
│
├── lib/
│   ├── db.ts                               # 기존 Prisma 싱글톤 (공유)
│   ├── constants.ts                        # 기존 상수 (공유)
│   ├── security.ts                         # 기존 보안 모듈 (공유)
│   ├── utils.ts                            # 기존 cn() 유틸리티 (공유)
│   ├── tts.ts                              # 기존 TTS 모듈 (공유)
│   │
│   ├── admin-auth.ts                       # ★ 관리자 인증 모듈
│   ├── admin-rbac.ts                       # ★ RBAC 권한 체크 모듈
│   ├── cms.ts                              # ★ CMS 콘텐츠 헬퍼
│   ├── cms-schema.ts                       # ★ CMS 키 스키마 정의 (key→type→default)
│   ├── audit.ts                            # ★ 감사 로그 기록 헬퍼
│   └── admin-middleware.ts                 # ★ 관리자 API 공통 미들웨어
│
└── hooks/
    ├── use-toast.ts                        # 기존
    ├── use-pwa.ts                          # 기존
    ├── use-mobile.ts                       # 기존
    └── use-cms-polling.ts                  # ★ CMS 폴링 훅 (키오스크에서 사용)
```

### 2.2 모듈 의존성 그래프

```
┌─────────────────────────────────────────────────────────────────┐
│                      Page Layer (app/admin/)                    │
│  /admin/login    /admin    /admin/content   /admin/books  ...   │
└────────┬────────────┬────────────┬────────────┬─────────────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Component Layer (components/admin/)           │
│  AdminGuard  AdminLayout  ContentEditor  BookTable  UserTable  │
└────────┬────────────┬────────────┬────────────┬─────────────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Store Layer (stores/)                      │
│         useAdminStore (auth, sidebar, UI 상태)                  │
│         useCmsStore   (CMS 콘텐츠 캐시, 폴링 상태)              │
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Lib Layer (lib/)                           │
│  admin-auth.ts  admin-rbac.ts  cms.ts  cms-schema.ts  audit.ts │
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer (lib/db.ts)                     │
│              Prisma Client → SQLite (custom.db)                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 기존 코드 영향 범위

| 영역 | 변경 여부 | 설명 |
|------|:---------:|------|
| `src/app/layout.tsx` | ❌ | 루트 레이아웃 변경 없음 |
| `src/app/page.tsx` | ❌ | 키오스크 진입점 변경 없음 |
| `src/components/kiosk/*` | ⚠️ 최소 | CMS 값 하드코딩 → `useCmsStore()` 참조로 교체 |
| `src/stores/useAppStore.ts` | ❌ | 키오스크 스토어 변경 없음 |
| `src/lib/db.ts` | ❌ | Prisma 싱글톤 공유 |
| `prisma/schema.prisma` | ✅ | AdminUser, CmsContent, AuditLog 등 신규 모델 추가 |
| `src/components/ui/*` | ❌ | 기존 shadcn/ui 공유, 신규 추가만 |

---

## 3. 데이터 흐름 아키텍처

### 3.1 CMS 콘텐츠 변경 흐름 (관리자 → 키오스크)

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        ADMIN DASHBOARD                                    │
│                                                                           │
│  ContentEditor.tsx                                                        │
│    │ ① 사용자가 "대기 화면 타이틀"을 "스마트 도서관" → "행복한 도서관" 변경  │
│    │ ② "저장" 버튼 클릭                                                   │
│    ▼                                                                      │
│  PATCH /api/admin/cms/idle.title_text                                     │
│    { value: "행복한 도서관" }                                              │
│    │                                                                      │
│    ▼ ③ 미들웨어 체인                                                       │
│  ┌─────────────────────┐                                                  │
│  │ admin-middleware.ts  │                                                  │
│  │  1. JWT 검증         │                                                  │
│  │  2. RBAC 권한 체크   │  → 403 if 권한 없음                              │
│  │  3. Zod 입력 검증    │  → 400 if 유효하지 않음                           │
│  └──────────┬──────────┘                                                  │
│             ▼                                                             │
│  ┌─────────────────────┐                                                  │
│  │ cms.ts (헬퍼)       │                                                  │
│  │  db.cmsContent.upsert({                                                │
│  │    key: "idle.title_text",                                             │
│  │    value: "행복한 도서관",                                              │
│  │    updatedBy: adminUser.id                                             │
│  │  })                                                                    │
│  └──────────┬──────────┘                                                  │
│             ▼                                                             │
│  ┌─────────────────────┐                                                  │
│  │ audit.ts (감사 로그) │                                                  │
│  │  db.auditLog.create({                                                  │
│  │    action: "UPDATE",                                                   │
│  │    entity: "CmsContent",                                               │
│  │    oldValue: "스마트 도서관",                                           │
│  │    newValue: "행복한 도서관"                                            │
│  │  })                                                                    │
│  └──────────┬──────────┘                                                  │
│             ▼                                                             │
│  ④ 응답: 200 OK { key, value, updatedAt }                                 │
└───────────────────────────────────────────────────────────────────────────┘

                ║  CmsContent 테이블 업데이트 완료 (SQLite WAL)
                ║

┌───────────────────────────────────────────────────────────────────────────┐
│                        KIOSK FRONTEND                                     │
│                                                                           │
│  ⑤ use-cms-polling.ts (3초 간격)                                         │
│    GET /api/cms/content                                                   │
│    Header: If-None-Match: <이전 ETag>                                     │
│    │                                                                      │
│    ├── 304 Not Modified → 변경 없음, 폴링 계속                             │
│    │                                                                      │
│    └── 200 OK + ETag: <새 ETag>                                          │
│         { "idle.title_text": "행복한 도서관", ... }                       │
│         │                                                                 │
│         ▼ ⑥                                                              │
│    useCmsStore.setState({                                                 │
│      content: { ...prev, "idle.title_text": "행복한 도서관" },            │
│      etag: <새 ETag>                                                      │
│    })                                                                     │
│         │                                                                 │
│         ▼ ⑦                                                              │
│    KioskIdleScreen.tsx                                                    │
│      const title = useCmsStore(s => s.content['idle.title_text'])         │
│      // → "행복한 도서관"  ← 자동 Re-render!                              │
└───────────────────────────────────────────────────────────────────────────┘
```

### 3.2 대시보드 통계 데이터 흐름

```
┌──────────────┐     GET /api/admin/dashboard     ┌───────────────────────┐
│  StatsCards  │ ────────────────────────────────► │  Dashboard API       │
│  HourlyChart │ ◄───────────────────────────────  │                      │
│  TopBooksList│     { today, hourly, top, recent} │  ① SimLoan 집계     │
└──────────────┘                                   │  ② Book 대출 횟수    │
                                                   │  ③ 최근 20건 조회    │
                                                   └──────────┬──────────┘
                                                              │ Prisma
                                                              ▼
                                                   ┌───────────────────────┐
                                                   │  SimLoan + Book +     │
                                                   │  SimUser (집계 쿼리)  │
                                                   └───────────────────────┘
```

### 3.3 감사 로그 기록 흐름

```
모든 Admin API 쓰기 작업 (POST/PATCH/DELETE)
  │
  ▼
admin-middleware.ts (after hook)
  │
  ▼
audit.ts → db.auditLog.create({
    action:    "UPDATE" | "CREATE" | "DELETE",
    entity:    "CmsContent" | "Book" | "SimUser" | "AdminUser" | ...,
    entityId:  "clxxxx...",
    oldValue:  JSON.stringify(before),
    newValue:  JSON.stringify(after),
    performedBy: adminUser.id,
    performedAt: new Date()
  })
```

---

## 4. 인증 아키텍처

### 4.1 인증 흐름 다이어그램

```
┌──────────────┐                                           ┌──────────────────┐
│  /admin/login│                                           │  AdminUser Table  │
│  (이메일 +   │                                           │  email            │
│   비밀번호    │                                           │  passwordHash     │
│   입력 폼)   │                                           │  role             │
└──────┬───────┘                                           │  isActive         │
       │ POST /api/admin/auth/login                        └────────┬─────────┘
       │ { email, password }                                        │
       ▼                                                            │
┌──────────────────────────────────────────────────────────────────┤
│  ① 이메일로 AdminUser 조회                                       │
│  ② bcrypt.compare(password, passwordHash) 검증                   │
│  ③ isActive === true 확인                                        │
│  ④ 로그인 실패 횟수 확인 (5회 초과 시 15분 잠금)                  │
│  ⑤ JWT Access Token + Refresh Token 발급                         │
│  ⑥ httpOnly 쿠키에 토큰 저장                                     │
│  ⑦ lastLoginAt 갱신                                               │
│  ⑧ AuditLog 기록 (LOGIN 이벤트)                                   │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼ 302 Redirect → /admin
       Set-Cookie: admin_access_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=900
       Set-Cookie: admin_refresh_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/api/admin/auth; Max-Age=604800
```

### 4.2 JWT 토큰 구조

```typescript
// Access Token Payload
interface AdminAccessTokenPayload {
  sub: string;        // AdminUser.id
  email: string;      // AdminUser.email
  role: AdminRole;    // 'super_admin' | 'admin' | 'operator'
  iat: number;        // 발급 시간
  exp: number;        // 만료 시간 (발급 + 15분)
}

// Refresh Token Payload
interface AdminRefreshTokenPayload {
  sub: string;        // AdminUser.id
  type: 'refresh';
  iat: number;
  exp: number;        // 만료 시간 (발급 + 7일)
}
```

### 4.3 세션 관리 전략

```
┌───────────────────────────────────────────────────────────────┐
│                     세션 라이프사이클                          │
│                                                               │
│  [로그인]                                                     │
│    │  Access Token 발급 (15분)                                │
│    │  Refresh Token 발급 (7일)                                │
│    │  httpOnly 쿠키 2개 설정                                  │
│    ▼                                                          │
│  [API 요청]                                                   │
│    │  Authorization: Bearer <access_token>                    │
│    │  ├─ 유효 → 요청 처리                                     │
│    │  ├─ 만료 (401) → Refresh Token으로 자동 갱신              │
│    │  └─ 무효 → 401 → /admin/login 리다이렉트                 │
│    ▼                                                          │
│  [비활동 감지]                                                │
│    │  30분間 사용자 액션 없음                                  │
│    │  → 자동 로그아웃 → /admin/login                          │
│    ▼                                                          │
│  [명시적 로그아웃]                                             │
│       쿠키 삭제 + AuditLog 기록 (LOGOUT 이벤트)               │
└───────────────────────────────────────────────────────────────┘
```

| 항목 | 값 | 설명 |
|------|-----|------|
| Access Token 수명 | **15분** | 짧은 수명으로 탈취 피해 최소화 |
| Refresh Token 수명 | **7일** | 장기 세션 유지 (자동 갱신) |
| 비활동 로그아웃 | **30분** | 마지막 API 요청 후 30분 경과 시 자동 로그아웃 |
| 비밀번호 정책 | 8자 이상, 대소문자+숫자+특수문자 | Zod 스키마 검증 |
| 로그인 실패 잠금 | 5회 연속 실패 시 15분 잠금 | brute-force 방어 |
| 쿠키 속성 | `HttpOnly; Secure; SameSite=Strict` | XSS·CSRF 방어 |

### 4.4 RBAC 권한 체크 미들웨어

```typescript
// src/lib/admin-rbac.ts

type AdminRole = 'super_admin' | 'admin' | 'operator';

// 리소스-액션 권한 매핑
const RBAC_TABLE: Record<AdminRole, Record<string, string[]>> = {
  super_admin: {
    // 모든 리소스에 모든 액션 허용
    cms:       ['read', 'write'],
    books:     ['read', 'write', 'delete'],
    users:     ['read', 'write', 'delete'],
    accounts:  ['read', 'write', 'delete'],
    audit:     ['read', 'export'],
    settings:  ['read', 'write'],
    dashboard: ['read'],
  },
  admin: {
    cms:       ['read', 'write'],
    books:     ['read', 'write', 'delete'],
    users:     ['read', 'write', 'delete'],
    accounts:  [],                   // 계정 관리 불가
    audit:     ['read'],             // 내보내기 불가
    settings:  ['read'],             // 쓰기 불가 (대출 규칙은 cms 채널로)
    dashboard: ['read'],
  },
  operator: {
    cms:       ['read'],             // 읽기 전용
    books:     ['read'],
    users:     ['read'],
    accounts:  [],
    audit:     [],
    settings:  ['read'],
    dashboard: ['read'],
  },
};

export function checkPermission(
  role: AdminRole,
  resource: string,
  action: string
): boolean {
  return RBAC_TABLE[role]?.[resource]?.includes(action) ?? false;
}
```

```typescript
// src/lib/admin-middleware.ts — API Route 공통 미들웨어

import { verifyToken } from './admin-auth';
import { checkPermission } from './admin-rbac';
import { logAudit } from './audit';

export async function withAdminAuth(
  request: NextRequest,
  handler: (req: NextRequest, admin: AdminUser) => Promise<NextResponse>,
  options: { resource: string; action: string }
): Promise<NextResponse> {
  // ① JWT 검증
  const token = request.cookies.get('admin_access_token')?.value;
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ② AdminUser 조회 (isActive 확인)
  const admin = await db.adminUser.findUnique({ where: { id: payload.sub } });
  if (!admin || !admin.isActive) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ③ RBAC 권한 체크
  if (!checkPermission(admin.role, options.resource, options.action)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // ④ 핸들러 실행
  const response = await handler(request, admin);

  // ⑤ 쓰기 작업 시 감사 로그 기록 (after hook)
  if (['POST', 'PATCH', 'DELETE'].includes(request.method)) {
    await logAudit(request, admin, response);
  }

  return response;
}
```

---

## 5. 컴포넌트 아키텍처

### 5.1 컴포넌트 계층 구조

```
<AdminLayout>                                  ← /admin/layout.tsx
  ├── <AdminGuard>                             ← 인증 가드 (미인증 시 리다이렉트)
  │     │
  │     ├── <AdminSidebar>                     ← 좌측 사이드바 내비게이션
  │     │     ├── Logo + "스마트 도서관 관리자"
  │     │     ├── NavItem: 📊 대시보드        → /admin
  │     │     ├── NavItem: 🎨 콘텐츠 관리    → /admin/content
  │     │     ├── NavItem: 📚 도서 관리      → /admin/books
  │     │     ├── NavItem: 👥 이용자 관리    → /admin/users
  │     │     ├── NavItem: ⚙️ 설정           → /admin/settings
  │     │     ├── NavItem: 📋 감사 로그      → /admin/audit-log
  │     │     └── [super_admin 전용]
  │     │         └── NavItem: 🔑 계정 관리   → /admin/accounts
  │     │
  │     ├── <AdminHeader>                      ← 상단 헤더
  │     │     ├── Page title (동적)
  │     │     ├── Sync status indicator (● 연결됨 / ○ 연결 끊김)
  │     │     ├── Notification bell (선택)
  │     │     └── User avatar + name + role badge + "로그아웃"
  │     │
  │     └── <main> {children}                  ← 페이지 콘텐츠 영역
  │           │
  │           ├── /admin → <DashboardPage>
  │           │     ├── <StatsCards>
  │           │     │     ├── 금일 대출 건수
  │           │     │     ├── 금일 반납 건수
  │           │     │     ├── 현재 대출 중 권수
  │           │     │     └── 연체 건수
  │           │     ├── <HourlyChart> (recharts BarChart, 최근 7일)
  │           │     ├── <TopBooksList> (대출 횟수 TOP 10)
  │           │     └── <RecentActivity> (최근 20건 로그)
  │           │
  │           ├── /admin/content → <ContentPage>
  │           │     ├── <ContentGroup title="대기 화면">
  │           │     │     ├── <ImageFieldEditor key="idle.logo_image">
  │           │     │     ├── <TextFieldEditor  key="idle.title_text">
  │           │     │     ├── <ColorFieldEditor key="idle.bg_color">
  │           │     │     └── ...
  │           │     ├── <ContentGroup title="메인 메뉴">
  │           │     ├── <ContentGroup title="인증 화면">
  │           │     ├── <ContentGroup title="도서 선택 화면">
  │           │     ├── <ContentGroup title="대출 완료 화면">
  │           │     ├── <ContentGroup title="반납 완료 화면">
  │           │     └── <ContentGroup title="대출 규칙">
  │           │
  │           ├── /admin/books → <BooksPage>
  │           │     ├── <BookTable> (TanStack Table)
  │           │     │     ├── 검색 + 카테고리 필터
  │           │     │     ├── 정렬 (제목, 저자, 대출수, 등록일)
  │           │     │     └── 페이지네이션 (50건/페이지)
  │           │     ├── <BookForm> (등록/수정 다이얼로그)
  │           │     └── <BookImport> (CSV 업로드, P1)
  │           │
  │           ├── /admin/users → <UsersPage>
  │           │     ├── <UserTable>
  │           │     └── <UserForm>
  │           │
  │           ├── /admin/settings → <SettingsPage>
  │           │     ├── <BorrowRulesEditor>
  │           │     │     ├── 최대 대출 권수 (Slider: 1~20)
  │           │     │     ├── 대출 기간 (Slider: 1~90일)
  │           │     │     ├── 연체 배수 (Slider: 1.0~5.0)
  │           │     │     └── 연체 페널티 활성화 (Switch)
  │           │     └── <SystemSettingsPanel>
  │           │
  │           └── /admin/audit-log → <AuditLogPage>
  │                 ├── 필터 (기간, 작업자, 엔티티, 액션)
  │                 ├── <AuditLogTable>
  │                 └── <AuditLogDetail> (변경 전후 diff)
```

### 5.2 AdminGuard 인증 가드

```typescript
// src/components/admin/AdminGuard.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAdminStore } from '@/stores/useAdminStore';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin, setAdmin } = useAdminStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // /admin/login은 가드 제외
    if (pathname === '/admin/login') {
      setChecking(false);
      return;
    }

    // 세션 확인 API 호출
    fetch('/api/admin/auth/me', { credentials: 'include' })
      .then(res => {
        if (!res.ok) {
          router.replace('/admin/login');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data) setAdmin(data.admin);
        setChecking(false);
      })
      .catch(() => {
        router.replace('/admin/login');
      });
  }, [pathname]);

  if (checking) return <AdminLoadingSkeleton />;
  if (!admin && pathname !== '/admin/login') return null;

  return <>{children}</>;
}
```

### 5.3 AdminLayout 반응형 구조

```typescript
// src/app/admin/layout.tsx

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        {/* 사이드바 */}
        <AdminSidebar />

        {/* 메인 영역 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminHeader />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  );
}
```

---

## 6. 실시간 동기화 아키텍처

### 6.1 폴링 전략 개요

키오스크 프론트엔드가 관리자의 CMS 변경 사항을 실시간으로 감지하기 위해 **3초 간격 HTTP 폴링 + ETag 캐싱** 전략을 사용한다. WebSocket 대비 구현 복잡도가 낮고, 단일 키오스크 환경에서 충분한 실시간성(≤3초)을 보장한다.

```
┌──────────────────────────────────────────────────────────────────┐
│                    폴링 라이프사이클                             │
│                                                                  │
│  [초기 로드]                                                     │
│    GET /api/cms/content                                          │
│    → 200 OK, ETag: "abc123", Body: { ... 모든 CMS 키-값 ... }   │
│    → useCmsStore 초기화                                           │
│                                                                  │
│  [폴링 루프] (3초 간격)                                          │
│    ┌──────────────────────────────────────────┐                  │
│    │  GET /api/cms/content                    │                  │
│    │  If-None-Match: "abc123"                 │                  │
│    │                                          │                  │
│    │  ├── 304 Not Modified                    │                  │
│    │  │   → 변경 없음, 다음 폴링 대기           │                  │
│    │  │                                      │                  │
│    │  └── 200 OK, ETag: "def456"             │                  │
│    │      Body: { ... 갱신된 CMS 키-값 ... }  │                  │
│    │      → useCmsStore 업데이트               │                  │
│    │      → React Re-render                   │                  │
│    └──────────────────────────────────────────┘                  │
│                                                                  │
│  [에러 처리]                                                     │
│    ├── 네트워크 오류 → 5초 후 재시도 (지수 백오프, 최대 30초)     │
│    ├── 5xx 서버 오류 → 10초 후 재시도                             │
│    └── 3회 연속 실패 → "연결 끊김" 인디케이터 표시                │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 ETag 기반 변경 감지

```typescript
// src/app/api/cms/content/route.ts

import { db } from '@/lib/db';

// 서버 측 ETag 생성 (모든 CmsContent updatedAt의 해시)
function generateEtag(items: CmsContent[]): string {
  const hash = items
    .map(i => `${i.key}:${i.updatedAt.getTime()}`)
    .join('|');
  return `"${Buffer.from(hash).toString('base64').slice(0, 32)}"`;
}

export async function GET(request: NextRequest) {
  const allContent = await db.cmsContent.findMany({
    orderBy: { key: 'asc' },
  });

  const etag = generateEtag(allContent);

  // 클라이언트 ETag와 동일 → 변경 없음
  const clientEtag = request.headers.get('If-None-Match');
  if (clientEtag === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  // 변경 있음 → 새 데이터 응답
  const contentMap = Object.fromEntries(
    allContent.map(c => [c.key, c.value])
  );

  return NextResponse.json(contentMap, {
    headers: {
      'ETag': etag,
      'Cache-Control': 'no-cache',
    },
  });
}
```

### 6.3 CMS 폴링 훅

```typescript
// src/hooks/use-cms-polling.ts

import { useEffect, useRef, useCallback } from 'react';
import { useCmsStore } from '@/stores/useCmsStore';

const POLL_INTERVAL = 3000; // 3초
const MAX_RETRY_DELAY = 30000; // 최대 30초

export function useCmsPolling() {
  const { etag, setContent, setEtag, setConnectionStatus } = useCmsStore();
  const retryDelay = useRef(3000);
  const abortController = useRef<AbortController | null>(null);

  const poll = useCallback(async () => {
    try {
      abortController.current = new AbortController();

      const res = await fetch('/api/cms/content', {
        headers: etag ? { 'If-None-Match': etag } : {},
        signal: abortController.current.signal,
      });

      if (res.status === 304) {
        // 변경 없음
        retryDelay.current = POLL_INTERVAL; // 백오프 리셋
        setConnectionStatus('connected');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const newEtag = res.headers.get('ETag') || '';

        setContent(data);
        setEtag(newEtag);
        setConnectionStatus('connected');
        retryDelay.current = POLL_INTERVAL; // 백오프 리셋
      }
    } catch (err) {
      // 네트워크 오류 → 지수 백오프
      retryDelay.current = Math.min(retryDelay.current * 1.5, MAX_RETRY_DELAY);
      setConnectionStatus('disconnected');
    }
  }, [etag, setContent, setEtag, setConnectionStatus]);

  useEffect(() => {
    // 초기 로드
    poll();

    // 폴링 루프
    const interval = setInterval(poll, POLL_INTERVAL);

    return () => {
      clearInterval(interval);
      abortController.current?.abort();
    };
  }, [poll]);
}
```

### 6.4 CMS Zustand 스토어

```typescript
// src/stores/useCmsStore.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

interface CmsState {
  /** CMS 콘텐츠 맵 (key → value) */
  content: Record<string, string>;
  /** 현재 ETag (변경 감지용) */
  etag: string | null;
  /** 서버 연결 상태 */
  connectionStatus: ConnectionStatus;
  /** 콘텐츠 버전 (변경 시마다 증가) */
  version: number;

  // Actions
  setContent: (content: Record<string, string>) => void;
  setEtag: (etag: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  /** 특정 키의 값 조회 (기본값 폴백) */
  getValue: (key: string, defaultValue?: string) => string;
}

export const useCmsStore = create<CmsState>()(
  devtools((set, get) => ({
    content: {},
    etag: null,
    connectionStatus: 'checking',
    version: 0,

    setContent: (content) => set((state) => ({
      content,
      version: state.version + 1,
    })),

    setEtag: (etag) => set({ etag }),

    setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

    getValue: (key, defaultValue = '') => {
      return get().content[key] ?? defaultValue;
    },
  }), { name: 'CmsStore' })
);
```

### 6.5 콘텐츠 버전닝 개념

```
CmsContent 테이블:
  key: "idle.title_text"     updatedAt: 2026-03-05T10:30:00Z
  key: "idle.bg_color"       updatedAt: 2026-03-05T10:30:00Z
  key: "menu.borrow_button_text" updatedAt: 2026-03-04T15:20:00Z

ETag 생성:
  "idle.title_text:1741170600000|idle.bg_color:1741170600000|..."
  → Base64 → "abc123..."

버전 증가:
  useCmsStore.version: 0 → 1 → 2 → ...
  (관리자가 저장할 때마다 DB updatedAt이 갱신되고,
   다음 폴링에서 ETag가 변경되어 version이 증가)
```

---

## 7. 반응형 아키텍처

### 7.1 브레이크포인트 정의

```typescript
// tailwind.config.ts 확장
export default {
  theme: {
    screens: {
      'mobile':   '375px',    // 스마트폰
      'tablet':   '768px',    // 태블릿
      'kiosk-lg': '1280px',   // 21″ 키오스크
      'kiosk-xl': '1920px',   // 24″ 키오스크
    },
  },
};
```

### 7.2 반응형 레이아웃 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  kiosk-xl / kiosk-lg (≥1280px) — 21″/24″ 키오스크                         │
│                                                                             │
│  ┌──────────┬─────────────────────────────────────────┬──────────────────┐ │
│  │ Sidebar  │  Main Content Area                      │ Preview Panel   │ │
│  │ (240px)  │                                         │ (320px, P1)     │ │
│  │          │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐│                 │ │
│  │ 📊 대시  │  │ Card  │ │ Card  │ │ Card  │ │ Card  ││  21″ Preview   │ │
│  │ 🎨 콘텐  │  └───────┘ └───────┘ └───────┘ └───────┘│  (iframe)      │ │
│  │ 📚 도서  │                                         │                 │ │
│  │ 👥 이용  │  ┌───────────────────────────────────────┐│                 │ │
│  │ ⚙️ 설정  │  │         Chart / Table Area            ││                 │ │
│  │ 📋 감사  │  │                                       ││                 │ │
│  │          │  └───────────────────────────────────────┘│                 │ │
│  └──────────┴─────────────────────────────────────────┴──────────────────┘ │
│  Grid: 3-column (sidebar + main + preview)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  tablet (768~1279px) — 10″ 태블릿                            │
│                                                               │
│  ┌────┬───────────────────────────────────────────────────┐  │
│  │Icon│  Main Content Area                                │  │
│  │Bar │  (사이드바 hover 시 확장)                           │  │
│  │64px│                                                     │  │
│  │    │  ┌───────────┐ ┌───────────┐                      │  │
│  │ 📊 │  │   Card    │ │   Card    │                      │  │
│  │ 🎨 │  └───────────┘ └───────────┘                      │  │
│  │ 📚 │  ┌───────────┐ ┌───────────┐                      │  │
│  │ 👥 │  │   Card    │ │   Card    │                      │  │
│  │ ⚙️ │  └───────────┘ └───────────┘                      │  │
│  │ 📋 │                                                     │  │
│  │    │  ┌─────────────────────────────────────────────┐  │  │
│  │    │  │         Chart / Table Area                   │  │  │
│  │    │  └─────────────────────────────────────────────┘  │  │
│  └────┴───────────────────────────────────────────────────┘  │
│  Grid: 2-column (icon sidebar + main)                        │
│  Preview: 하단 280px 접히식                                   │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│  mobile (≤767px) — 스마트폰                   │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ ☰  Admin Dashboard     👤 관리자  ⤴    │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │            Card (full width)            │  │
│  └─────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────┐  │
│  │            Card (full width)            │  │
│  └─────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────┐  │
│  │            Card (full width)            │  │
│  └─────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────┐  │
│  │       Chart (100% × 200px)             │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  Grid: 1-column stack                        │
│  Sidebar: 햄버거 메뉴 (슬라이드 오버레이)     │
│  Table: 카드 리스트 뷰로 전환                 │
│  Preview: 모달 오버레이                       │
└───────────────────────────────────────────────┘
```

### 7.3 반응형 컴포넌트 전략

| UI 요소 | kiosk-xl/lg (≥1280px) | tablet (768~1279px) | mobile (≤767px) |
|---------|------------------------|----------------------|------------------|
| **사이드바** | 240px 고정 노출 | 64px 아이콘 전용 (hover 확장) | 햄버거 메뉴 (슬라이드 오버레이) |
| **콘텐츠 영역** | 3-column CSS Grid | 2-column CSS Grid | 1-column flex stack |
| **미리보기 패널** | 우측 320px 고정 | 하단 280px 접히식 | 모달 오버레이 |
| **데이터 테이블** | 전체 컬럼 노출 | 주요 컬럼 5개 + 더보기 | 카드 리스트 뷰로 전환 |
| **컬러 피커** | 인라인 팝오버 | 인라인 팝오버 | 전체화면 모달 |
| **이미지 업로드** | 드래그앤드롭 영역 | 드래그앤드롭 영역 | 카메라+파일 선택 버튼 |
| **통계 그래프** | 800×400 영역 | 100% 너비 × 300px | 100% 너비 × 200px |
| **폼 레이아웃** | 2-column label+input | 2-column label+input | 1-column stacked |
| **다이얼로그** | 600px 폭 | 90% 폭 | 풀스크린 |

### 7.4 AdminSidebar 반응형 구현

```typescript
// src/components/admin/AdminSidebar.tsx (핵심 로직)

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMobile(); // 기존 use-mobile.ts 훅

  // 모바일: 햄버거 메뉴 → Sheet (슬라이드 오버레이)
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent onItemClick={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  // 태블릿+: 고정 사이드바 (hover 확장)
  return (
    <aside className={cn(
      "hidden lg:flex flex-col border-r bg-white transition-all duration-200",
      collapsed ? "w-16" : "w-60"
    )}>
      <SidebarContent collapsed={collapsed} />
      <Button
        variant="ghost"
        size="icon"
        className="self-center"
        onClick={() => setCollapsed(!collapsed)}
      >
        <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
      </Button>
    </aside>
  );
}
```

---

## 8. API 아키텍처

### 8.1 Admin API Route 패턴

모든 `/api/admin/*` Route Handler는 `withAdminAuth` 미들웨어를 통해 인증·인가·감사 로깅을 일관되게 적용한다.

```typescript
// src/app/api/admin/cms/[key]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-middleware';
import { db } from '@/lib/db';
import { z } from 'zod';

// Zod 입력 스키마
const UpdateCmsSchema = z.object({
  value: z.string().max(5000),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  return withAdminAuth(request, async (req, admin) => {
    // ① 입력 검증
    const body = await req.json();
    const parsed = UpdateCmsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // ② 변경 전 값 조회 (감사 로그용)
    const before = await db.cmsContent.findUnique({ where: { key } });

    // ③ UPSERT
    const updated = await db.cmsContent.upsert({
      where: { key },
      create: {
        key,
        type: inferTypeFromKey(key), // cms-schema.ts에서 추론
        value: parsed.data.value,
        updatedBy: admin.id,
      },
      update: {
        value: parsed.data.value,
        updatedBy: admin.id,
      },
    });

    // ④ 응답 (감사 로그는 withAdminAuth after hook에서 자동 기록)
    return NextResponse.json({
      key: updated.key,
      value: updated.value,
      updatedAt: updated.updatedAt,
    });
  }, { resource: 'cms', action: 'write' });
}
```

### 8.2 API 엔드포인트 전체 목록

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| POST | `/api/admin/auth/login` | 공개 | 관리자 로그인 |
| POST | `/api/admin/auth/logout` | 인증 | 관리자 로그아웃 |
| GET | `/api/admin/auth/me` | 인증 | 현재 세션 확인 |
| GET | `/api/admin/cms` | cms:read | CMS 전체 조회 |
| PATCH | `/api/admin/cms/:key` | cms:write | CMS 단일 항목 업데이트 |
| POST | `/api/admin/cms-upload` | cms:write | CMS 이미지 업로드 |
| GET | `/api/admin/books` | books:read | 도서 목록 (페이지네이션) |
| POST | `/api/admin/books` | books:write | 도서 등록 |
| GET | `/api/admin/books/:id` | books:read | 도서 상세 |
| PATCH | `/api/admin/books/:id` | books:write | 도서 수정 |
| DELETE | `/api/admin/books/:id` | books:delete | 도서 삭제 |
| GET | `/api/admin/users` | users:read | 이용자 목록 |
| POST | `/api/admin/users` | users:write | 이용자 등록 |
| GET | `/api/admin/users/:id` | users:read | 이용자 상세 |
| PATCH | `/api/admin/users/:id` | users:write | 이용자 수정 |
| GET | `/api/admin/dashboard` | dashboard:read | 대시보드 통계 |
| GET | `/api/admin/audit-log` | audit:read | 감사 로그 조회 |
| GET | `/api/admin/settings` | settings:read | 시스템 설정 조회 |
| PATCH | `/api/admin/settings` | settings:write | 시스템 설정 변경 |
| GET | `/api/admin/accounts` | accounts:read | 관리자 계정 목록 |
| POST | `/api/admin/accounts` | accounts:write | 관리자 계정 생성 |
| PATCH | `/api/admin/accounts/:id` | accounts:write | 관리자 계정 수정 |
| GET | `/api/cms/content` | 공개 | CMS 전체 (키오스크 폴링) |
| GET | `/api/cms/content/:key` | 공개 | CMS 단일 (키오스크용) |

### 8.3 공유 CMS 읽기 API (키오스크 폴링 대상)

```typescript
// src/app/api/cms/content/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  // ① 모든 CmsContent 조회
  const allContent = await db.cmsContent.findMany({
    select: { key: true, value: true, updatedAt: true },
    orderBy: { key: 'asc' },
  });

  // ② ETag 생성
  const etag = generateEtag(allContent);

  // ③ 변경 없으면 304
  const clientEtag = request.headers.get('If-None-Match');
  if (clientEtag === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag },
    });
  }

  // ④ key→value 맵으로 변환
  const contentMap = Object.fromEntries(
    allContent.map(c => [c.key, c.value])
  );

  // ⑤ 응답
  return NextResponse.json(contentMap, {
    headers: {
      ETag: etag,
      'Cache-Control': 'no-cache',
    },
  });
}
```

### 8.4 대시보드 통계 API

```typescript
// src/app/api/admin/dashboard/route.ts

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (req, admin) => {
    const today = startOfDay(new Date());
    const sevenDaysAgo = subDays(today, 7);

    // 병렬 쿼리 (Promise.all)
    const [
      todayLoans,
      todayReturns,
      activeLoans,
      overdueLoans,
      hourlyStats,
      topBooks,
      recentActivity,
    ] = await Promise.all([
      // 금일 대출 건수
      db.simLoan.count({
        where: {
          status: 'active',
          createdAt: { gte: today },
        },
      }),

      // 금일 반납 건수
      db.simLoan.count({
        where: {
          status: 'returned',
          returnDate: { gte: today.toISOString() },
        },
      }),

      // 현재 대출 중 권수
      db.simLoan.count({ where: { status: 'active' } }),

      // 연체 건수
      db.simLoan.count({
        where: {
          status: 'active',
          dueDate: { lt: new Date().toISOString() },
        },
      }),

      // 시간대별 통계 (최근 7일)
      getHourlyStats(sevenDaysAgo),

      // 인기 도서 TOP 10
      getTopBooks(10),

      // 최근 활동 20건
      getRecentActivity(20),
    ]);

    return NextResponse.json({
      today: { loans: todayLoans, returns: todayReturns, active: activeLoans, overdue: overdueLoans },
      hourly: hourlyStats,
      topBooks,
      recent: recentActivity,
    });
  }, { resource: 'dashboard', action: 'read' });
}
```

### 8.5 에러 응답 표준 포맷

```typescript
// 모든 Admin API 에러 응답은 다음 포맷을 따름
interface ApiError {
  error: string;              // 에러 메시지 (사용자 표시용)
  code?: string;              // 에러 코드 (클라이언트 분기용)
  details?: Record<string, string[]>;  // 필드별 검증 에러
}

// 400 Validation Error
{ error: "Validation failed", code: "VALIDATION_ERROR", details: { value: ["최대 50자까지 입력 가능합니다"] } }

// 401 Unauthorized
{ error: "Unauthorized", code: "AUTH_REQUIRED" }

// 403 Forbidden
{ error: "Insufficient permissions", code: "PERMISSION_DENIED" }

// 404 Not Found
{ error: "Resource not found", code: "NOT_FOUND" }

// 429 Rate Limited
{ error: "Too many requests", code: "RATE_LIMITED" }

// 500 Internal Error
{ error: "Internal server error", code: "INTERNAL_ERROR" }
```

---

## 9. 배포 아키텍처

### 9.1 단일 Next.js 프로세스 배포

```
┌─────────────────────────────────────────────────────────────────┐
│              단일 보드 (Raspberry Pi / Mini PC)                  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Caddy (역방향 프록시, port 443)               │ │
│  │  • TLS (self-signed 인증서, 키오스크 환경)                │ │
│  │  • / → Next.js :3000                                     │ │
│  │  • /admin → Next.js :3000 (동일 프로세스)                 │ │
│  │  • /api/* → Next.js :3000                                │ │
│  └─────────────────────────┬─────────────────────────────────┘ │
│                            │                                    │
│  ┌─────────────────────────▼─────────────────────────────────┐ │
│  │         Next.js 16 (단일 프로세스, port 3000)              │ │
│  │                                                           │ │
│  │  ┌─── Kiosk Frontend ───┐  ┌─── Admin Dashboard ────┐   │ │
│  │  │ / (CSR)               │  │ /admin/* (SSR+CSR)     │   │ │
│  │  │ /api/books, loans... │  │ /api/admin/*           │   │ │
│  │  └───────────────────────┘  └────────────────────────┘   │ │
│  │                         │                                  │ │
│  │  ┌──────────────────────▼──────────────────────────────┐ │ │
│  │  │              Prisma Client (싱글톤)                  │ │ │
│  │  └──────────────────────┬──────────────────────────────┘ │ │
│  └─────────────────────────┼─────────────────────────────────┘ │
│                            │                                    │
│  ┌─────────────────────────▼─────────────────────────────────┐ │
│  │         SQLite (custom.db, WAL 모드)                       │ │
│  │  • SimUser, Book, SimLoan, Scenario (기존)                │ │
│  │  • AdminUser, CmsContent, AuditLog (신규)                 │ │
│  │  • SystemSetting, KioskDevice, Notice (신규)              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │         /public/uploads/ (이미지 파일 스토리지)             │ │
│  │  • 로고, 아이콘, 배경 이미지, 도서 표지                    │ │
│  │  • 최대 500MB ( Sharp 자동 압축 → WebP )                  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 배포 특징

| 항목 | 값 | 설명 |
|------|-----|------|
| **프로세스** | 단일 Next.js | 키오스크 + 관리자 대시보드가 동일 프로세스에서 실행 |
| **포트** | 3000 | Caddy가 443 → 3000으로 프록시 |
| **DB** | SQLite (WAL) | 단일 파일, 동시 읽기 허용, 쓰기 직렬화 |
| **이미지** | `/public/uploads/` | 로컬 파일 시스템 (외부 CDN 없음) |
| **메모리** | ~4GB RAM | Next.js 런타임 + Chrome (키오스크 디스플레이) |
| **시작** | `bun .next/standalone/server.js` | 프로덕션 빌드 후 standalone 모드 |

### 9.3 빌드 파이프라인

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  prisma   │ ──► │  next build  │ ──► │  cp static   │ ──► │  bun start   │
│  generate │     │  (standalone)│     │  + public    │     │  (port 3000) │
└──────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### 9.4 마이그레이션 전략

```bash
# 신규 테이블 추가 (AdminUser, CmsContent, AuditLog 등)
prisma migrate dev --name add-admin-dashboard

# 프로덕션 배포 시
prisma migrate deploy

# 기존 키오스크 데이터는 영향 없음 (추가 전용)
```

---

## 10. ADR (Architecture Decision Records)

### ADR-D01: 동일 Next.js 프로세스 내 관리자 대시보드 통합 (별도 앱 분리 안 함)

```
┌─────────────────────────────────────────────────────────────┐
│ ADR-D01: Same Next.js Process                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 상황 (Context):                                              │
│   관리자 대시보드를 별도 Next.js 앱으로 분리할지, 기존 키오스크 │
│   앱 내에 /admin/* 경로로 통합할지 결정 필요                  │
│                                                             │
│ 결정 (Decision):                                             │
│   기존 Next.js 16 프로세스 내에 /admin/*로 통합              │
│                                                             │
│ 이유 (Rationale):                                            │
│   1. 단일 보드 환경에서 별도 프로세스 실행 시 메모리 추가     │
│      (Node.js 프로세스당 ~100MB, 4GB RAM 제약)              │
│   2. SQLite 파일 DB는 단일 프로세스에서 접근이 가장 안전      │
│      (WAL 모드라도 다중 프로세스 쓰기는 락 경합 발생)         │
│   3. Prisma Client 싱글톤 공유로 연결 오버헤드 제로          │
│   4. Next.js 16 App Router의 file-system 라우팅이            │
│      /admin/* 경로 분리를 자연스럽게 지원                     │
│   5. 배포 복잡도 최소화 (단일 빌드, 단일 프로세스, 단일 포트)  │
│                                                             │
│ 대안 (Alternatives Considered):                              │
│   A) 별도 Next.js 앱 (admin.example.com)                     │
│      → 메모리 2배, SQLite 다중 프로세스 접근, CORS 설정 필요  │
│   B) Remix/Admin.js 별도 프레임워크                           │
│      → 기술 스택 분산, 유지보수 비용 증가                     │
│   C) Next.js Monorepo (Turborepo)                            │
│      → 빌드 복잡도 증가, 단일 보드에 오버엔지니어링            │
│                                                             │
│ 결과 (Consequences):                                         │
│   + 단일 프로세스, 단일 포트, 단일 DB 연결                     │
│   + 배포 단순 (next build 한 번)                              │
│   + 코드 공유 용이 (lib/, components/ui/, stores/)            │
│   - 키오스크 번들에 admin 코드가 포함될 수 있음               │
│     → Next.js 자동 code splitting으로 완화                    │
│   - 한쪽 장애가 다른쪽에 영향 가능                            │
│     → Admin API 에러가 Kiosk API에 영향 없음 (독립 라우트)    │
│                                                             │
│ 상태: Accepted                                               │
└─────────────────────────────────────────────────────────────┘
```

### ADR-D02: WebSocket 대신 HTTP 폴링으로 실시간 동기화

```
┌─────────────────────────────────────────────────────────────┐
│ ADR-D02: HTTP Polling over WebSocket                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 상황 (Context):                                              │
│   관리자가 CMS 콘텐츠를 변경하면 키오스크 프론트엔드에        │
│   ≤3초 내 반영되어야 함. WebSocket과 HTTP 폴링 중 선택 필요   │
│                                                             │
│ 결정 (Decision):                                             │
│   3초 간격 HTTP 폴링 + ETag/If-None-Match 캐싱              │
│                                                             │
│ 이유 (Rationale):                                            │
│   1. 단일 키오스크 환경에서 WebSocket의 이점이 제한적          │
│      (다중 클라이언트 브로드캐스트 불필요)                    │
│   2. WebSocket 서버 구현 복잡도                              │
│      (연결 관리, 재연결, 하트비트, 메모리 누수 방지)           │
│   3. ETag 기반 폴링은 변경 없을 시 304 응답으로               │
│      페이로드 제로 → 대역폭·CPU 최소                          │
│   4. 3초 폴링으로 ≤3초 반영 보장 (요구사항 충족)              │
│   5. HTTP 폴링은 추가 인프라 없이 Next.js API Route로 구현    │
│   6. 키오스크 브라우저의 Service Worker와 충돌 가능성 낮음     │
│                                                             │
│ 대안 (Alternatives Considered):                              │
│   A) WebSocket (ws / socket.io)                              │
│      → 실시간성 최고, but 구현 복잡, 메모리 오버헤드           │
│   B) Server-Sent Events (SSE)                                │
│      → 단방향 실시간, but 연결 유지 오버헤드, 프록시 타임아웃  │
│   C) Long Polling                                            │
│      → 연결 유지 오버헤드, 구현 복잡도 중간                   │
│                                                             │
│ 결과 (Consequences):                                         │
│   + 구현 단순 (fetch + setInterval)                           │
│   + 디버깅 용이 (표준 HTTP 요청)                              │
│   + ETag로 변경 없을 시 네트워크 최소                         │
│   + 추가 인프라/라이브러리 불필요                              │
│   - 최대 3초 지연 (WebSocket은 밀리초 단위)                   │
│   - 3초마다 HTTP 요청 발생 (but 304면 페이로드 0)             │
│                                                             │
│ 폴백 계획:                                                   │
│   P2 다중 키오스크 환경에서 WebSocket 도입 검토                │
│                                                             │
│ 상태: Accepted                                               │
└─────────────────────────────────────────────────────────────┘
```

### ADR-D03: 세션 기반이 아닌 JWT 기반 관리자 인증

```
┌─────────────────────────────────────────────────────────────┐
│ ADR-D03: JWT over Server-Side Session                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 상황 (Context):                                              │
│   관리자 인증에 서버 측 세션 (express-session 등)과          │
│   JWT 중 선택 필요                                           │
│                                                             │
│ 결정 (Decision):                                             │
│   JWT (Access Token 15분 + Refresh Token 7일)                │
│   httpOnly 쿠키에 저장                                       │
│                                                             │
│ 이유 (Rationale):                                            │
│   1. Stateless 인증 → 서버 측 세션 스토리지 불필요           │
│      (SQLite에 세션 테이블 추가 불필요, 메모리 절약)          │
│   2. SQLite 기반 세션 스토리지는 매 요청마다 DB 조회 발생     │
│      → JWT는 토큰 검증만으로 인증 완료 (DB 조회 0회)          │
│   3. Access Token 짧은 수명 (15분)으로 탈취 피해 최소화       │
│   4. Refresh Token으로 자동 갱신, 사용자 경험 유지             │
│   5. httpOnly + Secure + SameSite=Strict 쿠키로              │
│      XSS·CSRF 방어                                           │
│   6. Single-process 환경에서 세션 동기화 불필요                │
│                                                             │
│ 대안 (Alternatives Considered):                              │
│   A) Server-side Session (SQLite-backed)                     │
│      → 매 요청 DB 조회, 세션 만료 처리 복잡                   │
│   B) next-auth (Auth.js)                                     │
│      → 오버엔지니어링 (OAuth, 어댑터 등 불필요)               │
│   C) JWT in localStorage                                     │
│      → XSS에 취약, httpOnly 쿠키가 안전                      │
│                                                             │
│ 결과 (Consequences):                                         │
│   + Stateless, DB 조회 없이 인증                              │
│   + 빠른 검증 (HMAC 서명 확인만)                              │
│   + 수명 기반 자동 만료                                       │
│   - 토큰 폐기가 즉각적이지 않음 (Access Token 만료까지 최대 15분) │
│     → 권한 변경 시 기존 토큰에 이전 권한이 남을 수 있음        │
│     → 완화: 권한 변경 시 해당 사용자의 refreshToken 무효화     │
│   - Refresh Token 저장 공간 필요                              │
│     → AdminUser.refreshTokenHash 컬럼 추가 (단일 해시)        │
│                                                             │
│ 상태: Accepted                                               │
└─────────────────────────────────────────────────────────────┘
```

### ADR-D04: CmsContent Key-Value 테이블 구조 (개별 테이블 분리 안 함)

```
┌─────────────────────────────────────────────────────────────┐
│ ADR-D04: CmsContent Key-Value Table                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 상황 (Context):                                              │
│   CMS 콘텐츠를 화면별 개별 테이블 (IdleContent, MenuContent  │
│   등)로 분리할지, 단일 Key-Value 테이블로 통합할지 결정 필요   │
│                                                             │
│ 결정 (Decision):                                             │
│   단일 CmsContent 테이블 (key-value 구조)                    │
│   key: "idle.title_text", "menu.borrow_button_color" 등      │
│                                                             │
│ 이유 (Rationale):                                            │
│   1. CMS 항목이 지속적으로 추가/변경되는 환경에서             │
│      스키마 마이그레이션 최소화 (새 키는 INSERT만)             │
│   2. 키오스크 폴링이 단일 쿼리로 전체 콘텐츠 조회 가능        │
│      → N개 테이블이면 N개 쿼리 필요                           │
│   3. ETag 생성이 단일 테이블의 updatedAt로 간단               │
│   4. 감사 로그가 key 단위로 기록되어 세밀한 추적 가능          │
│   5. Strapi/Payload CMS의 single-type 패턴과 유사             │
│   6. SQLite에서 다수의 소형 테이블보다 단일 테이블이 효율적   │
│                                                             │
│ 대안 (Alternatives Considered):                              │
│   A) 화면별 개별 테이블 (IdleContent, MenuContent, …)        │
│      → 타입 안전성 높음, but 마이그레이션 빈번, 폴링 복잡      │
│   B) JSON 컬럼 1개에 전체 콘텐츠 저장                         │
│      → 가장 단순, but 부분 업데이트 어려움, 감사 로그 부실     │
│   C) Entity-Attribute-Value (EAV) 패턴                       │
│      → 유연성 최고, but 조인 복잡, 쿼리 성능 저하              │
│                                                             │
│ 결과 (Consequences):                                         │
│   + 스키마 변경 없이 새 CMS 항목 추가 (INSERT만)              │
│   + 단일 쿼리로 전체 콘텐츠 조회 (키오스크 폴링 효율)        │
│   + key 단위 감사 로그                                       │
│   - 타입 안전성 약화 (value가 항상 String)                    │
│     → cms-schema.ts로 key→type 매핑을 앱 레벨에서 보강        │
│   - SQLite text 컬럼에 숫자/boolean을 String으로 캐스트        │
│     → cms.ts 헬퍼에서 타입 변환 함수 제공                     │
│                                                             │
│ CmsContent 테이블 구조:                                      │
│   id         String   @id @default(uuid())                   │
│   key        String   @unique  // "idle.title_text"          │
│   type       String            // "text"|"image"|"color"|... │
│   value      String            // 값 (타입별 포맷 상이)        │
│   updatedAt  DateTime @updatedAt                              │
│   updatedBy  String            // AdminUser.id                │
│                                                             │
│ 상태: Accepted                                               │
└─────────────────────────────────────────────────────────────┘
```

### ADR-D05: 클라우드 스토리지가 아닌 로컬 파일 시스템 이미지 스토리지

```
┌─────────────────────────────────────────────────────────────┐
│ ADR-D05: File-Based Image Storage (Local)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 상황 (Context):                                              │
│   CMS 이미지 (로고, 아이콘, 배경, 도서 표지)를 어디에         │
│   저장할지 결정 필요. 클라우드 스토리지(S3, GCS) 또는          │
│   로컬 파일 시스템 선택                                       │
│                                                             │
│ 결정 (Decision):                                             │
│   /public/uploads/ 디렉토리에 로컬 파일로 저장                │
│   Next.js 정적 서빙으로 직접 접근                             │
│                                                             │
│ 이유 (Rationale):                                            │
│   1. 단일 보드 환경에서 외부 네트워크 의존 최소화              │
│      (오프라인 동작 보장, 외부 API 비용 제로)                  │
│   2. SQLite 로컬-first 철학과 일관성                          │
│   3. Next.js /public/ 디렉토리 서빙이 추가 설정 없이 동작      │
│   4. 클라우드 스토리지 SDK 추가 의존성 불필요                   │
│   5. 이미지 총 용량 제한 (500MB)으로 로컬 디스크 충분          │
│   6. Sharp 라이브러리로 업로드 시 자동 압축·리사이즈·WebP 변환  │
│                                                             │
│ 대안 (Alternatives Considered):                              │
│   A) AWS S3 / Google Cloud Storage                           │
│      → 확장성 최고, but 외부 의존, 비용, 네트워크 지연          │
│   B) MinIO (로컬 S3 호환)                                    │
│      → S3 API 호환, but 추가 프로세스, 메모리 오버헤드          │
│   C) SQLite BLOB 컬럼                                        │
│      → DB 크기 팽창, 백업 복잡, 썸네일 생성 불리               │
│   D) Next.js /api/image 라우트 + 외부 URL 프록시              │
│      → 외부 의존, 캐싱 복잡                                   │
│                                                             │
│ 결과 (Consequences):                                         │
│   + 외부 의존 제로, 오프라인 동작                              │
│   + 구현 단순 (fs.writeFile + Sharp)                          │
│   + Next.js <Image> 컴포넌트로 자동 최적화                     │
│   - 다중 서버 환경에서 파일 동기화 불가                        │
│     → 단일 보드 환경이므로 문제 없음                           │
│   - 백업 시 /public/uploads/ 디렉토리를 별도 백업 필요          │
│   - 이미지 총 용량 500MB 제한                                 │
│     → Sharp 압축 + 미사용 이미지 정리 스케줄러로 관리           │
│                                                             │
│ 파일 구조:                                                   │
│   /public/uploads/                                           │
│     ├── cms/                                                 │
│     │   ├── idle-logo-<hash>.webp                            │
│     │   ├── idle-bg-<hash>.webp                              │
│     │   └── menu-borrow-icon-<hash>.svg                      │
│     ├── books/                                               │
│     │   ├── cover-<isbn>-<hash>.webp                         │
│     │   └── ...                                              │
│     └── _temp/  (업로드 임시, 1시간 후 자동 정리)              │
│                                                             │
│ 업로드 제약:                                                  │
│   • MIME: PNG, JPG, SVG만 허용                               │
│   • 크기: 이미지 유형별 제한 (아이콘 50KB, 로고 500KB,         │
│           배경 2MB, 표지 2MB)                                 │
│   • SVG: DOMPurify로 sanitize (XSS 방지)                     │
│   • 자동 처리: Sharp로 리사이즈 + WebP 변환 (SVG 제외)         │
│                                                             │
│ 상태: Accepted                                               │
└─────────────────────────────────────────────────────────────┘
```

---

> **변경 이력**

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| v1.0.0 | 2026-03-05 | 최초 작성 | Dashboard Architecture Team |
