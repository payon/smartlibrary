# 백엔드 프로그램 로직 문서

> **버전**: v1.0.0  
> **작성일**: 2026-03-05  
> **상태**: Production-ready  
> **담당**: Dashboard Backend Team  
> **참조**: [대시보드 프로그램 로직](../dashboard/program.md) · [API 명세](../dashboard/api.md) · [DB 설계](../dashboard/database.md) · [키오스크 프로그램 로직](../program.md)

---

## 목차

1. [프로그램 흐름 개요](#1-프로그램-흐름-개요)
2. [화면별 프로그램 로직](#2-화면별-프로그램-로직)
3. [비즈니스 로직](#3-비즈니스-로직)
4. [실시간 동기화 로직](#4-실시간-동기화-로직)
5. [초기화 로직](#5-초기화-로직)
6. [오류 처리 로직](#6-오류-처리-로직)

---

## 1. 프로그램 흐름 개요

### 1.1 전체 백엔드 플로우 다이어그램

```
┌──────────┐
│  START   │  (Next.js 서버 기동)
└────┬─────┘
     │
     ▼
┌──────────────────────┐
│ prisma db push       │
│ (스키마 → SQLite 동기화)│
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│ seed() 실행           │
│ (기본 관리자·CMS·설정) │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Next.js API Route Layer                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      공통 요청 처리 파이프라인                          │  │
│  │                                                                        │  │
│  │  Client Request                                                        │  │
│  │       │                                                                │  │
│  │       ▼                                                                │  │
│  │  ┌─────────────┐    무효     ┌──────────────┐                         │  │
│  │  │ 1. JWT Verify│───────────▶│ 401 Unauthorized│                       │  │
│  │  └────┬────────┘            └──────────────┘                         │  │
│  │       │ 유효                                                          │  │
│  │       ▼                                                              │  │
│  │  ┌─────────────┐    거부     ┌──────────────┐                        │  │
│  │  │ 2. RBAC Check│───────────▶│ 403 Forbidden  │                       │  │
│  │  └────┬────────┘            └──────────────┘                         │  │
│  │       │ 허용                                                          │  │
│  │       ▼                                                              │  │
│  │  ┌─────────────┐    실패     ┌──────────────┐                        │  │
│  │  │ 3. Zod Validate│─────────▶│ 400 Bad Request│                      │  │
│  │  └────┬────────┘            └──────────────┘                         │  │
│  │       │ 통과                                                          │  │
│  │       ▼                                                              │  │
│  │  ┌─────────────┐                                                     │  │
│  │  │ 4. Business │                                                     │  │
│  │  │    Logic    │                                                     │  │
│  │  └────┬────────┘                                                     │  │
│  │       │                                                              │  │
│  │       ▼                                                              │  │
│  │  ┌─────────────┐  (쓰기 작업만)                                      │  │
│  │  │ 5. Audit Log│                                                     │  │
│  │  └────┬────────┘                                                     │  │
│  │       │                                                              │  │
│  │       ▼                                                              │  │
│  │  ┌─────────────┐                                                     │  │
│  │  │ 6. JSON Res │                                                     │  │
│  │  └─────────────┘                                                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  주요 API 경로:                                                               │
│  ┌───────────────────┬──────────────────────────────────────────────────┐   │
│  │ 인증               │ POST /api/admin/auth/login                      │   │
│  │                   │ POST /api/admin/auth/logout                     │   │
│  │                   │ POST /api/admin/auth/refresh                    │   │
│  ├───────────────────┼──────────────────────────────────────────────────┤   │
│  │ 대시보드           │ GET  /api/admin/stats/dashboard                 │   │
│  ├───────────────────┼──────────────────────────────────────────────────┤   │
│  │ CMS 콘텐츠        │ GET  /api/admin/cms                             │   │
│  │                   │ PUT  /api/admin/cms/[key]                       │   │
│  │                   │ POST /api/admin/cms/batch                       │   │
│  │                   │ POST /api/admin/cms/images                      │   │
│  │                   │ GET  /api/cms/content  (키오스크 공개)           │   │
│  ├───────────────────┼──────────────────────────────────────────────────┤   │
│  │ 도서 관리         │ CRUD /api/admin/books                          │   │
│  │                   │ POST /api/admin/books/import (CSV)              │   │
│  │                   │ GET  /api/admin/books/export (CSV)              │   │
│  ├───────────────────┼──────────────────────────────────────────────────┤   │
│  │ 사용자 관리       │ CRUD /api/admin/users                          │   │
│  │                   │ PATCH /api/admin/users/[id]/pin                 │   │
│  │                   │ PATCH /api/admin/users/[id]/card                │   │
│  ├───────────────────┼──────────────────────────────────────────────────┤   │
│  │ 관리자 계정       │ CRUD /api/admin/admins                        │   │
│  │                   │ PATCH /api/admin/admins/[id]/role               │   │
│  ├───────────────────┼──────────────────────────────────────────────────┤   │
│  │ 통계              │ GET  /api/admin/stats/*                        │   │
│  ├───────────────────┼──────────────────────────────────────────────────┤   │
│  │ 감사 로그         │ GET  /api/admin/audit-logs                     │   │
│  │                   │ GET  /api/admin/audit-logs/export               │   │
│  ├───────────────────┼──────────────────────────────────────────────────┤   │
│  │ 시스템 설정       │ GET  /api/admin/settings                       │   │
│  │                   │ PATCH /api/admin/settings                       │   │
│  │                   │ POST /api/admin/settings/backup                 │   │
│  │                   │ POST /api/admin/settings/restore                │   │
│  └───────────────────┴──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 주요 백엔드 흐름 요약

```
┌─ 인증 흐름 ────────────────────────────────────────────────────────────┐
│  Login → JWT 발급(access 15m + refresh 7d) → httpOnly 쿠키 설정       │
│  이후 요청 → 미들웨어에서 JWT 검증 → RBAC 권한 검사 → 핸들러 실행       │
│  토큰 만료 → 401 TOKEN_EXPIRED → 클라이언트 자동 refresh → 재시도       │
└─────────────────────────────────────────────────────────────────────────┘

┌─ 콘텐츠 관리 흐름 ────────────────────────────────────────────────────┐
│  Admin 편집 → PUT /api/admin/cms/[key] → DB 업데이트                  │
│             → 버전 증분(updatedAt 자동) → 감사 로그 기록               │
│  키오스크 → 3초 간격 GET /api/cms/content (ETag 조건부 요청)           │
│           → 304 or 200 → Zustand Store 갱신 → UI 자동 반영             │
└─────────────────────────────────────────────────────────────────────────┘

┌─ 도서·사용자 CRUD 흐름 ──────────────────────────────────────────────┐
│  목록: GET + 필터(search, category, status) + 페이지네이션             │
│  등록: POST + Zod 검증 + 유일성 검사(ISBN/RFID) + 감사 로그           │
│  수정: PUT + 변경 필드만 업데이트 + 이전/새 값 감사 로그               │
│  삭제: DELETE + 활성 대출 검사 + Soft Delete(status='REMOVED')        │
└─────────────────────────────────────────────────────────────────────────┘

┌─ 통계 대시보드 흐름 ─────────────────────────────────────────────────┐
│  대시보드 진입 → GET /api/admin/stats/dashboard                       │
│  → Promise.all([오늘현황, 주간추세, 시간대분포, 인기도서, 최근활동])  │
│  → 집계 결과 JSON 응답                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 화면별 프로그램 로직

### 2.1 AdminLogin

관리자 로그인 화면의 백엔드 로직. 이메일/비밀번호 폼 제출 → JWT 발급 → 대시보드 리다이렉트.

```
ON POST /api/admin/auth/login { email, password }:
  ① LoginSchema.safeParse(body) — Zod 검증
     - email: z.string().email()
     - password: z.string().min(8)
     - 실패 → 400 VALIDATION_ERROR

  ② AdminUser.findUnique({ where: { email } })
     - 계정 없음 → 401 AUTH_FAILED (동일 메시지로 정보 노출 방지)

  ③ 계정 잠금 확인
     - lockedUntil > now → 401 ACCOUNT_LOCKED

  ④ bcrypt.compare(password, admin.passwordHash)
     - 불일치 → loginFailCount++
       - loginFailCount >= 5 → lockedUntil = now + 15분
       - 401 AUTH_FAILED

  ⑤ JWT 생성
     - accessToken:  { sub, role, permissions }  expiresIn: 15m
     - refreshToken: { sub, type:'refresh' }     expiresIn: 7d

  ⑥ DB 업데이트
     - loginFailCount = 0, lockedUntil = null
     - lastLoginAt = now
     - refreshTokenHash = hash(refreshToken)

  ⑦ 감사 로그 기록: action=LOGIN

  ⑧ httpOnly 쿠키 설정 + 응답
     - Set-Cookie: admin_access_token  (path=/, maxAge=900)
     - Set-Cookie: admin_refresh_token (path=/api/admin/auth/refresh, maxAge=604800)
     - body: { user, role, permissions }
```

#### 2.1.1 로그인 의사코드

```typescript
// app/api/admin/auth/login/route.ts
const LoginSchema = z.object({
  email:    z.string().email('유효한 이메일 주소를 입력하세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
});

async function handleLogin(request: NextRequest): Promise<NextResponse> {
  // Step 1: Zod 검증
  const body = await request.json();
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, 'VALIDATION_ERROR', '입력값이 유효하지 않습니다.', parsed.error.flatten());
  }
  const { email, password } = parsed.data;

  // Step 2: 이메일로 관리자 조회
  const admin = await prisma.adminUser.findUnique({
    where: { email },
    include: { role: { include: { permissions: true } } }
  });

  const FAIL_MSG = '이메일 또는 비밀번호가 일치하지 않습니다.';
  if (!admin || !admin.isActive) {
    return errorResponse(401, 'AUTH_FAILED', FAIL_MSG);
  }

  // Step 3: 잠금 확인
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    return errorResponse(401, 'ACCOUNT_LOCKED', '계정이 잠겼습니다. 잠시 후 다시 시도하세요.');
  }

  // Step 4: 비밀번호 비교
  const isMatch = await bcrypt.compare(password, admin.passwordHash);
  if (!isMatch) {
    const newFailCount = admin.loginFailCount + 1;
    const lockUpdate = newFailCount >= 5
      ? { loginFailCount: newFailCount, lockedUntil: addMinutes(new Date(), 15) }
      : { loginFailCount: newFailCount };

    await prisma.adminUser.update({ where: { id: admin.id }, data: lockUpdate });
    await writeAuditLog({ action: 'LOGIN_FAILED', entity: 'AdminUser', entityId: admin.id, performedBy: admin.id });
    return errorResponse(401, 'AUTH_FAILED', FAIL_MSG);
  }

  // Step 5: JWT 생성
  const accessToken = signJwt(
    { sub: admin.id, role: admin.role.code, permissions: admin.role.permissions.map(p => p.code) },
    { expiresIn: '15m' }
  );
  const refreshToken = signJwt(
    { sub: admin.id, type: 'refresh' },
    { expiresIn: '7d' }
  );

  // Step 6: DB 업데이트
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      loginFailCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      refreshTokenHash: hashToken(refreshToken),
    }
  });

  // Step 7: 감사 로그
  await writeAuditLog({ action: 'LOGIN', entity: 'AdminUser', entityId: admin.id, performedBy: admin.id });

  // Step 8: 쿠키 설정 + 응답
  const response = NextResponse.json({
    data: {
      user: { id: admin.id, name: admin.name, email: admin.email },
      role: admin.role.code,
      permissions: admin.role.permissions.map(p => p.code),
    }
  });
  response.cookies.set('admin_access_token', accessToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 900 });
  response.cookies.set('admin_refresh_token', refreshToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/admin/auth/refresh', maxAge: 604800 });
  return response;
}
```

---

### 2.2 DashboardOverview

대시보드 개요 화면의 백엔드 로직. 오늘 현황 KPI, 추세 차트, 인기 도서, 시스템 상태, 알림 목록을 집계.

```
ON GET /api/admin/stats/dashboard:
  ① JWT + RBAC 검사 — 권한: stats:read

  ② Promise.all로 병렬 집계:
     - getTodayStats()        → 오늘 대출/반납/활성대출/연체 건수
     - calculateTrend()       → 이번주 vs 지난주 대출 추세율
     - getHourlyDistribution(7) → 최근 7일 시간대별 대출·반납 분포
     - getPopularBooks(10)    → 대출 횟수 TOP 10 도서
     - getRecentActivity(20)  → 최근 20건 활동 로그
     - getSystemHealth()      → DB 크기, 활성 키오스크 수, 마지막 백업 시각

  ③ 집계 결과 병합 → JSON 응답
```

#### 2.2.1 오늘 현황 집계 의사코드

```typescript
// lib/stats-today.ts
async function getTodayStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayBorrows, todayReturns, activeLoans, overdueLoans, activeUsers] = await Promise.all([
    // 금일 대출 건수
    prisma.simLoan.count({ where: { loanDate: { gte: today } } }),
    // 금일 반납 건수
    prisma.simLoan.count({ where: { returnedAt: { gte: today }, status: 'RETURNED' } }),
    // 현재 대출 중
    prisma.simLoan.count({ where: { status: 'ACTIVE' } }),
    // 연체 건수
    prisma.simLoan.count({ where: { status: 'ACTIVE', dueDate: { lt: new Date() } } }),
    // 활성 이용자 수
    prisma.simUser.count({ where: { isActive: true } }),
  ]);

  return { todayBorrows, todayReturns, activeLoans, overdueLoans, activeUsers };
}
```

#### 2.2.2 주간 추세 계산 의사코드

```typescript
// lib/stats-trend.ts
async function calculateTrend() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(lastWeekStart.getDate() - 14);

  const [thisWeekCount, lastWeekCount] = await Promise.all([
    prisma.simLoan.count({ where: { loanDate: { gte: thisWeekStart, lt: today } } }),
    prisma.simLoan.count({ where: { loanDate: { gte: lastWeekStart, lt: thisWeekStart } } }),
  ]);

  const trendPercent = lastWeekCount === 0
    ? (thisWeekCount > 0 ? 100 : 0)
    : Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100);

  return {
    thisWeek: thisWeekCount,
    lastWeek: lastWeekCount,
    trendPercent,
    trendDirection: trendPercent > 0 ? 'up' : trendPercent < 0 ? 'down' : 'neutral',
  };
}
```

#### 2.2.3 시간대별 분포 집계 의사코드

```typescript
// lib/stats-hourly.ts
async function getHourlyDistribution(days: number = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const loans = await prisma.simLoan.findMany({
    where: { loanDate: { gte: since } },
    select: { loanDate: true }
  });

  const returns = await prisma.simLoan.findMany({
    where: { returnedAt: { gte: since }, status: 'RETURNED' },
    select: { returnedAt: true }
  });

  // 0~23시 분포 배열 초기화
  const hours = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${h.toString().padStart(2, '0')}:00`,
    loanCount: 0,
    returnCount: 0,
  }));

  for (const loan of loans) hours[loan.loanDate.getHours()].loanCount++;
  for (const ret of returns) { if (ret.returnedAt) hours[ret.returnedAt.getHours()].returnCount++; }

  const peakHour = hours.reduce((max, h) => h.loanCount > max.loanCount ? h : max, hours[0]);

  return { hours, peakHour };
}
```

#### 2.2.4 인기 도서 TOP N 집계 의사코드

```typescript
// lib/stats-popular.ts
async function getPopularBooks(limit: number = 10) {
  const popular = await prisma.$queryRaw<Array<{ bookId: string; count: bigint }>>`
    SELECT bookId, COUNT(*) as count
    FROM SimLoan
    GROUP BY bookId
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  const books = await prisma.book.findMany({
    where: { id: { in: popular.map(p => p.bookId) } },
    select: { id: true, title: true, author: true, coverUrl: true, category: true }
  });

  return popular.map((p, rank) => ({
    rank: rank + 1,
    book: books.find(b => b.id === p.bookId)!,
    loanCount: Number(p.count),
  }));
}
```

#### 2.2.5 시스템 상태 집계 의사코드

```typescript
// lib/stats-health.ts
async function getSystemHealth() {
  const dbPath = path.join(process.cwd(), 'db', 'custom.db');
  const dbStats = fs.statSync(dbPath);
  const dbSizeMB = (dbStats.size / (1024 * 1024)).toFixed(2);

  const [totalBooks, totalUsers, totalAdmins, lastBackup] = await Promise.all([
    prisma.book.count({ where: { status: { not: 'REMOVED' } } }),
    prisma.simUser.count({ where: { isActive: true } }),
    prisma.adminUser.count({ where: { isActive: true } }),
    prisma.systemSetting.findUnique({ where: { key: 'system.last_backup_at' } }),
  ]);

  return {
    dbSizeMB,
    totalBooks,
    totalUsers,
    totalAdmins,
    lastBackupAt: lastBackup?.value ?? null,
    uptime: process.uptime(),
    nodeVersion: process.version,
  };
}
```

---

### 2.3 ContentManagement

CMS 콘텐츠 관리 화면의 백엔드 로직. 키오스크 화면별 콘텐츠를 그룹핑하여 조회, 단일/일괄 수정, 이미지 업로드.

```
ON GET /api/admin/cms:
  ① JWT + RBAC — 권한: cms:read
  ② CmsContent.findMany({ orderBy: { key: 'asc' } })
  ③ key 접두사로 화면별 그룹핑 (idle.*, menu.*, auth.*, ...)
  ④ 응답: { items, grouped, total }

ON PUT /api/admin/cms/[key] { value }:
  ① JWT + RBAC — 권한: cms:write
  ② Zod 검증: value 비어있지 않은 문자열
  ③ 기존 항목 조회 → 존재하지 않으면 404
  ④ 타입별 값 검증 (validateCmsValue):
     - text   → 길이 ≤ 200
     - color  → /^#[0-9A-Fa-f]{6}$/
     - number → NaN 아님
     - boolean→ 'true' | 'false'
     - image  → /uploads/ 또는 /images/ 경로
     - json   → JSON.parse() 성공
  ⑤ oldValue 저장 → DB 업데이트 → 감사 로그

ON POST /api/admin/cms/batch { items: [{key, value}] }:
  ① JWT + RBAC — 권한: cms:write
  ② 전체 항목 사전 검증 (존재 + 타입별 값)
  ③ prisma.$transaction으로 원자적 업데이트
  ④ 각 항목별 감사 로그 기록
  ⑤ 응답: { updated: number, items }

ON POST /api/admin/cms/images (FormData):
  ① JWT + RBAC — 권한: cms:image
  ② 파일 검증: MIME(JPG/PNG/SVG), 크기 ≤ 2MB, magic byte
  ③ Sharp 리사이즈(800×1200) + WebP 변환 (SVG는 sanitize 후 그대로)
  ④ /public/uploads/{uuid}.webp 저장
  ⑤ CmsImage 메타 DB 저장
  ⑥ 감사 로그 기록
```

#### 2.3.1 콘텐츠 조회 의사코드

```typescript
// app/api/admin/cms/route.ts (GET)
async function handleGetCms(ctx: AdminHandlerContext) {
  const items = await prisma.cmsContent.findMany({ orderBy: { key: 'asc' } });

  // 화면별 그룹핑
  const grouped = items.reduce((acc, item) => {
    const section = item.key.split('.')[0]; // "idle", "menu", "auth" 등
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, CmsContent[]>);

  return NextResponse.json({ data: { items, grouped, total: items.length } });
}
```

#### 2.3.2 단일 콘텐츠 수정 의사코드

```typescript
// app/api/admin/cms/[key]/route.ts (PUT)
const CmsUpdateSchema = z.object({
  value: z.string().min(1, '값은 비어있을 수 없습니다.'),
  expectedUpdatedAt: z.string().datetime().optional(), // 동시 수정 감지용
});

async function handleUpdateCms(ctx: AdminHandlerContext, key: string, input: CmsUpdateInput) {
  const existing = await prisma.cmsContent.findUnique({ where: { key } });
  if (!existing) return errorResponse(404, 'NOT_FOUND', `CMS 항목 '${key}'이(가) 존재하지 않습니다.`);

  // 동시 수정 충돌 감지
  if (input.expectedUpdatedAt && existing.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    return errorResponse(409, 'CONCURRENT_UPDATE', '다른 관리자가 이 항목을 수정했습니다.');
  }

  // 타입별 값 검증
  const validatedValue = validateCmsValue(existing.type, input.value);

  const oldValue = existing.value;
  const updated = await prisma.cmsContent.update({
    where: { key },
    data: { value: String(validatedValue), updatedBy: ctx.admin.id }
  });

  // 감사 로그 + 버전 증분은 updatedAt(@updatedAt)으로 자동 처리
  await writeAuditLog({
    action: 'UPDATE', entity: 'CmsContent', entityId: updated.id,
    oldValue: JSON.stringify({ key, value: oldValue }),
    newValue: JSON.stringify({ key, value: updated.value }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: updated });
}
```

#### 2.3.3 타입별 검증 함수

```typescript
// lib/cms-validate.ts
function validateCmsValue(type: string, value: string): unknown {
  switch (type) {
    case 'text':
      if (value.length > 200) throw new ValidationError('텍스트가 너무 깁니다. (200자 이내)');
      return value;
    case 'color':
      if (!/^#[0-9A-Fa-f]{6}$/.test(value)) throw new ValidationError('유효한 HEX 색상이 아닙니다. (예: #1E3A5F)');
      return value;
    case 'number':
      const num = Number(value);
      if (isNaN(num)) throw new ValidationError('숫자가 아닙니다.');
      return value;
    case 'boolean':
      if (!['true', 'false'].includes(value)) throw new ValidationError('boolean 값이 아닙니다.');
      return value;
    case 'image':
      if (!value.startsWith('/uploads/') && !value.startsWith('/images/'))
        throw new ValidationError('유효한 이미지 경로가 아닙니다.');
      return value;
    case 'json':
      try { JSON.parse(value); return value; }
      catch { throw new ValidationError('유효한 JSON이 아닙니다.'); }
    default:
      return value;
  }
}
```

#### 2.3.4 일괄 수정 의사코드

```typescript
// app/api/admin/cms/batch/route.ts (POST)
const CmsBatchSchema = z.object({
  items: z.array(z.object({ key: z.string(), value: z.string() })).min(1).max(100),
});

async function handleBatchUpdate(ctx: AdminHandlerContext, input: CmsBatchInput) {
  // 사전 검증: 존재 + 타입별
  const existingItems = await prisma.cmsContent.findMany({
    where: { key: { in: input.items.map(i => i.key) } }
  });
  const existingMap = new Map(existingItems.map(i => [i.key, i]));
  const missingKeys = input.items.filter(i => !existingMap.has(i.key));
  if (missingKeys.length > 0) {
    return errorResponse(400, 'INVALID_KEYS', `존재하지 않는 키: ${missingKeys.map(k => k.key).join(', ')}`);
  }
  for (const item of input.items) {
    const existing = existingMap.get(item.key)!;
    try { validateCmsValue(existing.type, item.value); }
    catch (e) { return errorResponse(400, 'VALIDATION_ERROR', `키 '${item.key}'의 값이 유효하지 않습니다.`); }
  }

  // 원자적 트랜잭션
  const results = await prisma.$transaction(async (tx) => {
    const updated: CmsContent[] = [];
    for (const item of input.items) {
      const existing = existingMap.get(item.key)!;
      const result = await tx.cmsContent.update({
        where: { key: item.key },
        data: { value: item.value, updatedBy: ctx.admin.id }
      });
      updated.push(result);
      await tx.auditLog.create({
        data: {
          action: 'UPDATE', entity: 'CmsContent', entityId: result.id,
          oldValue: JSON.stringify({ key: item.key, value: existing.value }),
          newValue: JSON.stringify({ key: item.key, value: item.value }),
          performedBy: ctx.admin.id,
        }
      });
    }
    return updated;
  });

  return NextResponse.json({ data: { updated: results.length, items: results } });
}
```

#### 2.3.5 이미지 업로드 의사코드

```typescript
// app/api/admin/cms/images/route.ts (POST)
async function handleImageUpload(request: NextRequest, ctx: AdminHandlerContext) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  // 파일 검증
  const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/svg+xml'];
  if (!ALLOWED_MIMES.includes(file.type))
    return errorResponse(400, 'INVALID_MIME', 'JPG, PNG, SVG 파일만 업로드 가능합니다.');
  if (file.size > 2 * 1024 * 1024)
    return errorResponse(400, 'FILE_TOO_LARGE', '파일 크기는 2MB 이하여야 합니다.');

  // Magic byte 검증
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!verifyMagicByte(buffer, file.type))
    return errorResponse(400, 'MIME_MISMATCH', '파일 내용이 MIME 타입과 일치하지 않습니다.');

  const fileId = randomUUID();
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'cms');
  ensureDir(uploadDir);

  let outputPath: string, width = 0, height = 0;

  if (file.type === 'image/svg+xml') {
    const sanitized = sanitizeSvg(buffer.toString('utf-8'));
    outputPath = path.join(uploadDir, `${fileId}.svg`);
    fs.writeFileSync(outputPath, sanitized);
  } else {
    const processed = await sharp(buffer)
      .resize(800, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    outputPath = path.join(uploadDir, `${fileId}.webp`);
    fs.writeFileSync(outputPath, processed);
    const meta = await sharp(processed).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  }

  const url = `/uploads/cms/${path.basename(outputPath)}`;
  const imageRecord = await prisma.cmsImage.create({
    data: { id: fileId, url, originalName: file.name, mimeType: file.type, size: file.size, width, height, uploadedBy: ctx.admin.id }
  });

  await writeAuditLog({ action: 'CREATE', entity: 'CmsImage', entityId: imageRecord.id, newValue: JSON.stringify(imageRecord), performedBy: ctx.admin.id });

  return NextResponse.json({ data: imageRecord }, { status: 201 });
}
```

---

### 2.4 UserManagement

사용자 관리 화면의 백엔드 로직. 도서관 이용자(SimUser/LibraryUser) CRUD, PIN 관리, RFID 카드 재발급, 관리자 계정 관리.

```
ON GET /api/admin/users ?page=&search=&status=:
  ① JWT + RBAC — 권한: user:read
  ② 페이지네이션 + 필터 조건构建
  ③ pinHash 마스킹 (응답에서 제거)
  ④ 응답: { items, pagination }

ON POST /api/admin/users { name, rfid, pin, phone?, email? }:
  ① JWT + RBAC — 권한: user:create
  ② Zod 검증: name≤50, rfid≤20, PIN 6자리 숫자
  ③ RFID 유일성 검사
  ④ PIN → bcrypt.hash(pin, 12)
  ⑤ LibraryUser.create → 감사 로그 (pinHash는 [REDACTED])

ON PUT /api/admin/users/[id] { name?, phone?, email?, status? }:
  ① JWT + RBAC — 권한: user:update
  ② 기존 사용자 조회
  ③ RFID 변경 시 유일성 재검사
  ④ 업데이트 → 감사 로그

ON PATCH /api/admin/users/[id]/pin { newPin }:
  ① JWT + RBAC — 권한: user:update
  ② newPin Zod 검증 (6자리 숫자)
  ③ bcrypt.hash(newPin, 12)
  ④ pinHash 업데이트 → 감사 로그 ([REDACTED])

ON PATCH /api/admin/users/[id]/deactivate:
  ① JWT + RBAC — 권한: user:deactivate
  ② 활성 대출 조회 → 대출 중이면 409 ACTIVE_LOAN
  ③ status = 'WITHDRAWN' → 감사 로그

ON PATCH /api/admin/users/[id]/card { newRfid }:
  ① JWT + RBAC — 권한: user:update
  ② 새 RFID 유일성 검사
  ③ rfid 업데이트 → 감사 로그 (이전/새 RFID)
```

#### 2.4.1 사용자 목록 조회 의사코드

```typescript
// app/api/admin/users/route.ts (GET)
async function handleListUsers(request: NextRequest, ctx: AdminHandlerContext) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 50));
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || '';

  const where: Prisma.LibraryUserWhereInput = {
    ...(status && { status }),
    ...(search && {
      OR: [
        { name: { contains: search } },
        { rfid: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ]
    }),
  };

  const [items, total] = await Promise.all([
    prisma.libraryUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, rfid: true, phone: true, email: true,
        status: true, borrowCount: true, overdueCount: true,
        createdAt: true, updatedAt: true,
        // pinHash는 의도적으로 제외 (마스킹)
      }
    }),
    prisma.libraryUser.count({ where }),
  ]);

  return NextResponse.json({
    data: { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }
  });
}
```

#### 2.4.2 사용자 등록 의사코드

```typescript
// app/api/admin/users/route.ts (POST)
const UserCreateSchema = z.object({
  name:  z.string().min(1).max(50, '성명은 50자 이내'),
  rfid:  z.string().min(1).max(20, 'RFID는 20자 이내'),
  pin:   z.string().regex(/^\d{6}$/, 'PIN은 6자리 숫자'),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(100).optional(),
});

async function handleCreateUser(ctx: AdminHandlerContext, input: UserCreateInput) {
  // RFID 유일성
  const existing = await prisma.libraryUser.findUnique({ where: { rfid: input.rfid } });
  if (existing) return errorResponse(409, 'RFID_DUPLICATE', `RFID ${input.rfid}이(가) 이미 등록되어 있습니다.`);

  // PIN 해시
  const pinHash = await bcrypt.hash(input.pin, 12);

  const user = await prisma.libraryUser.create({
    data: { name: input.name, rfid: input.rfid, pinHash, phone: input.phone, email: input.email, borrowCount: 0, overdueCount: 0, status: 'ACTIVE' }
  });

  await writeAuditLog({
    action: 'CREATE', entity: 'LibraryUser', entityId: user.id,
    newValue: JSON.stringify({ ...user, pinHash: '[REDACTED]' }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: { ...user, pinHash: undefined } }, { status: 201 });
}
```

#### 2.4.3 관리자 계정 관리 의사코드

```typescript
// app/api/admin/admins/route.ts
const AdminCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(50),
  roleCode: z.enum(['super_admin', 'admin', 'operator']),
});

async function handleCreateAdmin(ctx: AdminHandlerContext, input: AdminCreateInput) {
  // 역할 계층 검사: super_admin만 관리자 계정 생성 가능
  if (!hasPermission(ctx.admin.role.code, 'admin:create')) {
    return errorResponse(403, 'FORBIDDEN', '관리자 계정 생성 권한이 없습니다.');
  }

  // 이메일 유일성
  const existing = await prisma.adminUser.findUnique({ where: { email: input.email } });
  if (existing) return errorResponse(409, 'EMAIL_DUPLICATE', '이미 사용 중인 이메일입니다.');

  const passwordHash = await bcrypt.hash(input.password, 12);

  const admin = await prisma.adminUser.create({
    data: { email: input.email, passwordHash, name: input.name, role: { connect: { code: input.roleCode } }, isActive: true }
  });

  await writeAuditLog({ action: 'CREATE', entity: 'AdminUser', entityId: admin.id, newValue: JSON.stringify({ email: admin.email, name: admin.name, role: input.roleCode }), performedBy: ctx.admin.id });

  return NextResponse.json({ data: { id: admin.id, email: admin.email, name: admin.name, role: input.roleCode } }, { status: 201 });
}
```

---

### 2.5 BookManagement

도서 관리 화면의 백엔드 로직. CRUD + 표지 이미지 업로드 + CSV 가져오기/내보내기.

```
ON GET /api/admin/books ?page=&search=&category=&status=:
  ① JWT + RBAC — 권한: book:read
  ② 필터 + 페이지네이션 (status != 'REMOVED' 기본)
  ③ 응답: { items, pagination }

ON POST /api/admin/books { title, author, isbn, category, ... }:
  ① JWT + RBAC — 권한: book:create
  ② Zod 검증 (title≤200, author≤100, ISBN-13 13자리 숫자)
  ③ ISBN 유일성 검사 → 중복 시 409
  ④ Book.create → 감사 로그

ON PUT /api/admin/books/[id] { ... }:
  ① JWT + RBAC — 권한: book:update
  ② 기존 도서 조회
  ③ ISBN 변경 시 유일성 재검사
  ④ 업데이트 → 감사 로그

ON DELETE /api/admin/books/[id]:
  ① JWT + RBAC — 권한: book:delete
  ② 활성 대출 조회 → 대출 중이면 409 ACTIVE_LOAN
  ③ Soft delete: status = 'REMOVED' → 감사 로그

ON POST /api/admin/books/import (FormData: CSV file):
  ① JWT + RBAC — 권한: book:import
  ② CSV 파싱 + 행별 Zod 검증
  ③ ISBN 중복(기존 DB) 스킵 또는 업데이트 (upsert 모드)
  ④ prisma.$transaction으로 일괄 삽입
  ⑤ 응답: { created, updated, skipped, errors }

ON GET /api/admin/books/export ?format=csv:
  ① JWT + RBAC — 권한: book:read
  ② 전체 도서 조회 (status != 'REMOVED')
  ③ CSV 문자열 생성 → 응답 (Content-Disposition: attachment)
```

#### 2.5.1 도서 등록 의사코드

```typescript
// app/api/admin/books/route.ts (POST)
const BookCreateSchema = z.object({
  title:       z.string().min(1).max(200, '도서명은 200자 이내'),
  author:      z.string().min(1).max(100, '저자는 100자 이내'),
  isbn:        z.string().regex(/^\d{13}$/, 'ISBN-13 형식(13자리 숫자)'),
  category:    z.string().min(1, '카테고리는 필수입니다'),
  publisher:   z.string().max(100).optional(),
  publishYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  coverImage:  z.string().optional(),
  totalCopies: z.number().int().min(1).default(3),
  shelfLocation: z.string().max(50).optional(),
});

async function handleCreateBook(ctx: AdminHandlerContext, input: BookCreateInput) {
  // ISBN 유일성
  const existing = await prisma.book.findUnique({ where: { isbn: input.isbn } });
  if (existing) return errorResponse(409, 'ISBN_DUPLICATE', `ISBN ${input.isbn}이(가) 이미 등록되어 있습니다.`);

  const book = await prisma.book.create({
    data: { ...input, availableCopies: input.totalCopies, status: 'AVAILABLE' }
  });

  await writeAuditLog({ action: 'CREATE', entity: 'Book', entityId: book.id, newValue: JSON.stringify(book), performedBy: ctx.admin.id });

  return NextResponse.json({ data: book }, { status: 201 });
}
```

#### 2.5.2 도서 삭제(Soft Delete) 의사코드

```typescript
// app/api/admin/books/[id]/route.ts (DELETE)
async function handleDeleteBook(ctx: AdminHandlerContext, id: string) {
  const existing = await prisma.book.findUnique({
    where: { id },
    include: { loans: { where: { returnedAt: null } } }
  });
  if (!existing) return errorResponse(404, 'NOT_FOUND', '도서를 찾을 수 없습니다.');
  if (existing.loans.length > 0)
    return errorResponse(409, 'ACTIVE_LOAN', '대출 중인 도서는 삭제할 수 없습니다. 먼저 반납 처리하세요.');

  const removed = await prisma.book.update({ where: { id }, data: { status: 'REMOVED' } });

  await writeAuditLog({
    action: 'DELETE', entity: 'Book', entityId: id,
    oldValue: JSON.stringify(existing), newValue: JSON.stringify({ status: 'REMOVED' }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: { deleted: true, id } });
}
```

#### 2.5.3 CSV 가져오기 의사코드

```typescript
// app/api/admin/books/import/route.ts (POST)
async function handleCsvImport(request: NextRequest, ctx: AdminHandlerContext) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file.name.endsWith('.csv'))
    return errorResponse(400, 'INVALID_FORMAT', 'CSV 파일만 가져오기 가능합니다.');
  if (file.size > 5 * 1024 * 1024)
    return errorResponse(400, 'FILE_TOO_LARGE', '파일 크기는 5MB 이하여야 합니다.');

  const text = await file.text();
  const rows = parseCsv(text); // 헤더 + 데이터 행

  const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const parsed = BookCsvRowSchema.safeParse(row);
      if (!parsed.success) {
        result.errors.push(`행 ${i + 2}: ${parsed.error.message}`);
        result.skipped++;
        continue;
      }

      // ISBN 기준 upsert
      const existing = await tx.book.findUnique({ where: { isbn: parsed.data.isbn } });
      if (existing) {
        await tx.book.update({ where: { isbn: parsed.data.isbn }, data: parsed.data });
        result.updated++;
      } else {
        await tx.book.create({ data: { ...parsed.data, availableCopies: parsed.data.totalCopies, status: 'AVAILABLE' } });
        result.created++;
      }
    }
  });

  await writeAuditLog({
    action: 'CREATE', entity: 'Book', entityId: 'batch',
    newValue: JSON.stringify(result), performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: result });
}
```

#### 2.5.4 CSV 내보내기 의사코드

```typescript
// app/api/admin/books/export/route.ts (GET)
async function handleCsvExport(request: NextRequest, ctx: AdminHandlerContext) {
  const books = await prisma.book.findMany({
    where: { status: { not: 'REMOVED' } },
    orderBy: { title: 'asc' }
  });

  const headers = ['isbn', 'title', 'author', 'category', 'publisher', 'publishYear', 'totalCopies', 'availableCopies', 'shelfLocation'];
  const csvRows = books.map(b => headers.map(h => csvEscape(b[h])).join(','));
  const csv = [headers.join(','), ...csvRows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="books_${new Date().toISOString().slice(0, 10)}.csv"`,
    }
  });
}
```

---

### 2.6 AnalyticsPage

통계 분석 화면의 백엔드 로직. 날짜 범위 선택 → 대출/반납 추세 차트, 인기 도서 랭킹, 카테고리 분포, 피크 시간대 히트맵, 사용자 활동 목록.

```
ON GET /api/admin/stats/loans-trend ?dateFrom=&dateTo=:
  ① JWT + RBAC — 권한: stats:read
  ② dateFrom ~ dateTo 범위의 일별 대출/반납 건수 집계
  ③ 응답: [{ date, loanCount, returnCount }]

