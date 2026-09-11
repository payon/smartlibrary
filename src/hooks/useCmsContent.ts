'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';

/**
 * CMS 콘텐츠 폴링 훅
 *
 * [기능]
 * - 마운트 시 /api/content에서 전체 콘텐츠 조회
 * - 30초 간격으로 버전 비교 후 변경 시에만 스토어 업데이트
 * - 관리자 모드에서는 폴링하지 않음 (관리자가 자체 데이터 관리)
 */

const POLL_INTERVAL = 30_000; // 30초

export function useCmsContent() {
  const adminMode = useAppStore((s) => s.adminMode);
  const cmsVersion = useAppStore((s) => s.cmsVersion);
  const setCmsContent = useAppStore((s) => s.setCmsContent);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** 콘텐츠 조회 함수 */
  const fetchContent = async () => {
    try {
      const res = await fetch('/api/content');
      if (res.ok) {
        const data = await res.json();
        // 버전이 변경된 경우에만 스토어 업데이트
        if (data.version !== undefined && data.version !== cmsVersion) {
          setCmsContent(data.content || {}, data.version);
        }
      }
    } catch {
      // 조회 실패 시 무시 (기존 콘텐츠 유지)
    }
  };

  useEffect(() => {
    // 관리자 모드에서는 폴링하지 않음
    if (adminMode) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // 최초 1회 조회
    fetchContent();

    // 30초 간격 폴링
    intervalRef.current = setInterval(fetchContent, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [adminMode, cmsVersion, setCmsContent]);
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
