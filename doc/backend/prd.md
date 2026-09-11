# 스마트 도서관 키오스크 시뮬레이터 — 백엔드 관리자 대시보드 PRD

> **버전**: v1.0.0  
> **작성일**: 2026-03-05  
> **상태**: Draft  
> **담당**: Backend & Dashboard Team  
> **기반 문서**: `doc/prd.md` (키오스크 프론트엔드 PRD), `doc/dashboard/prd.md` (대시보드 PRD)

---

## 목차

1. [제품 개요](#1-제품-개요)
2. [기능 요구사항](#2-기능-요구사항)
3. [CMS 콘텐츠 관리 요구사항](#3-cms-콘텐츠-관리-요구사항)
4. [RBAC 요구사항](#4-rbac-요구사항)
5. [실시간 동기화 요구사항](#5-실시간-동기화-요구사항)
6. [반응형 디자인 요구사항](#6-반응형-디자인-요구사항)
7. [비기능 요구사항](#7-비기능-요구사항)
8. [사용자 스토리](#8-사용자-스토리)
9. [데이터 요구사항](#9-데이터-요구사항)
10. [제약 사항](#10-제약-사항)
11. [마일스톤](#11-마일스톤)

---

## 1. 제품 개요

### 1.1 제품명

스마트 도서관 무인 대출/반납 키오스크 시뮬레이터 — **백엔드 관리자 대시보드**

### 1.2 제품 비전

키오스크 프론트엔드에 표시되는 **모든 텍스트·이미지·색상·규칙**을 코드 배포 없이 즉시 변경할 수 있는 **Headless CMS + 운영 관리 대시보드**. 도서관 관리자가 비개발자도 직관적으로 콘텐츠를 편집하고, 변경 사항이 **실시간(≤3초)** 으로 키오스크에 반영되며, 역할 기반 접근 제어(RBAC)로 보안을 보장한다. ECO(이씨오) 사 실제 제품의 UI/UX를 충실히 재현한 시뮬레이터의 운영 핵심 인프라로 기능한다.

### 1.3 핵심 가치

| 가치 | 설명 |
|------|------|
| **Zero-Deploy CMS** | 코드 수정·재배포 없이 키오스크 프론트엔드의 모든 콘텐츠를 즉시 변경 |
| **Real-Time Sync** | 관리자 변경 후 ≤3초 내 키오스크 화면에 반영 (SSE/Polling) |
| **Role-Safe** | super_admin / admin / operator 3-tier RBAC로 최소 권한 원칙 준수 |
| **Kiosk-First Responsive** | 21″·24″ 키오스크 터치스크린 → 태블릿 → 모바일까지 완전 반응형 |
| **Local-First** | SQLite + Prisma로 외부 DB 서버 의존 없이 단일 보드 자립 동작 |
| **Audit-Complete** | 모든 관리자 작업의 변경 전후값을 감사 로그에 기록하여 추적성 보장 |

### 1.4 대상 사용자

| 사용자 유형 | 역할 코드 | 설명 | 주요 활동 |
|-------------|-----------|------|-----------|
| 시스템 최고 관리자 | `super_admin` | 전체 시스템 권한 보유. 다른 관리자 계정 생성·권한 부여 | 계정 관리, 시스템 설정, DB 백업, 감사 로그 조회 |
| 도서관 관리자 | `admin` | 콘텐츠·도서·사용자 관리 + 통계 조회. 계정 관리 불가 | CMS 편집, 도서/사용자 CRUD, 공지 관리, 통계 확인 |
| 도서관 운영자 | `operator` | 읽기 전용 + 제한적 콘텐츠 편집. 도서·사용자 조회만 가능 | 대출/반납 현황 조회, 도서 검색, 공지 확인 |

### 1.5 참조 시스템

| 참조 | 반영 포인트 |
|------|-------------|
| **Strapi v5 Headless CMS** | 콘텐츠 타입·필드 동적 관리 구조, key-value 콘텐츠 저장 패턴 |
| **Payload CMS** | 블록 기반 에디터 + 이미지 크롭 UX |
| **Next.js Admin Template (Tremor)** | 통계 대시보드 UI 컴포넌트, 차트·카드 레이아웃 |
| **React Admin** | CRUD + 필터·정렬·페이지네이션 패턴 |
| **Vercel Dashboard** | 실시간 데이터 폴링·SSE 패턴, 배포 상태 인디케이터 |
| **ECO(이씨오) 실제 키오스크** | 화면 구성·버튼 배치·플로우 순서를 실제 제품과 동일하게 CMS로 제어 |

### 1.6 시스템 아키텍처 개요

```
┌──────────────────────┐                    ┌──────────────────────┐
│   Kiosk Frontend     │  SSE/Polling (≤3s) │  Admin Dashboard     │
│   (Next.js 16)       │◄───────────────────│  (Next.js 16)        │
│   Port 3000          │───────────────────►│  Port 3001           │
│   11 Screens         │  Content API (REST)│  CMS + Stats + RBAC  │
└──────────┬───────────┘                    └──────────┬───────────┘
           │                                             │
           │  /api/content/:key                          │  Prisma ORM
           │  /api/loans, /api/books, /api/users         │
           │                                             │
           ▼                                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        SQLite (Local DB)                             │
│  ┌─────────┐ ┌───────────┐ ┌──────┐ ┌──────────┐ ┌────────────┐   │
│  │CmsContent│ │AdminUser  │ │Book  │ │LibraryUser│ │BorrowRecord│   │
│  └─────────┘ └───────────┘ └──────┘ └──────────┘ └────────────┘   │
│  ┌─────────┐ ┌───────────┐ ┌──────┐ ┌──────────┐ ┌────────────┐   │
│  │AuditLog │ │Notice     │ │Kiosk │ │Sesssion  │ │Notification│   │
│  └─────────┘ └───────────┘ └──────┘ └──────────┘ └────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. 기능 요구사항

### 2.1 우선순위 정의

| 등급 | 의미 | 릴리스 |
|------|------|--------|
| **P0** | MVP — 1차 릴리스에 **반드시** 포함 | v1.0 |
| **P1** | 운영 강화 — 2차 릴리스, 출시 후 추가 | v1.5 |
| **P2** | 확장 기능 — 3차 릴리스 | v2.0 |

---

### 2.2 P0: MVP 필수 기능

#### P0-1. CMS 콘텐츠 관리

| ID | 기능명 | 설명 | 수용 기준 |
|----|--------|------|-----------|
| P0-1-1 | 텍스트 인라인 편집 | 모든 화면의 텍스트를 인라인 편집 (클릭 → 입력 → 저장) | 편집 후 저장 시 ≤3초 내 키오스크 반영 |
| P0-1-2 | 이미지 업로드·교체 | 로고, 버튼 아이콘, 배경 이미지, 도서 표지 등 업로드/교체 | PNG/JPG/SVG만 허용, 크기 제한 준수, SVG sanitize |
| P0-1-3 | 색상 변경 | 배경색, 버튼 색상, 텍스트 색상 등 HEX 값을 컬러 피커로 변경 | 유효 HEX 형식 검증, 실시간 미리보기 |
| P0-1-4 | 대출 규칙 설정 | 최대 권수(1~20), 대출 기간(1~90일), 연체 배수(1.0~5.0) 설정 | 슬라이더/숫자 입력, 유효범위 검증, 즉시 규칙 반영 |
| P0-1-5 | 도서 CRUD | 도서 등록·조회·수정·삭제 + 표지 이미지 업로드 | ISBN unique 검증, 카테고리 일치 검증 |
| P0-1-6 | 사용자 CRUD | 도서관 이용자 등록·조회·수정·삭제 (RFID/PIN 포함) | RFID unique 검증, PIN bcrypt 해시 저장 |
| P0-1-7 | 변경 즉시 반영 | CMS 저장 시 ≤3초 내 키오스크 프론트엔드에 반영 | SSE 우선 → 폴링 폴백 (3초 간격) |
| P0-1-8 | 변경 이력 조회 | 각 CMS 항목의 수정 이력을 최근 50건까지 확인 | 변경 전후값 diff 표시, 작업자·시간 표시 |

#### P0-2. 권한 관리 (RBAC)

| ID | 기능명 | 설명 | 수용 기준 |
|----|--------|------|-----------|
| P0-2-1 | 역할 정의 | super_admin, admin, operator 3개 역할 고정 | 역할 코드는 시스템 상수로 관리, 임의 생성 불가 |
| P0-2-2 | 권한 매핑 | 역할별 접근 가능 메뉴·API를 매핑 테이블로 관리 | 미인가 API 호출 시 403 반환 |
| P0-2-3 | 계정 관리 | 관리자 계정 생성·수정·비활성화 (삭제 금지 — 감사 추적 유지) | 비활성화 시 즉시 세션 만료 |
| P0-2-4 | 세션 관리 | JWT + Refresh Token, 30분 비활동 자동 로그아웃 | AT 15분, RT 7일, 5회 실패 시 15분 잠금 |

#### P0-3. 대시보드 통계

| ID | 기능명 | 설명 | 수용 기준 |
|----|--------|------|-----------|
| P0-3-1 | 오늘의 현황 | 금일 대출 건수, 반납 건수, 현재 대출 중 권수, 연체 건수 | 실시간 집계, 새로고침 불필요 (10초 자동 갱신) |
| P0-3-2 | 시간대별 그래프 | 최근 7일 시간대(0~23시) 대출·반납 누적 막대그래프 | Tremor BarChart 컴포넌트 활용 |
| P0-3-3 | 인기 도서 TOP 10 | 대출 횟수 기준 TOP 10 리스트 | 도서명, 대출 횟수, 카테고리 표시 |
| P0-3-4 | 최근 활동 | 최근 20건 대출·반납 로그 리스트 | 시간, 사용자, 도서, 유형 컬럼 |

---

### 2.3 P1: 운영 강화 기능

| ID | 기능명 | 설명 | 수용 기준 |
|----|--------|------|-----------|
| P1-1 | 감사 로그 | 모든 CMS 변경·권한 변경·로그인 이벤트를 타임스탬프+작업자+변경 전후로 기록 | 필터(기간·작업자·항목·액션유형), 변경 전후값 diff 하이라이트 |
| P1-2 | 화면 미리보기 | CMS 변경 사항을 저장 전 21″/24″/태블릿/모바일 뷰포트로 실시간 프리뷰 | 4개 뷰포트 iframe, 변경 diff 하이라이트 |
| P1-3 | 공지 관리 | 키오스크 대기 화면에 표시할 공지사항 CRUD | 시작~종료 일시, 우선순위, 활성/비활성 토글 |
| P1-4 | 일괄 가져오기 | 도서 CSV/Excel 일괄 등록 (최대 1,000건) | CSV 파서 + 건별 유효성 검증 + 성공/실패 리포트 |
| P1-5 | 데이터 내보내기 | 대출·반납 통계 CSV 내보내기 | 기간 선택 + UTF-8 BOM 인코딩 (Excel 호환) |
| P1-6 | 시스템 상태 모니터 | 키오스크 가동 시간, API 응답 시간, DB 크기, 에러 발생률 | 실시간 상태 카드 + 임계치 초과 시 경고 |
| P1-7 | 키오스크 원격 제어 | 대기 화면 강제 전환, 유지보수 모드 토글, 키오스크 앱 재시작 | super_admin 전용, 실행 전 확인 다이얼로그 |
| P1-8 | 백업/복원 | SQLite DB 백업 파일 다운로드 + 복원 기능 | 백업 시 타임스탬프 파일명, 복원 전 현재 DB 자동 백업 |
| P1-9 | 알림 시스템 | 연체 도서, 시스템 에러, 도서 재고 부족 시 대시보드 내 알림 | 알림 배지 + 알림 목록 패널 + 읽음/안읽음 상태 |
| P1-10 | 테마/외관 관리 | 색상 스킴 preset, 폰트 크기 조절, 애니메이션 속도 설정 | 다크/라이트 모드, 커스텀 색상 팔레트 저장 |

---

### 2.4 P2: 확장 기능

| ID | 기능명 | 설명 | 수용 기준 |
|----|--------|------|-----------|
| P2-1 | 다중 키오스크 관리 | 복수 키오스크 단말을 등록하고 단말별로 다른 CMS 콘텐츠 적용 | 단말 등록, 단말별 CMS 프로파일, 개별 브로드캐스트 |
| P2-2 | 다국어 CMS | 한국어·영어·중국어·일본어 4개국어 콘텐츠 관리 | i18n JSON 에디터, 로케일 전환 UI, 언어별 미리보기 |
| P2-3 | 예약 기능 | 도서 대출 예약(대기열) 관리 | 예약 등록/취소, 대기열 순서, 예약 도서 반납 시 알림 |
| P2-4 | 외부 알림 연동 | 연체 알림을 이메일/문자로 발송 | SMTP/SMS API 연동, 알림 템플릿 편집 |
| P2-5 | 예약 유지보수 | 특정 시간대에 키오스크를 유지보수 모드로 자동 전환 | 유지보수 윈도우 CRUD, 반복 설정(매일/매주) |
| P2-6 | 일괄 사용자 등록 | 사용자 CSV 일괄 등록 (최대 5,000건) | CSV 파서 + RFID/PIN 자동 생성 옵션 |
| P2-7 | 고급 분석 | 월별/연도별 대출 추이, 카테고리별 분포, 사용자 연령대 분석 | 다양한 차트 유형, 기간 선택, 데이터 드릴다운 |

---

## 3. CMS 콘텐츠 관리 요구사항

> 관리자 대시보드에서 제어 가능한 **모든 텍스트·이미지·색상·규칙** 항목의 완전 목록이다.  
> 각 항목은 Prisma 모델 `CmsContent`의 개별 레코드로 저장되며, `key` 값으로 프론트엔드가 조회한다.  
> 키오스크 프론트엔드의 **11개 화면** 각각에 대해 편집 가능한 항목을 정의한다.

### 3.1 대기 화면 (Idle Screen)

> 화면 ID: `idle` | 컴포넌트: `KioskIdleScreen.tsx`

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `idle.logo_image` | 로고 이미지 | **image** (PNG/SVG, ≤500KB) | `/icons/favicon-512.png` | 화면 중앙 상단 로고 (Library 아이콘 대체) |
| `idle.title_text` | 타이틀 텍스트 | **text** (≤50자) | `"SMART LIBRARY"` | 로고 하단 메인 타이틀 (현재: SMART LIBRARY) |
| `idle.title_color` | 타이틀 색상 | **color** (HEX) | `#FFFFFF` | 타이틀 텍스트 색상 |
| `idle.title_font_size` | 타이틀 폰트 크기 | **number** (24~72px) | `36` | 타이틀 폰트 크기 (px) |
| `idle.subtitle_text` | 부제목 텍스트 | **text** (≤100자) | `"무인 도서대출반납기"` | 타이틀 하단 설명 텍스트 |
| `idle.subtitle_color` | 부제목 색상 | **color** (HEX) | `#64748B` | 부제목 텍스트 색상 (현재: slate-500) |
| `idle.bg_color` | 배경색 | **color** (HEX) | `#0B1120` | 대기 화면 배경색 (현재: 다크 네이비) |
| `idle.bg_image` | 배경 이미지 | **image** (JPG/PNG, ≤2MB) | `null` | 배경 패턴 이미지 (선택, 설정 시 bg_color 위에 오버레이) |
| `idle.glow_color` | 글로우 효과 색상 | **color** (HEX) | `#38BDF8` | 배경 radial-gradient 글로우 색상 (현재: sky-400) |
| `idle.glow_opacity` | 글로우 효과 투명도 | **number** (0~1) | `0.06` | 글로우 효과 투명도 |
| `idle.touch_prompt` | 터치 안내 텍스트 | **text** (≤80자) | `"화면을 터치하여 시작하세요"` | 하단 깜빡이는 안내 문구 |
| `idle.touch_prompt_color` | 터치 안내 색상 | **color** (HEX) | `#7DD3FC` | 터치 안내 텍스트 색상 (현재: sky-300/80) |
| `idle.pulse_ring_color` | 펄스 링 색상 | **color** (HEX) | `#38BDF8` | 하단 펄스 링 테두리 색상 |
| `idle.pulse_ring_opacity` | 펄스 링 투명도 | **number** (0~1) | `0.3` | 펄스 링 테두리 투명도 |

### 3.2 메인 메뉴 (Main Menu)

> 화면 ID: `main-menu` | 컴포넌트: `KioskMainMenu.tsx`

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `menu.header_logo_icon` | 헤더 로고 아이콘 | **image** (SVG, ≤50KB) | `lucide:Library` | 헤더 Library 아이콘 (커스텀 SVG 교체 가능) |
| `menu.header_title_text` | 헤더 타이틀 | **text** (≤50자) | `"SMART LIBRARY"` | 헤더 타이틀 텍스트 |
| `menu.header_title_color` | 헤더 타이틀 색상 | **color** (HEX) | `#FFFFFF` | 헤더 타이틀 색상 |
| `menu.header_subtitle_text` | 헤더 부제목 | **text** (≤100자) | `"무인 도서대출반납기"` | 헤더 부제목 텍스트 |
| `menu.header_bg_color` | 헤더 배경색 | **color** (HEX) | `#0B1120` | 헤더 영역 배경색 |
| `menu.borrow_button_text` | 대출 버튼 텍스트 | **text** (≤30자) | `"도서 대출"` | 대출 버튼 라벨 |
| `menu.borrow_button_icon` | 대출 버튼 아이콘 | **image** (SVG, ≤50KB) | `lucide:BookOpen` | 대출 버튼 아이콘 |
| `menu.borrow_button_icon_color` | 대출 아이콘 색상 | **color** (HEX) | `#38BDF8` | 대출 버튼 아이콘 색상 (현재: sky-400) |
| `menu.borrow_button_bg_from` | 대출 버튼 배경색(시작) | **color** (HEX) | `#1E3A5F` | 대출 버튼 gradient 시작색 |
| `menu.borrow_button_bg_to` | 대출 버튼 배경색(끝) | **color** (HEX) | `#0F2744` | 대출 버튼 gradient 끝색 |
| `menu.borrow_button_border_color` | 대출 버튼 테두리 색상 | **color** (HEX) | `#38BDF8` | 대출 버튼 테두리 색상 |
| `menu.borrow_button_text_color` | 대출 버튼 텍스트 색상 | **color** (HEX) | `#FFFFFF` | 대출 버튼 글자 색상 |
| `menu.return_button_text` | 반납 버튼 텍스트 | **text** (≤30자) | `"도서 반납"` | 반납 버튼 라벨 |
| `menu.return_button_icon` | 반납 버튼 아이콘 | **image** (SVG, ≤50KB) | `lucide:ArrowDownToLine` | 반납 버튼 아이콘 |
| `menu.return_button_icon_color` | 반납 아이콘 색상 | **color** (HEX) | `#2DD4BF` | 반납 버튼 아이콘 색상 (현재: teal-400) |
| `menu.return_button_bg_from` | 반납 버튼 배경색(시작) | **color** (HEX) | `#134E4A` | 반납 버튼 gradient 시작색 |
| `menu.return_button_bg_to` | 반납 버튼 배경색(끝) | **color** (HEX) | `#0A3D3A` | 반납 버튼 gradient 끝색 |
| `menu.return_button_border_color` | 반납 버튼 테두리 색상 | **color** (HEX) | `#2DD4BF` | 반납 버튼 테두리 색상 |
| `menu.return_button_text_color` | 반납 버튼 텍스트 색상 | **color** (HEX) | `#FFFFFF` | 반납 버튼 글자 색상 |
| `menu.page_bg_color` | 페이지 배경색 | **color** (HEX) | `#0B1120` | 메인 메뉴 전체 배경색 |
| `menu.clock_color` | 시계 텍스트 색상 | **color** (HEX) | `#475569` | 하단 시계 텍스트 색상 (현재: slate-600) |

### 3.3 인증 — RFID 스캔 화면 (AuthScan)

> 화면 ID: `auth-scan` | 컴포넌트: `KioskAuthScan.tsx`

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `auth_scan.page_title` | 페이지 타이틀 | **text** (≤50자) | `"회원인증"` | 인증 화면 상단 타이틀 |
| `auth_scan.rfid_prompt` | RFID 안내 텍스트 | **text** (≤100자) | `"회원증을 가져다 대세요"` | RFID 인증 안내 문구 |
| `auth_scan.rfid_prompt_color` | RFID 안내 색상 | **color** (HEX) | `#CBD5E1` | RFID 안내 텍스트 색상 (현재: slate-300) |
| `auth_scan.rfid_sub_prompt` | RFID 보조 안내 | **text** (≤100자) | `"RFID 카드 리더기에 회원증을 대주세요"` | RFID 보조 안내 문구 |
| `auth_scan.rfid_sub_prompt_color` | 보조 안내 색상 | **color** (HEX) | `#64748B` | 보조 안내 텍스트 색상 (현재: slate-500) |
| `auth_scan.rfid_icon` | RFID 아이콘 | **image** (SVG, ≤50KB) | `lucide:CreditCard` | RFID 카드 아이콘 |
| `auth_scan.rfid_icon_color` | RFID 아이콘 색상 | **color** (HEX) | `#38BDF8` | RFID 아이콘 색상 (현재: sky-400) |
| `auth_scan.recognized_text` | 인식 성공 텍스트 | **text** (≤50자) | `"인식되었습니다"` | 인식 성공 시 표시 텍스트 |
| `auth_scan.recognized_color` | 인식 성공 색상 | **color** (HEX) | `#34D399` | 인식 성공 텍스트 색상 (현재: emerald-400) |
| `auth_scan.skip_text` | 스킵 버튼 텍스트 | **text** (≤50자) | `"회원증 없이 이용하기"` | 데모 모드 스킵 버튼 라벨 |
| `auth_scan.cancel_text` | 취소 버튼 텍스트 | **text** (≤20자) | `"취소"` | 취소 버튼 라벨 |
| `auth_scan.scan_ring_color` | 스캔 링 색상 | **color** (HEX) | `#38BDF8` | 카드 스캔 애니메이션 링 색상 |

### 3.4 인증 — PIN 입력 화면 (AuthPin)

> 화면 ID: `auth-pin` | 컴포넌트: `KioskAuthPin.tsx`

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `auth_pin.page_title` | 페이지 타이틀 | **text** (≤50자) | `"비밀번호 입력"` | PIN 화면 상단 타이틀 |
| `auth_pin.prompt_text` | PIN 안내 텍스트 | **text** (≤100자) | `"4자리 비밀번호를 입력해주세요"` | PIN 입력 안내 문구 |
| `auth_pin.prompt_color` | PIN 안내 색상 | **color** (HEX) | `#94A3B8` | PIN 안내 텍스트 색상 (현재: slate-400) |
| `auth_pin.dot_fill_color` | PIN 도트 채움 색상 | **color** (HEX) | `#38BDF8` | 입력된 PIN 도트 색상 (현재: sky-400) |
| `auth_pin.dot_empty_color` | PIN 도트 빈 색상 | **color** (HEX) | `#64748B` | 빈 PIN 도트 테두리 색상 (현재: slate-500) |
| `auth_pin.keypad_bg_color` | 키패드 배경색 | **color** (HEX) | `#1E293B` | 숫자 키패드 버튼 배경색 (현재: slate-800) |
| `auth_pin.keypad_text_color` | 키패드 텍스트 색상 | **color** (HEX) | `#FFFFFF` | 숫자 키패드 텍스트 색상 |
| `auth_pin.processing_text` | 처리 중 텍스트 | **text** (≤50자) | `"인증 중..."` | PIN 인증 처리 중 안내 |
| `auth_pin.error_text` | 인증 실패 메시지 | **text** (≤100자) | `"사용자를 찾을 수 없습니다. 다시 시도해주세요."` | 인증 오류 안내 |
| `auth_pin.confirm_text` | 확인 버튼 텍스트 | **text** (≤20자) | `"확인"` | 확인 버튼 라벨 |
| `auth_pin.cancel_text` | 취소 버튼 텍스트 | **text** (≤20자) | `"취소"` | 취소 버튼 라벨 |

### 3.5 도서 대출 — 도서 선택 화면 (LoanSelect)

> 화면 ID: `loan-select` | 컴포넌트: `KioskLoanSelect.tsx`

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `loan_select.page_title` | 페이지 타이틀 | **text** (≤50자) | `"도서를 선택해주세요"` | 도서 선택 상단 타이틀 |
| `loan_select.subtitle_template` | 부제목 템플릿 | **text** (≤100자) | `"최대 {max}권까지 대출할 수 있습니다"` | {max} 변수 치환 부제목 |
| `loan_select.search_placeholder` | 검색 placeholder | **text** (≤50자) | `"제목, 저자로 검색"` | 검색 입력 placeholder |
| `loan_select.category_list` | 카테고리 목록 | **json** (string[]) | `["전체","소설","인문","과학","역사","시"]` | 카테고리 탭 목록 |
| `loan_select.empty_result_text` | 결과 없음 텍스트 | **text** (≤100자) | `"대출 가능한 도서가 없습니다"` | 검색 결과 빈 상태 안내 |
| `loan_select.select_button_text` | 선택 버튼 텍스트 | **text** (≤20자) | `"선택"` | 도서 선택 버튼 라벨 |
| `loan_select.deselect_button_text` | 선택 해제 버튼 텍스트 | **text** (≤20자) | `"선택 취소"` | 도서 선택 해제 버튼 라벨 |
| `loan_select.limit_exceeded_text` | 권수 초과 메시지 | **text** (≤100자) | `"최대 {max}권까지 대출할 수 있습니다"` | 최대 권수 초과 시 안내 |
| `loan_select.next_button_text` | 다음 버튼 텍스트 | **text** (≤20자) | `"다음 단계"` | 다음 단계 이동 버튼 라벨 |
| `loan_select.prev_button_text` | 이전 버튼 텍스트 | **text** (≤20자) | `"이전"` | 이전 단계 이동 버튼 라벨 |
| `loan_select.selected_chip_color` | 선택 칩 색상 | **color** (HEX) | `#BAE6FD` | 선택된 도서 칩 배경색 (현재: sky-100) |

### 3.6 도서 대출 — 확인 화면 (LoanConfirm)

> 화면 ID: `loan-confirm` | 컴포넌트: `KioskLoanConfirm.tsx`

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `loan_confirm.page_title` | 페이지 타이틀 | **text** (≤50자) | `"대출 정보를 확인해주세요"` | 대출 확인 상단 타이틀 |
| `loan_confirm.book_list_label` | 도서 목록 라벨 | **text** (≤30자) | `"대출 도서"` | 도서 목록 섹션 라벨 |
| `loan_confirm.due_date_label` | 반납 예정 라벨 | **text** (≤30자) | `"반납예정"` | 반납 예정일 앞 라벨 |
| `loan_confirm.total_count_label` | 총 권수 라벨 | **text** (≤30자) | `"총 대출 권수"` | 총 대출 권수 라벨 |
| `loan_confirm.due_date_summary_label` | 요약 반납 예정 라벨 | **text** (≤30자) | `"반납 예정일"` | 요약 영역 반납 예정일 라벨 |
| `loan_confirm.execute_button_text` | 대출 실행 버튼 텍스트 | **text** (≤20자) | `"대출하기"` | 대출 실행 버튼 라벨 |
| `loan_confirm.processing_text` | 처리 중 텍스트 | **text** (≤30자) | `"처리 중..."` | 대출 처리 중 안내 |
| `loan_confirm.prev_button_text` | 이전 버튼 텍스트 | **text** (≤20자) | `"이전"` | 이전 버튼 라벨 |

### 3.7 도서 대출 — 완료 화면 (LoanComplete)

> 화면 ID: `loan-complete` | 컴포넌트: `KioskLoanComplete.tsx`

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `loan_complete.success_title` | 성공 타이틀 | **text** (≤50자) | `"대출완료"` | 대출 완료 메인 메시지 |
| `loan_complete.success_color` | 성공 색상 | **color** (HEX) | `#059669` | 성공 타이틀 색상 (현재: emerald-600) |
| `loan_complete.success_icon` | 성공 아이콘 | **image** (SVG, ≤50KB) | `lucide:CheckCircle2` | 완료 체크 아이콘 |
| `loan_complete.available_label` | 대출 가능 라벨 | **text** (≤20자) | `"대출 가능"` | 대출 가능 권수 라벨 |
| `loan_complete.current_label` | 대출 중 라벨 | **text** (≤20자) | `"대출 중"` | 현재 대출 중 라벨 |
| `loan_complete.overdue_label` | 연체 라벨 | **text** (≤20자) | `"연체"` | 연체 권수 라벨 |
| `loan_complete.book_list_label` | 도서 목록 라벨 | **text** (≤30자) | `"대출 도서 목록"` | 대출 도서 목록 라벨 |
| `loan_complete.no_books_text` | 도서 없음 텍스트 | **text** (≤50자) | `"대출 도서가 없습니다"` | 대출 도서 0건 안내 |
| `loan_complete.return_date_prefix` | 반납일 접두사 | **text** (≤20자) | `"반납"` | 반납일 앞 접두사 |
| `loan_complete.confirm_button_text` | 확인 버튼 텍스트 | **text** (≤20자) | `"확인하기"` | 완료 화면 확인 버튼 |

### 3.8 도서 반납 — 도서 투입 화면 (ReturnInsert)

> 화면 ID: `return-insert` | 컴포넌트: `KioskReturnInsert.tsx`

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `return_insert.page_title` | 페이지 타이틀 | **text** (≤50자) | `"도서반납"` | 반납 투입 상단 타이틀 |
| `return_insert.insert_prompt` | 투입 안내 텍스트 | **text** (≤100자) | `"반납할 도서를 하나씩 넣어주세요"` | 도서 투입 안내 문구 |
| `return_insert.insert_sub_prompt` | 투입 보조 안내 | **text** (≤100자) | `"도서를 넣으면 자동으로 인식됩니다"` | 자동 인식 보조 안내 |
| `return_insert.detected_text` | 감지 성공 텍스트 | **text** (≤50자) | `"도서가 감지되었습니다"` | 도서 감지 성공 안내 |
| `return_insert.detected_color` | 감지 성공 색상 | **color** (HEX) | `#34D399` | 감지 성공 텍스트 색상 (현재: emerald-400) |
| `return_insert.no_loans_text` | 반납 도서 없음 텍스트 | **text** (≤100자) | `"반납할 도서가 없습니다"` | 대출 중인 도서가 없을 때 안내 |
| `return_insert.no_loans_sub_text` | 반납 도서 없음 보조 | **text** (≤100자) | `"대출 중인 도서가 없습니다."` | 보조 안내 |
| `return_insert.cancel_text` | 취소 버튼 텍스트 | **text** (≤20자) | `"취소"` | 취소 버튼 라벨 |

### 3.9 도서 반납 — 스캔 화면 (ReturnScanning)

> 화면 ID: `return-scanning` | 컴포넌트: `KioskReturnScanning.tsx`

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `return_scanning.page_title` | 페이지 타이틀 | **text** (≤50자) | `"도서반납"` | 반납 스캔 상단 타이틀 |
| `return_scanning.count_label` | 인식 수 라벨 | **text** (≤30자) | `"인식된 도서"` | 인식된 도서 수 라벨 |
| `return_scanning.scanning_text` | 스캔 중 텍스트 | **text** (≤100자) | `"도서가 인식되었습니다. 잠시 기다려주세요."` | 스캔 진행 중 안내 |
| `return_scanning.scan_complete_text` | 스캔 완료 텍스트 | **text** (≤50자) | `"스캔이 완료되었습니다"` | 스캔 완료 안내 |
| `return_scanning.scan_complete_color` | 스캔 완료 색상 | **color** (HEX) | `#34D399` | 스캔 완료 텍스트 색상 (현재: emerald-400) |
| `return_scanning.more_button_text` | 더 넣기 버튼 텍스트 | **text** (≤30자) | `"더 넣기"` | 추가 반납 버튼 라벨 |
| `return_scanning.complete_button_text` | 반납 완료 버튼 텍스트 | **text** (≤30자) | `"반납 완료하기"` | 반납 완료 버튼 라벨 |
| `return_scanning.scanning_label` | 스캔 중 라벨 | **text** (≤30자) | `"스캔 중..."` | 스캔 중 상태 라벨 |
| `return_scanning.ring_color` | 펄스 링 색상 | **color** (HEX) | `#38BDF8` | 스캔 애니메이션 펄스 링 색상 (현재: sky-400) |

### 3.10 도서 반납 — 확인 화면 (ReturnConfirm)

> 화면 ID: `return-confirm` | 컴포넌트: `KioskReturnConfirm.tsx`

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `return_confirm.page_title` | 페이지 타이틀 | **text** (≤50자) | `"반납 정보를 확인해주세요"` | 반납 확인 상단 타이틀 |
| `return_confirm.book_list_label` | 도서 목록 라벨 | **text** (≤30자) | `"반납 도서"` | 반납 도서 목록 라벨 |
| `return_confirm.loan_date_prefix` | 대출일 접두사 | **text** (≤20자) | `"대출일"` | 대출일 앞 라벨 |
| `return_confirm.due_date_prefix` | 반납예정 접두사 | **text** (≤20자) | `"반납예정"` | 반납예정 앞 라벨 |
| `return_confirm.execute_button_text` | 반납 실행 버튼 텍스트 | **text** (≤20자) | `"반납하기"` | 반납 실행 버튼 라벨 |
| `return_confirm.processing_text` | 처리 중 텍스트 | **text** (≤30자) | `"처리 중..."` | 반납 처리 중 안내 |
| `return_confirm.prev_button_text` | 이전 버튼 텍스트 | **text** (≤20자) | `"이전"` | 이전 버튼 라벨 |

### 3.11 도서 반납 — 완료 화면 (ReturnComplete)

> 화면 ID: `return-complete` | 컴포넌트: `KioskReturnComplete.tsx`

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `return_complete.success_title` | 성공 타이틀 | **text** (≤50자) | `"반납완료"` | 반납 완료 메인 메시지 |
| `return_complete.success_color` | 성공 색상 | **color** (HEX) | `#1E293B` | 성공 타이틀 색상 (현재: slate-800) |
| `return_complete.success_sub_text` | 성공 보조 텍스트 | **text** (≤100자) | `"도서가 정상적으로 반납되었습니다."` | 반납 완료 보조 안내 |
| `return_complete.success_icon` | 성공 아이콘 | **image** (SVG, ≤50KB) | `lucide:CheckCircle2` | 완료 체크 아이콘 |
| `return_complete.book_list_label` | 도서 목록 라벨 | **text** (≤30자) | `"반납 도서"` | 반납 도서 목록 라벨 |
| `return_complete.overdue_warning_text` | 연체 경고 텍스트 | **text** (≤150자) | `"연체된 도서가 포함되어 있습니다. 연체료가 발생할 수 있습니다."` | 연체 포함 시 경고 |
| `return_complete.overdue_warning_color` | 연체 경고 색상 | **color** (HEX) | `#DC2626` | 연체 경고 텍스트 색상 |
| `return_complete.confirm_button_text` | 확인 버튼 텍스트 | **text** (≤20자) | `"확인하기"` | 완료 화면 확인 버튼 |

### 3.12 대출 규칙 (Borrow Rules)

> 화면 ID: N/A (글로벌 설정) | 참조: `src/lib/constants.ts`

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `rules.max_borrow_count` | 최대 대출 권수 | **number** (1~20) | `2` | 1인당 동시 대출 가능 권수 (현재: MAX_LOAN_COUNT=2) |
| `rules.borrow_period_days` | 대출 기간 | **number** (1~90) | `15` | 대출 기간 일 단위 (현재: LOAN_PERIOD_DAYS=15) |
| `rules.overdue_penalty_multiplier` | 연체 배수 | **number** (1.0~5.0) | `1.0` | 연체 1일당 대출 제한 일수 배수 (현재: OVERDUE_BLOCK_MULTIPLIER=1) |
| `rules.overdue_enabled` | 연체 페널티 활성화 | **boolean** | `true` | 연체 페널티 적용 여부 |
| `rules.extension_enabled` | 연장 기능 활성화 | **boolean** | `false` | 대출 연장 허용 여부 (현재: 불가) |

### 3.13 TTS 음성 안내 스크립트

> 화면 ID: N/A (글로벌 설정) | 참조: `src/lib/tts.ts`

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `tts.enabled` | TTS 활성화 | **boolean** | `true` | 전체 TTS 기능 활성화 여부 |
| `tts.lang` | 음성 언어 | **text** (≤10자) | `"ko-KR"` | 음성 출력 언어 코드 |
| `tts.rate` | 음성 속도 | **number** (0.5~2.0) | `0.85` | 음성 재생 속도 (시니어 친화적 느린 속도) |
| `tts.pitch` | 음성 피치 | **number** (0.5~2.0) | `1.0` | 음성 피치 |
| `tts.volume` | 음성 볼륨 | **number** (0~1.0) | `1.0` | 음성 볼륨 |
| `tts.idle_script` | 대기 화면 스크립트 | **text** (≤200자) | `"화면을 터치하여 시작하세요"` | 대기 화면 음성 안내 |
| `tts.menu_script` | 메인 메뉴 스크립트 | **text** (≤200자) | `"대출 또는 반납을 선택하세요"` | 메인 메뉴 음성 안내 |
| `tts.auth_scan_script` | 인증 스캔 스크립트 | **text** (≤200자) | `"회원증을 리더기에 대주세요"` | RFID 인증 음성 안내 |
| `tts.auth_pin_script` | PIN 입력 스크립트 | **text** (≤200자) | `"비밀번호 4자리를 입력해주세요"` | PIN 입력 음성 안내 |
| `tts.loan_select_script` | 도서 선택 스크립트 | **text** (≤200자) | `"대출할 도서를 선택하세요"` | 도서 선택 음성 안내 |
| `tts.loan_complete_script` | 대출 완료 스크립트 | **text** (≤200자) | `"대출이 완료되었습니다"` | 대출 완료 음성 안내 |
| `tts.return_insert_script` | 반납 투입 스크립트 | **text** (≤200자) | `"반납할 도서를 넣어주세요"` | 반납 투입 음성 안내 |
| `tts.return_complete_script` | 반납 완료 스크립트 | **text** (≤200자) | `"반납이 완료되었습니다"` | 반납 완료 음성 안내 |

### 3.14 공통 UI 요소

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `common.cancel_button_text` | 취소 버튼 텍스트 | **text** (≤20자) | `"취소"` | 전역 취소 버튼 라벨 |
| `common.confirm_button_text` | 확인 버튼 텍스트 | **text** (≤20자) | `"확인"` | 전역 확인 버튼 라벨 |
| `common.error_network_text` | 네트워크 오류 메시지 | **text** (≤150자) | `"네트워크 오류가 발생했습니다. 다시 시도해주세요."` | 네트워크 오류 안내 |
| `common.error_default_text` | 기본 오류 메시지 | **text** (≤150자) | `"오류가 발생했습니다. 다시 시도해주세요."` | 기본 오류 안내 |
| `common.dark_bg_color` | 다크 화면 배경색 | **color** (HEX) | `#0B1120` | 다크 테마 화면 배경색 (kiosk-dark-bg) |
| `common.light_bg_color` | 라이트 화면 배경색 | **color** (HEX) | `#F8FAFC` | 라이트 테마 화면 배경색 (kiosk-light-bg) |
| `common.maintenance_text` | 유지보수 안내 텍스트 | **text** (≤200자) | `"시스템 점검 중입니다. 잠시 후 이용해주세요."` | 유지보수 모드 안내 |
| `common.maintenance_bg_color` | 유지보수 배경색 | **color** (HEX) | `#1E293B` | 유지보수 화면 배경색 |

---

## 4. RBAC 요구사항

### 4.1 역할 정의

| 역할 | 코드 | 설명 | 계정 수 제한 |
|------|------|------|-------------|
| **슈퍼 관리자** | `super_admin` | 시스템 전체 권한. 다른 관리자 계정 생성·권한 부여·시스템 설정 변경 가능 | 1~3명 |
| **관리자** | `admin` | CMS 콘텐츠·도서·사용자 관리 + 통계 조회 + 공지 관리. 계정 관리 불가 | 제한 없음 |
| **운영자** | `operator` | 도서·사용자 조회(읽기 전용) + 대출·반납 통계 조회 + 공지 조회. 콘텐츠 변경 불가 | 제한 없음 |

### 4.2 권한 매핑 매트릭스

| 기능 영역 | 세부 기능 | super_admin | admin | operator |
|-----------|-----------|:-----------:|:-----:|:--------:|
| **CMS 콘텐츠** | 텍스트 읽기 | ✅ | ✅ | ✅ |
| | 텍스트 쓰기 | ✅ | ✅ | ❌ |
| | 이미지 업로드/교체 | ✅ | ✅ | ❌ |
| | 색상 변경 | ✅ | ✅ | ❌ |
| | 대출 규칙 변경 | ✅ | ✅ | ❌ |
| | TTS 스크립트 변경 | ✅ | ✅ | ❌ |
| | 공통 UI 텍스트 변경 | ✅ | ✅ | ❌ |
| **도서 관리** | 도서 목록 조회 | ✅ | ✅ | ✅ |
| | 도서 등록 | ✅ | ✅ | ❌ |
| | 도서 수정 | ✅ | ✅ | ❌ |
| | 도서 삭제 | ✅ | ✅ | ❌ |
| | 도서 CSV 가져오기 | ✅ | ✅ | ❌ |
| **사용자 관리** | 사용자 목록 조회 | ✅ | ✅ | ✅ |
| | 사용자 등록 | ✅ | ✅ | ❌ |
| | 사용자 수정 | ✅ | ✅ | ❌ |
| | 사용자 비활성화 | ✅ | ✅ | ❌ |
| | 사용자 CSV 가져오기 | ✅ | ✅ | ❌ |
| **대출/반납** | 대출·반납 로그 조회 | ✅ | ✅ | ✅ |
| | 대출·반납 통계 | ✅ | ✅ | ✅ |
| **대시보드** | 오늘의 현황 | ✅ | ✅ | ✅ |
| | 시간대별 그래프 | ✅ | ✅ | ✅ |
| | 인기 도서 TOP 10 | ✅ | ✅ | ✅ |
| | 통계 CSV 내보내기 | ✅ | ✅ | ❌ |
| **계정 관리** | 관리자 계정 조회 | ✅ | ❌ | ❌ |
| | 관리자 계정 생성 | ✅ | ❌ | ❌ |
| | 관리자 계정 권한 변경 | ✅ | ❌ | ❌ |
| | 관리자 계정 비활성화 | ✅ | ❌ | ❌ |
| **감사 로그** | 감사 로그 조회 | ✅ | ✅ | ❌ |
| | 감사 로그 내보내기 | ✅ | ❌ | ❌ |
| **공지 관리** | 공지 조회 | ✅ | ✅ | ✅ |
| | 공지 등록·수정·삭제 | ✅ | ✅ | ❌ |
| **시스템 설정** | DB 백업 | ✅ | ❌ | ❌ |
| | DB 복원 | ✅ | ❌ | ❌ |
| | 시스템 초기화 | ✅ | ❌ | ❌ |
| | 키오스크 원격 제어 | ✅ | ❌ | ❌ |
| | 유지보수 모드 토글 | ✅ | ❌ | ❌ |
| **알림** | 알림 목록 조회 | ✅ | ✅ | ✅ |
| | 알림 읽음 처리 | ✅ | ✅ | ✅ |
| | 알림 설정 변경 | ✅ | ✅ | ❌ |

### 4.3 인증·인가 흐름

```
┌─────────┐   POST /api/auth/login    ┌──────────────┐
│  Login   │ ──────────────────────►  │  Verify Cred │
│  Page    │ ◄──────────────────────  │  Issue JWT   │
└─────────┘   {accessToken,           └──────────────┘
                refreshToken}
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Every API Request                                                  │
│  Authorization: Bearer <accessToken>                                │
│  → Middleware: verify JWT → extract role → check                    │
│    permission against RBAC table → allow/deny 403                   │
└─────────────────────────────────────────────────────────────────────┘
```

| 항목 | 값 | 설명 |
|------|-----|------|
| Access Token 수명 | 15분 | 짧은 수명으로 탈취 리스크 최소화 |
| Refresh Token 수명 | 7일 | 자동 로그인 유지 기간 |
| 비활동 로그아웃 | 30분 | 마지막 활동 후 30분 경과 시 자동 로그아웃 |
| 비밀번호 정책 | 8자 이상, 대소문자+숫자+특수문자 포함 | zod 스키마 검증 |
| 로그인 실패 잠금 | 5회 연속 실패 시 15분 잠금 | brute-force 방지 |
| PIN 저장 | bcrypt (cost=12) | 평문 절대 저장 금지 |
| 세션 저장 | SQLite `Session` 테이블 | 서버 재시작 시에도 세션 유지 |

---

## 5. 실시간 동기화 요구사항

### 5.1 아키텍처 개요

```
┌──────────────────┐        SSE Connection         ┌──────────────────┐
│  Admin Dashboard  │ ──── POST /api/cms/save ────► │  Next.js Server  │
│  (Port 3001)     │                                │  (Port 3000)     │
└──────────────────┘                                └────────┬─────────┘
                                                             │
                                                    ┌────────▼─────────┐
                                                    │  SQLite DB       │
                                                    │  CmsContent      │
                                                    └────────┬─────────┘
                                                             │
                                             ┌───────────────┼───────────────┐
                                             │ SSE: cms:updated              │
                                             ▼                               ▼
                                    ┌──────────────┐               ┌──────────────┐
                                    │ Kiosk #1     │               │ Kiosk #N     │
                                    │ (Polling/SSE)│               │ (Polling/SSE)│
                                    └──────────────┘               └──────────────┘
```

### 5.2 동기화 방식 상세

| 항목 | 요구사항 | 구현 방식 |
|------|----------|-----------|
| **1차 방식** | Server-Sent Events (SSE) | `/api/cms/events` 엔드포인트, `EventSource` API |
| **폴백 방식** | Short Polling (3초 간격) | SSE 미지원 브라우저/환경에서 자동 전환 |
| **반영 지연** | CMS 저장 후 **≤3초** 내 키오스크 화면에 반영 | 서버 → DB 저장 → SSE 브로드캐스트 → 클라이언트 수신 → Zustand 업데이트 |
| **이벤트 타입** | `cms:updated` | 변경된 key 목록을 payload에 포함 |
| **동시 편집 충돌** | Last-Write-Wins + 충돌 알림 토스트 | 저장 시 `updatedAt` 비교, 충돌 시 경고 토스트 |
| **연결 끊김** | 자동 재연결 (지수 백오프, 최대 5회) | `EventSource` error 이벤트 → 1s, 2s, 4s, 8s, 16s 후 재연결 |
| **연결 상태** | 실시간 연결 상태 인디케이터 | 🟢 연결됨 / 🟡 재연결 중 / 🔴 연결 끊김 |
| **변경 브로드캐스트** | 서버 → 연결된 모든 키오스크 클라이언트 | 서버 측 클라이언트 목록 관리 |
| **초기 동기화** | 키오스크 시작 시 전체 CMS 콘텐츠 일괄 조회 | `GET /api/cms/bulk` → Zustand hydration |
| **부분 업데이트** | 변경된 key만 전송 | payload: `{ keys: ["idle.title_text", "menu.borrow_button_text"], timestamp: "..." }` |

### 5.3 키오스크 프론트엔드 연동 패턴

```typescript
// 키오스크 프론트엔드 — CMS 콘텐츠 구독 훅
function useCmsContent(key: string, defaultValue: string) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    // 1. 초기값 로드
    fetch(`/api/cms/content/${key}`).then(r => r.json()).then(d => setValue(d.value));

    // 2. SSE 구독
    const es = new EventSource('/api/cms/events');
    es.addEventListener('cms:updated', (e) => {
      const { keys } = JSON.parse(e.data);
      if (keys.includes(key)) {
        fetch(`/api/cms/content/${key}`).then(r => r.json()).then(d => setValue(d.value));
      }
    });

    return () => es.close();
  }, [key]);

  return value;
}
```

### 5.4 수용 기준

| ID | 기준 | 측정 방법 |
|----|------|-----------|
| SYNC-01 | CMS 저장 후 3초 이내 키오스크 화면 반영 | 타임스탬프 비교 (서버 저장 시각 vs 클라이언트 수신 시각) |
| SYNC-02 | SSE 연결 끊김 후 30초 이내 자동 복구 | 네트워크 단절 시나리오 테스트 |
| SYNC-03 | 동시 편집 시 충돌 알림 표시 | 2개 브라우저에서 동일 항목 동시 편집 |
| SYNC-04 | 키오스크 시작 후 5초 이내 전체 CMS 로드 완료 | 초기 로드 시간 측정 |
| SYNC-05 | 폴링 폴백 시 6초 이내 변경 반영 | SSE 비활성화 환경에서 측정 |

---

## 6. 반응형 디자인 요구사항

### 6.1 브레이크포인트 정의

| 명칭 | 대상 기기 | 해상도 | 방향 | 레이아웃 전략 |
|------|-----------|--------|------|---------------|
| **kiosk-xl** | 24″ 키오스크 터치스크린 | 1920×1080 | 가로 (landscape) | 3-column grid (사이드바 240px + 메인 + 미리보기 320px) |
| **kiosk-lg** | 21″ 키오스크 터치스크린 | 1920×1080 | 가로 (landscape) | 3-column grid (kiosk-xl과 동일, 폰트 살짝 축소) |
| **tablet** | 10″ 태블릿 | 768×1024 | 세로 (portrait) | 2-column grid (사이드바 접힘 + 메인 전체) |
| **mobile** | 스마트폰 | 375×667 | 세로 (portrait) | 1-column stack (햄버거 메뉴 + 풀스크린 편집) |

### 6.2 Tailwind CSS 브레이크포인트 매핑

```typescript
// tailwind.config.ts
export default {
  theme: {
    screens: {
      'mobile':  '375px',   // 스마트폰
      'tablet':  '768px',   // 태블릿
      'kiosk-lg': '1280px', // 21″ 키오스크 (최소)
      'kiosk-xl': '1920px', // 24″ 키오스크
    },
  },
}
```

### 6.3 반응형 UI 동작 상세

| UI 요소 | kiosk-xl/lg (≥1280px) | tablet (768~1279px) | mobile (≤767px) |
|---------|------------------------|----------------------|------------------|
| **사이드바** | 240px 고정 노출 | 64px 아이콘 전용 (hover 확장) | 햄버거 메뉴 (슬라이드 오버레이) |
| **콘텐츠 영역** | 3-column CSS Grid | 2-column CSS Grid | 1-column flex stack |
| **미리보기 패널** | 우측 320px 고정 | 하단 280px 접히식 | 모달 오버레이 |
| **데이터 테이블** | 전체 컬럼 노출 | 주요 컬럼 5개 + 더보기 | 카드 리스트 뷰로 전환 |
| **컬러 피커** | 인라인 팝오버 | 인라인 팝오버 | 전체화면 모달 |
| **이미지 업로드** | 드래그앤드롭 영역 | 드래그앤드롭 영역 | 카메라+파일 선택 버튼 |
| **통계 그래프** | 800×400 영역 | 100% 너비 × 300px | 100% 너비 × 200px |
| **버튼 크기** | 기본 (h-10) | 기본 (h-10) | 확대 (h-12, 터치 영역 확보) |
| **폰트 크기** | 기본 | 기본 | 1.1배 확대 |
| **모달/다이얼로그** | 중앙 오버레이 | 중앙 오버레이 | 풀스크린 바텀시트 |
| **토스트 알림** | 우측 상단 | 우측 상단 | 하단 중앙 |

### 6.4 키오스크 터치스크린 특화 요구사항

| 항목 | 요구사항 | 이유 |
|------|----------|------|
| 최소 터치 영역 | 44×44px | WCAG 2.5.5 Target Size |
| 버튼 간격 | 최소 8px | 오타 터치 방지 |
| 더블 탭 줌 | 비활성화 | 키오스크에서 핀치줌 불필요 |
| 커서 숨김 | 키오스크 모드에서 커서 none | 터치스크린에서 마우스 커서 불필요 |
| 스크롤 바 | 커스텀 thin 스크롤바 | 기본 스크롤바가 터치를 방해 |
| 폰트 렌더링 | font-smoothing: antialiased | 저해상도 키오스크 화면 가독성 |

### 6.5 수용 기준

| ID | 기준 | 검증 방법 |
|----|------|-----------|
| RWD-01 | 4개 브레이크포인트에서 레이아웃 깨짐 없음 | BrowserStack 시각적 회귀 테스트 |
| RWD-02 | 모든 인터랙티브 요소가 각 크기에서 조작 가능 | 수동 QA + 자동화 E2E |
| RWD-03 | 키오스크 21″/24″에서 터치 조작 가능 | 실기 테스트 |
| RWD-04 | 모바일에서 사이드바가 햄버거 메뉴로 전환 | Chrome DevTools 반응형 모드 |
| RWD-05 | 데이터 테이블이 모바일에서 카드 뷰로 전환 | 375px 뷰포트 확인 |

---

## 7. 비기능 요구사항

### 7.1 보안

| ID | 항목 | 요구사항 | 구현 방식 |
|----|------|----------|-----------|
| SEC-01 | HTTPS | 로컬 개발 외 반드시 TLS (Self-signed 허용) | Caddy 리버스 프록시 |
| SEC-02 | CORS | 대시보드 Origin만 허용 (`localhost:3001`) | Next.js 미들웨어 |
| SEC-03 | Rate Limiting | API 엔드포인트당 100회/분, 인증 10회/분 | Express rate-limit 미들웨어 |
| SEC-04 | 입력 검증 | Zod 스키마로 모든 입력 검증 | text 길이, color HEX, image MIME, number 범위 |
| SEC-05 | XSS | React 기본 이스케이프 + 이미지 URL 화이트리스트 | DOMPurify |
| SEC-06 | CSRF | SameSite 쿠키 + Double Submit Cookie | Next.js 쿠키 설정 |
| SEC-07 | 비밀번호 저장 | bcrypt (cost=12) | never store plaintext |
| SEC-08 | 이미지 업로드 보안 | MIME 검증 + 크기 제한 + SVG sanitize | sharp + DOMPurify |
| SEC-09 | 감사 로그 | 모든 쓰기 작업을 `AuditLog` 테이블에 기록 | Prisma 미들웨어 훅 |
| SEC-10 | 세션 하이재킹 방지 | Token rotation + IP/UA 바인딩 | Refresh Token 갱신 시 새 AT 발급 |

### 7.2 접근성 (A11Y)

| ID | 항목 | 요구사항 |
|----|------|----------|
| A11Y-01 | 표준 | WCAG 2.1 Level AA 준수 |
| A11Y-02 | 키보드 내비게이션 | 모든 인터랙티브 요소 Tab 포커스 가능, Escape 모달 닫기 |
| A11Y-03 | 스크린 리더 | ARIA 라벨·역할 부여, 상태 변경 알림 (aria-live) |
| A11Y-04 | 색 대비 | 텍스트 4.5:1 이상, 대형 텍스트 3:1 이상 |
| A11Y-05 | 포커스 인디케이터 | 2px solid outline, 커서 사용 시 숨김 가능 |
| A11Y-06 | 모션 감소 | `prefers-reduced-motion` 존중 |

### 7.3 성능

| ID | 항목 | 요구사항 | 측정 기준 |
|----|------|----------|-----------|
| PERF-01 | 초기 로드 | LCP ≤ 2초 (로컬 네트워크) | Lighthouse |
| PERF-02 | TTI | TTI ≤ 3초 | Lighthouse |
| PERF-03 | 번들 크기 | First Load JS ≤ 200KB (gzip) | Next.js 빌드 분석 |
| PERF-04 | 이미지 최적화 | Next.js `<Image>` 자동 WebP 변환, 반응형 srcset | 네트워크 탭 확인 |
| PERF-05 | DB 쿼리 | 목록 조회 ≤ 100ms (10,000건 기준) | Prisma 쿼리 로그 |
| PERF-06 | CMS 반영 | 저장→반영 ≤ 3초 | E2E 타임스탬프 측정 |
| PERF-07 | 대시보드 로드 | 통계 데이터 로드 ≤ 1초 | Performance API |

### 7.4 신뢰성

| ID | 항목 | 요구사항 |
|----|------|----------|
| REL-01 | 가용성 | 단일 보드 환경에서 99.5% 가용성 (월 3.6시간 다운타임 허용) |
| REL-02 | 데이터 무결성 | SQLite WAL 모드로 크래시 복구 보장 |
| REL-03 | 백업 | 일일 자동 백업 + 수동 백업 지원 |
| REL-04 | 에러 복구 | API 오류 시 사용자 친화적 에러 메시지 + 자동 재시도 옵션 |
| REL-05 | 그레이스풀 디그레이션 | SSE 불가 시 폴링으로 자동 전환, DB 잠금 시 읽기 전용 모드 |

---

## 8. 사용자 스토리

### 8.1 슈퍼 관리자 (super_admin)

| ID | 스토리 | 수용 기준 |
|----|--------|-----------|
| US-SA-01 | 슈퍼 관리자로서, 새 관리자 계정을 생성하여 팀원에게 대시보드 접근 권한을 부여하고 싶다. | 이메일·역할 입력 → 계정 생성 → 임시 비밀번호 표시 (P2: 초대 이메일 발송) |
| US-SA-02 | 슈퍼 관리자로서, 관리자의 역할을 변경하여 권한을 조정하고 싶다. | 역할 드롭다운 변경 → 즉시 권한 반영 → 감사 로그 기록 → 기존 세션 무효화 |
| US-SA-03 | 슈퍼 관리자로서, 감사 로그를 조회하여 누가 언제 어떤 변경을 했는지 추적하고 싶다. | 필터(기간·작업자·항목·액션유형) → 변경 전후값(diff) 하이라이트 표시 |
| US-SA-04 | 슈퍼 관리자로서, DB를 백업하여 데이터 손실에 대비하고 싶다. | 백업 버튼 → SQLite 파일 다운로드 (타임스탬프 파일명) → 복원 기능 (복원 전 자동 백업) |
| US-SA-05 | 슈퍼 관리자로서, 키오스크를 원격으로 유지보수 모드로 전환하여 점검 작업을 수행하고 싶다. | 유지보수 모드 토글 → 확인 다이얼로그 → 키오스크에 즉시 반영 → 감사 로그 기록 |
| US-SA-06 | 슈퍼 관리자로서, 시스템 상태를 모니터링하여 이상을 조기 감지하고 싶다. | 가동 시간, API 응답 시간, DB 크기, 에러율 실시간 표시 → 임계치 초과 시 경고 |

### 8.2 관리자 (admin)

| ID | 스토리 | 수용 기준 |
|----|--------|-----------|
| US-AD-01 | 관리자로서, 대기 화면의 로고와 타이틀을 변경하여 도서관 브랜딩을 커스터마이징하고 싶다. | 이미지 업로드 + 텍스트 편집 → 실시간 미리보기 → 저장 → 3초 내 키오스크 반영 |
| US-AD-02 | 관리자로서, 대출·반납 버튼의 색상과 아이콘을 변경하여 시각적 일관성을 유지하고 싶다. | 컬러 피커 + 아이콘 SVG 업로드 → 실시간 미리보기 → 저장 |
| US-AD-03 | 관리자로서, 대출 규칙(최대 권수, 기간, 연체 배수)을 조정하여 도서관 정책 변경을 반영하고 싶다. | 슬라이더/숫자 입력 → 유효범위 검증 → 즉시 규칙 반영 → 감사 로그 기록 |
| US-AD-04 | 관리자로서, 새 도서를 등록하여 대출 가능 목록에 추가하고 싶다. | 도서 정보 입력 + 표지 이미지 업로드 → ISBN 중복 검증 → 저장 → 목록에 즉시 표시 |
| US-AD-05 | 관리자로서, 도서를 CSV로 일괄 등록하여 대량 등록 시간을 단축하고 싶다. | CSV 업로드 → 건별 유효성 검증 → 성공/실패 결과 리포트 → 건별 오류 표시 |
| US-AD-06 | 관리자로서, 오늘의 대출·반납 현황을 한눈에 파악하여 운영 상태를 모니터링하고 싶다. | 대시보드 진입 → 4개 지표 카드 + 그래프 + TOP 10 + 최근 로그 |
| US-AD-07 | 관리자로서, CMS 변경 전 화면 미리보기로 실제 적용 모습을 확인하고 싶다. | 미리보기 토글 → 4개 뷰포트 탭(21″/24″/태블릿/모바일) → 확인 후 저장 |
| US-AD-08 | 관리자로서, 공지사항을 등록하여 키오스크 대기 화면에 안내 문구를 표시하고 싶다. | 공지 텍스트 + 시작/종료 일시 → 우선순위 설정 → 저장 → 대기 화면 반영 |
| US-AD-09 | 관리자로서, TTS 음성 안내 스크립트를 수정하여 시니어 이용자에게 적절한 안내를 제공하고 싶다. | 화면별 스크립트 편집 → 속도/피치 조절 → 저장 → 즉시 반영 |
| US-AD-10 | 관리자로서, 연체 도서 및 시스템 에러 알림을 확인하여 신속히 대응하고 싶다. | 알림 배지 클릭 → 알림 목록 → 알림 유형별 필터 → 읽음 처리 |

### 8.3 운영자 (operator)

| ID | 스토리 | 수용 기준 |
|----|--------|-----------|
| US-OP-01 | 운영자로서, 도서 목록을 조회하여 대출 가능 상태를 확인하고 싶다. | 검색 + 카테고리 필터 + 페이지네이션 → 읽기 전용 (편집 버튼 숨김) |
| US-OP-02 | 운영자로서, 사용자 목록을 조회하여 이용자 정보를 확인하고 싶다. | 검색 + 상태 필터 → 읽기 전용 (PIN 마스킹: `****`) |
| US-OP-03 | 운영자로서, 오늘의 대출·반납 통계를 조회하여 현황을 파악하고 싶다. | 대시보드 진입 → 4개 지표 카드 + 그래프 (읽기 전용) |
| US-OP-04 | 운영자로서, 공지사항을 확인하여 현재 안내 문구를 파악하고 싶다. | 공지 목록 조회 → 읽기 전용 (등록/수정/삭제 불가) |
| US-OP-05 | 운영자로서, CMS 콘텐츠의 현재 값을 확인하여 키오스크에 표시되는 내용을 파악하고 싶다. | CMS 항목 목록 → 값 조회 → 읽기 전용 (편집 불가) |

---

## 9. 데이터 요구사항

### 9.1 Prisma 스키마 (1차 릴리스)

```prisma
// prisma/schema.prisma — 백엔드 관리자 대시보드

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ============================================================================
// 관리자 계정
// ============================================================================

model AdminUser {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  name         String
  role         String    // "super_admin" | "admin" | "operator"
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  loginFailCount Int     @default(0)
  lockedUntil  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  sessions     Session[]
  auditLogs    AuditLog[]
}

model Session {
  id           String    @id @default(uuid())
  userId       String
  refreshToken String    @unique
  userAgent    String?
  ipAddress    String?
  expiresAt    DateTime
  createdAt    DateTime  @default(now())

  user         AdminUser @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ============================================================================
// CMS 콘텐츠
// ============================================================================

model CmsContent {
  id         String   @id @default(uuid())
  key        String   @unique  // e.g. "idle.title_text"
  type       String            // "text" | "image" | "color" | "number" | "boolean" | "json"
  value      String            // 값 (이미지는 URL, 색상은 HEX, 숫자는 String 캐스트)
  group      String            // 화면 그룹: "idle" | "menu" | "auth_scan" | ... | "rules" | "tts" | "common"
  label      String            // 관리자 UI 표시용 한글 라벨
  sortOrder  Int      @default(0)
  updatedAt  DateTime @updatedAt
  updatedBy  String?           // AdminUser.id

  revisions  CmsRevision[]
}

model CmsRevision {
  id         String     @id @default(uuid())
  contentId  String
  oldValue   String?
  newValue   String?
  updatedBy  String
  updatedAt  DateTime   @default(now())

  content    CmsContent @relation(fields: [contentId], references: [id], onDelete: Cascade)
}

// ============================================================================
// 도서관 이용자 (기존 SimUser와 동일 구조, 관리자 대시보드에서 관리)
// ============================================================================

model LibraryUser {
  id           String    @id @default(uuid())
  name         String
  rfid         String    @unique
  pinHash      String
  phone        String?
  email        String?
  borrowCount  Int       @default(0)
  overdueCount Int       @default(0)
  status       String    @default("ACTIVE") // ACTIVE | SUSPENDED | WITHDRAWN
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  loans        BorrowRecord[]
}

// ============================================================================
// 도서 (기존 Book과 동일 구조, 관리자 대시보드에서 관리)
// ============================================================================

model Book {
  id              String    @id @default(uuid())
  isbn            String    @unique
  title           String
  author          String
  publisher       String?
  publishYear     Int?
  category        String?
  coverUrl        String?
  totalCopies     Int       @default(3)
  availableCopies Int       @default(3)
  shelfLocation   String?
  status          String    @default("AVAILABLE") // AVAILABLE | BORROWED | LOST | REPAIR
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  loans           BorrowRecord[]
}

// ============================================================================
// 대출/반납 기록
// ============================================================================

model BorrowRecord {
  id          String    @id @default(uuid())
  userId      String
  bookId      String
  type        String             // "BORROW" | "RETURN"
  borrowedAt  DateTime
  dueDate     DateTime?
  returnedAt  DateTime?
  isOverdue   Boolean   @default(false)
  method      String?   @default("kiosk") // "kiosk" | "counter"
  createdAt   DateTime  @default(now())

  user        LibraryUser @relation(fields: [userId], references: [id])
  book        Book        @relation(fields: [bookId], references: [id])
}

// ============================================================================
// 감사 로그
// ============================================================================

model AuditLog {
  id          String   @id @default(uuid())
  action      String            // "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "ROLE_CHANGE"
  entity      String            // "CmsContent" | "Book" | "LibraryUser" | "AdminUser" | "Notice"
  entityId    String?
  oldValue    String?           // JSON 직렬화
  newValue    String?           // JSON 직렬화
  performedBy String           // AdminUser.id
  performedAt DateTime @default(now())
  ipAddress   String?
  userAgent   String?
}

// ============================================================================
// 공지사항
// ============================================================================

model Notice {
  id        String   @id @default(uuid())
  title     String
  content   String
  priority  Int      @default(0)   // 높을수록 우선 표시
  startAt   DateTime
  endAt     DateTime
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ============================================================================
// 알림
// ============================================================================

model Notification {
  id         String   @id @default(uuid())
  type       String            // "OVERDUE" | "SYSTEM_ERROR" | "LOW_STOCK" | "INFO"
  title      String
  message    String
  isRead     Boolean  @default(false)
  relatedId  String?           // 관련 엔티티 ID (도서 ID, 사용자 ID 등)
  createdAt  DateTime @default(now())
}

// ============================================================================
// 키오스크 단말 (P2 다중 키오스크 지원 대비)
// ============================================================================

model KioskUnit {
  id          String   @id @default(uuid())
  name        String            // e.g. "1층 로비 A"
  location    String?
  status      String   @default("ONLINE") // ONLINE | OFFLINE | MAINTENANCE
  lastPingAt  DateTime?
  cmsProfile  String?           // 단말별 CMS 프로파일 ID (P2)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 9.2 시드 데이터

| 항목 | 수량 | 설명 |
|------|------|------|
| 관리자 계정 | 3명 | super_admin 1명, admin 1명, operator 1명 |
| CMS 콘텐츠 | ~120건 | 11개 화면 × 평균 10항목 + 규칙 + TTS + 공통 |
| 데모 이용자 | 1명 | 김도서관, PIN 1234 |
| 도서 | 15권 | 한국 도서 15종 (ISBN, 표지 URL 포함) |
| 카테고리 | 5개 | 소설, 인문, 과학, 역사, 시 |
| 공지사항 | 1건 | 환영 공지 (비활성 상태) |

### 9.3 데이터 용량 제한

| 항목 | 제한 | 근거 |
|------|------|------|
| 최대 도서 수 | 10,000권 | SQLite 인덱스 성능 한계 |
| 최대 이용자 수 | 5,000명 | SQLite 인덱스 성능 한계 |
| 최대 관리자 계정 | 50명 | 실제 운영 환경 충분 |
| 이미지 총 용량 | 500MB | 로컬 디스크 제한 |
| CMS 콘텐츠 항목 | 200개 | 11화면 × 15항목 + 규칙 + TTS 여유분 |
| 감사 로그 보관 | 최근 10만건 | SQLite 파일 크기 관리 |
| 개별 이미지 크기 | SVG 50KB, PNG/JPG 2MB | 업로드 제한 |

---

## 10. 제약 사항

| ID | 제약 | 이유 | 대응 전략 |
|----|------|------|-----------|
| C-01 | **SQLite 단일 파일 DB** | 로컬 보드 단독 동작, 외부 DB 서버 불가 | WAL 모드로 동시 읽기 성능 확보, 쓰기 직렬화 |
| C-02 | **Node.js 단일 프로세스** | 키오스크 임베디드 보드 리소스 제한 | Next.js 16 서버 컴포넌트 + 스트리밍 SSR |
| C-03 | **로컬 스토리지 이미지** | 외부 CDN/스토리지 사용 불가 | `/public/uploads/` 디렉토리 + Next.js 정적 서빙 + Sharp 압축 |
| C-04 | **최대 도서 10,000권** | SQLite 성능 한계 | 복합 인덱스 + 커서 기반 페이지네이션 (50건/페이지) |
| C-05 | **최대 이용자 5,000명** | SQLite 성능 한계 | 복합 인덱스 + 커서 기반 페이지네이션 (50건/페이지) |
| C-06 | **이미지 총 용량 ≤ 500MB** | 로컬 디스크 제한 | Sharp 자동 압축 + 미사용 이미지 정리 스케줄러 |
| C-07 | **Next.js 16 App Router 전용** | Pages Router 혼용 금지 | 모든 라우트 `app/` 디렉토리 내 |
| C-08 | **Prisma ORM 전용** | Raw SQL 금지 (감사·마이그레이션 추적) | schema.prisma로 모든 쿼리 정의 |
| C-09 | **한국어 기본 로케일** | 1차 릴리스 한국어 전용 | P2에서 i18n 다국어 지원 |
| C-10 | **단일 키오스크 연결** | 1차 릴리스 1대 키오스크만 | KioskUnit 모델은 P2 대비 준비, 1차는 단일 인스턴스 |
| C-11 | **ECO 화면 일치성** | 실제 제품과 동일한 화면 구성·플로우 유지 | CMS는 텍스트·색상만 변경, 화면 구조(버튼 수, 플로우 순서)는 변경 불가 |
| C-12 | **대출 연장 불가** | ECO 실제 기기 정책 | `rules.extension_enabled` 기본값 false, API 400 반환 |
| C-13 | **최대 대출 2권** | ECO 실제 기기 정책 | `rules.max_borrow_count` 기본값 2, UI에서 3권 이상 선택 차단 |
| C-14 | **세로 화면 기준** | 키오스크 하드웨어가 세로 방향 | 프론트엔드: 768×1024 기준, 대시보드: 가로·세로 모두 대응 |

---

## 11. 마일스톤

### 11.1 Phase 1 — MVP (P0, v1.0) : 16주

| 주차 | 기간 | 산출물 | 상태 |
|------|------|--------|------|
| W1~W2 | Phase 1-1 | **프로젝트 스캐폴딩**: Next.js 16 + Tailwind 4 + Prisma + SQLite 스키마 정의 + AdminUser/CmsContent 모델 | |
| W3~W4 | Phase 1-2 | **인증 시스템**: 로그인/로그아웃 UI, JWT 발급·갱신, RBAC 미들웨어, 세션 관리 | |
| W5~W6 | Phase 1-3 | **CMS 편집 UI (텍스트·색상)**: 11개 화면별 텍스트·색상 편집 폼, 컬러 피커, 인라인 편집 | |
| W7~W8 | Phase 1-4 | **CMS 편집 UI (이미지·규칙)**: 이미지 업로드·교체·삭제 + SVG 아이콘 관리 + 대출 규칙 설정 슬라이더 | |
| W9~W10 | Phase 1-5 | **도서 CRUD + 사용자 CRUD**: 데이터 테이블 뷰 + 검색·필터 + 페이지네이션 + 표지 이미지 업로드 | |
| W11~W12 | Phase 1-6 | **대시보드 통계**: 오늘 현황 카드, 시간대별 그래프, 인기 도서 TOP 10, 최근 활동 로그 | |
| W13~W14 | Phase 1-7 | **실시간 동기화**: SSE 서버 + 키오스크 클라이언트 EventSource + 폴링 폴백 + 연결 상태 인디케이터 | |
| W15~W16 | Phase 1-8 | **반응형 레이아웃 + QA**: 태블릿·모바일 대응, 키오스크 터치 최적화, 통합 QA + 버그 수정 | |

**Phase 1 인수 기준**:

- [ ] 모든 P0 기능 ID가 수용 기준을 충족
- [ ] 4개 브레이크포인트에서 레이아웃 깨짐 없음 (RWD-01~05)
- [ ] CMS 변경 후 3초 이내 키오스크 반영 확인 (SYNC-01)
- [ ] RBAC: 각 역할별 허용·차단 동작 검증 완료
- [ ] Lighthouse 접근성 점수 ≥ 90
- [ ] LCP ≤ 2초, TTI ≤ 3초
- [ ] 15권 시드 도서 + 1명 데모 사용자 정상 동작

---

### 11.2 Phase 2 — 운영 강화 (P1, v1.5) : 8주

| 주차 | 기간 | 산출물 | 상태 |
|------|------|--------|------|
| W17~W18 | Phase 2-1 | **감사 로그**: AuditLog 테이블 + 조회 UI + 필터(기간·작업자·항목·액션) + 변경 전후 diff 하이라이트 | |
| W19~W20 | Phase 2-2 | **화면 미리보기**: 4개 뷰포트 iframe 프리뷰 + 변경 diff 하이라이트 + 저장 전 미리보기 토글 | |
| W21~W22 | Phase 2-3 | **공지 관리 + 알림 시스템**: 공지 CRUD + 시작/종료 일시 + 우선순위 + 알림 배지 + 알림 목록 패널 | |
| W23~W24 | Phase 2-4 | **일괄 처리 + 시스템 모니터 + 백업**: CSV 가져오기/내보내기 + 시스템 상태 카드 + DB 백업/복원 | |

**Phase 2 인수 기준**:

- [ ] 감사 로그에 모든 쓰기 작업이 기록됨
- [ ] 화면 미리보기 4개 뷰포트 정상 동작
- [ ] 공지 등록 후 키오스크 대기 화면에 반영
- [ ] CSV 1,000건 일괄 등록 30초 이내 완료
- [ ] DB 백업→복원 후 데이터 무결성 확인

---

### 11.3 Phase 3 — 확장 (P2, v2.0) : 12주

| 주차 | 기간 | 산출물 | 상태 |
|------|------|--------|------|
| W25~W28 | Phase 3-1 | **다중 키오스크 + 원격 제어**: 단말 등록 + 단말별 CMS 프로파일 + 개별 브로드캐스트 + 유지보수 모드 + 재시작 | |
| W29~W32 | Phase 3-2 | **다국어 CMS + 테마 관리**: i18n JSON 에디터 (KO/EN/ZH/JA) + 로케일 전환 UI + 커스텀 색상 팔레트 + 폰트 크기 조절 | |
| W33~W36 | Phase 3-3 | **예약 + 외부 알림 + 고급 분석**: 대출 예약 대기열 + 연체 이메일/문자 알림 + 월별/카테고리별 통계 차트 | |

**Phase 3 인수 기준**:

- [ ] 다중 키오스크: 3대 이상 단말 개별 CMS 적용 확인
- [ ] 다국어: 4개국어 전환 시 모든 텍스트 정상 표시
- [ ] 예약: 대출 중 도서 예약 → 반납 시 알림 발송 확인
- [ ] 외부 알림: 연체 이메일/문자 발송 성공률 ≥ 95%

---

### 11.4 마일스톤 요약

```
v1.0 (Phase 1)  v1.5 (Phase 2)  v2.0 (Phase 3)
  │                │                │
  │  MVP           │  운영 강화     │  확장
  │  ├─ 인증       │  ├─ 감사로그   │  ├─ 다중키오스크
  │  ├─ CMS편집    │  ├─ 미리보기   │  ├─ 다국어
  │  ├─ CRUD       │  ├─ 공지+알림  │  ├─ 예약
  │  ├─ 통계       │  ├─ 일괄처리   │  ├─ 외부알림
  │  ├─ 실시간     │  ├─ 모니터     │  └─ 고급분석
  │  └─ 반응형     │  └─ 백업       │
  │                │                │
  W16 ──────────── W24 ──────────── W36
```

---

> **변경 이력**

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| v1.0.0 | 2026-03-05 | 최초 작성 — 11개 섹션 완성 (제품개요, 기능요구사항, CMS상세, RBAC, 실시간동기화, 반응형디자인, 비기능요구사항, 사용자스토리, 데이터요구사항, 제약사항, 마일스톤) | Backend Team |
