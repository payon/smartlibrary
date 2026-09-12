/**
 * 관리자 세션 확인 API 라우트
 *
 * [GET] /api/admin/auth/session
 * 현재 로그인된 관리자 세션을 확인합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: '인증되지 않았습니다.', authenticated: false },
        { status: 401 }
      );
    }

    // 토큰 검증
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.', authenticated: false },
        { status: 401 }
      );
    }

    // [보안] DB에서 세션 존재 확인 (로그아웃된 토큰 재사용 방지)
    const session = await db.adminSession.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
      },
    });
    if (!session) {
      return NextResponse.json(
        { error: '만료되거나 로그아웃된 세션입니다.', authenticated: false },
        { status: 401 }
      );
    }

    // 사용자 정보 조회 (활성 상태 확인)
    const user = await db.adminUser.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: '비활성화된 계정입니다.', authenticated: false },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      authenticated: true,
    });
  } catch (error) {
    console.error('세션 확인 오류:', error);
    return NextResponse.json(
      { error: '세션 확인 중 오류가 발생했습니다.', authenticated: false },
      { status: 500 }
    );
  }
}
