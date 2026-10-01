/**
 * 사용자 API 라우트
 *
 * [GET] /api/users (X-PIN header or ?pin=xxx deprecated) - PIN으로 사용자 조회
 * [POST] /api/users - 회원가입
 *
 * [보안 조치]
 * - Content-Type 검증 (JSON만 허용)
 * - 요청 본문 크기 제한
 * - 입력값 XSS sanitization
 * - 각 필드별 형식 검증
 * - PIN 브루트포스 방지 레이트 리미팅
 * - 레이트 리미팅 (IP 기반)
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { json } from '@/lib/api-helpers';
import {
  sanitizeString,
  sanitizeInput,
  validateName,
  validatePhoneNumber,
  validateBirthDate,
  validatePin,
  checkRateLimit,
  validateRequestBodySize,
  validateJsonContentType,
  getClientIp,
} from '@/lib/security';

/** 레이트 리미팅 식별자 접두사 */
const RATE_LIMIT_PREFIX_SIGNUP = 'signup:';
const RATE_LIMIT_PREFIX_PIN = 'pin-lookup:';

export const dynamic = 'force-dynamic';

/**
 * 카드 번호 생성 함수
 * 8자리 난수를 생성하여 'LIB-' 접두사를 붙입니다.
 */
function generateCardNumber(): string {
  const array = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    array[0] = Math.floor(Math.random() * 90000000) + 10000000;
  }
  const digits = 10000000 + (array[0] % 90000000);
  return `LIB-${digits}`;
}

/**
 * PIN 기반 사용자 조회 GET 핸들러
 * 키오스크 인증에서 사용됩니다.
 */
export async function GET(request: NextRequest) {
  try {
    // [보안] PIN은 URL 쿼리 파라미터 대신 헤더로 전송 권장
    // 쿼리 파라미터 PIN은 서버 로그에 기록될 수 있어 보안상 취약
    const { searchParams } = new URL(request.url);
    const rawPin = (request.headers.get('x-pin') || searchParams.get('pin'))?.trim();

    if (!rawPin) {
      return json({ error: 'pin 파라미터가 필요합니다.' }, 400);
    }

    // [보안] 레이트 리미팅 체크 (PIN 브루트포스 방지: IP당 5분 5회)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`${RATE_LIMIT_PREFIX_PIN}${clientIp}`, 5 * 60 * 1000, 5);
    if (!rateLimit.allowed) {
      return json(
        { error: 'PIN 입력 시도가 너무 많습니다. 5분 후 다시 시도해주세요.' },
        429
      );
    }

    // [보안] PIN sanitization
    const pin = sanitizeString(rawPin);
    if (!/^\d{4}$/.test(pin)) {
      // 형식 오류도 타이밍을 맞춰 열거 완화
      await new Promise((r) => setTimeout(r, 200));
      return json(
        { error: 'PIN은 4자리 숫자여야 합니다.' },
        400
      );
    }

    // [데이터베이스] PIN으로 사용자 조회
    const user = await db.simUser.findUnique({
      where: { pin },
    });

    if (!user) {
      // 존재/비존재 타이밍 균일화
      await new Promise((r) => setTimeout(r, 200));
      return json([]);
    }

    // [보안] 응답에서 PIN 제외
    const { pin: _pin, ...safeUser } = user;
    return json([safeUser]);
  } catch (error) {
    console.error('PIN 사용자 조회 오류:', error);
    return json({ error: '사용자 조회 중 오류가 발생했습니다.' }, 500);
  }
}

/**
 * 회원가입 POST 핸들러
 */
export async function POST(request: NextRequest) {
  try {
    // [보안] 레이트 리미팅 체크
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`${RATE_LIMIT_PREFIX_SIGNUP}${clientIp}`, 60000, 10);
    if (!rateLimit.allowed) {
      return json({ error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' }, 429, { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) });
    }

    // [보안] Content-Type 검증
    if (!validateJsonContentType(request)) {
      return json({ error: '잘못된 요청 형식입니다.' }, 415);
    }

    // [보안] 요청 본문 크기 검증
    if (!(await validateRequestBodySize(request))) {
      return json({ error: '요청 크기가 너무 큽니다.' }, 413);
    }

    const body = await request.json();
    const { name, birthDate, phone, address, pin } = body;

    if (!name || !birthDate || !phone) {
      return json({ error: '이름, 생년월일, 전화번호는 필수 항목입니다.' }, 400);
    }

    if (!validateName(name)) {
      return json({ error: '이름은 한글 또는 영문 2~50자로 입력해주세요.' }, 400);
    }

    if (!validateBirthDate(birthDate)) {
      return json({ error: '올바른 생년월일을 입력해주세요. (YYYYMMDD 또는 YYYY-MM-DD)' }, 400);
    }

    if (!validatePhoneNumber(phone)) {
      return json({ error: '올바른 전화번호를 입력해주세요.' }, 400);
    }

    if (!validatePin(pin)) {
      return json({ error: '안전하지 않은 비밀번호입니다. 4자리 숫자를 입력해주세요.' }, 400);
    }

    const sanitized = sanitizeInput({ name, birthDate, phone, address, pin }) as {
      name: string;
      birthDate: string;
      phone: string;
      address?: string;
      pin: string;
    };

    const existingPin = await db.simUser.findUnique({ where: { pin: sanitized.pin } });
    if (existingPin) {
      return json({ error: '이미 사용 중인 비밀번호입니다. 다른 번호를 선택해주세요.' }, 400);
    }

    const cardNumber = generateCardNumber();
    const today = new Date().toISOString().split('T')[0];

    const user = await db.simUser.create({
      data: {
        name: sanitized.name,
        birthDate: sanitized.birthDate,
        phone: sanitized.phone,
        address: sanitized.address ?? null,
        cardType: 'mobile',
        cardNumber,
        cardIssued: today,
        pin: sanitized.pin,
      },
    });

    const { pin: _pin, ...safeUser } = user;
    return json(safeUser, 201);
  } catch (error) {
    console.error('회원가입 오류:', error);
    return json({ error: '회원가입 처리 중 오류가 발생했습니다.' }, 500);
  }
}
