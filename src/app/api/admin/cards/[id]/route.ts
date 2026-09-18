/**
 * 관리자 도서카드 개별 관리 API 라우트
 *
 * [GET] /api/admin/cards/[id]
 * 도서카드 상세 정보를 조회합니다.
 *
 * [PUT] /api/admin/cards/[id]
 * 도서카드 상태를 변경합니다. (승인/거부/발급)
 * body: { action: 'approve' | 'reject' | 'issue' | 'cancel', reason?: string }
 *
 * [DELETE] /api/admin/cards/[id]
 * 도서카드 신청을 삭제합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 도서카드 상세 조회
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

    if (!hasPermission(payload.role, 'cards:read')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const card = await db.libraryCard.findUnique({
      where: { id },
    });

    if (!card) {
      return NextResponse.json({ error: '도서카드를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 연결된 이용자 정보도 조회
    let linkedUser = null;
    if (card.userId) {
      linkedUser = await db.simUser.findUnique({
        where: { id: card.userId },
        select: {
          id: true,
          name: true,
          phone: true,
          cardNumber: true,
          pin: true,
          isActive: true,
        },
      });
    }

    // 승인자 정보
    let approver = null;
    if (card.approvedBy) {
      approver = await db.adminUser.findUnique({
        where: { id: card.approvedBy },
        select: { id: true, name: true, email: true },
      });
    }

    return NextResponse.json({ card, linkedUser, approver });
  } catch (error) {
    console.error('도서카드 상세 조회 오류:', error);
    return NextResponse.json(
      { error: '도서카드 상세 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 도서카드 상태 변경 (승인/거부/발급/취소)
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

    if (!hasPermission(payload.role, 'cards:write')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body;

    if (!action || !['approve', 'reject', 'issue', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: '유효한 작업을 지정하세요. (approve, reject, issue, cancel)' },
        { status: 400 }
      );
    }

    const card = await db.libraryCard.findUnique({ where: { id } });
    if (!card) {
      return NextResponse.json({ error: '도서카드를 찾을 수 없습니다.' }, { status: 404 });
    }

    const now = new Date();
    let updateData: Record<string, unknown> = {};
    let newStatus = card.status;

    switch (action) {
      case 'approve':
        // pending → approved
        if (card.status !== 'pending') {
          return NextResponse.json(
            { error: '대기 상태의 신청만 승인할 수 있습니다.' },
            { status: 400 }
          );
        }
        newStatus = 'approved';
        updateData = {
          status: 'approved',
          approvedAt: now,
          approvedBy: payload.userId,
        };
        break;

      case 'reject':
        // pending → rejected
        if (card.status !== 'pending') {
          return NextResponse.json(
            { error: '대기 상태의 신청만 거부할 수 있습니다.' },
            { status: 400 }
          );
        }
        newStatus = 'rejected';
        updateData = {
          status: 'rejected',
          approvedAt: now,
          approvedBy: payload.userId,
        };
        break;

      case 'issue':
        // approved → issued (카드 번호 발급)
        if (card.status !== 'approved' && card.status !== 'pending') {
          return NextResponse.json(
            { error: '승인된 신청만 발급할 수 있습니다.' },
            { status: 400 }
          );
        }
        // 카드 번호 생성 (아직 없으면)
        if (!card.cardNumber) {
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const random4 = Math.floor(1000 + Math.random() * 9000).toString();
          const cardNumber = `LIB-${dateStr}-${random4}`;
          updateData = {
            status: 'issued',
            cardNumber,
            approvedAt: card.approvedAt || now,
            approvedBy: card.approvedBy || payload.userId,
            issuedAt: now,
          };
        } else {
          updateData = {
            status: 'issued',
            approvedAt: card.approvedAt || now,
            approvedBy: card.approvedBy || payload.userId,
            issuedAt: now,
          };
        }
        newStatus = 'issued';

        // SimUser에 카드 번호 연동
        if (card.userId) {
          const existingCard = await db.libraryCard.findUnique({ where: { id } });
          if (existingCard?.cardNumber) {
            await db.simUser.update({
              where: { id: card.userId },
              data: {
                cardNumber: existingCard.cardNumber,
                cardType: card.cardType,
                cardIssued: now.toISOString().split('T')[0],
              },
            });
          }
        }
        break;

      case 'cancel':
        // any → cancelled (사용자 요청 취소)
        if (card.status === 'issued') {
          return NextResponse.json(
            { error: '이미 발급된 카드는 취소할 수 없습니다.' },
            { status: 400 }
          );
        }
        newStatus = 'rejected';
        updateData = {
          status: 'rejected',
          approvedAt: now,
          approvedBy: payload.userId,
        };
        break;
    }

    const updatedCard = await db.libraryCard.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      userId: payload.userId,
      action: 'update',
      entity: 'library_card',
      entityId: id,
      details: { action, from: card.status, to: newStatus, reason: reason || undefined },
      ipAddress: getClientIp(request),
    });

    const actionMessages: Record<string, string> = {
      approve: '도서카드 신청이 승인되었습니다',
      reject: '도서카드 신청이 거부되었습니다',
      issue: '도서카드가 발급되었습니다',
      cancel: '도서카드 신청이 취소되었습니다',
    };

    return NextResponse.json({
      card: updatedCard,
      message: actionMessages[action],
    });
  } catch (error) {
    console.error('도서카드 상태 변경 오류:', error);
    return NextResponse.json(
      { error: '도서카드 상태 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 도서카드 신청 삭제
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

    if (!hasPermission(payload.role, 'cards:write')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const card = await db.libraryCard.findUnique({ where: { id } });
    if (!card) {
      return NextResponse.json({ error: '도서카드를 찾을 수 없습니다.' }, { status: 404 });
    }

    await db.libraryCard.delete({ where: { id } });

    await logAudit({
      userId: payload.userId,
      action: 'delete',
      entity: 'library_card',
      entityId: id,
      details: { applicantName: card.applicantName, cardNumber: card.cardNumber },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ message: '도서카드 신청이 삭제되었습니다' });
  } catch (error) {
    console.error('도서카드 삭제 오류:', error);
    return NextResponse.json(
      { error: '도서카드 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
