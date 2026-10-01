/**
 * 도서 반납 스캔 화면
 *
 * [기능]
 * - RFID 스캔 애니메이션 (CMS 관리)
 * - 인식된 대출 도서 표시
 * - 추가 반납 또는 반납 완료 선택
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { EcoHeader, EcoSteps, EcoUserPill, EcoTicker, RETURN_STEPS } from '@/components/kiosk/eco/EcoChrome';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import { BookPlus, CheckCircle2, Loader2 } from 'lucide-react';
import type { LoanItem } from '@/stores/useAppStore';
import { CmsText } from '@/components/kiosk/CmsText';
import { useScreenTheme } from '@/components/kiosk/CmsMedia';
import { useCmsText } from '@/hooks/useCmsContent';

export default function KioskReturnScanning() {
  const returnScanningTitle = useCmsText('returnscanning.title', '도서반납');
  const theme = useScreenTheme('return-scanning');
  useKioskSpeak(`${returnScanningTitle}. 도서를 인식하고 있습니다.`);
  const { returnedLoans, setScreen, authenticatedUser } = useAppStore();
  const [scanning, setScanning] = useState(true);
  const [remainingLoans, setRemainingLoans] = useState<LoanItem[]>([]);

  /** 스캔 완료 + 남은 대출 도서 조회 */
  useEffect(() => {
    const timer = setTimeout(() => {
      setScanning(false);
    }, 2000);

    // 남은 대출 도서 조회
    if (authenticatedUser) {
      fetch(`/api/loans?userId=${authenticatedUser.id}`)
        .then((res) => res.json())
        .then((loans: LoanItem[]) => {
          const active = loans.filter(
            (l) =>
              l.status === 'active' &&
              !returnedLoans.some((r) => r.id === l.id)
          );
          setRemainingLoans(active);
        })
        .catch(() => {});
    }

    return () => clearTimeout(timer);
  }, [authenticatedUser, returnedLoans]);

  /** 더 넣기 (남은 도서가 있을 때) */
  const handleMore = () => {
    setScreen('return-insert');
  };

  /** 반납 완료 */
  const handleComplete = () => {
    setScreen('return-confirm');
  };

  return (
    <div className="kiosk-screen eco-bg flex flex-col" style={theme.style}>
      <EcoHeader title="도서반납" />
      <EcoSteps steps={RETURN_STEPS} current={0} />
      <EcoUserPill />
      {/* 상단 타이틀 */}
      <header className="px-6 pt-6 pb-2">
        <h1 className="text-3xl font-bold text-center eco-title-text">
          <CmsText contentKey="returnscanning.title" fallback="도서반납" />
        </h1>
        <p className="text-slate-600 text-sm mt-1 text-center">
          인식된 도서: {returnedLoans.length}권
        </p>
      </header>

      {/* 스캔 애니메이션 영역 */}
      <main className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="relative mb-8 flex items-center justify-center">
          {/* 바깥쪽 펄스 링 */}
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute w-32 h-32 rounded-full border-2 border-sky-400"
          />
          {/* 안쪽 펄스 링 */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute w-24 h-24 rounded-full border border-sky-400"
          />
          {/* 중심 아이콘 */}
          <div className="relative w-32 h-32 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center">
            {scanning ? (
              <Loader2 className="w-12 h-12 text-sky-400 animate-spin" />
            ) : (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              </motion.div>
            )}
          </div>
        </div>

        {/* 상태 메시지 */}
        {scanning ? (
          <motion.p
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-slate-700 text-base"
          >
            <CmsText contentKey="returnscanning.scanning_text" fallback="도서가 인식되었습니다. 잠시 기다려주세요." />
          </motion.p>
        ) : (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-emerald-600 text-lg font-semibold"
          >
            <CmsText contentKey="returnscanning.complete_text" fallback="스캔이 완료되었습니다" />
          </motion.p>
        )}

        {/* 인식된 도서 목록 */}
        {returnedLoans.length > 0 && (
          <div className="mt-8 w-full max-w-xs space-y-2">
            {returnedLoans.map((loan, idx) => (
              <motion.div
                key={loan.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="eco-card rounded-lg px-4 py-2.5 flex items-center gap-3"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-800 font-medium truncate">{loan.book?.title || '도서'}</p>
                  <p className="text-xs text-slate-500">{loan.book?.author || ''}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* 하단 버튼 */}
      {scanning ? (
        <footer className="pb-10 px-6">
          <div className="eco-btn-secondary w-full opacity-60 cursor-wait">
            <Loader2 className="w-5 h-5 animate-spin" />
            스캔 중...
          </div>
        </footer>
      ) : (
        <footer className="pb-10 px-6 flex flex-col gap-3">
          {remainingLoans.length > 0 && (
            <button
              onClick={handleMore}
              className="eco-btn-secondary w-full"
            >
              <BookPlus className="w-5 h-5" />
              <CmsText contentKey="returnscanning.more_button_text" fallback={`더 넣기 (${remainingLoans.length}권 남음)`} />
            </button>
          )}
          <button
            onClick={handleComplete}
            className="eco-btn-primary w-full"
          >
            <CheckCircle2 className="w-5 h-5" />
            <CmsText contentKey="returnscanning.complete_button_text" fallback="반납 완료하기" />
          </button>
        </footer>
      )}
      <EcoTicker />
    </div>
  );
}
