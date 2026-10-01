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

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { OVERDUE_BLOCK_MULTIPLIER } from '@/lib/constants';
import { json } from '@/lib/api-helpers';
import {
  validateCuid,
  checkRateLimit,
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
      return json(
        { error: '잘못된 대출 ID 형식입니다.' },
        400
      );
    }

    // [보안] 레이트 리미팅 체크
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`${RATE_LIMIT_PREFIX}${clientIp}`, 60000, 30);
    if (!rateLimit.allowed) {
      return json(
        { error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' },
        429
      );
    }

    // 본문은 선택적 (키오스크는 빈 JSON 전송). 있으면 크기만 검사
    let body: { returnDate?: string; userId?: string } = {};
    const contentLength = request.headers.get('content-length');
    if (contentLength && contentLength !== '0') {
      if (!(await validateRequestBodySize(request))) {
        return json(
          { error: '요청 크기가 너무 큽니다.' },
          413
        );
      }
      try {
        body = await request.json();
      } catch {
        body = {};
      }
    }
    const returnDateStr = body.returnDate ?? new Date().toISOString().split('T')[0];

    // [보안] 반납일 형식 검증
    if (typeof returnDateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(returnDateStr)) {
      return json(
        { error: '올바른 반납일 형식이 아닙니다.' },
        400
      );
    }
    if (!validateDateRange('2000-01-01', returnDateStr)) {
      return json({ error: '올바른 반납일 형식이 아닙니다.' }, 400);
    }
    {
      const todayStr = new Date().toISOString().split('T')[0];
      if (!validateDateRange(returnDateStr, todayStr) && returnDateStr !== todayStr) {
        // 미래 반납일 거부 (당일은 허용)
        if (returnDateStr > todayStr) {
          return json({ error: '반납일은 오늘 이후일 수 없습니다.' }, 400);
        }
      }
    }

    // [데이터베이스] Prisma ORM 파라미터화 쿼리
    const loan = await db.simLoan.findUnique({
      where: { id },
      include: { book: true },
    });

    if (!loan) {
      return json(
        { error: '대출 기록을 찾을 수 없습니다.' },
        404
      );
    }

    if (loan.status === 'returned') {
      return json(
        { error: '이미 반납된 도서입니다.' },
        400
      );
    }

    // [보안] 소유권 검사 (userId가 제공되면 일치해야 함)
    if (body.userId && body.userId !== loan.userId) {
      return json({ error: '본인의 대출만 반납할 수 있습니다.' }, 403);
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

    // [데이터베이스] 반납 처리 (원자적: active 상태일 때만 전이 + 재고 복구 상한)
    const result = await db.$transaction(async (tx) => {
      const updated = await tx.simLoan.updateMany({
        where: { id, status: 'active' },
        data: {
          status: 'returned',
          returnDate: returnDateStr,
        },
      });
      if (updated.count === 0) {
        throw new Error('이미 반납된 도서입니다.');
      }
      const book = await tx.book.findUnique({ where: { id: loan.bookId } });
      if (book && book.availableCopies < book.totalCopies) {
        await tx.book.update({
          where: { id: loan.bookId },
          data: { availableCopies: { increment: 1 } },
        });
      }
      return tx.simLoan.findUnique({ where: { id }, include: { book: true } });
    });
    const updatedLoan = result!;

    return json({
      loan: updatedLoan,
      overdueDays,
      penaltyDays,
      penalty:
        overdueDays > 0
          ? {
              overdueDays,
              blockDays: penaltyDays,
              blockUntil: new Date(Date.now() + penaltyDays * 86400000).toISOString(),
            }
          : null,
      message:
        overdueDays > 0
          ? `반납이 완료되었습니다. (${overdueDays}일 연체로 ${penaltyDays}일간 대출이 제한됩니다.)`
          : '반납이 완료되었습니다.',
    });
  } catch (error) {
    console.error('반납 오류:', error);
    if (error instanceof Error && error.message === '이미 반납된 도서입니다.') {
      return json({ error: '이미 반납된 도서입니다.' }, 400);
    }
    return json(
      { error: '도서 반납 중 오류가 발생했습니다.' },
      500
    );
  }
}