ON GET /api/admin/stats/popular-books ?limit=&dateFrom=&dateTo=:
  ① JWT + RBAC — 권한: stats:read
  ② 기간 내 대출 횟수 기준 TOP N 집계
  ③ 응답: [{ rank, book, loanCount }]

ON GET /api/admin/stats/category-distribution:
  ① JWT + RBAC — 권한: stats:read
  ② 카테고리별 도서 수 및 대출 건수 집계
  ③ 응답: [{ category, bookCount, loanCount, percentage }]

ON GET /api/admin/stats/peak-hours ?days=:
  ① JWT + RBAC — 권한: stats:read
  ② 최근 N일간 0~23시 대출/반납 분포
  ③ 응답: { hours: [{hour, loanCount, returnCount}], peakHour }

ON GET /api/admin/stats/user-activity ?page=&limit=:
  ① JWT + RBAC — 권한: stats:read
  ② 최근 활동 순 사용자 목록 (대출+반납 건수)
  ③ 응답: [{ user, loanCount, returnCount, lastActivityAt }]
```

#### 2.6.1 대출 추세 집계 의사코드

```typescript
// app/api/admin/stats/loans-trend/route.ts (GET)
async function handleLoansTrend(request: NextRequest, ctx: AdminHandlerContext) {
  const url = new URL(request.url);
  const dateFrom = new Date(url.searchParams.get('dateFrom') || subDays(new Date(), 30).toISOString());
  const dateTo = new Date(url.searchParams.get('dateTo') || new Date().toISOString());

  // 일별 집계 (raw SQL — Prisma groupBy 제약 회피)
  const dailyStats = await prisma.$queryRaw<Array<{ date: string; loanCount: bigint; returnCount: bigint }>>`
    SELECT
      DATE(loanDate) as date,
      SUM(CASE WHEN type = 'BORROW' THEN 1 ELSE 0 END) as loanCount,
      SUM(CASE WHEN type = 'RETURN' THEN 1 ELSE 0 END) as returnCount
    FROM SimLoan
    WHERE loanDate >= ${dateFrom} AND loanDate <= ${dateTo}
    GROUP BY DATE(loanDate)
    ORDER BY date ASC
  `;

  return NextResponse.json({
    data: dailyStats.map(s => ({
      date: s.date,
      loanCount: Number(s.loanCount),
      returnCount: Number(s.returnCount),
    }))
  });
}
```

#### 2.6.2 카테고리 분포 집계 의사코드

```typescript
// app/api/admin/stats/category-distribution/route.ts (GET)
async function handleCategoryDistribution(ctx: AdminHandlerContext) {
  const categoryStats = await prisma.$queryRaw<Array<{ category: string; bookCount: bigint; loanCount: bigint }>>`
    SELECT
      b.category,
      COUNT(DISTINCT b.id) as bookCount,
      COUNT(sl.id) as loanCount
    FROM Book b
    LEFT JOIN SimLoan sl ON sl.bookId = b.id
    WHERE b.status != 'REMOVED'
    GROUP BY b.category
    ORDER BY loanCount DESC
  `;

  const totalLoans = categoryStats.reduce((sum, c) => sum + Number(c.loanCount), 0);

  return NextResponse.json({
    data: categoryStats.map(c => ({
      category: c.category,
      bookCount: Number(c.bookCount),
      loanCount: Number(c.loanCount),
      percentage: totalLoans > 0 ? Math.round((Number(c.loanCount) / totalLoans) * 100) : 0,
    }))
  });
}
```

#### 2.6.3 사용자 활동 목록 의사코드

```typescript
// app/api/admin/stats/user-activity/route.ts (GET)
async function handleUserActivity(request: NextRequest, ctx: AdminHandlerContext) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));

  const userActivity = await prisma.$queryRaw<Array<{
    userId: string; name: string; loanCount: bigint; returnCount: bigint; lastActivityAt: Date;
  }>>`
    SELECT
      u.id as userId, u.name,
      SUM(CASE WHEN sl.status = 'ACTIVE' THEN 1 ELSE 0 END) as loanCount,
      SUM(CASE WHEN sl.status = 'RETURNED' THEN 1 ELSE 0 END) as returnCount,
      MAX(COALESCE(sl.returnedAt, sl.loanDate)) as lastActivityAt
    FROM SimUser u
    LEFT JOIN SimLoan sl ON sl.userId = u.id
    WHERE u.isActive = 1
    GROUP BY u.id
    ORDER BY lastActivityAt DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `;

  return NextResponse.json({
    data: userActivity.map(u => ({
      user: { id: u.userId, name: u.name },
      loanCount: Number(u.loanCount),
      returnCount: Number(u.returnCount),
      lastActivityAt: u.lastActivityAt?.toISOString() ?? null,
    }))
  });
}
```

---

### 2.7 SystemSettings

시스템 설정 화면의 백엔드 로직. 키오스크 구성, 테마 설정, 유지보수 모드, DB 백업/복원.

```
ON GET /api/admin/settings:
  ① JWT + RBAC — 권한: stats:read
  ② SystemSetting 전체 조회
  ③ 그룹핑 (borrow.*, kiosk.*, audit.*, system.*)
  ④ 응답: { items, grouped }

