/**
 * 관리자 데이터 시드 API 라우트
 *
 * [POST] /api/admin/seed
 * 관리자 기본 데이터를 초기화합니다.
 * 초기 설정 시(관리자 계정이 없을 때) 인증 없이도 실행 가능합니다.
 *
 * [멱등성]
 * - 동일한 결과를 보장하기 위해 기존 관리자/콘텐츠/설정 데이터를
 *   삭제 후 재삽입합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hashPassword } from '@/lib/admin-auth';
import { DEFAULT_CONTENT_ITEMS } from '@/lib/content-sync';
import { invalidateCache } from '@/lib/content-cache';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';

/** 기본 관리자 계정 정의 (비밀번호는 환경변수 필수 — 하드코딩 금지) */
const DEFAULT_ADMIN_USERS = [
  {
    email: 'superadmin@library.go.kr',
    password: process.env.ADMIN_SEED_PASSWORD,
    name: '최고관리자',
    role: 'super_admin',
  },
  {
    email: 'admin@library.go.kr',
    password: process.env.ADMIN_SEED_PASSWORD,
    name: '관리자',
    role: 'admin',
  },
  {
    email: 'operator@library.go.kr',
    password: process.env.ADMIN_SEED_PASSWORD,
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

export async function POST(request: NextRequest) {
  try {
    // 초기 설정: 관리자 계정이 없으면 인증 없이도 시드 허용
    const adminCount = await db.adminUser.count();
    let userId: string | undefined;

    if (adminCount > 0) {
      // 관리자가 이미 존재하면 인증 필요
      const token = request.cookies.get('admin_token')?.value;
      if (!token) {
        return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
      }

      const payload = await verifyToken(token);
      if (!payload) {
        return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
      }

      if (payload.role !== 'super_admin') {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
      }
      userId = payload.userId;
    }

    // [보안] 시드 비밀번호는 환경변수 필수 (하드코딩된 기본값 사용 금지)
    if (!process.env.ADMIN_SEED_PASSWORD) {
      return NextResponse.json(
        { error: 'ADMIN_SEED_PASSWORD 환경변수가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const results = {
      adminsCreated: 0,
      contentSeeded: 0,
      configSeeded: 0,
    };

    // ================================================================
    // 1. 기존 관리자/콘텐츠/설정 데이터 삭제 (외래키 제약조건 순서 준수)
    // ================================================================

    await db.contentVersion.deleteMany();
    await db.contentItem.deleteMany();
    await db.kioskConfig.deleteMany();
    await db.notification.deleteMany();
    await db.adminSession.deleteMany();
    await db.adminUser.deleteMany();

    // ================================================================
    // 2. 관리자 계정 생성 (bcrypt 해시)
    // ================================================================

    const adminResults: { email: string; role: string }[] = [];
    for (const adminDef of DEFAULT_ADMIN_USERS) {
      const passwordHash = await hashPassword(adminDef.password!);
      const admin = await db.adminUser.create({
        data: {
          email: adminDef.email,
          name: adminDef.name,
          passwordHash,
          role: adminDef.role,
          isActive: true,
        },
      });
      adminResults.push({ email: admin.email, role: admin.role });
      results.adminsCreated++;
      // 첫 번째 생성된 super_admin의 ID를 userId로 사용
      if (!userId && admin.role === 'super_admin') {
        userId = admin.id;
      }
    }

    // ================================================================
    // 3. CMS 콘텐츠 아이템 시드 (11개 화면 + 글로벌)
    // ================================================================

    const contentItems = DEFAULT_CONTENT_ITEMS.map((item) => ({
      key: item.key,
      value: item.value,
      type: item.type,
      screen: item.screen,
      label: item.label,
    }));
    const contentCount = await db.contentItem.createMany({ data: contentItems });
    results.contentSeeded = contentCount.count;

    // ================================================================
    // 4. 키오스크 설정 시드 (3개 카테고리)
    // ================================================================

    const configItems = DEFAULT_KIOSK_CONFIGS.map((cfg) => ({
      key: cfg.key,
      value: cfg.value,
      label: cfg.label,
      category: cfg.category,
    }));
    const configCount = await db.kioskConfig.createMany({ data: configItems });
    results.configSeeded = configCount.count;

    // 캐시 무효화
    invalidateCache();

    // 감사 로그 기록
    if (userId) {
      await logAudit({
        userId,
        action: 'create',
        entity: 'admin',
        details: { seedResults: results, admins: adminResults },
        ipAddress: getClientIp(request),
      });
    }

    return NextResponse.json({
      message: '관리자 데이터가 초기화되었습니다',
      admins: adminResults,
      ...results,
    });
  } catch (error) {
    console.error('관리자 데이터 시드 오류:', error);
    return NextResponse.json(
      { error: '관리자 데이터를 초기화하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
