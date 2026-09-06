# Program Logic Document

## 스마트 도서관 무인 키오스크 시뮬레이터 — 프로그램 로직

---

## 1. 프로그램 흐름 개요

### 1.1 전체 플로우 다이어그램

```
┌─────────┐
│  START   │
└────┬────┘
     │
     ▼
┌─────────┐  터치   ┌──────────┐
│  IDLE   │────────▶│MAIN MENU │
└─────────┘         └────┬─────┘
     ▲                   │
     │         ┌────────┴────────┐
     │         ▼                 ▼
     │   ┌──────────┐    ┌──────────┐
     │   │대출 모드 │    │반납 모드 │
     │   └────┬─────┘    └────┬─────┘
     │        │               │
     │        ▼               ▼
     │   ┌──────────┐   ┌──────────┐
     │   │AUTH SCAN │   │AUTH SCAN │
     │   └────┬─────┘   └────┬─────┘
     │        ▼               ▼
     │   ┌──────────┐   ┌──────────┐
     │   │ AUTH PIN │   │ AUTH PIN │
     │   └────┬─────┘   └────┬─────┘
     │        ▼               ▼
     │   ┌──────────┐   ┌──────────┐
     │   │LOANSELECT│   │RETURN INS│
     │   └────┬─────┘   └────┬─────┘
     │        ▼               ▼
     │   ┌──────────┐   ┌──────────┐
     │   │LOANCONFIRM│  │RETURNSCAN│
     │   └────┬─────┘   └────┬─────┘
     │        ▼          ┌────┴────┐
     │   ┌──────────┐   ▼         ▼
     │   │LOANCOMPL │ 더넣기   반납확인
     │   └────┬─────┘   │    ┌──────────┐
     │        │         │    │RETCONFIRM│
     │        │         │    └────┬─────┘
     │        │         │         ▼
     │        │         │    ┌──────────┐
     │        │         │    │RETCOMPLTE│
     │        │         │    └────┬─────┘
     └────────┴─────────┴─────────┘
```

---

## 2. 화면별 프로그램 로직

### 2.1 KioskIdleScreen

```
ON MOUNT:
  - 현재 시간 표시 (1초 간격 업데이트)
  - 펄스 글로우 애니메이션 시작

ON TOUCH:
  - setScreen('main-menu')

ON TIMEOUT (30초 무터치):
  - (현재 미구현, 향후 자동 화면 보호)
```

### 2.2 KioskMainMenu

```
ON MOUNT:
  - 현재 시간 표시 (1초 간격 업데이트)

ON "도서 대출" CLICK:
  - setKioskMode('loan')
  - setScreen('auth-scan')

ON "도서 반납" CLICK:
  - setKioskMode('return')
  - setScreen('auth-scan')

ON "← 뒤로" CLICK:
  - setScreen('idle')
```

### 2.3 KioskAuthScan

```
ON MOUNT:
  - RFID 스캔 애니메이션 시작 (scanRFID 키프레임)
  - 타이머 1: 2초 후 → "회원증 인식됨" 토스트
  - 타이머 2: 3.5초 후 → setScreen('auth-pin')
  - useRef 가드로 중복 실행 방지

ON "회원증 없이 이용하기" CLICK:
  - authenticatedUser = 데모 사용자 (김도서관)
  - kioskMode에 따라:
    - 'loan' → setScreen('loan-select')
    - 'return' → setScreen('return-insert')

ON UNMOUNT:
  - 모든 타이머 clearTimeout

오류 처리:
  - 인증 실패 시: "회원증을 인식할 수 없습니다" 토스트
  - 재시도 안내
```

### 2.4 KioskAuthPin

```
상태:
  - pin: string (최대 4자리)
  - error: boolean
  - loading: boolean

ON 숫자 KEY CLICK:
  - if pin.length < 4:
    - pin += 숫자
  - if pin.length === 4:
    - 자동 제출 (handlePinSubmit)

ON BACKSPACE CLICK:
  - pin = pin.slice(0, -1)

handlePinSubmit:
  - loading = true
  - FETCH GET /api/users?pin={pin}
  - if 사용자 발견:
    - setAuthenticatedUser(사용자)
    - kioskMode에 따라 화면 전환:
      - 'loan' → setScreen('loan-select')
      - 'return' → setScreen('return-insert')
  - if 사용자 미발견:
    - error = true
    - 1초 후 pin = '', error = false
    - "PIN 번호가 올바르지 않습니다" 토스트
  - loading = false

데모 PIN: 1234
```

