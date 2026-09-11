# 백엔드 관리자 대시보드 API 명세서

> 스마트 도서관 무인 키오스크 시뮬레이터 — 백엔드 관리자 대시보드 API Specification
> Version: 1.0.0
> Base URL: `http://localhost:3000`
> 모든 `/api/admin/*` 엔드포인트는 JWT 인증 및 RBAC 권한 검사가 필요합니다.
> 기존 키오스크 API (`/api/books`, `/api/loans`, `/api/users`, `/api/seed`)는 그대로 유지됩니다.

---

## 목차

1. [공통 사항](#1-공통-사항)
2. [Admin 인증 API](#2-admin-인증-api)
3. [콘텐츠 관리 API (CMS)](#3-콘텐츠-관리-api-cms)
4. [공개 콘텐츠 API (키오스크용)](#4-공개-콘텐츠-api-키오스크용)
5. [관리자 사용자 관리 API](#5-관리자-사용자-관리-api)
6. [도서 관리 API (확장)](#6-도서-관리-api-확장)
7. [이용자 관리 API (확장)](#7-이용자-관리-api-확장)
8. [분석 API](#8-분석-api)
9. [시스템 설정 API](#9-시스템-설정-api)
10. [감사 로그 API](#10-감사-로그-api)
11. [미디어 관리 API](#11-미디어-관리-api)
12. [알림 API](#12-알림-api)
13. [키오스크 원격 제어 API](#13-키오스크-원격-제어-api)
14. [Rate Limit 명세](#14-rate-limit-명세)
15. [RBAC 권한 매트릭스](#15-rbac-권한-매트릭스)

---

## 1. 공통 사항

### 1.1 인증 헤더

모든 `/api/admin/*` 엔드포인트는 아래 헤더가 필수입니다 (인증 API 제외):

```
Authorization: Bearer {JWT}
```

JWT가 누락되거나 만료된 경우 `401 Unauthorized` 응답이 반환됩니다.

### 1.2 RBAC 권한 체계

| Role | Code | 설명 |
|------|------|------|
| Super Admin | `super_admin` | 모든 권한, 관리자 계정 관리 및 시스템 설정 가능 |
| Admin | `admin` | 콘텐츠/도서/이용자/알림 관리 가능, 설정 읽기 가능 |
| Viewer | `viewer` | 읽기 전용, 통계/로그/콘텐츠 조회만 가능 |

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
| 422 | `VALIDATION_ERROR` | 요청 본문 유효성 검사 실패 |
| 429 | `RATE_LIMITED` | 요청 한도 초과 |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 |

### 1.5 공통 쿼리 파라미터 (Pagination)

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

### 1.6 공통 응답 헤더

```
Content-Type: application/json
X-Request-Id: {uuid}
X-RateLimit-Limit: {limit}
X-RateLimit-Remaining: {remaining}
X-RateLimit-Reset: {epoch}
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000
```

### 1.7 요청 본문 크기 제한

| 대상 | 최대 크기 |
|------|-----------|
| 일반 JSON 요청 | 1MB |
| 이미지 업로드 (`/api/admin/media/upload`) | 10MB |
| CSV 가져오기 (`/api/admin/books/import`) | 5MB |

---

## 2. Admin 인증 API

### 2.1 로그인

```
POST /api/admin/auth/login
```

- **설명**: 관리자 이메일 및 비밀번호로 로그인하여 JWT를 발급받습니다.
- **인증**: 불필요 (공개 엔드포인트)
- **Rate Limit**: 10회/1분 (IP 기준)

**요청 본문:**

```json
{
  "email": "admin@library.go.kr",
  "password": "SecureP@ss123!"
}
```

| 필드 | 타입 | 필수 | 제약 | 설명 |
|------|------|------|------|------|
| `email` | string | ✅ | 유효한 이메일 형식 | 관리자 이메일 |
| `password` | string | ✅ | 최소 8자, 영문+숫자+특수문자 포함 | 비밀번호 |

**응답 200:**

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

**오류 400 — 유효성 오류:**

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

**오류 401 — 자격 증명 불일치:**

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "이메일 또는 비밀번호가 올바르지 않습니다.",
    "details": {}
  }
}
```

**오류 429 — 시도 초과:**

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

- **설명**: 현재 세션의 refreshToken을 무효화하고 로그아웃합니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 20회/1분

**요청 본문:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `refreshToken` | string | ✅ | 무효화할 refresh token |

**응답 200:**

```json
{
  "data": {
    "message": "로그아웃 되었습니다."
  }
}
```

**오류 401:**

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

### 2.3 세션 확인

```
GET /api/admin/auth/session
```

- **설명**: 현재 JWT가 유효한지 확인하고 세션 정보를 반환합니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 30회/1분

**응답 200 — 활성 세션:**

```json
{
  "data": {
    "valid": true,
    "admin": {
      "id": "adm_01HX3K8M2P",
      "email": "admin@library.go.kr",
      "name": "김관리",
      "role": "admin"
    },
    "expiresAt": "2025-06-27T15:30:00Z"
  }
}
```

**응답 200 — 만료된 세션:**

```json
{
  "data": {
    "valid": false,
    "admin": null,
    "expiresAt": null
  }
}
```

**오류 401:**

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

### 2.4 비밀번호 변경

```
POST /api/admin/auth/change-password
```

- **설명**: 현재 비밀번호를 확인한 후 새 비밀번호로 변경합니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 5회/1분

**요청 본문:**

```json
{
  "currentPassword": "OldP@ss123!",
  "newPassword": "NewP@ss456!",
  "confirmPassword": "NewP@ss456!"
}
```

| 필드 | 타입 | 필수 | 제약 | 설명 |
|------|------|------|------|------|
| `currentPassword` | string | ✅ | 최소 8자 | 현재 비밀번호 |
| `newPassword` | string | ✅ | 최소 8자, 영문+숫자+특수문자 포함, currentPassword와 상이 | 새 비밀번호 |
| `confirmPassword` | string | ✅ | newPassword와 일치 | 비밀번호 확인 |

**응답 200:**

```json
{
  "data": {
    "message": "비밀번호가 변경되었습니다."
  }
}
```

**오류 400 — 유효성 오류:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 본문이 올바르지 않습니다.",
    "details": {
      "newPassword": "비밀번호는 영문, 숫자, 특수문자를 포함하여 8자 이상이어야 합니다.",
      "confirmPassword": "비밀번호 확인이 일치하지 않습니다."
    }
  }
}
```

**오류 401 — 현재 비밀번호 불일치:**

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "현재 비밀번호가 올바르지 않습니다.",
    "details": {}
  }
}
```

---

## 3. 콘텐츠 관리 API (CMS)

### 3.1 콘텐츠 목록 조회

```
GET /api/admin/content
```

- **설명**: 모든 콘텐츠 항목을 조회합니다. 화면(screen) 및 타입(type)으로 필터링할 수 있습니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 100회/1분

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|-----------|------|------|------|
| `screen` | string | ❌ | 화면 필터 (`main` / `search` / `return` / `info` / `notice`) |
| `type` | string | ❌ | 타입 필터 (`text` / `image` / `color` / `icon`) |
| `search` | string | ❌ | key 또는 label 검색어 |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 50, max: 200) |

**예시 요청:**

```
GET /api/admin/content?screen=main&type=text&limit=50
```

**응답 200:**

```json
{
  "data": [
    {
      "key": "main.title",
      "label": "메인 화면 제목",
      "value": "스마트 도서관에 오신 것을 환영합니다",
      "defaultValue": "스마트 도서관에 오신 것을 환영합니다",
      "screen": "main",
      "type": "text",
      "version": 3,
      "updatedAt": "2025-06-27T10:00:00Z",
      "updatedBy": {
        "id": "adm_01HX3K8M2P",
        "name": "김관리"
      }
    },
    {
      "key": "main.background_image",
      "label": "메인 배경 이미지",
      "value": "/uploads/img_01HX3K9A7N.jpg",
      "defaultValue": "/uploads/default_bg.jpg",
      "screen": "main",
      "type": "image",
      "version": 1,
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

**오류 401:**

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

### 3.2 단일 콘텐츠 항목 조회

```
GET /api/admin/content/[key]
```

- **설명**: key로 특정 콘텐츠 항목을 조회합니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 100회/1분

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `key` | string | 콘텐츠 항목의 고유 key (예: `main.title`) |

**예시 요청:**

```
GET /api/admin/content/main.title
```

**응답 200:**

```json
{
  "data": {
    "key": "main.title",
    "label": "메인 화면 제목",
    "value": "스마트 도서관에 오신 것을 환영합니다",
    "defaultValue": "스마트 도서관에 오신 것을 환영합니다",
    "screen": "main",
    "type": "text",
    "description": "키오스크 메인 화면 상단에 표시되는 제목 텍스트입니다.",
    "version": 3,
    "updatedAt": "2025-06-27T10:00:00Z",
    "updatedBy": {
      "id": "adm_01HX3K8M2P",
      "name": "김관리"
    }
  }
}
```

**오류 404:**

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
PUT /api/admin/content/[key]
```

- **설명**: 콘텐츠 값을 수정합니다. 변경 시 감사 로그(audit log)가 자동으로 기록되고 버전이 증가합니다.
- **인증**: `admin` 이상
- **Rate Limit**: 50회/1분

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `key` | string | 콘텐츠 항목의 고유 key |

**요청 본문:**

```json
{
  "value": "새로운 도서관에 오신 것을 환영합니다"
}
```

| 필드 | 타입 | 필수 | 제약 | 설명 |
|------|------|------|------|------|
| `value` | string | ✅ | text: 최대 500자, image: 유효한 URL 또는 미디어 ID, color: hex 코드 | 새 값 |

**응답 200:**

```json
{
  "data": {
    "key": "main.title",
    "label": "메인 화면 제목",
    "value": "새로운 도서관에 오신 것을 환영합니다",
    "previousValue": "스마트 도서관에 오신 것을 환영합니다",
    "version": 4,
    "updatedAt": "2025-06-27T15:00:00Z",
    "updatedBy": {
      "id": "adm_01HX3K8M2P",
      "name": "김관리"
    }
  }
}
```

**오류 403:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "접근 권한이 없습니다.",
    "details": {
      "requiredRole": "admin",
      "currentRole": "viewer"
    }
  }
}
```

**오류 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 콘텐츠 항목을 찾을 수 없습니다.",
    "details": { "key": "main.title" }
  }
}
```

---

### 3.4 콘텐츠 일괄 수정

```
POST /api/admin/content/bulk
```

- **설명**: 여러 콘텐츠 항목을 한 번에 수정합니다. 감사 로그는 각 항목별로 개별 기록됩니다.
- **인증**: `admin` 이상
- **Rate Limit**: 20회/1분

**요청 본문:**

```json
{
  "items": [
    { "key": "main.title", "value": "새로운 도서관에 오신 것을 환영합니다" },
    { "key": "main.subtitle", "value": "도서 검색과 대출/반납을 이용할 수 있습니다" },
    { "key": "main.background_image", "value": "/uploads/img_new_bg.jpg" }
  ]
}
```

| 필드 | 타입 | 필수 | 제약 | 설명 |
|------|------|------|------|------|
| `items` | array | ✅ | 1~50개 항목 | 수정할 항목 배열 |
| `items[].key` | string | ✅ | 유효한 콘텐츠 key | 콘텐츠 항목 key |
| `items[].value` | string | ✅ | 타입별 제약参照 | 새 값 |

**응답 200:**

```json
{
  "data": {
    "updated": 3,
    "failed": 0,
    "results": [
      { "key": "main.title", "success": true, "version": 4 },
      { "key": "main.subtitle", "success": true, "version": 2 },
      { "key": "main.background_image", "success": true, "version": 2 }
    ]
  }
}
```

**오류 400 — 항목 수 초과:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "한 번에 최대 50개 항목까지 수정할 수 있습니다.",
    "details": { "maxItems": 50, "provided": 55 }
  }
}
```

---

### 3.5 콘텐츠 버전 이력 조회

```
GET /api/admin/content/versions/[key]
```

- **설명**: 특정 콘텐츠 항목의 변경 이력(버전)을 조회합니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 50회/1분

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `key` | string | 콘텐츠 항목의 고유 key |

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|-----------|------|------|------|
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 20, max: 100) |

**응답 200:**

```json
{
  "data": [
    {
      "version": 4,
      "value": "새로운 도서관에 오신 것을 환영합니다",
      "previousValue": "스마트 도서관에 오신 것을 환영합니다",
      "updatedBy": {
        "id": "adm_01HX3K8M2P",
        "name": "김관리"
      },
      "updatedAt": "2025-06-27T15:00:00Z"
    },
    {
      "version": 3,
      "value": "스마트 도서관에 오신 것을 환영합니다",
      "previousValue": "도서관 키오스크",
      "updatedBy": {
        "id": "adm_01HX2A5B7Q",
        "name": "이관리"
      },
      "updatedAt": "2025-06-25T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 4,
    "totalPages": 1
  }
}
```

**오류 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 콘텐츠 항목을 찾을 수 없습니다.",
    "details": { "key": "main.title" }
  }
}
```

---

### 3.6 콘텐츠 항목 기본값 초기화

```
POST /api/admin/content/reset/[key]
```

- **설명**: 콘텐츠 항목을 기본값(defaultValue)으로 초기화합니다.
- **인증**: `admin` 이상
- **Rate Limit**: 30회/1분

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `key` | string | 콘텐츠 항목의 고유 key |

**요청 본문:** 없음

**응답 200:**

```json
{
  "data": {
    "key": "main.title",
    "value": "스마트 도서관에 오신 것을 환영합니다",
    "previousValue": "새로운 도서관에 오신 것을 환영합니다",
    "resetToDefault": true,
    "version": 5,
    "updatedAt": "2025-06-27T16:00:00Z"
  }
}
```

**오류 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 콘텐츠 항목을 찾을 수 없습니다.",
    "details": { "key": "main.title" }
  }
}
```

---

## 4. 공개 콘텐츠 API (키오스크용)

> 이 API 그룹은 키오스크에서 호출하는 공개 엔드포인트로, 인증이 필요하지 않습니다.

### 4.1 키오스크 콘텐츠 전체 조회

```
GET /api/content
```

- **설명**: 키오스크에서 사용할 전체 콘텐츠를 조회합니다. 화면별로 그룹화되어 반환됩니다.
- **인증**: 불필요 (공개 엔드포인트)
- **Rate Limit**: 200회/1분
- **Cache**: `Cache-Control: public, max-age=60, s-maxage=300`

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|-----------|------|------|------|
| `screen` | string | ❌ | 특정 화면만 조회 (`main` / `search` / `return` / `info` / `notice`) |

**응답 200:**

```json
{
  "data": {
    "main": {
      "title": "스마트 도서관에 오신 것을 환영합니다",
      "subtitle": "도서 검색과 대출/반납을 이용할 수 있습니다",
      "background_image": "/uploads/img_01HX3K9A7N.jpg"
    },
    "search": {
      "title": "도서 검색",
      "placeholder": "도서명 또는 저자를 입력하세요"
    },
    "return": {
      "title": "도서 반납",
      "instruction": "반납할 도서를 아래에 놓아주세요"
    },
    "info": {
      "title": "도서관 안내",
      "operating_hours": "09:00 ~ 18:00"
    }
  },
  "version": "a1b2c3d4",
  "updatedAt": "2025-06-27T10:00:00Z"
}
```

---

### 4.2 콘텐츠 버전 해시 조회

```
GET /api/content/version
```

- **설명**: 현재 콘텐츠의 버전 해시를 반환합니다. 키오스크는 폴링으로 해시가 변경되었는지 확인 후 전체 콘텐츠를 다시 가져올 수 있습니다.
- **인증**: 불필요 (공개 엔드포인트)
- **Rate Limit**: 600회/1분 (10초 간격 폴링 지원)
- **Cache**: `Cache-Control: public, max-age=10`

**응답 200:**

```json
{
  "data": {
    "version": "a1b2c3d4",
    "updatedAt": "2025-06-27T10:00:00Z"
  }
}
```

> **폴링 사용 예시**: 키오스크는 10초 간격으로 `GET /api/content/version`을 호출하여 `version` 해시를 비교합니다. 해시가 변경된 경우에만 `GET /api/content`를 호출하여 콘텐츠를 갱신합니다.

---

## 5. 관리자 사용자 관리 API

### 5.1 관리자 목록 조회

```
GET /api/admin/users
```

- **설명**: 관리자 계정 목록을 조회합니다.
- **인증**: `super_admin` 전용
- **Rate Limit**: 50회/1분

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|-----------|------|------|------|
| `role` | string | ❌ | 역할 필터 (`super_admin` / `admin` / `viewer`) |
| `search` | string | ❌ | 이름 또는 이메일 검색 |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 20) |

**응답 200:**

```json
{
  "data": [
    {
      "id": "adm_01HX3K8M2P",
      "email": "admin@library.go.kr",
      "name": "김관리",
      "role": "admin",
      "isActive": true,
      "lastLoginAt": "2025-06-27T14:30:00Z",
      "createdAt": "2024-01-15T09:00:00Z"
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

**오류 403:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "접근 권한이 없습니다.",
    "details": {
      "requiredRole": "super_admin",
      "currentRole": "admin"
    }
  }
}
```

---

### 5.2 관리자 계정 생성

```
POST /api/admin/users
```

- **설명**: 새 관리자 계정을 생성합니다.
- **인증**: `super_admin` 전용
- **Rate Limit**: 10회/1분

**요청 본문:**

```json
{
  "email": "newadmin@library.go.kr",
  "name": "박관리",
  "password": "InitialP@ss1!",
  "role": "viewer"
}
```

| 필드 | 타입 | 필수 | 제약 | 설명 |
|------|------|------|------|------|
| `email` | string | ✅ | 유효한 이메일, 중복 불가 | 관리자 이메일 |
| `name` | string | ✅ | 2~50자 | 관리자 이름 |
| `password` | string | ✅ | 최소 8자, 영문+숫자+특수문자 | 초기 비밀번호 |
| `role` | string | ✅ | `admin` / `viewer` | 역할 (`super_admin`은 생성 불가) |

**응답 201:**

```json
{
  "data": {
    "id": "adm_01HX4L9N3Q",
    "email": "newadmin@library.go.kr",
    "name": "박관리",
    "role": "viewer",
    "isActive": true,
    "createdAt": "2025-06-27T16:00:00Z"
  }
}
```

**오류 409 — 이메일 중복:**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "이미 사용 중인 이메일입니다.",
    "details": { "email": "newadmin@library.go.kr" }
  }
}
```

**오류 422 — 유효성 오류:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "role이 올바르지 않습니다.",
    "details": { "role": "super_admin 역할은 이 엔드포인트에서 지정할 수 없습니다." }
  }
}
```

---

### 5.3 관리자 계정 수정

```
PUT /api/admin/users/[id]
```

- **설명**: 관리자 계정 정보를 수정합니다.
- **인증**: `super_admin` 전용
- **Rate Limit**: 20회/1분

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `id` | string | 관리자 ID (예: `adm_01HX3K8M2P`) |

**요청 본문:**

```json
{
  "name": "김관리자",
  "role": "admin",
  "isActive": true
}
```

| 필드 | 타입 | 필수 | 제약 | 설명 |
|------|------|------|------|------|
| `name` | string | ❌ | 2~50자 | 이름 |
| `role` | string | ❌ | `admin` / `viewer` | 역할 변경 |
| `isActive` | boolean | ❌ | — | 계정 활성/비활성 |

**응답 200:**

```json
{
  "data": {
    "id": "adm_01HX3K8M2P",
    "email": "admin@library.go.kr",
    "name": "김관리자",
    "role": "admin",
    "isActive": true,
    "updatedAt": "2025-06-27T17:00:00Z"
  }
}
```

**오류 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 관리자를 찾을 수 없습니다.",
    "details": { "id": "adm_invalid" }
  }
}
```

---

### 5.4 관리자 계정 삭제

```
DELETE /api/admin/users/[id]
```

- **설명**: 관리자 계정을 삭제합니다. 자기 자신은 삭제할 수 없습니다.
- **인증**: `super_admin` 전용
- **Rate Limit**: 10회/1분

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `id` | string | 관리자 ID |

**응답 200:**

```json
{
  "data": {
    "message": "관리자 계정이 삭제되었습니다.",
    "deletedId": "adm_01HX4L9N3Q"
  }
}
```

**오류 400 — 자기 자신 삭제:**

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "자기 자신의 계정은 삭제할 수 없습니다.",
    "details": {}
  }
}
```

**오류 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 관리자를 찾을 수 없습니다.",
    "details": { "id": "adm_invalid" }
  }
}
```

---

## 6. 도서 관리 API (확장)

### 6.1 도서 목록 조회 (관리자)

```
GET /api/admin/books
```

- **설명**: 도서 목록을 관리자 상세 정보와 함께 조회합니다. 기존 `/api/books`와 달리 대출 현황, 등록일 등 관리 메타데이터가 포함됩니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 100회/1분

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|-----------|------|------|------|
| `search` | string | ❌ | 도서명/저자/ISBN 검색 |
| `category` | string | ❌ | 카테고리 필터 |
| `status` | string | ❌ | 재고 상태 필터 (`available` / `unavailable` / `all`) |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 20) |
| `sortBy` | string | ❌ | 정렬 필드 (default: `createdAt`) |
| `sortOrder` | string | ❌ | 정렬 방향 (`asc` / `desc`, default: `desc`) |

**응답 200:**

```json
{
  "data": [
    {
      "id": "clxxxx...",
      "isbn": "9788954621948",
      "title": "연금술사",
      "author": "파울로 코엘료",
      "publisher": "문학동네",
      "publishYear": 2015,
      "category": "소설",
      "coverUrl": "https://images.unsplash.com/...",
      "totalCopies": 3,
      "availableCopies": 2,
      "shelfLocation": "A-01-03",
      "activeLoanCount": 1,
      "totalLoanCount": 12,
      "createdAt": "2024-01-10T08:00:00Z",
      "updatedAt": "2025-06-20T14:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

---

### 6.2 도서 생성

```
POST /api/admin/books
```

- **설명**: 새 도서를 등록합니다. 이미지 업로드를 지원합니다.
- **인증**: `admin` 이상
- **Rate Limit**: 30회/1분

**요청 본문 (multipart/form-data):**

| 필드 | 타입 | 필수 | 제약 | 설명 |
|------|------|------|------|------|
| `isbn` | string | ✅ | 13자리 숫자, 중복 불가 | ISBN |
| `title` | string | ✅ | 1~200자 | 도서명 |
| `author` | string | ✅ | 1~100자 | 저자 |
| `publisher` | string | ❌ | 최대 100자 | 출판사 |
| `publishYear` | integer | ❌ | 1900~현재년도 | 출판년도 |
| `category` | string | ✅ | 유효한 카테고리 | 카테고리 |
| `totalCopies` | integer | ✅ | 1~100 | 총 권수 |
| `shelfLocation` | string | ❌ | 최대 20자 | 서가 위치 |
| `coverImage` | File | ❌ | JPG/PNG/WebP, 최대 10MB | 표지 이미지 파일 |

**응답 201:**

```json
{
  "data": {
    "id": "clxxxx_new...",
    "isbn": "9788954621955",
    "title": "새로운 도서",
    "author": "저자명",
    "publisher": "출판사명",
    "publishYear": 2024,
    "category": "소설",
    "coverUrl": "/uploads/books/clxxxx_new_cover.jpg",
    "totalCopies": 1,
    "availableCopies": 1,
    "shelfLocation": "A-02-01",
    "createdAt": "2025-06-27T17:00:00Z"
  }
}
```

**오류 409 — ISBN 중복:**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "이미 등록된 ISBN입니다.",
    "details": { "isbn": "9788954621955" }
  }
}
```

---

### 6.3 도서 수정

```
PUT /api/admin/books/[id]
```

- **설명**: 도서 정보를 수정합니다. 이미지 교체도 지원합니다.
- **인증**: `admin` 이상
- **Rate Limit**: 30회/1분

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `id` | string | 도서 ID (CUID) |

**요청 본문 (multipart/form-data):**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `title` | string | ❌ | 도서명 |
| `author` | string | ❌ | 저자 |
| `publisher` | string | ❌ | 출판사 |
| `publishYear` | integer | ❌ | 출판년도 |
| `category` | string | ❌ | 카테고리 |
| `totalCopies` | integer | ❌ | 총 권수 (현재 대출 중 권수보다 크거나 같아야 함) |
| `shelfLocation` | string | ❌ | 서가 위치 |
| `coverImage` | File | ❌ | 표지 이미지 (교체 시에만 전송) |

**응답 200:**

```json
{
  "data": {
    "id": "clxxxx...",
    "isbn": "9788954621948",
    "title": "연금술사 (개정판)",
    "author": "파울로 코엘료",
    "publisher": "문학동네",
    "totalCopies": 5,
    "availableCopies": 3,
    "updatedAt": "2025-06-27T18:00:00Z"
  }
}
```

**오류 400 — 권수 오류:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "총 권수는 현재 대출 중인 권수(2)보다 크거나 같아야 합니다.",
    "details": { "activeLoans": 2, "requestedTotalCopies": 1 }
  }
}
```

---

### 6.4 도서 삭제

```
DELETE /api/admin/books/[id]
```

- **설명**: 도서를 삭제합니다. 활성 대출이 있는 도서는 삭제할 수 없습니다.
- **인증**: `admin` 이상
- **Rate Limit**: 10회/1분

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `id` | string | 도서 ID (CUID) |

**응답 200:**

```json
{
  "data": {
    "message": "도서가 삭제되었습니다.",
    "deletedId": "clxxxx..."
  }
}
```

**오류 400 — 활성 대출 존재:**

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "활성 대출이 있는 도서는 삭제할 수 없습니다.",
    "details": { "activeLoanCount": 2 }
  }
}
```

---

### 6.5 도서 CSV 가져오기

```
POST /api/admin/books/import
```

- **설명**: CSV 파일로 도서 데이터를 일괄 등록합니다.
- **인증**: `admin` 이상
- **Rate Limit**: 5회/1분

**요청 본문 (multipart/form-data):**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `file` | File | ✅ | CSV 파일 (최대 5MB, 최대 500행) |

**CSV 컬럼 형식:**

```
isbn,title,author,publisher,publishYear,category,totalCopies,shelfLocation
9788954621955,새도서,저자명,출판사명,2024,소설,3,A-03-01
```

**응답 200:**

```json
{
  "data": {
    "total": 25,
    "imported": 22,
    "skipped": 2,
    "errors": 1,
    "details": [
      { "row": 3, "isbn": "978INVALID", "error": "ISBN 형식이 올바르지 않습니다." },
      { "row": 5, "isbn": "9788954621948", "error": "이미 등록된 ISBN입니다." }
    ]
  }
}
```

---

### 6.6 도서 CSV 내보내기

```
GET /api/admin/books/export
```

- **설명**: 도서 데이터를 CSV 파일로 내보냅니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 10회/1분

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|-----------|------|------|------|
| `category` | string | ❌ | 카테고리 필터 |
| `status` | string | ❌ | 재고 상태 필터 |

**응답 200:**

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="books_export_20250627.csv"
```

```csv
isbn,title,author,publisher,publishYear,category,totalCopies,availableCopies,shelfLocation
9788954621948,연금술사,파울로 코엘료,문학동네,2015,소설,3,2,A-01-03
...
```

---

## 7. 이용자 관리 API (확장)

### 7.1 키오스크 이용자 목록 조회

```
GET /api/admin/kiosk-users
```

- **설명**: 키오스크 이용자(SimUser) 목록을 조회합니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 100회/1분

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|-----------|------|------|------|
| `search` | string | ❌ | 이름/전화번호/카드번호 검색 |
| `isActive` | boolean | ❌ | 활성 상태 필터 |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 20) |

