/**
 * 기본 API 라우트
 *
 * [GET] /api
 * 서버 상태 확인용 엔드포인트입니다.
 */

import { NextResponse } from "next/server";

/**
 * 기본 API 상태 확인 GET 핸들러
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "스마트 도서관 시뮬레이터",
    version: "1.0.0",
  });
}