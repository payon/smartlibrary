/**
 * 콘텐츠 리셋 API 라우트
 *
 * [POST] /api/admin/content/reset
 * 콘텐츠 아이템을 기본값으로 리셋합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { invalidateCache } from '@/lib/content-cache';
import { DEFAULT_CONTENT_ITEMS } from '@/lib/content-sync';
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
    const { key, all } = body as { key?: string; all?: boolean };

    if (all) {
      // 모든 콘텐츠를 기본값으로 리셋
      let resetCount = 0;

      await db.$transaction(async (tx) => {
        for (const defaultItem of DEFAULT_CONTENT_ITEMS) {
          const existingItem = await tx.contentItem.findUnique({
            where: { key: defaultItem.key },
          });

          if (existingItem) {
            await tx.contentItem.update({
              where: { key: defaultItem.key },
              data: { value: defaultItem.value },
            });

            await tx.contentVersion.create({
              data: {
                contentItemId: existingItem.id,
                oldValue: existingItem.value,
                newValue: defaultItem.value,
                changedBy: payload.userId,
              },
            });

            resetCount++;
          }
        }
      });

      invalidateCache();

      await logAudit({
        userId: payload.userId,
        action: 'update',
        entity: 'content',
        details: { resetAll: true, count: resetCount },
        ipAddress: getClientIp(request),
      });

      return NextResponse.json({
        message: `모든 콘텐츠가 기본값으로 리셋되었습니다 (${resetCount}개)`,
      });
    } else if (key) {
      // 특정 콘텐츠를 기본값으로 리셋
      const defaultItem = DEFAULT_CONTENT_ITEMS.find((item) => item.key === key);
      if (!defaultItem) {
        return NextResponse.json(
          { error: '해당 키의 기본 콘텐츠를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      const existingItem = await db.contentItem.findUnique({
        where: { key },
      });

      if (!existingItem) {
        return NextResponse.json(
          { error: '해당 키의 콘텐츠 아이템을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      const oldValue = existingItem.value;

      await db.contentItem.update({
        where: { key },
        data: { value: defaultItem.value },
      });

      await db.contentVersion.create({
        data: {
          contentItemId: existingItem.id,
          oldValue,
          newValue: defaultItem.value,
          changedBy: payload.userId,
        },
      });

      invalidateCache();

      await logAudit({
        userId: payload.userId,
        action: 'update',
        entity: 'content',
        entityId: existingItem.id,
        details: { resetKey: key, oldValue, newValue: defaultItem.value },
        ipAddress: getClientIp(request),
      });

      return NextResponse.json({
        message: `'${key}' 콘텐츠가 기본값으로 리셋되었습니다`,
      });
    } else {
      return NextResponse.json(
        { error: 'key 또는 all=true 중 하나를 지정해주세요.' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('콘텐츠 리셋 오류:', error);
    return NextResponse.json(
      { error: '콘텐츠를 리셋하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
