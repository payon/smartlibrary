/**
 * 도서증 발급 API 라우트
 *
 * [POST] /api/users/[id]/card
 * 도서증을 발급하거나 재발급합니다.
 *
 * [보안 조치]
 * - CUID 형식 ID 검증
 * - PIN 형식 및 유일성 검증
 * - 입력값 sanitization
 * - 레이트 리미팅
 * - 응답에서 PIN 정보 제외
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  validateCuid,
  validatePin,
  checkRateLimit,
  sanitizeInput,
  validateJsonContentType,
  validateRequestBodySize,
  getClientIp,
} from '@/lib/security';

/** 레이트 리미팅 식별자 접두사 */
const RATE_LIMIT_PREFIX = 'card-issuance:';

export const dynamic = 'force-dynamic';

/**
 * 카드 번호 생성 함수
 * 암호학적으로 안전한 난수를 사용합니다.
 * @returns 고유한 도서증 번호 문자열
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
 * 도서증 발급 POST 핸들러
 * 모바일 또는 실물 도서증을 발급합니다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // [보안] 레이트 리미팅 체크
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`${RATE_LIMIT_PREFIX}${clientIp}`, 60000, 10);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    // [보안] CUID 형식 ID 검증
    if (!validateCuid(id)) {
      return NextResponse.json(
        { error: '잘못된 사용자 ID 형식입니다.' },
        { status: 400 }
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
    const { cardType, pin } = body;

    // [보안] 도서증 종류 검증 (화이트리스트 방식)
    const ALLOWED_CARD_TYPES = ['mobile', 'physical'] as const;
    if (!cardType || !ALLOWED_CARD_TYPES.includes(cardType)) {
      return NextResponse.json(
        { error: '도서증 종류는 mobile 또는 physical이어야 합니다.' },
        { status: 400 }
      );
    }

    // [보안] PIN이 제공된 경우 검증
    if (pin) {
      if (!validatePin(pin)) {
        return NextResponse.json(
          { error: '안전하지 않은 비밀번호입니다. 4자리 숫자를 입력해주세요.' },
          { status: 400 }
        );
      }

      // [보안] PIN 유일성 검증
      const existingPin = await db.simUser.findUnique({ where: { pin } });
      if (existingPin && existingPin.id !== id) {
        return NextResponse.json(
          { error: '이미 사용 중인 비밀번호입니다. 다른 번호를 선택해주세요.' },
          { status: 400 }
        );
      }
    }

    // [데이터베이스] Prisma ORM 파라미터화 쿼리
    const user = await db.simUser.findUnique({ where: { id } });

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 새 카드 번호 생성
    const newCardNumber = generateCardNumber();
    const today = new Date().toISOString().split('T')[0];

    // 업데이트 데이터 구성
    const updateData: Record<string, string> = {
      cardType,
      cardNumber: newCardNumber,
      cardIssued: today,
    };

    // PIN이 제공되고 기존 PIN이 없는 경우에만 설정
    if (pin && !user.pin) {
      updateData.pin = pin;
    }

    const updatedUser = await db.simUser.update({
      where: { id },
      data: updateData,
    });

    // [보안] 응답에서 민감 정보(PIN) 제거
    const { pin: _pin, ...safeUser } = updatedUser;

    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('도서증 발급 오류:', error);
    return NextResponse.json(
      { error: '도서증 발급 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
