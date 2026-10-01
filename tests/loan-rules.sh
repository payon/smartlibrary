#!/bin/bash
# 대출 규칙 검증 (doc/harness.md 5.2) — 수동 단계 안내
# 실제 대출에는 유효한 userId/bookIds/pin이 필요하므로 여기서는 규칙 매트릭스만 확인
set -u
BASE="${BASE_URL:-http://localhost:3000}"

echo "=== Loan rules matrix ==="
echo "1. PIN 없이 대출 시도 -> 400 PIN_REQUIRED 예상"
curl -s -X POST "$BASE/api/loans" -H "Content-Type: application/json" \
  -d '{"userId":"invalid","bookIds":["invalid"],"method":"kiosk"}' | head -c 300; echo
echo
echo "2. 연장 시도 -> 400 EXTEND_NOT_ALLOWED 예상 (loanId 필요)"
echo "   curl -X POST $BASE/api/loans/<LOAN_ID>/extend"
echo
echo "3. 3권 초과 선택은 UI(store MAX_LOAN_COUNT=2) + 서버 400으로 차단"
