/**
 * 스마트 도서관 시뮬레이터 - 보안 유틸리티 모듈
 *
 * [기능]
 * - XSS 방지 입력값 sanitization
 * - 다양한 입력값 형식 검증 (전화번호, 생년월일, PIN, ISBN 등)
 * - 메모리 기반 레이트 리미팅 (Rate Limiting)
 * - 보안 HTTP 헤더 설정
 * - 요청 본문 크기 검증
 *
 * [시큐어코딩 가이드라인 준수]
 * - KISA(한국인터넷진흥원) 시큐어코딩 가이드 참고
 * - OWASP Top 10 방어 대책 적용
 */

import { NextRequest } from 'next/server';

// ============================================================================
// 상수 정의
// ============================================================================

/** 허용되지 않는 단순 PIN 패턴 목록 (순차, 반복, 대칭) */
const FORBIDDEN_PINS = new Set([
  '1234', '1111', '4321', '0123', '9876', '0000',
  '1212', '1221', '2222', '3333', '4444', '5555',
  '6666', '7777', '8888', '9999', '1000', '2000',
]);

/** 최대 요청 본문 크기 (1MB) - DoS 공격 방지 */
export const MAX_REQUEST_BODY_SIZE = 1 * 1024 * 1024;

/** 레이트 리미팅 기본 설정 */
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1분
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 60; // 분당 60회

/** PIN 브루트포스 방지 레이트 리미팅 설정 */
const PIN_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5분
const PIN_RATE_LIMIT_MAX_REQUESTS = 5; // 5분당 5회

// ============================================================================
// 레이트 리미팅 (Rate Limiting)
// ============================================================================

/** 레이트 리미팅 저장소 - 메모리 기반 (Key: 식별자, Value: 요청 기록 배열) */
const rateLimitMap = new Map<string, number[]>();

/** 레이트 리미팅 정리 인터벌 (10분마다 만료된 기록 삭제) */
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap.entries()) {
    // 최대 윈도우(5분)보다 오래된 기록이 전부면 삭제
    const validTimestamps = timestamps.filter((t) => now - t < PIN_RATE_LIMIT_WINDOW_MS);
    if (validTimestamps.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, validTimestamps);
    }
  }
}, 10 * 60 * 1000);

/**
 * 레이트 리미팅 체크 함수
 * 지정된 시간 윈도우 내 최대 요청 수를 초과하는지 검사합니다.
 *
 * @param key - 레이트 리미팅 식별자 (사용자 ID, IP 주소 등)
 * @param windowMs - 시간 윈도우 (밀리초)
 * @param maxRequests - 윈도우 내 최대 허용 요청 수
 * @returns { allowed: boolean, remaining: number, retryAfterMs: number }
 */
export function checkRateLimit(
  key: string,
  windowMs: number = DEFAULT_RATE_LIMIT_WINDOW_MS,
  maxRequests: number = DEFAULT_RATE_LIMIT_MAX_REQUESTS
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];

  // 윈도우 내의 유효한 타임스탬프만 필터링
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  // 최대 요청 수 초과 시 차단
  if (validTimestamps.length >= maxRequests) {
    const oldestInWindow = validTimestamps[0];
    const retryAfterMs = windowMs - (now - oldestInWindow);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  // 현재 요청 기록 추가
  validTimestamps.push(now);
  rateLimitMap.set(key, validTimestamps);

  return {
    allowed: true,
    remaining: maxRequests - validTimestamps.length,
    retryAfterMs: 0,
  };
}

/**
 * PIN 전용 레이트 리미팅 체크 (브루트포스 공격 방지)
 * 5분당 최대 5회 시도로 제한합니다.
 *
 * @param userId - 사용자 ID
 * @returns 레이트 리미팅 결과
 */
export function checkPinRateLimit(userId: string) {
  return checkRateLimit(
    `pin:${userId}`,
    PIN_RATE_LIMIT_WINDOW_MS,
    PIN_RATE_LIMIT_MAX_REQUESTS
  );
}

// ============================================================================
// 입력값 Sanitization (XSS 방지)
// ============================================================================

/**
 * 문자열 XSS 방지 sanitization
 * HTML 엔티티 이스케이프 및 위험한 패턴 제거
 *
 * @param input - sanitization할 입력 문자열
 * @returns 안전하게 처리된 문자열
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    // HTML 엔티티 이스케이프
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    // 자바스크립트 프로토콜 제거
    .replace(/javascript:/gi, '')
    // 데이터 URI 제거 (이미지 외)
    .replace(/data:(?!image\/)/gi, '')
    // VBScript 제거
    .replace(/vbscript:/gi, '')
    // null 바이트 제거
    .replace(/\0/g, '');
}

/**
 * 객체의 모든 문자열 필드를 재귀적으로 sanitization
 * 중첩된 객체와 배열도 처리합니다.
 *
 * @param obj - sanitization할 객체
 * @returns sanitization된 새 객체 (원본은 변경하지 않음)
 */