ON PATCH /api/admin/settings { items: [{key, value}] }:
  ① JWT + RBAC — 권한: cms:write (또는 system:setting)
  ② 각 항목 타입별 검증
  ③ prisma.$transaction으로 업데이트
  ④ 감사 로그 기록

ON POST /api/admin/settings/backup:
  ① JWT + RBAC — 권한: system:backup
  ② SQLite 파일 복사 (VACUUM INTO)
  ③ 백업 메타 기록 (크기, 일시)
  ④ 응답: { filename, size, timestamp }

ON POST /api/admin/settings/restore:
  ① JWT + RBAC — 권한: system:backup (super_admin only)
  ② 업로드된 DB 파일 검증 (SQLite magic header)
  ③ 현재 DB 백업 (안전망)
  ④ 업로드 파일로 DB 교체
  ⑤ Prisma 재연결
  ⑥ 감사 로그 기록
```

#### 2.7.1 설정 조회 의사코드

```typescript
// app/api/admin/settings/route.ts (GET)
async function handleGetSettings(ctx: AdminHandlerContext) {
  const items = await prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });

  const grouped = items.reduce((acc, item) => {
    const section = item.key.split('.')[0]; // "borrow", "kiosk", "audit", "system"
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  return NextResponse.json({ data: { items, grouped } });
}
```

#### 2.7.2 설정 업데이트 의사코드

```typescript
// app/api/admin/settings/route.ts (PATCH)
const SettingsUpdateSchema = z.object({
  items: z.array(z.object({ key: z.string(), value: z.string() })).min(1).max(50),
});

async function handleUpdateSettings(ctx: AdminHandlerContext, input: SettingsUpdateInput) {
  const results = await prisma.$transaction(async (tx) => {
    const updated = [];
    for (const item of input.items) {
      const existing = await tx.systemSetting.findUnique({ where: { key: item.key } });
      if (!existing) continue;

      const result = await tx.systemSetting.update({
        where: { key: item.key },
        data: { value: item.value }
      });
      updated.push(result);

      await tx.auditLog.create({
        data: {
          action: 'UPDATE', entity: 'SystemSetting', entityId: result.id,
          oldValue: JSON.stringify({ key: item.key, value: existing.value }),
          newValue: JSON.stringify({ key: item.key, value: item.value }),
          performedBy: ctx.admin.id,
        }
      });
    }
    return updated;
  });

  return NextResponse.json({ data: { updated: results.length, items: results } });
}
```

#### 2.7.3 DB 백업 의사코드

```typescript
// app/api/admin/settings/backup/route.ts (POST)
async function handleBackup(ctx: AdminHandlerContext) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `backup_${timestamp}.db`;
  const backupPath = path.join(process.cwd(), 'backups', backupFilename);
  ensureDir(path.dirname(backupPath));

  // SQLite VACUUM INTO (온라인 백업 — 잠금 없음)
  await prisma.$executeRawUnsafe(`VACUUM INTO '${backupPath}'`);

  const stats = fs.statSync(backupPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  // 백업 메타 기록
  await prisma.systemSetting.upsert({
    where: { key: 'system.last_backup_at' },
    update: { value: new Date().toISOString() },
    create: { key: 'system.last_backup_at', value: new Date().toISOString(), type: 'text' },
  });

  await writeAuditLog({
    action: 'CREATE', entity: 'SystemSetting', entityId: 'backup',
    newValue: JSON.stringify({ filename: backupFilename, sizeMB, timestamp }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: { filename: backupFilename, sizeMB, timestamp } });
}
```

#### 2.7.4 DB 복원 의사코드

```typescript
// app/api/admin/settings/restore/route.ts (POST)
async function handleRestore(request: NextRequest, ctx: AdminHandlerContext) {
  // super_admin만 복원 가능
  if (ctx.admin.role.code !== 'super_admin') {
    return errorResponse(403, 'FORBIDDEN', '슈퍼 관리자만 DB 복원할 수 있습니다.');
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const buffer = Buffer.from(await file.arrayBuffer());

  // SQLite magic header 검증
  const SQLITE_HEADER = Buffer.from('SQLite format 3\0');
  if (!buffer.subarray(0, 16).equals(SQLITE_HEADER)) {
    return errorResponse(400, 'INVALID_DB_FILE', '유효한 SQLite 데이터베이스 파일이 아닙니다.');
  }

  // 현재 DB 안전망 백업
  const dbPath = path.join(process.cwd(), 'db', 'custom.db');
  const safetyBackup = `${dbPath}.pre-restore.${Date.now()}`;
  fs.copyFileSync(dbPath, safetyBackup);

  // 업로드 파일로 교체
  fs.writeFileSync(dbPath, buffer);

  // Prisma 재연결
  await prisma.$disconnect();
  await prisma.$connect();

  await writeAuditLog({
    action: 'UPDATE', entity: 'SystemSetting', entityId: 'restore',
    newValue: JSON.stringify({ restoredAt: new Date().toISOString(), originalFile: file.name }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: { restored: true, timestamp: new Date().toISOString() } });
}
```

---

### 2.8 AuditLog

감사 로그 화면의 백엔드 로직. 필터 가능한 로그 테이블, CSV 내보내기.

```
ON GET /api/admin/audit-logs ?page=&adminId=&action=&entity=&dateFrom=&dateTo=:
  ① JWT + RBAC — 권한: audit:read
  ② 필터 조건构建 (adminId, action, entity, dateFrom~dateTo)
  ③ 페이지네이션 + 내림차순 정렬 (performedAt DESC)
  ④ 각 항목에 diff 계산 (computeAuditDiff)
  ⑤ 응답: { items(with diff), pagination }

ON GET /api/admin/audit-logs/export ?dateFrom=&dateTo=&format=csv:
  ① JWT + RBAC — 권한: audit:export (super_admin only)
  ② 필터 조건으로 전체 조회 (페이지네이션 없음)
  ③ CSV 문자열 생성
  ④ 응답: Content-Disposition: attachment
```

#### 2.8.1 감사 로그 조회 의사코드

```typescript
// app/api/admin/audit-logs/route.ts (GET)
async function handleListAuditLogs(request: NextRequest, ctx: AdminHandlerContext) {
  const url = new URL(request.url);
  const adminId  = url.searchParams.get('adminId') || undefined;
  const action   = url.searchParams.get('action') || undefined;
  const entity   = url.searchParams.get('entity') || undefined;
  const dateFrom = url.searchParams.get('dateFrom') || undefined;
  const dateTo   = url.searchParams.get('dateTo') || undefined;
  const page     = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize')) || 50));

  const where: Prisma.AuditLogWhereInput = {
    ...(adminId  && { performedBy: adminId }),
    ...(action   && { action }),
    ...(entity   && { entity }),
    ...(dateFrom && dateTo && { performedAt: { gte: new Date(dateFrom), lte: new Date(dateTo) } }),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { admin: { select: { id: true, name: true, email: true } } }
    }),
    prisma.auditLog.count({ where }),
  ]);

  // diff 계산
  const itemsWithDiff = items.map(item => ({
    ...item,
    diff: computeAuditDiff(item.oldValue, item.newValue),
  }));

  return NextResponse.json({
    data: { items: itemsWithDiff, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }
  });
}
```

#### 2.8.2 Audit Diff 계산 의사코드

```typescript
// lib/audit-diff.ts
function computeAuditDiff(oldJson: string | null, newJson: string | null): AuditDiff[] {
  const old = oldJson ? JSON.parse(oldJson) : {};
  const new_ = newJson ? JSON.parse(newJson) : {};
  const allKeys = new Set([...Object.keys(old), ...Object.keys(new_)]);
  const diffs: AuditDiff[] = [];

  for (const key of allKeys) {
    if (JSON.stringify(old[key]) !== JSON.stringify(new_[key])) {
      diffs.push({ field: key, oldValue: old[key] ?? null, newValue: new_[key] ?? null });
    }
  }
  return diffs;
}
```

#### 2.8.3 CSV 내보내기 의사코드

```typescript
// app/api/admin/audit-logs/export/route.ts (GET)
async function handleAuditLogExport(request: NextRequest, ctx: AdminHandlerContext) {
  if (!hasPermission(ctx.admin.role.code, 'audit:export'))
    return errorResponse(403, 'FORBIDDEN', '감사 로그 내보내기 권한이 없습니다.');

  const url = new URL(request.url);
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');

  const where: Prisma.AuditLogWhereInput = {
    ...(dateFrom && dateTo && { performedAt: { gte: new Date(dateFrom), lte: new Date(dateTo) } }),
  };

  const items = await prisma.auditLog.findMany({
    where,
    orderBy: { performedAt: 'desc' },
    include: { admin: { select: { name: true, email: true } } }
  });

  const headers = ['performedAt', 'adminName', 'adminEmail', 'action', 'entity', 'entityId', 'oldValue', 'newValue'];
  const csvRows = items.map(i => [
    i.performedAt.toISOString(),
    csvEscape(i.admin.name),
    csvEscape(i.admin.email),
    i.action,
    i.entity,
    i.entityId,
    csvEscape(i.oldValue ?? ''),
    csvEscape(i.newValue ?? ''),
  ].join(','));
  const csv = [headers.join(','), ...csvRows].join('\n');

  return new NextResponse('\uFEFF' + csv, { // BOM for Excel UTF-8
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit_log_${new Date().toISOString().slice(0, 10)}.csv"`,
    }
  });
}
```

---

## 3. 비즈니스 로직

### 3.1 콘텐츠 버전 관리 알고리즘

관리자가 CMS 콘텐츠를 수정하면 `updatedAt` 필드가 자동으로 갱신되어 버전 역할을 수행한다. 키오스크는 ETag(= hash(max updatedAt))로 변경을 감지한다.

```typescript
// 콘텐츠 버전 관리 흐름:
// 1. 관리자 수정 → prisma.cmsContent.update() → updatedAt 자동 갱신 (@updatedAt)
// 2. 키오스크 폴링 → GET /api/cms/content → ETag = hash(max(updatedAt))
// 3. ETag 불일치 → 200 + 전체 콘텐츠 + 새 ETag
// 4. ETag 일치   → 304 Not Modified (대역폭 절약)

