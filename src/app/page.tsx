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

/** 키오스크 화면 렌더러 */
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

/** 홈 페이지 컴포넌트 */
export default function Home() {
  const screen = useAppStore((s) => s.screen);
  const kioskMode = useAppStore((s) => s.kioskMode);
  const seededRef = useRef(false);

  /* 고유 키: 화면명 + 모드 조합으로 AnimatePresence가 컴포넌트를 재생성하도록 함 */
  const screenKey = screen + '-' + (kioskMode || '');

  /* 시드 데이터 초기화 */
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    fetch('/api/seed', { method: 'POST' }).catch(() => {});
  }, []);

  return (
    <div className="kiosk-frame">
      <AnimatePresence mode="wait">
        <motion.div
          key={screenKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-screen max-h-screen"
        >
          <ScreenRouter screen={screen} />
        </motion.div>
      </AnimatePresence>
      <PwaStatus />
    </div>
  );
}
