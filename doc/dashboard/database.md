# 스마트 도서관 키오스크 관리자 대시보드 — 데이터베이스 설계 문서

> **버전**: v1.0.0  
> **작성일**: 2026-03-04  
> **DB 엔진**: SQLite 3.x (WAL 모드)  
> **ORM**: Prisma 5.x  
> **문서 상태**: Production-ready

---

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [기존 테이블 요약](#2-기존-테이블-요약)
3. [신규 테이블 상세 설계](#3-신규-테이블-상세-설계)
4. [ER 다이어그램](#4-er-다이어그램)
5. [Prisma Schema](#5-prisma-schema)
6. [인덱스 전략](#6-인덱스-전략)
7. [시드 데이터](#7-시드-데이터)
8. [마이그레이션 전략](#8-마이그레이션-전략)
9. [데이터 접근 패턴](#9-데이터-접근-패턴)
10. [성능 고려사항](#10-성능-고려사항)
11. [보안 고려사항](#11-보안-고려사항)

---

## 1. 아키텍처 개요

### 1.1 설계 원칙

| 원칙 | 설명 |
|------|------|
| **관심사 분리** | 키오스크 운영 데이터(SimUser, Book, SimLoan…)와 관리자 도메인(AdminUser, AuditLog…)을 명확히 분리 |
| **감사 추적 우선** | 모든 관리자 행위는 AuditLog에 기록되어 규제 대응 및 장애 원인 분석 보장 |
| **JSON 유연성** | CMS 콘텐츠, 키오스크 설정 등 스키마 변동이 잦은 영역은 JSON 컬럼 활용 |
| **SQLite 최적화** | SQLite 제약(단일 writer, JSON 지원 등)을 고려한 인덱스 및 트랜잭션 설계 |

### 1.2 도메인 분류

```
┌─────────────────────────────────────────────────────────┐
│                    Database Domains                      │
├──────────────┬──────────────┬───────────────────────────┤
│  Kiosk Core  │  Admin Ops   │  System Infra             │
├──────────────┼──────────────┼───────────────────────────┤
│  SimUser     │  AdminUser   │  SystemSetting            │
│  Book        │  AdminRole   │  AuditLog                 │
│  SimLoan     │  CmsContent  │  KioskDevice              │
│  Scenario    │  CmsImage    │  Notice                   │
│  LearningPro │  DashboardSt │                           │
│  gress       │              │                           │
└──────────────┴──────────────┴───────────────────────────┘
```

---

## 2. 기존 테이블 요약

> 아래 테이블은 현재 `schema.prisma`에 이미 정의되어 있으며, 신규 테이블과의 관계만 추가로 명시한다.

### 2.1 SimUser — 시뮬레이션 사용자

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | String | PK, cuid() | 사용자 고유 ID |
| name | String | NOT NULL | 성명 |
| birthDate | String | NOT NULL | 생년월일 (YYYY-MM-DD) |
| phone | String | NOT NULL | 연락처 |
| address | String | nullable | 주소 |
| cardType | String | default("mobile") | 카드 유형 |
| cardNumber | String | UNIQUE, nullable | 카드 번호 |
| cardIssued | String | nullable | 카드 발급일 |
| pin | String | UNIQUE, nullable | PIN 번호 |
| isActive | Boolean | default(true) | 활성 상태 |
| createdAt | DateTime | default(now()) | 생성 시각 |
| updatedAt | DateTime | @updatedAt | 갱신 시각 |

### 2.2 Book — 도서

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

### 2.3 SimLoan — 대출 기록

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

### 2.4 LearningProgress — 학습 진도

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

### 2.5 Scenario — 시나리오

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

## 3. 신규 테이블 상세 설계

### 3.1 AdminUser — 관리자 계정

관리자 대시보드에 로그인하는 모든 계정을 관리한다. RBAC(Role-Based Access Control)의 주체 엔티티이다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 관리자 고유 ID |
| email | String | **UNIQUE**, NOT NULL | — | 로그인 이메일 |
| passwordHash | String | NOT NULL | — | bcrypt 해시 (cost=12) |
| name | String | NOT NULL | — | 표시 이름 |
| role | String | NOT NULL | "operator" | 권한 등급: `super_admin` / `admin` / `operator` |
| isActive | Boolean | NOT NULL | true | 계정 활성 여부 (비활성 시 로그인 불가) |
| lastLoginAt | DateTime | nullable | null | 마지막 로그인 시각 |
| createdAt | DateTime | NOT NULL | now() | 생성 시각 |
| updatedAt | DateTime | NOT NULL | @updatedAt | 갱신 시각 |

**관계**:
- `AdminUser 1:N AuditLog` — 관리자의 모든 감사 로그
- `AdminUser 1:N CmsContent` — CMS 콘텐츠 최종 수정자
- `AdminUser 1:N CmsImage` — 이미지 업로더
- `AdminUser 1:N Notice` — 공지 작성자

**비즈니스 규칙**:
- `super_admin` 계정은 최소 1개 존재해야 함 (시드 데이터로 보장)
- `email` 형식은 애플리케이션 레이어에서 검증 (Prisma 수준에서는 String)
- 비밀번호는 평문 저장 절대 금지 — 반드시 bcrypt hash
- `isActive = false`인 계정은 인증 미들웨어에서 차단

---

### 3.2 AdminRole — 권한 역할 정의

세분화된 권한(permission)을 역할 단위로 그룹화한다. `AdminUser.role`과 연계되어 사용된다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 역할 고유 ID |
| name | String | **UNIQUE**, NOT NULL | — | 역할 식별자 (예: `super_admin`, `admin`, `operator`) |
| displayName | String | NOT NULL | — | UI 표시명 (예: "최고 관리자") |
| description | String | nullable | null | 역할 설명 |
| permissions | String | NOT NULL | "[]" | 권한 목록 JSON 배열 (예: `["user:read","user:write","loan:read"]`) |
| createdAt | DateTime | NOT NULL | now() | 생성 시각 |

**permissions JSON 스키마**:

```json
{
  "type": "array",
  "items": {
    "type": "string",
    "pattern": "^[a-z]+:(read|write|delete|manage)$"
  },
  "examples": [
    ["user:read", "user:write", "loan:read", "loan:write", "book:read", "book:write", "cms:manage", "system:manage"],
    ["user:read", "loan:read", "book:read"],
    ["loan:read"]
  ]
}
```

**권한 매트릭스**:

| 권한 코드 | super_admin | admin | operator |
|-----------|:-----------:|:-----:|:--------:|
| user:read | O | O | O |
| user:write | O | O | X |
| user:delete | O | X | X |
| loan:read | O | O | O |
| loan:write | O | O | O |
| book:read | O | O | O |
| book:write | O | O | X |
| book:delete | O | X | X |
| cms:manage | O | O | X |
| system:manage | O | X | X |
| audit:read | O | O | X |
| kiosk:manage | O | O | X |

---

### 3.3 AuditLog — 감사 추적 로그

관리자 대시보드에서 발생하는 모든 데이터 변경 사항을 기록한다. 복구, 규제 대응, 장애 원인 분석의 핵심 데이터이다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 로그 고유 ID |
| adminUserId | String | FK → AdminUser.id, NOT NULL | — | 행위자 관리자 ID |
| action | String | NOT NULL | — | 행위 유형: `create` / `update` / `delete` / `login` / `logout` / `export` |
| entity | String | NOT NULL | — | 대상 엔티티명 (예: `SimUser`, `Book`, `CmsContent`) |
| entityId | String | nullable | null | 대상 엔티티 ID (엔티티가 특정 인스턴스인 경우) |
| oldValue | String | nullable | null | 변경 전 값 JSON (create의 경우 null) |
| newValue | String | nullable | null | 변경 후 값 JSON (delete의 경우 null) |
| ip | String | nullable | null | 클라이언트 IP 주소 |
| userAgent | String | nullable | null | 클라이언트 User-Agent |
| createdAt | DateTime | NOT NULL | now() | 로그 발생 시각 |

**관계**:
- `AuditLog N:1 AdminUser` — 행위자 참조

**비즈니스 규칙**:
- AuditLog은 **절대 UPDATE/DELETE 불가** (append-only)
- `oldValue`/`newValue`는 변경된 필드만 포함하는 diff 형식 권장
- 대량 변경(bulk update) 시 행 단위로 개별 AuditLog 레코드 생성
- 90일 이상 된 로그는 아카이브 테이블로 이관 (애플리케이션 배치 잡)

**AuditLog 예시**:

```json
{
  "id": "clxyz123",
  "adminUserId": "cladmin001",
  "action": "update",
  "entity": "CmsContent",
  "entityId": "clcms0042",
  "oldValue": "{\"value\": \"#1E40AF\"}",
  "newValue": "{\"value\": \"#2563EB\"}",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
  "createdAt": "2026-03-04T09:15:00.000Z"
}
```

---

### 3.4 CmsContent — CMS 콘텐츠 항목

대시보드 화면의 텍스트, 색상, 수치 등 커스터마이징 가능한 모든 콘텐츠를 key-value 형태로 관리한다. 코드 배포 없이 UI 변경이 가능하다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 콘텐츠 고유 ID |
| key | String | **UNIQUE**, NOT NULL | — | 콘텐츠 식별자 (예: `home.heroTitle`, `theme.primaryColor`) |
| screen | String | NOT NULL | — | 소속 화면 (예: `home`, `stats`, `loan`, `book`) |
| type | String | NOT NULL | "text" | 값 타입: `text` / `image` / `color` / `number` / `json` |
| value | String | nullable | null | 현재 값 |
| defaultValue | String | nullable | null | 초기값 (복원 기준) |
| description | String | nullable | null | 항목 설명 (관리자 UI에서 표시) |
| updatedAt | DateTime | NOT NULL | @updatedAt | 최종 갱신 시각 |
| updatedBy | String | FK → AdminUser.id, nullable | null | 최종 수정 관리자 ID |

**key 네이밍 컨벤션**:

```
{screen}.{section}.{field}

예:
  home.heroTitle          — 홈 화면 히어로 타이틀
  home.heroSubtitle       — 홈 화면 히어로 서브타이틀
  theme.primaryColor      — 테마 기본 색상
  theme.secondaryColor    — 테마 보조 색상
  stats.showPeakHour      — 통계 화면 피크 시간 표시 여부
  loan.maxExtendCount     — 대출 연장 최대 횟수
  kiosk.idleTimeout       — 키오스크 유휴 타임아웃(초)
```

**관계**:
- `CmsContent N:1 AdminUser` — 최종 수정자 참조 (updatedBy)

---

### 3.5 CmsImage — CMS 이미지 관리

대시보드 및 키오스크 화면에 사용되는 이미지 리소스를 관리한다. 파일은 로컬 디스크 또는 OSS에 저장하고, 메타데이터를 DB에서 관리한다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 이미지 고유 ID |
| key | String | **UNIQUE**, NOT NULL | — | 이미지 식별자 (예: `home.heroBg`, `logo.main`) |
| originalName | String | NOT NULL | — | 원본 파일명 |
| storedPath | String | NOT NULL | — | 저장 경로 (예: `/uploads/cms/2026/03/abc.webp`) |
| mimeType | String | NOT NULL | — | MIME 타입 (예: `image/webp`, `image/png`) |
| sizeBytes | Int | NOT NULL | — | 파일 크기 (바이트) |
| width | Int | nullable | null | 이미지 너비 (px) |
| height | Int | nullable | null | 이미지 높이 (px) |
| alt | String | nullable | null | 대체 텍스트 (접근성) |
| updatedAt | DateTime | NOT NULL | @updatedAt | 최종 갱신 시각 |
| uploadedBy | String | FK → AdminUser.id, nullable | null | 업로드 관리자 ID |

**비즈니스 규칙**:
- 허용 MIME 타입: `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`
- 최대 파일 크기: 5MB (애플리케이션 레이어에서 검증)
- 업로드 시 WebP 자동 변환 권장 (SVG 제외)
- 이미지 교체 시 기존 파일은 소프트 삭제 후 30일 경과 시 물리 삭제

---

### 3.6 KioskDevice — 키오스크 기기 관리

현장에 설치된 키오스크 단말기의 등록, 상태 모니터링, 원격 설정을 지원한다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 기기 고유 ID |
| name | String | NOT NULL | — | 기기 표시명 (예: "1층 로비 A") |
| location | String | NOT NULL | — | 설치 위치 (예: "1층 로비", "3층 아동실") |
| ipAddress | String | nullable | null | 기기 IP 주소 |
| status | String | NOT NULL | "offline" | 상태: `online` / `offline` / `maintenance` |
| lastHeartbeat | DateTime | nullable | null | 마지막 heartbeat 수신 시각 |
| settings | String | nullable | null | 기기별 설정 JSON (예:idle 타임아웃, 볼륨 등) |
| createdAt | DateTime | NOT NULL | now() | 등록 시각 |

**settings JSON 스키마**:

```json
{
  "type": "object",
  "properties": {
    "idleTimeout": { "type": "number", "default": 120, "description": "유휴 타임아웃 (초)" },
    "volume": { "type": "number", "default": 80, "minimum": 0, "maximum": 100 },
    "brightness": { "type": "number", "default": 100, "minimum": 0, "maximum": 100 },
    "autoRestart": { "type": "boolean", "default": true },
    "restartHour": { "type": "number", "default": 3, "minimum": 0, "maximum": 23 }
  }
}
```

**비즈니스 규칙**:
- heartbeat: 키오스크가 30초 간격으로 PATCH 요청 → `lastHeartbeat` 갱신, `status = "online"`
- `lastHeartbeat`가 2분 이상 갱신 없으면 → `status = "offline"` (서버 사이드 감지)
- `maintenance` 상태는 관리자가 수동 설정 → 해당 기기 서비스 중단 페이지 표시

---

### 3.7 SystemSetting — 시스템 설정

시스템 전반에 걸친 설정 항목을 category + key 복합 유일 키로 관리한다. `CmsContent`가 화면 커스터마이징이라면, `SystemSetting`은 백엔드 로직 제어에 사용된다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 설정 고유 ID |
| category | String | NOT NULL | — | 설정 카테고리 (예: `loan`, `kiosk`, `notification`) |
| key | String | NOT NULL | — | 설정 키 (카테고리 내 유일) |
| value | String | nullable | null | 현재 값 |
| defaultValue | String | nullable | null | 초기값 |
| type | String | NOT NULL | "string" | 값 타입: `string` / `number` / `boolean` / `json` |
| description | String | nullable | null | 설정 설명 |
| updatedAt | DateTime | NOT NULL | @updatedAt | 갱신 시각 |

**유일 제약**: `@@unique([category, key])` — 동일 카테고리 내 키 중복 불가

**설정 항목 예시**:

| category | key | defaultValue | type | 설명 |
|----------|-----|-------------|------|------|
| loan | maxLoanCount | "5" | number | 1인 최대 대출 권수 |
| loan | loanPeriodDays | "14" | number | 기본 대출 기간 (일) |
| loan | extendDays | "7" | number | 연장 기간 (일) |
| loan | maxExtendCount | "2" | number | 최대 연장 횟수 |
| kiosk | heartbeatIntervalSec | "30" | number | heartbeat 간격 (초) |
| kiosk | offlineThresholdSec | "120" | number | 오프라인 판정 임계값 (초) |
| notification | overdueReminderDay | "3" | number | 연체 알림 시작일 |
| notification | smtpEnabled | "false" | boolean | SMTP 알림 사용 여부 |

---

### 3.8 Notice — 공지/알림

관리자가 작성하는 공지사항으로, 대시보드 및 키오스크 화면에 표시된다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 공지 고유 ID |
| title | String | NOT NULL | — | 제목 |
| content | String | NOT NULL | — | 본문 (Markdown 지원) |
| type | String | NOT NULL | "info" | 유형: `info` / `warning` / `urgent` |
| isActive | Boolean | NOT NULL | true | 활성 여부 |
| startAt | DateTime | NOT NULL | now() | 게시 시작 시각 |
| endAt | DateTime | nullable | null | 게시 종료 시각 (null = 무기한) |
| createdAt | DateTime | NOT NULL | now() | 생성 시각 |
| createdBy | String | FK → AdminUser.id, nullable | null | 작성 관리자 ID |

**비즈니스 규칙**:
- 화면에 표시할 공지 조회 조건: `isActive = true AND startAt <= now() AND (endAt IS NULL OR endAt > now())`
- `urgent` 타입 공지는 항상 최상단에 표시
- `endAt` 도달 시 자동으로 `isActive = false` 처리 (배치 또는 조회 시 평가)

---

### 3.9 DashboardStat — 대시보드 통계 스냅샷

대시보드 렌더링 성능을 위해, 원시 트랜잭션 데이터(SimLoan 등)를 일 단위로 집계하여 스냅샷으로 저장한다. 실시간 집계 쿼리 부하를 방지한다.

| 컬럼 | 타입 | 제약 | 기본값 | 설명 |
|------|------|------|--------|------|
| id | String | **PK**, cuid() | 자동 생성 | 통계 고유 ID |
| date | String | NOT NULL | — | 집계 일자 (YYYY-MM-DD, 유일) |
| totalLoans | Int | NOT NULL | 0 | 당일 총 대출 건수 |
| activeLoans | Int | NOT NULL | 0 | 현재 활성 대출 건수 |
| returns | Int | NOT NULL | 0 | 당일 반납 건수 |
| overdue | Int | NOT NULL | 0 | 현재 연체 건수 |
| newUsers | Int | NOT NULL | 0 | 당일 신규 가입자 수 |
| peakHour | Int | nullable | null | 당일 피크 시간대 (0~23) |
| createdAt | DateTime | NOT NULL | now() | 레코드 생성 시각 |

**유일 제약**: `@@unique([date])` — 일별 단일 스냅샷

**비즈니스 규칙**:
- 매일 00:05 (KST)에 전일 집계 배치 실행 → upsert
- 대시보드 로딩 시 별도 실시간 쿼리 없이 `DashboardStat`만 조회
- 피크 시간대는 당일 시간별 대출 건수 중 최빈 시간으로 산출
- 최근 30일 데이터는 인메모리 캐시에 유지 (TTL = 5분)

---

## 4. ER 다이어그램

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              ER Diagram — Smart Library Kiosk Admin                  │
└──────────────────────────────────────────────────────────────────────────────────────┘

 ╔═══════════╗       ╔═══════════╗       ╔═══════════╗
 ║  SimUser  ║       ║   Book    ║       ║ Scenario  ║
 ╠═══════════╣       ╠═══════════╣       ╠═══════════╣
 ║ PK id     ║       ║ PK id     ║       ║ PK id     ║
 ║ name      ║       ║ isbn (UQ) ║       ║ title     ║
 ║ birthDate ║       ║ title     ║       ║ stepsJson ║
 ║ phone     ║       ║ author    ║       ║ difficulty║
 ║ cardNum(U)║       ║ totalCop  ║       ║ orderIdx  ║
 ║ pin (UQ)  ║       ║ availCop  ║       ╚══════╤════╝
 ╚════╤══════╝       ╚════╤══════╝              │
      │ 1                  │ 1                    │
      │                    │                      │
      │ N                  │ N                    │ N
 ╔════╧══════╗       ╔════╧══════╗       ╔══════╧══════╗
 ║  SimLoan  ║       ║           ║       ║  Learning   ║
 ╠═══════════╣       ║           ║       ║  Progress   ║
 ║ PK id     ║       ║           ║       ╠═════════════╣
 ║ FK userId ║───────║───────────║───────║ FK userId   ║
 ║ FK bookId ║───────║           ║       ║ FK scenId   ║
 ║ status    ║       ║           ║       ║ stepIndex   ║
 ╚═══════════╝       ║           ║       ║ completed   ║
                     ║           ║       ╚═════════════╝
                     ║           ║
 ╔═══════════════════╧═══════════╧══════════════════════════════╗
 ║                    Admin Domain                               ║
 ╠══════════════════════════════════════════════════════════════╣
 ║                                                              ║
 ║  ╔════════════╗        ╔════════════╗                       ║
 ║  ║ AdminUser  ║        ║ AdminRole  ║                       ║
 ║  ╠════════════╣        ╠════════════╣                       ║
 ║  ║ PK id      ║        ║ PK id      ║                       ║
 ║  ║ email (UQ) ║        ║ name (UQ)  ║                       ║
 ║  ║ passHash   ║        ║ displayNm  ║                       ║
 ║  ║ name       ║        ║ perms[JSON]║                       ║
 ║  ║ role       ║        ╚════════════╝                       ║
 ║  ║ isActive   ║                                             ║
 ║  ╚════╤═══════╝                                             ║
 ║       │ 1                                                    ║
 ║       │                                                      ║
 ║       ├──────────── N ────────────┐                          ║
 ║       │                           │                          ║
 ║  ╔════╧══════╗  ╔════════════════╧═════╗  ╔════════════╗  ║
 ║  ║ AuditLog  ║  ║     CmsContent      ║  ║  CmsImage   ║  ║
 ║  ╠═══════════╣  ╠═════════════════════╣  ╠═════════════╣  ║
 ║  ║ PK id     ║  ║ PK id              ║  ║ PK id        ║  ║
 ║  ║ FK adminId║  ║ key (UQ)           ║  ║ key (UQ)     ║  ║
 ║  ║ action    ║  ║ screen             ║  ║ storedPath   ║  ║
 ║  ║ entity    ║  ║ type               ║  ║ mimeType     ║  ║
 ║  ║ old[JSON] ║  ║ value              ║  ║ sizeBytes    ║  ║
 ║  ║ new[JSON] ║  ║ FK updatedBy       ║  ║ FK uploadedBy║  ║
 ║  ╚═══════════╝  ╚═════════════════════╝  ╚═════════════╝  ║
 ║                                                              ║
 ║  ╔════════════╗  ╔════════════════╗  ╔════════════════╗    ║
 ║  ║KioskDevice║  ║ SystemSetting  ║  ║ DashboardStat  ║    ║
 ║  ╠════════════╣  ╠════════════════╣  ╠════════════════╣    ║
 ║  ║ PK id      ║  ║ PK id         ║  ║ PK id          ║    ║
 ║  ║ name       ║  ║ category      ║  ║ date (UQ)      ║    ║
 ║  ║ location   ║  ║ key           ║  ║ totalLoans     ║    ║
 ║  ║ status     ║  ║ @@unique(cat, ║  ║ activeLoans    ║    ║
 ║  ║ settings   ║  ║         key)  ║  ║ returns        ║    ║
 ║  ║ lastHeart  ║  ║ value         ║  ║ overdue        ║    ║
 ║  ╚════════════╝  ╚════════════════╝  ╚════════════════╝    ║
 ║                                                              ║
 ║  ╔════════════╗                                             ║
 ║  ║  Notice    ║                                             ║
 ║  ╠════════════╣                                             ║
 ║  ║ PK id      ║                                             ║
 ║  ║ title      ║                                             ║
 ║  ║ content    ║                                             ║
 ║  ║ type       ║                                             ║
 ║  ║ startAt    ║                                             ║
 ║  ║ endAt      ║                                             ║
 ║  ║ FK createdBy║                                            ║
 ║  ╚════════════╝                                             ║
 ╚══════════════════════════════════════════════════════════════╝

 관계 요약:
 ─────────────────────────────────────────────────────────────
 AdminUser ──1:N──▶ AuditLog       (adminUserId)
 AdminUser ──1:N──▶ CmsContent     (updatedBy)
 AdminUser ──1:N──▶ CmsImage       (uploadedBy)
 AdminUser ──1:N──▶ Notice         (createdBy)
 SimUser   ──1:N──▶ SimLoan        (userId)
 SimUser   ──1:N──▶ LearningProgress (userId)
 Book      ──1:N──▶ SimLoan        (bookId)
 Scenario  ──1:N──▶ LearningProgress (scenarioId)
```

---

## 5. Prisma Schema

아래는 기존 스키마에 신규 모델을 추가한 전체 내용이다.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
//  Kiosk Core Domain (기존)
// ─────────────────────────────────────────────

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

  loans    SimLoan[]
  progress LearningProgress[]
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

  loans SimLoan[]
}

model SimLoan {
  id         String   @id @default(cuid())
  userId     String
  bookId     String
  loanDate   String
  dueDate    String
  returnDate String?
  status     String   @default("active")
  method     String?  @default("counter")
  extended   Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user SimUser @relation(fields: [userId], references: [id])
  book Book    @relation(fields: [bookId], references: [id])
}

model LearningProgress {
  id          String   @id @default(cuid())
  userId      String
  scenarioId  String
  stepIndex   Int      @default(0)
  completed   Boolean  @default(false)
  attempts    Int      @default(0)
  bestTimeSec Int?
  stars       Int      @default(0)
  updatedAt   DateTime @updatedAt

  user     SimUser  @relation(fields: [userId], references: [id])
  scenario Scenario @relation(fields: [scenarioId], references: [id])
}

model Scenario {
  id          String   @id @default(cuid())
  title       String
  description String?
  difficulty  String   @default("beginner")
  stepsJson   String
  category    String?
  orderIndex  Int      @default(0)

  progress LearningProgress[]
}

// ─────────────────────────────────────────────
//  Admin Domain (신규)
// ─────────────────────────────────────────────

model AdminUser {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  name         String
  role         String    @default("operator")
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  auditLogs   AuditLog[]   @relation("AdminAuditLogs")
  cmsContents CmsContent[] @relation("AdminCmsUpdates")
  cmsImages   CmsImage[]   @relation("AdminCmsUploads")
  notices     Notice[]     @relation("AdminNotices")
}

model AdminRole {
  id          String   @id @default(cuid())
  name        String   @unique
  displayName String
  description String?
  permissions String   @default("[]")
  createdAt   DateTime @default(now())
}

model AuditLog {
  id           String    @id @default(cuid())
  adminUserId  String
  action       String
  entity       String
  entityId     String?
  oldValue     String?
  newValue     String?
  ip           String?
  userAgent    String?
  createdAt    DateTime  @default(now())

  adminUser AdminUser @relation("AdminAuditLogs", fields: [adminUserId], references: [id])

  @@index([adminUserId])
  @@index([entity, entityId])
  @@index([action])
  @@index([createdAt])
}

model CmsContent {
  id           String    @id @default(cuid())
  key          String    @unique
  screen       String
  type         String    @default("text")
  value        String?
  defaultValue String?
  description  String?
  updatedAt    DateTime  @updatedAt
  updatedBy    String?

  adminUser AdminUser? @relation("AdminCmsUpdates", fields: [updatedBy], references: [id])

  @@index([screen])
  @@index([type])
}

model CmsImage {
  id           String    @id @default(cuid())
  key          String    @unique
  originalName String
  storedPath   String
  mimeType     String
  sizeBytes    Int
  width        Int?
  height       Int?
  alt          String?
  updatedAt    DateTime  @updatedAt
  uploadedBy   String?

  adminUser AdminUser? @relation("AdminCmsUploads", fields: [uploadedBy], references: [id])

  @@index([mimeType])
}

model KioskDevice {
  id            String    @id @default(cuid())
  name          String
  location      String
  ipAddress     String?
  status        String    @default("offline")
  lastHeartbeat DateTime?
  settings      String?
  createdAt     DateTime  @default(now())

  @@index([status])
  @@index([location])
}

model SystemSetting {
  id           String   @id @default(cuid())
  category     String
  key          String
  value        String?
  defaultValue String?
  type         String   @default("string")
  description  String?
  updatedAt    DateTime @updatedAt

  @@unique([category, key])
  @@index([category])
}

model Notice {
  id         String    @id @default(cuid())
  title      String
  content    String
  type       String    @default("info")
  isActive   Boolean   @default(true)
  startAt    DateTime  @default(now())
  endAt      DateTime?
  createdAt  DateTime  @default(now())
  createdBy  String?

  adminUser AdminUser? @relation("AdminNotices", fields: [createdBy], references: [id])

  @@index([isActive, startAt])
  @@index([type])
}

model DashboardStat {
  id          String   @id @default(cuid())
  date        String   @unique
  totalLoans  Int      @default(0)
  activeLoans Int      @default(0)
  returns     Int      @default(0)
  overdue     Int      @default(0)
  newUsers    Int      @default(0)
  peakHour    Int?
  createdAt   DateTime @default(now())

  @@index([date])
}
```

---

## 6. 인덱스 전략

### 6.1 인덱스 설계 원칙

| 원칙 | 설명 |
|------|------|
| **쿼리 주도 설계** | 실제 데이터 접근 패턴(9장)을 기준으로 필요 인덱스만 생성 |
| **SQLite B-Tree** | SQLite는 단일 인덱스당 하나의 B-Tree 사용, 복합 조건은 복합 인덱스로 대응 |
| **쓰기 오버헤드 최소화** | 과도한 인덱스는 INSERT/UPDATE 성능 저하, 핵심 쿼리에만 추가 |

### 6.2 인덱스 목록

| 테이블 | 인덱스 | 컬럼 | 유형 | 근거 |
|--------|--------|------|------|------|
| **AuditLog** | `idx_audit_admin` | adminUserId | 단일 | 관리자별 감사 로그 조회 |
| **AuditLog** | `idx_audit_entity` | entity, entityId | 복합 | 특정 엔티티 변경 이력 추적 |
| **AuditLog** | `idx_audit_action` | action | 단일 | 행위 유형별 필터링 |
| **AuditLog** | `idx_audit_created` | createdAt | 단일 | 기간별 감사 로그 조회 (최신순) |
| **CmsContent** | `idx_cms_screen` | screen | 단일 | 화면별 콘텐츠 일괄 조회 |
| **CmsContent** | `idx_cms_type` | type | 단일 | 타입별 필터링 |
| **KioskDevice** | `idx_kiosk_status` | status | 단일 | 온라인/오프라인 기기 필터링 |
| **KioskDevice** | `idx_kiosk_location` | location | 단일 | 위치별 기기 조회 |
| **SystemSetting** | `idx_setting_category` | category | 단일 | 카테고리별 설정 일괄 조회 |
| **Notice** | `idx_notice_active_start` | isActive, startAt | 복합 | 활성 공지 시간 범위 조회 |
| **Notice** | `idx_notice_type` | type | 단일 | 유형별 공지 필터링 |
| **DashboardStat** | `idx_stat_date` | date | 단일 | 날짜 범위 조회 (차트 데이터) |
| **SimLoan** | `idx_loan_status` | status | 단일 | 활성/연체 대출 필터링 |
| **SimLoan** | `idx_loan_user` | userId | 단일 | 사용자별 대출 이력 |
| **SimLoan** | `idx_loan_book` | bookId | 단일 | 도서별 대출 이력 |

### 6.3 추가 인덱스 (성능 튜닝 단계)

마이그레이션 부하를 최소화하기 위해, 초기 릴리즈 이후 쿼리 프로파일링 결과에 따라 추가를 검토한다.

| 검토 인덱스 | 트리거 조건 |
|------------|------------|
| `SimLoan(loanDate)` | 일별 대출 집계 쿼리 지연 시 |
| `AuditLog(adminUserId, createdAt)` | 관리자별 최근 활동 조회 지연 시 |
| `LearningProgress(userId, scenarioId)` | 사용자-시나리오 조합 조회 지연 시 |

---

## 7. 시드 데이터

### 7.1 AdminRole 시드

```json
[
  {
    "name": "super_admin",
    "displayName": "최고 관리자",
    "description": "시스템 전체 권한 보유. 모든 엔티티 생성/수정/삭제 가능",
    "permissions": "[\"user:read\",\"user:write\",\"user:delete\",\"loan:read\",\"loan:write\",\"book:read\",\"book:write\",\"book:delete\",\"cms:manage\",\"system:manage\",\"audit:read\",\"kiosk:manage\"]"
  },
  {
    "name": "admin",
    "displayName": "관리자",
    "description": "일반 관리 권한. 사용자/대출/도서/CMS 관리 가능, 시스템 설정 불가",
    "permissions": "[\"user:read\",\"user:write\",\"loan:read\",\"loan:write\",\"book:read\",\"book:write\",\"cms:manage\",\"audit:read\",\"kiosk:manage\"]"
  },
  {
    "name": "operator",
    "displayName": "운영자",
    "description": "조회 및 대출/반납 처리만 가능. 설정 및 CMS 변경 불가",
    "permissions": "[\"user:read\",\"loan:read\",\"loan:write\",\"book:read\"]"
  }
]
```

### 7.2 AdminUser 시드

```json
[
  {
    "email": "superadmin@smartlib.go.kr",
    "passwordHash": "$2b$12$...bcrypt_hash_of_SmartLib2026!...",
    "name": "시스템 최고관리자",
    "role": "super_admin",
    "isActive": true
  },
  {
    "email": "admin@smartlib.go.kr",
    "passwordHash": "$2b$12$...bcrypt_hash_of_Admin2026!...",
    "name": "도서관 관리자",
    "role": "admin",
    "isActive": true
  }
]
```

> **보안 주의**: 실제 배포 시 반드시 강력한 초기 비밀번호를 사용하고, 첫 로그인 후 즉시 변경하도록 강제한다.

### 7.3 SystemSetting 시드

```json
[
  { "category": "loan", "key": "maxLoanCount", "value": "5", "defaultValue": "5", "type": "number", "description": "1인 최대 대출 권수" },
  { "category": "loan", "key": "loanPeriodDays", "value": "14", "defaultValue": "14", "type": "number", "description": "기본 대출 기간 (일)" },
  { "category": "loan", "key": "extendDays", "value": "7", "defaultValue": "7", "type": "number", "description": "연장 기간 (일)" },
  { "category": "loan", "key": "maxExtendCount", "value": "2", "defaultValue": "2", "type": "number", "description": "최대 연장 횟수" },
  { "category": "kiosk", "key": "heartbeatIntervalSec", "value": "30", "defaultValue": "30", "type": "number", "description": "heartbeat 간격 (초)" },
  { "category": "kiosk", "key": "offlineThresholdSec", "value": "120", "defaultValue": "120", "type": "number", "description": "오프라인 판정 임계값 (초)" },
  { "category": "kiosk", "key": "autoRestartEnabled", "value": "true", "defaultValue": "true", "type": "boolean", "description": "키오스크 자동 재시작 사용 여부" },
  { "category": "kiosk", "key": "restartHour", "value": "3", "defaultValue": "3", "type": "number", "description": "자동 재시작 시간 (0~23)" },
  { "category": "notification", "key": "overdueReminderDay", "value": "3", "defaultValue": "3", "type": "number", "description": "연체 알림 시작일 (반납예정일 + N일)" },
  { "category": "notification", "key": "smtpEnabled", "value": "false", "defaultValue": "false", "type": "boolean", "description": "SMTP 알림 사용 여부" },
  { "category": "notification", "key": "smtpHost", "value": null, "defaultValue": "", "type": "string", "description": "SMTP 서버 호스트" },
  { "category": "notification", "key": "smtpPort", "value": null, "defaultValue": "587", "type": "number", "description": "SMTP 서버 포트" },
  { "category": "dashboard", "key": "statRetentionDays", "value": "365", "defaultValue": "365", "type": "number", "description": "통계 스냅샷 보존 일수" },
  { "category": "dashboard", "key": "cacheTtlSec", "value": "300", "defaultValue": "300", "type": "number", "description": "대시보드 캐시 TTL (초)" }
]
```

### 7.4 CmsContent 시드

```json
[
  { "key": "home.heroTitle", "screen": "home", "type": "text", "value": "스마트 도서관에 오신 것을 환영합니다", "defaultValue": "스마트 도서관에 오신 것을 환영합니다", "description": "홈 화면 메인 타이틀" },
  { "key": "home.heroSubtitle", "screen": "home", "type": "text", "value": "키오스크로 간편하게 대출·반납하세요", "defaultValue": "키오스크로 간편하게 대출·반납하세요", "description": "홈 화면 서브 타이틀" },
  { "key": "theme.primaryColor", "screen": "global", "type": "color", "value": "#1E40AF", "defaultValue": "#1E40AF", "description": "테마 기본 색상" },
  { "key": "theme.secondaryColor", "screen": "global", "type": "color", "value": "#059669", "defaultValue": "#059669", "description": "테마 보조 색상" },
  { "key": "theme.borderRadius", "screen": "global", "type": "number", "value": "8", "defaultValue": "8", "description": "컴포넌트 border-radius (px)" },
  { "key": "kiosk.idleMessage", "screen": "kiosk", "type": "text", "value": "화면을 터치하여 시작하세요", "defaultValue": "화면을 터치하여 시작하세요", "description": "키오스크 유휴 화면 메시지" },
  { "key": "kiosk.idleTimeoutSec", "screen": "kiosk", "type": "number", "value": "120", "defaultValue": "120", "description": "키오스크 유휴 타임아웃 (초)" }
]
```

### 7.5 KioskDevice 시드

```json
[
  { "name": "1층 로비 A", "location": "1층 로비", "ipAddress": "192.168.10.101", "status": "offline", "settings": "{\"idleTimeout\":120,\"volume\":80,\"brightness\":100,\"autoRestart\":true,\"restartHour\":3}" },
  { "name": "1층 로비 B", "location": "1층 로비", "ipAddress": "192.168.10.102", "status": "offline", "settings": "{\"idleTimeout\":120,\"volume\":80,\"brightness\":100,\"autoRestart\":true,\"restartHour\":3}" },
  { "name": "2층 종합자료실", "location": "2층 종합자료실", "ipAddress": "192.168.10.201", "status": "offline", "settings": "{\"idleTimeout\":120,\"volume\":70,\"brightness\":100,\"autoRestart\":true,\"restartHour\":3}" },
  { "name": "3층 아동실", "location": "3층 아동실", "ipAddress": "192.168.10.301", "status": "offline", "settings": "{\"idleTimeout\":90,\"volume\":90,\"brightness\":100,\"autoRestart\":true,\"restartHour\":3}" }
]
```

---

## 8. 마이그레이션 전략

### 8.1 전체 로드맵

```
Phase 1                    Phase 2                    Phase 3
초기 마이그레이션          관계 추가 및 인덱스        운영 안정화
───────────────          ─────────────────          ──────────────
• 신규 테이블 9개 CREATE   • FK 제약 활성화           • 인덱스 튜닝
• 시드 데이터 INSERT       • 누락 인덱스 추가          • 배치 잡 연동
• 기존 스키마 호환성 확인  • 기존 모델에 relation 추가  • 아카이브 파이프라인
```

### 8.2 Phase 1: 초기 마이그레이션

```bash
# 1. 신규 모델이 포함된 schema로 마이그레이션 생성
npx prisma migrate dev \
  --name add_admin_dashboard_tables \
  --create-only

# 2. 생성된 SQL 검토
cat prisma/migrations/*/migration.sql

# 3. 시드 스크립트 작성
#    prisma/seed.ts 에 AdminRole, AdminUser, SystemSetting, CmsContent, KioskDevice 시드 추가

# 4. 마이그레이션 적용
npx prisma migrate dev \
  --name add_admin_dashboard_tables

# 5. 시드 실행
npx prisma db seed
```

### 8.3 Phase 2: 관계 및 인덱스 보강

```bash
# 기존 LearningProgress → Scenario 역관계 추가
npx prisma migrate dev \
  --name add_scenario_progress_relation

# 인덱스 추가
npx prisma migrate dev \
  --name add_performance_indexes
```

### 8.4 마이그레이션 SQL (Phase 1 생성 예상)

```sql
-- AdminUser
CREATE TABLE "AdminUser" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "email"       TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "role"        TEXT NOT NULL DEFAULT 'operator',
  "isActive"    BOOLEAN NOT NULL DEFAULT 1,
  "lastLoginAt" DATETIME,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL
);
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AdminRole
CREATE TABLE "AdminRole" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "permissions" TEXT NOT NULL DEFAULT '[]',
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AdminRole_name_key" ON "AdminRole"("name");

-- AuditLog
CREATE TABLE "AuditLog" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "adminUserId"  TEXT NOT NULL,
  "action"       TEXT NOT NULL,
  "entity"       TEXT NOT NULL,
  "entityId"     TEXT,
  "oldValue"     TEXT,
  "newValue"     TEXT,
  "ip"           TEXT,
  "userAgent"    TEXT,
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX "AuditLog_adminUserId_idx" ON "AuditLog"("adminUserId");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CmsContent
CREATE TABLE "CmsContent" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "key"          TEXT NOT NULL,
  "screen"       TEXT NOT NULL,
  "type"         TEXT NOT NULL DEFAULT 'text',
  "value"        TEXT,
  "defaultValue" TEXT,
  "description"  TEXT,
  "updatedAt"    DATETIME NOT NULL,
  "updatedBy"    TEXT,
  FOREIGN KEY ("updatedBy") REFERENCES "AdminUser"("id") ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE UNIQUE INDEX "CmsContent_key_key" ON "CmsContent"("key");
CREATE INDEX "CmsContent_screen_idx" ON "CmsContent"("screen");
CREATE INDEX "CmsContent_type_idx" ON "CmsContent"("type");

-- CmsImage
CREATE TABLE "CmsImage" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "key"          TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storedPath"   TEXT NOT NULL,
  "mimeType"     TEXT NOT NULL,
  "sizeBytes"    INTEGER NOT NULL,
  "width"        INTEGER,
  "height"       INTEGER,
  "alt"          TEXT,
  "updatedAt"    DATETIME NOT NULL,
  "uploadedBy"   TEXT,
  FOREIGN KEY ("uploadedBy") REFERENCES "AdminUser"("id") ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE UNIQUE INDEX "CmsImage_key_key" ON "CmsImage"("key");
CREATE INDEX "CmsImage_mimeType_idx" ON "CmsImage"("mimeType");

-- KioskDevice
CREATE TABLE "KioskDevice" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "name"          TEXT NOT NULL,
  "location"      TEXT NOT NULL,
  "ipAddress"     TEXT,
  "status"        TEXT NOT NULL DEFAULT 'offline',
  "lastHeartbeat" DATETIME,
  "settings"      TEXT,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "KioskDevice_status_idx" ON "KioskDevice"("status");
CREATE INDEX "KioskDevice_location_idx" ON "KioskDevice"("location");

-- SystemSetting
CREATE TABLE "SystemSetting" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "category"     TEXT NOT NULL,
  "key"          TEXT NOT NULL,
  "value"        TEXT,
  "defaultValue" TEXT,
  "type"         TEXT NOT NULL DEFAULT 'string',
  "description"  TEXT,
  "updatedAt"    DATETIME NOT NULL
);
CREATE UNIQUE INDEX "SystemSetting_category_key_key" ON "SystemSetting"("category", "key");
CREATE INDEX "SystemSetting_category_idx" ON "SystemSetting"("category");

-- Notice
CREATE TABLE "Notice" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "title"      TEXT NOT NULL,
  "content"    TEXT NOT NULL,
  "type"       TEXT NOT NULL DEFAULT 'info',
  "isActive"   BOOLEAN NOT NULL DEFAULT 1,
  "startAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endAt"      DATETIME,
  "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy"  TEXT,
  FOREIGN KEY ("createdBy") REFERENCES "AdminUser"("id") ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE INDEX "Notice_isActive_startAt_idx" ON "Notice"("isActive", "startAt");
CREATE INDEX "Notice_type_idx" ON "Notice"("type");

-- DashboardStat
CREATE TABLE "DashboardStat" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "date"        TEXT NOT NULL,
  "totalLoans"  INTEGER NOT NULL DEFAULT 0,
  "activeLoans" INTEGER NOT NULL DEFAULT 0,
  "returns"     INTEGER NOT NULL DEFAULT 0,
  "overdue"     INTEGER NOT NULL DEFAULT 0,
  "newUsers"    INTEGER NOT NULL DEFAULT 0,
  "peakHour"    INTEGER,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DashboardStat_date_key" ON "DashboardStat"("date");
CREATE INDEX "DashboardStat_date_idx" ON "DashboardStat"("date");
```

### 8.5 롤백 전략

| 시나리오 | 대응 |
|---------|------|
| 마이그레이션 적용 전 문제 발견 | `npx prisma migrate resolve --rolled-back <migration_name>` |
| 적용 후 롤백 필요 | `npx prisma migrate diff`로 역방향 SQL 생성 후 수동 실행 |
| 프로덕션 장애 | SQLite 백업 복원 + `prisma migrate status`로 동기화 확인 |

### 8.6 SQLite WAL 모드 설정

```sql
-- 성능 향상: WAL 모드 활성화 (읽기-쓰기 동시성 향상)
PRAGMA journal_mode = WAL;

-- 체크포인트 빈도 설정
PRAGMA wal_autocheckpoint = 1000;

-- Busy timeout 설정 (쓰기 경합 시 대기)
PRAGMA busy_timeout = 5000;
```

---

## 9. 데이터 접근 패턴

### 9.1 인증 및 권한

```typescript
// 이메일로 관리자 조회 (로그인)
const admin = await prisma.adminUser.findUnique({
  where: { email },
  select: {
    id: true, email: true, passwordHash: true,
    name: true, role: true, isActive: true,
  },
});

// 역할 권한 조회
const role = await prisma.adminRole.findUnique({
  where: { name: admin.role },
  select: { permissions: true },
});

// 로그인 시각 갱신
await prisma.adminUser.update({
  where: { id: admin.id },
  data: { lastLoginAt: new Date() },
});
```

### 9.2 감사 로그 기록

```typescript
// 범용 감사 로그 작성 헬퍼
async function writeAuditLog(params: {
  adminUserId: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export';
  entity: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}) {
  return prisma.auditLog.create({
    data: {
      ...params,
      oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
      newValue: params.newValue ? JSON.stringify(params.newValue) : null,
    },
  });
}

// 감사 로그 조회 (페이지네이션)
const logs = await prisma.auditLog.findMany({
  where: {
    adminUserId: adminId,           // 선택: 특정 관리자
    entity: entityName,              // 선택: 특정 엔티티
    createdAt: { gte: from, lte: to }, // 기간 필터
  },
  include: { adminUser: { select: { name: true, email: true } } },
  orderBy: { createdAt: 'desc' },
  take: 50,
  skip: (page - 1) * 50,
});
```

### 9.3 대시보드 통계

```typescript
// 최근 N일 통계 조회 (차트 데이터)
const stats = await prisma.dashboardStat.findMany({
  where: {
    date: { gte: startDate, lte: endDate },
  },
  orderBy: { date: 'asc' },
});

// 오늘 실시간 요약 (스냅샷 + 실시간 보정)
const todaySnapshot = await prisma.dashboardStat.findUnique({
  where: { date: todayStr },
});

// 활성 대출 수 (실시간)
const activeLoanCount = await prisma.simLoan.count({
  where: { status: 'active' },
});

// 연체 수 (실시간)
const overdueCount = await prisma.simLoan.count({
  where: { status: 'overdue' },
});
```

### 9.4 CMS 콘텐츠 관리

```typescript
// 화면별 콘텐츠 일괄 조회 (프론트엔드 렌더링용)
const contents = await prisma.cmsContent.findMany({
  where: { screen: 'home' },
});

// 콘텐츠 값 업데이트 (감사 로그 동시 기록)
await prisma.$transaction([
  prisma.cmsContent.update({
    where: { key: 'home.heroTitle' },
    data: {
      value: '새로운 환영 메시지',
      updatedBy: adminId,
    },
  }),
  prisma.auditLog.create({
    data: {
      adminUserId: adminId,
      action: 'update',
      entity: 'CmsContent',
      entityId: contentId,
      oldValue: JSON.stringify({ value: oldValue }),
      newValue: JSON.stringify({ value: '새로운 환영 메시지' }),
      ip: clientIp,
    },
  }),
]);

// 키로 단일 조회
const color = await prisma.cmsContent.findUnique({
  where: { key: 'theme.primaryColor' },
  select: { value: true },
});
```

### 9.5 키오스크 기기 관리

```typescript
// 전체 기기 상태 조회 (모니터링 대시보드)
const devices = await prisma.kioskDevice.findMany({
  orderBy: [{ location: 'asc' }, { name: 'asc' }],
});

// 상태별 기기 수 집계
const onlineCount = await prisma.kioskDevice.count({ where: { status: 'online' } });
const offlineCount = await prisma.kioskDevice.count({ where: { status: 'offline' } });
const maintenanceCount = await prisma.kioskDevice.count({ where: { status: 'maintenance' } });

// heartbeat 수신
await prisma.kioskDevice.update({
  where: { id: deviceId },
  data: {
    status: 'online',
    lastHeartbeat: new Date(),
  },
});

// 오프라인 기기 자동 감지 (배치)
const threshold = new Date(Date.now() - 120_000); // 2분 전
await prisma.kioskDevice.updateMany({
  where: {
    status: 'online',
    lastHeartbeat: { lt: threshold },
  },
  data: { status: 'offline' },
});
```

### 9.6 공지 관리

```typescript
// 현재 활성 공지 조회 (대시보드 및 키오스크 표시용)
const now = new Date();
const activeNotices = await prisma.notice.findMany({
  where: {
    isActive: true,
    startAt: { lte: now },
    OR: [
      { endAt: null },
      { endAt: { gt: now } },
    ],
  },
  orderBy: [
    { type: 'desc' },  // urgent 먼저
    { createdAt: 'desc' },
  ],
});

// 공지 생성
await prisma.notice.create({
  data: {
    title: '시스템 점검 안내',
    content: '3월 10일 02:00~06:00 시스템 점검으로 인해 서비스가 일시 중단됩니다.',
    type: 'warning',
    startAt: new Date('2026-03-08T00:00:00Z'),
    endAt: new Date('2026-03-10T06:00:00Z'),
    createdBy: adminId,
  },
});
```

### 9.7 시스템 설정

```typescript
// 카테고리별 설정 일괄 조회
const loanSettings = await prisma.systemSetting.findMany({
  where: { category: 'loan' },
});

// 단일 설정 조회 (타입 캐스팅 포함)
async function getSetting<T>(category: string, key: string): Promise<T | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { category_key: { category, key } },
  });
  if (!setting?.value) return null;
  switch (setting.type) {
    case 'number': return Number(setting.value) as T;
    case 'boolean': return (setting.value === 'true') as unknown as T;
    case 'json': return JSON.parse(setting.value) as T;
    default: return setting.value as unknown as T;
  }
}

// 사용 예
const maxLoan = await getSetting<number>('loan', 'maxLoanCount'); // 5
const smtpOn = await getSetting<boolean>('notification', 'smtpEnabled'); // false
```

### 9.8 사용자·대출 관리 (기존 테이블)

```typescript
// 활성 대출 목록 (사용자별)
const userLoans = await prisma.simLoan.findMany({
  where: { userId, status: 'active' },
  include: {
    book: { select: { title: true, author: true, coverUrl: true } },
    user: { select: { name: true, phone: true } },
  },
  orderBy: { dueDate: 'asc' },
});

// 연체 도서 목록
const overdueLoans = await prisma.simLoan.findMany({
  where: {
    status: 'active',
    dueDate: { lt: todayStr },
  },
  include: {
    user: { select: { name: true, phone: true } },
    book: { select: { title: true, author: true } },
  },
  orderBy: { dueDate: 'asc' },
  take: 100,
});

// 도서 검색 (제목/저자/ISBN)
const books = await prisma.book.findMany({
  where: {
    OR: [
      { title: { contains: keyword } },
      { author: { contains: keyword } },
      { isbn: { contains: keyword } },
    ],
  },
  take: 20,
});

// 학습 진도 요약 (시나리오별)
const progressSummary = await prisma.learningProgress.groupBy({
  by: ['scenarioId'],
  _count: { completed: true },
  _avg: { stars: true, attempts: true },
  where: { completed: true },
});
```

---

## 10. 성능 고려사항

### 10.1 SQLite 특성 기반 최적화

| 항목 | 전략 |
|------|------|
| **동시 쓰기** | SQLite는 단일 writer. 대량 INSERT는 트랜잭션으로 묶어 lock 횟수 최소화 |
| **읽기 동시성** | WAL 모드 사용 시 읽기-쓰기 동시 가능. 기본으로 활성화 |
| **JSON 컬럼** | SQLite는 JSON 함수 지원. 단, WHERE 조건에서 JSON 내부 필드 탐색은 인덱스 미적용 → 애플리케이션 레이어에서 필터링 |
| **COUNT 쿼리** | 대량 데이터에서 COUNT(*)는 풀 스캔. `DashboardStat` 스냅샷 활용 |
| **커넥션 풀** | Prisma 기본 풀 크기 = num_cpus * 2 + 1. SQLite는 단일 파일이므로 과도한 풀 크기는 의미 없음 |

### 10.2 대시보드 로딩 최적화

```
요청 → 인메모리 캐시 확인 (TTL 5분)
         │ Hit  → 캐시 데이터 반환
         │ Miss → DashboardStat 조회 + 실시간 보정 쿼리
                 → 캐시 저장 → 반환
```

- 첫 화면 로딩: `DashboardStat` 최근 30건 + 활성 대출/연체 COUNT (2건) = **3 쿼리**
- 상세 화면: 개별 테이블 조회 (페이지네이션, take=50)

### 10.3 대량 데이터 처리

```typescript
// 대량 AuditLog INSERT — 트랜잭션으로 일괄 처리
await prisma.$transaction(
  logEntries.map(entry =>
    prisma.auditLog.create({ data: entry })
  )
);

// 대량 사용자 EXPORT — 커서 기반 스트리밍
async function* exportUsers() {
  let cursor: string | undefined;
  while (true) {
    const batch = await prisma.simUser.findMany({
      take: 1000,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });
    if (batch.length === 0) break;
    yield batch;
    cursor = batch[batch.length - 1].id;
  }
}
```

---

## 11. 보안 고려사항

### 11.1 비밀번호 저장

| 항목 | 정책 |
|------|------|
| 해시 알고리즘 | bcrypt (cost factor = 12) |
| 평문 저장 | **절대 금지** |
| 전송 | HTTPS만 허용 (HTTP 요청은 301 리다이렉트) |
| 초기 비밀번호 | 시드 비밀번호는 첫 로그인 시 강제 변경 |

### 11.2 감사 로그 보호

- AuditLog 테이블에 대한 UPDATE/DELETE 권한은 **애플리케이션 레이어에서 차단**
- Prisma 미들웨어로 AuditLog 대상 update/delete 작업 시 에러 throw
- DB 수준에서는 추가 보호 불가 (SQLite는 행 수준 보안 미지원)

```typescript
// Prisma 미들웨어 — AuditLog 쓰기 금지
prisma.$use(async (params, next) => {
  if (params.model === 'AuditLog' && params.action !== 'create' && params.action !== 'findMany' && params.action !== 'findUnique' && params.action !== 'count') {
    throw new Error('AuditLog은 append-only입니다. UPDATE/DELETE가 금지됩니다.');
  }
  return next(params);
});
```

### 11.3 권한 검증

```typescript
// 권한 체크 헬퍼
async function checkPermission(adminId: string, required: string): Promise<boolean> {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { role: true, isActive: true },
  });
  if (!admin?.isActive) return false;

  const role = await prisma.adminRole.findUnique({
    where: { name: admin.role },
    select: { permissions: true },
  });
  const perms: string[] = JSON.parse(role?.permissions ?? '[]');
  return perms.includes(required);
}

// 사용 예 — API 라우트 가드
if (!await checkPermission(req.adminId, 'book:write')) {
  return res.status(403).json({ error: '권한이 없습니다.' });
}
```

### 11.4 민감 데이터 마스킹

| 컬럼 | 마스킹 정책 |
|------|------------|
| AdminUser.passwordHash | API 응답에서 **항상 제외** (select에서 미포함) |
| SimUser.phone | 목록 화면에서 `010-****-5678` 형태로 부분 마스킹 |
| SimUser.pin | API 응답에서 **절대 노출 금지** |
| AuditLog.oldValue/newValue | 민감 필드(passwordHash 등)는 로그 기록 시 제외 |

---

## 부록 A: 테이블 요약

| # | 테이블 | 도메인 | 컬럼 수 | 주요 용도 |
|---|--------|--------|---------|----------|
| 1 | SimUser | Kiosk Core | 12 | 이용자 정보 |
| 2 | Book | Kiosk Core | 12 | 도서 정보 |
| 3 | SimLoan | Kiosk Core | 11 | 대출 기록 |
| 4 | LearningProgress | Kiosk Core | 9 | 학습 진도 |
| 5 | Scenario | Kiosk Core | 7 | 시나리오 정의 |
| 6 | AdminUser | Admin | 9 | 관리자 계정 |
| 7 | AdminRole | Admin | 6 | 권한 역할 |
| 8 | AuditLog | Admin | 10 | 감사 추적 |
| 9 | CmsContent | Admin | 9 | CMS 콘텐츠 |
| 10 | CmsImage | Admin | 10 | CMS 이미지 |
| 11 | KioskDevice | System | 8 | 키오스크 기기 |
| 12 | SystemSetting | System | 8 | 시스템 설정 |
| 13 | Notice | System | 9 | 공지/알림 |
| 14 | DashboardStat | System | 9 | 통계 스냅샷 |

**총 14개 테이블, 129개 컬럼**

---

## 부록 B: 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| v1.0.0 | 2026-03-04 | 초기 설계 문서 작성 | 시스템 설계팀 |
