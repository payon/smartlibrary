/**
 * 키오스크 시뮬레이션 메인 페이지
 *
 * [역할]
 * - 키오스크 UI / 관리자 대시보드 전환
 * - adminMode가 true이면 관리자 대시보드 렌더
 * - adminMode가 false이면 키오스크 UI 렌더
 */

'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { useAdminStore } from '@/stores/useAdminStore';
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
import AdminLogin from '@/components/admin/AdminLogin';
import AdminDashboard from '@/components/admin/AdminDashboard';

function ScreenRouter({ screen }: { screen: KioskViewName }) {
  switch (screen) {
    case 'idle': return <KioskIdleScreen />;
    case 'main-menu': return <KioskMainMenu />;
    case 'auth-scan': return <KioskAuthScan />;
    case 'auth-pin': return <KioskAuthPin />;
    case 'loan-select': return <KioskLoanSelect />;
    case 'loan-confirm': return <KioskLoanConfirm />;
    case 'loan-complete': return <KioskLoanComplete />;
    case 'return-insert': return <KioskReturnInsert />;
    case 'return-scanning': return <KioskReturnScanning />;
    case 'return-confirm': return <KioskReturnConfirm />;
    case 'return-complete': return <KioskReturnComplete />;
    default: return <KioskIdleScreen />;
  }
}

export default function Home() {
  const screen = useAppStore((s) => s.screen);
  const kioskMode = useAppStore((s) => s.kioskMode);
  const adminMode = useAppStore((s) => s.adminMode);
  const setAdminMode = useAppStore((s) => s.setAdminMode);
  const isAdminAuthenticated = useAdminStore((s) => s.isAuthenticated);

  /* 시드 데이터 초기화 (최초 1회) */
  useEffect(() => {
    fetch('/api/seed', { method: 'POST' }).catch(() => {});
  }, []);

  // adminMode가 켜졌는데 인증이 풀리면 adminMode도 끄기
  useEffect(() => {
    if (adminMode && !isAdminAuthenticated) {
      // 관리자 인증이 안 된 상태면 로그인 화면 보여주기 위해 유지
    }
  }, [adminMode, isAdminAuthenticated]);

  const screenKey = screen + '-' + (kioskMode || '');

  // 관리자 모드
  if (adminMode) {
    if (isAdminAuthenticated) {
      return <AdminDashboard />;
    }
    return <AdminLogin />;
  }

  // 키오스크 모드
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
