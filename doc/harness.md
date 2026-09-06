# Test Harness Document

## 스마트 도서관 무인 키오스크 시뮬레이터 — 테스트 하네스

---

## 1. 테스트 전략

### 1.1 테스트 피라미드

```
           ┌──────────┐
           │  E2E     │  ← Agent Browser 자동 검증
           │  (적음)  │
          ┌┴──────────┴┐
          │ Integration │  ← API Route 수동 검증
          │  (중간)     │
         ┌┴────────────┴┐
         │   Unit        │  ← 컴포넌트/로직 단위 검증
         │   (많음)      │
         └───────────────┘
```

### 1.2 테스트 원칙

| 원칙 | 설명 |
|---|---|
| **브라우저 검증 필수** | 빌드 성공 ≠ 동작 성공. Agent Browser로 E2E 검증 |
| **코어 플로우 우선** | 대출/반납 전체 플로우를 최우선 검증 |
| **시각적 검증** | 화면 렌더링, 애니메이션, 레이아웃 확인 |
| **인터랙션 검증** | 버튼 클릭, PIN 입력, 화면 전환 동작 확인 |
| **데이터 검증** | API 응답, DB 상태 변화 확인 |

---

## 2. 테스트 환경

### 2.1 개발 서버

```bash
# 서버 시작
bun run dev    # Next.js on port 3000

# 서버 상태 확인
curl http://localhost:3000/api

# 린트 검사
bun run lint
```

### 2.2 브라우저 검증 도구

| 도구 | 용도 | 실행 방법 |
|---|---|---|
| Agent Browser | E2E 자동 검증 | Skill: `agent-browser` |
| Dev Log | 런타임 오류 확인 | `Read /home/z/my-project/dev.log` |
| Preview Panel | 시각적 확인 | 우측 패널 |

### 2.3 API 수동 검증

```bash
# 시드 초기화
curl -X POST http://localhost:3000/api/seed

# 도서 목록
curl http://localhost:3000/api/books

# 사용자 PIN 조회
curl "http://localhost:3000/api/users?pin=1234"

# 대출 생성
curl -X POST http://localhost:3000/api/loans \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","bookIds":["BOOK_ID1","BOOK_ID2"],"pin":"1234"}'

# 반납
curl -X POST http://localhost:3000/api/loans/LOAN_ID/return
```

---

## 3. 테스트 케이스

### 3.1 코어 플로우 테스트 (P0)

#### TC-001: 대출 전체 플로우

```
사전 조건: 서버 실행, DB 시드 완료

단계:
  1. 대기 화면 표시 확인
     - "SMART LIBRARY" 텍스트 표시
     - "화면을 터치하여 시작하세요" 펄스 표시

  2. 대기 화면 터치 → 메인 메뉴
     - "도서 대출" 버튼 표시 (초록)
     - "도서 반납" 버튼 표시 (주황)

  3. "도서 대출" 클릭 → RFID 인증
     - RFID 스캔 애니메이션 표시
     - "회원증 없이 이용하기" 버튼 표시

  4. "회원증 없이 이용하기" 클릭 → 도서 선택
     - 도서 목록 그리드 표시 (2열)
     - 검색 바 표시
     - 카테고리 탭 표시

  5. 도서 1권 선택
     - 선택 카운트 "1/2권" 표시
     - "대출하기" 버튼 활성화

  6. 도서 2권 선택
     - 선택 카운트 "2/2권" 표시

  7. 도서 3권 선택 시도
     - 토스트: "최대 2권까지 대출할 수 있습니다"
     - 선택 차단

  8. "대출하기" 클릭 → 대출 확인
     - 대출자 정보 표시
     - 선택 도서 2권 표시
     - 반납예정일 표시 (오늘+15일)

  9. "대출하기" 클릭 → 대출 완료
     - 성공 체크마크 애니메이션
     - 통계 대시보드 표시
     - 활성 대출 목록 표시

 10. "처음으로 돌아가기" 클릭 → 대기 화면
```

#### TC-002: 반납 전체 플로우

