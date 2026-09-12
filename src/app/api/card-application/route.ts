/**
 * 도서증 발급 신청 API 라우트
 *
 * [POST] /api/card-application - 카드 발급 신청
 *
 * [처리 로직]
 * - 필수 필드 유효성 검증
 * - LibraryCard 레코드 생성
 * - 모바일 카드: 자동 승인 (status='issued'), 카드 번호 생성
 * - 실물 카드: 승인 대기 (status='pending')
 * - 동일 전화번호 SimUser가 없으면 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * 카드 번호 생성: LIB-YYYYMMDD-XXXX
 */
function generateCardNumber(): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const random = String(Math.floor(1000 + Math.random() * 9000));
  return `LIB-${datePart}-${random}`;
}

/**
 * 카드 발급 신청 POST 핸들러
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { applicantName, birthDate, phone, address, cardType } = body;

    // 필수 필드 검증
    if (!applicantName || typeof applicantName !== 'string' || applicantName.trim().length < 2) {
      return NextResponse.json(
        { error: '이름은 2자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    if (!birthDate || typeof birthDate !== 'string' || !/^\d{8}$/.test(birthDate.replace(/\s/g, ''))) {
      return NextResponse.json(
        { error: '생년월일은 8자리 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    if (!phone || typeof phone !== 'string' || !/^\d{10,11}$/.test(phone.replace(/[^0-9]/g, ''))) {
      return NextResponse.json(
        { error: '올바른 전화번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!cardType || (cardType !== 'mobile' && cardType !== 'physical')) {
      return NextResponse.json(
        { error: '카드 종류는 mobile 또는 physical이어야 합니다.' },
        { status: 400 }
      );
    }

    const isMobile = cardType === 'mobile';
    const sanitizedPhone = phone.replace(/[^0-9]/g, '');
    const sanitizedBirthDate = birthDate.replace(/\s/g, '');

    // 모바일 카드: 자동 승인, 카드 번호 생성
    // 실물 카드: 승인 대기
    const cardNumber = isMobile ? generateCardNumber() : null;
    const status = isMobile ? 'issued' : 'pending';

    // LibraryCard 레코드 생성
    const card = await db.libraryCard.create({
      data: {
        applicantName: applicantName.trim(),
        birthDate: sanitizedBirthDate,
        phone: sanitizedPhone,
        address: address?.trim() || null,
        cardType,
        cardNumber,
        status,
        ...(isMobile ? { issuedAt: new Date() } : {}),
      },
    });

    // 동일 전화번호 SimUser가 없으면 생성
    const existingUser = await db.simUser.findFirst({
      where: { phone: sanitizedPhone },
    });

    if (!existingUser) {
      const newUserCardNumber = generateCardNumber();
      const today = new Date().toISOString().split('T')[0];

      const newUser = await db.simUser.create({
        data: {
          name: applicantName.trim(),
          birthDate: sanitizedBirthDate,
          phone: sanitizedPhone,
          address: address?.trim() || null,
          cardType,
          cardNumber: newUserCardNumber,
          cardIssued: today,
          isActive: true,
        },
      });

      // LibraryCard에 userId 연결
      await db.libraryCard.update({
        where: { id: card.id },
        data: { userId: newUser.id },
      });
    } else {
      // 기존 사용자에게 연결
      await db.libraryCard.update({
        where: { id: card.id },
        data: { userId: existingUser.id },
      });
    }

    // 응답에서 최종 카드 데이터 조회
    const updatedCard = await db.libraryCard.findUnique({
      where: { id: card.id },
    });

    return NextResponse.json(
      {
        success: true,
        card: {
          id: updatedCard!.id,
          cardNumber: updatedCard!.cardNumber,
          status: updatedCard!.status,
          cardType: updatedCard!.cardType,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('카드 발급 신청 오류:', error);
    return NextResponse.json(
      { error: '카드 발급 신청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
