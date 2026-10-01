/**
 * 관리자 비밀번호 변경 API 라우트
 *
 * [POST] /api/admin/auth/change-password
 * 현재 비밀번호를 확인 후 새 비밀번호로 변경합니다.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, json } from '@/lib/api-helpers';
import { verifyPassword, hashPassword, validateAdminPassword } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp, checkRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 비밀번호 변경
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }
    const payload = auth.payload;

    // 레이트 리미팅 (5분당 5회)
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(
      `change-password:${payload.userId}`,
      5 * 60 * 1000,
      5
    );
    if (!rateLimitResult.allowed) {
      return json({ error: '비밀번호 변경 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429);
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' }, 400);
    }

    // [보안] 새 비밀번호 복잡도 검증 (공통 기준)
    const pwError = validateAdminPassword(newPassword);
    if (pwError) {
      return json({ error: pwError }, 400);
    }

    // 관리자 사용자 조회
    const user = await db.adminUser.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return json({ error: '사용자를 찾을 수 없습니다.' }, 404);
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

      return json({ error: '현재 비밀번호가 올바르지 않습니다.' }, 401);
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

    return json({
      message: '비밀번호가 변경되었습니다',
    });
  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    return json(
      { error: '비밀번호를 변경하는 중 오류가 발생했습니다.' }, 500);
  }
}
