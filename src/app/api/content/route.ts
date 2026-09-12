/**
 * 키오스크 콘텐츠 공개 API 라우트
 *
 * [GET] /api/content
 * 키오스크에서 사용할 콘텐츠를 key→value 맵으로 반환합니다.
 * 인증이 필요 없는 공개 엔드포인트입니다.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getContentVersion } from '@/lib/content-cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await db.contentItem.findMany({
      select: { key: true, value: true },
    });

    const content: Record<string, string> = {};
    for (const item of items) {
      content[item.key] = item.value;
    }

    const version = getContentVersion();
    const updatedAt = new Date().toISOString();

    return NextResponse.json(
      { content, version, updatedAt },
      {
        headers: {
          'Cache-Control': 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('콘텐츠 조회 오류:', error);
    return NextResponse.json(
      { error: '콘텐츠를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
