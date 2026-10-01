/**
 * 관리자 계정 상세 API 라우트 (super_admin 전용)
 *
 * [PUT] /api/admin/users/[id]
 * 이름/역할/활성상태/비밀번호를 수정합니다.
 *
 * [DELETE] /api/admin/users/[id]
 * 계정을 비활성화하고 세션을 모두 삭제합니다.
 *
 * [보호 규칙]
 * - 자기 자신의 역할/활성상태 변경 불가
 * - 마지막 활성 super_admin의 역할 변경/비활성화 불가
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, json } from '@/lib/api-helpers';
import { hashPassword, validateAdminPassword } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';
import { VALID_ADMIN_ROLES } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * 마지막 활성 super_admin 여부 확인
 */
async function isLastActiveSuperAdmin(id: string): Promise<boolean> {
  const target = await db.adminUser.findUnique({ where: { id } });
  if (!target || target.role !== 'super_admin' || !target.isActive) return false;
  const count = await db.adminUser.count({
    where: { role: 'super_admin', isActive: true },
  });
  return count <= 1;
}

/**
 * 관리자 계정 업데이트
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    if (auth.user.role !== 'super_admin') {
      return json({ error: '권한이 없습니다.' }, 403);
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.adminUser.findUnique({ where: { id } });
    if (!existing) {
      return json(
        { error: '관리자 계정을 찾을 수 없습니다.' },
        404
      );
    }

    const isSelf = id === auth.payload.userId;
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 50) {
        return json({ error: '이름은 2~50자여야 합니다.' }, 400);
      }
      updateData.name = body.name.trim();
    }

    if (body.role !== undefined) {
      if (!(VALID_ADMIN_ROLES as readonly string[]).includes(body.role)) {
        return json({ error: '유효하지 않은 역할입니다.' }, 400);
      }
      if (isSelf) {
        return json({ error: '자신의 역할은 변경할 수 없습니다.' }, 400);
      }
      if (body.role !== 'super_admin' && (await isLastActiveSuperAdmin(id))) {
        return json({ error: '마지막 최고관리자의 역할은 변경할 수 없습니다.' }, 400);
      }
      updateData.role = body.role;
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') {
        return json({ error: 'isActive는 boolean이어야 합니다.' }, 400);
      }
      if (isSelf && body.isActive === false) {
        return json({ error: '자신의 계정은 비활성화할 수 없습니다.' }, 400);
      }
      if (body.isActive === false && (await isLastActiveSuperAdmin(id))) {
        return json({ error: '마지막 최고관리자는 비활성화할 수 없습니다.' }, 400);
      }
      updateData.isActive = body.isActive;
    }

    // 비밀번호 변경 시 복잡도 검증 후 해시 (관리자 비밀번호 초기화용)
    if (body.password) {
      const pwError = validateAdminPassword(body.password);
      if (pwError) {
        return json({ error: pwError }, 400);
      }
      updateData.passwordHash = await hashPassword(body.password);
    }

    if (Object.keys(updateData).length === 0) {
      return json({ error: '변경할 항목이 없습니다.' }, 400);
    }

    const user = await db.adminUser.update({
      where: { id },
      data: updateData,
    });

    // 비활성화 시 세션도 모두 삭제
    if (updateData.isActive === false) {
      await db.adminSession.deleteMany({ where: { userId: id } });
    }

    await logAudit({
      userId: auth.payload.userId,
      action: 'update',
      entity: 'admin',
      entityId: id,
      details: { updatedFields: Object.keys(updateData).filter((k) => k !== 'passwordHash') },
      ipAddress: getClientIp(request),
    });

    const { passwordHash: _, ...userWithoutHash } = user;

    return json({
      user: userWithoutHash,
      message: '관리자 계정이 업데이트되었습니다',
    });
  } catch (error) {
    console.error('관리자 계정 업데이트 오류:', error);
    return json(
      { error: '관리자 계정을 업데이트하는 중 오류가 발생했습니다.' },
      500
    );
  }
}

/**
 * 관리자 계정 비활성화
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    if (auth.user.role !== 'super_admin') {
      return json({ error: '권한이 없습니다.' }, 403);
    }

    const { id } = await params;

    // 자기 자신은 비활성화 불가
    if (id === auth.payload.userId) {
      return json(
        { error: '자신의 계정은 비활성화할 수 없습니다.' },
        400
      );
    }

    const existing = await db.adminUser.findUnique({ where: { id } });
    if (!existing) {
      return json(
        { error: '관리자 계정을 찾을 수 없습니다.' },
        404
      );
    }

    if (await isLastActiveSuperAdmin(id)) {
      return json({ error: '마지막 최고관리자는 비활성화할 수 없습니다.' }, 400);
    }

    await db.adminUser.update({
      where: { id },
      data: { isActive: false },
    });

    // 세션도 모두 삭제
    await db.adminSession.deleteMany({
      where: { userId: id },
    });

    await logAudit({
      userId: auth.payload.userId,
      action: 'delete',
      entity: 'admin',
      entityId: id,
      details: { deactivated: true, email: existing.email },
      ipAddress: getClientIp(request),
    });

    return json({
      message: '관리자 계정이 비활성화되었습니다',
    });
  } catch (error) {
    console.error('관리자 계정 비활성화 오류:', error);
    return json(
      { error: '관리자 계정을 비활성화하는 중 오류가 발생했습니다.' },
      500
    );
  }
}
