/**
 * 학습 수료증 API 라우트
 *
 * [GET] /api/progress/certificate?userId=xxx
 * 사용자의 학습 수료증 정보를 반환합니다.
 *
 * [보안 조치]
 * - CUID 형식 ID 검증
 * - 레이트 리미팅
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  validateCuid,
  checkRateLimit,
  getClientIp,
} from '@/lib/security';

/** 레이트 리미팅 식별자 접두사 */
const RATE_LIMIT_PREFIX = 'certificate:';

export const dynamic = 'force-dynamic';

/**
 * 학습 수료증 GET 핸들러
 * 완료된 시나리오 목록과 전체 진행도를 반환합니다.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId가 필요합니다.' },
        { status: 400 }
      );
    }

    // [보안] CUID 형식 ID 검증
    if (!validateCuid(userId)) {
      return NextResponse.json(
        { error: '잘못된 사용자 ID 형식입니다.' },
        { status: 400 }
      );
    }

    // [보안] 레이트 리미팅 체크
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`${RATE_LIMIT_PREFIX}${clientIp}`, 60000, 20);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    // 완료된 시나리오 수 조회
    const completedCount = await db.learningProgress.count({
      where: { userId, completed: true },
    });

    // 전체 시나리오 수 조회
    const totalScenarios = await db.scenario.count();

    return NextResponse.json({
      completedCount,
      totalScenarios,
      progressPercent: totalScenarios > 0 ? Math.round((completedCount / totalScenarios) * 100) : 0,
    });
  } catch (error) {
    console.error('수료증 조회 오류:', error);
    return NextResponse.json(
      { error: '수료증 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
