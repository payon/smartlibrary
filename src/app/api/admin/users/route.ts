/**
 * 관리자 계정 관리 API 라우트
 *
 * [GET] /api/admin/users
 * 관리자 계정 목록을 조회합니다.
 *
 * [POST] /api/admin/users
 * 새로운 관리자 계정을 생성합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission, hashPassword } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 관리자 계정 목록 조회
 */
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

    if (!hasPermission(payload.role, 'users:read')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
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

    return NextResponse.json({ users });
  } catch (error) {
    console.error('관리자 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '관리자 목록을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 관리자 계정 생성
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

    // super_admin만 관리자 계정 생성 가능
    if (!hasPermission(payload.role, 'users:read') || payload.role !== 'super_admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, password, role } = body;

    if (!email || !name || !password || !role) {
      return NextResponse.json(
        { error: '이메일, 이름, 비밀번호, 역할은 필수입니다.' },
        { status: 400 }
      );
    }

    // 이메일 중복 확인
    const existing = await db.adminUser.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: '이미 등록된 이메일입니다.' },
        { status: 409 }
      );
    }

    // 비밀번호 해시
    const passwordHash = await hashPassword(password);

    const user = await db.adminUser.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        isActive: true,
      },
    });

    await logAudit({
      userId: payload.userId,
      action: 'create',
      entity: 'admin',
      entityId: user.id,
      details: { email, name, role },
      ipAddress: getClientIp(request),
    });

    // passwordHash 제외하고 반환
    const { passwordHash: _, ...userWithoutHash } = user;

    return NextResponse.json({
      user: userWithoutHash,
      message: '관리자 계정이 생성되었습니다',
    });
  } catch (error) {
    console.error('관리자 계정 생성 오류:', error);
    return NextResponse.json(
      { error: '관리자 계정을 생성하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
