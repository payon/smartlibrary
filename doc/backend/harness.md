# Test Harness Document — Backend Admin Dashboard

## 스마트 도서관 무인 키오스크 시뮬레이터 — 관리자 대시보드 테스트 하네스

---

## 1. 테스트 전략

### 1.1 테스트 피라미드

```
           ┌──────────┐
           │  E2E     │  ← Agent Browser 관리자 화면 자동 검증
           │  (적음)  │
          ┌┴──────────┴┐
          │ Integration │  ← Admin API Route + DB 상태 검증
          │  (중간)     │
         ┌┴────────────┴┐
         │   Unit        │  ← 서비스 로직 / RBAC / 감사 단위 검증
         │   (많음)      │
         └───────────────┘
```

### 1.2 테스트 원칙

| 원칙 | 설명 |
|---|---|
| **인증 우선** | 모든 관리자 API는 인증·권한 검증이 선행 조건 |
| **RBAC 강제** | admin / operator 역할에 따라 접근 가능 엔드포인트 차단 |
| **감사 추적** | 모든 쓰기 액션은 감사 로그에 기록되어야 함 |
| **실시간 동기화** | 콘텐츠 수정 후 키오스크에 30초 이내 반영 |
| **브라우저 검증 필수** | 빌드 성공 ≠ 동작 성공. Agent Browser로 E2E 검증 |
| **데이터 무결성** | 대출 중 도서 삭제 방지, 콘텐츠 버전 히스토리 보존 |

---

## 2. 테스트 환경

### 2.1 개발 서버

```bash
# 서버 시작
bun run dev    # Next.js on port 3000

# 서버 상태 확인
curl http://localhost:3000/api

# 관리자 대시보드 접속
open http://localhost:3000/admin

# 린트 검사
bun run lint
```

### 2.2 브라우저 검증 도구

| 도구 | 용도 | 실행 방법 |
|---|---|---|
| Agent Browser | E2E 자동 검증 (관리자 화면) | Skill: `agent-browser` |
| Dev Log | 런타임 오류 확인 | `Read /home/z/my-project/dev.log` |
| Preview Panel | 시각적 확인 | 우측 패널 |
| Network Tab | API 요청/응답 확인 | 브라우저 개발자 도구 |

### 2.3 API 수동 검증

```bash
# 관리자 로그인 → 세션 쿠키 획득
curl -X POST http://localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"admin@library.kr","password":"admin1234!"}'

# CMS 콘텐츠 조회
curl http://localhost:3000/api/admin/cms \
  -b cookies.txt

# CMS 콘텐츠 수정
curl -X PATCH http://localhost:3000/api/admin/cms/CONTENT_ID \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"value":"새로운 환영 메시지"}'

# 도서 목록 조회
curl http://localhost:3000/api/admin/books \
  -b cookies.txt

# 도서 생성
curl -X POST http://localhost:3000/api/admin/books \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"테스트 도서","author":"저자","isbn":"9788901234567","categoryId":"CAT_ID","totalCopies":3}'

# 통계 데이터 조회
curl http://localhost:3000/api/admin/stats \
  -b cookies.txt

# 감사 로그 조회
curl "http://localhost:3000/api/admin/audit-logs?limit=50" \
  -b cookies.txt
```

---

## 3. 테스트 케이스

### 3.1 인증 테스트 (P0)

#### TC-B001: 관리자 로그인 성공

```
사전 조건: 서버 실행, 관리자 계정(admin@library.kr) 존재

단계:
  1. POST /api/admin/auth/login
     - body: { email: "admin@library.kr", password: "admin1234!" }

  2. 응답 확인
     - HTTP 200
     - 응답 본문에 { success: true, user: { role: "admin" } }
     - Set-Cookie: session 토큰 존재
     - 세션 만료시간: 8시간 이후

  3. 세션 쿠키로 보호된 엔드포인트 접근
     - GET /api/admin/stats → HTTP 200

기대 결과: 로그인 성공, 세션 쿠키 발급, 보호된 리소스 접근 가능
```

#### TC-B002: 관리자 로그인 실패 (잘못된 비밀번호)

```
사전 조건: 서버 실행, 관리자 계정 존재

단계:
  1. POST /api/admin/auth/login
     - body: { email: "admin@library.kr", password: "wrong-password!" }

  2. 응답 확인
     - HTTP 401
     - 응답 본문에 { error: "인증 정보가 올바르지 않습니다" }
     - Set-Cookie: 세션 토큰 미발급

  3. 보호된 엔드포인트 접근 시도
     - GET /api/admin/stats → HTTP 401

기대 결과: 로그인 실패, 세션 미발급, 보호된 리소스 접근 차단
```

