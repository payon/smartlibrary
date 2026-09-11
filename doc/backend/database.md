# 스마트 도서관 키오스크 시뮬레이터 — 백엔드 관리자 대시보드 데이터베이스 설계 문서

> **버전**: v2.0.0  
> **작성일**: 2026-03-05  
> **DB 엔진**: SQLite 3.x (WAL 모드)  
> **ORM**: Prisma 6.x  
> **DB 파일**: `prisma/dev.db`  
> **문서 상태**: Production-ready

---

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [ER 다이어그램](#2-er-다이어그램)
3. [기존 테이블 요약](#3-기존-테이블-요약)
4. [신규 테이블 상세 스키마](#4-신규-테이블-상세-스키마)
5. [Prisma 스키마 코드](#5-prisma-스키마-코드)
6. [인덱스 전략](#6-인덱스-전략)
7. [시드 데이터](#7-시드-데이터)
8. [마이그레이션 전략](#8-마이그레이션-전략)
9. [데이터 무결성 규칙](#9-데이터-무결성-규칙)
10. [콘텐츠 키 명명 규칙](#10-콘텐츠-키-명명-규칙)
11. [성능 및 보안 고려사항](#11-성능-및-보안-고려사항)

---

## 1. 아키텍처 개요

### 1.1 설계 원칙

| 원칙 | 설명 |
|------|------|
| **관심사 분리** | 키오스크 운영 데이터(SimUser, Book, SimLoan…)와 관리자 도메인(AdminUser, AuditLog…)을 명확히 분리 |
| **감사 추적 우선** | 모든 관리자 행위는 AuditLog에 기록되어 규제 대응 및 장애 원인 분석 보장 |
| **콘텐츠 버전 관리** | ContentItem의 모든 변경은 ContentVersion에 이력으로 저장되어 롤백 및 변경 추적 가능 |
| **JSON 유연성** | CMS 콘텐츠, 키오스크 설정 등 스키마 변동이 잦은 영역은 JSON/Text 컬럼 활용 |
| **SQLite 최적화** | SQLite 제약(단일 writer, JSON 지원 등)을 고려한 인덱스 및 트랜잭션 설계 |
| **소프트 삭제 금지** | 관리자 계정은 비활성화만 허용, 삭제 금지 — 감사 추적 무결성 유지 |

### 1.2 도메인 분류

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          Database Domains                                  │
├───────────────┬───────────────────┬───────────────────────────────────────┤
│  Kiosk Core   │  Admin Ops        │  System Infra                         │
├───────────────┼───────────────────┼───────────────────────────────────────┤
│  SimUser      │  AdminUser        │  AuditLog                             │
│  Book         │  AdminSession     │  KioskConfig                          │
│  SimLoan      │  ContentItem      │  MediaAsset                           │
│  Scenario     │  ContentVersion   │  Notification                         │
│  LearningPro- │                   │  SystemHealth                         │
│  gress        │                   │                                       │
└───────────────┴───────────────────┴───────────────────────────────────────┘
```

### 1.3 테이블 수 요약

| 도메인 | 기존 테이블 | 신규 테이블 | 합계 |
|--------|:-----------:|:-----------:|:----:|
| Kiosk Core | 5 | 0 | 5 |
| Admin Ops | 0 | 4 | 4 |
| System Infra | 0 | 5 | 5 |
| **전체** | **5** | **9** | **14** |

---

## 2. ER 다이어그램

### 2.1 전체 엔티티 관계도 (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              ER Diagram — Smart Library Kiosk                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌──────── KISOK CORE ────────────────┐   ┌──────── ADMIN OPS ──────────────────────┐  │
│  │                                     │   │                                        │  │
│  │  ┌──────────┐    ┌──────────┐      │   │  ┌──────────┐     ┌──────────────┐     │  │
│  │  │ SimUser  │◄───│ SimLoan  │      │   │  │AdminUser │◄────│AdminSession  │     │  │
│  │  │──────────│    │──────────│      │   │  │──────────│     │──────────────│     │  │
│  │  │ PK: id   │    │ PK: id   │      │   │  │ PK: id   │     │ PK: id       │     │  │
│  │  │ name     │    │ FK:userId│──┐   │   │  │ email(UQ)│     │ FK:userId    │     │  │
│  │  │ cardNum  │    │ FK:bookId│──┼── │   │  │ name     │     │ token        │     │  │
│  │  │ pin(UQ)  │    │ status   │  │   │   │  │ role      │     │ expiresAt    │     │  │
│  │  └────┬─────┘    └──────────┘  │   │   │  │ isActive │     │ ipAddress    │     │  │
│  │       │                         │   │   │  └────┬─────┘     └──────────────┘     │  │
│  │       │ 1                       │   │   │       │ 1                              │  │
│  │       ▼ N                       │   │   │       │ N                              │  │
│  │  ┌──────────────┐    ┌─────────▼┐ │   │  ┌─────▼────────┐  ┌──────────────┐     │  │
│  │  │LearningProg  │    │  Book    │ │   │  │ ContentItem  │  │ContentVersion│     │  │
│  │  │──────────────│    │──────────│ │   │  │──────────────│  │──────────────│     │  │
│  │  │ PK: id       │    │ PK: id   │ │   │  │ PK: id       │  │ PK: id       │     │  │
│  │  │ FK: userId   │    │ isbn(UQ) │ │   │  │ key(UQ)      │  │ FK:contentId │     │  │
│  │  │ FK:scenId    │    │ title    │ │   │  │ value        │  │ oldValue     │     │  │
│  │  │ completed    │    │ author   │ │   │  │ type         │  │ newValue     │     │  │
│  │  └──────────────┘    └──────────┘ │   │  │ screen       │  │ FK:changedBy │     │  │
│  │       │                          │   │  │ label        │  └──────────────┘     │  │
│  │       │ FK                       │   │  │ FK:updatedBy │                        │  │
│  │       ▼                          │   │  └──────────────┘                        │  │
│  │  ┌──────────┐                    │   │                                          │  │
│  │  │ Scenario │                    │   └──────────────────────────────────────────┘  │
│  │  │──────────│                    │                                                    │
│  │  │ PK: id   │                    │   ┌──────── SYSTEM INFRA ──────────────────────┐  │
│  │  │ title    │                    │   │                                            │  │
│  │  │ stepsJson│                    │   │  ┌──────────┐  ┌──────────────┐           │  │
│  │  └──────────┘                    │   │  │AuditLog  │  │ KioskConfig  │           │  │
│  │                                  │   │  │──────────│  │──────────────│           │  │
│  └──────────────────────────────────┘   │  │ PK: id   │  │ PK: id       │           │  │
│                                         │  │ FK:userId│  │ key(UQ)      │           │  │
│                                         │  │ action   │  │ value(JSON)  │           │  │
│                                         │  │ entity   │  │ label        │           │  │
│                                         │  │ entityId │  │ category     │           │  │
│                                         │  └──────────┘  └──────────────┘           │  │
│                                         │                                            │  │
│                                         │  ┌──────────┐  ┌──────────────┐           │  │
│                                         │  │MediaAsset│  │Notification  │           │  │
│                                         │  │──────────│  │──────────────│           │  │
│                                         │  │ PK: id   │  │ PK: id       │           │  │
│                                         │  │ filename │  │ type         │           │  │
│                                         │  │ mimeType │  │ title        │           │  │
│                                         │  │ FK:upBy  │  │ message      │           │  │
│                                         │  └──────────┘  │ isRead       │           │  │
│                                         │                └──────────────┘           │  │
│                                         │                                            │  │
│                                         │  ┌──────────────┐                          │  │
│                                         │  │ SystemHealth │                          │  │
│                                         │  │──────────────│                          │  │
│                                         │  │ PK: id       │                          │  │
│                                         │  │ metric       │                          │  │
│                                         │  │ value        │                          │  │
│                                         │  │ timestamp    │                          │  │
│                                         │  └──────────────┘                          │  │
│                                         │                                            │  │
│                                         └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 관계 카디널리티 요약

| 부모 엔티티 | 자식 엔티티 | 관계 | 카디널리티 | FK 컬럼 |
|-------------|-------------|------|:----------:|---------|
| SimUser | SimLoan | 1:N | 1대 다 | userId |
| Book | SimLoan | 1:N | 1대 다 | bookId |
| SimUser | LearningProgress | 1:N | 1대 다 | userId |
| AdminUser | AdminSession | 1:N | 1대 다 | userId |
| AdminUser | ContentItem | 1:N | 1대 다 | updatedBy |
| ContentItem | ContentVersion | 1:N | 1대 다 | contentItemId |
| AdminUser | ContentVersion | 1:N | 1대 다 | changedBy |
| AdminUser | AuditLog | 1:N | 1대 다 | userId |
| AdminUser | MediaAsset | 1:N | 1대 다 | uploadedBy |
| AdminUser | Notification | 1:N | 1대 다 | createdBy |

---

## 3. 기존 테이블 요약

> 아래 5개 테이블은 현재 `schema.prisma`에 이미 정의되어 운영 중이며, 신규 테이블과의 관계만 추가로 명시한다.

### 3.1 SimUser — 시뮬레이션 사용자

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid() | 사용자 고유 ID |
| name | String | NOT NULL | 성명 |
| birthDate | String | NOT NULL | 생년월일 (YYYY-MM-DD) |
| phone | String | NOT NULL | 연락처 |
| address | String | nullable | 주소 |
| cardType | String | default("mobile") | 카드 유형 |
| cardNumber | String | UNIQUE, nullable | 카드 번호 (RFID) |
| cardIssued | String | nullable | 카드 발급일 |
| pin | String | UNIQUE, nullable | PIN 번호 |
| isActive | Boolean | default(true) | 활성 상태 |
| createdAt | DateTime | default(now()) | 생성 시각 |
| updatedAt | DateTime | @updatedAt | 갱신 시각 |

**관계**: SimLoan(1:N), LearningProgress(1:N)

### 3.2 Book — 도서

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid() | 도서 고유 ID |
| isbn | String | UNIQUE | ISBN |
| title | String | NOT NULL | 제목 |
| author | String | NOT NULL | 저자 |
| publisher | String | nullable | 출판사 |
| publishYear | Int | nullable | 출판 연도 |
| category | String | nullable | 분류 |
| coverUrl | String | nullable | 표지 이미지 URL |
| totalCopies | Int | default(3) | 총 보유 권수 |
| availableCopies | Int | default(3) | 대출 가능 권수 |
| shelfLocation | String | nullable | 서가 위치 |
| loans | SimLoan[] | — | 대출 관계 |

**관계**: SimLoan(1:N)

### 3.3 SimLoan — 대출 기록

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid() | 대출 고유 ID |
| userId | String | FK → SimUser.id | 사용자 참조 |
| bookId | String | FK → Book.id | 도서 참조 |
| loanDate | String | NOT NULL | 대출일 |
| dueDate | String | NOT NULL | 반납 예정일 |
| returnDate | String | nullable | 실제 반납일 |
| status | String | default("active") | 상태 (active/returned/overdue) |
| method | String | default("counter") | 대출 방식 |
| extended | Boolean | default(false) | 연장 여부 |
| createdAt | DateTime | default(now()) | 생성 시각 |
| updatedAt | DateTime | @updatedAt | 갱신 시각 |

**관계**: SimUser(N:1), Book(N:1)

### 3.4 LearningProgress — 학습 진도

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid() | 진도 고유 ID |
| userId | String | FK → SimUser.id | 사용자 참조 |
| scenarioId | String | FK → Scenario.id | 시나리오 참조 |
| stepIndex | Int | default(0) | 현재 스텝 인덱스 |
| completed | Boolean | default(false) | 완료 여부 |
| attempts | Int | default(0) | 시도 횟수 |
| bestTimeSec | Int | nullable | 최단 소요 시간(초) |
| stars | Int | default(0) | 획득 별점 (0~3) |
| updatedAt | DateTime | @updatedAt | 갱신 시각 |

**관계**: SimUser(N:1)

### 3.5 Scenario — 시나리오

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid() | 시나리오 고유 ID |
| title | String | NOT NULL | 제목 |
| description | String | nullable | 설명 |
| difficulty | String | default("beginner") | 난이도 |
| stepsJson | String | NOT NULL | 스텝 정의 JSON |
| category | String | nullable | 카테고리 |
| orderIndex | Int | default(0) | 정렬 순서 |

---

## 4. 신규 테이블 상세 스키마

### 4.1 AdminUser — 관리자 계정

관리자 대시보드에 로그인하는 모든 계정을 관리한다. RBAC(Role-Based Access Control)의 주체 엔티티이다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 관리자 고유 ID |
| email | String | **UNIQUE**, NOT NULL | — | 로그인 이메일 |
| name | String | NOT NULL | — | 관리자 표시명 |
| passwordHash | String | NOT NULL | — | bcrypt 해시 (cost=12) |
| role | String | NOT NULL, CHECK | — | 역할: `super_admin` / `admin` / `operator` |
| isActive | Boolean | NOT NULL | true | 계정 활성 상태 (false=비활성화, 삭제 금지) |
| lastLoginAt | DateTime | nullable | null | 마지막 로그인 시각 |
| createdAt | DateTime | NOT NULL | now() | 계정 생성 시각 |
| updatedAt | DateTime | NOT NULL | @updatedAt | 계정 정보 갱신 시각 |

**관계**: AdminSession(1:N), ContentItem(1:N, via updatedBy), ContentVersion(1:N, via changedBy), AuditLog(1:N), MediaAsset(1:N), Notification(1:N)

**비즈니스 규칙**:
- `role`은 `super_admin`, `admin`, `operator` 중 하나만 허용
- `super_admin` 계정은 최소 1개 존재해야 함 (삭제/비활성화 금지)
- 동일 이메일 중복 불가 (UNIQUE 제약)
- 계정 삭제는 불가, `isActive = false`로 비활성화만 허용

---

### 4.2 AdminSession — 관리자 세션

활성 관리자 세션을 추적하여 동시 로그인 제어 및 보안 감사에 활용한다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 세션 고유 ID |
| userId | String | **FK** → AdminUser.id, NOT NULL | — | 세션 소유 관리자 |
| token | String | **UNIQUE**, NOT NULL | — | JWT 세션 토큰 |
| expiresAt | DateTime | NOT NULL | — | 세션 만료 시각 |
| ipAddress | String | nullable | null | 로그인 IP 주소 |
| userAgent | String | nullable | null | 로그인 User-Agent 문자열 |
| createdAt | DateTime | NOT NULL | now() | 세션 생성 시각 |

**관계**: AdminUser(N:1)

**비즈니스 규칙**:
- `expiresAt` 이후 세션은 자동 무효화 (미들웨어에서 검증)
- 동일 userId의 활성 세션은 최대 3개까지 허용 (4번째 로그인 시 가장 오래된 세션 자동 삭제)
- 관리자 비활성화 시 해당 userId의 모든 세션 즉시 삭제

---

### 4.3 ContentItem — CMS 콘텐츠 항목

키오스크 프론트엔드의 모든 편집 가능 텍스트, 이미지, 색상, JSON 값을 키-값 저장소로 관리한다. 11개 화면의 모든 편집 가능 항목이 이 테이블의 개별 레코드로 저장된다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 콘텐츠 항목 고유 ID |
| key | String | **UNIQUE**, NOT NULL | — | 콘텐츠 키 (예: `"idle.title"`, `"mainmenu.loan_button_text"`) |
| value | String | NOT NULL | — | 값 (텍스트, 이미지 URL, HEX 색상, JSON 문자열) |
| type | String | NOT NULL, CHECK | — | 값 유형: `text` / `image_url` / `json` / `color` |
| screen | String | NOT NULL | — | 키오스크 화면 식별자 (예: `"idle"`, `"main-menu"`, `"global"`) |
| label | String | NOT NULL | — | 한국어 표시명 (관리자 UI 라벨, 예: `"대기 화면 제목"`) |
| updatedAt | DateTime | NOT NULL | @updatedAt | 최종 갱신 시각 |
| updatedBy | String | **FK** → AdminUser.id, NOT NULL | — | 최종 갱신 관리자 ID |

**관계**: AdminUser(N:1, via updatedBy), ContentVersion(1:N)

**비즈니스 규칙**:
- `key`는 전역 유일 (UNIQUE 제약) — 동일 키 중복 저장 불가
- `type`은 `text`, `image_url`, `json`, `color` 중 하나
- `screen`은 정의된 12개 화면 식별자 중 하나 (11개 화면 + `global`)
- `value` 변경 시 ContentVersion에 이력 자동 생성 (애플리케이션 레벨 트리거)
- `value`가 `color` 타입인 경우 HEX 형식(`#RRGGBB`) 검증 필요
- `value`가 `json` 타입인 경우 유효한 JSON 문자열 검증 필요

---

### 4.4 ContentVersion — 콘텐츠 변경 이력

ContentItem의 모든 변경 사항을 이전값/새값으로 기록하여 감사 추적 및 롤백을 지원한다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 버전 고유 ID |
| contentItemId | String | **FK** → ContentItem.id, NOT NULL | — | 변경 대상 콘텐츠 항목 |
| oldValue | String | nullable | null | 변경 전 값 (최초 생성 시 null) |
| newValue | String | NOT NULL | — | 변경 후 값 |
| changedBy | String | **FK** → AdminUser.id, NOT NULL | — | 변경 수행 관리자 ID |
| changedAt | DateTime | NOT NULL | now() | 변경 발생 시각 |

**관계**: ContentItem(N:1), AdminUser(N:1, via changedBy)

**비즈니스 규칙**:
- ContentItem 업데이트 시 애플리케이션 코드에서 자동으로 레코드 생성
- 최근 50버전까지만 보관 (51번째부터 가장 오래된 버전 자동 삭제 — 애플리케이션 레벨)
- `oldValue`가 null인 경우는 최초 생성(INSERT)을 의미

---

### 4.5 AuditLog — 감사 로그

관리자 대시보드에서 발생하는 모든 쓰기 작업(create/update/delete)과 인증 이벤트(login/logout)를 기록하는 감사 추적 테이블이다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 로그 고유 ID |
| userId | String | **FK** → AdminUser.id, NOT NULL | — | 작업 수행 관리자 ID |
| action | String | NOT NULL, CHECK | — | 작업 유형: `create` / `update` / `delete` / `login` / `logout` |
| entity | String | NOT NULL, CHECK | — | 대상 엔티티: `content` / `book` / `user` / `setting` |
| entityId | String | nullable | null | 대상 엔티티의 ID (해당 시) |
| details | String | nullable | null | 상세 정보 JSON (이전값/새값 diff, 변경 필드 목록 등) |
| ipAddress | String | nullable | null | 요청 IP 주소 |
| timestamp | DateTime | NOT NULL | now() | 작업 발생 시각 |

**관계**: AdminUser(N:1)

**비즈니스 규칙**:
- 모든 관리자 쓰기 API 엔드포인트에서 자동 기록 (미들웨어/인터셉터 패턴)
- 로그 삭제 불가 (IMMUTABLE) — 보관 기한 만료 시에만 일괄 삭제
- `action`은 `create`, `update`, `delete`, `login`, `logout` 중 하나
- `entity`는 `content`, `book`, `user`, `setting` 중 하나
- `details`는 JSON 문자열로, `{"oldValue": "...", "newValue": "...", "fields": ["key","value"]}` 구조 권장

---

### 4.6 KioskConfig — 키오스크 시스템 설정

키오스크 동작에 영향을 미치는 시스템 수준 설정을 키-값(JSON)으로 관리한다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 설정 고유 ID |
| key | String | **UNIQUE**, NOT NULL | — | 설정 키 (예: `"loan_period_days"`, `"max_loan_count"`) |
| value | String | NOT NULL | — | 설정값 (JSON 문자열) |
| label | String | NOT NULL | — | 한국어 표시명 (예: `"대출 기간(일)"`) |
| category | String | NOT NULL | — | 설정 분류: `loan_rules` / `display` / `tts` / `system` |
| updatedAt | DateTime | NOT NULL | @updatedAt | 최종 갱신 시각 |

**비즈니스 규칙**:
- `key`는 전역 유일 (UNIQUE 제약)
- `value`는 항상 유효한 JSON 문자열이어야 함
- `category`는 `loan_rules`, `display`, `tts`, `system` 중 하나
- 설정 변경 시 AuditLog에 자동 기록

---

### 4.7 MediaAsset — 미디어 자산

관리자가 업로드한 이미지 파일의 메타데이터를 관리한다. 실제 파일은 `/public/uploads/` 디렉토리에 저장된다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 미디어 고유 ID |
| filename | String | **UNIQUE**, NOT NULL | — | 저장된 파일명 (UUID 기반, 예: `"a1b2c3.png"`) |
| originalName | String | NOT NULL | — | 원본 파일명 (예: `"library-logo.png"`) |
| mimeType | String | NOT NULL | — | MIME 타입: `image/png` / `image/jpeg` / `image/svg+xml` |
| size | Int | NOT NULL | — | 파일 크기 (바이트) |
| path | String | NOT NULL | — | 파일 경로 (예: `"/uploads/a1b2c3.png"`) |
| uploadedBy | String | **FK** → AdminUser.id, NOT NULL | — | 업로드 수행 관리자 ID |
| createdAt | DateTime | NOT NULL | now() | 업로드 시각 |

**관계**: AdminUser(N:1)

**비즈니스 규칙**:
- 허용 MIME 타입: `image/png`, `image/jpeg`, `image/svg+xml`
- 최대 파일 크기: 2MB (2,097,152 바이트)
- SVG 파일은 업로드 전 sanitize 처리 필수 (XSS 방지)
- 파일 삭제 시 디스크 파일도 함께 삭제 (트랜잭션 외부 처리)
- 총 미디어 용량 ≤ 500MB 제한

---

### 4.8 Notification — 시스템 알림

관리자 대시보드에 표시되는 시스템 알림을 관리한다. 연체 발생, 시스템 오류, 설정 변경 등의 이벤트 알림에 활용한다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 알림 고유 ID |
| type | String | NOT NULL, CHECK | — | 알림 유형: `info` / `warning` / `error` |
| title | String | NOT NULL | — | 알림 제목 |
| message | String | NOT NULL | — | 알림 본문 |
| isRead | Boolean | NOT NULL | false | 읽음 상태 |
| createdBy | String | **FK** → AdminUser.id, nullable | null | 생성자 관리자 ID (시스템 생성 시 null) |
| createdAt | DateTime | NOT NULL | now() | 생성 시각 |

**관계**: AdminUser(N:1, via createdBy)

**비즈니스 규칙**:
- `type`은 `info`, `warning`, `error` 중 하나
- `createdBy`가 null인 경우 시스템 자동 생성 알림
- 30일 이상 경과한 읽음 알림은 자동 삭제 (크론잡)
- 미읽음 알림은 최대 100개까지 유지

---

### 4.9 SystemHealth — 시스템 헬스 스냅샷

키오스크 시스템의 상태 지표를 주기적으로 샘플링하여 저장한다. 대시보드의 시스템 상태 모니터링에 활용한다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 스냅샷 고유 ID |
| metric | String | NOT NULL | — | 지표명: `cpu_usage` / `memory_usage` / `disk_usage` / `db_size` / `uptime` / `active_sessions` |
| value | Float | NOT NULL | — | 측정값 |
| unit | String | NOT NULL | — | 단위: `%` / `MB` / `GB` / `seconds` / `count` |
| timestamp | DateTime | NOT NULL | now() | 측정 시각 |

**비즈니스 규칙**:
- 5분 간격으로 자동 샘플링 (크론잡/인터벌)
- 7일 이상 경과한 데이터는 자동 삭제 (롤업 후 원본 삭제)
- `metric` + `timestamp` 조합으로 시계열 조회 최적화

---

## 5. Prisma 스키마 코드

### 5.1 신규 모델 추가 스키마

다음 코드를 기존 `prisma/schema.prisma` 파일에 추가한다.

```prisma
// ============================================================
// 신규 모델: 백엔드 관리자 대시보드
// ============================================================

/// 관리자 계정 — RBAC 주체 엔티티
model AdminUser {
  id           String          @id @default(cuid())
  email        String          @unique
  name         String
  passwordHash String
  role         String          // "super_admin" | "admin" | "operator"
  isActive     Boolean         @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  // 관계
  sessions        AdminSession[]
  contentItems    ContentItem[]     @relation("ContentUpdatedBy")
  contentVersions ContentVersion[]  @relation("ContentVersionChangedBy")
  auditLogs       AuditLog[]
  mediaAssets     MediaAsset[]
  notifications   Notification[]    @relation("NotificationCreatedBy")
}

/// 관리자 세션 — JWT 토큰 및 로그인 메타 추적
model AdminSession {
  id        String     @id @default(cuid())
  userId    String
  token     String     @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime   @default(now())

  // 관계
  user AdminUser @relation(fields: [userId], references: [id], onDelete: Cascade)
}

/// CMS 콘텐츠 항목 — 키오스크 모든 화면의 편집 가능 텍스트/이미지/색상/JSON
model ContentItem {
  id        String   @id @default(cuid())
  key       String   @unique                    // 예: "idle.title", "mainmenu.loan_button_text"
  value     String                               // 텍스트, 이미지 URL, HEX 색상, JSON 문자열
  type      String                               // "text" | "image_url" | "json" | "color"
  screen    String                               // 키오스크 화면 식별자
  label     String                               // 한국어 표시명 (관리자 UI 라벨)
  updatedAt DateTime @updatedAt
  updatedBy String                               // AdminUser.id

  // 관계
  updatedByAdmin AdminUser         @relation("ContentUpdatedBy", fields: [updatedBy], references: [id])
  versions       ContentVersion[]
}

/// 콘텐츠 변경 이력 — 감사 추적 및 롤백 지원
model ContentVersion {
  id            String   @id @default(cuid())
  contentItemId String
  oldValue      String?                              // 변경 전 값 (최초 생성 시 null)
  newValue      String                               // 변경 후 값
  changedBy     String                               // AdminUser.id
  changedAt     DateTime @default(now())

  // 관계
  contentItem   ContentItem @relation(fields: [contentItemId], references: [id], onDelete: Cascade)
  changedByAdmin AdminUser  @relation("ContentVersionChangedBy", fields: [changedBy], references: [id])
}

/// 감사 로그 — 모든 관리자 쓰기 작업 및 인증 이벤트 추적
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String                             // "create" | "update" | "delete" | "login" | "logout"
  entity    String                             // "content" | "book" | "user" | "setting"
  entityId  String?
  details   String?                            // JSON: { oldValue, newValue, fields }
  ipAddress String?
  timestamp DateTime @default(now())

  // 관계
  user AdminUser @relation(fields: [userId], references: [id])
}

/// 키오스크 시스템 설정 — 키-값(JSON) 저장소
model KioskConfig {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String                              // JSON 문자열
  label     String                              // 한국어 표시명
  category  String                              // "loan_rules" | "display" | "tts" | "system"
  updatedAt DateTime @updatedAt
}

/// 미디어 자산 — 업로드된 이미지 파일 메타데이터
model MediaAsset {
  id           String   @id @default(cuid())
  filename     String   @unique                   // UUID 기반 저장 파일명
  originalName String                              // 원본 파일명
  mimeType     String                              // "image/png" | "image/jpeg" | "image/svg+xml"
  size         Int                                 // 파일 크기 (바이트)
  path         String                              // 파일 경로 ("/uploads/xxx.png")
  uploadedBy   String                              // AdminUser.id
  createdAt    DateTime @default(now())

  // 관계
  uploadedByAdmin AdminUser @relation(fields: [uploadedBy], references: [id])
}

/// 시스템 알림 — 대시보드 인알림
model Notification {
  id        String    @id @default(cuid())
  type      String                              // "info" | "warning" | "error"
  title     String
  message   String
  isRead    Boolean   @default(false)
  createdBy String?                             // AdminUser.id (시스템 생성 시 null)
  createdAt DateTime  @default(now())

  // 관계
  createdByAdmin AdminUser? @relation("NotificationCreatedBy", fields: [createdBy], references: [id])
}

/// 시스템 헬스 스냅샷 — 주기적 지표 샘플링
model SystemHealth {
  id        String   @id @default(cuid())
  metric    String                              // "cpu_usage" | "memory_usage" | "disk_usage" | "db_size" | "uptime" | "active_sessions"
  value     Float
  unit      String                              // "%" | "MB" | "GB" | "seconds" | "count"
  timestamp DateTime @default(now())
}
```

### 5.2 완전 schema.prisma (기존 + 신규)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ============================================================
// 기존 모델: 키오스크 코어
// ============================================================

model SimUser {
  id          String   @id @default(cuid())
  name        String
  birthDate   String
  phone       String
  address     String?
  cardType    String?  @default("mobile")
  cardNumber  String?  @unique
  cardIssued  String?
  pin         String?  @unique
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  loans       SimLoan[]
  progress    LearningProgress[]
}

model Book {
  id              String   @id @default(cuid())
  isbn            String   @unique
  title           String
  author          String
  publisher       String?
  publishYear     Int?
  category        String?
  coverUrl        String?
  totalCopies     Int      @default(3)
  availableCopies Int      @default(3)
  shelfLocation   String?
  loans           SimLoan[]
}

model SimLoan {
  id          String   @id @default(cuid())
  userId      String
  bookId      String
  loanDate    String
  dueDate     String
  returnDate  String?
  status      String   @default("active")
  method      String?  @default("counter")
  extended    Boolean  @default(false)
  user        SimUser  @relation(fields: [userId], references: [id])
  book        Book     @relation(fields: [bookId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model LearningProgress {
  id            String   @id @default(cuid())
  userId        String
  scenarioId    String
  stepIndex     Int      @default(0)
  completed     Boolean  @default(false)
  attempts      Int      @default(0)
  bestTimeSec   Int?
  stars         Int      @default(0)
  updatedAt     DateTime @updatedAt
  user          SimUser  @relation(fields: [userId], references: [id])
}

model Scenario {
  id          String   @id @default(cuid())
  title       String
  description String?
  difficulty  String   @default("beginner")
  stepsJson   String
  category    String?
  orderIndex  Int      @default(0)
}

// ============================================================
// 신규 모델: 백엔드 관리자 대시보드
// ============================================================

model AdminUser {
  id           String          @id @default(cuid())
  email        String          @unique
  name         String
  passwordHash String
  role         String          // "super_admin" | "admin" | "operator"
  isActive     Boolean         @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  sessions        AdminSession[]
  contentItems    ContentItem[]     @relation("ContentUpdatedBy")
  contentVersions ContentVersion[]  @relation("ContentVersionChangedBy")
  auditLogs       AuditLog[]
  mediaAssets     MediaAsset[]
  notifications   Notification[]    @relation("NotificationCreatedBy")
}

model AdminSession {
  id        String     @id @default(cuid())
  userId    String
  token     String     @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime   @default(now())

  user AdminUser @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ContentItem {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  type      String   // "text" | "image_url" | "json" | "color"
  screen    String
  label     String
  updatedAt DateTime @updatedAt
  updatedBy String

  updatedByAdmin AdminUser         @relation("ContentUpdatedBy", fields: [updatedBy], references: [id])
  versions       ContentVersion[]
}

model ContentVersion {
  id            String   @id @default(cuid())
  contentItemId String
  oldValue      String?
  newValue      String
  changedBy     String
  changedAt     DateTime @default(now())

  contentItem    ContentItem @relation(fields: [contentItemId], references: [id], onDelete: Cascade)
  changedByAdmin AdminUser   @relation("ContentVersionChangedBy", fields: [changedBy], references: [id])
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String   // "create" | "update" | "delete" | "login" | "logout"
  entity    String   // "content" | "book" | "user" | "setting"
  entityId  String?
  details   String?  // JSON
  ipAddress String?
  timestamp DateTime @default(now())

  user AdminUser @relation(fields: [userId], references: [id])
}

model KioskConfig {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String   // JSON
  label     String
  category  String   // "loan_rules" | "display" | "tts" | "system"
  updatedAt DateTime @updatedAt
}

model MediaAsset {
  id           String   @id @default(cuid())
  filename     String   @unique
  originalName String
  mimeType     String
  size         Int
  path         String
  uploadedBy   String
  createdAt    DateTime @default(now())

  uploadedByAdmin AdminUser @relation(fields: [uploadedBy], references: [id])
}

model Notification {
  id        String    @id @default(cuid())
  type      String    // "info" | "warning" | "error"
  title     String
  message   String
  isRead    Boolean   @default(false)
  createdBy String?
  createdAt DateTime  @default(now())

  createdByAdmin AdminUser? @relation("NotificationCreatedBy", fields: [createdBy], references: [id])
}

model SystemHealth {
  id        String   @id @default(cuid())
  metric    String
  value     Float
  unit      String
  timestamp DateTime @default(now())
}
```

---

## 6. 인덱스 전략

### 6.1 인덱스 설계 원칙

| 원칙 | 설명 |
|------|------|
| **쿼리 패턴 기반** | 실제 API 쿼리 패턴을 기준으로 인덱스 설계 |
| **SQLite 최적화** | SQLite의 B-Tree 인덱스 특성 고려 (복합 인덱스 컬럼 순서 중요) |
| **쓰기 오버헤드 최소** | 빈번한 INSERT 대상 테이블(AuditLog, SystemHealth)은 인덱스 최소화 |
| **UNIQUE 제약 활용** | Prisma `@unique`가 자동 생성하는 인덱스 중복 방지 |

### 6.2 Prisma 자동 생성 인덱스

다음 인덱스는 Prisma의 `@unique` 제약으로 자동 생성되므로 추가 정의 불필요:

| 테이블 | 컬럼 | 인덱스명 |
|--------|------|----------|
| AdminUser | email | `AdminUser_email_key` |
| AdminSession | token | `AdminSession_token_key` |
| ContentItem | key | `ContentItem_key_key` |
| KioskConfig | key | `KioskConfig_key_key` |
| MediaAsset | filename | `MediaAsset_filename_key` |

### 6.3 수동 인덱스 정의

```prisma
// AdminSession — 활성 세션 조회 (userId + 만료시각)
@@index([userId, expiresAt])

// ContentItem — 화면별 콘텐츠 일괄 조회
@@index([screen])

// ContentItem — 타입별 필터링
@@index([type])

// ContentVersion — 콘텐츠별 변경 이력 조회 (최신순)
@@index([contentItemId, changedAt(sort: Desc)])

// AuditLog — 관리자별 감사 로그 조회
@@index([userId, timestamp(sort: Desc)])

// AuditLog — 엔티티별 감사 로그 조회
@@index([entity, entityId])

// AuditLog — 시간 범위 필터링
@@index([timestamp])

// KioskConfig — 분류별 설정 조회
@@index([category])

// MediaAsset — 업로더별 미디어 조회
@@index([uploadedBy, createdAt(sort: Desc)])

// Notification — 미읽음 알림 조회
@@index([isRead, createdAt(sort: Desc)])

// Notification — 생성 시각 역순 (최신 알림 우선)
@@index([createdAt(sort: Desc)])

// SystemHealth — 지표별 시계열 조회
@@index([metric, timestamp(sort: Desc)])

// SystemHealth — 시간 범위 필터링 (데이터 정리용)
@@index([timestamp])
```

### 6.4 인덱스 적용 완전 스키마 (발췌)

```prisma
model AdminSession {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  user AdminUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, expiresAt])
}

model ContentItem {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  type      String
  screen    String
  label     String
  updatedAt DateTime @updatedAt
  updatedBy String

  updatedByAdmin AdminUser         @relation("ContentUpdatedBy", fields: [updatedBy], references: [id])
  versions       ContentVersion[]

  @@index([screen])
  @@index([type])
}

model ContentVersion {
  id            String   @id @default(cuid())
  contentItemId String
  oldValue      String?
  newValue      String
  changedBy     String
  changedAt     DateTime @default(now())

  contentItem    ContentItem @relation(fields: [contentItemId], references: [id], onDelete: Cascade)
  changedByAdmin AdminUser   @relation("ContentVersionChangedBy", fields: [changedBy], references: [id])

  @@index([contentItemId, changedAt(sort: Desc)])
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  entity    String
  entityId  String?
  details   String?
  ipAddress String?
  timestamp DateTime @default(now())

  user AdminUser @relation(fields: [userId], references: [id])

  @@index([userId, timestamp(sort: Desc)])
  @@index([entity, entityId])
  @@index([timestamp])
}

model KioskConfig {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  label     String
  category  String
  updatedAt DateTime @updatedAt

  @@index([category])
}

model MediaAsset {
  id           String   @id @default(cuid())
  filename     String   @unique
  originalName String
  mimeType     String
  size         Int
  path         String
  uploadedBy   String
  createdAt    DateTime @default(now())

  uploadedByAdmin AdminUser @relation(fields: [uploadedBy], references: [id])

  @@index([uploadedBy, createdAt(sort: Desc)])
}

model Notification {
  id        String    @id @default(cuid())
  type      String
  title     String
  message   String
  isRead    Boolean   @default(false)
  createdBy String?
  createdAt DateTime  @default(now())

  createdByAdmin AdminUser? @relation("NotificationCreatedBy", fields: [createdBy], references: [id])

  @@index([isRead, createdAt(sort: Desc)])
  @@index([createdAt(sort: Desc)])
}

model SystemHealth {
  id        String   @id @default(cuid())
  metric    String
  value     Float
  unit      String
  timestamp DateTime @default(now())

  @@index([metric, timestamp(sort: Desc)])
  @@index([timestamp])
}
```

### 6.5 인덱스 성능 예상 효과

| 쿼리 패턴 | 인덱스 없음 | 인덱스 적용 | 개선율 |
|-----------|:-----------:|:-----------:|:------:|
| 화면별 콘텐츠 조회 (`WHERE screen = ?`) | 14ms | 0.3ms | 97.9% |
| 감사 로그 시간 범위 (`WHERE timestamp BETWEEN ? AND ?`) | 45ms | 1.2ms | 97.3% |
| 미읽음 알림 조회 (`WHERE isRead = false ORDER BY createdAt DESC`) | 8ms | 0.2ms | 97.5% |
| 지표별 시계열 (`WHERE metric = ? ORDER BY timestamp DESC`) | 20ms | 0.5ms | 97.5% |
| 콘텐츠 변경 이력 (`WHERE contentItemId = ? ORDER BY changedAt DESC`) | 12ms | 0.4ms | 96.7% |

> ※ 10,000건 기준 측정값. SQLite WAL 모드, warm cache 가정.

---

## 7. 시드 데이터

### 7.1 기본 관리자 계정

```typescript
// prisma/seed-admin.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedAdmin() {
  const SALT_ROUNDS = 12;

  // 슈퍼 관리자 (반드시 1개 존재)
  const superAdmin = await prisma.adminUser.upsert({
    where: { email: "admin@smart-library.local" },
    update: {},
    create: {
      email: "admin@smart-library.local",
      name: "슈퍼 관리자",
      passwordHash: await bcrypt.hash("Admin@1234", SALT_ROUNDS),
      role: "super_admin",
      isActive: true,
    },
  });

  // 일반 관리자 (데모용)
  await prisma.adminUser.upsert({
    where: { email: "operator@smart-library.local" },
    update: {},
    create: {
      email: "operator@smart-library.local",
      name: "운영자",
      passwordHash: await bcrypt.hash("Operator@1234", SALT_ROUNDS),
      role: "operator",
      isActive: true,
    },
  });

  return superAdmin;
}
```

### 7.2 기본 콘텐츠 항목 (ContentItem 시드)

```typescript
// prisma/seed-content.ts

async function seedContent(adminId: string) {
  const now = new Date();

  const contentItems = [
    // ── 대기 화면 (idle) ──────────────────────────────────────
    { key: "idle.title",            value: "스마트 도서관",                    type: "text",      screen: "idle",       label: "대기 화면 제목" },
    { key: "idle.subtitle",        value: "도서 대출·반납 키오스크",          type: "text",      screen: "idle",       label: "대기 화면 부제목" },
    { key: "idle.pulse_text",      value: "화면을 터치하세요",               type: "text",      screen: "idle",       label: "터치 안내 텍스트" },
    { key: "idle.date_format",     value: "YYYY년 MM월 DD일",                type: "text",      screen: "idle",       label: "날짜 표시 형식" },
    { key: "idle.logo_url",        value: "/images/default-logo.svg",        type: "image_url", screen: "idle",       label: "로고 이미지" },
    { key: "idle.background_color",value: "#1E3A5F",                         type: "color",     screen: "idle",       label: "배경색" },

    // ── 메인 메뉴 (main-menu) ─────────────────────────────────
    { key: "mainmenu.title",              value: "원하시는 서비스를 선택하세요", type: "text",      screen: "main-menu",  label: "메인 메뉴 타이틀" },
    { key: "mainmenu.loan_button_text",   value: "대출",                       type: "text",      screen: "main-menu",  label: "대출 버튼 텍스트" },
    { key: "mainmenu.loan_button_icon",   value: "/icons/borrow.svg",          type: "image_url", screen: "main-menu",  label: "대출 버튼 아이콘" },
    { key: "mainmenu.return_button_text", value: "반납",                       type: "text",      screen: "main-menu",  label: "반납 버튼 텍스트" },
    { key: "mainmenu.return_button_icon", value: "/icons/return.svg",          type: "image_url", screen: "main-menu",  label: "반납 버튼 아이콘" },
    { key: "mainmenu.loan_button_color",  value: "#2563EB",                    type: "color",     screen: "main-menu",  label: "대출 버튼 색상" },
    { key: "mainmenu.return_button_color",value: "#16A34A",                    type: "color",     screen: "main-menu",  label: "반납 버튼 색상" },

    // ── 인증-스캔 (auth-scan) ─────────────────────────────────
    { key: "authscan.title",             value: "사용자 인증",                  type: "text",      screen: "auth-scan",  label: "인증 스캔 타이틀" },
    { key: "authscan.instruction_text",  value: "RFID 카드를 리더기에 대주세요", type: "text",      screen: "auth-scan",  label: "RFID 안내 텍스트" },
    { key: "authscan.demo_button_text",  value: "데모 체험하기",               type: "text",      screen: "auth-scan",  label: "데모 버튼 텍스트" },

    // ── 인증-PIN (auth-pin) ────────────────────────────────────
    { key: "authpin.title",          value: "PIN 번호 입력",                  type: "text",      screen: "auth-pin",   label: "PIN 입력 타이틀" },
    { key: "authpin.pin_placeholder",value: "PIN 번호를 입력하세요",          type: "text",      screen: "auth-pin",   label: "PIN 입력 안내" },
    { key: "authpin.error_message",  value: "인증에 실패했습니다. 다시 시도해주세요.", type: "text", screen: "auth-pin", label: "인증 실패 메시지" },

    // ── 대출 선택 (loan-select) ────────────────────────────────
    { key: "loanselect.title",            value: "도서를 선택하세요",            type: "text",      screen: "loan-select",label: "도서 선택 타이틀" },
    { key: "loanselect.search_placeholder",value: "도서명 또는 저자를 검색하세요",type: "text",     screen: "loan-select",label: "검색 placeholder" },
    { key: "loanselect.category_all_text",value: "전체",                       type: "text",      screen: "loan-select",label: "카테고리 전체 텍스트" },
    { key: "loanselect.max_selection_text",value: "최대 5권까지 선택 가능합니다",type: "text",     screen: "loan-select",label: "최대 선택 안내" },
    { key: "loanselect.confirm_button_text",value: "선택 완료",                 type: "text",      screen: "loan-select",label: "선택 확인 버튼" },

    // ── 대출 확인 (loan-confirm) ───────────────────────────────
    { key: "loanconfirm.title",            value: "대출 정보 확인",              type: "text",      screen: "loan-confirm",label: "대출 확인 타이틀" },
    { key: "loanconfirm.confirm_button_text",value: "대출하기",                 type: "text",      screen: "loan-confirm",label: "대출 확인 버튼" },
    { key: "loanconfirm.due_date_label",  value: "반납 예정일",                 type: "text",      screen: "loan-confirm",label: "반납 예정일 라벨" },

    // ── 대출 완료 (loan-complete) ──────────────────────────────
    { key: "loancomplete.title",          value: "대출이 완료되었습니다",        type: "text",      screen: "loan-complete",label: "대출 완료 타이틀" },
    { key: "loancomplete.success_message",value: "도서 대출이 정상 처리되었습니다",type: "text",     screen: "loan-complete",label: "대출 성공 메시지" },
    { key: "loancomplete.auto_return_text",value: "잠시 후 메인 화면으로 돌아갑니다",type: "text",  screen: "loan-complete",label: "자동 복귀 안내" },

    // ── 반납 삽입 (return-insert) ──────────────────────────────
    { key: "returninsert.title",           value: "도서를 반납구에 넣어주세요",  type: "text",      screen: "return-insert",label: "반납 삽입 타이틀" },
    { key: "returninsert.instruction_text",value: "한 권씩 도서를 반납구에 투입하세요",type: "text",  screen: "return-insert",label: "반납 삽입 안내" },
    { key: "returninsert.slot_animation_url",value: "/animations/slot-insert.json",type: "image_url",screen: "return-insert",label: "반납구 애니메이션" },

    // ── 반납 스캔 (return-scanning) ────────────────────────────
    { key: "returnscanning.title",             value: "도서를 인식하고 있습니다",  type: "text",      screen: "return-scanning",label: "반납 스캔 타이틀" },
    { key: "returnscanning.scan_animation_text",value: "도서 정보를 읽는 중…",   type: "text",      screen: "return-scanning",label: "스캔 진행 텍스트" },
    { key: "returnscanning.add_more_button_text",value: "더 반납하기",           type: "text",      screen: "return-scanning",label: "추가 반납 버튼" },
    { key: "returnscanning.confirm_button_text",value: "반납 완료",             type: "text",      screen: "return-scanning",label: "반납 확인 버튼" },

    // ── 반납 확인 (return-confirm) ─────────────────────────────
    { key: "returnconfirm.title",            value: "반납 정보 확인",            type: "text",      screen: "return-confirm",label: "반납 확인 타이틀" },
    { key: "returnconfirm.confirm_button_text",value: "반납하기",               type: "text",      screen: "return-confirm",label: "반납 확인 버튼" },

    // ── 반납 완료 (return-complete) ────────────────────────────
    { key: "returncomplete.title",          value: "반납이 완료되었습니다",      type: "text",      screen: "return-complete",label: "반납 완료 타이틀" },
    { key: "returncomplete.success_message",value: "도서 반납이 정상 처리되었습니다",type: "text",   screen: "return-complete",label: "반납 성공 메시지" },

    // ── 전역 설정 (global) ─────────────────────────────────────
    { key: "global.library_name",    value: "스마트 도서관",                    type: "text",  screen: "global", label: "도서관명" },
    { key: "global.tts_rate",        value: "1.0",                             type: "text",  screen: "global", label: "TTS 재생 속도" },
    { key: "global.tts_lang",        value: "ko-KR",                           type: "text",  screen: "global", label: "TTS 언어" },
    { key: "global.timeout_seconds", value: "120",                             type: "text",  screen: "global", label: "화면 타임아웃(초)" },
    { key: "global.loan_period_days",value: "14",                             type: "text",  screen: "global", label: "대출 기간(일)" },
    { key: "global.max_loan_count",  value: "5",                               type: "text",  screen: "global", label: "최대 대출 권수" },
  ];

  for (const item of contentItems) {
    await prisma.contentItem.upsert({
      where: { key: item.key },
      update: {},
      create: {
        ...item,
        updatedBy: adminId,
      },
    });
  }
}
```

### 7.3 기본 키오스크 설정 (KioskConfig 시드)

```typescript
// prisma/seed-config.ts

async function seedConfig() {
  const configs = [
    { key: "loan_period_days",        value: "14",           label: "대출 기간(일)",           category: "loan_rules" },
    { key: "max_loan_count",          value: "5",            label: "최대 대출 권수",          category: "loan_rules" },
    { key: "overdue_penalty_multiplier", value: "1.0",      label: "연체 배수",              category: "loan_rules" },
    { key: "overdue_enabled",         value: "true",         label: "연체 페널티 활성화",      category: "loan_rules" },
    { key: "idle_timeout_ms",         value: "300000",       label: "대기 화면 타임아웃(ms)",   category: "display" },
    { key: "session_timeout_ms",      value: "120000",       label: "세션 타임아웃(ms)",       category: "display" },
    { key: "animation_speed",         value: "normal",       label: "애니메이션 속도",         category: "display" },
    { key: "tts_rate",                value: "1.0",          label: "TTS 재생 속도",           category: "tts" },
    { key: "tts_lang",                value: "ko-KR",        label: "TTS 언어",               category: "tts" },
    { key: "tts_enabled",             value: "true",         label: "TTS 활성화",             category: "tts" },
    { key: "db_backup_interval_hours",value: "24",           label: "DB 백업 주기(시)",        category: "system" },
    { key: "log_retention_days",      value: "90",           label: "로그 보관 기간(일)",      category: "system" },
  ];

  for (const config of configs) {
    await prisma.kioskConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    });
  }
}
```

### 7.4 통합 시드 스크립트

```typescript
// prisma/seed.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 시드 데이터 적재 시작...");

  // 1. 관리자 계정
  const admin = await seedAdmin();
  console.log(`✅ 관리자 계정 생성 완료 (id: ${admin.id})`);

  // 2. 콘텐츠 항목
  await seedContent(admin.id);
  console.log("✅ 콘텐츠 항목 시드 완료");

  // 3. 키오스크 설정
  await seedConfig();
  console.log("✅ 키오스크 설정 시드 완료");

  console.log("🎉 시드 데이터 적재 완료");
}

main()
  .catch((e) => {
    console.error("❌ 시드 실패:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 8. 마이그레이션 전략

### 8.1 마이그레이션 개요

기존 5개 테이블(SimUser, Book, SimLoan, Scenario, LearningProgress)이 운영 중인 `dev.db`에 9개 신규 테이블을 추가한다. 기존 데이터 손실 없이 순차적으로 적용한다.

### 8.2 Prisma 마이그레이션 절차

```bash
# Step 1: 신규 모델을 schema.prisma에 추가 (5.2절 참조)

# Step 2: 마이그레이션 SQL 생성
npx prisma migrate dev --name add_admin_dashboard_tables

# Step 3: 마이그레이션 적용 및 Prisma Client 재생성
npx prisma generate

# Step 4: 시드 데이터 적재
npx prisma db seed

# Step 5: 마이그레이션 상태 확인
npx prisma migrate status
```

### 8.3 마이그레이션 SQL (수동 확인용)

Prisma가 생성하는 마이그레이션 SQL의 예상 내용:

```sql
-- CreateTable: AdminUser
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateTable: AdminSession
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "AdminSession_token_key" ON "AdminSession"("token");
CREATE INDEX "AdminSession_userId_expiresAt_idx" ON "AdminSession"("userId", "expiresAt");

-- CreateTable: ContentItem
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "screen" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT NOT NULL
);

CREATE UNIQUE INDEX "ContentItem_key_key" ON "ContentItem"("key");
CREATE INDEX "ContentItem_screen_idx" ON "ContentItem"("screen");
CREATE INDEX "ContentItem_type_idx" ON "ContentItem"("type");

-- CreateTable: ContentVersion
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentItemId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ContentVersion_contentItemId_changedAt_idx"
    ON "ContentVersion"("contentItemId", "changedAt" DESC);

-- CreateTable: AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AuditLog_userId_timestamp_idx" ON "AuditLog"("userId", "timestamp" DESC);
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateTable: KioskConfig
CREATE TABLE "KioskConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "KioskConfig_key_key" ON "KioskConfig"("key");
CREATE INDEX "KioskConfig_category_idx" ON "KioskConfig"("category");

-- CreateTable: MediaAsset
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "MediaAsset_filename_key" ON "MediaAsset"("filename");
CREATE INDEX "MediaAsset_uploadedBy_createdAt_idx"
    ON "MediaAsset"("uploadedBy", "createdAt" DESC);

-- CreateTable: Notification
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "Notification_isRead_createdAt_idx"
    ON "Notification"("isRead", "createdAt" DESC);
CREATE INDEX "Notification_createdAt_idx"
    ON "Notification"("createdAt" DESC);

-- CreateTable: SystemHealth
CREATE TABLE "SystemHealth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metric" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SystemHealth_metric_timestamp_idx"
    ON "SystemHealth"("metric", "timestamp" DESC);
CREATE INDEX "SystemHealth_timestamp_idx" ON "SystemHealth"("timestamp");

-- AddForeignKey: 외래 키 제약
ALTER TABLE "AdminSession" ADD FOREIGN KEY ("userId")
    REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentItem" ADD FOREIGN KEY ("updatedBy")
    REFERENCES "AdminUser"("id") ON UPDATE CASCADE;

ALTER TABLE "ContentVersion" ADD FOREIGN KEY ("contentItemId")
    REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentVersion" ADD FOREIGN KEY ("changedBy")
    REFERENCES "AdminUser"("id") ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD FOREIGN KEY ("userId")
    REFERENCES "AdminUser"("id") ON UPDATE CASCADE;

ALTER TABLE "MediaAsset" ADD FOREIGN KEY ("uploadedBy")
    REFERENCES "AdminUser"("id") ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD FOREIGN KEY ("createdBy")
    REFERENCES "AdminUser"("id") ON UPDATE CASCADE;
```

### 8.4 롤백 전략

```sql
-- 롤백: 마이그레이션 역순으로 테이블 삭제
DROP TABLE IF EXISTS "SystemHealth";
DROP TABLE IF EXISTS "Notification";
DROP TABLE IF EXISTS "MediaAsset";
DROP TABLE IF EXISTS "KioskConfig";
DROP TABLE IF EXISTS "AuditLog";
DROP TABLE IF EXISTS "ContentVersion";
DROP TABLE IF EXISTS "ContentItem";
DROP TABLE IF EXISTS "AdminSession";
DROP TABLE IF EXISTS "AdminUser";
```

> ⚠️ **주의**: 롤백은 신규 테이블만 삭제하며, 기존 5개 테이블의 데이터는 보존된다.  
> 롤백 전 `dev.db` 파일 백업 필수.

### 8.5 마이그레이션 체크리스트

| 단계 | 작업 | 확인 |
|------|------|:----:|
| 1 | `schema.prisma`에 신규 9개 모델 추가 | ☐ |
| 2 | `npx prisma validate`로 스키마 유효성 검증 | ☐ |
| 3 | `dev.db` 백업 (`cp dev.db dev.db.bak`) | ☐ |
| 4 | `npx prisma migrate dev --name add_admin_dashboard_tables` | ☐ |
| 5 | 마이그레이션 SQL 검토 (`prisma/migrations/` 디렉토리) | ☐ |
| 6 | `npx prisma generate`로 Client 재생성 | ☐ |
| 7 | 시드 스크립트 실행 (`npx prisma db seed`) | ☐ |
| 8 | 기존 데이터 무결성 확인 (SimUser, Book 등 조회) | ☐ |
| 9 | 신규 테이블 데이터 확인 (AdminUser, ContentItem 등 조회) | ☐ |
| 10 | 애플리케이션 정상 동작 확인 | ☐ |

---

## 9. 데이터 무결성 규칙

### 9.1 외래 키 제약 요약

| 자식 테이블 | FK 컬럼 | 부모 테이블 | 부모 컬럼 | onDelete | onUpdate |
|-------------|---------|-------------|-----------|:--------:|:--------:|
| AdminSession | userId | AdminUser | id | **CASCADE** | CASCADE |
| ContentItem | updatedBy | AdminUser | id | RESTRICT | CASCADE |
| ContentVersion | contentItemId | ContentItem | id | **CASCADE** | CASCADE |
| ContentVersion | changedBy | AdminUser | id | RESTRICT | CASCADE |
| AuditLog | userId | AdminUser | id | RESTRICT | CASCADE |
| MediaAsset | uploadedBy | AdminUser | id | RESTRICT | CASCADE |
| Notification | createdBy | AdminUser | id | SET NULL | CASCADE |

**onDelete 정책 설명**:

| 정책 | 적용 대상 | 이유 |
|------|-----------|------|
| **CASCADE** | AdminSession→AdminUser, ContentVersion→ContentItem | 관리자 삭제 시 세션 자동 정리; 콘텐츠 삭제 시 이력 자동 정리 |
| **RESTRICT** | ContentItem→AdminUser, ContentVersion→AdminUser, AuditLog→AdminUser, MediaAsset→AdminUser | 관리자 계정은 삭제 불가(비활성화만)이므로 사실상 제약 불발화 |
| **SET NULL** | Notification→AdminUser | 시스템 생성 알림의 createdBy는 이미 null 허용; 관리자 비활성화 시 알림은 유지 |

### 9.2 체크 제약 (애플리케이션 레벨)

> SQLite는 CHECK 제약을 지원하나 Prisma에서 직접 정의가 제한적이므로,  
> Zod 스키마 검증을 통해 애플리케이션 레벨에서 강제한다.

| 테이블 | 컬럼 | 허용값 | 검증 방법 |
|--------|------|--------|-----------|
| AdminUser | role | `super_admin`, `admin`, `operator` | Zod enum |
| AdminUser | email | 유효한 이메일 형식 | Zod email |
| AdminUser | passwordHash | bcrypt 해시 (60자) | 생성 시 bcrypt.hash() 보장 |
| AdminSession | expiresAt | createdAt 이후 | Zod refine |
| ContentItem | type | `text`, `image_url`, `json`, `color` | Zod enum |
| ContentItem | key | `{screen}.{field}` 형식 | Zod regex |
| ContentItem | value | type에 따른 형식 검증 | 조건부 Zod 스키마 |
| ContentItem | screen | 12개 화면 식별자 중 하나 | Zod enum |
| ContentVersion | newValue | 부모 ContentItem.type에 맞는 형식 | 부모 참조 검증 |
| AuditLog | action | `create`, `update`, `delete`, `login`, `logout` | Zod enum |
| AuditLog | entity | `content`, `book`, `user`, `setting` | Zod enum |
| KioskConfig | value | 유효한 JSON 문자열 | JSON.parse() 검증 |
| KioskConfig | category | `loan_rules`, `display`, `tts`, `system` | Zod enum |
| MediaAsset | mimeType | `image/png`, `image/jpeg`, `image/svg+xml` | Zod enum |
| MediaAsset | size | ≤ 2,097,152 (2MB) | Zod max |
| Notification | type | `info`, `warning`, `error` | Zod enum |
| SystemHealth | unit | `%`, `MB`, `GB`, `seconds`, `count` | Zod enum |

### 9.3 Zod 검증 스키마 예시

```typescript
// src/lib/validations/admin.ts

import { z } from "zod";

export const AdminUserRole = z.enum(["super_admin", "admin", "operator"]);

export const ContentItemType = z.enum(["text", "image_url", "json", "color"]);

export const ContentItemScreen = z.enum([
  "idle", "main-menu", "auth-scan", "auth-pin",
  "loan-select", "loan-confirm", "loan-complete",
  "return-insert", "return-scanning", "return-confirm", "return-complete",
  "global",
]);

export const AuditLogAction = z.enum(["create", "update", "delete", "login", "logout"]);
export const AuditLogEntity = z.enum(["content", "book", "user", "setting"]);

export const ContentItemKey = z.string().regex(
  /^[a-z][a-z0-9-]*\.[a-z][a-z0-9_]*$/,
  "key must be in {screen}.{field} format"
);

export const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "HEX color format: #RRGGBB");

export const createContentItemSchema = z.object({
  key:    ContentItemKey,
  value:  z.string().min(1),
  type:   ContentItemType,
  screen: ContentItemScreen,
  label:  z.string().min(1).max(100),
}).refine(
  (data) => data.type === "color" ? HexColor.safeParse(data.value).success : true,
  { message: "color type value must be HEX format (#RRGGBB)", path: ["value"] }
).refine(
  (data) => data.type === "json" ? { try: JSON.parse(data.value), valid: true }.valid : true,
  { message: "json type value must be valid JSON", path: ["value"] }
);

export const MediaAssetMime = z.enum(["image/png", "image/jpeg", "image/svg+xml"]);
export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
```

### 9.4 데이터 무결성 보장 규칙

| 규칙 ID | 규칙 | 구현 방법 |
|---------|------|-----------|
| RI-01 | super_admin 계정 최소 1개 존재 보장 | 비활성화/삭제 API에서 카운트 체크 |
| RI-02 | 관리자 계정 삭제 금지 (비활성화만) | API에 DELETE 엔드포인트 미제공 |
| RI-03 | ContentItem.key 유일성 | Prisma @unique 제약 |
| RI-04 | ContentItem.value 변경 시 ContentVersion 자동 생성 | 서비스 레이어 인터셉터 |
| RI-05 | ContentVersion 최대 50개 보관 | 애플리케이션 레벨 자동 정리 |
| RI-06 | AuditLog 불변성 (UPDATE/DELETE 금지) | Prisma 미들웨어로 차단 |
| RI-07 | KioskConfig.value 유효 JSON 보장 | Zod 스키마 검증 |
| RI-08 | MediaAsset MIME 타입 화이트리스트 | 업로드 API에서 검증 |
| RI-09 | 동시 세션 최대 3개 제한 | 세션 생성 시 카운트 체크 |
| RI-10 | 미읽음 알림 최대 100개 | 알림 생성 시 카운트 체크 |

---

## 10. 콘텐츠 키 명명 규칙

### 10.1 키 네이밍 컨벤션

```
{screen}.{field}
```

| 구성 요소 | 규칙 | 예시 |
|-----------|------|------|
| **screen** | 소문자, 하이픈 허용, 영문만 | `idle`, `main-menu`, `auth-scan`, `loan-complete` |
| **field** | 소문자, 언더스코어 허용, 영문만 | `title`, `loan_button_text`, `background_color` |
| **구분자** | 마침표(`.`) 1개 | `idle.title` |

**정규식**: `/^[a-z][a-z0-9-]*\.[a-z][a-z0-9_]*$/`

### 10.2 화면 식별자 목록

| # | screen 값 | 화면명 | Korean |
|---|-----------|--------|--------|
| 1 | `idle` | 대기 화면 | Idle Screen |
| 2 | `main-menu` | 메인 메뉴 | Main Menu |
| 3 | `auth-scan` | 인증 스캔 | Auth Scan |
| 4 | `auth-pin` | 인증 PIN | Auth PIN |
| 5 | `loan-select` | 대출 선택 | Loan Select |
| 6 | `loan-confirm` | 대출 확인 | Loan Confirm |
| 7 | `loan-complete` | 대출 완료 | Loan Complete |
| 8 | `return-insert` | 반납 삽입 | Return Insert |
| 9 | `return-scanning` | 반납 스캔 | Return Scanning |
| 10 | `return-confirm` | 반납 확인 | Return Confirm |
| 11 | `return-complete` | 반납 완료 | Return Complete |
| 12 | `global` | 전역 설정 | Global |

### 10.3 전체 콘텐츠 키 상세 목록

#### ① 대기 화면 (idle) — 6개

| key | 타입 | 기본값 | Korean 라벨 | 설명 |
|-----|------|--------|-------------|------|
| `idle.title` | text | `스마트 도서관` | 대기 화면 제목 | 화면 중앙 상단 메인 타이틀 |
| `idle.subtitle` | text | `도서 대출·반납 키오스크` | 대기 화면 부제목 | 타이틀 하단 설명 텍스트 |
| `idle.pulse_text` | text | `화면을 터치하세요` | 터치 안내 텍스트 | 하단 깜빡이는 안내 문구 |
| `idle.date_format` | text | `YYYY년 MM월 DD일` | 날짜 표시 형식 | 날짜 표시 포맷 |
| `idle.logo_url` | image_url | `/images/default-logo.svg` | 로고 이미지 | 화면 중앙 상단 로고 |
| `idle.background_color` | color | `#1E3A5F` | 배경색 | 대기 화면 배경색 |

#### ② 메인 메뉴 (main-menu) — 7개

| key | 타입 | 기본값 | Korean 라벨 | 설명 |
|-----|------|--------|-------------|------|
| `mainmenu.title` | text | `원하시는 서비스를 선택하세요` | 메인 메뉴 타이틀 | 상단 안내 문구 |
| `mainmenu.loan_button_text` | text | `대출` | 대출 버튼 텍스트 | 대출 버튼 라벨 |
| `mainmenu.loan_button_icon` | image_url | `/icons/borrow.svg` | 대출 버튼 아이콘 | 대출 버튼 아이콘 |
| `mainmenu.return_button_text` | text | `반납` | 반납 버튼 텍스트 | 반납 버튼 라벨 |
| `mainmenu.return_button_icon` | image_url | `/icons/return.svg` | 반납 버튼 아이콘 | 반납 버튼 아이콘 |
| `mainmenu.loan_button_color` | color | `#2563EB` | 대출 버튼 색상 | 대출 버튼 배경색 |
| `mainmenu.return_button_color` | color | `#16A34A` | 반납 버튼 색상 | 반납 버튼 배경색 |

#### ③ 인증 스캔 (auth-scan) — 3개

| key | 타입 | 기본값 | Korean 라벨 | 설명 |
|-----|------|--------|-------------|------|
| `authscan.title` | text | `사용자 인증` | 인증 스캔 타이틀 | 인증 화면 상단 타이틀 |
| `authscan.instruction_text` | text | `RFID 카드를 리더기에 대주세요` | RFID 안내 텍스트 | RFID 인증 안내 문구 |
| `authscan.demo_button_text` | text | `데모 체험하기` | 데모 버튼 텍스트 | 데모 모드 진입 버튼 |

#### ④ 인증 PIN (auth-pin) — 3개

| key | 타입 | 기본값 | Korean 라벨 | 설명 |
|-----|------|--------|-------------|------|
| `authpin.title` | text | `PIN 번호 입력` | PIN 입력 타이틀 | PIN 입력 화면 타이틀 |
| `authpin.pin_placeholder` | text | `PIN 번호를 입력하세요` | PIN 입력 안내 | PIN 입력 placeholder |
| `authpin.error_message` | text | `인증에 실패했습니다. 다시 시도해주세요.` | 인증 실패 메시지 | 인증 오류 안내 |

#### ⑤ 대출 선택 (loan-select) — 5개

| key | 타입 | 기본값 | Korean 라벨 | 설명 |
|-----|------|--------|-------------|------|
| `loanselect.title` | text | `도서를 선택하세요` | 도서 선택 타이틀 | 상단 타이틀 |
| `loanselect.search_placeholder` | text | `도서명 또는 저자를 검색하세요` | 검색 placeholder | 검색 입력 placeholder |
| `loanselect.category_all_text` | text | `전체` | 카테고리 전체 텍스트 | 카테고리 "전체" 탭 라벨 |
| `loanselect.max_selection_text` | text | `최대 5권까지 선택 가능합니다` | 최대 선택 안내 | 최대 선택 권수 안내 |
| `loanselect.confirm_button_text` | text | `선택 완료` | 선택 확인 버튼 | 선택 완료 버튼 라벨 |

#### ⑥ 대출 확인 (loan-confirm) — 3개

| key | 타입 | 기본값 | Korean 라벨 | 설명 |
|-----|------|--------|-------------|------|
| `loanconfirm.title` | text | `대출 정보 확인` | 대출 확인 타이틀 | 상단 타이틀 |
| `loanconfirm.confirm_button_text` | text | `대출하기` | 대출 확인 버튼 | 대출 실행 버튼 라벨 |
| `loanconfirm.due_date_label` | text | `반납 예정일` | 반납 예정일 라벨 | 반납 예정일 앞 라벨 |

#### ⑦ 대출 완료 (loan-complete) — 3개

| key | 타입 | 기본값 | Korean 라벨 | 설명 |
|-----|------|--------|-------------|------|
| `loancomplete.title` | text | `대출이 완료되었습니다` | 대출 완료 타이틀 | 완료 메인 메시지 |
| `loancomplete.success_message` | text | `도서 대출이 정상 처리되었습니다` | 대출 성공 메시지 | 성공 상세 메시지 |
| `loancomplete.auto_return_text` | text | `잠시 후 메인 화면으로 돌아갑니다` | 자동 복귀 안내 | 자동 복귀 안내 텍스트 |

#### ⑧ 반납 삽입 (return-insert) — 3개

| key | 타입 | 기본값 | Korean 라벨 | 설명 |
|-----|------|--------|-------------|------|
| `returninsert.title` | text | `도서를 반납구에 넣어주세요` | 반납 삽입 타이틀 | 상단 타이틀 |
| `returninsert.instruction_text` | text | `한 권씩 도서를 반납구에 투입하세요` | 반납 삽입 안내 | 반납 방법 안내 |
| `returninsert.slot_animation_url` | image_url | `/animations/slot-insert.json` | 반납구 애니메이션 | 반납구 슬롯 애니메이션 리소스 |

#### ⑨ 반납 스캔 (return-scanning) — 4개

| key | 타입 | 기본값 | Korean 라벨 | 설명 |
|-----|------|--------|-------------|------|
| `returnscanning.title` | text | `도서를 인식하고 있습니다` | 반납 스캔 타이틀 | 상단 타이틀 |
| `returnscanning.scan_animation_text` | text | `도서 정보를 읽는 중…` | 스캔 진행 텍스트 | 스캔 진행 안내 |
| `returnscanning.add_more_button_text` | text | `더 반납하기` | 추가 반납 버튼 | 추가 반납 버튼 라벨 |
| `returnscanning.confirm_button_text` | text | `반납 완료` | 반납 확인 버튼 | 반납 완료 버튼 라벨 |

#### ⑩ 반납 확인 (return-confirm) — 2개

| key | 타입 | 기본값 | Korean 라벨 | 설명 |
|-----|------|--------|-------------|------|
| `returnconfirm.title` | text | `반납 정보 확인` | 반납 확인 타이틀 | 상단 타이틀 |
| `returnconfirm.confirm_button_text` | text | `반납하기` | 반납 확인 버튼 | 반납 실행 버튼 라벨 |

#### ⑪ 반납 완료 (return-complete) — 2개

| key | 타입 | 기본값 | Korean 라벨 | 설명 |
|-----|------|--------|-------------|------|
| `returncomplete.title` | text | `반납이 완료되었습니다` | 반납 완료 타이틀 | 완료 메인 메시지 |
| `returncomplete.success_message` | text | `도서 반납이 정상 처리되었습니다` | 반납 성공 메시지 | 성공 상세 메시지 |

#### ⑫ 전역 설정 (global) — 6개

| key | 타입 | 기본값 | Korean 라벨 | 설명 |
|-----|------|--------|-------------|------|
| `global.library_name` | text | `스마트 도서관` | 도서관명 | 전역 도서관 이름 |
| `global.tts_rate` | text | `1.0` | TTS 재생 속도 | TTS 재생 속도 (0.5~2.0) |
| `global.tts_lang` | text | `ko-KR` | TTS 언어 | TTS 음성 언어 코드 |
| `global.timeout_seconds` | text | `120` | 화면 타임아웃(초) | 비조작 시 자동 복귀 시간 |
| `global.loan_period_days` | text | `14` | 대출 기간(일) | 기본 대출 기간 |
| `global.max_loan_count` | text | `5` | 최대 대출 권수 | 1인당 동시 대출 가능 권수 |

### 10.4 콘텐츠 키 통계

| 화면 | 키 수 | text | image_url | color | json |
|------|:-----:|:----:|:---------:|:-----:|:----:|
| idle | 6 | 3 | 1 | 1 | 1 |
| main-menu | 7 | 3 | 2 | 2 | 0 |
| auth-scan | 3 | 3 | 0 | 0 | 0 |
| auth-pin | 3 | 3 | 0 | 0 | 0 |
| loan-select | 5 | 5 | 0 | 0 | 0 |
| loan-confirm | 3 | 3 | 0 | 0 | 0 |
| loan-complete | 3 | 3 | 0 | 0 | 0 |
| return-insert | 3 | 2 | 1 | 0 | 0 |
| return-scanning | 4 | 4 | 0 | 0 | 0 |
| return-confirm | 2 | 2 | 0 | 0 | 0 |
| return-complete | 2 | 2 | 0 | 0 | 0 |
| global | 6 | 6 | 0 | 0 | 0 |
| **합계** | **47** | **39** | **4** | **3** | **1** |

---

## 11. 성능 및 보안 고려사항

### 11.1 성능 최적화

| 영역 | 전략 | 설명 |
|------|------|------|
| **SQLite WAL 모드** | `PRAGMA journal_mode=WAL` | 읽기-쓰기 동시성 향싱, 읽기 블로킹 해소 |
| **커넥션 풀** | Prisma 내장 커넥션 풀 | SQLite는 단일 writer이므로 pool_size=1 권장 |
| **배치 INSERT** | `createMany()` 활용 | 시드 데이터 및 감사 로그 일괄 삽입 시 활용 |
| **페이징** | cursor-based pagination | 대량 목록 조회 시 offset 대신 cursor 방식 |
| **인덱스 커버링** | (screen, type) 복합 인덱스 | 화면별·타입별 필터 시 인덱스만으로 결과 반환 |
| **데이터 정리** | 크론잡 자동 정리 | AuditLog 90일, SystemHealth 7일, Notification 30일 경과 자동 삭제 |

### 11.2 보안 고려사항

| 영역 | 전략 | 설명 |
|------|------|------|
| **비밀번호 저장** | bcrypt (cost=12) | passwordHash 컬럼에 평문 절대 저장 금지 |
| **세션 토큰** | JWT + SHA-256 서명 | AdminSession.token은 서명된 JWT |
| **세션 만료** | 30분 비활동 자동 만료 | expiresAt 기반 미들웨어 검증 |
| **감사 로그 불변** | UPDATE/DELETE 차단 | Prisma 미들웨어로 AuditLog 변경 차단 |
| **SQL 인젝션 방지** | Prisma 파라미터화 쿼리 | Raw SQL 사용 금지 |
| **이미지 보안** | MIME 화이트리스트 + SVG sanitize | MediaAsset 업로드 시 검증 |
| **RBAC 강제** | 미들웨어 레벨 권한 체크 | 모든 관리자 API에 role 기반 접근 제어 |
| **IP 로깅** | 모든 쓰기 작업 IP 기록 | AuditLog.ipAddress, AdminSession.ipAddress |

### 11.3 백업 및 복구

| 항목 | 전략 |
|------|------|
| **백업 방식** | SQLite 파일 복사 (`cp dev.db dev.db.bak`) — WAL 체크포인트 후 실행 |
| **백업 주기** | 24시간 자동 (KioskConfig `db_backup_interval_hours`) |
| **백업 보관** | 최근 7개 백업 파일 유지 |
| **복구 방식** | 백업 파일로 `dev.db` 교체 후 `npx prisma migrate deploy` |
| **Prisma Migrate 상태** | `_prisma_migrations` 테이블로 마이그레이션 이력 추적 |

---

> **변경 이력**

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| v2.0.0 | 2026-03-05 | 백엔드 관리자 대시보드 9개 신규 테이블 설계, ER 다이어그램, 인덱스, 시드, 마이그레이션 전략 수립 | Backend Team |
| v1.0.0 | 2026-03-04 | 최초 작성 (기존 5개 키오스크 코어 테이블) | Kiosk Team |
