/**
 * 키오스크 하드웨어 설정 공개 API 라우트
 *
 * [GET] /api/kiosk-config
 * 프론트 표시에 필요한 최소 설정만 공개합니다 (인증 불필요).
 * 민감 설정(대출 규칙 등)은 제외 — 화이트리스트 방식.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** 프론트 공개 허용 키 */
const PUBLIC_KEYS = [
  'kiosk.volume',
  'kiosk.screen_brightness',
  'kiosk.idle_timeout_seconds',
] as const;

export async function GET() {
  try {
    const configs = await db.kioskConfig.findMany({
      where: { key: { in: [...PUBLIC_KEYS] } },
      select: { key: true, value: true, updatedAt: true },
    });

    const config: Record<string, string> = {};
    for (const c of configs) {
      config[c.key] = c.value;
    }

    return NextResponse.json(
      { config },
      { headers: { 'Cache-Control': 'no-cache' } }
    );
  } catch (error) {
    console.error('키오스크 설정 조회 오류:', error);
    return NextResponse.json(
      { error: '키오스크 설정을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
