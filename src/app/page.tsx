/**
 * 키오스크 시뮬레이션 메인 페이지
 *
 * [역할]
 * - 키오스크 화면 컨테이너 (세로 모드, max-width 480px)
 * - 화면 라우팅 (store.screen 기준)
 * - 시드 데이터 초기화
 * - PWA 상태 표시
 */

'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import type { KioskViewName } from '@/lib/constants';
import KioskIdleScreen from '@/components/kiosk/KioskIdleScreen';
import KioskMainMenu from '@/components/kiosk/KioskMainMenu';
import KioskAuthScan from '@/components/kiosk/KioskAuthScan';
import KioskAuthPin from '@/components/kiosk/KioskAuthPin';
import KioskLoanSelect from '@/components/kiosk/KioskLoanSelect';
import KioskLoanConfirm from '@/components/kiosk/KioskLoanConfirm';
import KioskLoanComplete from '@/components/kiosk/KioskLoanComplete';
import KioskReturnInsert from '@/components/kiosk/KioskReturnInsert';
import KioskReturnScanning from '@/components/kiosk/KioskReturnScanning';
import KioskReturnConfirm from '@/components/kiosk/KioskReturnConfirm';
import KioskReturnComplete from '@/components/kiosk/KioskReturnComplete';
import PwaStatus from '@/components/PwaStatus';

/**
 * 키오스크 화면 렌더러
 * 현재 store.screen 값에 따라 해당 컴포넌트를 반환합니다.
 */
function ScreenRouter({ screen }: { screen: KioskViewName }) {
  switch (screen) {
    case 'idle':
      return <KioskIdleScreen />;
    case 'main-menu':
      return <KioskMainMenu />;
    case 'auth-scan':
      return <KioskAuthScan />;
    case 'auth-pin':
      return <KioskAuthPin />;
    case 'loan-select':
      return <KioskLoanSelect />;
    case 'loan-confirm':
      return <KioskLoanConfirm />;
    case 'loan-complete':
      return <KioskLoanComplete />;
    case 'return-insert':
      return <KioskReturnInsert />;
    case 'return-scanning':
      return <KioskReturnScanning />;
    case 'return-confirm':
      return <KioskReturnConfirm />;
    case 'return-complete':
      return <KioskReturnComplete />;
    default:
      return <KioskIdleScreen />;
  }
}

/**
 * 홈 페이지 컴포넌트
 * 키오스크 프레임 내에서 화면 전환을 관리합니다.
 */
export default function Home() {
  const screen = useAppStore((s) => s.screen);

  // 시드 데이터 초기화 중복 실행 방지용 ref
  const seededRef = useRef(false);

  // ========================================================================
  // 초기화: 시드 데이터 로드
  // ========================================================================
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    fetch('/api/seed', { method: 'POST' }).catch(() => {
      // 시드 오류는 무시 (이미 데이터가 있을 수 있음)
    });
  }, []);

  return (
    <div className="kiosk-frame">
      {/* 화면 전환 애니메이션 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-screen max-h-screen"
        >
          <ScreenRouter screen={screen} />
        </motion.div>
      </AnimatePresence>

      {/* PWA 상태 표시 */}
      <PwaStatus />
    </div>
  );
}
