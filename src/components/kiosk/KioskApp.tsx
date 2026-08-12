/**
 * 키오스크 앱 컨테이너 (클라이언트 전용)
 *
 * [역할]
 * - page.tsx에서 dynamic(ssr:false)로 불러옴
 * - Zustand 스토어 기반 화면 라우팅
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

/** 키오스크 앱 컴포넌트 (클라이언트에서만 마운트됨) */
export default function KioskApp() {
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
    </div>
  );
}
