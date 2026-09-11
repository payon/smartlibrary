/**
 * 키오스크 설정 관리 API 라우트
 *
 * [GET] /api/admin/settings
 * 키오스크 설정 목록을 카테고리별로 그룹화하여 조회합니다.
 *
 * [PUT] /api/admin/settings
 * 키오스크 설정을 업데이트합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 설정 목록 조회 (카테고리별 그룹화)
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

    if (!hasPermission(payload.role, 'settings:read')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const configs = await db.kioskConfig.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // 카테고리별로 그룹화
    const grouped: Record<string, typeof configs> = {};
    for (const config of configs) {
      if (!grouped[config.category]) {
        grouped[config.category] = [];
      }
      grouped[config.category].push(config);
    }

    return NextResponse.json({ configs, grouped });
  } catch (error) {
    console.error('설정 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '설정 목록을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 설정 업데이트
 */
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    if (!hasPermission(payload.role, 'settings:write')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'key와 value는 필수입니다.' },
        { status: 400 }
      );
    }

    const existing = await db.kioskConfig.findUnique({
      where: { key },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '해당 키의 설정을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const config = await db.kioskConfig.update({
      where: { key },
      data: { value },
    });

    await logAudit({
      userId: payload.userId,
      action: 'update',
      entity: 'kiosk_config',
      entityId: config.id,
      details: { key, oldValue: existing.value, newValue: value },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      config,
      message: '설정이 업데이트되었습니다',
    });
  } catch (error) {
    console.error('설정 업데이트 오류:', error);
    return NextResponse.json(
      { error: '설정을 업데이트하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
