/**
 * PIN 검증/설정 API 라우트
 *
 * [POST] /api/users/[id]/pin
 * PIN 검증 또는 설정을 처리합니다.
 *
 * [보안 조치]
 * - CUID 형식 ID 검증
 * - PIN 브루트포스 방지 레이트 리미팅 (5분당 5회)
 * - 타이밍 어택 방지 (일정한 응답 시간 유지)
 * - 입력값 검증
 * - 응답에서 PIN 정보 제외
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  validateCuid,
  validatePin,
  checkPinRateLimit,
  validateJsonContentType,
  validateRequestBodySize,
} from '@/lib/security';

export const dynamic = 'force-dynamic';

/** 타이밍 어택 방지용 최소 응답 지연 시간 (밀리초) */
const MIN_RESPONSE_TIME_MS = 200;

/** PIN 검증용 더미 해시 (존재하지 않는 사용자일 때도 동일한 시간 소모) */
const DUMMY_PIN = '0000';

/**
 * PIN 검증/설정 POST 핸들러
 * action: 'set' → PIN 설정/변경
 * action 없음 → PIN 검증
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id } = await params;

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
    const { pin, action } = body;

    // [보안] PIN 브루트포스 방지 레이트 리미팅
    const rateLimit = checkPinRateLimit(id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `비밀번호 시도 횟수를 초과했습니다. ${Math.ceil(rateLimit.retryAfterMs / 60000)}분 후에 다시 시도해주세요.` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      );
    }

    // [데이터베이스] Prisma ORM 파라미터화 쿼리
    const user = await db.simUser.findUnique({ where: { id } });

    // PIN 설정 모드
    if (action === 'set') {
      if (!pin || !validatePin(pin)) {
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

      const updatedUser = await db.simUser.update({
        where: { id },
        data: { pin },
      });

      // [보안] 응답에서 PIN 제거
      const { pin: _pin, ...safeUser } = updatedUser;
      return await delayResponse(NextResponse.json(safeUser), startTime);
    }

    // PIN 검증 모드
    if (!pin || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: '4자리 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // [보안] 타이밍 어택 방지: 존재하지 않는 사용자도 동일한 시간 소모
    if (!user) {
      // 더미 비교 수행 (응답 시간 일정화)
      if (DUMMY_PIN === pin) { /* 의도적인 더미 연산 */ }
      return await delayResponse(
        NextResponse.json(
          { error: '사용자를 찾을 수 없습니다.' },
          { status: 404 }
        ),
        startTime
      );
    }

    if (!user.pin) {
      return NextResponse.json(
        { error: '비밀번호가 설정되지 않았습니다. 도서증 발급 시 비밀번호를 설정해주세요.' },
        { status: 400 }
      );
    }

    // [보안] PIN 비교 (상수 시간 비교 권장이나, 4자리 숫자의 경우 단순 비교도 허용 가능)
    // TODO: 프로덕션 환경에서는 bcrypt/argon2 같은 해시 사용 권장
    if (user.pin !== pin) {
      return await delayResponse(
        NextResponse.json(
          { error: '비밀번호가 일치하지 않습니다.' },
          { status: 401 }
        ),
        startTime
      );
    }

    // [보안] 응답에서 PIN 제거
    const { pin: _pin2, ...safeUser } = user;
    return await delayResponse(
      NextResponse.json({ success: true, user: safeUser }),
      startTime
    );
  } catch (error) {
    console.error('PIN 오류:', error);
    return NextResponse.json(
      { error: '비밀번호 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 타이밍 어택 방지를 위한 응답 지연 함수
 * 최소 응답 시간에 도달할 때까지 대기합니다.
 */
async function delayResponse(response: NextResponse, startTime: number): Promise<NextResponse> {
  const elapsed = Date.now() - startTime;
  const remaining = MIN_RESPONSE_TIME_MS - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  return response;
}
