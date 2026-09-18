/**
 * 시드 데이터 API 라우트
 *
 * [POST] /api/seed
 * 데이터베이스를 초기화하고 시드 데이터를 삽입합니다.
 * 데모 사용자, 관리자 계정, CMS 콘텐츠, 키오스크 설정을 생성합니다.
 *
 * [보안 조치]
 * - 레이트 리미팅 (초기화는 1분당 1회로 제한)
 * - 개발/시뮬레이션 환경 전용
 *
 * [멱등성]
 * - 동일한 결과를 보장하기 위해 기존 데이터를 삭제 후 재삽입합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SEED_BOOKS, SCENARIOS } from '@/lib/constants';
import { checkRateLimit, getClientIp } from '@/lib/security';
import { hashPassword } from '@/lib/admin-auth';
import { DEFAULT_CONTENT_ITEMS } from '@/lib/content-sync';
import { invalidateCache } from '@/lib/content-cache';

/** 레이트 리미팅 식별자 접두사 */
const RATE_LIMIT_PREFIX = 'seed:';

/** 기본 관리자 계정 정의 */
const DEFAULT_ADMIN_USERS = [
  {
    email: 'superadmin@library.go.kr',
    password: process.env.ADMIN_SEED_PASSWORD || 'admin1234',
    name: '최고관리자',
    role: 'super_admin',
  },
  {
    email: 'admin@library.go.kr',
    password: process.env.ADMIN_SEED_PASSWORD || 'admin1234',
    name: '관리자',
    role: 'admin',
  },
  {
    email: 'operator@library.go.kr',
    password: process.env.ADMIN_SEED_PASSWORD || 'admin1234',
    name: '운영자',
    role: 'operator',
  },
] as const;

/** 기본 키오스크 설정 (3개 카테고리) */
const DEFAULT_KIOSK_CONFIGS = [
  // ── 대여 설정 (loan) ──
  { key: 'loan.max_books_per_loan', value: '2', label: '1회 최대 대여 권수', category: 'loan' },
  { key: 'loan.loan_period_days', value: '15', label: '대여 기간(일)', category: 'loan' },
  { key: 'loan.overdue_block_multiplier', value: '1', label: '연체 정지 배수', category: 'loan' },
  { key: 'loan.extend_enabled', value: 'false', label: '대여 연장 활성화', category: 'loan' },

  // ── 키오스크 설정 (kiosk) ──
  { key: 'kiosk.idle_timeout_seconds', value: '120', label: '대기 시간 초과(초)', category: 'kiosk' },
  { key: 'kiosk.screen_brightness', value: '100', label: '화면 밝기(%)', category: 'kiosk' },
  { key: 'kiosk.maintenance_mode', value: 'false', label: '점검 모드', category: 'kiosk' },
  { key: 'kiosk.volume', value: '80', label: '음량(%)', category: 'kiosk' },

  // ── 알림 설정 (notification) ──
  { key: 'notification.overdue_notify_enabled', value: 'true', label: '연체 알림 활성화', category: 'notification' },
  { key: 'notification.loan_expiry_notify_days', value: '3', label: '대여 만료 알림일', category: 'notification' },
  { key: 'notification.system_alert_enabled', value: 'true', label: '시스템 알림 활성화', category: 'notification' },
] as const;

export const dynamic = 'force-dynamic';

/**
 * 시드 데이터 초기화 POST 핸들러
 * 모든 기존 데이터를 삭제하고 시드 데이터를 다시 삽입합니다.
 */
export async function POST(request: NextRequest) {
  try {
    // [보안] 프로덕션 환경에서는 ALLOW_SEED=true일 때만 시드 허용
    // Docker 컨테이너 초기화 시 ALLOW_SEED=true로 설정하여 시드 가능
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
      return NextResponse.json(
        { error: '프로덕션 환경에서는 데이터 초기화를 사용할 수 없습니다. (ALLOW_SEED=true 필요)' },
        { status: 403 }
      );
    }

    // [보안] 레이트 리미팅 체크 (초기화는 1분당 1회로 엄격 제한)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`${RATE_LIMIT_PREFIX}${clientIp}`, 60000, 1);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '데이터 초기화는 1분당 1회만 가능합니다.' },
        { status: 429 }
      );
    }

    // ================================================================
    // 1. 기존 데이터 전체 삭제 (외래키 제약조건 순서 준수)
    // ================================================================

    // 관리자 관련 테이블 (종속성 순서: ContentVersion → ContentItem, AdminSession → AdminUser)
    await db.contentVersion.deleteMany();
    await db.contentItem.deleteMany();
    await db.kioskConfig.deleteMany();
    await db.notification.deleteMany();
    await db.adminSession.deleteMany();
    await db.adminUser.deleteMany();

    // 키오스크 시뮬레이션 테이블
    await db.simLoan.deleteMany();
    await db.learningProgress.deleteMany();
    await db.simUser.deleteMany();
    await db.book.deleteMany();
    await db.scenario.deleteMany();

    // ================================================================
    // 2. 키오스크 시뮬레이션 시드 데이터
    // ================================================================

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

    // ================================================================
    // 3. 관리자 계정 생성 (bcrypt 해시)
    // ================================================================

    const adminResults = [];
    for (const adminDef of DEFAULT_ADMIN_USERS) {
      const passwordHash = await hashPassword(adminDef.password);
      const admin = await db.adminUser.create({
        data: {
          email: adminDef.email,
          name: adminDef.name,
          passwordHash,
          role: adminDef.role,
          isActive: true,
        },
      });
      adminResults.push({ id: admin.id, email: admin.email, role: admin.role });
    }

    // ================================================================
    // 4. CMS 콘텐츠 아이템 시드 (11개 화면 + 글로벌)
    // ================================================================

    const contentItems = DEFAULT_CONTENT_ITEMS.map((item) => ({
      key: item.key,
      value: item.value,
      type: item.type,
      screen: item.screen,
      label: item.label,
    }));
    const contentCount = await db.contentItem.createMany({ data: contentItems });

    // ================================================================
    // 5. 키오스크 설정 시드 (3개 카테고리)
    // ================================================================

    const configItems = DEFAULT_KIOSK_CONFIGS.map((cfg) => ({
      key: cfg.key,
      value: cfg.value,
      label: cfg.label,
      category: cfg.category,
    }));
    const configCount = await db.kioskConfig.createMany({ data: configItems });

    // 캐시 무효화
    invalidateCache();

    return NextResponse.json({
      success: true,
      // 시뮬레이션 데이터
      books: bookCount.count,
      scenarios: scenarioCount.count,
      demoUser: {
        id: demoUser.id,
        name: demoUser.name,
        cardNumber: demoUser.cardNumber,
      },
      // 관리자 계정
      admins: adminResults,
      // CMS 콘텐츠
      contentSeeded: contentCount.count,
      // 키오스크 설정
      configSeeded: configCount.count,
    });
  } catch (error) {
    console.error('시드 데이터 초기화 오류:', error);
    return NextResponse.json(
      { error: '데이터 초기화 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