// lib/cms-version.ts
async function getContentVersion(): Promise<{ etag: string; maxUpdatedAt: Date }> {
  // 가장 최근에 수정된 항목의 updatedAt으로 전체 버전 표현
  const latest = await prisma.cmsContent.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true }
  });

  const maxUpdatedAt = latest?.updatedAt ?? new Date(0);
  const etag = `"${hashString(String(maxUpdatedAt.getTime()))}"`;

  return { etag, maxUpdatedAt };
}
```

### 3.2 RBAC 권한 검사 알고리즘

```typescript
// lib/rbac.ts
const PERMISSIONS = {
  'cms:read':          'CMS 콘텐츠 조회',
  'cms:write':         'CMS 콘텐츠 수정',
  'cms:image':         'CMS 이미지 업로드/교체',
  'book:read':         '도서 목록 조회',
  'book:create':       '도서 등록',
  'book:update':       '도서 수정',
  'book:delete':       '도서 삭제',
  'book:import':       '도서 CSV 가져오기',
  'user:read':         '사용자 목록 조회',
  'user:create':       '사용자 등록',
  'user:update':       '사용자 수정',
  'user:deactivate':   '사용자 비활성화',
  'stats:read':        '통계 대시보드 조회',
  'stats:export':      '통계 CSV 내보내기',
  'admin:read':        '관리자 계정 조회',
  'admin:create':      '관리자 계정 생성',
  'admin:update':      '관리자 계정 수정',
  'admin:deactivate':  '관리자 비활성화',
  'audit:read':        '감사 로그 조회',
  'audit:export':      '감사 로그 내보내기',
  'notice:read':       '공지 조회',
  'notice:write':      '공지 등록·수정·삭제',
  'system:backup':     'DB 백업',
  'system:reset':      '시스템 초기화',
} as const;