#### TC-B003: 세션 만료 및 갱신

```
사전 조건: 관리자 로그인 완료, 세션 쿠키 보유

단계:
  1. 세션 만료 시간 경과 후 (또는 만료된 세션 쿠키 사용)
     - GET /api/admin/stats → HTTP 401
     - 응답 본문에 { error: "세션이 만료되었습니다" }

  2. 세션 갱신 요청
     - POST /api/admin/auth/refresh → HTTP 200
     - 새 세션 쿠키 발급

  3. 갱신된 세션으로 접근
     - GET /api/admin/stats → HTTP 200

기대 결과: 만료된 세션 차단, 갱신 후 정상 접근 복구
```

#### TC-B004: RBAC 권한 차단 (operator가 admin 전용 기능 접근 시)

```
사전 조건: operator 역할 계정(operator@library.kr)으로 로그인

단계:
  1. operator 세션으로 admin 전용 엔드포인트 접근
     - GET /api/admin/users → HTTP 403
     - POST /api/admin/users → HTTP 403
     - DELETE /api/admin/users/USER_ID → HTTP 403

  2. 응답 본문 확인
     - { error: "접근 권한이 없습니다" }

  3. operator 허용 엔드포인트 접근
     - GET /api/admin/books → HTTP 200
     - GET /api/admin/cms → HTTP 200

기대 결과: admin 전용 기능 403 차단, operator 허용 기능 정상 접근
```

---

### 3.2 CMS 콘텐츠 관리 테스트 (P0)

#### TC-B005: 텍스트 콘텐츠 수정 및 저장

```
사전 조건: 관리자 로그인 완료, CMS 콘텐츠 존재

단계:
  1. 현재 콘텐츠 조회
     - GET /api/admin/cms → 200
     - 키: "welcomeMessage", 값: "도서관에 오신 것을 환영합니다"

  2. 콘텐츠 수정
     - PATCH /api/admin/cms/CONTENT_ID
     - body: { value: "새로운 환영 메시지입니다" }
     - HTTP 200

  3. 수정 결과 확인
     - GET /api/admin/cms → 200
     - 키: "welcomeMessage", 값: "새로운 환영 메시지입니다"

  4. 감사 로그 확인
     - 콘텐츠 수정 액션이 감사 로그에 기록됨

기대 결과: 콘텐츠 수정 즉시 저장, 조회 시 수정값 반영
```

#### TC-B006: 이미지 콘텐츠 업로드 및 교체

```
사전 조건: 관리자 로그인 완료

단계:
  1. 이미지 업로드
     - POST /api/admin/cms/upload (multipart/form-data)
     - 파일: hero-banner.png (2MB 이하)
     - HTTP 200, 응답에 { url: "/uploads/..." }

  2. 이미지 교체
     - 동일 키에 새 이미지 업로드
     - 기존 이미지 URL 대체 확인

  3. 파일 크기 초과 시
     - 5MB 이상 파일 업로드 → HTTP 413
     - { error: "파일 크기는 2MB를 초과할 수 없습니다" }

  4. 허용되지 않은 형식
     - .exe 파일 업로드 → HTTP 400
     - { error: "지원하지 않는 파일 형식입니다" }

기대 결과: 이미지 업로드/교체 정상, 크기·형식 제한 동작
```

#### TC-B007: 콘텐츠 수정 후 실시간 동기화 (kiosk에 즉시 반영)

```
사전 조건: 관리자 로그인 완료, 키오스크 클라이언트 실행 중

단계:
  1. 키오스크에서 현재 콘텐츠 확인
     - GET /api/cms → welcomeMessage: "기존 메시지"

  2. 관리자가 콘텐츠 수정
     - PATCH /api/admin/cms/CONTENT_ID
     - body: { value: "수정된 메시지" }

  3. 키오스크 폴링 (30초 이내)
     - GET /api/cms → welcomeMessage: "수정된 메시지"
     - 수정 이전 값이 아닌 새 값 반환

  4. 키오스크 UI 갱신 확인
     - 화면에 "수정된 메시지" 표시

기대 결과: 수정 후 30초 이내 키오스크에 변경 사항 반영
```

#### TC-B008: 콘텐츠 버전 히스토리 조회

