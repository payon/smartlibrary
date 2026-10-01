/**
 * 키오스크 사용자 관리 API 라우트
 *
 * [GET] /api/admin/kiosk-users?search=xxx
 * SimUser(키오스크 사용자) 목록을 대출 정보와 함께 조회합니다.
 *
 * [POST] /api/admin/kiosk-users
 * 관리자가 직접 키오스크 이용자를 등록합니다.
 * body: { name, birthDate, phone, address?, pin }
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, json } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, 'kiosk-users:read');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { cardNumber: { contains: search } },
      ];
    }

    const users = await db.simUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        loans: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    // 대출 정보와 함께 반환
    const usersWithLoans = users.map((user) => {
      const activeLoans = user.loans.filter((loan) => loan.status === 'active').length;
      const totalLoans = user.loans.length;

      const { loans, ...userWithoutLoans } = user;

      return {
        ...userWithoutLoans,
        activeLoans,
        totalLoans,
      };
    });

    return json({ users: usersWithLoans });
  } catch (error) {
    console.error('키오스크 사용자 목록 조회 오류:', error);
    return json(
      { error: '키오스크 사용자 목록을 조회하는 중 오류가 발생했습니다.' }, 500);
  }
}

/**
 * 키오스크 이용자 등록 POST 핸들러
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, 'kiosk-users:write');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const body = await request.json();
    const { name, birthDate, phone, address, pin } = body;

    if (!name || !birthDate || !phone || !pin) {
      return json({ error: '이름, 생년월일, 전화번호, PIN은 필수입니다.' }, 400);
    }

    if (!/^\d{8}$/.test(birthDate)) {
      return json({ error: '생년월일은 8자리 숫자여야 합니다.' }, 400);
    }

    if (!/^\d{10,11}$/.test(phone)) {
      return json({ error: '올바른 전화번호를 입력해주세요.' }, 400);
    }

    if (!/^\d{4}$/.test(pin)) {
      return json({ error: 'PIN은 4자리 숫자여야 합니다.' }, 400);
    }

    // 중복 전화번호 확인
    const existingUser = await db.simUser.findFirst({ where: { phone } });
    if (existingUser) {
      return json({ error: '이미 등록된 전화번호입니다.' }, 409);
    }

    // PIN 중복 확인
    const pinConflict = await db.simUser.findUnique({ where: { pin } });
    if (pinConflict) {
      return json({ error: '이미 사용 중인 PIN입니다. 다른 PIN을 입력해주세요.' }, 409);
    }

    const user = await db.simUser.create({
      data: {
        name,
        birthDate,
        phone,
        address: address || null,
        pin,
        isActive: true,
      },
    });

    await logAudit({
      userId: auth.payload.userId,
      action: 'create',
      entity: 'sim_user',
      entityId: user.id,
      details: { name, phone },
      ipAddress: getClientIp(request),
    });

    return json({
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          cardNumber: user.cardNumber,
          isActive: user.isActive,
          activeLoans: 0,
          totalLoans: 0,
        },
        message: '키오스크 이용자가 등록되었습니다',
      }, 201);
  } catch (error) {
    console.error('키오스크 이용자 등록 오류:', error);
    return json({ error: '키오스크 이용자 등록 중 오류가 발생했습니다.' }, 500);
  }
}
