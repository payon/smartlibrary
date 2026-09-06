# TDD (Technical Design Document)

## 스마트 도서관 무인 키오스크 시뮬레이터 — 기술 설계

---

## 1. 기술 스택

### 1.1 코어 프레임워크

| 계층 | 기술 | 버전 | 용도 |
|---|---|---|---|
| 프레임워크 | Next.js | 16.1.3 | App Router, API Routes, SSR/CSR |
| 언어 | TypeScript | 5.x | 정적 타입, 컴파일 타임 검증 |
| 런타임 | Bun | latest | 패키지 매니저, 개발 서버 |
| 빌드 | Turbopack | 내장 | HMR, 번들링 |

### 1.2 프론트엔드

| 기술 | 버전 | 용도 |
|---|---|---|
| React | 19.x | UI 렌더링 |
| Tailwind CSS | 4.x | 유틸리티 우선 스타일링 |
| shadcn/ui | New York | 컴포넌트 라이브러리 (40+ 프리미티브) |
| Lucide React | latest | 아이콘 셋 |
| Framer Motion | 12.x | 화면 전환 애니메이션 |
| Zustand | 5.x | 클라이언트 전역 상태 관리 |
| TanStack Query | 5.x | 서버 상태 캐싱/동기화 |
| date-fns | latest | 날짜 포맷/계산 |
| Sonner | latest | 토스트 알림 |

### 1.3 백엔드

| 기술 | 버전 | 용도 |
|---|---|---|
| Prisma | 6.x | ORM, 스키마 관리 |
| SQLite | — | 임베디드 DB (단일 파일) |
| Zod | 4.x | 런타임 스키마 검증 |
| NextAuth.js | 4.x | 인증 (설정됨, 현재 미사용) |

### 1.4 보안

| 모듈 | 용도 |
|---|---|
| `src/lib/security.ts` | XSS 방지, Rate Limiting, CUID/ISBN/PIN 검증, 보안 헤더 |
| `next-intl` | 국제화 (설정됨, 한국어 고정) |

---

## 2. 상태 관리 설계

### 2.1 Zustand 스토어 (`useAppStore`)

```typescript
interface AppStore {
  // 화면 상태
  screen: KioskViewName;           // 현재 화면 식별자
  kioskMode: KioskMode;            // 'loan' | 'return' | null

  // 인증 상태
  authenticatedUser: SimUser | null;

  // 대출 상태
  selectedBooks: BookItem[];       // 최대 2개

  // 반납 상태
  returnedLoans: LoanItem[];

  // 센서 시뮬레이션
  sensorActive: boolean;

  // 액션
  setScreen: (screen: KioskViewName) => void;
  prevScreen: () => void;
  setKioskMode: (mode: KioskMode) => void;
  setAuthenticatedUser: (user: SimUser | null) => void;
  addSelectedBook: (book: BookItem) => void;
  removeSelectedBook: (bookId: string) => void;
  clearSelectedBooks: () => void;
  addReturnedLoan: (loan: LoanItem) => void;
  clearReturnedLoans: () => void;
  resetTimeout: () => void;
}
```

### 2.2 화면 식별자

```typescript
type KioskViewName =
  | 'idle'
  | 'main-menu'
  | 'auth-scan'
  | 'auth-pin'
  | 'loan-select'
  | 'loan-confirm'
  | 'loan-complete'
  | 'return-insert'
  | 'return-scanning'
  | 'return-confirm'
  | 'return-complete';
```

### 2.3 화면 전환 맵핑

```
PREV_SCREEN_MAP:
  idle           → null
  main-menu      → idle
  auth-scan      → main-menu
  auth-pin       → auth-scan
  loan-select    → auth-pin
  loan-confirm   → loan-select
  loan-complete  → idle
  return-insert  → auth-pin
  return-scanning → return-insert
  return-confirm → return-scanning
  return-complete → idle
```

---

## 3. 데이터베이스 설계

### 3.1 ER 다이어그램

```
SimUser 1──N SimLoan N──1 Book
SimUser 1──N LearningProgress
Scenario (독립)
```

### 3.2 테이블 상세

#### SimUser
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | String | @id @default(cuid()) | 고유 식별자 |
| name | String | | 성명 |
| birthDate | String | | 생년월일 |
| phone | String | | 전화번호 |
| address | String? | | 주소 |
| cardType | String? | | 회원증 유형 |
| cardNumber | String? | @unique | 회원증 번호 |
| cardIssued | DateTime? | | 발급일 |
| pin | String? | @unique | PIN 번호 |
| isActive | Boolean | @default(true) | 활성 상태 |