```
사전 조건: 콘텐츠 수정 이력 존재 (최소 2회 수정)

단계:
  1. 콘텐츠 버전 히스토리 조회
     - GET /api/admin/cms/CONTENT_ID/versions → 200
     - 응답에 버전 배열 (최신순)

  2. 히스토리 항목 확인
     - 각 항목: { version, value, modifiedBy, modifiedAt }
     - 최신 버전이 현재 값과 일치
     - 수정자 정보(admin@library.kr) 포함

  3. 이전 버전 조회
     - GET /api/admin/cms/CONTENT_ID/versions/V2 → 200
     - 해당 버전의 값 반환

기대 결과: 모든 수정 이력 보존, 수정자·시간 기록, 이전 버전 조회 가능
```

#### TC-B009: 콘텐츠 기본값 리셋

```
사전 조건: 콘텐츠가 기본값에서 수정된 상태

단계:
  1. 기본값 리셋 요청
     - POST /api/admin/cms/CONTENT_ID/reset → 200

  2. 리셋 결과 확인
     - GET /api/admin/cms → 값이 기본값으로 복원

  3. 감사 로그 확인
     - "콘텐츠 기본값 리셋" 액션 기록

기대 결과: 콘텐츠가 기본값으로 복원, 감사 로그 기록
```

---

### 3.3 도서 관리 테스트 (P0)

#### TC-B010: 도서 생성 (이미지 포함)

```
사전 조건: 관리자 로그인 완료

단계:
  1. 도서 생성 (이미지 없음)
     - POST /api/admin/books
     - body: { title: "새 도서", author: "저자", isbn: "9788901234567",
               categoryId: "CAT_ID", totalCopies: 3 }
     - HTTP 201, 응답에 { id, availableCopies: 3 }

  2. 도서 생성 (이미지 포함)
     - POST /api/admin/books (multipart/form-data)
     - 텍스트 필드 + 이미지 파일
     - HTTP 201, 응답에 { imageUrl: "/uploads/..." }

  3. 필수 필드 누락
     - POST /api/admin/books body: { title: "" }
     - HTTP 400, { error: "필수 필드가 누락되었습니다" }

  4. 중복 ISBN
     - 동일 ISBN으로 재생성 → HTTP 409
     - { error: "이미 존재하는 ISBN입니다" }

기대 결과: 도서 생성 정상, 이미지 업로드 동반, 필수값·중복 검증 동작
```

#### TC-B011: 도서 수정

```
사전 조건: 도서 존재

단계:
  1. 도서 수정
     - PATCH /api/admin/books/BOOK_ID
     - body: { title: "수정된 제목", totalCopies: 5 }
     - HTTP 200

  2. 수정 결과 확인
     - GET /api/admin/books/BOOK_ID → 수정된 값 반영

  3. availableCopies 자동 조정
     - totalCopies를 현재 대출 수보다 작게 설정
     - HTTP 400, { error: "대출 중인 도서 수보다 총 수량을 줄일 수 없습니다" }

기대 결과: 도서 수정 정상, 대출 중 수량 보호 로직 동작
```

#### TC-B012: 도서 삭제 (대출 중인 도서 삭제 방지)

```
사전 조건: 도서 존재, 일부 도서는 대출 중

단계:
  1. 대출 중인 도서 삭제 시도
     - DELETE /api/admin/books/BOOK_ID_ON_LOAN
     - HTTP 409, { error: "대출 중인 도서는 삭제할 수 없습니다" }

  2. 대출 중이 아닌 도서 삭제
     - DELETE /api/admin/books/BOOK_ID_AVAILABLE
     - HTTP 200, { success: true }

  3. 삭제 확인
     - GET /api/admin/books/BOOK_ID_AVAILABLE → HTTP 404

  4. 감사 로그 확인
     - 도서 삭제 액션 기록 (도서 메타데이터 포함)

기대 결과: 대출 중 도서 삭제 차단, 가용 도서 삭제 정상, 감사 로그 기록
```

#### TC-B013: CSV 도서 일괄 등록

```
사전 조건: 관리자 로그인 완료, CSV 파일 준비

단계:
  1. 정상 CSV 업로드
     - POST /api/admin/books/import (multipart/form-data)
     - 파일: books.csv (헤더: title,author,isbn,categoryId,totalCopies)
     - HTTP 200, { imported: 25, skipped: 2, errors: [] }

  2. 중복 ISBN 스킵
     - 이미 존재하는 ISBN은 skipped 카운트에 포함

  3. 형식 오류 CSV
     - 필수 컬럼 누락 CSV → HTTP 400
     - { error: "필수 컬럼이 누락되었습니다: isbn" }

  4. 대용량 CSV (500행 이상)
     - HTTP 200, 백그라운드 처리 후 결과 통지

기대 결과: CSV 일괄 등록 정상, 중복 스킵, 형식 검증 동작
```