**응답 200:**

```json
{
  "data": [
    {
      "id": "clxxxx...",
      "name": "김도서관",
      "birthDate": "1960-05-15",
      "phone": "010-1234-5678",
      "cardNumber": "LIB-2025-001",
      "cardIssued": "2025-01-15T00:00:00.000Z",
      "isActive": true,
      "activeLoanCount": 1,
      "totalLoanCount": 5,
      "overdueCount": 0,
      "createdAt": "2025-01-15T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 48,
    "totalPages": 3
  }
}
```

---

### 7.2 키오스크 이용자 수정

```
PUT /api/admin/kiosk-users/[id]
```

- **설명**: 키오스크 이용자 정보를 수정합니다.
- **인증**: `admin` 이상
- **Rate Limit**: 30회/1분

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `id` | string | 이용자 ID (CUID) |

**요청 본문:**

```json
{
  "name": "김도서관",
  "phone": "010-1234-9999",
  "isActive": true
}
```

| 필드 | 타입 | 필수 | 제약 | 설명 |
|------|------|------|------|------|
| `name` | string | ❌ | 2~50자 | 이름 |
| `phone` | string | ❌ | `010-XXXX-XXXX` 형식 | 전화번호 |
| `isActive` | boolean | ❌ | — | 활성 상태 |

