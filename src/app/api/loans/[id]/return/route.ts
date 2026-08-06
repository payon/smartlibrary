/**
 * 도서 반납 API 라우트
 *
 * [POST] /api/loans/[id]/return
 * 대출된 도서를 반납 처리합니다.
 *
 * [보안 조치]
 * - CUID 형식 ID 검증
 * - 입력값 검증
 * - 반납일 유효성 검증
 * - 레이트 리미팅
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { OVERDUE_BLOCK_MULTIPLIER } from '@/lib/constants';
import {
  validateCuid,
  checkRateLimit,
  validateJsonContentType,
  validateRequestBodySize,
  validateDateRange,
  getClientIp,
} from '@/lib/security';

/** 레이트 리미팅 식별자 접두사 */
const RATE_LIMIT_PREFIX = 'return:';

export const dynamic = 'force-dynamic';

/**
 * 도서 반납 POST 핸들러
 * 대출 기록을 'returned' 상태로 변경하고 연체 페널티를 계산합니다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // [보안] CUID 형식 ID 검증
    if (!validateCuid(id)) {
      return NextResponse.json(
        { error: '잘못된 대출 ID 형식입니다.' },
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
    const returnDateStr = body.returnDate ?? new Date().toISOString().split('T')[0];

    // [보안] 반납일 형식 검증
    if (typeof returnDateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(returnDateStr)) {
      return NextResponse.json(
        { error: '올바른 반납일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // [데이터베이스] Prisma ORM 파라미터화 쿼리
    const loan = await db.simLoan.findUnique({
      where: { id },
      include: { book: true },
    });

    if (!loan) {
      return NextResponse.json(
        { error: '대출 기록을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (loan.status === 'returned') {
      return NextResponse.json(
        { error: '이미 반납된 도서입니다.' },
        { status: 400 }
      );
    }

    // 연체 일수 및 페널티 계산
    const returnDate = new Date(returnDateStr);
    const dueDate = new Date(loan.dueDate);
    returnDate.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const diffMs = returnDate.getTime() - dueDate.getTime();
    const overdueDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    // 연체일수만큼 대여 정지 (연체료 없음)
    const penaltyDays = overdueDays * OVERDUE_BLOCK_MULTIPLIER;

    // [데이터베이스] 반납 처리
    const updatedLoan = await db.simLoan.update({
      where: { id },
      data: {
        status: 'returned',
        returnDate: returnDateStr,
      },
      include: { book: true },
    });

    // 본수 복구
    await db.book.update({
      where: { id: loan.bookId },
      data: { availableCopies: { increment: 1 } },
    });

    return NextResponse.json({
      loan: updatedLoan,
      overdueDays,
      penaltyDays,
    });
  } catch (error) {
    console.error('반납 오류:', error);
    return NextResponse.json(
      { error: '도서 반납 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
