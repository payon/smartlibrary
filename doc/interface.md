# Interface Specification Document

## 스마트 도서관 무인 키오스크 시뮬레이터 — 인터페이스 정의

---

## 1. 컴포넌트 인터페이스

### 1.1 키오스크 화면 컴포넌트

모든 키오스크 화면 컴포넌트는 공통 인터페이스를 따른다:

```typescript
// 기본 화면 컴포넌트 인터페이스
interface KioskScreenProps {
  // 현재 모든 화면 컴포넌트는 props 없음
  // 상태는 Zustand 스토어에서 직접 읽음
}

// 각 컴포넌트 시그니처
export default function KioskIdleScreen(): JSX.Element
export default function KioskMainMenu(): JSX.Element
export default function KioskAuthScan(): JSX.Element
export default function KioskAuthPin(): JSX.Element
export default function KioskLoanSelect(): JSX.Element
export default function KioskLoanConfirm(): JSX.Element
export default function KioskLoanComplete(): JSX.Element
export default function KioskReturnInsert(): JSX.Element
export default function KioskReturnScanning(): JSX.Element
export default function KioskReturnConfirm(): JSX.Element
export default function KioskReturnComplete(): JSX.Element
```

### 1.2 ScreenRouter 인터페이스

```typescript
interface ScreenRouterProps {
  screen: KioskViewName;
}

function ScreenRouter({ screen }: ScreenRouterProps): JSX.Element
```

### 1.3 KioskApp 컴포넌트

```typescript
// KioskApp은 dynamic import로 로드되는 클라이언트 전용 컨테이너
export default function KioskApp(): JSX.Element
// 내부적으로:
//   - useAppStore에서 screen 읽기
//   - AnimatePresence + ScreenRouter 렌더
//   - 마운트 시 /api/seed 호출
```

---

## 2. 상태 인터페이스 (Zustand Store)

### 2.1 AppStore

```typescript
interface AppStore {
  // ── 화면 상태 ──
  screen: KioskViewName;
  setScreen: (screen: KioskViewName) => void;
  prevScreen: () => void;

  // ── 키오스크 모드 ──
  kioskMode: KioskMode;
  setKioskMode: (mode: KioskMode) => void;

  // ── 인증 ──
  authenticatedUser: SimUser | null;
  setAuthenticatedUser: (user: SimUser | null) => void;

  // ── 대출 선택 ──
  selectedBooks: BookItem[];
  addSelectedBook: (book: BookItem) => void;
  removeSelectedBook: (bookId: string) => void;
  clearSelectedBooks: () => void;

  // ── 반납 ──
  returnedLoans: LoanItem[];
  addReturnedLoan: (loan: LoanItem) => void;
  clearReturnedLoans: () => void;

  // ── 센서 ──
  sensorActive: boolean;
  setSensorActive: (active: boolean) => void;

  // ── 타임아웃 ──
  resetTimeout: () => void;
}
```

### 2.2 타입 정의

```typescript
// 화면 식별자
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

// 키오스크 모드
type KioskMode = 'loan' | 'return' | null;

// 화면 이름 (한국어)
const KIOSK_VIEW_NAMES: Record<KioskViewName, string> = {
  'idle': '대기',
  'main-menu': '메인 메뉴',
  'auth-scan': '회원증 인증',
  'auth-pin': 'PIN 입력',
  'loan-select': '도서 선택',
  'loan-confirm': '대출 확인',
  'loan-complete': '대출 완료',
  'return-insert': '도서 투입',
  'return-scanning': '도서 인식',
  'return-confirm': '반납 확인',
  'return-complete': '반납 완료',
};
```

---

## 3. 데이터 모델 인터페이스

### 3.1 SimUser (Prisma Model)

```typescript
interface SimUser {
  id: string;              // CUID
  name: string;            // 성명
  birthDate: string;       // 생년월일 (YYYY-MM-DD)
  phone: string;           // 전화번호
  address?: string;        // 주소
  cardType?: string;       // 회원증 유형 ('mobile' | 'physical')
  cardNumber?: string;     // 회원증 번호 (unique)
  cardIssued?: Date;       // 발급일
  pin?: string;            // PIN (unique, 4자리)
  isActive: boolean;       // 활성 상태
  createdAt: Date;
  updatedAt: Date;
  loans: SimLoan[];        // 관계
  learningProgress: LearningProgress[]; // 관계
}
```

### 3.2 Book (Prisma Model)

```typescript
interface Book {
  id: string;              // CUID
  isbn: string;            // ISBN-13 (unique)
  title: string;           // 도서명
  author: string;          // 저자
  publisher?: string;      // 출판사
  publishYear?: number;    // 출판년도
  category?: string;       // 카테고리
  coverUrl?: string;       // 표지 이미지 URL
  totalCopies: number;     // 총 보유 권수
  availableCopies: number; // 대출 가능 권수
  shelfLocation?: string;  // 서가 위치
  createdAt: Date;
  updatedAt: Date;
  loans: SimLoan[];        // 관계
}
```