**응답 200:**

```json
{
  "data": {
    "id": "clxxxx...",
    "name": "김도서관",
    "phone": "010-1234-9999",
    "isActive": true,
    "updatedAt": "2025-06-27T18:30:00Z"
  }
}
```

**오류 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 이용자를 찾을 수 없습니다.",
    "details": { "id": "clxxxx_invalid" }
  }
}
```

---

### 7.3 키오스크 이용자 비활성화

```
DELETE /api/admin/kiosk-users/[id]
```

- **설명**: 키오스크 이용자를 비활성화합니다. 활성 대출이 있는 경우 비활성화할 수 없습니다. 데이터는 삭제되지 않고 `isActive`가 `false`로 변경됩니다.
- **인증**: `admin` 이상
- **Rate Limit**: 10회/1분

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `id` | string | 이용자 ID (CUID) |

**응답 200:**

```json
{
  "data": {
    "id": "clxxxx...",
    "name": "김도서관",
    "isActive": false,
    "message": "이용자가 비활성화되었습니다."
  }
}
```

**오류 400 — 활성 대출 존재:**

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "활성 대출이 있는 이용자는 비활성화할 수 없습니다.",
    "details": { "activeLoanCount": 1 }
  }
}
```

---

## 8. 분석 API

### 8.1 대시보드 개요 통계

