/**
 * 감사 로그 API 라우트
 *
 * [GET] /api/admin/audit?userId=xxx&action=xxx&entity=xxx&from=xxx&to=xxx&page=1&pageSize=50
 * 감사 로그를 페이지네이션으로 조회합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, hasPermission } from '@/lib/admin-auth';
import { getAuditLogs } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

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

    if (!hasPermission(payload.role, 'audit:read')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    const userId = searchParams.get('userId') || undefined;
    const action = searchParams.get('action') || undefined;
    const entity = searchParams.get('entity') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    const { logs, total } = await getAuditLogs({
      userId,
      action,
      entity,
      from,
      to,
      page,
      pageSize,
    });

    return NextResponse.json({ logs, total });
  } catch (error) {
    console.error('감사 로그 조회 오류:', error);
    return NextResponse.json(
      { error: '감사 로그를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
