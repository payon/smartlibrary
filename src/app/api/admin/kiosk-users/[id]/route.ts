/**
 * 키오스크 이용자 상세 API 라우트
 *
 * [PUT] /api/admin/kiosk-users/[id]
 * 이름/주소/활성상태/PIN을 수정합니다.
 *
 * [DELETE] /api/admin/kiosk-users/[id]
 * 대출 기록이 없는 이용자를 삭제합니다.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, json } from '@/lib/api-helpers';
import { logAudit } from '@/lib/audit-logger';
import { getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * 키오스크 이용자 수정
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request, 'kiosk-users:write');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.simUser.findUnique({ where: { id } });
    if (!existing) {
      return json({ error: '이용자를 찾을 수 없습니다.' }, 404);
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 50) {
        return json({ error: '이름은 2~50자여야 합니다.' }, 400);
      }
      updateData.name = body.name.trim();
    }

    if (body.address !== undefined) {
      if (body.address !== null && (typeof body.address !== 'string' || body.address.length > 200)) {
        return json({ error: '주소는 200자 이내여야 합니다.' }, 400);
      }
      updateData.address = body.address ? body.address.trim() || null : null;
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') {
        return json({ error: 'isActive는 boolean이어야 합니다.' }, 400);
      }
      updateData.isActive = body.isActive;
    }

    // PIN 초기화 (4자리 숫자 + 중복 불가)
    if (body.pin !== undefined) {
      if (typeof body.pin !== 'string' || !/^\d{4}$/.test(body.pin)) {
        return json({ error: 'PIN은 4자리 숫자여야 합니다.' }, 400);
      }
      const conflict = await db.simUser.findUnique({ where: { pin: body.pin } });
      if (conflict && conflict.id !== id) {
        return json({ error: '이미 사용 중인 PIN입니다.' }, 409);
      }
      updateData.pin = body.pin;
    }

    if (Object.keys(updateData).length === 0) {
      return json({ error: '변경할 항목이 없습니다.' }, 400);
    }

    const user = await db.simUser.update({ where: { id }, data: updateData });
    const { pin: _, ...safeUser } = user;

    await logAudit({
      userId: auth.payload.userId,
      action: 'update',
      entity: 'sim_user',
      entityId: id,
      details: { updatedFields: Object.keys(updateData).filter((k) => k !== 'pin') },
      ipAddress: getClientIp(request),
    });

    return json({ user: safeUser, message: '이용자 정보가 업데이트되었습니다' });
  } catch (error) {
    console.error('키오스크 이용자 수정 오류:', error);
    return json({ error: '이용자 정보를 수정하는 중 오류가 발생했습니다.' }, 500);
  }
}

/**
 * 키오스크 이용자 삭제 (대출 기록이 없을 때만)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request, 'kiosk-users:write');
    if ('error' in auth) {
      return json({ error: auth.error }, auth.status);
    }

    const { id } = await params;

    const existing = await db.simUser.findUnique({
      where: { id },
      include: { _count: { select: { loans: true } } },
    });
    if (!existing) {
      return json({ error: '이용자를 찾을 수 없습니다.' }, 404);
    }

    if (existing._count.loans > 0) {
      return json(
        { error: '대출 기록이 있는 이용자는 삭제할 수 없습니다. 비활성화를 사용하세요.' },
        400
      );
    }

    await db.learningProgress.deleteMany({ where: { userId: id } });
    await db.simUser.delete({ where: { id } });

    await logAudit({
      userId: auth.payload.userId,
      action: 'delete',
      entity: 'sim_user',
      entityId: id,
      details: { name: existing.name, phone: existing.phone },
      ipAddress: getClientIp(request),
    });

    return json({ message: '이용자가 삭제되었습니다' });
  } catch (error) {
    console.error('키오스크 이용자 삭제 오류:', error);
    return json({ error: '이용자를 삭제하는 중 오류가 발생했습니다.' }, 500);
  }
}