---

### 3.4 이용자 관리 테스트 (P1)

#### TC-B014: 관리자 계정 CRUD

```
사전 조건: admin 역할로 로그인

단계:
  1. 관리자 계정 생성
     - POST /api/admin/users
     - body: { email: "new-admin@library.kr", name: "신규관리자", role: "operator", password: "SecureP@ss1" }
     - HTTP 201

  2. 관리자 목록 조회
     - GET /api/admin/users → 200
     - 생성한 계정 포함 확인

  3. 관리자 정보 수정
     - PATCH /api/admin/users/USER_ID
     - body: { name: "수정된 이름" }
     - HTTP 200

  4. 관리자 계정 삭제
     - DELETE /api/admin/users/USER_ID → 200
     - 자기 자신 삭제 시도 → HTTP 400

  5. operator가 admin 생성 시도
     - operator 세션으로 POST /api/admin/users → HTTP 403

기대 결과: 관리자 CRUD 정상, 자기 삭제 방지, RBAC 차단 동작
```

#### TC-B015: 키오스크 이용자 관리

```
사전 조건: 관리자 로그인 완료

단계:
  1. 키오스크 이용자 목록 조회
     - GET /api/admin/kiosk-users → 200
     - 페이지네이션 파라미터 지원 (?page=1&limit=20)

  2. 이용자 상세 조회
     - GET /api/admin/kiosk-users/USER_ID → 200
     - 대출 이력, 연체 현황 포함

  3. 이용자 검색
     - GET /api/admin/kiosk-users?search=홍길동 → 200
     - 이름/PIN 기반 검색 결과

  4. 이용자 대출 기록 조회
     - GET /api/admin/kiosk-users/USER_ID/loans → 200
     - 활성 대출 + 과거 대출 포함

기대 결과: 이용자 조회·검색 정상, 대출 이력 포함
```

---

### 3.5 분석 대시보드 테스트 (P1)

#### TC-B016: 통계 데이터 조회

```
사전 조건: 관리자 로그인 완료, 대출/반납 데이터 존재

단계:
  1. 종합 통계 조회
     - GET /api/admin/stats → 200
     - 응답 필드: { totalBooks, totalUsers, activeLoans, overdueLoans,
                    todayLoans, todayReturns, popularBooks, recentActivities }

  2. 기간별 통계 조회
     - GET /api/admin/stats?from=2025-01-01&to=2025-03-01 → 200
     - 해당 기간 데이터만 반환

  3. 빈 데이터 기간
     - 미래 기간 지정 → 200, 모든 카운트 0

기대 결과: 통계 데이터 정상 조회, 기간 필터 동작
```

#### TC-B017: 차트 렌더링

```
사전 조건: 관리자 대시보드 접속, 통계 데이터 존재

단계:
  1. 대시보드 페이지 접근
     - /admin/dashboard 렌더링
     - 일별 대출 추이 차트 표시
     - 인기 도서 순위 차트 표시
     - 카테고리별 분포 차트 표시

  2. 차트 인터랙션
     - 기간 선택 드롭다운 동작 (7일/30일/90일)
     - 차트 데이터 갱신 확인

  3. 빈 데이터 상태
     - 데이터 없는 기간 → "데이터가 없습니다" 플레이스홀더

기대 결과: 차트 정상 렌더링, 기간 전환 동작, 빈 상태 처리
```

---

### 3.6 반응형 테스트 (P0)

#### TC-B018: 21인치 키오스크 해상도 (1080×1920)

```
단계:
  1. 뷰포트 1080×1920 설정
  2. 관리자 대시보드 렌더링 확인
     - 사이드바 또는 탭 내비게이션 표시
     - 콘텐츠 영역 가로 스크롤 없음
     - 차트 렌더링 정상
  3. CMS 에디터 레이아웃 확인
     - 입력 필드 전체 표시
     - 이미지 미리보기 정상
  4. 버튼 터치 타겟 최소 44×44px 확인
```

#### TC-B019: 24인치 키오스크 해상도 (1080×1920)

```
단계:
  1. 뷰포트 1080×1920 설정
  2. 관리자 대시보드 렌더링 확인
     - TC-B018과 동일 검증
  3. 해상도 동일하나 DPI 차이에 따른 스케일링 확인
     - 폰트 가독성 유지
     - 이미지 선명도 유지
```

#### TC-B020: 태블릿 해상도 (768×1024)

