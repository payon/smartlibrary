/**
 * 데이터베이스 클라이언트 모듈
 *
 * [역할]
 * - Prisma Client 싱글톤 인스턴스 관리
 * - 개발 환경에서 핫 리로드 시 연결 중복 방지
 *
 * [데이터베이스 보안]
 * - Prisma ORM이 모든 쿼리를 파라미터화하여 SQL Injection 방지
 * - raw query 사용 금지 (필요시 $queryRawUnsafe 대신 $queryRaw 사용)
 * - 민감한 로그는 프로덕션에서 비활성화
 */

import { PrismaClient } from '@prisma/client';

/** 전역 Prisma 인스턴스 저장 (개발 환경 핫 리로드 방지) */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma 데이터베이스 클라이언트 인스턴스
 * - 개발 환경: 글로벌에 캐싱하여 핫 리로드 시 연결 중복 방지
 * - 프로덕션 환경: 매 요청마다 새 인스턴스 생성 (커넥션 풀 자동 관리)
 * - query 로그: 프로덕션에서는 비활성화 권장
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // 프로덕션에서는 로그 비활성화 (민감 정보 노출 방지)
    log: process.env.NODE_ENV === 'production' ? [] : ['query'],
  });

// 개발 환경에서 글로벌에 인스턴스 캐싱
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
