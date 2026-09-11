# 관리자 대시보드 테스트 하네스

> **스마트 도서관 키오스크 관리자 대시보드 — Test Harness Document**  
> **버전**: v1.0.0  
> **작성일**: 2026-03-05  
> **상태**: Production-ready  
> **담당**: Dashboard QA & Architecture Team  
> **참조**: [PRD](./prd.md) · [API 명세](./api.md) · [TDD](./tdd.md) · [DB 설계](./database.md) · [아키텍처](./architect.md) · [키오스크 하네스](../harness.md)

---

## 목차

1. [테스트 전략](#1-테스트-전략)
2. [테스트 환경](#2-테스트-환경)
3. [테스트 케이스](#3-테스트-케이스)
4. [API 수동 검증 스크립트](#4-api-수동-검증-스크립트)
5. [Agent Browser E2E 검증 프로시저](#5-agent-browser-e2e-검증-프로시저)
6. [릴리즈 검증 기준](#6-릴리즈-검증-기준)

---

## 1. 테스트 전략

### 1.1 테스트 피라미드

```
               ┌──────────────┐
               │    E2E       │  ← Agent Browser 자동 검증 (10%)
               │  (적음, 비용↑) │
              ┌┴──────────────┴┐
              │  Integration   │  ← API Route curl + DB 상태 검증 (25%)
              │  (중간)         │
             ┌┴────────────────┴┐
             │     Unit         │  ← Zod 스키마 · RBAC 로직 · 컴포넌트 단위 (65%)
             │   (많음, 빠름)    │
             └──────────────────┘
```

**비율 목표**: Unit 65% : Integration 25% : E2E 10%  
**총 커버리지 목표**: Statements ≥ 80%, Branches ≥ 75%

### 1.2 관리자 대시보드 테스트 원칙

| 원칙 | 설명 |
|------|------|
| **브라우저 검증 필수** | 빌드 성공 ≠ 동작 성공. 모든 코어 플로우를 Agent Browser로 E2E 검증 |
| **RBAC 완전 검증** | 각 역할(super_admin / admin / operator)별 허용·차단 동작을 100% 검증 |
| **실시간 반영 검증** | CMS 변경 → 키오스크 반영 ≤3초를 실측 검증 |
| **반응형 4포인트 검증** | 21″·24″·태블릿·모바일 모든 브레이크포인트에서 레이아웃 깨짐 없음 |
| **감사 추적 검증** | 모든 쓰기 작업이 AuditLog에 기록되는지 확인 |
| **보안 경계 검증** | 인증·권한·입력검증·Rate Limit를 경계값 중심으로 테스트 |
| **시각적 회귀 방지** | 핵심 페이지 스냅샷 비교로 UI 회귀 조기 발견 |
| **API 계약 준수** | 모든 API 응답이 [API 명세](./api.md)의 스키마와 일치 |

### 1.3 테스트 분류 체계

| 분류 | 대상 | 도구 | 실행 시점 |
|------|------|------|-----------|
| **Unit** | Zod 검증 스키마, RBAC 권한 판정 로직, JWT 발급/검증 함수, CMS 값 변환 유틸 | Vitest | commit 시 |
| **Integration** | API Route 핸들러 + Prisma DB 상태 변화, 미들웨어 체인 | Vitest + 실제 SQLite | PR 시 |
| **E2E** | 로그인→대시보드→CMS 편집→저장→키오스크 반영 전체 플로우 | Agent Browser | 릴리즈 전 |
| **수동 API** | curl 기반 엔드포인트 개별 검증, 경계값 테스트 | curl + jq | 개발 중 |
| **시각** | 반응형 레이아웃, 컬러 피커, 이미지 업로드 UI | Agent Browser snapshot | PR 시 |

---

## 2. 테스트 환경

### 2.1 개발 서버

```bash
# Next.js 개발 서버 시작 (관리자 대시보드는 /admin/* 경로에 통합)
bun run dev    # 포트 3000

# 서버 상태 확인
curl -s http://localhost:3000/api/health | jq '.status'
# 기대값: "ok"

# 린트 검사
bun run lint

# 타입 검사
bunx tsc --noEmit

# Prisma 마이그레이션 + 시드
bunx prisma migrate reset --force
bunx prisma db seed
```

### 2.2 관리자 대시보드 URL 구조

| 페이지 | URL | 설명 |
|--------|-----|------|
| 로그인 | `http://localhost:3000/admin/login` | 관리자 인증 화면 |
| 대시보드 | `http://localhost:3000/admin/dashboard` | 통계 현황 메인 |
| CMS 편집 | `http://localhost:3000/admin/cms` | 콘텐츠 관리 (화면별 탭) |
| 도서 관리 | `http://localhost:3000/admin/books` | 도서 CRUD 리스트 |
| 사용자 관리 | `http://localhost:3000/admin/users` | 이용자 CRUD 리스트 |
| 관리자 계정 | `http://localhost:3000/admin/accounts` | 관리자 계정 관리 (super_admin 전용) |
| 감사 로그 | `http://localhost:3000/admin/audit` | 변경 이력 조회 |
| 공지 관리 | `http://localhost:3000/admin/notices` | 공지 CRUD |

### 2.3 브라우저 검증 도구

| 도구 | 용도 | 실행 방법 |
|------|------|-----------|
| **Agent Browser** | E2E 자동 검증 — 로그인 플로우, CMS 편집, 권한 차단, 반응형 | Skill: `agent-browser` |
| **Dev Log** | 런타임 오류, 하이드레이션 미스매치, API 500 확인 | `Read /home/z/my-project/dev.log` |
| **Preview Panel** | 시각적 확인 — 컬러 피커, 이미지 업로드, 레이아웃 | 우측 패널 |
| **React DevTools** | 컴포넌트 트리, Zustand 스토어 상태 확인 | 브라우저 확장 |

### 2.4 테스트용 계정 (시드 데이터)

| 역할 | 이메일 | 비밀번호 | 용도 |
|------|--------|----------|------|
| `super_admin` | `super@library.kr` | `Admin123!` | 전체 권한 테스트 |
| `admin` | `admin@library.kr` | `Admin123!` | 관리자 권한 테스트 |
| `operator` | `operator@library.kr` | `Oper123!` | 운영자 권한 테스트 (읽기 전용) |

### 2.5 환경 변수

```bash
# .env.test
DATABASE_URL="file:./test.db"
JWT_SECRET="test-secret-key-for-harness"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"
UPLOAD_DIR="/tmp/test-uploads"
MAX_IMAGE_SIZE_BYTES="2097152"    # 2MB
ALLOWED_IMAGE_TYPES="image/png,image/jpeg,image/svg+xml"
RATE_LIMIT_ADMIN="10"             # 10회/분 (테스트용 낮은 값)
```

---

## 3. 테스트 케이스

### TC-D01: 관리자 로그인 플로우 (정상/오류)

**우선순위**: P0  
**대상 API**: `POST /api/admin/auth/login`, `POST /api/admin/auth/refresh`, `POST /api/admin/auth/logout`

#### TC-D01-1: 정상 로그인

```
사전 조건: 서버 실행, 시드 DB 초기화

단계:
  1. GET /admin/login 접근
     - 이메일 입력 필드 표시
     - 비밀번호 입력 필드 표시
     - "로그인" 버튼 표시 (초기 비활성화)

  2. 이메일 "admin@library.kr" 입력
     - 이메일 형식 검증 통과
     - 에러 메시지 없음

  3. 비밀번호 "Admin123!" 입력
     - "로그인" 버튼 활성화

  4. "로그인" 버튼 클릭
     - POST /api/admin/auth/login 요청 발생
     - 응답 200: { accessToken, refreshToken, user: { id, email, name, role } }
     - JWT가 HttpOnly 쿠키에 저장
     - /admin/dashboard로 리다이렉트

  5. 대시보드 페이지 로드
     - 사용자 이름 "관리자" 표시
     - 역할 배지 "admin" 표시
     - 사이드바 메뉴 표시 (역할에 따라 다름)

기대 결과:
  - HTTP 200 응답
  - accessToken payload: { sub, email, role, iat, exp }
  - refreshToken DB 저장 확인
  - AuditLog에 LOGIN 이벤트 기록
```

#### TC-D01-2: 로그인 오류 케이스

```
단계:
  1. 존재하지 않는 이메일 "unknown@test.kr" + 임의 비밀번호
     → POST /api/admin/auth/login
     → 401 Unauthorized: { error: { code: "INVALID_CREDENTIALS" } }
     - 토스트: "이메일 또는 비밀번호가 올바르지 않습니다"
     - 이메일/비밀번호 어떤 것이 틀렸는지 힌트 제공 금지

  2. 올바른 이메일 + 틀린 비밀번호 "Wrong123!"
     → 401 Unauthorized
     - 실패 카운트 증가 (DB 확인)

  3. 5회 연속 실패
     → 429 Too Many Requests: { error: { code: "ACCOUNT_LOCKED" } }
     - 토스트: "5회 연속 실패로 계정이 15분간 잠겼습니다"
     - 이후 15분 내 올바른 자격증명도 로그인 불가

  4. 비활성화된 계정 (isActive=false)
     → 403 Forbidden: { error: { code: "ACCOUNT_DISABLED" } }
     - 토스트: "비활성화된 계정입니다"

  5. 빈 이메일 제출
     → 400 Bad Request: { error: { code: "VALIDATION_ERROR" } }
     - 인라인 에러: "이메일을 입력하세요"

  6. 잘못된 이메일 형식 "not-an-email"
     → 400 Bad Request
     - 인라인 에러: "유효한 이메일 형식이 아닙니다"
```

#### TC-D01-3: 세션 관리

```
단계:
  1. 로그인 후 30분 비활동
     - 자동 로그아웃 → /admin/login 리다이렉트
     - 토스트: "세션이 만료되었습니다. 다시 로그인하세요"

  2. AccessToken 만료 (15분) 후 API 호출
     - 자동 RefreshToken으로 갱신 시도
     - 갱신 성공 → 요청 재시도 (사용자 무감지)
     - 갱신 실패 → 로그인 페이지 리다이렉트

  3. 수동 로그아웃
     - POST /api/admin/auth/logout
     - 쿠키 삭제
     - RefreshToken DB에서 제거
     - /admin/login 리다이렉트
     - AuditLog에 LOGOUT 이벤트 기록
```

---

### TC-D02: CMS 콘텐츠 변경 → 키오스크 실시간 반영

**우선순위**: P0  
**대상 API**: `GET /api/admin/cms`, `PATCH /api/admin/cms/:key`, `GET /api/cms/:key` (키오스크용 공개 API)

#### TC-D02-1: 텍스트 콘텐츠 변경 및 반영

```
사전 조건: super_admin 또는 admin으로 로그인

단계:
  1. /admin/cms 접근 → "대기 화면" 탭 선택
     - idle.title_text 현재값 "스마트 도서관" 표시
     - idle.subtitle_text 현재값 "도서 대출·반납 키오스크" 표시

  2. idle.title_text를 "행복 도서관"으로 변경
     - 인라인 편집 활성화
     - 입력값 길이 ≤50자 검증 (51자 입력 시 인라인 에러)

  3. "저장" 버튼 클릭
     - PATCH /api/admin/cms/idle.title_text
       Body: { "value": "행복 도서관" }
     - 200 OK 응답
     - 토스트: "저장되었습니다"
     - AuditLog 기록: { action: "UPDATE", entity: "CmsContent", oldValue: "스마트 도서관", newValue: "행복 도서관" }

  4. 키오스크 프론트엔드 반영 확인 (≤3초)
     - GET /api/cms/idle.title_text → "행복 도서관"
     - Agent Browser로 키오스크 대기 화면 스냅샷 → "행복 도서관" 텍스트 확인
     - WebSocket 이벤트 cms:updated 수신 확인

기대 결과:
  - API 응답 시간 ≤500ms
  - 키오스크 반영 지연 ≤3초
  - 변경 이력에 수정 내역 기록
```

#### TC-D02-2: 색상 콘텐츠 변경

```
단계:
  1. idle.bg_color 컬러 피커 열기
     - 현재값 #1E3A5F 표시 (HEX 입력 + 컬러 피커 UI)

  2. #2D4A7F로 변경
     - HEX 형식 검증 (잘못된 형식 "ZZZZZZ" 입력 시 에러)
     - 실시간 미리보기 패널에 배경색 즉시 반영

  3. "저장" 클릭
     - PATCH /api/admin/cms/idle.bg_color Body: { "value": "#2D4A7F" }
     - 키오스크 대기 화면 배경색 변경 확인
```

#### TC-D02-3: 대출 규칙 변경

```
단계:
  1. "대출 규칙" 탭 선택
     - rules.max_borrow_count: 5 (슬라이더 + 숫자 입력)
     - rules.borrow_period_days: 14
     - rules.overdue_penalty_multiplier: 1.0

  2. 최대 대출 권수를 3으로 변경
     - 슬라이더 이동 → 숫자 입력값 동기화
     - 범위 검증: 1~20 외 값 입력 시 에러

  3. 대출 기간을 21일로 변경
     - 범위 검증: 1~90 외 값 입력 시 에러

  4. "저장" 클릭
     - PATCH /api/admin/cms/rules.max_borrow_count Body: { "value": "3" }
     - PATCH /api/admin/cms/rules.borrow_period_days Body: { "value": "21" }
     - 키오스크 즉시 반영: 최대 3권, 21일 대출 기간

오류 케이스:
  1. max_borrow_count = 0 → 검증 에러 "최소 1권 이상이어야 합니다"
  2. max_borrow_count = 21 → 검증 에러 "최대 20권까지 설정 가능합니다"
  3. borrow_period_days = 0 → 검증 에러
  4. borrow_period_days = 91 → 검증 에러
```

#### TC-D02-4: operator 권한으로 CMS 변경 시도

```
사전 조건: operator로 로그인

단계:
  1. /admin/cms 접근
     - 모든 CMS 값 읽기 전용으로 표시
     - 편집 버튼/입력 필드 비활성화 또는 숨김

  2. PATCH /api/admin/cms/idle.title_text 직접 호출 (curl)
     → 403 Forbidden: { error: { code: "FORBIDDEN" } }
     - 토스트: "콘텐츠 변경 권한이 없습니다"
```

---

### TC-D03: 도서 CRUD

**우선순위**: P0  
**대상 API**: `GET /api/admin/books`, `POST /api/admin/books`, `PATCH /api/admin/books/:id`, `DELETE /api/admin/books/:id`

#### TC-D03-1: 도서 등록 (Create)

```
사전 조건: admin으로 로그인

단계:
  1. /admin/books 접근 → "도서 등록" 버튼 클릭
     - 등록 폼 모달 또는 페이지 전환
     - 필수 필드: 도서명, 저자, ISBN-13, 카테고리

  2. 폼 입력:
     - 도서명: "데미안"
     - 저자: "헤르만 헤세"
     - ISBN-13: "9788932917249"
     - 카테고리: "소설" (드롭다운)
     - 출판사: "민음사" (선택)
     - 출판연도: 2018 (선택)

  3. 표지 이미지 업로드 (선택)
     - 드래그앤드롭 영역에 JPG 파일 드롭
     - 미리보기 썸네일 표시
     - 파일 크기 ≤2MB, MIME image/jpeg 검증

  4. "등록" 버튼 클릭
     - POST /api/admin/books
       Body: { title, author, isbn, category, publisher, publishYear, coverImage }
     - 201 Created 응답
     - 목록에 새 도서 즉시 표시
     - AuditLog: { action: "CREATE", entity: "Book" }

오류 케이스:
  1. ISBN 중복: 이미 존재하는 ISBN 입력 → 409 Conflict
     - 에러: "이미 등록된 ISBN입니다"
  2. 필수 필드 누락: 도서명 없이 제출 → 400 Bad Request
  3. ISBN 형식 오류: "123" (13자리 아님) → 400
  4. 카테고리 불일치: "SF" (목록에 없음) → 400
```

#### TC-D03-2: 도서 목록 조회 (Read)

```
단계:
  1. GET /api/admin/books?page=1&limit=50
     - 200 OK: { books: [...], total, page, limit }
     - 테이블에 컬럼: 도서명, 저자, ISBN, 카테고리, 상태, 등록일

  2. 검색: ?search=데미안
     - 도서명 또는 저자에 "데미안" 포함 결과만 반환

  3. 카테고리 필터: ?category=소설
     - 카테고리가 "소설"인 도서만 반환

  4. 상태 필터: ?status=AVAILABLE
     - 대출 가능 도서만 반환

  5. 정렬: ?sort=createdAt&order=desc
     - 최근 등록순 정렬

  6. 페이지네이션: ?page=2&limit=50
     - 51~100번째 도서 반환
```

#### TC-D03-3: 도서 수정 (Update)

```
단계:
  1. 목록에서 특정 도서 행 클릭 → 수정 폼
  2. 도서명을 "데미안 (개정판)"으로 변경
  3. "저장" 클릭
     - PATCH /api/admin/books/:id Body: { title: "데미안 (개정판)" }
     - 200 OK
     - 목록에 즉시 반영
     - AuditLog: { action: "UPDATE", entity: "Book", oldValue, newValue }
```

#### TC-D03-4: 도서 삭제 (Delete)

```
단계:
  1. 목록에서 도서 "삭제" 버튼 클릭
     - 확인 다이얼로그: "정말 삭제하시겠습니까?"
  2. "확인" 클릭
     - DELETE /api/admin/books/:id
     - 200 OK (soft delete: status → "REPAIR" 또는 실제 삭제)
     - 목록에서 제거
     - AuditLog: { action: "DELETE", entity: "Book", entityId }

오류 케이스:
  1. 대출 중인 도서 삭제 시도 → 409 Conflict
     - 에러: "대출 중인 도서는 삭제할 수 없습니다"
```

#### TC-D03-5: operator 권한으로 도서 쓰기 시도

```
단계:
  1. operator로 /admin/books 접근
     - "도서 등록" 버튼 숨김
     - 행별 "수정"/"삭제" 버튼 숨김
     - 목록 조회만 가능

  2. POST /api/admin/books 직접 호출 (curl with operator JWT)
     → 403 Forbidden
```

---

### TC-D04: 사용자 CRUD

**우선순위**: P0  
**대상 API**: `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:id`

#### TC-D04-1: 사용자 등록

```
사전 조건: admin으로 로그인

단계:
  1. /admin/users 접근 → "사용자 등록" 버튼 클릭
  2. 폼 입력:
     - 성명: "김도서"
     - RFID: "RFID-001234"
     - PIN: "123456" (6자리, 숫자만)
     - 연락처: "010-1234-5678" (선택)
     - 이메일: "kim@library.kr" (선택)

  3. "등록" 클릭
     - POST /api/admin/users
       Body: { name, rfid, pin, phone, email }
     - 201 Created
     - PIN은 DB에 bcrypt 해시로 저장 (원문 저장 금지)
     - AuditLog: { action: "CREATE", entity: "LibraryUser" }

오류 케이스:
  1. RFID 중복 → 409 Conflict: "이미 등록된 RFID입니다"
  2. PIN 5자리 → 400: "PIN은 6자리 숫자여야 합니다"
  3. PIN 문자 포함 "12a456" → 400
  4. 성명 누락 → 400
```

#### TC-D04-2: 사용자 목록 조회

```
단계:
  1. GET /api/admin/users?page=1&limit=50
     - 200 OK: { users: [...], total, page, limit }
     - PIN 컬럼은 마스킹 처리 ("****") — 원문 노출 금지

  2. 검색: ?search=김도서
  3. 상태 필터: ?status=ACTIVE
  4. 연체 필터: ?overdue=true
```

#### TC-D04-3: 사용자 수정

```
단계:
  1. 사용자 행 클릭 → 수정 폼
  2. 연락처를 "010-9876-5432"로 변경
  3. PIN 재설정: "654321"
     - 재설정 시 기존 해시 교체
  4. "저장" 클릭 → PATCH /api/admin/users/:id
     - AuditLog: { action: "UPDATE", entity: "LibraryUser" }
```

#### TC-D04-4: 사용자 비활성화 (삭제 금지)

```
단계:
  1. 사용자 상태를 "SUSPENDED"로 변경
     - "비활성화" 버튼 클릭 → 확인 다이얼로그
  2. "확인" 클릭
     - PATCH /api/admin/users/:id Body: { status: "SUSPENDED" }
     - 물리 삭제(DELETE)는 제공하지 않음 — 감사 추적 유지

  3. 비활성화된 사용자는 키오스크에서 인증 불가
```

---

### TC-D05: 권한 관리 (RBAC)

**우선순위**: P0  
**대상 API**: `GET /api/admin/accounts`, `POST /api/admin/accounts`, `PATCH /api/admin/accounts/:id`

#### TC-D05-1: operator는 CMS 변경 불가

```
사전 조건: operator로 로그인

단계:
  1. /admin/cms 접근
     - 모든 편집 컨트롤 비활성화 (입력 필드 readonly, 저장 버튼 숨김)

  2. API 직접 호출:
     curl -X PATCH /api/admin/cms/idle.title_text \
       -H "Authorization: Bearer $OPERATOR_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"value":"해킹시도"}'
     → 403 Forbidden: { error: { code: "FORBIDDEN", message: "콘텐츠 변경 권한이 없습니다" } }

  3. operator 접근 가능 메뉴 확인:
     - ✅ 도서 목록 조회 (읽기 전용)
     - ✅ 사용자 목록 조회 (읽기 전용)
     - ✅ 대시보드 통계 조회
     - ❌ CMS 콘텐츠 쓰기
     - ❌ 도서 등록/수정/삭제
     - ❌ 사용자 등록/수정/비활성화
     - ❌ 공지 등록/수정/삭제
     - ❌ 감사 로그 조회
     - ❌ 관리자 계정 관리
```

#### TC-D05-2: admin은 관리자 생성 불가

```
사전 조건: admin으로 로그인

단계:
  1. /admin/accounts 접근 시도
     - 사이드바에 "관리자 계정" 메뉴 숨김
     - 직접 URL 입력 → 403 리다이렉트 또는 빈 페이지

  2. API 직접 호출:
     curl -X POST /api/admin/accounts \
       -H "Authorization: Bearer $ADMIN_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"email":"new@library.kr","name":"신규","role":"operator","password":"New123!"}'
     → 403 Forbidden: { error: { code: "FORBIDDEN" } }

  3. admin 접근 가능 메뉴 확인:
     - ✅ CMS 콘텐츠 읽기/쓰기
     - ✅ 도서 CRUD
     - ✅ 사용자 CRUD
     - ✅ 공지 CRUD
     - ✅ 감사 로그 조회
     - ✅ 통계 대시보드
     - ❌ 관리자 계정 조회/생성/수정
     - ❌ 감사 로그 내보내기
     - ❌ 시스템 설정 (DB 백업 등)
```

#### TC-D05-3: super_admin 전체 권한

```
사전 조건: super_admin으로 로그인

단계:
  1. 모든 메뉴 접근 가능 확인
  2. 관리자 계정 생성:
     - POST /api/admin/accounts
       Body: { email: "newadmin@library.kr", name: "신규관리자", role: "admin", password: "New123!" }
     - 201 Created
     - AuditLog: { action: "CREATE", entity: "AdminUser" }

  3. 관리자 역할 변경:
     - PATCH /api/admin/accounts/:id Body: { role: "operator" }
     - 즉시 권한 반영 (기존 세션의 JWT는 만료까지 유효 → 재로그인 시 새 권한)

  4. 관리자 비활성화:
     - PATCH /api/admin/accounts/:id Body: { isActive: false }
     - 비활성화된 계정은 즉시 로그아웃 처리

  5. 자기 자신 비활성화 시도 → 400 Bad Request
     - 에러: "자신의 계정은 비활성화할 수 없습니다"
```

#### TC-D05-4: 미인증 요청 차단

```
단계:
  1. JWT 없이 /api/admin/* 호출
     → 401 Unauthorized: { error: { code: "UNAUTHORIZED" } }

  2. 만료된 JWT로 호출
     → 401 Unauthorized: { error: { code: "TOKEN_EXPIRED" } }

  3. 변조된 JWT (서명 불일치)
     → 401 Unauthorized: { error: { code: "INVALID_TOKEN" } }

  4. /admin/* 페이지 직접 접근 (미인증)
     → /admin/login으로 리다이렉트
```

---

### TC-D06: 이미지 업로드 (정상/크기초과/타입오류)

**우선순위**: P0  
**대상 API**: `POST /api/admin/cms/images`, `DELETE /api/admin/cms/images/:id`

#### TC-D06-1: 정상 이미지 업로드

```
사전 조건: admin으로 로그인

단계:
  1. /admin/cms → "대기 화면" 탭 → 로고 이미지 업로드 영역
  2. PNG 파일 (300KB, 200×200px) 드래그앤드롭
     - 업로드 진행 바 표시
     - POST /api/admin/cms/images
       Content-Type: multipart/form-data
       Body: { file: (binary), key: "idle.logo_image" }
     - 200 OK: { url: "/uploads/cms/idle-logo_xxxxx.png", size, width, height }
     - 미리보기 썸네일 즉시 표시
     - 키오스크 대기 화면 로고 즉시 교체 (≤3초)

  3. SVG 아이콘 업로드 (20KB, 대출 버튼 아이콘)
     - SVG sanitize 처리 (<script> 태그 제거 확인)
     - 200 OK
```

#### TC-D06-2: 파일 크기 초과

```
단계:
  1. 3MB JPG 파일 업로드 시도 (제한: 2MB)
     → 413 Payload Too Large: { error: { code: "FILE_TOO_LARGE", message: "파일 크기가 2MB를 초과합니다" } }
     - 토스트: "파일 크기가 2MB를 초과하여 업로드할 수 없습니다"
     - 업로드 영역 에러 상태 표시

  2. 배경 이미지 2.5MB 업로드 시도 (제한: 2MB)
     → 동일 413 에러
```

#### TC-D06-3: 허용되지 않은 파일 타입

```
단계:
  1. PDF 파일 업로드 시도
     → 400 Bad Request: { error: { code: "INVALID_FILE_TYPE", message: "PNG, JPG, SVG 파일만 업로드 가능합니다" } }

  2. GIF 파일 업로드 시도
     → 400 Bad Request (허용 MIME: image/png, image/jpeg, image/svg+xml)

  3. .exe 파일 업로드 시도
     → 400 Bad Request
```

#### TC-D06-4: SVG 보안 검증

```
단계:
  1. <script> 태그 포함 SVG 업로드
     - 서버에서 SVG sanitize 수행
     - <script> 제거 후 업로드 성공
     - 저장된 파일에 <script> 포함 여부 확인 (포함 금지)

  2. onload 속성 포함 SVG
     - 이벤트 핸들러 속성 제거 후 저장
```

---

### TC-D07: 감사 로그 기록 확인

**우선순위**: P1  
**대상 API**: `GET /api/admin/audit`

#### TC-D07-1: CMS 변경 감사 로그

```
사전 조건: super_admin으로 로그인, CMS 변경 수행 후

단계:
  1. GET /api/admin/audit?entity=CmsContent&action=UPDATE
     - 200 OK: { logs: [...], total }
     - 각 로그 항목 포함:
       - action: "UPDATE"
       - entity: "CmsContent"
       - entityId: 해당 CMS key
       - oldValue: 변경 전 값
       - newValue: 변경 후 값
       - performedBy: 작업자 AdminUser.id
       - performedAt: 타임스탬프

  2. 변경 전후 diff 확인
     - oldValue ≠ newValue 확인
     - oldValue가 이전 상태와 일치 확인
```

#### TC-D07-2: 전체 감사 로그 조회

```
단계:
  1. GET /api/admin/audit (최근 100건)
     - 로그 유형: CREATE, UPDATE, DELETE, LOGIN, LOGOUT
     - 엔티티: CmsContent, Book, LibraryUser, AdminUser

  2. 필터 조합:
     - ?performedBy=ADMIN_ID (특정 작업자)
     - ?entity=Book (특정 엔티티)
     - ?action=CREATE (특정 액션)
     - ?from=2026-03-01&to=2026-03-05 (기간 필터)

  3. 페이지네이션: ?page=1&limit=50
```

#### TC-D07-3: operator 감사 로그 접근 불가

```
단계:
  1. operator JWT로 GET /api/admin/audit 호출
     → 403 Forbidden

  2. /admin/audit 페이지 접근
     - 사이드바에 메뉴 숨김
     - 직접 URL → 403 리다이렉트
```

---

### TC-D08: 반응형 레이아웃 (21인치/24인치/태블릿/모바일)

**우선순위**: P0  
**브레이크포인트**: `mobile: 375px`, `tablet: 768px`, `kiosk-lg: 1280px`, `kiosk-xl: 1920px`

#### TC-D08-1: 24인치 키오스크 (1920×1080, kiosk-xl)

```
단계:
  1. 뷰포트를 1920×1080으로 설정
  2. /admin/dashboard 접근
     - 사이드바 240px 고정 노출 (텍스트+아이콘)
     - 콘텐츠 영역 3-column CSS Grid
     - 미리보기 패널 우측 320px 고정
     - 통계 그래프 800×400 영역
     - 데이터 테이블 전체 컬럼 노출

  3. /admin/cms 접근
     - 3-column: 사이드바 | 편집 폼 | 미리보기
     - 컬러 피커 인라인 팝오버
     - 이미지 드래그앤드롭 영역 충분한 크기
```

#### TC-D08-2: 21인치 키오스크 (1280×720, kiosk-lg)

```
단계:
  1. 뷰포트를 1280×720으로 설정
  2. /admin/dashboard 접근
     - 사이드바 240px 고정 (kiosk-xl과 동일)
     - 폰트 약간 축소
     - 통계 그래프 축소 표시
```

#### TC-D08-3: 태블릿 (768×1024)

```
단계:
  1. 뷰포트를 768×1024으로 설정 (세로 방향)
  2. /admin/dashboard 접근
     - 사이드바 64px 아이콘 전용 (hover 시 확장)
     - 콘텐츠 영역 2-column CSS Grid
     - 미리보기 패널 하단 280px 접히식
     - 데이터 테이블 주요 컬럼 5개 + "더보기" 버튼
```

#### TC-D08-4: 모바일 (375×667)

```
단계:
  1. 뷰포트를 375×667으로 설정
  2. /admin/dashboard 접근
     - 햄버거 메뉴 (슬라이드 오버레이)
     - 1-column flex stack
     - 미리보기 모달 오버레이
     - 데이터 테이블 → 카드 리스트 뷰 전환
     - 컬러 피커 전체화면 모달
     - 이미지 업로드 → 카메라+파일 선택 버튼
     - 통계 그래프 100% 너비 × 200px

  3. 햄버거 메뉴 열기/닫기
     - 오버레이 배경 클릭 → 메뉴 닫기
     - Escape 키 → 메뉴 닫기
```

#### TC-D08-5: 공통 반응형 검증

```
모든 브레이크포인트에서:
  □ 터치 타겟 최소 44×44px
  □ 텍스트 최소 14px (본문), 18px (입력 필드)
  □ 버튼 최소 높이 36px
  □ 포커스 인디케이터 2px outline 표시
  □ 스크롤바 정상 동작
  □ 오버플로우/언더플로우 없음
  □ 콘솔 에러 없음
```

---

### TC-D09: 대시보드 통계 표시

**우선순위**: P0  
**대상 API**: `GET /api/admin/stats/summary`, `GET /api/admin/stats/hourly`, `GET /api/admin/stats/popular`, `GET /api/admin/stats/recent`

#### TC-D09-1: 오늘의 현황 카드

```
사전 조건: admin으로 로그인, 대출/반납 데이터 존재

단계:
  1. /admin/dashboard 접근
  2. GET /api/admin/stats/summary
     - 200 OK: { todayBorrow, todayReturn, activeBorrow, overdueCount }
  3. 4개 지표 카드 표시:
     - 금일 대출 건수 (숫자 + 전일 대비 증감)
     - 금일 반납 건수 (숫자 + 전일 대비 증감)
     - 현재 대출 중 권수
     - 연체 건수 (0이면 녹색, >0이면 적색 경고)
```

#### TC-D09-2: 시간대별 그래프

```
단계:
  1. GET /api/admin/stats/hourly?days=7
     - 200 OK: { data: [{ hour, borrowCount, returnCount }] }
  2. BarChart 렌더링:
     - X축: 0~23시
     - Y축: 건수
     - 2개 시리즈: 대출(청색), 반납(녹색)
     - Tooltip 표시 (hour, count)
  3. recharts 컴포넌트 정상 렌더링 확인
```

#### TC-D09-3: 인기 도서 TOP 10

```
단계:
  1. GET /api/admin/stats/popular?limit=10
     - 200 OK: { books: [{ rank, title, author, borrowCount }] }
  2. TOP 10 리스트 렌더링:
     - 순위, 도서명, 저자, 대출 횟수
     - 최대 10건 표시
```

#### TC-D09-4: 최근 활동

```
단계:
  1. GET /api/admin/stats/recent?limit=20
     - 200 OK: { activities: [{ time, userName, bookTitle, type }] }
  2. 최근 20건 리스트:
     - 시간, 사용자명, 도서명, 유형(대출/반납)
     - 최신순 정렬
```

#### TC-D09-5: 통계 데이터 없는 상태

```
단계:
  1. 대출/반납 기록이 0건인 DB에서 접근
     - 오늘의 현황: 모든 값 0
     - 그래프: 빈 차트 + "데이터가 없습니다" 안내
     - TOP 10: 빈 리스트 + 안내
     - 최근 활동: 빈 리스트 + 안내
```

---

### TC-D10: 공지 관리

**우선순위**: P1  
**대상 API**: `GET /api/admin/notices`, `POST /api/admin/notices`, `PATCH /api/admin/notices/:id`, `DELETE /api/admin/notices/:id`

#### TC-D10-1: 공지 등록

```
사전 조건: admin으로 로그인

단계:
  1. /admin/notices 접근 → "공지 등록" 버튼 클릭
  2. 폼 입력:
     - 제목: "시스템 점검 안내"
     - 내용: "3월 10일 02:00~06:00 시스템 점검으로 이용이 제한됩니다."
     - 시작 일시: 2026-03-09T00:00:00
     - 종료 일시: 2026-03-10T06:00:00
     - 우선순위: 1 (높음)
  3. "등록" 클릭
     - POST /api/admin/notices
     - 201 Created
     - 목록에 즉시 표시
     - AuditLog: { action: "CREATE", entity: "Notice" }
  4. 키오스크 대기 화면 반영 확인
     - 활성 공지가 대기 화면에 표시
```

#### TC-D10-2: 공지 수정

```
단계:
  1. 공지 행 클릭 → 수정 폼
  2. 내용 변경 → "저장" 클릭
     - PATCH /api/admin/notices/:id
     - 200 OK
```

#### TC-D10-3: 공지 삭제

```
단계:
  1. "삭제" 버튼 클릭 → 확인 다이얼로그
  2. "확인" 클릭
     - DELETE /api/admin/notices/:id
     - 200 OK
     - 키오스크 대기 화면에서 해당 공지 제거
```

#### TC-D10-4: 공지 시간 범위 검증

```
오류 케이스:
  1. 종료 일시 < 시작 일시
     → 400 Bad Request: "종료 일시는 시작 일시 이후여야 합니다"
  2. 시작 일시 누락 → 400
  3. 종료 일시 누락 → 400
```

#### TC-D10-5: operator 공지 쓰기 불가

```
단계:
  1. operator로 /admin/notices 접근
     - 읽기 전용 (등록/수정/삭제 버튼 숨김)
  2. POST /api/admin/notices with operator JWT
     → 403 Forbidden
```

---

## 4. API 수동 검증 스크립트

### 4.1 관리자 로그인 및 Token 추출

```bash
#!/bin/bash
# tests/admin-login.sh

BASE="http://localhost:3000"

echo "=== TC-D01: 관리자 로그인 ==="

# 1. 정상 로그인 — admin
echo -n "[1] admin 로그인: "
LOGIN_RESP=$(curl -s -X POST "$BASE/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@library.kr","password":"Admin123!"}')
ADMIN_TOKEN=$(echo "$LOGIN_RESP" | jq -r '.accessToken')
ADMIN_RT=$(echo "$LOGIN_RESP" | jq -r '.refreshToken')
echo "accessToken=${ADMIN_TOKEN:0:20}..."

# 2. 정상 로그인 — super_admin
echo -n "[2] super_admin 로그인: "
SA_RESP=$(curl -s -X POST "$BASE/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"super@library.kr","password":"Admin123!"}')
SA_TOKEN=$(echo "$SA_RESP" | jq -r '.accessToken')
echo "accessToken=${SA_TOKEN:0:20}..."

# 3. 정상 로그인 — operator
echo -n "[3] operator 로그인: "
OP_RESP=$(curl -s -X POST "$BASE/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@library.kr","password":"Oper123!"}')
OP_TOKEN=$(echo "$OP_RESP" | jq -r '.accessToken')
echo "accessToken=${OP_TOKEN:0:20}..."

# 4. 로그인 실패 — 틀린 비밀번호
echo -n "[4] 틀린 비밀번호: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@library.kr","password":"Wrong123!"}')
echo "HTTP $HTTP_CODE (expect 401)"

# 5. 로그인 실패 — 없는 이메일
echo -n "[5] 없는 이메일: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@test.kr","password":"Admin123!"}')
echo "HTTP $HTTP_CODE (expect 401)"

# 6. 빈 이메일
echo -n "[6] 빈 이메일: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"","password":"Admin123!"}')
echo "HTTP $HTTP_CODE (expect 400)"

# Token을 환경변수로 export (후속 스크립트에서 사용)
export ADMIN_TOKEN SA_TOKEN OP_TOKEN
```

### 4.2 CMS 콘텐츠 변경 및 키오스크 반영 검증

```bash
#!/bin/bash
# tests/cms-update.sh

BASE="http://localhost:3000"
# ADMIN_TOKEN은 이전 스크립트에서 export됨

echo "=== TC-D02: CMS 콘텐츠 변경 ==="

# 1. 현재 대기 화면 타이틀 조회
echo -n "[1] 현재 idle.title_text: "
curl -s "$BASE/api/admin/cms/idle.title_text" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.value'

# 2. 타이틀 변경
echo -n "[2] 타이틀 변경: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/admin/cms/idle.title_text" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"행복 도서관"}')
echo "HTTP $HTTP_CODE (expect 200)"

# 3. 변경 확인 (관리자 API)
echo -n "[3] 변경 후 관리자 API 확인: "
curl -s "$BASE/api/admin/cms/idle.title_text" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.value'

# 4. 키오스크 공개 API로 반영 확인 (인증 불필요)
echo -n "[4] 키오스크 공개 API 확인: "
curl -s "$BASE/api/cms/idle.title_text" | jq -r '.value'

# 5. 배경색 변경
echo -n "[5] 배경색 변경: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/admin/cms/idle.bg_color" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"#2D4A7F"}')
echo "HTTP $HTTP_CODE (expect 200)"

# 6. 대출 규칙 변경
echo -n "[6] 최대 대출 권수 3으로 변경: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/admin/cms/rules.max_borrow_count" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"3"}')
echo "HTTP $HTTP_CODE (expect 200)"

# 7. 원래값으로 복원
echo -n "[7] 타이틀 복원: "
curl -s -o /dev/null -w "HTTP %{http_code}" -X PATCH "$BASE/api/admin/cms/idle.title_text" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"스마트 도서관"}'
echo ""

# 8. 잘못된 HEX 값
echo -n "[8] 잘못된 HEX 값: "
RESP=$(curl -s -X PATCH "$BASE/api/admin/cms/idle.bg_color" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"ZZZZZZ"}')
echo "$RESP" | jq -r '.error.code // "OK"'
```

### 4.3 도서 CRUD

```bash
#!/bin/bash
# tests/book-crud.sh

BASE="http://localhost:3000"

echo "=== TC-D03: 도서 CRUD ==="

# 1. 도서 목록 조회
echo -n "[1] 도서 목록: "
TOTAL=$(curl -s "$BASE/api/admin/books?page=1&limit=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.total')
echo "total=$TOTAL"

# 2. 도서 등록
echo -n "[2] 도서 등록: "
CREATE_RESP=$(curl -s -X POST "$BASE/api/admin/books" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"데미안",
    "author":"헤르만 헤세",
    "isbn":"9788932917249",
    "category":"소설",
    "publisher":"민음사",
    "publishYear":2018
  }')
BOOK_ID=$(echo "$CREATE_RESP" | jq -r '.id')
echo "id=$BOOK_ID"

# 3. ISBN 중복 등록
echo -n "[3] ISBN 중복: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/books" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"데미안 복제",
    "author":"헤르만 헤세",
    "isbn":"9788932917249",
    "category":"소설"
  }')
echo "HTTP $HTTP_CODE (expect 409)"

# 4. 도서 수정
echo -n "[4] 도서 수정: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/admin/books/$BOOK_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"데미안 (개정판)"}')
echo "HTTP $HTTP_CODE (expect 200)"

# 5. 도서 삭제
echo -n "[5] 도서 삭제: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/admin/books/$BOOK_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "HTTP $HTTP_CODE (expect 200)"

# 6. 필수 필드 누락
echo -n "[6] 필수 필드 누락: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/books" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"제목만"}')
echo "HTTP $HTTP_CODE (expect 400)"

# 7. 검색
echo -n "[7] 도서 검색 '데미안': "
COUNT=$(curl -s "$BASE/api/admin/books?search=데미안" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.total')
echo "results=$COUNT"
```

### 4.4 사용자 CRUD

```bash
#!/bin/bash
# tests/user-crud.sh

BASE="http://localhost:3000"

echo "=== TC-D04: 사용자 CRUD ==="

# 1. 사용자 목록 조회
echo -n "[1] 사용자 목록: "
TOTAL=$(curl -s "$BASE/api/admin/users?page=1&limit=50" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.total')
echo "total=$TOTAL"

# 2. 사용자 등록
echo -n "[2] 사용자 등록: "
CREATE_RESP=$(curl -s -X POST "$BASE/api/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"김도서",
    "rfid":"RFID-001234",
    "pin":"123456",
    "phone":"010-1234-5678",
    "email":"kim@library.kr"
  }')
USER_ID=$(echo "$CREATE_RESP" | jq -r '.id')
echo "id=$USER_ID"

# 3. RFID 중복
echo -n "[3] RFID 중복: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"중복사용자","rfid":"RFID-001234","pin":"654321"}')
echo "HTTP $HTTP_CODE (expect 409)"

# 4. 사용자 수정
echo -n "[4] 사용자 수정: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"010-9876-5432"}')
echo "HTTP $HTTP_CODE (expect 200)"

# 5. 사용자 비활성화
echo -n "[5] 사용자 비활성화: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"SUSPENDED"}')
echo "HTTP $HTTP_CODE (expect 200)"

# 6. PIN 형식 오류
echo -n "[6] PIN 5자리: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"테스트","rfid":"RFID-999999","pin":"12345"}')
echo "HTTP $HTTP_CODE (expect 400)"
```

### 4.5 권한 거부 (Permission Denied) 테스트

```bash
#!/bin/bash
# tests/permission-denied.sh

BASE="http://localhost:3000"
# ADMIN_TOKEN, OP_TOKEN, SA_TOKEN은 이전 스크립트에서 export됨

echo "=== TC-D05: 권한 관리 (RBAC) ==="

# ── operator 권한 검증 ──

echo "--- operator 권한 ---"

# 1. operator → CMS 쓰기 (거부)
echo -n "[1] operator CMS 쓰기: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/admin/cms/idle.title_text" \
  -H "Authorization: Bearer $OP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"해킹시도"}')
echo "HTTP $HTTP_CODE (expect 403)"

# 2. operator → 도서 등록 (거부)
echo -n "[2] operator 도서 등록: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/books" \
  -H "Authorization: Bearer $OP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"x","author":"x","isbn":"9780000000001","category":"소설"}')
echo "HTTP $HTTP_CODE (expect 403)"

# 3. operator → 사용자 등록 (거부)
echo -n "[3] operator 사용자 등록: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/users" \
  -H "Authorization: Bearer $OP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"x","rfid":"RFID-XXX","pin":"123456"}')
echo "HTTP $HTTP_CODE (expect 403)"

# 4. operator → 감사 로그 조회 (거부)
echo -n "[4] operator 감사 로그: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/audit" \
  -H "Authorization: Bearer $OP_TOKEN")
echo "HTTP $HTTP_CODE (expect 403)"

# 5. operator → 관리자 계정 조회 (거부)
echo -n "[5] operator 계정 관리: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/accounts" \
  -H "Authorization: Bearer $OP_TOKEN")
echo "HTTP $HTTP_CODE (expect 403)"

# 6. operator → 도서 목록 조회 (허용)
echo -n "[6] operator 도서 조회: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/books" \
  -H "Authorization: Bearer $OP_TOKEN")
echo "HTTP $HTTP_CODE (expect 200)"

# 7. operator → 통계 조회 (허용)
echo -n "[7] operator 통계 조회: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/stats/summary" \
  -H "Authorization: Bearer $OP_TOKEN")
echo "HTTP $HTTP_CODE (expect 200)"

# ── admin 권한 검증 ──

echo "--- admin 권한 ---"

# 8. admin → 관리자 계정 생성 (거부)
echo -n "[8] admin 계정 생성: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/accounts" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"new@library.kr","name":"신규","role":"operator","password":"New123!"}')
echo "HTTP $HTTP_CODE (expect 403)"

# 9. admin → 관리자 계정 조회 (거부)
echo -n "[9] admin 계정 조회: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/accounts" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "HTTP $HTTP_CODE (expect 403)"

# 10. admin → CMS 쓰기 (허용)
echo -n "[10] admin CMS 쓰기: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/admin/cms/idle.title_text" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"스마트 도서관"}')
echo "HTTP $HTTP_CODE (expect 200)"

# ── 미인증 요청 ──

echo "--- 미인증 요청 ---"

# 11. JWT 없이 관리자 API 호출
echo -n "[11] 미인증 요청: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/books")
echo "HTTP $HTTP_CODE (expect 401)"
```

### 4.6 감사 로그 조회

```bash
#!/bin/bash
# tests/audit-log.sh

BASE="http://localhost:3000"

echo "=== TC-D07: 감사 로그 기록 확인 ==="

# 1. 전체 감사 로그 조회 (super_admin)
echo -n "[1] 전체 로그: "
TOTAL=$(curl -s "$BASE/api/admin/audit?page=1&limit=50" \
  -H "Authorization: Bearer $SA_TOKEN" | jq '.total')
echo "total=$TOTAL"

# 2. CMS 변경 로그만 필터
echo -n "[2] CMS UPDATE 로그: "
RESP=$(curl -s "$BASE/api/admin/audit?entity=CmsContent&action=UPDATE&page=1&limit=5" \
  -H "Authorization: Bearer $SA_TOKEN")
echo "$RESP" | jq '.total'

# 3. 특정 작업자 로그
echo -n "[3] 특정 작업자 로그: "
ADMIN_ID=$(curl -s "$BASE/api/admin/accounts" \
  -H "Authorization: Bearer $SA_TOKEN" | jq -r '.accounts[0].id')
curl -s "$BASE/api/admin/audit?performedBy=$ADMIN_ID&page=1&limit=5" \
  -H "Authorization: Bearer $SA_TOKEN" | jq '.total'

# 4. 기간 필터
echo -n "[4] 기간 필터 (최근 7일): "
FROM_DATE=$(date -d '7 days ago' +%Y-%m-%d)
TO_DATE=$(date +%Y-%m-%d)
curl -s "$BASE/api/admin/audit?from=$FROM_DATE&to=$TO_DATE&page=1&limit=5" \
  -H "Authorization: Bearer $SA_TOKEN" | jq '.total'

# 5. 로그 항목 상세 확인 (oldValue/newValue diff 존재)
echo -n "[5] 변경 diff 확인: "
curl -s "$BASE/api/admin/audit?entity=CmsContent&action=UPDATE&page=1&limit=1" \
  -H "Authorization: Bearer $SA_TOKEN" | \
  jq '.logs[0] | {action, entity, oldValue, newValue, performedAt}'

# 6. operator 접근 거부
echo -n "[6] operator 감사 로그 접근: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/audit" \
  -H "Authorization: Bearer $OP_TOKEN")
echo "HTTP $HTTP_CODE (expect 403)"
```

---

## 5. Agent Browser E2E 검증 프로시저

### 5.1 필수 검증 체크리스트

```markdown
□ 서버 실행 확인
  - curl http://localhost:3000/api/health → "ok"

□ 로그인 페이지 렌더링 (TC-D01)
  - /admin/login 접근 → 이메일/비밀번호 입력 필드 표시
  - 빈 페이지/에러 없음
  - 콘솔 에러 없음

□ 정상 로그인 플로우 (TC-D01-1)
  - 이메일/비밀번호 입력 → "로그인" 클릭 → /admin/dashboard 리다이렉트
  - 사용자 이름, 역할 배지 표시
  - 사이드바 메뉴 역할에 맞게 표시

□ 로그인 오류 표시 (TC-D01-2)
  - 틀린 자격증명 → 에러 토스트 표시
  - 빈 이메일 → 인라인 검증 에러

□ 대시보드 페이지 로드 (TC-D09)
  - 4개 지표 카드 렌더링
  - 시간대별 그래프 렌더링 (recharts)
  - 인기 도서 TOP 10 리스트
  - 최근 활동 리스트

□ CMS 편집기 모든 필드 표시 (TC-D02)
  - /admin/cms → 대기 화면 탭
  - 텍스트 필드: idle.title_text, idle.subtitle_text, idle.touch_prompt
  - 컬러 피커: idle.bg_color, idle.touch_prompt_color
  - 이미지 업로드: idle.logo_image, idle.bg_image
  - 모든 화면 탭 (대기/메인/인증/선택/대출완료/반납완료/규칙) 전환 동작

□ CMS 콘텐츠 변경 → 키오스크 반영 (TC-D02)
  - 텍스트 변경 → 저장 → 토스트 "저장되었습니다"
  - 키오스크 대기 화면에서 변경된 텍스트 확인 (≤3초)

□ 도서 CRUD 동작 (TC-D03)
  - /admin/books → 목록 렌더링
  - "도서 등록" → 폼 → 등록 → 목록에 즉시 표시
  - 행 클릭 → 수정 → 저장 → 반영
  - "삭제" → 확인 다이얼로그 → 삭제 → 목록에서 제거

□ 사용자 CRUD 동작 (TC-D04)
  - /admin/users → 목록 렌더링 (PIN 마스킹)
  - 등록/수정/비활성화 동작

□ 권한 거부 표시 (TC-D05)
  - operator로 로그인 → CMS 편집 컨트롤 비활성화
  - operator로 쓰기 시도 → 403 에러 토스트
  - admin으로 계정 관리 접근 → 403 또는 숨김

□ 이미지 업로드 (TC-D06)
  - 정상 PNG → 업로드 성공 → 미리보기 썸네일
  - 크기 초과 → 에러 토스트
  - 타입 오류 → 에러 토스트

□ 반응형 레이아웃 (TC-D08)
  - 1920×1080 (kiosk-xl): 3-column, 사이드바 240px
  - 1280×720 (kiosk-lg): 3-column, 폰트 축소
  - 768×1024 (tablet): 2-column, 사이드바 아이콘 전용
  - 375×667 (mobile): 1-column, 햄버거 메뉴, 카드 뷰

□ 공지 관리 (TC-D10)
  - /admin/notices → 목록, 등록, 수정, 삭제 동작

□ 감사 로그 (TC-D07)
  - /admin/audit → 로그 리스트 렌더링
  - 필터 동작 (엔티티, 액션, 기간)
  - operator 접근 → 403

□ 하이드레이션 미스매치 없음
□ 콘솔 오류 없음
□ React 경고 없음
```

### 5.2 Agent Browser 검증 절차 상세

#### 단계 1: 서버 기동 확인

```
Agent Browser 명령:
  1. curl http://localhost:3000/api/health
     기대: { "status": "ok" }
  2. 서버 비정상 시 bun run dev 실행 후 재확인
```

#### 단계 2: 로그인 페이지 검증

```
Agent Browser 명령:
  1. navigate http://localhost:3000/admin/login
  2. snapshot
     확인: 이메일 입력 필드 존재
     확인: 비밀번호 입력 필드 존재
     확인: "로그인" 버튼 존재
     확인: 빈 화면/에러 없음
  3. type [email] "admin@library.kr"
  4. type [password] "Admin123!"
  5. click [로그인 버튼]
  6. wait 2000
  7. snapshot
     확인: URL이 /admin/dashboard로 변경
     확인: 사용자 이름 표시
     확인: 사이드바 메뉴 표시
```

#### 단계 3: 대시보드 페이지 검증

```
Agent Browser 명령:
  1. navigate http://localhost:3000/admin/dashboard
  2. snapshot
     확인: 4개 지표 카드 렌더링 (금일 대출, 금일 반납, 대출 중, 연체)
     확인: 시간대별 BarChart 렌더링
     확인: 인기 도서 TOP 10 리스트
     확인: 최근 활동 리스트
```

#### 단계 4: CMS 편집기 검증

```
Agent Browser 명령:
  1. navigate http://localhost:3000/admin/cms
  2. snapshot
     확인: 화면별 탭 표시 (대기/메인/인증/선택/대출완료/반납완료/규칙)
     확인: "대기 화면" 탭 활성 상태
     확인: 텍스트 입력 필드 표시
     확인: 컬러 피커 표시
     확인: 이미지 업로드 영역 표시
  3. click [대기 화면 탭]
  4. type [idle.title_text] "행복 도서관"
  5. click [저장 버튼]
  6. wait 1000
  7. snapshot
     확인: 토스트 "저장되었습니다" 표시
```

#### 단계 5: 권한 거부 검증 (operator)

```
Agent Browser 명령:
  1. navigate http://localhost:3000/admin/login
  2. type [email] "operator@library.kr"
  3. type [password] "Oper123!"
  4. click [로그인 버튼]
  5. wait 2000
  6. navigate http://localhost:3000/admin/cms
  7. snapshot
     확인: 편집 컨트롤 비활성화 (readonly, 저장 버튼 숨김)
     확인: 읽기 전용 모드 안내 문구
  8. navigate http://localhost:3000/admin/audit
  9. snapshot
     확인: 403 에러 또는 접근 불가 안내
```

#### 단계 6: 반응형 레이아웃 검증

```
Agent Browser 명령:
  1. viewport 1920 1080
  2. navigate http://localhost:3000/admin/dashboard
  3. snapshot → 확인: 3-column grid, 사이드바 240px
  4. viewport 1280 720
  5. snapshot → 확인: 3-column grid, 폰트 축소
  6. viewport 768 1024
  7. snapshot → 확인: 2-column grid, 사이드바 아이콘 전용
  8. viewport 375 667
  9. snapshot → 확인: 1-column stack, 햄버거 메뉴
  10. click [햄버거 메뉴]
  11. snapshot → 확인: 슬라이드 오버레이 메뉴
```

### 5.3 dev.log 확인 항목

```
□ Fatal error 없음
□ Hydration mismatch 없음
□ API 500 오류 없음
□ Unhandled promise rejection 없음
□ 메모리 부족 경고 없음
□ WebSocket 연결 에러 없음 (정상 운영 시)
□ CORS 에러 없음
□ Prisma 쿼리 에러 없음
```

---

## 6. 릴리즈 검증 기준

### 6.1 1차 릴리즈 (MVP, P0) 인수 기준

| 항목 | 기준 | 검증 방법 | 테스트 케이스 |
|------|------|-----------|---------------|
| **빌드** | `bun run lint` 0 오류, `bunx tsc --noEmit` 0 오류 | CI 자동 | — |
| **서버** | 포트 3000 정상 응답 | curl /api/health | — |
| **관리자 로그인** | 정상/오류/잠금 모두 동작 | Agent Browser + curl | TC-D01 |
| **CMS 변경 → 키오스크 반영** | ≤3초 실측 | Agent Browser + curl | TC-D02 |
| **도서 CRUD** | 등록/조회/수정/삭제 정상 | Agent Browser + curl | TC-D03 |
| **사용자 CRUD** | 등록/조회/수정/비활성화 정상 | Agent Browser + curl | TC-D04 |
| **RBAC 완전 검증** | 각 역할별 허용·차단 100% | curl (403/200 확인) | TC-D05 |
| **이미지 업로드** | 정상/크기초과/타입오류 | Agent Browser + curl | TC-D06 |
| **반응형 레이아웃** | 4개 브레이크포인트 깨짐 없음 | Agent Browser viewport | TC-D08 |
| **대시보드 통계** | 4개 지표 + 그래프 + TOP 10 + 최근 활동 | Agent Browser + curl | TC-D09 |
| **콘솔 오류** | 0건 | dev.log | — |
| **하이드레이션 미스매치** | 0건 | dev.log | — |
| **Lighthouse 접근성** | 점수 ≥ 90 | Lighthouse CI | — |
| **LCP** | ≤ 2초 (로컬 네트워크) | Lighthouse CI | — |
| **번들 크기** | First Load JS ≤ 200KB (gzip) | 빌드 출력 | — |

### 6.2 2차 릴리즈 (P1) 인수 기준

| 항목 | 기준 | 검증 방법 | 테스트 케이스 |
|------|------|-----------|---------------|
| **감사 로그** | 모든 쓰기 작업 기록, oldValue/newValue diff 존재 | curl + DB | TC-D07 |
| **공지 관리** | 등록/수정/삭제 + 시간 범위 + 키오스크 반영 | Agent Browser + curl | TC-D10 |
| **화면 미리보기** | 4개 뷰포트 iframe 프리뷰 동작 | Agent Browser | — |
| **CSV 일괄 등록** | 최대 1,000건, 오류 리포트 | curl | — |
| **통계 CSV 내보내기** | 다운로드 동작 | Agent Browser | — |

### 6.3 3차 릴리즈 (P2) 인수 기준

| 항목 | 기준 | 검증 방법 | 테스트 케이스 |
|------|------|-----------|---------------|
| **다중 키오스크** | 단말 등록 + 단말별 CMS 프로파일 | Agent Browser | — |
| **다국어 CMS** | KO/EN/ZH/JA 4개국어 전환 | Agent Browser | — |
| **예약 기능** | 대출 예약 대기열 동작 | Agent Browser | — |
| **알림 연동** | 연체 이메일/문자 발송 | curl (mock) | — |

### 6.4 릴리즈 전 체크리스트

```markdown
□ 모든 P0 테스트 케이스 통과
□ bun run lint: 0 오류
□ bunx tsc --noEmit: 0 오류
□ Unit 테스트: Statements ≥ 80%, Branches ≥ 75%
□ Agent Browser E2E: 섹션 5.1 체크리스트 전부 □
□ API 수동 검증: 섹션 4 스크립트 전부 PASS
□ dev.log: Fatal/Hydration/500 오류 0건
□ 반응형: 4개 브레이크포인트 레이아웃 깨짐 0건
□ RBAC: 3개 역할 × 전체 권한 매핑 검증 완료
□ Lighthouse: 접근성 ≥ 90, LCP ≤ 2s, 번들 ≤ 200KB gzip
□ 감사 로그: 모든 쓰기 작업 기록 확인
□ 이미지 업로드: 정상/크기초과/타입오류/MIME 검증 통과
□ CMS → 키오스크 실시간 반영: ≤3초 실측
□ 보안: Rate Limit, XSS, CSRF, SVG sanitize 검증 통과
□ Prisma 마이그레이션: 프로덕션 DB 적용 성공
```

### 6.5 회귀 테스트 범위

| 변경 유형 | 필수 회귀 범위 |
|-----------|---------------|
| CMS 콘텐츠 로직 변경 | TC-D02 전체 + TC-D07 (감사 로그) |
| RBAC 권한 변경 | TC-D05 전체 (3개 역할 × 전체 매핑) |
| API 엔드포인트 추가/수정 | 해당 CRUD TC + 권한 TC |
| 반응형 CSS 변경 | TC-D08 전체 (4개 브레이크포인트) |
| 이미지 처리 변경 | TC-D06 전체 |
| Prisma 스키마 변경 | 전체 TC (DB 마이그레이션 후) |
| 인증 로직 변경 | TC-D01 전체 + TC-D05-4 |
| 공지 로직 변경 | TC-D10 전체 |

---

> **변경 이력**

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| v1.0.0 | 2026-03-05 | 최초 작성 | Dashboard QA Team |