### 2.5 KioskLoanSelect

```
상태:
  - searchQuery: string
  - selectedCategory: string ('전체')
  - books: Book[]

ON MOUNT:
  - FETCH GET /api/books
  - books = 응답 데이터

ON 검색 INPUT CHANGE:
  - searchQuery = value
  - FETCH GET /api/books?search={searchQuery}&category={selectedCategory}

ON 카테고리 TAB CLICK:
  - selectedCategory = category
  - FETCH GET /api/books?search={searchQuery}&category={selectedCategory}

ON 도서 카드 CLICK:
  - if 도서가 이미 선택됨:
    - removeSelectedBook(bookId)
  - else if selectedBooks.length >= 2:
    - 토스트: "최대 2권까지 대출할 수 있습니다"
    - return (선택 차단)
  - else:
    - addSelectedBook(book)

ON "대출하기" CLICK:
  - if selectedBooks.length > 0:
    - setScreen('loan-confirm')

필터링 로직:
  - 클라이언트 사이드 필터 (검색 + 카테고리)
  - 또는 서버 사이드 (API 쿼리 파라미터)
```

### 2.6 KioskLoanConfirm

```
ON MOUNT:
  - authenticatedUser 확인 (없으면 auth-scan으로 리다이렉트)
  - selectedBooks 확인 (없으면 loan-select로 리다이렉트)
  - dueDate = today + 15일

ON "대출하기" CLICK:
  - loading = true
  - FETCH POST /api/loans
    - body: { userId, bookIds: selectedBooks.map(b => b.id) }
  - if 성공:
    - clearSelectedBooks()
    - setScreen('loan-complete')
  - if 실패:
    - 토스트: 오류 메시지
  - loading = false
```

### 2.7 KioskLoanComplete

```
ON MOUNT:
  - FETCH GET /api/users/[userId] (갱신된 대출 목록)
  - 성공 체크마크 애니메이션
  - 타이머: 10초 후 자동 대기 복귀

ON "처음으로 돌아가기" CLICK:
  - setScreen('idle')
  - resetStore()

자동 복귀:
  - 10초 카운트다운 표시
  - 카운트다운 중 터치 시 타이머 리셋
```

### 2.8 KioskReturnInsert

```
ON MOUNT:
  - FETCH GET /api/loans?userId={userId}&status=active
  - if 활성 대출 없음:
    - "대출 중인 도서가 없습니다" 메시지
    - "처음으로" 버튼
  - else:
    - 반납구 슬롯 애니메이션 시작
    - 타이머: 2초 후 첫 활성 대출 자동 감지
    - 감지 시: addReturnedLoan(loan)
    - setScreen('return-scanning')
```

### 2.9 KioskReturnScanning

```
ON MOUNT:
  - RFID 스캔 펄스 애니메이션
  - returnedLoans 목록 표시

ON "더 넣기" CLICK:
  - setScreen('return-insert') (추가 반납)

ON "반납하기" CLICK:
  - if returnedLoans.length > 0:
    - setScreen('return-confirm')
```

### 2.10 KioskReturnConfirm

```
ON MOUNT:
  - returnedLoans 목록 표시

ON "반납 확인" CLICK:
  - loading = true
  - FOR EACH loan IN returnedLoans:
    - FETCH POST /api/loans/{loan.id}/return
  - if 전체 성공:
    - clearReturnedLoans()
    - setScreen('return-complete')
  - if 일부 실패:
    - 토스트: "일부 도서 반납에 실패했습니다"
    - 성공한 것만 complete로 이동
  - loading = false
```

### 2.11 KioskReturnComplete

```
ON MOUNT:
  - 성공 체크마크 애니메이션
  - 타이머: 5초 후 자동 대기 복귀

ON "처음으로 돌아가기" CLICK:
  - setScreen('idle')
  - resetStore()
```

---

## 3. 비즈니스 로직

### 3.1 대출 규칙 엔진

```typescript
// 대출 가능 여부 확인
function canLoan(userId: string): { allowed: boolean; reason?: string } {
  // 1. 연체 확인
  const overdueLoans = getOverdueLoans(userId);
  if (overdueLoans.length > 0) {
    return { allowed: false, reason: '연체 중인 도서가 있어 대출할 수 없습니다' };
  }

  // 2. 현재 대출 권수 확인
  const activeLoans = getActiveLoans(userId);
  if (activeLoans.length >= MAX_LOAN_COUNT) {
    return { allowed: false, reason: `최대 ${MAX_LOAN_COUNT}권까지 대출 가능합니다` };
  }

  return { allowed: true };
}

// 대출 권수 계산 (추가 대출 가능 권수)
function remainingLoanCount(userId: string): number {
  const activeLoans = getActiveLoans(userId);
  return Math.max(0, MAX_LOAN_COUNT - activeLoans.length);
}
```

