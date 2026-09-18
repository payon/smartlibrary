/**
 * 관리자 도서카드 발급 관리 API 라우트
 *
 * [GET] /api/admin/cards
 * 도서카드 발급 신청 목록을 조회합니다.
 * 쿼리: ?status=pending|approved|rejected|issued & ?search=이름/전화 & ?cardType=mobile|physical
 *
 * [POST] /api/admin/cards
 * 관리자가 직접 도서카드를 발급합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hasPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 도서카드 발급 신청 목록 조회
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const cardType = searchParams.get('cardType');

    // 필터 조건 구성
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (cardType) where.cardType = cardType;
    if (search) {
      where.OR = [
        { applicantName: { contains: search } },
        { phone: { contains: search } },
        { cardNumber: { contains: search } },
      ];
    }

    const cards = await db.libraryCard.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
    });

    // 통계 집계
    const stats = await db.libraryCard.aggregate({
      _count: { id: true },
      where: {},
    });

    const pendingCount = await db.libraryCard.count({ where: { status: 'pending' } });
    const approvedCount = await db.libraryCard.count({ where: { status: 'approved' } });
    const issuedCount = await db.libraryCard.count({ where: { status: 'issued' } });
    const rejectedCount = await db.libraryCard.count({ where: { status: 'rejected' } });

    return NextResponse.json({
      cards,
      stats: {
        total: stats._count.id,
        pending: pendingCount,
        approved: approvedCount,
        issued: issuedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    console.error('도서카드 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '도서카드 목록을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 관리자 직접 도서카드 발급
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { applicantName, birthDate, phone, address, cardType } = body;

    if (!applicantName || !birthDate || !phone) {
      return NextResponse.json(
        { error: '이름, 생년월일, 전화번호는 필수입니다.' },
        { status: 400 }
      );
    }

    // 카드 번호 자동 생성
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const random4 = Math.floor(1000 + Math.random() * 9000).toString();
    const cardNumber = `LIB-${dateStr}-${random4}`;

    // 기존 이용자 확인 (전화번호로)
    let user = await db.simUser.findFirst({ where: { phone } });

    // 이용자가 없으면 생성
    if (!user) {
      const pin = phone.slice(-4).padStart(4, '0');
      user = await db.simUser.create({
        data: {
          name: applicantName,
          birthDate,
          phone,
          address: address || null,
          cardType: cardType || 'mobile',
          cardNumber,
          pin,
          isActive: true,
        },
      });
    } else {
      // 기존 이용자에 카드 번호 업데이트
      await db.simUser.update({
        where: { id: user.id },
        data: { cardNumber, cardType: cardType || 'mobile' },
      });
    }

    // 도서카드 레코드 생성 (발급 완료 상태)
    const now = new Date();
    const card = await db.libraryCard.create({
      data: {
        applicantName,
        birthDate,
        phone,
        address: address || null,
        cardType: cardType || 'mobile',
        cardNumber,
        status: 'issued',
        approvedAt: now,
        approvedBy: payload.userId,
        issuedAt: now,
        userId: user.id,
      },
    });

    await logAudit({
      userId: payload.userId,
      action: 'create',
      entity: 'library_card',
      entityId: card.id,
      details: { applicantName, phone, cardNumber, status: 'issued' },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      card,
      user: { id: user.id, name: user.name, pin: user.pin, cardNumber: user.cardNumber },
      message: '도서카드가 발급되었습니다',
    });
  } catch (error) {
    console.error('도서카드 발급 오류:', error);
    return NextResponse.json(
      { error: '도서카드 발급 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
