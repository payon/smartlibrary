/**
 * 감사 로그 모듈
 *
 * [기능]
 * - 관리자 액션 감사 로그 기록
 * - 로그 조회 시 필터링 지원
 * - IP 주소 및 상세 정보 기록
 */

import { db } from '@/lib/db';

// ============================================================================
// 감사 로그 기록
// ============================================================================

/** 감사 로그 생성 매개변수 */
export interface AuditLogParams {
  userId?: string;
  action: string; // create | update | delete | login | logout
  entity: string; // content | book | user | setting | admin | kiosk_config | notification
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * 감사 로그 기록
 *
 * @param params - 감사 로그 매개변수
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    console.error('감사 로그 기록 오류:', error);
  }
}

/**
 * 감사 로그 조회
 *
 * @param filters - 필터 옵션
 * @returns 감사 로그 목록과 전체 개수
 */
export async function getAuditLogs(filters: {
  userId?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ logs: AuditLogRecord[]; total: number }> {
  const { userId, action, entity, from, to, page = 1, pageSize = 50 } = filters;

  const where: Record<string, unknown> = {};

  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (entity) where.entity = entity;

  if (from || to) {
    const timestampFilter: Record<string, Date> = {};
    if (from) timestampFilter.gte = new Date(from);
    if (to) timestampFilter.lte = new Date(to);
    where.timestamp = timestampFilter;
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return { logs, total };
}

/** 감사 로그 레코드 타입 (user 포함) */
interface AuditLogRecord {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  timestamp: Date;
  user: { id: string; name: string; email: string; role: string } | null;
}
