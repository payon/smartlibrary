# API Specification Document

## 스마트 도서관 무인 키오스크 시뮬레이터 — API 명세

---

## 1. API 개요

### 1.1 Base URL

```
http://localhost:3000/api
```

### 1.2 공통 사항

#### 요청 헤더

```
Content-Type: application/json
```

#### 응답 헤더 (모든 응답)

```
Content-Type: application/json
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000
```

#### 공통 오류 응답

| 상태 코드 | 의미 | 응답 형식 |
|---|---|---|
| 400 | 잘못된 요청 | `{ "error": string, "code"?: string }` |
| 403 | 권한 없음 | `{ "error": string }` |
| 404 | 리소스 없음 | `{ "error": string }` |
| 429 | 요청 제한 초과 | `{ "error": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }` |
| 500 | 서버 오류 | `{ "error": "서버 오류가 발생했습니다." }` |

---

## 2. API 엔드포인트 상세

---

### 2.1 헬스체크

#### `GET /api`

| 항목 | 내용 |
|---|---|
| 설명 | API 서버 상태 확인 |
| 인증 | 불필요 |

**응답 200:**

```json
{
  "status": "ok",
  "timestamp": "2025-03-04T14:30:00.000Z"
}
```

---

### 2.2 시드 데이터 초기화

#### `POST /api/seed`

| 항목 | 내용 |
|---|---|
| 설명 | 데이터베이스 초기화 및 시드 데이터 생성 |
| 인증 | 불필요 |
| 주의 | 기존 데이터 모두 삭제 후 재생성 |

**요청 본문:** 없음

**응답 200:**

```json
{
  "message": "시드 데이터가 생성되었습니다.",
  "user": {
    "id": "clxxxx...",
    "name": "김도서관",
    "pin": "1234",
    "phone": "010-1234-5678"
  },
  "bookCount": 15,
  "scenarioCount": 7
}
```

---

### 2.3 도서 목록 조회

#### `GET /api/books`

| 항목 | 내용 |
|---|---|
| 설명 | 도서 목록 조회 (검색/필터 지원) |
| 인증 | 불필요 |

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `search` | string | 선택 | 도서명/저자 검색어 |
| `category` | string | 선택 | 카테고리 필터 |

**응답 200:**

```json
{
  "books": [
    {
      "id": "clxxxx...",
      "isbn": "9788954621948",
      "title": "연금술사",
      "author": "파울로 코엘료",
      "publisher": "문학동네",
      "publishYear": 2015,
      "category": "소설",
      "coverUrl": "https://images.unsplash.com/...",
      "totalCopies": 3,
      "availableCopies": 2,
      "shelfLocation": "A-01-03"
    }
  ],
  "total": 15
}
```

---

### 2.4 대출 목록 조회

#### `GET /api/loans`

| 항목 | 내용 |
|---|---|
| 설명 | 대출 목록 조회 |
| 인증 | 불필요 |

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `userId` | string | 필수 | 사용자 ID (CUID) |
| `status` | string | 선택 | 대출 상태 필터 (`active`/`returned`/`overdue`) |

**응답 200:**

```json
{
  "loans": [
    {
      "id": "clxxxx...",
      "userId": "clxxxx...",
      "bookId": "clxxxx...",
      "loanDate": "2025-03-04T14:30:00.000Z",
      "dueDate": "2025-03-19T14:30:00.000Z",
      "returnDate": null,
      "status": "active",
      "method": "kiosk",
      "extended": false,
      "book": {
        "id": "clxxxx...",
        "title": "연금술사",
        "author": "파울로 코엘료"
      }
    }
  ]
}
```

**오류 400:**

```json
{ "error": "userId가 필요합니다." }
```

---

### 2.5 대출 생성

#### `POST /api/loans`

| 항목 | 내용 |
|---|---|
| 설명 | 도서 대출 (최대 2권 배치 처리) |
| 인증 | PIN 확인 |

**요청 본문:**

```json
{
  "userId": "clxxxx...",
  "bookIds": ["clxxxx...", "clxxxx..."],
  "pin": "1234"
}
```

