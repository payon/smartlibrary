# 관리자 대시보드 API 명세서

> 한국 스마트 도서관 키오스크 관리자 대시보드 API Specification  
> Version: 1.0.0  
> Base URL: `https://{domain}`  
> 모든 관리자 API는 `/api/admin/*` 경로에 위치하며, JWT 인증 및 RBAC 권한 검사가 필요합니다.

---

## 목차

1. [공통 사항](#1-공통-사항)
2. [인증 API](#2-인증-api)
3. [CMS 콘텐츠 API](#3-cms-콘텐츠-api)
4. [CMS 이미지 API](#4-cms-이미지-api)
5. [공개 CMS API (키오스크용)](#5-공개-cms-api-키오스크에서-호출-인증-불필요)
6. [도서 관리 API](#6-도서-관리-api)
7. [사용자 관리 API](#7-사용자-관리-api)
8. [관리자 계정 API](#8-관리자-계정-api)
9. [통계 API](#9-통계-api)
10. [감사 로그 API](#10-감사-로그-api)
11. [공지 관리 API](#11-공지-관리-api)
12. [시스템 설정 API](#12-시스템-설정-api)

---

## 1. 공통 사항

### 1.1 인증 헤더

모든 `/api/admin/*` 엔드포인트는 아래 헤더가 필수입니다:

```
Authorization: Bearer {JWT}
```

JWT가 누락되거나 만료된 경우 `401 Unauthorized` 응답이 반환됩니다.

### 1.2 RBAC 권한 체계

| Role | Code | 설명 |
|------|------|------|
| Super Admin | `super_admin` | 모든 권한, 관리자 계정 관리 가능 |
| Admin | `admin` | 콘텐츠/도서/사용자/공지/설정 관리 가능 |
| Viewer | `viewer` | 읽기 전용, 통계/로그 조회만 가능 |

권한이 부족한 경우 `403 Forbidden` 응답이 반환됩니다.

### 1.3 공통 에러 응답 형식

모든 에러 응답은 아래 JSON 구조를 따릅니다:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "사람이 읽을 수 있는 에러 메시지",
    "details": {}
  }
}
```

### 1.4 공통 HTTP 상태 코드

| Status | Code | 설명 |
|--------|------|------|
| 400 | `BAD_REQUEST` | 잘못된 요청 파라미터 또는 본문 |
| 401 | `UNAUTHORIZED` | JWT 누락, 만료 또는 무효 |
| 403 | `FORBIDDEN` | 권한 부족 (RBAC 거부) |
| 404 | `NOT_FOUND` | 요청한 리소스가 존재하지 않음 |
| 409 | `CONFLICT` | 중복 리소스 (예: 이미 존재하는 이메일) |
| 429 | `RATE_LIMITED` | 요청 한도 초과 |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 |

### 1.5 Rate Limiting

| 대상 | 한도 | Window |
|------|------|--------|
| 인증 API (`/auth/*`) | 10회 | 1분 |
| 일반 관리자 API | 100회 | 1분 |
| 이미지 업로드 | 20회 | 1분 |
| 공개 CMS API (`/api/cms/*`) | 200회 | 1분 |

Rate limit 초과 시:

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1719500400
```

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
    "details": {
      "limit": 100,
      "window": "60s",
      "resetAt": "2025-06-27T15:00:00Z"
    }
  }
}
```

### 1.6 공통 쿼리 파라미터 (Pagination)

| Parameter | Type | Default | 설명 |
|-----------|------|---------|------|
| `page` | integer | 1 | 페이지 번호 (1-based) |
| `limit` | integer | 20 | 페이지당 항목 수 (max: 100) |
| `sortBy` | string | `createdAt` | 정렬 필드 |
| `sortOrder` | string | `desc` | 정렬 방향 (`asc` / `desc`) |

Pagination 응답 형식:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### 1.7 공통 응답 헤더

```
X-Request-Id: {uuid}
X-RateLimit-Limit: {limit}
X-RateLimit-Remaining: {remaining}
X-RateLimit-Reset: {epoch}
```

---

## 2. 인증 API

### 2.1 로그인

```
POST /api/admin/auth/login
```

- **Required Role**: 없음 (공개 엔드포인트)
- **Rate Limit**: 10회/1분

**Request Body:**

```json
{
  "email": "admin@library.go.kr",
  "password": "SecureP@ss123!"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | ✅ | 유효한 이메일 형식 |
| `password` | string | ✅ | 최소 8자 |

**Response 200:**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "admin": {
      "id": "adm_01HX3K8M2P",
      "email": "admin@library.go.kr",
      "name": "김관리",
      "role": "admin",
      "lastLoginAt": "2025-06-27T14:30:00Z"
    }
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 본문이 올바르지 않습니다.",
    "details": {
      "email": "유효한 이메일 주소를 입력해주세요.",
      "password": "비밀번호는 최소 8자 이상이어야 합니다."
    }
  }
}
```

**Error 401:**

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "이메일 또는 비밀번호가 올바르지 않습니다.",
    "details": {}
  }
}
```

**Error 429:**

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "로그인 시도가 너무 많습니다. 5분 후 다시 시도해주세요.",
    "details": {
      "retryAfter": 300
    }
  }
}
```

---

### 2.2 로그아웃

```
POST /api/admin/auth/logout
```

- **Required Role**: `viewer` 이상 (인증 필요)
- **Description**: 현재 세션의 refreshToken을 무효화합니다.

**Request Headers:**

```
Authorization: Bearer {JWT}
```

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| Field | Type | Required | 설명 |
|-------|------|----------|------|
| `refreshToken` | string | ✅ | 무효화할 refresh token |

**Response 200:**

```json
{
  "data": {
    "message": "로그아웃 되었습니다."
  }
}
```

**Error 401:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다.",
    "details": {}
  }
}
```

---

### 2.3 내 정보 조회

```
GET /api/admin/auth/me
```

- **Required Role**: `viewer` 이상

**Response 200:**

```json
{
  "data": {
    "id": "adm_01HX3K8M2P",
    "email": "admin@library.go.kr",
    "name": "김관리",
    "role": "admin",
    "permissions": [
      "cms:read",
      "cms:write",
      "books:read",
      "books:write",
      "users:read",
      "users:write",
      "notices:read",
      "notices:write",
      "settings:read",
      "settings:write",
      "stats:read",
      "audit:read"
    ],
    "lastLoginAt": "2025-06-27T14:30:00Z",
    "createdAt": "2024-01-15T09:00:00Z"
  }
}
```

**Error 401:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "토큰이 만료되었습니다. 다시 로그인해주세요.",
    "details": {
      "expiredAt": "2025-06-27T15:30:00Z"
    }
  }
}
```

---

## 3. CMS 콘텐츠 API

### 3.1 콘텐츠 목록 조회

```
GET /api/admin/cms
```

- **Required Role**: `viewer` 이상

**Query Parameters:**

| Parameter | Type | Required | 설명 |
|-----------|------|----------|------|
| `screen` | string | ❌ | 화면 필터 (`main` / `search` / `return` / `info` / `notice`) |
| `search` | string | ❌ | key 또는 label 검색 |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 50, max: 200) |

**Example Request:**

```
GET /api/admin/cms?screen=main&limit=50
```

**Response 200:**

```json
{
  "data": [
    {
      "key": "main.title",
      "label": "메인 화면 제목",
      "value": "스마트 도서관에 오신 것을 환영합니다",
      "screen": "main",
      "type": "text",
      "updatedAt": "2025-06-27T10:00:00Z",
      "updatedBy": {
        "id": "adm_01HX3K8M2P",
        "name": "김관리"
      }
    },
    {
      "key": "main.subtitle",
      "label": "메인 화면 부제목",
      "value": "도서 검색과 대출/반납을 이용할 수 있습니다",
      "screen": "main",
      "type": "text",
      "updatedAt": "2025-06-25T08:00:00Z",
      "updatedBy": {
        "id": "adm_01HX3K8M2P",
        "name": "김관리"
      }
    },
    {
      "key": "main.background_image",
      "label": "메인 배경 이미지",
      "value": "img_01HX3K9A7N",
      "screen": "main",
      "type": "image",
      "updatedAt": "2025-06-20T12:00:00Z",
      "updatedBy": {
        "id": "adm_01HX3K8M2P",
        "name": "김관리"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 32,
    "totalPages": 1
  }
}
```

**Error 401:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다.",
    "details": {}
  }
}
```

**Error 403:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "접근 권한이 없습니다.",
    "details": {
      "requiredRole": "viewer",
      "currentRole": null
    }
  }
}
```

---

### 3.2 단일 콘텐츠 항목 조회

```
GET /api/admin/cms/[key]
```

- **Required Role**: `viewer` 이상
- **Path Parameter**: `key` — 콘텐츠 항목의 고유 key (예: `main.title`)

**Example Request:**

```
GET /api/admin/cms/main.title
```

**Response 200:**

```json
{
  "data": {
    "key": "main.title",
    "label": "메인 화면 제목",
    "value": "스마트 도서관에 오신 것을 환영합니다",
    "screen": "main",
    "type": "text",
    "description": "키오스크 메인 화면 상단에 표시되는 제목 텍스트입니다.",
    "updatedAt": "2025-06-27T10:00:00Z",
    "updatedBy": {
      "id": "adm_01HX3K8M2P",
      "name": "김관리"
    }
  }
}
```

**Error 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 콘텐츠 항목을 찾을 수 없습니다.",
    "details": {
      "key": "main.title"
    }
  }
}
```

---

### 3.3 콘텐츠 항목 수정

```
PUT /api/admin/cms/[key]
```

- **Required Role**: `admin` 이상
- **Description**: 콘텐츠 값을 수정하며, 변경 시 감사 로그(audit log)가 자동으로 기록됩니다.

**Request Body:**

```json
{
  "value": "행복한 도서관에 오신 것을 환영합니다"
}
```

| Field | Type | Required | 설명 |
|-------|------|----------|------|
| `value` | string | ✅ | 새로운 콘텐츠 값 (빈 문자열 허용, max: 2000자) |

**Response 200:**

```json
{
  "data": {
    "key": "main.title",
    "label": "메인 화면 제목",
    "value": "행복한 도서관에 오신 것을 환영합니다",
    "screen": "main",
    "type": "text",
    "updatedAt": "2025-06-27T15:00:00Z",
    "updatedBy": {
      "id": "adm_01HX3K8M2P",
      "name": "김관리"
    },
    "auditLogId": "aud_01HX3L0B4Q"
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 본문이 올바르지 않습니다.",
    "details": {
      "value": "값은 2000자를 초과할 수 없습니다."
    }
  }
}
```

**Error 403:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "쓰기 권한이 없습니다.",
    "details": {
      "requiredRole": "admin",
      "currentRole": "viewer"
    }
  }
}
```

**Error 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 콘텐츠 항목을 찾을 수 없습니다.",
    "details": {
      "key": "main.nonexistent"
    }
  }
}
```

---

### 3.4 콘텐츠 일괄 수정

```
POST /api/admin/cms/batch
```

- **Required Role**: `admin` 이상
- **Description**: 여러 콘텐츠 항목을 한 번에 수정합니다. 각 변경마다 감사 로그가 개별적으로 기록됩니다.

**Request Body:**

```json
{
  "items": [
    {
      "key": "main.title",
      "value": "행복한 도서관에 오신 것을 환영합니다"
    },
    {
      "key": "main.subtitle",
      "value": "검색과 대출/반납 서비스를 이용하세요"
    },
    {
      "key": "search.placeholder",
      "value": "책 제목 또는 저자를 입력하세요"
    }
  ]
}
```

| Field | Type | Required | 설명 |
|-------|------|----------|------|
| `items` | array | ✅ | 수정할 항목 배열 (max: 50개) |
| `items[].key` | string | ✅ | 콘텐츠 key |
| `items[].value` | string | ✅ | 새로운 값 |

**Response 200:**

```json
{
  "data": {
    "updated": 3,
    "failed": 0,
    "results": [
      {
        "key": "main.title",
        "value": "행복한 도서관에 오신 것을 환영합니다",
        "updatedAt": "2025-06-27T15:00:00Z",
        "auditLogId": "aud_01HX3L0B4Q"
      },
      {
        "key": "main.subtitle",
        "value": "검색과 대출/반납 서비스를 이용하세요",
        "updatedAt": "2025-06-27T15:00:00Z",
        "auditLogId": "aud_01HX3L0B5R"
      },
      {
        "key": "search.placeholder",
        "value": "책 제목 또는 저자를 입력하세요",
        "updatedAt": "2025-06-27T15:00:00Z",
        "auditLogId": "aud_01HX3L0B6S"
      }
    ]
  }
}
```

**Error 400 (부분 실패):**

```json
{
  "error": {
    "code": "PARTIAL_FAILURE",
    "message": "일부 항목 수정에 실패했습니다.",
    "details": {
      "updated": 2,
      "failed": 1,
      "failures": [
        {
          "key": "invalid.key",
          "reason": "NOT_FOUND"
        }
      ]
    }
  }
}
```

**Error 400 (항목 수 초과):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "한 번에 최대 50개 항목까지 수정할 수 있습니다.",
    "details": {
      "max": 50,
      "provided": 55
    }
  }
}
```

---

## 4. CMS 이미지 API

### 4.1 이미지 목록 조회

```
GET /api/admin/cms/images
```

- **Required Role**: `viewer` 이상

**Query Parameters:**

| Parameter | Type | Required | 설명 |
|-----------|------|----------|------|
| `screen` | string | ❌ | 화면 필터 |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 20) |

**Response 200:**

```json
{
  "data": [
    {
      "id": "img_01HX3K9A7N",
      "url": "https://cdn.library.go.kr/cms/main-bg-001.jpg",
      "alt": "도서관 메인 배경 이미지",
      "screen": "main",
      "mimeType": "image/jpeg",
      "size": 245760,
      "width": 1920,
      "height": 1080,
      "updatedAt": "2025-06-20T12:00:00Z",
      "updatedBy": {
        "id": "adm_01HX3K8M2P",
        "name": "김관리"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "totalPages": 1
  }
}
```

**Error 401:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다.",
    "details": {}
  }
}
```

---

### 4.2 이미지 업로드

```
POST /api/admin/cms/images
```

- **Required Role**: `admin` 이상
- **Content-Type**: `multipart/form-data`
- **Rate Limit**: 20회/1분

**Form Data:**

| Field | Type | Required | 설명 |
|-------|------|----------|------|
| `file` | binary | ✅ | 이미지 파일 (JPEG, PNG, WebP, SVG) |
| `alt` | string | ❌ | 대체 텍스트 (default: "") |
| `screen` | string | ❌ | 할당할 화면 (예: `main`) |

**제약 사항:**

- 최대 파일 크기: 5MB
- 허용 MIME type: `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`
- 최소 해상도: 100×100px
- 최대 해상도: 3840×2160px

**Response 201:**

```json
{
  "data": {
    "id": "img_01HX3K9A7N",
    "url": "https://cdn.library.go.kr/cms/main-bg-002.jpg",
    "alt": "도서관 메인 배경 이미지",
    "screen": "main",
    "mimeType": "image/jpeg",
    "size": 245760,
    "width": 1920,
    "height": 1080,
    "createdAt": "2025-06-27T15:00:00Z",
    "createdBy": {
      "id": "adm_01HX3K8M2P",
      "name": "김관리"
    }
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "이미지 파일이 올바르지 않습니다.",
    "details": {
      "file": "허용되지 않는 파일 형식입니다. (JPEG, PNG, WebP, SVG만 가능)"
    }
  }
}
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "파일 크기가 제한을 초과합니다.",
    "details": {
      "file": "최대 5MB까지 업로드할 수 있습니다.",
      "maxSize": 5242880,
      "providedSize": 8388608
    }
  }
}
```

**Error 429:**

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "이미지 업로드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    "details": {}
  }
}
```

---

### 4.3 이미지 정보 수정

```
PUT /api/admin/cms/images/[id]
```

- **Required Role**: `admin` 이상
- **Path Parameter**: `id` — 이미지 ID

**Request Body:**

```json
{
  "alt": "메인 화면 배경 - 책장이 있는 도서관 내부",
  "screen": "main"
}
```

| Field | Type | Required | 설명 |
|-------|------|----------|------|
| `alt` | string | ❌ | 대체 텍스트 (max: 200자) |
| `screen` | string | ❌ | 할당할 화면 |

**Response 200:**

```json
{
  "data": {
    "id": "img_01HX3K9A7N",
    "url": "https://cdn.library.go.kr/cms/main-bg-002.jpg",
    "alt": "메인 화면 배경 - 책장이 있는 도서관 내부",
    "screen": "main",
    "mimeType": "image/jpeg",
    "size": 245760,
    "width": 1920,
    "height": 1080,
    "updatedAt": "2025-06-27T15:30:00Z",
    "updatedBy": {
      "id": "adm_01HX3K8M2P",
      "name": "김관리"
    }
  }
}
```

**Error 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 이미지를 찾을 수 없습니다.",
    "details": {
      "id": "img_01HX3K9A7N"
    }
  }
}
```

---

### 4.4 이미지 삭제

```
DELETE /api/admin/cms/images/[id]
```

- **Required Role**: `admin` 이상
- **Path Parameter**: `id` — 이미지 ID
- **Description**: CDN에서 파일을 삭제하고 DB 레코드를 제거합니다. 해당 이미지를 참조하는 콘텐츠 항목이 있으면 `409 Conflict`가 반환됩니다.

**Response 200:**

```json
{
  "data": {
    "message": "이미지가 삭제되었습니다.",
    "id": "img_01HX3K9A7N"
  }
}
```

**Error 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 이미지를 찾을 수 없습니다.",
    "details": {
      "id": "img_invalid"
    }
  }
}
```

**Error 409:**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "해당 이미지를 참조하는 콘텐츠 항목이 존재합니다.",
    "details": {
      "referencedBy": ["main.background_image", "info.hero_image"]
    }
  }
}
```

---

## 5. 공개 CMS API (키오스크에서 호출, 인증 불필요)

> 키오스크 클라이언트에서 호출하는 공개 API입니다.  
> JWT 인증이 필요하지 않으며, 응답 캐싱을 위해 ETag / If-None-Match 헤더를 지원합니다.

### 5.1 전체 콘텐츠 조회

```
GET /api/cms/content
```

- **Required Role**: 없음 (공개)
- **Cache**: ETag 지원, max-age=300 (5분)

**Query Parameters:**

| Parameter | Type | Required | 설명 |
|-----------|------|----------|------|
| `v` | integer | ❌ | 콘텐츠 버전 (변경 시에만 응답 반환, 아니면 304) |

**Request Headers (조건부 요청):**

```
If-None-Match: "etag_abc123"
```

**Response 200:**

```
ETag: "etag_def456"
Cache-Control: public, max-age=300
```

```json
{
  "data": {
    "version": 42,
    "updatedAt": "2025-06-27T15:00:00Z",
    "screens": {
      "main": {
        "title": "스마트 도서관에 오신 것을 환영합니다",
        "subtitle": "도서 검색과 대출/반납을 이용할 수 있습니다",
        "background_image": {
          "url": "https://cdn.library.go.kr/cms/main-bg-001.jpg",
          "alt": "도서관 메인 배경 이미지"
        }
      },
      "search": {
        "placeholder": "검색어를 입력하세요",
        "hint": "제목, 저자, ISBN으로 검색할 수 있습니다"
      },
      "return": {
        "title": "도서 반납",
        "instruction": "반납할 도서를 아래 슬롯에 넣어주세요"
      },
      "info": {
        "title": "도서관 안내",
        "operating_hours": "평일 09:00~18:00 / 토요일 09:00~13:00",
        "contact": "02-1234-5678"
      },
      "notice": {
        "title": "공지사항"
      }
    }
  }
}
```

**Response 304 (변경 없음):**

```
HTTP/1.1 304 Not Modified
ETag: "etag_abc123"
```

**Error 429:**

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
    "details": {}
  }
}
```

---

### 5.2 특정 화면 콘텐츠 조회

```
GET /api/cms/content/[screen]
```

- **Required Role**: 없음 (공개)
- **Path Parameter**: `screen` — 화면 식별자 (`main`, `search`, `return`, `info`, `notice`)
- **Cache**: ETag 지원, max-age=300

**Example Request:**

```
GET /api/cms/content/main
```

**Response 200:**

```
ETag: "etag_main_v42"
Cache-Control: public, max-age=300
```

```json
{
  "data": {
    "screen": "main",
    "version": 42,
    "updatedAt": "2025-06-27T15:00:00Z",
    "content": {
      "title": "스마트 도서관에 오신 것을 환영합니다",
      "subtitle": "도서 검색과 대출/반납을 이용할 수 있습니다",
      "background_image": {
        "url": "https://cdn.library.go.kr/cms/main-bg-001.jpg",
        "alt": "도서관 메인 배경 이미지"
      }
    }
  }
}
```

**Error 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "알 수 없는 화면 식별자입니다.",
    "details": {
      "screen": "unknown",
      "availableScreens": ["main", "search", "return", "info", "notice"]
    }
  }
}
```

---

## 6. 도서 관리 API

### 6.1 도서 목록 조회

```
GET /api/admin/books
```

- **Required Role**: `viewer` 이상

**Query Parameters:**

| Parameter | Type | Required | 설명 |
|-----------|------|----------|------|
| `search` | string | ❌ | 제목/저자/ISBN 검색 |
| `category` | string | ❌ | 카테고리 필터 |
| `status` | string | ❌ | 상태 필터 (`available` / `on_loan` / `lost` / `removed`) |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 20, max: 100) |
| `sortBy` | string | ❌ | 정렬 필드 (`title` / `author` / `createdAt` / `updatedAt`) |
| `sortOrder` | string | ❌ | 정렬 방향 (`asc` / `desc`, default: `desc`) |

**Example Request:**

```
GET /api/admin/books?search=해리&category=문학&status=available&page=1&limit=20
```

**Response 200:**

```json
{
  "data": [
    {
      "id": "bk_01HX3M1A2B",
      "isbn": "9788901234567",
      "title": "해리 포터와 마법사의 돌",
      "author": "J.K. 롤링",
      "publisher": "문학수철",
      "category": "문학",
      "location": "A-2-15",
      "status": "available",
      "coverImage": "https://cdn.library.go.kr/covers/9788901234567.jpg",
      "totalCopies": 3,
      "availableCopies": 2,
      "publishedAt": "2000-08-01",
      "createdAt": "2024-03-10T09:00:00Z",
      "updatedAt": "2025-06-25T14:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

**Error 401:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다.",
    "details": {}
  }
}
```

**Error 403:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "접근 권한이 없습니다.",
    "details": {}
  }
}
```

---

### 6.2 도서 등록

```
POST /api/admin/books
```

- **Required Role**: `admin` 이상

**Request Body:**

```json
{
  "isbn": "9788901234567",
  "title": "해리 포터와 마법사의 돌",
  "author": "J.K. 롤링",
  "publisher": "문학수첼",
  "category": "문학",
  "location": "A-2-15",
  "totalCopies": 3,
  "publishedAt": "2000-08-01",
  "coverImageUrl": "https://cdn.library.go.kr/covers/9788901234567.jpg",
  "description": "해리 포터 시리즈의 첫 번째 책입니다."
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `isbn` | string | ✅ | 13자리 ISBN (숫자만) |
| `title` | string | ✅ | 1~200자 |
| `author` | string | ✅ | 1~100자 |
| `publisher` | string | ❌ | max 100자 |
| `category` | string | ✅ | 등록된 카테고리 |
| `location` | string | ❌ | 서가 위치 (예: A-2-15) |
| `totalCopies` | integer | ✅ | 1 이상 |
| `publishedAt` | string | ❌ | ISO 8601 날짜 |
| `coverImageUrl` | string | ❌ | 유효한 URL |
| `description` | string | ❌ | max 2000자 |

**Response 201:**

```json
{
  "data": {
    "id": "bk_01HX3M1A2B",
    "isbn": "9788901234567",
    "title": "해리 포터와 마법사의 돌",
    "author": "J.K. 롤링",
    "publisher": "문학수첼",
    "category": "문학",
    "location": "A-2-15",
    "status": "available",
    "coverImage": "https://cdn.library.go.kr/covers/9788901234567.jpg",
    "totalCopies": 3,
    "availableCopies": 3,
    "publishedAt": "2000-08-01",
    "createdAt": "2025-06-27T15:00:00Z",
    "updatedAt": "2025-06-27T15:00:00Z"
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 본문이 올바르지 않습니다.",
    "details": {
      "isbn": "ISBN은 13자리 숫자여야 합니다.",
      "title": "제목은 필수 항목입니다."
    }
  }
}
```

**Error 409:**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "동일한 ISBN의 도서가 이미 존재합니다.",
    "details": {
      "existingBookId": "bk_01HX3M1A2B"
    }
  }
}
```

---

### 6.3 도서 수정

```
PUT /api/admin/books/[id]
```

- **Required Role**: `admin` 이상
- **Path Parameter**: `id` — 도서 ID

**Request Body:**

```json
{
  "title": "해리 포터와 마법사의 돌 (개정판)",
  "location": "A-3-01",
  "totalCopies": 5,
  "description": "해리 포터 시리즈 첫 번째 책, 개정판입니다."
}
```

| Field | Type | Required | 설명 |
|-------|------|----------|------|
| `title` | string | ❌ | 도서 제목 |
| `author` | string | ❌ | 저자 |
| `publisher` | string | ❌ | 출판사 |
| `category` | string | ❌ | 카테고리 |
| `location` | string | ❌ | 서가 위치 |
| `totalCopies` | integer | ❌ | 총 권수 |
| `publishedAt` | string | ❌ | 출판일 |
| `coverImageUrl` | string | ❌ | 표지 이미지 URL |
| `description` | string | ❌ | 설명 |

> 모든 필드는 선택적이며, 포함된 필드만 업데이트됩니다 (partial update).

**Response 200:**

```json
{
  "data": {
    "id": "bk_01HX3M1A2B",
    "isbn": "9788901234567",
    "title": "해리 포터와 마법사의 돌 (개정판)",
    "author": "J.K. 롤링",
    "publisher": "문학수첼",
    "category": "문학",
    "location": "A-3-01",
    "status": "available",
    "coverImage": "https://cdn.library.go.kr/covers/9788901234567.jpg",
    "totalCopies": 5,
    "availableCopies": 3,
    "publishedAt": "2000-08-01",
    "createdAt": "2024-03-10T09:00:00Z",
    "updatedAt": "2025-06-27T15:30:00Z"
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "totalCopies는 현재 대출 중인 권수(2)보다 작을 수 없습니다.",
    "details": {
      "totalCopies": "최소 2 이상이어야 합니다.",
      "currentLoans": 2
    }
  }
}
```

**Error 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 도서를 찾을 수 없습니다.",
    "details": {
      "id": "bk_invalid"
    }
  }
}
```

---

### 6.4 도서 삭제 (Soft Delete)

```
DELETE /api/admin/books/[id]
```

- **Required Role**: `admin` 이상
- **Path Parameter**: `id` — 도서 ID
- **Description**: 실제 레코드를 삭제하지 않고 `status`를 `removed`로 변경합니다 (soft delete). 대출 중인 도서는 삭제할 수 없습니다.

**Response 200:**

```json
{
  "data": {
    "id": "bk_01HX3M1A2B",
    "title": "해리 포터와 마법사의 돌 (개정판)",
    "status": "removed",
    "updatedAt": "2025-06-27T16:00:00Z"
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "현재 대출 중인 도서는 삭제할 수 없습니다.",
    "details": {
      "activeLoans": 2,
      "availableCopies": 3,
      "totalCopies": 5
    }
  }
}
```

**Error 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 도서를 찾을 수 없습니다.",
    "details": {
      "id": "bk_invalid"
    }
  }
}
```

---

## 7. 사용자 관리 API

### 7.1 사용자 목록 조회

```
GET /api/admin/users
```

- **Required Role**: `viewer` 이상

**Query Parameters:**

| Parameter | Type | Required | 설명 |
|-----------|------|----------|------|
| `search` | string | ❌ | 이름/전화번호/회원번호 검색 |
| `status` | string | ❌ | 상태 필터 (`active` / `suspended` / `deactivated`) |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 20, max: 100) |
| `sortBy` | string | ❌ | 정렬 필드 |
| `sortOrder` | string | ❌ | 정렬 방향 |

**Response 200:**

```json
{
  "data": [
    {
      "id": "usr_01HX3N2B3C",
      "memberNumber": "LIB-2024-00142",
      "name": "이서연",
      "phone": "010-1234-5678",
      "email": "seoyeon@email.com",
      "status": "active",
      "loanCount": 3,
      "overdueCount": 0,
      "createdAt": "2024-06-15T10:00:00Z",
      "updatedAt": "2025-06-27T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 856,
    "totalPages": 43
  }
}
```

**Error 401:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다.",
    "details": {}
  }
}
```

---

### 7.2 사용자 등록

```
POST /api/admin/users
```

- **Required Role**: `admin` 이상

**Request Body:**

```json
{
  "name": "박지훈",
  "phone": "010-9876-5432",
  "email": "jihoon@email.com",
  "address": "서울시 강남구 역삼동 123"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✅ | 1~50자 |
| `phone` | string | ✅ | 010-XXXX-XXXX 형식 |
| `email` | string | ❌ | 유효한 이메일 |
| `address` | string | ❌ | max 200자 |

**Response 201:**

```json
{
  "data": {
    "id": "usr_01HX3N2B3C",
    "memberNumber": "LIB-2025-00857",
    "name": "박지훈",
    "phone": "010-9876-5432",
    "email": "jihoon@email.com",
    "address": "서울시 강남구 역삼동 123",
    "status": "active",
    "loanCount": 0,
    "overdueCount": 0,
    "createdAt": "2025-06-27T15:00:00Z",
    "updatedAt": "2025-06-27T15:00:00Z"
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 본문이 올바르지 않습니다.",
    "details": {
      "phone": "010-XXXX-XXXX 형식으로 입력해주세요."
    }
  }
}
```

**Error 409:**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "동일한 전화번호의 사용자가 이미 존재합니다.",
    "details": {
      "existingUserId": "usr_01HX3N2B3C"
    }
  }
}
```

---

### 7.3 사용자 수정

```
PUT /api/admin/users/[id]
```

- **Required Role**: `admin` 이상
- **Path Parameter**: `id` — 사용자 ID

**Request Body:**

```json
{
  "name": "박지훈",
  "phone": "010-9876-5432",
  "email": "jihoon_new@email.com",
  "address": "서울시 서초구 반포동 456"
}
```

> 모든 필드 선택적 (partial update)

**Response 200:**

```json
{
  "data": {
    "id": "usr_01HX3N2B3C",
    "memberNumber": "LIB-2025-00857",
    "name": "박지훈",
    "phone": "010-9876-5432",
    "email": "jihoon_new@email.com",
    "address": "서울시 서초구 반포동 456",
    "status": "active",
    "loanCount": 0,
    "overdueCount": 0,
    "createdAt": "2025-06-27T15:00:00Z",
    "updatedAt": "2025-06-27T16:00:00Z"
  }
}
```

**Error 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 사용자를 찾을 수 없습니다.",
    "details": {
      "id": "usr_invalid"
    }
  }
}
```

---

### 7.4 사용자 비활성화

```
DELETE /api/admin/users/[id]
```

- **Required Role**: `admin` 이상
- **Path Parameter**: `id` — 사용자 ID
- **Description**: 사용자를 비활성화(`deactivated`) 상태로 변경합니다. 미반납 도서가 있는 경우 비활성화할 수 없습니다.

**Response 200:**

```json
{
  "data": {
    "id": "usr_01HX3N2B3C",
    "name": "박지훈",
    "status": "deactivated",
    "updatedAt": "2025-06-27T16:30:00Z"
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "미반납 도서가 있는 사용자는 비활성화할 수 없습니다.",
    "details": {
      "activeLoans": 2
    }
  }
}
```

**Error 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 사용자를 찾을 수 없습니다.",
    "details": {
      "id": "usr_invalid"
    }
  }
}
```

---

## 8. 관리자 계정 API

> 모든 엔드포인트는 `super_admin` role 전용입니다.

### 8.1 관리자 목록 조회

```
GET /api/admin/admins
```

- **Required Role**: `super_admin`

**Query Parameters:**

| Parameter | Type | Required | 설명 |
|-----------|------|----------|------|
| `search` | string | ❌ | 이름/이메일 검색 |
| `role` | string | ❌ | 역할 필터 (`super_admin` / `admin` / `viewer`) |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 20) |

**Response 200:**

```json
{
  "data": [
    {
      "id": "adm_01HX3K8M2P",
      "email": "admin@library.go.kr",
      "name": "김관리",
      "role": "admin",
      "lastLoginAt": "2025-06-27T14:30:00Z",
      "createdAt": "2024-01-15T09:00:00Z",
      "updatedAt": "2024-01-15T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

**Error 403:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "최고 관리자만 접근할 수 있습니다.",
    "details": {
      "requiredRole": "super_admin",
      "currentRole": "admin"
    }
  }
}
```

---

### 8.2 관리자 계정 생성

```
POST /api/admin/admins
```

- **Required Role**: `super_admin`

**Request Body:**

```json
{
  "email": "newadmin@library.go.kr",
  "name": "최새관리",
  "password": "SecureP@ss456!",
  "role": "viewer"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | ✅ | 유효한 이메일, 중복 불가 |
| `name` | string | ✅ | 1~50자 |
| `password` | string | ✅ | 8자 이상, 대/소문자+숫자+특수문자 포함 |
| `role` | string | ✅ | `admin` / `viewer` (`super_admin`은 직접 생성 불가) |

**Response 201:**

```json
{
  "data": {
    "id": "adm_01HX4P0C3D",
    "email": "newadmin@library.go.kr",
    "name": "최새관리",
    "role": "viewer",
    "lastLoginAt": null,
    "createdAt": "2025-06-27T15:00:00Z",
    "updatedAt": "2025-06-27T15:00:00Z"
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 본문이 올바르지 않습니다.",
    "details": {
      "password": "비밀번호는 8자 이상이며 대소문자, 숫자, 특수문자를 포함해야 합니다.",
      "role": "super_admin 계정은 이 API로 생성할 수 없습니다."
    }
  }
}
```

**Error 409:**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "동일한 이메일의 관리자가 이미 존재합니다.",
    "details": {
      "email": "newadmin@library.go.kr"
    }
  }
}
```

---

### 8.3 관리자 역할 변경

```
PUT /api/admin/admins/[id]
```

- **Required Role**: `super_admin`
- **Path Parameter**: `id` — 관리자 ID

**Request Body:**

```json
{
  "role": "admin",
  "name": "최새관리"
}
```

| Field | Type | Required | 설명 |
|-------|------|----------|------|
| `role` | string | ❌ | 변경할 역할 (`admin` / `viewer`) |
| `name` | string | ❌ | 변경할 이름 |

> 자기 자신의 역할은 변경할 수 없습니다.

**Response 200:**

```json
{
  "data": {
    "id": "adm_01HX4P0C3D",
    "email": "newadmin@library.go.kr",
    "name": "최새관리",
    "role": "admin",
    "lastLoginAt": null,
    "createdAt": "2025-06-27T15:00:00Z",
    "updatedAt": "2025-06-27T16:00:00Z"
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "자기 자신의 역할은 변경할 수 없습니다.",
    "details": {}
  }
}
```

**Error 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 관리자를 찾을 수 없습니다.",
    "details": {
      "id": "adm_invalid"
    }
  }
}
```

---

### 8.4 관리자 비밀번호 변경

```
PUT /api/admin/admins/[id]/password
```

- **Required Role**: `super_admin`
- **Path Parameter**: `id` — 관리자 ID
- **Description**: 최고 관리자가 다른 관리자의 비밀번호를 강제로 변경합니다.

**Request Body:**

```json
{
  "newPassword": "NewSecureP@ss789!"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `newPassword` | string | ✅ | 8자 이상, 대/소문자+숫자+특수문자 포함 |

**Response 200:**

```json
{
  "data": {
    "message": "비밀번호가 변경되었습니다.",
    "id": "adm_01HX4P0C3D"
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "비밀번호가 정책을 충족하지 않습니다.",
    "details": {
      "newPassword": "8자 이상이며 대소문자, 숫자, 특수문자를 포함해야 합니다."
    }
  }
}
```

**Error 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 관리자를 찾을 수 없습니다.",
    "details": {
      "id": "adm_invalid"
    }
  }
}
```

---

## 9. 통계 API

### 9.1 오늘의 개요

```
GET /api/admin/stats/overview
```

- **Required Role**: `viewer` 이상
- **Description**: 대시보드 메인 화면에 표시되는 오늘의 요약 통계입니다.

**Response 200:**

```json
{
  "data": {
    "date": "2025-06-27",
    "todayLoans": 42,
    "todayReturns": 38,
    "todayNewUsers": 3,
    "activeLoans": 187,
    "overdueLoans": 12,
    "totalBooks": 4520,
    "totalUsers": 856,
    "availableBooks": 3890,
    "kioskSessions": 215,
    "changesFromYesterday": {
      "todayLoans": 5.0,
      "todayReturns": -2.6,
      "todayNewUsers": 50.0,
      "activeLoans": 1.1,
      "overdueLoans": -7.7
    }
  }
}
```

> `changesFromYesterday`의 값은 퍼센트(%)입니다.

**Error 401:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다.",
    "details": {}
  }
}
```

---

### 9.2 대출 추이

```
GET /api/admin/stats/loans
```

- **Required Role**: `viewer` 이상

**Query Parameters:**

| Parameter | Type | Required | 설명 |
|-----------|------|----------|------|
| `period` | string | ❌ | 기간 (`7d` / `30d` / `90d` / `1y`, default: `30d`) |
| `startDate` | string | ❌ | 시작일 (ISO 8601, `period` 대신 사용 가능) |
| `endDate` | string | ❌ | 종료일 (ISO 8601, `period` 대신 사용 가능) |

**Example Request:**

```
GET /api/admin/stats/loans?period=30d
```

**Response 200:**

```json
{
  "data": {
    "period": "30d",
    "startDate": "2025-05-28",
    "endDate": "2025-06-27",
    "summary": {
      "totalLoans": 1245,
      "totalReturns": 1189,
      "avgDailyLoans": 41.5,
      "peakDay": {
        "date": "2025-06-14",
        "loans": 68
      }
    },
    "daily": [
      {
        "date": "2025-06-27",
        "loans": 42,
        "returns": 38,
        "overdue": 12
      },
      {
        "date": "2025-06-26",
        "loans": 40,
        "returns": 39,
        "overdue": 13
      },
      {
        "date": "2025-06-25",
        "loans": 35,
        "returns": 41,
        "overdue": 14
      }
    ]
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "잘못된 기간 파라미터입니다.",
    "details": {
      "period": "유효한 값: 7d, 30d, 90d, 1y"
    }
  }
}
```

---

### 9.3 이용 현황

```
GET /api/admin/stats/usage
```

- **Required Role**: `viewer` 이상
- **Description**: 피크 시간대 및 인기 도서 통계를 제공합니다.

**Query Parameters:**

| Parameter | Type | Required | 설명 |
|-----------|------|----------|------|
| `period` | string | ❌ | 기간 (`7d` / `30d` / `90d`, default: `30d`) |

**Response 200:**

```json
{
  "data": {
    "period": "30d",
    "peakHours": [
      { "hour": 10, "sessions": 45, "loans": 18 },
      { "hour": 11, "sessions": 52, "loans": 22 },
      { "hour": 12, "sessions": 38, "loans": 12 },
      { "hour": 14, "sessions": 48, "loans": 20 },
      { "hour": 15, "sessions": 55, "loans": 25 },
      { "hour": 16, "sessions": 42, "loans": 16 },
      { "hour": 17, "sessions": 30, "loans": 10 }
    ],
    "popularBooks": [
      {
        "rank": 1,
        "id": "bk_01HX3M1A2B",
        "title": "해리 포터와 마법사의 돌",
        "author": "J.K. 롤링",
        "loanCount": 28
      },
      {
        "rank": 2,
        "id": "bk_01HX3M2C3D",
        "title": "데미안",
        "author": "헤르만 헤세",
        "loanCount": 24
      },
      {
        "rank": 3,
        "id": "bk_01HX3M3D4E",
        "title": "어린 왕자",
        "author": "생텍쥐페리",
        "loanCount": 21
      },
      {
        "rank": 4,
        "id": "bk_01HX3M4E5F",
        "title": "1984",
        "author": "조지 오웰",
        "loanCount": 19
      },
      {
        "rank": 5,
        "id": "bk_01HX3M5F6G",
        "title": "삼국지 1",
        "author": "이문열",
        "loanCount": 17
      }
    ],
    "dailySessions": {
      "weekday": {
        "avg": 215,
        "peak": "15시"
      },
      "weekend": {
        "avg": 89,
        "peak": "11시"
      }
    }
  }
}
```

**Error 401:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다.",
    "details": {}
  }
}
```

---

## 10. 감사 로그 API

### 10.1 감사 로그 목록 조회

```
GET /api/admin/audit
```

- **Required Role**: `viewer` 이상
- **Description**: 관리자의 모든 중요 작업이 자동으로 기록된 감사 로그를 조회합니다.

**Query Parameters:**

| Parameter | Type | Required | 설명 |
|-----------|------|----------|------|
| `adminId` | string | ❌ | 특정 관리자 ID 필터 |
| `action` | string | ❌ | 액션 유형 필터 (`create` / `update` / `delete` / `login` / `logout`) |
| `entity` | string | ❌ | 대상 엔티티 필터 (`cms` / `book` / `user` / `admin` / `notice` / `setting` / `image`) |
| `startDate` | string | ❌ | 시작일 (ISO 8601) |
| `endDate` | string | ❌ | 종료일 (ISO 8601) |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 20, max: 100) |

**Example Request:**

```
GET /api/admin/audit?action=update&entity=cms&startDate=2025-06-20&endDate=2025-06-27&page=1&limit=20
```

**Response 200:**

```json
{
  "data": [
    {
      "id": "aud_01HX3L0B4Q",
      "adminId": "adm_01HX3K8M2P",
      "adminName": "김관리",
      "adminEmail": "admin@library.go.kr",
      "action": "update",
      "entity": "cms",
      "entityId": "main.title",
      "changes": {
        "before": "스마트 도서관에 오신 것을 환영합니다",
        "after": "행복한 도서관에 오신 것을 환영합니다"
      },
      "ip": "192.168.1.100",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
      "createdAt": "2025-06-27T15:00:00Z"
    },
    {
      "id": "aud_01HX3L0B5R",
      "adminId": "adm_01HX3K8M2P",
      "adminName": "김관리",
      "adminEmail": "admin@library.go.kr",
      "action": "update",
      "entity": "cms",
      "entityId": "main.subtitle",
      "changes": {
        "before": "도서 검색과 대출/반납을 이용할 수 있습니다",
        "after": "검색과 대출/반납 서비스를 이용하세요"
      },
      "ip": "192.168.1.100",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
      "createdAt": "2025-06-27T15:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "잘못된 날짜 범위입니다.",
    "details": {
      "startDate": "시작일이 종료일보다 늦을 수 없습니다."
    }
  }
}
```

**Error 401:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다.",
    "details": {}
  }
}
```

**Error 403:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "접근 권한이 없습니다.",
    "details": {}
  }
}
```

---

## 11. 공지 관리 API

### 11.1 공지 목록 조회

```
GET /api/admin/notices
```

- **Required Role**: `viewer` 이상

**Query Parameters:**

| Parameter | Type | Required | 설명 |
|-----------|------|----------|------|
| `status` | string | ❌ | 상태 필터 (`active` / `inactive` / `expired`) |
| `priority` | string | ❌ | 우선순위 필터 (`high` / `normal` / `low`) |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 20) |

**Response 200:**

```json
{
  "data": [
    {
      "id": "ntc_01HX3Q1A2B",
      "title": "시스템 점검 안내",
      "content": "7월 1일 02:00~06:00 시스템 점검으로 인해 키오스크 이용이 제한됩니다.",
      "status": "active",
      "priority": "high",
      "startDate": "2025-06-27T00:00:00Z",
      "endDate": "2025-07-01T23:59:59Z",
      "createdBy": {
        "id": "adm_01HX3K8M2P",
        "name": "김관리"
      },
      "createdAt": "2025-06-27T10:00:00Z",
      "updatedAt": "2025-06-27T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 8,
    "totalPages": 1
  }
}
```

**Error 401:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다.",
    "details": {}
  }
}
```

---

### 11.2 공지 등록

```
POST /api/admin/notices
```

- **Required Role**: `admin` 이상

**Request Body:**

```json
{
  "title": "여름휴가 기간 단축 운영 안내",
  "content": "7월 15일~8월 15일까지 평일 운영시간이 09:00~16:00으로 단축됩니다.",
  "priority": "normal",
  "startDate": "2025-07-01T00:00:00Z",
  "endDate": "2025-08-15T23:59:59Z"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | ✅ | 1~200자 |
| `content` | string | ✅ | 1~5000자 (Markdown 지원) |
| `priority` | string | ❌ | `high` / `normal` / `low` (default: `normal`) |
| `startDate` | string | ✅ | ISO 8601 날짜/시간 |
| `endDate` | string | ✅ | ISO 8601 날짜/시간, `startDate` 이후 |

**Response 201:**

```json
{
  "data": {
    "id": "ntc_01HX3Q2B3C",
    "title": "여름휴가 기간 단축 운영 안내",
    "content": "7월 15일~8월 15일까지 평일 운영시간이 09:00~16:00으로 단축됩니다.",
    "status": "active",
    "priority": "normal",
    "startDate": "2025-07-01T00:00:00Z",
    "endDate": "2025-08-15T23:59:59Z",
    "createdBy": {
      "id": "adm_01HX3K8M2P",
      "name": "김관리"
    },
    "createdAt": "2025-06-27T16:00:00Z",
    "updatedAt": "2025-06-27T16:00:00Z"
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 본문이 올바르지 않습니다.",
    "details": {
      "endDate": "종료일은 시작일 이후여야 합니다.",
      "title": "제목은 필수 항목입니다."
    }
  }
}
```

**Error 403:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "쓰기 권한이 없습니다.",
    "details": {
      "requiredRole": "admin",
      "currentRole": "viewer"
    }
  }
}
```

---

### 11.3 공지 수정

```
PUT /api/admin/notices/[id]
```

- **Required Role**: `admin` 이상
- **Path Parameter**: `id` — 공지 ID

**Request Body:**

```json
{
  "title": "여름휴가 기간 단축 운영 안내 (수정)",
  "content": "7월 15일~8월 15일까지 평일 운영시간이 09:00~15:00으로 단축됩니다.",
  "priority": "high",
  "endDate": "2025-08-20T23:59:59Z"
}
```

> 모든 필드 선택적 (partial update)

**Response 200:**

```json
{
  "data": {
    "id": "ntc_01HX3Q2B3C",
    "title": "여름휴가 기간 단축 운영 안내 (수정)",
    "content": "7월 15일~8월 15일까지 평일 운영시간이 09:00~15:00으로 단축됩니다.",
    "status": "active",
    "priority": "high",
    "startDate": "2025-07-01T00:00:00Z",
    "endDate": "2025-08-20T23:59:59Z",
    "createdBy": {
      "id": "adm_01HX3K8M2P",
      "name": "김관리"
    },
    "createdAt": "2025-06-27T16:00:00Z",
    "updatedAt": "2025-06-27T17:00:00Z"
  }
}
```

**Error 400:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "종료일이 시작일 이전입니다.",
    "details": {
      "startDate": "2025-07-01T00:00:00Z",
      "endDate": "2025-06-01T23:59:59Z"
    }
  }
}
```

**Error 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 공지를 찾을 수 없습니다.",
    "details": {
      "id": "ntc_invalid"
    }
  }
}
```

---

### 11.4 공지 삭제

```
DELETE /api/admin/notices/[id]
```

- **Required Role**: `admin` 이상
- **Path Parameter**: `id` — 공지 ID
- **Description**: 공지를 영구 삭제합니다.

**Response 200:**

```json
{
  "data": {
    "message": "공지가 삭제되었습니다.",
    "id": "ntc_01HX3Q2B3C"
  }
}
```

**Error 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 공지를 찾을 수 없습니다.",
    "details": {
      "id": "ntc_invalid"
    }
  }
}
```

---

## 12. 시스템 설정 API

### 12.1 설정 목록 조회

```
GET /api/admin/settings
```

- **Required Role**: `viewer` 이상

**Query Parameters:**

| Parameter | Type | Required | 설명 |
|-----------|------|----------|------|
| `category` | string | ❌ | 카테고리 필터 (`library` / `kiosk` / `loan` / `notification`) |

**Response 200:**

```json
{
  "data": {
    "library": {
      "label": "도서관 기본 설정",
      "items": [
        {
          "key": "library.name",
          "label": "도서관명",
          "value": "강남 스마트 도서관",
          "type": "string",
          "updatedAt": "2025-03-01T10:00:00Z"
        },
        {
          "key": "library.phone",
          "label": "대표 전화번호",
          "value": "02-1234-5678",
          "type": "string",
          "updatedAt": "2025-03-01T10:00:00Z"
        },
        {
          "key": "library.address",
          "label": "도서관 주소",
          "value": "서울시 강남구 역삼동 123",
          "type": "string",
          "updatedAt": "2025-03-01T10:00:00Z"
        }
      ]
    },
    "kiosk": {
      "label": "키오스크 설정",
      "items": [
        {
          "key": "kiosk.idle_timeout",
          "label": "유휴 화면 복귀 시간(초)",
          "value": 120,
          "type": "number",
          "updatedAt": "2025-04-10T14:00:00Z"
        },
        {
          "key": "kiosk.screen_brightness",
          "label": "화면 밝기(%)",
          "value": 80,
          "type": "number",
          "updatedAt": "2025-04-10T14:00:00Z"
        },
        {
          "key": "kiosk.screensaver_enabled",
          "label": "화면 보호기 활성화",
          "value": true,
          "type": "boolean",
          "updatedAt": "2025-04-10T14:00:00Z"
        }
      ]
    },
    "loan": {
      "label": "대출 설정",
      "items": [
        {
          "key": "loan.max_books",
          "label": "1인 최대 대출 권수",
          "value": 5,
          "type": "number",
          "updatedAt": "2025-01-01T00:00:00Z"
        },
        {
          "key": "loan.period_days",
          "label": "대출 기간(일)",
          "value": 14,
          "type": "number",
          "updatedAt": "2025-01-01T00:00:00Z"
        },
        {
          "key": "loan.renewal_limit",
          "label": "연장 가능 횟수",
          "value": 1,
          "type": "number",
          "updatedAt": "2025-01-01T00:00:00Z"
        },
        {
          "key": "loan.overdue_fine_per_day",
          "label": "연체 과태료(원/일)",
          "value": 100,
          "type": "number",
          "updatedAt": "2025-01-01T00:00:00Z"
        }
      ]
    },
    "notification": {
      "label": "알림 설정",
      "items": [
        {
          "key": "notification.overdue_alert",
          "label": "연체 알림 발송",
          "value": true,
          "type": "boolean",
          "updatedAt": "2025-01-01T00:00:00Z"
        },
        {
          "key": "notification.overdue_alert_day",
          "label": "연체 알림 기준일",
          "value": 1,
          "type": "number",
          "description": "연체 N일 차부터 알림 발송",
          "updatedAt": "2025-01-01T00:00:00Z"
        }
      ]
    }
  }
}
```

**Error 401:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다.",
    "details": {}
  }
}
```

---

### 12.2 설정 일괄 수정

```
PUT /api/admin/settings
```

- **Required Role**: `admin` 이상
- **Description**: 여러 설정 항목을 한 번에 수정합니다. 각 변경마다 감사 로그가 기록됩니다.

**Request Body:**

```json
{
  "items": [
    {
      "key": "library.name",
      "value": "서초 스마트 도서관"
    },
    {
      "key": "kiosk.idle_timeout",
      "value": 90
    },
    {
      "key": "loan.max_books",
      "value": 7
    },
    {
      "key": "notification.overdue_alert",
      "value": false
    }
  ]
}
```

| Field | Type | Required | 설명 |
|-------|------|----------|------|
| `items` | array | ✅ | 수정할 설정 배열 (max: 50개) |
| `items[].key` | string | ✅ | 설정 key |
| `items[].value` | string\|number\|boolean | ✅ | 설정 값 (key의 type과 일치해야 함) |

**Response 200:**

```json
{
  "data": {
    "updated": 4,
    "failed": 0,
    "results": [
      {
        "key": "library.name",
        "value": "서초 스마트 도서관",
        "updatedAt": "2025-06-27T18:00:00Z"
      },
      {
        "key": "kiosk.idle_timeout",
        "value": 90,
        "updatedAt": "2025-06-27T18:00:00Z"
      },
      {
        "key": "loan.max_books",
        "value": 7,
        "updatedAt": "2025-06-27T18:00:00Z"
      },
      {
        "key": "notification.overdue_alert",
        "value": false,
        "updatedAt": "2025-06-27T18:00:00Z"
      }
    ]
  }
}
```

**Error 400 (타입 불일치):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "설정 값의 타입이 일치하지 않습니다.",
    "details": {
      "kiosk.idle_timeout": {
        "expected": "number",
        "provided": "string"
      }
    }
  }
}
```

**Error 400 (부분 실패):**

```json
{
  "error": {
    "code": "PARTIAL_FAILURE",
    "message": "일부 설정 수정에 실패했습니다.",
    "details": {
      "updated": 3,
      "failed": 1,
      "failures": [
        {
          "key": "invalid.key",
          "reason": "NOT_FOUND"
        }
      ]
    }
  }
}
```

**Error 403:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "설정 수정 권한이 없습니다.",
    "details": {
      "requiredRole": "admin",
      "currentRole": "viewer"
    }
  }
}
```

**Error 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "알 수 없는 설정 카테고리입니다.",
    "details": {
      "category": "unknown",
      "availableCategories": ["library", "kiosk", "loan", "notification"]
    }
  }
}
```

---

## 부록

### A. 전체 엔드포인트 요약

| Method | Path | Required Role | 설명 |
|--------|------|---------------|------|
| POST | `/api/admin/auth/login` | 없음 | 로그인 |
| POST | `/api/admin/auth/logout` | 인증 필요 | 로그아웃 |
| GET | `/api/admin/auth/me` | `viewer` | 내 정보 조회 |
| GET | `/api/admin/cms` | `viewer` | 콘텐츠 목록 |
| GET | `/api/admin/cms/[key]` | `viewer` | 단일 콘텐츠 조회 |
| PUT | `/api/admin/cms/[key]` | `admin` | 콘텐츠 수정 |
| POST | `/api/admin/cms/batch` | `admin` | 콘텐츠 일괄 수정 |
| GET | `/api/admin/cms/images` | `viewer` | 이미지 목록 |
| POST | `/api/admin/cms/images` | `admin` | 이미지 업로드 |
| PUT | `/api/admin/cms/images/[id]` | `admin` | 이미지 정보 수정 |
| DELETE | `/api/admin/cms/images/[id]` | `admin` | 이미지 삭제 |
| GET | `/api/cms/content` | 없음 | 공개 전체 콘텐츠 (ETag) |
| GET | `/api/cms/content/[screen]` | 없음 | 공개 화면별 콘텐츠 |
| GET | `/api/admin/books` | `viewer` | 도서 목록 |
| POST | `/api/admin/books` | `admin` | 도서 등록 |
| PUT | `/api/admin/books/[id]` | `admin` | 도서 수정 |
| DELETE | `/api/admin/books/[id]` | `admin` | 도서 삭제 (soft) |
| GET | `/api/admin/users` | `viewer` | 사용자 목록 |
| POST | `/api/admin/users` | `admin` | 사용자 등록 |
| PUT | `/api/admin/users/[id]` | `admin` | 사용자 수정 |
| DELETE | `/api/admin/users/[id]` | `admin` | 사용자 비활성화 |
| GET | `/api/admin/admins` | `super_admin` | 관리자 목록 |
| POST | `/api/admin/admins` | `super_admin` | 관리자 생성 |
| PUT | `/api/admin/admins/[id]` | `super_admin` | 관리자 역할 변경 |
| PUT | `/api/admin/admins/[id]/password` | `super_admin` | 관리자 비밀번호 변경 |
| GET | `/api/admin/stats/overview` | `viewer` | 오늘의 개요 |
| GET | `/api/admin/stats/loans` | `viewer` | 대출 추이 |
| GET | `/api/admin/stats/usage` | `viewer` | 이용 현황 |
| GET | `/api/admin/audit` | `viewer` | 감사 로그 |
| GET | `/api/admin/notices` | `viewer` | 공지 목록 |
| POST | `/api/admin/notices` | `admin` | 공지 등록 |
| PUT | `/api/admin/notices/[id]` | `admin` | 공지 수정 |
| DELETE | `/api/admin/notices/[id]` | `admin` | 공지 삭제 |
| GET | `/api/admin/settings` | `viewer` | 설정 목록 |
| PUT | `/api/admin/settings` | `admin` | 설정 일괄 수정 |

### B. 에러 코드 전체 목록

| Code | HTTP Status | 설명 |
|------|-------------|------|
| `VALIDATION_ERROR` | 400 | 요청 파라미터/본문 검증 실패 |
| `BAD_REQUEST` | 400 | 잘못된 요청 |
| `PARTIAL_FAILURE` | 400 | 일괄 처리 중 일부 실패 |
| `UNAUTHORIZED` | 401 | 인증 필요 / 토큰 무효/만료 |
| `INVALID_CREDENTIALS` | 401 | 로그인 정보 불일치 |
| `FORBIDDEN` | 403 | 권한 부족 (RBAC 거부) |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `CONFLICT` | 409 | 중복/참조 충돌 |
| `RATE_LIMITED` | 429 | 요청 한도 초과 |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |

### C. ID 형식

모든 엔티티 ID는 접두사 + ULID 형식을 사용합니다:

| Entity | Prefix | Example |
|--------|--------|---------|
| Admin | `adm_` | `adm_01HX3K8M2P` |
| Book | `bk_` | `bk_01HX3M1A2B` |
| User | `usr_` | `usr_01HX3N2B3C` |
| Image | `img_` | `img_01HX3K9A7N` |
| Notice | `ntc_` | `ntc_01HX3Q1A2B` |
| Audit Log | `aud_` | `aud_01HX3L0B4Q` |

### D. 화면 식별자

| Screen | 설명 |
|--------|------|
| `main` | 키오스크 메인 (환영) 화면 |
| `search` | 도서 검색 화면 |
| `return` | 도서 반납 화면 |
| `info` | 도서관 안내 화면 |
| `notice` | 공지사항 화면 |

---

> **문서 버전 이력**

| Version | Date | 변경 내용 |
|---------|------|-----------|
| 1.0.0 | 2025-06-27 | 최초 작성 |
