# CloudPanel 배포 + MySQL/PostgreSQL 전환 검토서

> 대상: 현재 CloudPanel에서 동작 중인本项目을 동일 패널에 적용 + 향후 MySQL/PostgreSQL 전환

---

## 1. CloudPanel 배포 절차 (Node.js 앱)

| 항목 | 설정 |
|---|---|
| Node 버전 | 20+ (Dockerfile은 node:24, `bun` 필요 → 패널에 Bun 설치 또는 `npm` 사용) |
| 앱 포트 | 패널 할당 포트 (예: 3000대, `PORT` env로 전달) |
| 시작 명령 | `bun install && bunx prisma generate && bunx prisma db push && bun start` (초회) / 이후 `bun start` |
| 리버스 프록시 | 패널 nginx → 앱 포트, HTTPS는 패널에서 종료 |

### 필수 환경변수 (패널 Environment Variables에 등록, `.env` 커밋 금지)

| 변수 | 값 | 비고 |
|---|---|---|
| `DATABASE_URL` | `file:./prisma/db/prod.db` (SQLite 유지 시) | MySQL 전환 시 `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | 32자 이상 난수 | 기본값 사용 시 세션 위조 가능 — **필수 변경** |
| `ADMIN_SEED_PASSWORD` | 초기 관리자 비밀번호 | 최초 시드에만 사용, 이후 불필요 |
| `TRUST_PROXY` | `true` | 패널 nginx 뒤이므로 **필수**. false면 전 사용자 IP가 127.0.0.1로 보여 rate-limit이 공유되고 감사 로그 IP가 깨짐 |
| `NODE_ENV` | `production` | HSTS·Secure 쿠키 활성화 조건 |

### 최초 배포 시드

1. 배포 후 `POST /api/admin/auth/... ` 로그인 불가 상태 → `POST /api/seed` body `{"confirm":true}` 1회 호출 (관리자 0명일 때만 인증 없이 동작 — 부트스트랩)
2. 이후 시드는 super_admin 로그인 + `confirm:true` 필요. 운영 중 실수 초기화 방지됨
3. Docker 사용 시 `docker-entrypoint.sh`가 이를 자동 처리 (신규 DB→시드, 기존 DB→스킵)

### 업로드 파일 영속화

- `public/uploads/` 에 저장. 패널 Node 앱은 디렉터리 유지되나 **git 재배포 시 삭제될 수 있음** → 배포 전 백업 또는 패널의 영속 볼륨/외부 스토리지 권장. Docker Compose는 `kiosk-uploads` 볼륨으로 이미 대응됨

---

## 2. 현재 상태 점검 (배포 준비도)

| 항목 | 상태 |
|---|---|
| 보안 헤더 (next.config + middleware) | ✅ 적용 중 (3200 실측 확인) |
| Rate-limit IP 신뢰 (`TRUST_PROXY`) | ✅ 구현됨. compose 기본값 `true`로 수정, 패널에서도 `true` 설정 필요 |
| 시드 API 인증 게이트 | ✅ 최초 1회만 개방, entrypoint 대응 수정됨 |
| `.env` dev 비밀값 커밋됨 | ⚠️ `JWT_SECRET=dev-only...` 등이 저장소에 있음. 운영값은 패널에만 입력하고 `.env`는 `.gitignore` 권장 |
| `next.config.ts` HSTS 상시 발송 | ⚠️ HTTP 직결 개발환경에서만 이슈, 패널 HTTPS 뒤에서는 정상 |
| `typescript.ignoreBuildErrors` | ⚠️ 운영 빌드 전 `tsc` 정리 권장 (admin 계열 기존 오류 존재) |

---

## 3. MySQL / PostgreSQL 전환 시 필요 변경

### 3.1 스키마 (`prisma/schema.prisma`)

```prisma
datasource db {
  provider = "mysql"        // 또는 "postgresql"
  url      = env("DATABASE_URL")
}
```

- `cuid()` 기본값: 3개 DB 모두 지원 → 변경 불필요
- `Boolean / Int / Float / DateTime`: 그대로 사용 가능
- `@unique` nullable(`pin`, `cardNumber`): 3개 DB 모두 다중 NULL 허용 → 정상

### 3.2 TEXT 매핑 필수 (MySQL 한정)

Prisma MySQL에서 `String`은 기본 `VARCHAR(191)` → 2000자 콘텐츠가 잘리거나 오류. 아래는 `@db.Text` 지정 필요:

| 모델 | 필드 |
|---|---|
| `ContentItem` | `value` |
| `ContentVersion` | `oldValue`, `newValue` |
| `AuditLog` | `details` |
| `Scenario` | `stepsJson`, `description` |
| `KioskConfig` | `value` |
| `SimUser` / `LibraryCard` | `address` |
| `Notification` | `message` |

> PostgreSQL은 `String`→`TEXT` 자동 매핑이라 불필요. SQLite는 `@db.Text`를 인식하지 못하므로, **전환 시점에 스키마를 분기** (동일 파일에 주석 전환 또는 `schema.mysql.prisma` 분리 권장)

### 3.3 검색 대소문자 (코드 변경 없음, DB 설정으로 해결)

- `contains` 검색 사용 중 (`/api/books`, `/api/admin/books`)
- MySQL: DB·테이블 콜레이션을 **`utf8mb4_unicode_ci`** 로 생성 (기본 `utf8mb4_0900_ai_ci`도 무관, `*_bin`은 금물)
- PostgreSQL: `LIKE`가 대소문자 구분 → 한글 검색은 영향 적으나 영문 검색 시 `mode: 'insensitive'` 추가 필요 (현재 미사용 — 전환 시 2개 파일에 추가)

### 3.4 마이그레이션 절차

```bash
# 1. provider 변경 + (MySQL이면 @db.Text 추가)
# 2. 기준 마이그레이션 생성
bunx prisma migrate dev --name init
# 3. CloudPanel MySQL에 DATABASE_URL 지정 후
bunx prisma migrate deploy
# 4. 시드 1회 (부트스트랩) → 관리자 로그인 확인
```

- 현재 `prisma/migrations/` 없음 (`db push` 운용) → 전환 시점이 마이그레이션 도입 적기
- `db push --accept-data-loss`는 **운영에서 사용 금지** (entrypoint는 SQLite 전용 흐름 — MySQL 전환 시 entrypoint의 push 부분을 `migrate deploy`로 교체 필요)

### 3.5 기존 SQLite 데이터 이전

`scripts/` 없음 — 이전 시점에 스크립트 작성 필요 (개요):
1. SQLite에서 테이블별 `findMany` → JSON 덤프
2. MySQL에 `migrate deploy` 후 `createMany` (순서: Book/Scenario/SimUser → SimLoan/LearningProgress → Admin/Content/Config → 버전/감사/미디어/카드)
3. `id` (cuid 문자열) 그대로 유지 → FK 무결성 유지, 시퀀스 없음이라 충돌 없음

### 3.6 코드 수정 불필요 확인

- `$transaction` / `updateMany(조건부)` / `increment/decrement` / `skip-take` 페이징: 3개 DB 동일 동작
- `validateCuid` 정규식: cuid 문자열 형식 공통
- `String` 날짜 비교 (`dueDate < 'YYYY-MM-DD'`): ISO 문자열 사전식 비교로 3개 DB 동일 (DATETIME 컬럼이 아닌 String 컬럼이므로)

---

## 4. 전환 전 체크리스트

```markdown
□ CloudPanel env 5종 등록 (DATABASE_URL/JWT_SECRET/ADMIN_SEED_PASSWORD/TRUST_PROXY=true/NODE_ENV)
□ `.env` 운영값 제거 + `.gitignore` 등록
□ provider 전환 + (MySQL) @db.Text + 콜레이션 utf8mb4_unicode_ci
□ `prisma migrate dev` → `migrate deploy` 로 entrypoint 교체 (MySQL 전환 시)
□ 시드 1회 + 관리자 로그인 + `/api/content` 108키 확인
□ 업로드 디렉터리 백업 계획 (public/uploads)
□ tsc 정리 + `ignoreBuildErrors` 해제 검토
```
