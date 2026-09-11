/**
 * 키오스크 사용자 관리 API 라우트
 *
 * [GET] /api/admin/kiosk-users?search=xxx
 * SimUser(키오스크 사용자) 목록을 대출 정보와 함께 조회합니다.
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

    if (!hasPermission(payload.role, 'kiosk-users:read')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { cardNumber: { contains: search } },
      ];
    }

    const users = await db.simUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        loans: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    // 대출 정보와 함께 반환
    const usersWithLoans = users.map((user) => {
      const activeLoans = user.loans.filter((loan) => loan.status === 'active').length;
      const totalLoans = user.loans.length;

      const { loans, ...userWithoutLoans } = user;

      return {
        ...userWithoutLoans,
        activeLoans,
        totalLoans,
      };
    });

    return NextResponse.json({ users: usersWithLoans });
  } catch (error) {
    console.error('키오스크 사용자 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '키오스크 사용자 목록을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