```
GET /api/admin/analytics/overview
```

- **설명**: 대시보드 메인에 표시할 종합 통계를 조회합니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 60회/1분

**응답 200:**

```json
{
  "data": {
    "totalBooks": 15,
    "totalUsers": 48,
    "activeLoans": 12,
    "overdueLoans": 2,
    "todayLoans": 3,
    "todayReturns": 5,
    "availableBooks": 13,
    "avgLoanPeriod": 11.2,
    "peakHour": 14,
    "lastUpdated": "2025-06-27T18:00:00Z"
  }
}
```

---

### 8.2 대출 통계

```
GET /api/admin/analytics/loans
```

- **설명**: 대출 관련 상세 통계를 조회합니다. 기간별 추이와 누적 데이터를 제공합니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 60회/1분

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|-----------|------|------|------|
| `period` | string | ❌ | 통계 기간 (`daily` / `weekly` / `monthly`, default: `daily`) |
| `startDate` | string | ❌ | 시작일 (ISO 8601, default: 30일 전) |
| `endDate` | string | ❌ | 종료일 (ISO 8601, default: 오늘) |

**응답 200:**

```json
{
  "data": {
    "summary": {
      "totalLoans": 156,
      "totalReturns": 142,
      "totalOverdue": 8,
      "avgDailyLoans": 5.2,
      "avgDailyReturns": 4.7
    },
    "trend": [
      { "date": "2025-06-27", "loans": 7, "returns": 5, "overdue": 1 },
      { "date": "2025-06-26", "loans": 4, "returns": 6, "overdue": 0 },
      { "date": "2025-06-25", "loans": 5, "returns": 3, "overdue": 2 }
    ],
    "period": "daily",
    "startDate": "2025-05-28",
    "endDate": "2025-06-27"
  }
}
```

