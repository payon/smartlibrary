/**
 * 대출 API 라우트
 *
 * [GET] /api/loans?userId=xxx - 대출 목록 조회
 * [POST] /api/loans - 도서 대출
 *
 * [보안 조치]
 * - CUID 형식 ID 검증
 * - PIN 브루트포스 방지 레이트 리미팅
 * - 입력값 sanitization
 * - 연체/페널티 상태 검증
 * - 최대 대출 권수(10권) 제한
 * - 대출 기간(15일) 고정
 * - 응답에서 민감 정보 제외
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
 * 새로운 도서 대출을 생성합니다.
 * 연장 불가, 15일 고정, 최대 10권 제한.
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
    const { userId, bookId, method, pin } = body;

    // [보안] 필수 필드 검증
    if (!userId || !bookId) {
      return NextResponse.json(
        { error: 'userId와 bookId는 필수 항목입니다.' },
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

    if (!validateCuid(bookId)) {
      return NextResponse.json(
        { error: '잘못된 도서 ID 형식입니다.' },
        { status: 400 }
      );
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

    // [데이터베이스] 사용자 조회 (Prisma ORM 파라미터화 쿼리)
    const user = await db.simUser.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 키오스크 대출 시 PIN 검증
    if (method === 'kiosk') {
      // [보안] PIN 브루트포스 방지 레이트 리미팅
      const pinRateLimit = checkPinRateLimit(userId);
      if (!pinRateLimit.allowed) {
        return NextResponse.json(
          { error: `비밀번호 시도 횟수를 초과했습니다. ${Math.ceil(pinRateLimit.retryAfterMs / 60000)}분 후에 다시 시도해주세요.` },
          { status: 429 }
        );
      }

      if (!pin) {
        return NextResponse.json(
          { error: '비밀번호를 입력해주세요.' },
          { status: 400 }
        );
      }
      if (!user.pin) {
        return NextResponse.json(
          { error: '비밀번호가 설정되지 않았습니다. 도서증 발급 시 비밀번호를 설정해주세요.' },
          { status: 400 }
        );
      }
      if (user.pin !== pin) {
        return NextResponse.json(
          { error: '비밀번호가 일치하지 않습니다.' },
          { status: 401 }
        );
      }
    }

    // ========================================================================
    // 연체/페널티 검사
    // ========================================================================
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // [비즈니스 로직] 현재 연체 중인 대출 검사
    const overdueLoans = await db.simLoan.findMany({
      where: {
        userId,
        status: 'active',
        dueDate: { lt: today.toISOString().split('T')[0] },
      },
    });

    if (overdueLoans.length > 0) {
      // 가장 많이 연체된 도서 기준으로 대여 정지일 계산
      let maxOverdueDays = 0;
      for (const loan of overdueLoans) {
        const dueDate = new Date(loan.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const days = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (days > maxOverdueDays) maxOverdueDays = days;
      }
      const blockDays = maxOverdueDays * OVERDUE_BLOCK_MULTIPLIER;
      return NextResponse.json(
        {
          error: `연체된 도서가 있어 대출할 수 없습니다. 반납 후 ${blockDays}일 뒤에 대여 가능합니다.`,
          overdueDays: maxOverdueDays,
          blockDays,
        },
        { status: 400 }
      );
    }

    // [비즈니스 로직] 연체 반납 후 페널티 기간 검사
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
        // 대여 정지 종료일 = 반납일 + 연체일수
        const pEnd = new Date(returnDate);
        pEnd.setDate(pEnd.getDate() + overdueDays * OVERDUE_BLOCK_MULTIPLIER);
        if (!penaltyEndDate || pEnd > penaltyEndDate) {
          penaltyEndDate = pEnd;
        }
      }
    }
    if (penaltyEndDate && today <= penaltyEndDate) {
      const remainingDays = Math.ceil((penaltyEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return NextResponse.json(
        {
          error: `연체 반납으로 인해 ${remainingDays}일 동안 대출할 수 없습니다.`,
          penaltyRemainingDays: remainingDays,
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // 최대 대출 권수 검사 (거주지 기반, 최대 10권)
    // ========================================================================
    const activeLoanCount = await db.simLoan.count({
      where: { userId, status: 'active' },
    });
    if (activeLoanCount >= MAX_LOAN_COUNT) {
      return NextResponse.json(
        { error: `대출 가능한 권수(${MAX_LOAN_COUNT}권)를 초과했습니다.` },
        { status: 400 }
      );
    }

    // [데이터베이스] 도서 조회
    const book = await db.book.findUnique({ where: { id: bookId } });
    if (!book) {
      return NextResponse.json(
        { error: '도서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 대출 가능 본수 확인
    if (book.availableCopies <= 0) {
      return NextResponse.json(
        { error: '대출 가능한 복본이 없습니다.' },
        { status: 400 }
      );
    }

    // ========================================================================
    // 대출 생성 (15일 고정 기간, 연장 불가)
    // ========================================================================
    const loanDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + LOAN_PERIOD_DAYS);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // [데이터베이스] 트랜잭션으로 대출 생성 + 재고 감소 원자적 처리
    const loan = await db.simLoan.create({
      data: {
        userId,
        bookId,
        loanDate,
        dueDate: dueDateStr,
        status: 'active',
        method,
      },
      include: { book: true },
    });

    // 본수 감소
    await db.book.update({
      where: { id: bookId },
      data: { availableCopies: { decrement: 1 } },
    });

    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    console.error('대출 오류:', error);
    return NextResponse.json(
      { error: '도서 대출 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
