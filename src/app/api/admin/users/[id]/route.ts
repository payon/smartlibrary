/**
 * 관리자 계정 상세 API 라우트
 *
 * [PUT] /api/admin/users/[id]
 * [DELETE] /api/admin/users/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission, hashPassword } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 관리자 계정 업데이트
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    if (payload.role !== 'super_admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.adminUser.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: '관리자 계정을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // 비밀번호 변경 시 해시
    if (body.password) {
      updateData.passwordHash = await hashPassword(body.password);
    }

    const user = await db.adminUser.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      userId: payload.userId,
      action: 'update',
      entity: 'admin',
      entityId: id,
      details: { updatedFields: Object.keys(updateData) },
      ipAddress: getClientIp(request),
    });

    const { passwordHash: _, ...userWithoutHash } = user;

    return NextResponse.json({
      user: userWithoutHash,
      message: '관리자 계정이 업데이트되었습니다',
    });
  } catch (error) {
    console.error('관리자 계정 업데이트 오류:', error);
    return NextResponse.json(
      { error: '관리자 계정을 업데이트하는 중 오류가 발생했습니다.' },
      { status: 500 }
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
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    if (payload.role !== 'super_admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;

    // 자기 자신은 비활성화 불가
    if (id === payload.userId) {
      return NextResponse.json(
        { error: '자신의 계정은 비활성화할 수 없습니다.' },
        { status: 400 }
      );
    }

    const existing = await db.adminUser.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: '관리자 계정을 찾을 수 없습니다.' },
        { status: 404 }
      );
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
      userId: payload.userId,
      action: 'delete',
      entity: 'admin',
      entityId: id,
      details: { deactivated: true, email: existing.email },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      message: '관리자 계정이 비활성화되었습니다',
    });
  } catch (error) {
    console.error('관리자 계정 비활성화 오류:', error);
    return NextResponse.json(
      { error: '관리자 계정을 비활성화하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