| 필드 | 타입 | 필수 | 제약 | 설명 |
|---|---|---|---|---|
| `userId` | string | 필수 | CUID | 대출자 ID |
| `bookIds` | string[] | 필수 | 1~2개 | 대출 도서 ID 배열 |
| `pin` | string | 필수 | 4자리 숫자 | PIN 확인 |

**응답 200:**

```json
{
  "loans": [
    {
      "id": "clxxxx...",
      "userId": "clxxxx...",
      "bookId": "clxxxx...",
      "loanDate": "2025-03-04T14:30:00.000Z",
      "dueDate": "2025-03-19T14:30:00.000Z",
      "status": "active",
      "method": "kiosk",
      "extended": false
    }
  ],
  "message": "2권이 대출되었습니다."
}
```

**오류 응답:**

| 상태 | 코드 | 조건 | 메시지 |
|---|---|---|---|
| 400 | `INVALID_INPUT` | bookIds 빈 배열 | "대출할 도서를 선택해주세요." |
| 400 | `MAX_LOAN_EXCEEDED` | 기존+신규 > 2권 | "최대 2권까지 대출 가능합니다." |
| 400 | `PIN_REQUIRED` | PIN 누락 | "PIN 번호가 필요합니다." |
| 400 | `INVALID_PIN` | PIN 불일치 | "PIN 번호가 올바르지 않습니다." |
| 403 | `OVERDUE_BLOCKED` | 연체 중 | "연체 중인 도서가 있어 대출할 수 없습니다." |
| 404 | — | 사용자/도서 미존재 | "사용자를 찾을 수 없습니다." / "도서를 찾을 수 없습니다." |
| 400 | — | 재고 부족 | "해당 도서는 현재 대출할 수 없습니다." |

---

### 2.6 반납 처리

#### `POST /api/loans/[id]/return`

| 항목 | 내용 |
|---|---|
| 설명 | 단일 대출 반납 처리 |
| 인증 | 불필요 |

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `id` | string | 대출 ID (CUID) |

**요청 본문:** 없음

**응답 200:**

```json
{
  "loan": {
    "id": "clxxxx...",
    "status": "returned",
    "returnDate": "2025-03-10T10:00:00.000Z"
  },
  "penalty": null,
  "message": "반납이 완료되었습니다."
}
```

**연체 반납 응답 200:**

```json
{
  "loan": { "id": "clxxxx...", "status": "returned" },
  "penalty": {
    "overdueDays": 3,
    "blockDays": 3,
    "blockUntil": "2025-03-13T10:00:00.000Z"
  },
  "message": "반납이 완료되었습니다. (3일 연체로 3일간 대출이 제한됩니다.)"
}
```

**오류 응답:**

| 상태 | 조건 | 메시지 |
|---|---|---|
| 404 | 대출 미존재 | "대출 기록을 찾을 수 없습니다." |
| 400 | 이미 반납됨 | "이미 반납된 도서입니다." |

---

### 2.7 대출 연장 (항상 거부)

#### `POST /api/loans/[id]/extend`

| 항목 | 내용 |
|---|---|
| 설명 | 대출 연장 (항상 400 반환) |
| 인증 | 불필요 |

**응답 400:**

```json
{
  "error": "대출 연장은 지원하지 않습니다.",
  "code": "EXTEND_NOT_ALLOWED"
}
```

---

### 2.8 사용자 조회 (PIN)

#### `GET /api/users?pin=XXXX`

| 항목 | 내용 |
|---|---|
| 설명 | PIN 번호로 사용자 조회 |
| 인증 | 불필요 |
| 보안 | PIN 브루트포스 방지 (5회/5분) |

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `pin` | string | 필수 | 4자리 PIN |

**응답 200:**

```json
{
  "user": {
    "id": "clxxxx...",
    "name": "김도서관",
    "birthDate": "1960-05-15",
    "phone": "010-1234-5678",
    "cardNumber": "LIB-2025-001",
    "isActive": true
  }
}
```

**오류 응답:**