type PermissionCode = keyof typeof PERMISSIONS;

// 역할별 권한 매핑
const ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  super_admin: Object.keys(PERMISSIONS) as PermissionCode[], // 전체 권한
  admin: [
    'cms:read', 'cms:write', 'cms:image',
    'book:read', 'book:create', 'book:update', 'book:delete', 'book:import',
    'user:read', 'user:create', 'user:update', 'user:deactivate',
    'stats:read', 'stats:export',
    'audit:read',
    'notice:read', 'notice:write',
  ],
  operator: [
    'cms:read', 'book:read', 'user:read', 'stats:read', 'notice:read',
  ],
};

// 권한 검사
function hasPermission(role: string, required: PermissionCode): boolean {
  return ROLE_PERMISSIONS[role]?.includes(required) ?? false;
}

// 다중 권한 (하나라도 만족)
function hasAnyPermission(role: string, required: PermissionCode[]): boolean {
  return required.some(p => hasPermission(role, p));
}

// 다중 권한 (모두 만족)
function hasAllPermissions(role: string, required: PermissionCode[]): boolean {
  return required.every(p => hasPermission(role, p));
}

// 역할 계층
const ROLE_HIERARCHY = ['super_admin', 'admin', 'operator'] as const;

function getRoleLevel(role: string): number {
  const idx = ROLE_HIERARCHY.indexOf(role as any);
  return idx === -1 ? Infinity : idx; // 낮을수록 높은 권한
}

