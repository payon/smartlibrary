/**
 * 대출 API 라우트
 *
 * [GET] /api/loans?userId=xxx - 대출 목록 조회
 * [POST] /api/loans - 도서 대출 (단권 또는 다권)
 *
 * [보안 조치]
 * - CUID 형식 ID 검증
 * - PIN 브루트포스 방지 레이트 리미팅
 * - 입력값 sanitization
 * - 연체/페널티 상태 검증
 * - 최대 대출 권수(10권) 제한
 * - 대출 기간(15일) 고정
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { MAX_LOAN_COUNT, LOAN_PERIOD_DAYS, OVERDUE_BLOCK_MULTIPLIER } from '@/lib/constants';
import { json } from '@/lib/api-helpers';
import {
  validateCuid,
  checkRateLimit,
  checkPinRateLimit,
  validateRequestBodySize,
  validateBodySize,
  validateJsonContentType,
  getClientIp,
} from '@/lib/security';

/** 레이트 리미팅 식별자 접두사 */
const RATE_LIMIT_PREFIX = 'loans:';

export const dynamic = 'force-dynamic';

/**
 * 대출 목록 조회 GET 핸들러
 * 특정 사용자의 모든 대출 기록을 반환합니다.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return json({ error: 'userId가 필요합니다.' }, 400);
    }

    // [보안] CUID 형식 ID 검증 (데모 사용자 제외)
    if (userId !== 'demo-user' && !validateCuid(userId)) {
      return json({ error: '잘못된 사용자 ID 형식입니다.' }, 400);
    }

    // [보안] 레이트 리미팅 체크
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`${RATE_LIMIT_PREFIX}${clientIp}`, 60000, 30);
    if (!rateLimit.allowed) {
      return json({ error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' }, 429);
    }

    // [데이터베이스] Prisma ORM 파라미터화 쿼리
    const loans = await db.simLoan.findMany({
      where: { userId },
      include: { book: true },
      orderBy: { loanDate: 'desc' },
    });

    return json(loans);
  } catch (error) {
    console.error('대출 목록 조회 오류:', error);
    return json({ error: '대출 목록을 불러오는 중 오류가 발생했습니다.' }, 500);
  }
}

/**
 * 도서 대출 POST 핸들러
 * 단권 대출 또는 다권 대출(bookIds 배열)을 지원합니다.
 */
