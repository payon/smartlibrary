/**
 * 대출 완료 화면
 *
 * [기능]
 * - 성공 체크마크 애니메이션 (CMS 관리)
 * - 사용자 대출 통계 대시보드
 * - 대출 도서 목록 및 반납일 표시
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { EcoHeader, EcoSteps, EcoUserPill, EcoTicker, LOAN_STEPS } from '@/components/kiosk/eco/EcoChrome';
import { useKioskSpeak } from '@/hooks/useKioskSpeak';
import type { LoanItem } from '@/stores/useAppStore';
import { MAX_LOAN_COUNT, LOAN_PERIOD_DAYS } from '@/lib/constants';
import { CheckCircle2, BookOpen, AlertTriangle, CheckCircle } from 'lucide-react';
import { CmsText } from '@/components/kiosk/CmsText';
import KioskReceipt from '@/components/kiosk/KioskReceipt';
import { useScreenTheme } from '@/components/kiosk/CmsMedia';
import { useCmsText } from '@/hooks/useCmsContent';

export default function KioskLoanComplete() {
  const loanCompleteTitle = useCmsText('loancomplete.title', '대출완료');
  const theme = useScreenTheme('loan-complete');
  useKioskSpeak(`${loanCompleteTitle}. 대출이 완료되었습니다.`);
  const { authenticatedUser, setScreen, clearSelectedBooks, setAuthenticatedUser, receiptPrint } = useAppStore();
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

  /** 확인 버튼 - 세션 정리(선택/인증 초기화) 후 대기 화면으로 */
  const handleConfirm = () => {
    clearSelectedBooks();
    setAuthenticatedUser(null);
    setScreen('miryang-main');
  };

  const activeLoans = loans.filter((l) => l.status === 'active');

  return (
    <div className="kiosk-screen eco-bg flex flex-col" style={theme.style}>
      <EcoHeader title="도서대출" />
      <EcoSteps steps={LOAN_STEPS} current={5} />
      <EcoUserPill />
      {/* 성공 타이틀 */}
      <header className="text-center pt-6 pb-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <CheckCircle2 className="w-9 h-9 text-white" />
        </motion.div>
        <h1 className="text-3xl font-bold text-center eco-title-text">
          <CmsText contentKey="loancomplete.title" fallback="대출완료" />
        </h1>
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

      {/* 대출 영수증 (출력 선택 시에만) */}
      <div className="flex-1 overflow-y-auto kiosk-scroll px-5 pb-4">
        {receiptPrint ? (
          <div className="mb-2">
            <KioskReceipt
              kind="loan"
              userName={authenticatedUser?.name || ''}
              cardNumber={authenticatedUser?.cardNumber || ''}
              phone={authenticatedUser?.phone}
              books={activeLoans.map((loan) => ({
                title: loan.book?.title || '도서',
                author: loan.book?.author || '',
                loanDate: loan.loanDate,
                dueDate: loan.dueDate,
              }))}
            />
          </div>
        ) : (
          <div className="eco-card p-6 text-center mb-2">
            <p className="text-slate-600">영수증을 출력하지 않았습니다.</p>
            <p className="text-sm text-slate-500 mt-1">반납 예정일을 꼭 기억하세요.</p>
          </div>
        )}
        {receiptPrint && activeLoans.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">대출 도서가 없습니다</p>
        )}
      </div>

      {/* 확인 버튼 */}
      <footer className="pb-8 px-5">
        <button
          onClick={handleConfirm}
          className="eco-btn-primary w-full"
        >
          <CmsText contentKey="loancomplete.confirm_button_text" fallback="확인하기" />
        </button>
      </footer>
      <EcoTicker />
    </div>
  );
}