```
단계:
  1. 뷰포트 768×1024 설정
  2. 관리자 대시보드 렌더링 확인
     - 사이드바 → 햄버거 메뉴 전환
     - 콘텐츠 단일 열 레이아웃
  3. 테이블 렌더링
     - 가로 스크롤 또는 카드 레이아웃 전환
     - 모든 데이터 접근 가능
  4. 차트 리사이즈
     - 차트가 컨테이너에 맞게 축소
```

#### TC-B021: 모바일 해상도 (375×812)

```
단계:
  1. 뷰포트 375×812 설정
  2. 관리자 대시보드 렌더링 확인
     - 햄버거 메뉴 + 하단 탭 내비게이션
     - 콘텐츠 전체 폭 사용
  3. 테이블 → 카드 레이아웃 전환 확인
  4. 모달/드로어 동작
     - 생성/수정 폼 → 풀스크린 드로어
  5. 터치 타겟 최소 44×44px 확인
```

---

### 3.7 감사 로그 테스트 (P1)

#### TC-B022: 모든 관리자 액션 감사 기록

```
사전 조건: 관리자 로그인 완료

단계:
  1. 쓰기 액션 수행
     - 도서 생성 (POST /api/admin/books)
     - 콘텐츠 수정 (PATCH /api/admin/cms/ID)
     - 이용자 수정 (PATCH /api/admin/users/ID)
     - 도서 삭제 (DELETE /api/admin/books/ID)

  2. 감사 로그 확인
     - GET /api/admin/audit-logs → 200
     - 각 액션에 대응하는 로그 항목 존재
     - 항목 필드: { action, resource, resourceId, userId, userEmail, timestamp, details }

  3. 읽기 액션은 감사 로그에 기록되지 않음
     - GET /api/admin/stats → 감사 로그 미생성

기대 결과: 모든 쓰기 액션 감사 기록, 읽기 액션 미기록
```

#### TC-B023: 감사 로그 필터링

```
사전 조건: 감사 로그 다수 존재

단계:
  1. 액션 유형 필터링
     - GET /api/admin/audit-logs?action=BOOK_CREATE → 200
     - 도서 생성 로그만 반환

  2. 사용자 필터링
     - GET /api/admin/audit-logs?userId=ADMIN_ID → 200
     - 해당 관리자 로그만 반환

  3. 기간 필터링
     - GET /api/admin/audit-logs?from=2025-01-01&to=2025-03-01 → 200
     - 해당 기간 로그만 반환

  4. 복합 필터링
     - GET /api/admin/audit-logs?action=CMS_UPDATE&from=2025-01-01 → 200
     - 액션 + 기간 동시 필터

  5. 페이지네이션
     - GET /api/admin/audit-logs?page=1&limit=20 → 200
     - 총 항목 수 포함 { total, page, limit }

기대 결과: 액션·사용자·기간 필터링 정상, 페이지네이션 동작
```

---

### 3.8 실시간 동기화 테스트 (P0)

#### TC-B024: 콘텐츠 수정 → 키오스크 폴링 → UI 갱신 (30초 이내)

```
사전 조건: 관리자 대시보드 로그인, 키오스크 클라이언트 실행 중

단계:
  1. 키오스크에서 현재 콘텐츠 확인
     - GET /api/cms → welcomeMessage: "기존 메시지"
     - 키오스크 화면에 "기존 메시지" 표시

  2. 관리자가 콘텐츠 수정
     - PATCH /api/admin/cms/CONTENT_ID
     - body: { value: "실시간 테스트 메시지" }
     - HTTP 200

  3. 키오스크 폴링 주기 대기 (최대 30초)
     - GET /api/cms → welcomeMessage: "실시간 테스트 메시지"

  4. 키오스크 UI 갱신 확인
     - 화면에 "실시간 테스트 메시지" 표시
     - 페이지 새로고침 없이 자동 갱신

성공 기준: 수정 시점부터 30초 이내 키오스크 UI 갱신
```

#### TC-B025: 다중 수정 시 최종 상태 일관성

```
사전 조건: 관리자 대시보드 로그인, 키오스크 클라이언트 실행 중

단계:
  1. 연속 콘텐츠 수정 (3회)
     - PATCH /api/admin/cms/ID → value: "수정1" (t=0s)
     - PATCH /api/admin/cms/ID → value: "수정2" (t=5s)
     - PATCH /api/admin/cms/ID → value: "수정3" (t=10s)

  2. 최종 상태 확인
     - GET /api/cms → welcomeMessage: "수정3"
     - 최종 수정값만 유효 (중간값 미반영)

  3. 키오스크 UI 확인
     - 폴링 후 최종값 "수정3" 표시
     - 중간값("수정1", "수정2") 잠깐 표시 후 최종값 수렴 허용

  4. 버전 히스토리 확인
     - GET /api/admin/cms/ID/versions
     - 3개 버전 모두 보존

성공 기준: 최종 상태 일관성 보장, 버전 히스토리 전체 보존
```