export function sanitizeInput(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // 문자열 필드는 XSS 방지 sanitization 적용
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      // 배열의 각 요소를 재귀적으로 처리
      sanitized[key] = value.map((item) =>
        typeof item === 'object' && item !== null && !Array.isArray(item)
          ? sanitizeInput(item as Record<string, unknown>)
          : typeof item === 'string'
            ? sanitizeString(item)
            : item
      );
    } else if (typeof value === 'object' && value !== null) {
      // 중첩 객체를 재귀적으로 처리
      sanitized[key] = sanitizeInput(value as Record<string, unknown>);
    } else {
      // 숫자, 불린 등은 그대로 유지
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ============================================================================
// 입력값 검증 (Validation)
// ============================================================================

/**
 * CUID 형식 ID 검증
 * Prisma에서 생성하는 CUID 형식인지 확인합니다.
 *
 * @param id - 검증할 ID 문자열
 * @returns 유효하면 true
 */
export function validateCuid(id: string): boolean {
  // CUID 형식: 소문자 알파벳 + 숫자, 길이 7~30
  return typeof id === 'string' && /^[a-z0-9]{7,30}$/.test(id);
}

/**
 * 한국 전화번호 형식 검증
 * 010-XXXX-XXXX 또는 숫자 10~11자리 형식을 지원합니다.
 *
 * @param phone - 검증할 전화번호
 * @returns 유효하면 true
 */
export function validatePhoneNumber(phone: string): boolean {
  if (typeof phone !== 'string') return false;
  // 하이픈 제거 후 숫자만 추출
  const digits = phone.replace(/[^0-9]/g, '');
  // 10~11자리 숫자 (휴대전화: 010으로 시작하는 11자리, 유선: 10자리)
  return /^\d{10,11}$/.test(digits);
}

/**
 * 생년월일 검증
 * YYYYMMDD 또는 YYYY-MM-DD 형식을 지원하며, 과거 날짜인지 확인합니다.
 *
 * @param date - 검증할 생년월일 문자열
 * @returns 유효하면 true
 */
export function validateBirthDate(date: string): boolean {
  if (typeof date !== 'string') return false;

  // 하이픈 제거
  const cleaned = date.replace(/-/g, '');

  // 8자리 숫자인지 확인
  if (!/^\d{8}$/.test(cleaned)) return false;

  const year = parseInt(cleaned.substring(0, 4), 10);
  const month = parseInt(cleaned.substring(4, 6), 10);
  const day = parseInt(cleaned.substring(6, 8), 10);

  // 년도 범위 검증 (1900년 ~ 현재년도)
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) return false;

  // 월 범위 검증
  if (month < 1 || month > 12) return false;

  // 일 범위 검증 (간단한 검증, 윤년 등은 Date 객체로 확인)
  const testDate = new Date(year, month - 1, day);
  if (testDate.getFullYear() !== year || testDate.getMonth() !== month - 1 || testDate.getDate() !== day) {
    return false;
  }

  // 미래 날짜 거부
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (testDate > today) return false;

  return true;
}

/**
 * 4자리 PIN 검증
 * 숫자 4자리이며, 단순 패턴(연속, 반복 등)을 거부합니다.
 *
 * @param pin - 검증할 PIN 문자열
 * @returns 유효하면 true
 */
export function validatePin(pin: string): boolean {
  if (typeof pin !== 'string') return false;
  if (!/^\d{4}$/.test(pin)) return false;

  // 금지된 단순 패턴 검사
  if (FORBIDDEN_PINS.has(pin)) return false;

  // 4자리 모두 같은 숫자인지 검사
  if (/^(.)\1{3}$/.test(pin)) return false;

  // 연속된 숫자 패턴 검사 (예: 1234, 2345, 3456, 4567, 5678, 6789)
  const digits = pin.split('').map(Number);
  let isSequential = true;
  const diff = digits[1] - digits[0];
  for (let i = 2; i < 4; i++) {
    if (digits[i] - digits[i - 1] !== diff) {
      isSequential = false;
      break;
    }
  }
  if (isSequential && Math.abs(diff) === 1) return false;

  return true;
}

/**
 * ISBN 형식 검증
 * 10자리 또는 13자리 ISBN 형식을 지원합니다.
 *
 * @param isbn - 검증할 ISBN 문자열
 * @returns 유효하면 true
 */
export function validateIsbn(isbn: string): boolean {
  if (typeof isbn !== 'string') return false;
  // 하이픈 제거
  const cleaned = isbn.replace(/-/g, '');
  // ISBN-10 또는 ISBN-13
  return /^\d{10}$/.test(cleaned) || /^\d{13}$/.test(cleaned);
}

/**
 * 날짜 범위 검증
 * 시작일이 종료일보다 이전이거나 같은지 확인합니다.
 *
 * @param startDate - 시작일 문자열 (YYYY-MM-DD)
 * @param endDate - 종료일 문자열 (YYYY-MM-DD)
 * @returns 유효하면 true
 */
export function validateDateRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

  return start <= end;
}

