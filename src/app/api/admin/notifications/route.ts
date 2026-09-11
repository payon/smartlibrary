/**
 * 알림 관리 API 라우트
 *
 * [GET] /api/admin/notifications
 * 알림 목록을 조회합니다.
 *
 * [POST] /api/admin/notifications
 * 새로운 알림을 생성합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 알림 목록 조회
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

    if (!hasPermission(payload.role, 'notifications:read')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const notifications = await db.notification.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('알림 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '알림 목록을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 알림 생성
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

    if (!hasPermission(payload.role, 'notifications:write')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { type, title, message } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'type, title, message는 필수입니다.' },
        { status: 400 }
      );
    }

    const notification = await db.notification.create({
      data: {
        type,
        title,
        message,
        createdBy: payload.userId,
      },
    });

    await logAudit({
      userId: payload.userId,
      action: 'create',
      entity: 'notification',
      entityId: notification.id,
      details: { type, title },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      notification,
      message: '알림이 생성되었습니다',
    });
  } catch (error) {
    console.error('알림 생성 오류:', error);
    return NextResponse.json(
      { error: '알림을 생성하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
