/**
 * 관리자 비밀번호 변경 API 라우트
 *
 * [POST] /api/admin/auth/change-password
 * 현재 비밀번호를 확인 후 새 비밀번호로 변경합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, verifyPassword, hashPassword } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp, checkRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 비밀번호 변경
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // 레이트 리미팅 (5분당 5회)
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(
      `change-password:${payload.userId}`,
      5 * 60 * 1000,
      5
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: '비밀번호 변경 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 새 비밀번호 길이 검증
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: '새 비밀번호는 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 관리자 사용자 조회
    const user = await db.adminUser.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 현재 비밀번호 검증
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      // 실패 로그 기록
      await logAudit({
        userId: payload.userId,
        action: 'update',
        entity: 'admin',
        entityId: payload.userId,
        details: { action: 'change_password', success: false },
        ipAddress: clientIp,
      });

      return NextResponse.json(
        { error: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 새 비밀번호 해시 및 업데이트
    const newPasswordHash = await hashPassword(newPassword);
    await db.adminUser.update({
      where: { id: payload.userId },
      data: { passwordHash: newPasswordHash },
    });

    // 성공 로그 기록
    await logAudit({
      userId: payload.userId,
      action: 'update',
      entity: 'admin',
      entityId: payload.userId,
      details: { action: 'change_password', success: true },
      ipAddress: clientIp,
    });

    return NextResponse.json({
      message: '비밀번호가 변경되었습니다',
    });
  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    return NextResponse.json(
      { error: '비밀번호를 변경하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
