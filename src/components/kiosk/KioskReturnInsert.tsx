/**
 * 도서 반납 삽입 화면
 *
 * [기능]
 * - 반납 도서 투입 안내 (CMS 관리)
 * - 사용자의 대출 중인 도서를 조회하여 자동 감지 시뮬레이션
 * - 2초 후 첫 번째 대출 도서를 자동 인식
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { EcoHeader, EcoSteps, EcoUserPill, EcoTicker, RETURN_STEPS } from '@/components/kiosk/eco/EcoChrome';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import { BookDown, ArrowDown, X, Info } from 'lucide-react';
import type { LoanItem } from '@/stores/useAppStore';
import { CmsText } from '@/components/kiosk/CmsText';
import { useScreenTheme, CmsImage } from '@/components/kiosk/CmsMedia';
import { useCmsText } from '@/hooks/useCmsContent';

export default function KioskReturnInsert() {
  const returnInsertTitle = useCmsText('returninsert.title', '도서반납');
  const theme = useScreenTheme('return-insert');
  useKioskSpeak(`${returnInsertTitle}. 반납할 도서를 투입구에 넣어주세요.`);
  const { setScreen, prevScreen, addReturnedLoan, authenticatedUser } = useAppStore();
  const [detected, setDetected] = useState(false);
  const [noLoans, setNoLoans] = useState(false);

  /** 사용자 대출 조회 및 자동 감지 처리 (이미 담은 도서 제외) */
  const checkAndDetect = useCallback(async () => {
    if (!authenticatedUser) {
      setNoLoans(true);
      return;
    }

    try {
      const res = await fetch(`/api/loans?userId=${authenticatedUser.id}`);
      if (!res.ok) {
        setNoLoans(true);
        return;
      }
      const loans: LoanItem[] = await res.json();
      const addedIds = new Set(useAppStore.getState().returnedLoans.map((l) => l.id));
      const active = loans.filter((l) => l.status === 'active' && !addedIds.has(l.id));

      if (active.length === 0) {
        // 남은 대출이 없으면 스캔 화면으로 (이미 담은 목록 확인)
        if (addedIds.size > 0) {
          setScreen('return-scanning');
        } else {
          setNoLoans(true);
        }
        return;
      }

      // 2초 후 아직 담지 않은 첫 번째 대출 도서 자동 감지
      setDetected(true);
      addReturnedLoan(active[0]);
      setTimeout(() => {
        setScreen('return-scanning');
      }, 800);
    } catch {
      setNoLoans(true);
    }
  }, [authenticatedUser, setScreen, addReturnedLoan]);

  /** 초기화 및 감지 시작 */
  useEffect(() => {
    const timer = setTimeout(checkAndDetect, 2000);
    return () => clearTimeout(timer);
  }, [checkAndDetect]);

  return (
    <div className="kiosk-screen eco-bg flex flex-col" style={theme.style}>
      <EcoHeader title="도서반납" />
      <EcoSteps steps={RETURN_STEPS} current={0} />
      <EcoUserPill />
      {/* 상단 타이틀 */}
      <header className="px-6 pt-6 pb-2">
        <h1 className="text-3xl font-bold text-center eco-title-text">
          <CmsText contentKey="returninsert.title" fallback="도서반납" />
        </h1>
      </header>

      {/* 메인 안내 영역 */}
      <main className="flex-1 flex flex-col items-center justify-center px-8">
        {noLoans ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <Info className="w-16 h-16 text-sky-400 mx-auto mb-4" />
            <p className="text-slate-700 text-lg font-medium mb-2">
              <CmsText contentKey="returninsert.no_loans_title" fallback="반납할 도서가 없습니다" />
            </p>
            <p className="text-slate-500 text-sm">
              <CmsText contentKey="returninsert.no_loans_desc" fallback="대출 중인 도서가 없습니다." />
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {/* 도서 아이콘 */}
            <CmsImage contentKey="returninsert.sensor_image_url" alt="반납구 안내 이미지" imgClassName="w-28 h-28 object-contain mx-auto mb-4" />
            <div className="relative mb-8">
              <div className="w-28 h-28 mx-auto rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center">
                {detected ? (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                    <BookDown className="w-14 h-14 text-emerald-400" />
                  </motion.div>
                ) : (
                  <BookDown className="w-14 h-14 text-slate-400" />
                )}
              </div>

              {/* 아래로 향하는 화살표 애니메이션 */}
              {!detected && (
                <motion.div
                  className="absolute -bottom-4 left-1/2 -translate-x-1/2"
                  animate={{ y: [0, 6, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  <ArrowDown className="w-8 h-8 text-sky-400" />
                </motion.div>
              )}
            </div>

            {/* 안내 메시지 */}
            {detected ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-emerald-600 text-lg font-semibold"
              >
                <CmsText contentKey="returninsert.detected_text" fallback="도서가 감지되었습니다" />
              </motion.p>
            ) : (
              <>
                <p className="text-slate-700 text-lg font-medium mb-2">
                  <CmsText contentKey="returninsert.instruction" fallback="반납할 도서를 하나씩 넣어주세요" />
                </p>
                <p className="text-slate-500 text-sm">
                  <CmsText contentKey="returninsert.instruction_sub" fallback="도서를 넣으면 자동으로 인식됩니다" />
                </p>
              </>
            )}
          </motion.div>
        )}
      </main>

      {/* 반납 시 유의사항 */}
      <div className="mx-6 mb-3 rounded-xl bg-white border border-slate-200 p-3 shrink-0">
        <p className="text-sm font-bold text-violet-500 mb-1.5">반납 시 유의사항</p>
        <p className="text-xs text-slate-600 leading-relaxed">
          1. 투입구 크기보다 큰 도서는 가까운 도서관에 반납해 주세요.
          <br />
          2. 책을 바르게 넣어주세요.
        </p>
      </div>

      {/* 하단 취소 버튼 */}
      <footer className="pb-10 px-6 flex gap-3">
        <button
          onClick={prevScreen}
          className="eco-btn-secondary flex-1"
        >
          <X className="w-5 h-5" />
          취소
        </button>
        {noLoans && (
          <button
            onClick={() => setScreen('miryang-main')}
            className="eco-btn-primary flex-1"
          >
            처음으로
          </button>
        )}
      </footer>
      <EcoTicker />
    </div>
  );
}
