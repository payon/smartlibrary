# 스마트 도서관 키오스크 시뮬레이터 — 관리자 대시보드 PRD

> **버전**: v1.0.0  
> **작성일**: 2026-03-05  
> **상태**: Draft  
> **담당**: Backend & Dashboard Team

---

## 목차

1. [제품 개요](#1-제품-개요)
2. [기능 요구사항](#2-기능-요구사항)
3. [CMS 관리 항목 상세](#3-cms-관리-항목-상세)
4. [권한 관리 (RBAC)](#4-권한-관리-rbac)
5. [비기능 요구사항](#5-비기능-요구사항)
6. [사용자 스토리](#6-사용자-스토리)
7. [제약 사항](#7-제약-사항)
8. [마일스톤](#8-마일스톤)

---

## 1. 제품 개요

### 1.1 비전

스마트 도서관 키오스크 시뮬레이터의 **관리자 대시보드**는 비개발자 관리자도 키오스크 프론트엔드의 **모든 텍스트·이미지·색상·규칙**을 실시간으로 변경할 수 있는 **Headless CMS + 통계 대시보드** 역할을 수행한다. 코드 배포 없이 즉시 반영되는 콘텐츠 관리를 통해 도서관 운영자의 자율성을 극대화하고, 역할 기반 접근 제어(RBAC)로 보안을 보장한다.

### 1.2 핵심 가치

| 가치 | 설명 |
|------|------|
| **Zero-Deploy CMS** | 코드 수정·재배포 없이 모든 프론트엔드 콘텐츠를 변경 |
| **Real-Time Sync** | 변경 즉시(≤3초) 키오스크 화면에 반영 |
| **Role-Safe** | super_admin / admin / operator 3-tier RBAC |
| **Kiosk-First Responsive** | 21″·24″ 키오스크 → 태블릿 → 모바일까지 완전 반응형 |
| **Local-First** | SQLite + Prisma로 외부 DB 의존 없이 단일 보드 자립 동작 |

### 1.3 참조 시스템

| 참조 | 반영 포인트 |
|------|-------------|
| **Strapi v5 Headless CMS** | 콘텐츠 타입·필드 동적 관리 구조 |
| **Payload CMS** | 블록 기반 에디터 + 이미지 크롭 UX |
| **Next.js Admin Template (Tremor)** | 통계 대시보드 UI 컴포넌트 |
| **React Admin** | CRUD + 필터·정렬·페이지네이션 패턴 |
| **Vercel Dashboard** | 실시간 데이터 폴링·WebSocket 패턴 |

### 1.4 시스템 아키텍처 요약

```
┌──────────────────┐     WebSocket/Polling(≤3s)     ┌──────────────────┐
│   Kiosk Frontend │ ◄────────────────────────────── │  Admin Dashboard │
│   (Next.js 16)   │ ──────────────────────────────► │   (Next.js 16)  │
└──────────────────┘     Content API (REST)          └────────┬─────────┘
                                                                   │
                                                          Prisma ORM
                                                                   │
                                                          ┌────────▼─────────┐
                                                          │  SQLite (Local)  │
                                                          │  cms / audit /   │
                                                          │  stats / rbac    │
                                                          └──────────────────┘
```

---

## 2. 기능 요구사항

### 2.1 우선순위 정의

| 등급 | 의미 |
|------|------|
| **P0** | MVP — 1차 릴리스에 반드시 포함 |
| **P1** | 2차 릴리스 — 운영 필수 but 출시 후 추가 가능 |
| **P2** | 3차 릴리스 — 확장 기능 |

---

### 2.2 P0: MVP 필수 기능

#### P0-1. CMS 콘텐츠 관리

| ID | 기능 | 설명 |
|----|------|------|
| P0-1-1 | 텍스트 편집 | 대기·메인·인증·완료 등 모든 화면의 텍스트를 인라인 편집 |
| P0-1-2 | 이미지 업로드·교체 | 로고, 버튼 아이콘, 배경 이미지 등 이미지 항목 업로드 및 교체 |
| P0-1-3 | 색상 변경 | 배경색, 버튼 색상, 텍스트 색상 등 CSS 색상 값을 컬러 피커로 변경 |
| P0-1-4 | 대출 규칙 설정 | 최대 권수, 대출 기간(일), 연체 배수를 슬라이더/입력으로 설정 |
| P0-1-5 | 도서 CRUD | 도서 등록·조회·수정·삭제 + 표지 이미지 업로드 |
| P0-1-6 | 사용자 CRUD | 도서관 이용자 등록·조회·수정·삭제 (RFID/PIN 포함) |
| P0-1-7 | 변경 즉시 반영 | 저장 시 ≤3초 내 키오스크 프론트엔드에 반영 (WebSocket 또는 폴링) |
| P0-1-8 | 변경 이력 | 각 CMS 항목의 수정 이력을 최근 50건까지 확인 |

#### P0-2. 권한 관리 (RBAC)

| ID | 기능 | 설명 |
|----|------|------|
| P0-2-1 | 역할 정의 | super_admin, admin, operator 3개 역할 고정 |
| P0-2-2 | 권한 매핑 | 역할별 접근 가능 메뉴·API를 매핑 테이블로 관리 |
| P0-2-3 | 계정 관리 | 관리자 계정 생성·수정·비활성화 (삭제 금지 — 감사 추적 유지) |
| P0-2-4 | 세션 관리 | JWT + Refresh Token, 30분 비활동 자동 로그아웃 |

#### P0-3. 대시보드 통계

| ID | 기능 | 설명 |
|----|------|------|
| P0-3-1 | 오늘의 현황 | 금일 대출 건수, 반납 건수, 현재 대출 중 권수, 연체 건수 |
| P0-3-2 | 시간대별 그래프 | 최근 7일 시간대(0~23시) 대출·반납 누적 막대그래프 |
| P0-3-3 | 인기 도서 TOP 10 | 대출 횟수 기준 TOP 10 리스트 |
| P0-3-4 | 최근 활동 | 최근 20건 대출·반납 로그 리스트 (시간, 사용자, 도서, 유형) |

---

### 2.3 P1: 2차 릴리스 기능

| ID | 기능 | 설명 |
|----|------|------|
| P1-1 | 감사 로그 | 모든 CMS 변경·권한 변경·로그인 이벤트를 타임스탬프+작업자+변경 전후로 기록 |
| P1-2 | 화면 미리보기 | CMS 변경 사항을 저장 전 21″/24″/태블릿/모바일 뷰포트로 실시간 프리뷰 |
| P1-3 | 공지 관리 | 키오스크 대기 화면에 표시할 공지사항 CRUD (시작~종료 일시, 우선순위) |
| P1-4 | 일괄 가져오기 | 도서 CSV/Excel 일괄 등록 (최대 1,000건) |
| P1-5 | 데이터 내보내기 | 대출·반납 통계 CSV 내보내기 |

---

### 2.4 P2: 3차 릴리스 기능

| ID | 기능 | 설명 |
|----|------|------|
| P2-1 | 다중 키오스크 관리 | 복수 키오스크 단말을 등록하고 단말별로 다른 CMS 콘텐츠 적용 |
| P2-2 | 다국어 CMS | 한국어·영어·중국어·일본어 4개국어 콘텐츠 관리 (i18n JSON 에디터) |
| P2-3 | 예약 기능 | 도서 대출 예약(대기열) 관리 |
| P2-4 | 알림 연동 | 연체 알림을 이메일/문자로 발송 (외부 API 연동) |

---

## 3. CMS 관리 항목 상세

> 관리자 대시보드에서 제어 가능한 **모든 텍스트·이미지·색상·규칙** 항목의 완전 목록이다.  
> 각 항목은 Prisma 모델 `CmsContent`의 개별 레코드로 저장되며, `key` 값으로 프론트엔드가 조회한다.

### 3.1 대기 화면 (Idle Screen)

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `idle.logo_image` | 로고 이미지 | **image** (PNG/SVG, ≤500KB) | `/images/default-logo.svg` | 화면 중앙 상단 로고 |
| `idle.title_text` | 타이틀 텍스트 | **text** (≤50자) | `"스마트 도서관"` | 로고 하단 메인 타이틀 |
| `idle.subtitle_text` | 부제목 텍스트 | **text** (≤100자) | `"도서 대출·반납 키오스크"` | 타이틀 하단 설명 텍스트 |
| `idle.bg_color` | 배경색 | **color** (HEX) | `#1E3A5F` | 대기 화면 배경색 |
| `idle.bg_image` | 배경 이미지 | **image** (JPG/PNG, ≤2MB) | `null` | 배경 패턴 이미지 (선택) |
| `idle.touch_prompt` | 터치 안내 텍스트 | **text** (≤80자) | `"화면을 터치하세요"` | 하단 깜빡이는 안내 문구 |
| `idle.touch_prompt_color` | 터치 안내 색상 | **color** (HEX) | `#FFFFFF` | 터치 안내 텍스트 색상 |

### 3.2 메인 메뉴 (Main Menu)

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `menu.borrow_button_text` | 대출 버튼 텍스트 | **text** (≤20자) | `"대출"` | 대출 버튼 라벨 |
| `menu.borrow_button_icon` | 대출 버튼 아이콘 | **image** (SVG, ≤50KB) | `/icons/borrow.svg` | 대출 버튼 아이콘 |
| `menu.borrow_button_color` | 대출 버튼 색상 | **color** (HEX) | `#2563EB` | 대출 버튼 배경색 |
| `menu.borrow_button_text_color` | 대출 버튼 텍스트 색상 | **color** (HEX) | `#FFFFFF` | 대출 버튼 글자 색상 |
| `menu.return_button_text` | 반납 버튼 텍스트 | **text** (≤20자) | `"반납"` | 반납 버튼 라벨 |
| `menu.return_button_icon` | 반납 버튼 아이콘 | **image** (SVG, ≤50KB) | `/icons/return.svg` | 반납 버튼 아이콘 |
| `menu.return_button_color` | 반납 버튼 색상 | **color** (HEX) | `#16A34A` | 반납 버튼 배경색 |
| `menu.return_button_text_color` | 반납 버튼 텍스트 색상 | **color** (HEX) | `#FFFFFF` | 반납 버튼 글자 색상 |
| `menu.page_title` | 페이지 타이틀 | **text** (≤50자) | `"원하시는 서비스를 선택하세요"` | 메인 메뉴 상단 안내 문구 |
| `menu.back_button_text` | 뒤로가기 텍스트 | **text** (≤20자) | `"뒤로"` | 뒤로가기 버튼 라벨 |

### 3.3 인증 화면 (Authentication Screen)

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `auth.page_title` | 페이지 타이틀 | **text** (≤50자) | `"사용자 인증"` | 인증 화면 상단 타이틀 |
| `auth.rfid_prompt` | RFID 안내 텍스트 | **text** (≤100자) | `"RFID 카드를 리더기에 대주세요"` | RFID 인증 안내 문구 |
| `auth.rfid_prompt_color` | RFID 안내 색상 | **color** (HEX) | `#374151` | RFID 안내 텍스트 색상 |
| `auth.rfid_icon` | RFID 아이콘 | **image** (SVG, ≤50KB) | `/icons/rfid.svg` | RFID 카드 아이콘 |
| `auth.pin_prompt` | PIN 안내 텍스트 | **text** (≤100자) | `"PIN 번호를 입력하세요"` | PIN 인증 안내 문구 |
| `auth.pin_prompt_color` | PIN 안내 색상 | **color** (HEX) | `#374151` | PIN 안내 텍스트 색상 |
| `auth.pin_icon` | PIN 아이콘 | **image** (SVG, ≤50KB) | `/icons/pin.svg` | PIN 입력 아이콘 |
| `auth.error_invalid_text` | 인증 실패 메시지 | **text** (≤100자) | `"인증에 실패했습니다. 다시 시도해주세요."` | 인증 오류 안내 |
| `auth.tab_rfid_text` | RFID 탭 라벨 | **text** (≤20자) | `"RFID 인증"` | 탭 전환 라벨 |
| `auth.tab_pin_text` | PIN 탭 라벨 | **text** (≤20자) | `"PIN 인증"` | 탭 전환 라벨 |

### 3.4 도서 선택 화면 (Book Selection Screen)

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `select.page_title` | 페이지 타이틀 | **text** (≤50자) | `"도서를 선택하세요"` | 도서 선택 상단 타이틀 |
| `select.search_placeholder` | 검색 placeholder | **text** (≤50자) | `"도서명 또는 저자를 검색하세요"` | 검색 입력 placeholder |
| `select.category_list` | 카테고리 목록 | **json** (string[]) | `["전체","소설","비소설","아동","참고서","만화"]` | 카테고리 탭 목록 |
| `select.empty_result_text` | 결과 없음 텍스트 | **text** (≤100자) | `"검색 결과가 없습니다."` | 검색 결과 빈 상태 안내 |
| `select.select_button_text` | 선택 버튼 텍스트 | **text** (≤20자) | `"선택"` | 도서 선택 버튼 라벨 |
| `select.no_book_text` | 도서 없음 텍스트 | **text** (≤100자) | `"대출 가능한 도서가 없습니다."` | 대출 가능 도서 0건 안내 |

### 3.5 대출 완료 화면 (Borrow Complete Screen)

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `borrow.success_title` | 성공 타이틀 | **text** (≤50자) | `"대출이 완료되었습니다"` | 대출 완료 메인 메시지 |
| `borrow.success_icon` | 성공 아이콘 | **image** (SVG, ≤50KB) | `/icons/check-circle.svg` | 완료 체크 아이콘 |
| `borrow.success_color` | 성공 색상 | **color** (HEX) | `#16A34A` | 성공 메시지 색상 |
| `borrow.due_date_label` | 반납 예정 라벨 | **text** (≤30자) | `"반납 예정일"` | 반납 예정일 앞 라벨 |
| `borrow.item_count_label` | 권수 라벨 | **text** (≤30자) | `"대출 권수"` | 대출 권수 앞 라벨 |
| `borrow.limit_exceeded_text` | 권수 초과 메시지 | **text** (≤100자) | `"대출 가능 권수를 초과했습니다."` | 최대 권수 초과 시 안내 |
| `borrow.finish_button_text` | 종료 버튼 텍스트 | **text** (≤20자) | `"종료"` | 완료 화면 종료 버튼 |

### 3.6 반납 완료 화면 (Return Complete Screen)

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `return.success_title` | 성공 타이틀 | **text** (≤50자) | `"반납이 완료되었습니다"` | 반납 완료 메인 메시지 |
| `return.success_icon` | 성공 아이콘 | **image** (SVG, ≤50KB) | `/icons/check-circle.svg` | 완료 체크 아이콘 |
| `return.success_color` | 성공 색상 | **color** (HEX) | `#16A34A` | 성공 메시지 색상 |
| `return.overdue_warning_text` | 연체 경고 텍스트 | **text** (≤150자) | `"연체된 도서가 포함되어 있습니다. 연체료가 발생할 수 있습니다."` | 연체 포함 시 경고 |
| `return.overdue_warning_color` | 연체 경고 색상 | **color** (HEX) | `#DC2626` | 연체 경고 텍스트 색상 |
| `return.finish_button_text` | 종료 버튼 텍스트 | **text** (≤20자) | `"종료"` | 완료 화면 종료 버튼 |

### 3.7 대출 규칙 (Borrow Rules)

| key | 항목명 | 타입 | 기본값 | 설명 |
|-----|--------|------|--------|------|
| `rules.max_borrow_count` | 최대 대출 권수 | **number** (1~20) | `5` | 1인당 동시 대출 가능 권수 |
| `rules.borrow_period_days` | 대출 기간 | **number** (1~90) | `14` | 대출 기간 (일 단위) |
| `rules.overdue_penalty_multiplier` | 연체 배수 | **number** (1.0~5.0) | `1.0` | 연체 1일당 대출 제한 일수 배수 |
| `rules.overdue_enabled` | 연료 페널티 활성화 | **boolean** | `true` | 연체 페널티 적용 여부 |

### 3.8 도서 관리 (Book CRUD)

> `Book` Prisma 모델의 관리 항목. CMS 콘텐츠라기보다 도메인 엔티티이지만, 관리자 대시보드에서 제어 가능.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | String (UUID) | 자동 | 도서 고유 ID |
| `title` | String (≤200자) | ✅ | 도서명 |
| `author` | String (≤100자) | ✅ | 저자 |
| `isbn` | String (13자) | ✅ | ISBN-13 |
| `category` | String | ✅ | 카테고리 (`select.category_list` 참조) |
| `publisher` | String (≤100자) | ❌ | 출판사 |
| `publishYear` | Int | ❌ | 출판 연도 |
| `coverImage` | String (URL) | ❌ | 표지 이미지 경로 (≤2MB JPG/PNG) |
| `description` | String (≤500자) | ❌ | 도서 소개 |
| `location` | String (≤50자) | ❌ | 청구 기호 / 위치 코드 |
| `status` | Enum | 자동 | `AVAILABLE` / `BORROWED` / `LOST` / `REPAIR` |
| `createdAt` | DateTime | 자동 | 등록 일시 |
| `updatedAt` | DateTime | 자동 | 수정 일시 |

### 3.9 사용자 관리 (User CRUD)

> `User` Prisma 모델의 관리 항목.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | String (UUID) | 자동 | 이용자 고유 ID |
| `name` | String (≤50자) | ✅ | 성명 |
| `rfid` | String (≤20자) | ✅ (unique) | RFID 카드 번호 |
| `pin` | String (6자, hashed) | ✅ | PIN 번호 (bcrypt 해시 저장) |
| `phone` | String (≤20자) | ❌ | 연락처 |
| `email` | String (≤100자) | ❌ | 이메일 |
| `borrowCount` | Int | 자동 | 현재 대출 중 권수 |
| `overdueCount` | Int | 자동 | 연체 권수 |
| `status` | Enum | 자동 | `ACTIVE` / `SUSPENDED` / `WITHDRAWN` |
| `createdAt` | DateTime | 자동 | 가입 일시 |
| `updatedAt` | DateTime | 자동 | 수정 일시 |

---

## 4. 권한 관리 (RBAC)

### 4.1 역할 정의

| 역할 | 코드 | 설명 |
|------|------|------|
| **슈퍼 관리자** | `super_admin` | 시스템 전체 권한. 다른 관리자 계정 생성·권한 부여 가능 |
| **관리자** | `admin` | CMS 콘텐츠·도서·사용자 관리 + 통계 조회. 계정 관리 불가 |
| **운영자** | `operator` | 도서·사용자 조회 + 대출·반납 통계만 조회. 콘텐츠 변경 불가 |

### 4.2 권한 매핑 상세

| 기능 영역 | 세부 기능 | super_admin | admin | operator |
|-----------|-----------|:-----------:|:-----:|:--------:|
| **CMS 콘텐츠** | 텍스트 읽기 | ✅ | ✅ | ✅ |
| | 텍스트 쓰기 | ✅ | ✅ | ❌ |
| | 이미지 업로드/교체 | ✅ | ✅ | ❌ |
| | 색상 변경 | ✅ | ✅ | ❌ |
| | 대출 규칙 변경 | ✅ | ✅ | ❌ |
| **도서 관리** | 도서 목록 조회 | ✅ | ✅ | ✅ |
| | 도서 등록 | ✅ | ✅ | ❌ |
| | 도서 수정 | ✅ | ✅ | ❌ |
| | 도서 삭제 | ✅ | ✅ | ❌ |
| | 도서 CSV 가져오기 | ✅ | ✅ | ❌ |
| **사용자 관리** | 사용자 목록 조회 | ✅ | ✅ | ✅ |
| | 사용자 등록 | ✅ | ✅ | ❌ |
| | 사용자 수정 | ✅ | ✅ | ❌ |
| | 사용자 비활성화 | ✅ | ✅ | ❌ |
| **대출/반납** | 대출·반납 로그 조회 | ✅ | ✅ | ✅ |
| | 대출·반납 실행(키오스크) | — | — | — |
| **통계 대시보드** | 오늘의 현황 | ✅ | ✅ | ✅ |
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
| | 시스템 초기화 | ✅ | ❌ | ❌ |

### 4.3 인증·인가 흐름

```
┌─────────┐   POST /api/auth/login    ┌──────────────┐
│  Login   │ ──────────────────────►  │  Verify Cred │
│  Page    │ ◄──────────────────────  │  Issue JWT   │
└─────────┘   {accessToken,           └──────────────┘
                refreshToken}
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│  Every API Request                                  │
│  Authorization: Bearer <accessToken>                │
│  → Middleware: verify JWT → extract role → check    │
│    permission against RBAC table → allow/deny 403   │
└─────────────────────────────────────────────────────┘
```

| 항목 | 값 |
|------|-----|
| Access Token 수명 | 15분 |
| Refresh Token 수명 | 7일 |
| 비활동 로그아웃 | 30분 |
| 비밀번호 정책 | 8자 이상, 대소문자+숫자+특수문자 포함 |
| 로그인 실패 잠금 | 5회 연속 실패 시 15분 잠금 |

---

## 5. 비기능 요구사항

### 5.1 반응형 브레이크포인트

| 명칭 | 대상 기기 | 해상도 | 방향 | 레이아웃 전략 |
|------|-----------|--------|------|---------------|
| **kiosk-xl** | 24″ 키오스크 | 1920×1080 | 가로 (landscape) | 3-column grid (사이드바 + 메인 + 미리보기) |
| **kiosk-lg** | 21″ 키오스크 | 1920×1080 | 가로 (landscape) | 3-column grid (kiosk-xl과 동일, 폰트 살짝 축소) |
| **tablet** | 10″ 태블릿 | 768×1024 | 세로 (portrait) | 2-column grid (사이드바 접힘 + 메인 전체) |
| **mobile** | 스마트폰 | 375×667 | 세로 (portrait) | 1-column stack (햄버거 메뉴 + 풀스크린 편집) |

#### Tailwind CSS 브레이크포인트 매핑

```js
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

#### 반응형 UI 동작 상세

| UI 요소 | kiosk-xl/lg (≥1280px) | tablet (768~1279px) | mobile (≤767px) |
|---------|------------------------|----------------------|------------------|
| 사이드바 | 240px 고정 노출 | 64px 아이콘 전용 (hover 확장) | 햄버거 메뉴 (슬라이드 오버레이) |
| 콘텐츠 영역 | 3-column CSS Grid | 2-column CSS Grid | 1-column flex stack |
| 미리보기 패널 | 우측 320px 고정 | 하단 280px 접히식 | 모달 오버레이 |
| 데이터 테이블 | 전체 컬럼 노출 | 주요 컬럼 5개 + 더보기 | 카드 리스트 뷰로 전환 |
| 컬러 피커 | 인라인 팝오버 | 인라인 팝오버 | 전체화면 모달 |
| 이미지 업로드 | 드래그앤드롭 영역 | 드래그앤드롭 영역 | 카메라+파일 선택 버튼 |
| 통계 그래프 | 800×400 영역 | 100% 너비 × 300px | 100% 너비 × 200px |

### 5.2 실시간 반영

| 항목 | 요구사항 |
|------|----------|
| 전송 방식 | WebSocket (우선) → 폴링 폴백 (3초 간격) |
| 반영 지연 | CMS 저장 후 **≤3초** 내 키오스크 화면에 반영 |
| 동시 편집 충돌 | 마지막 쓰기 승리 (Last-Write-Wins) + 충돌 알림 토스트 |
| 연결 끊김 | 자동 재연결 (지수 백오프, 최대 5회) + 연결 상태 인디케이터 |
| 변경 브로드캐스트 | 서버 → 연결된 모든 키오스크 클라이언트에 `cms:updated` 이벤트 |

### 5.3 보안

| 항목 | 요구사항 |
|------|----------|
| HTTPS | 로컬 개발 외 반드시 TLS (Self-signed 허용, kiosk 환경) |
| CORS | 대시보드 Origin만 허용 (`localhost:3001` 등) |
| Rate Limiting | API 엔드포인트당 100회/분 (관리자 인증: 10회/분) |
| 입력 검증 | Zod 스키마로 모든 입력 검증 (text 길이, color HEX 형식, image MIME) |
| XSS | React 기본 이스케이프 + 이미지 URL 화이트리스트 |
| CSRF | SameSite 쿠키 + Double Submit Cookie |
| 비밀번호 저장 | bcrypt (cost=12) |
| 이미지 업로드 | MIME 검증 (PNG/JPG/SVG만) + 파일 크기 제한 + SVG sanitize |
| 감사 로그 | 모든 쓰기 작업을 `AuditLog` 테이블에 기록 |

### 5.4 접근성 (A11Y)

| 항목 | 요구사항 |
|------|----------|
| 표준 | WCAG 2.1 Level AA |
| 키보드 내비게이션 | 모든 인터랙티브 요소 Tab 포커스 가능, Escape 모달 닫기 |
| 스크린 리더 | ARIA 라벨·역할 부여, 상태 변경 알림 (aria-live) |
| 색 대비 | 텍스트 4.5:1 이상, 대형 텍스트 3:1 이상 |
| 포커스 인디케이터 | 2px solid outline, 커스텀 포커스 링 |
| 모션 감소 | `prefers-reduced-motion` 존중 |

### 5.5 성능

| 항목 | 요구사항 |
|------|----------|
| 초기 로드 | LCP ≤ 2초 (로컬 네트워크) |
| TTI | TTI ≤ 3초 |
| 번들 크기 | First Load JS ≤ 200KB (gzip) |
| 이미지 최적화 | Next.js `<Image>` 자동 WebP 변환, 반응형 srcset |
| DB 쿼리 | 목록 조회 ≤ 100ms (10,000건 기준) |

---

## 6. 사용자 스토리

### 6.1 슈퍼 관리자 (super_admin)

| ID | 스토리 | 수용 기준 |
|----|--------|-----------|
| US-SA-01 | 슈퍼 관리자로서, 새 관리자 계정을 생성하여 팀원에게 대시보드 접근 권한을 부여하고 싶다. | 이메일·역할 입력 → 계정 생성 → 초대 이메일 발송 (P2) 또는 임시 비밀번호 표시 |
| US-SA-02 | 슈퍼 관리자로서, 관리자의 역할을 변경하여 권한을 조정하고 싶다. | 역할 드롭다운 변경 → 즉시 권한 반영 → 감사 로그 기록 |
| US-SA-03 | 슈퍼 관리자로서, 감사 로그를 조회하여 누가 언제 어떤 변경을 했는지 추적하고 싶다. | 필터(기간·작업자·항목) → 변경 전후값(diff) 표시 |
| US-SA-04 | 슈퍼 관리자로서, DB를 백업하여 데이터 손실에 대비하고 싶다. | 백업 버튼 → SQLite 파일 다운로드 → 복원 기능 |

### 6.2 관리자 (admin)

| ID | 스토리 | 수용 기준 |
|----|--------|-----------|
| US-AD-01 | 관리자로서, 대기 화면의 로고와 타이틀을 변경하여 도서관 브랜딩을 커스터마이징하고 싶다. | 이미지 업로드 + 텍스트 편집 → 저장 → 3초 내 키오스크 반영 |
| US-AD-02 | 관리자로서, 대출·반납 버튼의 색상과 아이콘을 변경하여 시각적 일관성을 유지하고 싶다. | 컬러 피커 + 아이콘 SVG 업로드 → 실시간 미리보기 → 저장 |
| US-AD-03 | 관리자로서, 대출 규칙(최대 권수, 기간, 연체 배수)을 조정하여 도서관 정책 변경을 반영하고 싶다. | 슬라이더/숫자 입력 → 유효범위 검증 → 즉시 규칙 반영 |
| US-AD-04 | 관리자로서, 새 도서를 등록하여 대출 가능 목록에 추가하고 싶다. | 도서 정보 입력 + 표지 이미지 업로드 → 저장 → 목록에 즉시 표시 |
| US-AD-05 | 관리자로서, 도서를 CSV로 일괄 등록하여 대량 등록 시간을 단축하고 싶다. | CSV 업로드 → 유효성 검증 → 성공/실패 결과 리포트 → 건별 오류 표시 |
| US-AD-06 | 관리자로서, 오늘의 대출·반납 현황을 한눈에 파악하여 운영 상태를 모니터링하고 싶다. | 대시보드 진입 → 4개 지표 카드 + 그래프 + TOP 10 + 최근 로그 |
| US-AD-07 | 관리자로서, CMS 변경 전 화면 미리보기로 실제 적용 모습을 확인하고 싶다. | 미리보기 토글 → 4개 뷰포트 탭(21″/24″/태블릿/모바일) → 확인 후 저장 |
| US-AD-08 | 관리자로서, 공지사항을 등록하여 키오스크 대기 화면에 안내 문구를 표시하고 싶다. | 공지 텍스트 + 시작/종료 일시 → 우선순위 설정 → 저장 → 대기 화면 반영 |

### 6.3 운영자 (operator)

| ID | 스토리 | 수용 기준 |
|----|--------|-----------|
| US-OP-01 | 운영자로서, 도서 목록을 조회하여 대출 가능 상태를 확인하고 싶다. | 검색 + 카테고리 필터 + 페이지네이션 → 읽기 전용 |
| US-OP-02 | 운영자로서, 사용자 목록을 조회하여 이용자 정보를 확인하고 싶다. | 검색 + 상태 필터 → 읽기 전용 (PIN 마스킹) |
| US-OP-03 | 운영자로서, 오늘의 대출·반납 통계를 조회하여 현황을 파악하고 싶다. | 대시보드 진입 → 4개 지표 카드 + 그래프 (읽기 전용) |

---

## 7. 제약 사항

| ID | 제약 | 이유 | 대응 |
|----|------|------|------|
| C-01 | **SQLite 단일 파일 DB** | 로컬 보드 단독 동작, 외부 DB 서버 불가 | WAL 모드로 동시 읽기 성능 확보, 쓰기 직렬화 |
| C-02 | **Node.js 단일 프로세스** | 키오스크 임베디드 보드 리소스 제한 | Next.js 16 서버 컴포넌트 + 스트리밍 SSR |
| C-03 | **로컬 스토리지 이미지** | 외부 CDN/스토리지 사용 불가 | `/public/uploads/` 디렉토리 + 정적 서빙 |
| C-04 | **최대 도서 10,000권** | SQLite 성능 한계 | 인덱스 최적화 + 페이지네이션 (50건/페이지) |
| C-05 | **최대 사용자 5,000명** | SQLite 성능 한계 | 인덱스 최적화 + 페이지네이션 (50건/페이지) |
| C-06 | **이미지 총 용량 ≤ 500MB** | 로컬 디스크 제한 | 이미지 압축 (Sharp) + 사용하지 않는 이미지 정리 |
| C-07 | **Next.js 16 App Router 전용** | Pages Router 혼용 금지 | 모든 라우트 `app/` 디렉토리 내 |
| C-08 | **Prisma ORM 전용** | Raw SQL 금지 (감사·마이그레이션 추적) | Prisma schema.prisma로 모든 쿼리 |
| C-09 | **한국어 기본 로케일** | 1차 릴리스 한국어 전용 | P2에서 i18n 다국어 지원 |
| C-10 | **단일 키오스크 연결** | 1차 릴리스 1대 키오스크만 | P2에서 다중 키오스크 지원 |

---

## 8. 마일스톤

### 8.1 1차 릴리스 — MVP (P0)

| 주차 | 기간 | 산출물 | 상태 |
|------|------|--------|------|
| W1~W2 | Phase 1-1 | 프로젝트 스캐폴딩: Next.js 16 + Tailwind 4 + Prisma + SQLite 스키마 정의 | |
| W3~W4 | Phase 1-2 | 인증 시스템: 로그인/로그아웃, JWT 발급·갱신, RBAC 미들웨어 | |
| W5~W6 | Phase 1-3 | CMS 편집 UI: 대기·메인·인증·선택·완료 화면 텍스트·색상 편집 폼 | |
| W7~W8 | Phase 1-4 | 이미지 관리: 업로드·교체·삭제 + SVG 아이콘 관리 | |
| W9~W10 | Phase 1-5 | 도서 CRUD + 사용자 CRUD: 테이블 뷰 + 필터 + 페이지네이션 | |
| W11~W12 | Phase 1-6 | 대출 규칙 설정 UI + 대시보드 통계 (오늘 현황, 그래프, TOP 10, 최근 로그) | |
| W13~W14 | Phase 1-7 | 실시간 동기화: WebSocket 서버 + 키오스크 클라이언트 폴링 폴백 | |
| W15~W16 | Phase 1-8 | 반응형 레이아웃: 태블릿·모바일 대응, QA + 버그 수정 | |

**1차 릴리스 인수 기준**:

- [ ] 모든 P0 기능 ID가 수용 기준을 충족
- [ ] 4개 브레이크포인트에서 레이아웃 깨짐 없음
- [ ] CMS 변경 후 3초 이내 키오스크 반영 확인
- [ ] RBAC: 각 역할별 허용·차단 동작 검증 완료
- [ ] Lighthouse 접근성 점수 ≥ 90

---

### 8.2 2차 릴리스 — 운영 강화 (P1)

| 주차 | 기간 | 산출물 | 상태 |
|------|------|--------|------|
| W17~W18 | Phase 2-1 | 감사 로그: `AuditLog` 테이블 + 조회 UI + 필터·내보내기 | |
| W19~W20 | Phase 2-2 | 화면 미리보기: 4개 뷰포트 iframe 프리뷰 + 변경 diff 하이라이트 | |
| W21~W22 | Phase 2-3 | 공지 관리: CRUD + 시작/종료 일시 + 우선순위 + 대기 화면 연동 | |
| W23~W24 | Phase 2-4 | 일괄 가져오기/내보내기: CSV 파서 + 유효성 검증 + 에러 리포트 | |

---

### 8.3 3차 릴리스 — 확장 (P2)

| 주차 | 기간 | 산출물 | 상태 |
|------|------|--------|------|
| W25~W28 | Phase 3-1 | 다중 키오스크: 단말 등록 + 단말별 CMS 프로파일 + 개별 브로드캐스트 | |
| W29~W32 | Phase 3-2 | 다국어 CMS: i18n JSON 에디터 (KO/EN/ZH/JA) + 로케일 전환 UI | |
| W33~W36 | Phase 3-3 | 예약 + 알림: 대출 예약 대기열 + 연체 이메일/문자 알림 연동 | |

---

### 8.4 Prisma 스키마 요약 (1차 릴리스)

```prisma
// prisma/schema.prisma

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}

model AdminUser {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  role         String   // "super_admin" | "admin" | "operator"
  isActive     Boolean  @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model CmsContent {
  id         String   @id @default(uuid())
  key        String   @unique  // e.g. "idle.logo_image"
  type       String            // "text" | "image" | "color" | "number" | "boolean" | "json"
  value      String            // 값 (이미지는 URL, 색상은 HEX, 숫자는 String 캐스트)
  updatedAt  DateTime @updatedAt
  updatedBy  String            // AdminUser.id
}

model Book {
  id           String   @id @default(uuid())
  title        String
  author       String
  isbn         String   @unique
  category     String
  publisher    String?
  publishYear  Int?
  coverImage   String?
  description  String?
  location     String?
  status       String   @default("AVAILABLE") // AVAILABLE | BORROWED | LOST | REPAIR
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model LibraryUser {
  id           String   @id @default(uuid())
  name         String
  rfid         String   @unique
  pinHash      String
  phone        String?
  email        String?
  borrowCount  Int      @default(0)
  overdueCount Int      @default(0)
  status       String   @default("ACTIVE") // ACTIVE | SUSPENDED | WITHDRAWN
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model BorrowRecord {
  id          String   @id @default(uuid())
  userId      String
  bookId      String
  type        String            // "BORROW" | "RETURN"
  borrowedAt  DateTime
  dueDate     DateTime?
  returnedAt  DateTime?
  isOverdue   Boolean  @default(false)
  createdAt   DateTime @default(now())

  user        LibraryUser @relation(fields: [userId], references: [id])
  book        Book        @relation(fields: [bookId], references: [id])
}

model AuditLog {
  id         String   @id @default(uuid())
  action     String            // "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT"
  entity     String            // "CmsContent" | "Book" | "LibraryUser" | "AdminUser"
  entityId   String?
  oldValue   String?           // JSON
  newValue   String?           // JSON
  performedBy String          // AdminUser.id
  performedAt DateTime @default(now())
}

model Notice {
  id        String   @id @default(uuid())
  title     String
  content   String
  priority  Int      @default(0)
  startAt   DateTime
  endAt     DateTime
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

> **변경 이력**

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| v1.0.0 | 2026-03-05 | 최초 작성 | Dashboard Team |