---

### 8.3 도서 통계

```
GET /api/admin/analytics/books
```

- **설명**: 인기 도서, 카테고리 분포 등 도서 관련 통계를 조회합니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 60회/1분

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|-----------|------|------|------|
| `top` | integer | ❌ | 인기 도서 상위 N권 (default: 10, max: 50) |

**응답 200:**

```json
{
  "data": {
    "popularBooks": [
      {
        "id": "clxxxx...",
        "title": "연금술사",
        "author": "파울로 코엘료",
        "loanCount": 24,
        "currentAvailable": 2
      }
    ],
    "categoryDistribution": [
      { "category": "소설", "count": 5, "percentage": 33.3 },
      { "category": "역사", "count": 3, "percentage": 20.0 },
      { "category": "과학", "count": 3, "percentage": 20.0 },
      { "category": "에세이", "count": 2, "percentage": 13.3 },
      { "category": "경제", "count": 2, "percentage": 13.3 }
    ],
    "lowStockBooks": [
      {
        "id": "clxxxx...",
        "title": "사피엔스",
        "availableCopies": 0,
        "totalCopies": 2
      }
    ]
  }
}
```

---

### 8.4 이용 패턴 통계

```
GET /api/admin/analytics/usage
```

- **설명**: 피크 시간대, 이용 패턴 등 키오스크 사용 통계를 조회합니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 60회/1분

**응답 200:**

```json
{
  "data": {
    "peakHours": [
      { "hour": 9, "avgTransactions": 3.2 },
      { "hour": 10, "avgTransactions": 5.8 },
      { "hour": 14, "avgTransactions": 7.1 },
      { "hour": 15, "avgTransactions": 6.3 }
    ],
    "weeklyPattern": [
      { "day": "월", "avgLoans": 4.2, "avgReturns": 3.8 },
      { "day": "화", "avgLoans": 3.9, "avgReturns": 4.1 },
      { "day": "수", "avgLoans": 5.1, "avgReturns": 4.5 },
      { "day": "목", "avgLoans": 4.8, "avgReturns": 5.2 },
      { "day": "금", "avgLoans": 3.5, "avgReturns": 3.9 }
    ],
    "avgSessionDuration": 120,
    "methodDistribution": {
      "kiosk": 142,
      "counter": 14
    }
  }
}
```

---

## 9. 시스템 설정 API

### 9.1 전체 설정 조회

```
GET /api/admin/settings
```

- **설명**: 키오스크 시스템 설정 전체를 조회합니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 60회/1분

**응답 200:**

```json
{
  "data": {
    "kiosk": {
      "idleTimeout": 120,
      "language": "ko",
      "volume": 80,
      "maintenanceMode": false
    },
    "loan": {
      "maxBooks": 2,
      "loanPeriodDays": 15,
      "extendAllowed": false,
      "overdueBlockDays": true
    },
    "ui": {
      "theme": "light",
      "fontSize": "normal",
      "showAnimations": true
    },
    "notifications": {
      "overdueReminder": true,
      "newBookAlert": false
    },
    "updatedAt": "2025-06-27T10:00:00Z",
    "updatedBy": {
      "id": "adm_01HX3K8M2P",
      "name": "김관리"
    }
  }
}
```

---

### 9.2 설정 항목 수정

```
PUT /api/admin/settings/[key]
```

- **설명**: 특정 설정 항목을 수정합니다. 변경 시 감사 로그가 기록됩니다.
- **인증**: `super_admin` 전용
- **Rate Limit**: 20회/1분

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `key` | string | 설정 항목 key (예: `kiosk.idleTimeout`, `loan.maxBooks`) |

**요청 본문:**

```json
{
  "value": 180
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `value` | any | ✅ | 새 설정 값 (key에 따라 타입 상이) |

**응답 200:**

```json
{
  "data": {
    "key": "kiosk.idleTimeout",
    "value": 180,
    "previousValue": 120,
    "updatedAt": "2025-06-27T19:00:00Z"
  }
}
```

**오류 422 — 유효하지 않은 값:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "설정 값이 올바르지 않습니다.",
    "details": {
      "key": "kiosk.idleTimeout",
      "expectedType": "integer",
      "min": 30,
      "max": 600
    }
  }
}
```

---

### 9.3 유지보수 모드 전환

```
POST /api/admin/settings/maintenance
```

- **설명**: 키오스크 유지보수 모드를 켜거나 끕니다. 유지보수 모드에서는 키오스크에 "현재 시스템 점검 중" 메시지가 표시됩니다.
- **인증**: `super_admin` 전용
- **Rate Limit**: 5회/1분

**요청 본문:**

