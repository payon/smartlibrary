/**
 * 도서 대출 연장 API 라우트
 *
 * [POST] /api/loans/[id]/extend
 * 대출 연장 요청을 처리합니다.
 *
 * [비즈니스 규칙]
 * - 연장은 항상 불가 (정책상 15일 고정)
 * - 모든 요청에 대해 400 에러 반환
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 대출 연장 POST 핸들러
 * 정책상 대출 연장을 허용하지 않습니다.
 */
export async function POST() {
  // [비즈니스 규칙] 연장 불가 정책 적용
  return NextResponse.json(
    { error: '도서 대출 연장이 불가합니다. 반납일을 준수해주세요.' },
    { status: 400 }
  );
}