function canManageRole(actorRole: string, targetRole: string): boolean {
  return getRoleLevel(actorRole) < getRoleLevel(targetRole);
}
```

### 3.3 통계 집계 쿼리 패턴

```typescript
// 공통 집계 유틸리티
// lib/stats-utils.ts

// 일별 집계 범위 생성 (빈 날짜도 포함 — 차트 간격 유지)
function generateDateRange(from: Date, to: Date): string[] {
  const dates: string[] = [];
  const current = new Date(from);
  while (current <= to) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// 집계 결과를 날짜 범위에 머지 (빈 날짜는 0으로 채움)
function mergeWithDateRange<T extends { date: string }>(
  data: T[],
  dateRange: string[],
  defaultValue: Omit<T, 'date'>
): T[] {
  const dataMap = new Map(data.map(d => [d.date, d]));
  return dateRange.map(date => dataMap.get(date) ?? { date, ...defaultValue } as T);
}

// 페이지네이션 파라미터 파싱
function parsePagination(url: URL): { page: number; pageSize: number; skip: number } {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 50));
  return { page, pageSize, skip: (page - 1) * pageSize };
}
```

### 3.4 감사 로그 생성 패턴

모든 관리자 쓰기 작업은 `writeAuditLog()`를 호출하여 AuditLog 테이블에 기록한다.

```typescript
// lib/audit.ts
interface AuditLogInput {
  action:       'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED';
  entity:       'CmsContent' | 'CmsImage' | 'Book' | 'LibraryUser' | 'AdminUser' | 'Notice' | 'SystemSetting';
  entityId:     string;
  oldValue?:    string | null;  // JSON 직렬화된 이전 상태
  newValue?:    string | null;  // JSON 직렬화된 새 상태
  performedBy:  string;         // AdminUser.id
}

async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      performedBy: input.performedBy,
    }
  });
}

// 보존 정책: 90일 이전 로그 자동 삭제
const AUDIT_RETENTION_DAYS = 90;

async function purgeOldAuditLogs(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - AUDIT_RETENTION_DAYS);
  const result = await prisma.auditLog.deleteMany({ where: { performedAt: { lt: cutoffDate } } });
  return result.count;
}
```

### 3.5 콘텐츠 동기화 알림 패턴

관리자가 콘텐츠를 저장하면 DB가 업데이트되고, 키오스크의 다음 폴링 주기(최대 3초)에 변경이 감지되어 UI에 반영된다. 별도의 푸시 알림이나 WebSocket 없이 **ETag 기반 폴링**으로 실시간 동기화를 달성한다.

```typescript
// 콘텐츠 동기화 흐름:
//
//  [관리자 대시보드]                 [서버]                    [키오스크]
//       │                             │                          │
//  PUT /api/admin/cms/[key]           │                          │
//  { value: "새 텍스트" }             │                          │
//       │────────────────────────────▶│                          │
//       │                             │                          │
//       │                    ┌────────┴────────┐                │
//       │                    │ DB 업데이트      │                │
//       │                    │ updatedAt = now  │                │
//       │                    │ AuditLog 기록   │                │
//       │                    └────────┬────────┘                │
//       │                             │                          │
//       │  200 OK { data: updated }   │                          │
//       │◀────────────────────────────│                          │
//       │                             │                          │
//       │                             │    GET /api/cms/content  │
//       │                             │    If-None-Match: "old"  │
//       │                             │◀─────────────────────────│
//       │                             │                          │
//       │                    ┌────────┴────────┐                │
//       │                    │ ETag 재계산      │                │
//       │                    │ "old" ≠ "new"   │                │
//       │                    └────────┬────────┘                │
//       │                             │                          │
//       │                             │  200 + 전체 콘텐츠       │
//       │                             │  + ETag: "new"          │
//       │                             │─────────────────────────▶│
//       │                             │                          │
//       │                             │                ┌────────┴────────┐
//       │                             │                │ Zustand Store   │
//       │                             │                │ 갱신 → UI 리렌더│
//       │                             │                └─────────────────┘
```

---

## 4. 실시간 동기화 로직

### 4.1 키오스크 폴링 아키텍처

```
┌────────────────────────────────────────────────────────────────┐
│                    Kiosk Frontend                              │
│                                                                │
│  useCmsContent('idle.title_text', '스마트 도서관')             │
│     │                                                          │
│     ▼                                                          │
│  ┌──────────────────────┐                                     │
│  │ Zustand Store        │                                     │
│  │  cmsContent: Map     │                                     │
│  │  lastUpdatedAt: Date │                                     │
│  │  etag: string        │                                     │
│  └──────┬───────────────┘                                     │
│         │ 구독                                                │
│         ▼                                                     │
│  ┌──────────────────────┐                                     │
│  │ useEffect + setInterval│                                    │
│  │  3초마다 fetch         │                                    │
│  │  GET /api/cms/content  │                                    │
│  │  If-None-Match: {etag} │                                    │
│  └──────┬───────────────┘                                     │
│         │                                                      │
└─────────┼──────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────┐
│                    Server                                     │
│                                                               │
│  GET /api/cms/content                                        │
│     │                                                         │
│     ├── ETag 일치 → 304 Not Modified                         │
│     │                                                         │
│     └── ETag 불일치 → 200 + 전체 콘텐츠 + 새 ETag           │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 4.2 서버 측 공개 CMS API 의사코드

```typescript
// app/api/cms/content/route.ts (GET)
// 인증 불필요 — 키오스크에서 호출
async function handleKioskContent(request: NextRequest): Promise<NextResponse> {
  const items = await prisma.cmsContent.findMany({ orderBy: { key: 'asc' } });

  // ETag 생성 (max updatedAt의 해시)
  const maxUpdatedAt = Math.max(...items.map(i => i.updatedAt.getTime()));
  const etag = `"${hashString(String(maxUpdatedAt))}"`;

  // 조건부 요청
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  // Map 형태로 변환 (키오스크에서 빠르게 조회)
  const contentMap = items.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {} as Record<string, string>);

  return NextResponse.json(
    { data: { items, map: contentMap, updatedAt: new Date(maxUpdatedAt).toISOString() } },
    { headers: { ETag: etag, 'Cache-Control': 'max-age=3' } }
  );
}
```

### 4.3 클라이언트 측 Zustand Store + 폴링 의사코드

