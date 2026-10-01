/**
 * 콘텐츠 기본값 동기화 API 라우트
 *
 * [POST] /api/admin/content/sync
 * DEFAULT_CONTENT_ITEMS에 있지만 DB에 없는 키만 추가합니다.
 * (배포 후 새 키가 생겨도 기존 수정값을 덮어쓰지 않음)
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { invalidateCache } from '@/lib/content-cache';
import { DEFAULT_CONTENT_ITEMS } from '@/lib/content-sync';
import { getClientIp } from '@/lib/security';
import { json } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return json({ error: '인증이 필요합니다.' }, 401);
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return json({ error: '유효하지 않은 토큰입니다.' }, 401);
    }

    if (!hasPermission(payload.role, 'content:write')) {
      return json({ error: '권한이 없습니다.' }, 403);
    }

    const existing = await db.contentItem.findMany({ select: { key: true } });
    const existingKeys = new Set(existing.map((e) => e.key));

    const missing = DEFAULT_CONTENT_ITEMS.filter((item) => !existingKeys.has(item.key));

    for (const item of missing) {
      await db.contentItem.create({
        data: {
          key: item.key,
          value: item.value,
          type: item.type,
          screen: item.screen,
          label: item.label,
          sortOrder: DEFAULT_CONTENT_ITEMS.indexOf(item),
        },
      });
    }

    if (missing.length > 0) {
      invalidateCache();

      await logAudit({
        userId: payload.userId,
        action: 'create',
        entity: 'content',
        details: { syncMissing: true, count: missing.length, keys: missing.map((m) => m.key) },
        ipAddress: getClientIp(request),
      });
    }

    return json({
      message: `누락된 콘텐츠 ${missing.length}개를 추가했습니다.`,
      added: missing.map((m) => m.key),
    });
  } catch (error) {
    console.error('콘텐츠 동기화 오류:', error);
    return json(
      { error: '콘텐츠를 동기화하는 중 오류가 발생했습니다.' },
      500
    );
  }
}
