/**
 * 관리자 로그아웃 API 라우트
 *
 * [POST] /api/admin/auth/logout
 * 관리자 로그아웃을 처리합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, deleteSession } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;

    if (token) {
      // 토큰 검증
      const payload = await verifyToken(token);

      // 세션 삭제
      await deleteSession(token);

      // 로그아웃 로그 기록
      if (payload) {
        await logAudit({
          userId: payload.userId,
          action: 'logout',
          entity: 'admin',
          entityId: payload.userId,
          ipAddress: getClientIp(request),
        });
      }
    }

    // 쿠키 삭제 및 응답
    const response = NextResponse.json({
      message: '로그아웃 성공',
    });

    response.cookies.set('admin_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('관리자 로그아웃 오류:', error);
    return NextResponse.json(
      { error: '로그아웃 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
