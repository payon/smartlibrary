'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';

/**
 * CMS 콘텐츠 폴링 훅
 *
 * [기능]
 * - 마운트 시 /api/content에서 전체 콘텐츠 조회
 * - 5초 간격으로 경량 버전 확인 후 변경 시에만 전체 재조회
 * - 관리자가 저장하면 수초 내 프론트에 즉시 반영
 * - 관리자 모드에서는 폴링하지 않음 (관리자가 자체 데이터 관리)
 *
 * [주의]
 * - cmsVersion을 useEffect 의존성 배열에 넣지 않음 (무한 루프 방지)
 * - 대신 ref로 최신 버전을 추적하여 비교
 */

const VERSION_POLL_INTERVAL = 5_000; // 5초 (경량 버전 확인)

export function useCmsContent() {
  const adminMode = useAppStore((s) => s.adminMode);
  const setCmsContent = useAppStore((s) => s.setCmsContent);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const versionRef = useRef<number>(0);

  useEffect(() => {
    // 관리자 모드에서는 폴링하지 않음
    if (adminMode) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    /** 전체 콘텐츠 조회 후 스토어 반영 */
    const fetchFullContent = async () => {
      try {
        const res = await fetch('/api/content');
        if (res.ok) {
          const data = await res.json();
          if (data.version !== undefined) {
            versionRef.current = data.version;
          }
          setCmsContent(data.content || {}, data.version ?? versionRef.current);
        }
      } catch {
        // 조회 실패 시 무시 (기존 콘텐츠 유지)
      }
    };

    /** 경량 버전 확인 → 변경 시에만 전체 조회 */
    const pollVersion = async () => {
      try {
        const res = await fetch('/api/content/version');
        if (!res.ok) {
          // 버전 API 실패 시 전체 조회로 폴백
          await fetchFullContent();
          return;
        }
        const data = await res.json();
        if (data.version !== undefined && data.version !== versionRef.current) {
          await fetchFullContent();
        }
      } catch {
        // 조회 실패 시 무시 (기존 콘텐츠 유지)
      }
    };

    // 최초 1회 전체 조회
    fetchFullContent();

    // 5초 간격 버전 폴링
    intervalRef.current = setInterval(pollVersion, VERSION_POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [adminMode, setCmsContent]);
}

/**
 * CMS 텍스트 조회 헬퍼 훅
 *
 * @param key - 콘텐츠 키 (예: "idle.title")
 * @param fallback - CMS 콘텐츠가 없을 때 사용할 기본 텍스트
 * @returns CMS 콘텐츠 값 또는 기본 텍스트
 */
export function useCmsText(key: string, fallback: string): string {
  const cmsContent = useAppStore((s) => s.cmsContent);
  return cmsContent[key] || fallback;
}
