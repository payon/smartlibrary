/**
 * 키오스크 하드웨어 설정 동기화 훅
 *
 * [기능]
 * - 마운트 시 /api/kiosk-config 조회 후 스토어 반영
 * - 15초 간격 폴링으로 관리자 변경분을 프론트에 적용
 * - 음량 → TTS 볼륨 / 밝기 → 화면 필터 / 유휴시간 → 자동복귀 타이머
 */

'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';

const POLL_INTERVAL = 15_000; // 15초

function toNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value === undefined || Number.isNaN(n) ? fallback : n;
}

export function useKioskConfig() {
  const adminMode = useAppStore((s) => s.adminMode);
  const setVolume = useAppStore((s) => s.setVolume);
  const setBrightness = useAppStore((s) => s.setBrightness);
  const setIdleTimeoutSec = useAppStore((s) => s.setIdleTimeoutSec);

  useEffect(() => {
    if (adminMode) return;

    let cancelled = false;

    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/kiosk-config');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const config = data.config || {};
        setVolume(toNumber(config['kiosk.volume'], 80));
        setBrightness(toNumber(config['kiosk.screen_brightness'], 100));
        setIdleTimeoutSec(toNumber(config['kiosk.idle_timeout_seconds'], 120));
      } catch {
        // 조회 실패 시 기존값 유지
      }
    };

    fetchConfig();
    const timer = setInterval(fetchConfig, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [adminMode, setVolume, setBrightness, setIdleTimeoutSec]);
}