---

## 4. Agent Browser E2E 검증 프로시저

### 4.1 필수 검증 체크리스트

```markdown
□ 서버 실행 확인 (curl /api)
□ 관리자 로그인 화면 렌더링 (공백/에러 없음)
□ 관리자 로그인 성공 → 대시보드 전환
□ 관리자 로그인 실패 → 오류 메시지 표시
□ 대시보드 통계 차트 렌더링
□ CMS 에디터 화면 로드
□ 콘텐츠 텍스트 수정 → 저장 성공
□ 콘텐츠 이미지 업로드 → 미리보기 표시
□ 도서 목록 조회 → 테이블 렌더링
□ 도서 생성 폼 → 제출 성공
□ 도서 삭제 → 확인 다이얼로그 → 삭제 성공
□ 이용자 관리 화면 로드
□ 감사 로그 화면 로드 → 필터링 동작
□ RBAC: operator → admin 전용 메뉴 숨김
□ 반응형: 1080×1920 키오스크 레이아웃
□ 반응형: 768×1024 태블릿 레이아웃
□ 반응형: 375×812 모바일 레이아웃
□ 세션 만료 → 로그인 화면 리다이렉트
□ 콘솔 오류 없음
□ 하이드레이션 미스매치 없음
```

### 4.2 dev.log 확인 항목

```
□ Fatal error 없음
□ Hydration mismatch 없음
□ API 500 오류 없음
□ Unhandled promise rejection 없음
□ 인증 관련 경고 없음 (ex: 세션 검증 실패 로그 과다)
□ 메모리 부족 경고 없음
□ DB 연결 오류 없음
```

### 4.3 단계별 검증 프로시저

```
Step 1: 서버 기동 확인
  □ curl http://localhost:3000/api → 200

Step 2: 관리자 로그인 화면
  □ /admin 접속 → 로그인 폼 표시
  □ 이메일/비밀번호 입력 필드 존재
  □ "로그인" 버튼 존재

Step 3: 로그인 성공
  □ 올바른 자격증명 입력 → "로그인" 클릭
  □ /admin/dashboard 로 전환
  □ 사용자 이름 표시
  □ 로그아웃 버튼 표시

Step 4: 대시보드 확인
  □ 통계 카드 4개 이상 표시
  □ 일별 대출 차트 렌더링
  □ 최근 활동 목록 표시

Step 5: CMS 화면
  □ /admin/cms 접속 → 콘텐츠 목록 표시
  □ 텍스트 콘텐츠 클릭 → 에디터 오픈
  □ 수정 → 저장 → 성공 토스트

Step 6: 도서 관리 화면
  □ /admin/books 접속 → 도서 테이블 표시
  □ "도서 추가" 버튼 클릭 → 생성 폼 오픈
  □ 필수값 입력 → 제출 → 성공

Step 7: 반응형 확인
  □ 뷰포트 1080×1920 → 레이아웃 정상
  □ 뷰포트 768×1024 → 레이아웃 정상
  □ 뷰포트 375×812 → 레이아웃 정상

Step 8: 세션 만료/로그아웃
  □ 로그아웃 클릭 → /admin 로그인 화면
  □ 세션 없이 /admin/dashboard 접근 → 로그인 화면 리다이렉트
```

---

## 5. 테스트 자동화 스크립트

### 5.1 관리자 인증 API 검증

```bash
#!/bin/bash
# tests/admin-auth.sh

BASE="http://localhost:3000/api/admin"

echo "=== Admin Auth Tests ==="

# 1. 로그인 성공
echo -n "TC-B001 Login success: "
LOGIN_RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -c /tmp/admin-cookies.txt \
  -d '{"email":"admin@library.kr","password":"admin1234!"}')
echo "$LOGIN_RESP" | jq -r '.success // "FAIL"'

# 2. 로그인 실패
echo -n "TC-B002 Login failure: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@library.kr","password":"wrong!"}')
echo "HTTP $HTTP_CODE (expect 401)"

# 3. 세션 검증 (보호된 엔드포인트)
echo -n "TC-B001 Session valid: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/stats" \
  -b /tmp/admin-cookies.txt)
echo "HTTP $HTTP_CODE (expect 200)"

# 4. 미인증 접근 차단
echo -n "TC-B002 Unauthenticated: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/stats")
echo "HTTP $HTTP_CODE (expect 401)"

# 5. RBAC: operator 로그인 후 admin 전용 접근
echo -n "TC-B004 RBAC block: "
curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -c /tmp/operator-cookies.txt \
  -d '{"email":"operator@library.kr","password":"operator1234!"}' > /dev/null
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/users" \
  -b /tmp/operator-cookies.txt)
echo "HTTP $HTTP_CODE (expect 403)"

echo "=== Done ==="
```

