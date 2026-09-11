/**
 * 콘텐츠 일괄 업데이트 API 라우트
 *
 * [POST] /api/admin/content/bulk
 * 여러 콘텐츠 아이템을 한 번에 업데이트합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { invalidateCache } from '@/lib/content-cache';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    if (!hasPermission(payload.role, 'content:write')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { items, changedBy } = body as {
      items: Array<{ key: string; value: string }>;
      changedBy?: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: '업데이트할 아이템 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    let updatedCount = 0;

    // 트랜잭션으로 일괄 업데이트
    await db.$transaction(async (tx) => {
      for (const item of items) {
        const existingItem = await tx.contentItem.findUnique({
          where: { key: item.key },
        });

        if (existingItem) {
          const oldValue = existingItem.value;

          // 콘텐츠 업데이트
          await tx.contentItem.update({
            where: { key: item.key },
            data: { value: item.value },
          });

          // 버전 기록 생성
          await tx.contentVersion.create({
            data: {
              contentItemId: existingItem.id,
              oldValue,
              newValue: item.value,
              changedBy: changedBy || payload.userId,
            },
          });

          updatedCount++;
        }
      }
    });

    // 캐시 무효화
    invalidateCache();

    // 감사 로그 기록
    await logAudit({
      userId: payload.userId,
      action: 'update',
      entity: 'content',
      details: { bulkUpdate: true, count: updatedCount, keys: items.map((i) => i.key) },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      updated: updatedCount,
      message: `${updatedCount}개의 콘텐츠가 업데이트되었습니다`,
    });
  } catch (error) {
    console.error('콘텐츠 일괄 업데이트 오류:', error);
    return NextResponse.json(
      { error: '콘텐츠를 일괄 업데이트하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
