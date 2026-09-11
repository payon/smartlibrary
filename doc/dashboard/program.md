# 관리자 대시보드 프로그램 로직 문서

> **버전**: v1.0.0  
> **작성일**: 2026-03-05  
> **상태**: Production-ready  
> **담당**: Dashboard Backend Team  
> **참조**: [PRD](./prd.md) · [API 명세](./api.md) · [DB 설계](./database.md) · [아키텍처](./architect.md) · [키오스크 프로그램 로직](../program.md)

---

## 목차

1. [프로그램 흐름 개요](#1-프로그램-흐름-개요)
2. [관리자 인증 로직](#2-관리자-인증-로직)
3. [CMS 콘텐츠 관리 로직](#3-cms-콘텐츠-관리-로직)
4. [도서 관리 로직](#4-도서-관리-로직)
5. [사용자 관리 로직](#5-사용자-관리-로직)
6. [권한 관리 (RBAC) 로직](#6-권한-관리-rbac-로직)
7. [실시간 동기화 로직](#7-실시간-동기화-로직)
8. [감사 로그 로직](#8-감사-로그-로직)
9. [통계 대시보드 로직](#9-통계-대시보드-로직)
10. [초기화 로직](#10-초기화-로직)
11. [오류 처리 로직](#11-오류-처리-로직)

---

## 1. 프로그램 흐름 개요

### 1.1 전체 관리자 대시보드 플로우 다이어그램

```
┌──────────┐
│  START   │
└────┬─────┘
     │
     ▼
┌──────────┐  인증 실패   ┌──────────┐
│LOGIN PAGE│─────────────▶│에러 표시 │
└────┬─────┘              └──────────┘
     │ 인증 성공
     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      AdminLayout (인증된 세션)                       │
│  ┌──────────┐  ┌─────────────────────────────────────────────────┐  │
│  │ Sidebar  │  │  Main Content Area                              │  │
│  │          │  │                                                 │  │
│  │ 대시보드 │──▶│  오늘현황 + 시간대그래프 + 인기도서 + 최근활동   │  │
│  │ CMS관리  │──▶│  화면별 콘텐츠 편집 폼 (text/color/image/rule) │  │
│  │ 도서관리 │──▶│  Book 테이블 + CRUD + 이미지업로드 + CSV가져오기 │  │
│  │ 사용자   │──▶│  LibraryUser 테이블 + CRUD + PIN관리            │  │
│  │ 관리자   │──▶│  AdminUser 테이블 + 역할관리 (super_admin only) │  │
│  │ 감사로그 │──▶│  AuditLog 테이블 + 필터 + 날짜범위 + 내보내기   │  │
│  │ 공지관리 │──▶│  Notice CRUD + 시작/종료일시 + 우선순위          │  │
│  │ 설정     │──▶│  SystemSetting + DB백업 + 초기화                │  │
│  └──────────┘  └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
     │ 로그아웃
     ▼
┌──────────┐
│LOGIN PAGE│
└──────────┘
```

### 1.2 요청 처리 공통 플로우

모든 `/api/admin/*` 요청은 아래 공통 파이프라인을 거친다:

```
Client Request
     │
     ▼
┌─────────────────┐
│ 1. JWT Verify   │──── 무효 ────▶ 401 Unauthorized
└────┬────────────┘
     │ 유효
     ▼
┌─────────────────┐
│ 2. Role Extract │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ 3. Permission   │──── 거부 ────▶ 403 Forbidden
│    Check (RBAC) │
└────┬────────────┘
     │ 허용
     ▼
┌─────────────────┐
│ 4. Input Validate│──── 실패 ───▶ 400 Bad Request (Zod Error)
│    (Zod Schema) │
└────┬────────────┘
     │ 유효
     ▼
┌─────────────────┐
│ 5. Business     │
│    Logic        │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ 6. Audit Log    │  (쓰기 작업만)
│    Write        │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ 7. JSON Response│
└─────────────────┘
```

### 1.3 공통 의사코드 (TypeScript)

```typescript
// lib/admin-handler.ts
type AdminHandlerContext = {
  admin: AdminUser;          // JWT에서 추출한 관리자 정보
  permissions: string[];     // 역할에서 전개한 권한 목록
};

type AdminHandler<TInput, TOutput> = (
  ctx: AdminHandlerContext,
  input: TInput
) => Promise<TOutput>;

async function adminApiHandler<TInput, TOutput>(
  request: NextRequest,
  config: {
    requiredPermission: string;
    validateSchema: ZodSchema<TInput>;
    handler: AdminHandler<TInput, TOutput>;
    auditAction?: string;
    auditEntity?: string;
  }
): Promise<NextResponse> {
  // Step 1: JWT 검증
  const token = request.cookies.get('admin_access_token')?.value;
  if (!token) return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: '토큰이 없습니다.' } },
    { status: 401 }
  );

  const payload = verifyJwt(token);
  if (!payload) return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: '토큰이 만료되거나 무효합니다.' } },
    { status: 401 }
  );

  // Step 2: 관리자 조회 + 역할 추출
  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.sub },
    include: { role: { include: { permissions: true } } }
  });
  if (!admin || !admin.isActive) return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: '비활성화된 계정입니다.' } },
    { status: 401 }
  );

  // Step 3: RBAC 권한 검사
  const permissions = admin.role.permissions.map(p => p.code);
  if (!permissions.includes(config.requiredPermission)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '권한이 부족합니다.' } },
      { status: 403 }
    );
  }

  // Step 4: 입력 검증 (Zod)
  const body = await request.json();
  const parsed = config.validateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(
    { error: { code: 'VALIDATION_ERROR', message: '입력값이 유효하지 않습니다.', details: parsed.error.flatten() } },
    { status: 400 }
  );

  // Step 5: 비즈니스 로직 실행
  const ctx: AdminHandlerContext = { admin, permissions };
  const result = await config.handler(ctx, parsed.data);

  // Step 6: 감사 로그 (쓰기 작업만)
  if (config.auditAction) {
    await writeAuditLog({
      action: config.auditAction,
      entity: config.auditEntity ?? 'Unknown',
      entityId: result.id,
      oldValue: result.oldValue ?? null,
      newValue: result.newValue ?? null,
      performedBy: admin.id,
    });
  }

  // Step 7: 응답
  return NextResponse.json({ data: result.data }, { status: result.status ?? 200 });
}
```

---

## 2. 관리자 인증 로직

### 2.1 로그인 플로우

```
Client                              Server
  │                                   │
  │  POST /api/admin/auth/login       │
  │  { email, password }              │
  │──────────────────────────────────▶│
  │                                   │
  │                          ┌────────┴────────┐
  │                          │ 1. 이메일로      │
  │                          │    AdminUser     │
  │                          │    조회          │
  │                          └────────┬────────┘
  │                                   │
  │                          ┌────────┴────────┐
  │                          │ 2. 계정 존재?    │
  │                          │    isActive?     │
  │                          │    잠금 상태?    │
  │                          └────────┬────────┘
  │                          No/비활성/잠금     │
  │                          ──────────────────▶ 401 (동일 메시지로 정보 노출 방지)
  │                                   │ Yes
  │                          ┌────────┴────────┐
  │                          │ 3. bcrypt compare│
  │                          │    (password,   │
  │                          │     passwordHash)│
  │                          └────────┬────────┘
  │                          불일치             │
  │                          ──────────────────▶ loginFailCount++ → 5회 초과 시 15분 잠금 → 401
  │                                   │ 일치
  │                          ┌────────┴────────┐
  │                          │ 4. JWT 생성      │
  │                          │   access: 15분   │
  │                          │   refresh: 7일   │
  │                          └────────┬────────┘
  │                                   │
  │                          ┌────────┴────────┐
  │                          │ 5. httpOnly      │
  │                          │    쿠키 설정     │
  │                          └────────┬────────┘
  │                                   │
  │  Set-Cookie: admin_access_token   │
  │  Set-Cookie: admin_refresh_token  │
  │  { user, role, permissions }      │
  │◀──────────────────────────────────│
  │                                   │
```

#### 2.1.1 로그인 의사코드

```typescript
// app/api/admin/auth/login/route.ts
async function handleLogin(request: NextRequest): Promise<NextResponse> {
  const { email, password } = LoginSchema.parse(await request.json());

  // 1. 이메일로 관리자 조회
  const admin = await prisma.adminUser.findUnique({
    where: { email },
    include: { role: true }
  });

  // 2. 계정 존재 + 활성 + 잠금 상태 확인
  const LOGIN_FAIL_MESSAGE = '이메일 또는 비밀번호가 일치하지 않습니다.';
  if (!admin || !admin.isActive) {
    return errorResponse(401, 'AUTH_FAILED', LOGIN_FAIL_MESSAGE);
  }

  // 잠금 확인 (5회 연속 실패 → 15분 잠금)
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    return errorResponse(401, 'ACCOUNT_LOCKED', '계정이 잠겼습니다. 잠시 후 다시 시도하세요.');
  }

  // 3. bcrypt 비밀번호 비교
  const isMatch = await bcrypt.compare(password, admin.passwordHash);
  if (!isMatch) {
    // 실패 횟수 증가
    const newFailCount = admin.loginFailCount + 1;
    const lockUpdate = newFailCount >= 5
      ? { loginFailCount: newFailCount, lockedUntil: addMinutes(new Date(), 15) }
      : { loginFailCount: newFailCount };

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: lockUpdate
    });

    await writeAuditLog({
      action: 'LOGIN_FAILED',
      entity: 'AdminUser',
      entityId: admin.id,
      performedBy: admin.id,
    });

    return errorResponse(401, 'AUTH_FAILED', LOGIN_FAIL_MESSAGE);
  }

  // 4. JWT 생성
  const accessToken = signJwt(
    { sub: admin.id, role: admin.role.code, permissions: admin.role.permissions },
    { expiresIn: '15m' }
  );
  const refreshToken = signJwt(
    { sub: admin.id, type: 'refresh' },
    { expiresIn: '7d' }
  );

  // 5. 실패 횟수 초기화 + 마지막 로그인 시간 갱신
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      loginFailCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      refreshTokenHash: hashToken(refreshToken), // refresh token 저장 (순환 검증용)
    }
  });

  // 6. 감사 로그
  await writeAuditLog({
    action: 'LOGIN',
    entity: 'AdminUser',
    entityId: admin.id,
    newValue: { lastLoginAt: new Date().toISOString() },
    performedBy: admin.id,
  });

  // 7. httpOnly 쿠키 설정 + 응답
  const response = NextResponse.json({
    data: {
      user: { id: admin.id, name: admin.name, email: admin.email },
      role: admin.role.code,
      permissions: admin.role.permissions.map(p => p.code),
    }
  });

  response.cookies.set('admin_access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60, // 15분
  });

  response.cookies.set('admin_refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/admin/auth/refresh', // refresh 엔드포인트에서만 전송
    maxAge: 7 * 24 * 60 * 60, // 7일
  });

  return response;
}
```

#### 2.1.2 Zod 검증 스키마

```typescript
const LoginSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력하세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
});
```

### 2.2 세션 검증 미들웨어

모든 `/api/admin/*` 요청에 대해 JWT를 검증하고 관리자 정보를 주입하는 미들웨어.

```typescript
// middleware.ts (Next.js middleware)
export async function middleware(request: NextRequest) {
  // 관리자 API 경로만 처리
  if (!request.nextUrl.pathname.startsWith('/api/admin/')) {
    return NextResponse.next();
  }

  // 로그인·리프레시 엔드포인트는 제외
  if (
    request.nextUrl.pathname === '/api/admin/auth/login' ||
    request.nextUrl.pathname === '/api/admin/auth/refresh'
  ) {
    return NextResponse.next();
  }

  // Step 1: access token 추출
  const accessToken = request.cookies.get('admin_access_token')?.value;
  if (!accessToken) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' } },
      { status: 401 }
    );
  }

  // Step 2: JWT 검증
  const payload = verifyJwt(accessToken);
  if (!payload) {
    return NextResponse.json(
      { error: { code: 'TOKEN_EXPIRED', message: '액세스 토큰이 만료되었습니다.' } },
      { status: 401 }
    );
  }

  // Step 3: 관리자 활성 상태 확인
  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.sub },
    select: { id: true, isActive: true, role: { include: { permissions: true } } }
  });

  if (!admin || !admin.isActive) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: '비활성화된 계정입니다.' } },
      { status: 401 }
    );
  }

  // Step 4: 요청 헤더에 관리자 정보 주입 (다운스트림 핸들러에서 사용)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-admin-id', admin.id);
  requestHeaders.set('x-admin-role', admin.role.code);
  requestHeaders.set('x-admin-permissions', JSON.stringify(admin.role.permissions.map(p => p.code)));

  return NextResponse.next({
    request: { headers: requestHeaders }
  });
}

export const config = {
  matcher: ['/api/admin/:path*'],
};
```

### 2.3 토큰 갱신 (Refresh) 플로우

```
Client                                     Server
  │                                          │
  │  API 호출 → 401 (TOKEN_EXPIRED)          │
  │◀─────────────────────────────────────────│
  │                                          │
  │  POST /api/admin/auth/refresh            │
  │  Cookie: admin_refresh_token=xxx         │
  │────────────────────────────────────────▶ │
  │                                          │
  │                                 ┌────────┴────────┐
  │                                 │ 1. refresh token │
  │                                 │    검증          │
  │                                 └────────┬────────┘
  │                                 무효     │ 유효
  │                                 ─────────▶ 401 → 강제 로그아웃
  │                                          │
  │                                 ┌────────┴────────┐
  │                                 │ 2. DB의 해시와   │
  │                                 │    일치 확인     │
  │                                 │    (순환 방지)   │
  │                                 └────────┬────────┘
  │                                          │
  │                                 ┌────────┴────────┐
  │                                 │ 3. 새 access     │
  │                                 │    token 생성    │
  │                                 │    (15분)        │
  │                                 └────────┬────────┘
  │                                          │
  │  Set-Cookie: admin_access_token (new)    │
  │  { success: true }                       │
  │◀─────────────────────────────────────────│
  │                                          │
  │  원래 API 재시도                         │
  │────────────────────────────────────────▶ │
  │                                          │
```

#### 2.3.1 토큰 갱신 의사코드

```typescript
// app/api/admin/auth/refresh/route.ts
async function handleRefresh(request: NextRequest): Promise<NextResponse> {
  const refreshToken = request.cookies.get('admin_refresh_token')?.value;
  if (!refreshToken) {
    return errorResponse(401, 'NO_REFRESH_TOKEN', '리프레시 토큰이 없습니다.');
  }

  // 1. JWT 검증
  const payload = verifyJwt(refreshToken, { allowExpired: false });
  if (!payload || payload.type !== 'refresh') {
    return errorResponse(401, 'INVALID_REFRESH_TOKEN', '유효하지 않은 리프레시 토큰입니다.');
  }

  // 2. DB에 저장된 해시와 일치 확인 (토큰 재사용 공격 방지)
  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.sub },
    select: { id: true, isActive: true, refreshTokenHash: true, role: true }
  });

  if (!admin || !admin.isActive || admin.refreshTokenHash !== hashToken(refreshToken)) {
    // 의심스러운 재사용 → 모든 토큰 무효화
    await prisma.adminUser.update({
      where: { id: payload.sub },
      data: { refreshTokenHash: null }
    });
    return errorResponse(401, 'TOKEN_REUSED', '토큰이 무효화되었습니다. 다시 로그인하세요.');
  }

  // 3. 새 access token 생성
  const newAccessToken = signJwt(
    { sub: admin.id, role: admin.role.code },
    { expiresIn: '15m' }
  );

  // 4. 쿠키 설정
  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_access_token', newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60,
  });

  return response;
}
```

#### 2.3.2 클라이언트 측 자동 갱신 인터셉터

```typescript
// lib/admin-fetch.ts
let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

async function adminFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, credentials: 'include' });

  // 401 + TOKEN_EXPIRED → 자동 갱신 시도
  if (response.status === 401) {
    const body = await response.json();
    if (body.error?.code === 'TOKEN_EXPIRED') {
      // 이미 갱신 중이면 대기
      if (isRefreshing) {
        await new Promise<void>(resolve => pendingRequests.push(resolve));
        return adminFetch<T>(url, options); // 원래 요청 재시도
      }

      isRefreshing = true;
      try {
        const refreshRes = await fetch('/api/admin/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (!refreshRes.ok) {
          // 갱신 실패 → 강제 로그아웃
          window.location.href = '/admin/login';
          throw new Error('세션이 만료되었습니다.');
        }

        // 대기 중인 요청들 해제
        pendingRequests.forEach(resolve => resolve());
        pendingRequests = [];

        // 원래 요청 재시도
        return adminFetch<T>(url, options);
      } finally {
        isRefreshing = false;
      }
    }
  }

  if (!response.ok) {
    throw new AdminApiError(response.status, body.error);
  }

  return body.data;
}
```

### 2.4 로그아웃 플로우

```typescript
// app/api/admin/auth/logout/route.ts
async function handleLogout(request: NextRequest): Promise<NextResponse> {
  const adminId = request.headers.get('x-admin-id');

  // 1. DB에서 refresh token 무효화
  if (adminId) {
    await prisma.adminUser.update({
      where: { id: adminId },
      data: { refreshTokenHash: null }
    });

    // 2. 감사 로그
    await writeAuditLog({
      action: 'LOGOUT',
      entity: 'AdminUser',
      entityId: adminId,
      performedBy: adminId,
    });
  }

  // 3. 쿠키 삭제
  const response = NextResponse.json({ success: true });
  response.cookies.delete('admin_access_token');
  response.cookies.delete('admin_refresh_token');

  return response;
}
```

---

## 3. CMS 콘텐츠 관리 로직

### 3.1 콘텐츠 조회 (관리자용)

```
GET /api/admin/cms
     │
     ▼
┌────────────────────┐
│ JWT + RBAC 검사    │──── 권한: cms:read
└────┬───────────────┘
     │
     ▼
┌────────────────────┐
│ CmsContent 전체 조회│
│ prisma.cmsContent  │
│   .findMany()      │
│   → key 기준 정렬   │
└────┬───────────────┘
     │
     ▼
┌────────────────────┐
│ 타입별 값 변환      │
│ image → URL + 메타  │
│ color → HEX 검증   │
│ json  → 파싱       │
└────┬───────────────┘
     │
     ▼  { items: CmsContent[] }
```

#### 3.1.1 조회 의사코드

```typescript
// app/api/admin/cms/route.ts
async function handleGetCms(ctx: AdminHandlerContext): Promise<NextResponse> {
  // CmsContent 전체 조회 (key 기준 정렬)
  const items = await prisma.cmsContent.findMany({
    orderBy: { key: 'asc' }
  });

  // 화면별 그룹핑 (프론트엔드 탭 UI용)
  const grouped = items.reduce((acc, item) => {
    const section = item.key.split('.')[0]; // "idle", "menu", "auth" 등
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, CmsContent[]>);

  return NextResponse.json({
    data: { items, grouped, total: items.length }
  });
}
```

### 3.2 단일 콘텐츠 수정

```
PUT /api/admin/cms/[key]
     │
     ▼
┌────────────────────┐
│ JWT + RBAC 검사    │──── 권한: cms:write
└────┬───────────────┘
     │
     ▼
┌────────────────────┐
│ Zod 검증           │
│  key: 유효한 CMS key│
│  value: 타입별 검증 │
│   text → 길이 제한  │
│   color → HEX 정규 │
│   number → 범위    │
│   image → URL 형식 │
└────┬───────────────┘
     │
     ▼
┌────────────────────┐
│ 기존 값 조회 (old) │
│ prisma.cmsContent  │
│   .findUnique()    │
└────┬───────────────┘
     │
     ▼
┌────────────────────┐
│ DB 업데이트        │
│ prisma.cmsContent  │
│   .update()        │
│   updatedAt = now  │
│   updatedBy = admin│
└────┬───────────────┘
     │
     ▼
┌────────────────────┐
│ 감사 로그          │
│ action: UPDATE     │
│ oldValue: 이전값   │
│ newValue: 변경값   │
└────┬───────────────┘
     │
     ▼  { item: CmsContent }
```

#### 3.2.1 수정 의사코드

```typescript
// app/api/admin/cms/[key]/route.ts
const CmsUpdateSchema = z.object({
  value: z.string().min(1, '값은 비어있을 수 없습니다.'),
});

async function handleUpdateCms(
  ctx: AdminHandlerContext,
  key: string,
  input: z.infer<typeof CmsUpdateSchema>
): Promise<NextResponse> {
  // 타입별 값 검증
  const existing = await prisma.cmsContent.findUnique({ where: { key } });
  if (!existing) {
    return errorResponse(404, 'NOT_FOUND', `CMS 항목 '${key}'이(가) 존재하지 않습니다.`);
  }

  // 타입별 추가 검증
  const validatedValue = validateCmsValue(existing.type, input.value);
  //   text   → z.string().max(getMaxLength(key))
  //   color  → /^#[0-9A-Fa-f]{6}$/
  //   number → z.number().min(min).max(max)
  //   boolean→ z.boolean()
  //   image  → URL 형식 + 파일 존재 확인
  //   json   → JSON.parse() 성공 여부

  // 기존 값 저장 (감사 로그용)
  const oldValue = existing.value;

  // DB 업데이트
  const updated = await prisma.cmsContent.update({
    where: { key },
    data: {
      value: String(validatedValue),
      updatedBy: ctx.admin.id,
      // updatedAt은 @updatedAt으로 자동 갱신
    }
  });

  // 감사 로그
  await writeAuditLog({
    action: 'UPDATE',
    entity: 'CmsContent',
    entityId: updated.id,
    oldValue: JSON.stringify({ key, value: oldValue }),
    newValue: JSON.stringify({ key, value: updated.value }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: updated });
}

// 타입별 검증 함수
function validateCmsValue(type: string, value: string): unknown {
  switch (type) {
    case 'text':
      if (value.length > 200) throw new ValidationError('텍스트가 너무 깁니다.');
      return value;
    case 'color':
      if (!/^#[0-9A-Fa-f]{6}$/.test(value)) throw new ValidationError('유효한 HEX 색상이 아닙니다.');
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

### 3.3 일괄 수정 (Batch Update)

```
POST /api/admin/cms/batch
     │
     ▼
┌────────────────────┐
│ JWT + RBAC 검사    │──── 권한: cms:write
└────┬───────────────┘
     │
     ▼
┌────────────────────┐
│ 전체 항목 검증      │
│ for each item:     │
│   key 존재?        │
│   value 타입 검증? │
│ 하나라도 실패 → 400│
└────┬───────────────┘
     │ 모두 유효
     ▼
┌────────────────────┐
│ DB 트랜잭션        │
│ prisma.$transaction│
│  for each item:    │
│   cmsContent.update│
│   + AuditLog.create│
└────┬───────────────┘
     │
     ▼  { updated: number, items: CmsContent[] }
```

#### 3.3.1 일괄 수정 의사코드

```typescript
// app/api/admin/cms/batch/route.ts
const CmsBatchSchema = z.object({
  items: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })).min(1).max(100, '최대 100개 항목까지 일괄 수정 가능합니다.'),
});

async function handleBatchUpdate(
  ctx: AdminHandlerContext,
  input: z.infer<typeof CmsBatchSchema>
): Promise<NextResponse> {
  // 1. 전체 항목 사전 검증
  const existingItems = await prisma.cmsContent.findMany({
    where: { key: { in: input.items.map(i => i.key) } }
  });

  const existingMap = new Map(existingItems.map(i => [i.key, i]));

  // 존재하지 않는 키 확인
  const missingKeys = input.items.filter(i => !existingMap.has(i.key));
  if (missingKeys.length > 0) {
    return errorResponse(400, 'INVALID_KEYS', `존재하지 않는 키: ${missingKeys.map(k => k.key).join(', ')}`);
  }

  // 타입별 값 검증
  for (const item of input.items) {
    const existing = existingMap.get(item.key)!;
    try {
      validateCmsValue(existing.type, item.value);
    } catch (e) {
      return errorResponse(400, 'VALIDATION_ERROR', `키 '${item.key}'의 값이 유효하지 않습니다: ${e.message}`);
    }
  }

  // 2. DB 트랜잭션으로 원자적 업데이트
  const results = await prisma.$transaction(async (tx) => {
    const updated: CmsContent[] = [];

    for (const item of input.items) {
      const existing = existingMap.get(item.key)!;

      // 업데이트
      const result = await tx.cmsContent.update({
        where: { key: item.key },
        data: {
          value: item.value,
          updatedBy: ctx.admin.id,
        }
      });
      updated.push(result);

      // 감사 로그
      await tx.auditLog.create({
        data: {
          action: 'UPDATE',
          entity: 'CmsContent',
          entityId: result.id,
          oldValue: JSON.stringify({ key: item.key, value: existing.value }),
          newValue: JSON.stringify({ key: item.key, value: item.value }),
          performedBy: ctx.admin.id,
        }
      });
    }

    return updated;
  });

  return NextResponse.json({
    data: { updated: results.length, items: results }
  });
}
```

### 3.4 키오스크 콘텐츠 조회 (공개 API)

키오스크 프론트엔드에서 호출하는 인증 불필요 API. **ETag 기반 조건부 요청**으로 대역폭을 최적화한다.

```
GET /api/cms/content
     │
     ▼
┌────────────────────┐
│ If-None-Match 헤더 │
│ 확인 (ETag)        │
└────┬───────────────┘
     │
     ├── ETag 일치 → 304 Not Modified (body 없음)
     │
     ▼ ETag 불일치 (또는 최초 요청)
┌────────────────────┐
│ CmsContent 전체 조회│
│ prisma.cmsContent  │
│   .findMany()      │
└────┬───────────────┘
     │
     ▼
┌────────────────────┐
│ ETag 생성          │
│ hash(max(updatedAt))│
└────┬───────────────┘
     │
     ▼  200 + ETag 헤더 + { items: CmsContent[] }
```

#### 3.4.1 키오스크 콘텐츠 조회 의사코드

```typescript
// app/api/cms/content/route.ts
async function handleKioskContent(request: NextRequest): Promise<NextResponse> {
  // CmsContent 전체 조회
  const items = await prisma.cmsContent.findMany({
    orderBy: { key: 'asc' }
  });

  // ETag 생성 (모든 항목의 updatedAt 중 최대값의 해시)
  const maxUpdatedAt = Math.max(...items.map(i => i.updatedAt.getTime()));
  const etag = `"${hashString(String(maxUpdatedAt))}"`;

  // 조건부 요청 확인
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag }
    });
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

### 3.5 기본값 폴백 (Default Fallback)

CmsContent 테이블에 특정 키가 없거나, CMS API 호출이 실패한 경우 `constants.ts`의 기본값을 사용한다.

```typescript
// lib/cms-defaults.ts
export const CMS_DEFAULTS: Record<string, { type: string; value: string }> = {
  'idle.logo_image':           { type: 'image',  value: '/images/default-logo.svg' },
  'idle.title_text':           { type: 'text',   value: '스마트 도서관' },
  'idle.subtitle_text':        { type: 'text',   value: '도서 대출·반납 키오스크' },
  'idle.bg_color':             { type: 'color',  value: '#1E3A5F' },
  'idle.touch_prompt':         { type: 'text',   value: '화면을 터치하세요' },
  'idle.touch_prompt_color':   { type: 'color',  value: '#FFFFFF' },
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

// 폴백 조회 함수
export function getCmsValueWithDefault(key: string, dbValue?: string | null): string {
  if (dbValue != null && dbValue !== '') return dbValue;
  return CMS_DEFAULTS[key]?.value ?? '';
}
```

---

## 4. 도서 관리 로직

### 4.1 CRUD 플로우 개요

```
┌──────────────────────────────────────────────────────────┐
│                    도서 관리 CRUD                         │
├────────────┬─────────────────────────────────────────────┤
│ CREATE     │ POST /api/admin/books                       │
│            │ → 권한: book:create                         │
│            │ → ISBN 유일성 검사                          │
│            │ → 표지 이미지 업로드 (선택)                  │
│            │ → Book.create + AuditLog                    │
├────────────┼─────────────────────────────────────────────┤
│ READ (List)│ GET /api/admin/books                        │
│            │ → 권한: book:read                           │
│            │ → 페이지네이션 + 필터 + 정렬                 │
├────────────┼─────────────────────────────────────────────┤
│ READ (1)   │ GET /api/admin/books/[id]                  │
│            │ → 권한: book:read                           │
│            │ → 대출 이력 포함                             │
├────────────┼─────────────────────────────────────────────┤
│ UPDATE     │ PUT /api/admin/books/[id]                  │
│            │ → 권한: book:update                         │
│            │ → ISBN 변경 시 유일성 재검사                 │
│            │ → Book.update + AuditLog                    │
├────────────┼─────────────────────────────────────────────┤
│ DELETE     │ DELETE /api/admin/books/[id]               │
│            │ → 권한: book:delete                         │
│            │ → 활성 대출 중이면 삭제 거부                  │
│            │ → Soft delete (status = 'REMOVED')         │
│            │ + AuditLog                                  │
└────────────┴─────────────────────────────────────────────┘
```

### 4.2 도서 등록 (CREATE)

```typescript
// app/api/admin/books/route.ts (POST)
const BookCreateSchema = z.object({
  title:       z.string().min(1).max(200, '도서명은 200자 이내'),
  author:      z.string().min(1).max(100, '저자는 100자 이내'),
  isbn:        z.string().regex(/^\d{13}$/, 'ISBN-13 형식(13자리 숫자)'),
  category:    z.string().min(1, '카테고리는 필수입니다'),
  publisher:   z.string().max(100).optional(),
  publishYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  coverImage:  z.string().optional(), // 업로드 후 URL
  description: z.string().max(500).optional(),
  location:    z.string().max(50).optional(),
});

async function handleCreateBook(ctx: AdminHandlerContext, input: BookCreateInput) {
  // ISBN 유일성 검사
  const existing = await prisma.book.findUnique({ where: { isbn: input.isbn } });
  if (existing) {
    return errorResponse(409, 'ISBN_DUPLICATE', `ISBN ${input.isbn}이(가) 이미 등록되어 있습니다.`);
  }

  // 도서 생성
  const book = await prisma.book.create({
    data: {
      ...input,
      status: 'AVAILABLE',
    }
  });

  // 감사 로그
  await writeAuditLog({
    action: 'CREATE',
    entity: 'Book',
    entityId: book.id,
    newValue: JSON.stringify(book),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: book }, { status: 201 });
}
```

### 4.3 표지 이미지 업로드 플로우

```
┌──────────────┐
│ 파일 선택     │
│ (drag&drop   │
│  또는 클릭)   │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ 클라이언트 검증│
│  MIME: JPG/  │
│   PNG/SVG    │──── 불일치 → 에러 토스트
│  크기 ≤ 2MB  │──── 초과 → 에러 토스트
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ POST /api/   │
│ admin/cms/   │
│ images       │
│ (FormData)   │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ 서버 측 검증  │
│  MIME 재확인 │
│  magic byte  │──── 위조 → 400
│  SVG sanitize│
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Sharp 리사이즈│
│  max 800×1200│
│  WebP 변환   │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ /public/     │
│ uploads/     │
│ books/       │
│ {uuid}.webp  │
│ 로 저장       │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ CmsImage     │
│ 테이블에 메타 │
│ 저장 (크기,   │
│ 원본명, URL) │
└────┬─────────┘
     │
     ▼  { url: '/uploads/books/xxx.webp' }
```

#### 4.3.1 이미지 업로드 의사코드

```typescript
// app/api/admin/cms/images/route.ts (POST)
async function handleImageUpload(request: NextRequest, ctx: AdminHandlerContext) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  // 1. 서버 측 파일 검증
  const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/svg+xml'];
  if (!ALLOWED_MIMES.includes(file.type)) {
    return errorResponse(400, 'INVALID_MIME', 'JPG, PNG, SVG 파일만 업로드 가능합니다.');
  }
  if (file.size > 2 * 1024 * 1024) {
    return errorResponse(400, 'FILE_TOO_LARGE', '파일 크기는 2MB 이하여야 합니다.');
  }

  // 2. Magic byte 검증 (MIME 위조 방지)
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!verifyMagicByte(buffer, file.type)) {
    return errorResponse(400, 'MIME_MISMATCH', '파일 내용이 MIME 타입과 일치하지 않습니다.');
  }

  // 3. 이미지 처리 (Sharp)
  const fileId = randomUUID();
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'books');
  ensureDir(uploadDir);

  let outputPath: string;
  let width: number;
  let height: number;

  if (file.type === 'image/svg+xml') {
    // SVG: sanitize 후 그대로 저장
    const sanitized = sanitizeSvg(buffer.toString('utf-8'));
    outputPath = path.join(uploadDir, `${fileId}.svg`);
    fs.writeFileSync(outputPath, sanitized);
    width = 0; height = 0; // SVG는 치수 생략
  } else {
    // JPG/PNG: 리사이즈 + WebP 변환
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

  const url = `/uploads/books/${path.basename(outputPath)}`;

  // 4. CmsImage 메타 저장
  const imageRecord = await prisma.cmsImage.create({
    data: {
      id: fileId,
      url,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      width,
      height,
      uploadedBy: ctx.admin.id,
    }
  });

  // 5. 감사 로그
  await writeAuditLog({
    action: 'CREATE',
    entity: 'CmsImage',
    entityId: imageRecord.id,
    newValue: JSON.stringify(imageRecord),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: imageRecord }, { status: 201 });
}
```

### 4.4 도서 수정 (UPDATE)

```typescript
// app/api/admin/books/[id]/route.ts (PUT)
async function handleUpdateBook(
  ctx: AdminHandlerContext,
  id: string,
  input: BookUpdateInput
) {
  // 기존 도서 조회
  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) {
    return errorResponse(404, 'NOT_FOUND', '도서를 찾을 수 없습니다.');
  }

  // ISBN 변경 시 유일성 재검사
  if (input.isbn && input.isbn !== existing.isbn) {
    const duplicate = await prisma.book.findUnique({ where: { isbn: input.isbn } });
    if (duplicate) {
      return errorResponse(409, 'ISBN_DUPLICATE', `ISBN ${input.isbn}이(가) 이미 사용 중입니다.`);
    }
  }

  // 업데이트
  const updated = await prisma.book.update({
    where: { id },
    data: input,
  });

  // 감사 로그 (이전 값 / 새 값 JSON diff)
  await writeAuditLog({
    action: 'UPDATE',
    entity: 'Book',
    entityId: id,
    oldValue: JSON.stringify(existing),
    newValue: JSON.stringify(updated),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: updated });
}
```

### 4.5 도서 삭제 (Soft Delete)

```typescript
// app/api/admin/books/[id]/route.ts (DELETE)
async function handleDeleteBook(ctx: AdminHandlerContext, id: string) {
  const existing = await prisma.book.findUnique({
    where: { id },
    include: { loans: { where: { returnedAt: null } } } } // 활성 대출 조회
  });

  if (!existing) {
    return errorResponse(404, 'NOT_FOUND', '도서를 찾을 수 없습니다.');
  }

  // 활성 대출 중이면 삭제 거부
  if (existing.loans.length > 0) {
    return errorResponse(409, 'ACTIVE_LOAN', '대출 중인 도서는 삭제할 수 없습니다. 먼저 반납 처리하세요.');
  }

  // Soft delete: status를 'REMOVED'로 변경 (실제 레코드 삭제 안 함)
  const removed = await prisma.book.update({
    where: { id },
    data: { status: 'REMOVED' },
  });

  // 감사 로그
  await writeAuditLog({
    action: 'DELETE',
    entity: 'Book',
    entityId: id,
    oldValue: JSON.stringify(existing),
    newValue: JSON.stringify({ status: 'REMOVED' }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: { deleted: true, id } });
}
```

### 4.6 도서 목록 조회 (필터 + 페이지네이션)

```typescript
// app/api/admin/books/route.ts (GET)
async function handleListBooks(request: NextRequest, ctx: AdminHandlerContext) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 50));
  const search = url.searchParams.get('search') || '';
  const category = url.searchParams.get('category') || '';
  const status = url.searchParams.get('status') || '';

  const where: Prisma.BookWhereInput = {
    // Soft-delete 제외
    status: status ? status : { not: 'REMOVED' },
    ...(category && { category }),
    ...(search && {
      OR: [
        { title: { contains: search } },
        { author: { contains: search } },
        { isbn: { contains: search } },
      ]
    }),
  };

  const [items, total] = await Promise.all([
    prisma.book.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.book.count({ where }),
  ]);

  return NextResponse.json({
    data: {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      }
    }
  });
}
```

---

## 5. 사용자 관리 로직

### 5.1 CRUD 플로우 개요

```
┌──────────────────────────────────────────────────────────┐
│                  도서관 이용자 관리 CRUD                   │
├────────────┬─────────────────────────────────────────────┤
│ CREATE     │ POST /api/admin/users                       │
│            │ → 권한: user:create                         │
│            │ → RFID 유일성 검사                          │
│            │ → PIN bcrypt 해시 저장                       │
│            │ → LibraryUser.create + AuditLog             │
├────────────┼─────────────────────────────────────────────┤
│ READ (List)│ GET /api/admin/users                        │
│            │ → 권한: user:read                           │
│            │ → PIN 마스킹 (pinHash 노출 금지)             │
│            │ → 페이지네이션 + 필터 + 정렬                 │
├────────────┼─────────────────────────────────────────────┤
│ UPDATE     │ PUT /api/admin/users/[id]                  │
│            │ → 권한: user:update                         │
│            │ → RFID 변경 시 유일성 재검사                 │
│            │ → PIN 변경 시 bcrypt 재해시                  │
│            │ → LibraryUser.update + AuditLog             │
├────────────┼─────────────────────────────────────────────┤
│ DEACTIVATE │ PATCH /api/admin/users/[id]/deactivate     │
│            │ → 권한: user:deactivate                     │
│            │ → 활성 대출 중이면 비활성화 거부             │
│            │ → status = 'WITHDRAWN'                     │
│            │ + AuditLog                                  │
└────────────┴─────────────────────────────────────────────┘
```

### 5.2 사용자 등록 (CREATE)

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
  // RFID 유일성 검사
  const existing = await prisma.libraryUser.findUnique({ where: { rfid: input.rfid } });
  if (existing) {
    return errorResponse(409, 'RFID_DUPLICATE', `RFID ${input.rfid}이(가) 이미 등록되어 있습니다.`);
  }

  // PIN bcrypt 해시
  const pinHash = await bcrypt.hash(input.pin, 12);

  // 이용자 생성
  const user = await prisma.libraryUser.create({
    data: {
      name: input.name,
      rfid: input.rfid,
      pinHash,
      phone: input.phone,
      email: input.email,
      borrowCount: 0,
      overdueCount: 0,
      status: 'ACTIVE',
    }
  });

  // 감사 로그 (PIN 값은 로그에 기록하지 않음)
  await writeAuditLog({
    action: 'CREATE',
    entity: 'LibraryUser',
    entityId: user.id,
    newValue: JSON.stringify({ ...user, pinHash: '[REDACTED]' }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({
    data: { ...user, pinHash: undefined } // 응답에서 pinHash 제거
  }, { status: 201 });
}
```

### 5.3 PIN 변경 로직

```typescript
// app/api/admin/users/[id]/pin/route.ts (PATCH)
const PinUpdateSchema = z.object({
  newPin: z.string().regex(/^\d{6}$/, 'PIN은 6자리 숫자'),
});

async function handleUpdatePin(
  ctx: AdminHandlerContext,
  userId: string,
  input: { newPin: string }
) {
  const user = await prisma.libraryUser.findUnique({ where: { id: userId } });
  if (!user) return errorResponse(404, 'NOT_FOUND', '사용자를 찾을 수 없습니다.');

  // 새 PIN 해시
  const newPinHash = await bcrypt.hash(input.newPin, 12);

  await prisma.libraryUser.update({
    where: { id: userId },
    data: { pinHash: newPinHash }
  });

  await writeAuditLog({
    action: 'UPDATE',
    entity: 'LibraryUser',
    entityId: userId,
    oldValue: JSON.stringify({ pinHash: '[REDACTED]' }),
    newValue: JSON.stringify({ pinHash: '[REDACTED]', pinChangedAt: new Date().toISOString() }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: { success: true } });
}
```

### 5.4 사용자 비활성화 (활성 대출 검사)

```typescript
// app/api/admin/users/[id]/deactivate/route.ts (PATCH)
async function handleDeactivateUser(ctx: AdminHandlerContext, userId: string) {
  const user = await prisma.libraryUser.findUnique({
    where: { id: userId },
    include: { loans: { where: { returnedAt: null } } } // 활성 대출
  });

  if (!user) return errorResponse(404, 'NOT_FOUND', '사용자를 찾을 수 없습니다.');
  if (user.status === 'WITHDRAWN') return errorResponse(409, 'ALREADY_WITHDRAWN', '이미 탈퇴 처리된 사용자입니다.');

  // 활성 대출 중이면 비활성화 거부
  if (user.loans.length > 0) {
    return errorResponse(409, 'ACTIVE_LOAN', '대출 중인 도서가 있어 비활성화할 수 없습니다. 먼저 반납 처리하세요.');
  }

  const deactivated = await prisma.libraryUser.update({
    where: { id: userId },
    data: { status: 'WITHDRAWN' }
  });

  await writeAuditLog({
    action: 'UPDATE',
    entity: 'LibraryUser',
    entityId: userId,
    oldValue: JSON.stringify({ status: user.status }),
    newValue: JSON.stringify({ status: 'WITHDRAWN' }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: deactivated });
}
```

### 5.5 카드 발급 관리

```typescript
// app/api/admin/users/[id]/card/route.ts
async function handleReissueCard(ctx: AdminHandlerContext, userId: string, input: { newRfid: string }) {
  const user = await prisma.libraryUser.findUnique({ where: { id: userId } });
  if (!user) return errorResponse(404, 'NOT_FOUND', '사용자를 찾을 수 없습니다.');

  // 새 RFID 유일성 검사
  const duplicate = await prisma.libraryUser.findUnique({ where: { rfid: input.newRfid } });
  if (duplicate) return errorResponse(409, 'RFID_DUPLICATE', '이미 사용 중인 RFID입니다.');

  const oldRfid = user.rfid;

  await prisma.libraryUser.update({
    where: { id: userId },
    data: { rfid: input.newRfid }
  });

  await writeAuditLog({
    action: 'UPDATE',
    entity: 'LibraryUser',
    entityId: userId,
    oldValue: JSON.stringify({ rfid: oldRfid }),
    newValue: JSON.stringify({ rfid: input.newRfid }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: { success: true, newRfid: input.newRfid } });
}
```

---

## 6. 권한 관리 (RBAC) 로직

### 6.1 권한 검사 알고리즘

```
요청 도달
     │
     ▼
┌───────────────────────┐
│ 1. JWT에서 사용자 ID   │
│    추출 (payload.sub)  │
└────┬──────────────────┘
     │
     ▼
┌───────────────────────┐
│ 2. AdminUser.role      │
│    → AdminRole         │
│    → AdminRole.        │
│      permissions[]     │
└────┬──────────────────┘
     │
     ▼
┌───────────────────────┐
│ 3. requiredPermission │
│    ∈ permissions[]?   │
└────┬──────┬───────────┘
     │ Yes  │ No
     ▼      ▼
  허용    403 Forbidden
```

#### 6.1.1 권한 검사 의사코드

```typescript
// lib/rbac.ts

// 권한 코드 정의
const PERMISSIONS = {
  // CMS 콘텐츠
  'cms:read':          'CMS 콘텐츠 조회',
  'cms:write':         'CMS 콘텐츠 수정',
  'cms:image':         'CMS 이미지 업로드/교체',
  // 도서 관리
  'book:read':         '도서 목록 조회',
  'book:create':       '도서 등록',
  'book:update':       '도서 수정',
  'book:delete':       '도서 삭제',
  'book:import':       '도서 CSV 가져오기',
  // 사용자 관리
  'user:read':         '사용자 목록 조회',
  'user:create':       '사용자 등록',
  'user:update':       '사용자 수정',
  'user:deactivate':   '사용자 비활성화',
  // 통계
  'stats:read':        '통계 대시보드 조회',
  'stats:export':      '통계 CSV 내보내기',
  // 관리자 계정
  'admin:read':        '관리자 계정 조회',
  'admin:create':      '관리자 계정 생성',
  'admin:update':      '관리자 계정 수정',
  'admin:deactivate':  '관리자 비활성화',
  // 감사 로그
  'audit:read':        '감사 로그 조회',
  'audit:export':      '감사 로그 내보내기',
  // 공지
  'notice:read':       '공지 조회',
  'notice:write':      '공지 등록·수정·삭제',
  // 시스템
  'system:backup':     'DB 백업',
  'system:reset':      '시스템 초기화',
} as const;

type PermissionCode = keyof typeof PERMISSIONS;

// 역할별 권한 매핑
const ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  super_admin: Object.keys(PERMISSIONS) as PermissionCode[], // 모든 권한
  admin: [
    'cms:read', 'cms:write', 'cms:image',
    'book:read', 'book:create', 'book:update', 'book:delete', 'book:import',
    'user:read', 'user:create', 'user:update', 'user:deactivate',
    'stats:read', 'stats:export',
    'audit:read',
    'notice:read', 'notice:write',
  ],
  operator: [
    'cms:read',
    'book:read',
    'user:read',
    'stats:read',
    'notice:read',
  ],
};

// 권한 검사 함수
function hasPermission(role: string, required: PermissionCode): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(required);
}

// 다중 권한 검사 (하나라도 만족하면 통과)
function hasAnyPermission(role: string, required: PermissionCode[]): boolean {
  return required.some(p => hasPermission(role, p));
}

// 다중 권한 검사 (모두 만족해야 통과)
function hasAllPermissions(role: string, required: PermissionCode[]): boolean {
  return required.every(p => hasPermission(role, p));
}
```

### 6.2 역할 계층 (Role Hierarchy)

```
super_admin  >  admin  >  operator

┌──────────────────────────────────────────────────────────┐
│ super_admin                                              │
│  • 모든 권한 (전체 22개)                                 │
│  • 관리자 계정 관리 (admin:*)                            │
│  • 시스템 설정 (system:*)                                │
│  • 감사 로그 내보내기 (audit:export)                      │
├──────────────────────────────────────────────────────────┤
│ admin                                                    │
│  • CMS 콘텐츠 관리 (cms:*)                              │
│  • 도서·사용자 CRUD (book:*, user:*)                     │
│  • 통계 조회 + 내보내기 (stats:*)                        │
│  • 감사 로그 조회 (audit:read)                           │
│  • 공지 관리 (notice:*)                                  │
├──────────────────────────────────────────────────────────┤
│ operator                                                 │
│  • 읽기 전용 (cms:read, book:read, user:read, stats:read)│
│  • 공지 조회 (notice:read)                               │
└──────────────────────────────────────────────────────────┘
```

```typescript
// lib/role-hierarchy.ts
const ROLE_HIERARCHY = ['super_admin', 'admin', 'operator'] as const;

function getRoleLevel(role: string): number {
  const idx = ROLE_HIERARCHY.indexOf(role as any);
  return idx === -1 ? Infinity : idx; // 낮을수록 높은 권한
}

function canManageRole(actorRole: string, targetRole: string): boolean {
  // 자신보다 높거나 같은 역할은 관리 불가
  return getRoleLevel(actorRole) < getRoleLevel(targetRole);
}
```

### 6.3 자기 수정 가드 (Self-Modification Guard)

관리자는 자신의 역할을 변경할 수 없다.

```typescript
// app/api/admin/admins/[id]/role/route.ts (PATCH)
async function handleUpdateRole(
  ctx: AdminHandlerContext,
  targetId: string,
  input: { newRole: string }
) {
  // 자기 수정 가드: 자신의 역할 변경 금지
  if (targetId === ctx.admin.id) {
    return errorResponse(403, 'SELF_MODIFICATION', '자신의 역할은 변경할 수 없습니다.');
  }

  // 역할 계층 검사: 자신보다 높거나 같은 역할의 계정은 수정 불가
  const target = await prisma.adminUser.findUnique({ where: { id: targetId } });
  if (!target) return errorResponse(404, 'NOT_FOUND', '관리자를 찾을 수 없습니다.');

  if (!canManageRole(ctx.admin.role.code, target.role.code)) {
    return errorResponse(403, 'ROLE_HIERARCHY', '자신보다 높거나 같은 권한의 계정은 수정할 수 없습니다.');
  }

  // 새 역할 검증
  if (!ROLE_PERMISSIONS[input.newRole]) {
    return errorResponse(400, 'INVALID_ROLE', `유효하지 않은 역할: ${input.newRole}`);
  }

  const oldRole = target.role.code;

  await prisma.adminUser.update({
    where: { id: targetId },
    data: { role: { connect: { code: input.newRole } } }
  });

  await writeAuditLog({
    action: 'UPDATE',
    entity: 'AdminUser',
    entityId: targetId,
    oldValue: JSON.stringify({ role: oldRole }),
    newValue: JSON.stringify({ role: input.newRole }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: { success: true } });
}
```

### 6.4 마지막 super_admin 가드

시스템에 super_admin 역할의 활성 계정이 최소 1개 이상 존재해야 한다. 마지막 super_admin은 비활성화할 수 없다.

```typescript
// app/api/admin/admins/[id]/deactivate/route.ts (PATCH)
async function handleDeactivateAdmin(ctx: AdminHandlerContext, targetId: string) {
  // 자기 자신 비활성화 금지
  if (targetId === ctx.admin.id) {
    return errorResponse(403, 'SELF_DEACTIVATE', '자신의 계정은 비활성화할 수 없습니다.');
  }

  const target = await prisma.adminUser.findUnique({ where: { id: targetId } });
  if (!target) return errorResponse(404, 'NOT_FOUND', '관리자를 찾을 수 없습니다.');

  // 마지막 super_admin 가드
  if (target.role.code === 'super_admin') {
    const activeSuperAdminCount = await prisma.adminUser.count({
      where: { role: { code: 'super_admin' }, isActive: true }
    });

    if (activeSuperAdminCount <= 1) {
      return errorResponse(403, 'LAST_SUPER_ADMIN', '마지막 슈퍼 관리자는 비활성화할 수 없습니다.');
    }
  }

  await prisma.adminUser.update({
    where: { id: targetId },
    data: { isActive: false }
  });

  await writeAuditLog({
    action: 'UPDATE',
    entity: 'AdminUser',
    entityId: targetId,
    oldValue: JSON.stringify({ isActive: true }),
    newValue: JSON.stringify({ isActive: false }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: { success: true } });
}
```

---

## 7. 실시간 동기화 로직

### 7.1 키오스크 폴링 아키텍처

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
│         │                                                      │
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

### 7.2 Zustand Store + 폴링 의사코드

```typescript
// store/cms-store.ts
import { create } from 'zustand';

interface CmsState {
  content: Record<string, string>;   // key → value Map
  lastUpdatedAt: string | null;
  etag: string | null;
  isLoading: boolean;
  error: Error | null;

  // Actions
  setContent: (data: Record<string, string>, etag: string, updatedAt: string) => void;
  fetchContent: () => Promise<void>;
}

export const useCmsStore = create<CmsState>((set, get) => ({
  content: {},
  lastUpdatedAt: null,
  etag: null,
  isLoading: false,
  error: null,

  setContent: (data, etag, updatedAt) => set({
    content: data,
    etag,
    lastUpdatedAt: updatedAt,
    isLoading: false,
    error: null,
  }),

  fetchContent: async () => {
    const { etag } = get();
    set({ isLoading: true });

    try {
      const headers: Record<string, string> = {};
      if (etag) headers['If-None-Match'] = etag;

      const response = await fetch('/api/cms/content', { headers });

      if (response.status === 304) {
        // 콘텐츠 변경 없음
        set({ isLoading: false });
        return;
      }

      if (!response.ok) throw new Error(`CMS API 실패: ${response.status}`);

      const { data } = await response.json();
      const newEtag = response.headers.get('ETag');

      set({
        content: data.map,
        etag: newEtag,
        lastUpdatedAt: data.updatedAt,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({ isLoading: false, error: error as Error });
      // CMS API 실패 → 기본값 사용 (그레이스풀 폴백)
      // content가 비어있으면 defaults로 초기화
      const { content } = get();
      if (Object.keys(content).length === 0) {
        const defaults: Record<string, string> = {};
        for (const [key, def] of Object.entries(CMS_DEFAULTS)) {
          defaults[key] = def.value;
        }
        set({ content: defaults });
      }
    }
  },
}));
```

### 7.3 폴링 훅 (useCmsPolling)

```typescript
// hooks/use-cms-polling.ts
export function useCmsPolling(intervalMs: number = 3000) {
  const fetchContent = useCmsStore(s => s.fetchContent);

  useEffect(() => {
    // 최초 1회 즉시 fetch
    fetchContent();

    // 이후 interval 간격으로 폴링
    const timer = setInterval(fetchContent, intervalMs);

    return () => clearInterval(timer);
  }, [fetchContent, intervalMs]);
}
```

### 7.4 CMS 콘텐츠 조회 훅 (useCmsContent)

```typescript
// hooks/use-cms-content.ts
export function useCmsContent(key: string, defaultValue: string): string {
  const content = useCmsStore(s => s.content);
  const error = useCmsStore(s => s.error);

  // DB 값 > 기본값 > 하드코딩 기본값
  if (error && !content[key]) {
    // API 실패 + DB 값 없음 → 하드코딩 기본값
    return CMS_DEFAULTS[key]?.value ?? defaultValue;
  }

  return content[key] ?? CMS_DEFAULTS[key]?.value ?? defaultValue;
}

// 타입드 버전
export function useCmsText(key: string, defaultValue: string): string {
  return useCmsContent(key, defaultValue);
}

export function useCmsColor(key: string, defaultValue: string): string {
  const value = useCmsContent(key, defaultValue);
  // HEX 검증 (폴백)
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : defaultValue;
}

export function useCmsNumber(key: string, defaultValue: number): number {
  const value = useCmsContent(key, String(defaultValue));
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

export function useCmsBoolean(key: string, defaultValue: boolean): boolean {
  const value = useCmsContent(key, String(defaultValue));
  return value === 'true';
}
```

### 7.5 콘텐츠 변경 감지 (updatedAt 비교)

```typescript
// lib/cms-change-detection.ts
export function detectContentChanges(
  oldContent: Record<string, string>,
  newContent: Record<string, string>
): Array<{ key: string; oldValue: string; newValue: string }> {
  const changes: Array<{ key: string; oldValue: string; newValue: string }> = [];

  for (const key of Object.keys(newContent)) {
    if (oldContent[key] !== newContent[key]) {
      changes.push({
        key,
        oldValue: oldContent[key] ?? '(없음)',
        newValue: newContent[key],
      });
    }
  }

  return changes;
}

// Zustand 미들웨어: 변경 감지 시 콘솔 로그 (개발 모드)
export const cmsChangeLogger = (config: StateCreator<CmsState>) => (set: any, get: any, api: any) => {
  return config(
    (args: any) => {
      const oldContent = get().content;
      set(args);
      const newContent = get().content;

      if (process.env.NODE_ENV === 'development') {
        const changes = detectContentChanges(oldContent, newContent);
        if (changes.length > 0) {
          console.group('[CMS] 콘텐츠 변경 감지');
          changes.forEach(c => console.log(`${c.key}: "${c.oldValue}" → "${c.newValue}"`));
          console.groupEnd();
        }
      }
    },
    get,
    api
  );
};
```

### 7.6 그레이스풀 폴백 (Graceful Fallback)

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

---

## 8. 감사 로그 로직

### 8.1 자동 로깅 (Admin Mutation 감사)

모든 관리자 쓰기 작업(CREATE, UPDATE, DELETE, LOGIN, LOGOUT)은 AuditLog에 자동 기록된다.

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
```

### 8.2 Old Value / New Value JSON Diff

```typescript
// lib/audit-diff.ts
interface AuditDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

function computeAuditDiff(oldJson: string | null, newJson: string | null): AuditDiff[] {
  const old = oldJson ? JSON.parse(oldJson) : {};
  const new_ = newJson ? JSON.parse(newJson) : {};

  const allKeys = new Set([...Object.keys(old), ...Object.keys(new_)]);
  const diffs: AuditDiff[] = [];

  for (const key of allKeys) {
    const oldVal = old[key];
    const newVal = new_[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({
        field: key,
        oldValue: oldVal ?? null,
        newValue: newVal ?? null,
      });
    }
  }

  return diffs;
}

// 예시 출력:
// computeAuditDiff('{"title":"소년이온다","status":"AVAILABLE"}', '{"title":"소년이 온다","status":"AVAILABLE"}')
// → [{ field: "title", oldValue: "소년이온다", newValue: "소년이 온다" }]
```

### 8.3 감사 로그 조회 (필터)

```typescript
// app/api/admin/audit-logs/route.ts (GET)
async function handleListAuditLogs(request: NextRequest, ctx: AdminHandlerContext) {
  const url = new URL(request.url);

  // 필터 파라미터
  const adminId   = url.searchParams.get('adminId') || undefined;
  const action    = url.searchParams.get('action') || undefined;
  const entity    = url.searchParams.get('entity') || undefined;
  const dateFrom  = url.searchParams.get('dateFrom') || undefined;
  const dateTo    = url.searchParams.get('dateTo') || undefined;
  const page      = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize  = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize')) || 50));

  const where: Prisma.AuditLogWhereInput = {
    ...(adminId  && { performedBy: adminId }),
    ...(action   && { action }),
    ...(entity   && { entity }),
    ...(dateFrom && dateTo && {
      performedAt: {
        gte: new Date(dateFrom),
        lte: new Date(dateTo),
      }
    }),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        admin: { select: { id: true, name: true, email: true } }
      }
    }),
    prisma.auditLog.count({ where }),
  ]);

  // diff 계산 (프론트엔드에서 변경 내역 하이라이트용)
  const itemsWithDiff = items.map(item => ({
    ...item,
    diff: computeAuditDiff(item.oldValue, item.newValue),
  }));

  return NextResponse.json({
    data: {
      items: itemsWithDiff,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    }
  });
}
```

### 8.4 보존 정책 (Retention Policy)

```typescript
// lib/audit-retention.ts
const AUDIT_RETENTION_DAYS = 90; // 기본 90일

async function purgeOldAuditLogs(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - AUDIT_RETENTION_DAYS);

  const result = await prisma.auditLog.deleteMany({
    where: {
      performedAt: { lt: cutoffDate }
    }
  });

  return result.count;
}

// 스케줄러: 매일 02:00에 실행 (node-cron 또는 Next.js cron route)
// app/api/cron/purge-audit/route.ts
export async function GET(request: NextRequest) {
  // cron 시크릿 검증
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const deletedCount = await purgeOldAuditLogs();
  return NextResponse.json({ deleted: deletedCount, retentionDays: AUDIT_RETENTION_DAYS });
}
```

---

## 9. 통계 대시보드 로직

### 9.1 일일 스냅샷 (Daily Snapshot)

```typescript
// app/api/admin/stats/route.ts (GET)
async function handleDashboardStats(ctx: AdminHandlerContext) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 오늘의 현황 (SimLoan 기반 집계)
  const [
    todayBorrows,
    todayReturns,
    activeLoans,
    overdueLoans,
  ] = await Promise.all([
    // 금일 대출 건수
    prisma.borrowRecord.count({
      where: { type: 'BORROW', borrowedAt: { gte: today } }
    }),
    // 금일 반납 건수
    prisma.borrowRecord.count({
      where: { type: 'RETURN', returnedAt: { gte: today } }
    }),
    // 현재 대출 중 권수
    prisma.borrowRecord.count({
      where: { returnedAt: null }
    }),
    // 연체 건수
    prisma.borrowRecord.count({
      where: { isOverdue: true, returnedAt: null }
    }),
  ]);

  return NextResponse.json({
    data: {
      today: {
        borrows: todayBorrows,
        returns: todayReturns,
        activeLoans,
        overdueLoans,
      }
    }
  });
}
```

### 9.2 추세 계산 (Trend Calculation)

```typescript
// lib/stats-trend.ts
async function calculateTrend(): Promise<TrendData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 이번 주간 (최근 7일)
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(thisWeekStart.getDate() - 7);

  // 지난 주간 (7일 전 ~ 14일 전)
  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(lastWeekStart.getDate() - 14);

  const [thisWeekCount, lastWeekCount] = await Promise.all([
    prisma.borrowRecord.count({
      where: {
        type: 'BORROW',
        borrowedAt: { gte: thisWeekStart, lt: today }
      }
    }),
    prisma.borrowRecord.count({
      where: {
        type: 'BORROW',
        borrowedAt: { gte: lastWeekStart, lt: thisWeekStart }
      }
    }),
  ]);

  // 추세율 계산
  const trendPercent = lastWeekCount === 0
    ? (thisWeekCount > 0 ? 100 : 0)
    : Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100);

  const trendDirection: 'up' | 'down' | 'neutral' =
    trendPercent > 0 ? 'up' : trendPercent < 0 ? 'down' : 'neutral';

  return {
    thisWeek: thisWeekCount,
    lastWeek: lastWeekCount,
    trendPercent,
    trendDirection,
  };
}
```

### 9.3 시간대별 피크 감지 (Peak Hour Detection)

```typescript
// lib/stats-peak.ts
async function getHourlyDistribution(days: number = 7): Promise<HourlyData[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  // 시간대별 대출 건수 집계
  const records = await prisma.borrowRecord.findMany({
    where: {
      type: 'BORROW',
      borrowedAt: { gte: since }
    },
    select: { borrowedAt: true }
  });

  // 0~23시 분포 생성
  const hours = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${h.toString().padStart(2, '0')}:00`,
    borrowCount: 0,
    returnCount: 0,
  }));

  for (const record of records) {
    const hour = record.borrowedAt.getHours();
    hours[hour].borrowCount++;
  }

  // 반납도 동일하게 집계
  const returnRecords = await prisma.borrowRecord.findMany({
    where: {
      type: 'RETURN',
      returnedAt: { gte: since }
    },
    select: { returnedAt: true }
  });

  for (const record of returnRecords) {
    if (record.returnedAt) {
      const hour = record.returnedAt.getHours();
      hours[hour].returnCount++;
    }
  }

  // 피크 시간대 감지 (대출 기준)
  const peakHour = hours.reduce((max, h) =>
    h.borrowCount > max.borrowCount ? h : max
  , hours[0]);

  return { hours, peakHour };
}
```

### 9.4 인기 도서 TOP 10

```typescript
// lib/stats-popular.ts
async function getPopularBooks(limit: number = 10): Promise<PopularBook[]> {
  // 대출 횟수 기준 집계 (raw SQL 필요 — Prisma groupBy 제약)
  const popular = await prisma.$queryRaw<Array<{ bookId: string; count: bigint }>>`
    SELECT bookId, COUNT(*) as count
    FROM BorrowRecord
    WHERE type = 'BORROW'
    GROUP BY bookId
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  // 도서 정보 조인
  const books = await prisma.book.findMany({
    where: { id: { in: popular.map(p => p.bookId) } },
    select: { id: true, title: true, author: true, coverImage: true }
  });

  return popular.map((p, rank) => ({
    rank: rank + 1,
    book: books.find(b => b.id === p.bookId)!,
    borrowCount: Number(p.count),
  }));
}
```

### 9.5 대시보드 통합 응답

```typescript
// app/api/admin/stats/dashboard/route.ts (GET)
async function handleDashboard(request: NextRequest, ctx: AdminHandlerContext) {
  const [todayStats, trend, hourly, popular, recentActivity] = await Promise.all([
    getTodayStats(),          // 오늘 현황 4개 지표
    calculateTrend(),         // 주간 추세
    getHourlyDistribution(7), // 시간대별 분포 (7일)
    getPopularBooks(10),      // 인기 도서 TOP 10
    getRecentActivity(20),    // 최근 20건 활동
  ]);

  return NextResponse.json({
    data: {
      today: todayStats,
      trend,
      hourly,
      popular,
      recentActivity,
    }
  });
}
```

---

## 10. 초기화 로직

### 10.1 전체 시드 플로우

```
Application Start (Next.js build / dev)
     │
     ▼
┌──────────────────────┐
│ prisma db push       │
│ (스키마 동기화)       │
└────┬─────────────────┘
     │
     ▼
┌──────────────────────┐
│ seed() 호출           │
│ prisma/seed.ts       │
└────┬─────────────────┘
     │
     ├──▶ 10.2 AdminRole 시드
     ├──▶ 10.3 super_admin 계정 시드
     ├──▶ 10.4 CMS 콘텐츠 시드
     ├──▶ 10.5 SystemSetting 시드
     └──▶ 10.6 샘플 데이터 시드 (개발 모드)
```

### 10.2 AdminRole + 권한 시드

```typescript
// prisma/seed.ts
async function seedAdminRoles() {
  // 권한 시드
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
  const permissions = await Promise.all(permissionRecords);

  // 역할 시드
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
        code,
        label,
        permissions: {
          connect: rolePermissionCodes.map(pc => ({ code: pc }))
        }
      }
    });
  }

  console.log('✅ AdminRole + Permission 시드 완료');
}
```

### 10.3 super_admin 계정 시드

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
      email,
      passwordHash,
      name: '슈퍼 관리자',
      role: { connect: { code: 'super_admin' } },
      isActive: true,
    }
  });

  console.log(`✅ super_admin 계정 생성: ${email} / ${password}`);
}
```

### 10.4 CMS 콘텐츠 시드

```typescript
async function seedCmsContent() {
  let created = 0;
  let skipped = 0;

  for (const [key, def] of Object.entries(CMS_DEFAULTS)) {
    const existing = await prisma.cmsContent.findUnique({ where: { key } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.cmsContent.create({
      data: {
        key,
        type: def.type,
        value: def.value,
        updatedBy: 'system', // 시드에 의한 생성
      }
    });
    created++;
  }

  console.log(`✅ CMS 콘텐츠 시드: ${created}건 생성, ${skipped}건 스킵`);
}
```

### 10.5 SystemSetting 시드

```typescript
async function seedSystemSettings() {
  const defaults = [
    { key: 'borrow.max_count',           value: '5',    type: 'number' },
    { key: 'borrow.period_days',         value: '14',   type: 'number' },
    { key: 'borrow.overdue_multiplier',  value: '1.0',  type: 'number' },
    { key: 'borrow.overdue_enabled',     value: 'true', type: 'boolean' },
    { key: 'kiosk.idle_timeout_ms',      value: '30000',type: 'number' },
    { key: 'kiosk.poll_interval_ms',     value: '3000', type: 'number' },
    { key: 'audit.retention_days',       value: '90',   type: 'number' },
    { key: 'system.max_books',           value: '10000',type: 'number' },
    { key: 'system.max_users',           value: '5000', type: 'number' },
    { key: 'system.max_image_total_mb',  value: '500',  type: 'number' },
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

### 10.6 메인 시드 함수

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

---

## 11. 오류 처리 로직

### 11.1 관리자 API 에러 응답 형식

모든 `/api/admin/*` 에러 응답은 통일된 JSON 구조를 따른다.

```typescript
// lib/api-error.ts
interface AdminApiErrorBody {
  error: {
    code: string;            // 기계 판독용 에러 코드
    message: string;         // 사람이 읽을 수 있는 한국어 메시지
    details?: unknown;       // 추가 정보 (검증 에러 필드 목록 등)
  };
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details && { details }) } },
    { status }
  );
}
```

### 11.2 에러 코드 체계

| HTTP | Code | 설명 | 발생 조건 |
|------|------|------|-----------|
| 400 | `VALIDATION_ERROR` | 입력값 검증 실패 | Zod 스키마 불일치 |
| 400 | `INVALID_MIME` | 허용되지 않은 MIME 타입 | 이미지 업로드 시 JPG/PNG/SVG 외 |
| 400 | `INVALID_KEYS` | 존재하지 않는 CMS 키 | batch update 시 누락 키 |
| 401 | `UNAUTHORIZED` | 인증 필요 | 토큰 누락 |
| 401 | `TOKEN_EXPIRED` | 액세스 토큰 만료 | JWT exp 초과 |
| 401 | `AUTH_FAILED` | 로그인 실패 | 이메일/비밀번호 불일치 |
| 401 | `ACCOUNT_LOCKED` | 계정 잠금 | 5회 연속 실패 |
| 401 | `TOKEN_REUSED` | 토큰 재사용 감지 | refresh token 재사용 공격 |
| 403 | `FORBIDDEN` | 권한 부족 | RBAC 거부 |
| 403 | `SELF_MODIFICATION` | 자기 역할 변경 금지 | targetId === adminId |
| 403 | `SELF_DEACTIVATE` | 자기 비활성화 금지 | targetId === adminId |
| 403 | `LAST_SUPER_ADMIN` | 마지막 super_admin 보호 | super_admin count ≤ 1 |
| 403 | `ROLE_HIERARCHY` | 역할 계층 위반 | 낮은 역할이 높은 역할 수정 시도 |
| 404 | `NOT_FOUND` | 리소스 없음 | findUnique null |
| 409 | `ISBN_DUPLICATE` | ISBN 중복 | Book.isbn unique 제약 |
| 409 | `RFID_DUPLICATE` | RFID 중복 | LibraryUser.rfid unique 제약 |
| 409 | `ACTIVE_LOAN` | 활성 대출 존재 | 삭제/비활성화 시 대출 중 |
| 409 | `CONCURRENT_UPDATE` | 동시 수정 충돌 | updatedAt 불일치 |
| 429 | `RATE_LIMITED` | 요청 한도 초과 | rate limit 초과 |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 | 예기치 않은 예외 |

### 11.3 권한 거부 (Permission Denied) 처리

```typescript
// 클라이언트 측 권한 에러 처리
export function handlePermissionDenied(error: AdminApiError) {
  if (error.code === 'FORBIDDEN') {
    toast.error('접근 권한이 없습니다.', {
      description: '해당 작업에 필요한 권한이 부여되지 않았습니다.',
    });

    // 읽기 전용 모드 UI 전환 (선택적)
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
}
```

### 11.4 검증 에러 상세 (Validation Error Details)

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

### 11.5 동시 수정 충돌 처리 (Optimistic Concurrency Control)

```typescript
// lib/concurrent-update.ts
const CmsUpdateWithVersionSchema = CmsUpdateSchema.extend({
  expectedUpdatedAt: z.string().datetime(), // 클라이언트가 마지막으로 본 updatedAt
});

async function handleConcurrentUpdate(
  key: string,
  input: { value: string; expectedUpdatedAt: string },
  ctx: AdminHandlerContext
) {
  const existing = await prisma.cmsContent.findUnique({ where: { key } });

  if (!existing) return errorResponse(404, 'NOT_FOUND', '항목을 찾을 수 없습니다.');

  // 동시 수정 충돌 감지
  if (existing.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    // 다른 관리자가 이미 수정함
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

  // 충돌 없음 → 업데이트 진행
  const updated = await prisma.cmsContent.update({
    where: { key },
    data: { value: input.value, updatedBy: ctx.admin.id }
  });

  await writeAuditLog({
    action: 'UPDATE',
    entity: 'CmsContent',
    entityId: updated.id,
    oldValue: JSON.stringify({ key, value: existing.value }),
    newValue: JSON.stringify({ key, value: updated.value }),
    performedBy: ctx.admin.id,
  });

  return NextResponse.json({ data: updated });
}
```

### 11.6 글로벌 에러 바운더리 (Next.js)

```typescript
// app/admin/error.tsx
'use client';

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 에러 리포팅 (Sentry 등)
    console.error('[Admin ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-bold text-red-600">오류가 발생했습니다</h2>
        <p className="mt-2 text-gray-600">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
```

### 11.7 API 에러 로깅 (서버 측)

```typescript
// lib/api-logger.ts
export function logApiError(
  request: NextRequest,
  error: unknown,
  context?: Record<string, unknown>
) {
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
| v1.0.0 | 2026-03-05 | 최초 작성 | Dashboard Team |
