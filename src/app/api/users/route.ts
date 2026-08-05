/**
 * 사용자 API 라우트 - 회원가입
 *
 * [POST] /api/users
 * 새로운 도서관 회원을 등록합니다.
 *
 * [보안 조치]
 * - Content-Type 검증 (JSON만 허용)
 * - 요청 본문 크기 제한
 * - 입력값 XSS sanitization
 * - 각 필드별 형식 검증 (이름, 전화번호, 생년월일, PIN)
 * - PIN 브루트포스 방지 레이트 리미팅
 * - 단순 PIN 패턴 거부
 * - PIN 유일성 검증
 * - 레이트 리미팅 (IP 기반)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
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
const RATE_LIMIT_PREFIX = 'signup:';

export const dynamic = 'force-dynamic';

/**
 * 카드 번호 생성 함수
 * 8자리 난수를 생성하여 'LIB-' 접두사를 붙입니다.
 * @returns 고유한 도서증 번호 문자열
 */
function generateCardNumber(): string {
  // crypto.getRandomValues를 사용하여 예측 불가능한 난수 생성 (보안 강화)
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
 * 회원가입 POST 핸들러
 * 새로운 사용자를 생성하고 도서증 번호를 발급합니다.
 */
export async function POST(request: NextRequest) {
  try {
    // [보안] 레이트 리미팅 체크 (IP 기반, 분당 10회 제한)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`${RATE_LIMIT_PREFIX}${clientIp}`, 60000, 10);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      );
    }

    // [보안] Content-Type 검증
    if (!validateJsonContentType(request)) {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.' },
        { status: 415 }
      );
    }

    // [보안] 요청 본문 크기 검증
    if (!(await validateRequestBodySize(request))) {
      return NextResponse.json(
        { error: '요청 크기가 너무 큽니다.' },
        { status: 413 }
      );
    }

    const body = await request.json();
    const { name, birthDate, phone, address, pin } = body;

    // [보안] 필수 필드 존재 여부 검증
    if (!name || !birthDate || !phone) {
      return NextResponse.json(
        { error: '이름, 생년월일, 전화번호는 필수 항목입니다.' },
        { status: 400 }
      );
    }

    // [보안] 입력값 형식 검증
    if (!validateName(name)) {
      return NextResponse.json(
        { error: '이름은 한글 또는 영문 2~50자로 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!validateBirthDate(birthDate)) {
      return NextResponse.json(
        { error: '올바른 생년월일을 입력해주세요. (YYYYMMDD 또는 YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    if (!validatePhoneNumber(phone)) {
      return NextResponse.json(
        { error: '올바른 전화번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!validatePin(pin)) {
      return NextResponse.json(
        { error: '안전하지 않은 비밀번호입니다. 4자리 숫자를 입력해주세요. (1234, 1111, 연속된 숫자 사용 불가)' },
        { status: 400 }
      );
    }

    // [보안] 입력값 XSS sanitization
    const sanitized = sanitizeInput({ name, birthDate, phone, address, pin }) as {
      name: string;
      birthDate: string;
      phone: string;
      address?: string;
      pin: string;
    };

    // [보안] PIN 유일성 검증 (다른 사용자와 중복 방지)
    const existingPin = await db.simUser.findUnique({ where: { pin: sanitized.pin } });
    if (existingPin) {
      return NextResponse.json(
        { error: '이미 사용 중인 비밀번호입니다. 다른 번호를 선택해주세요.' },
        { status: 400 }
      );
    }

    // 카드 번호 생성
    const cardNumber = generateCardNumber();
    const today = new Date().toISOString().split('T')[0];

    // [데이터베이스] Prisma ORM을 통한 파라미터화 쿼리 (SQL Injection 방지)
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

    // [보안] 응답에서 민감 정보(PIN) 제거
    const { pin: _pin, ...safeUser } = user;

    return NextResponse.json(safeUser, { status: 201 });
  } catch (error) {
    console.error('회원가입 오류:', error);
    // [보안] 내부 오류 상세 정보 노출 방지
    return NextResponse.json(
      { error: '회원가입 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
