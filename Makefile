# ============================================================================
# 무인 도서 대출 반납기 키오스크 시뮬레이터 - Makefile
# ============================================================================
# 사용법:
#   make build     - Docker 이미지 빌드
#   make up        - 컨테이너 시작 (백그라운드)
#   make down      - 컨테이너 종료
#   make logs      - 로그 확인
#   make restart   - 재시작
#   make reset     - 데이터 초기화 (볼륨 삭제)
#   make shell     - 컨테이너 쉘 접속
#   make seed      - 시드 데이터 재삽입
#   make status    - 상태 확인
# ============================================================================

.PHONY: build up down logs restart reset shell seed status dev

# 기본 변수
COMPOSE = docker compose
PORT ?= 3000

# ── 개발 (Docker 없이) ────────────────────────────────────────────────────
dev:
	bun run dev

# ── Docker Compose 명령 ───────────────────────────────────────────────────
build:
	$(COMPOSE) build

up: build
	$(COMPOSE) up -d
	@echo ""
	@echo "✅ 키오스크 시뮬레이터가 시작되었습니다!"
	@echo "   접속: http://localhost:$(PORT)"
	@echo "   로그: make logs"
	@echo ""

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f kiosk

restart:
	$(COMPOSE) restart kiosk

# ── 데이터 초기화 ─────────────────────────────────────────────────────────
reset:
	$(COMPOSE) down -v
	@echo "✅ 모든 데이터가 초기화되었습니다. make up 으로 다시 시작하세요."

# ── 컨테이너 접속 ────────────────────────────────────────────────────────
shell:
	$(COMPOSE) exec kiosk /bin/bash

# ── 시드 데이터 재삽입 ───────────────────────────────────────────────────
seed:
	@echo "🌱 시드 데이터 재삽입 중..."
	$(COMPOSE) exec kiosk sh -c "rm -f /app/db/.seeded"
	$(COMPOSE) restart kiosk
	@echo "✅ 컨테이너 재시작 후 자동으로 시드가 실행됩니다."

# ── 상태 확인 ─────────────────────────────────────────────────────────────
status:
	@echo "📊 컨테이너 상태:"
	@$(COMPOSE) ps
	@echo ""
	@echo "🏥 헬스 체크:"
	@curl -sf http://localhost:$(PORT)/api > /dev/null 2>&1 && echo "   ✅ 서버 정상 작동" || echo "   ❌ 서버 응답 없음"
