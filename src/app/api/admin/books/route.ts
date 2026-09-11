/**
 * 관리자 도서 관리 API 라우트
 *
 * [GET] /api/admin/books?search=xxx&category=xxx
 * 도서 목록을 조회합니다.
 *
 * [POST] /api/admin/books
 * 새로운 도서를 생성합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 도서 목록 조회
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

    if (!hasPermission(payload.role, 'books:read')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const category = searchParams.get('category')?.trim();

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { author: { contains: search } },
        { isbn: { contains: search } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const books = await db.book.findMany({
      where,
      orderBy: { title: 'asc' },
      include: {
        _count: {
          select: { loans: true },
        },
      },
    });

    return NextResponse.json({ books });
  } catch (error) {
    console.error('도서 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '도서 목록을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 도서 생성
 */
export async function POST(request: NextRequest) {
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

    if (!hasPermission(payload.role, 'books:write')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      isbn,
      title,
      author,
      publisher,
      publishYear,
      category,
      coverUrl,
      totalCopies,
      availableCopies,
      shelfLocation,
    } = body;

    if (!isbn || !title || !author) {
      return NextResponse.json(
        { error: 'ISBN, 제목, 저자는 필수입니다.' },
        { status: 400 }
      );
    }

    // ISBN 중복 확인
    const existing = await db.book.findUnique({
      where: { isbn },
    });

    if (existing) {
      return NextResponse.json(
        { error: '이미 등록된 ISBN입니다.' },
        { status: 409 }
      );
    }

    const book = await db.book.create({
      data: {
        isbn,
        title,
        author,
        publisher: publisher || null,
        publishYear: publishYear || null,
        category: category || null,
        coverUrl: coverUrl || null,
        totalCopies: totalCopies ?? 3,
        availableCopies: availableCopies ?? totalCopies ?? 3,
        shelfLocation: shelfLocation || null,
      },
    });

    // 감사 로그 기록
    await logAudit({
      userId: payload.userId,
      action: 'create',
      entity: 'book',
      entityId: book.id,
      details: { isbn, title, author },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      book,
      message: '도서가 등록되었습니다',
    });
  } catch (error) {
    console.error('도서 생성 오류:', error);
    return NextResponse.json(
      { error: '도서를 생성하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
