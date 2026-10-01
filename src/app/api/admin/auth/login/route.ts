/**
 * 관리자 로그인 API 라우트
 *
 * [POST] /api/admin/auth/login
 * 이메일과 비밀번호로 관리자 로그인을 처리합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateToken, verifyPassword, createSession } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp, checkRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // [보안] 레이트 리미팅 — 5분당 5회 로그인 시도 제한 (브루트포스 방지)
    const clientIp = getClientIp(request);
    const loginRateLimit = checkRateLimit(`login:${clientIp}`, 5 * 60 * 1000, 5);
    if (!loginRateLimit.allowed) {
      return NextResponse.json(
        { error: '로그인 시도 횟수를 초과했습니다. 5분 후에 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 관리자 사용자 조회
    const user = await db.adminUser.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 비밀번호 검증
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      // 실패 로그 기록
      await logAudit({
        userId: user.id,
        action: 'login',
        entity: 'admin',
        entityId: user.id,
        details: { success: false },
        ipAddress: getClientIp(request),
      });

      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // JWT 토큰 생성
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // 세션 생성
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || undefined;
    await createSession(user.id, token, ipAddress, userAgent);

    // 마지막 로그인 시간 업데이트
    await db.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 성공 로그 기록
    await logAudit({
      userId: user.id,
      action: 'login',
      entity: 'admin',
      entityId: user.id,
      details: { success: true },
      ipAddress,
    });

    // 쿠키 설정 및 응답
    // [보안/호환] HTTPS(프록시 경유 포함)일 때만 Secure — HTTP 직결 시 Secure면
    // 브라우저가 쿠키를 버려 이후 모든 관리자 API가 401이 됨
    const forwardedProto = request.headers.get('x-forwarded-proto');
    const isHttps = forwardedProto === 'https';
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      message: '로그인 성공',
    });

    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24시간
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('관리자 로그인 오류:', error);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
