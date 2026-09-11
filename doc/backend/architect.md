# 스마트 도서관 키오스크 시뮬레이터 — 백엔드 관리자 대시보드 아키텍처

> **버전**: v1.0.0  
> **작성일**: 2026-03-05  
> **상태**: Design-Complete  
> **담당**: Backend Architecture Team  
> **참조**: [키오스크 아키텍처](../architect.md) · [대시보드 아키텍처](../dashboard/architect.md) · [DB 설계](../dashboard/database.md) · [API 명세](../dashboard/api.md)

---

## 목차

1. [시스템 전체 구조](#1-시스템-전체-구조)
2. [디렉토리 구조](#2-디렉토리-구조)
3. [데이터 흐름 아키텍처](#3-데이터-흐름-아키텍처)
4. [컴포넌트 아키텍처](#4-컴포넌트-아키텍처)
5. [API 아키텍처](#5-api-아키텍처)
6. [실시간 동기화 아키텍처](#6-실시간-동기화-아키텍처)
7. [RBAC 아키텍처](#7-rbac-아키텍처)
8. [감사 로그 아키텍처](#8-감사-로그-아키텍처)
9. [미들웨어 아키텍처](#9-미들웨어-아키텍처)
10. [배포 아키텍처](#10-배포-아키텍처)
11. [ADR (Architecture Decision Records)](#11-adr-architecture-decision-records)

---

## 1. 시스템 전체 구조

### 1.1 아키텍처 개요

백엔드 관리자 대시보드는 기존 스마트 도서관 키오스크 시뮬레이터(Next.js 16, port 3000) 내에 **`/admin/*` 경로로 통합**되는 모듈이다. 별도 프로세스나 포트 없이 동일한 SQLite 데이터베이스와 Prisma 클라이언트를 공유하며, 관리자가 변경한 CMS 콘텐츠가 키오스크 프론트엔드에 폴링 기반 실시간 동기화로 반영되는 구조를 갖는다.

### 1.2 시스템 구조 다이어그램

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                       Single Next.js 16 Process (port 3000)                       │
│                                                                                    │
│  ┌──────────────────────────────┐     ┌──────────────────────────────────────┐    │
│  │   KIOSK FRONTEND (기존)       │     │   ADMIN DASHBOARD (신규)             │    │
│  │   / (루트 경로)                │     │   /admin/* (관리자 경로)              │    │
│  │                              │     │                                      │    │
│  │  ┌─────────┐ ┌───────────┐  │     │  ┌────────────┐ ┌──────────────┐   │    │
│  │  │IdleScreen│ │ MainMenu  │  │     │  │AdminLayout │ │ContentMgmt  │   │    │
│  │  └─────────┘ └───────────┘  │     │  └────────────┘ └──────────────┘   │    │
│  │  ┌─────────┐ ┌───────────┐  │     │  ┌────────────┐ ┌──────────────┐   │    │
│  │  │AuthScan │ │LoanSelect │  │     │  │BookMgmt    │ │UserMgmt      │   │    │
│  │  └─────────┘ └───────────┘  │     │  └────────────┘ └──────────────┘   │    │
│  │  ┌─────────┐ ┌───────────┐  │     │  ┌────────────┐ ┌──────────────┐   │    │
│  │  │LoanConf │ │RetComplete│  │     │  │Settings    │ │AuditLog      │   │    │
│  │  └─────────┘ └───────────┘  │     │  └────────────┘ └──────────────┘   │    │
│  │           ... (11 screens)   │     │  ┌──────────────────────────────┐  │    │
│  │                              │     │  │DashboardOverview (통계 요약) │  │    │
│  │  ┌──────────────────────┐   │     │  └──────────────────────────────┘  │    │
│  │  │  useAppStore (Zustand)│   │     │                                      │    │
│  │  │  screen, user, books  │   │     │  ┌──────────────────────────────┐  │    │
│  │  └──────────────────────┘   │     │  │  useAdminStore (Zustand)     │  │    │
│  │                              │     │  │  auth, cms, users, settings  │  │    │
│  └──────────────┬───────────────┘     │  └──────────────────────────────┘  │    │
│                 │                      └──────────────┬───────────────────────┘    │
│                 │   ┌───── 폴링 (30s ETag) ◄───────┘                           │
│                 │   └───── CMS 변경 전파 ──────────►                           │
│                 │                                                                │
│  ┌──────────────┴────────────────────────────────────────────────────────────┐   │
│  │                        API LAYER (Next.js Route Handlers)                  │   │
│  │                                                                            │   │
│  │  ┌───── Kiosk API (기존) ──────┐  ┌───── Admin API (신규, 인증 필요) ────┐ │   │
│  │  │ GET    /api/books           │  │ POST   /api/admin/auth/login        │ │   │
│  │  │ GET    /api/loans           │  │ POST   /api/admin/auth/logout       │ │   │
│  │  │ POST   /api/loans           │  │ GET    /api/admin/auth/me           │ │   │
│  │  │ POST   /api/loans/[id]/return│ │ GET    /api/admin/content           │ │   │
│  │  │ GET    /api/users           │  │ PATCH  /api/admin/content/:key      │ │   │
│  │  │ POST   /api/users           │  │ POST   /api/admin/content/upload    │ │   │
│  │  │ ...                          │  │ GET    /api/admin/users             │ │   │
│  │  └──────────────────────────────┘  │ POST   /api/admin/users             │ │   │
│  │                                    │ GET    /api/admin/books             │ │   │
│  │  ┌───── Public Content API ─────┐  │ POST   /api/admin/books             │ │   │
│  │  │ GET  /api/content            │  │ GET    /api/admin/analytics         │ │   │
│  │  │ GET  /api/content/:key      │  │ GET    /api/admin/settings          │ │   │
│  │  │ (키오스크 30s 폴링 대상)     │  │ PATCH  /api/admin/settings          │ │   │
│  │  └──────────────────────────────┘  │ GET    /api/admin/audit             │ │   │
│  │                                    │ POST   /api/admin/kiosk/restart     │ │   │
│  │                                    └──────────────────────────────────────┘ │   │
│  └────────────────────────────────────┬───────────────────────────────────────┘   │
│                                       │ Prisma Client (싱글톤)                     │
│                                       ▼                                             │
│  ┌────────────────────────────────────────────────────────────────────────────┐   │
│  │                      DATA LAYER (SQLite via Prisma)                         │   │
│  │                                                                            │   │
│  │  ┌─── Kiosk Core ──────┐  ┌─── Admin Ops ────┐  ┌─── System Infra ────┐  │   │
│  │  │ SimUser              │  │ AdminUser        │  │ SystemSetting       │  │   │
│  │  │ Book                 │  │ AdminRole        │  │ AuditLog            │  │   │
│  │  │ SimLoan              │  │ CmsContent       │  │ KioskDevice         │  │   │
│  │  │ LearningProgress     │  │ CmsImage         │  │ Notice              │  │   │
│  │  │ Scenario             │  │                  │  │                     │  │   │
│  │  └──────────────────────┘  └──────────────────┘  └─────────────────────┘  │   │
│  │                           custom.db (SQLite WAL)                           │   │
│  └────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 레이어 간 관계 요약

```
┌─────────────────────────────────────────────────────────────────┐
│                       Presentation Layer                        │
│  ┌───────────────────────┐    ┌───────────────────────────────┐ │
│  │  Kiosk Frontend        │    │  Admin Dashboard Frontend     │ │
│  │  (11 screens, Zustand) │    │  (6 pages, Zustand, RBAC)    │ │
│  └───────────┬───────────┘    └──────────────┬────────────────┘ │
└──────────────┼───────────────────────────────┼──────────────────┘
               │ fetch /api                    │ fetch /api/admin
               ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API Layer                              │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Kiosk API     │  │ Public CMS   │  │ Admin API (JWT+RBAC)  │ │
│  │ (기존)        │  │ (키오스크용)  │  │ (신규)                │ │
│  └───────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
└──────────┼─────────────────┼──────────────────────┼─────────────┘
           │                 │                      │
           └────────┬────────┘                      │
                    │ Prisma Client                 │ 인증 미들웨어
                    ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Database Layer (SQLite)                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────────┐ │
│  │ Kiosk     │  │ CMS       │  │ Auth      │  │ Audit       │ │
│  │ Domain    │  │ Domain    │  │ Domain    │  │ Domain      │ │
│  └───────────┘  └───────────┘  └───────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 디렉토리 구조

### 2.1 전체 디렉토리 트리

```
src/
├── app/
│   ├── layout.tsx                          # 루트 레이아웃 (기존, 변경 없음)
│   ├── page.tsx                            # 키오스크 진입점 (기존)
│   ├── globals.css                         # 글로벌 스타일 (기존)
│   │
│   ├── admin/                              # ★ 관리자 대시보드 라우트 그룹
│   │   ├── layout.tsx                      #   AdminLayout (인증 가드 + 사이드바)
│   │   ├── page.tsx                        #   /admin → DashboardOverview (통계 홈)
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
│       ├── route.ts                        # GET /api (헬스체크, 기존)
│       ├── seed/route.ts                   # POST /api/seed (기존)
│       ├── books/route.ts                  # GET /api/books (기존)
│       ├── loans/...                       # 기존 키오스크 API
│       ├── users/...                       # 기존 키오스크 API
│       ├── progress/...                    # 기존 키오스크 API
│       │
│       ├── content/                        # ★ 공개 CMS API (키오스크 폴링 대상)
│       │   ├── route.ts                    #   GET /api/content (전체 콘텐츠 + ETag)
│       │   └── [key]/
│       │       └── route.ts                #   GET /api/content/:key (단일 항목)
│       │
│       └── admin/                          # ★ 관리자 전용 API (JWT 인증 필요)
│           ├── auth/
│           │   ├── login/route.ts          #   POST /api/admin/auth/login
│           │   ├── logout/route.ts         #   POST /api/admin/auth/logout
│           │   └── me/route.ts             #   GET  /api/admin/auth/me
│           ├── content/
│           │   ├── route.ts                #   GET /api/admin/content
│           │   └── [key]/
│           │       └── route.ts            #   PATCH /api/admin/content/:key
│           ├── content-upload/
│           │   └── route.ts                #   POST /api/admin/content/upload
│           ├── users/
│           │   ├── route.ts                #   GET/POST /api/admin/users
│           │   └── [id]/
│           │       └── route.ts            #   GET/PATCH/DELETE /api/admin/users/:id
│           ├── books/
│           │   ├── route.ts                #   GET/POST /api/admin/books
│           │   └── [id]/
│           │       └── route.ts            #   GET/PATCH/DELETE /api/admin/books/:id
│           ├── analytics/
│           │   └── route.ts                #   GET /api/admin/analytics
│           ├── settings/
│           │   └── route.ts                #   GET/PATCH /api/admin/settings
│           ├── audit/
│           │   └── route.ts                #   GET /api/admin/audit
│           ├── accounts/
│           │   ├── route.ts                #   GET/POST /api/admin/accounts
│           │   └── [id]/
│           │       └── route.ts            #   PATCH /api/admin/accounts/:id
│           └── kiosk/
│               └── route.ts                #   POST /api/admin/kiosk/restart
│
├── components/
│   ├── kiosk/                              # 기존 키오스크 컴포넌트 (변경 없음)
│   ├── ui/                                 # 기존 shadcn/ui 프리미티브 (변경 없음)
│   │
│   └── admin/                              # ★ 관리자 대시보드 전용 컴포넌트
│       ├── AdminLayout.tsx                 #   레이아웃 셸 (사이드바 + 헤더 + 메인)
│       ├── AdminSidebar.tsx                #   사이드바 내비게이션
│       ├── AdminHeader.tsx                 #   상단 헤더 (사용자 정보, 로그아웃)
│       ├── AdminGuard.tsx                  #   인증 가드 (미인증 시 리다이렉트)
│       ├── PermissionGate.tsx              #   RBAC 권한 게이트 (UI 요소 표시/숨김)
│       │
│       ├── cms/                            #   CMS 콘텐츠 편집기
│       │   ├── ContentEditor.tsx           #     콘텐츠 편집 메인 컴포넌트
│       │   ├── ContentGroup.tsx            #     화면별 콘텐츠 그룹 (Idle, Menu, Auth…)
│       │   ├── TextFieldEditor.tsx         #     텍스트 타입 편집기
│       │   ├── ColorFieldEditor.tsx        #     컬러 피커 편집기
│       │   ├── ImageFieldEditor.tsx        #     이미지 업로드/교체 편집기
│       │   ├── NumberFieldEditor.tsx       #     숫자 입력 편집기
│       │   ├── BooleanFieldEditor.tsx      #     토글 스위치 편집기
│       │   ├── JsonFieldEditor.tsx         #     JSON 에디터 (카테고리 목록 등)
│       │   └── ContentDiffViewer.tsx       #     변경 전후 diff 뷰어
│       │
│       ├── analytics/                      #   통계 분석 컴포넌트
│       │   ├── StatsCards.tsx             #     오늘의 현황 4개 지표 카드
│       │   ├── HourlyChart.tsx            #     시간대별 대출·반납 그래프
│       │   ├── TopBooksList.tsx           #     인기 도서 TOP 10
│       │   ├── RecentActivity.tsx          #     최근 활동 로그
│       │   └── DateRangePicker.tsx        #     기간 선택 피커
│       │
│       ├── users/                          #   사용자 관리 컴포넌트
│       │   ├── UserTable.tsx              #     이용자 목록 테이블
│       │   ├── UserForm.tsx               #     이용자 등록/수정 폼
│       │   ├── UserDetail.tsx             #     이용자 상세 뷰
│       │   ├── AccountTable.tsx           #     관리자 계정 테이블
│       │   └── AccountForm.tsx            #     관리자 계정 등록/수정 폼
│       │
│       ├── books/                          #   도서 관리 컴포넌트
│       │   ├── BookTable.tsx              #     도서 목록 테이블
│       │   ├── BookForm.tsx               #     도서 등록/수정 폼
│       │   └── BookImport.tsx             #     CSV 일괄 가져오기
│       │
│       ├── settings/                       #   시스템 설정 컴포넌트
│       │   ├── KioskConfig.tsx            #     키오스크 설정 (타임아웃, 언어 등)
│       │   ├── ThemeSettings.tsx          #     테마 설정 (색상, 레이아웃)
│       │   ├── MaintenanceMode.tsx        #     유지보수 모드 토글
│       │   └── BackupRestore.tsx          #     DB 백업/복원
│       │
│       └── audit/                          #   감사 로그 컴포넌트
│           ├── AuditTable.tsx             #     감사 로그 테이블
│           └── AuditDetail.tsx            #     감사 상세 뷰 (변경 전후 diff)
│
├── stores/
│   ├── useAppStore.ts                      # 기존 키오스크 Zustand 스토어
│   └── useAdminStore.ts                    # ★ 관리자 대시보드 Zustand 스토어
│
├── lib/
│   ├── constants.ts                        # 기존 상수 (변경 없음)
│   ├── security.ts                         # 기존 보안 모듈 (변경 없음)
│   ├── db.ts                               # 기존 Prisma 클라이언트 싱글톤
│   ├── utils.ts                            # 기존 cn() 유틸리티
│   ├── tts.ts                              # 기존 TTS 모듈
│   ├── admin-auth.ts                       # ★ RBAC 인증/인가 구현
│   ├── content-sync.ts                     # ★ 실시간 콘텐츠 동기화
│   ├── audit-logger.ts                     # ★ 감사 로그 기록 유틸리티
│   └── content-cache.ts                    # ★ 콘텐츠 인메모리 캐시 + 버전 관리
│
├── hooks/
│   ├── use-pwa.ts                          # 기존 PWA 훅
│   ├── use-mobile.ts                       # 기존 모바일 감지 훅
│   ├── use-toast.ts                        # 기존 토스트 훅
│   ├── use-cms.ts                          # ★ CMS 콘텐츠 폴링 훅 (키오스크용)
│   └── use-permission.ts                   # ★ 권한 확인 훅 (대시보드용)
│
└── types/
    └── admin.ts                            # ★ 관리자 도메인 타입 정의
```

### 2.2 신규 파일 의존성 그래프

```
┌─────────────────────────────────────────────────────────────────┐
│                     Admin Dashboard Pages                       │
│                                                                 │
│  /admin/page.tsx (DashboardOverview)                            │
│    ├── AdminLayout                                              │
│    │     ├── AdminSidebar                                       │
│    │     ├── AdminHeader                                        │
│    │     └── AdminGuard ──► useAdminStore (auth)               │
│    ├── StatsCards ──► GET /api/admin/analytics                  │
│    ├── HourlyChart ──► GET /api/admin/analytics                 │
│    ├── TopBooksList ──► GET /api/admin/analytics                │
│    └── RecentActivity ──► GET /api/admin/audit                  │
│                                                                 │
│  /admin/content/page.tsx (ContentManagement)                    │
│    ├── ContentEditor ──► GET/PATCH /api/admin/content           │
│    │     ├── ContentGroup (화면별 그룹)                          │
│    │     ├── TextFieldEditor                                    │
│    │     ├── ColorFieldEditor                                   │
│    │     ├── ImageFieldEditor ──► POST /api/admin/content/upload│
│    │     ├── NumberFieldEditor                                  │
│    │     ├── BooleanFieldEditor                                 │
│    │     ├── JsonFieldEditor                                    │
│    │     └── ContentDiffViewer                                  │
│    └── PermissionGate ──► use-permission (role: admin+)         │
│                                                                 │
│  /admin/users/page.tsx (UserManagement)                         │
│    ├── UserTable ──► GET /api/admin/users                       │
│    ├── UserForm ──► POST/PATCH /api/admin/users                 │
│    ├── UserDetail ──► GET /api/admin/users/:id                  │
│    ├── AccountTable ──► GET /api/admin/accounts                 │
│    ├── AccountForm ──► POST/PATCH /api/admin/accounts           │
│    └── PermissionGate                                           │
│                                                                 │
│  /admin/books/page.tsx (BookManagement)                         │
│    ├── BookTable ──► GET /api/admin/books                       │
│    ├── BookForm ──► POST/PATCH /api/admin/books                 │
│    ├── BookImport ──► POST /api/admin/books/import              │
│    └── PermissionGate                                           │
│                                                                 │
│  /admin/settings/page.tsx (SystemSettings)                      │
│    ├── KioskConfig ──► GET/PATCH /api/admin/settings            │
│    ├── ThemeSettings ──► PATCH /api/admin/content (색상 CMS)    │
│    ├── MaintenanceMode ──► PATCH /api/admin/settings            │
│    ├── BackupRestore ──► GET /api/admin/settings/backup         │
│    └── PermissionGate (role: super_admin)                       │
│                                                                 │
│  /admin/audit-log/page.tsx (AuditLog)                           │
│    ├── AuditTable ──► GET /api/admin/audit                      │
│    ├── AuditDetail                                              │
│    └── PermissionGate (role: admin+)                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 데이터 흐름 아키텍처

### 3.1 콘텐츠 편집 흐름 (Admin UI → API → DB → Cache → Kiosk)

```
┌──────────────┐    ① PATCH 요청    ┌───────────────────────┐    ② Prisma WRITE    ┌──────────────┐
│  Admin UI    │ ─────────────────► │ /api/admin/content/   │ ───────────────────► │  CmsContent  │
│  (편집 폼)   │                    │ :key                   │                      │  (SQLite)    │
│              │ ◄──────────────── │                        │                      └──────┬───────┘
│  ⑥ 토스트    │    ③ 200 OK       │  ③' AuditLog 기록     │                             │
│  "저장됨"    │                    │      + 캐시 갱신       │                             │
└──────────────┘                    └───────────────────────┘                             │
                                                                                          │ ④ content-cache
                                                                                          │   version++
                                                                                          ▼
                                                                                 ┌──────────────────┐
                                                                                 │ Content Cache    │
                                                                                 │ (인메모리)        │
                                                                                 │ version: N       │
                                                                                 │ data: Map<key,  │
                                                                                 │   value>         │
                                                                                 └────────┬─────────┘
                                                                                          │
                                                    ⑤ 키오스크 폴링 (30s)                  │
┌──────────────┐    ⑧ Re-render   ┌───────────────┐    ⑦ Zustand set()    ┌───────▼────────┐
│  Kiosk UI    │ ◄────────────── │  useCmsStore   │ ◄────────────────── │  GET /api/content│
│  (IdleScreen │                  │  (Zustand)     │    ⑥ JSON + ETag    │  (If-None-Match)│
│   etc.)      │                  └───────────────┘                      └────────────────┘
└──────────────┘
```

| 단계 | 설명 | 지연 |
|------|------|------|
| ① | 관리자가 편집 폼에서 값 변경 후 "저장" 클릭 | 사용자 액션 |
| ② | Admin API가 Prisma로 `CmsContent` 테이블에 UPSERT | ~5ms |
| ③ | API가 `AuditLog`에 변경 전후값 기록 + 응답 200 OK | ~3ms |
| ③' | `content-cache.ts` 인메모리 캐시 갱신 + version++ | ~1ms |
| ④ | 캐시 버전 카운터 증분, ETag 값 변경 | ~0ms |
| ⑤ | 키오스크 프론트엔드가 30초 간격으로 `GET /api/content` 폴링 | ≤30s |
| ⑥ | 서버가 ETag 비교, 변경 시 200 + 새 데이터, 미변경 시 304 | ~2ms |
| ⑦ | Zustand `useCmsStore.setCmsContent()` 호출로 전역 상태 갱신 | ~1ms |
| ⑧ | React가 상태 변경 감지, 해당 CMS 값을 사용하는 컴포넌트만 Re-render | ~16ms |

**총 전파 지연**: CMS 저장 후 **≤30초** 내 키오스크 화면에 반영 (ETag 기반 최적화 시 변경 즉시 응답)

### 3.2 RBAC 인증·인가 흐름 (Login → Session → Role Check → Permission Gate)

```
┌──────────────┐    ① POST          ┌───────────────────────┐    ② bcrypt 비교     ┌──────────────┐
│  Login Page  │ ─────────────────► │ /api/admin/auth/      │ ─────────────────► │  AdminUser   │
│  (이메일+PW) │                    │ login                  │                    │  (SQLite)    │
│              │                    │                        │ ◄──────────────── │  passwordHash │
│              │                    │                        │    ③ 일치 여부      └──────────────┘
│              │                    │  ④ JWT 발급            │
│              │ ◄──────────────── │  {accessToken,         │
│              │    Set-Cookie     │   refreshToken}        │
│              │    (httpOnly)     │                        │
└──────────────┘                    └───────────────────────┘
       │
       │ ⑤ 이후 모든 Admin API 요청
       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Request: GET /api/admin/content                                            │
│  Cookie: token=<JWT>                                                        │
│                                                                             │
│  ┌─────────┐    ⑥ JWT 검증     ┌──────────────┐    ⑦ 권한 확인   ┌────────┐│
│  │Middleware│ ──────────────► │  admin-auth.ts│ ─────────────► │ RBAC   ││
│  │  (Next)  │                  │  verifyJWT()  │                │ Table  ││
│  └─────────┘                    └──────────────┘                └────────┘│
│       │                                                              │     │
│       │  ⑧ 응답                                        ⑨ 허용/거부  │     │
│       ▼                                                              ▼     │
│  ┌───────────────┐                                          ┌─────────────┐│
│  │ 200 + Data    │ (권한 있음)                               │ 403         ││
│  └───────────────┘                                          │ Forbidden   ││
│                                                              └─────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

| 단계 | 설명 |
|------|------|
| ① | 로그인 페이지에서 이메일 + 비밀번호 입력 후 제출 |
| ② | 서버가 `AdminUser` 테이블에서 이메일로 계정 조회 후 bcrypt 비교 |
| ③ | 비밀번호 일치 여부 확인 (5회 실패 시 15분 잠금) |
| ④ | JWT Access Token (15분) + Refresh Token (7일) 발급 |
| ⑤ | httpOnly 쿠키에 토큰 저장, 이후 모든 Admin API 요청에 자동 첨부 |
| ⑥ | Next.js 미들웨어에서 JWT 서명 검증 + 만료 확인 |
| ⑦ | `admin-auth.ts`에서 페이로드의 role 추출 후 요청 API의 필요 권한과 비교 |
| ⑧ | 권한 충족 시 200 OK + 데이터 응답 |
| ⑨ | 권한 부족 시 403 Forbidden 응답 |

### 3.3 감사 로그 흐름 (Action → Middleware → Audit Table)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Admin API Request                                │
│  PATCH /api/admin/content/:key  { value: "새 텍스트" }              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ① Route Handler 실행                                                │
│     - 기존값 조회: oldValue = GET CmsContent WHERE key = :key        │
│     - 새값 적용: UPSERT CmsContent SET value = "새 텍스트"          │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ② audit-logger.ts 기록                                              │
│     AuditLog.create({                                                │
│       action:    "UPDATE",                                           │
│       entity:    "CmsContent",                                       │
│       entityId:  ":key",                                             │
│       oldValue:  JSON.stringify(oldValue),    // 변경 전              │
│       newValue:  JSON.stringify("새 텍스트"), // 변경 후              │
│       performedBy: adminUser.id,                                     │
│       performedAt: new Date()                                        │
│     })                                                               │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ③ AuditLog 테이블 (SQLite)                                         │
│  ┌──────────┬────────┬───────────┬─────────┬──────────┬────────────┐│
│  │ action   │ entity │ entityId  │ oldValue│ newValue │ performedBy││
│  ├──────────┼────────┼───────────┼─────────┼──────────┼────────────┤│
│  │ UPDATE   │ CmsCont│ idle.title│ "스마트  │ "성북구   │ admin-001  ││
│  │          │ ent    │ _text     │ 도서관  │ 도서관"  │            ││
│  └──────────┴────────┴───────────┴─────────┴──────────┴────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

**감사 로그가 기록되는 작업 목록**:

| 작업 | action | 기록 시점 |
|------|--------|-----------|
| CMS 콘텐츠 변경 | `UPDATE` | PATCH /api/admin/content/:key |
| 도서 등록 | `CREATE` | POST /api/admin/books |
| 도서 수정 | `UPDATE` | PATCH /api/admin/books/:id |
| 도서 삭제 | `DELETE` | DELETE /api/admin/books/:id |
| 이용자 등록 | `CREATE` | POST /api/admin/users |
| 이용자 수정 | `UPDATE` | PATCH /api/admin/users/:id |
| 이용자 삭제 | `DELETE` | DELETE /api/admin/users/:id |
| 관리자 계정 생성 | `CREATE` | POST /api/admin/accounts |
| 관리자 권한 변경 | `UPDATE` | PATCH /api/admin/accounts/:id |
| 로그인 | `LOGIN` | POST /api/admin/auth/login |
| 로그아웃 | `LOGOUT` | POST /api/admin/auth/logout |
| 시스템 설정 변경 | `UPDATE` | PATCH /api/admin/settings |
| 이미지 업로드 | `UPLOAD` | POST /api/admin/content/upload |

---

## 4. 컴포넌트 아키텍처

### 4.1 관리자 대시보드 페이지 계층

```
┌──────────────────────────────────────────────────────────────────┐
│                     /admin/layout.tsx                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  AdminGuard                                                │  │
│  │    if (!isAuthenticated) redirect → /admin/login           │  │
│  │                                                            │  │
│  │  ┌──────────┐ ┌──────────────────────────────────────────┐│  │
│  │  │          │ │                                          ││  │
│  │  │  Admin   │ │            {children}                    ││  │
│  │  │  Sidebar │ │                                          ││  │
│  │  │          │ │  ┌─────────────────────────────────────┐ ││  │
│  │  │ ┌──────┐│ │  │  AdminHeader                         │ ││  │
│  │  │ │대시보드││ │  │  [사용자명] [역할] [로그아웃]        │ ││  │
│  │  │ ├──────┤│ │  └─────────────────────────────────────┘ ││  │
│  │  │ │콘텐츠││ │                                          ││  │
│  │  │ ├──────┤│ │  ┌─────────────────────────────────────┐ ││  │
│  │  │ │도서  ││ │  │                                     │ ││  │
│  │  │ ├──────┤│ │  │       Page Content                  │ ││  │
│  │  │ │사용자││ │  │                                     │ ││  │
│  │  │ ├──────┤│ │  │                                     │ ││  │
│  │  │ │설정  ││ │  │                                     │ ││  │
│  │  │ ├──────┤│ │  │                                     │ ││  │
│  │  │ │감사  ││ │  │                                     │ ││  │
│  │  │ └──────┘│ │  └─────────────────────────────────────┘ ││  │
│  │  │          │ │                                          ││  │
│  │  └──────────┘ └──────────────────────────────────────────┘│  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 DashboardOverview (대시보드 홈)

```
┌──────────────────────────────────────────────────────────────┐
│  /admin → DashboardOverview                                  │
│                                                              │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐   │
│  │ 금일 대출  │ │ 금일 반납  │ │ 대출 중   │ │ 연체 건수  │   │
│  │   12건     │ │   8건     │ │   34권    │ │   3건     │   │
│  │  ▲ +3     │ │  ▲ +1    │ │           │ │  ▼ -1     │   │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘   │
│  (StatsCards)                                                │
│                                                              │
│  ┌─────────────────────────┐  ┌─────────────────────────┐   │
│  │                         │  │  인기 도서 TOP 10        │   │
│  │  시간대별 대출·반납      │  │  1. 해리포터 (28회)     │   │
│  │  ▓▓░▓▓▓▓░▓▓░▓          │  │  2. 어린왕자 (24회)     │   │
│  │  (HourlyChart)          │  │  3. ...                 │   │
│  │                         │  │  (TopBooksList)         │   │
│  └─────────────────────────┘  └─────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  최근 활동                                            │   │
│  │  14:32  김철수  해리포터  대출                        │   │
│  │  14:28  이영희  어린왕자  반납                        │   │
│  │  (RecentActivity)                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**데이터 소스**: `GET /api/admin/analytics`

### 4.3 ContentManagement (CMS 콘텐츠 관리)

```
┌──────────────────────────────────────────────────────────────┐
│  /admin/content → ContentManagement                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  화면 선택 탭: [대기] [메인메뉴] [인증] [선택]       │   │
│  │                [대출완료] [반납완료] [대출규칙]        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌───────────────────────────┐  ┌────────────────────────┐  │
│  │  ContentGroup: 대기 화면   │  │  미리보기 (선택)      │  │
│  │                           │  │                        │  │
│  │  로고 이미지              │  │  ┌──────────────────┐ │  │
│  │  ┌─────────────────────┐ │  │  │                  │ │  │
│  │  │ [이미지 업로드 영역] │ │  │  │  Idle Screen    │ │  │
│  │  │   (ImageFieldEditor)│ │  │  │  프리뷰         │ │  │
│  │  └─────────────────────┘ │  │  │                  │ │  │
│  │                           │  │  └──────────────────┘ │  │
│  │  타이틀 텍스트            │  │                        │  │
│  │  ┌─────────────────────┐ │  │                        │  │
│  │  │ 스마트 도서관       │ │  │                        │  │
│  │  │   (TextFieldEditor) │ │  │                        │  │
│  │  └─────────────────────┘ │  │                        │  │
│  │                           │  │                        │  │
│  │  배경색                  │  │                        │  │
│  │  ┌─────────────────────┐ │  │                        │  │
│  │  │ [■ #1E3A5F]         │ │  │                        │  │
│  │  │   (ColorFieldEditor)│ │  │                        │  │
│  │  └─────────────────────┘ │  │                        │  │
│  │                           │  │                        │  │
│  │  [저장]  [초기화]         │  │                        │  │
│  └───────────────────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 UserManagement (사용자 관리)

```
┌──────────────────────────────────────────────────────────────┐
│  /admin/users → UserManagement                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  [검색] [상태 필터 ▼] [역할 필터 ▼]  [+ 신규 등록]  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  이름    │ RFID      │ 상태     │ 대출권수 │ 역할    │   │
│  ├──────────┼───────────┼──────────┼──────────┼─────────┤   │
│  │  김철수  │ RF-00123  │ 활성     │ 2        │ 이용자  │   │
│  │  이영희  │ RF-00456  │ 활성     │ 1        │ 이용자  │   │
│  │  관리자1 │ —         │ 활성     │ —        │ admin   │   │
│  └──────────────────────────────────────────────────────┘   │
│  (UserTable / AccountTable)                                  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ◀ 1  2  3  4  5 ▶   50건/페이지  총 243건         │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 4.5 BookManagement (도서 관리)

```
┌──────────────────────────────────────────────────────────────┐
│  /admin/books → BookManagement                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  [검색] [카테고리 ▼] [상태 ▼]  [+ 등록] [CSV 가져오기]│  │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 표지 │ 도서명    │ 저자    │ ISBN       │ 가용/총  │   │
│  ├──────┼───────────┼─────────┼────────────┼──────────┤   │
│  │ [img]│ 해리포터  │ J.K.    │ 978-...    │ 2/3      │   │
│  │ [img]│ 어린왕자  │ 생텍    │ 978-...    │ 1/3      │   │
│  └──────────────────────────────────────────────────────┘   │
│  (BookTable)                                                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ◀ 1  2  3 ... 20 ▶   50건/페이지  총 987건         │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 4.6 SystemSettings (시스템 설정)

```
┌──────────────────────────────────────────────────────────────┐
│  /admin/settings → SystemSettings                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  키오스크 설정                                        │   │
│  │  ────────────                                         │   │
│  │  세션 타임아웃: [300] 초                              │   │
│  │  유휴 화면 복귀: [30] 초                              │   │
│  │  기본 언어: [한국어 ▼]                                │   │
│  │  (KioskConfig)                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  테마 설정                                            │   │
│  │  ────────                                             │   │
│  │  주 색상: [■ #1E3A5F]                                 │   │
│  │  강조 색상: [■ #2563EB]                               │   │
│  │  배경 색상: [■ #FFFFFF]                               │   │
│  │  (ThemeSettings)                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  유지보수 모드                                        │   │
│  │  ──────────                                           │   │
│  │  [○ 활성 / ● 유지보수]                               │   │
│  │  유지보수 메시지: "시스템 점검 중입니다"              │   │
│  │  (MaintenanceMode)                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  백업/복원                                            │   │
│  │  ────────                                             │   │
│  │  [DB 백업 다운로드]  [DB 복원 (파일 선택)]           │   │
│  │  (BackupRestore) — super_admin 전용                   │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 4.7 AuditLog (감사 로그)

```
┌──────────────────────────────────────────────────────────────┐
│  /admin/audit-log → AuditLog                                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  [기간 선택] [작업자 필터] [항목 유형 ▼]  [CSV 내보내기]│  │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 시각      │ 작업자 │ 작업  │ 항목     │ 변경 내용    │   │
│  ├───────────┼───────┼───────┼──────────┼──────────────┤   │
│  │ 14:32:05  │ admin1│ UPDATE│ CmsCont  │ "스마트 도서관"│   │
│  │           │       │       │          │ → "성북구 도서관"│  │
│  │ 14:28:12  │ admin1│ CREATE│ Book     │ 해리포터 신규  │   │
│  │ 14:15:00  │ admin2│ LOGIN │ Auth     │ 로그인         │   │
│  └──────────────────────────────────────────────────────┘   │
│  (AuditTable)                                                │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  항목 클릭 → AuditDetail: 변경 전후 diff 하이라이트   │   │
│  │  - "스마트 도서관"  (삭제선)                          │   │
│  │  + "성북구 도서관"  (초록 하이라이트)                │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 4.8 공통 컴포넌트 패턴

#### PermissionGate 컴포넌트

```typescript
// UI 요소의 표시/숨김을 RBAC 권한으로 제어
function PermissionGate({
  requiredRole,
  children,
  fallback = null
}: {
  requiredRole: 'super_admin' | 'admin' | 'operator';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user } = useAdminStore();
  const hasPermission = checkPermission(user.role, requiredRole);
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}

// 사용 예:
<PermissionGate requiredRole="admin">
  <Button onClick={handleSave}>저장</Button>
</PermissionGate>

<PermissionGate requiredRole="super_admin">
  <BackupRestore />
</PermissionGate>
```

#### AdminGuard 컴포넌트

```typescript
// 인증되지 않은 사용자를 로그인 페이지로 리다이렉트
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checkSession } = useAdminStore();

  useEffect(() => {
    checkSession(); // GET /api/admin/auth/me
  }, []);

  if (!isAuthenticated) {
    redirect('/admin/login');
    return null;
  }

  return <>{children}</>;
}
```

---

## 5. API 아키텍처

### 5.1 전체 API 엔드포인트 맵

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           API Architecture                                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─── Kiosk API (기존, 인증 불필요) ────────────────────────────────────┐ │
│  │  GET    /api                     헬스체크                             │ │
│  │  GET    /api/books               도서 목록 조회                       │ │
│  │  GET    /api/loans               대출 기록 조회                       │ │
│  │  POST   /api/loans               대출 실행                            │ │
│  │  POST   /api/loans/[id]/return   반납 실행                            │ │
│  │  POST   /api/loans/[id]/extend   대출 연장                            │ │
│  │  GET    /api/users               사용자 조회                          │ │
│  │  POST   /api/users               사용자 생성 (키오스크 가입)          │ │
│  │  POST   /api/users/[id]/card     카드 발급                            │ │
│  │  POST   /api/users/[id]/pin      PIN 변경                             │ │
│  │  POST   /api/seed                시드 데이터 초기화                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌─── Public Content API (키오스크 폴링 대상, 인증 불필요) ─────────────┐ │
│  │  GET    /api/content             전체 CMS 콘텐츠 (ETag 지원)         │ │
│  │  GET    /api/content/[key]       단일 CMS 콘텐츠 항목                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌─── Admin API (JWT 인증 + RBAC 필요) ────────────────────────────────┐ │
│  │                                                                        │ │
│  │  [인증]                                                                │ │
│  │  POST   /api/admin/auth/login     관리자 로그인                       │ │
│  │  POST   /api/admin/auth/logout    관리자 로그아웃                     │ │
│  │  GET    /api/admin/auth/me        현재 세션 확인                      │ │
│  │                                                                        │ │
│  │  [CMS 콘텐츠] — admin+ 권한 필요                                      │ │
│  │  GET    /api/admin/content        전체 CMS 콘텐츠 조회                │ │
│  │  PATCH  /api/admin/content/[key]  CMS 콘텐츠 업데이트               │ │
│  │  POST   /api/admin/content/upload 이미지 업로드                       │ │
│  │                                                                        │ │
│  │  [도서 관리] — admin+ 권한 필요                                       │ │
│  │  GET    /api/admin/books          도서 목록 (필터/페이지네이션)       │ │
│  │  POST   /api/admin/books          도서 등록                           │ │
│  │  GET    /api/admin/books/[id]     도서 상세                           │ │
│  │  PATCH  /api/admin/books/[id]     도서 수정                           │ │
│  │  DELETE /api/admin/books/[id]     도서 삭제                           │ │
│  │                                                                        │ │
│  │  [사용자 관리] — admin+ 권한 필요                                     │ │
│  │  GET    /api/admin/users          이용자 목록                         │ │
│  │  POST   /api/admin/users          이용자 등록                         │ │
│  │  GET    /api/admin/users/[id]     이용자 상세                         │ │
│  │  PATCH  /api/admin/users/[id]     이용자 수정                         │ │
│  │  DELETE /api/admin/users/[id]     이용자 삭제 (비활성화)             │ │
│  │                                                                        │ │
│  │  [관리자 계정] — super_admin 전용                                     │ │
│  │  GET    /api/admin/accounts       관리자 계정 목록                    │ │
│  │  POST   /api/admin/accounts       관리자 계정 생성                    │ │
│  │  PATCH  /api/admin/accounts/[id]  관리자 계정 수정 (역할 변경 등)     │ │
│  │                                                                        │ │
│  │  [통계] — operator+ 권한 필요                                         │ │
│  │  GET    /api/admin/analytics      대시보드 통계 데이터                 │ │
│  │                                                                        │ │
│  │  [시스템 설정] — admin+ 권한 필요                                     │ │
│  │  GET    /api/admin/settings       시스템 설정 조회                    │ │
│  │  PATCH  /api/admin/settings       시스템 설정 변경                    │ │
│  │                                                                        │ │
│  │  [감사 로그] — admin+ 권한 필요                                       │ │
│  │  GET    /api/admin/audit          감사 로그 조회 (필터/페이지네이션)  │ │
│  │                                                                        │ │
│  │  [키오스크 제어] — super_admin 전용                                   │ │
│  │  POST   /api/admin/kiosk/restart 키오스크 재시작 명령                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Admin Route Handler 공통 패턴

```typescript
// 모든 Admin API Route의 공통 구조
export async function PATCH(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  // 1. 인증 확인 (JWT)
  const session = await verifyAuth(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. 권한 확인 (RBAC)
  if (!hasPermission(session.role, 'content:write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Rate Limit 확인
  if (!checkRateLimit(session.userId)) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  // 4. 입력 검증 (Zod)
  const body = await request.json();
  const validated = contentUpdateSchema.parse(body);

  // 5. 기존값 조회 (감사 로그용)
  const oldValue = await db.cmsContent.findUnique({ where: { key: params.key } });

  // 6. 비즈니스 로직 + DB 쓰기
  const result = await db.cmsContent.upsert({
    where: { key: params.key },
    update: { value: validated.value, updatedBy: session.userId },
    create: { key: params.key, type: validated.type, value: validated.value, updatedBy: session.userId },
  });

  // 7. 콘텐츠 캐시 갱신 + 버전 증분
  contentCache.update(params.key, validated.value);

  // 8. 감사 로그 기록
  await auditLog({
    action: 'UPDATE',
    entity: 'CmsContent',
    entityId: params.key,
    oldValue: oldValue?.value,
    newValue: validated.value,
    performedBy: session.userId,
  });

  // 9. 응답 반환
  return NextResponse.json(result, { headers: getSecurityHeaders() });
}
```

### 5.3 Public Content API (키오스크 폴링 대상)

```typescript
// GET /api/content — ETag 기반 변경 감지
export async function GET(request: NextRequest) {
  const currentVersion = contentCache.getVersion();
  const etag = `"v${currentVersion}"`;

  // If-None-Match 헤더 비교 → 304 Not Modified
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag },
    });
  }

  // 변경 시 전체 콘텐츠 반환
  const content = contentCache.getAll();
  return NextResponse.json(content, {
    headers: {
      ETag: etag,
      'Cache-Control': 'no-cache',
      ...getSecurityHeaders(),
    },
  });
}
```

---

## 6. 실시간 동기화 아키텍처

### 6.1 동기화 개요

관리자 대시보드에서 CMS 콘텐츠를 변경하면, 해당 변경이 **폴링 기반**으로 키오스크 프론트엔드에 전파된다. WebSocket 대신 폴링을 선택한 이유는 단일 키오스크 환경에서 구현 단순성과 안정성이 우선이기 때문이다 (→ ADR-006).

### 6.2 동기화 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Content Versioning & Sync                        │
│                                                                     │
│  ┌──────────────┐    PATCH /api/admin/content/:key                  │
│  │  Admin UI    │ ─────────────────────────────────────────┐       │
│  └──────────────┘                                          │       │
│                                                             ▼       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    content-cache.ts                           │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  인메모리 캐시 (Map<key, value>)                       │  │  │
│  │  │  "idle.title_text"  → "스마트 도서관"                  │  │  │
│  │  │  "idle.bg_color"    → "#1E3A5F"                       │  │  │
│  │  │  "menu.borrow_button_text" → "대출"                    │  │  │
│  │  │  ...                                                   │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  version: 42  ← 관리자 변경 시 ++                           │  │
│  │  lastUpdatedAt: 2026-03-05T14:32:05Z                        │  │
│  │                                                              │  │
│  │  getVersion()  → 42                                          │  │
│  │  getAll()      → { version: 42, content: Map<key, value> }   │  │
│  │  update(key, val) → 캐시 갱신 + version++                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                         │                                          │
│                         │  GET /api/content (ETag: "v42")         │
│                         ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    키오스크 프론트엔드                        │  │
│  │                                                              │  │
│  │  use-cms.ts (폴링 훅)                                       │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  useEffect(() => {                                     │  │  │
│  │  │    const interval = setInterval(async () => {           │  │  │
│  │  │      const res = await fetch('/api/content', {         │  │  │
│  │  │        headers: { 'If-None-Match': currentEtag }       │  │  │
│  │  │      });                                               │  │  │
│  │  │      if (res.status === 200) {                         │  │  │
│  │  │        const data = await res.json();                  │  │  │
│  │  │        useCmsStore.getState().setContent(data);        │  │  │
│  │  │        currentEtag = res.headers.get('ETag');          │  │  │
│  │  │      }                                                 │  │  │
│  │  │      // 304: 변경 없음, 아무 동작 안 함               │  │  │
│  │  │    }, 30000); // 30초 간격                             │  │  │
│  │  │    return () => clearInterval(interval);               │  │  │
│  │  │  }, []);                                               │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 버전 관리 메커니즘

```
시간축:
─────────────────────────────────────────────────────────────────►

T0: 키오스크 시작 → GET /api/content → version:1, ETag:"v1"
T1: 30초 후 폴링 → GET /api/content (If-None-Match:"v1") → 304 Not Modified
T2: 관리자 변경 → PATCH /api/admin/content/idle.title_text
    → DB UPSERT → content-cache.update() → version:2, ETag:"v2"
T3: 30초 후 폴링 → GET /api/content (If-None-Match:"v1") → 200 + 새 데이터 + ETag:"v2"
    → Zustand setContent() → 화면 Re-render
T4: 30초 후 폴링 → GET /api/content (If-None-Match:"v2") → 304 Not Modified
```

### 6.4 content-cache.ts 구조

```typescript
// src/lib/content-cache.ts
class ContentCache {
  private cache = new Map<string, string>();
  private version = 0;
  private lastUpdatedAt = new Date();

  /** 전체 캐시 조회 (키오스크 API용) */
  getAll(): { version: number; content: Record<string, string>; updatedAt: string } {
    return {
      version: this.version,
      content: Object.fromEntries(this.cache),
      updatedAt: this.lastUpdatedAt.toISOString(),
    };
  }

  /** 현재 버전 조회 (ETag 생성용) */
  getVersion(): number {
    return this.version;
  }

  /** 단일 항목 조회 */
  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  /** 캐시 갱신 (Admin API 호출 시) */
  update(key: string, value: string): void {
    this.cache.set(key, value);
    this.version++;
    this.lastUpdatedAt = new Date();
  }

  /** DB에서 전체 로드 (서버 시작 시) */
  async loadFromDB(): Promise<void> {
    const all = await db.cmsContent.findMany();
    this.cache.clear();
    for (const item of all) {
      this.cache.set(item.key, item.value);
    }
    this.version = all.length > 0 ? Math.max(...all.map(i => i.updatedAt.getTime())) : 0;
  }
}

export const contentCache = new ContentCache();
```

### 6.5 동기화 성능 지표

| 항목 | 값 | 비고 |
|------|-----|------|
| 폴링 간격 | 30초 | 키오스크 → /api/content |
| ETag 지원 | ✅ | 변경 없으면 304, 대역폭 절약 |
| 변경 감지 | ~2ms | 인메모리 캐시 버전 비교 |
| 전파 지연 | ≤30초 | 최악의 경우 (폴링 직후 변경 시) |
| 평균 전파 지연 | ~15초 | 균등 분포 가정 |
| 캐시 미스 시 복구 | 자동 | 서버 시작 시 DB에서 로드 |

---

## 7. RBAC 아키텍처

### 7.1 역할 계층

```
┌───────────────────────────────────────────────────┐
│                Role Hierarchy                      │
│                                                   │
│  ┌───────────────────────────────────────────┐    │
│  │  super_admin (슈퍼 관리자)                │    │
│  │  - 시스템 전체 권한                       │    │
│  │  - 관리자 계정 관리                       │    │
│  │  - DB 백업/복원                           │    │
│  │  - 키오스크 원격 제어                     │    │
│  │  ┌─────────────────────────────────────┐  │    │
│  │  │  admin (관리자)                      │  │    │
│  │  │  - CMS 콘텐츠 관리                  │  │    │
│  │  │  - 도서/사용자 CRUD                  │  │    │
│  │  │  - 통계 조회                         │  │    │
│  │  │  - 감사 로그 조회                    │  │    │
│  │  │  ┌───────────────────────────────┐  │  │    │
│  │  │  │  operator (운영자)             │  │  │    │
│  │  │  │  - 도서/사용자 읽기 전용       │  │  │    │
│  │  │  │  - 통계 조회                   │  │  │    │
│  │  │  └───────────────────────────────┘  │  │    │
│  │  └─────────────────────────────────────┘  │    │
│  └───────────────────────────────────────────┘    │
└───────────────────────────────────────────────────┘
```

### 7.2 권한 매핑 테이블

| 리소스:작업 | super_admin | admin | operator |
|-------------|:-----------:|:-----:|:--------:|
| content:read | ✅ | ✅ | ✅ |
| content:write | ✅ | ✅ | ❌ |
| content:upload | ✅ | ✅ | ❌ |
| books:read | ✅ | ✅ | ✅ |
| books:write | ✅ | ✅ | ❌ |
| books:delete | ✅ | ✅ | ❌ |
| users:read | ✅ | ✅ | ✅ |
| users:write | ✅ | ✅ | ❌ |
| accounts:read | ✅ | ❌ | ❌ |
| accounts:write | ✅ | ❌ | ❌ |
| analytics:read | ✅ | ✅ | ✅ |
| settings:read | ✅ | ✅ | ❌ |
| settings:write | ✅ | ✅ | ❌ |
| audit:read | ✅ | ✅ | ❌ |
| kiosk:control | ✅ | ❌ | ❌ |
| backup:execute | ✅ | ❌ | ❌ |

### 7.3 admin-auth.ts 구현 구조

```typescript
// src/lib/admin-auth.ts

// JWT 페이로드 타입
interface AdminJWTPayload {
  userId: string;
  email: string;
  role: 'super_admin' | 'admin' | 'operator';
  iat: number;
  exp: number;
}

// 권한 체크 함수
const PERMISSION_MAP: Record<string, string[]> = {
  'content:write':  ['super_admin', 'admin'],
  'content:upload': ['super_admin', 'admin'],
  'books:write':    ['super_admin', 'admin'],
  'books:delete':   ['super_admin', 'admin'],
  'users:write':    ['super_admin', 'admin'],
  'accounts:read':  ['super_admin'],
  'accounts:write': ['super_admin'],
  'audit:read':     ['super_admin', 'admin'],
  'kiosk:control':  ['super_admin'],
  'backup:execute': ['super_admin'],
  // 기본 읽기 권한은 모든 역할 허용
};

function hasPermission(role: string, permission: string): boolean {
  const allowed = PERMISSION_MAP[permission];
  if (!allowed) return true; // 정의되지 않은 권한은 모두 허용
  return allowed.includes(role);
}

// JWT 검증 (httpOnly 쿠키에서 토큰 추출)
async function verifyAuth(request: NextRequest): Promise<AdminJWTPayload | null> {
  const token = request.cookies.get('admin-token')?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AdminJWTPayload;
    return payload;
  } catch {
    return null; // 만료 또는 무효
  }
}

// JWT 발급
function issueToken(payload: Omit<AdminJWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

// Refresh Token 발급
function issueRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
}
```

### 7.4 인증 토큰 구성

| 항목 | Access Token | Refresh Token |
|------|-------------|---------------|
| 저장 위치 | httpOnly 쿠키 | httpOnly 쿠키 |
| 쿠키명 | `admin-token` | `admin-refresh-token` |
| 수명 | 15분 | 7일 |
| SameSite | Strict | Strict |
| HTTPS Only | ✅ (Secure) | ✅ (Secure) |
| Path | /api/admin | /api/admin/auth |
| 갱신 방식 | 만료 시 Refresh Token으로 재발급 | 재로그인 |

### 7.5 미들웨어 기반 인증 흐름

```typescript
// src/middleware.ts (Next.js 미들웨어)
export function middleware(request: NextRequest) {
  // /admin/* 경로 (정적 리소스 제외)에 인증 적용
  if (request.nextUrl.pathname.startsWith('/admin') &&
      !request.nextUrl.pathname.startsWith('/admin/login') &&
      !request.nextUrl.pathname.match(/\.(js|css|png|svg|ico)$/)) {

    const token = request.cookies.get('admin-token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // /api/admin/* 경로에 인증 적용 (API Route 레벨에서 별도 검증)
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
```

---

## 8. 감사 로그 아키텍처

### 8.1 감사 로그 기록 패턴

```typescript
// src/lib/audit-logger.ts
interface AuditLogEntry {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'UPLOAD';
  entity: string;
  entityId?: string;
  oldValue?: string;  // JSON 직렬화
  newValue?: string;  // JSON 직렬화
  performedBy: string;
}

async function auditLog(entry: AuditLogEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      performedBy: entry.performedBy,
      performedAt: new Date(),
    },
  });
}
```

### 8.2 감사 로그 보존 정책

| 항목 | 정책 |
|------|------|
| 보존 기간 | 무기한 (SQLite 파일 크기 관리로 대응) |
| 최대 레코드 | 100,000건 초과 시 가장 오래된 10% 자동 정리 |
| 조회 권한 | admin+ (operator 불가) |
| 내보내기 | super_admin 전용 CSV 내보내기 |
| 변경 불가 | UPDATE/DELETE 작업 금지 (Append-Only) |

### 8.3 감사 로그 ER 다이어그램

```
┌───────────────────────────────────────────────────┐
│  AuditLog                                         │
│  ┌─────────────┬──────────┬─────────────────────┐ │
│  │ id          │ String   │ @id @default(uuid()) │ │
│  │ action      │ String   │ CREATE|UPDATE|DELETE │ │
│  │             │          │ LOGIN|LOGOUT|UPLOAD  │ │
│  │ entity      │ String   │ CmsContent|Book|    │ │
│  │             │          │ LibraryUser|AdminUser│ │
│  │ entityId    │ String?  │ 변경 대상 ID         │ │
│  │ oldValue    │ String?  │ JSON (변경 전)       │ │
│  │ newValue    │ String?  │ JSON (변경 후)       │ │
│  │ performedBy │ String   │ AdminUser.id         │ │
│  │ performedAt │ DateTime │ @default(now())      │ │
│  └─────────────┴──────────┴─────────────────────┘ │
│                                                    │
│  ┌─────────┐                                       │
│  │ Indexes │ performedAt (DESC) — 조회 최적화     │
│  │         │ entity + entityId — 항목별 조회      │
│  │         │ performedBy — 작업자별 조회          │
│  └─────────┘                                       │
└───────────────────────────────────────────────────┘
```

---

## 9. 미들웨어 아키텍처

### 9.1 미들웨어 체인

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Request Processing Pipeline                      │
│                                                                     │
│  Client Request                                                     │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ① Next.js Middleware (src/middleware.ts)                    │   │
│  │     - /admin/* 경로: JWT 쿠키 존재 여부 확인               │   │
│  │     - 미인증: /admin/login 리다이렉트                       │   │
│  │     - /api/admin/*: 토큰 전달 (Route Handler에서 검증)     │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                     │
│                              ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ② Security Headers (getSecurityHeaders)                    │   │
│  │     - X-Content-Type-Options: nosniff                       │   │
│  │     - X-Frame-Options: DENY                                 │   │
│  │     - X-XSS-Protection: 1; mode=block                      │   │
│  │     - Referrer-Policy: strict-origin-when-cross-origin      │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                     │
│                              ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ③ Rate Limiting (checkRateLimit)                           │   │
│  │     - Admin API: 100회/분 (IP 기준)                        │   │
│  │     - Login API: 10회/분 (IP 기준)                         │   │
│  │     - 초과 시 429 Too Many Requests                        │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                     │
│                              ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ④ Auth Verification (verifyAuth) — Admin API만             │   │
│  │     - JWT 검증 + 만료 확인                                 │   │
│  │     - 페이로드에서 role 추출                               │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                     │
│                              ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⑤ RBAC Permission Check (hasPermission)                    │   │
│  │     - role vs 필요 권한 매핑                               │   │
│  │     - 부족 시 403 Forbidden                                │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                     │
│                              ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⑥ Input Validation (Zod Schema)                            │   │
│  │     - 요청 바디 파싱 + 스키마 검증                        │   │
│  │     - 실패 시 400 Bad Request                              │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                     │
│                              ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⑦ Business Logic + DB Query (Prisma)                       │   │
│  │     - 기존값 조회 (감사 로그용)                            │   │
│  │     - DB 트랜잭션 실행                                    │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                     │
│                              ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⑧ Audit Log Recording (auditLog) — 쓰기 작업만            │   │
│  │     - 변경 전후값 기록                                     │   │
│  │     - 캐시 갱신 (CMS 변경 시)                              │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                     │
│                              ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⑨ Response                                                │   │
│  │     - 200/201 + 데이터                                     │   │
│  │     - Security Headers 포함                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. 배포 아키텍처

### 10.1 단일 프로세스 배포

```
┌──────────────────────────────────────────────────────────┐
│                 단일 Next.js 16 프로세스                   │
│                                                          │
│  Next.js (port 3000)                                     │
│  ├── Static Assets     (/public)                         │
│  ├── Kiosk Page        (/)  ← 키오스크 전용              │
│  ├── Admin Pages       (/admin/*)  ← 관리자 대시보드     │
│  ├── Kiosk API         (/api/books, /api/loans, ...)     │
│  ├── Public CMS API    (/api/content)  ← 폴링 대상       │
│  └── Admin API         (/api/admin/*)  ← JWT 인증        │
│                                                          │
│  SQLite (custom.db)                                      │
│  ├── Kiosk Core 테이블 (SimUser, Book, SimLoan, ...)    │
│  ├── Admin 테이블 (AdminUser, CmsContent, CmsImage)     │
│  └── System 테이블 (AuditLog, SystemSetting, Notice)    │
│                                                          │
│  File System                                             │
│  └── /public/uploads/  ← 이미지 파일 저장소             │
└──────────────────────────────────────────────────────────┘
```

### 10.2 게이트웨이 (Caddy)

```
외부 요청 → Caddy (역방향 프록시) → Next.js :3000
  - /api/*?XTransformPort=N → 포트 N 포워딩
  - /              → 키오스크 프론트엔드
  - /admin/*       → 관리자 대시보드
  - /api/content   → CMS 콘텐츠 (키오스크 폴링)
  - /api/admin/*   → Admin API (JWT 인증 필요)
```

### 10.3 리소스 제약 및 대응

| 항목 | 제한 | 대응 |
|------|------|------|
| RAM | ~4GB | swap 2GB 추가, 인메모리 캐시 최대 10MB |
| /dev/shm | 64MB | Chrome 제한적 |
| 프로세스 | 단일 Next.js | 키오스크 + 관리자 통합 운영 |
| SQLite | 단일 writer | WAL 모드로 동시 읽기 허용 |
| 디스크 | 이미지 ≤ 500MB | 사용하지 않는 이미지 자동 정리 |
| DB 크기 | 감사 로그 ≤ 100,000건 | 초과 시 오래된 10% 자동 정리 |

---

## 11. ADR (Architecture Decision Records)

### ADR-001: 동일 Next.js 앱 통합 (별도 앱 분리 불가)

**상황**: 관리자 대시보드를 독립 Next.js 앱으로 분리할지, 기존 키오스크 앱에 통합할지 결정 필요

**결정**: 기존 Next.js 16 앱 내 `/admin/*` 경로로 통합

**이유**:
- 단일 프로세스로 메모리 절약 (임베디드 보드 제약)
- SQLite DB 공유가 자연스러움 (동일 Prisma 클라이언트)
- 배포 복잡도 최소화 (단일 `next build` + `next start`)
- Next.js App Router의 레이아웃 중첩로 관리자/키오스크 UI 자연스럽게 분리

**결과**: 메모리 효율적, DB 접근 간편, 반면 번들 크기 증가 (Admin 컴포넌트 추가 ~150KB gzip)

---

### ADR-002: 폴링 기반 실시간 동기화 (WebSocket 미채택)

**상황**: 관리자 CMS 변경을 키오스크에 실시간 전파할 방식 선택

**결정**: HTTP 폴링 (30초 간격) + ETag 변경 감지

**이유**:
- 단일 키오스크 환경에서 WebSocket의 오버엔지니어링
- HTTP 폴링은 추가 의존성 없이 구현 가능
- ETag 기반 304 응답으로 대역폭 최소화
- 서버 재시작 시 WebSocket 재연결 복구 로직 불필요
- 30초 지연은 도서관 환경에서 허용 가능 (즉각성 요구 낮음)

**결과**: 구현 단순, 안정성 높음, 반면 최대 30초 지연 발생

---

### ADR-003: JWT + httpOnly 쿠키 인증 (Session Storage 미채택)

**상황**: 관리자 인증 방식 선택

**결정**: JWT (Access Token 15분 + Refresh Token 7일)를 httpOnly 쿠키에 저장

**이유**:
- httpOnly 쿠키는 JavaScript에서 접근 불가 → XSS 공격 방어
- SameSite=Strict로 CSRF 공격 방어
- JWT는 무상태(stateless) → 서버 측 세션 저장소 불필요
- Refresh Token으로 Access Token 만료 시 자동 갱신
- SQLite 환경에서 세션 테이블 추가 오버헤드 불필요

**결과**: 보안 강화, 서버 무상태, 반면 토큰 갱신 로직 필요

---

### ADR-004: 인메모리 콘텐츠 캐시 (Redis 미채택)

**상황**: 키오스크 폴링 시 콘텐츠 조회 성능 최적화 방식 선택

**결정**: Node.js 인메모리 `Map` 기반 캐시 + 버전 카운터

**이유**:
- CMS 항목 수 ~50개, 총 용량 < 100KB → 인메모리 충분
- 외부 Redis 의존성 추가 불필요 (단일 보드 환경)
- 서버 시작 시 DB에서 1회 로드, 이후 업데이트만 반영
- 버전 카운터로 ETag 생성, 304 응답으로 폴링 최적화

**결과**: 응답 ~2ms (DB 쿼리 생략), 반면 서버 재시작 시 캐시 리로드 필요

---

### ADR-005: 3-tier 고정 역할 (동적 권한 미채택)

**상황**: RBAC 역할을 동적으로 정의할지, 고정 3-tier로 할지 결정

**결정**: `super_admin` / `admin` / `operator` 3개 역할 고정

**이유**:
- 소규모 도서관 관리팀 (3~5명)에 3-tier면 충분
- 동적 역할 시 역할 관리 UI + 권한 매핑 테이블 + 마이그레이션 복잡도 증가
- 코드 내 권한 체크가 컴파일 타임에 결정 가능 → 타입 안전성
- ADR-003 JWT 페이로드에 role 문자열 직접 포함 가능

**결과**: 구현 단순, 타입 안전, 반면 역할 확장 시 스키마 변경 필요

---

### ADR-006: 감사 로그 Append-Only (UPDATE/DELETE 금지)

**상황**: 감사 로그의 수정·삭제 허용 여부 결정

**결정**: AuditLog 테이블은 INSERT만 허용, UPDATE/DELETE 금지

**이유**:
- 감사 추적 무결성 보장 (규제 대응, 장애 원인 분석)
- 변조 방지 → 관리자가 실수를 숨길 수 없음
- SQLite에서 읽기 전용 테이블 보호는 앱 레이어에서만 가능 (Prisma 접근 제한)

**결과**: 감사 무결성 보장, 반면 잘못 기록된 로그 수정 불가

---

### ADR-007: Zod 스키마 기반 입력 검증 (수동 검증 미채택)

**상황**: Admin API 입력 검증 방식 선택

**결정**: Zod 라이브러리로 모든 Admin API 입력 검증

**이유**:
- 런타임 검증 + TypeScript 타입 추출 동시 지원
- CMS 타입별 검증 규칙 선언적 정의 (text: 길이 제한, color: HEX 형식, image: MIME)
- 에러 메시지 자동 생성 (한국어 커스텀 가능)
- Prisma와 함께 사용 시 end-to-end 타입 안전

**결과**: 타입 안전 + 런타임 검증, 반면 Zod 의존성 추가 (~13KB gzip)

---

### ADR-008: 이미지 로컬 파일 시스템 저장 (외부 스토리지 미채택)

**상황**: CMS 이미지 업로드 저장소 선택

**결정**: `/public/uploads/` 디렉토리에 로컬 파일로 저장

**이유**:
- 외부 CDN/S3 의존 불필요 (단일 보드 환경)
- Next.js 정적 서빙으로 즉시 접근 가능
- 이미지 URL이 상대 경로 (`/uploads/...`)로 단순
- Sharp 기반 자동 리사이징 + WebP 변환 가능

**결과**: 외부 의존 없음, 반면 서버 이전 시 uploads 디렉토리 함께 마이그레이션 필요

---

> **변경 이력**

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| v1.0.0 | 2026-03-05 | 최초 작성 | Backend Architecture Team |
