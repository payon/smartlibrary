/**
 * 대출 완료 화면
 *
 * [기능]
 * - 성공 체크마크 애니메이션
 * - 사용자 대출 통계 대시보드
 * - 대출 도서 목록 및 반납일 표시
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import type { LoanItem } from '@/stores/useAppStore';
import { MAX_LOAN_COUNT, LOAN_PERIOD_DAYS } from '@/lib/constants';
import { CheckCircle2, BookOpen, AlertTriangle, CheckCircle } from 'lucide-react';

export default function KioskLoanComplete() {
  const { authenticatedUser, setScreen, clearSelectedBooks } = useAppStore();
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [stats, setStats] = useState({ available: MAX_LOAN_COUNT, current: 0, overdue: 0 });

  /** 대출 기록 및 통계 조회 */
  useEffect(() => {
    const fetchData = async () => {
      if (!authenticatedUser) return;
      try {
        const res = await fetch(`/api/loans?userId=${authenticatedUser.id}`);
        if (res.ok) {
          const data: LoanItem[] = await res.json();
          setLoans(data);
          const active = data.filter((l) => l.status === 'active');
          const overdue = data.filter((l) => {
            if (l.status !== 'active') return false;
            return new Date(l.dueDate) < new Date();
          });
          setStats({
            available: MAX_LOAN_COUNT - active.length,
            current: active.length,
            overdue: overdue.length,
          });
        }
      } catch {
        // 조회 실패 무시
      }
    };
    fetchData();
  }, [authenticatedUser]);

  /** 확인 버튼 - 초기화 후 대기 화면으로 */
  const handleConfirm = () => {
    clearSelectedBooks();
    setScreen('idle');
  };

  /** 반납일 포맷팅 */
  const formatDueDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const activeLoans = loans.filter((l) => l.status === 'active');

  return (
    <div className="kiosk-screen kiosk-light-bg flex flex-col">
      {/* 성공 타이틀 */}
      <header className="text-center pt-10 pb-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <CheckCircle2 className="w-9 h-9 text-white" />
        </motion.div>
        <h1 className="text-2xl font-bold text-emerald-600">대출완료</h1>
      </header>

      {/* 통계 대시보드 */}
      <div className="px-5 mb-4">
        <div className="grid grid-cols-3 gap-3">
          {/* 대출 가능 권수 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-emerald-50 rounded-xl p-3 text-center"
          >
            <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-emerald-700">{stats.available}</p>
            <p className="text-[10px] text-emerald-600">대출 가능</p>
          </motion.div>

          {/* 현재 대출 권수 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-sky-50 rounded-xl p-3 text-center"
          >
            <BookOpen className="w-6 h-6 text-sky-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-sky-700">{stats.current}</p>
            <p className="text-[10px] text-sky-600">대출 중</p>
          </motion.div>

          {/* 연체 도서 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-red-50 rounded-xl p-3 text-center"
          >
            <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-red-700">{stats.overdue}</p>
            <p className="text-[10px] text-red-600">연체</p>
          </motion.div>
        </div>
      </div>

      {/* 대출 도서 목록 */}
      <div className="flex-1 overflow-y-auto kiosk-scroll px-5 pb-4">
        <p className="text-sm font-semibold text-slate-600 mb-2">대출 도서 목록</p>
        {activeLoans.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">대출 도서가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {activeLoans.map((loan, idx) => (
              <motion.div
                key={loan.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * idx }}
                className="flex gap-3 bg-white rounded-xl p-3 border border-slate-100"
              >
                <div className="w-10 h-14 rounded-lg bg-slate-100 shrink-0 overflow-hidden">
                  {loan.book?.coverUrl ? (
                    <img src={loan.book.coverUrl} alt={loan.book.title} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{loan.book?.title || '도서'}</p>
                  <p className="text-xs text-slate-400">{loan.book?.author}</p>
                  <p className="text-xs text-sky-600 mt-0.5">반납: {formatDueDate(loan.dueDate)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 확인 버튼 */}
      <footer className="pb-8 px-5">
        <button
          onClick={handleConfirm}
          className="kiosk-btn bg-slate-800 hover:bg-slate-700 text-white w-full"
        >
          확인하기
        </button>
      </footer>
    </div>
  );
}
