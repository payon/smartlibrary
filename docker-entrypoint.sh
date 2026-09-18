#!/bin/bash
# ============================================================================
# Docker Entrypoint Script
# ============================================================================
# 무인 도서 대출 반납기 키오스크 시뮬레이터 - 컨테이너 시작 스크립트
#
# 역할:
#   1. SQLite 데이터베이스 디렉토리 생성
#   2. Prisma 스키마 적용 (db push)
#   3. 초기 시드 데이터 삽입 (최초 실행 시에만)
#   4. Next.js standalone 서버 실행
# ============================================================================

set -e

echo "============================================================"
echo "  🏛️  무인 도서 대출 반납기 키오스크 시뮬레이터"
echo "  Docker Container Starting..."
echo "============================================================"

# ── 환경 변수 기본값 설정 ────────────────────────────────────────────────
: "${DATABASE_URL:=file:/app/db/custom.db}"
: "${PORT:=3000}"
: "${HOSTNAME:=0.0.0.0}"

DB_DIR="/app/db"
DB_FILE="${DB_DIR}/custom.db"
SEED_MARKER="${DB_DIR}/.seeded"

# ── 1. 데이터베이스 디렉토리 생성 ────────────────────────────────────────
echo ""
echo "📁 [1/3] 데이터베이스 디렉토리 확인..."
mkdir -p "${DB_DIR}"

if [ -f "${DB_FILE}" ]; then
    FILESIZE=$(stat -f%z "${DB_FILE}" 2>/dev/null || stat -c%s "${DB_FILE}" 2>/dev/null || echo "0")
    echo "   ✅ 기존 DB 발견: ${DB_FILE} (${FILESIZE} bytes)"
else
    echo "   ℹ️  새 DB 생성 예정: ${DB_FILE}"
fi

# ── 2. Prisma 스키마 적용 ────────────────────────────────────────────────
echo ""
echo "📊 [2/3] Prisma 스키마 적용 중 (db push)..."

RETRY_COUNT=0
MAX_RETRIES=3

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if npx prisma db push --accept-data-loss 2>&1; then
        echo "   ✅ Prisma 스키마 적용 완료"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "   ⚠️  Prisma db push 실패 (시도 ${RETRY_COUNT}/${MAX_RETRIES}), 재시도 중..."
            sleep 2
        else
            echo "   ❌ Prisma db push 최종 실패 (시도 ${MAX_RETRIES}/${MAX_RETRIES})"
            echo "   ℹ️  서버를 시작합니다. 수동으로 prisma db push를 실행하세요."
        fi
    fi
done

# ── 3. 시드 데이터 삽입 (최초 실행 시에만) ─────────────────────────────
echo ""
echo "🌱 [3/3] 시드 데이터 확인..."

if [ -f "${SEED_MARKER}" ]; then
    SEED_TIME=$(cat "${SEED_MARKER}")
    echo "   ✅ 시드 데이터 이미 존재 (${SEED_TIME})"
else
    echo "   ⏳ 초기 시드 데이터 삽입 중..."

    # 임시 서버 시작 (시드 API 호출을 위해)
    echo "   ⏳ 임시 서버 시작 중..."
    NODE_ENV=production node server.js &
    SERVER_PID=$!

    # 서버 준비 대기
    MAX_WAIT=60
    WAITED=0
    echo "   ⏳ 서버 준비 대기 중 (최대 ${MAX_WAIT}초)..."
    until curl -sf http://localhost:3000/api > /dev/null 2>&1; do
        sleep 1
        WAITED=$((WAITED + 1))
        if [ $WAITED -ge $MAX_WAIT ]; then
            echo "   ⚠️  서버 시작 대기 시간 초과, 시드를 건너뜁니다"
            kill $SERVER_PID 2>/dev/null || true
            wait $SERVER_PID 2>/dev/null || true
            break
        fi
    done

    if [ $WAITED -lt $MAX_WAIT ]; then
        echo "   ✅ 서버 준비 완료 (${WAITED}초 대기)"

        # 시드 API 호출 (최대 3회 재시도)
        SEED_SUCCESS=false
        for ATTEMPT in 1 2 3; do
            SEED_RESPONSE=$(curl -sf -X POST http://localhost:3000/api/seed 2>&1) && {
                if echo "${SEED_RESPONSE}" | grep -q '"success"'; then
                    echo "   ✅ 시드 데이터 삽입 완료!"
                    SEED_SUCCESS=true
                    # 시드 완료 마커 생성
                    date -Iseconds > "${SEED_MARKER}" 2>/dev/null || echo "seeded" > "${SEED_MARKER}"
                    break
                else
                    echo "   ⚠️  시드 응답 확인 중... (시도 ${ATTEMPT}/3)"
                fi
            } || {
                echo "   ⚠️  시드 API 호출 실패 (시도 ${ATTEMPT}/3): ${SEED_RESPONSE}"
            }
            sleep 2
        done

        if [ "${SEED_SUCCESS}" = "false" ]; then
            echo "   ℹ️  자동 시드 실패. 서버 시작 후 수동으로 호출하세요:"
            echo "      curl -X POST http://localhost:3000/api/seed"
        fi
    fi

    # 임시 서버 종료
    echo "   🛑 임시 서버 종료 중..."
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
    sleep 2
fi

# ── 4. Next.js 서버 실행 ──────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  🚀 Next.js 서버 시작"
echo "  포트: ${PORT}"
echo "  데이터베이스: ${DATABASE_URL}"
echo "============================================================"
echo ""

# CMD로 전달된 명령어 실행
exec "$@"
