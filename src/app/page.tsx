/**
 * 키오스크 시뮬레이션 메인 페이지
 */

'use client';

import { useState, useEffect } from 'react';
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
  const [mounted, setMounted] = useState(false);
  const screen = useAppStore((s) => s.screen);
  const kioskMode = useAppStore((s) => s.kioskMode);

  useEffect(() => {
    setMounted(true);
    fetch('/api/seed', { method: 'POST' }).catch(() => {});
  }, []);

  if (!mounted) return null;

  const screenKey = screen + '-' + (kioskMode || '');

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
