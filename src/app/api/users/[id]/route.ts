/**
 * 사용자 상세 정보 API 라우트
 *
 * [GET] /api/users/[id]
 * 사용자 정보와 활성 대출 목록을 조회합니다.
 *
 * [보안 조치]
 * - CUID 형식 ID 검증
 * - 응답에서 PIN 정보 제외
 * - 레이트 리미팅
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  validateCuid,
  checkRateLimit,
  getClientIp,
} from '@/lib/security';

export const dynamic = 'force-dynamic';

/** 레이트 리미팅 식별자 접두사 */
const RATE_LIMIT_PREFIX = 'user-detail:';

/**
 * 사용자 조회 GET 핸들러
 * 사용자 정보와 활성 대출 목록을 반환합니다.
 * PIN은 보안상 응답에 포함하지 않습니다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // [보안] 레이트 리미팅 체크
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`${RATE_LIMIT_PREFIX}${clientIp}`, 60000, 30);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    // [보안] CUID 형식 ID 검증 (SQL Injection / Path Traversal 방지)
    if (!validateCuid(id)) {
      return NextResponse.json(
        { error: '잘못된 사용자 ID 형식입니다.' },
        { status: 400 }
      );
    }

    // [데이터베이스] Prisma ORM 파라미터화 쿼리
    const user = await db.simUser.findUnique({
      where: { id },
      include: {
        loans: {
          where: { status: 'active' },
          include: { book: true },
          orderBy: { loanDate: 'desc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // [보안] 응답에서 민감 정보(PIN) 제거
    const { pin: _pin, ...safeUser } = user;

    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('사용자 조회 오류:', error);
    // [보안] 내부 오류 상세 정보 노출 방지
    return NextResponse.json(
      { error: '사용자 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
