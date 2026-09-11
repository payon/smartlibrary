/**
 * 관리자 도서 상세 API 라우트
 *
 * [GET] /api/admin/books/[id]
 * [PUT] /api/admin/books/[id]
 * [DELETE] /api/admin/books/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 도서 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id } = await params;
    const book = await db.book.findUnique({
      where: { id },
      include: {
        loans: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!book) {
      return NextResponse.json(
        { error: '도서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ book });
  } catch (error) {
    console.error('도서 상세 조회 오류:', error);
    return NextResponse.json(
      { error: '도서를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 도서 업데이트
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id } = await params;
    const body = await request.json();

    const existing = await db.book.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: '도서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 업데이트할 필드만 추출
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'isbn', 'title', 'author', 'publisher', 'publishYear',
      'category', 'coverUrl', 'totalCopies', 'availableCopies', 'shelfLocation',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // ISBN 변경 시 중복 확인
    if (updateData.isbn && updateData.isbn !== existing.isbn) {
      const duplicate = await db.book.findUnique({
        where: { isbn: updateData.isbn as string },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: '이미 등록된 ISBN입니다.' },
          { status: 409 }
        );
      }
    }

    const book = await db.book.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      userId: payload.userId,
      action: 'update',
      entity: 'book',
      entityId: id,
      details: { updatedFields: Object.keys(updateData) },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      book,
      message: '도서가 업데이트되었습니다',
    });
  } catch (error) {
    console.error('도서 업데이트 오류:', error);
    return NextResponse.json(
      { error: '도서를 업데이트하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 도서 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id } = await params;

    const existing = await db.book.findUnique({
      where: { id },
      include: { loans: { where: { status: 'active' } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '도서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 활성 대출이 있는 경우 삭제 불가
    if (existing.loans.length > 0) {
      return NextResponse.json(
        { error: '활성 대출이 있는 도서는 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    await db.book.delete({ where: { id } });

    await logAudit({
      userId: payload.userId,
      action: 'delete',
      entity: 'book',
      entityId: id,
      details: { isbn: existing.isbn, title: existing.title },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      message: '도서가 삭제되었습니다',
    });
  } catch (error) {
    console.error('도서 삭제 오류:', error);
    return NextResponse.json(
      { error: '도서를 삭제하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