| 상태 | 조건 | 메시지 |
|---|---|---|
| 400 | PIN 누락 | "PIN 번호가 필요합니다." |
| 404 | 사용자 미존재 | "해당 PIN의 사용자를 찾을 수 없습니다." |
| 429 | 시도 초과 | "PIN 입력 시도가 너무 많습니다. 5분 후 다시 시도해주세요." |

---

### 2.9 사용자 가입

#### `POST /api/users`

| 항목 | 내용 |
|---|---|
| 설명 | 신규 사용자 가입 |
| 인증 | 불필요 |

**요청 본문:**

```json
{
  "name": "이도서",
  "birthDate": "1955-08-20",
  "phone": "010-9876-5432",
  "pin": "5678"
}
```

**응답 201:**

```json
{
  "user": {
    "id": "clxxxx...",
    "name": "이도서",
    "pin": "5678"
  },
  "message": "회원가입이 완료되었습니다."
}
```

---

### 2.10 사용자 상세 조회

#### `GET /api/users/[id]`

| 항목 | 내용 |
|---|---|
| 설명 | 사용자 상세 정보 + 활성 대출 목록 |
| 인증 | 불필요 |

**응답 200:**

```json
{
  "user": {
    "id": "clxxxx...",
    "name": "김도서관",
    "birthDate": "1960-05-15",
    "phone": "010-1234-5678",
    "cardNumber": "LIB-2025-001",
    "cardIssued": "2025-01-15T00:00:00.000Z",
    "isActive": true
  },
  "activeLoans": [
    {
      "id": "clxxxx...",
      "bookId": "clxxxx...",
      "book": { "title": "연금술사", "author": "파울로 코엘료" },
      "loanDate": "2025-03-04T14:30:00.000Z",
      "dueDate": "2025-03-19T14:30:00.000Z",
      "status": "active"
    }
  ],
  "totalLoans": 5,
  "overdueCount": 0
}
```

> **주의**: `pin` 필드는 응답에서 제외됨

---

### 2.11 회원증 발급

#### `POST /api/users/[id]/card`

| 항목 | 내용 |
|---|---|
| 설명 | 회원증 발급/재발급 |
| 인증 | 불필요 |

**요청 본문:**

```json
{
  "cardType": "mobile"
}
```

| 필드 | 타입 | 값 | 설명 |
|---|---|---|---|
| `cardType` | string | `'mobile'` \| `'physical'` | 회원증 유형 |

**응답 200:**

```json
{
  "cardNumber": "LIB-2025-001",
  "cardType": "mobile",
  "cardIssued": "2025-03-04T14:30:00.000Z",
  "message": "모바일 회원증이 발급되었습니다."
}
```

---

### 2.12 PIN 설정/검증

#### `POST /api/users/[id]/pin`

| 항목 | 내용 |
|---|---|
| 설명 | PIN 설정 또는 검증 |
| 인증 | 불필요 |
| 보안 | 타이밍 어택 방지 (최소 200ms 지연) |

**요청 본문 — 설정:**

```json
{
  "pin": "5678",
  "action": "set"
}
```

**요청 본문 — 검증:**

```json
{
  "pin": "5678",
  "action": "verify"
}
```

**응답 200 (설정):**

```json
{ "message": "PIN이 설정되었습니다." }
```

**응답 200 (검증 성공):**

```json
{ "verified": true, "message": "PIN이 확인되었습니다." }
```

**응답 401 (검증 실패):**

```json
{ "verified": false, "error": "PIN 번호가 올바르지 않습니다." }
```

---

## 3. Rate Limit 명세

| 엔드포인트 | 윈도우 | 최대 요청 | 기준 |
|---|---|---|---|
| 전체 | 60초 | 100회 | IP |
| `GET /api/users?pin=` | 5분 | 5회 | IP |
| `POST /api/users/[id]/pin` | 5분 | 5회 | IP |

---

## 4. 요청 본문 크기 제한

| 엔드포인트 | 최대 크기 |
|---|---|
| 전체 | 1MB |
| `POST /api/loans` | 10KB |
| `POST /api/users` | 10KB |
