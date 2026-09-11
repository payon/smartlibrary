/**
 * 콘텐츠 버전 이력 API 라우트
 *
 * [GET] /api/admin/content/versions/[key]
 * 특정 콘텐츠 아이템의 버전 변경 이력을 조회합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * 콘텐츠 버전 이력 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
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

    if (!hasPermission(payload.role, 'content:read')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { key } = await params;

    // 콘텐츠 아이템 존재 확인
    const contentItem = await db.contentItem.findUnique({
      where: { key },
      select: { id: true, key: true, value: true, label: true },
    });

    if (!contentItem) {
      return NextResponse.json(
        { error: '해당 키의 콘텐츠 아이템을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 페이지네이션 파라미터
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    const [versions, total] = await Promise.all([
      db.contentVersion.findMany({
        where: { contentItemId: contentItem.id },
        orderBy: { changedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.contentVersion.count({
        where: { contentItemId: contentItem.id },
      }),
    ]);

    return NextResponse.json({
      contentItem,
      versions,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('콘텐츠 버전 이력 조회 오류:', error);
    return NextResponse.json(
      { error: '버전 이력을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
