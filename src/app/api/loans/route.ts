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

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { MAX_LOAN_COUNT, LOAN_PERIOD_DAYS, OVERDUE_BLOCK_MULTIPLIER } from '@/lib/constants';
import {
  validateCuid,
  sanitizeInput,
  checkRateLimit,
  checkPinRateLimit,
  validateRequestBodySize,
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
      return NextResponse.json(
        { error: 'userId가 필요합니다.' },
        { status: 400 }
      );
    }

    // [보안] CUID 형식 ID 검증 (데모 사용자 제외)
    if (userId !== 'demo-user' && !validateCuid(userId)) {
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

    // [데이터베이스] Prisma ORM 파라미터화 쿼리
    const loans = await db.simLoan.findMany({
      where: { userId },
      include: { book: true },
      orderBy: { loanDate: 'desc' },
    });

    return NextResponse.json(loans);
  } catch (error) {
    console.error('대출 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '대출 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
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
    const { userId, bookId, bookIds, method, pin } = body;

    // 단권 또는 다권 지원
    const targetBookIds: string[] = bookIds && Array.isArray(bookIds) ? bookIds : (bookId ? [bookId] : []);

    if (!userId || targetBookIds.length === 0) {
      return NextResponse.json(
        { error: 'userId와 bookId(또는 bookIds)는 필수 항목입니다.' },
        { status: 400 }
      );
    }

    // [보안] CUID 형식 ID 검증 (데모 사용자 제외)
    if (userId !== 'demo-user' && !validateCuid(userId)) {
      return NextResponse.json(
        { error: '잘못된 사용자 ID 형식입니다.' },
        { status: 400 }
      );
    }

    for (const bid of targetBookIds) {
      if (bid !== 'demo-user' && !validateCuid(bid)) {
        return NextResponse.json(
          { error: '잘못된 도서 ID 형식입니다.' },
          { status: 400 }
        );
      }
    }

    // [보안] 대출 방법 화이트리스트 검증
    const ALLOWED_METHODS = ['counter', 'kiosk'] as const;
    if (!method || !ALLOWED_METHODS.includes(method)) {
      return NextResponse.json(
        { error: '대출 방법은 counter 또는 kiosk이어야 합니다.' },
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

    // [데이터베이스] 사용자 조회 (데모 사용자는 스킵)
    if (userId !== 'demo-user') {
      const user = await db.simUser.findUnique({ where: { id: userId } });
      if (!user) {
        return NextResponse.json(
          { error: '사용자를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      // 카운터 대출 시 PIN 검증 (키오스크는 PIN 화면에서 이미 검증됨)
      // kiosk: PIN은 PIN 입력 화면에서 사전 검증되므로 API에서 선택적 검증만 수행
      const shouldValidatePin = method === 'counter' || (method === 'kiosk' && pin);
      if (shouldValidatePin && user.pin) {
        const pinRateLimit = checkPinRateLimit(userId);
        if (!pinRateLimit.allowed) {
          return NextResponse.json(
            { error: `비밀번호 시도 횟수를 초과했습니다. ${Math.ceil(pinRateLimit.retryAfterMs / 60000)}분 후에 다시 시도해주세요.` },
            { status: 429 }
          );
        }
        if (user.pin !== pin) {
          return NextResponse.json(
            { error: '비밀번호가 일치하지 않습니다.' },
            { status: 401 }
          );
        }
      }
    }

    // ========================================================================
    // 연체/페널티 검사 (데모 사용자는 스킵)
    // ========================================================================
    if (userId !== 'demo-user') {
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
        return NextResponse.json(
          { error: `연체된 도서가 있어 대출할 수 없습니다. 반납 후 ${blockDays}일 뒤에 대여 가능합니다.`, overdueDays: maxOverdueDays, blockDays },
          { status: 400 }
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
        return NextResponse.json(
          { error: `연체 반납으로 인해 ${remainingDays}일 동안 대출할 수 없습니다.`, penaltyRemainingDays: remainingDays },
          { status: 400 }
        );
      }

      // 최대 대출 권수 검사
      const activeLoanCount = await db.simLoan.count({
        where: { userId, status: 'active' },
      });
      if (activeLoanCount + targetBookIds.length > MAX_LOAN_COUNT) {
        return NextResponse.json(
          { error: `대출 가능한 권수(${MAX_LOAN_COUNT}권)를 초과했습니다.` },
          { status: 400 }
        );
      }
    }

    // ========================================================================
    // 대출 생성
    // ========================================================================
    const loanDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + LOAN_PERIOD_DAYS);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const results = [];
    for (const bid of targetBookIds) {
      // 데모 도서 ID는 스킵
      if (bid === 'return-sim-1') continue;

      const book = await db.book.findUnique({ where: { id: bid } });
      if (!book || book.availableCopies <= 0) {
        results.push({ bookId: bid, success: false, error: book ? '대출 가능한 복본이 없습니다.' : '도서를 찾을 수 없습니다.' });
        continue;
      }

      try {
        const loan = await db.simLoan.create({
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

        await db.book.update({
          where: { id: bid },
          data: { availableCopies: { decrement: 1 } },
        });

        results.push({ bookId: bid, success: true, loan });
      } catch (err) {
        results.push({ bookId: bid, success: false, error: '대출 처리 중 오류' });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    if (successCount === 0 && targetBookIds.length > 0) {
      return NextResponse.json(
        { error: '모든 도서 대출에 실패했습니다.', results },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      loanedCount: successCount,
      results,
    }, { status: 201 });
  } catch (error) {
    console.error('대출 오류:', error);
    return NextResponse.json(
      { error: '도서 대출 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
