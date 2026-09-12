# 스마트 도서관 무인 키오스크 — UI 설계서 (화면 설계서)

> **버전**: v1.0  
> **작성일**: 2026-03-04  
> **대상 시스템**: 스마트 도서관 무인 도서대출반납기 시뮬레이터  
> **기반 기술**: Next.js 16 + React 19 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui  
> **화면 방향**: 세로 (Portrait, 768×1024 기준)  
> **터치 인터페이스**: 모든 조작은 터치 기반 (최소 44px 터치 타겟)

---

## 목차

1. [총칭 (General)](#1-총칭-general)
2. [전체 화면 전이도 (State Transition Diagram)](#2-전체-화면-전이도-state-transition-diagram)
3. [키오스크 화면 그룹](#3-키오스크-화면-그룹)
   - 3.1 [KS-001 대기 화면 (Idle)](#31-ks-001-대기-화면-idle)
   - 3.2 [KS-002 메인 메뉴 (Main Menu)](#32-ks-002-메인-메뉴-main-menu)
   - 3.3 [KS-003 도서증 발급 종류 선택 (Card Apply)](#33-ks-003-도서증-발급-종류-선택-card-apply)
   - 3.4 [KS-004 도서증 발급 개인정보 입력 (Card Form)](#34-ks-004-도서증-발급-개인정보-입력-card-form)
   - 3.5 [KS-005 도서증 발급 승인 대기 (Card Pending)](#35-ks-005-도서증-발급-승인-대기-card-pending)
   - 3.6 [KS-006 도서증 발급 완료 (Card Complete)](#36-ks-006-도서증-발급-완료-card-complete)
   - 3.7 [KS-007 회원증 RFID 스캔 (Auth Scan)](#37-ks-007-회원증-rfid-스캔-auth-scan)
   - 3.8 [KS-008 비밀번호 입력 (Auth PIN)](#38-ks-008-비밀번호-입력-auth-pin)
   - 3.9 [KS-009 도서 선택 (Loan Select)](#39-ks-009-도서-선택-loan-select)
   - 3.10 [KS-010 대출 확인 (Loan Confirm)](#310-ks-010-대출-확인-loan-confirm)
   - 3.11 [KS-011 대출 완료 (Loan Complete)](#311-ks-011-대출-완료-loan-complete)
   - 3.12 [KS-012 반납 도서 투입 (Return Insert)](#312-ks-012-반납-도서-투입-return-insert)
   - 3.13 [KS-013 반납 스캔 (Return Scanning)](#313-ks-013-반납-스캔-return-scanning)
   - 3.14 [KS-014 반납 확인 (Return Confirm)](#314-ks-014-반납-확인-return-confirm)
   - 3.15 [KS-015 반납 완료 (Return Complete)](#315-ks-015-반납-완료-return-complete)
4. [관리자 화면 그룹](#4-관리자-화면-그룹)
   - 4.1 [AD-001 관리자 로그인 (Admin Login)](#41-ad-001-관리자-로그인-admin-login)
   - 4.2 [AD-002 관리자 대시보드 개요 (Overview)](#42-ad-002-관리자-대시보드-개요-overview)
   - 4.3 [AD-003 콘텐츠 관리 (Content)](#43-ad-003-콘텐츠-관리-content)
   - 4.4 [AD-004 도서 관리 (Books)](#44-ad-004-도서-관리-books)
   - 4.5 [AD-005 이용자 관리 (Users)](#45-ad-005-이용자-관리-users)
   - 4.6 [AD-006 분석 대시보드 (Analytics)](#46-ad-006-분석-대시보드-analytics)
   - 4.7 [AD-007 시스템 설정 (Settings)](#47-ad-007-시스템-설정-settings)
   - 4.8 [AD-008 감사 로그 (Audit)](#48-ad-008-감사-로그-audit)
5. [공통 요소 및 인터랙션 패턴](#5-공통-요소-및-인터랙션-패턴)
6. [애니메이션 명세](#6-애니메이션-명세)
7. [접근성 명세](#7-접근성-명세)
8. [에러 처리 명세](#8-에러-처리-명세)
9. [타임아웃 및 자동 복귀 명세](#9-타임아웃-및-자동-복귀-명세)

---

## 1. 총칭 (General)

### 1.1 설계 원칙

| 원칙 | 설명 | 근거 |
|---|---|---|
| **ECO 실제 제품 재현** | 이씨오(ECO) 실제 무인 도서대출반납기 화면 레이아웃, 색상, 버튼 배치 충실히 재현 | 제품 요구사항 |
| **시니어 친화적 UI** | 큰 글씨, 큰 버튼, 명확한 시각 피드백, 음성 안내 | 65세+ 이용자 가독성 |
| **터치 우선 인터랙션** | 모든 조작은 터치 기반, 최소 44px 터치 타겟 보장 | WCAG 2.1 AA |
| **세로 방향 화면** | 키오스크 하드웨어 세로 방향 (768×1024 기준) | 하드웨어 제약 |
| **단순한 플로우** | 최소 단계 수, 되돌아가기 명확, 진행 상태 가시 | 사용성 |
| **CMS 콘텐츠 관리** | 모든 화면 텍스트는 CMS 키로 관리, 실시간 갱신 | 운영 효율성 |

### 1.2 색상 팔레트

| 용도 | 색상 | HEX | Tailwind 클래스 |
|---|---|---|---|
| 대기 화면 배경 | 다크 네이비 | `#0b1120` | — (inline style) |
| 화면 배경 (라이트) | 밝은 회 | `#F8FAFC` | `bg-slate-50` |
| 메인 메뉴 배경 | 다크 네이비 | `#0b1120` | — (inline style) |
| 도서카드 발급 버튼 | 갈색 그래디언트 | `#4a3620 → #3a2a15` | — (inline style) |
| 도서 대출 버튼 | 네이비 그래디언트 | `#1e3a5f → #0f2744` | — (inline style) |
| 도서 반납 버튼 | �얼 그래디언트 | `#134e4a → #0a3d3a` | — (inline style) |
| 강조 텍스트 | 흰 | `#FFFFFF` | `text-white` |
| 일반 텍스트 | 진회 | `#334155` | `text-slate-700` |
| 보조 텍스트 | 회 | `#94A3B8` | `text-slate-400` |
| 오류/경고 | 빨강 | `#EF4444` | `bg-red-500` |
| 성공 | 초록 | `#22C55E` | `bg-emerald-500` |
| 스캔 펄스 | 청록 | `#22D3EE` | `bg-cyan-400` |
| RFID 스캔 | 하늘 | `#38BDF8` | `text-sky-400` |

### 1.3 타이포그래피

| 역할 | 크기 | 굵기 | Tailwind 클래스 |
|---|---|---|---|
| 대기 화면 타이틀 | 36px | 700 | `text-4xl font-bold` |
| 메인 메뉴 버튼 텍스트 | 24px | 700 | `text-2xl font-bold` |
| 화면 타이틀 | 24px | 600 | `text-2xl font-semibold` |
| 카드 타이틀 | 20px | 700 | `text-xl font-bold` |
| 본문 | 16px | 400 | `text-base` |
| 캡션/보조 | 14px | 400 | `text-sm` |
| PIN 도트 | 20px | — | `w-5 h-5 rounded-full` |

### 1.4 버튼 규격

| 유형 | 최소 높이 | 최소 폭 | 라운딩 | 배치 |
|---|---|---|---|---|
| 메인 메뉴 버튼 | 140px | 전체 폭 | 16px (rounded-2xl) | 수직 스택 |
| 폼 제출 버튼 | 64px | 전체 폭 | 16px (rounded-2xl) | 하단 고정 |
| 이전/취소 버튼 | 56px | 전체 폭 | 16px (rounded-2xl) | 하단 고정 |
| 숫자 키패드 키 | 64px (h-16) | 그리드 셀 | 12px (rounded-xl) | 3열 그리드 |
| 도서 카드 선택 버튼 | — | 전체 폭 | 8px (rounded-lg) | 카드 내부 |
| 관리자 진입 버튼 | 40px | 40px | 8px (rounded-lg) | 우측 하단 절대 배치 |

### 1.5 레이아웃 구조

```
┌───────────────────────────┐
│       <header>            │  ← 상단 헤더 (타이틀, 뒤로가기)
├───────────────────────────┤
│                           │
│       <main>              │  ← 메인 콘텐츠 (flex-1, 스크롤 가능)
│                           │
│                           │
├───────────────────────────┤
│       <footer>            │  ← 하단 버튼 영역 (고정)
└───────────────────────────┘

전체: flex flex-col h-screen
```

---

## 2. 전체 화면 전이도 (State Transition Diagram)

### 2.1 키오스크 화면 전이도

```
                    ┌──────────┐
                    │   idle   │ ← 대기 화면 (초기 상태)
                    └────┬─────┘
                         │ 화면 터치
                         ▼
                    ┌──────────┐
                    │main-menu │ ← 메인 메뉴
                    └──┬──┬──┬─┘
                       │  │  │
         ┌─────────────┘  │  └─────────────┐
         │ 도서카드 발급   │ 도서 대출      │ 도서 반납
         ▼                ▼                ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │card-apply│    │auth-scan │    │auth-scan │
   └────┬─────┘    └────┬─────┘    └────┬─────┘
        │               │               │
        ▼               ▼               ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │card-form │    │auth-pin  │    │auth-pin  │
   └────┬─────┘    └────┬─────┘    └────┬─────┘
        │               │               │
   ┌────┴────┐         │               │
   │         │         │               │
   ▼         ▼         ▼               ▼
[모바일]  [실물]  ┌──────────┐    ┌──────────────┐
   │         │    │loan-select│    │return-insert │
   │         │    └────┬─────┘    └──────┬───────┘
   │         │         │                 │
   │         ▼         ▼                 ▼
   │   ┌──────────┐ ┌──────────┐  ┌──────────────┐
   │   │card-     │ │loan-     │  │return-       │
   │   │pending   │ │confirm   │  │scanning      │
   │   └────┬─────┘ └────┬─────┘  └──────┬───────┘
   │        │            │                │
   │        ▼            ▼                ▼
   │   ┌──────────┐ ┌──────────┐  ┌──────────────┐
   │   │card-     │ │loan-     │  │return-       │
   │   │complete  │ │complete  │  │confirm       │
   │   └────┬─────┘ └────┬─────┘  └──────┬───────┘
   │        │            │                │
   ▼        ▼            ▼                ▼
   ┌──────────┐    ┌──────────┐    ┌──────────────┐
   │card-     │    │  idle    │    │return-       │
   │complete  │    │ (자동    │    │complete      │
   └────┬─────┘    │  복귀)   │    └──────┬───────┘
        │          └──────────┘           │
        │                                 │
        ├─→ [도서 대출하러 가기] → auth-scan (kioskMode=loan)
        │
        └─→ [확인] → idle

   return-complete → [확인하기] → idle (자동 복귀)
```

### 2.2 이전 화면 매핑 (PREV_SCREEN_MAP)

| 현재 화면 | 이전 화면 | 비고 |
|---|---|---|
| `main-menu` | `idle` | 대기 화면으로 복귀 |
| `card-apply` | `main-menu` | 메인 메뉴로 복귀 |
| `card-form` | `card-apply` | 발급 종류 선택으로 복귀 |
| `card-pending` | `card-form` | (취소 버튼 → main-menu) |
| `card-complete` | `idle` | (확인 버튼 → idle) |
| `auth-scan` | `main-menu` | 메인 메뉴로 복귀 |
| `auth-pin` | `auth-scan` | 스캔 화면으로 복귀 |
| `loan-select` | `auth-pin` | PIN 입력으로 복귀 |
| `loan-confirm` | `loan-select` | 도서 선택으로 복귀 |
| `loan-complete` | `idle` | (자동 복귀) |
| `return-insert` | `main-menu` | 메인 메뉴로 복귀 |
| `return-scanning` | `return-insert` | (더 넣기 → return-insert) |
| `return-confirm` | `return-scanning` | 스캔 화면으로 복귀 |
| `return-complete` | `idle` | (자동 복귀) |

### 2.3 관리자 화면 전이도

```
┌──────────┐
│AdminLogin│ ← 관리자 로그인 (idle 화면 우측 하단 Settings 버튼 → adminMode=true)
└────┬─────┘
     │ 로그인 성공
     ▼
┌──────────────────────────────────────────┐
│            AdminDashboard                │
│  ┌──────────┬───────────────────────┐   │
│  │ 사이드바  │     메인 콘텐츠      │   │
│  │          │                       │   │
│  │ 개요     │  ← overview          │   │
│  │ 콘텐츠   │  ← content           │   │
│  │ 도서     │  ← books             │   │
│  │ 이용자   │  ← users             │   │
│  │ 분석     │  ← analytics         │   │
│  │ 설정     │  ← settings          │   │
│  │ 감사     │  ← audit             │   │
│  │          │                       │   │
│  └──────────┴───────────────────────┘   │
│  [로그아웃] → idle (adminMode=false)    │
└──────────────────────────────────────────┘
```

---

## 3. 키오스크 화면 그룹

---

### 3.1 KS-001 대기 화면 (Idle)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-001` |
| 화면명 | 대기 화면 (Idle Screen) |
| 화면 키 | `idle` |
| 컴포넌트 | `KioskIdleScreen.tsx` |
| 진입 경로 | 앱 초기 상태 / 완료 화면에서 자동 복귀 / 관리자 모드 종료 |
| 배경색 | `#0b1120` (CMS `idle.background_color`로 교체 가능) |

#### 화면 레이아웃

```
┌───────────────────────────────┐
│                               │
│         ┌───────────┐         │
│         │  📚       │         │ ← Library 아이콘 (w-16 h-16, text-sky-400)
│         │  SMART    │         │ ← CMS: idle.title
│         │  LIBRARY  │         │   text-4xl font-bold tracking-[0.2em] text-white
│         │           │         │
│         │ 무인 도서  │         │ ← CMS: idle.subtitle
│         │ 대출반납기 │         │   text-slate-500 text-sm tracking-[0.3em]
│         └───────────┘         │
│                               │
│    ◉ 화면을 터치하여          │ ← CMS: idle.pulse_text
│      시작하세요               │   펄스 애니메이션 (opacity 0.4→1→0.4, 2.5s)
│                               │
│         ○                     │ ← 하단 펄스 링 (scale 1→2.5, opacity 0.25→0)
│                               │   3s 반복
│                     ⚙         │ ← 관리자 진입 버튼 (우측 하단)
└───────────────────────────────┘
```

#### UI 요소 상세

| 요소 ID | 유형 | 크기 | 색상 | 텍스트 | 비고 |
|---|---|---|---|---|---|
| `idle-icon` | 아이콘 (Library) | w-16 h-16 | text-sky-400 | — | drop-shadow glow |
| `idle-title` | 텍스트 (h1) | text-4xl | text-white | "SMART LIBRARY" | CMS 키: `idle.title` |
| `idle-subtitle` | 텍스트 (p) | text-sm | text-slate-500 | "무인 도서대출반납기" | CMS 키: `idle.subtitle` |
| `idle-pulse` | 텍스트 (p) | text-base | text-sky-300/80 | "화면을 터치하여 시작하세요" | CMS 키: `idle.pulse_text`, 펄스 애니메이션 |
| `idle-ring` | 원형 도형 | 120×120px | border-sky-400/30 | — | 펄스 링 애니메이션 |
| `idle-admin-btn` | 버튼 (Settings) | w-10 h-10 | text-slate-400 | — | opacity-50, hover 시 opacity-100 |

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-IDLE-001` | 화면 전체 `onClick` / `onTouchStart` | — | `setScreen('main-menu')` | `main-menu` | 화면 어디를 터치해도 메인 메뉴로 이동 |
| `A-IDLE-002` | 관리자 버튼 `onClick` / `onTouchStart` | `e.stopPropagation()` | `setAdminMode(true)` | 관리자 로그인 | 터치 이벤트 전파 중지 (화면 터치와 분리) |

#### 배경 효과

- **글로우 효과**: `radial-gradient(ellipse 400px 400px at 50% 45%, rgba(56,189,248,0.06) 0%, transparent 70%)`
- **배경색**: CMS `idle.background_color` 값 (hex 검증 후 적용, 기본값 `#0b1120`)

---

### 3.2 KS-002 메인 메뉴 (Main Menu)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-002` |
| 화면명 | 메인 메뉴 (Main Menu) |
| 화면 키 | `main-menu` |
| 컴포넌트 | `KioskMainMenu.tsx` |
| 진입 경로 | 대기 화면 터치 |
| 배경색 | `#0b1120` (다크 네이비) |

#### 화면 레이아웃

```
┌───────────────────────────────┐
│       📚 SMART LIBRARY        │ ← 상단 브랜딩 (Library 아이콘 + 타이틀)
│      무인 도서대출반납기       │
│                               │
│  ┌─────────────────────────┐  │
│  │   💳  도서카드 발급      │  │ ← 갈색 그래디언트 버튼 (140px 높이)
│  │                          │  │   CMS: mainmenu.card_button_text
│  └─────────────────────────┘  │
│                               │
│  ┌─────────────────────────┐  │
│  │   📖  도서 대출          │  │ ← 네이비 그래디언트 버튼 (140px 높이)
│  │                          │  │   CMS: mainmenu.loan_button_text
│  └─────────────────────────┘  │
│                               │
│  ┌─────────────────────────┐  │
│  │   📥  도서 반납          │  │ ← �얼 그래디언트 버튼 (140px 높이)
│  │                          │  │   CMS: mainmenu.return_button_text
│  └─────────────────────────┘  │
│                               │
│       🕐 2026.03.04 14:30:25  │ ← 하단 현재 시간 (1초 간격 갱신)
└───────────────────────────────┘
```

#### UI 요소 상세

| 요소 ID | 유형 | 크기 | 색상/그래디언트 | 아이콘 | 텍스트 | CMS 키 |
|---|---|---|---|---|---|---|
| `mm-title` | 텍스트 (h1) | text-2xl | text-white | Library (w-7 h-7, text-sky-400) | "SMART LIBRARY" | `mainmenu.title` |
| `mm-subtitle` | 텍스트 (p) | text-xs | text-slate-500 | — | "무인 도서대출반납기" | — |
| `mm-card-btn` | 버튼 (motion) | min-h-140px, 전체 폭 | #4a3620→#3a2a15 | CreditCard (w-12 h-12, text-amber-400) | "도서카드 발급" | `mainmenu.card_button_text` |
| `mm-loan-btn` | 버튼 (motion) | min-h-140px, 전체 폭 | #1e3a5f→#0f2744 | BookOpen (w-12 h-12, text-sky-400) | "도서 대출" | `mainmenu.loan_button_text` |
| `mm-return-btn` | 버튼 (motion) | min-h-140px, 전체 폭 | #134e4a→#0a3d3a | ArrowDownToLine (w-12 h-12, text-teal-400) | "도서 반납" | `mainmenu.return_button_text` |
| `mm-clock` | 텍스트 (span) | text-sm | text-slate-600 | Clock (w-4 h-4) | "YYYY.MM.DD HH:MM:SS" | — |

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-MM-001` | 도서카드 발급 버튼 `onClick` | — | `setKioskMode('card')`, `setScreen('card-apply')` | `card-apply` | 카드 모드 설정 후 발급 종류 선택으로 |
| `A-MM-002` | 도서 대출 버튼 `onClick` | — | `setKioskMode('loan')`, `setScreen('auth-scan')` | `auth-scan` | 대출 모드 설정 후 회원증 스캔으로 |
| `A-MM-003` | 도서 반납 버튼 `onClick` | — | `setKioskMode('return')`, `setScreen('auth-scan')` | `auth-scan` | 반납 모드 설정 후 회원증 스캔으로 |

#### 버튼 진입 애니메이션

- **도서카드 발급**: delay 0.05s, opacity 0→1, y 20→0, duration 0.4s
- **도서 대출**: delay 0.15s, opacity 0→1, y 20→0, duration 0.4s
- **도서 반납**: delay 0.3s, opacity 0→1, y 20→0, duration 0.4s
- **whileTap**: scale 0.97 (누름 피드백)

---

### 3.3 KS-003 도서증 발급 종류 선택 (Card Apply)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-003` |
| 화면명 | 도서증 발급 종류 선택 |
| 화면 키 | `card-apply` |
| 컴포넌트 | `KioskCardApply.tsx` |
| 진입 경로 | 메인 메뉴 → 도서카드 발급 버튼 |
| 배경색 | `#0b1120` |

#### 화면 레이아웃

```
┌───────────────────────────────┐
│  ← 이전                       │ ← 뒤로가기 버튼
│                               │
│       도서증 발급              │ ← CMS: cardapply.title
│    발급 종류를 선택해주세요    │ ← CMS: cardapply.subtitle
│                               │
│  ┌─────────────────────────┐  │
│  │ 📱 모바일 도서증 발급    │  │ ← 네이비 그래디언트 (130px)
│  │    즉시 발급, 자동 승인  │  │
│  └─────────────────────────┘  │
│                               │
│  ┌─────────────────────────┐  │
│  │ 💳 실물 도서증 발급      │  │ ← 갈색 그래디언트 (130px)
│  │    담당자 승인 후 발급   │  │
│  └─────────────────────────┘  │
│                               │
│  ┌─────────────────────────┐  │
│  │ ⚡ 자동 발급 신청        │  │ ← 에메랄드 그래디언트 (130px)
│  │    개인정보 입력 후 자동  │  │
│  └─────────────────────────┘  │
│                               │
└───────────────────────────────┘
```

#### UI 요소 상세

| 요소 ID | 유형 | 크기 | 색상 | 아이콘 | 텍스트 | CMS 키 |
|---|---|---|---|---|---|---|
| `ca-back` | 버튼 | min-h-48px | text-slate-400 | ArrowLeft (w-6 h-6) | "이전" | — |
| `ca-title` | 텍스트 (h1) | text-2xl | text-white | — | "도서증 발급" | `cardapply.title` |
| `ca-subtitle` | 텍스트 (p) | text-sm | text-slate-500 | — | "발급 종류를 선택해주세요" | `cardapply.subtitle` |
| `ca-mobile-btn` | 버튼 | min-h-130px | #1e3a5f→#0f2744 | Smartphone (w-11 h-11, text-sky-400) | "모바일 도서증 발급" / "즉시 발급, 자동 승인" | `cardapply.mobile_title` / `cardapply.mobile_desc` |
| `ca-physical-btn` | 버튼 | min-h-130px | #4a3620→#3a2a15 | CreditCard (w-11 h-11, text-amber-400) | "실물 도서증 발급" / "담당자 승인 후 발급" | `cardapply.physical_title` / `cardapply.physical_desc` |
| `ca-auto-btn` | 버튼 | min-h-130px | #1a3a2a→#0f2a1e | Zap (w-11 h-11, text-emerald-400) | "자동 발급 신청" / "개인정보 입력 후 자동 승인" | `cardapply.auto_title` / `cardapply.auto_desc` |

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-CA-001` | 이전 버튼 `onClick` | — | `setScreen('main-menu')` | `main-menu` | 메인 메뉴로 복귀 |
| `A-CA-002` | 모바일 도서증 버튼 `onClick` | — | `setKioskMode('card')`, `setCardApplication({cardType:'mobile', ...})`, `setScreen('card-form')` | `card-form` | cardType=mobile 설정 |
| `A-CA-003` | 실물 도서증 버튼 `onClick` | — | `setKioskMode('card')`, `setCardApplication({cardType:'physical', ...})`, `setScreen('card-form')` | `card-form` | cardType=physical 설정 |
| `A-CA-004` | 자동 발급 신청 버튼 `onClick` | — | `setKioskMode('card')`, `setCardApplication({cardType:'mobile', ...})`, `setScreen('card-form')` | `card-form` | 자동 발급은 모바일 도서증과 동일 처리 |

---

### 3.4 KS-004 도서증 발급 개인정보 입력 (Card Form)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-004` |
| 화면명 | 도서증 발급 개인정보 입력 |
| 화면 키 | `card-form` |
| 컴포넌트 | `KioskCardForm.tsx` |
| 진입 경로 | 발급 종류 선택 → 모바일/실물/자동 버튼 |
| 배경색 | `#0b1120` |

#### 화면 레이아웃

```
┌───────────────────────────────┐
│  ← 이전                       │ ← 뒤로가기
│                               │
│       개인정보 입력            │ ← CMS: cardform.title
│                               │
│      💳 모바일 도서증          │ ← 카드 종류 표시 (모바일=sky, 실물=amber)
│                               │
│  👤 이름 *                    │ ← 필수 입력
│  ┌─────────────────────────┐  │
│  │ 홍길동                   │  │ ← placeholder
│  └─────────────────────────┘  │
│  [에러 메시지]                │
│                               │
│  📅 생년월일 *                │ ← 필수, 8자리 숫자
│  ┌─────────────────────────┐  │
│  │ 19900101                 │  │ ← inputMode=numeric, maxLength=8
│  └─────────────────────────┘  │
│  [에러 메시지]                │
│                               │
│  📞 전화번호 *                │ ← 필수, 10~11자리 숫자
│  ┌─────────────────────────┐  │
│  │ 01012345678              │  │ ← inputMode=tel, maxLength=11
│  └─────────────────────────┘  │
│  [에러 메시지]                │
│                               │
│  📍 주소 (선택)               │ ← 선택 입력
│  ┌─────────────────────────┐  │
│  │ 서울시 강남구 대치동      │  │
│  └─────────────────────────┘  │
│                               │
│  ┌─────────────────────────┐  │
│  │   📤 신청하기             │  │ ← 제출 버튼
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

#### 폼 필드 상세

| 필드 | 라벨 | 타입 | 필수 | 유효성 검증 | 에러 메시지 | CMS 키 |
|---|---|---|---|---|---|---|
| 이름 | "이름" | text | ✅ | trim() 길이 ≥ 2 | "이름을 입력해주세요" / "이름은 2자 이상이어야 합니다" | `cardform.name_label` |
| 생년월일 | "생년월일" | text (inputMode=numeric) | ✅ | 8자리 숫자 (`^\d{8}$`) | "생년월일을 입력해주세요" / "생년월일 8자리 숫자로 입력해주세요" | `cardform.birthdate_label` |
| 전화번호 | "전화번호" | text (inputMode=tel) | ✅ | 10~11자리 숫자 (`^\d{10,11}$`) | "전화번호를 입력해주세요" / "올바른 전화번호를 입력해주세요" | `cardform.phone_label` |
| 주소 | "주소" | text | ❌ | 없음 | — | `cardform.address_label` |

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-CF-001` | 이전 버튼 `onClick` | — | `setScreen('card-apply')` | `card-apply` | 발급 종류 선택으로 복귀 |
| `A-CF-002` | 신청하기 버튼 `onClick` | 유효성 검증 실패 | 에러 메시지 표시 | 현재 화면 유지 | 빨간 텍스트로 필드별 에러 표시 |
| `A-CF-003` | 신청하기 버튼 `onClick` | 유효성 검증 성공, cardType=mobile | API POST `/api/card-application`, `setScreen('card-complete')` | `card-complete` | 모바일: 즉시 완료 화면 |
| `A-CF-004` | 신청하기 버튼 `onClick` | 유효성 검증 성공, cardType=physical | API POST `/api/card-application`, `setScreen('card-pending')` | `card-pending` | 실물: 승인 대기 화면 |

#### 제출 버튼 상태

| 상태 | 텍스트 | 비고 |
|---|---|---|
| 기본 | "신청하기" | CMS 키: `cardform.submit_button_text` |
| 제출 중 | "처리 중..." | 버튼 disabled |

---

### 3.5 KS-005 도서증 발급 승인 대기 (Card Pending)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-005` |
| 화면명 | 도서증 발급 승인 대기 (실물 도서증 전용) |
| 화면 키 | `card-pending` |
| 컴포넌트 | `KioskCardPending.tsx` |
| 진입 경로 | 개인정보 입력 → 실물 도서증 제출 |
| 배경색 | `#0b1120` |

#### 화면 레이아웃

```
┌───────────────────────────────┐
│                               │
│         ⏳                    │ ← Clock 아이콘 (갈색 원형 배경)
│                               │
│   발급 신청이 완료되었습니다   │ ← CMS: cardpending.title
│   담당자 승인을 기다려주세요  │ ← CMS: cardpending.wait_message
│                               │
│       ● ● ●                  │ ← 펄스 도트 (3개, 순차 애니메이션)
│                               │
│  ┌─────────────────────────┐  │
│  │    신청 내역             │  │ ← CMS: cardpending.summary_title
│  │  👤 이름: 홍길동         │  │
│  │  📅 생년월일: 1990.01.01 │  │
│  │  📞 전화번호: 010-1234-  │  │
│  │           5678            │  │
│  │  💳 종류: 실물 도서증     │  │
│  └─────────────────────────┘  │
│                               │
│  ┌─────────────────────────┐  │
│  │      취소                │  │ ← 취소 버튼
│  └─────────────────────────┘  │
│                               │
└───────────────────────────────┘
```

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-CP-001` | 취소 버튼 `onClick` | — | `clearTimeout(timer)`, `setCardApplication(null)`, `setScreen('main-menu')` | `main-menu` | 타이머 해제, 신청 데이터 초기화, 메인 메뉴로 |
| `A-CP-002` | 5초 타이머 만료 (자동) | — | `setScreen('card-complete')` | `card-complete` | 시뮬레이션: 5초 후 자동 승인 |

#### 펄스 도트 애니메이션

- 3개 원형 도트 (w-3 h-3, bg-amber-400)
- scale [1, 1.4, 1], opacity [0.4, 1, 0.4]
- duration 1.2s, repeat Infinity, delay i×0.25s

---

### 3.6 KS-006 도서증 발급 완료 (Card Complete)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-006` |
| 화면명 | 도서증 발급 완료 |
| 화면 키 | `card-complete` |
| 컴포넌트 | `KioskCardComplete.tsx` |
| 진입 경로 | 모바일 도서증 즉시 완료 / 실물 도서증 승인 후 완료 |
| 배경색 | `#0b1120` |

#### 화면 레이아웃 (모바일 도서증)

```
┌───────────────────────────────┐
│                               │
│         ✅                    │ ← 성공 체크마크 (emerald-500 원형)
│  도서증 발급이 완료되었습니다! │ ← CMS: cardcomplete.title
│  모바일 도서증이 발급되었습니다 │ ← CMS: cardcomplete.mobile_message
│                               │
│  ┌─────────────────────────┐  │
│  │  💳 카드 번호            │  │
│  │     LIB-20260304-7283   │  │ ← LIB-YYYYMMDD-XXXX 형식
│  │  ✅ 이름: 홍길동         │  │
│  │  💳 종류: 모바일 도서증   │  │
│  │  📅 발급일: 2026.03.04   │  │
│  │                          │  │
│  │    ┌──────────┐          │  │
│  │    │  QR 코드  │          │  │ ← QR 플레이스홀더 (w-28 h-28)
│  │    └──────────┘          │  │
│  └─────────────────────────┘  │
│                               │
│  ┌─────────────────────────┐  │
│  │   📖 도서 대출하러 가기   │  │ ← 대출 이동 버튼
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │
│  │        확인              │  │ ← 대기 화면 복귀 버튼
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

#### 화면 레이아웃 (실물 도서증)

```
│  도서증 발급이 완료되었습니다! │
│  실물 도서증은 3영업일 내 발급 │ ← CMS: cardcomplete.physical_message
│                               │
│  ┌─────────────────────────┐  │
│  │  💳 카드 번호            │  │
│  │     LIB-20260304-7283   │  │
│  │  ✅ 이름: 홍길동         │  │
│  │  💳 종류: 실물 도서증     │  │
│  │  📅 발급일: 2026.03.04   │  │
│  └─────────────────────────┘  │
│        (QR 코드 없음)         │
```

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-CC-001` | 도서 대출하러 가기 버튼 `onClick` | — | `setKioskMode('loan')`, `setScreen('auth-scan')` | `auth-scan` | 카드 발급 후 바로 대출 가능 |
| `A-CC-002` | 확인 버튼 `onClick` | — | `setScreen('idle')` | `idle` | 대기 화면으로 복귀 |

---

### 3.7 KS-007 회원증 RFID 스캔 (Auth Scan)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-007` |
| 화면명 | 회원증 RFID 스캔 |
| 화면 키 | `auth-scan` |
| 컴포넌트 | `KioskAuthScan.tsx` |
| 진입 경로 | 메인 메뉴 → 대출/반납 버튼 |
| 배경색 | 다크 (kiosk-dark-bg) |

#### 화면 레이아웃

```
┌───────────────────────────────┐
│  회원인증                     │ ← CMS: authscan.title
│                               │
│       ┌──────────┐            │
│       │  💳      │            │ ← CreditCard 아이콘 (w-14 h-14, text-sky-400)
│       │          │            │   또는 CheckCircle2 (인식 성공 시)
│       └──────────┘            │
│       ○ 스캔 링              │ ← card-scan-ring 애니메이션
│                               │
│  회원증을 가져다 대세요        │ ← CMS: authscan.instruction (펄스 텍스트)
│  RFID 카드 리더기에 회원증을   │
│  대주세요                     │
│                               │
│  ┌─────────────────────────┐  │
│  │  ✕ 취소                 │  │ ← 취소 버튼
│  └─────────────────────────┘  │
│  회원증 없이 이용하기          │ ← CMS: authscan.demo_button_text (텍스트 버튼)
│                               │
└───────────────────────────────┘
```

#### 상태 변화

| 상태 | 카드 아이콘 | 메시지 | 스캔 링 | 비고 |
|---|---|---|---|---|
| `scanning` | CreditCard (sky-400) | "회원증을 가져다 대세요" (펄스) | 표시 | 초기 상태 |
| `recognized` | CheckCircle2 (emerald-400) | "인식되었습니다" | 숨김 | 2초 후 자동 전이 |
| `skipped` | — | "데모 모드로 진행합니다" | 숨김 | 회원증 없이 이용 |

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-AS-001` | 취소 버튼 `onClick` | — | `prevScreen()` | `main-menu` | 메인 메뉴로 복귀 |
| `A-AS-002` | 회원증 없이 이용하기 `onClick` | — | API GET `/api/users` (PIN: 1234), `setAuthenticatedUser(users[0])`, toast 성공, 500ms 후 화면 전이 | `loan-select` (대출) / `return-insert` (반납) | kioskMode에 따라 분기 |
| `A-AS-003` | 2초 타이머 (자동) | — | `setStatus('recognized')` | 현재 화면 | 인식 성공 상태로 변경 |
| `A-AS-004` | 3.5초 타이머 (자동) | — | `setScreen('auth-pin')` | `auth-pin` | PIN 입력 화면으로 자동 전이 |

---

### 3.8 KS-008 비밀번호 입력 (Auth PIN)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-008` |
| 화면명 | 비밀번호 입력 |
| 화면 키 | `auth-pin` |
| 컴포넌트 | `KioskAuthPin.tsx` |
| 진입 경로 | 회원증 스캔 → 자동 전이 (3.5초) |
| 배경색 | 다크 (kiosk-dark-bg) |

#### 화면 레이아웃

```
┌───────────────────────────────┐
│  비밀번호 입력                 │ ← CMS: authpin.title
│  4자리 비밀번호를 입력해주세요 │
│                               │
│      ● ● ○ ○                 │ ← PIN 도트 (4자리, 입력된 만큼 sky-400)
│                               │
│  ┌─────┐ ┌─────┐ ┌─────┐     │
│  │  1  │ │  2  │ │  3  │     │ ← 숫자 키패드 (3×4 그리드)
│  └─────┘ └─────┘ └─────┘     │    각 키 h-16, rounded-xl
│  ┌─────┐ ┌─────┐ ┌─────┐     │
│  │  4  │ │  5  │ │  6  │     │
│  └─────┘ └─────┘ └─────┘     │
│  ┌─────┐ ┌─────┐ ┌─────┐     │
│  │  7  │ │  8  │ │  9  │     │
│  └─────┘ └─────┘ └─────┘     │
│  ┌───────────┐ ┌─────┐       │
│  │     0     │ │  ⌫  │       │ ← 0 + 삭제(Delete) 키
│  └───────────┘ └─────┘       │
│                               │
│  [✓ 확인]                    │ ← 4자리 완성 시에만 표시
│  [← 취소]                    │
└───────────────────────────────┘
```

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-AP-001` | 숫자 키 `onClick` | pin.length < 4 | pin에 숫자 추가 | 현재 화면 | 4자리 완성 시 자동으로 `handleConfirm` 호출 |
| `A-AP-002` | 삭제 키 `onClick` | pin.length > 0 | pin 마지막 자리 제거 | 현재 화면 | — |
| `A-AP-003` | 4자리 자동 제출 | pin.length === 4 | API GET `/api/users` (X-PIN 헤더), 사용자 인증 | `loan-select` (대출) / `return-insert` (반납) | kioskMode에 따라 분기 |
| `A-AP-004` | 확인 버튼 `onClick` | pin.length === 4, !isProcessing | `handleConfirm(pin)` | `loan-select` / `return-insert` | 수동 확인 |
| `A-AP-005` | 취소 버튼 `onClick` | — | `prevScreen()` | `auth-scan` | 스캔 화면으로 복귀 |

#### PIN 인증 처리 플로우

```
1. API GET /api/users (X-PIN: 입력값)
2. 성공 시:
   a. setAuthenticatedUser(users[0])
   b. toast.success(사용자명 + "님 환영합니다")
   c. 500ms 후 setScreen(kioskMode에 따른 다음 화면)
3. 실패 시:
   a. 데모 사용자 조회 (PIN 1234)
   b. 데모 사용자 있으면 인증 성공 처리
   c. 데모 사용자도 없으면 toast.error + pin 초기화
```

#### 처리 중 상태

- 회전 스피너 (border-sky-400, animate-spin)
- "인증 중..." 텍스트
- 모든 키패드 키 disabled

---

### 3.9 KS-009 도서 선택 (Loan Select)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-009` |
| 화면명 | 도서 선택 |
| 화면 키 | `loan-select` |
| 컴포넌트 | `KioskLoanSelect.tsx` |
| 진입 경로 | PIN 인증 성공 → kioskMode=loan |
| 배경색 | 라이트 (kiosk-light-bg) |

#### 화면 레이아웃

```
┌───────────────────────────────┐
│  도서를 선택해주세요           │ ← CMS: loanselect.title
│  최대 2권까지 대출할 수 있습니다│
│                               │
│  🔍 제목, 저자로 검색         │ ← 검색 바 (검색어 + X 버튼)
│                               │
│  [전체][소설][인문][과학]...   │ ← 카테고리 필터 탭 (가로 스크롤)
│                               │
│  [연금술사 ✕] [어린왕자 ✕]    │ ← 선택된 도서 칩 (가로 스크롤)
│                               │
│  ┌────────┐ ┌────────┐       │
│  │  📕    │ │  📕    │       │ ← 2열 도서 그리드
│  │ 연금술 │ │ 어린   │       │    표지(aspect-2/3) + 제목 + 저자
│  │ 사     │ │ 왕자   │       │    [선택] / [선택 취소] 버튼
│  │[선택]  │ │[선택]  │       │
│  └────────┘ └────────┘       │
│  ┌────────┐ ┌────────┐       │
│  │  📕    │ │  📕    │       │
│  │ 백년의 │ │ 사피   │       │
│  │ 고독   │ │ 엔스   │       │
│  │[선택]  │ │[선택]  │       │
│  └────────┘ └────────┘       │
│                               │
│  [← 이전]  [다음 단계 →]     │ ← 하단 버튼
└───────────────────────────────┘
```

#### UI 요소 상세

| 요소 ID | 유형 | 설명 | 비고 |
|---|---|---|---|
| `ls-search` | input | 검색 바, placeholder "제목, 저자로 검색" | 검색어 입력 시 실시간 API 조회 |
| `ls-search-clear` | 버튼 (X) | 검색어 초기화 | search 값이 있을 때만 표시 |
| `ls-category-tab` | 버튼 그룹 | 카테고리 필터: 전체, 소설, 인문, 과학, 역시, 시 | 가로 스크롤, 선택 시 bg-slate-800 |
| `ls-chip` | 버튼 (motion) | 선택된 도서 칩, 클릭 시 선택 해제 | 8자 이상 시 ... 처리 |
| `ls-book-card` | div (motion) | 도서 카드: 표지 + 제목 + 저자 + 선택 버튼 | 2열 그리드 |
| `ls-select-btn` | 버튼 | "선택" / "선택 취소" 토글 | 선택 시 bg-sky-50, 취소 시 bg-red-50 |
| `ls-prev-btn` | 버튼 | "이전" | — |
| `ls-next-btn` | 버튼 | "다음 단계" | selectedBooks.length === 0 시 disabled |

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-LS-001` | 검색 바 `onChange` | — | API GET `/api/books?search={value}&category={category}` | 현재 화면 | 실시간 도서 목록 갱신 |
| `A-LS-002` | 카테고리 탭 `onClick` | — | `setCategory(cat)`, API GET `/api/books?category={cat}` | 현재 화면 | 카테고리 필터 적용 |
| `A-LS-003` | 도서 카드 선택 버튼 `onClick` | 미선택 도서, selectedBooks.length < MAX_LOAN_COUNT | `addBook(book)` | 현재 화면 | 선택 칩에 추가, 체크마크 오버레이 |
| `A-LS-004` | 도서 카드 선택 버튼 `onClick` | 미선택 도서, selectedBooks.length ≥ MAX_LOAN_COUNT | toast.error("최대 2권까지 대출할 수 있습니다") | 현재 화면 | 최대 권수 초과 경고 |
| `A-LS-005` | 선택 칩 `onClick` / 선택 취소 버튼 | 이미 선택된 도서 | `removeBook(bookId)` | 현재 화면 | 선택 해제 |
| `A-LS-006` | 이전 버튼 `onClick` | — | `prevScreen()` | `auth-pin` | PIN 입력으로 복귀 |
| `A-LS-007` | 다음 단계 버튼 `onClick` | selectedBooks.length > 0 | `setScreen('loan-confirm')` | `loan-confirm` | 대출 확인으로 이동 |

---

### 3.10 KS-010 대출 확인 (Loan Confirm)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-010` |
| 화면명 | 대출 확인 |
| 화면 키 | `loan-confirm` |
| 컴포넌트 | `KioskLoanConfirm.tsx` |
| 진입 경로 | 도서 선택 → 다음 단계 |
| 배경색 | 라이트 (kiosk-light-bg) |

#### 화면 레이아웃

```
┌───────────────────────────────┐
│  대출 정보를 확인해주세요      │ ← CMS: loanconfirm.title
│                               │
│  ┌─────────────────────────┐  │
│  │  👤 김도서관             │  │ ← 대출자 정보 카드
│  │     LIB-00000001         │  │    이름 + 카드 번호
│  └─────────────────────────┘  │
│                               │
│  대출 도서 (2권)              │
│  ┌─────────────────────────┐  │
│  │ 📕 연금술사             │  │ ← 선택 도서 목록
│  │    Paulo Coelho          │  │    표지(소형) + 제목 + 저자
│  │    반납예정: 2026.03.19  │  │    + 반납 예정일
│  ├─────────────────────────┤  │
│  │ 📕 어린왕자             │  │
│  │    Saint-Exupéry         │  │
│  │    반납예정: 2026.03.19  │  │
│  └─────────────────────────┘  │
│                               │
│  ┌─────────────────────────┐  │
│  │  총 대출 권수:  2권     │  │ ← 요약 카드 (sky-50)
│  │  반납 예정일: 2026.03.19│  │
│  └─────────────────────────┘  │
│                               │
│  [← 이전]  [✓ 대출하기]     │ ← 하단 버튼
└───────────────────────────────┘
```

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-LC-001` | 이전 버튼 `onClick` | — | `prevScreen()` | `loan-select` | 도서 선택으로 복귀 |
| `A-LC-002` | 대출하기 버튼 `onClick` | !isProcessing | API POST `/api/loans` `{userId, bookIds, method:'kiosk'}`, 성공 시 `setScreen('loan-complete')` | `loan-complete` | 대출 실행 |
| `A-LC-003` | 대출 API 실패 | — | toast.error(에러 메시지) | 현재 화면 | 에러 처리 |

#### 반납 예정일 계산

- `dueDate = today + LOAN_PERIOD_DAYS` (15일)

#### 대출 버튼 상태

| 상태 | 표시 | 비고 |
|---|---|---|
| 기본 | "대출하기" (CheckCircle2 아이콘) | CMS 키: `loanconfirm.confirm_button_text` |
| 처리 중 | 회전 스피너 + "처리 중..." | 버튼 disabled, opacity-60 |

---

### 3.11 KS-011 대출 완료 (Loan Complete)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-011` |
| 화면명 | 대출 완료 |
| 화면 키 | `loan-complete` |
| 컴포넌트 | `KioskLoanComplete.tsx` |
| 진입 경로 | 대출 확인 → 대출 API 성공 |
| 배경색 | 라이트 (kiosk-light-bg) |

#### 화면 레이아웃

```
┌───────────────────────────────┐
│         ✅                    │ ← 성공 체크마크 (emerald-500, spring 애니메이션)
│       대출완료                │ ← CMS: loancomplete.title
│                               │
│  ┌───────┐ ┌───────┐ ┌──────┐│
│  │   0   │ │   2   │ │  0   ││ ← 통계 대시보드 (3열 그리드)
│  │대출가능│ │ 대출중 │ │ 연체 ││
│  └───────┘ └───────┘ └──────┘│
│                               │
│  대출 도서 목록               │ ← CMS: loancomplete.list_title
│  ┌─────────────────────────┐  │
│  │ 📕 연금술사             │  │ ← 활성 대출 목록
│  │    Paulo Coelho          │  │
│  │    반납: 2026.03.19     │  │
│  ├─────────────────────────┤  │
│  │ 📕 어린왕자             │  │
│  │    Saint-Exupéry         │  │
│  │    반납: 2026.03.19     │  │
│  └─────────────────────────┘  │
│                               │
│  [✓ 확인하기]                │ ← 대기 화면 복귀 버튼
└───────────────────────────────┘
```

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-LO-001` | 확인하기 버튼 `onClick` | — | `clearSelectedBooks()`, `setScreen('idle')` | `idle` | 선택 도서 초기화 후 대기 화면으로 |

#### 데이터 조회

- 화면 진입 시 API GET `/api/loans?userId={id}` 로 대출 기록 조회
- 통계 계산: available = MAX_LOAN_COUNT - active.length, current = active.length, overdue = 연체 수

---

### 3.12 KS-012 반납 도서 투입 (Return Insert)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-012` |
| 화면명 | 반납 도서 투입 |
| 화면 키 | `return-insert` |
| 컴포넌트 | `KioskReturnInsert.tsx` |
| 진입 경로 | PIN 인증 성공 → kioskMode=return |
| 배경색 | 다크 (kiosk-dark-bg) |

#### 화면 레이아웃 (정상 상태)

```
┌───────────────────────────────┐
│  도서반납                     │ ← CMS: returninsert.title
│                               │
│       ┌──────────┐            │
│       │  📥      │            │ ← BookDown 아이콘 (w-14 h-14)
│       │          │            │
│       └──────────┘            │
│          ↓ (애니메이션)       │ ← 아래로 향하는 화살표 (y 0→6→0, 1.2s 반복)
│                               │
│  반납할 도서를 하나씩          │ ← CMS: returninsert.instruction
│  넣어주세요                    │
│  도서를 넣으면 자동으로        │ ← CMS: returninsert.instruction_sub
│  인식됩니다                    │
│                               │
│  [✕ 취소]                    │
└───────────────────────────────┘
```

#### 화면 레이아웃 (대출 없음)

```
│       ℹ                       │ ← Info 아이콘 (w-16 h-16, text-sky-400)
│  반납할 도서가 없습니다        │ ← CMS: returninsert.no_loans_title
│  대출 중인 도서가 없습니다.    │ ← CMS: returninsert.no_loans_desc
```

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-RI-001` | 취소 버튼 `onClick` | — | `prevScreen()` | `auth-scan` | 스캔 화면으로 복귀 |
| `A-RI-002` | 화면 진입 시 (useEffect) | — | `clearReturnedLoans()`, 2초 후 `checkAndDetect()` | — | 반납 목록 초기화 |
| `A-RI-003` | 2초 후 자동 감지 | 대출 중인 도서 있음 | API GET `/api/loans?userId={id}`, active 대출 필터, `addReturnedLoan(active[0])`, 800ms 후 `setScreen('return-scanning')` | `return-scanning` | 첫 번째 대출 도서 자동 감지 |
| `A-RI-004` | 2초 후 자동 감지 | 대출 중인 도서 없음 | `setNoLoans(true)` | 현재 화면 | "반납할 도서가 없습니다" 표시 |

---

### 3.13 KS-013 반납 스캔 (Return Scanning)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-013` |
| 화면명 | 반납 스캔 |
| 화면 키 | `return-scanning` |
| 컴포넌트 | `KioskReturnScanning.tsx` |
| 진입 경로 | 반납 투입 → 도서 자동 감지 |
| 배경색 | 다크 (kiosk-dark-bg) |

#### 화면 레이아웃

```
┌───────────────────────────────┐
│  도서반납                     │ ← CMS: returnscanning.title
│  인식된 도서: 1권             │
│                               │
│       ◎                       │ ← 바깥쪽 펄스 링 (scale 1→1.3→1, 2s)
│      ◎                        │ ← 안쪽 펄스 링 (scale 1→1.2→1, 1.5s)
│    ┌──────┐                   │
│    │ ✅   │                   │ ← CheckCircle2 (스캔 완료 시)
│    │  또는 │                   │   또는 Loader2 (스캔 중)
│    └──────┘                   │
│                               │
│  스캔이 완료되었습니다         │ ← CMS: returnscanning.complete_text
│                               │
│  ┌─────────────────────────┐  │
│  │ ✅ 연금술사              │  │ ← 인식된 도서 목록
│  │    Paulo Coelho          │  │
│  └─────────────────────────┘  │
│                               │
│  [📖 더 넣기 (1권 남음)]     │ ← 남은 대출 도서가 있을 때만
│  [✅ 반납 완료하기]           │
└───────────────────────────────┘
```

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-RS-001` | 더 넣기 버튼 `onClick` | remainingLoans.length > 0 | `setScreen('return-insert')` | `return-insert` | 추가 반납 도서 투입 |
| `A-RS-002` | 반납 완료하기 버튼 `onClick` | 스캔 완료 후 | `setScreen('return-confirm')` | `return-confirm` | 반납 확인으로 이동 |
| `A-RS-003` | 2초 타이머 (자동) | — | `setScanning(false)` | 현재 화면 | 스캔 완료 상태로 변경 |

#### 남은 대출 도서 조회

- API GET `/api/loans?userId={id}` → active 대출 중 returnedLoans에 없는 것

---

### 3.14 KS-014 반납 확인 (Return Confirm)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-014` |
| 화면명 | 반납 확인 |
| 화면 키 | `return-confirm` |
| 컴포넌트 | `KioskReturnConfirm.tsx` |
| 진입 경로 | 반납 스캔 → 반납 완료하기 |
| 배경색 | 라이트 (kiosk-light-bg) |

#### 화면 레이아웃

```
┌───────────────────────────────┐
│  반납 정보를 확인해주세요      │ ← CMS: returnconfirm.title
│                               │
│  반납 도서 (1권)              │
│  ┌─────────────────────────┐  │
│  │ 📕 연금술사             │  │ ← 반납 도서 목록
│  │    Paulo Coelho          │  │    표지(소형) + 제목 + 저자
│  │    대출일: 2026.03.04    │  │    + 대출일 → 반납예정일
│  │    → 반납예정: 2026.03.19│  │
│  └─────────────────────────┘  │
│                               │
│  [← 이전]  [✅ 반납하기]     │ ← 하단 버튼
└───────────────────────────────┘
```

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-RC-001` | 이전 버튼 `onClick` | — | `prevScreen()` | `return-scanning` | 반납 스캔으로 복귀 |
| `A-RC-002` | 반납하기 버튼 `onClick` | !isProcessing | 모든 returnedLoans에 대해 API POST `/api/loans/{id}/return`, 성공 수 카운트 | `return-complete` | 반납 실행 (순차 처리) |
| `A-RC-003` | 반납 API 모두 실패 | — | toast.error("반납 처리에 실패했습니다") | 현재 화면 | 에러 처리 |

---

### 3.15 KS-015 반납 완료 (Return Complete)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `KS-015` |
| 화면명 | 반납 완료 |
| 화면 키 | `return-complete` |
| 컴포넌트 | `KioskReturnComplete.tsx` |
| 진입 경로 | 반납 확인 → 반납 API 성공 |
| 배경색 | 라이트 (kiosk-light-bg) |

#### 화면 레이아웃

```
┌───────────────────────────────┐
│                               │
│         ✅                    │ ← 성공 체크마크 (w-20 h-20, text-emerald-500)
│       반납완료                │ ← CMS: returncomplete.title
│  도서가 정상적으로 반납되었습니다│ ← CMS: returncomplete.message
│                               │
│  ┌─────────────────────────┐  │
│  │  반납 도서 (1권)         │  │
│  │  ✅ 연금술사             │  │ ← 반납 도서 요약
│  └─────────────────────────┘  │
│                               │
│  [✅ 확인하기]                │ ← 대기 화면 복귀 버튼
│                               │
└───────────────────────────────┘
```

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `A-RD-001` | 확인하기 버튼 `onClick` | — | `clearReturnedLoans()`, `setScreen('idle')` | `idle` | 반납 목록 초기화 후 대기 화면으로 |

---

## 4. 관리자 화면 그룹

---

### 4.1 AD-001 관리자 로그인 (Admin Login)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `AD-001` |
| 화면명 | 관리자 로그인 |
| 컴포넌트 | `AdminLogin.tsx` |
| 진입 경로 | 대기 화면 우측 하단 Settings 버튼 → adminMode=true |
| 배경색 | bg-gradient-to-br from-slate-50 to-slate-100 |

#### 화면 레이아웃

```
┌───────────────────────────────┐
│                               │
│  ┌─────────────────────────┐  │
│  │       📚                │  │ ← Library 아이콘 (w-8 h-8, text-primary)
│  │  스마트 도서관 관리      │  │ ← 카드 타이틀
│  │  관리자 계정으로 로그인  │  │ ← 카드 설명
│  │                          │  │
│  │  이메일                  │  │ ← 라벨
│  │  ┌────────────────────┐ │  │
│  │  │admin@library.go.kr │ │  │ ← email 입력 (h-12)
│  │  └────────────────────┘ │  │
│  │                          │  │
│  │  비밀번호                │  │ ← 라벨
│  │  ┌────────────────────┐ │  │
│  │  │ ********            │ │  │ ← password 입력 (h-12)
│  │  └────────────────────┘ │  │
│  │                          │  │
│  │  [에러 메시지]           │  │ ← 빨간 배경, 조건부 표시
│  │                          │  │
│  │  [🔑 로그인]            │  │ ← 제출 버튼 (h-12, 전체 폭)
│  │                          │  │
│  │  테스트 계정 안내        │  │ ← 개발 환경에서만 표시
│  │  이메일: superadmin@...  │  │
│  │  비밀번호: admin1234     │  │
│  └─────────────────────────┘  │
│                               │
└───────────────────────────────┘
```

#### 액션 명세

| 액션 ID | 트리거 | 조건 | 동작 | 전이 화면 | 비고 |
|---|---|---|---|---|---|
| `AD-L-001` | 로그인 버튼 `onClick` (form submit) | 이메일/비밀번호 비어 있음 | 에러 메시지 "이메일과 비밀번호를 모두 입력해주세요." | 현재 화면 | 유효성 검증 |
| `AD-L-002` | 로그인 버튼 `onClick` | 유효성 통과 | API POST `/api/admin/auth/login` `{email, password}`, 성공 시 `setAdminUser(data.user)`, toast 성공 | 대시보드 개요 | 로그인 성공 |
| `AD-L-003` | 로그인 API 실패 | — | 에러 메시지 표시 (`data.error` 또는 "로그인에 실패했습니다.") | 현재 화면 | 서버 에러 |
| `AD-L-004` | 네트워크 오류 | — | 에러 메시지 "서버 연결에 실패했습니다." | 현재 화면 | 네트워크 에러 |

#### 버튼 상태

| 상태 | 표시 | 비고 |
|---|---|---|
| 기본 | "로그인" (LogIn 아이콘) | — |
| 로딩 | 회전 스피너 + "로그인 중..." | 버튼 disabled, 입력 disabled |

#### 기본 관리자 계정

| 이메일 | 비밀번호 | 역할 |
|---|---|---|
| `superadmin@library.go.kr` | `admin1234` | super_admin |
| `admin@library.go.kr` | `admin1234` | admin |
| `operator@library.go.kr` | `admin1234` | operator |

---

### 4.2 AD-002 관리자 대시보드 개요 (Overview)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `AD-002` |
| 화면명 | 대시보드 개요 |
| 섹션 키 | `overview` |
| 컴포넌트 | `OverviewSection.tsx` |
| 진입 경로 | 로그인 성공 후 기본 섹션 / 사이드바 "대시보드 개요" 클릭 |

#### 화면 레이아웃

```
┌──────────────────────────────────────────┐
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │  ← KPI 카드 (4열 그리드)
│  │  15  │ │   2  │ │   0  │ │   1  │   │     총 도서 / 활성 대출 /
│  │총도서│ │활성  │ │연체  │ │오늘  │   │     연체 / 오늘 대출
│  └──────┘ └──────┘ └──────┘ └──────┘   │
│                                          │
│  ┌──────────────────────────────────┐    │  ← 최근 활동 목록
│  │  최근 활동                       │    │
│  │  • 김도서관님이 "연금술사" 대출  │    │
│  │  • 이책님이 "어린왕자" 반납      │    │
│  │  • ...                           │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌──────────────────────────────────┐    │  ← 빠른 작업 버튼
│  │  [도서 추가] [대출 현황] [설정]  │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

#### 액션 명세

| 액션 ID | 트리거 | 동작 | 비고 |
|---|---|---|---|
| `AD-OV-001` | 화면 진입 시 | KPI 데이터, 최근 활동, 오늘 통계 API 조회 | 자동 로딩 |
| `AD-OV-002` | 빠른 작업 "도서 추가" 클릭 | `setActiveSection('books')` | 도서 관리 섹션으로 이동 |
| `AD-OV-003` | 빠른 작업 "대출 현황" 클릭 | `setActiveSection('analytics')` | 분석 대시보드로 이동 |
| `AD-OV-004` | 빠른 작업 "설정" 클릭 | `setActiveSection('settings')` | 시스템 설정으로 이동 |

---

### 4.3 AD-003 콘텐츠 관리 (Content)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `AD-003` |
| 화면명 | 콘텐츠 관리 (CMS) |
| 섹션 키 | `content` |
| 컴포넌트 | `ContentSection.tsx` |
| 진입 경로 | 사이드바 "콘텐츠 관리" 클릭 |

#### 화면 레이아웃

```
┌──────────────────────────────────────────┐
│  [화면별 필터 ▼]                         │  ← 화면 선택 드롭다운
│                                          │
│  ┌──────────────────────────────────┐    │  ← 콘텐츠 항목 목록
│  │  idle.title          | SMART LI…│    │     key | 값 | 타입 | 편집
│  │  idle.subtitle       | 무인 도…│    │
│  │  idle.pulse_text     | 화면을 …│    │
│  │  mainmenu.title      | SMART … │    │
│  │  ...                             │    │
│  └──────────────────────────────────┘    │
│                                          │
│  [개별 저장] [일괄 저장] [기본값 복원]   │  ← 하단 작업 버튼
└──────────────────────────────────────────┘
```

#### 콘텐츠 항목 유형

| 타입 | 편집 방식 | 비고 |
|---|---|---|
| `text` | 텍스트 입력 필드 | 일반 텍스트 |
| `color` | 색상 선택기 | hex 색상값 |
| `image` | 이미지 업로드 | 파일 선택 |
| `json` | JSON 편집기 | 구조화된 데이터 |

#### 액션 명세

| 액션 ID | 트리거 | 동작 | 비고 |
|---|---|---|---|
| `AD-CT-001` | 화면 필터 변경 | 해당 화면의 콘텐츠 항목만 필터링 | — |
| `AD-CT-002` | 콘텐츠 값 편집 | 입력 필드 값 변경 | 로컬 상태 업데이트 |
| `AD-CT-003` | 개별 저장 | API PUT `/api/admin/content/{key}` | 단일 항목 저장 |
| `AD-CT-004` | 일괄 저장 | API POST `/api/admin/content/bulk` | 변경된 모든 항목 저장 |
| `AD-CT-005` | 기본값 복원 | API POST `/api/admin/content/reset` | 모든 항목 기본값으로 복원 |

---

### 4.4 AD-004 도서 관리 (Books)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `AD-004` |
| 화면명 | 도서 관리 |
| 섹션 키 | `books` |
| 컴포넌트 | `BooksSection.tsx` |
| 진입 경로 | 사이드바 "도서 관리" 클릭 |

#### 화면 레이아웃

```
┌──────────────────────────────────────────┐
│  [🔍 검색] [카테고리 필터 ▼] [+ 도서 추가]│  ← 상단 도구 모음
│                                          │
│  ┌──────────────────────────────────┐    │  ← 도서 테이블
│  │ 표지 │ 제목    │ 저자  │ 카테고리│재고│가용│  │
│  │  📕  │ 연금술사│ Paulo│ 소설   │ 3 │ 2 │  │
│  │  📕  │ 어린왕자│ Saint│ 소설   │ 2 │ 1 │  │
│  │  ...                             │    │
│  └──────────────────────────────────┘    │
│                                          │
│  [이전] 1 2 3 ... [다음]                │  ← 페이지네이션
└──────────────────────────────────────────┘
```

#### 액션 명세

| 액션 ID | 트리거 | 동작 | 비고 |
|---|---|---|---|
| `AD-BK-001` | 도서 추가 버튼 | 도서 추가 Dialog 열기 | 빈 폼 |
| `AD-BK-002` | 도서 행 클릭 / 편집 버튼 | 도서 편집 Dialog 열기 | 기존 데이터로 폼 채움 |
| `AD-BK-003` | 도서 삭제 버튼 | 삭제 확인 Dialog → API DELETE `/api/admin/books/{id}` | — |
| `AD-BK-004` | 도서 추가/편집 저장 | API POST/PUT `/api/admin/books` | 폼 유효성 검증 |
| `AD-BK-005` | 검색 바 입력 | 도서 목록 실시간 필터 | — |
| `AD-BK-006` | 카테고리 필터 변경 | API GET `/api/admin/books?category={cat}` | — |

#### 도서 폼 필드

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| ISBN | text | ✅ | unique |
| 제목 | text | ✅ | — |
| 저자 | text | ✅ | — |
| 출판사 | text | ❌ | — |
| 카테고리 | select | ✅ | 소설/인문/과학/역사/시 |
| 총 권수 | number | ✅ | totalCopies |
| 표지 URL | text | ❌ | coverUrl |

---

### 4.5 AD-005 이용자 관리 (Users)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `AD-005` |
| 화면명 | 이용자 관리 |
| 섹션 키 | `users` |
| 컴포넌트 | `UsersSection.tsx` |
| 진입 경로 | 사이드바 "이용자 관리" 클릭 |

#### 화면 레이아웃

```
┌──────────────────────────────────────────┐
│  [관리자 계정] [키오스크 이용자]          │  ← 탭 전환
│                                          │
│  ┌──────────────────────────────────┐    │  ← 관리자 계정 탭
│  │  이메일        │ 이름   │ 역할    │  │
│  │  superadmin@..│ 슈퍼관 │ super_ │  │
│  │  admin@...    │ 관리자 │ admin  │  │
│  │  operator@... │ 운영자 │ operat │  │
│  └──────────────────────────────────┘    │
│  [+ 관리자 추가]                         │
│                                          │
│  ┌──────────────────────────────────┐    │  ← 키오스크 이용자 탭
│  │  이름   │ 카드번호  │ 대출수 │ 상태│  │
│  │  김도서 │ LIB-...  │   2   │ 활성│  │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

#### 액션 명세

| 액션 ID | 트리거 | 동작 | 비고 |
|---|---|---|---|
| `AD-US-001` | 관리자 추가 버튼 | 관리자 생성 Dialog 열기 | 이메일, 이름, 역할, 비밀번호 입력 |
| `AD-US-002` | 관리자 편집 버튼 | 관리자 편집 Dialog 열기 | — |
| `AD-US-003` | 관리자 삭제 버튼 | 삭제 확인 → API DELETE `/api/admin/users/{id}` | super_admin은 삭제 불가 |
| `AD-US-004` | 관리자 저장 | API POST/PUT `/api/admin/users` | — |
| `AD-US-005` | 탭 전환 | 관리자 계정 / 키오스크 이용자 목록 전환 | — |

---

### 4.6 AD-006 분석 대시보드 (Analytics)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `AD-006` |
| 화면명 | 분석 대시보드 |
| 섹션 키 | `analytics` |
| 컴포넌트 | `AnalyticsSection.tsx` |
| 진입 경로 | 사이드바 "분석 대시보드" 클릭 |

#### 화면 레이아웃

```
┌──────────────────────────────────────────┐
│  [7일] [30일] [90일]                     │  ← 날짜 범위 선택
│                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │  ← 통계 카드
│  │  45  │ │  38  │ │  12  │ │  7   │   │     총 대출 / 총 반납 /
│  │총대출│ │총반납│ │활성  │ │연체  │   │     활성 / 연체
│  └──────┘ └──────┘ └──────┘ └──────┘   │
│                                          │
│  ┌──────────────────────────────────┐    │  ← 대출 추이 LineChart
│  │  📈                              │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌────────────┐  ┌────────────────┐     │  ← 카테고리 PieChart +
│  │  🥧 카테고리│  │  📊 인기 도서  │     │     인기 도서 BarChart
│  │   분포      │  │    순위        │     │
│  └────────────┘  └────────────────┘     │
└──────────────────────────────────────────┘
```

#### 액션 명세

| 액션 ID | 트리거 | 동작 | 비고 |
|---|---|---|---|
| `AD-AN-001` | 날짜 범위 버튼 클릭 | API GET `/api/admin/analytics?range={7|30|90}` | 차트 및 통계 갱신 |
| `AD-AN-002` | 화면 진입 시 | 기본 30일 범위 데이터 로딩 | 자동 로딩 |

---

### 4.7 AD-007 시스템 설정 (Settings)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `AD-007` |
| 화면명 | 시스템 설정 |
| 섹션 키 | `settings` |
| 컴포넌트 | `SettingsSection.tsx` |
| 진입 경로 | 사이드바 "시스템 설정" 클릭 |

#### 화면 레이아웃

```
┌──────────────────────────────────────────┐
│  ┌──────────────────────────────────┐    │  ← 대출 규정 설정
│  │  대출 규정                       │    │
│  │  최대 대출 권수:  [2]           │    │
│  │  대출 기간(일):   [15]          │    │
│  │  연체 배율:       [1.5]         │    │
│  │              [저장]             │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌──────────────────────────────────┐    │  ← 키오스크 설정
│  │  키오스크 설정                   │    │
│  │  세션 타임아웃(초): [30]        │    │
│  │  유지보수 모드:     [OFF]       │    │  ← Switch 토글
│  │              [저장]             │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌──────────────────────────────────┐    │  ← 알림 설정
│  │  알림 설정                       │    │
│  │  연체 알림:  [ON]               │    │
│  │  대출 알림:  [ON]               │    │
│  │              [저장]             │    │
│  └──────────────────────────────────┘    │
│                                          │
│  [⚠ 데이터베이스 초기화]               │  ← 위험 작업 (확인 Dialog)
└──────────────────────────────────────────┘
```

#### 액션 명세

| 액션 ID | 트리거 | 동작 | 비고 |
|---|---|---|---|
| `AD-ST-001` | 대출 규정 저장 | API PUT `/api/admin/settings` `{category:'loan'}` | — |
| `AD-ST-002` | 키오스크 설정 저장 | API PUT `/api/admin/settings` `{category:'kiosk'}` | — |
| `AD-ST-003` | 알림 설정 저장 | API PUT `/api/admin/settings` `{category:'notification'}` | — |
| `AD-ST-004` | 데이터베이스 초기화 | 확인 Dialog → API POST `/api/admin/seed` | **주의**: 모든 데이터 초기화 |

---

### 4.8 AD-008 감사 로그 (Audit)

#### 화면 식별 정보

| 항목 | 값 |
|---|---|
| 화면 ID | `AD-008` |
| 화면명 | 감사 로그 |
| 섹션 키 | `audit` |
| 컴포넌트 | `AuditSection.tsx` |
| 진입 경로 | 사이드바 "감사 로그" 클릭 |

#### 화면 레이아웃

```
┌──────────────────────────────────────────┐
│  [액션 필터 ▼] [엔티티 필터 ▼]          │  ← 필터 드롭다운
│  [시작일] ~ [종료일]                     │  ← 날짜 범위
│  [필터 적용]                             │
│                                          │
│  ┌──────────────────────────────────┐    │  ← 감사 로그 테이블
│  │ 시간     │ 사용자  │ 액션  │ 대상 │  │
│  │ 14:30:25 │ admin  │ 로그인│ -   │  │
│  │ 14:31:10 │ admin  │ 생성  │ 도서 │  │
│  │ 14:32:00 │ admin  │ 수정  │ 콘텐츠│  │
│  │ ...                              │    │
│  └──────────────────────────────────┘    │
│                                          │
│  [이전] 1 2 3 ... [다음]                │  ← 페이지네이션
└──────────────────────────────────────────┘
```

#### 액션 명세

| 액션 ID | 트리거 | 동작 | 비고 |
|---|---|---|---|
| `AD-AU-001` | 필터 적용 버튼 | API GET `/api/admin/audit?action=&entity=&from=&to=&page=` | 필터링된 로그 조회 |
| `AD-AU-002` | 페이지 전환 | API GET `/api/admin/audit?page={n}` | 페이지네이션 |
| `AD-AU-003` | 화면 진입 시 | 최근 감사 로그 자동 로딩 | — |

---

## 5. 공통 요소 및 인터랙션 패턴

### 5.1 관리자 대시보드 공통 레이아웃

```
┌──────────────────────────────────────────┐
│ ☰  스마트 도서관 관리  🔔  👤 관리자  ⏻ │  ← 상단 헤더 바
├──────────┬───────────────────────────────┤
│          │                               │
│ 사이드바 │       메인 콘텐츠             │  ← AnimatePresence 전환
│          │                               │
│ 개요     │                               │
│ 콘텐츠   │                               │
│ 도서     │                               │
│ 이용자   │                               │
│ 분석     │                               │
│ 설정     │                               │
│ 감사     │                               │
│          │                               │
│ [키오스크│                               │
│  모드로  │                               │
│  전환]   │                               │
├──────────┴───────────────────────────────┤
│  © 2026 Smart Library                    │  ← 푸터
└──────────────────────────────────────────┘
```

### 5.2 사이드바 네비게이션 항목

| 항목 | 아이콘 | 라벨 | 섹션 키 |
|---|---|---|---|
| 1 | LayoutDashboard | 대시보드 개요 | `overview` |
| 2 | Palette | 콘텐츠 관리 | `content` |
| 3 | BookOpen | 도서 관리 | `books` |
| 4 | Users | 이용자 관리 | `users` |
| 5 | BarChart3 | 분석 대시보드 | `analytics` |
| 6 | Settings | 시스템 설정 | `settings` |
| 7 | FileText | 감사 로그 | `audit` |

### 5.3 상단 헤더 바 요소

| 요소 | 아이콘 | 동작 | 비고 |
|---|---|---|---|
| 햄버거 메뉴 | Menu | `toggleSidebar()` | 모바일에서만 표시 (Sheet 드로어) |
| 제목 | — | — | 현재 섹션 제목 (SECTION_TITLES) |
| 알림 벨 | Bell | 알림 드롭다운 열기 | 읽지 않은 알림 수 Badge |
| 사용자 정보 | — | DropdownMenu: 프로필, 비밀번호 변경 | 관리자 이름 + 역할 |
| 로그아웃 | LogOut | API POST `/api/admin/auth/logout`, `setAdminMode(false)` | 키오스크 대기 화면으로 |
| 키오스크 모드 전환 | Monitor | `setAdminMode(false)` | 키오스크 대기 화면으로 (로그아웃 없이) |

### 5.4 모바일 사이드바 (Sheet 드로어)

- **트리거**: 햄버거 메뉴 버튼 (햄버거 아이콘, md 미만에서만 표시)
- **방향**: 좌측에서 슬라이드 인
- **내용**: 사이드바 네비게이션 항목과 동일
- **닫기**: 오버레이 터치 / 항목 선택 시 자동 닫힘

### 5.5 권한 기반 UI 제어

| 역할 | 개요 | 콘텐츠 | 도서 | 이용자 | 분석 | 설정 | 감사 |
|---|---|---|---|---|---|---|---|
| `super_admin` | 읽기/쓰기 | 읽기/쓰기 | 읽기/쓰기 | 읽기/쓰기 | 읽기/쓰기 | 읽기/쓰기 | 읽기/쓰기 |
| `admin` | 읽기/쓰기 | 읽기/쓰기 | 읽기/쓰기 | 읽기/쓰기 | 읽기/쓰기 | 읽기 | 읽기 |
| `operator` | 읽기 | 읽기 | 읽기 | 읽기 | 읽기 | — | 읽기 |

### 5.6 키오스크 공통 버튼 스타일 (kiosk-btn 클래스)

```css
.kiosk-btn {
  @apply flex items-center justify-center gap-2 
         min-h-[56px] px-6 rounded-2xl 
         text-base font-semibold 
         transition-all duration-200 
         active:scale-[0.98];
}
```

### 5.7 키오스크 공통 배경 클래스

| 클래스 | 배경색 | 용도 |
|---|---|---|
| `kiosk-dark-bg` | #0b1120 (다크 네이비) | 대기, 메인 메뉴, 카드 발급, 스캔, PIN |
| `kiosk-light-bg` | #F8FAFC (라이트) | 도서 선택, 대출/반납 확인 및 완료 |

### 5.8 CMS 텍스트 렌더링 (CmsText 컴포넌트)

- **컴포넌트**: `CmsText.tsx`
- **동작**: `useAppStore().cmsContent[contentKey]` 조회 → 값이 있으면 사용, 없으면 `fallback` 텍스트 사용
- **속성**: `contentKey`, `fallback`, `as` (태그 종류: span/p/h1/h2/h3/div), `className`

---

## 6. 애니메이션 명세

### 6.1 화면 전환 애니메이션

| 전환 | 라이브러리 | 지속 시간 | 이징 | 설명 |
|---|---|---|---|---|
| 화면 전환 | Framer Motion AnimatePresence | 300ms | ease-in-out | 페이드 인/아웃 |
| 섹션 전환 (관리자) | Framer Motion AnimatePresence | 200ms | ease-in-out | 페이드 + 약간의 y 이동 |

### 6.2 키오스크 인터랙션 애니메이션

| 애니메이션 ID | 요소 | 키프레임 | 지속 시간 | 반복 | 비고 |
|---|---|---|---|---|---|
| `ANI-001` | 대기 화면 펄스 텍스트 | opacity [0.4, 1, 0.4] | 2.5s | Infinity | "화면을 터치하여 시작하세요" |
| `ANI-002` | 대기 화면 펄스 링 | scale [1, 1.8, 2.5], opacity [0.25, 0.08, 0] | 3s | Infinity | 하단 확장 링 |
| `ANI-003` | RFID 스캔 링 | scale 0→1.5, opacity 1→0 | 2s | Infinity | card-scan-ring CSS |
| `ANI-004` | 성공 체크마크 | scale 0→1 (spring, stiffness 200, damping 15) | — | 1회 | 대출/반납/카드 완료 |
| `ANI-005` | 메인 메뉴 버튼 진입 | opacity 0→1, y 20→0 | 0.4s | 1회 | delay 각 버튼별 차등 |
| `ANI-006` | 카드 발급 버튼 진입 | opacity 0→1, y 24→0 | 0.4s | 1회 | delay 0.1 + i×0.12 |
| `ANI-007` | 승인 대기 펄스 도트 | scale [1, 1.4, 1], opacity [0.4, 1, 0.4] | 1.2s | Infinity | delay i×0.25 |
| `ANI-008` | PIN 도트 입력 | scale [1, 1.3, 1] | 0.2s | 1회 | 현재 입력 위치 |
| `ANI-009` | 반납 투입 화살표 | y [0, 6, 0] | 1.2s | Infinity | 아래로 향하는 화살표 |
| `ANI-010` | 반납 스캔 바깥쪽 링 | scale [1, 1.3, 1], opacity [0.3, 0, 0.3] | 2s | Infinity | — |
| `ANI-011` | 반납 스캔 안쪽 링 | scale [1, 1.2, 1], opacity [0.5, 0.1, 0.5] | 1.5s | Infinity | — |
| `ANI-012` | 버튼 탭 피드백 | scale 0.97 | — | 1회 | whileTap |

### 6.3 reduced-motion 대응

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
}
```

---

## 7. 접근성 명세

### 7.1 ARIA 속성

| 요소 | 속성 | 값 | 화면 |
|---|---|---|---|
| 대기 화면 전체 | `role` | `button` | KS-001 |
| 대기 화면 전체 | `tabIndex` | `0` | KS-001 |
| 대기 화면 전체 | `aria-label` | "화면을 터치하여 시작하세요" | KS-001 |
| 관리자 진입 버튼 | `aria-label` | "관리자 모드" | KS-001 |
| 뒤로가기 버튼 | `aria-label` | "뒤로가기" | KS-003~008 |
| 도서 카드 | `aria-label` | `"도서: {title}"` | KS-009 |
| PIN 입력 | `aria-label` | "PIN 번호 입력" | KS-008 |
| 선택 카운트 | `aria-live` | `assertive` | KS-009 |

### 7.2 포커스 관리

- 화면 전환 시 첫 번째 인터랙티브 요소에 자동 포커스
- 모달/Dialog 포커스 트랩 (shadcn/ui Dialog 기본 제공)
- 뒤로 가기 시 이전 포커스 복원

### 7.3 스크린 리더

- 화면 전환 안내: `aria-live` 영역으로 화면명 안내
- 성공/오류 메시지: toast (Sonner) → `aria-live` 영역
- 시각 전용 요소: `aria-hidden="true"`

### 7.4 터치 타겟 크기

| 요소 | 최소 크기 | 기준 |
|---|---|---|
| 모든 버튼 | 44×44px | WCAG 2.1 AA |
| 숫자 키패드 키 | 64×64px (h-16) | 시니어 친화적 |
| 메인 메뉴 버튼 | 140px 높이 | 시니어 친화적 |
| 입력 필드 | 56px 높이 | 시니어 친화적 |

---

## 8. 에러 처리 명세

### 8.1 키오스크 에러 처리

| 에러 유형 | 화면 | 처리 방식 | 사용자 메시지 |
|---|---|---|---|
| API 네트워크 오류 | 대출 확인 | toast.error | "네트워크 오류가 발생했습니다. 다시 시도해주세요." |
| API 비즈니스 에러 | 대출 확인 | toast.error + 응답 에러 메시지 | 서버에서 반환된 에러 메시지 |
| 도서 목록 조회 실패 | 도서 선택 | toast.error | "도서 목록을 불러오지 못했습니다" |
| PIN 인증 실패 | PIN 입력 | toast.error + PIN 초기화 | "사용자를 찾을 수 없습니다. 다시 시도해주세요." |
| 데모 사용자 조회 실패 | RFID 스캔 | toast.error | "데모 사용자를 찾을 수 없습니다" |
| 최대 권수 초과 | 도서 선택 | toast.error | "최대 2권까지 대출할 수 있습니다" |
| 반납할 도서 없음 | 반납 투입 | 화면 내 메시지 | "반납할 도서가 없습니다" |
| 카드 신청 API 오류 | 카드 폼 | console.error (화면 전환은 계속) | — |
| 폼 유효성 에러 | 카드 폼 | 필드별 빨간 에러 텍스트 | 필드별 메시지 |

### 8.2 관리자 에러 처리

| 에러 유형 | 화면 | 처리 방식 | 사용자 메시지 |
|---|---|---|---|
| 로그인 인증 실패 | 로그인 | Card 내 에러 메시지 | 서버 에러 메시지 / "로그인에 실패했습니다." |
| 네트워크 오류 | 로그인 | Card 내 에러 메시지 | "서버 연결에 실패했습니다." |
| 권한 부족 | 모든 섹션 | 버튼/메뉴 숨김 | — (UI 제어) |
| Select.Item 빈 값 | 감사 로그 | **런타임 에러 (미수정)** | shadcn/ui Select requires non-empty value |

---

## 9. 타임아웃 및 자동 복귀 명세

### 9.1 키오스크 자동 전이 타이머

| 화면 | 타이머 | 동작 | 비고 |
|---|---|---|---|
| RFID 스캔 | 2초 | 상태 → `recognized` | 인식 성공 표시 |
| RFID 스캔 | 3.5초 | 화면 → `auth-pin` | PIN 입력으로 자동 전이 |
| 반납 투입 | 2초 | 자동 감지 시작 | 도서 인식 시뮬레이션 |
| 반납 투입 | 감지 후 800ms | 화면 → `return-scanning` | 스캔 화면으로 |
| 반납 스캔 | 2초 | 상태 → 스캔 완료 | 스캔 완료 표시 |
| 카드 승인 대기 | 5초 | 화면 → `card-complete` | 시뮬레이션: 자동 승인 |
| PIN 인증 성공 | 500ms | 화면 전이 | 대출/반납 화면으로 |

### 9.2 세션 타임아웃

| 항목 | 기본값 | 설정 가능 | 비고 |
|---|---|---|---|
| 키오스크 세션 타임아웃 | 30초 | ✅ (관리자 설정) | 30초 무조작 시 대기 화면 자동 복귀 |
| 관리자 세션 만료 | 24시간 | ❌ | JWT 토큰 만료 |

### 9.3 CMS 콘텐츠 폴링

| 항목 | 간격 | 비고 |
|---|---|---|
| CMS 버전 확인 | 30초 | `/api/content/version` 폴링 |
| CMS 콘텐츠 갱신 | 버전 변경 시 | `/api/content` 전체 갱신 |

---

## 부록 A: 전체 화면 목록 요약

### 키오스크 화면 (15개)

| ID | 화면 키 | 화면명 | 배경 | 이전 화면 |
|---|---|---|---|---|
| KS-001 | `idle` | 대기 화면 | 다크 | — |
| KS-002 | `main-menu` | 메인 메뉴 | 다크 | idle |
| KS-003 | `card-apply` | 도서증 발급 종류 선택 | 다크 | main-menu |
| KS-004 | `card-form` | 도서증 발급 개인정보 입력 | 다크 | card-apply |
| KS-005 | `card-pending` | 도서증 발급 승인 대기 | 다크 | card-form |
| KS-006 | `card-complete` | 도서증 발급 완료 | 다크 | idle |
| KS-007 | `auth-scan` | 회원증 RFID 스캔 | 다크 | main-menu |
| KS-008 | `auth-pin` | 비밀번호 입력 | 다크 | auth-scan |
| KS-009 | `loan-select` | 도서 선택 | 라이트 | auth-pin |
| KS-010 | `loan-confirm` | 대출 확인 | 라이트 | loan-select |
| KS-011 | `loan-complete` | 대출 완료 | 라이트 | idle |
| KS-012 | `return-insert` | 반납 도서 투입 | 다크 | main-menu |
| KS-013 | `return-scanning` | 반납 스캔 | 다크 | return-insert |
| KS-014 | `return-confirm` | 반납 확인 | 라이트 | return-scanning |
| KS-015 | `return-complete` | 반납 완료 | 라이트 | idle |

### 관리자 화면 (8개)

| ID | 섹션 키 | 화면명 | 사이드바 라벨 |
|---|---|---|---|
| AD-001 | — | 관리자 로그인 | — |
| AD-002 | `overview` | 대시보드 개요 | 대시보드 개요 |
| AD-003 | `content` | 콘텐츠 관리 | 콘텐츠 관리 |
| AD-004 | `books` | 도서 관리 | 도서 관리 |
| AD-005 | `users` | 이용자 관리 | 이용자 관리 |
| AD-006 | `analytics` | 분석 대시보드 | 분석 대시보드 |
| AD-007 | `settings` | 시스템 설정 | 시스템 설정 |
| AD-008 | `audit` | 감사 로그 | 감사 로그 |

---

## 부록 B: 전체 액션 목록 요약

### 키오스크 액션 (38개)

| 액션 ID | 화면 | 트리거 | 전이 |
|---|---|---|---|
| A-IDLE-001 | 대기 | 화면 터치 | main-menu |
| A-IDLE-002 | 대기 | 관리자 버튼 | 관리자 로그인 |
| A-MM-001 | 메인 메뉴 | 도서카드 발급 | card-apply |
| A-MM-002 | 메인 메뉴 | 도서 대출 | auth-scan |
| A-MM-003 | 메인 메뉴 | 도서 반납 | auth-scan |
| A-CA-001 | 카드 발급 선택 | 이전 | main-menu |
| A-CA-002 | 카드 발급 선택 | 모바일 도서증 | card-form |
| A-CA-003 | 카드 발급 선택 | 실물 도서증 | card-form |
| A-CA-004 | 카드 발급 선택 | 자동 발급 | card-form |
| A-CF-001 | 카드 입력 폼 | 이전 | card-apply |
| A-CF-002 | 카드 입력 폼 | 유효성 실패 | 현재 화면 |
| A-CF-003 | 카드 입력 폼 | 모바일 제출 | card-complete |
| A-CF-004 | 카드 입력 폼 | 실물 제출 | card-pending |
| A-CP-001 | 카드 승인 대기 | 취소 | main-menu |
| A-CP-002 | 카드 승인 대기 | 5초 자동 승인 | card-complete |
| A-CC-001 | 카드 완료 | 도서 대출하러 가기 | auth-scan |
| A-CC-002 | 카드 완료 | 확인 | idle |
| A-AS-001 | RFID 스캔 | 취소 | main-menu |
| A-AS-002 | RFID 스캔 | 회원증 없이 이용 | loan-select/return-insert |
| A-AS-003 | RFID 스캔 | 2초 자동 인식 | 현재 화면 (상태 변경) |
| A-AS-004 | RFID 스캔 | 3.5초 자동 전이 | auth-pin |
| A-AP-001 | PIN 입력 | 숫자 키 입력 | 현재 화면 |
| A-AP-002 | PIN 입력 | 삭제 키 | 현재 화면 |
| A-AP-003 | PIN 입력 | 4자리 자동 제출 | loan-select/return-insert |
| A-AP-004 | PIN 입력 | 확인 버튼 | loan-select/return-insert |
| A-AP-005 | PIN 입력 | 취소 | auth-scan |
| A-LS-001 | 도서 선택 | 검색 바 입력 | 현재 화면 |
| A-LS-002 | 도서 선택 | 카테고리 필터 | 현재 화면 |
| A-LS-003 | 도서 선택 | 도서 선택 (미초과) | 현재 화면 |
| A-LS-004 | 도서 선택 | 도서 선택 (초과) | 현재 화면 (토스트) |
| A-LS-005 | 도서 선택 | 선택 해제 | 현재 화면 |
| A-LS-006 | 도서 선택 | 이전 | auth-pin |
| A-LS-007 | 도서 선택 | 다음 단계 | loan-confirm |
| A-LC-001 | 대출 확인 | 이전 | loan-select |
| A-LC-002 | 대출 확인 | 대출하기 | loan-complete |
| A-LC-003 | 대출 확인 | API 실패 | 현재 화면 (토스트) |
| A-LO-001 | 대출 완료 | 확인하기 | idle |
| A-RI-001 | 반납 투입 | 취소 | auth-scan |
| A-RI-002 | 반납 투입 | 화면 진입 | — (초기화) |
| A-RI-003 | 반납 투입 | 2초 자동 감지 | return-scanning |
| A-RI-004 | 반납 투입 | 대출 없음 | 현재 화면 (메시지) |
| A-RS-001 | 반납 스캔 | 더 넣기 | return-insert |
| A-RS-002 | 반납 스캔 | 반납 완료하기 | return-confirm |
| A-RS-003 | 반납 스캔 | 2초 스캔 완료 | 현재 화면 (상태 변경) |
| A-RC-001 | 반납 확인 | 이전 | return-scanning |
| A-RC-002 | 반납 확인 | 반납하기 | return-complete |
| A-RC-003 | 반납 확인 | API 모두 실패 | 현재 화면 (토스트) |
| A-RD-001 | 반납 완료 | 확인하기 | idle |

### 관리자 액션 (18개)

| 액션 ID | 화면 | 트리거 | 비고 |
|---|---|---|---|
| AD-L-001 | 로그인 | 빈 입력 제출 | 유효성 에러 |
| AD-L-002 | 로그인 | 로그인 성공 | 대시보드 진입 |
| AD-L-003 | 로그인 | 인증 실패 | 에러 메시지 |
| AD-L-004 | 로그인 | 네트워크 오류 | 에러 메시지 |
| AD-OV-001 | 개요 | 화면 진입 | 데이터 자동 로딩 |
| AD-OV-002 | 개요 | 빠른 작업 - 도서 추가 | books 섹션 이동 |
| AD-OV-003 | 개요 | 빠른 작업 - 대출 현황 | analytics 섹션 이동 |
| AD-OV-004 | 개요 | 빠른 작업 - 설정 | settings 섹션 이동 |
| AD-CT-001~005 | 콘텐츠 | 필터/편집/저장/복원 | CMS 관리 |
| AD-BK-001~006 | 도서 | 추가/편집/삭제/검색/필터 | 도서 CRUD |
| AD-US-001~005 | 이용자 | 추가/편집/삭제/탭 전환 | 관리자 + 키오스크 이용자 |
| AD-AN-001~002 | 분석 | 날짜 범위/자동 로딩 | 차트 데이터 갱신 |
| AD-ST-001~004 | 설정 | 저장/초기화 | 시스템 설정 |
| AD-AU-001~003 | 감사 | 필터/페이지/자동 로딩 | 감사 로그 조회 |

---

## 부록 C: CMS 콘텐츠 키 전체 목록

### 대기 화면

| 키 | 기본값 | 타입 |
|---|---|---|
| `idle.title` | SMART LIBRARY | text |
| `idle.subtitle` | 무인 도서대출반납기 | text |
| `idle.pulse_text` | 화면을 터치하여 시작하세요 | text |
| `idle.background_color` | #0b1120 | color |

### 메인 메뉴

| 키 | 기본값 | 타입 |
|---|---|---|
| `mainmenu.title` | SMART LIBRARY | text |
| `mainmenu.card_button_text` | 도서카드 발급 | text |
| `mainmenu.loan_button_text` | 도서 대출 | text |
| `mainmenu.return_button_text` | 도서 반납 | text |

### 카드 발급 선택

| 키 | 기본값 | 타입 |
|---|---|---|
| `cardapply.title` | 도서증 발급 | text |
| `cardapply.subtitle` | 발급 종류를 선택해주세요 | text |
| `cardapply.mobile_title` | 모바일 도서증 발급 | text |
| `cardapply.mobile_desc` | 즉시 발급, 자동 승인 | text |
| `cardapply.physical_title` | 실물 도서증 발급 | text |
| `cardapply.physical_desc` | 담당자 승인 후 발급 | text |
| `cardapply.auto_title` | 자동 발급 신청 | text |
| `cardapply.auto_desc` | 개인정보 입력 후 자동 승인 | text |

### 카드 발급 폼

| 키 | 기본값 | 타입 |
|---|---|---|
| `cardform.title` | 개인정보 입력 | text |
| `cardform.name_label` | 이름 | text |
| `cardform.birthdate_label` | 생년월일 | text |
| `cardform.phone_label` | 전화번호 | text |
| `cardform.address_label` | 주소 | text |
| `cardform.submit_button_text` | 신청하기 | text |

### 카드 승인 대기

| 키 | 기본값 | 타입 |
|---|---|---|
| `cardpending.title` | 발급 신청이 완료되었습니다 | text |
| `cardpending.wait_message` | 담당자 승인을 기다려주세요 | text |
| `cardpending.summary_title` | 신청 내역 | text |
| `cardpending.cancel_button_text` | 취소 | text |

### 카드 발급 완료

| 키 | 기본값 | 타입 |
|---|---|---|
| `cardcomplete.title` | 도서증 발급이 완료되었습니다! | text |
| `cardcomplete.mobile_message` | 모바일 도서증이 발급되었습니다 | text |
| `cardcomplete.physical_message` | 실물 도서증은 3영업일 내 발급됩니다 | text |
| `cardcomplete.go_loan_button_text` | 도서 대출하러 가기 | text |
| `cardcomplete.confirm_button_text` | 확인 | text |

### 회원증 스캔

| 키 | 기본값 | 타입 |
|---|---|---|
| `authscan.title` | 회원인증 | text |
| `authscan.instruction` | 회원증을 가져다 대세요 | text |
| `authscan.demo_button_text` | 회원증 없이 이용하기 | text |

### PIN 입력

| 키 | 기본값 | 타입 |
|---|---|---|
| `authpin.title` | 비밀번호 입력 | text |

### 도서 선택

| 키 | 기본값 | 타입 |
|---|---|---|
| `loanselect.title` | 도서를 선택해주세요 | text |
| `loanselect.max_selection_warning` | 최대 2권까지 대출할 수 있습니다 | text |
| `loanselect.confirm_button_text` | 다음 단계 | text |

### 대출 확인

| 키 | 기본값 | 타입 |
|---|---|---|
| `loanconfirm.title` | 대출 정보를 확인해주세요 | text |
| `loanconfirm.confirm_button_text` | 대출하기 | text |

### 대출 완료

| 키 | 기본값 | 타입 |
|---|---|---|
| `loancomplete.title` | 대출완료 | text |
| `loancomplete.list_title` | 대출 도서 목록 | text |
| `loancomplete.confirm_button_text` | 확인하기 | text |

### 반납 투입

| 키 | 기본값 | 타입 |
|---|---|---|
| `returninsert.title` | 도서반납 | text |
| `returninsert.instruction` | 반납할 도서를 하나씩 넣어주세요 | text |
| `returninsert.instruction_sub` | 도서를 넣으면 자동으로 인식됩니다 | text |
| `returninsert.detected_text` | 도서가 감지되었습니다 | text |
| `returninsert.no_loans_title` | 반납할 도서가 없습니다 | text |
| `returninsert.no_loans_desc` | 대출 중인 도서가 없습니다. | text |

### 반납 스캔

| 키 | 기본값 | 타입 |
|---|---|---|
| `returnscanning.title` | 도서반납 | text |
| `returnscanning.scanning_text` | 도서가 인식되었습니다. 잠시 기다려주세요. | text |
| `returnscanning.complete_text` | 스캔이 완료되었습니다 | text |
| `returnscanning.more_button_text` | 더 넣기 (N권 남음) | text |
| `returnscanning.complete_button_text` | 반납 완료하기 | text |

### 반납 확인

| 키 | 기본값 | 타입 |
|---|---|---|
| `returnconfirm.title` | 반납 정보를 확인해주세요 | text |
| `returnconfirm.confirm_button_text` | 반납하기 | text |

### 반납 완료

| 키 | 기본값 | 타입 |
|---|---|---|
| `returncomplete.title` | 반납완료 | text |
| `returncomplete.message` | 도서가 정상적으로 반납되었습니다. | text |
| `returncomplete.confirm_button_text` | 확인하기 | text |

---

## 부록 D: API 엔드포인트 목록

### 키오스크 공개 API

| 메서드 | 경로 | 설명 | 사용 화면 |
|---|---|---|---|
| GET | `/api` | 서버 상태 확인 | — |
| POST | `/api/seed` | 초기 데이터 시드 | 앱 시작 시 |
| GET | `/api/users` | 사용자 조회 (PIN 기반) | KS-007, KS-008 |
| POST | `/api/users` | 사용자 등록 | — |
| GET | `/api/users/{id}` | 사용자 상세 | — |
| POST | `/api/users/{id}/pin` | PIN 확인/설정 | — |
| POST | `/api/users/{id}/card` | 도서증 발급 | — |
| GET | `/api/books` | 도서 검색 | KS-009 |
| GET | `/api/loans` | 대출 목록 | KS-011, KS-012, KS-013 |
| POST | `/api/loans` | 대출 생성 | KS-010 |
| POST | `/api/loans/{id}/return` | 반납 처리 | KS-014 |
| POST | `/api/loans/{id}/extend` | 대출 연장 (항상 400) | — |
| POST | `/api/card-application` | 도서증 발급 신청 | KS-004 |
| GET | `/api/content` | CMS 콘텐츠 조회 | 앱 전체 |
| GET | `/api/content/version` | CMS 버전 확인 | 앱 전체 (폴링) |

### 관리자 API (인증 필요)

| 메서드 | 경로 | 설명 | 사용 화면 |
|---|---|---|---|
| POST | `/api/admin/auth/login` | 관리자 로그인 | AD-001 |
| POST | `/api/admin/auth/logout` | 관리자 로그아웃 | 헤더 바 |
| GET | `/api/admin/auth/session` | 세션 확인 | 앱 시작 시 |
| POST | `/api/admin/auth/change-password` | 비밀번호 변경 | 헤더 바 |
| GET/POST | `/api/admin/users` | 관리자 계정 목록/생성 | AD-005 |
| PUT/DELETE | `/api/admin/users/{id}` | 관리자 계정 수정/삭제 | AD-005 |
| GET | `/api/admin/kiosk-users` | 키오스크 이용자 목록 | AD-005 |
| GET/POST | `/api/admin/books` | 도서 목록/생성 | AD-004 |
| GET/PUT/DELETE | `/api/admin/books/{id}` | 도서 상세/수정/삭제 | AD-004 |
| GET/PUT | `/api/admin/content` | 콘텐츠 항목 목록/수정 | AD-003 |
| GET/PUT | `/api/admin/content/{key}` | 단일 콘텐츠 항목 | AD-003 |
| POST | `/api/admin/content/bulk` | 콘텐츠 일괄 수정 | AD-003 |
| POST | `/api/admin/content/reset` | 콘텐츠 기본값 복원 | AD-003 |
| GET | `/api/admin/content/versions/{key}` | 콘텐츠 버전 이력 | AD-003 |
| GET/PUT | `/api/admin/settings` | 시스템 설정 조회/수정 | AD-007 |
| GET | `/api/admin/analytics` | 분석 통계 | AD-006 |
| GET | `/api/admin/audit` | 감사 로그 | AD-008 |
| GET/POST | `/api/admin/kiosk` | 키오스크 상태/초기화 | AD-007 |
| GET/POST | `/api/admin/media` | 미디어 자산 | AD-003 |
| GET/POST | `/api/admin/notifications` | 알림 목록/생성 | 헤더 바 |
| POST | `/api/admin/seed` | 데이터 초기화 | AD-007 |

---

*— 문서 끝 —*