export async function POST(request: NextRequest) {
  try {
    // [보안] Content-Type 검증
    if (!validateJsonContentType(request)) {
      return json({ error: '잘못된 요청 형식입니다.' }, 415);
    }

    // [보안] 요청 본문 크기 검증
    if (!(await validateRequestBodySize(request))) {
      return json({ error: '요청 크기가 너무 큽니다.' }, 413);
    }

    const body = await request.json();
    if (!validateBodySize(body, 10 * 1024)) {
      return json({ error: '요청 크기가 너무 큽니다.' }, 413);
    }
    const { userId, bookId, bookIds, method, pin } = body;

    // 단권 또는 다권 지원
    const targetBookIds: string[] = bookIds && Array.isArray(bookIds) ? bookIds : (bookId ? [bookId] : []);

    if (!userId || targetBookIds.length === 0) {
      return json({ error: 'userId와 bookId(또는 bookIds)는 필수 항목입니다.' }, 400);
    }

    // [보안] CUID 형식 ID 검증
    if (!validateCuid(userId)) {
      return json(
        { error: '잘못된 사용자 ID 형식입니다.' },
        400
      );
    }

    for (const bid of targetBookIds) {
      if (!validateCuid(bid)) {
        return json(
          { error: '잘못된 도서 ID 형식입니다.' },
          400
        );
      }
    }

    // [보안] 대출 방법 화이트리스트 검증
    const ALLOWED_METHODS = ['counter', 'kiosk'] as const;
    if (!method || !ALLOWED_METHODS.includes(method)) {
      return json({ error: '대출 방법은 counter 또는 kiosk이어야 합니다.' }, 400);
    }

    // [보안] 레이트 리미팅 체크
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`${RATE_LIMIT_PREFIX}${clientIp}`, 60000, 20);
    if (!rateLimit.allowed) {
      return json({ error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' }, 429);
    }

    // [데이터베이스] 사용자 조회 + PIN 필수 검증 (counter/kiosk 공통)
    const user = await db.simUser.findUnique({ where: { id: userId } });
    if (!user) {
      return json(
        { error: '사용자를 찾을 수 없습니다.' },
        404
      );
    }
    if (!user.isActive) {
      return json({ error: '비활성화된 계정입니다.' }, 403);
    }

    // PIN은 항상 필수 (키오스크 사전검증이 있어도 서버에서 재검증)
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return json(
        { error: 'PIN 번호가 필요합니다.', code: 'PIN_REQUIRED' },
        400
      );
    }
    if (!user.pin) {
      return json({ error: 'PIN이 등록되지 않은 계정입니다.' }, 400);
    }
    {
      const pinRateLimit = checkPinRateLimit(`loan:${userId}:${clientIp}`);
      if (!pinRateLimit.allowed) {
        return json(
          { error: `비밀번호 시도 횟수를 초과했습니다. ${Math.ceil(pinRateLimit.retryAfterMs / 60000)}분 후에 다시 시도해주세요.` },
          429
        );
      }
      // 실패 응답을 최소 200ms 지연 (타이밍 어택 완화)
      if (user.pin !== pin) {
        await new Promise((r) => setTimeout(r, 200));
        return json(
          { error: 'PIN 번호가 올바르지 않습니다.', code: 'INVALID_PIN' },
          401
        );
      }
    }

    // ========================================================================
    // 연체/페널티 검사
    // ========================================================================
    {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const overdueLoans = await db.simLoan.findMany({
        where: {
          userId,
          status: 'active',
          dueDate: { lt: today.toISOString().split('T')[0] },
        },
      });

      if (overdueLoans.length > 0) {
        let maxOverdueDays = 0;
        for (const loan of overdueLoans) {
          const dueDate = new Date(loan.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          const days = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          if (days > maxOverdueDays) maxOverdueDays = days;
        }
        const blockDays = maxOverdueDays * OVERDUE_BLOCK_MULTIPLIER;
        return json(
          { error: `연체된 도서가 있어 대출할 수 없습니다. 반납 후 ${blockDays}일 뒤에 대여 가능합니다.`, code: 'OVERDUE_BLOCKED', overdueDays: maxOverdueDays, blockDays },
          403
        );
      }

      const penalizedReturns = await db.simLoan.findMany({
        where: { userId, status: 'returned' },
      });
      let penaltyEndDate: Date | null = null;
      for (const loan of penalizedReturns) {
        if (!loan.returnDate || !loan.dueDate) continue;
        const returnDate = new Date(loan.returnDate);
        const dueDate = new Date(loan.dueDate);
        returnDate.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        const overdueDays = Math.max(0, Math.floor((returnDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        if (overdueDays > 0) {
          const pEnd = new Date(returnDate);
          pEnd.setDate(pEnd.getDate() + overdueDays * OVERDUE_BLOCK_MULTIPLIER);
          if (!penaltyEndDate || pEnd > penaltyEndDate) penaltyEndDate = pEnd;
        }
      }
      const today2 = new Date();
      today2.setHours(0, 0, 0, 0);
      if (penaltyEndDate && today2 <= penaltyEndDate) {
        const remainingDays = Math.ceil((penaltyEndDate.getTime() - today2.getTime()) / (1000 * 60 * 60 * 24));
        return json(
          { error: `연체 반납으로 인해 ${remainingDays}일 동안 대출할 수 없습니다.`, code: 'OVERDUE_BLOCKED', penaltyRemainingDays: remainingDays },
          403
        );
      }

      // 최대 대출 권수 검사
      const activeLoanCount = await db.simLoan.count({
        where: { userId, status: 'active' },
      });
      if (activeLoanCount + targetBookIds.length > MAX_LOAN_COUNT) {
        return json(
          { error: `대출 가능한 권수(${MAX_LOAN_COUNT}권)를 초과했습니다.`, code: 'MAX_LOAN_EXCEEDED' },
          400
        );
      }
    }

    // ========================================================================
    // 대출 생성 (원자적 재고 차감 트랜잭션)
    // ========================================================================
    const loanDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + LOAN_PERIOD_DAYS);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const results: Array<{ bookId: string; success: boolean; loan?: unknown; error?: string }> = [];
    for (const bid of targetBookIds) {
      try {
        const loan = await db.$transaction(async (tx) => {
          // 재고가 있을 때만 원자적으로 차감
          const dec = await tx.book.updateMany({
            where: { id: bid, availableCopies: { gt: 0 } },
            data: { availableCopies: { decrement: 1 } },
          });
          if (dec.count === 0) {
            const exists = await tx.book.findUnique({ where: { id: bid } });
            throw new Error(exists ? '대출 가능한 복본이 없습니다.' : '도서를 찾을 수 없습니다.');
          }
          return tx.simLoan.create({
            data: {
              userId,
              bookId: bid,
              loanDate,
              dueDate: dueDateStr,
              status: 'active',
              method,
            },
            include: { book: true },
          });
        });

        results.push({ bookId: bid, success: true, loan });
      } catch (err) {
        results.push({ bookId: bid, success: false, error: err instanceof Error ? err.message : '대출 처리 중 오류' });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    if (successCount === 0 && targetBookIds.length > 0) {
      return json(
        { error: '모든 도서 대출에 실패했습니다.', code: 'INVALID_INPUT', results },
        400
      );
    }

    return json({
      success: true,
      loanedCount: successCount,
      results,
      loans: results.filter((r) => r.success).map((r) => r.loan),
      message: `${successCount}권이 대출되었습니다.`,
    }, 201);
  } catch (error) {
    console.error('대출 오류:', error);
    return json({ error: '도서 대출 중 오류가 발생했습니다.' }, 500);
  }
}
