/**
 * 키오스크 앱 컨테이너 (클라이언트 전용)
 *
 * [역할]
 * - page.tsx에서 dynamic(ssr:false)로 불러옴
 * - Zustand 스토어 기반 화면 라우팅
 * - API 상태 확인 (health check)
 * - 유휴 자동 로그아웃 (120초)
 * - PWA 상태 표시
 */

'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import type { KioskViewName } from '@/lib/constants';
import KioskIdleScreen from '@/components/kiosk/KioskIdleScreen';
import KioskSignupGuide from '@/components/kiosk/KioskSignupGuide';
import KioskMainMenu from '@/components/kiosk/KioskMainMenu';
import KioskAuthScan from '@/components/kiosk/KioskAuthScan';
import KioskAuthPin from '@/components/kiosk/KioskAuthPin';
import KioskLoanSelect from '@/components/kiosk/KioskLoanSelect';
import KioskLoanConfirm from '@/components/kiosk/KioskLoanConfirm';
import KioskLoanDispense from '@/components/kiosk/KioskLoanDispense';
import KioskLoanHistory from '@/components/kiosk/KioskLoanHistory';
import KioskReceiptPrompt from '@/components/kiosk/KioskReceiptPrompt';
import KioskLoanComplete from '@/components/kiosk/KioskLoanComplete';
import KioskReturnInsert from '@/components/kiosk/KioskReturnInsert';
import KioskReturnScanning from '@/components/kiosk/KioskReturnScanning';
import KioskReturnConfirm from '@/components/kiosk/KioskReturnConfirm';
import KioskReturnComplete from '@/components/kiosk/KioskReturnComplete';
import KioskCardApply from '@/components/kiosk/KioskCardApply';
import KioskCardForm from '@/components/kiosk/KioskCardForm';
import KioskCardPending from '@/components/kiosk/KioskCardPending';
import KioskCardComplete from '@/components/kiosk/KioskCardComplete';

/** 키오스크 화면 렌더러 */
function ScreenRouter({ screen }: { screen: KioskViewName }) {
  switch (screen) {
    case 'idle':
      return <KioskIdleScreen />;
    case 'miryang-main':
      return <KioskIdleScreen />;
    case 'signup-guide':
      return <KioskSignupGuide />;
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
    case 'loan-dispense':
      return <KioskLoanDispense />;
    case 'loan-history':
      return <KioskLoanHistory />;
    case 'receipt':
      return <KioskReceiptPrompt />;
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
    case 'card-apply':
      return <KioskCardApply />;
    case 'card-form':
      return <KioskCardForm />;
    case 'card-pending':
      return <KioskCardPending />;
    case 'card-complete':
      return <KioskCardComplete />;
    default:
      return <KioskIdleScreen />;
  }
}

/** 키오스크 앱 컴포넌트 (클라이언트에서만 마운트됨) */
export default function KioskApp() {
  const screen = useAppStore((s) => s.screen);
  const kioskMode = useAppStore((s) => s.kioskMode);

  /* 고유 키: 화면명 + 모드 조합으로 AnimatePresence가 컴포넌트를 재생성하도록 함 */
  const screenKey = screen + '-' + (kioskMode || '');

  /* API 상태 확인 (health check, 실패 무시) */
  useEffect(() => {
    fetch('/api').catch(() => {});
  }, []);

  /* 유휴 자동 로그아웃: 화면 변경 시 타이머 리셋 (첫 화면 복귀) */
  useEffect(() => {
    const resetKiosk = () => {
      const { setAuthenticatedUser, clearSelectedBooks, clearReturnedLoans, setScreen } = useAppStore.getState();
      setAuthenticatedUser(null);
      clearSelectedBooks();
      clearReturnedLoans();
      setScreen('miryang-main');
    };
    const timer = setTimeout(() => {
      resetKiosk();
    }, 120000);
    return () => clearTimeout(timer);
  }, [screen]);

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
