/**
 * 학습 진행도 API 라우트
 *
 * [GET] /api/progress?userId=xxx - 진행도 조회
 * [POST] /api/progress - 진행도 생성
 * [PUT] /api/progress - 진행도 업데이트 (Upsert)
 *
 * [보안 조치]
 * - CUID 형식 ID 검증
 * - 레이트 리미팅
 * - 입력값 타입 검증
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  validateCuid,
  checkRateLimit,
  validateJsonContentType,
  validateRequestBodySize,
  getClientIp,
} from '@/lib/security';

/** 레이트 리미팅 식별자 접두사 */
const RATE_LIMIT_PREFIX = 'progress:';

export const dynamic = 'force-dynamic';

/**
 * 학습 진행도 조회 GET 핸들러
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
    const rateLimit = checkRateLimit(`${RATE_LIMIT_PREFIX}${clientIp}`, 60000, 30);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const progress = await db.learningProgress.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(progress);
  } catch (error) {
    console.error('학습 진행도 조회 오류:', error);
    return NextResponse.json(
      { error: '학습 진행도를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 학습 진행도 생성 POST 핸들러
 */
export async function POST(request: NextRequest) {
  try {
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
    const { userId, scenarioId, stepIndex, completed, attempts, bestTimeSec, stars } = body;

    if (!userId || !scenarioId) {
      return NextResponse.json(
        { error: 'userId와 scenarioId는 필수 항목입니다.' },
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

    if (!validateCuid(scenarioId)) {
      return NextResponse.json(
        { error: '잘못된 시나리오 ID 형식입니다.' },
        { status: 400 }
      );
    }

    // [보안] 입력값 타입 검증
    if (stepIndex !== undefined && typeof stepIndex !== 'number') {
      return NextResponse.json(
        { error: 'stepIndex는 숫자여야 합니다.' },
        { status: 400 }
      );
    }
    if (attempts !== undefined && typeof attempts !== 'number') {
      return NextResponse.json(
        { error: 'attempts는 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    // [데이터베이스] Prisma ORM 파라미터화 쿼리
    const progress = await db.learningProgress.create({
      data: {
        userId,
        scenarioId,
        stepIndex: stepIndex ?? 0,
        completed: completed ?? false,
        attempts: attempts ?? 0,
        bestTimeSec: bestTimeSec ?? null,
        stars: stars ?? 0,
      },
    });

    return NextResponse.json(progress, { status: 201 });
  } catch (error) {
    console.error('학습 진행도 저장 오류:', error);
    return NextResponse.json(
      { error: '학습 진행도 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 학습 진행도 업데이트 PUT 핸들러 (Upsert)
 */
export async function PUT(request: NextRequest) {
  try {
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
    const { userId, scenarioId, stepIndex, completed, attempts, bestTimeSec, stars } = body;

    if (!userId || !scenarioId) {
      return NextResponse.json(
        { error: 'userId와 scenarioId는 필수 항목입니다.' },
        { status: 400 }
      );
    }

    // [보안] CUID 형식 ID 검증
    if (!validateCuid(userId) || !validateCuid(scenarioId)) {
      return NextResponse.json(
        { error: '잘못된 ID 형식입니다.' },
        { status: 400 }
      );
    }

    // [데이터베이스] Upsert: 기존 기록이 있으면 업데이트, 없으면 생성
    const existing = await db.learningProgress.findFirst({
      where: { userId, scenarioId },
    });

    if (existing) {
      const updated = await db.learningProgress.update({
        where: { id: existing.id },
        data: {
          stepIndex: stepIndex !== undefined ? stepIndex : existing.stepIndex,
          completed: completed !== undefined ? completed : existing.completed,
          attempts: attempts !== undefined ? attempts : existing.attempts,
          bestTimeSec:
            bestTimeSec !== undefined
              ? bestTimeSec === null
                ? null
                : existing.bestTimeSec !== null
                  ? Math.min(existing.bestTimeSec, bestTimeSec)
                  : bestTimeSec
              : existing.bestTimeSec,
          stars:
            stars !== undefined
              ? Math.max(existing.stars, stars)
              : existing.stars,
        },
      });
      return NextResponse.json(updated);
    }

    // 기존 기록이 없으면 새로 생성
    const created = await db.learningProgress.create({
      data: {
        userId,
        scenarioId,
        stepIndex: stepIndex ?? 0,
        completed: completed ?? false,
        attempts: attempts ?? 0,
        bestTimeSec: bestTimeSec ?? null,
        stars: stars ?? 0,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('학습 진행도 업데이트 오류:', error);
    return NextResponse.json(
      { error: '학습 진행도 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