### 5.2 CMS 콘텐츠 API 검증

```bash
#!/bin/bash
# tests/admin-cms.sh

BASE="http://localhost:3000/api/admin"
COOKIES="-b /tmp/admin-cookies.txt"

echo "=== CMS Content Tests ==="

# 1. 콘텐츠 목록 조회
echo -n "TC-B005 CMS list: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/cms" $COOKIES)
echo "HTTP $HTTP_CODE (expect 200)"

# 2. 콘텐츠 수정
CMS_ID=$(curl -s "$BASE/cms" $COOKIES | jq -r '.[0].id // empty')
if [ -n "$CMS_ID" ]; then
  echo -n "TC-B005 CMS update: "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/cms/$CMS_ID" \
    $COOKIES \
    -H "Content-Type: application/json" \
    -d '{"value":"테스트 수정 값"}')
  echo "HTTP $HTTP_CODE (expect 200)"

  # 3. 버전 히스토리 조회
  echo -n "TC-B008 Version history: "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/cms/$CMS_ID/versions" $COOKIES)
  echo "HTTP $HTTP_CODE (expect 200)"

  # 4. 기본값 리셋
  echo -n "TC-B009 CMS reset: "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/cms/$CMS_ID/reset" $COOKIES)
  echo "HTTP $HTTP_CODE (expect 200)"
else
  echo "No CMS content found"
fi

# 5. 이미지 업로드 (크기 초과)
echo -n "TC-B006 Oversized upload: "
dd if=/dev/zero bs=1M count=3 2>/dev/null | \
  curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/cms/upload" \
    $COOKIES \
    -F "file=@-;filename=big.png;type=image/png"
echo " (expect 413)"

echo "=== Done ==="
```

### 5.3 도서 관리 API 검증

```bash
#!/bin/bash
# tests/admin-books.sh

BASE="http://localhost:3000/api/admin"
COOKIES="-b /tmp/admin-cookies.txt"

echo "=== Book Management Tests ==="

# 1. 도서 목록 조회
echo -n "TC-B010 Book list: "
BOOK_COUNT=$(curl -s "$BASE/books" $COOKIES | jq '.books | length')
echo "$BOOK_COUNT books"

# 2. 도서 생성
echo -n "TC-B010 Book create: "
CREATE_RESP=$(curl -s -X POST "$BASE/books" \
  $COOKIES \
  -H "Content-Type: application/json" \
  -d '{"title":"하네스 테스트 도서","author":"테스트","isbn":"9789999999999","categoryId":"cat-general","totalCopies":2}')
NEW_BOOK_ID=$(echo "$CREATE_RESP" | jq -r '.id // empty')
HTTP_CODE=$(echo "$CREATE_RESP" | jq -r 'if .id then "201" else "FAIL" end')
echo "HTTP $HTTP_CODE, ID=$NEW_BOOK_ID"

# 3. 도서 수정
if [ -n "$NEW_BOOK_ID" ]; then
  echo -n "TC-B011 Book update: "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/books/$NEW_BOOK_ID" \
    $COOKIES \
    -H "Content-Type: application/json" \
    -d '{"title":"수정된 하네스 테스트 도서"}')
  echo "HTTP $HTTP_CODE (expect 200)"

  # 4. 도서 삭제
  echo -n "TC-B012 Book delete: "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/books/$NEW_BOOK_ID" $COOKIES)
  echo "HTTP $HTTP_CODE (expect 200)"
fi

# 5. 중복 ISBN
echo -n "TC-B010 Duplicate ISBN: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/books" \
  $COOKIES \
  -H "Content-Type: application/json" \
  -d '{"title":"중복 ISBN 도서","author":"테스트","isbn":"9789999999999","categoryId":"cat-general","totalCopies":1}')
echo "HTTP $HTTP_CODE (expect 409)"

# 6. 대출 중 도서 삭제 시도
echo -n "TC-B012 Delete on-loan book: "
ON_LOAN_BOOK_ID=$(curl -s "$BASE/books" $COOKIES | jq -r '[.books[] | select(.availableCopies < .totalCopies)][0].id // empty')
if [ -n "$ON_LOAN_BOOK_ID" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/books/$ON_LOAN_BOOK_ID" $COOKIES)
  echo "HTTP $HTTP_CODE (expect 409)"
else
  echo "No on-loan book to test"
fi

echo "=== Done ==="
```

