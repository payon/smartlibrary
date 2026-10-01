/**
 * 콘텐츠 관리 API 라우트
 *
 * [GET] /api/admin/content?screen=xxx
 * 콘텐츠 아이템 목록을 조회합니다.
 *
 * [PUT] /api/admin/content
 * 콘텐츠 아이템을 업데이트합니다.
 *
 * [보안]
 * - 세션 DB 검증 포함 관리자 인증 (requireAdmin)
 * - 타입별 값 검증 (content-validation)
 * - 저장 시 HTML 이스케이프를 하지 않음 (React 렌더 시점에 이스케이프됨.
 *   이스케이프 후 저장하면 이미지 URL의 `/` 가 깨져 프론트에 적용되지 않음)
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, json } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit-logger';
import { invalidateCache } from '@/lib/content-cache';
import { getClientIp } from '@/lib/security';
import { validateContentValue } from '@/lib/content-validation';

export const dynamic = 'force-dynamic';

/** 허용되는 콘텐츠 타입 */
const VALID_CONTENT_TYPES = ['text', 'image', 'color', 'json', 'number'] as const;

/**
 * 콘텐츠 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인 (세션 DB 검증 포함)
    const auth = await requireAdmin(request, 'content:read');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const { searchParams } = new URL(request.url);
    const screen = searchParams.get('screen');

    const where = screen ? { screen } : {};

    const items = await db.contentItem.findMany({
      where,
      orderBy: [{ screen: 'asc' }, { sortOrder: 'asc' }, { key: 'asc' }],
    });

    const version = await db.contentItem.count();

    return json({ items, version });
  } catch (error) {
    console.error('콘텐츠 목록 조회 오류:', error);
    return json(
      { error: '콘텐츠 목록을 조회하는 중 오류가 발생했습니다.' },
      500
    );
  }
}

/**
 * 콘텐츠 아이템 업데이트
 */
export async function PUT(request: NextRequest) {
  try {
    // 인증 확인 (세션 DB 검증 포함)
    const auth = await requireAdmin(request, 'content:write');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const body = await request.json();
    const { key, value, type } = body;

    if (!key || value === undefined) {
      return json(
        { error: 'key와 value는 필수입니다.' },
        400
      );
    }

    // [보안] 콘텐츠 타입 검증
    if (type && !(VALID_CONTENT_TYPES as readonly string[]).includes(type)) {
      return json(
        { error: '유효하지 않은 콘텐츠 타입입니다.' },
        400
      );
    }

    // 기존 콘텐츠 아이템 조회
    const existingItem = await db.contentItem.findUnique({
      where: { key },
    });

    if (!existingItem) {
      return json(
        { error: '해당 키의 콘텐츠 아이템을 찾을 수 없습니다.' },
        404
      );
    }

    // [보안] 아이템 타입 기준 값 검증 (이스케이프 없이 원본 저장)
    const validation = validateContentValue(existingItem.type, value);
    if (!validation.ok) {
      return json({ error: validation.error }, 400);
    }

    // 순서 변경 (선택)
    let sortOrder = existingItem.sortOrder;
    if (body.sortOrder !== undefined) {
      if (!Number.isInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 9999) {
        return json({ error: '순서는 0~9999 정수여야 합니다.' }, 400);
      }
      sortOrder = body.sortOrder;
    }

    const oldValue = existingItem.value;

    // 콘텐츠 업데이트
    const item = await db.contentItem.update({
      where: { key },
      data: { value, sortOrder },
    });

    // 버전 기록 생성
    await db.contentVersion.create({
      data: {
        contentItemId: item.id,
        oldValue,
        newValue: value,
        changedBy: auth.payload.userId, // Always use server-authenticated user ID
      },
    });

    // 캐시 무효화
    invalidateCache();

    // 감사 로그 기록
    await logAudit({
      userId: auth.payload.userId,
      action: 'update',
      entity: 'content',
      entityId: item.id,
      details: { key, oldValue, newValue: value },
      ipAddress: getClientIp(request),
    });

    return json({
      item,
      message: '콘텐츠가 업데이트되었습니다',
    });
  } catch (error) {
    console.error('콘텐츠 업데이트 오류:', error);
    return json(
      { error: '콘텐츠를 업데이트하는 중 오류가 발생했습니다.' },
      500
    );
  }
}

