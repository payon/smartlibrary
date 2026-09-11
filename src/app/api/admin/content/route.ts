/**
 * 콘텐츠 관리 API 라우트
 *
 * [GET] /api/admin/content?screen=xxx
 * 콘텐츠 아이템 목록을 조회합니다.
 *
 * [PUT] /api/admin/content
 * 콘텐츠 아이템을 업데이트합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { invalidateCache } from '@/lib/content-cache';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 콘텐츠 목록 조회
 */
export async function GET(request: NextRequest) {
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

    if (!hasPermission(payload.role, 'content:read')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const screen = searchParams.get('screen');

    const where = screen ? { screen } : {};

    const items = await db.contentItem.findMany({
      where,
      orderBy: [{ screen: 'asc' }, { key: 'asc' }],
    });

    const version = await db.contentItem.count();

    return NextResponse.json({ items, version });
  } catch (error) {
    console.error('콘텐츠 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '콘텐츠 목록을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 콘텐츠 아이템 업데이트
 */
export async function PUT(request: NextRequest) {
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
    const { key, value, changedBy } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'key와 value는 필수입니다.' },
        { status: 400 }
      );
    }

    // 기존 콘텐츠 아이템 조회
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
      data: { value },
    });

    // 버전 기록 생성
    await db.contentVersion.create({
      data: {
        contentItemId: item.id,
        oldValue,
        newValue: value,
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
      details: { key, oldValue, newValue: value },
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
