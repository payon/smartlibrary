/**
 * 콘텐츠 일괄 업데이트 API 라우트
 *
 * [POST] /api/admin/content/bulk
 * 여러 콘텐츠 아이템을 한 번에 업데이트합니다.
 *
 * [보안]
 * - 세션 DB 검증 포함 관리자 인증 (requireAdmin)
 * - 항목별 타입 검증 (부적합 항목은 전체 거부 + 원인 키 명시)
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, json } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit-logger';
import { invalidateCache } from '@/lib/content-cache';
import { getClientIp } from '@/lib/security';
import { validateContentValue } from '@/lib/content-validation';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 인증 확인 (세션 DB 검증 포함)
    const auth = await requireAdmin(request, 'content:write');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const body = await request.json();
    const { items, changedBy } = body as {
      items: Array<{ key: string; value: string }>;
      changedBy?: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return json(
        { error: '업데이트할 아이템 목록이 필요합니다.' },
        400
      );
    }

    if (items.length > 200) {
      return json(
        { error: '한 번에 200개까지만 업데이트할 수 있습니다.' },
        400
      );
    }

    // 사전 검증: 모든 항목의 타입 적합성 확인 (부분 적용 방지)
    const existingItems = await db.contentItem.findMany({
      where: { key: { in: items.map((i) => i.key) } },
    });
    const typeByKey = new Map(existingItems.map((e) => [e.key, e.type]));
    for (const item of items) {
      const type = typeByKey.get(item.key);
      if (!type) {
        return json(
          { error: `존재하지 않는 키입니다: ${item.key}` },
          404
        );
      }
      const validation = validateContentValue(type, item.value);
      if (!validation.ok) {
        return json(
          { error: `[${item.key}] ${validation.error}` },
          400
        );
      }
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
              changedBy: auth.payload.userId,
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
      userId: auth.payload.userId,
      action: 'update',
      entity: 'content',
      details: { bulkUpdate: true, count: updatedCount, keys: items.map((i) => i.key) },
      ipAddress: getClientIp(request),
    });

    return json({
      updated: updatedCount,
      message: `${updatedCount}개의 콘텐츠가 업데이트되었습니다`,
    });
  } catch (error) {
    console.error('콘텐츠 일괄 업데이트 오류:', error);
    return json(
      { error: '콘텐츠를 일괄 업데이트하는 중 오류가 발생했습니다.' },
      500
    );
  }
}