```
사전 조건: TC-001 완료 후 (2권 대출 상태)

단계:
  1. 대기 화면 → 메인 메뉴 → "도서 반납" 클릭

  2. RFID 인증 → PIN 입력
     - PIN 1234 입력 → 사용자 인증

  3. 도서 투입 화면
     - 반납구 슬롯 표시
     - 2초 후 첫 도서 자동 감지

  4. 반납 스캔 화면
     - 감지된 도서 표시
     - "더 넣기" 버튼 표시
     - "반납하기" 버튼 표시

  5. "더 넣기" → 도서 투입 → 2번째 도서 감지

  6. "반납하기" → 반납 확인
     - 반납 도서 2권 목록 표시

  7. "반납 확인" → 반납 완료
     - 성공 체크마크
     - 반납 도서 요약

  8. "처음으로 돌아가기" → 대기 화면
```

#### TC-003: PIN 인증 플로우

```
단계:
  1. 메인 메뉴 → "도서 대출" → RFID 인증
  2. 2초 대기 → "회원증이 인식되었습니다" 토스트
  3. 3.5초 대기 → PIN 입력 화면 전환
  4. PIN "1234" 입력 (4자리 완성 시 자동 제출)
  5. 정상 인증 → 도서 선택 화면

오류 케이스:
  1. PIN "0000" 입력 → "PIN 번호가 올바르지 않습니다" 토스트
  2. 도트 빨강 → 1초 후 초기화
```

---

### 3.2 대출 규칙 테스트 (P0)

#### TC-004: 최대 2권 제한

```
단계:
  1. 도서 선택 화면에서 3권 이상 선택 시도
  2. 3권째 클릭 → 토스트 경고 + 선택 차단
  3. API: bookIds.length > 2 → 400 오류
```

#### TC-005: 연체 차단

```
사전 조건: 연체 중인 대출 존재

단계:
  1. 대출 시도 → 403 오류
  2. "연체 중인 도서가 있어 대출할 수 없습니다" 메시지
```

#### TC-006: 연장 불가

```
단계:
  1. POST /api/loans/[id]/extend → 항상 400
  2. "대출 연장은 지원하지 않습니다" 메시지
```

#### TC-007: 재고 확인

```
단계:
  1. availableCopies === 0인 도서 선택
  2. 대출 시도 → "해당 도서는 현재 대출할 수 없습니다"
```

---

### 3.3 UI/UX 테스트 (P1)

#### TC-008: 반응형 레이아웃

```
단계:
  1. 모바일 폭 (375px)에서 화면 확인
  2. 태블릿 폭 (768px)에서 화면 확인
  3. 키오스크 폭 (480px)에서 화면 확인
  4. 모든 폭에서 버튼 터치 가능 (최소 44px)
```

#### TC-009: 스티키 푸터

```
단계:
  1. 내용이 짧은 화면 → 푸터 하단 고정
  2. 내용이 긴 화면 → 푸터 자연스럽게 밀림
  3. 푸터와 본문 겹침 없음
```

#### TC-010: 화면 전환 애니메이션

```
단계:
  1. 각 화면 전환 시 페이드 인/아웃 확인
  2. 전환 지속 시간 300ms ± 100ms
  3. 전환 중 빈 화면 없음 (AnimatePresence)
```

#### TC-011: 시니어 가독성

```
단계:
  1. 최소 폰트 18px 확인
  2. 버튼 최소 높이 56px 확인
  3. 색상 대비비 4.5:1 이상 확인
  4. 터치 타겟 최소 44×44px 확인
```

---

### 3.4 보안 테스트 (P1)

#### TC-012: Rate Limiting

```
단계:
  1. 1분 내 101회 API 요청 → 429 오류
  2. PIN 5회 오류 시도 → 5분 잠금
```

#### TC-013: XSS 방지

```
단계:
  1. 검색어에 <script> 태그 입력 → 새니타이즈 처리
  2. 응답에 스크립트 포함 안 됨
```

#### TC-014: 입력 검증

```
단계:
  1. 유효하지 않은 CUID → 400
  2. 유효하지 않은 ISBN → 400
  3. PIN 5자리 입력 → 차단
  4. PIN 문자 입력 → 차단
```

---

### 3.5 오류 처리 테스트 (P1)

#### TC-015: 네트워크 오류