### 3.2 반납 페널티 계산

```typescript
// 연체 일수 및 차단 일수 계산
function calculateOverduePenalty(loan: SimLoan): {
  overdueDays: number;
  blockDays: number;
  blockUntil: Date;
} {
  const now = new Date();
  const dueDate = new Date(loan.dueDate);

  if (now <= dueDate) {
    return { overdueDays: 0, blockDays: 0, blockUntil: now };
  }

  const overdueDays = differenceInDays(now, dueDate);
  const blockDays = overdueDays * OVERDUE_BLOCK_MULTIPLIER; // 1배수
  const blockUntil = addDays(now, blockDays);

  return { overdueDays, blockDays, blockUntil };
}
```

### 3.3 반납예정일 계산

```typescript
function calculateDueDate(loanDate: Date = new Date()): Date {
  return addDays(loanDate, LOAN_PERIOD_DAYS); // 15일
}
```

---

## 4. 시뮬레이션 로직

### 4.1 RFID 스캔 시뮬레이션

```typescript
// 실제 RFID 하드웨어 없이 시뮬레이션
function simulateRFIDScan() {
  // Phase 1: 스캔 중 (0~2초)
  setTimeout(() => {
    showToast('회원증이 인식되었습니다');
  }, 2000);

  // Phase 2: 화면 전환 (3.5초)
  setTimeout(() => {
    setScreen('auth-pin');
  }, 3500);
}
```

### 4.2 도서 투입 시뮬레이션

```typescript
// 반납구 센서 시뮬레이션
function simulateBookInsertion(activeLoans: SimLoan[]) {
  // 2초 후 첫 번째 활성 대출 자동 감지
  setTimeout(() => {
    if (activeLoans.length > 0) {
      addReturnedLoan(activeLoans[0]);
      setScreen('return-scanning');
    }
  }, 2000);
}
```

### 4.3 시간 단축 시뮬레이션

```typescript
// 실제 15일 → 시뮬레이션 1.5일 (10배 단축)
const SIM_TIME_MULTIPLIER = 0.1;
function simDueDate() {
  return addDays(new Date(), LOAN_PERIOD_DAYS * SIM_TIME_MULTIPLIER);
}
```

---

## 5. 초기화 로직

### 5.1 앱 시작 시

```
1. page.tsx 마운트
2. dynamic import KioskApp (SSR 비활성화)
3. KioskApp 마운트:
   a. GET /api/seed (1회 DB 초기화)
   b. store.screen === 'idle' → IdleScreen 렌더
4. 이후 Zustand 상태 기반 화면 전환
```

### 5.2 시드 데이터 초기화

```typescript
// POST /api/seed 로직
async function seedDatabase() {
  // 1. 기존 데이터 삭제 (순서: Loan → Progress → User → Book → Scenario)
  // 2. SimUser 생성 (김도서관, PIN 1234)
  // 3. Book 15권 생성 (SEED_BOOKS 상수)
  // 4. Scenario 7개 생성
  // 5. 완료 응답
}
```

---

## 6. 오류 처리 로직

### 6.1 공통 오류 처리 패턴

```typescript
async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, options);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '알 수 없는 오류가 발생했습니다');
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      toast.error(error.message);
    } else {
      toast.error('네트워크 오류가 발생했습니다');
    }
    throw error;
  }
}
```

### 6.2 화면별 오류 시나리오

| 화면 | 오류 | 처리 |
|---|---|---|
| AuthPin | PIN 불일치 | 도트 빨강 → 1초 후 초기화 |
| AuthPin | 네트워크 오류 | 토스트 + 재시도 안내 |
| LoanSelect | 도서 목록 로딩 실패 | "다시 시도해주세요" 버튼 |
| LoanConfirm | 대출 API 실패 | 오류 메시지 + 뒤로 가기 |
| ReturnInsert | 활성 대출 없음 | "대출 중인 도서가 없습니다" |
| ReturnConfirm | 반납 API 실패 | 일부 성공 시 성공건만 완료 처리 |
