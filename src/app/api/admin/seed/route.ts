/**
 * 관리자 데이터 시드 API 라우트
 *
 * [POST] /api/admin/seed
 * 관리자 기본 데이터를 초기화합니다.
 * 초기 설정 시(관리자 계정이 없을 때) 인증 없이도 실행 가능합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, hashPassword } from '@/lib/admin-auth';
import { DEFAULT_CONTENT_ITEMS } from '@/lib/content-sync';
import { invalidateCache } from '@/lib/content-cache';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';

/** 기본 키오스크 설정 */
const DEFAULT_KIOSK_CONFIGS = [
  { key: 'kiosk.idle_timeout', value: '120', label: '대기 시간 초과(초)', category: 'general' },
  { key: 'kiosk.max_loan_count', value: '2', label: '최대 대여 권수', category: 'loan' },
  { key: 'kiosk.loan_period_days', value: '15', label: '대여 기간(일)', category: 'loan' },
  { key: 'kiosk.overdue_block_multiplier', value: '1', label: '연체 정지 배수', category: 'loan' },
  { key: 'kiosk.receipt_enabled', value: 'true', label: '영수증 출력 활성화', category: 'general' },
  { key: 'kiosk.sound_enabled', value: 'true', label: '소리 활성화', category: 'general' },
  { key: 'kiosk.language', value: 'ko', label: '기본 언어', category: 'general' },
  { key: 'kiosk.theme', value: 'light', label: '테마', category: 'appearance' },
  { key: 'kiosk.font_size', value: '16', label: '기본 폰트 크기', category: 'appearance' },
  { key: 'kiosk.animation_enabled', value: 'true', label: '애니메이션 활성화', category: 'appearance' },
];

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

    const results = {
      adminCreated: false,
      contentSeeded: 0,
      configSeeded: 0,
    };

    // 1. 기본 super_admin 계정 생성
    const existingAdmin = await db.adminUser.findUnique({
      where: { email: 'admin@library.kr' },
    });

    if (!existingAdmin) {
      const passwordHash = await hashPassword('admin123!');
      const admin = await db.adminUser.create({
        data: {
          email: 'admin@library.kr',
          name: '시스템 관리자',
          passwordHash,
          role: 'super_admin',
          isActive: true,
        },
      });
      results.adminCreated = true;
      userId = admin.id;
    }

    // 2. 기본 콘텐츠 아이템 시드
    for (const defaultItem of DEFAULT_CONTENT_ITEMS) {
      const existing = await db.contentItem.findUnique({
        where: { key: defaultItem.key },
      });

      if (!existing) {
        await db.contentItem.create({
          data: {
            key: defaultItem.key,
            value: defaultItem.value,
            type: defaultItem.type,
            screen: defaultItem.screen,
            label: defaultItem.label,
          },
        });
        results.contentSeeded++;
      }
    }

    // 3. 기본 키오스크 설정 시드
    for (const config of DEFAULT_KIOSK_CONFIGS) {
      const existing = await db.kioskConfig.findUnique({
        where: { key: config.key },
      });

      if (!existing) {
        await db.kioskConfig.create({
          data: {
            key: config.key,
            value: config.value,
            label: config.label,
            category: config.category,
          },
        });
        results.configSeeded++;
      }
    }

    // 캐시 무효화
    invalidateCache();

    // 감사 로그 기록
    if (userId) {
      await logAudit({
        userId,
        action: 'create',
        entity: 'admin',
        details: JSON.stringify({ seedResults: results }),
        ipAddress: getClientIp(request),
      });
    }

    return NextResponse.json({
      message: '관리자 데이터가 초기화되었습니다',
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
