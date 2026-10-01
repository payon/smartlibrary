/**
 * 관리자 계정 관리 API 라우트
 *
 * [GET] /api/admin/users
 * 관리자 계정 목록을 조회합니다.
 *
 * [POST] /api/admin/users (super_admin 전용)
 * 새로운 관리자 계정을 생성합니다.
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
 * 관리자 계정 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, 'users:read');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const users = await db.adminUser.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return json({ users });
  } catch (error) {
    console.error('관리자 목록 조회 오류:', error);
    return json(
      { error: '관리자 목록을 조회하는 중 오류가 발생했습니다.' },
      500
    );
  }
}

/**
 * 관리자 계정 생성 (super_admin 전용)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    // super_admin만 관리자 계정 생성 가능
    if (auth.user.role !== 'super_admin') {
      return json({ error: '권한이 없습니다.' }, 403);
    }

    const body = await request.json();
    const { email, name, password, role } = body;

    if (!email || !name || !password || !role) {
      return json(
        { error: '이메일, 이름, 비밀번호, 역할은 필수입니다.' },
        400
      );
    }

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return json({ error: '올바른 이메일 형식이어야 합니다.' }, 400);
    }

    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
      return json({ error: '이름은 2~50자여야 합니다.' }, 400);
    }

    // [보안] 역할 검증
    if (!(VALID_ADMIN_ROLES as readonly string[]).includes(role)) {
      return json(
        { error: '유효하지 않은 역할입니다. (super_admin, admin, operator)' },
        400
      );
    }

    // [보안] 비밀번호 복잡도 검증
    const pwError = validateAdminPassword(password);
    if (pwError) {
      return json({ error: pwError }, 400);
    }

    // 이메일 중복 확인
    const existing = await db.adminUser.findUnique({
      where: { email: email.trim() },
    });

    if (existing) {
      return json(
        { error: '이미 등록된 이메일입니다.' },
        409
      );
    }

    // 비밀번호 해시
    const passwordHash = await hashPassword(password);

    const user = await db.adminUser.create({
      data: {
        email: email.trim(),
        name: name.trim(),
        passwordHash,
        role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logAudit({
      userId: auth.payload.userId,
      action: 'create',
      entity: 'admin',
      entityId: user.id,
      details: { email: user.email, name: user.name, role: user.role },
      ipAddress: getClientIp(request),
    });

    return json({
      user,
      message: '관리자 계정이 생성되었습니다',
    });
  } catch (error) {
    console.error('관리자 계정 생성 오류:', error);
    return json(
      { error: '관리자 계정을 생성하는 중 오류가 발생했습니다.' },
      500
    );
  }
}
