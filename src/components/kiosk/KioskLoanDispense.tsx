/**
 * 대출처리 (도서 수령) 화면 — 실기기 참조
 *
 * [기능]
 * - 배출구에서 도서 수령 시뮬레이션
 * - "N권 중 M번째 도서 수령" 진행 표시
 * - 완료 후 영수증 발급 화면으로 이동
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PackageCheck } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import { CmsText } from '@/components/kiosk/CmsText';
import { useScreenTheme } from '@/components/kiosk/CmsMedia';
import { useCmsText } from '@/hooks/useCmsContent';
import { EcoHeader, EcoSteps, EcoUserPill, EcoTicker, LOAN_STEPS } from '@/components/kiosk/eco/EcoChrome';

export default function KioskLoanDispense() {
  const title = useCmsText('loandispense.title', '대출처리');
  const theme = useScreenTheme('loan-dispense');
  const { dispenseQueue, setScreen } = useAppStore();
  const [current, setCurrent] = useState(0);

  const total = Math.max(dispenseQueue.length, 1);
  const done = current >= dispenseQueue.length;

  useKioskSpeak(
    done
      ? '도서를 모두 수령했습니다.'
      : `${title}. 배출구에서 도서를 수령하세요. ${total}권 중 ${current + 1}번째입니다.`
  );

  /* 권별 자동 수령 시뮬레이션 (2초 간격) */
  useEffect(() => {
    if (dispenseQueue.length === 0) {
      const t = setTimeout(() => setScreen('receipt'), 1500);
      return () => clearTimeout(t);
    }
    if (done) {
      const t = setTimeout(() => setScreen('receipt'), 1200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCurrent((c) => c + 1), 2000);
    return () => clearTimeout(t);
  }, [dispenseQueue.length, done, current, setScreen]);

  const book = dispenseQueue[Math.min(current, dispenseQueue.length - 1)];

  return (
    <div className="kiosk-screen eco-bg flex flex-col" style={theme.style}>
      <EcoHeader title="도서대출" />
      <EcoSteps steps={LOAN_STEPS} current={3} />
      <EcoUserPill />

      <header className="px-6 pt-6 pb-2">
        <h2 className="text-3xl font-bold text-center eco-title-text">
          <CmsText contentKey="loandispense.title" fallback="대출처리" />
        </h2>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="eco-card w-full max-w-sm px-6 py-8 text-center">
          <motion.div
            key={current}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 mx-auto rounded-full bg-sky-100 flex items-center justify-center mb-4"
          >
            <PackageCheck className="w-10 h-10 text-sky-600" />
          </motion.div>
          {done || dispenseQueue.length === 0 ? (
            <p className="text-lg font-semibold text-slate-700">
              도서 수령이 완료되었습니다
            </p>
          ) : (
            <>
              <p className="text-lg font-semibold text-slate-700">
                도서가 배출되었습니다.<br />
                배출구에서 도서를 수령하세요.
              </p>
              <p className="text-sky-600 font-bold mt-2">
                {total}권 중 {current + 1}번째 도서 수령
              </p>
              {book && (
                <p className="text-sm text-slate-500 mt-2 truncate">
                  {book.title} · {book.author}
                </p>
              )}
              {/* 진행 바 */}
              <div className="h-2 rounded-full bg-slate-200 mt-4 overflow-hidden" aria-hidden="true">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all"
                  style={{ width: `${((current + 1) / total) * 100}%` }}
                />
              </div>
            </>
          )}
        </div>
      </main>

      <EcoTicker />
    </div>
  );
}