#### Book
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | String | @id @default(cuid()) | 고유 식별자 |
| isbn | String | @unique | ISBN |
| title | String | | 도서명 |
| author | String | | 저자 |
| publisher | String? | | 출판사 |
| publishYear | Int? | | 출판년도 |
| category | String? | | 카테고리 |
| coverUrl | String? | | 표지 이미지 URL |
| totalCopies | Int | @default(1) | 총 보유 권수 |
| availableCopies | Int | @default(1) | 대출 가능 권수 |
| shelfLocation | String? | | 서가 위치 |

#### SimLoan
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | String | @id @default(cuid()) | 고유 식별자 |
| userId | String | | 대출자 ID |
| bookId | String | | 도서 ID |
| loanDate | DateTime | | 대출일 |
| dueDate | DateTime | | 반납예정일 |
| returnDate | DateTime? | | 실제 반납일 |
| status | String | | active/returned/overdue |
| method | String? | | kiosk/counter |
| extended | Boolean | @default(false) | 연장 여부 |

---

## 4. 보안 설계

### 4.1 Rate Limiting

```typescript
// 메모리 기반 IP별 요청 제한
const RATE_LIMIT = {
  windowMs: 60_000,     // 1분 윈도우
  maxRequests: 100,     // 최대 100회/분
};

// PIN 브루트포스 방지
const PIN_RATE_LIMIT = {
  windowMs: 300_000,    // 5분 윈도우
  maxAttempts: 5,       // 최대 5회/5분
};
```

### 4.2 입력 검증

| 검증 대상 | 방식 | 모듈 |
|---|---|---|
| CUID | 정규식 매칭 | `validateCuid()` |
| ISBN | 13자리 체크섬 | `validateISBN()` |
| PIN | 4자리 숫자 | `validatePin()` |
| 전화번호 | 한국 번호 형식 | `validatePhone()` |
| 생년월일 | YYYY-MM-DD | `validateBirthDate()` |
| XSS | DOMPurify 대체 | `sanitizeXSS()` |

### 4.3 보안 헤더

```
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000
```

---

## 5. 성능 설계

### 5.1 렌더링 전략

| 화면 | 렌더링 | 사유 |
|---|---|---|
| 전체 | CSR (`dynamic(ssr: false)`) | 하이드레이션 미스매치 방지 |
| KioskApp | `use client` | 키오스크는 클라이언트 전용 |

### 5.2 캐싱 전략

| 대상 | 방식 | TTL |
|---|---|---|
| 도서 목록 | TanStack Query | 5분 |
| 사용자 정보 | Zustand 인메모리 | 세션 내 |
| DB 연결 | Prisma 싱글톤 | 프로세스 생존 |

### 5.3 애니메이션 최적화

```typescript
// framer-motion 트랜지션
const screenTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3 },  // 300ms 페이드
};
```

---

## 6. 오류 처리 설계

### 6.1 API 오류 응답 형식

```typescript
interface ApiError {
  error: string;        // 오류 메시지 (한국어)
  code?: string;        // 오류 코드
  details?: unknown;    // 추가 정보
}
```

### 6.2 오류 코드 체계

| 코드 | HTTP | 설명 |
|---|---|---|
| `INVALID_INPUT` | 400 | 입력 검증 실패 |
| `PIN_REQUIRED` | 400 | PIN 누락 |
| `OVERDUE_BLOCKED` | 403 | 연체로 인한 대출 차단 |
| `MAX_LOAN_EXCEEDED` | 400 | 최대 대출 권수 초과 (2권) |
| `NOT_FOUND` | 404 | 리소스 미존재 |
| `RATE_LIMITED` | 429 | 요청 제한 초과 |
| `EXTEND_NOT_ALLOWED` | 400 | 연장 불가 |

---

## 7. 배포 아키텍처

### 7.1 개발 환경

```
Next.js Dev Server (port 3000)
  ├── / (SPA — 키오스크 UI)
  └── /api/* (API Routes)
```

### 7.2 프로덕션 빌드

```
next build → .next/
  ├── static/    (정적 자산)
  └── server/    (SSR/API)
```

### 7.3 환경 변수

| 변수 | 설명 | 기본값 |
|---|---|---|
| `DATABASE_URL` | SQLite 경로 | `file:./dev.db` |
| `NEXTAUTH_SECRET` | 인증 암호 | — |
| `NEXTAUTH_URL` | 인증 URL | `http://localhost:3000` |