```
단계:
  1. 서버 다운 상태에서 API 호출
  2. "네트워크 오류가 발생했습니다" 토스트
  3. 재시도 버튼 표시
```

#### TC-016: 빈 상태

```
단계:
  1. 대출 중인 도서 없는 사용자로 반납 시도
  2. "대출 중인 도서가 없습니다" 메시지
  3. "처음으로" 버튼 표시
```

---

## 4. Agent Browser E2E 검증 프로시저

### 4.1 필수 검증 체크리스트

```markdown
□ 서버 실행 확인 (curl /api)
□ 대기 화면 렌더링 (공백/에러 없음)
□ 메인 메뉴 버튼 클릭 동작
□ RFID 인증 → PIN 전환
□ PIN 입력 → 도서 선택 전환
□ 도서 선택 (최대 2권 제한 동작)
□ 대출 확인 → 완료 플로우
□ 반납 전체 플로우
□ 뒤로 가기 동작
□ 반응형 레이아웃 (모바일/태블릿)
□ 스티키 푸터
□ 콘솔 오류 없음
□ 하이드레이션 미스매치 없음
```

### 4.2 dev.log 확인 항목

```
□ Fatal error 없음
□ Hydration mismatch 없음
□ API 500 오류 없음
□ Unhandled promise rejection 없음
□ 메모리 부족 경고 없음
```

---

## 5. 테스트 자동화 스크립트

### 5.1 API 건전성 검사

```bash
#!/bin/bash
# tests/api-health.sh

echo "=== API Health Check ==="

# 1. 서버 상태
echo -n "Server: "
curl -s http://localhost:3000/api | jq -r '.status'

# 2. 시드 초기화
echo -n "Seed: "
curl -s -X POST http://localhost:3000/api/seed | jq -r '.message'

# 3. 도서 목록
echo -n "Books: "
curl -s http://localhost:3000/api/books | jq '.books | length'

# 4. PIN 조회
echo -n "User by PIN: "
curl -s "http://localhost:3000/api/users?pin=1234" | jq -r '.user.name'

# 5. 대출 목록
USER_ID=$(curl -s "http://localhost:3000/api/users?pin=1234" | jq -r '.user.id')
echo -n "Loans: "
curl -s "http://localhost:3000/api/loans?userId=$USER_ID" | jq '.loans | length'

echo "=== Done ==="
```

### 5.2 대출 규칙 검증

```bash
#!/bin/bash
# tests/loan-rules.sh

USER_ID=$(curl -s "http://localhost:3000/api/users?pin=1234" | jq -r '.user.id')
BOOK_IDS=$(curl -s http://localhost:3000/api/books | jq -r '.books[:3] | .[].id' | tr '\n' ' ')

# 3권 대출 시도 → 400 예상
echo -n "3-book loan attempt: "
THREE_IDS=$(echo $BOOK_IDS | awk '{print "["$1","$2","$3"]"}')
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  http://localhost:3000/api/loans \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"bookIds\":$THREE_IDS,\"pin\":\"1234\"}")
echo "HTTP $HTTP_CODE (expect 400)"

# 연장 시도 → 400 예상
echo -n "Extend attempt: "
LOAN_ID=$(curl -s "http://localhost:3000/api/loans?userId=$USER_ID" | jq -r '.loans[0].id')
if [ -n "$LOAN_ID" ] && [ "$LOAN_ID" != "null" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "http://localhost:3000/api/loans/$LOAN_ID/extend")
  echo "HTTP $HTTP_CODE (expect 400)"
else
  echo "No active loan to test"
fi
```

---

## 6. 릴리즈 검증 기준

| 항목 | 기준 | 방법 |
|---|---|---|
| 빌드 | `bun run lint` 0 오류 | 린트 |
| 서버 | 포트 3000 정상 응답 | curl |
| 대기 화면 | 렌더링 정상 | Agent Browser |
| 대출 플로우 | TC-001 전체 통과 | Agent Browser |
| 반납 플로우 | TC-002 전체 통과 | Agent Browser |
| 2권 제한 | TC-004 통과 | API + UI |
| 콘솔 오류 | 0건 | dev.log |
| 반응형 | 모바일/태블릿 정상 | Agent Browser |
