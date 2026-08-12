/**
 * 시드 데이터 API 라우트
 *
 * [POST] /api/seed
 * 데이터베이스를 초기화하고 시드 데이터를 삽입합니다.
 * 데모 사용자(김도서관, PIN 1234)를 생성합니다.
 *
 * [보안 조치]
 * - 레이트 리미팅 (초기화는 1분당 1회로 제한)
 * - 개발/시뮬레이션 환경 전용
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SEED_BOOKS, SCENARIOS } from '@/lib/constants';
import {
  checkRateLimit,
  getClientIp,
} from '@/lib/security';

/** 레이트 리미팅 식별자 접두사 */
const RATE_LIMIT_PREFIX = 'seed:';

export const dynamic = 'force-dynamic';

/**
 * 시드 데이터 초기화 POST 핸들러
 * 모든 기존 데이터를 삭제하고 시드 데이터를 다시 삽입합니다.
 */
export async function POST(request: NextRequest) {
  try {
    // [보안] 레이트 리미팅 체크 (초기화는 1분당 1회로 엄격 제한)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`${RATE_LIMIT_PREFIX}${clientIp}`, 60000, 1);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '데이터 초기화는 1분당 1회만 가능합니다.' },
        { status: 429 }
      );
    }

    // [데이터베이스] 기존 데이터 전체 삭제 (외래키 제약조건 순서 준수)
    await db.simLoan.deleteMany();
    await db.learningProgress.deleteMany();
    await db.simUser.deleteMany();
    await db.book.deleteMany();
    await db.scenario.deleteMany();

    // 시드 데이터 삽입
    const bookCount = await db.book.createMany({ data: SEED_BOOKS });
    const scenarioCount = await db.scenario.createMany({ data: SCENARIOS });

    // 데모 사용자 생성
    const demoUser = await db.simUser.create({
      data: {
        name: '김도서관',
        birthDate: '19900101',
        phone: '010-1234-5678',
        address: '서울시 강남구',
        cardType: 'mobile',
        cardNumber: 'LIB-00000001',
        cardIssued: new Date().toISOString().split('T')[0],
        pin: '1234',
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      books: bookCount.count,
      scenarios: scenarioCount.count,
      demoUser: {
        id: demoUser.id,
        name: demoUser.name,
        cardNumber: demoUser.cardNumber,
      },
    });
  } catch (error) {
    console.error('시드 데이터 초기화 오류:', error);
    return NextResponse.json(
      { error: '데이터 초기화 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
