/**
 * 도서 검색 API 라우트
 *
 * [GET] /api/books?query=xxx
 * 도서를 검색합니다. 쿼리 없으면 전체 조회.
 *
 * [보안 조치]
 * - 검색어 길이 제한 (최대 100자)
 * - 검색어 sanitization
 * - 레이트 리미팅
 * - Prisma ORM 파라미터화 쿼리 (SQL Injection 방지)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  sanitizeString,
  checkRateLimit,
  getClientIp,
} from '@/lib/security';

/** 검색어 최대 길이 (DoS 방지) */
const MAX_QUERY_LENGTH = 100;

/** 레이트 리미팅 식별자 접두사 */
const RATE_LIMIT_PREFIX = 'book-search:';

export const dynamic = 'force-dynamic';

/**
 * 도서 검색 GET 핸들러
 * 제목, 저자, 카테고리에서 검색어를 포함하는 도서를 반환합니다.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('query')?.trim();

    // [보안] 레이트 리미팅 체크
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`${RATE_LIMIT_PREFIX}${clientIp}`, 60000, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    // 검색어가 있는 경우
    if (rawQuery) {
      // [보안] 검색어 길이 제한
      if (rawQuery.length > MAX_QUERY_LENGTH) {
        return NextResponse.json(
          { error: '검색어가 너무 깁니다. 100자 이하로 입력해주세요.' },
          { status: 400 }
        );
      }

      // [보안] 검색어 XSS sanitization
      const query = sanitizeString(rawQuery);

      // [데이터베이스] Prisma ORM 파라미터화 쿼리 (SQL Injection 방지)
      // contains 연산자는 Prisma가 내부적으로 파라미터화 처리
      const books = await db.book.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { author: { contains: query } },
            { category: { contains: query } },
          ],
        },
        orderBy: { title: 'asc' },
      });

      return NextResponse.json(books);
    }

    // 검색어 없음: 전체 도서 목록 반환
    const books = await db.book.findMany({
      orderBy: { title: 'asc' },
    });

    return NextResponse.json(books);
  } catch (error) {
    console.error('도서 검색 오류:', error);
    return NextResponse.json(
      { error: '도서를 검색하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
