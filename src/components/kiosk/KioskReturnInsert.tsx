/**
 * 도서 반납 삽입 화면
 *
 * [기능]
 * - 반납 도서 투입 안내
 * - 사용자의 대출 중인 도서를 조회하여 자동 감지 시뮬레이션
 * - 2초 후 첫 번째 대출 도서를 자동 인식
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { BookDown, ArrowDown, X, Info } from 'lucide-react';
import type { LoanItem } from '@/stores/useAppStore';

export default function KioskReturnInsert() {
  const { setScreen, prevScreen, addReturnedLoan, clearReturnedLoans, authenticatedUser } = useAppStore();
  const [detected, setDetected] = useState(false);
  const [noLoans, setNoLoans] = useState(false);

  /** 사용자 대출 조회 및 자동 감지 처리 */
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
      const active = loans.filter((l) => l.status === 'active');

      if (active.length === 0) {
        setNoLoans(true);
        return;
      }

      // 2초 후 첫 번째 대출 도서 자동 감지
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
    clearReturnedLoans();
    const timer = setTimeout(checkAndDetect, 2000);
    return () => clearTimeout(timer);
  }, [clearReturnedLoans, checkAndDetect]);

  return (
    <div className="kiosk-screen kiosk-dark-bg flex flex-col">
      {/* 상단 타이틀 */}
      <header className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-white">도서반납</h1>
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
            <p className="text-slate-200 text-lg font-medium mb-2">
              반납할 도서가 없습니다
            </p>
            <p className="text-slate-500 text-sm">
              대출 중인 도서가 없습니다.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {/* 도서 아이콘 */}
            <div className="relative mb-8">
              <div className="w-28 h-28 mx-auto rounded-2xl bg-white/5 border border-slate-600 flex items-center justify-center">
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
                className="text-emerald-400 text-lg font-semibold"
              >
                도서가 감지되었습니다
              </motion.p>
            ) : (
              <>
                <p className="text-slate-200 text-lg font-medium mb-2">
                  반납할 도서를 하나씩 넣어주세요
                </p>
                <p className="text-slate-500 text-sm">
                  도서를 넣으면 자동으로 인식됩니다
                </p>
              </>
            )}
          </motion.div>
        )}
      </main>

      {/* 하단 취소 버튼 */}
      <footer className="pb-10 px-6">
        <button
          onClick={prevScreen}
          className="kiosk-btn bg-slate-700 hover:bg-slate-600 text-white w-full"
        >
          <X className="w-5 h-5" />
          취소
        </button>
      </footer>
    </div>
  );
}
