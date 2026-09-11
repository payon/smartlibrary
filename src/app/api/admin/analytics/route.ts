/**
 * 관리자 분석 대시보드 API 라우트
 *
 * [GET] /api/admin/analytics
 * 분석 통계 데이터를 반환합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    if (!hasPermission(payload.role, 'analytics:read')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // 기본 통계
    const [
      totalBooks,
      totalUsers,
      activeLoans,
      overdueLoans,
      todayLoans,
      todayReturns,
    ] = await Promise.all([
      db.book.count(),
      db.simUser.count({ where: { isActive: true } }),
      db.simLoan.count({ where: { status: 'active' } }),
      db.simLoan.count({
        where: {
          status: 'active',
          dueDate: { lt: todayStr },
        },
      }),
      db.simLoan.count({
        where: {
          loanDate: { contains: todayStr.replace(/-/g, '') },
        },
      }),
      db.simLoan.count({
        where: {
          status: 'returned',
          returnDate: { contains: todayStr.replace(/-/g, '') },
        },
      }),
    ]);

    // 인기 도서 (대출 횟수 기준 상위 5권)
    const popularBooksRaw = await db.simLoan.groupBy({
      by: ['bookId'],
      _count: { bookId: true },
      orderBy: { _count: { bookId: 'desc' } },
      take: 5,
    });

    const popularBookIds = popularBooksRaw.map((item) => item.bookId);
    const popularBookDetails = await db.book.findMany({
      where: { id: { in: popularBookIds } },
      select: { id: true, title: true, author: true },
    });

    const popularBooks = popularBooksRaw.map((item) => {
      const detail = popularBookDetails.find((b) => b.id === item.bookId);
      return {
        bookId: item.bookId,
        title: detail?.title || '알 수 없음',
        author: detail?.author || '',
        loanCount: item._count.bookId,
      };
    });

    // 카테고리별 도서 분포
    const categoryDistributionRaw = await db.book.groupBy({
      by: ['category'],
      _count: { category: true },
      orderBy: { _count: { category: 'desc' } },
    });

    const categoryDistribution = categoryDistributionRaw.map((item) => ({
      category: item.category || '미분류',
      count: item._count.category,
    }));

    // 최근 7일간 일별 대출 수
    const loansByDay = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');

      const count = await db.simLoan.count({
        where: { loanDate: { contains: dateStr } },
      });

      loansByDay.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }

    return NextResponse.json({
      totalBooks,
      totalUsers,
      activeLoans,
      overdueLoans,
      todayLoans,
      todayReturns,
      popularBooks,
      categoryDistribution,
      loansByDay,
    });
  } catch (error) {
    console.error('분석 통계 조회 오류:', error);
    return NextResponse.json(
      { error: '분석 통계를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
