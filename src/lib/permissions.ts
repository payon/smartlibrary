/**
 * 권한 정의 단일 소스 모듈
 *
 * [역할]
 * - 역할별 권한 맵의 단일 정의 소스
 * - admin-auth.ts와 useAdminStore.ts 모두 이 모듈을 임포트
 */

/** 역할 계층 구조 (높을수록 더 많은 권한) */
export const ROLE_HIERARCHY: Record<string, number> = {
  operator: 1,
  admin: 2,
  super_admin: 3,
};

/** 역할별 허용 권한 정의 (단일 소스) */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'], // 모든 권한
  admin: [
    'dashboard:read',
    'content:read', 'content:write',
    'books:read', 'books:write',
    'users:read',
    'kiosk-users:read',
    'cards:read', 'cards:write',
    'loans:read',
    'analytics:read',
    'settings:read', 'settings:write',
    'notifications:read', 'notifications:write',
    'audit:read',
  ],
  operator: [
    'dashboard:read',
    'content:read',
    'books:read',
    'users:read',
    'kiosk-users:read',
    'cards:read',
    'loans:read',
    'analytics:read',
    'settings:read',
    'notifications:read',
    'audit:read',
  ],
};

/** 유효한 관리자 역할 목록 */
export const VALID_ADMIN_ROLES = ['super_admin', 'admin', 'operator'] as const;
