/**
 * 콘텐츠 인메모리 캐시 모듈
 *
 * [역할]
 * - 키오스크 콘텐츠 빠른 제공을 위한 인메모리 캐시
 * - DB 조회 없이 key→value 맵으로 즉시 응답
 * - ETag/버전 기반 폴링으로 변경 감지
 *
 * [캐시 정책]
 * - TTL: 30초 (TTL 만료 시 다음 조회에서 자동 갱신)
 * - 관리자 콘텐츠 업데이트 시 즉시 무효화 (invalidateCache)
 * - 버전 번호로 콘텐츠 변경 여부 확인
 */

import { db } from '@/lib/db';

// ─── Cache State ─────────────────────────────────────────────────────────────

let contentCache: Record<string, string> = {};
let contentVersion = 0;
let lastRefreshed = 0;
const CACHE_TTL = 30_000; // 30 seconds

// ─── Cache Functions ────────────────────────────────────────────────────────

/**
 * 캐시된 콘텐츠 단일 항목 조회
 * - TTL 만료 시 백그라운드에서 자동 갱신
 * @param key - 콘텐츠 키 (예: 'idle.title')
 * @returns 캐시된 값 또는 undefined
 */
export function getCachedContent(key: string): string | undefined {
  maybeRefresh();
  return contentCache[key];
}

/**
 * 캐시된 전체 콘텐츠 조회
 * - TTL 만료 시 백그라운드에서 자동 갱신
 * @returns key→value 맵
 */
export function getAllCachedContent(): Record<string, string> {
  maybeRefresh();
  return { ...contentCache };
}

/**
 * 현재 콘텐츠 버전 번호 반환
 * - 키오스크 폴링에서 ETag 대신 사용
 * - 버전이 변경되면 전체 콘텐츠 재조회 필요
 * @returns 버전 번호
 */
export function getContentVersion(): number {
  return contentVersion;
}

/**
 * 캐시를 DB에서 새로고침
 * - 전체 ContentItem을 조회하여 key→value 맵 구성
 * - 버전 번호 증가
 * - 마지막 갱신 시간 업데이트
 */
export async function refreshContentCache(): Promise<void> {
  try {
    const items = await db.contentItem.findMany({
      select: { key: true, value: true },
    });

    const newCache: Record<string, string> = {};
    for (const item of items) {
      newCache[item.key] = item.value;
    }

    contentCache = newCache;
    contentVersion++;
    lastRefreshed = Date.now();
  } catch (error) {
    // DB 오류 시 기존 캐시 유지
    console.error('[ContentCache] Failed to refresh cache:', error);
  }
}

/**
 * 캐시 무효화
 * - 관리자가 콘텐츠를 업데이트한 즉시 호출
 * - 다음 조회 시 DB에서 재로드
 */
export function invalidateCache(): void {
  lastRefreshed = 0;
  contentVersion++;
}

// ─── Internal ────────────────────────────────────────────────────────────────

/**
 * TTL 만료 여부 확인 및 백그라운드 갱신 트리거
 * - 비동기로 실행하여 호출자를 블로킹하지 않음
 */
function maybeRefresh(): void {
  const now = Date.now();
  if (now - lastRefreshed > CACHE_TTL) {
    // Fire-and-forget: 호출자를 기다리게 하지 않음
    refreshContentCache().catch(() => {
      // 갱신 실패는 무시 (기존 캐시로 서비스)
    });
  }
}
