/**
 * 키오스크 관리 API 라우트
 *
 * [GET] /api/admin/kiosk
 * 키오스크 상태 및 헬스 체크 정보를 조회합니다.
 *
 * [POST] /api/admin/kiosk
 * 키오스크를 리셋합니다. (캐시 무효화, 세션 정리 등)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { invalidateCache } from '@/lib/content-cache';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 키오스크 헬스 체크 및 상태 조회
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

    // 시스템 메트릭 조회
    const [
      activeUsers,
      activeLoans,
      totalBooks,
      totalContent,
      recentSessions,
      systemHealth,
    ] = await Promise.all([
      db.simUser.count({ where: { isActive: true } }),
      db.simLoan.count({ where: { status: 'active' } }),
      db.book.count(),
      db.contentItem.count(),
      db.adminSession.count({
        where: { expiresAt: { gt: new Date() } },
      }),
      db.systemHealth.findMany({
        orderBy: { timestamp: 'desc' },
        take: 20,
      }),
    ]);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: {
        activeUsers,
        activeLoans,
        totalBooks,
        totalContent,
        recentSessions,
      },
      systemHealth,
    };

    return NextResponse.json(health);
  } catch (error) {
    console.error('키오스크 헬스 체크 오류:', error);
    return NextResponse.json(
      { status: 'unhealthy', error: '헬스 체크 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 키오스크 리셋
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

    if (!hasPermission(payload.role, 'settings:write')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { resetType } = body as { resetType?: string };

    const results: string[] = [];

    // 캐시 무효화
    invalidateCache();
    results.push('content_cache_invalidated');

    // 만료된 세션 정리
    const deletedSessions = await db.adminSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    results.push(`expired_sessions_cleaned:${deletedSessions.count}`);

    // 리셋 타입에 따른 추가 작업
    if (resetType === 'full') {
      // 전체 리셋: 시스템 헬스 메트릭 초기화
      await db.systemHealth.deleteMany({});
      results.push('system_health_metrics_cleared');
    }

    // 감사 로그 기록
    await logAudit({
      userId: payload.userId,
      action: 'update',
      entity: 'kiosk_config',
      details: { resetType: resetType || 'soft', results },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      message: '키오스크가 리셋되었습니다',
      results,
      resetType: resetType || 'soft',
    });
  } catch (error) {
    console.error('키오스크 리셋 오류:', error);
    return NextResponse.json(
      { error: '키오스크를 리셋하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
