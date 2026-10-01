/**
 * 회원증 스캔 화면
 *
 * [기능]
 * - 회원증 RFID 스캔 안내 (CMS 관리)
 * - 카드 태그 시뮬레이션: 데모 회원증 인식 → authenticatedUser 설정
 * - 대출 모드 → PIN 입력으로 이동 (본인 확인)
 * - 반납 모드 → PIN 없이 바로 반납 투입으로 이동 (실제 기기와 동일)
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import type { SimUser } from '@/stores/useAppStore';
import { EcoHeader, EcoSteps, EcoUserPill, EcoTicker, LOAN_STEPS, RETURN_STEPS } from '@/components/kiosk/eco/EcoChrome';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import { CreditCard, CheckCircle2, X } from 'lucide-react';
import { CmsText } from '@/components/kiosk/CmsText';
import { useScreenTheme } from '@/components/kiosk/CmsMedia';
import { useCmsText } from '@/hooks/useCmsContent';

export default function KioskAuthScan() {
  const authScanTitle = useCmsText('authscan.title', '회원인증');
  const theme = useScreenTheme('auth-scan');
  useKioskSpeak(`${authScanTitle}. 회원증을 카드 리더기에 가져다 대세요. 회원증이 없으면 회원증 없이 이용하기를 눌러주세요.`);
  const { setScreen, prevScreen, kioskMode, setAuthenticatedUser } = useAppStore();
  const [status, setStatus] = useState<'scanning' | 'recognized' | 'skipped'>('scanning');

  const flowTitle = kioskMode === 'return' ? '도서반납' : '도서대출';
  const flowSteps = kioskMode === 'return' ? RETURN_STEPS : LOAN_STEPS;

  /** 데모 회원증 인식 (RFID 태그 시뮬레이션 — PIN 입력 없음) */
  const recognizeDemoCard = async (): Promise<void> => {
    try {
      const res = await fetch('/api/users', { headers: { 'X-PIN': '1234' } });
      if (res.ok) {
        const users: SimUser[] = await res.json();
        if (users.length > 0) {
          setAuthenticatedUser({ ...users[0], pin: '1234' });
        }
      }
    } catch {
      // 인식 실패 시에도 화면은 진행 (다음 화면에서 안내)
    }
  };

  /** 다음 화면 결정 (반납은 PIN 없이 바로 투입 — 실제 기기와 동일) */
  const getNextScreen = () => (kioskMode === 'return' ? 'return-insert' as const : 'auth-pin' as const);

  /** 2초 후 자동 인식 시뮬레이션 */
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setStatus('recognized');
    }, 2000);
    const moveTimer = setTimeout(async () => {
      if (cancelled) return;
      await recognizeDemoCard();
      if (!cancelled) setScreen(getNextScreen());
    }, 3500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(moveTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setScreen, kioskMode]);

  /** 회원증 없이 이용하기 → 다음 화면으로 이동 */
  const handleSkip = async () => {
    setStatus('skipped');
    await recognizeDemoCard();
    setTimeout(() => {
      setScreen(getNextScreen());
    }, 500);
  };

  return (
    <div className="kiosk-screen eco-bg flex flex-col" style={theme.style}>
      <EcoHeader title={flowTitle} />
      <EcoSteps steps={flowSteps} current={0} />
      <EcoUserPill />
      {/* 상단 타이틀 */}
      <header className="px-6 pt-6 pb-2">
        <h2 className="text-3xl font-bold text-center eco-title-text">
          <CmsText contentKey="authscan.title" fallback="회원인증" />
        </h2>
      </header>

      {/* 메인 스캔 영역 */}
      <main className="flex-1 flex flex-col items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="eco-card w-full max-w-sm px-6 py-8 text-center"
        >
          {/* 카드 아이콘 및 스캔 애니메이션 */}
          <div className="relative mb-6">
            <div className="w-28 h-28 mx-auto rounded-2xl bg-sky-50 border-2 border-sky-300/60 flex items-center justify-center">
              {status === 'scanning' ? (
                <CreditCard className="w-12 h-12 text-sky-500" />
              ) : (
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              )}
            </div>

            {/* 스캔 링 애니메이션 */}
            {status === 'scanning' && (
              <div className="absolute inset-0 w-28 h-28 mx-auto rounded-2xl card-scan-ring" />
            )}
          </div>

          {/* 안내 메시지 */}
          {status === 'scanning' && (
            <motion.p
              className="text-slate-700 text-lg font-semibold mb-2"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <CmsText contentKey="authscan.instruction" fallback="회원증을 가져다 대세요" />
            </motion.p>
          )}

          {status === 'recognized' && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-emerald-600 text-lg font-semibold"
            >
              인식되었습니다
            </motion.p>
          )}

          {status === 'skipped' && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sky-600 text-base"
            >
              {kioskMode === 'return' ? '반납으로 이동합니다' : 'PIN 입력으로 이동합니다'}
            </motion.p>
          )}

          <p className="text-slate-500 text-sm mt-3">
            RFID 카드 리더기에 회원증을 대주세요
          </p>

          {/* 취소 버튼 */}
          <button
            onClick={prevScreen}
            className="eco-btn-secondary w-full mt-6"
          >
            <X className="w-5 h-5" />
            취소
          </button>

          {/* 데모 모드 스킵 버튼 */}
          {status === 'scanning' && (
            <button
              onClick={handleSkip}
              className="text-slate-500 hover:text-slate-700 text-sm py-2 mt-1 transition-colors"
            >
              <CmsText contentKey="authscan.demo_button_text" fallback="회원증 없이 이용하기" />
            </button>
          )}
        </motion.div>
      </main>

      <EcoTicker />
    </div>
  );
}