### 5.4 감사 로그 API 검증

```bash
#!/bin/bash
# tests/admin-audit.sh

BASE="http://localhost:3000/api/admin"
COOKIES="-b /tmp/admin-cookies.txt"

echo "=== Audit Log Tests ==="

# 1. 감사 로그 조회
echo -n "TC-B022 Audit list: "
AUDIT_COUNT=$(curl -s "$BASE/audit-logs?limit=50" $COOKIES | jq '.logs | length')
echo "$AUDIT_COUNT entries"

# 2. 액션 필터링
echo -n "TC-B023 Filter by action: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/audit-logs?action=BOOK_CREATE" $COOKIES)
echo "HTTP $HTTP_CODE (expect 200)"

# 3. 기간 필터링
echo -n "TC-B023 Filter by date: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/audit-logs?from=2025-01-01&to=2025-12-31" $COOKIES)
echo "HTTP $HTTP_CODE (expect 200)"

# 4. 페이지네이션
echo -n "TC-B023 Pagination: "
PAGE_RESP=$(curl -s "$BASE/audit-logs?page=1&limit=5" $COOKIES)
PAGE_COUNT=$(echo "$PAGE_RESP" | jq '.logs | length')
TOTAL=$(echo "$PAGE_RESP" | jq -r '.total // 0')
echo "page=$PAGE_COUNT, total=$TOTAL"

echo "=== Done ==="
```

### 5.5 통계 API 검증

```bash
#!/bin/bash
# tests/admin-stats.sh

BASE="http://localhost:3000/api/admin"
COOKIES="-b /tmp/admin-cookies.txt"

echo "=== Stats Dashboard Tests ==="

# 1. 종합 통계
echo -n "TC-B016 Overall stats: "
STATS=$(curl -s "$BASE/stats" $COOKIES)
echo "$STATS" | jq '{totalBooks, activeLoans, overdueLoans}'

# 2. 기간별 통계
echo -n "TC-B016 Period stats: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/stats?from=2025-01-01&to=2025-03-01" $COOKIES)
echo "HTTP $HTTP_CODE (expect 200)"

# 3. 미래 기간 (빈 데이터)
echo -n "TC-B016 Future period: "
FUTURE_STATS=$(curl -s "$BASE/stats?from=2099-01-01&to=2099-12-31" $COOKIES)
echo "$FUTURE_STATS" | jq '{todayLoans, todayReturns}'

echo "=== Done ==="
```

---

## 6. 릴리즈 검증 기준

| 항목 | 기준 | 방법 |
|---|---|---|
| 빌드 | `bun run lint` 0 오류 | 린트 |
| 서버 | 포트 3000 정상 응답 | curl |
| 관리자 로그인 | TC-B001 통과 | API + Agent Browser |
| 로그인 실패 | TC-B002 통과 (401) | API |
| 세션 만료 | TC-B003 통과 | API |
| RBAC | TC-B004 통과 (operator → 403) | API |
| CMS 수정 | TC-B005 통과 | API + Agent Browser |
| 이미지 업로드 | TC-B006 통과 (크기/형식 제한) | API |
| 실시간 동기화 | TC-B007 통과 (30초 이내) | API + 키오스크 클라이언트 |
| 버전 히스토리 | TC-B008 통과 | API |
| 기본값 리셋 | TC-B009 통과 | API |
| 도서 CRUD | TC-B010~B012 통과 | API |
| CSV 일괄 등록 | TC-B013 통과 | API |
| 대출 중 삭제 방지 | TC-B012 409 반환 | API |
| 관리자 CRUD | TC-B014 통과 | API |
| 통계 데이터 | TC-B016 통과 | API |
| 차트 렌더링 | TC-B017 통과 | Agent Browser |
| 반응형 21인치 | TC-B018 통과 | Agent Browser |
| 반응형 태블릿 | TC-B020 통과 | Agent Browser |
| 반응형 모바일 | TC-B021 통과 | Agent Browser |
| 감사 로그 | TC-B022~B023 통과 | API |
| 실시간 동기화 | TC-B024 통과 (30초 이내) | API + 키오스크 |
| 다중 수정 일관성 | TC-B025 통과 | API |
| 콘솔 오류 | 0건 | dev.log |
| 하이드레이션 미스매치 | 0건 | dev.log |