### 3.3 SimLoan (Prisma Model)

```typescript
interface SimLoan {
  id: string;              // CUID
  userId: string;          // 대출자 ID (FK)
  bookId: string;          // 도서 ID (FK)
  loanDate: Date;          // 대출일
  dueDate: Date;           // 반납예정일
  returnDate?: Date;       // 실제 반납일
  status: string;          // 'active' | 'returned' | 'overdue'
  method?: string;         // 'kiosk' | 'counter'
  extended: boolean;       // 연장 여부 (항상 false)
  createdAt: Date;
  updatedAt: Date;
  user: SimUser;           // 관계
  book: Book;              // 관계
}
```

### 3.4 클라이언트 측 아이템 타입

```typescript
// 대출 선택용 북 아이템
interface BookItem {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  category?: string;
  availableCopies: number;
}

// 반납용 론 아이템
interface LoanItem {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  loanDate: string;
  dueDate: string;
}
```

---

## 4. API 요청/응답 인터페이스

### 4.1 공통 응답

```typescript
// 성공 응답
interface ApiSuccess<T> {
  data: T;
  message?: string;
}

// 오류 응답
interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}
```

### 4.2 /api/seed

```typescript
// POST /api/seed
interface SeedResponse {
  message: string;
  user: SimUser;
  bookCount: number;
  scenarioCount: number;
}
```

### 4.3 /api/books

```typescript
// GET /api/books?search=&category=
interface BooksResponse {
  books: Book[];
  total: number;
}
```

### 4.4 /api/loans

```typescript
// GET /api/loans?userId=&status=
interface LoansResponse {
  loans: SimLoan[];
}

// POST /api/loans
interface CreateLoanRequest {
  userId: string;
  bookIds: string[];      // 최대 2개
  pin: string;             // 4자리
}

interface CreateLoanResponse {
  loans: SimLoan[];
  message: string;
}
```

### 4.5 /api/loans/[id]/return

```typescript
// POST /api/loans/[id]/return
interface ReturnLoanResponse {
  loan: SimLoan;
  penalty?: {
    overdueDays: number;
    blockDays: number;
    blockUntil: string;
  };
  message: string;
}
```

### 4.6 /api/users

```typescript
// GET /api/users?pin=1234
interface UserByPinResponse {
  user: SimUser;
}

// POST /api/users
interface CreateUserRequest {
  name: string;
  birthDate: string;
  phone: string;
  pin: string;
}

interface CreateUserResponse {
  user: SimUser;
  message: string;
}
```

### 4.7 /api/users/[id]

```typescript
// GET /api/users/[id]
interface UserDetailResponse {
  user: Omit<SimUser, 'pin'>;   // PIN 제외
  activeLoans: SimLoan[];
  totalLoans: number;
  overdueCount: number;
}
```

---

## 5. 보안 인터페이스

### 5.1 검증 함수

```typescript
// CUID 형식 검증
function validateCuid(id: string): boolean;

// ISBN-13 체크섬 검증
function validateISBN(isbn: string): boolean;

// PIN 형식 검증 (4자리 숫자)
function validatePin(pin: string): boolean;

// 한국 전화번호 형식 검증
function validatePhone(phone: string): boolean;

// 생년월일 형식 검증 (YYYY-MM-DD)
function validateBirthDate(date: string): boolean;

// XSS 새니타이즈
function sanitizeXSS(input: string): string;
```

### 5.2 Rate Limiter

```typescript
// IP 기반 요청 제한
function checkRateLimit(ip: string, limit?: number, windowMs?: number): boolean;

// PIN 브루트포스 방지
function checkPinRateLimit(identifier: string): {
  allowed: boolean;
  remainingAttempts: number;
  resetAt: Date;
};
```

### 5.3 보안 헤더

```typescript
// 보안 HTTP 헤더 생성
function getSecurityHeaders(): Headers;
// 포함: CSP, X-Frame-Options, X-Content-Type-Options, HSTS
```

---

## 6. TTS 인터페이스

```typescript
// Web Speech API TTS 모듈
interface TTSOptions {
  text: string;
  rate?: number;      // 기본 0.85 (시니어 느린 속도)
  pitch?: number;     // 기본 1.0
  volume?: number;    // 기본 1.0
  lang?: string;      // 기본 'ko-KR'
}

function speak(options: TTSOptions): void;
function stop(): void;
function isSupported(): boolean;
```

---

## 7. 상수 인터페이스

```typescript
// 대출 규칙 상수
const MAX_LOAN_COUNT: 2;              // 최대 대출 권수
const LOAN_PERIOD_DAYS: 15;           // 대출 기간 (일)
const OVERDUE_BLOCK_MULTIPLIER: 1;    // 연체 차단 배수

// 도서 카테고리
const BOOK_CATEGORIES: string[] = [
  '전체', '소설', '인문', '과학', '역사', '시'
];

// 시드 도서
const SEED_BOOKS: SeedBook[];  // 15권

// 학습 시나리오
const SCENARIOS: Scenario[];    // 7개
```