/**
 * 콘텐츠 아이템 생성 (관리자 직접 추가)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, 'content:write');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const body = await request.json();
    const { key, value, type, screen, label } = body;

    if (!key || value === undefined || !type || !screen || !label) {
      return json(
        { error: 'key, value, type, screen, label은 필수입니다.' },
        400
      );
    }

    // [보안] 키 형식 검증 (screen.name, 소문자/숫자/점/하이픈/언더스코어)
    if (
      typeof key !== 'string' ||
      !/^[a-z0-9][a-z0-9._-]{1,100}$/.test(key) ||
      !key.includes('.')
    ) {
      return json(
        { error: '키는 "화면이름.항목이름" 형식(영문 소문자/숫자/._-)이어야 합니다.' },
        400
      );
    }

    if (!(VALID_CONTENT_TYPES as readonly string[]).includes(type)) {
      return json({ error: '유효하지 않은 콘텐츠 타입입니다.' }, 400);
    }

    if (typeof screen !== 'string' || !/^[a-z0-9-]{1,30}$/.test(screen)) {
      return json({ error: 'screen은 영문 소문자/숫자/하이픈 30자 이내여야 합니다.' }, 400);
    }

    if (typeof label !== 'string' || label.trim().length === 0 || label.length > 100) {
      return json({ error: 'label은 1~100자여야 합니다.' }, 400);
    }

    // [보안] 타입별 값 검증
    const validation = validateContentValue(type, value);
    if (!validation.ok) {
      return json({ error: validation.error }, 400);
    }

    const existing = await db.contentItem.findUnique({ where: { key } });
    if (existing) {
      return json({ error: '이미 존재하는 키입니다.' }, 409);
    }

    // 같은 화면 맨 뒤 순서로 배치
    const maxOrder = await db.contentItem.aggregate({
      where: { screen },
      _max: { sortOrder: true },
    });

    const item = await db.contentItem.create({
      data: {
        key,
        value,
        type,
        screen,
        label: label.trim(),
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    invalidateCache();

    await logAudit({
      userId: auth.payload.userId,
      action: 'create',
      entity: 'content',
      entityId: item.id,
      details: { key, type, screen },
      ipAddress: getClientIp(request),
    });

    return json({ item, message: '콘텐츠가 추가되었습니다' }, 201);
  } catch (error) {
    console.error('콘텐츠 생성 오류:', error);
    return json({ error: '콘텐츠를 생성하는 중 오류가 발생했습니다.' }, 500);
  }
}

/**
 * 콘텐츠 아이템 삭제 (쿼리 ?key=xxx)
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, 'content:write');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (!key) {
      return json({ error: 'key 파라미터가 필요합니다.' }, 400);
    }

    const existing = await db.contentItem.findUnique({ where: { key } });
    if (!existing) {
      return json({ error: '해당 키의 콘텐츠 아이템을 찾을 수 없습니다.' }, 404);
    }

    await db.contentVersion.deleteMany({ where: { contentItemId: existing.id } });
    await db.contentItem.delete({ where: { key } });

    invalidateCache();

    await logAudit({
      userId: auth.payload.userId,
      action: 'delete',
      entity: 'content',
      entityId: existing.id,
      details: { key },
      ipAddress: getClientIp(request),
    });

    return json({ message: '콘텐츠가 삭제되었습니다' });
  } catch (error) {
    console.error('콘텐츠 삭제 오류:', error);
    return json({ error: '콘텐츠를 삭제하는 중 오류가 발생했습니다.' }, 500);
  }
}
