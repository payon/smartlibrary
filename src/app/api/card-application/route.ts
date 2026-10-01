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
 * - 동일 전화번호 SimUser가 없으면 생성 (PIN 자동 할당)
 * - PIN: 전화번호 뒤 4자리, 4자리 미만이면 앞에 0 패딩
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { json, secureCardNumber, secureRandomPin } from '@/lib/api-helpers';
import { checkRateLimit, getClientIp, validateRequestBodySize, validateBodySize, validateJsonContentType } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 카드 발급 신청 POST 핸들러
 */
export async function POST(request: NextRequest) {
  try {
    // [보안] 대량 생성 방지: IP당 1시간 5회
    const clientIp = getClientIp(request);
    const rl = checkRateLimit(`card-application:${clientIp}`, 60 * 60 * 1000, 5);
    if (!rl.allowed) {
      return json({ error: '신청 횟수를 초과했습니다. 1시간 후 다시 시도해주세요.' }, 429);
    }
    if (!validateJsonContentType(request)) {
      return json({ error: '잘못된 요청 형식입니다.' }, 415);
    }
    if (!(await validateRequestBodySize(request))) {
      return json({ error: '요청 크기가 너무 큽니다.' }, 413);
    }
    const body = await request.json();
    if (!validateBodySize(body, 10 * 1024)) {
      return json({ error: '요청 크기가 너무 큽니다.' }, 413);
    }
    const { applicantName, birthDate, phone, address, cardType } = body;

    // 필수 필드 검증
    if (!applicantName || typeof applicantName !== 'string' || applicantName.trim().length < 2) {
      return json({ error: '이름은 2자 이상이어야 합니다.' }, 400);
    }

    if (!birthDate || typeof birthDate !== 'string' || !/^\d{8}$/.test(birthDate.replace(/\s/g, ''))) {
      return json({ error: '생년월일은 8자리 숫자여야 합니다.' }, 400);
    }

    if (!phone || typeof phone !== 'string' || !/^\d{10,11}$/.test(phone.replace(/[^0-9]/g, ''))) {
      return json({ error: '올바른 전화번호를 입력해주세요.' }, 400);
    }

    if (!cardType || (cardType !== 'mobile' && cardType !== 'physical')) {
      return json({ error: '카드 종류는 mobile 또는 physical이어야 합니다.' }, 400);
    }

    const isMobile = cardType === 'mobile';
    const sanitizedPhone = phone.replace(/[^0-9]/g, '');
    const sanitizedBirthDate = birthDate.replace(/\s/g, '');

    // 모바일 카드: 자동 승인, 카드 번호 생성 (CSPRNG)
    // 실물 카드: 승인 대기
    const cardNumber = isMobile ? secureCardNumber() : null;
    const status = isMobile ? 'issued' : 'pending';

    // LibraryCard 레코드 생성 (카드번호 충돌 시 재시도)
    let card: { id: string } | null = null;
    for (let i = 0; i < 5; i++) {
      try {
        card = await db.libraryCard.create({
          data: {
            applicantName: applicantName.trim().slice(0, 50),
            birthDate: sanitizedBirthDate,
            phone: sanitizedPhone,
            address: typeof address === 'string' ? address.trim().slice(0, 200) || null : null,
            cardType,
            cardNumber: isMobile ? (i === 0 ? cardNumber : secureCardNumber()) : null,
            status,
            ...(isMobile ? { issuedAt: new Date() } : {}),
          },
        });
        break;
      } catch (e) {
        if (i === 4) throw e;
      }
    }

    // 동일 전화번호 SimUser가 없으면 생성
    const existingUser = await db.simUser.findFirst({
      where: { phone: sanitizedPhone },
    });

    // PIN은 예측 불가능한 난수로만 발급 (전화번호 뒤4자리 사용 금지)
    async function assignUniquePin(): Promise<string> {
      for (let i = 0; i < 20; i++) {
        const used = await db.simUser.findMany({ select: { pin: true }, take: 1000 });
        const existing = new Set(used.map((u) => u.pin).filter(Boolean) as string[]);
        const candidate = secureRandomPin(existing);
        const conflict = await db.simUser.findUnique({ where: { pin: candidate } });
        if (!conflict) return candidate;
      }
      throw new Error('PIN 생성 실패');
    }

    let linkedUserId: string | null = existingUser?.id ?? null;
    if (!existingUser) {
      const newUserCardNumber = secureCardNumber();
      const today = new Date().toISOString().split('T')[0];
      const assignedPin = await assignUniquePin();

      const newUser = await db.simUser.create({
        data: {
          name: applicantName.trim().slice(0, 50),
          birthDate: sanitizedBirthDate,
          phone: sanitizedPhone,
          address: typeof address === 'string' ? address.trim().slice(0, 200) || null : null,
          cardType,
          cardNumber: newUserCardNumber,
          cardIssued: today,
          isActive: true,
          pin: assignedPin,
        },
      });
      linkedUserId = newUser.id;

      // LibraryCard에 userId 연결
      await db.libraryCard.update({
        where: { id: card!.id },
        data: { userId: newUser.id },
      });
    } else {
      // 기존 사용자에게 연결 (PIN이 없으면 설정)
      if (!existingUser.pin) {
        const assignedPin = await assignUniquePin();
        await db.simUser.update({
          where: { id: existingUser.id },
          data: { pin: assignedPin },
        });
      }
      await db.libraryCard.update({
        where: { id: card!.id },
        data: { userId: existingUser.id },
      });
    }

    // 응답에서 최종 카드 데이터 조회 (PIN은 절대 반환하지 않음)
    const updatedCard = await db.libraryCard.findUnique({
      where: { id: card!.id },
    });

    const finalUser = linkedUserId
      ? await db.simUser.findUnique({
          where: { id: linkedUserId },
          select: { id: true, name: true, cardNumber: true },
        })
      : null;

    return json(
      {
        success: true,
        card: {
          id: updatedCard!.id,
          cardNumber: updatedCard!.cardNumber,
          status: updatedCard!.status,
          cardType: updatedCard!.cardType,
        },
        user: finalUser,
        message: isMobile
          ? '모바일 회원증이 발급되었습니다. PIN은 발급 화면에 1회만 표시됩니다.'
          : '실물 회원증 신청이 접수되었습니다.',
      },
      201
    );
  } catch (error) {
    console.error('카드 발급 신청 오류:', error);
    return json(
      { error: '카드 발급 신청 처리 중 오류가 발생했습니다.' },
      500
    );
  }
}
