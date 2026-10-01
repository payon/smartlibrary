/**
 * 키오스크 설정 관리 API 라우트
 *
 * [GET] /api/admin/settings
 * 키오스크 설정 목록을 카테고리별로 그룹화하여 조회합니다.
 *
 * [PUT] /api/admin/settings
 * 키오스크 설정을 업데이트합니다.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, json } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 설정 목록 조회 (카테고리별 그룹화)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, 'settings:read');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const configs = await db.kioskConfig.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // 카테고리별로 그룹화
    const grouped: Record<string, typeof configs> = {};
    for (const config of configs) {
      if (!grouped[config.category]) {
        grouped[config.category] = [];
      }
      grouped[config.category].push(config);
    }

    return json({ configs, grouped });
  } catch (error) {
    console.error('설정 목록 조회 오류:', error);
    return json(
      { error: '설정 목록을 조회하는 중 오류가 발생했습니다.' },
      500
    );
  }
}

/**
 * 설정 업데이트
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, 'settings:write');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return json(
        { error: 'key와 value는 필수입니다.' },
        400
      );
    }

    const existing = await db.kioskConfig.findUnique({
      where: { key },
    });

    if (!existing) {
      return json(
        { error: '해당 키의 설정을 찾을 수 없습니다.' },
        404
      );
    }

    // [보안] 키별 값 범위 검증 (잘못된 값으로 키오스크 동작이 깨지는 것 방지)
    const rangeError = validateSettingValue(key, value);
    if (rangeError) {
      return json({ error: rangeError }, 400);
    }

    const config = await db.kioskConfig.update({
      where: { key },
      data: { value },
    });

    await logAudit({
      userId: auth.payload.userId,
      action: 'update',
      entity: 'kiosk_config',
      entityId: config.id,
      details: { key, oldValue: existing.value, newValue: value },
      ipAddress: getClientIp(request),
    });

    return json({
      config,
      message: '설정이 업데이트되었습니다',
    });
  } catch (error) {
    console.error('설정 업데이트 오류:', error);
    return json(
      { error: '설정을 업데이트하는 중 오류가 발생했습니다.' },
      500
    );
  }
}

/**
 * 설정 키별 허용 범위 검증
 * @returns 오류 메시지 또는 null (정상)
 */
function validateSettingValue(key: string, value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 100) {
    return '값은 100자 이내 문자열이어야 합니다.';
  }
  const num = Number(value);
  switch (key) {
    case 'kiosk.volume':
      if (!Number.isInteger(num) || num < 0 || num > 100) {
        return '음량은 0~100 정수여야 합니다.';
      }
      return null;
    case 'kiosk.screen_brightness':
      if (!Number.isInteger(num) || num < 10 || num > 100) {
        return '화면 밝기는 10~100 정수여야 합니다.';
      }
      return null;
    case 'kiosk.idle_timeout_seconds':
      if (!Number.isInteger(num) || num < 30 || num > 600) {
        return '유휴 시간은 30~600초 정수여야 합니다.';
      }
      return null;
    case 'loan.max_books_per_loan':
      if (!Number.isInteger(num) || num < 1 || num > 10) {
        return '최대 대여 권수는 1~10 정수여야 합니다.';
      }
      return null;
    case 'loan.loan_period_days':
      if (!Number.isInteger(num) || num < 1 || num > 60) {
        return '대여 기간은 1~60일 정수여야 합니다.';
      }
      return null;
    default:
      return null;
  }
}