/**
 * 이름 검증
 * 한글, 영문, 공백만 허용하며 길이를 제한합니다.
 *
 * @param name - 검증할 이름
 * @returns 유효하면 true
 */
export function validateName(name: string): boolean {
  if (typeof name !== 'string') return false;
  // 한글, 영문(대소문자), 공백만 허용, 2~50자
  return /^[가-힣a-zA-Z\s]{2,50}$/.test(name.trim());
}

// ============================================================================
// 요청 검증
// ============================================================================

/**
 * 요청 본문 크기 검증
 * 대용량 요청으로 인한 DoS 공격을 방지합니다.
 *
 * @param request - Next.js 요청 객체
 * @param maxSize - 최대 허용 크기 (바이트), 기본값 1MB
 * @returns 본문 크기가 허용 범위 내이면 true
 */
export async function validateRequestBodySize(
  request: NextRequest,
  maxSize: number = MAX_REQUEST_BODY_SIZE
): Promise<boolean> {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxSize) return false;
  }
  return true;
}

/**
 * Content-Type 검증
 * 요청이 JSON 형식인지 확인합니다.
 *
 * @param request - Next.js 요청 객체
 * @returns JSON 요청이면 true
 */
export function validateJsonContentType(request: NextRequest): boolean {
  const contentType = request.headers.get('content-type') || '';
  return contentType.includes('application/json');
}

// ============================================================================
// 보안 HTTP 헤더
// ============================================================================

/**
 * 보안 HTTP 헤더 설정
 * OWASP 권장 보안 헤더와 KISA 시큐어코딩 가이드를 기반으로 설정합니다.
 */
export const SECURITY_HEADERS = {
  /**
   * Content-Security-Policy (CSP)
   * XSS, 데이터 삽입, 클릭재킹 등을 방지하는 콘텐츠 보안 정책
   */
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js 런타임에 필요
    "style-src 'self' 'unsafe-inline'", // Tailwind CSS 런타임에 필요
    "img-src 'self' data: blob:", // 이미지 출처 제한
    "font-src 'self' data:", // 폰트 출처 제한
    "connect-src 'self'", // API 연결 제한 (PWA에서는 필요에 따라 확장)
    "frame-ancestors 'none'", // 클릭재킹 방지
    "base-uri 'self'", // Base URI 태그 제한
    "form-action 'self'", // 폼 제출 대상 제한
  ].join('; '),

  /**
   * X-Frame-Options
   * 클릭재킹(Clickjacking) 공격 방지
   */
  'X-Frame-Options': 'DENY',

  /**
   * X-Content-Type-Options
   * MIME 스니핑(MIME Sniffing) 공격 방지
   */
  'X-Content-Type-Options': 'nosniff',

  /**
   * Referrer-Policy
   * 리퍼러 정보 유출 방지
   */
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  /**
   * Permissions-Policy
   * 브라우저 기능 접근 권한 제어
   */
  'Permissions-Policy': [
    'camera=()', // 카메라 비활성화
    'microphone=()', // 마이크 비활성화
    'geolocation=()', // 위치 정보 비활성화
    'payment=()', // 결제 API 비활성화
  ].join(', '),

  /**
   * X-XSS-Protection
   * 레거시 브라우저 XSS 필터 활성화 (모던 브라우저는 CSP로 대체)
   */
  'X-XSS-Protection': '1; mode=block',

  /**
   * Strict-Transport-Security (HSTS)
 * HTTPS 강제 사용 (운영 환경에서만 적용 권장)
 */
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  /**
   * X-Permitted-Cross-Domain-Policies
   * 크로스도메인 정책 파일 로딩 제한 (Flash 등)
   */
  'X-Permitted-Cross-Domain-Policies': 'none',

  /**
   * Cross-Origin-Opener-Policy
   * 크로스 도메인 윈도우 열기 보호
   */
  'Cross-Origin-Opener-Policy': 'same-origin',

  /**
   * Cross-Origin-Resource-Policy
   * 크로스 도메인 리소스 로딩 제한
   */
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const;

/**
 * 보안 헤더를 HeadersInit 형식으로 반환합니다.
 * Next.js 미들웨어 및 Response 헤더에 직접 적용할 수 있습니다.
 *
 * @returns 보안 헤더가 포함된 HeadersInit 객체
 */
export function getSecurityHeaders(): Record<string, string> {
  return { ...SECURITY_HEADERS };
}

// ============================================================================
// 클라이언트 IP 추출 유틸리티
// ============================================================================

/**
 * 클라이언트 IP 주소 추출
 * 프록시 환경에서도 올바른 클라이언트 IP를 추출합니다.
 *
 * @param request - Next.js 요청 객체
 * @returns 클라이언트 IP 주소 문자열
 */
export function getClientIp(request: NextRequest): string {
  // X-Forwarded-For 헤더에서 첫 번째 IP 추출 (프록시 환경)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // X-Real-IP 헤더 확인 (Nginx 등)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // 직접 연결의 경우
  return '127.0.0.1';
}