```typescript
// store/cms-store.ts
interface CmsState {
  content: Record<string, string>;
  lastUpdatedAt: string | null;
  etag: string | null;
  isLoading: boolean;
  error: Error | null;
  setContent: (data: Record<string, string>, etag: string, updatedAt: string) => void;
  fetchContent: () => Promise<void>;
}

export const useCmsStore = create<CmsState>((set, get) => ({
  content: {},
  lastUpdatedAt: null,
  etag: null,
  isLoading: false,
  error: null,

  setContent: (data, etag, updatedAt) => set({ content: data, etag, lastUpdatedAt: updatedAt, isLoading: false, error: null }),

  fetchContent: async () => {
    const { etag } = get();
    set({ isLoading: true });
    try {
      const headers: Record<string, string> = {};
      if (etag) headers['If-None-Match'] = etag;
      const response = await fetch('/api/cms/content', { headers });

      if (response.status === 304) { set({ isLoading: false }); return; }
      if (!response.ok) throw new Error(`CMS API 실패: ${response.status}`);

      const { data } = await response.json();
      const newEtag = response.headers.get('ETag');
      set({ content: data.map, etag: newEtag, lastUpdatedAt: data.updatedAt, isLoading: false, error: null });
    } catch (error) {
      set({ isLoading: false, error: error as Error });
      // 그레이스풀 폴백: 기존 캐시 유지, 없으면 defaults로 초기화
      const { content } = get();
      if (Object.keys(content).length === 0) {
        const defaults: Record<string, string> = {};
        for (const [key, def] of Object.entries(CMS_DEFAULTS)) { defaults[key] = def.value; }
        set({ content: defaults });
      }
    }
  },
}));
```

### 4.4 폴링 훅 의사코드

```typescript
// hooks/use-cms-polling.ts
export function useCmsPolling(intervalMs: number = 3000) {
  const fetchContent = useCmsStore(s => s.fetchContent);
  useEffect(() => {
    fetchContent(); // 최초 1회
    const timer = setInterval(fetchContent, intervalMs);
    return () => clearInterval(timer);
  }, [fetchContent, intervalMs]);
}
```

### 4.5 TanStack Query 무효화 전략

관리자 대시보드에서는 TanStack Query를 사용하여 서버 상태를 관리한다. 쓰기 작업 성공 시 관련 쿼리키를 무효화하여 목록을 자동 갱신한다.

```typescript
// lib/admin-query-keys.ts
export const adminQueryKeys = {
  // CMS
  cmsAll:        ['admin', 'cms'] as const,
  cmsGrouped:    ['admin', 'cms', 'grouped'] as const,
  // 도서
  booksAll:      ['admin', 'books'] as const,
  booksList:     (filters: BookFilters) => ['admin', 'books', 'list', filters] as const,
  bookDetail:    (id: string) => ['admin', 'books', 'detail', id] as const,
  // 사용자
  usersAll:      ['admin', 'users'] as const,
  usersList:     (filters: UserFilters) => ['admin', 'users', 'list', filters] as const,
  // 관리자
  adminsAll:     ['admin', 'admins'] as const,
  // 통계
  statsDashboard: ['admin', 'stats', 'dashboard'] as const,
  statsTrend:    (range: DateRange) => ['admin', 'stats', 'trend', range] as const,
  // 감사 로그
  auditLogs:     (filters: AuditFilters) => ['admin', 'audit-logs', filters] as const,
  // 설정
  settings:      ['admin', 'settings'] as const,
};

// 사용 예: 도서 생성 후 목록 무효화
async function onCreateBook(input: BookCreateInput) {
  await adminFetch('/api/admin/books', { method: 'POST', body: JSON.stringify(input) });
  // 도서 목록 + 통계 대시보드 무효화
  queryClient.invalidateQueries({ queryKey: adminQueryKeys.booksAll });
  queryClient.invalidateQueries({ queryKey: adminQueryKeys.statsDashboard });
}

// 사용 예: CMS 콘텐츠 수정 후 CMS 쿼리 무효화
async function onUpdateCms(key: string, value: string) {
  await adminFetch(`/api/admin/cms/${key}`, { method: 'PUT', body: JSON.stringify({ value }) });
  queryClient.invalidateQueries({ queryKey: adminQueryKeys.cmsAll });
}
```

### 4.6 그레이스풀 폴백 (Graceful Fallback)

```
┌─────────────────────────────────────────────────────┐
│              콘텐츠 해결 우선순위                     │
│                                                      │
│  1. DB 값 (CmsContent.value)          ← 최우선      │
│  2. constants.ts 기본값               ← DB 누락 시  │
│  3. useCmsContent(key, default) 인자  ← 상수도 없을 시│
│  4. 빈 문자열 ''                      ← 최종 폴백   │
│                                                      │
│  API 실패 시:                                        │
│  • 이미 캐시된 content 유지                          │
│  • 캐시도 없으면 constants.ts 기본값으로 초기화       │
│  • 화면 깨짐 없이 동작 보장                          │
└─────────────────────────────────────────────────────┘
```

```typescript
// lib/cms-defaults.ts
export const CMS_DEFAULTS: Record<string, { type: string; value: string }> = {
  'idle.logo_image':           { type: 'image',  value: '/images/default-logo.svg' },
  'idle.title_text':           { type: 'text',   value: '스마트 도서관' },
  'idle.subtitle_text':        { type: 'text',   value: '도서 대출·반납 키오스크' },
  'idle.bg_color':             { type: 'color',  value: '#1E3A5F' },
  'idle.touch_prompt':         { type: 'text',   value: '화면을 터치하세요' },
  'menu.borrow_button_text':   { type: 'text',   value: '대출' },
  'menu.borrow_button_color':  { type: 'color',  value: '#2563EB' },
  'menu.return_button_text':   { type: 'text',   value: '반납' },
  'menu.return_button_color':  { type: 'color',  value: '#16A34A' },
  'rules.max_borrow_count':    { type: 'number', value: '5' },
  'rules.borrow_period_days':  { type: 'number', value: '14' },
  'rules.overdue_penalty_multiplier': { type: 'number', value: '1.0' },
  'rules.overdue_enabled':     { type: 'boolean', value: 'true' },
  // ... 전체 항목은 PRD 3절 참조
};

export function getCmsValueWithDefault(key: string, dbValue?: string | null): string {
  if (dbValue != null && dbValue !== '') return dbValue;
  return CMS_DEFAULTS[key]?.value ?? '';
}
```

---

## 5. 초기화 로직

### 5.1 전체 시드 플로우

```
Application Start (Next.js build / dev)
     │
     ▼
┌──────────────────────┐
│ prisma db push       │
│ (스키마 → SQLite 동기화)│
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│ seed() 호출           │
│ prisma/seed.ts       │
└────┬─────────────────┘
     │
     ├──▶ 5.2 AdminRole + Permission 시드
     ├──▶ 5.3 super_admin 계정 시드
     ├──▶ 5.4 CMS 콘텐츠 시드
     ├──▶ 5.5 SystemSetting 시드
     └──▶ 5.6 샘플 데이터 시드 (개발 모드)
```

### 5.2 AdminRole + Permission 시드

```typescript
// prisma/seed.ts
async function seedAdminRoles() {
  // 권한 시드 (upsert)
  const permissionRecords = [];
  for (const [code, description] of Object.entries(PERMISSIONS)) {
    permissionRecords.push(
      prisma.adminPermission.upsert({
        where: { code },
        update: { description },
        create: { code, description },
      })
    );
  }
  await Promise.all(permissionRecords);

  // 역할 시드 (upsert + 권한 연결)
  for (const [code, label] of [
    ['super_admin', '슈퍼 관리자'],
    ['admin', '관리자'],
    ['operator', '운영자'],
  ] as const) {
    const rolePermissionCodes = ROLE_PERMISSIONS[code];
    await prisma.adminRole.upsert({
      where: { code },
      update: { label },
      create: {
        code, label,
        permissions: { connect: rolePermissionCodes.map(pc => ({ code: pc })) }
      }
    });
  }

  console.log('✅ AdminRole + Permission 시드 완료');
}
```

### 5.3 기본 관리자 계정 시드

