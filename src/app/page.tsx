/**
 * 키오스크 시뮬레이션 메인 페이지
 *
 * [역할]
 * - 키오스크 UI / 관리자 대시보드 전환
 * - adminMode가 true이면 관리자 대시보드 렌더
 * - adminMode가 false이면 키오스크 UI 렌더
 * - CMS 콘텐츠 30초 폴링으로 실시간 동기화
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { useAppStore, hydrateA11ySettings } from '@/stores/useAppStore';
import { useAdminStore } from '@/stores/useAdminStore';
import { useCmsContent } from '@/hooks/useCmsContent';
import { useKioskConfig } from '@/hooks/useKioskConfig';
import { KIOSK_VIEW_NAMES } from '@/lib/constants';
import { isSafeColor } from '@/components/kiosk/CmsMedia';
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
import KioskGuide from '@/components/kiosk/KioskGuide';
import { CircleHelp } from 'lucide-react';
import AdminLogin from '@/components/admin/AdminLogin';
import AdminDashboard from '@/components/admin/AdminDashboard';

function ScreenRouter({ screen }: { screen: KioskViewName }) {
  switch (screen) {
    case 'idle': return <KioskIdleScreen />;
    case 'miryang-main': return <KioskIdleScreen />;
    case 'signup-guide': return <KioskSignupGuide />;
    case 'main-menu': return <KioskMainMenu />;
    case 'card-apply': return <KioskCardApply />;
    case 'card-form': return <KioskCardForm />;
    case 'card-pending': return <KioskCardPending />;
    case 'card-complete': return <KioskCardComplete />;
    case 'auth-scan': return <KioskAuthScan />;
    case 'auth-pin': return <KioskAuthPin />;
    case 'loan-select': return <KioskLoanSelect />;
    case 'loan-confirm': return <KioskLoanConfirm />;
    case 'loan-dispense': return <KioskLoanDispense />;
    case 'loan-history': return <KioskLoanHistory />;
    case 'receipt': return <KioskReceiptPrompt />;
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
  const fontSize = useAppStore((s) => s.fontSize);
  const highContrast = useAppStore((s) => s.highContrast);
  const cmsContent = useAppStore((s) => s.cmsContent);
  const brightness = useAppStore((s) => s.brightness);
  const idleTimeoutSec = useAppStore((s) => s.idleTimeoutSec);
  const resetStore = useAppStore((s) => s.resetStore);
  const isAdminAuthenticated = useAdminStore((s) => s.isAuthenticated);
  const screenRef = useRef<HTMLDivElement>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  /* 배리어프리 저장 설정 복원 (최초 1회) */
  useEffect(() => {
    hydrateA11ySettings();
  }, []);

  /* 글자 크기 → html 루트 폰트 스케일 (rem 단위 전체 확대, 키오스크 전용) */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (adminMode) {
      root.style.removeProperty('font-size');
      return;
    }
    if (fontSize === 'large') {
      root.style.fontSize = '112.5%';
    } else if (fontSize === 'xlarge') {
      root.style.fontSize = '125%';
    } else {
      root.style.removeProperty('font-size');
    }
  }, [fontSize, adminMode]);

  /* 화면 전환 시 이전 음성 중단 (멘트 겹침 방지)
     — 제거됨: 자식 화면의 useKioskSpeak가 마운트 시 재생을 시작하는데,
     부모 effect가 그 직후 실행되어 멘트를 즉시 죽이는 버그가 있었음.
     겹침 방지는 각 화면 언마운트 cleanup(stopSpeaking)이 담당 */

  /* 유휴 자동 로그아웃: 관리자 설정 시간 무조작 시 첫 화면으로 복귀 */
  useEffect(() => {
    if (adminMode || screen === 'miryang-main') return;
    const timer = setTimeout(() => {
      resetStore();
    }, idleTimeoutSec * 1000);
    return () => clearTimeout(timer);
  }, [screen, kioskMode, adminMode, resetStore, idleTimeoutSec]);

  /* 화면 전환 시 포커스 이동 (키보드 사용자) */
  useEffect(() => {
    if (adminMode) return;
    screenRef.current?.focus({ preventScroll: true });
  }, [screen, adminMode]);

  /* 관리자 세션 복구 시도 (페이지 새로고침 시) */
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/admin/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            useAdminStore.getState().setAdminUser(data.user);
          }
        }
      } catch {
        // 세션 확인 실패는 무시
      }
    };
    checkSession();
  }, []);

  /* CMS 콘텐츠 폴링 활성화 (키오스크 모드에서만) */
  useCmsContent();

  /* 키오스크 하드웨어 설정 동기화 (음량/밝기/유휴시간) */
  useKioskConfig();

  const screenKey = screen + '-' + (kioskMode || '');
  const screenName = KIOSK_VIEW_NAMES[screen] || '키오스크';
  // 안내/메인메뉴에는 툴바 내 도움말 버튼이 있어 FAB 숨김
  const showGuideFab = !adminMode && screen !== 'miryang-main' && screen !== 'main-menu';

  // 관리자 모드
  if (adminMode) {
    if (isAdminAuthenticated) {
      return <AdminDashboard />;
    }
    return <AdminLogin />;
  }

  // 키오스크 모드 (관리자 지정 전역 컬러를 CSS 변수로 주입 — 즉시 반영)
  const primaryRaw = cmsContent['global.primary_color'] || '';
  const accentRaw = cmsContent['global.accent_color'] || '';
  const primaryColor = isSafeColor(primaryRaw) ? primaryRaw.trim() : undefined;
  const accentColor = isSafeColor(accentRaw) ? accentRaw.trim() : undefined;
  return (
    <MotionConfig reducedMotion="user">
    <div
      className="kiosk-frame"
      data-fontsize={fontSize}
      data-contrast={highContrast ? 'high' : 'normal'}
      style={
        {
          ...(primaryColor ? { '--kiosk-primary': primaryColor } : {}),
          ...(accentColor ? { '--kiosk-accent': accentColor } : {}),
          ...(brightness !== 100 ? { filter: `brightness(${brightness / 100})` } : {}),
        } as React.CSSProperties
      }
    >
      {/* 스크린리더용 화면 안내 (시각 숨김) */}
      <span className="sr-only" role="status" aria-live="polite">
        {screenName}입니다
      </span>
      <AnimatePresence mode="wait">
        <motion.div
          key={screenKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="h-screen max-h-screen"
        >
          <div ref={screenRef} tabIndex={-1} style={{ outline: 'none' }}>
            <ScreenRouter screen={screen} />
          </div>
        </motion.div>
      </AnimatePresence>
      {/* 전 화면 공용 따라하기 도움말 버튼 */}
      {showGuideFab && (
        <button
          onClick={() => setGuideOpen(true)}
          className="absolute bottom-24 right-4 z-40 h-12 px-4 rounded-2xl bg-sky-600/90 text-white text-sm font-semibold flex items-center gap-1.5 shadow-lg"
          aria-label="따라하기 도움말 열기"
        >
          <CircleHelp className="w-5 h-5" />
          도움말
        </button>
      )}
      {guideOpen && <KioskGuide onClose={() => setGuideOpen(false)} />}
    </div>
    </MotionConfig>
  );
}
