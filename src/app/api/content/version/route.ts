/**
 * 콘텐츠 버전 공개 API 라우트
 *
 * [GET] /api/content/version
 * 키오스크 폴링에서 콘텐츠 버전 번호를 반환합니다.
 * 인증이 필요 없는 공개 엔드포인트입니다.
 */

import { NextResponse } from 'next/server';
import { getContentVersion } from '@/lib/content-cache';

export const dynamic = 'force-dynamic';

/**
 * 콘텐츠 버전 번호 조회
 * 키오스크에서 30초 간격으로 폴링하여 콘텐츠 변경 여부를 확인합니다.
 */
export async function GET() {
  try {
    const version = getContentVersion();

    return NextResponse.json(
      { version },
      {
        headers: {
          'Cache-Control': 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('콘텐츠 버전 조회 오류:', error);
    return NextResponse.json(
      { error: '콘텐츠 버전을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