```typescript
async function seedSuperAdmin() {
  const email = process.env.ADMIN_SEED_EMAIL ?? 'admin@library.kr';
  const password = process.env.ADMIN_SEED_PASSWORD ?? 'admin123!';

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`⚠️  super_admin 계정이 이미 존재합니다: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.adminUser.create({
    data: {
      email, passwordHash,
      name: '슈퍼 관리자',
      role: { connect: { code: 'super_admin' } },
      isActive: true,
    }
  });

  console.log(`✅ super_admin 계정 생성: ${email} / ${password}`);
}
```

### 5.4 기본 콘텐츠 항목 시드

```typescript
async function seedCmsContent() {
  let created = 0, skipped = 0;

  for (const [key, def] of Object.entries(CMS_DEFAULTS)) {
    const existing = await prisma.cmsContent.findUnique({ where: { key } });
    if (existing) { skipped++; continue; }

    await prisma.cmsContent.create({
      data: { key, type: def.type, value: def.value, updatedBy: 'system' }
    });
    created++;
  }

  console.log(`✅ CMS 콘텐츠 시드: ${created}건 생성, ${skipped}건 스킵`);
}
```

### 5.5 SystemSetting 시드

```typescript
async function seedSystemSettings() {
  const defaults = [
    { key: 'borrow.max_count',           value: '5',     type: 'number' },
    { key: 'borrow.period_days',         value: '14',    type: 'number' },
    { key: 'borrow.overdue_multiplier',  value: '1.0',   type: 'number' },
    { key: 'borrow.overdue_enabled',     value: 'true',  type: 'boolean' },
    { key: 'kiosk.idle_timeout_ms',      value: '30000', type: 'number' },
    { key: 'kiosk.poll_interval_ms',     value: '3000',  type: 'number' },
    { key: 'audit.retention_days',       value: '90',    type: 'number' },
    { key: 'system.max_books',           value: '10000', type: 'number' },
    { key: 'system.max_users',           value: '5000',  type: 'number' },
    { key: 'system.max_image_total_mb',  value: '500',   type: 'number' },
  ];

  for (const setting of defaults) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('✅ SystemSetting 시드 완료');
}
```

### 5.6 메인 시드 함수

```typescript
// prisma/seed.ts
async function main() {
  console.log('🌱 시드 시작...\n');

  await seedAdminRoles();
  await seedSuperAdmin();
  await seedCmsContent();
  await seedSystemSettings();

  if (process.env.NODE_ENV === 'development') {
    await seedSampleData(); // 개발용 샘플 도서·사용자
  }

  console.log('\n🎉 시드 완료!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 5.7 세션 복원 (페이지 새로고침 시)

관리자가 페이지를 새로고침하면, 클라이언트는 httpOnly 쿠키에 저장된 JWT를 자동으로 전송하여 세션을 복원한다.

```typescript
// app/admin/layout.tsx (Server Component)
async function AdminLayout({ children }) {
  // 미들웨어에서 x-admin-id 헤더가 주입됨
  // 클라이언트 컴포넌트에서는 GET /api/admin/auth/me 호출로 세션 복원
  return (
    <AdminLayoutClient>
      {children}
    </AdminLayoutClient>
  );
}

// 클라이언트 측 세션 복원
// hooks/use-admin-session.ts
export function useAdminSession() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'session'],
    queryFn: () => adminFetch<{ user: AdminUser; role: string; permissions: string[] }>('/api/admin/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5분
  });

  return {
    user: data?.user ?? null,
    role: data?.role ?? null,
    permissions: data?.permissions ?? [],
    isLoading,
    isAuthenticated: !!data && !error,
  };
}
```

---

## 6. 오류 처리 로직

### 6.1 인증 오류

| 시나리오 | HTTP | Code | 백엔드 처리 | 클라이언트 처리 |
|----------|------|------|-------------|----------------|
| 토큰 누락 | 401 | `UNAUTHORIZED` | 미들웨어에서 차단 | `/admin/login` 리다이렉트 |
| 액세스 토큰 만료 | 401 | `TOKEN_EXPIRED` | 미들웨어에서 감지 | 자동 refresh → 재시도 |
| 리프레시 토큰 무효 | 401 | `INVALID_REFRESH_TOKEN` | DB 해시 불일치 → 토큰 무효화 | 강제 로그아웃 |
| 리프레시 토큰 재사용 | 401 | `TOKEN_REUSED` | 의심스러운 재사용 → 모든 토큰 무효화 | 강제 로그아웃 |
| 계정 잠금 | 401 | `ACCOUNT_LOCKED` | 5회 연속 실패 → 15분 잠금 | "계정이 잠겼습니다" 안내 |
| 비활성화된 계정 | 401 | `UNAUTHORIZED` | isActive = false | "비활성화된 계정입니다" |
| 권한 부족 | 403 | `FORBIDDEN` | RBAC 검사 실패 | "접근 권한이 없습니다" 토스트 |

#### 6.1.1 토큰 갱신 인터셉터 의사코드

```typescript
// lib/admin-fetch.ts
let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

async function adminFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, credentials: 'include' });

  // 401 + TOKEN_EXPIRED → 자동 갱신
  if (response.status === 401) {
    const body = await response.json();
    if (body.error?.code === 'TOKEN_EXPIRED') {
      if (isRefreshing) {
        await new Promise<void>(resolve => pendingRequests.push(resolve));
        return adminFetch<T>(url, options); // 재시도
      }

      isRefreshing = true;
      try {
        const refreshRes = await fetch('/api/admin/auth/refresh', { method: 'POST', credentials: 'include' });
        if (!refreshRes.ok) {
          window.location.href = '/admin/login'; // 강제 로그아웃
          throw new Error('세션이 만료되었습니다.');
        }
        pendingRequests.forEach(resolve => resolve());
        pendingRequests = [];
        return adminFetch<T>(url, options); // 재시도
      } finally {
        isRefreshing = false;
      }
    }
  }

  if (!response.ok) throw new AdminApiError(response.status, body.error);
  return body.data;
}
```

### 6.2 검증 오류 (Zod)

```typescript
// Zod 에러를 필드별 상세로 변환
function formatZodError(zodError: ZodError): ValidationErrorDetail[] {
  return zodError.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

// 예시 응답:
// {
//   "error": {
//     "code": "VALIDATION_ERROR",
//     "message": "입력값이 유효하지 않습니다.",
//     "details": {
//       "fieldErrors": [
//         { "field": "isbn", "message": "ISBN-13 형식(13자리 숫자)", "code": "invalid_string" },
//         { "field": "title", "message": "도서명은 200자 이내", "code": "too_big" }
//       ]
//     }
//   }
// }
```

### 6.3 API 오류 (네트워크·서버)

| HTTP | Code | 설명 | 발생 조건 |
|------|------|------|-----------|
| 400 | `VALIDATION_ERROR` | 입력값 검증 실패 | Zod 스키마 불일치 |
| 400 | `INVALID_MIME` | 허용되지 않은 MIME 타입 | 이미지 업로드 시 JPG/PNG/SVG 외 |
| 400 | `INVALID_KEYS` | 존재하지 않는 CMS 키 | batch update 시 누락 키 |
| 400 | `MIME_MISMATCH` | MIME 위조 | magic byte 불일치 |
| 400 | `INVALID_FORMAT` | 잘못된 파일 형식 | CSV import 시 비CSV 파일 |
| 404 | `NOT_FOUND` | 리소스 없음 | findUnique null |
| 409 | `ISBN_DUPLICATE` | ISBN 중복 | Book.isbn unique 제약 |
| 409 | `RFID_DUPLICATE` | RFID 중복 | LibraryUser.rfid unique 제약 |
| 409 | `EMAIL_DUPLICATE` | 이메일 중복 | AdminUser.email unique 제약 |
| 409 | `ACTIVE_LOAN` | 활성 대출 존재 | 삭제/비활성화 시 대출 중 |
| 409 | `CONCURRENT_UPDATE` | 동시 수정 충돌 | updatedAt 불일치 |
| 409 | `ALREADY_WITHDRAWN` | 이미 탈퇴 | 중복 비활성화 |
| 429 | `RATE_LIMITED` | 요청 한도 초과 | rate limit 초과 |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 | 예기치 않은 예외 |

#### 6.3.1 공통 에러 응답 형식

```typescript
// lib/api-error.ts
interface AdminApiErrorBody {
  error: {
    code: string;            // 기계 판독용 에러 코드
    message: string;         // 사람이 읽을 수 있는 한국어 메시지
    details?: unknown;       // 추가 정보 (검증 에러 필드 목록 등)
  };
}

function errorResponse(status: number, code: string, message: string, details?: unknown): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details && { details }) } },
    { status }
  );
}
```

### 6.4 업로드 오류

| 시나리오 | HTTP | Code | 처리 |
|----------|------|------|------|
| MIME 타입 불일치 | 400 | `INVALID_MIME` | 클라이언트 + 서버 양쪽 검증 |
| 파일 크기 초과 (2MB) | 400 | `FILE_TOO_LARGE` | 클라이언트 선검증 + 서버 재검증 |
| Magic byte 위조 | 400 | `MIME_MISMATCH` | 서버에서만 검증 (보안) |
| SVG XSS 공격 | 400 | `INVALID_MIME` | DOMPurify/sanitize-svg 처리 |
| CSV 형식 오류 | 400 | `INVALID_FORMAT` | 행별 파싱 오류 수집 |
| 디스크 쓰기 실패 | 500 | `INTERNAL_ERROR` | try/catch + 로깅 |

### 6.5 권한 거부 처리

```typescript
// 클라이언트 측 권한 에러 처리
export function handlePermissionDenied(error: AdminApiError) {
  if (error.code === 'FORBIDDEN') {
    toast.error('접근 권한이 없습니다.', { description: '해당 작업에 필요한 권한이 부여되지 않았습니다.' });
    return { readOnly: true };
  }
  if (error.code === 'SELF_MODIFICATION' || error.code === 'SELF_DEACTIVATE') {
    toast.error('자신의 계정은 수정할 수 없습니다.');
    return {};
  }
  if (error.code === 'LAST_SUPER_ADMIN') {
    toast.error('마지막 슈퍼 관리자 계정은 비활성화할 수 없습니다.');
    return {};
  }
  if (error.code === 'ROLE_HIERARCHY') {
    toast.error('자신보다 높거나 같은 권한의 계정은 수정할 수 없습니다.');
    return {};
  }
}
```

### 6.6 동시 수정 충돌 처리 (Optimistic Concurrency Control)

```typescript
// lib/concurrent-update.ts
async function handleConcurrentUpdate(key: string, input: { value: string; expectedUpdatedAt: string }, ctx: AdminHandlerContext) {
  const existing = await prisma.cmsContent.findUnique({ where: { key } });
  if (!existing) return errorResponse(404, 'NOT_FOUND', '항목을 찾을 수 없습니다.');

  // 동시 수정 충돌 감지
  if (existing.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    return NextResponse.json({
      error: {
        code: 'CONCURRENT_UPDATE',
        message: '다른 관리자가 이 항목을 수정했습니다. 최신 내용을 확인 후 다시 시도하세요.',
        details: {
          currentUpdatedAt: existing.updatedAt.toISOString(),
          expectedUpdatedAt: input.expectedUpdatedAt,
          currentValue: existing.value,
        }
      }
    }, { status: 409 });
  }

  // 충돌 없음 → 업데이트
  const updated = await prisma.cmsContent.update({
    where: { key },
    data: { value: input.value, updatedBy: ctx.admin.id }
  });

  await writeAuditLog({
    action: 'UPDATE', entity: 'CmsContent', entityId: updated.id,
    oldValue: JSON.stringify({ key, value: existing.value }),
    newValue: JSON.stringify({ key, value: updated.value }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: updated });
}
```

### 6.7 글로벌 에러 바운더리

```typescript
// app/admin/error.tsx
'use client';
export default function AdminErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[Admin ErrorBoundary]', error);
    // 프로덕션: Sentry 등 외부 모니터링 전송
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-bold text-red-600">오류가 발생했습니다</h2>
        <p className="mt-2 text-gray-600">{error.message}</p>
        <button onClick={reset} className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">다시 시도</button>
      </div>
    </div>
  );
}
```

### 6.8 API 에러 로깅 (서버 측)

```typescript
// lib/api-logger.ts
export function logApiError(request: NextRequest, error: unknown, context?: Record<string, unknown>) {
  const isOperational = error instanceof AdminOperationalError;

  const logEntry = {
    timestamp: new Date().toISOString(),
    level: isOperational ? 'warn' : 'error',
    method: request.method,
    path: request.nextUrl.pathname,
    error: {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    context,
  };

  if (isOperational) {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.error(JSON.stringify(logEntry));
    // 비운영적 에러 → 외부 모니터링 전송 (Sentry 등)
  }
}
```

---

> **변경 이력**

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| v1.0.0 | 2026-03-05 | 최초 작성 | Backend Team |