```json
{
  "enabled": true,
  "message": "시스템 점검 중입니다. 오후 3시에 재개됩니다."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `enabled` | boolean | ✅ | 유지보수 모드 활성화 여부 |
| `message` | string | ❌ | 키오스크에 표시할 안내 메시지 (최대 200자) |

**응답 200:**

```json
{
  "data": {
    "maintenanceMode": true,
    "message": "시스템 점검 중입니다. 오후 3시에 재개됩니다.",
    "updatedAt": "2025-06-27T19:30:00Z"
  }
}
```

---

## 10. 감사 로그 API

### 10.1 감사 로그 목록 조회

```
GET /api/admin/audit
```

- **설명**: 감사 로그를 조회합니다. 모든 관리자 작업(생성/수정/삭제/설정 변경)이 기록됩니다.
- **인증**: `super_admin` 전용
- **Rate Limit**: 30회/1분

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|-----------|------|------|------|
| `userId` | string | ❌ | 작업자 관리자 ID 필터 |
| `action` | string | ❌ | 작업 유형 필터 (`create` / `update` / `delete` / `login` / `logout` / `settings_change`) |
| `entity` | string | ❌ | 대상 엔티티 필터 (`book` / `user` / `admin` / `content` / `settings` / `loan`) |
| `startDate` | string | ❌ | 시작일 (ISO 8601) |
| `endDate` | string | ❌ | 종료일 (ISO 8601) |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 20) |

**응답 200:**

```json
{
  "data": [
    {
      "id": "aud_01HX3M4P5R",
      "action": "update",
      "entity": "content",
      "entityId": "main.title",
      "userId": "adm_01HX3K8M2P",
      "userName": "김관리",
      "details": {
        "previousValue": "스마트 도서관에 오신 것을 환영합니다",
        "newValue": "새로운 도서관에 오신 것을 환영합니다"
      },
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2025-06-27T15:00:00Z"
    },
    {
      "id": "aud_01HX3M6Q8S",
      "action": "login",
      "entity": "admin",
      "entityId": "adm_01HX3K8M2P",
      "userId": "adm_01HX3K8M2P",
      "userName": "김관리",
      "details": {},
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2025-06-27T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 256,
    "totalPages": 13
  }
}
```

**오류 403:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "접근 권한이 없습니다.",
    "details": {
      "requiredRole": "super_admin",
      "currentRole": "admin"
    }
  }
}
```

---

## 11. 미디어 관리 API

### 11.1 이미지 업로드

```
POST /api/admin/media/upload
```

- **설명**: 이미지를 업로드하고 미디어 에셋으로 등록합니다.
- **인증**: `admin` 이상
- **Rate Limit**: 20회/1분

**요청 본문 (multipart/form-data):**

| 필드 | 타입 | 필수 | 제약 | 설명 |
|------|------|------|------|------|
| `file` | File | ✅ | JPG/PNG/WebP/SVG, 최대 10MB | 업로드할 이미지 파일 |
| `alt` | string | ❌ | 최대 200자 | 대체 텍스트 (접근성) |
| `category` | string | ❌ | `cover` / `background` / `icon` / `general` | 미디어 카테고리 |

**응답 201:**

```json
{
  "data": {
    "id": "med_01HX5N7R2T",
    "url": "/uploads/media/med_01HX5N7R2T.jpg",
    "alt": "메인 화면 배경 이미지",
    "category": "background",
    "mimeType": "image/jpeg",
    "size": 245760,
    "width": 1920,
    "height": 1080,
    "uploadedBy": {
      "id": "adm_01HX3K8M2P",
      "name": "김관리"
    },
    "createdAt": "2025-06-27T20:00:00Z"
  }
}
```

**오류 400 — 파일 형식 오류:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "지원하지 않는 파일 형식입니다.",
    "details": {
      "allowedTypes": ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
      "provided": "image/gif"
    }
  }
}
```

**오류 413 — 파일 크기 초과:**

```json
{
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "파일 크기가 10MB를 초과합니다.",
    "details": { "maxSize": "10MB", "providedSize": "15MB" }
  }
}
```

---

### 11.2 미디어 에셋 목록 조회

```
GET /api/admin/media
```

- **설명**: 업로드된 미디어 에셋 목록을 조회합니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 100회/1분

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|-----------|------|------|------|
| `category` | string | ❌ | 카테고리 필터 (`cover` / `background` / `icon` / `general`) |
| `search` | string | ❌ | alt 텍스트 검색 |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 20) |

**응답 200:**

```json
{
  "data": [
    {
      "id": "med_01HX5N7R2T",
      "url": "/uploads/media/med_01HX5N7R2T.jpg",
      "alt": "메인 화면 배경 이미지",
      "category": "background",
      "mimeType": "image/jpeg",
      "size": 245760,
      "width": 1920,
      "height": 1080,
      "createdAt": "2025-06-27T20:00:00Z"
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

---

### 11.3 미디어 에셋 삭제

```
DELETE /api/admin/media/[id]
```

- **설명**: 미디어 에셋을 삭제합니다. 콘텐츠에서 참조 중인 경우 삭제할 수 없습니다.
- **인증**: `admin` 이상
- **Rate Limit**: 10회/1분

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `id` | string | 미디어 에셋 ID |

**응답 200:**

```json
{
  "data": {
    "message": "미디어 에셋이 삭제되었습니다.",
    "deletedId": "med_01HX5N7R2T"
  }
}
```

**오류 400 — 참조 중:**

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "콘텐츠에서 참조 중인 미디어는 삭제할 수 없습니다.",
    "details": {
      "referencedBy": ["main.background_image", "info.header_image"]
    }
  }
}
```

---

## 12. 알림 API

### 12.1 알림 목록 조회

```
GET /api/admin/notifications
```

- **설명**: 관리자 알림 목록을 조회합니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 100회/1분

**쿼리 파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|-----------|------|------|------|
| `isRead` | boolean | ❌ | 읽음 상태 필터 |
| `type` | string | ❌ | 알림 유형 필터 (`system` / `overdue` / `loan` / `alert`) |
| `page` | integer | ❌ | 페이지 번호 (default: 1) |
| `limit` | integer | ❌ | 페이지당 항목 수 (default: 20) |

**응답 200:**

```json
{
  "data": [
    {
      "id": "ntf_01HX6P8S3U",
      "type": "overdue",
      "title": "연체 도서 발생",
      "message": "김도서관님의 '연금술사' 대출이 3일 연체되었습니다.",
      "isRead": false,
      "createdAt": "2025-06-27T14:00:00Z"
    },
    {
      "id": "ntf_01HX6Q9T4V",
      "type": "system",
      "title": "시스템 업데이트",
      "message": "키오스크 소프트웨어 v1.2.0이 배포되었습니다.",
      "isRead": true,
      "readAt": "2025-06-27T10:00:00Z",
      "createdAt": "2025-06-27T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  },
  "unreadCount": 4
}
```

---

### 12.2 알림 읽음 처리

```
PUT /api/admin/notifications/[id]/read
```

- **설명**: 알림을 읽음 상태로 표시합니다.
- **인증**: `viewer` 이상
- **Rate Limit**: 50회/1분

**경로 파라미터:**

| 파라미터 | 타입 | 설명 |
|-----------|------|------|
| `id` | string | 알림 ID |

**요청 본문:** 없음

**응답 200:**

```json
{
  "data": {
    "id": "ntf_01HX6P8S3U",
    "isRead": true,
    "readAt": "2025-06-27T21:00:00Z"
  }
}
```

**오류 404:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 알림을 찾을 수 없습니다.",
    "details": { "id": "ntf_invalid" }
  }
}
```

---

### 12.3 알림 생성

```
POST /api/admin/notifications
```

- **설명**: 새 알림을 생성합니다. 시스템 알림 또는 커스텀 알림을 만들 수 있습니다.
- **인증**: `admin` 이상
- **Rate Limit**: 30회/1분

**요청 본문:**

```json
{
  "type": "system",
  "title": "정기 점검 안내",
  "message": "6월 30일 오전 9시~12시 정기 점검이 예정되어 있습니다."
}
```

| 필드 | 타입 | 필수 | 제약 | 설명 |
|------|------|------|------|------|
| `type` | string | ✅ | `system` / `alert` | 알림 유형 |
| `title` | string | ✅ | 1~100자 | 알림 제목 |
| `message` | string | ✅ | 1~500자 | 알림 내용 |

**응답 201:**

```json
{
  "data": {
    "id": "ntf_01HX7R0U5W",
    "type": "system",
    "title": "정기 점검 안내",
    "message": "6월 30일 오전 9시~12시 정기 점검이 예정되어 있습니다.",
    "isRead": false,
    "createdAt": "2025-06-27T21:30:00Z"
  }
}
```

**오류 422:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 본문이 올바르지 않습니다.",
    "details": {
      "type": "overdue, loan 유형은 시스템에서 자동 생성되므로 직접 생성할 수 없습니다."
    }
  }
}
```

---

## 13. 키오스크 원격 제어 API

### 13.1 키오스크 초기화 (Idle 상태로 복귀)

```
POST /api/admin/kiosk/reset
```

- **설명**: 키오스크를 idle(대기) 상태로 초기화합니다. 진행 중인 작업이 있으면 취소됩니다.
- **인증**: `super_admin` 전용
- **Rate Limit**: 5회/1분

**요청 본문:**

```json
{
  "reason": "화면 멈춤 현상 발생으로 인한 강제 초기화"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `reason` | string | ❌ | 초기화 사유 (최대 200자, 감사 로그에 기록됨) |

**응답 200:**

```json
{
  "data": {
    "message": "키오스크가 초기화되었습니다.",
    "previousState": "loan_select",
    "newState": "idle",
    "resetAt": "2025-06-27T22:00:00Z"
  }
}
```

---

### 13.2 키오스크 재시작

```
POST /api/admin/kiosk/restart
```

- **설명**: 키오스크 애플리케이션을 재시작합니다. WebSocket 연결이 끊어졌다가 재연결됩니다.
- **인증**: `super_admin` 전용
- **Rate Limit**: 3회/10분

**요청 본문:**

```json
{
  "reason": "메모리 사용량 과다로 인한 재시작"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `reason` | string | ❌ | 재시작 사유 (최대 200자) |

**응답 200:**

```json
{
  "data": {
    "message": "키오스크 재시작 요청이 전송되었습니다.",
    "restartingAt": "2025-06-27T22:05:00Z",
    "estimatedDowntime": 10
  }
}
```

**오류 429 — 재시작 쿨다운:**

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "재시작 후 10분이 경과하지 않았습니다. 잠시 후 다시 시도해주세요.",
    "details": {
      "retryAfter": 360
    }
  }
}
```

---

### 13.3 키오스크 상태 확인

```
GET /api/admin/kiosk/health
```

- **설명**: 키오스크의 현재 상태 및 건강 정보를 조회합니다.
- **인증**: `admin` 이상
- **Rate Limit**: 30회/1분

**응답 200 — 정상:**

```json
{
  "data": {
    "status": "healthy",
    "state": "idle",
    "uptime": 86400,
    "lastActivity": "2025-06-27T21:50:00Z",
    "websocket": {
      "connected": true,
      "latency": 12
    },
    "memory": {
      "used": 156,
      "total": 512,
      "percentage": 30.5
    },
    "version": "1.2.0",
    "screen": "idle",
    "checkedAt": "2025-06-27T22:00:00Z"
  }
}
```

**응답 200 — 비정상:**

```json
{
  "data": {
    "status": "degraded",
    "state": "idle",
    "uptime": 86400,
    "lastActivity": "2025-06-27T21:50:00Z",
    "websocket": {
      "connected": false,
      "latency": null
    },
    "memory": {
      "used": 480,
      "total": 512,
      "percentage": 93.8
    },
    "version": "1.2.0",
    "screen": "idle",
    "warnings": [
      "WebSocket 연결이 끊어져 있습니다.",
      "메모리 사용량이 90%를 초과합니다."
    ],
    "checkedAt": "2025-06-27T22:00:00Z"
  }
}
```

---

## 14. Rate Limit 명세

| 엔드포인트 그룹 | 윈도우 | 최대 요청 | 기준 | 비고 |
|---|---|---|---|---|
| `POST /api/admin/auth/login` | 1분 | 10회 | IP | 브루트포스 방지 |
| `POST /api/admin/auth/change-password` | 1분 | 5회 | IP | 비밀번호 변경 제한 |
| `POST /api/admin/auth/logout` | 1분 | 20회 | IP | — |
| `GET /api/admin/auth/session` | 1분 | 30회 | IP | — |
| 콘텐츠 관리 읽기 (`GET /api/admin/content*`) | 1분 | 100회 | JWT | — |
| 콘텐츠 관리 쓰기 (`PUT/POST /api/admin/content*`) | 1분 | 50회 | JWT | — |
| 콘텐츠 일괄 수정 | 1분 | 20회 | JWT | — |
| 공개 콘텐츠 (`GET /api/content`) | 1분 | 200회 | IP | 캐시 적용 |
| 공개 콘텐츠 버전 (`GET /api/content/version`) | 1분 | 600회 | IP | 10초 폴링 지원 |
| 관리자 사용자 관리 읽기 | 1분 | 50회 | JWT | — |
| 관리자 사용자 관리 쓰기 | 1분 | 10회 | JWT | — |
| 도서 관리 읽기 | 1분 | 100회 | JWT | — |
| 도서 관리 쓰기 | 1분 | 30회 | JWT | — |
| 도서 CSV 가져오기 | 1분 | 5회 | JWT | 대량 작업 제한 |
| 도서 CSV 내보내기 | 1분 | 10회 | JWT | — |
| 이용자 관리 읽기 | 1분 | 100회 | JWT | — |
| 이용자 관리 쓰기 | 1분 | 30회 | JWT | — |
| 분석 API | 1분 | 60회 | JWT | — |
| 시스템 설정 읽기 | 1분 | 60회 | JWT | — |
| 시스템 설정 쓰기 | 1분 | 20회 | JWT | — |
| 유지보수 모드 전환 | 1분 | 5회 | JWT | — |
| 감사 로그 | 1분 | 30회 | JWT | — |
| 미디어 업로드 | 1분 | 20회 | JWT | — |
| 미디어 조회 | 1분 | 100회 | JWT | — |
| 미디어 삭제 | 1분 | 10회 | JWT | — |
| 알림 조회 | 1분 | 100회 | JWT | — |
| 알림 쓰기 | 1분 | 30회 | JWT | — |
| 키오스크 초기화 | 1분 | 5회 | JWT | — |
| 키오스크 재시작 | 10분 | 3회 | JWT | 쿨다운 적용 |
| 키오스크 상태 확인 | 1분 | 30회 | JWT | — |
| 전체 공통 제한 | 60초 | 300회 | IP | 전체 요청 상한 |

Rate limit 초과 시 공통 응답:

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

---

## 15. RBAC 권한 매트릭스

### 15.1 역할별 권한

| 권한 (Permission) | `super_admin` | `admin` | `viewer` | 비고 |
|---|:---:|:---:|:---:|---|
| `auth:login` | ✅ | ✅ | ✅ | 공개 엔드포인트 |
| `auth:logout` | ✅ | ✅ | ✅ | — |
| `auth:session` | ✅ | ✅ | ✅ | — |
| `auth:change-password` | ✅ | ✅ | ✅ | — |
| `content:read` | ✅ | ✅ | ✅ | — |
| `content:write` | ✅ | ✅ | ❌ | 콘텐츠 수정/일괄수정/초기화 |
| `content:public` | ✅ | ✅ | ✅ | 공개 콘텐츠 API (인증 불필요) |
| `admin-users:read` | ✅ | ❌ | ❌ | 관리자 계정 조회 |
| `admin-users:write` | ✅ | ❌ | ❌ | 관리자 계정 생성/수정/삭제 |
| `books:read` | ✅ | ✅ | ✅ | 도서 조회 (관리자 상세 포함) |
| `books:write` | ✅ | ✅ | ❌ | 도서 생성/수정/삭제 |
| `books:import` | ✅ | ✅ | ❌ | CSV 가져오기 |
| `books:export` | ✅ | ✅ | ✅ | CSV 내보내기 |
| `kiosk-users:read` | ✅ | ✅ | ✅ | 이용자 조회 |
| `kiosk-users:write` | ✅ | ✅ | ❌ | 이용자 수정/비활성화 |
| `analytics:read` | ✅ | ✅ | ✅ | 분석 통계 조회 |
| `settings:read` | ✅ | ✅ | ✅ | 설정 조회 |
| `settings:write` | ✅ | ❌ | ❌ | 설정 수정 |
| `settings:maintenance` | ✅ | ❌ | ❌ | 유지보수 모드 전환 |
| `audit:read` | ✅ | ❌ | ❌ | 감사 로그 조회 |
| `media:read` | ✅ | ✅ | ✅ | 미디어 조회 |
| `media:write` | ✅ | ✅ | ❌ | 미디어 업로드/삭제 |
| `notifications:read` | ✅ | ✅ | ✅ | 알림 조회 |
| `notifications:write` | ✅ | ✅ | ❌ | 알림 생성 |
| `notifications:read-mark` | ✅ | ✅ | ✅ | 알림 읽음 처리 |
| `kiosk:reset` | ✅ | ❌ | ❌ | 키오스크 초기화 |
| `kiosk:restart` | ✅ | ❌ | ❌ | 키오스크 재시작 |
| `kiosk:health` | ✅ | ✅ | ❌ | 키오스크 상태 확인 |

### 15.2 엔드포인트별 최소 권한

| 엔드포인트 | 메서드 | 최소 권한 | 비고 |
|---|---|---|---|
| `/api/admin/auth/login` | POST | 없음 (공개) | — |
| `/api/admin/auth/logout` | POST | `viewer` | — |
| `/api/admin/auth/session` | GET | `viewer` | — |
| `/api/admin/auth/change-password` | POST | `viewer` | — |
| `/api/admin/content` | GET | `viewer` | — |
| `/api/admin/content/[key]` | GET | `viewer` | — |
| `/api/admin/content/[key]` | PUT | `admin` | — |
| `/api/admin/content/bulk` | POST | `admin` | — |
| `/api/admin/content/versions/[key]` | GET | `viewer` | — |
| `/api/admin/content/reset/[key]` | POST | `admin` | — |
| `/api/content` | GET | 없음 (공개) | 키오스크용 |
| `/api/content/version` | GET | 없음 (공개) | 키오스크용 |
| `/api/admin/users` | GET | `super_admin` | — |
| `/api/admin/users` | POST | `super_admin` | — |
| `/api/admin/users/[id]` | PUT | `super_admin` | — |
| `/api/admin/users/[id]` | DELETE | `super_admin` | — |
| `/api/admin/books` | GET | `viewer` | — |
| `/api/admin/books` | POST | `admin` | — |
| `/api/admin/books/[id]` | PUT | `admin` | — |
| `/api/admin/books/[id]` | DELETE | `admin` | — |
| `/api/admin/books/import` | POST | `admin` | — |
| `/api/admin/books/export` | GET | `viewer` | — |
| `/api/admin/kiosk-users` | GET | `viewer` | — |
| `/api/admin/kiosk-users/[id]` | PUT | `admin` | — |
| `/api/admin/kiosk-users/[id]` | DELETE | `admin` | — |
| `/api/admin/analytics/overview` | GET | `viewer` | — |
| `/api/admin/analytics/loans` | GET | `viewer` | — |
| `/api/admin/analytics/books` | GET | `viewer` | — |
| `/api/admin/analytics/usage` | GET | `viewer` | — |
| `/api/admin/settings` | GET | `viewer` | — |
| `/api/admin/settings/[key]` | PUT | `super_admin` | — |
| `/api/admin/settings/maintenance` | POST | `super_admin` | — |
| `/api/admin/audit` | GET | `super_admin` | — |
| `/api/admin/media/upload` | POST | `admin` | — |
| `/api/admin/media` | GET | `viewer` | — |
| `/api/admin/media/[id]` | DELETE | `admin` | — |
| `/api/admin/notifications` | GET | `viewer` | — |
| `/api/admin/notifications/[id]/read` | PUT | `viewer` | — |
| `/api/admin/notifications` | POST | `admin` | — |
| `/api/admin/kiosk/reset` | POST | `super_admin` | — |
| `/api/admin/kiosk/restart` | POST | `super_admin` | — |
| `/api/admin/kiosk/health` | GET | `admin` | — |

---

## 부록 A: 공통 데이터 타입

### AdminUser

```typescript
interface AdminUser {
  id: string;              // adm_ 접두사 CUID
  email: string;
  name: string;
  role: "super_admin" | "admin" | "viewer";
  isActive: boolean;
  lastLoginAt: string | null;  // ISO 8601
  createdAt: string;           // ISO 8601
  updatedAt: string;           // ISO 8601
}
```

### ContentItem

```typescript
interface ContentItem {
  key: string;             // 예: "main.title"
  label: string;           // 관리자용 표시명
  value: string;           // 현재 값
  defaultValue: string;    // 기본값
  screen: string;          // 화면 식별자
  type: "text" | "image" | "color" | "icon";
  description?: string;    // 항목 설명
  version: number;         // 버전 번호
  updatedAt: string;       // ISO 8601
  updatedBy: {
    id: string;
    name: string;
  };
}
```

### AuditLogEntry

```typescript
interface AuditLogEntry {
  id: string;              // aud_ 접두사 CUID
  action: "create" | "update" | "delete" | "login" | "logout" | "settings_change";
  entity: "book" | "user" | "admin" | "content" | "settings" | "loan" | "media";
  entityId: string;
  userId: string;
  userName: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;       // ISO 8601
}
```

### PaginationMeta

```typescript
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

### ErrorResponse

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}
```

---

## 부록 B: 환경 변수

| 변수명 | 설명 | 기본값 |
|---|---|---|
| `JWT_SECRET` | JWT 서명 비밀키 | — (필수) |
| `JWT_EXPIRES_IN` | Access Token 만료 시간 | `3600` (1시간) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token 만료 시간 | `604800` (7일) |
| `ADMIN_RATE_LIMIT_MAX` | 관리자 API 분당 최대 요청 | `100` |
| `AUTH_RATE_LIMIT_MAX` | 인증 API 분당 최대 요청 | `10` |
| `UPLOAD_MAX_SIZE` | 업로드 최대 크기 (bytes) | `10485760` (10MB) |
| `CSV_MAX_ROWS` | CSV 가져오기 최대 행수 | `500` |
| `MAINTENANCE_MODE` | 유지보수 모드 플래그 | `false` |
| `AUDIT_LOG_ENABLED` | 감사 로그 활성화 | `true` |
