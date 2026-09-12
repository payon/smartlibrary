/**
 * 콘텐츠 상세 API 라우트
 *
 * [GET] /api/admin/content/[key]
 * 단일 콘텐츠 아이템을 키로 조회합니다.
 *
 * [PUT] /api/admin/content/[key]
 * 콘텐츠 아이템을 키로 업데이트합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { invalidateCache } from '@/lib/content-cache';
import { getClientIp, sanitizeString } from '@/lib/security';

export const dynamic = 'force-dynamic';

/** 콘텐츠 값 최대 길이 */
const MAX_CONTENT_VALUE_LENGTH = 2000;
/** 허용되는 콘텐츠 타입 */
const VALID_CONTENT_TYPES = ['text', 'image', 'color', 'json', 'number'] as const;

/**
 * 단일 콘텐츠 아이템 조회
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

    const item = await db.contentItem.findUnique({
      where: { key },
      include: {
        versions: {
          orderBy: { changedAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: '해당 키의 콘텐츠 아이템을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('콘텐츠 상세 조회 오류:', error);
    return NextResponse.json(
      { error: '콘텐츠를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 콘텐츠 아이템 업데이트 (키로)
 */
export async function PUT(
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

    if (!hasPermission(payload.role, 'content:write')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { key } = await params;
    const body = await request.json();
    const { value, type, changedBy } = body;

    if (value === undefined) {
      return NextResponse.json(
        { error: 'value는 필수입니다.' },
        { status: 400 }
      );
    }

    // [보안] 콘텐츠 값 길이 제한
    if (value && value.length > MAX_CONTENT_VALUE_LENGTH) {
      return NextResponse.json(
        { error: `콘텐츠 값은 ${MAX_CONTENT_VALUE_LENGTH}자를 초과할 수 없습니다.` },
        { status: 400 }
      );
    }
    // [보안] 콘텐츠 타입 검증
    if (type && !VALID_CONTENT_TYPES.includes(type as any)) {
      return NextResponse.json(
        { error: '유효하지 않은 콘텐츠 타입입니다.' },
        { status: 400 }
      );
    }
    // [보안] 콘텐츠 값 새니타이즈
    const sanitizedValue = typeof value === 'string' ? sanitizeString(value) : value;

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

    // 콘텐츠 업데이트
    const item = await db.contentItem.update({
      where: { key },
      data: { value: sanitizedValue },
    });

    // 버전 기록 생성
    await db.contentVersion.create({
      data: {
        contentItemId: item.id,
        oldValue,
        newValue: sanitizedValue,
        changedBy: changedBy || payload.userId,
      },
    });

    // 캐시 무효화
    invalidateCache();

    // 감사 로그 기록
    await logAudit({
      userId: payload.userId,
      action: 'update',
      entity: 'content',
      entityId: item.id,
      details: { key, oldValue, newValue: sanitizedValue },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      item,
      message: '콘텐츠가 업데이트되었습니다',
    });
  } catch (error) {
    console.error('콘텐츠 업데이트 오류:', error);
    return NextResponse.json(
      { error: '콘텐츠를 업데이트하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
