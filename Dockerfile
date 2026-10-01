# ============================================================================
# 무인 도서 대출 반납기 키오스크 시뮬레이터 - Docker 이미지
# ============================================================================
# Multi-stage build for Next.js 16 standalone + Prisma SQLite
#
# 빌드:    docker build -t library-kiosk .
# 실행:    docker run -p 3000:3000 -v kiosk-db:/app/db library-kiosk
# Compose: docker compose up --build
# ============================================================================

# ── Stage 1: Dependencies 설치 ─────────────────────────────────────────────
FROM node:24-slim AS deps

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bun 설치
RUN npm install -g bun@1.3.14

# 패키지 매니페스트 복사
COPY package.json bun.lock ./

# 의존성 설치 (Bun 사용)
RUN bun install --frozen-lockfile

# ── Stage 2: 빌드 ──────────────────────────────────────────────────────────
FROM node:24-slim AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bun 설치
RUN npm install -g bun@1.3.14

# 의존성 복사
COPY --from=deps /app/node_modules ./node_modules

# 소스 코드 복사
COPY . .

# Prisma 클라이언트 생성 (PostgreSQL용 스키마)
# 런타임 DATABASE_URL의 프로토콜과 일치해야 함
ARG PRISMA_SCHEMA=prisma/schema.postgres.prisma
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate --schema=${PRISMA_SCHEMA}

# Next.js standalone 빌드
# 빌드 스크립트가 자동으로 .next/static과 public을 .next/standalone/에 복사함
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ── Stage 3: 프로덕션 실행 ───────────────────────────────────────────────
FROM node:24-slim AS runner

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 보안: non-root 사용자 생성
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home appuser

# 환경 변수 기본값 (실제 값은 compose/env_file에서 주입)
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://library:library@db:5432/smartlib"
ENV PRISMA_SCHEMA="prisma/schema.postgres.prisma"
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# ── Standalone 빌드 결과물 복사 ──────────────────────────────────────────
# build 스크립트가 이미 .next/static, public을 standalone 안에 복사했음
COPY --from=builder --chown=appuser:nodejs /app/.next/standalone ./

# ── Prisma 런타임 파일 복사 ──────────────────────────────────────────────
# prisma generate 결과물과 CLI (db push에 필요)
COPY --from=builder --chown=appuser:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=appuser:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=appuser:nodejs /app/prisma ./prisma

# prisma CLI 바이너리 복사 (entrypoint에서 db push 실행에 필요)
COPY --from=builder --chown=appuser:nodejs /app/node_modules/prisma ./node_modules/prisma

# ── 데이터베이스 디렉토리 생성 (SQLite 호환 유지) ─────────────────────────
RUN mkdir -p /app/db && chown appuser:nodejs /app/db

# ── Entrypoint 스크립트 ───────────────────────────────────────────────────
COPY --chown=appuser:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# non-root 사용자로 전환
USER appuser

# 포트 노출
EXPOSE 3000

# 헬스 체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api || exit 1

# Entrypoint
ENTRYPOINT ["./docker-entrypoint.sh"]

# Next.js standalone 서버 실행
CMD ["node", "server.js"]
